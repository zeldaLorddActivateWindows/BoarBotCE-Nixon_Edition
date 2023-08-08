/**
 * {@link CollectedPowerup CollectedPowerup.ts}
 *
 * Information for a specific collected powerup.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CollectedPowerup {
    public numTotal = 0;
    public highestTotal = 0;
    public numClaimed = 0;
    public numUsed = 0;
    public firstUsed = 0;
    public lastUsed = 0;
    public numActive?: number;
    public numOpened?: number;
    public raritiesUsed?: number[];
}