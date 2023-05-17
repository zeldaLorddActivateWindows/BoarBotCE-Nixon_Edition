import {
    ActionRowBuilder, AttachmentBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction, ColorResolvable, EmbedBuilder,
    Events,
    Interaction,
    InteractionCollector,
    MessageComponentInteraction,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    User
} from 'discord.js';
import {BoarUser} from '../../util/boar/BoarUser';
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
import {FormatStrings} from '../../util/discord/FormatStrings';
import {RarityConfig} from '../../bot/config/items/RarityConfig';
import createRBTree, {Node, Tree} from 'functional-red-black-tree';

enum View {
    Normal,
    Detailed,
    Powerups
}

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
    private allBoarsTree: Tree<string, number> = createRBTree();
    private boarUser: BoarUser = {} as BoarUser;
    private baseRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private optionalButtons: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder> =
        new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;
    private curView: View = View.Normal;
    private curPage: number = 0;
    private maxPageNormal: number = 0;
    private enhancingPage: number = -1;
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {})
    };

    // The modal that's shown to a user if they opened one
    private modalShowing: ModalBuilder = {} as ModalBuilder;

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
        const userInput = interaction.options.getUser(this.subcommandInfo.args[0].name)
            ? interaction.options.getUser(this.subcommandInfo.args[0].name) as User
            : interaction.user;
        const viewInput = interaction.options.getInteger(this.subcommandInfo.args[1].name) as View;
        const pageInput = interaction.options.getString(this.subcommandInfo.args[2].name)
            ? (interaction.options.getString(this.subcommandInfo.args[2].name) as string)
                .toLowerCase().replace(/\s+/g, '')
            : "1";

        LogDebug.sendDebug(
            `User: ${userInput}, View: ${viewInput}, Page: ${pageInput}`,
            this.config, this.firstInter
        );

        await Queue.addQueue(() => this.getUserInfo(userInput), interaction.id + userInput.id);

        this.maxPageNormal = Math.floor(Object.keys(this.allBoars).length / config.numberConfig.collBoarsPerPage);

        if (viewInput === View.Detailed && this.allBoars.length > 0 || viewInput === View.Powerups) {
            this.curView = viewInput;
        }

        let pageVal: number = 1;
        if (!Number.isNaN(parseInt(pageInput))) {
            pageVal = parseInt(pageInput);
        } else if (this.curView == View.Detailed) {
            pageVal = this.getPageFromName(pageInput, this.allBoarsTree.root);
        }

        if (this.curView == View.Normal) {
            this.curPage = Math.max(Math.min(pageVal-1, this.maxPageNormal), 0);
        } else if (this.curView == View.Detailed) {
            this.curPage = Math.max(Math.min(pageVal-1, this.allBoars.length-1), 0);
        } else {
            this.curPage = Math.max(Math.min(pageVal-1, this.config.numberConfig.maxPowPages-1), 0);
        }

        this.collector = await CollectorUtils.createCollector(interaction, interaction.id + interaction.user.id);

        this.collectionImage = new CollectionImageGenerator(this.boarUser, this.config, this.allBoars);
        await this.showCollection();

        this.collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter));
        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(reason));
    }

    private async handleCollect(inter: ButtonInteraction) {
        try {
            const canInteract = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            if (!inter.isMessageComponent()) return;

            this.compInter = inter;

            LogDebug.sendDebug(
                `${inter.customId.split('|')[0]} on page ${this.curPage} in view ${this.curView}`,
                this.config, this.firstInter
            );

            const collRowConfig = this.config.commandConfigs.boar.collection.componentFields;
            const collComponents = {
                leftPage: collRowConfig[0][0].components[0],
                inputPage: collRowConfig[0][0].components[1],
                rightPage: collRowConfig[0][0].components[2],
                normalView: collRowConfig[0][1].components[0],
                detailedView: collRowConfig[0][1].components[1],
                powerupView: collRowConfig[0][1].components[2],
                favorite: collRowConfig[1][0].components[0],
                gift: collRowConfig[1][0].components[1],
                editions: collRowConfig[1][0].components[2],
                enhance: collRowConfig[1][0].components[3]
            };

            // User wants to input a page manually
            if (inter.customId.startsWith(collComponents.inputPage.customId)) {
                await this.modalHandle(inter);
                clearInterval(this.timerVars.updateTime);
                return;
            }

            await inter.deferUpdate();

            switch (inter.customId.split('|')[0]) {
                // User wants to go to previous page
                case collComponents.leftPage.customId:
                    this.curPage--;
                    break;

                // User wants to go to the next page
                case collComponents.rightPage.customId:
                    this.curPage++;
                    break;

                case collComponents.normalView.customId:
                    this.curView = View.Normal;
                    this.curPage = 0;
                    break;

                case collComponents.detailedView.customId:
                    this.curView = View.Detailed;
                    this.curPage = 0;
                    break;

                case collComponents.powerupView.customId:
                    this.curView = View.Powerups;
                    this.curPage = 0;
                    break;

                case collComponents.favorite.customId:
                    await Queue.addQueue(() => {
                        this.boarUser.favoriteBoar = this.allBoars[this.curPage].id;
                        this.boarUser.updateUserData();
                    }, inter.id + this.boarUser.user.id);
                    break;

                case collComponents.editions.customId:
                    await this.doEditions();
                    break;

                case collComponents.enhance.customId:
                    if (this.enhancingPage !== this.curPage) {
                        await this.firstInter.followUp({
                            files: [await this.collectionImage.finalizeEnhanceConfirm(this.curPage)],
                            ephemeral: true
                        });
                        this.enhancingPage = this.curPage;
                    } else {
                        await Queue.addQueue(() => {
                            this.boarUser.powerups.numEnhancers -=
                                this.allBoars[this.curPage].rarity[1].enhancersNeeded;
                            this.boarUser.boarScore +=
                                this.config.rarityConfigs[this.allBoars[this.curPage].rarity[0]].score -
                                this.allBoars[this.curPage].rarity[1].score;
                            this.boarUser.updateUserData();
                        }, inter.id + this.boarUser.user.id);
                    }
                    break;
            }

            await this.showCollection();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
    }

    private async doEditions(): Promise<void> {
        const strConfig = this.config.stringConfig;
        let replyString = '';

        for (let i=0; i<this.allBoars[this.curPage].editions.length; i++) {
            const edition = this.allBoars[this.curPage].editions[i];
            const editionDate = Math.floor(this.allBoars[this.curPage].editionDates[i] / 1000);

            replyString += strConfig.collEditionLine
                .replace('%@', edition)
                .replace('%@', FormatStrings.toShortDateTime(editionDate));
        }

        replyString = replyString.substring(0, replyString.length-1).substring(0, 4096);
        await this.compInter.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle(strConfig.collEditionTitle.replace('%@', this.allBoars[this.curPage].name))
                    .setDescription(replyString)
                    .setColor(this.config.colorConfig.editionEmbed as ColorResolvable)
            ],
            ephemeral: true
        });
    }

    /**
     * Sends modals and receives information on modal submission
     *
     * @param inter - Used to show the modal and create/remove listener
     * @private
     */
    private async modalHandle(inter: MessageComponentInteraction): Promise<void> {
        const modals = this.config.commandConfigs.boar.collection.modals;

        this.modalShowing = new ModalBuilder(modals[0]);
        this.modalShowing.setCustomId(modals[0].customId + '|' + inter.id);
        await inter.showModal(this.modalShowing);

        inter.client.on(
            Events.InteractionCreate,
            this.modalListener
        );

        setTimeout(() => {
            inter.client.removeListener(Events.InteractionCreate, this.modalListener);
        }, 60000);
    }

    /**
     * Handles when the user makes an interaction that could be a modal submission
     *
     * @param submittedModal - The interaction to respond to
     * @private
     */
    private modalListener = async (submittedModal: Interaction) => {
        try  {
            // If not a modal submission on current interaction, destroy the modal listener
            if (submittedModal.isMessageComponent() && submittedModal.customId.endsWith(this.firstInter.id + this.firstInter.user.id) ||
                BoarBotApp.getBot().getConfig().maintenanceMode && !this.config.devs.includes(this.compInter.user.id)
            ) {
                clearInterval(this.timerVars.updateTime);
                submittedModal.client.removeListener(Events.InteractionCreate, this.modalListener);

                return;
            }

            // Updates the cooldown to interact again
            CollectorUtils.canInteract(this.timerVars);

            if (!submittedModal.isModalSubmit() || this.collector.ended ||
                !submittedModal.guild || submittedModal.customId !== this.modalShowing.data.custom_id
            ) {
                clearInterval(this.timerVars.updateTime);
                return;
            }

            await submittedModal.deferUpdate();

            const submittedPage = submittedModal.fields.getTextInputValue(
                this.modalShowing.components[0].components[0].data.custom_id as string
            ).toLowerCase().replace(/\s+/g, '');

            LogDebug.sendDebug(
                `${submittedModal.customId.split('|')[0]} input value: ` + submittedPage, this.config, this.firstInter
            );

            let pageVal: number = 1;
            if (!Number.isNaN(parseInt(submittedPage))) {
                pageVal = parseInt(submittedPage);
            } else if (this.curView == View.Detailed) {
                pageVal = this.getPageFromName(submittedPage, this.allBoarsTree.root)
            }

            if (this.curView === View.Normal) {
                this.curPage = Math.max(Math.min(pageVal-1, this.maxPageNormal), 0);
            } else if (this.curView === View.Detailed) {
                this.curPage = Math.max(Math.min(pageVal-1, this.allBoars.length-1), 0);
            } else {
                this.curPage = Math.max(Math.min(pageVal-1, this.config.numberConfig.maxPowPages-1), 0);
            }

            await this.showCollection();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }

        clearInterval(this.timerVars.updateTime);
        submittedModal.client.removeListener(Events.InteractionCreate, this.modalListener);
    };

    private async handleEndCollect(reason: string) {
        try {
            LogDebug.sendDebug('Ended collection with reason: ' + reason, this.config, this.firstInter);

            if (reason == CollectorUtils.Reasons.Error) {
                await Replies.handleReply(
                    this.firstInter, this.config.stringConfig.setupError,
                    this.config.colorConfig.error as ColorResolvable, true
                );
            }

            await this.firstInter.editReply({
                components: []
            });
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    /**
     * Gets information from the user's file
     *
     * @param userInput - The {@link User} that was input from the command
     * @private
     */
    private async getUserInfo(userInput: User) {
        if (!this.firstInter.guild || !this.firstInter.channel) return;

        this.boarUser = new BoarUser(userInput);

        // Adds information about each boar in user's boar collection to an array
        for (const boarID of Object.keys(this.boarUser.boarCollection)) {
            // Local user boar information
            const boarInfo = this.boarUser.boarCollection[boarID];
            if (boarInfo.num === 0) continue;

            const rarity: [number, RarityConfig] = BoarUtils.findRarity(boarID);
            if (rarity[0] === 0) continue;

            // Global boar information
            const boarDetails = this.config.boarItemConfigs[boarID];

            this.allBoars.push({
                id: boarID,
                name: boarDetails.name,
                file: boarDetails.file,
                staticFile: boarDetails.staticFile,
                num: boarInfo.num,
                editions: boarInfo.editions,
                editionDates: boarInfo.editionDates,
                firstObtained: boarInfo.firstObtained,
                lastObtained: boarInfo.lastObtained,
                rarity: rarity,
                color: this.config.colorConfig['rarity' + rarity[0]],
                description: boarDetails.description
            });

            this.allBoarsTree = this.allBoarsTree.insert(
                boarDetails.name.toLowerCase().replace(/\s+/g, ''), this.allBoars.length
            );
        }
    }

    /**
     * Displays the collection image
     *
     * @private
     */
    private async showCollection() {
        const optionalRow: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder> =
            new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;

        this.disableButtons();

        if (
            !this.collectionImage.normalBaseMade() && !this.collectionImage.detailedBaseMade()
            && !this.collectionImage.powerupsBaseMade()
        ) {
            this.initButtons();
        }

        if (this.curView == View.Normal && !this.collectionImage.normalBaseMade()) {
            await this.collectionImage.createNormalBase();
        }

        if (this.curView == View.Detailed && !this.collectionImage.detailedBaseMade()) {
            await this.collectionImage.createDetailedBase();
        }

        if (this.curView == View.Powerups) {
            await this.collectionImage.createPowerupsBase(this.curPage);
        }

        let finalImage: AttachmentBuilder;

        if (this.curView == View.Normal) {
            finalImage = await this.collectionImage.finalizeNormalImage(this.curPage);
        } else if (this.curView == View.Detailed) {
            finalImage = await this.collectionImage.finalizeDetailedImage(this.curPage);
            optionalRow.addComponents(this.optionalButtons.components[0].setDisabled(false)); // Favorite button
        } else {
            finalImage = await this.collectionImage.finalizePowerupsImage();
        }

        // Enables next button if there's more than one page
        if (
            this.curView == View.Normal && this.maxPageNormal > this.curPage ||
            this.curView == View.Detailed && this.allBoars.length > this.curPage + 1 ||
            this.curView == View.Powerups && this.config.numberConfig.maxPowPages > this.curPage + 1
        ) {
            this.baseRows[0].components[2].setDisabled(false);
        }

        // Enables previous button if on a page other than the first
        if (this.curPage > 0) {
            this.baseRows[0].components[0].setDisabled(false);
        }

        // Enables manual input button if there's more than one page
        if (
            this.curView == View.Normal && this.maxPageNormal > 0 ||
            this.curView == View.Detailed && this.allBoars.length > 1
        ) {
            this.baseRows[0].components[1].setDisabled(false);
        }

        // Allows pressing Normal view if not currently on it
        if (this.curView !== View.Normal) {
            this.baseRows[1].components[0].setDisabled(false);
        }

        // Allows pressing Detailed view if not currently on it and if there's boars to view
        if (this.curView !== View.Detailed && this.allBoars.length > 0) {
            this.baseRows[1].components[1].setDisabled(false);
        }

        // Allows pressing Powerup view if not currently on it
        if (this.curView !== View.Powerups) {
            this.baseRows[1].components[2].setDisabled(false);
        }

        // Enables edition viewing on special boars
        if (this.curView == View.Detailed && this.allBoars[this.curPage].rarity[1].score === 0) {
            optionalRow.addComponents(this.optionalButtons.components[2].setDisabled(false));
        }

        // Enables enhance button for daily boars
        if (
            this.curView == View.Detailed &&
            this.allBoars[this.curPage].rarity[1].enhancersNeeded > 0
        ) {
            optionalRow.addComponents(this.optionalButtons.components[3]
                .setDisabled(
                    this.boarUser.powerups.numEnhancers < this.allBoars[this.curPage].rarity[1].enhancersNeeded
                )
            );
        }

        if (optionalRow.components.length > 0) {
            await this.firstInter.editReply({ files: [finalImage], components: [...this.baseRows, optionalRow] });
        } else {
            await this.firstInter.editReply({ files: [finalImage], components: this.baseRows });
        }
    }

    private initButtons(): void {
        const collFieldConfigs = this.config.commandConfigs.boar.collection.componentFields;

        for (let i=0; i<collFieldConfigs.length; i++) {
            for (const rowConfig of collFieldConfigs[i]) {
                let newRow = new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>(rowConfig);

                newRow = ComponentUtils.addToIDs(rowConfig, newRow, this.firstInter.id + this.firstInter.user.id);

                if (i == 0) {
                    this.baseRows.push(newRow);
                } else {
                    this.optionalButtons = newRow;
                }
            }
        }
    }

    private disableButtons(): void {
        for (const row of this.baseRows) {
            for (const component of row.components) {
                component.setDisabled(true);
            }
        }

        for (const component of this.optionalButtons.components) {
            component.setDisabled(true);
        }
    }

    private getPageFromName(pageInput: string, root: Node<string, number>): number {
        if (root.key.includes(pageInput))
            return root.value;
        if (pageInput > root.key && root.right !== null)
            return this.getPageFromName(pageInput, root.right);
        if (pageInput < root.key && root.left !== null)
            return this.getPageFromName(pageInput, root.left);
        return root.value;
    }
}