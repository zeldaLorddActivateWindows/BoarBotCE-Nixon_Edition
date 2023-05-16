import {PowerupConfig} from './PowerupConfig';
import {PromptTypeConfigs} from './PromptTypeConfigs';

/**
 * {@link PowerupConfigs PowerupConfigs.ts}
 *
 * Stores powerup configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class PowerupConfigs {
    public readonly multiBoost: PowerupConfig = new PowerupConfig;
    public readonly gift: PowerupConfig = new PowerupConfig;
    public readonly extraChance: PowerupConfig = new PowerupConfig;
    public readonly enhancer: PowerupConfig = new PowerupConfig;
    public readonly promptTypes: PromptTypeConfigs = new PromptTypeConfigs;
}