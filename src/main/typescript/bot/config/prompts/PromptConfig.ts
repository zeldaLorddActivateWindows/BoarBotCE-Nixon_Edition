import {RowConfig} from '../commands/RowConfig';

/**
 * {@link PromptConfig PromptConfig.ts}
 *
 * Stores a powerup prompt configuration for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class PromptConfig {
    public readonly name: string = ' ';
    public readonly description: string = ' ';
    public readonly rows: RowConfig[] = [];
    public readonly emoji1: string = ' ';
    public readonly emoji2: string = ' ';
    public readonly choices: string[] = [' ', ' ', ' ', ' '];
    public readonly numButtons: number = 0;
    public readonly rightClock: string = ' ';
}