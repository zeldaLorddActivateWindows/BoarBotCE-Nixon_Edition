/***********************************************
 * BoarBot.ts
 * Creates the bot, logs it in, then finds where
 * all event and command handlers are.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import dotenv from 'dotenv';
import {BoarBot} from './bot/BoarBot';
import {Bot} from './api/bot/Bot';
import {LogDebug} from './util/logging/LogDebug';

dotenv.config();

//***************************************

export class BoarBotApp {
    private static bot: Bot;

    public static async main(): Promise<void> {
        const boarBot = new BoarBot();
        this.bot = boarBot;

        await boarBot.create();

        if (process.argv[2] === 'deploy')
            await boarBot.deployCommands();
    }

    public static getBot(): Bot {
        return this.bot;
    }
}

//***************************************

try {
    BoarBotApp.main();
} catch (err: unknown) {
    LogDebug.handleError(err);
}