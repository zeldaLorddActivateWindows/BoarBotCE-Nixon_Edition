import {Events, Message} from 'discord.js';
import {Listener} from '../api/listeners/Listener';
import {BoarBotApp} from '../BoarBotApp';
import {LogDebug} from '../util/logging/LogDebug';

/**
 * {@link GuildAddListener GuildAddListener.ts}
 *
 * An event that runs when someone sends a
 * message that the bot can read.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class MessageListener implements Listener {
	public readonly eventName: Events = Events.MessageCreate;

	/**
	 * Handles message send to the bot (Only DM Reports)
	 * @param message - The message to reply to and log
	 */
	public async execute(message: Message): Promise<void> {
		const config = BoarBotApp.getBot().getConfig();
		if (!message.channel.isDMBased() || message.author.id === message.client.user.id) return;
		await LogDebug.sendReport(message, config);
	}
}