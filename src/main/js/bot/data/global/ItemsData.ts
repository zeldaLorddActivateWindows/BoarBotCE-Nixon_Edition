import {ItemData} from './ItemData';

/**
 * {@link ItemsData ItemsData.ts}
 *
 * Stores information all items globally
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class ItemsData {
    [itemType: string]: Record<string, ItemData>
    public powerups = {} as Record<string, ItemData>;
    public boars = {} as Record<string, ItemData>;
}