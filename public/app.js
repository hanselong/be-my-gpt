import { STARTER_VOCAB, STARTER_TRAINING_PHRASES } from './constants.js';

document.addEventListener('DOMContentLoaded', () => {
    // STATE
    let state = {
        sessionId: null,
        promptId: null,
        vocabulary: [],
        trainingPhrases: [],
        maxStepReached: 0,
    };

    const stepOrder = ['vocabulary', 'training', 'prompting', 'inference', 'scoring'];

    // DOM ELEMENTS
    const steps = {
        vocabulary: document.getElementById('step-1-vocabulary'),
        training: document.getElementById('step-2-training'),
        prompting: document.getElementById('step-3-prompting'),
        inference: document.getElementById('step-4-inference'),
        scoring: document.getElementById('step-5-scoring'),
    };

    const navButtons = {
        vocabulary: document.getElementById('nav-step-1'),
        training: document.getElementById('nav-step-2'),
        prompting: document.getElementById('nav-step-3'),
        inference: document.getElementById('nav-step-4'),
        startOver: document.getElementById('nav-start-over'),
    };
    
    const detailsBox = document.querySelector('.info-box[open], .info-box:not([open])'); // A robust selector for the <details> element
    if (detailsBox) {
        const summary = detailsBox.querySelector('summary h4');
        const originalText = '💡 How does a real GPT do this?';

        detailsBox.addEventListener('toggle', (event) => {
            if (detailsBox.open) {
                summary.textContent = `${originalText} (Click to collapse)`;
            } else {
                summary.textContent = `${originalText} (Click to expand)`;
            }
        });

        // Initialize the text correctly on page load
        if (detailsBox.open) {
            summary.textContent = `${originalText} (Click to collapse)`;
        } else {
            summary.textContent = `${originalText} (Click to expand)`;
        }
    }

    // Step 1: Vocab
    const vocabForm = document.getElementById('vocab-form');
    const vocabInput = document.getElementById('vocab-input');
    const vocabList = document.getElementById('vocab-list');
    const vocabCount = document.getElementById('vocab-count');
    const gotoTrainingButton = document.getElementById('goto-training-button');
    
    // Step 2: Training
    const trainingForm = document.getElementById('training-form');
    const trainingInput = document.getElementById('training-input');
    const trainingList = document.getElementById('training-list');
    const gotoPromptingButton = document.getElementById('goto-prompting-button');

    // Step 3: Prompting
    const promptForm = document.getElementById('prompt-form');
    const promptInput = document.getElementById('prompt-input');

    // Step 4: Inference
    const inferencePrompt = document.getElementById('inference-prompt');
    const responseForm = document.getElementById('response-form');
    const responseInput = document.getElementById('response-input');
    const inferenceVocabList = document.getElementById('inference-vocab-list');
    const inferenceTrainingList = document.getElementById('inference-training-list');
    
    // Step 5: Scoring
    const finalScore = document.getElementById('final-score');
    const scoreBreakdown = document.getElementById('score-breakdown');
    const originalResponse = document.getElementById('original-response');
    const filteredResponse = document.getElementById('filtered-response');

    // Control Buttons
    const resetButton = document.getElementById('reset-button');
    const tryAgainButton = document.getElementById('try-again-button');
    const newPromptButton = document.getElementById('new-prompt-button');

    // --- API HELPERS ---
    const api = {
        createSession: () => fetch('/api/sessions', { method: 'POST' }).then(res => res.json()),
        getSession: (sessionId) => fetch(`/api/sessions/${sessionId}`).then(res => res.json()),
        addVocabulary: (sessionId, text) => fetch(`/api/sessions/${sessionId}/vocabulary`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ text })
        }).then(res => res.json()),
        addTraining: (sessionId, phrase) => fetch(`/api/sessions/${sessionId}/training`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ phrase })
        }).then(res => res.json()),
        addTrainingBatch: (sessionId, phrases) => fetch(`/api/sessions/${sessionId}/training/batch`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ phrases })
        }).then(res => res.json()),
        addPrompt: (sessionId, prompt) => fetch(`/api/sessions/${sessionId}/prompts`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ prompt })
        }).then(res => res.json()),
        submitResponse: (promptId, responseText) => fetch(`/api/prompts/${promptId}/responses`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ responseText })
        }).then(res => res.json()),
    };

    // --- RENDER FUNCTIONS ---
    const renderVocabulary = () => {
        vocabList.innerHTML = '';
        inferenceVocabList.innerHTML = '';
        state.vocabulary.sort(); // Sort vocabulary alphabetically
        state.vocabulary.forEach(word => {
            const li = document.createElement('li');
            li.textContent = word;
            vocabList.appendChild(li);
            inferenceVocabList.appendChild(li.cloneNode(true));
        });
        vocabCount.textContent = state.vocabulary.length;

        // NEW: Control the "I'm Done" button's state
        if (state.vocabulary.length > 0) {
            gotoTrainingButton.disabled = false;
        } else {
            gotoTrainingButton.disabled = true;
        }
    };

    const renderTrainingPhrases = () => {
        trainingList.innerHTML = '';
        inferenceTrainingList.innerHTML = '';
        state.trainingPhrases.forEach(phrase => {
            const li = document.createElement('li');
            li.innerHTML = `"${phrase.originalPhrase}" ➔ <i>"${phrase.filteredPhrase || '(empty)'}"</i>`;
            trainingList.appendChild(li);
            inferenceTrainingList.appendChild(li.cloneNode(true));
        });
    };

    const updateNavState = (currentStepName) => {
        const currentStepIndex = stepOrder.indexOf(currentStepName);

        // Enable/disable buttons based on the maximum step reached
        stepOrder.forEach((stepName, index) => {
            const button = navButtons[stepName];
            if (button) {
                button.disabled = index > state.maxStepReached;
                button.classList.remove('active');
            }
        });

        // Set the current step's button to active
        const activeButton = navButtons[currentStepName];
        if (activeButton) {
            activeButton.classList.add('active');
        }
    };

    const updateUI = (currentStep) => {
        Object.values(steps).forEach(stepEl => stepEl.classList.add('hidden'));
        if (steps[currentStep]) {
            steps[currentStep].classList.remove('hidden');
        }

        // Update the max step reached if we are moving forward
        const newStepIndex = stepOrder.indexOf(currentStep);
        if (newStepIndex > state.maxStepReached) {
            state.maxStepReached = newStepIndex;
        }

        // Update the nav bar to reflect the current state
        updateNavState(currentStep);
    };

    // --- GAME LOGIC ---
    const initGame = async () => {
        const savedSessionId = localStorage.getItem('beMyGptSessionId');
        if (savedSessionId) {
            try {
                const sessionData = await api.getSession(savedSessionId);
                state.sessionId = sessionData.id;
                state.vocabulary = sessionData.vocabulary || [];
                state.trainingPhrases = sessionData.trainingPhrases || [];
                
                renderVocabulary(); // This will now correctly set the button state
                renderTrainingPhrases();

                // Stay on the vocab page if we have vocab but no training yet
                if (state.vocabulary.length > 0) {
                    updateUI('vocabulary');
                } else {
                    updateUI('vocabulary');
                }
            } catch (error) {
                console.error("Failed to load saved session, starting new one.");
                await startNewGame();
            }
        } else {
            await startNewGame();
        }
    };
    
    const startNewGame = async () => {
        const data = await api.createSession();
        state.sessionId = data.sessionId;
        state.maxStepReached = 0;
        localStorage.setItem('beMyGptSessionId', state.sessionId);
        // Reset state and UI
        state.vocabulary = [];
        state.trainingPhrases = [];
        state.promptId = null;
        renderVocabulary();
        renderTrainingPhrases();
        vocabInput.value = '';
        trainingInput.value = '';
        promptInput.value = '';
        responseInput.value = '';
        updateUI('vocabulary');
    };

    // --- EVENT LISTENERS ---
    resetButton.addEventListener('click', startNewGame);
    navButtons.vocabulary.addEventListener('click', () => updateUI('vocabulary'));
    navButtons.training.addEventListener('click', () => updateUI('training'));
    navButtons.prompting.addEventListener('click', () => updateUI('prompting'));
    navButtons.inference.addEventListener('click', () => updateUI('inference'));

    const starterVocabButton = document.getElementById('add-starter-vocab-button');
    const addTokensToVocab = async (text) => {
        if (!text || text.trim() === '') return;

        // Step A: Process the input text into a de-duplicated array of tokens.
        const inputTokens = text.toLowerCase().match(/\b(\w+)\b/g) || [];
        const uniqueInputTokens = [...new Set(inputTokens)];

        // Step B: Create a Set of existing tokens for efficient lookup.
        const existingTokensSet = new Set(state.vocabulary);

        // Step C: Filter the input tokens to find only the ones that are truly new.
        const newTokensToAdd = uniqueInputTokens.filter(token => !existingTokensSet.has(token));

        // Step D: If there are no new tokens to add, simply exit the function.
        if (newTokensToAdd.length === 0) {
            console.log("No new unique tokens to add.");
            // Optional: You could show a small notification to the user here.
            return;
        }

        // Step E: Send only the new, unique tokens to the backend.
        const textPayload = newTokensToAdd.join(' ');
        await api.addVocabulary(state.sessionId, textPayload);

        // Step F: Refresh the complete vocabulary from the backend (the source of truth).
        const sessionData = await api.getSession(state.sessionId);
        state.vocabulary = sessionData.vocabulary;
        renderVocabulary();
    };

    vocabForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textToAdd = vocabInput.value.trim();
        await addTokensToVocab(textToAdd);
        vocabInput.value = ''; // Clear the input after adding
    });

    starterVocabButton.addEventListener('click', async () => {
        const vocabString = STARTER_VOCAB.join(' ');
        await addTokensToVocab(vocabString);
    });

    gotoTrainingButton.addEventListener('click', () => {
        updateUI('training');
    });

    const starterTrainingButton = document.getElementById('add-starter-training-button');

    trainingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phrase = trainingInput.value.trim();
        if (phrase) {
            // De-duplication check
            const existingPhrases = new Set(state.trainingPhrases.map(p => p.originalPhrase));
            if (existingPhrases.has(phrase)) {
                console.log("This phrase already exists.");
                trainingInput.value = '';
                return; // Exit if phrase is a duplicate
            }

            const newPhrase = await api.addTraining(state.sessionId, phrase);
            state.trainingPhrases.push(newPhrase);
            renderTrainingPhrases();
            trainingInput.value = '';
        }
    });

    starterTrainingButton.addEventListener('click', async () => {
        // De-duplication logic
        const existingPhrases = new Set(state.trainingPhrases.map(p => p.originalPhrase));
        const newPhrasesToAdd = STARTER_TRAINING_PHRASES.filter(p => !existingPhrases.has(p));

        if (newPhrasesToAdd.length === 0) {
            console.log("All starter phrases have already been added.");
            return;
        }

        await api.addTrainingBatch(state.sessionId, newPhrasesToAdd);
        
        // Refresh the whole session to get the updated list
        const sessionData = await api.getSession(state.sessionId);
        state.trainingPhrases = sessionData.trainingPhrases;
        renderTrainingPhrases();
    });

    gotoPromptingButton.addEventListener('click', () => {
        updateUI('prompting');
    });

    promptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = promptInput.value.trim();
        if (prompt) {
            const newPrompt = await api.addPrompt(state.sessionId, prompt);
            state.promptId = newPrompt.id;
            inferencePrompt.textContent = newPrompt.promptText;
            updateUI('inference');
        }
    });

    responseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const responseText = responseInput.value.trim();
        if (responseText) {
            const result = await api.submitResponse(state.promptId, responseText);
            
            // Display results
            finalScore.textContent = result.score.toFixed(2);
            originalResponse.textContent = result.responseText;
            filteredResponse.textContent = result.filteredResponseText || "(empty)";
            
            const breakdown = result.breakdown;
            scoreBreakdown.innerHTML = `
                <p><strong>N-Gram Score:</strong> ${breakdown.bigramScore} points (found ${breakdown.matchedBigrams} of your ${breakdown.totalResponseBigrams} word-pairs in the training data).</p>
                <p><strong>Matched Pairs:</strong> ${breakdown.matchedBigramList?.join(', ') || 'None'}</p>
                <p><strong>Length Bonus:</strong> ${breakdown.lengthBonus} points.</p>
            `;

            updateUI('scoring');
        }
    });

    tryAgainButton.addEventListener('click', () => {
        responseInput.value = '';
        updateUI('inference');
    });

    newPromptButton.addEventListener('click', () => {
        promptInput.value = '';
        updateUI('prompting');
    });
    
    // --- INITIALIZE ---
    initGame();
});