/***********************************************
 * Listener.ts
 * An interface used to create new listeners.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {Events} from 'discord.js';

//***************************************

export interface Listener {
    eventName: Events;
    execute(...args: any[]): void;
}