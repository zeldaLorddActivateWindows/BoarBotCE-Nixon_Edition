/***********************************************
 * ready.ts
 * An event that runs once the bot is ready and
 * online.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {Client, Events, TextChannel} from 'discord.js'
import fs from 'fs';
import {handleError, sendDebug} from '../logging/LogDebug';

//***************************************

/**
 * Handles when bot comes online
 * @param client - The bot itself
 */
async function execute(client: Client) {
	const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

	sendDebug(config.strings.general.botOnline);

	try {
		const botStatusChannel = await client.channels.fetch(config.channels.botStatus) as TextChannel;

		if (botStatusChannel.guild.members.me &&
			botStatusChannel.guild.members.me.permissions.has('ViewChannel') &&
			botStatusChannel.guild.members.me.permissions.has('SendMessages')
		) {
			await botStatusChannel.send(
				config.strings.general.botStatus.replace('%@', Math.round(Date.now() / 1000))
			);
		}
	} catch (err: unknown) {
		await handleError(err);
		return;
	}
}

//***************************************

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute
}
