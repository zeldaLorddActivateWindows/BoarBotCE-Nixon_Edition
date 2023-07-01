import {Guild, PermissionResolvable} from 'discord.js';

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
     * @param guild
     * @param perm - The permissions to check
     */
    public static hasPerm(guild: Guild | null, perm: PermissionResolvable): boolean {
        if (guild === null || !guild.members.me) return false;
        return guild.members.me.permissions.has(perm);
    }
}