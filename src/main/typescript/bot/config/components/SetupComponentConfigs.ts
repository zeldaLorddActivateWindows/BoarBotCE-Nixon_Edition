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

    public selectMenu1: ComponentConfig = new ComponentConfig;
    public selectMenu2_1: ComponentConfig = new ComponentConfig;
    public selectMenu2_2: ComponentConfig = new ComponentConfig;
    public selectMenu2_3: ComponentConfig = new ComponentConfig;

    // Refresh buttons

    public refresh1: ComponentConfig = new ComponentConfig;
    public refresh2: ComponentConfig = new ComponentConfig;

    // Info buttons

    public info1: ComponentConfig = new ComponentConfig;
    public info2: ComponentConfig = new ComponentConfig;
    public info3: ComponentConfig = new ComponentConfig;

    // SB Buttons

    public sbYes: ComponentConfig = new ComponentConfig;
    public sbNo: ComponentConfig = new ComponentConfig;

    // Buttons that appear on multiple fields

    public findChannel: ComponentConfig = new ComponentConfig;
    public cancel: ComponentConfig = new ComponentConfig;
    public restart: ComponentConfig = new ComponentConfig;
    public next: ComponentConfig = new ComponentConfig;
}