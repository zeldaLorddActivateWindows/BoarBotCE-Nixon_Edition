/***********************************************
 * give.ts
 * Weslay
 *
 * Used to give a user a specific boar
 ***********************************************/

import {BoarUser} from '../supporting_files/BoarUser';
import {addQueue} from '../supporting_files/Queue';
import {handleError, sendDebug} from '../supporting_files/LogDebug';
import {getConfigFile} from '../supporting_files/DataHandlers';
import {findRarity, handleStart} from '../supporting_files/GeneralFunctions';
import {ChatInputCommandInteraction} from 'discord.js';
import {noPermsReply} from '../supporting_files/InteractionReplies';

//***************************************

const initConfig = getConfigFile();

const commandStrings = initConfig.strings.commands;
const commandName = commandStrings.give.name;
const arg1 = commandStrings.give.args.arg1.name;
const arg2 = commandStrings.give.args.arg2.name;

//***************************************

module.exports = {
    data: { name: commandName },
    async execute(interaction: ChatInputCommandInteraction) {
        const config = getConfigFile();

        const guildData = await handleStart(interaction);

        if (!guildData)
            return;

        if (!config.developers.includes(interaction.user.id)) {
            await noPermsReply(interaction);
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const debugStrings = config.strings.debug;
        const generalStrings = config.strings.general;
        const badgeIDs = Object.keys(config.badgeIDs);

        const userInput = interaction.options.getUser(arg1);
        const idInput = interaction.options.getString(arg2);
        let rarityFound: string = '';

        if (!userInput || !idInput) {
            await interaction.editReply(generalStrings.nullValues);
            return;
        }

        // Gets the rarity of boar gotten
        rarityFound = findRarity(idInput);

        // Returns if ID doesn't exist in boars or badges
        if (rarityFound === '' && !badgeIDs.includes(idInput)) {
            await interaction.editReply(generalStrings.invalidID);
            return;
        }

        await addQueue(async function() {
            try {
                if (!interaction.guild || !interaction.channel)
                    return;

                const boarUser = new BoarUser(userInput, interaction.guild);

                // Gives either a boar or a badge depending on input
                if (rarityFound !== '')
                    await boarUser.addBoar(config, idInput, interaction);
                else
                    await boarUser.addBadge(config, idInput, interaction);
            } catch (err: unknown) {
                await handleError(err, interaction);
            }
        }, interaction.id + userInput.id);

        sendDebug(debugStrings.endCommand
            .replace('%@', interaction.user.tag)
            .replace('%@', interaction.options.getSubcommand())
        );
    }
};