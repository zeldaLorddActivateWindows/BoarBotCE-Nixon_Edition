import {OutcomeConfig} from './OutcomeConfig';

/**
 * {@link ItemConfig ItemConfig.ts}
 *
 * Stores an item configuration for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ItemConfig {
    public name: string = '';
    public pluralName: string = '';
    public description: string = '';
    public file: string = '';
    public staticFile?: string;
    public isSB: boolean = false;
    public blacklisted: boolean = false;
    public tiers?: number[];
    public outcomes?: OutcomeConfig[];
}