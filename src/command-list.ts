/************************************************
 * commands-list.ts
 * Weslay
 *
 * A collection of all /boar commands. Gives a
 * user their 'daily boar', shows users either
 * their or other's inventories.
 ***********************************************/

import {SlashCommandBuilder} from 'discord.js';
import {handleError} from './supporting_files/LogDebug';
import {getConfigFile} from './supporting_files/DataHandlers';

//***************************************

const {ChatInputCommandInteraction} = require('discord.js');

const config = getConfigFile();
const commandInfo = config.strings.commands;
const boarCommand = commandInfo.boar;
const configCommand = commandInfo.config;
const helpCommand = commandInfo.help;
const dailyCommand = commandInfo.daily;
const giveCommand = commandInfo.give;
const collectionCommand = commandInfo.collection;

//***************************************

module.exports = {
    data: new SlashCommandBuilder()
        .setName(boarCommand.name)
        .setDescription(boarCommand.description)
        .addSubcommand(option => option.setName(configCommand.name)
            .setDescription(configCommand.description)
        )
        .addSubcommand(option => option.setName(helpCommand.name)
            .setDescription(helpCommand.description)
        )
        .addSubcommand(option => option.setName(dailyCommand.name)
            .setDescription(dailyCommand.description)
        )
        .addSubcommand(option => option.setName(giveCommand.name)
            .setDescription(giveCommand.description)
            .addUserOption(option => option.setName(giveCommand.args.arg1.name)
                .setDescription(giveCommand.args.arg1.description)
                .setRequired(true)
            )
            .addStringOption(option => option.setName(giveCommand.args.arg2.name)
                .setDescription(giveCommand.args.arg2.description)
                .setRequired(true)
            )
        )
        .addSubcommand(option => option.setName(collectionCommand.name)
            .setDescription(commandInfo.collection.description)
            .addUserOption(option => option.setName(collectionCommand.args.arg1.name)
                .setDescription(collectionCommand.args.arg1.description)
                .setRequired(false)
            )
        ),
    async execute(interaction: typeof ChatInputCommandInteraction) {
        const subcommand = interaction.client.subcommands.get(interaction.options._subcommand);

        if (subcommand) {
            try {
                await subcommand.execute(interaction);
            } catch (err: unknown) {
                await handleError(err, interaction);
                return;
            }
        }
    }
};