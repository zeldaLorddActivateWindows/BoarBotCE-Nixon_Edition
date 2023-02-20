/***********************************************
 * Command.ts
 * An interface used to create new commands.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction, Events, SlashCommandBuilder} from 'discord.js';

//***************************************

export interface Command {
    data: SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction): void;
}