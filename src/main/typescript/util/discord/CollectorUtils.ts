import {
    ButtonInteraction,
    InteractionCollector, MessageComponentInteraction, StringSelectMenuInteraction, TextChannel,
} from 'discord.js';
import {NumberConfig} from '../../bot/config/NumberConfig';
import {Replies} from '../interactions/Replies';
import {BoarBotApp} from '../../BoarBotApp';

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
    public static marketCollectors:
        Record<string, InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>> = {};
    public static collectionCollectors:
        Record<string, InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>> = {};
    public static topCollectors:
        Record<string, InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>> = {};
    public static setupCollectors:
        Record<string, InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>> = {};
    public static helpCollectors:
        Record<string, InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>> = {};
    public static selfWipeCollectors:
        Record<string, InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>> = {};
    public static questsCollectors:
        Record<string, InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>> = {};

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
        const startTime = Date.now();

        // If the collection attempt was too quick, cancel it
        if (
            inter && (startTime <= timerVars.timeUntilNextCollect ||
            inter.createdTimestamp <= timerVars.timeUntilNextCollect)
        ) {
            await inter.deferUpdate();
            return false;
        }

        if (startTime <= timerVars.timeUntilNextCollect) {
            return false;
        }

        // Updates time to collect every 100ms, preventing
        // users from clicking too fast
        timerVars.timeUntilNextCollect = Date.now() + 300;
        timerVars.updateTime = setInterval(() => {
            timerVars.timeUntilNextCollect = Date.now() + 300;
        }, 100);

        return true;
    }

    /**
     * Creates and returns a message component collector
     *
     * @param channel - The channel to put the collector
     * @param id - The id to look for
     * @param nums - Used to get number configurations
     * @param excludeUser - Whether to exclude the user instead of it only being them
     * @param time - The time it takes for the collector to end
     * @private
     */
    public static async createCollector(
        channel: TextChannel,
        id: string,
        nums: NumberConfig,
        excludeUser = false,
        time?: number
    ): Promise<InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>> {
        // Only allows button presses from current interaction
        const filter = async (compInter: MessageComponentInteraction) => {
            const modifiers: string[] = compInter.customId.split('|').slice(1);
            const returnVal = modifiers[0] === id;

            if (
                compInter.customId.toLowerCase().startsWith('gift') && returnVal &&
                excludeUser && modifiers[1] === compInter.user.id
            ) {
                try {
                    await Replies.handleReply(
                        compInter, 'You can\'t claim your own gift!', BoarBotApp.getBot().getConfig().colorConfig.error
                    );
                } catch {}
            } else if (
                returnVal && modifiers.length > 1 && excludeUser && modifiers[1] === compInter.user.id ||
                returnVal && modifiers.length > 1 && !excludeUser && modifiers[1] !== compInter.user.id
            ) {
                try {
                    await Replies.handleReply(
                        compInter, 'This isn\'t yours to interact with!',
                        BoarBotApp.getBot().getConfig().colorConfig.error
                    );
                } catch {}
            }

            if (modifiers.length > 1 && excludeUser) {
                return returnVal && modifiers[1] !== compInter.user.id;
            } else if (modifiers.length > 1) {
                return returnVal && modifiers[1] === compInter.user.id;
            }

            return returnVal;
        };

        if (!time) {
            return channel.createMessageComponentCollector({
                filter,
                idle: nums.collectorIdle
            }) as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
        } else {
            return channel.createMessageComponentCollector({
                filter,
                time: time
            }) as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
        }
    }
}