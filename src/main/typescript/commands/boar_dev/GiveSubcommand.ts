import {AutocompleteInteraction, ChatInputCommandInteraction, User} from 'discord.js';
import {BoarUser} from '../../util/boar/BoarUser';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {Queue} from '../../util/interactions/Queue';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {Replies} from '../../util/interactions/Replies';
import {LogDebug} from '../../util/logging/LogDebug';

/**
 * {@link GiveSubcommand GiveSubcommand.ts}
 *
 * Used to give a user a specific item.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class GiveSubcommand implements Subcommand {
    private config = BoarBotApp.getBot().getConfig();
    private interaction: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private userInput: User = {} as User;
    private idInput: string = '';
    private subcommandInfo = this.config.commandConfigs.boarDev.give;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction) {
        this.config = BoarBotApp.getBot().getConfig();

        const guildData = await InteractionUtils.handleStart(this.config, interaction);
        if (!guildData) return;

        if (!this.config.devs.includes(interaction.user.id)) {
            await Replies.noPermsReply(this.config, interaction);
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        this.interaction = interaction;

        const strConfig = this.config.stringConfig;

        const userInput = interaction.options.getUser(this.subcommandInfo.args[0].name);
        const idInput = interaction.options.getString(this.subcommandInfo.args[1].name);

        if (!userInput || !idInput) {
            await interaction.editReply(strConfig.nullFound);
            return;
        }

        this.userInput = userInput;
        this.idInput = idInput;

        await Queue.addQueue(() => this.doGive(), interaction.id + userInput.id);

        LogDebug.sendDebug('End of interaction', this.config, interaction);
    }

    /**
     * Handles when an argument has options that need to be
     * autocompleted
     *
     * @param interaction - Used to get the entered value to autocomplate
     */
    public async autocomplete(interaction: AutocompleteInteraction) {
        const strConfig = this.config.stringConfig;

        const focusedValue = interaction.options.getFocused().toLowerCase();
        const boarChoices = Object.keys(this.config.boarItemConfigs)
            .map(val => (val + strConfig.giveBoarChoiceTag));
        const badgeChoices = Object.keys(this.config.badgeItemConfigs)
            .map(val => (val + strConfig.giveBadgeChoiceTag));
        const choices = boarChoices.concat(badgeChoices);
        const possibleChoices = choices.filter(choice => choice.toLowerCase().includes(focusedValue));

        await interaction.respond(
            possibleChoices.map(choice => {
                return { name: choice, value: choice }
            }).slice(0, 25)
        );
    }

    /**
     * Gives the user the boar that was input
     *
     * @private
     */
    private async doGive() {
        try {
            if (!this.interaction.guild || !this.interaction.channel) return;

            const strConfig = this.config.stringConfig;

            const boarUser = new BoarUser(this.userInput);

            if (this.idInput.endsWith(strConfig.giveBoarChoiceTag)) {
                await boarUser.addBoar(this.config, this.idInput.split(' ')[0], this.interaction);
            } else if (this.idInput.endsWith(strConfig.giveBadgeChoiceTag)) {
                await boarUser.addBadge(this.config, this.idInput.split(' ')[0], this.interaction);
            }
        } catch (err: unknown) {
            await LogDebug.handleError(err, this.interaction);
        }
    }
}