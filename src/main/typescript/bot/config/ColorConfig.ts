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

    public foregroundGray: string = '';
    public font: string = '';

    public badge: string = '';

    public rarity1: string = '';
    public rarity2: string = '';
    public rarity3: string = '';
    public rarity4: string = '';
    public rarity5: string = '';
    public rarity6: string = '';
    public rarity7: string = '';
}