import axios from 'axios';
import { settings } from '../app/settings/server';

interface ModerationResult {
    allowed: boolean;
    reason?: string;
}

// Basic level moderation to detect sensitive information
function basicModeration(message: string): ModerationResult {
    const phoneRegex = /\b\d{10}\b|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/; // Matches phone numbers
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/; // Matches email addresses

    if (phoneRegex.test(message)) {
        return { allowed: false, reason: 'Message contains a phone number.' };
    }

    if (emailRegex.test(message)) {
        return { allowed: false, reason: 'Message contains an email address.' };
    }

    return { allowed: true };
}

// Second level moderation using OpenAI API
async function advancedModeration(message: string): Promise<ModerationResult> {
    const openAIKey = settings.get('OpenAI_API_Key');
    
    if (!openAIKey) {
        // If no API key is configured, skip advanced moderation
        return { allowed: true };
    }

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/moderations',
            { input: message },
            {
                headers: {
                    'Authorization': `Bearer ${openAIKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.results[0].flagged) {
            const categories = response.data.results[0].categories;
            const flaggedCategories = Object.entries(categories)
                .filter(([_, flagged]) => flagged)
                .map(([category]) => category)
                .join(', ');
            
            return { 
                allowed: false, 
                reason: `Message flagged by content moderation for: ${flaggedCategories}`
            };
        }

        return { allowed: true };
    } catch (error) {
        console.error('Error in OpenAI moderation:', error);
        // On API error, fall back to allowing the message but log the error
        return { allowed: true };
    }
}

// Combined moderation function that runs both levels
export async function moderateMessage(message: string): Promise<ModerationResult> {
    // First level - basic pattern matching
    const basicResult = basicModeration(message);
    if (!basicResult.allowed) {
        return basicResult;
    }

    // Second level - OpenAI moderation
    return await advancedModeration(message);
}