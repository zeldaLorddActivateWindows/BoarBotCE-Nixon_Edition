import {BotConfig} from '../../bot/config/BotConfig';
import {ChatInputCommandInteraction} from 'discord.js';
import {Replies} from './Replies';
import {BoarBotApp} from '../../BoarBotApp';

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
        interaction: ChatInputCommandInteraction,
        config: BotConfig
    ): Promise<boolean> {
        const subcommandName: string = interaction.options.getSubcommand();
        const needsCooldown: boolean | undefined = BoarBotApp.getBot().getSubcommands()
            .get(subcommandName)?.data.cooldown;
        const userID: string = interaction.user.id;

        if (!needsCooldown) return false;

        if (!this.cooldowns[subcommandName]) {
            this.cooldowns[subcommandName] = [];
        }

        if (this.cooldowns[subcommandName].includes(userID)) {
            await Replies.onCooldownReply(interaction, config);
            return true;
        }

        this.cooldowns[subcommandName].push(userID);

        setTimeout(() => {
            const index: number = this.cooldowns[subcommandName].indexOf(userID);
            this.cooldowns[subcommandName].splice(index, 1);
        }, 5000);

        return false;
    }
}