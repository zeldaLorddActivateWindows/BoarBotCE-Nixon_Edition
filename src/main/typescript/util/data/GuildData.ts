/**
 * {@link GuildData GuildData.ts}
 *
 * A guild's configured information in a bot instance
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class GuildData {
    public fullySetup: boolean = false;
    public isSBServer: boolean = false;
    public tradeChannel: string = '';
    public channels: string[] = [];
}