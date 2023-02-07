/***********************************************
* onMessage.ts
* Weslay
*
* An event that runs when someone sends a
* message.
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