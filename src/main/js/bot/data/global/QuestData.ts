/**
 * {@link QuestData QuestData.ts}
 *
 * Stores data for quests globally
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class QuestData {
    questsStartTimestamp = 0;

    // All 7 quests in ID form, with easiest coming first and hardest coming last
    curQuestIDs = ['', '', '', '', '', '', ''] as [string, string, string, string, string, string, string]
}