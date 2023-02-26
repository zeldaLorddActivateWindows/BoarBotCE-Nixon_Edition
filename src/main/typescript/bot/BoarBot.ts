import dotenv from 'dotenv';
import fs from 'fs';
import {ActivityType, Client, GatewayIntentBits, TextChannel} from 'discord.js';
import {Bot} from '../api/bot/Bot';
import {handleError, sendDebug} from '../logging/LogDebug';
import {FormatStrings} from '../util/discord/FormatStrings';
import {ConfigHandler} from './handlers/ConfigHandler';
import {CommandHandler} from './handlers/CommandHandler';
import {EventHandler} from './handlers/EventHandler';
import {BotConfig} from './config/BotConfig';
import {Command} from '../api/commands/Command';

dotenv.config();

/**
 * {@link BoarBot BoarBot.ts}
 *
 * Creates a {@link Bot bot}, logs it in, then finds where
 * all event and command handlers are. Loads
 * other configurations as well.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarBot implements Bot {
	private client: Client = new Client({ intents:[] });
	private configHandler: ConfigHandler = new ConfigHandler;
	private commandHandler: CommandHandler = new CommandHandler();
	private eventHandler: EventHandler = new EventHandler();

	/**
	 * Creates the bot by loading and registering global information
	 */
	public async create(): Promise<void> {
		this.buildClient();

		this.fixGuildData();

		await this.login();
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

	public getClient(): Client { return this.client; }

	/**
	 * Finds config file and pulls it into the code
	 */
	public loadConfig(): void { this.configHandler.loadConfig(); }

	/**
	 * Returns config information that was gathered from config file
	 */
	public getConfig(): BotConfig { return this.configHandler.getConfig(); }

	/**
	 * Registers command and subcommand information from files
	 */
	public registerCommands(): void { this.commandHandler.registerCommands(); }

	/**
	 * Deploys both application and guild commands
	 */
	public deployCommands(): void { this.commandHandler.deployCommands(); }

	/**
	 * Returns command information like name, execute function, and more
	 */
	public getCommands(): Map<string, Command> { return this.commandHandler.getCommands(); }

	/**
	 * Registers event listeners from files
	 */
	public registerListeners() { this.eventHandler.registerListeners(); }

	/**
	 * Logs the bot in using token
	 */
	public async login(): Promise<void> {
		try {
			sendDebug('Logging in...');
			await this.client.login(process.env.TOKEN);
		} catch {
			handleError('Client wasn\'t initialized or you used an invalid token!');
			process.exit(-1);
		}
	}

	/**
	 * Sends a status message on start
	 */
	public async onStart(): Promise<void> {
		sendDebug('Successfully logged in! Bot online!');

		const botStatusChannel = await this.getStatusChannel();

		if (!botStatusChannel) return;

		try {
			await botStatusChannel.send(
				this.getConfig().stringConfig.botStatus +
				FormatStrings.toRelTime(Math.round(Date.now() / 1000))
			);
		} catch (err: unknown) {
			handleError(err);
		}

		sendDebug('Successfully sent status message!');
	}

	/**
	 * Deletes empty guild files (Guild was in the process of setting bot up)
	 */
	private fixGuildData(): void {
		let guildDataFolder: string;
		let guildDataFiles: string[];

		try {
			guildDataFolder = this.getConfig().pathConfig.guildDataFolder;
			guildDataFiles = fs.readdirSync(guildDataFolder);
		} catch {
			handleError('Unable to find guild data directory provided in \'config.json\'!');
			process.exit(-1);
		}

		for (const guildData of guildDataFiles) {
			const data = JSON.parse(fs.readFileSync(guildDataFolder + guildData, 'utf-8'));

			if (Object.keys(data).length !== 0) continue;

			fs.rmSync(guildDataFolder + guildData);

			sendDebug('Deleted empty guild file: ' + guildData);
		}

		sendDebug('Guild data fixed!')
	}

	/**
	 * Finds the {@link TextChannel} to send status messages to
	 * @private
	 */
	private async getStatusChannel(): Promise<TextChannel | undefined> {
		const botStatusChannelID: string = this.getConfig().botStatusChannel;
		let botStatusChannel: TextChannel;

		try {
			botStatusChannel = await this.client.channels.fetch(botStatusChannelID) as TextChannel;
		} catch {
			handleError(
				'Bot cannot find status channel. Status message not sent.\nIs the channel ID \'' +
				botStatusChannelID + '\' correct? Does the bot have view channel permissions?'
			);
			return undefined;
		}

		const memberMe = botStatusChannel.guild.members.me;
		if (!memberMe) {
			handleError('Bot doesn\'t exist in testing server. Status message not sent.');
			return undefined;
		}

		const memberMePerms = memberMe.permissions.toArray();
		if (!memberMePerms.includes('SendMessages')) {
			handleError('Bot doesn\'t have permission to send status message. Status message not sent.');
			return undefined;
		}

		return botStatusChannel;
	}

}