import axios from 'axios';

interface ModerationResult {
    allowed: boolean;
    reason?: string;
}

interface OpenAIModerationResult {
    flagged: boolean;
    categories: Record<string, boolean>;
}

const SENSITIVE_PATTERNS = {
    phone: /\b\d{10}\b|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    ssn: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/,
    creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/,
    ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/
};

function basicModeration(message: string): ModerationResult {
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

async function advancedModeration(message: string): Promise<ModerationResult> {
    try {
        const response = await axios.post<{ results: OpenAIModerationResult[] }>('https://api.openai.com/v1/moderations', {
            input: message
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const result = response.data.results[0];
        if (result.flagged) {
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
        return { allowed: true };
    }
}

export async function moderateMessage(message: string): Promise<ModerationResult> {
    const basicResult = basicModeration(message);
    if (!basicResult.allowed) {
        return basicResult;
    }

    return await advancedModeration(message);
}