import {AttachmentBuilder, AutocompleteInteraction, ChatInputCommandInteraction, User} from 'discord.js';
import {BoarUser} from '../../util/boar/BoarUser';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {Replies} from '../../util/interactions/Replies';
import {LogDebug} from '../../util/logging/LogDebug';
import {ItemImageGenerator} from '../../util/generators/ItemImageGenerator';
import {BoarUtils} from '../../util/boar/BoarUtils';
import {GuildData} from '../../util/data/global/GuildData';
import {StringConfig} from '../../bot/config/StringConfig';

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
    private idInput = '';
    private subcommandInfo = this.config.commandConfigs.boarDev.give;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.config = BoarBotApp.getBot().getConfig();

        const guildData: GuildData | undefined = await InteractionUtils.handleStart(interaction, this.config);
        if (!guildData) return;

        if (!this.config.devs.includes(interaction.user.id)) {
            await Replies.noPermsReply(interaction, this.config);
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        this.interaction = interaction;

        const strConfig: StringConfig = this.config.stringConfig;

        const userInput: User | null = interaction.options.getUser(this.subcommandInfo.args[0].name);
        const idInput: string | null = interaction.options.getString(this.subcommandInfo.args[1].name);

        if (!userInput || !idInput) {
            await Replies.handleReply(interaction, strConfig.nullFound);
            return;
        }

        this.userInput = userInput;
        this.idInput = idInput;

        await this.doGive();
    }

    /**
     * Handles when an argument has options that need to be
     * autocompleted
     *
     * @param interaction - Used to get the entered value to autocomplate
     */
    public async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const strConfig: StringConfig = this.config.stringConfig;

        const focusedValue: string = interaction.options.getFocused().toLowerCase();
        const boarChoices: string[] = Object.keys(this.config.itemConfigs.boars)
            .map(val => (val + ' | ' + strConfig.giveBoarChoiceTag));
        const badgeChoices: string[] = Object.keys(this.config.itemConfigs.badges)
            .map(val => (val + ' | ' + strConfig.giveBadgeChoiceTag));
        const choices: string[] = boarChoices.concat(badgeChoices);
        const possibleChoices: string[] = choices.filter(choice => choice.toLowerCase().includes(focusedValue));

        await interaction.respond(
            possibleChoices.map(choice => {
                return { name: choice, value: choice }
            }).slice(0, 25)
        );
    }

    /**
     * Gives the user the item that was input and responds with an attachment of the item
     *
     * @private
     */
    private async doGive(): Promise<void> {
        if (!this.interaction.guild || !this.interaction.channel) return;

        const strConfig: StringConfig = this.config.stringConfig;

        const boarUser: BoarUser =  new BoarUser(this.userInput, true);

        LogDebug.sendDebug(
            'Gave \'' + this.idInput + '\' to ' + this.userInput.username + '(' + this.userInput.id + ')',
            this.config, this.interaction
        );

        const inputID: string = this.idInput.split(' ')[0];
        const tag: string = this.idInput.split(' ')[2];
        let attachment: AttachmentBuilder | undefined;
        let replyString: string = strConfig.giveBoar;

        if (
            !tag || tag === strConfig.giveBoarChoiceTag && !BoarUtils.findRarity(inputID, this.config) ||
            tag === strConfig.giveBadgeChoiceTag && !this.config.itemConfigs.badges[inputID]
        ) {
            await Replies.handleReply(this.interaction, strConfig.giveBadID);
            return;
        }

        if (tag === strConfig.giveBoarChoiceTag) {
            await boarUser.addBoars([this.idInput.split(' ')[0]], this.interaction, this.config);

            attachment = await new ItemImageGenerator(boarUser.user, inputID, strConfig.giveTitle, this.config)
                .handleImageCreate(false, this.interaction.user);
        } else if (tag === strConfig.giveBadgeChoiceTag) {
            const hasBadge: boolean = await boarUser.addBadge(this.idInput.split(' ')[0], this.interaction);

            if (!hasBadge) {
                attachment = await new ItemImageGenerator(boarUser.user, inputID, strConfig.giveBadgeTitle, this.config)
                    .handleImageCreate(true, this.interaction.user);
                replyString = strConfig.giveBadge;
            } else {
                replyString = strConfig.giveBadgeHas;
            }
        }

        await Replies.handleReply(this.interaction, replyString);

        if (attachment) {
            await this.interaction.followUp({ files: [attachment] });
        }
    }
}