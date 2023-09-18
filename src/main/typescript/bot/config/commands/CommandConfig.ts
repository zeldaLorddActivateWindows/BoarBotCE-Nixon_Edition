/**
 * {@link CommandConfig CommandConfig.ts}
 *
 * Stores a specific command configuration
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CommandConfig {
    public readonly name= '' as string;
    public readonly description = '' as string;
    public readonly perms?: bigint;
}