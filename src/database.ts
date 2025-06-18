import Database from 'better-sqlite3';
import path from 'path';

// Point to the db file
const dbPath = path.resolve(__dirname, '..', 'db', 'database.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency, good practice
db.pragma('journal_mode = WAL'); // Good practice for concurrency
db.pragma('foreign_keys = ON'); // Enforce foreign key constraints

// Function to initialize the database schema
export function initializeDb() {
    const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS Sessions (
        id TEXT PRIMARY KEY,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;
    const createVocabularyTable = `
    CREATE TABLE IF NOT EXISTS Vocabulary (
        sessionId TEXT,
        word TEXT NOT NULL,
        FOREIGN KEY(sessionId) REFERENCES Sessions(id) ON DELETE CASCADE,
        PRIMARY KEY (sessionId, word)
    );`;    
    const createTrainingPhrasesTable = `
    CREATE TABLE IF NOT EXISTS TrainingPhrases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        originalPhrase TEXT NOT NULL,
        filteredPhrase TEXT NOT NULL,
        FOREIGN KEY(sessionId) REFERENCES Sessions(id) ON DELETE CASCADE,
        UNIQUE(sessionId, originalPhrase)
    );`;
    const createPromptsTable = `
    CREATE TABLE IF NOT EXISTS Prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        promptText TEXT NOT NULL,
        filteredPromptText TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sessionId) REFERENCES Sessions(id) ON DELETE CASCADE
    );`;
    const createResponsesTable =`
    CREATE TABLE IF NOT EXISTS Responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        promptId INTEGER NOT NULL,
        responseText TEXT NOT NULL,
        filteredResponseText TEXT NOT NULL,
        score REAL NOT NULL,
        scoreBreakdown TEXT NOT NULL,
        FOREIGN KEY(promptId) REFERENCES Prompts(id) ON DELETE CASCADE
    );`;
    
    db.exec(createSessionsTable);
    db.exec(createVocabularyTable);
    db.exec(createTrainingPhrasesTable);
    db.exec(createPromptsTable);
    db.exec(createResponsesTable);
    console.log('Database initialized successfully.');
}

export default db;