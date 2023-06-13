/**
 * {@link BuySellData BuySellData.ts}
 *
 * Stores information a buy/sell entry of an item
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class BuySellData {
    public userID: string = '';
    public price: number = 0;
    public num: number = 0;
    public editions: number[] | undefined;
    public editionDates: number[] | undefined;
    public listTime: number = 0;
    public filledAmount: number = 0;
}