import {BuySellData} from './BuySellData';

/**
 * {@link ItemData ItemData.ts}
 *
 * Stores information about an item globally
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class ItemData {
    public curEdition?: number;
    public buyers: BuySellData[] = [];
    public sellers: BuySellData[] = [];
    public lastBuys: [number, number, string] = [0, 0, ''];
    public lastSells: [number, number, string] = [0, 0, ''];
}