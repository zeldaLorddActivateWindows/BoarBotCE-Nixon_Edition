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
    public readonly name: string = '';
    public readonly pluralName: string = '';
    public readonly description: string = '';
    public readonly file: string = '';
    public readonly staticFile?: string;
    public readonly isSB: boolean = false;
    public readonly blacklisted: boolean = false;
    public readonly rewardAmt?: number;
    public readonly outcomes?: OutcomeConfig[];
}