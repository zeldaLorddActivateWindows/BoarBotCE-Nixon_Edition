import {BadgeItemConfig} from './items/BadgeItemConfig';

/**
 * {@link ColorConfig ColorConfig.ts}
 *
 * Stores number configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ColorConfig {
    [colorKey: string]: string;

    public readonly foregroundGray: string = '';
    public readonly font: string = '';

    public readonly badge: string = '';

    public readonly rarity1: string = '';
    public readonly rarity2: string = '';
    public readonly rarity3: string = '';
    public readonly rarity4: string = '';
    public readonly rarity5: string = '';
    public readonly rarity6: string = '';
    public readonly rarity7: string = '';
}