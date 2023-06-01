import {UserData} from './UserData';

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
    public buyers: UserData = new UserData;
    public sellers: UserData = new UserData;
}