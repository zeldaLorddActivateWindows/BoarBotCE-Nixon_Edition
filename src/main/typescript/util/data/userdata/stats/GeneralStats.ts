/**
 * {@link GeneralStats GeneralStats.ts}
 *
 * A collection of user general stats.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class GeneralStats {
    public lastDaily: number = 0;
    public numDailies: number = 0;
    public totalBoars: number = 0;
    public boarScore: number = 0;
    public favoriteBoar: string = '';
    public lastBoar: string = '';
    public firstDaily: number = 0;
    public boarStreak: number = 0;
    public multiplier: number = 1;
    public highestMulti: number = 0;
    public notificationsOn: boolean = false;
}