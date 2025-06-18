import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { initializeDb } from './database';
import { filterTextByVocabulary, calculateHeuristicScore } from './gameLogic';

// Initialize DB on startup
initializeDb();

const app = express();
app.use(express.json());
app.use(express.static('public')); // Serve frontend files

const PORT = 3333;

// --- API ROUTES ---

// 1. Start a new game session
app.post('/api/sessions', (req, res) => {
    const sessionId = uuidv4();
    const stmt = db.prepare('INSERT INTO Sessions (id) VALUES (?)');
    stmt.run(sessionId);
    res.status(201).json({ sessionId });
});

// GET THE ENTIRE STATE OF A SESSION
app.get('/api/sessions/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = db.prepare('SELECT id FROM Sessions WHERE id = ?').get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const vocabulary = db.prepare('SELECT word FROM Vocabulary WHERE sessionId = ?').all(sessionId).map((r: any) => r.word);
    const trainingPhrases = db.prepare('SELECT id, originalPhrase, filteredPhrase FROM TrainingPhrases WHERE sessionId = ?').all(sessionId);
    const prompts = db.prepare('SELECT id, promptText, filteredPromptText FROM Prompts WHERE sessionId = ?').all(sessionId);

    res.json({ id: sessionId, vocabulary, trainingPhrases, prompts });
});

// 2. Add vocabulary to a session
app.post('/api/sessions/:sessionId/vocabulary', (req, res) => {
    const { sessionId } = req.params;

    // Check if the body exists and if it has a 'text' property that is a string
    if (!req.body || typeof req.body.text !== 'string') {
        return res.status(400).json({ 
            error: "Request body must be a JSON object with a 'text' property." 
        });
    }

    const { text }: { text: string } = req.body;

    // Process the text into an array of words
    const words = (text.toLowerCase().match(/\b(\w+)\b/g) || []);

    // If the user submitted an empty textarea, there's nothing to do.
    if (words.length === 0) {
        return res.status(200).json({ message: "No new tokens to add." });
    }

    const insert = db.prepare('INSERT OR IGNORE INTO Vocabulary (sessionId, word) VALUES (?, ?)');
    
    const insertMany = db.transaction((wordList: string[]) => {
        for (const word of wordList) {
            insert.run(sessionId, word);
        }
    });

    try {
        insertMany(words);
        res.status(200).json({ message: `${words.length} tokens processed and saved.` });
    } catch (err) {
        console.error("Vocabulary insert transaction failed:", err);
        res.status(500).json({ error: "Could not save vocabulary to the database." });
    }
});

// 3. Add a training phrase
app.post('/api/sessions/:sessionId/training', (req, res) => {
    const { sessionId } = req.params;
    const { phrase }: { phrase: string } = req.body;

    // Get current vocabulary for this session
    const vocabRows = db.prepare('SELECT word FROM Vocabulary WHERE sessionId = ?').all(sessionId) as { word: string }[];
    const vocabulary = new Set(vocabRows.map(row => row.word));
    
    const filteredPhrase = filterTextByVocabulary(phrase, vocabulary);

    const stmt = db.prepare('INSERT INTO TrainingPhrases (sessionId, originalPhrase, filteredPhrase) VALUES (?, ?, ?)');
    const info = stmt.run(sessionId, phrase, filteredPhrase);

    res.status(201).json({ id: info.lastInsertRowid, originalPhrase: phrase, filteredPhrase });
});

// BATCH Add Training Phrases
app.post('/api/sessions/:sessionId/training/batch', (req, res) => {
    const { sessionId } = req.params;
    const { phrases }: { phrases: string[] } = req.body;

    if (!phrases || !Array.isArray(phrases)) {
        return res.status(400).json({ error: 'Request body must include a "phrases" array.' });
    }

    const vocabRows = db.prepare('SELECT word FROM Vocabulary WHERE sessionId = ?').all(sessionId) as { word: string }[];
    const vocabulary = new Set(vocabRows.map(row => row.word));
    
    // Using INSERT OR IGNORE thanks to our new UNIQUE constraint.
    const insert = db.prepare('INSERT OR IGNORE INTO TrainingPhrases (sessionId, originalPhrase, filteredPhrase) VALUES (?, ?, ?)');

    const insertMany = db.transaction((phraseList) => {
        let insertedCount = 0;
        for (const phrase of phraseList) {
            const filteredPhrase = filterTextByVocabulary(phrase, vocabulary);
            const info = insert.run(sessionId, phrase, filteredPhrase);
            // info.changes will be 1 if a row was inserted, 0 if it was ignored.
            if (info.changes > 0) {
                insertedCount++;
            }
        }
        return insertedCount;
    });

    try {
        const count = insertMany(phrases);
        res.status(201).json({ message: `Successfully processed ${phrases.length} phrases, added ${count} new ones.` });
    } catch (err) {
        console.error("Training phrase batch insert failed:", err);
        res.status(500).json({ error: "Failed to save training phrases." });
    }
});

// 4. Add a prompt
app.post('/api/sessions/:sessionId/prompts', (req, res) => {
    const { sessionId } = req.params;
    const { prompt }: { prompt: string } = req.body;

    const vocabRows = db.prepare('SELECT word FROM Vocabulary WHERE sessionId = ?').all(sessionId) as { word: string }[];
    const vocabulary = new Set(vocabRows.map(row => row.word));
    const filteredPromptText = filterTextByVocabulary(prompt, vocabulary);

    const info = db.prepare('INSERT INTO Prompts (sessionId, promptText, filteredPromptText) VALUES (?, ?, ?)')
                   .run(sessionId, prompt, filteredPromptText);
    
    res.status(201).json({ id: info.lastInsertRowid, promptText: prompt, filteredPromptText });
});

// 5. Submit a response for a prompt (Inference & Scoring)
app.post('/api/prompts/:promptId/responses', (req, res) => {
    const { promptId } = req.params;
    const { responseText } = req.body;

    // Find the session this prompt belongs to
    const prompt = db.prepare('SELECT sessionId FROM Prompts WHERE id = ?').get(promptId) as { sessionId: string };
    if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
    }
    const { sessionId } = prompt;

    // Get all necessary data for scoring
    const vocabRows = db.prepare('SELECT word FROM Vocabulary WHERE sessionId = ?').all(sessionId) as { word: string }[];
    const vocabulary = new Set(vocabRows.map(row => row.word));

    const trainingRows = db.prepare('SELECT filteredPhrase FROM TrainingPhrases WHERE sessionId = ?').all(sessionId) as { filteredPhrase: string }[];
    const allFilteredTrainingPhrases = trainingRows.map(r => r.filteredPhrase);
    
    // Perform filtering and scoring
    const filteredResponseText = filterTextByVocabulary(responseText, vocabulary);
    const { score, breakdown } = calculateHeuristicScore(filteredResponseText, allFilteredTrainingPhrases);

    // Save the result
    const info = db.prepare('INSERT INTO Responses (promptId, responseText, filteredResponseText, score, scoreBreakdown) VALUES (?, ?, ?, ?, ?)')
                   .run(promptId, responseText, filteredResponseText, score, JSON.stringify(breakdown));
    
    res.status(201).json({
        id: info.lastInsertRowid,
        responseText,
        filteredResponseText,
        score,
        breakdown
    });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});