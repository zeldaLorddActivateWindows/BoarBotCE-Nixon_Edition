import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    InteractionCollector, MessageComponentInteraction, StringSelectMenuInteraction,
} from 'discord.js';

// Reasons for ending collection
enum Reasons {
    Finished = 'finished',
    Cancelled = 'cancelled',
    Error = 'error',
    Expired = 'idle'
}

/**
 * {@link CollectorUtils CollectorUtils.ts}
 *
 * A collection of functions that collectors
 * use frequently.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CollectorUtils {
    public static readonly Reasons = Reasons;

    /**
     * Determines whether the interaction should be processed
     *
     * @param timerVars - Information regarding component cooldown
     * @param inter - Used if the interaction should be dumped
     */
    public static async canInteract(
        timerVars: { timeUntilNextCollect: number, updateTime: NodeJS.Timer },
        inter?: ButtonInteraction | StringSelectMenuInteraction,
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
     * @param excludeUser - Whether to exclude the user instead of it only being them
     * @private
     */
    public static async createCollector(
        interaction: ChatInputCommandInteraction | MessageComponentInteraction,
        excludeUser: boolean = false
    ): Promise<InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>> {
        // Only allows button presses from current interaction
        const filter = async (compInter: MessageComponentInteraction) => {
            const modifiers = compInter.customId.split('|').slice(1);
            let returnVal = modifiers[0] === interaction.id;

            if (modifiers.length > 1 && excludeUser) {
                return returnVal && modifiers[1] !== compInter.user.id;
            } else if (modifiers.length > 1) {
                return returnVal && modifiers[1] === compInter.user.id;
            }

            return returnVal;
        };

        return interaction.channel?.createMessageComponentCollector({
            filter,
            idle: 1000 * 60 * 2
        }) as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
    }
}