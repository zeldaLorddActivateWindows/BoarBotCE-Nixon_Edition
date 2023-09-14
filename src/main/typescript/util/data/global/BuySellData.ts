/**
 * {@link BuySellData BuySellData.ts}
 *
 * Stores information a buy/sell entry of an item
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class BuySellData {
    public userID = '';
    public price = 0;
    public num = 0;
    public editions: number[] = [];
    public editionDates: number[] = [];
    public listTime = 0;
    public filledAmount = 0;
    public claimedAmount = 0;
}