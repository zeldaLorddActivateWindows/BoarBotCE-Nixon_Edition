/**
 * {@link GeneralStats GeneralStats.ts}
 *
 * A collection of user general stats.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class GeneralStats {
    public lastDaily = 0;
    public numDailies = 0;
    public totalBoars = 0;
    public boarScore = 0;
    public favoriteBoar = '';
    public lastBoar = '';
    public firstDaily = 0;
    public boarStreak = 0;
    public highestStreak = 0;
    public multiplier = 1;
    public highestMulti = 0;
    public notificationsOn = false;
    public notificationChannel = '';
    public unbanTime: number | undefined; // No longer used, now stored globally
    public deletionTime: number | undefined;
}