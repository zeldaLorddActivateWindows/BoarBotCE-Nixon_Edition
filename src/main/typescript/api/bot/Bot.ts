/***********************************************
 * Bot.ts
 * An interface used to handle a new bot.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

//***************************************

export interface Bot {
    buildClient(): void;
    loadConfig(): void;
    // getConfig(): any;
    loadFonts(): void;
    setRelativeTime(): void;
    // registerCommands(): void;
    // registerListeners(): void;
    // fixGuildData(): void;
    onStart(): void;
    login(): void;
}