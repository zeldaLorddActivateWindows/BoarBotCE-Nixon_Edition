/**
 * {@link QuestConfig QuestConfig.ts}
 *
 * Stores a quest configuration for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class QuestConfig {
    public readonly description: string = ' ';
    public readonly descriptionAlt: string = ' ';
    public readonly lowerReward: string = ' ';
    public readonly higherReward: string = ' ';
    public readonly valType: string = ' ';
    public readonly questVals: [number, number][] = [];
}