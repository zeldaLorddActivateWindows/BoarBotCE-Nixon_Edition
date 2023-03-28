import Canvas from 'canvas';
import {BotConfig} from '../../bot/config/BotConfig';
import {BoarItemConfig} from '../../bot/config/items/BoarItemConfig';
import {BadgeItemConfig} from '../../bot/config/items/BadgeItemConfig';
import {BoarUtils} from '../boar/BoarUtils';
import {Options, PythonShell} from 'python-shell';
import {LogDebug} from '../logging/LogDebug';
import {CanvasUtils} from './CanvasUtils';
import {AttachmentBuilder} from 'discord.js';
import {BoarUser} from '../boar/BoarUser';
import fs from 'fs';
import moment from 'moment/moment';

/**
 * {@link CollectionImageGenerator CollectionImageGenerator.ts}
 *
 * Creates the dynamic collection image.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CollectionImageGenerator {
    private readonly boarUser: BoarUser = {} as BoarUser;
    private readonly config: BotConfig = {} as BotConfig;
    private readonly allBoars: any[] = [];
    private normalBase: Buffer = {} as Buffer;
    private detailedBase: Buffer = {} as Buffer;
    private powerupsBase: Buffer = {} as Buffer;

    constructor(boarUser: BoarUser, config: BotConfig, boars: any[]) {
        this.boarUser = boarUser;
        this.config = config;
        this.allBoars = boars;
    }

    /**
     * Creates the base image of the Normal view
     *
     * @private
     */
    public async createNormalBase(): Promise<void> {
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

        // Maximums

        const maxUniques = Object.keys(this.config.boarItemConfigs).length;

        // Non-trivial user information

        const userUniques = Object.keys(this.boarUser.boarCollection).length;
        const userTag = this.boarUser.user.username.substring(0, nums.maxUsernameLength) + '#' +
            this.boarUser.user.discriminator;
        const userAvatar = this.boarUser.user.displayAvatarURL({ extension: 'png' });

        // Fixes stats through flooring/alternate values

        const scoreString = Math.min(this.boarUser.boarScore, nums.maxScore).toLocaleString();
        const totalString = Math.min(this.boarUser.totalBoars, nums.maxBoars).toLocaleString();
        const uniqueString = Math.min(userUniques, maxUniques).toLocaleString();
        const dailiesString = Math.min(this.boarUser.numDailies, nums.maxDailies).toLocaleString();
        const streakString = Math.min(this.boarUser.boarStreak, nums.maxStreak).toLocaleString();
        const lastDailyString = this.boarUser.lastDaily > 0
            ? moment(this.boarUser.lastDaily).fromNow()
            : strConfig.unavailable;
        const firstDate = this.boarUser.firstDaily > 0
            ? new Date(this.boarUser.firstDaily).toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric'})
            : strConfig.unavailable;

        // Font info

        const fontName = strConfig.fontName;
        const bigFont = `${nums.fontBig}px ${fontName}`;
        const mediumFont = `${nums.fontMedium}px ${fontName}`;
        const smallFont = `${nums.fontSmallMedium}px ${fontName}`;

        const canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx = canvas.getContext('2d');

        // Draws underlay

        ctx.drawImage(await Canvas.loadImage(collectionUnderlay), ...nums.originPos, ...nums.collImageSize);

        // Draws top bar information

        ctx.drawImage(await Canvas.loadImage(userAvatar), ...nums.collUserAvatarPos, ...nums.collUserAvatarSize);
        CanvasUtils.drawText(ctx, userTag, nums.collUserTagPos, mediumFont, 'left', colorConfig.font);
        CanvasUtils.drawText(ctx, strConfig.collDateLabel, nums.collDateLabelPos, mediumFont, 'left', colorConfig.font);
        CanvasUtils.drawText(ctx, firstDate, nums.collDatePos, mediumFont, 'left', colorConfig.font);
        ctx.drawImage(await Canvas.loadImage(noClan), ...nums.collClanPos, ...nums.collClanSize);

        if (this.boarUser.badges.length === 0) {
            CanvasUtils.drawText(
                ctx, strConfig.collNoBadges, nums.collNoBadgePos, mediumFont, 'left', colorConfig.font
            );
        }

        // Draws badge information if the user has badges

        for (let i=0; i<this.boarUser.badges.length; i++) {
            const badgesFolder = pathConfig.badgeImages;
            const badgeXY: [number, number] = [nums.collBadgeStart + i * nums.collBadgeSpacing, nums.collBadgeY];
            const badgeFile = badgesFolder + this.config.badgeItemConfigs[this.boarUser.badges[i]].file;

            ctx.drawImage(await Canvas.loadImage(badgeFile), ...badgeXY, ...nums.collBadgeSize);
        }

        // Draws stats information

        CanvasUtils.drawText(
            ctx, strConfig.collScoreLabel, nums.collScoreLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, scoreString, nums.collScorePos, smallFont, 'center', colorConfig.font);

        CanvasUtils.drawText(
            ctx, strConfig.collTotalLabel, nums.collTotalLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, totalString, nums.collTotalPos, smallFont, 'center', colorConfig.font);

        CanvasUtils.drawText(
            ctx, strConfig.collUniquesLabel, nums.collUniquesLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, uniqueString, nums.collUniquePos, smallFont, 'center', colorConfig.font);

        CanvasUtils.drawText(
            ctx, strConfig.collDailiesLabel, nums.collDailiesLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, dailiesString, nums.collDailiesPos, smallFont, 'center', colorConfig.font);

        CanvasUtils.drawText(
            ctx, strConfig.collStreakLabel, nums.collStreakLabelPos, mediumFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, streakString, nums.collStreakPos, smallFont, 'center', colorConfig.font);

        CanvasUtils.drawText(
            ctx, strConfig.collLastDailyLabel, nums.collLastDailyLabelPos, bigFont, 'center', colorConfig.font
        );
        CanvasUtils.drawText(ctx, lastDailyString, nums.collLastDailyPos, bigFont, 'center', colorConfig.font);

        this.normalBase = canvas.toBuffer();
    }

    /**
     * Finalizes the Normal view image
     *
     * @private
     */
    public async finalizeNormalImage(page: number): Promise<AttachmentBuilder> {
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

        const lastBoarRarity = BoarUtils.findRarity(this.boarUser.lastBoar);
        const favBoarRarity = BoarUtils.findRarity(this.boarUser.favoriteBoar);

        const curBoars = this.allBoars.slice(page * boarsPerPage, (page+1)*boarsPerPage);

        const canvas = Canvas.createCanvas(nums.collImageSize[0], nums.collImageSize[1]);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(this.normalBase), ...nums.originPos, ...nums.collImageSize);

        ctx.drawImage(canvas, ...nums.originPos, ...nums.collImageSize);

        // Draws boars and rarities
        for (let i=0; i<curBoars.length; i++) {
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

            const boarFile = boarsFolder + curBoars[i].file;

            ctx.drawImage(await Canvas.loadImage(boarFile), ...boarImagePos, ...nums.collBoarSize);
            CanvasUtils.drawLine(
                ctx, lineStartPos, lineEndPos, nums.collRarityWidth, colorConfig['rarity' + curBoars[i].rarity]
            );
        }

        // Draws overlay

        ctx.drawImage(await Canvas.loadImage(collectionOverlay), ...nums.originPos, ...nums.collImageSize);
        CanvasUtils.drawText(
            ctx, strConfig.collFavLabel, nums.collFavLabelPos, smallestFont, 'center', favBoarRarity === 0
                ? colorConfig.font
                : colorConfig['rarity' + favBoarRarity]
        );
        CanvasUtils.drawText(
            ctx, strConfig.collRecentLabel, nums.collRecentLabelPos, smallestFont, 'center', lastBoarRarity === 0
                ? colorConfig.font
                : colorConfig['rarity' + lastBoarRarity]
        );

        return new AttachmentBuilder(canvas.toBuffer());
    }

    /**
     * Creates the base image of the Detailed view
     *
     * @private
     */
    public async createDetailedBase(): Promise<void> {}

    /**
     * Creates the base image of the Powerups view
     *
     * @private
     */
    public async createPowerupsBase(): Promise<void> {}
}