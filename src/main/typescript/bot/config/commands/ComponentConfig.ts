/**
 * {@link ComponentConfig ComponentConfig.ts}
 *
 * Stores configurations for a component
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ComponentConfig {
    public readonly type = 2 as number;
    public readonly customId = '' as string;
    public readonly label = '' as string;
    public readonly emoji?: string;
    public readonly placeholder?: string;
    public readonly style = 2 as number;
    public readonly required = false as boolean;
    public readonly disabled = false as boolean;
}