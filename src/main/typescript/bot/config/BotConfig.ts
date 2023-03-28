import {
    User,
    TextChannel,
    APISelectMenuOption,
} from 'discord.js';
import {PathConfig} from './PathConfig';
import {StringConfig} from './StringConfig';
import {NumberConfig} from './NumberConfig';
import {CommandConfigs} from './commands/CommandConfigs';
import {BoarItemConfigs} from './items/BoarItemConfigs';
import {BadgeItemConfigs} from './items/BadgeItemConfigs';
import {RarityConfig} from './items/RarityConfig';
import {ColorConfig} from './ColorConfig';

/**
 * {@link BotConfig BotConfig.ts}
 *
 * Stores configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BotConfig {
    /**
     * All {@link User} IDs associated with developers
     */
    public readonly devs: string[] = [];

    /**
     * The {@link TextChannel} ID the bot sends status messages to
     */
    public readonly botStatusChannel: string = '';

    /**
     * The {@link TextChannel} ID the bot sends logs and reports to
     */
    public readonly logChannel: string = '';

    /**
     * The {@link PathConfig paths} of all files/folders the bot accesses
     */
    public readonly pathConfig: PathConfig = new PathConfig;

    /**
     * {@link StringConfig String constants} the bot uses for responses and more
     */
    public readonly stringConfig: StringConfig = new StringConfig;

    /**
     * Collection of {@link CommandConfig command configurations} the bot uses
     */
    public readonly commandConfigs: CommandConfigs = new CommandConfigs;

    /**
     * Non-intuitive number constants the bot uses
     */
    public readonly numberConfig: NumberConfig = new NumberConfig;

    /**
     * Collection of {@link BoarItemConfig boar item configurations}
     */
    public readonly boarItemConfigs: BoarItemConfigs = new BoarItemConfigs;

    /**
     * Collection of {@link BadgeItemConfig badge item configurations}
     */
    public readonly badgeItemConfigs: BadgeItemConfigs = new BadgeItemConfigs;

    /**
     * Array of {@link RarityConfig rarity configurations}
     */
    public readonly rarityConfigs: RarityConfig[] = [];

    /**
     * Object storing initial user data
     */
    public readonly emptyUser: any;

    /**
     * Object storing initial boar data in collection
     */
    public readonly emptyBoar: any;

    /**
     * {@link ColorConfig Color configurations} used by the bot
     */
    public readonly colorConfig: ColorConfig = new ColorConfig;

    /**
     * If boars can be obtained without waiting for the next day
     */
    public readonly unlimitedBoars: boolean = false;

    /**
     * If debug messages should be sent to the console
     */
    public readonly debugMode: boolean = true;

    /**
     * If the bot is in maintenance mode
     */
    public readonly maintenanceMode: boolean = false;
}