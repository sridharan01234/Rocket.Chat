const axios = require('axios');

// Basic level moderation patterns
const SENSITIVE_PATTERNS = {
    phone: /\b\d{10}\b|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    ssn: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/,
    creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/,
    ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/
};

// Basic level moderation to detect sensitive information
function basicModeration(message) {
    for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
        if (pattern.test(message)) {
            return { 
                allowed: false, 
                reason: `Message contains sensitive information (${type})`
            };
        }
    }
    return { allowed: true };
}

// Second level moderation using OpenAI API
async function advancedModeration(message) {
    try {
        const response = await axios.post('https://api.openai.com/v1/moderations', {
            input: message
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const result = response.data.results[0];
        if (result.flagged) {
            // Get the specific categories that were flagged
            const flaggedCategories = Object.entries(result.categories)
                .filter(([_, isFlagged]) => isFlagged)
                .map(([category]) => category);

            return {
                allowed: false,
                reason: `Content flagged by AI moderation for: ${flaggedCategories.join(', ')}`
            };
        }
        return { allowed: true };
    } catch (error) {
        console.error('Error in OpenAI moderation:', error);
        // If OpenAI fails, we'll still allow the message but log the error
        return { allowed: true };
    }
}

// Combined moderation function
async function moderateMessage(message) {
    // First level: Basic pattern matching
    const basicResult = basicModeration(message);
    if (!basicResult.allowed) {
        return basicResult;
    }

    // Second level: AI-based moderation
    return await advancedModeration(message);
}

module.exports = { moderateMessage };