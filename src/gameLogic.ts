// Helper to clean and split text into words
const textToWords = (text: string): string[] => {
    return text.toLowerCase().match(/\b(\w+)\b/g) || [];
};

/**
 * Filters a given text, keeping only words present in the vocabulary set.
 */
export function filterTextByVocabulary(text: string, vocabulary: Set<string>): string {
    const words = textToWords(text);
    const filteredWords = words.filter(word => vocabulary.has(word));
    return filteredWords.join(' ');
}

/**
 * Creates n-grams from a text string.
 */
function createNgrams(text: string, n: number): Set<string> {
    const words = text.split(' ');
    const ngrams = new Set<string>();
    if (words.length < n) return ngrams;

    for (let i = 0; i <= words.length - n; i++) {
        ngrams.add(words.slice(i, i + n).join(' '));
    }
    return ngrams;
}

/**
 * Calculates a heuristic score for a response based on training data.
 */
export function calculateHeuristicScore(
    filteredResponse: string,
    allFilteredTrainingPhrases: string[]
): { score: number; breakdown: any } {
    if (!filteredResponse.trim()) {
        return { score: 0, breakdown: { error: "Empty response" } };
    }

    const trainingText = allFilteredTrainingPhrases.join(' ');
    const trainingBigrams = createNgrams(trainingText, 2);
    const responseBigrams = createNgrams(filteredResponse, 2);

    if (trainingBigrams.size === 0) {
      // Avoid division by zero, give a base score for just using the vocab
      return { score: 50, breakdown: { message: "Used vocabulary correctly, but no training data to compare against.", matchedBigrams: 0, totalResponseBigrams: responseBigrams.size, lengthBonus: 0 } };
    }

    let matchedBigrams = 0;
    const matchedBigramList: string[] = [];
    for (const bigram of responseBigrams) {
        if (trainingBigrams.has(bigram)) {
            matchedBigrams++;
            matchedBigramList.push(bigram);
        }
    }

    // Score is the percentage of response bigrams that are found in the training data.
    const bigramScore = responseBigrams.size > 0 ? (matchedBigrams / responseBigrams.size) * 80 : 0;
    
    // Simple length bonus
    const lengthBonus = Math.min(filteredResponse.split(' ').length * 2, 20); // Max 20 points bonus
    const finalScore = Math.min(bigramScore + lengthBonus, 100);

    return {
        score: finalScore,
        breakdown: {
            bigramScore: bigramScore.toFixed(2),
            matchedBigrams,
            totalResponseBigrams: responseBigrams.size,
            matchedBigramList,
            lengthBonus: lengthBonus.toFixed(2),
        }
    };
}