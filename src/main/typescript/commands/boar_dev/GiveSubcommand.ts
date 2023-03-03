/***********************************************
 * GiveSubcommand.ts
 * Used to give a user a specific boar.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {ChatInputCommandInteraction} from 'discord.js';
import {BoarUser} from '../../util/BoarUser';
import {addQueue} from '../../util/Queue';
import {handleError, sendDebug} from '../../logging/LogDebug';
import {getConfigFile} from '../../util/DataHandlers';
import {findRarity, handleStart} from '../../util/GeneralFunctions';
import {noPermsReply} from '../../util/InteractionReplies';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';

//***************************************

// ADD ARGUMENT TO CHOOSE IF BADGE OR BOAR

export default class GiveSubcommand implements Subcommand {
    private initConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.initConfig.commandConfigs.boarDev.give;
    public readonly data = { name: this.subcommandInfo.name };

    public async execute(interaction: ChatInputCommandInteraction) {
        const config = BoarBotApp.getBot().getConfig();

        const guildData = await handleStart(config, interaction);

        if (!guildData)
            return;

        if (!config.devs.includes(interaction.user.id)) {
            await noPermsReply(config, interaction);
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const strConfig = config.stringConfig;
        const badgeIDs = Object.keys(config.badgeItemConfigs);

        const userInput = interaction.options.getUser(this.subcommandInfo.args[0].name);
        const idInput = interaction.options.getString(this.subcommandInfo.args[1].name);
        let rarityFound: number = -1;

        if (!userInput || !idInput) {
            await interaction.editReply(strConfig.nullFound);
            return;
        }

        // Gets the rarity of boar gotten
        rarityFound = findRarity(idInput);

        // Returns if ID doesn't exist in boars or badges
        if (rarityFound === -1 && !badgeIDs.includes(idInput)) {
            await interaction.editReply(strConfig.invalidID);
            return;
        }

        await addQueue(async function() {
            try {
                if (!interaction.guild || !interaction.channel)
                    return;

                const boarUser = new BoarUser(userInput);

                // Gives either a boar or a badge depending on input
                if (rarityFound !== -1)
                    await boarUser.addBoar(config, idInput, interaction);
                else
                    await boarUser.addBadge(config, idInput, interaction);
            } catch (err: unknown) {
                await handleError(err, interaction);
            }
        }, interaction.id + userInput.id);

        sendDebug('End of interaction', config, interaction);
    }
}