import {
    User,
    TextChannel,
    SelectMenuOptionBuilder,
    RestOrArray,
    APISelectMenuOption,
    SelectMenuComponentOptionData
} from 'discord.js';
import {PathConfig} from './PathConfig';
import {StringConfig} from './StringConfig';
import {CommandConfig} from './commands/CommandConfig';
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
    public devs: string[] = [];

    /**
     * The {@link TextChannel} ID the bot sends status messages to
     */
    public botStatusChannel: string = '';

    /**
     * The {@link PathConfig paths} of all files/folders the bot accesses
     */
    public pathConfig: PathConfig = new PathConfig;

    /**
     * {@link StringConfig String constants} the bot uses for responses and more
     */
    public stringConfig: StringConfig = new StringConfig;

    /**
     * Collection of {@link CommandConfig command configurations} the bot uses
     */
    public commandConfigs: CommandConfigs = new CommandConfigs;

    /**
     * Non-intuitive number constants the bot uses
     */
    public numberConfig: NumberConfig = new NumberConfig;

    /**
     * Collection of {@link BoarItemConfig boar item configurations}
     */
    public boarItemConfigs: BoarItemConfigs = new BoarItemConfigs;

    /**
     * Collection of {@link BadgeItemConfig badge item configurations}
     */
    public badgeItemConfigs: BadgeItemConfigs = new BadgeItemConfigs;

    /**
     * Array of {@link RarityConfig rarity configurations}
     */
    public rarityConfigs: RarityConfig[] = [];

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
    public emptySelectMenu: APISelectMenuOption[] = [{ label: '', value: '' }];

    /**
     * {@link ColorConfig Color configurations} used by the bot
     */
    public colorConfig: ColorConfig = new ColorConfig;

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