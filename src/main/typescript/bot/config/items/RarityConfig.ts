/**
 * {@link RarityConfig RarityConfig.ts}
 *
 * Stores rarity configurations for a specific rarity
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class RarityConfig {
    public name: string = '';
    public weight: number = 0;
    public score: number = 0;
    public fromDaily: boolean = false;
    public boars: string[] = [];
}