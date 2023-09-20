import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    MessageComponentInteraction,
    ModalSubmitInteraction, TextChannel
} from 'discord.js';
import {BotConfig} from '../../bot/config/BotConfig';
import {BoarBotApp} from '../../BoarBotApp';
import {InteractionUtils} from '../interactions/InteractionUtils';
import {Replies} from '../interactions/Replies';
import fs from 'fs';
import AdmZip from 'adm-zip';

// Console colors
enum Colors {
    White = '\x1b[0m',
    Yellow = '\x1b[33m',
    Grey = '\x1b[90m',
    Red = '\x1b[31m',
    Green = '\x1b[32m'
}

/**
 * {@link LogDebug LogDebug.ts}
 *
 * Handles util logging information, debugging, and
 * errors.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class LogDebug {
    public static readonly Colors = Colors;

    /**
     * Sends messages to the console
     *
     * @param debugMessage - Message to send to debug
     * @param config - Used to get debug prefix and see if debug mode
     * @param interaction - Whether to prepend string with command and user info
     * @param sendToChannel
     */
    public static log(
        debugMessage: any,
        config: BotConfig,
        interaction?: ChatInputCommandInteraction | AutocompleteInteraction | MessageComponentInteraction,
        sendToChannel = false
    ): void {
        if (!config.debugMode) return;

        const prefix = `[${Colors.Yellow}LOG${Colors.White}] `;
        const time = LogDebug.getPrefixTime();

        if (typeof debugMessage !== 'string') {
            debugMessage = JSON.stringify(debugMessage, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        }

        if (interaction && !interaction.isMessageComponent()) {
            debugMessage = config.stringConfig.commandDebugPrefix
                .replace('%@', interaction.user.username + ' (' + interaction.user.id + ')')
                .replace('%@', interaction.commandName + ' ')
                .replace('%@', interaction.options.getSubcommand()) +
                debugMessage
        } else if (interaction) {
            debugMessage = config.stringConfig.commandDebugPrefix
                .replace('%@', interaction.user.username + ' (' + interaction.user.id + ')')
                .replace('%@', interaction.customId.split('|')[0])
                .replace('%@', '') +
                debugMessage
        }

        const completeString = prefix + time + debugMessage;

        try {
            if (sendToChannel) {
                this.sendLogToChannel(completeString, config);
            } else {
                console.log(completeString);
            }
        } catch {
            console.log(completeString);
        }

        this.writeToLogFile(completeString, config);
    }

    /**
     * Handles error responses in console and interactions
     *
     * @param err - Error message
     * @param interaction - Interaction to reply to
     * @param sendToChannel
     */
    public static async handleError(
        err: unknown | string,
        interaction?: ChatInputCommandInteraction | ModalSubmitInteraction |
            AutocompleteInteraction | MessageComponentInteraction,
        sendToChannel = true
    ): Promise<boolean> {
        try {
            const errString: string | undefined = typeof err === 'string' ? err : (err as Error).stack;
            const prefix = `[${Colors.Red}CAUGHT ERROR${Colors.White}] `;
            const time: string = LogDebug.getPrefixTime();
            const config: BotConfig = BoarBotApp.getBot().getConfig();

            if (
                errString && (errString.includes('Unknown interaction') ||
                errString.includes('Unknown Message') ||
                errString.includes('Missing Access') ||
                errString.includes('ChannelNotCached'))
            ) {
                LogDebug.log(errString, config);
                return false;
            }

            let completeString: string = prefix + time;
            if (interaction && interaction.isChatInputCommand()) {
                completeString += config.stringConfig.commandDebugPrefix
                    .replace('%@', interaction.user.username + ' (' + interaction.user.id + ')')
                    .replace('%@', interaction.commandName + ' ')
                    .replace('%@', interaction.options.getSubcommand()) +
                    errString;
            } else {
                completeString += errString;
            }

            try {
                if (sendToChannel) {
                    await this.sendLogToChannel(completeString, config, true);
                } else {
                    console.log(completeString);
                }
            } catch {
                console.log(completeString);
            }

            this.writeToLogFile(completeString, config);

            if (!interaction || interaction.isAutocomplete()) return true;

            const errResponse = config.stringConfig.error;

            await Replies.handleReply(interaction, errResponse, config.colorConfig.error);
        } catch (err: unknown) {
            await this.handleError(err, undefined, false);
        }

        return true;
    }

    /**
     * Pauses the code for a specified amount of time
     *
     * @param time - Time in ms to sleep
     */
    public static async sleep(time: number): Promise<void> {
        return new Promise(r => setTimeout(r, time));
    }

    /**
     * Gets the formatted time that goes after the prefix
     *
     * @private
     */
    private static getPrefixTime(): string {
        return `[${Colors.Grey}${new Date().toLocaleString()}${Colors.White}]\n`;
    }

    private static async sendLogToChannel(message: string, config: BotConfig, ping = false): Promise<void> {
        console.log(message);

        if (BoarBotApp.getBot().getClient().isReady()) {
            const logChannel: TextChannel | undefined = await InteractionUtils.getTextChannel(config.logChannel);
            const pingMessage = ping
                ? `<@${config.devs[0]}>`
                : '';

            if (!logChannel) return;
            await logChannel.send(pingMessage + '```ansi\n' + message.substring(0, 1800) + '```').catch(() => {});
        }
    }

    private static writeToLogFile(completeString: string, config: BotConfig): void {
        if (BoarBotApp.getBot().getClient().isReady()) {
            const curTime = Date.now();
            const curFolderName = new Date(curTime).toLocaleDateString().replaceAll('/','-');
            const oldFolderName =
                new Date(curTime - config.numberConfig.oneDay).toLocaleDateString().replaceAll('/','-');

            if (!fs.existsSync(config.pathConfig.logsFolder)) {
                fs.mkdirSync(config.pathConfig.logsFolder);
            }

            if (fs.existsSync(config.pathConfig.logsFolder + oldFolderName)) {
                const zip = new AdmZip();
                zip.addLocalFolder(config.pathConfig.logsFolder + oldFolderName);
                zip.writeZip(config.pathConfig.logsFolder + oldFolderName + '.zip');
                fs.rmSync(config.pathConfig.logsFolder + oldFolderName, { recursive: true });
            }

            if (!fs.existsSync(config.pathConfig.logsFolder + curFolderName)) {
                fs.mkdirSync(config.pathConfig.logsFolder + curFolderName);
            }

            fs.appendFileSync(
                config.pathConfig.logsFolder + curFolderName + '/' + BoarBotApp.getBot().getClient().readyTimestamp +
                '.log', completeString.replace(
                /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''
            ) + '\n'
            );
        }
    }
}
