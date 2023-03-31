import {ChatInputCommandInteraction, MessageComponentInteraction, PermissionResolvable} from 'discord.js';

/**
 * {@link PermissionUtils PermissionUtils.ts}
 *
 * Deals with permission checking and more.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class PermissionUtils {
    /**
     * Gets whether bot has a permission
     *
     * @param interaction - Gets information from guild
     * @param perm - The permissions to check
     */
    public static hasPerm(
        interaction: MessageComponentInteraction | ChatInputCommandInteraction,
        perm: PermissionResolvable
    ): boolean {
        if (!interaction.guild || !interaction.guild.members.me) return false;
        return interaction.guild.members.me.permissions.has(perm);
    }
}