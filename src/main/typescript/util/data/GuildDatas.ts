import {GuildData} from './GuildData';

/**
 * {@link GuildDatas GuildDatas.ts}
 *
 * All guild data tied to a bot instance
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class GuildDatas {
    [guildID: string]: GuildData;
}