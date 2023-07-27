import {BotConfig} from '../config/BotConfig';
import fs from 'fs';
import {BoarBotApp} from '../../BoarBotApp';
import {Client} from 'discord.js';
import {LogDebug} from '../../util/logging/LogDebug';

/**
 * {@link EventHandler EventHandler.ts}
 *
 * Handles registering listeners for
 * a bot instance.
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
            LogDebug.handleError('Unable to find listener directory provided in \'config.json\'!');
            process.exit(-1);
        }

        for (const listenerFile of listenerFiles) {
            try {
                const exports: any = require('../../listeners/' + listenerFile);
                const listenClass: any = new exports.default();

                client.on(listenClass.eventName, (...args: string[]) => listenClass.execute(...args));

                LogDebug.log('Successfully registered listener for event: ' + listenClass.eventName, config);
            } catch (err: unknown) {
                LogDebug.handleError(err);
                process.exit(-1);
            }
        }
    }
}