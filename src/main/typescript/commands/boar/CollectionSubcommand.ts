import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction, InteractionCollector,
    StringSelectMenuBuilder, StringSelectMenuInteraction,
    User
} from 'discord.js';
import {BoarUser} from '../../util/boar/BoarUser';
import Canvas from 'canvas';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {Queue} from '../../util/interactions/Queue';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {LogDebug} from '../../util/logging/LogDebug';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {ComponentUtils} from '../../util/discord/ComponentUtils';
import {BoarUtils} from '../../util/boar/BoarUtils';
import {CollectionImageGenerator} from '../../util/generators/CollectionImageGenerator';
import {Replies} from '../../util/interactions/Replies';

/**
 * {@link CollectionSubcommand CollectionSubcommand.ts}
 *
 * Used to see a collection of boars, powerups,
 * and other information pertaining to a user.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class CollectionSubcommand implements Subcommand {
    private config = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.config.commandConfigs.boar.collection;
    private firstInter: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private compInter: ButtonInteraction = {} as ButtonInteraction;
    private collectionImage = {} as CollectionImageGenerator;
    private allBoars: any[] = [];
    private curBoars: any[] = [];
    private boarUser: BoarUser = {} as BoarUser;
    private baseCanvas: Canvas.Canvas = {} as Canvas.Canvas;
    private curPage: number = 0;
    private maxPageNormal: number = 0;
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {})
    };
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
    public readonly data = { name: this.subcommandInfo.name, path: __filename, cooldown: this.subcommandInfo.cooldown };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction) {
        const config = BoarBotApp.getBot().getConfig();

        const guildData = await InteractionUtils.handleStart(config, interaction);
        if (!guildData) return;

        await interaction.deferReply();
        this.firstInter = interaction;

        // Gets user to interact with
        const userInput = (interaction.options.getUser(this.subcommandInfo.args[0].name)
            ? interaction.options.getUser(this.subcommandInfo.args[0].name)
            : interaction.user) as User;

        await Queue.addQueue(() => this.getUserInfo(userInput), interaction.id + userInput.id);

        this.maxPageNormal = Math.floor(Object.keys(this.allBoars).length / config.numberConfig.collBoarsPerPage);

        this.collector = await CollectorUtils.createCollector(interaction, interaction.id + interaction.user.id);

        this.collectionImage = new CollectionImageGenerator(this.boarUser, this.config, this.allBoars);
        await this.showCollection();

        this.collector.on('collect', async (inter: ButtonInteraction) => this.handleCollect(inter));
    }

    private async handleCollect(inter: ButtonInteraction) {
        try {
            const canInteract = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            if (!inter.isMessageComponent()) return;

            this.compInter = inter;

            LogDebug.sendDebug(`${inter.customId.split('|')[0]} on field ${this.curPage}`, this.config, this.firstInter);

            if (BoarBotApp.getBot().getConfig().maintenanceMode && !this.config.devs.includes(inter.user.id)) {
                this.collector.stop(CollectorUtils.Reasons.Maintenance);
                return;
            }

            const collRowConfig = this.config.commandConfigs.boar.collection.componentFields;
            const collComponents = {
                leftPage: collRowConfig[0][0].components[0],
                inputPage: collRowConfig[0][0].components[1],
                rightPage: collRowConfig[0][0].components[2],
                normalView: collRowConfig[0][1].components[0],
                detailedView: collRowConfig[0][1].components[1],
                powerupView: collRowConfig[0][1].components[2]
            };

            await inter.deferUpdate();

            switch (inter.customId.split('|')[0]) {
                // User wants to go to previous page
                case collComponents.leftPage.customId:
                    this.curPage--;
                    await this.showCollection();
                    break;

                // User wants to go to the next page
                case collComponents.rightPage.customId:
                    this.curPage++;
                    await this.showCollection();
                    break;
            }
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
    }

    /**
     * Gets information from the user's file
     *
     * @param userInput - The {@link User} that was input from the command
     * @private
     */
    private async getUserInfo(userInput: User) {
        try {
            if (!this.firstInter.guild || !this.firstInter.channel) return;

            this.boarUser = new BoarUser(userInput);

            // Adds information about each boar in user's boar collection to an array
            for (const boarID of Object.keys(this.boarUser.boarCollection)) {
                // Local user boar information
                const boarInfo = this.boarUser.boarCollection[boarID];
                const rarity: number = BoarUtils.findRarity(boarID);

                // Global boar information
                const boarDetails = this.config.boarItemConfigs[boarID];

                this.allBoars.push({
                    id: boarID,
                    name: boarDetails.name,
                    file: boarDetails.file,
                    num: boarInfo.num,
                    editions: boarInfo.editions,
                    firstObtained: boarInfo.firstObtained,
                    lastObtained: boarInfo.lastObtained,
                    rarity: rarity,
                    color: this.config.colorConfig[rarity]
                });
            }
        } catch (err: unknown) {
            await LogDebug.handleError(err, this.firstInter);
        }
    }

    /**
     * Displays the collection image
     *
     * @private
     */
    private async showCollection() {
        if (!this.collectionImage.normalBaseMade()) {
            await this.collectionImage.createNormalBase();
        }

        const finalImage = await this.collectionImage.finalizeNormalImage(this.curPage);

        const collFieldConfigs = this.config.commandConfigs.boar.collection.componentFields;
        const baseRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
        const optionalButtonsRow =
            new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>(collFieldConfigs[1][0]);

        for (const rowConfig of collFieldConfigs[0]) {
            let newRow = new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>(rowConfig);

            newRow = ComponentUtils.addToIDs(rowConfig, newRow, this.firstInter.id + this.firstInter.user.id);
            baseRows.push(newRow);
        }

        // Enables next button if there's more than one page
        if (this.maxPageNormal > this.curPage) {
            baseRows[0].components[2].setDisabled(false);
        }

        // Enables previous button if on a page other than the first
        if (this.curPage > 0) {
            baseRows[0].components[0].setDisabled(false);
        }

        await this.firstInter.editReply({ files: [finalImage], components: baseRows });
    }
}