/**
 * {@link TopUserData TopUserData.ts}
 *
 * Stores information about users and associated values
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class TopUserData {
    // User ID as key, username and data value as value
    [userID: string]: [string, number] | undefined;
}