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
    private collectionImage = {} as CollectionImageGenerator;
    private allBoars: any[] = [];
    private curBoars: any[] = [];
    private boarUser: BoarUser = {} as BoarUser;
    private baseCanvas: Canvas.Canvas = {} as Canvas.Canvas;
    private curPage: number = 1;
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

        this.collector = await CollectorUtils.createCollector(interaction, interaction.id + interaction.user.id);

        this.collectionImage = new CollectionImageGenerator(this.boarUser, this.config, this.allBoars);
        await this.showCollection(0);

        this.collector.on('collect', async (inter: ButtonInteraction) => {
            const canInteract = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            LogDebug.sendDebug(`Used ${inter.customId} on field ${this.curPage}`, config, interaction);
        });
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
    private async showCollection(page: number) {
        await this.collectionImage.createNormalBase();
        const finalImage = await this.collectionImage.finalizeNormalImage(page);

        const collFieldConfigs = this.config.commandConfigs.boar.collection.componentFields;
        const baseRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
        const optionalButtonsRow =
            new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>(collFieldConfigs[1][0]);

        for (const rowConfig of collFieldConfigs[0]) {
            let newRow = new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>(rowConfig);

            newRow = ComponentUtils.addToIDs(rowConfig, newRow, this.firstInter.id);
            baseRows.push(newRow);
        }

        await this.firstInter.editReply({ files: [finalImage], components: baseRows });
    }
}