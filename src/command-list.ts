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
        )
        // .addSubcommand(option => option.setName("top")
        //     .setDescription("View the Boar Score Leaderboard.")
        //     .addIntegerOption(option => option.setName("page")
        //         .setDescription("Page number of leaderboard.")
        //         .setRequired(false)
        //     )
        //     .addStringOption(option => option.setName("leaderboard")
        //         .setDescription("Which leaderboard to look at.")
        //         .setRequired(false)
        //         .addChoices(
        //             { name: "Boar Score", value:"Boar Score" },
        //             { name: "Unique Boars", value:"Unique Boars" },
        //             { name: "Total Boars", value:"Total Boars" },
        //             { name: "Score-to-Total Ratio", value:"Score-to-Total Ratio" },
        //             { name: "Extra Boar Total", value:"Extra Boar Total" },
        //             { name: "Base Multiplier", value:"Base Multiplier" }
        //         )
        //     )
        // )
        // .addSubcommand(option => option.setName("powerup")
        //     .setDescription("Spawn a powerup.")
        //     .addIntegerOption(option => option.setName("type")
        //         .setDescription("Type of powerup.")
        //         .setRequired(false)
        //         .addChoices(
        //             { name: "Extra Boars", value:1 },
        //             { name: "4x Multiplier", value:2 },
        //             { name: "10% Score Increase", value:3 },
        //             { name: "Steal Boar", value:4 },
        //             { name: "Powerup Boar", value:5 }
        //         )
        //     )
        // )
        // .addSubcommand(option => option.setName("trade")
        //     .setDescription("Trade boars with someone.")
        //     .addUserOption(option => option.setName("user")
        //         .setDescription("User you'd like to trade with.")
        //         .setRequired(true)
        //     )
        // )
        // .addSubcommand(option => option.setName("tradelist")
        //     .setDescription("Check ingoing and outgoing trades.")
        // )
        ,
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