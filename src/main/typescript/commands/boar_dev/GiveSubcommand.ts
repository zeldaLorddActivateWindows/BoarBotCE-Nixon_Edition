import {ChatInputCommandInteraction} from 'discord.js';
import {BoarUser} from '../../util/BoarUser';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {Queue} from '../../util/Queue';
import {GeneralFunctions} from '../../util/GeneralFunctions';
import {Replies} from '../../util/Replies';
import {LogDebug} from '../../util/logging/LogDebug';

/**
 * {@link GiveSubcommand GiveSubcommand.ts}
 *
 * Used to give a user a specific item.
 * ADD ARGUMENT TO CHOOSE IF BADGE OR BOAR
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class GiveSubcommand implements Subcommand {
    private initConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.initConfig.commandConfigs.boarDev.give;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction) {
        const config = BoarBotApp.getBot().getConfig();

        const guildData = await GeneralFunctions.handleStart(config, interaction);

        if (!guildData)
            return;

        if (!config.devs.includes(interaction.user.id)) {
            await Replies.noPermsReply(config, interaction);
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
        rarityFound = GeneralFunctions.findRarity(idInput);

        // Returns if ID doesn't exist in boars or badges
        if (rarityFound === -1 && !badgeIDs.includes(idInput)) {
            await interaction.editReply(strConfig.invalidID);
            return;
        }

        await Queue.addQueue(async function() {
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
                await LogDebug.handleError(err, interaction);
            }
        }, interaction.id + userInput.id);

        LogDebug.sendDebug('End of interaction', config, interaction);
    }
}