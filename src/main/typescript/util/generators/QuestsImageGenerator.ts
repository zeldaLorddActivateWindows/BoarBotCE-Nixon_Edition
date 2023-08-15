import {BotConfig} from '../../bot/config/BotConfig';
import Canvas from 'canvas';
import {CanvasUtils} from './CanvasUtils';
import {AttachmentBuilder} from 'discord.js';
import {StringConfig} from '../../bot/config/StringConfig';
import {NumberConfig} from '../../bot/config/NumberConfig';
import {ColorConfig} from '../../bot/config/ColorConfig';
import {PathConfig} from '../../bot/config/PathConfig';
import {BoarUser} from '../boar/BoarUser';
import {DataHandlers} from '../data/DataHandlers';
import {QuestData} from '../data/global/QuestData';
import {QuestConfigs} from '../../bot/config/quests/QuestConfigs';
import {ItemConfigs} from '../../bot/config/items/ItemConfigs';

/**
 * {@link QuestsImageGenerator QuestsImageGenerator.ts}
 *
 * Creates an image showing a user's progress on weekly boar quests
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class QuestsImageGenerator {
    /**
     * Creates a dynamic generic embed
     *
     * @param boarUser
     * @param config - Used to get position and other config info
     */
    public static async makeImage(boarUser: BoarUser, config: BotConfig) {
        const strConfig: StringConfig = config.stringConfig;
        const nums: NumberConfig = config.numberConfig;
        const colorConfig: ColorConfig = config.colorConfig;
        const pathConfig: PathConfig = config.pathConfig;
        const questConfigs: QuestConfigs = config.questConfigs;
        const powConfigs: ItemConfigs = config.itemConfigs.powerups;

        const questsUnderlay = pathConfig.otherAssets + pathConfig.questsUnderlay;

        const fontMedium = `${nums.fontMedium}px ${strConfig.fontName}`;
        const fontSmallest = `${nums.fontSmallest}px ${strConfig.fontName}`;

        const questData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Quest) as QuestData;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

        const startDay = new Date(questData.questsStartTimestamp);
        const endDay = new Date(questData.questsStartTimestamp + nums.oneDay * 7);

        const startDayStr = months[startDay.getUTCMonth()] + ' ' + startDay.getUTCDate();
        const endDayStr = months[endDay.getUTCMonth()] + ' ' + endDay.getUTCDate();

        const canvas: Canvas.Canvas = Canvas.createCanvas(1127, 1500);
        const ctx: Canvas.CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(questsUnderlay), 0, 0);

        await CanvasUtils.drawText(
            ctx, `${startDayStr} - ${endDayStr}`, [563, 143], fontMedium, 'center', colorConfig.font
        );

        const startPos = [76, 244];
        let index = 0;
        for (const id of questData.curQuestIDs) {
            const questConfig = questConfigs[id];
            const valIndex = Math.floor(index / 2);
            let isAltStr = false;
            let numToComplete = 1;
            let dynamicPart = '';
            const rewardAmt = questConfig.questVals[valIndex][1];

            const questStrPos: [number, number] = [startPos[0], startPos[1] + index * 166];
            const progressStrPos: [number, number] = [startPos[0], startPos[1] + index * 166 + 75];
            const bucksRewardPos: [number, number] = [startPos[0] + 972, startPos[1] + index * 166 + 46];
            const powRewardAmtPos: [number, number] = [startPos[0] + 867, startPos[1] + index * 166 + 41];
            const powRewardImgPos: [number, number] = [startPos[0] + 865, startPos[1] + index * 166 - 45];

            switch(questConfig.valType) {
                case 'number':
                    isAltStr = questConfig.questVals[valIndex][0] > 1;
                    numToComplete = questConfig.questVals[valIndex][0];
                    dynamicPart = (id.toLowerCase().includes('bucks')
                        ? '$'
                        : '') + questConfig.questVals[valIndex][0].toLocaleString();
                    break;
                case 'rarity':
                    isAltStr = valIndex === 1 || valIndex === 3;
                    numToComplete = 1;
                    dynamicPart = config.rarityConfigs[questConfig.questVals[valIndex][0] - 1].name + ' Boar';
                    break;
                case 'time':
                    numToComplete = 1;
                    dynamicPart = '<' + questConfig.questVals[valIndex][0].toLocaleString() + 'ms';
                    break;
            }

            await CanvasUtils.drawText(
                ctx, isAltStr ? questConfig.descriptionAlt : questConfig.description, questStrPos, fontMedium, 'left',
                colorConfig.font, 800, false, [dynamicPart], [colorConfig.green]
            );

            await CanvasUtils.drawText(
                ctx, boarUser.stats.quests.progress[index] + '/' + numToComplete, progressStrPos, fontMedium, 'left',
                boarUser.stats.quests.progress[index] >= numToComplete
                    ? colorConfig.green
                    : colorConfig.silver
            );

            if (valIndex < 2 && questConfig.lowerReward === 'bucks') {
                await CanvasUtils.drawText(
                    ctx, '+$' + rewardAmt, bucksRewardPos, fontMedium, 'right', colorConfig.bucks
                );
            } else if (valIndex < 2) {
                const powRewardImgPath = pathConfig.powerups + powConfigs[questConfig.lowerReward].file;

                await CanvasUtils.drawText(
                    ctx, '+' + rewardAmt, powRewardAmtPos, fontSmallest, 'right', colorConfig.powerup
                );
                ctx.drawImage(await Canvas.loadImage(powRewardImgPath), ...powRewardImgPos, 142, 142);
            } else {
                const powRewardImgPath = pathConfig.powerups + powConfigs[questConfig.higherReward].file;

                await CanvasUtils.drawText(
                    ctx, '+' + rewardAmt, powRewardAmtPos, fontSmallest, 'right', colorConfig.powerup
                );
                ctx.drawImage(await Canvas.loadImage(powRewardImgPath), ...powRewardImgPos, 142, 142);
            }

            index++;
        }

        await CanvasUtils.drawText(
            ctx, '3 ' + config.itemConfigs.powerups.enhancer.pluralName, [563, 1477],
            fontMedium, 'center', colorConfig.powerup
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${strConfig.imageName}.png` });
    }
}