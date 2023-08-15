import {TextChannel, ForumChannel} from 'discord.js';
import {PathConfig} from './PathConfig';
import {StringConfig} from './StringConfig';
import {NumberConfig} from './NumberConfig';
import {CommandConfigs} from './commands/CommandConfigs';
import {RarityConfig} from './items/RarityConfig';
import {ColorConfig} from './ColorConfig';
import {PromptConfigs} from './prompts/PromptConfigs';
import {AllItemConfigs} from './items/AllItemConfigs';
import {QuestConfigs} from './quests/QuestConfigs';

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
     * The {@link TextChannel} ID the bot sends certain logs to
     */
    public readonly logChannel: string = '';

    /**
     * The {@link ForumChannel} ID the bot sends reports to
     */
    public readonly reportsChannel: string = '';

    /**
     * The {@link TextChannel} ID the bot sends update messages to
     */
    public readonly updatesChannel: string = '';

    /**
     * The {@link PathConfig paths} of all files/folders the bot accesses
     */
    public readonly pathConfig: PathConfig = new PathConfig;

    /**
     * {@link StringConfig String constants} the bot uses for responses and more
     */
    public readonly stringConfig: StringConfig = new StringConfig;

    /**
     * Non-intuitive number constants the bot uses
     */
    public readonly numberConfig: NumberConfig = new NumberConfig;

    /**
     * Collection of information about powerups
     */
    public readonly promptConfigs: PromptConfigs = new PromptConfigs;

    /**
     * Collection of information about quests
     */
    public readonly questConfigs: QuestConfigs = new QuestConfigs;

    /**
     * Collection of {@link CommandConfig command configurations} the bot uses
     */
    public readonly commandConfigs: CommandConfigs = new CommandConfigs;

    /**
     * Collection of {@link ItemConfigs sets of item configurations}
     */
    public readonly itemConfigs: AllItemConfigs = new AllItemConfigs;

    /**
     * Array of {@link RarityConfig rarity configurations}
     */
    public readonly rarityConfigs: RarityConfig[] = [];

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

    /**
     * If the market can be opened using /boar market
     */
    public readonly marketOpen: boolean = false;
}