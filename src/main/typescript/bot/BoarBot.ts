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
import {ActivityType, Client, GatewayIntentBits, TextChannel} from 'discord.js';
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

	/**
	 * Creates the bot by loading and registering global information
	 */
	public async create(): Promise<void> {
		this.buildClient();

		await this.loadConfig();
		this.setCommands();
		this.registerListeners();

		this.loadFonts();
		this.setRelativeTime();
		this.fixGuildData();

		await this.login()
		await this.onStart();
	}

	/**
	 * Builds the {@link Client} object with chosen options
	 */
	public buildClient(): void {
		this.client = new Client({
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

	/**
	 * Loads config data from configuration file in project root
	 */
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

	/**
	 * Verifies the contents of the data in the configuration file
	 * @private
	 */
	private verifyConfig(): void {}

	/**
	 * Grabs {@link BotConfig config} data the bot uses
	 */
	public getConfig(): BotConfig { return this.config; }

	/**
	 * Sets up all the {@link Command commands} the bot can use
	 */
	public setCommands(): void {
		if (!this.instanceVarsSet()) process.exit(-1);

		const commandFiles = fs.readdirSync(this.config.pathConfig.commands);

		for (const commandFile of commandFiles) {
			const exports = require('../commands/' + commandFile);
			const commandClass = new exports.default();

			this.commands.set(commandClass.data.name, commandClass);

			sendDebug('Successfully found and set command: ' + commandClass.data.name);
		}
	}

	/**
	 * Grabs the {@link Map} storing {@link Command} data
	 */
	public getCommands(): Map<string, Command> { return this.commands; }

	/**
	 * Deploys application commands to Discord API
	 */
	public async deployCommands(): Promise<void> {
		const commandData = [];

		for (const command of this.commands.values())
			commandData.push(command.data);

		const rest = new REST({ version: '10' }).setToken(process.env.TOKEN as string);
		try {
			await rest.put(Routes.applicationCommands(process.env.CLIENT_ID as string), { body: commandData });
			sendDebug('Application commands have successfully been registered!');
		} catch (err: unknown) {
			handleError(err);
		}
	}

	/**
	 * Registers {@link Listener event listeners} for the bot
	 */
	public registerListeners(): void {
		if (!this.instanceVarsSet()) process.exit(-1);

		const listenerFiles = fs.readdirSync(this.config.pathConfig.listeners);

		for (const listenerFile of listenerFiles) {
			const exports = require('../listeners/' + listenerFile);
			const listenClass = new exports.default();

			this.client.on(listenClass.eventName, (...args: any[]) => listenClass.execute(...args));

			sendDebug('Successfully registered listener for event: ' + listenClass.eventName);
		}
	}

	/**
	 * Grabs the font file and loads it for Canvas if it exists
	 */
	public loadFonts(): void {
		if (!this.instanceVarsSet()) process.exit(-1);

		try {
			const mcFont = this.config.pathConfig.resources.other.basePath +
				this.config.pathConfig.resources.other.font;

			registerFont(mcFont, {family: this.config.stringConfig.general.fontName});
		} catch {
			handleError('Unable to load font. Verify its path in \'config.json\'.');
			return;
		}

		sendDebug('Fonts successfully loaded!');
	}

	/**
	 * Sets relative time information like cutoffs and locales
	 */
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

	/**
	 * Deletes guild files that were in the process of setting the bot up
	 */
	public fixGuildData(): void {
		if (!this.instanceVarsSet()) process.exit(-1);

		const guildDataFolder = this.config.pathConfig.data.guildFolder;
		const guildDataFiles = fs.readdirSync(guildDataFolder);

		for (const guildData of guildDataFiles) {
			const data = JSON.parse(fs.readFileSync(guildDataFolder + guildData, 'utf-8'));

			if (Object.keys(data).length !== 0) continue;

			fs.rmSync(guildDataFolder + guildData);

			sendDebug('Deleted empty guild file: ' + guildData);
		}

		sendDebug('Guild data fixed!')
	}

	/**
	 * Logs the bot in
	 */
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

	/**
	 * What the bot should do once it's fully logged in
	 */
	public async onStart(): Promise<void> {
		if (!await this.instanceVarsSet()) process.exit(-1);

		sendDebug('Successfully logged in! Bot online!');

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

	/**
	 * Finds the {@link TextChannel} to send status messages to
	 * @private
	 */
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

	/**
	 * Used to prevent the usage of instance variables before they were set
	 * @return allSet - Whether instance variables were set
	 * @private
	 */
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