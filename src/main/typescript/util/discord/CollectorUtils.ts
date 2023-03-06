import {ButtonInteraction, SelectMenuInteraction} from 'discord.js';

/**
 * {@link CollectorUtils CollectorUtils.ts}
 *
 * A collection of functions that collectors
 * use frequently
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CollectorUtils {
    public static async canInteract(
        inter: ButtonInteraction | SelectMenuInteraction,
        timerVars: { timeUntilNextCollect: number, updateTime: NodeJS.Timer },
        onlyUpdate: boolean = false
    ): Promise<boolean> {
        // If the collection attempt was too quick, cancel it
        if (!onlyUpdate && Date.now() < timerVars.timeUntilNextCollect) {
            await inter.deferUpdate();
            return false;
        }

        // Updates time to collect every 100ms, preventing
        // users from clicking too fast
        timerVars.timeUntilNextCollect = Date.now() + 500;
        timerVars.updateTime = setInterval(() => {
            timerVars.timeUntilNextCollect = Date.now() + 500;
        }, 100);

        return true;
    }
}