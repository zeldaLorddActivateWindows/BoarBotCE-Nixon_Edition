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
import {handleError, sendDebug} from '../supporting_files/LogDebug';

//***************************************

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute (client: Client) {
		const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

		sendDebug(config.strings.general.botOnline);

		try {
			const botStatusChannel = await client.channels.fetch(config.channels.botStatus) as TextChannel;

			await botStatusChannel.send(
				config.strings.general.botStatus.replace('%@', Math.round(Date.now() / 1000))
			);
		} catch (err: unknown) {
			await handleError(err);
			return;
		}
  	}
}
