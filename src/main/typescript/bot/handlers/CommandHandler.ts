import {Routes} from 'discord-api-types/v10';
import {BotConfig} from '../config/BotConfig';
import fs from 'fs';
import {handleError, sendDebug} from '../../logging/LogDebug';
import {Command} from '../../api/commands/Command';
import {REST} from '@discordjs/rest';
import {BoarBotApp} from '../../BoarBotApp';

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

        const commandFiles: string[] = [];

        for (const commandFolder of commandFolders) {
            const folderFiles: string[] = fs.readdirSync(config.pathConfig.commands + commandFolder);
            const commandFile: string | undefined = folderFiles.find((fileName) => {
                return fileName.toLowerCase().includes('command') && !fileName.toLowerCase().includes('subcommand');
            });

            if (!commandFile) {
                handleError(`Command folder '${commandFolder}' has no command class file!`);
                continue;
            }

            commandFiles.push(commandFile);
        }

        for (const commandFile of commandFiles) {
            try {
                const exports = require('../commands/' + commandFile);
                const commandClass = new exports.default();

                this.commands.set(commandClass.data.name, commandClass);

                sendDebug('Successfully found and set command: ' + commandClass.data.name);
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
}