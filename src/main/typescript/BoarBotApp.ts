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

dotenv.config();

//***************************************

class BoarBotApp {
    main(): void { new BoarBot(); }
}

//***************************************

try {
    new BoarBotApp().main();
} catch {
    handleError('Failed to log bot in!');
}