import {ChatInputCommandInteraction,SlashCommandBuilder} from 'discord.js';

/**
 * {@link Command Command.ts}
 *
 * An interface used to create new commands.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export interface Command {
    data: SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction): void;
}