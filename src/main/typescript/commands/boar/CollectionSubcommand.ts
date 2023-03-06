import {
    ActionRowBuilder, AttachmentBuilder,
    ButtonBuilder,
    ButtonInteraction, ButtonStyle,
    ChatInputCommandInteraction, InteractionCollector, SelectMenuBuilder,
    SelectMenuInteraction,
    User
} from 'discord.js';
import {BoarUser} from '../../util/BoarUser';
import Canvas from 'canvas';
import {drawImageCompact, drawLine, drawRect, drawText} from '../../util/generators/CanvasFunctions';
import moment from 'moment';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {Queue} from '../../util/Queue';
import {GeneralFunctions} from '../../util/GeneralFunctions';
import {LogDebug} from '../../util/logging/LogDebug';

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
    private initConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo = this.initConfig.commandConfigs.boar.collection;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction) {
        const config = BoarBotApp.getBot().getConfig();

        const guildData = await GeneralFunctions.handleStart(config, interaction);

        if (!guildData) return;

        await interaction.deferReply();

        // Gets user to interact with
        const userInput = (interaction.options.getUser(this.subcommandInfo.args[0].name)
            ? interaction.options.getUser(this.subcommandInfo.args[0].name)
            : interaction.user) as User;

        // Config aliases
        const strConfig = config.stringConfig;
        const numConfig = config.numberConfig;
        const pathConfig = config.pathConfig;
        const hexColors = config.colorConfig;
        const rarities = Object.keys(config.rarityConfigs);
        const collectionFolder = pathConfig.collAssets;
        const boarsFolder = pathConfig.boarImages;
        const collectionUnderlay = collectionFolder + pathConfig.collUnderlay;
        const collectionOverlay = collectionFolder + pathConfig.collOverlay;

        // Stores information about all boars the user has
        const boarArray: any[] = [];
        // Stores a slice of the boar array that's being shown
        let currentBoarArray: any[];

        let boarUser: BoarUser;

        // User information
        let userScore = 0;
        let userTotal = 0;
        let userUniques = 0;
        let userMultiplier = 0;
        let userStreak = 0;
        let userLastDaily = 0;
        let userAvatar = '';
        let userTag= '';

        // Atypical boar information
        let lastBoarRarity: number;
        let favoriteBoarRarity: number;

        await Queue.addQueue(async () => {
            try {
                if (!interaction.guild || !interaction.channel)
                    return;

                boarUser = new BoarUser(userInput);

                // User information
                userScore = boarUser.boarScore;
                userTotal = boarUser.totalBoars;
                userUniques = Object.keys(boarUser.boarCollection).length;
                userMultiplier = boarUser.powerups.multiplier;
                userStreak = boarUser.boarStreak;
                userLastDaily = boarUser.lastDaily;
                userAvatar = userInput.displayAvatarURL({ extension: 'png' });
                userTag = userInput.username.substring(0, numConfig.maxUsernameLength) + '#' +
                    userInput.discriminator;

                // Atypical boar information
                lastBoarRarity = GeneralFunctions.findRarity(boarUser.lastBoar);
                favoriteBoarRarity = GeneralFunctions.findRarity(boarUser.favoriteBoar);

                // Adds information about each boar in user's boar collection to an array
                for (const boarID of Object.keys(boarUser.boarCollection)) {
                    // Local boar information
                    const boarInfo = boarUser.boarCollection[boarID];
                    const rarity: number = GeneralFunctions.findRarity(boarID);

                    // Global boar information
                    const boarDetails = config.boarItemConfigs[boarID];

                    boarArray.push({
                        id: boarID,
                        name: boarDetails.name,
                        file: boarDetails.file,
                        num: boarInfo.num,
                        editions: boarInfo.editions,
                        firstObtained: boarInfo.firstObtained,
                        lastObtained: boarInfo.lastObtained,
                        rarity: rarity,
                        color: hexColors[rarity]
                    });
                }
            } catch (err: unknown) {
                await LogDebug.handleError(err, interaction);
            }
        }, interaction.id + userInput.id);

        // Constants with context
        const boarsPerPage = 16;

        // Aliases for information stored in config
        const maxScore = numConfig.maxScore;
        const maxBoars = numConfig.maxBoars;
        const maxStreak = numConfig.maxStreak;
        const maxMultiplier = 100000;
        let maxUniques = Object.keys(config.boarItemConfigs).length;

        // Position and dimension information
        const origin = numConfig.originPos;
        const imageSize = numConfig.collImageSize;

        // Font info
        const fontName = strConfig.fontName;
        const bigFont = `${numConfig.fontBig}px ${fontName}`;
        const mediumFont = `${numConfig.fontMedium}px ${fontName}`;
        const smallFont = `${numConfig.fontSmallMedium}px ${fontName}`;

        // Sets stats depending on their size
        const scoreString = userScore <= maxScore
            ? userScore.toLocaleString()
            : `${maxScore.toLocaleString()}+`;
        const totalString = userTotal <= maxBoars
            ? userTotal.toLocaleString()
            : `${maxBoars.toLocaleString()}+`;
        const uniqueString = userUniques <= maxUniques
            ? userUniques.toLocaleString()
            : `${maxUniques.toLocaleString()}+`;
        const multiString = userMultiplier <= maxMultiplier
            ? `${userMultiplier.toFixed(2)}x`
            : `${maxMultiplier.toFixed(2)}x`;
        const streakString = userStreak <= maxStreak
            ? userStreak.toLocaleString()
            : `${maxStreak.toLocaleString()}+`;
        const lastDailyString = userLastDaily > 1
            ? moment(userLastDaily).fromNow()
            : strConfig.unavailable;

        // // Gets the day a user first started using the bot
        // let firstDate: string;
        // if (boarUser.firstDaily > 0) {
        //     firstDate = new Date(boarUser.firstDaily)
        //         .toLocaleString('default', { month: 'long', day: '2-digit', year: 'numeric' })
        // } else {
        //     firstDate = collectionStrings.dateUnavailable;
        // }
        //
        // currentBoarArray = boarArray.slice(0, boarsPerPage);
        //
        // // Creating image
        // const mainCanvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
        // const mainCtx = mainCanvas.getContext('2d');
        //
        // // Draws underlay
        // drawImageCompact(mainCtx, await Canvas.loadImage(collectionUnderlay), origin, imageSize);
        //
        // // Draws top bar information
        // drawImageCompact(mainCtx, await Canvas.loadImage(userAvatar), nums.userAvatarPos, nums.userAvatarSize);
        // drawText(mainCtx, userTag, nums.userTagPos, mediumFont, 'left', hexColors.font);
        // drawText(mainCtx, firstDate, nums.datePos, mediumFont, 'left', hexColors.font);
        //
        // // Draws badge information
        // if (boarUser.badges.length === 0)
        //     drawText(mainCtx, collectionStrings.noBadges, nums.noBadgePos, mediumFont, 'left', hexColors.font);
        //
        // for (let i=0; i<boarUser.badges.length; i++) {
        //     const badgesFolder = configAssets.badges;
        //     const badgeXY = [nums.badgeStart + i * nums.badgeSpacing, nums.badgeY];
        //     const badgeFile = badgesFolder + config.badgeIDs[boarUser.badges[i]].file;
        //
        //     drawImageCompact(mainCtx, await Canvas.loadImage(badgeFile), badgeXY, nums.badgeSize);
        // }
        //
        // // Draws stats information
        // drawText(mainCtx, scoreString, nums.scorePos, smallFont, 'center', hexColors.font);
        // drawText(mainCtx, totalString, nums.totalPos, smallFont, 'center', hexColors.font);
        // drawText(mainCtx, uniqueString, nums.uniquePos, smallFont, 'center', hexColors.font);
        // drawText(mainCtx, multiString, nums.multiPos, smallFont, 'center', hexColors.font);
        // drawText(mainCtx, streakString, nums.streakPos, smallFont, 'center', hexColors.font);
        // drawText(mainCtx, lastDailyString, nums.lastDailyPos, bigFont, 'center', hexColors.font);
        //
        // // Draws last boar gotten and rarity
        // if (boarUser.lastBoar !== '') {
        //     const lastBoarDetails = config.boarIDs[boarUser.lastBoar];
        //     const boarFile = boarsFolder + lastBoarDetails.file
        //
        //     drawImageCompact(mainCtx, await Canvas.loadImage(boarFile), nums.lastBoarPos, nums.lastBoarSize);
        //     drawRect(mainCtx, nums.lastRarityPos, nums.lastRaritySize, hexColors[lastBoarRarity]);
        // }
        //
        // // Draws favorite boar and rarity
        // if (boarUser.favoriteBoar !== '') {
        //     const favoriteBoarDetails = config.boarIDs[boarUser.favoriteBoar];
        //     const boarFile = boarsFolder + favoriteBoarDetails.file
        //
        //     drawImageCompact(mainCtx, await Canvas.loadImage(boarFile), nums.favBoarPos, nums.favBoarSize);
        //     drawRect(mainCtx, nums.favRarityPos, nums.favRaritySize, hexColors[favoriteBoarRarity]);
        // }

        // Row 1 buttons (Navigation)
        const backButton = new ButtonBuilder()
            .setCustomId('back')
            .setEmoji('<:back:1073072529507369072>')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);
        const pageButton = new ButtonBuilder()
            .setCustomId('page')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);
        const forwardButton = new ButtonBuilder()
            .setCustomId('forward')
            .setEmoji('<:forward:1073071982096175184>')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        // Row 2 buttons (Views)
        const normalViewButton = new ButtonBuilder()
            .setCustomId('normal_view')
            .setLabel('Normal')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true);
        const detailedViewButton = new ButtonBuilder()
            .setCustomId('detailed_view')
            .setLabel('Detailed')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true);
        const powerupViewButton = new ButtonBuilder()
            .setCustomId('powerup_view')
            .setLabel('Powerups')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true);

        // Row 3 buttons (Specific for each view)
        const favoriteButton = new ButtonBuilder()
            .setCustomId('favorite')
            .setEmoji('🌟')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);
        const giftButton = new ButtonBuilder()
            .setCustomId('gift')
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const row1 = new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>()
            .setComponents(backButton, pageButton, forwardButton);
        const row2 = new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>()
            .setComponents(normalViewButton, detailedViewButton, powerupViewButton);
        const row3 = new ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>();

        // await finishImage(config, interaction, mainCanvas, currentBoarArray, [row1, row2]);

        let curPage: number = 1;

        // Handles fast interactions from overlapping
        let timeUntilNextCollect = 0;
        let updateTime: NodeJS.Timer;

        // Only allows button presses from current interaction to affect results
        const filter = async (btnInt: ButtonInteraction | SelectMenuInteraction) => {
            return btnInt.customId.split('|')[1] === interaction.id + btnInt.user.id;
        };

        const collector = interaction.channel?.createMessageComponentCollector({
            filter,
            idle: 1000 * 60 * 2
        }) as InteractionCollector<ButtonInteraction>;

        collector.on('collect', async (inter: ButtonInteraction) => {
            // If the collection attempt was too quick, cancel it
            if (Date.now() < timeUntilNextCollect) {
                await inter.deferUpdate();
                return;
            }

            // Updates time to collect every 100ms, preventing
            // users from clicking too fast
            timeUntilNextCollect = Date.now() + 500;
            updateTime = setInterval(() => {
                timeUntilNextCollect = Date.now() + 500;
            }, 100);

            LogDebug.sendDebug(`Used ${inter.customId.split('|')[0]} on field ${curPage}`, config, interaction);
        });

        LogDebug.sendDebug('End of interaction', config, interaction);
    }

    /**
     * Finishes off the collection image
     *
     * @param config
     * @param interaction
     * @param canvasBase
     * @param currentBoarArray
     * @param components
     */
    public async finishImage(
        config: any,
        interaction: ChatInputCommandInteraction | ButtonInteraction,
        canvasBase: Canvas.Canvas,
        currentBoarArray: any[],
        components: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>[]
    ): Promise<void> {
        const origin = config.numbers.general.originPos;
        const nums = config.numbers.collection;
        const imageSize = nums.imageSize;
        const boarsFolder = config.paths.assets.boars;
        const collectionAssets = config.paths.assets.collection;
        const collectionOverlay = collectionAssets.basePath + collectionAssets.overlay;
        const hexColors = config.hexColors;

        let attachment: AttachmentBuilder;

        const canvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
        const ctx = canvas.getContext('2d');

        drawImageCompact(ctx, canvasBase, origin, imageSize);

        // Draws boars and rarities
        for (let i=0; i<currentBoarArray.length; i++) {
            const boarImagePos = [
                nums.boarStartX + (i % nums.boarCols) * nums.boarSpacingX,
                nums.boarStartY + Math.floor(i / nums.boarRows) * nums.boarSpacingY
            ];

            const lineStartPos = [
                nums.rarityStartX + (i % nums.boarCols) * nums.boarSpacingX,
                nums.rarityStartY + Math.floor(i / nums.boarRows) * nums.boarSpacingY
            ];

            const lineEndPost = [
                nums.rarityStartX + nums.rarityEndDiff + (i % nums.boarCols) * nums.boarSpacingX,
                nums.rarityStartY - nums.rarityEndDiff + Math.floor(i / nums.boarRows) * nums.boarSpacingY
            ];

            const boarFile = boarsFolder + currentBoarArray[i].file;

            drawImageCompact(ctx, await Canvas.loadImage(boarFile), boarImagePos, nums.boarSize);
            drawLine(ctx, lineStartPos, lineEndPost, nums.rarityWidth, hexColors[currentBoarArray[i].rarity]);
        }

        // Draws overlay
        drawImageCompact(ctx, await Canvas.loadImage(collectionOverlay), origin, imageSize);

        attachment = new AttachmentBuilder(canvas.toBuffer())

        await interaction.editReply({ files: [attachment], components: components });
    }
}