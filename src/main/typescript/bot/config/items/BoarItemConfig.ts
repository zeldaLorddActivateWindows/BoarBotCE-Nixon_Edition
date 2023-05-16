/**
 * {@link BoarItemConfig BoarItemConfig.ts}
 *
 * Stores a specific boar item configuration
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarItemConfig {
    public readonly name: string = '';
    public readonly file: string = '';
    public readonly staticFile: string | undefined;
    public readonly description: string = '';
    public readonly isSB: boolean = false;
    public readonly blacklisted: boolean = false;
}