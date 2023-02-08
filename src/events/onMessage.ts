/***********************************************
 * onMessage.ts
 * An event that runs when someone sends a
 * message.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {Events, Message} from 'discord.js';
import {sendReport} from '../supporting_files/LogDebug';

//***************************************

module.exports = {
	name: Events.MessageCreate,
	async execute(message: Message) {
		if (!message.channel.isDMBased() || message.author.id === message.client.user.id) return;
		await sendReport(message);
	}
};