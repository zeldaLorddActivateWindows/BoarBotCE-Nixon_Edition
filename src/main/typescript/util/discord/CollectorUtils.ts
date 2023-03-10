import {ButtonInteraction, ChatInputCommandInteraction, InteractionCollector, SelectMenuInteraction} from 'discord.js';

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

        timerVars: { timeUntilNextCollect: number, updateTime: NodeJS.Timer },
        inter?: ButtonInteraction | SelectMenuInteraction,
    ): Promise<boolean> {
        // If the collection attempt was too quick, cancel it
        if (inter && Date.now() < timerVars.timeUntilNextCollect) {
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

    /**
     * Creates and returns a message component collector
     *
     * @param interaction - The interaction to create the collector with
     * @param addition - What should be found at the end of custom ID
     * @private
     */
    public static async createCollector(
        interaction: ChatInputCommandInteraction,
        addition: string
    ): Promise<InteractionCollector<ButtonInteraction | SelectMenuInteraction>> {
        // Only allows button presses from current interaction
        const filter = async (compInter: ButtonInteraction | SelectMenuInteraction) => {
            return compInter.customId.endsWith(addition);
        };

        return interaction.channel?.createMessageComponentCollector({
            filter,
            idle: 1000 * 60 * 2
        }) as InteractionCollector<ButtonInteraction | SelectMenuInteraction>;
    }
}