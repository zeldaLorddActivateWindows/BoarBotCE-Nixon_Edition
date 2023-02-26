import {BotConfig} from '../config/BotConfig';
import fs from 'fs';
import {handleError, sendDebug} from '../../logging/LogDebug';
import {Command} from '../../api/commands/Command';
import {REST} from '@discordjs/rest';
import {registerFont} from 'canvas';
import moment from 'moment/moment';
import {BoarBotApp} from '../../BoarBotApp';
import {Client} from 'discord.js';

/**
 * {@link EventHandler EventHandler.ts}
 *
 * Handles setting, getting, and deploying commands
 * for a bot instance
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class EventHandler {
    /**
     * Registers {@link Listener event listeners} for the bot
     */
    public registerListeners(): void {
        const config: BotConfig = BoarBotApp.getBot().getConfig();
        const client: Client = BoarBotApp.getBot().getClient();

        let listenerFiles: string[];

        try {
            listenerFiles = fs.readdirSync(config.pathConfig.listeners);
        } catch {
            handleError('Unable to find listener directory provided in \'config.json\'!');
            process.exit(-1);
        }

        for (const listenerFile of listenerFiles) {
            try {
                const exports = require('../listeners/' + listenerFile);
                const listenClass = new exports.default();

                client.on(listenClass.eventName, (...args: any[]) => listenClass.execute(...args));

                sendDebug('Successfully registered listener for event: ' + listenClass.eventName);
            } catch {
                handleError('One or more listener classes has an invalid structure!');
                process.exit(-1);
            }
        }
    }
}