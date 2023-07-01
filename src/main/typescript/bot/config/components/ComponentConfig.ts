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
    public readonly type: number = 2;
    public readonly customId: string = '';
    public readonly label: string = '';
    public readonly emoji?: string;
    public readonly placeholder?: string;
    public readonly style: number = 2;
    public readonly required: boolean = false;
    public readonly disabled: boolean = false;
}