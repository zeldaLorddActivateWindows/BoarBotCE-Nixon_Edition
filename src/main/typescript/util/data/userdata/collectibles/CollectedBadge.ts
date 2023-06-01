/**
 * {@link CollectedBadge CollectedBadge.ts}
 *
 * Information for a specific collected badge.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CollectedBadge {
    public possession: boolean = false;
    public firstObtained: number = 0;
    public curObtained: number = 0;
    public lastLost: number = 0;
    public timesLost: number = 0;
}