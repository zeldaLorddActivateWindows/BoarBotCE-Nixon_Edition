import {RowConfig} from './RowConfig';

/**
 * {@link ModalConfig ModalConfig.ts}
 *
 * Stores configurations for a modal
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ModalConfig {
    public readonly title = '' as string;
    public readonly customId = '' as string;
    public readonly components = [] as RowConfig[];
}