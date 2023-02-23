/**
 * {@link ModalConfig ModalConfig.ts}
 *
 * Stores modal configurations for a specific interaction
 * for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ModalConfig {
    public title: string = '';
    public id: string = '';
    public inputIDs: string[] = [];
    public inputLabels: string[] = [];
    public inputPlaceholders: string[] = [];
}