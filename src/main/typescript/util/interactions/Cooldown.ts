import {BotConfig} from '../../bot/config/BotConfig';
import {ChatInputCommandInteraction} from 'discord.js';
import {Replies} from './Replies';

/**
 * {@link Cooldown Cooldown.ts}
 *
 * Handles cooldowns on commands.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class Cooldown {
    public static cooldowns: any = {};

    /**
     * Handles cooldowns for users on certain commands
     *
     * @param config - Used to get the string to reply with
     * @param interaction - Interaction to reply to
     */
    public static async handleCooldown(
        config: BotConfig,
        interaction: ChatInputCommandInteraction
    ): Promise<boolean> {
        const commandName = interaction.commandName;
        const userID = interaction.user.id;

        if (!this.cooldowns[commandName]) {
            this.cooldowns[commandName] = [];
        }

        if (this.cooldowns[commandName].includes(userID)) {
            await Replies.onCooldownReply(config, interaction);
            return true;
        }

        this.cooldowns[commandName].push(userID);

        setTimeout(() => {
            const index = this.cooldowns[commandName].indexOf(userID);
            this.cooldowns[commandName].splice(index, 1);
        }, 5000);

        return false;
    }
}