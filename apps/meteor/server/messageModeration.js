import { HTTP } from 'meteor/http';
import { settings } from '../app/settings/server';

// Basic level moderation patterns
// Basic level moderation patterns
const SENSITIVE_PATTERNS = {
	phone: /\b(?:\+?\d{1,3}[-.\s]?)?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
	email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
	ssn: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/,
	creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/,
	ipAddress: /\b\d{1,3}(\.\d{1,3}){3}\b/,
	socialHandle: /@\w{1,30}\b/, // e.g. @username
	url: /\bhttps?:\/\/[^\s]+\b|\bwww\.[^\s]+\b/, // any http(s) URL
	telegram: /\bt\.me\/[A-Za-z0-9_]+\b/, // t.me/username
	whatsapp: /\bwa\.me\/\d+\b/, // wa.me/1234567890
};

// Basic level moderation to detect sensitive information
function basicModeration(message) {
	// Skip moderation if it's disabled
	if (!settings.get('Message_Moderation_Enabled')) {
		return { allowed: true };
	}

	for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
		if (pattern.test(message)) {
			return {
				allowed: false,
				reason: `Message contains sensitive information (${type})`,
			};
		}
	}
	return { allowed: true };
}

async function advancedModeration(message) {
	if (!settings.get('Message_Moderation_Enabled')) {
		return { allowed: true };
	}

	const apiKey = settings.get('OpenAI_API_Key');
	if (!apiKey) {
		console.warn('OpenAI API key not configured, skipping advanced moderation');
		return { allowed: true };
	}

	try {
		const payload = {
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: [
						'You are a content-moderation assistant.',
						'Your job is to detect any **attempts** to share or solicit personal contact information,',
						'even if they are indirect (e.g. "DM me on Instagram", "let’s talk offline").',
						'Answer in JSON exactly with keys `flagged` (boolean) and `reason` (string).',
					].join(' '),
				},
				{ role: 'user', content: message },
			],
		};

		const response = await HTTP.call('POST', 'https://api.openai.com/v1/chat/completions', {
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			data: payload,
		});

		const assistantReply = response.data.choices[0].message.content;
		const result = JSON.parse(assistantReply);

		if (result.flagged) {
			return {
				allowed: false,
				reason: `AI flagged indirect contact sharing: ${result.reason}`,
			};
		}

		return { allowed: true };
	} catch (error) {
		console.error('Error in advancedModeration:', error);
		// On failure, default to allowing so we don’t block normal chat
		return { allowed: true };
	}
}

// Combined moderation function
export async function moderateMessage(message) {
	// First level: Basic pattern matching
	const basicResult = basicModeration(message);
	if (!basicResult.allowed) {
		return basicResult;
	}

	// Second level: AI-based moderation
	return await advancedModeration(message);
}

module.exports = { moderateMessage };
