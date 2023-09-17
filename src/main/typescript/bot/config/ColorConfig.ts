/**
 * {@link ColorConfig ColorConfig.ts}
 *
 * Stores number configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ColorConfig {
    readonly [colorKey: string]: string;

    // Colors used in custom images

    public readonly dark: string = '#000000';
    public readonly mid: string = '#000000';
    public readonly light: string = '#000000';
    public readonly font: string = '#000000';

    // Colors for different item types

    public readonly badge: string = '#000000';
    public readonly powerup: string = '#000000';
    public readonly bucks: string = '#000000';

    // Leaderboard colors

    public readonly gold: string = '#000000';
    public readonly silver: string = '#000000'; // Used for slight emphasis too
    public readonly bronze: string = '#000000';

    // General purpose colors

    public readonly green: string = '#000000';
    public readonly maintenance: string = '#000000';
    public readonly error: string = '#000000';

    // Boar rarity colors

    public readonly rarity1: string = '#000000';
    public readonly rarity2: string = '#000000';
    public readonly rarity3: string = '#000000';
    public readonly rarity4: string = '#000000';
    public readonly rarity5: string = '#000000';
    public readonly rarity6: string = '#000000';
    public readonly rarity7: string = '#000000';
}