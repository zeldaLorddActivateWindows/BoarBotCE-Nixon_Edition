/***********************************************
 * onMessage.ts
 * An event that runs when someone sends a
 * message.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {Events, Message} from 'discord.js';
import {sendReport} from '../logging/LogDebug';

//***************************************

/**
 * Handles message send to the bot (Only DM Reports)
 * @param message - The message to reply to and log
 */
async function execute(message: Message) {
	if (!message.channel.isDMBased() || message.author.id === message.client.user.id) return;
	await sendReport(message);
}

//***************************************

module.exports = {
	name: Events.MessageCreate,
	execute
};