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
import {ActivityType, Client, GatewayIntentBits, Partials, TextChannel} from 'discord.js';
import {Routes} from 'discord-api-types/v10';
import {registerFont} from 'canvas';
import moment from 'moment';
import {Bot} from '../api/bot/Bot';
import {handleError, sendDebug} from '../logging/LogDebug';
import {BotConfig} from './config/BotConfig';
import {Command} from '../api/commands/Command';
import {REST} from '@discordjs/rest';

dotenv.config();

//***************************************

export class BoarBot implements Bot {
	private client: Client = {} as Client;
	private config: BotConfig = {} as BotConfig;
	private commands: Map<string, Command> = new Map<string, Command>();

	public async create(): Promise<void> {
		this.buildClient();

		await this.loadConfig();
		this.setCommands();
		this.registerListeners();

		this.loadFonts();
		this.setRelativeTime();

		await this.login()
		await this.onStart();
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

	public async loadConfig(): Promise<void> {
		let parsedConfig: any;

		try {
			parsedConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
		} catch {
			handleError('Unable to parse config file. Is \'config.json\' in the project root?');
			process.exit(-1);
		}

		this.config = parsedConfig as BotConfig;

		sendDebug('Config successfully loaded!');
	}

	private verifyConfig(): void {}

	public getConfig(): BotConfig { return this.config; }

	public setCommands() {
		if (!this.instanceVarsSet()) process.exit(-1);

		const commandFiles = fs.readdirSync(this.config.pathConfig.commands);

		for (const commandFile of commandFiles) {
			const exports = require('../commands/' + commandFile);
			const commandClass = new exports.default();

			this.commands.set(commandClass.data.name, commandClass);

			sendDebug(`Successfully registered command '${commandClass.data.name}'`);
		}
	}

	public getCommands() { return this.commands; }

	public async deployCommands() {
		const commandData = [];

		for (const command of this.commands.values())
			commandData.push(command.data);

		const rest = new REST({ version: '10' }).setToken(process.env.TOKEN as string);
		try {
			await rest.put(Routes.applicationCommands(process.env.CLIENT_ID as string), { body: commandData });
			sendDebug(this.config.stringConfig.general.registeredCommands);
		} catch (err: unknown) {
			handleError(err);
		}
	}

	public registerListeners() {
		if (!this.instanceVarsSet()) process.exit(-1);

		const listenerFiles = fs.readdirSync(this.config.pathConfig.listeners);

		for (const listenerFile of listenerFiles) {
			const exports = require('../listeners/' + listenerFile);
			const listenClass = new exports.default();

			this.client.on(listenClass.eventName, (...args: any[]) => listenClass.execute(...args));

			sendDebug(`Successfully registered listener for event '${listenClass.eventName}'`);
		}
	}

	public loadFonts(): void {
		if (!this.instanceVarsSet()) process.exit(-1);

		try {
			const mcFont = this.config.pathConfig.resources.other.basePath +
				this.config.pathConfig.resources.other.font;

			registerFont(mcFont, {family: this.config?.stringConfig.general.fontName});
		} catch {
			handleError('Unable to load font. Verify its path in \'config.json\'.');
			return;
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

	public async login(): Promise<void> {
		if (!await this.instanceVarsSet()) process.exit(-1);

		try {
			sendDebug('Logging in...');
			await this.client.login(process.env.TOKEN);
		} catch {
			await handleError('Invalid token!');
			process.exit(-1);
		}
	}

	public async onStart(): Promise<void> {
		if (!await this.instanceVarsSet()) process.exit(-1);

		sendDebug(this.config.stringConfig.general.botOnline);

		const botStatusChannel = await this.getStatusChannel();

		if (!botStatusChannel) { return; }

		try {
			await botStatusChannel.send(
				this.config.stringConfig.general.botStatus.replace('%@', Math.round(Date.now() / 1000))
			);
		} catch (err: unknown) {
			await handleError(err);
		}

		sendDebug('Successfully sent status message!');
	}

	private async getStatusChannel(): Promise<TextChannel | undefined> {
		let botStatusChannel: TextChannel;

		try {
			botStatusChannel = await this.client.channels.fetch(this.config.botStatusChannel) as TextChannel;
		} catch {
			await handleError('Bot cannot find status channel. Status message not sent.');
			return undefined;
		}

		const memberMe = botStatusChannel.guild.members.me;
		if (!memberMe) {
			await handleError('Bot doesn\'t exist in testing server. Status message not sent.');
			return undefined;
		}

		const memberMePerms = memberMe.permissions.toArray();
		if (!memberMePerms.includes('SendMessages')) {
			await handleError('Bot doesn\'t have permission to send status message. Status message not sent.');
			return undefined;
		}

		return botStatusChannel;
	}

	private async instanceVarsSet(): Promise<boolean> {
		let allSet = true;

		if (Object.keys(this.client).length === 0) {
			await handleError('Client was never built!');
			allSet = false;
		} else if (Object.keys(this.config).length === 0) {
			await handleError('Client was never built!');
			allSet = false;
		}

		return allSet;
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