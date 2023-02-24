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
    public readonly title: string = '';
    public readonly id: string = '';
    public readonly inputIDs: string[] = [];
    public readonly inputLabels: string[] = [];
    public readonly inputPlaceholders: string[] = [];
}