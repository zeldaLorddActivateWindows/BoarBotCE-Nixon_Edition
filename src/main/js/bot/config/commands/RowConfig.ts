import {ComponentType} from 'discord.js';
import {ComponentConfig} from './ComponentConfig';

/**
 * {@link RowConfig RowConfig.ts}
 *
 * Stores configurations for a component row
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class RowConfig {
    public readonly type = ComponentType.ActionRow;
    public readonly components = [] as ComponentConfig[];
}