/************************************************
 * collection.ts
 * Weslay
 *
 * Used to see a collection of boars, powerups,
 * and other information pertaining to a user
 ***********************************************/

import {
    AttachmentBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction, InteractionCollector,
    SelectMenuInteraction,
    User
} from 'discord.js';
import {findRarity, handleStart} from '../supporting_files/GeneralFunctions';
import {BoarUser} from '../supporting_files/BoarUser';
import Canvas from 'canvas';
import {addQueue} from '../supporting_files/Queue';
import {handleError, sendDebug} from '../supporting_files/LogDebug';
import {getConfigFile, removeGuildFile} from '../supporting_files/DataHandlers';
import {drawImageCompact, drawLine, drawRect, drawText} from '../supporting_files/CanvasFunctions';
import {finishImage} from '../supporting_files/command_specific/CollectionFunctions';

//***************************************

const initConfig = getConfigFile();

const commandStrings = initConfig.strings.commands;
const commandName = commandStrings.collection.name;
const arg1 = commandStrings.collection.args.arg1.name;

//***************************************

module.exports = {
    data: { name: commandName },
    async execute(interaction: ChatInputCommandInteraction) {
        const config = getConfigFile();

        const guildData = await handleStart(interaction);

        if (!guildData)
            return;

        await interaction.deferReply();

        const debugStrings = config.strings.debug;

        // Gets user to interact with
        const userInput = (interaction.options.getUser(arg1)
            ? interaction.options.getUser(arg1)
            : interaction.user) as User;

        await addQueue(async () => {
            try {
                if (!interaction.guild || !interaction.channel)
                    return;

                // Config aliases
                const configStrings = config.strings;
                const collectionStrings = configStrings.commands.collection.other;
                const generalNums = config.numbers.general;
                const nums = config.numbers.collection;
                const hexColors = config.hexColors;
                const rarities = Object.keys(config.raritiesInfo);
                const configAssets = config.paths.assets;
                const collectionAssets = configAssets.collection;
                const collectionFolder = collectionAssets.basePath;
                const boarsFolder = configAssets.boars;
                const collectionUnderlay = collectionFolder + collectionAssets.underlay;
                const collectionOverlay = collectionFolder + collectionAssets.overlay;

                const boarUser = new BoarUser(userInput);

                // User information
                const userScore = boarUser.boarScore;
                const userTotal = boarUser.totalBoars;
                const userUniques = Object.keys(boarUser.boarCollection).length;
                const userMultiplier = boarUser.powerups.multiplier;
                const userGifts = boarUser.powerups.gifts;
                const userAvatar = userInput.displayAvatarURL({ extension: 'png' });
                const userTag = userInput.username.substring(0, generalNums.usernameLength) + '#' +
                    userInput.discriminator;

                // Atypical boar information
                const lastBoarRarity = findRarity(boarUser.lastBoar);
                const favoriteBoarRarity = findRarity(boarUser.favoriteBoar);

                // Stores information about all boars the user has
                const boarArray: any[] = [];
                // Stores a slice of the boar array that's being shown
                let currentBoarArray: any[];

                let attachment: AttachmentBuilder;

                // Adds information about each boar in user's boar collection to an array
                for (const boarID of Object.keys(boarUser.boarCollection)) {
                    // Local boar information
                    const boarInfo = boarUser.boarCollection[boarID];
                    const rarity: string = findRarity(boarID);

                    // Global boar information
                    const boarDetails = config.boarIDs[boarID];

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

                // Constants with context
                const msPerSec = 1000;
                const boarsPerPage = 16;

                // Aliases for information stored in config
                const maxScore = nums.maxScore;
                const maxBoars = nums.maxBoars;
                const maxGifts = nums.maxGifts;
                const maxMultiplier = 1 / config.raritiesInfo[rarities[rarities.length - 1]].probability;
                let maxUniques = Object.keys(config.boarIDs).length;

                // Position and dimension information
                const origin = generalNums.originPos;
                const imageSize = nums.imageSize;

                // Font info
                const fontName = configStrings.general.fontName;
                const mediumFont = `${generalNums.fontSizes.medium}px ${fontName}`;
                const smallFont = `${generalNums.fontSizes.small_medium}px ${fontName}`;

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
                const giftString = userGifts <= maxGifts
                    ? userGifts.toLocaleString()
                    : `${maxGifts.toLocaleString()}+`;

                // Gets the day a user first started using the bot
                let firstDate: string;
                if (boarUser.firstDaily > 0) {
                    firstDate = new Date(boarUser.firstDaily * msPerSec)
                        .toLocaleString('default', { month: 'long', day: '2-digit', year: 'numeric' })
                } else {
                    firstDate = collectionStrings.noDailies;
                }

                currentBoarArray = boarArray.slice(0, boarsPerPage);

                // Creating image
                const canvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
                const ctx = canvas.getContext('2d');

                // Draws underlay
                drawImageCompact(ctx, await Canvas.loadImage(collectionUnderlay), origin, imageSize);

                // Draws top bar information
                drawImageCompact(ctx, await Canvas.loadImage(userAvatar), nums.userAvatarPos, nums.userAvatarSize);
                drawText(ctx, userTag, nums.userTagPos, mediumFont, 'left', hexColors.font);
                drawText(ctx, firstDate, nums.datePos, mediumFont, 'left', hexColors.font);

                // Draws badge information
                if (boarUser.badges.length === 0)
                    drawText(ctx, collectionStrings.noBadges, nums.noBadgePos, mediumFont, 'left', hexColors.font);

                for (let i=0; i<boarUser.badges.length; i++) {
                    const badgesFolder = configAssets.badges;
                    const badgeXY = [nums.badgeStart + i * nums.badgeSpacing, nums.badgeY];
                    const badgeFile = badgesFolder + config.badgeIDs[boarUser.badges[i]].file;

                    drawImageCompact(ctx, await Canvas.loadImage(badgeFile), badgeXY, nums.badgeSize);
                }

                // Draws stats information
                drawText(ctx, scoreString, nums.scorePos, smallFont, 'center', hexColors.font);
                drawText(ctx, totalString, nums.totalPos, smallFont, 'center', hexColors.font);
                drawText(ctx, uniqueString, nums.uniquePos, smallFont, 'center', hexColors.font);
                drawText(ctx, multiString, nums.multiPos, smallFont, 'center', hexColors.font);
                drawText(ctx, giftString, nums.giftPos, smallFont, 'center', hexColors.font);

                // Draws last boar gotten and rarity
                if (boarUser.lastBoar !== '') {
                    const lastBoarDetails = config.boarIDs[boarUser.lastBoar];
                    const boarFile = boarsFolder + lastBoarDetails.file

                    drawImageCompact(ctx, await Canvas.loadImage(boarFile), nums.lastBoarPos, nums.lastBoarSize);
                    drawRect(ctx, nums.lastRarityPos, nums.lastRaritySize, hexColors[lastBoarRarity]);
                }

                // Draws favorite boar and rarity
                if (boarUser.favoriteBoar !== '') {
                    const favoriteBoarDetails = config.boarIDs[boarUser.favoriteBoar];
                    const boarFile = boarsFolder + favoriteBoarDetails.file

                    drawImageCompact(ctx, await Canvas.loadImage(boarFile), nums.favBoarPos, nums.favBoarSize);
                    drawRect(ctx, nums.favRarityPos, nums.favRaritySize, hexColors[favoriteBoarRarity]);
                }

                // Draws boar enhancers
                for (let i=0; i<nums.enhancerCols; i++) {
                    const enhancerPos = [
                        nums.enhancerStartX + i % nums.enhancerCols * nums.enhancerSpacingX, nums.enhancerStartY
                    ];

                    let enhancerFile = collectionFolder + collectionAssets.enhancerOff;
                    if (i < boarUser.powerups.enhancers)
                        enhancerFile = collectionFolder + collectionAssets.enhancerOn;

                    drawImageCompact(ctx, await Canvas.loadImage(enhancerFile), enhancerPos, nums.enhancerSize);
                }

                await finishImage(config, interaction, canvas, currentBoarArray);

                let curPage: number = 1;

                // Handles fast interactions from overlapping
                let timeUntilNextCollect = 0;
                let updateTime: NodeJS.Timer;

                // Only allows button presses from current interaction to affect results
                const filter = async (btnInt: ButtonInteraction | SelectMenuInteraction) => {
                    return btnInt.customId.split('|')[1] === interaction.id;
                };

                const collector = interaction.channel.createMessageComponentCollector({
                    filter,
                    idle: 120000
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

                    sendDebug(debugStrings.formInteraction
                        .replace('%@', interaction.user.tag)
                        .replace('%@', inter.customId.split('|')[0])
                        .replace('%@', curPage)
                    );
                });
            } catch (err: unknown) {
                await handleError(err, interaction);
            }
        }, interaction.id + userInput.id)

        sendDebug(debugStrings.endCommand
            .replace('%@', interaction.user.tag)
            .replace('%@', interaction.options.getSubcommand())
        );
    }
};