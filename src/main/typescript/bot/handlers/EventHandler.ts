import fs from 'fs';
import {BoarBotApp} from '../../BoarBotApp';
import {LogDebug} from '../../util/logging/LogDebug';

/**
 * {@link EventHandler EventHandler.ts}
 *
 * Handles registering listeners for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class EventHandler {
    /**
     * Registers {@link Listener event listeners} for the bot
     */
    public registerListeners(): void {
        const config = BoarBotApp.getBot().getConfig();
        const client = BoarBotApp.getBot().getClient();

        let listenerFiles: string[];

        try {
            listenerFiles = fs.readdirSync(config.pathConfig.listeners).filter((fname: string) => {
                return fname.endsWith('.js');
            });
        } catch {
            LogDebug.handleError('Unable to find listener directory provided in \'config.json\'!');
            process.exit(-1);
        }

        for (const listenerFile of listenerFiles) {
            try {
                const exports = require('../../listeners/' + listenerFile);
                const listenClass = new exports.default();

                client.on(listenClass.eventName, (...args: string[]) => listenClass.execute(...args));

                LogDebug.log('Successfully registered listener for event: ' + listenClass.eventName, config);
            } catch (err: unknown) {
                LogDebug.handleError(err);
                process.exit(-1);
            }
        }
    }
}