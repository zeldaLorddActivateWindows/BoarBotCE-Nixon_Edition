/***********************************************
 * BotConfig.ts
 * Stores configurations for a bot instance
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {
    User,
    TextChannel,
    SelectMenuOptionBuilder,
    RestOrArray,
    APISelectMenuOption,
    SelectMenuComponentOptionData
} from 'discord.js';
import {PathConfig} from './PathConfig';

//***************************************

export class BotConfig {
    /**
     * All {@link User} IDs associated with developers
     */
    public devs: string[] = [];

    /**
     * The {@link TextChannel} ID the bot sends status messages
     */
    public botStatusChannel: string = '';

    /**
     * The paths of all files/folders the bot accesses
     */
    public pathConfig: PathConfig = {} as PathConfig;

    /**
     * String constants the bot uses for responses
     */
    public stringConfig: any;

    /**
     * Non-intuitive number constants the bot uses
     */
    public numberConfig: any;

    /**
     * All {@link BoarItem Boar Items}
     */
    public boarCollectibles: any;

    /**
     * All {@link BadgeItem Badge Items}
     */
    public badgeCollectibles: any;

    /**
     * All {@link Rarity Rarities}
     */
    public rarityConfig: any;

    /**
     * Object storing initial user data
     */
    public emptyUser: any;

    /**
     * Object storing initial boar data in collection
     */
    public emptyBoar: any;

    /**
     * Option that's left when select menu empty
     */
    public emptySelectMenu: RestOrArray<SelectMenuComponentOptionData> = [{ label: '', value: '' }];

    /**
     * {@link Color Colors} used by the bot
     */
    public hexValues: any;

    /**
     * If boars can be obtained without waiting for the next day
     */
    public unlimitedBoars: boolean = false;

    /**
     * If debug messages should be sent to the console
     */
    public debugMode: boolean = false;

    /**
     * If the bot is in maintenance mode
     */
    public maintenanceMode: boolean = false;
}