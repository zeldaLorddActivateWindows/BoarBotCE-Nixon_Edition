import {PermissionFlagsBits} from 'discord-api-types/v10';
import {BoarCommandConfig} from './BoarCommandConfig';
import {BoarDevCommandConfig} from './BoarDevCommandConfig';
import {BoarManageCommandConfig} from './BoarManageCommandConfig';

/**
 * {@link CommandConfig CommandConfig.ts}
 *
 * Stores a specific command configuration
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CommandConfig {
    public readonly name: string = '';
    public readonly description: string = '';
    public readonly perms: bigint | undefined = undefined;
}