import Canvas from 'canvas';
import {BotConfig} from '../../bot/config/BotConfig';
import {BoarUtils} from '../boar/BoarUtils';
import {Options, PythonShell} from 'python-shell';
import {LogDebug} from '../logging/LogDebug';
import {CanvasUtils} from './CanvasUtils';
import {AttachmentBuilder} from 'discord.js';
import {BoarUser} from '../boar/BoarUser';
import fs from 'fs';

/**
 * {@link ItemImageGenerator ItemImageGenerator.ts}
 *
 * Creates the dynamic item image.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class ItemImageGenerator {
    private readonly boarUser: BoarUser = {} as BoarUser;
    private readonly config: BotConfig = {} as BotConfig;
    private readonly id: string = '';
    private readonly title: string = '';
    private buffer: Buffer = {} as Buffer;
    private tempPath: string = '';
    private colorKey: string = '';
    private imageFilePath: string = '';
    private userAvatar: string = '';
    private userTag: string = '';
    private itemName: string = '';
    private itemFile: string = '';
    private isBadge: boolean = false;

    constructor(boarUser: BoarUser, config: BotConfig, id: string, title: string) {
        this.boarUser = boarUser;
        this.config = config;
        this.id = id;
        this.title = title;
    }

    /**
     * Creates the image to be sent on boar/badge add

     * @return attachment - AttachmentBuilder object containing image
     * @private
     */
    public async handleImageCreate(
        isBadge: boolean,
        manualInput?: {name: string, file: string, colorKey: string},
        score?: number
    ): Promise<AttachmentBuilder> {
        const strConfig = this.config.stringConfig;
        const pathConfig = this.config.pathConfig;

        let folderPath: string;

        this.isBadge = isBadge;

        if (this.isBadge && manualInput === undefined) {
            const badgeInfo = this.config.badgeItemConfigs[this.id];
            this.itemName = badgeInfo.name;
            this.itemFile = badgeInfo.file;
            folderPath = pathConfig.badgeImages;
            this.colorKey = 'badge';
        } else if (manualInput === undefined) {
            const boarInfo = this.config.boarItemConfigs[this.id];
            this.itemName = boarInfo.name;
            this.itemFile = boarInfo.file;
            folderPath = pathConfig.boarImages;
            this.colorKey = 'rarity' + BoarUtils.findRarity(this.id)[0];
        } else {
            this.itemName = manualInput.name;
            this.itemFile = manualInput.file;
            folderPath = pathConfig.otherAssets;
            this.colorKey = manualInput.colorKey;
        }

        this.imageFilePath = folderPath + this.itemFile;
        const imageExtension = this.imageFilePath.split('.')[1];
        const isAnimated = imageExtension === 'gif';

        const usernameLength = this.config.numberConfig.maxUsernameLength;

        this.tempPath = pathConfig.tempItemAssets + this.id + this.colorKey +
            this.title.toLowerCase().substring(0, 4) + '.' + imageExtension;

        this.userAvatar = this.boarUser.user.displayAvatarURL({ extension: 'png' });
        this.userTag = this.boarUser.user.username.substring(0, usernameLength);

        // Creates base response attachment depending on the boar's image type
        if (!fs.existsSync(this.tempPath)) {
            if (isAnimated) {
                await this.makeAnimated();
            } else {
                await this.makeStatic();
            }
            fs.writeFileSync(this.tempPath, this.buffer);
        } else {
            this.buffer = fs.readFileSync(this.tempPath);
        }

        if (isAnimated) {
            await this.addAnimatedProfile(score);
        } else {
            await this.addStaticProfile(score);
        }

        return new AttachmentBuilder(this.buffer, { name:`${strConfig.imageName}.${imageExtension}` });
    }

    private async makeAnimated() {
        const script = this.config.pathConfig.dynamicImageScript;

        // Waits for python code to execute before continuing
        await new Promise((resolve) => {
            const scriptOptions: Options = {
                args: [
                    JSON.stringify(this.config.pathConfig),
                    JSON.stringify(this.config.colorConfig),
                    JSON.stringify(this.config.numberConfig),
                    this.colorKey,
                    this.imageFilePath,
                    this.title,
                    this.itemName,
                    this.isBadge.toString()
                ]
            };

            // Sends python all dynamic image data and receives final animated image
            PythonShell.run(script, scriptOptions, (err, data) => {
                if (!data) {
                    LogDebug.handleError(err);
                    return;
                }

                this.buffer = Buffer.from(data[0], 'base64');
                resolve('Success');
            });
        });
    }

    private async makeStatic() {
        const strConfig = this.config.stringConfig;
        const nums = this.config.numberConfig;
        const pathConfig = this.config.pathConfig;
        const colorConfig = this.config.colorConfig;

        const itemAssetsFolder = pathConfig.itemAssets;
        const underlayPath = itemAssetsFolder + pathConfig.itemUnderlay;
        const backplatePath = itemAssetsFolder + pathConfig.itemBackplate;
        const overlay = itemAssetsFolder + pathConfig.itemOverlay;

        // Positioning and dimension info

        const origin = nums.originPos;
        const imageSize = nums.itemImageSize;

        let mainPos: [number, number];
        let mainSize: [number, number];

        if (this.isBadge) {
            mainPos = nums.itemBadgePos;
            mainSize = nums.itemBadgeSize;
        } else {
            mainPos = nums.itemBoarPos;
            mainSize = nums.itemBoarSize;
        }

        // Font info

        const fontName = strConfig.fontName;
        const mediumFont = `${nums.fontMedium}px ${fontName}`;

        const canvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
        const ctx = canvas.getContext('2d');

        // Draws edge/background rarity color

        CanvasUtils.drawRect(ctx, origin, imageSize, colorConfig[this.colorKey]);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(await Canvas.loadImage(underlayPath), ...origin, ...imageSize);
        ctx.globalCompositeOperation = 'normal';

        // Draws item and overlay

        ctx.drawImage(await Canvas.loadImage(backplatePath), ...origin);
        ctx.drawImage(await Canvas.loadImage(this.imageFilePath), ...mainPos, ...mainSize);
        ctx.drawImage(await Canvas.loadImage(overlay), ...origin);

        // Draws method of delivery and name of item

        CanvasUtils.drawText(ctx, this.title, nums.itemTitlePos, mediumFont, 'center', colorConfig.font);
        CanvasUtils.drawText(
            ctx, this.itemName, nums.itemNamePos, mediumFont, 'center', colorConfig[this.colorKey]
        );

        this.buffer = canvas.toBuffer();
    }

    private async addAnimatedProfile(score?: number) {
        const script = this.config.pathConfig.userOverlayScript;

        // Waits for python code to execute before continuing
        await new Promise((resolve, reject) => {
            const scriptOptions: Options = {
                args: [
                    JSON.stringify(this.config.pathConfig),
                    JSON.stringify(this.config.colorConfig),
                    JSON.stringify(this.config.numberConfig),
                    this.tempPath,
                    this.userAvatar,
                    this.userTag,
                    score === undefined ? '' : score.toLocaleString()
                ]
            };

            // Sends python all dynamic image data and receives final animated image
            PythonShell.run(script, scriptOptions, (err, data) => {
                if (!data) {
                    LogDebug.handleError(err);

                    reject('Python Error!');
                    return;
                }

                this.buffer = Buffer.from(data[0], 'base64');
                resolve('Script ran successfully!');
            });
        });
    }

    private async addStaticProfile(score?: number) {
        const nums = this.config.numberConfig;
        const colorConfig = this.config.colorConfig;

        const smallMediumFont = `${nums.fontSmallMedium}px ${this.config.stringConfig.fontName}`;

        const origin = nums.originPos;
        const imageSize = nums.itemImageSize;

        const canvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(this.tempPath), ...origin, ...imageSize);

        ctx.font = smallMediumFont;

        ctx.beginPath();
        ctx.roundRect(
            nums.itemUserBoxPos[0], nums.itemUserBoxPos[1],
            ctx.measureText(this.userTag).width + nums.itemUserBoxExtra, nums.itemBoxHeight, nums.itemBorderRadius
        );
        ctx.fillStyle = this.config.colorConfig.foregroundGray;
        ctx.fill();

        CanvasUtils.drawText(ctx, this.userTag, nums.itemUserTagPos, smallMediumFont, 'left', colorConfig.font);

        if (score) {
            ctx.beginPath();
            ctx.roundRect(
                nums.itemBucksBoxPos[0], nums.itemBucksBoxPos[1],
                ctx.measureText('+$' + score).width + nums.itemBucksBoxExtra, nums.itemBoxHeight, nums.itemBorderRadius
            );
            ctx.fillStyle = this.config.colorConfig.foregroundGray;
            ctx.fill();

            CanvasUtils.drawText(
                ctx, '+%@' + score.toLocaleString(), nums.itemBucksPos, smallMediumFont, 'left',
                colorConfig.font, undefined, false, '$', colorConfig.bucks
            );
        }

        CanvasUtils.drawCircleImage(
            ctx, await Canvas.loadImage(this.userAvatar), nums.itemUserAvatarPos, nums.itemUserAvatarWidth
        );

        this.buffer = canvas.toBuffer();
    }
}