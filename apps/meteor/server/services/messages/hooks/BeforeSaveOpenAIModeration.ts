import { type IMessage } from '@rocket.chat/core-typings';
import { MeteorError } from '@rocket.chat/core-services';
import { settings } from '../../../../app/settings/server';
import { api } from '../../../lib/openai';

export class BeforeSaveOpenAIModeration {
    async moderateContent({ message }: { message: IMessage }): Promise<IMessage> {
        if (!message.msg || !settings.get('Message_OpenAI_Moderation_Enabled')) {
            return message;
        }

        try {
            const response = await fetch('https://api.openai.com/v1/moderations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.get('OpenAI_API_Key')}`
                },
                body: JSON.stringify({
                    input: message.msg
                })
            });

            const result = await response.json();

            if (result.results[0].flagged) {
                // Message contains inappropriate content
                throw new MeteorError(
                    'error-message-blocked',
                    'Message blocked by content moderation',
                    { message: message.msg }
                );
            }

            return message;
        } catch (error) {
            // If OpenAI API fails, log error but allow message through
            console.error('OpenAI moderation failed:', error);
            return message;
        }
    }
}