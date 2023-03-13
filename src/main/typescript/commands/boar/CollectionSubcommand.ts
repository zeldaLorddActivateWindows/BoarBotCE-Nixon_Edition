import {
    ActionRowBuilder, AttachmentBuilder,
    ButtonBuilder,
    ButtonInteraction, ButtonStyle,
    ChatInputCommandInteraction, InteractionCollector, SelectMenuBuilder,
    SelectMenuInteraction,
    User
} from 'discord.js';
import {BoarUser} from '../../util/boar/BoarUser';
import Canvas from 'canvas';
import moment from 'moment';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {Queue} from '../../util/interactions/Queue';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {LogDebug} from '../../util/logging/LogDebug';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {ComponentUtils} from '../../util/discord/ComponentUtils';
import {BoarUtils} from '../../util/boar/BoarUtils';
import {CanvasUtils} from '../../util/generators/CanvasUtils';

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
    private allBoars: any[] = [];
    private curBoars: any[] = [];
    private boarUser: BoarUser = {} as BoarUser;
    private baseCanvas: Canvas.Canvas = {} as Canvas.Canvas;
    private curPage: number = 1;
    private timerVars = {
        timeUntilNextCollect: 0,
        updateTime: setTimeout(() => {})
    };
    private collector: InteractionCollector<ButtonInteraction | SelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | SelectMenuInteraction>;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

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

        await this.showCollection();

        this.collector.on('collect', async (inter: ButtonInteraction) => {
            const canInteract = await CollectorUtils.canInteract(this.timerVars, inter);
            if (!canInteract) return;

            LogDebug.sendDebug(`Used ${inter.customId} on field ${this.curPage}`, config, interaction);
        });

        LogDebug.sendDebug('End of interaction', config, interaction);
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
        // Config aliases

        const strConfig = this.config.stringConfig;
        const nums = this.config.numberConfig;
        const pathConfig = this.config.pathConfig;
        const colorConfig = this.config.colorConfig;

        // Asset path info

        const collectionFolder = pathConfig.collAssets;
        const boarsFolder = pathConfig.boarImages;
        const collectionUnderlay = collectionFolder + pathConfig.collUnderlay;
        const noClan = collectionFolder + pathConfig.clanNone;

        // Constants for max values

        const maxScore = nums.maxScore;
        const maxBoars = nums.maxBoars;
        const maxStreak = nums.maxStreak;
        const maxDailies = nums.maxDailies;
        const maxUniques = Object.keys(this.config.boarItemConfigs).length;

        // Non-trivial user information and stats

        const userUniques = Object.keys(this.boarUser.boarCollection).length;
        const userTag = this.boarUser.user.username.substring(0, nums.maxUsernameLength) + '#' +
            this.boarUser.user.discriminator;
        const userAvatar = this.boarUser.user.displayAvatarURL({ extension: 'png' });

        // Sets stat values depending on if they're below/above a threshold

        const scoreString = this.boarUser.boarScore <= maxScore
            ? this.boarUser.boarScore.toLocaleString()
            : `${maxScore.toLocaleString()}+`;
        const totalString = this.boarUser.totalBoars <= maxBoars
            ? this.boarUser.totalBoars.toLocaleString()
            : `${maxBoars.toLocaleString()}+`;
        const uniqueString = userUniques <= maxUniques
            ? userUniques.toLocaleString()
            : `${maxUniques.toLocaleString()}+`;
        const dailiesString = this.boarUser.numDailies <= maxDailies
            ? this.boarUser.numDailies.toLocaleString()
            : `${maxDailies.toLocaleString()}+`;
        const streakString = this.boarUser.boarStreak <= maxStreak
            ? this.boarUser.boarStreak.toLocaleString()
            : `${maxStreak.toLocaleString()}+`;
        const lastDailyString = this.boarUser.lastDaily > 1
            ? moment(this.boarUser.lastDaily).fromNow()
            : strConfig.unavailable;

        // Position and dimension information

        const origin = nums.originPos;
        const imageSize = nums.collImageSize;

        // Font info

        const fontName = strConfig.fontName;
        const bigFont = `${nums.fontBig}px ${fontName}`;
        const mediumFont = `${nums.fontMedium}px ${fontName}`;
        const smallFont = `${nums.fontSmallMedium}px ${fontName}`;

        // Label strings

        const dateLabel = strConfig.collDateLabel;
        const scoreLabel = strConfig.collScoreLabel;
        const totalLabel = strConfig.collTotalLabel;
        const uniquesLabel = strConfig.collUniquesLabel;
        const dailiesLabel = strConfig.collDailiesLabel;
        const streakLabel = strConfig.collStreakLabel;
        const lastDailyLabel = strConfig.collLastDailyLabel;

        // Gets the day a user first started using the bot

        let firstDate: string;
        if (this.boarUser.firstDaily > 0) {
            firstDate = new Date(this.boarUser.firstDaily).toLocaleString('default', {
                month: 'long', day: '2-digit', year: 'numeric'
            })
        } else {
            firstDate = strConfig.unavailable;
        }

        // Creating base image

        this.baseCanvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
        const mainCtx = this.baseCanvas.getContext('2d');

        // Draws underlay
        mainCtx.drawImage(await Canvas.loadImage(collectionUnderlay), ...origin, ...imageSize);

        // Draws top bar information

        mainCtx.drawImage(await Canvas.loadImage(userAvatar), ...nums.collUserAvatarPos, ...nums.collUserAvatarSize);
        CanvasUtils.drawText(mainCtx, userTag, nums.collUserTagPos, mediumFont, 'left', colorConfig.font);
        CanvasUtils.drawText(mainCtx, dateLabel, nums.collDateLabelPos, mediumFont, 'left', colorConfig.font);
        CanvasUtils.drawText(mainCtx, firstDate, nums.collDatePos, mediumFont, 'left', colorConfig.font);
        mainCtx.drawImage(await Canvas.loadImage(noClan), ...nums.collClanPos, ...nums.collClanSize);

        if (this.boarUser.badges.length === 0) {
            CanvasUtils.drawText(
                mainCtx, strConfig.collNoBadges, nums.collNoBadgePos, mediumFont, 'left', colorConfig.font
            );
        }

        // Draws badge information if the user has badges
        for (let i=0; i<this.boarUser.badges.length; i++) {
            const badgesFolder = pathConfig.badgeImages;
            const badgeXY: [number, number] = [nums.collBadgeStart + i * nums.collBadgeSpacing, nums.collBadgeY];
            const badgeFile = badgesFolder + this.config.badgeItemConfigs[this.boarUser.badges[i]].file;

            mainCtx.drawImage(await Canvas.loadImage(badgeFile), ...badgeXY, ...nums.collBadgeSize);
        }

        // Draws stats information

        CanvasUtils.drawText(mainCtx, scoreLabel, nums.collScoreLabelPos, mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, scoreString, nums.collScorePos, smallFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, totalLabel, nums.collTotalLabelPos, mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, totalString, nums.collTotalPos, smallFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, uniquesLabel, nums.collUniquesLabelPos, mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, uniqueString, nums.collUniquePos, smallFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, dailiesLabel, nums.collDailiesLabelPos, mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, dailiesString, nums.collDailiesPos, smallFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, streakLabel, nums.collStreakLabelPos, mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, streakString, nums.collStreakPos, smallFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, lastDailyLabel, nums.collLastDailyLabelPos, bigFont, 'center', colorConfig.font);
        CanvasUtils.drawText(mainCtx, lastDailyString, nums.collLastDailyPos, bigFont, 'center', colorConfig.font);

        // Draws last boar gotten and rarity
        if (this.boarUser.lastBoar !== '') {
            const lastBoarDetails = this.config.boarItemConfigs[this.boarUser.lastBoar];
            const boarFile = boarsFolder + lastBoarDetails.file;

            mainCtx.drawImage(await Canvas.loadImage(boarFile), ...nums.collLastBoarPos, ...nums.collLastBoarSize);
        }

        // Draws favorite boar and rarity
        if (this.boarUser.favoriteBoar !== '') {
            const favoriteBoarDetails = this.config.boarItemConfigs[this.boarUser.favoriteBoar];
            const boarFile = boarsFolder + favoriteBoarDetails.file;

            mainCtx.drawImage(await Canvas.loadImage(boarFile), ...nums.collFavBoarPos, ...nums.collFavBoarSize);
        }

        const collFieldConfigs = this.config.commandConfigs.boar.collection.componentFields;
        const baseRows: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>[] = [];
        const optionalButtonsRow = new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>(collFieldConfigs[1][0]);

        for (const rowConfig of collFieldConfigs[0]) {
            let newRow = new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>(rowConfig);

            newRow = ComponentUtils.addToIDs(rowConfig, newRow, this.firstInter.id);
            baseRows.push(newRow);
        }

        await this.finishImage(baseRows);
    }

    /**
     * Finishes off the collection image
     *
     * @param components - The components to add beneath the image
     */
    private async finishImage(components: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>[]): Promise<void> {
        // Config aliases

        const strConfig = this.config.stringConfig;
        const pathConfig = this.config.pathConfig;
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        // Asset path info

        const boarsFolder = pathConfig.boarImages;
        const collectionOverlay = pathConfig.collAssets + pathConfig.collOverlay;

        const boarsPerPage = nums.collBoarsPerPage;

        const smallestFont = `${nums.fontSmallest}px ${strConfig.fontName}`;

        // Overall positioning and size info

        const origin = nums.originPos;
        const imageSize = nums.collImageSize;

        // Label strings

        const favLabel = strConfig.collFavLabel;
        const recentLabel = strConfig.collRecentLabel;

        const lastBoarRarity = BoarUtils.findRarity(this.boarUser.lastBoar);
        const favBoarRarity = BoarUtils.findRarity(this.boarUser.favoriteBoar);

        let attachment: AttachmentBuilder;

        this.curBoars = this.allBoars.slice(0, boarsPerPage);

        const canvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(this.baseCanvas, ...origin, ...imageSize);

        // Draws boars and rarities
        for (let i=0; i<this.curBoars.length; i++) {
            const boarImagePos: [number, number] = [
                nums.collBoarStartX + (i % nums.collBoarCols) * nums.collBoarSpacingX,
                nums.collBoarStartY + Math.floor(i / nums.collBoarRows) * nums.collBoarSpacingY
            ];

            const lineStartPos = [
                nums.collRarityStartX + (i % nums.collBoarCols) * nums.collBoarSpacingX,
                nums.collRarityStartY + Math.floor(i / nums.collBoarRows) * nums.collBoarSpacingY
            ];

            const lineEndPos = [
                nums.collRarityStartX + nums.collRarityEndDiff + (i % nums.collBoarCols) * nums.collBoarSpacingX,
                nums.collRarityStartY - nums.collRarityEndDiff +
                    Math.floor(i / nums.collBoarRows) * nums.collBoarSpacingY
            ];

            const boarFile = boarsFolder + this.curBoars[i].file;

            ctx.drawImage(await Canvas.loadImage(boarFile), ...boarImagePos, ...nums.collBoarSize);
            CanvasUtils.drawLine(
                ctx, lineStartPos, lineEndPos, nums.collRarityWidth, colorConfig['rarity' + this.curBoars[i].rarity]
            );
        }

        // Draws overlay

        ctx.drawImage(await Canvas.loadImage(collectionOverlay), ...origin, ...imageSize);
        CanvasUtils.drawText(
            ctx, favLabel, nums.collFavLabelPos, smallestFont, 'center', favBoarRarity === 0
                ? colorConfig.font
                : colorConfig['rarity' + favBoarRarity]
        );
        CanvasUtils.drawText(
            ctx, recentLabel, nums.collRecentLabelPos, smallestFont, 'center', lastBoarRarity === 0
                ? colorConfig.font
                : colorConfig['rarity' + lastBoarRarity]
        );

        attachment = new AttachmentBuilder(canvas.toBuffer());

        await this.firstInter.editReply({ files: [attachment], components: components });
    }
}