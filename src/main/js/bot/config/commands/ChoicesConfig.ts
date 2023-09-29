/**
 * {@link ChoicesConfig ChoicesConfig.ts}
 *
 * Stores choice configurations for a subcommand argument
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ChoicesConfig<T = string | number> {
    public readonly name = '' as string;
    public readonly value = '' as T;
}