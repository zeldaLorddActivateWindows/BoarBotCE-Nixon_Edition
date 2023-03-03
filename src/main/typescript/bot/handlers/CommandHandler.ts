import {Routes} from 'discord-api-types/v10';
import {BotConfig} from '../config/BotConfig';
import fs from 'fs';
import {handleError, sendDebug} from '../../logging/LogDebug';
import {Command} from '../../api/commands/Command';
import {REST} from '@discordjs/rest';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder} from 'discord.js';

/**
 * {@link CommandHandler CommandHandler.ts}
 *
 * Handles setting, getting, and deploying commands
 * for a bot instance
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CommandHandler {
    private commands: Map<string, Command> = new Map();
    private subcommands: Map<string, Subcommand> = new Map();

    /**
     * Sets up all the {@link Command commands} the bot can use
     */
    public registerCommands(): void {
        const config: BotConfig = BoarBotApp.getBot().getConfig();

        let commandFolders: string[];

        try {
            commandFolders = fs.readdirSync(config.pathConfig.commands);
        } catch {
            handleError('Unable to find command directory provided in \'config.json\'!');
            process.exit(-1);
        }

        const allFiles: string[][] = this.findCommandFiles(config, commandFolders);
        this.registerCommandFiles(config, allFiles);
    }

    /**
     * Finds all command and subcommand files
     *
     * @param config - The config file to use. Parameterized to prevent bugs when updating config
     * @param commandFolders - All folders that store commands
     * @return allFiles - All command ans subcommand files
     * @private
     */
    private findCommandFiles(config: BotConfig, commandFolders: string[]): string[][] {
        let allCommandFiles: string[] = [];
        let allSubcommandFiles: string[] = [];

        for (const commandFolder of commandFolders) {
            const folderFiles = fs.readdirSync(config.pathConfig.commands + commandFolder);

            const subcommandFiles = folderFiles.filter(fileName => {
                return fileName.toLowerCase().includes('subcommand');
            });

            subcommandFiles.forEach((fileName, index, arr) => {
                arr[index] = commandFolder + '/' + fileName;
            });

            allSubcommandFiles = allSubcommandFiles.concat(subcommandFiles);

            const commandFile = folderFiles.find(fileName => {
                return !subcommandFiles.includes(fileName);
            });

            if (!commandFile) {
                handleError(`Command folder '${commandFolder}' has no command class file!`);
                process.exit(-1);
            }

            folderFiles.forEach((fileName, index, arr) => {
                arr[index] = commandFolder + '/' + fileName;
            });

            allCommandFiles = allCommandFiles.concat(folderFiles);
        }

        return [allCommandFiles, allSubcommandFiles];
    }

    /**
     * Registers commands from their respective files
     *
     * @param config - The config file to use. Parameterized to prevent bugs when updating config
     * @param allFiles - All command and subcommand files
     * @private
     */
    private registerCommandFiles(config: BotConfig, allFiles: string[][]): void {
        const commandFiles: string[] = allFiles[0];
        const subcommandFiles: string[] = allFiles[1];

        for (const commandFile of commandFiles) {
            try {
                const exports = require('../../commands/' + commandFile);
                const commandClass = new exports.default();

                if (!subcommandFiles.includes(commandFile)) {
                    this.commands.set(commandClass.data.name, commandClass);
                } else {
                    this.subcommands.set(commandClass.data.name, commandClass);
                }

                sendDebug('Successfully found and set command: ' + commandClass.data.name, config);
            } catch {
                handleError('One or more command classes have an invalid structure!');
                process.exit(-1);
            }
        }
    }

    /**
     * Grabs the {@link Map} storing {@link Command} data
     */
    public getCommands(): Map<string, Command> { return this.commands; }

    public getSubcommands(): Map<string, Subcommand> { return this.subcommands; }

    /**
     * Deploys application commands to Discord API
     */
    public async deployCommands(): Promise<void> {
        const config = BoarBotApp.getBot().getConfig();
        const applicationCommandData: (SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder)[] = [];
        const guildCommandData: (SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder)[]  = [];

        for (const command of [...this.commands.values()]) {
            if (command.data.toJSON().default_member_permissions?.includes('0')) {
                guildCommandData.push(command.data);
                continue;
            }

            applicationCommandData.push(command.data);
        }

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN as string);
        await this.deployApplicationCommands(rest, applicationCommandData, config);
        await this.deployGuildCommands(rest, guildCommandData, config);
    }

    /**
     * Deploys application commands
     *
     * @param rest - API authorization
     * @param commandData - Application command data
     * @param config - The config file to use. Parameterized to prevent bugs when updating config
     * @private
     */
    private async deployApplicationCommands(
        rest: REST,
        commandData: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder[],
        config: BotConfig
    ): Promise<void> {
        try {
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID as string), { body: commandData });
            sendDebug('Application commands have successfully been registered!', config);
        } catch (err: unknown) {
            handleError(err);
        }
    }

    /**
     * Deploys guild application commands
     *
     * @param rest - API authorization
     * @param commandData - Guild application command data
     * @param config - The config file to use. Parameterized to prevent bugs when updating config
     * @private
     */
    private async deployGuildCommands(
        rest: REST,
        commandData: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder[],
        config: BotConfig
    ): Promise<void> {
        try {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID as string, process.env.GUILD_ID as string),
                { body: commandData }
            );
            sendDebug('Guild commands have successfully been registered!', config);
        } catch (err: unknown) {
            handleError(err);
        }
    }
}

