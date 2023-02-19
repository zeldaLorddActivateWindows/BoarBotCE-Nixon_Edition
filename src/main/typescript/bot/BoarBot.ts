/***********************************************
 * BoarBot.ts
 * Creates the bot, logs it in, then finds where
 * all event and command handlers are.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import dotenv from 'dotenv';
import fs from 'fs';
import {Client, GatewayIntentBits, Partials, TextChannel} from 'discord.js';
import {registerFont} from 'canvas';
import moment from 'moment';
import {Bot} from '../api/bot/Bot';
import {handleError, sendDebug} from '../logging/LogDebug';
import {BotConfig} from './config/BotConfig';

dotenv.config();

//***************************************

export class BoarBot implements Bot {
	private client: Client | null = null;
	private config: BotConfig = {} as BotConfig;

	constructor() {
		this.buildClient();

		this.loadConfig();
		this.loadFonts();
		this.setRelativeTime();

		this.registerListeners();

		this.login();
	}

	public buildClient() {
		this.client = new Client({
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
	}

	public loadConfig(): void {
		let parsedConfig: any;

		try {
			parsedConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
		} catch {
			handleError('Unable to parse config file. Is \'config.json\' in the project root?');
			process.exit(-1);
		}

		this.config = parsedConfig as BotConfig;

		sendDebug('Config successfully loaded: ' + JSON.stringify(this.config));
	}

	private verifyConfig(): void {}

	public getConfig(): BotConfig {
		return this.config;
	}

	public loadFonts(): void {
		if (!this.config) {
			handleError('Config file not loaded!');
			return;
		}

		try {
			const mcFont =
				this.config.pathConfig.resources.other.basePath + this.config.pathConfig.resources.other.font;

			registerFont(mcFont, {family: this.config?.stringConfig.general.fontName});
		} catch {
			handleError('Unable to load font. Verify its path in \'config.json\'.');
		}

		sendDebug('Fonts successfully loaded!');
	}

	public setRelativeTime(): void {
		moment.relativeTimeThreshold('s', 60);
		moment.relativeTimeThreshold('ss', 1);
		moment.relativeTimeThreshold('m', 60);
		moment.relativeTimeThreshold('h', 24);
		moment.relativeTimeThreshold('d', 30.437);
		moment.relativeTimeThreshold('M', 12);

		moment.updateLocale('en', {
			relativeTime : {
				future: 'in %s',
				past:   '%s ago',
				s  : '%d second',
				ss : '%d seconds',
				m:  '%d minute',
				mm: '%d minutes',
				h:  '%d hour',
				hh: '%d hours',
				d:  '%d day',
				dd: '%d days',
				M:  '%d month',
				MM: '%d months',
				y:  '%d year',
				yy: '%d years'
			}
		});

		sendDebug('Relative time information set!');
	}

	public registerListeners() {
		if (!this.client) {
			handleError('Client was never built!');
			return;
		}

		if (!this.config) {
			handleError('Config file not loaded!');
			return;
		}

		const listenersPath = this.config.pathConfig.listeners;
		const listenerFiles = fs.readdirSync(listenersPath);

		for (const listenerFile of listenerFiles) {
			const listenerFileExports = require('../listeners/' + listenerFile);
			const listenerClass = new listenerFileExports.default();
			this.client.on(listenerClass.eventName, (...args: any[]) => listenerClass.execute(...args));
			sendDebug(`Successfully registered event '${listenerClass.eventName}'`);
		}
	}

	public async login(): Promise<void> {
		if (!this.client) {
			handleError('Client was never built!');
			return;
		}

		try {
			sendDebug('Logging in...');
			await this.client.login(process.env.TOKEN);
		} catch {
			handleError('Invalid token!');
			process.exit(-1);
		}

		this.onStart();
	}

	public async onStart(): Promise<void> {
		if (!this.config) {
			handleError('Config file does not loaded!');
			process.exit(-1);
		}

		if (!this.client) {
			handleError('Client was never built!');
			return;
		}

		sendDebug(this.config.stringConfig.general.botOnline);

		let botStatusChannel: TextChannel | null = null;

		try {
			botStatusChannel = await this.client.channels.fetch(this.config.botStatusChannel) as TextChannel;
		} catch {
			handleError('Bot cannot find status channel. Status message not sent.');
			return;
		}

		const memberMe = botStatusChannel.guild.members.me;

		if (!memberMe) {
			handleError('Bot doesn\'t exist in testing server. Status message not sent.');
			return;
		}

		const memberMePerms = memberMe.permissions.toArray();

		if (!memberMePerms.includes('SendMessages')) {
			handleError('Bot doesn\'t have permission to send status message. Status message not sent.');
			return;
		}

		try {
			await botStatusChannel.send(
				this.config.stringConfig.general.botStatus.replace('%@', Math.round(Date.now() / 1000))
			);
		} catch (err: unknown) {
			await handleError(err);
			return;
		}
	}
}



// Registers list of subcommands
// const commandList = require(config.paths.commandList);
// client.commandList.set(commandList.data.name, commandList);
//
// // Registers subcommand file locations
// const subcommandsPath = path.join(__dirname, config.paths.commands);
// const subcommandFiles = fs.readdirSync(subcommandsPath).filter((file: string) => file.endsWith('.ts'));
//
// for (const file of subcommandFiles) {
// 	const filePath = path.join(subcommandsPath, file);
// 	const subcommand = require(filePath);
// 	client.subcommands.set(subcommand.data.name, subcommand);
// }

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
// const eventsPath = path.join(__dirname, config.paths.events);
// const eventFiles = fs.readdirSync('src/events').filter((file: string) => file.endsWith('.ts'));
//
// for (const file of eventFiles) {
// 	const filePath = path.join(eventsPath, file);
// 	const event = require(filePath);
// 	if (event.once)
// 		client.once(event.name, (...args: string[]) => event.execute(...args));
// 	else
// 		client.on(event.name, (...args: string[]) => event.execute(...args));
// }

// Gets rid of empty data files on restart
// const guildDataPath = config.paths.data.guildFolder;
// const guildFolders = fs.readdirSync(guildDataPath);
//
// for (const guild of guildFolders) {
// 	const filePath = guildDataPath + guild;
// 	const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
//
// 	if (Object.keys(data).length === 0)
// 		fs.rmSync(guildDataPath + guild);
// }