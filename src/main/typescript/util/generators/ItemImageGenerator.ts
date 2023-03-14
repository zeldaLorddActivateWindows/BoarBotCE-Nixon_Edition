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
    private rarityColorKey: string = '';
    private imageFilePath: string = '';
    private userAvatar: string = '';
    private userTag: string = '';
    private itemInfo: BoarItemConfig | BadgeItemConfig = {} as BoarItemConfig;
    private isBoar: boolean = true;

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
    public async handleImageCreate(): Promise<AttachmentBuilder> {
        const strConfig = this.config.stringConfig;
        const pathConfig = this.config.pathConfig;
        const numConfig = this.config.numberConfig;

        this.isBoar = this.id in this.config.boarItemConfigs;
        let folderPath: string;

        if (!this.isBoar) {
            this.itemInfo = this.config.badgeItemConfigs[this.id];
            folderPath = pathConfig.badgeImages;
            this.rarityColorKey = 'badge';
        } else {
            this.itemInfo = this.config.boarItemConfigs[this.id];
            folderPath = pathConfig.boarImages;
            this.rarityColorKey = 'rarity' + BoarUtils.findRarity(this.id);
        }

        this.imageFilePath = folderPath + this.itemInfo.file;
        const imageExtension = this.imageFilePath.split('.')[1];
        const isAnimated = imageExtension === 'gif';

        const tempPath = pathConfig.tempItemAssets + this.id + this.rarityColorKey + '.' + imageExtension;

        if (fs.existsSync(tempPath)) {
            return new AttachmentBuilder(
                fs.readFileSync(tempPath), { name:`${strConfig.imageName}.${imageExtension}` }
            );
        }

        const usernameLength = numConfig.maxUsernameLength;

        this.userAvatar = this.boarUser.user.displayAvatarURL({ extension: 'png' });
        this.userTag = this.boarUser.user.username.substring(0, usernameLength) +
            '#' + this.boarUser.user.discriminator;

        // Creates a dynamic response attachment depending on the boar's image type
        if (isAnimated) {
            await this.makeAnimated();
        } else {
            await this.makeStatic();
        }

        // Saves image file for faster subsequent interactions
        fs.writeFileSync(tempPath, this.buffer);

        return new AttachmentBuilder(this.buffer, { name:`${strConfig.imageName}.${imageExtension}` });
    }

    private async makeAnimated() {
        const script = this.config.pathConfig.dynamicImageScript;

        // Waits for python code to execute before continuing
        await new Promise((resolve, reject) => {
            const scriptOptions: Options = {
                args: [
                    JSON.stringify(this.config),
                    this.rarityColorKey,
                    this.imageFilePath,
                    this.userAvatar,
                    this.userTag,
                    this.title,
                    this.itemInfo.name,
                    this.isBoar.toString()
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

    private async makeStatic() {
        const strConfig = this.config.stringConfig;
        const numConfig = this.config.numberConfig;
        const pathConfig = this.config.pathConfig;
        const colorConfig = this.config.colorConfig;

        const itemAssetsFolder = pathConfig.itemAssets;
        const underlayPath = itemAssetsFolder + pathConfig.itemUnderlay;
        const backplatePath = itemAssetsFolder + pathConfig.itemBackplate;
        const overlay = itemAssetsFolder + pathConfig.itemOverlay;
        const nameplate = itemAssetsFolder + pathConfig.itemNameplate;

        // Positioning and dimension info

        const origin = numConfig.originPos;
        const imageSize = numConfig.itemImageSize;
        let nameplateSize: [number, number];

        let mainPos: [number, number];
        let mainSize: [number, number];

        if (!this.isBoar) {
            mainPos = numConfig.itemBadgePos;
            mainSize = numConfig.itemBadgeSize;
        } else {
            mainPos = numConfig.itemBoarPos;
            mainSize = numConfig.itemBoarSize;
        }

        // Font info

        const fontName = strConfig.fontName;
        const bigFont = `${numConfig.fontBig}px ${fontName}`;
        const mediumFont = `${numConfig.fontMedium}px ${fontName}`;

        const canvas = Canvas.createCanvas(imageSize[0], imageSize[1]);
        const ctx = canvas.getContext('2d');

        // Draws edge/background rarity color

        CanvasUtils.drawRect(ctx, origin, imageSize, colorConfig[this.rarityColorKey]);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(await Canvas.loadImage(underlayPath), ...origin, ...imageSize);
        ctx.globalCompositeOperation = 'normal';

        // Draws badge and overlay

        ctx.drawImage(await Canvas.loadImage(backplatePath), ...origin, ...imageSize);
        ctx.drawImage(await Canvas.loadImage(this.imageFilePath), ...mainPos, ...mainSize);
        ctx.drawImage(await Canvas.loadImage(overlay), ...origin, ...imageSize);

        // Draws method of delivery and name of badge

        CanvasUtils.drawText(ctx, this.title, numConfig.itemTitlePos, bigFont, 'center', colorConfig.font);
        CanvasUtils.drawText(
            ctx, this.itemInfo.name, numConfig.itemNamePos, mediumFont, 'center', colorConfig.font
        );

        // Draws user information

        nameplateSize = [
            ctx.measureText(this.userTag).width + numConfig.itemNameplatePadding,
            numConfig.itemNameplateHeight
        ];
        ctx.drawImage(await Canvas.loadImage(nameplate), ...numConfig.itemNameplatePos, ...nameplateSize);
        CanvasUtils.drawText(ctx, this.userTag, numConfig.itemUserTagPos, mediumFont, 'left', colorConfig.font);
        CanvasUtils.drawCircleImage(
            ctx, await Canvas.loadImage(this.userAvatar), numConfig.itemUserAvatarPos, numConfig.itemUserAvatarWidth
        );

        this.buffer = canvas.toBuffer();
    }
}