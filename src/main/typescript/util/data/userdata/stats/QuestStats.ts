/**
 * {@link QuestStats QuestStats.ts}
 *
 * A collection of user quest stats.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class QuestStats {
    public questWeekStart = 0;
    public progress: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];
    public claimed: [number, number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0, 0];
    public totalCompleted = 0;
    public totalFullCompleted = 0;
}