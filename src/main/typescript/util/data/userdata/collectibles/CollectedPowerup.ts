/**
 * {@link CollectedPowerup CollectedPowerup.ts}
 *
 * Information for a specific collected powerup.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CollectedPowerup {
    public numTotal: number = 0;
    public highestTotal: number = 0;
    public numClaimed: number = 0;
    public numUsed: number = 0;
    public firstUsed: number = 0;
    public lastUsed: number = 0;
    public numOpened?: number;
    public raritiesUsed?: number[];
}