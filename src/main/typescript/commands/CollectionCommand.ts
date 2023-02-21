/************************************************
 * CollectionCommand.ts
 * Used to see a collection of boars, powerups,
 * and other information pertaining to a user.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction, ButtonStyle,
    ChatInputCommandInteraction, InteractionCollector, SelectMenuBuilder,
    SelectMenuInteraction, SlashCommandBuilder,
    User
} from 'discord.js';
import {PermissionFlagsBits} from 'discord-api-types/v10';
import {findRarity, handleStart} from '../util/GeneralFunctions';
import {BoarUser} from '../util/BoarUser';
import Canvas from 'canvas';
import {addQueue} from '../util/Queue';
import {handleError, sendDebug} from '../logging/LogDebug';
import {getConfigFile} from '../util/DataHandlers';
import {drawImageCompact, drawRect, drawText} from '../util/CanvasFunctions';
import {finishImage} from '../util/command_specific/CollectionFunctions';
import moment from 'moment';
import {Command} from '../api/commands/Command';
import {BoarBotApp} from '../BoarBotApp';

//***************************************

export default class CollectionCommand implements Command {
    private initConfig = BoarBotApp.getBot().getConfig();
    private commandInfo = this.initConfig.stringConfig.commands.collection;
    public readonly data = new SlashCommandBuilder()
        .setName(this.commandInfo.name)
        .setDescription(this.commandInfo.description)
        .setDMPermission(false)
        .setDefaultMemberPermissions(this.commandInfo.adminOnly ? PermissionFlagsBits.Administrator : undefined)
        .addUserOption(option => option.setName(this.commandInfo.args.arg1.name)
            .setDescription(this.commandInfo.args.arg1.description)
            .setRequired(this.commandInfo.args.arg1.required)
        ) as SlashCommandBuilder;

    public async execute(interaction: ChatInputCommandInteraction) {
        const config = getConfigFile();

        const guildData = await handleStart(interaction);

        if (!guildData)
            return;

        await interaction.deferReply();

        const debugStrings = config.strings.debug;

        // Gets user to interact with
        const userInput = (interaction.options.getUser(this.commandInfo.args.arg1.name)
            ? interaction.options.getUser(this.commandInfo.args.arg1.name)
            : interaction.user) as User;

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
        let lastBoarRarity = '';
        let favoriteBoarRarity = '';

        await addQueue(async () => {
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
                userTag = userInput.username.substring(0, generalNums.usernameLength) + '#' +
                    userInput.discriminator;

                // Atypical boar information
                lastBoarRarity = findRarity(boarUser.lastBoar);
                favoriteBoarRarity = findRarity(boarUser.favoriteBoar);

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
            } catch (err: unknown) {
                await handleError(err, interaction);
            }
        }, interaction.id + userInput.id);

        // Constants with context
        const boarsPerPage = 16;

        // Aliases for information stored in config
        const maxScore = nums.maxScore;
        const maxBoars = nums.maxBoars;
        const maxStreak = nums.maxStreak;
        const maxMultiplier = 1 / config.raritiesInfo[rarities[rarities.length - 1]].probability;
        let maxUniques = Object.keys(config.boarIDs).length;

        // Position and dimension information
        const origin = generalNums.originPos;
        const imageSize = nums.imageSize;

        // Font info
        const fontName = configStrings.general.fontName;
        const bigFont = `${generalNums.fontSizes.big}px ${fontName}`;
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
        const streakString = userStreak <= maxStreak
            ? userStreak.toLocaleString()
            : `${maxStreak.toLocaleString()}+`;
        const lastDailyString = userLastDaily > 1
            ? moment(userLastDaily).fromNow()
            : collectionStrings.dateUnavailable;

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

            sendDebug(debugStrings.formInteraction
                .replace('%@', interaction.user.tag)
                .replace('%@', inter.customId.split('|')[0])
                .replace('%@', curPage)
            );
        });

        sendDebug(debugStrings.endCommand
            .replace('%@', interaction.user.tag)
            .replace('%@', interaction.commandName)
        );
    }
}