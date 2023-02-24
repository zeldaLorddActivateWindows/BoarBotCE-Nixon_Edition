import {ComponentConfig} from './ComponentConfig';

/**
 * {@link SetupComponentConfigs SetupComponentConfigs.ts}
 *
 * Stores {@link ComponentConfig component configurations}
 * used for {@link SetupCommand}.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class SetupComponentConfigs {
    // Select menus

    public readonly selectMenu1: ComponentConfig = new ComponentConfig;
    public readonly selectMenu2_1: ComponentConfig = new ComponentConfig;
    public readonly selectMenu2_2: ComponentConfig = new ComponentConfig;
    public readonly selectMenu2_3: ComponentConfig = new ComponentConfig;

    // Refresh buttons

    public readonly refresh1: ComponentConfig = new ComponentConfig;
    public readonly refresh2: ComponentConfig = new ComponentConfig;

    // Info buttons

    public readonly info1: ComponentConfig = new ComponentConfig;
    public readonly info2: ComponentConfig = new ComponentConfig;
    public readonly info3: ComponentConfig = new ComponentConfig;

    // SB Buttons

    public readonly sbYes: ComponentConfig = new ComponentConfig;
    public readonly sbNo: ComponentConfig = new ComponentConfig;

    // Buttons that appear on multiple fields

    public readonly findChannel: ComponentConfig = new ComponentConfig;
    public readonly cancel: ComponentConfig = new ComponentConfig;
    public readonly restart: ComponentConfig = new ComponentConfig;
    public readonly next: ComponentConfig = new ComponentConfig;
}