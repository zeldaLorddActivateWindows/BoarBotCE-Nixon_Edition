/***********************************************
 * MessageListener.ts
 * An event that runs when someone sends a
 * message.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {Events, Message} from 'discord.js';
import {sendReport} from '../logging/LogDebug';
import {Listener} from '../api/listeners/Listener';

//***************************************

export default class MessageListener implements Listener {
	public readonly eventName: Events = Events.MessageCreate;

	/**
	 * Handles message send to the bot (Only DM Reports)
	 * @param message - The message to reply to and log
	 */
	public async execute(message: Message): Promise<void> {
		if (!message.channel.isDMBased() || message.author.id === message.client.user.id) return;
		await sendReport(message);
	}
}