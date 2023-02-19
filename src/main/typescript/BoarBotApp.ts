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
import {handleError} from './logging/LogDebug';
import {Bot} from './api/bot/Bot';

dotenv.config();

//***************************************

export class BoarBotApp {
    private static bot: Bot;

    public static main(): void {
        this.bot = new BoarBot();
    }

    public static getBot(): Bot {
        return this.bot;
    }
}

//***************************************

try {
    BoarBotApp.main();
} catch {
    handleError('Failed to log bot in!');
}