/**
 * {@link RarityConfig RarityConfig.ts}
 *
 * Stores a specific rarity configuration
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class RarityConfig {
    public readonly name: string = '';
    public readonly pluralName: string = '';
    public readonly weight: number = 0;
    public readonly score: number = 0;
    public readonly fromDaily: boolean = false;
    public readonly enhancersNeeded: number = 0;
    public readonly boars: string[] = [];
}