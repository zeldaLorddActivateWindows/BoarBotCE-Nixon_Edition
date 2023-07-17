import {Events, Message} from 'discord.js';
import {Listener} from '../api/listeners/Listener';
import {BoarBotApp} from '../BoarBotApp';
import {LogDebug} from '../util/logging/LogDebug';
import {BotConfig} from '../bot/config/BotConfig';
import {Queue} from '../util/interactions/Queue';
import {BoarUser} from '../util/boar/BoarUser';

/**
 * {@link MessageListener MessageListener.ts}
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
	 *
	 * @param message - The message to reply to and log
	 */
	public async execute(message: Message): Promise<void> {
		const config: BotConfig = BoarBotApp.getBot().getConfig();
		if (config.maintenanceMode || !message.channel.isDMBased() || message.author.id === message.client.user.id) return;

		if (message.content.trim().toLowerCase() === 'stop') {
			await Queue.addQueue(async () => {
				try {
					const boarUser = new BoarUser(message.author);

					if (
						boarUser.stats.general.notificationsOn !== undefined &&
						!boarUser.stats.general.notificationsOn
					) {
						return;
					}

					boarUser.stats.general.notificationsOn = false;
					boarUser.updateUserData();

					LogDebug.log(
						`${message.author.username} (${message.author.id}) turned OFF notifications`,
						config, undefined, true
					);

					await message.reply('Successfully turned off notifications!');
				} catch (err: unknown) {
					await LogDebug.handleError(err);
				}
			}, message.id + message.author.id);
		}
	}
}