import {ChatInputCommandInteraction} from 'discord.js';

/**
 * {@link Subcommand Subcommand.ts}
 *
 * An interface used to create new subcommands.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export interface Subcommand {
    data: { name: string, path: string, cooldown: boolean };
    execute(interaction: ChatInputCommandInteraction): void;
}