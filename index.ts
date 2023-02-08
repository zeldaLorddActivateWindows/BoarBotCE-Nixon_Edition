/***********************************************
 * index.ts
 * Creates the bot, logs it in, then finds where
 * all event and command handlers are.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {GatewayIntentBits, Partials} from 'discord.js';
import {CustomClient} from './src/supporting_files/CustomClient';
import {registerFont} from 'canvas';
import {getConfigFile} from './src/supporting_files/DataHandlers';

dotenv.config();

//***************************************

const client = new CustomClient({
	partials: [
		Partials.Channel,
	],
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildEmojisAndStickers,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages
    ]
});

const config = getConfigFile();

const minecraftFont = config.paths.assets.other.basePath + config.paths.assets.other.font;
registerFont(minecraftFont, { family: config.strings.general.fontName });

// Registers list of subcommands
const commandList = require(config.paths.commandList);
client.commandList.set(commandList.data.name, commandList);

// Registers subcommand file locations
const subcommandsPath = path.join(__dirname, config.paths.commands);
const subcommandFiles = fs.readdirSync(subcommandsPath).filter((file: string) => file.endsWith('.ts'));

for (const file of subcommandFiles) {
	const filePath = path.join(subcommandsPath, file);
	const subcommand = require(filePath);
	client.subcommands.set(subcommand.data.name, subcommand);
}

// Registers modal file locations
// const modalsPath = path.join(__dirname, './src/modals');
// const modalFiles = fs.readdirSync(modalsPath).filter((file: string) => file.endsWith('.ts'));
//
// for (const file of modalFiles) {
// 	const filePath = path.join(modalsPath, file);
// 	const modal = require(filePath);
// 	client.modals.set(modal.data.name, modal);
// }

// Registers event handlers
const eventsPath = path.join(__dirname, config.paths.events);
const eventFiles = fs.readdirSync('src/events').filter((file: string) => file.endsWith('.ts'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once)
		client.once(event.name, (...args: string[]) => event.execute(...args));
	else
		client.on(event.name, (...args: string[]) => event.execute(...args));
}

// Gets rid of empty data files on restart
const guildDataPath = config.paths.data.guildFolder;
const guildFolders = fs.readdirSync(guildDataPath);

for (const guild of guildFolders) {
	const filePath = guildDataPath + guild;
	const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

	if (Object.keys(data).length === 0)
		fs.rmSync(guildDataPath + guild);
}

client.login(process.env.TOKEN);