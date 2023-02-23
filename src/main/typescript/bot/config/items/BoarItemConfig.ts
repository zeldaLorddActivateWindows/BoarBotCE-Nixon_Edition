/**
 * {@link BoarItemConfig BoarItemConfig.ts}
 *
 * Stores boar item configuration for a specific item
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarItemConfig {
    public name: string = '';
    public file: string = '';
    public description: string = '';
    public isSB: boolean = false;
    public blacklisted: boolean = false;
}