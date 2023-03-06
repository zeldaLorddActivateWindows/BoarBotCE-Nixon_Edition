/**
 * {@link ComponentConfig ComponentConfig.ts}
 *
 * Stores component configurations for a
 * specific interaction for bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ComponentConfig {
    public readonly customId: string = '';
    public readonly label: string | undefined = undefined;
    public readonly style: number = 2;
    public readonly disabled: boolean = false;
    public readonly placeholder: string | undefined = undefined;
}