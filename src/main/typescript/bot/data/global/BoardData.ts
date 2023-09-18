/**
 * {@link BoardData BoardData.ts}
 *
 * Stores information about a specific leaderboard
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class BoardData {
    public topUser?: string; // ID of top user
    public userData = {} as Record<string, [userID: string, value: number]>; // Leaderboard data for all users
}