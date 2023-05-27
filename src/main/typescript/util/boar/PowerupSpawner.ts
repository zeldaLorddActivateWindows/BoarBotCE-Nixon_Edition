/**
 * {@link PowerupSpawner PowerupSpawner.ts}
 *
 * Handles sending powerups and collecting user interactions
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
import {LogDebug} from '../logging/LogDebug';
import {BoarBotApp} from '../../BoarBotApp';
import {Queue} from '../interactions/Queue';
import {DataHandlers} from '../data/DataHandlers';
import fs from 'fs';
import {
    ActionRowBuilder, AttachmentBuilder,
    ButtonBuilder, ButtonInteraction, Channel,
    ChannelType, Message,
    TextChannel,
} from 'discord.js';
import {GuildData} from '../data/GuildData';
import {CollectorUtils} from '../discord/CollectorUtils';
import {BotConfig} from '../../bot/config/BotConfig';
import {Replies} from '../interactions/Replies';
import {PromptConfig} from '../../bot/config/powerups/PromptConfig';
import {NumberConfig} from '../../bot/config/NumberConfig';
import {RowConfig} from '../../bot/config/components/RowConfig';
import {PromptTypeConfig} from '../../bot/config/powerups/PromptTypeConfig';
import Canvas from 'canvas';
import {CanvasUtils} from '../generators/CanvasUtils';
import {PowerupConfig} from '../../bot/config/powerups/PowerupConfig';

export class PowerupSpawner {
    private readonly intervalVal: number =
        Math.round(BoarBotApp.getBot().getConfig().numberConfig.powInterval * (Math.random() * (1.25 - .75) + .75));
    private readonly initIntervalVal: number = 0;
    private claimers: Map<string, number> = new Map<string, number>();
    private powerupType: PowerupConfig = {} as PowerupConfig;
    private topOnePercent: number = -1;
    private topTenPercent: number = -1;
    private topFiftyPercent: number = -1;
    private powEndImage: AttachmentBuilder = {} as AttachmentBuilder;
    private numMsgs: number = 0;
    private numNotFinished: number = 0;
    private readyToEnd: boolean = false;

    constructor(initPowTime?: number) {
        this.initIntervalVal = initPowTime !== undefined ? Math.max(initPowTime - Date.now(), 5000) : this.intervalVal;
    }

    public startSpawning() {
        setTimeout(() => this.doSpawn(), this.initIntervalVal);
    }

    private async doSpawn() {
        try {
            const config = BoarBotApp.getBot().getConfig();
            const nums = config.numberConfig;
            const allBoarChannels: TextChannel[] = [];

            LogDebug.sendDebug('Spawning powerup', config);

            await Queue.addQueue(() => {
                const globalData = DataHandlers.getGlobalData();
                globalData.nextPowerup = Date.now() + this.intervalVal;
                fs.writeFileSync(config.pathConfig.globalDataFile, JSON.stringify(globalData));
            }, 'pow' + 'global');

            for (const guildFile of fs.readdirSync(config.pathConfig.guildDataFolder)) {
                const guildData: GuildData | undefined = await DataHandlers.getGuildData(guildFile.split('.')[0]);
                if (!guildData) continue;

                const client = BoarBotApp.getBot().getClient();
                for (const channelID of guildData.channels) {
                    let channel: Channel | null;

                    try {
                        channel = await client.channels.fetch(channelID)
                    } catch {
                        continue;
                    }

                    if (channel) {
                        allBoarChannels.push(channel as TextChannel);
                    }
                }
            }

            const curTime = Date.now();

            const powConfig = config.powerupConfig;
            const promptTypes = powConfig.promptTypes;
            const randPromptType = Object.keys(promptTypes)[Math.floor(
                Math.random() * Object.keys(promptTypes).length
            )];
            const chosenPrompt = this.getRandPrompt(randPromptType, config);

            this.powerupType = this.getRandPowerup(config);

            const rightStyle = promptTypes[randPromptType].rightStyle;
            const wrongStyle = promptTypes[randPromptType].wrongStyle;

            const rowsConfig = config.powerupConfig.rows;
            let rows: ActionRowBuilder<ButtonBuilder>[] = [];

            switch (randPromptType) {
                case 'emojiFind':
                    rows = this.makeEmojiRows(chosenPrompt, rightStyle, wrongStyle, rowsConfig, curTime, nums);
                    break;
                case 'trivia':
                    rows = this.makeTriviaRows(chosenPrompt, rightStyle, wrongStyle, rowsConfig, curTime, nums);
                    break;
                case 'fast':
                    rows = this.makeFastRows(chosenPrompt, rightStyle, wrongStyle, rowsConfig, curTime, nums);
                    break;
            }

            const powerupSpawnImage = await this.makePowerupSpawnImage(
                promptTypes[randPromptType], chosenPrompt, config
            );

            for (const channel of allBoarChannels) {
                try {
                    const collector = await CollectorUtils.createCollector(
                        channel, curTime.toString(), nums, false, nums.powDuration
                    );

                    const powMsg = await channel.send({
                        files: [powerupSpawnImage],
                        components: rows
                    });

                    this.numMsgs++;

                    collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter, powMsg, config));
                    collector.on('end', async () => await this.handleEndCollect(powMsg, config));
                } catch {}
            }
        } catch (err: unknown) {
            await LogDebug.handleError((err as Error).stack);
        }
    }

    private async handleCollect(inter: ButtonInteraction, powMsg: Message, config: BotConfig) {
        try {
            await inter.deferUpdate();

            LogDebug.sendDebug(inter.customId, config);

            if (!this.claimers.has(inter.user.id) && inter.customId.toLowerCase().includes('correct')) {
                let correctString = config.stringConfig.powRightFull;
                const timeToClaim = inter.createdTimestamp - powMsg.createdTimestamp;

                this.claimers.set(inter.user.id, timeToClaim);

                let occur = 0;
                correctString = correctString.replace(/%@/g, match => ++occur === 2 ? timeToClaim.toString() : match);

                await Replies.handleReply(inter, correctString, config.colorConfig.font,
                    config.stringConfig.powRight, config.colorConfig.green
                );
                LogDebug.sendDebug('Collected ' + inter.user.username, config);
            } else if (!this.claimers.has(inter.user.id)) {
                await Replies.handleReply(inter, config.stringConfig.powWrongFull, config.colorConfig.font,
                    config.stringConfig.powWrong, config.colorConfig.error
                );
                LogDebug.sendDebug('Failed attempt ' + inter.user.username, config);
            } else {
                await Replies.handleReply(inter, config.stringConfig.powAttempted, config.colorConfig.error);
                LogDebug.sendDebug('Already collected ' + inter.user.username, config);
            }
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    private async handleEndCollect(
        powMsg: Message,
        config: BotConfig
    ) {
        try {
            this.numNotFinished++;

            await powMsg.edit({
                components: [new ActionRowBuilder<ButtonBuilder>(config.powerupConfig.rows[1])]
            });

            if (--this.numMsgs === 0) {
                this.claimers = new Map([...this.claimers.entries()].sort((a, b) => a[1] - b[1]));

                const values = [...this.claimers.values()];
                const topOneIndex = Math.floor(this.claimers.size * .01);
                let topTenIndex = Math.floor(this.claimers.size * .1);
                let topFiftyIndex = Math.floor(this.claimers.size * .5);

                if (this.claimers.size > 0) {
                    this.topOnePercent = values[topOneIndex];
                }

                if (topOneIndex === topTenIndex && this.claimers.size > 1) {
                    this.topTenPercent = values[++topTenIndex];
                } else if (topOneIndex !== topTenIndex) {
                    this.topTenPercent = values[topTenIndex];
                }

                if (topOneIndex === topFiftyIndex && this.claimers.size > 2) {
                    this.topFiftyPercent = values[topFiftyIndex+2];
                } else if (topTenIndex === topFiftyIndex && this.claimers.size > 2) {
                    this.topFiftyPercent = values[topFiftyIndex+1];
                } else if (topTenIndex !== topFiftyIndex) {
                    this.topFiftyPercent = values[topFiftyIndex];
                }

                this.powEndImage = await this.makePowerupEndImage(config);

                await this.finishPow(powMsg, config);

                this.readyToEnd = true;
                return;
            }

            const finishInterval = setInterval(async () => {
                if (this.readyToEnd) {
                    await this.finishPow(powMsg, config);
                    clearInterval(finishInterval);
                }
            }, 1000);
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    private getRandPrompt(promptType: string, config: BotConfig) {
        const promptTypes = config.powerupConfig.promptTypes;
        const prompts: PromptConfig[] = [];

        for (const promptTypeProperty of Object.keys(promptTypes[promptType])) {
            if (
                typeof promptTypes[promptType][promptTypeProperty] === 'string' ||
                typeof promptTypes[promptType][promptTypeProperty] === 'number'
            ) {
                continue;
            }

            prompts.push(promptTypes[promptType][promptTypeProperty] as PromptConfig);
        }

        return prompts[Math.floor(Math.random() * prompts.length)] as PromptConfig;
    }

    private getRandPowerup(config: BotConfig) {
        const powerupTypes = config.powerupConfig;
        const powerups: PowerupConfig[] = [];

        for (const powerupTypeProperty of Object.keys(powerupTypes)) {
            if (!powerupTypes[powerupTypeProperty].hasOwnProperty('tiers')) {
                continue;
            }

            powerups.push(powerupTypes[powerupTypeProperty] as PowerupConfig);
        }

        return powerups[Math.floor(Math.random() * powerups.length)] as PowerupConfig;
    }

    private makeEmojiRows(
        prompt: PromptConfig,
        rightStyle: number,
        wrongStyle: number,
        rowsConfig: RowConfig[],
        id: number,
        nums: NumberConfig
    ): ActionRowBuilder<ButtonBuilder>[] {
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];

        const randEmojiIndex = Math.floor(Math.random() * nums.emojiRows * nums.emojiCols);

        const emoji1 = prompt.emoji1;
        const emoji2 = prompt.emoji2;

        let curIndex = 0;

        for (let i=0; i<nums.emojiRows; i++) {
            const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>();
            for (let j=0; j<nums.emojiCols; j++) {
                let button: ButtonBuilder;

                if (curIndex === randEmojiIndex) {
                    button = new ButtonBuilder(rowsConfig[0].components[0]);
                    button.setEmoji(emoji1).setStyle(rightStyle).setCustomId(
                        rowsConfig[0].components[0].customId + '|' + id
                    );
                } else {
                    button = new ButtonBuilder(rowsConfig[0].components[1]);
                    button.setEmoji(emoji2).setStyle(wrongStyle).setCustomId(
                        rowsConfig[0].components[1].customId + curIndex + '|' + id
                    );
                }

                row.addComponents(button);
                curIndex++;
            }
            rows.push(row);
        }

        return rows;
    }

    private makeTriviaRows(
        prompt: PromptConfig,
        rightStyle: number,
        wrongStyle: number,
        rowsConfig: RowConfig[],
        id: number,
        nums: NumberConfig
    ) {
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];

        const choices = [...prompt.choices];
        const answer = choices[0];

        let curIndex = 0;

        for (let i=0; i<nums.triviaRows; i++) {
            const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>();
            for (let j=0; j<nums.triviaCols; j++) {
                const randChoice = choices[Math.floor(Math.random() * choices.length)];
                let button: ButtonBuilder;

                if (randChoice === answer) {
                    button = new ButtonBuilder(rowsConfig[0].components[0]);
                    button.setLabel(randChoice).setStyle(rightStyle).setCustomId(
                        rowsConfig[0].components[0].customId + '|' + id
                    );
                } else {
                    button = new ButtonBuilder(rowsConfig[0].components[1]);
                    button.setLabel(randChoice).setStyle(wrongStyle).setCustomId(
                        rowsConfig[0].components[1].customId + curIndex + '|' + id
                    );
                }

                choices.splice(choices.indexOf(randChoice), 1);
                row.addComponents(button);
                curIndex++;
            }
            rows.push(row);
        }

        return rows;
    }

    private makeFastRows(
        prompt: PromptConfig,
        rightStyle: number,
        wrongStyle: number,
        rowsConfig: RowConfig[],
        id: number,
        nums: NumberConfig
    ) {
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];

        const numButtons = prompt.numButtons;
        const numRows = Math.ceil(numButtons / nums.fastCols);
        const randCorrectIndex = Math.floor(Math.random() * numButtons);

        let curIndex = 0;

        for (let i=0; i<numRows; i++) {
            const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>();
            for (let j=0; j<Math.min(numButtons, nums.fastCols); j++) {
                let button: ButtonBuilder;

                if (curIndex === randCorrectIndex) {
                    button = new ButtonBuilder(rowsConfig[0].components[0]);
                    button.setLabel('️').setStyle(rightStyle).setCustomId(
                        rowsConfig[0].components[0].customId + '|' + id
                    );
                } else {
                    button = new ButtonBuilder(rowsConfig[0].components[1]);
                    button.setLabel('️').setStyle(wrongStyle).setCustomId(
                        rowsConfig[0].components[1].customId + curIndex + '|' + id
                    );
                }

                row.addComponents(button);
                curIndex++;
            }
            rows.push(row);
        }

        return rows;
    }

    private async finishPow(powMsg: Message, config: BotConfig) {
        await powMsg.edit({
            files: [this.powEndImage],
            components: []
        });

        if (--this.numNotFinished === 0) {
            this.claimers = new Map<string, number>();
            this.topOnePercent = -1;
            this.topTenPercent = -1;
            this.topFiftyPercent = -1;
            this.powerupType = {} as PowerupConfig;
            this.readyToEnd = false;

            setTimeout(() => this.doSpawn(),
                Math.round(config.numberConfig.powInterval * (Math.random() * (1.25 - .75) + .75))
            );

            LogDebug.sendDebug('Finished', config);
        }
    }

    private async makePowerupSpawnImage(
        promptType: PromptTypeConfig,
        prompt: PromptConfig,
        config: BotConfig
    ) {
        const strConfig = config.stringConfig;
        const nums = config.numberConfig;
        const pathConfig = config.pathConfig;
        const colorConfig = config.colorConfig;

        const font = `${nums.fontBig}px ${strConfig.fontName}`;

        const canvas = Canvas.createCanvas(...nums.powSpawnSize);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(pathConfig.otherAssets + pathConfig.powerupSpawn), ...nums.originPos);

        const promptDescription: string = promptType.description ? promptType.description : prompt.description;

        CanvasUtils.drawText(
            ctx, promptDescription, nums.powSpawnDescriptionPos, font, 'center', colorConfig.font,
            nums.powSpawnDescriptionWidth, true
        );

        CanvasUtils.drawText(
            ctx, 'Reward: %@', nums.powSpawnRewardPos, font, 'center', colorConfig.font,
            nums.powSpawnDescriptionWidth, false, this.powerupType.pluralName, colorConfig.powerup
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${config.stringConfig.imageName}.png` });
    }

    private async makePowerupEndImage(
        config: BotConfig
    ) {
        const strConfig = config.stringConfig;
        const nums = config.numberConfig;
        const pathConfig = config.pathConfig;
        const colorConfig = config.colorConfig;

        const font = `${nums.fontBig}px ${strConfig.fontName}`;

        const canvas = Canvas.createCanvas(...nums.powSpawnSize);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(pathConfig.otherAssets + pathConfig.powerupEnd), ...nums.originPos);

        if (this.topOnePercent !== -1) {
            const topOneStr = '(Less than ' + (this.topOnePercent + 1) + 'ms)';
            const topTenStr = this.topTenPercent !== -1
                ? '(Less than ' + (this.topTenPercent + 1) + 'ms)'
                : 'N/A';
            const topFiftyStr = this.topFiftyPercent !== -1
                ? '(Less than ' + (this.topFiftyPercent + 1) + 'ms)'
                : 'N/A';

            CanvasUtils.drawText(
                ctx, 'Top 1%: %@', [745, 365], font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth, false, this.getPowerupString(this.powerupType.tiers[0]),
                colorConfig.powerup
            );
            CanvasUtils.drawText(
                ctx, topOneStr, [745, 435], font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth
            );

            CanvasUtils.drawText(
                ctx, 'Top 10%: %@', [745, 565], font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth, false, this.getPowerupString(this.powerupType.tiers[1]),
                colorConfig.powerup
            );
            CanvasUtils.drawText(
                ctx, topTenStr, [745, 635], font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth
            );

            CanvasUtils.drawText(
                ctx, 'Top 50%: %@', [745, 765], font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth, false, this.getPowerupString(this.powerupType.tiers[2]),
                colorConfig.powerup
            );
            CanvasUtils.drawText(
                ctx, topFiftyStr, [745, 835], font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth
            );
        } else {
            CanvasUtils.drawText(
                ctx, 'Nobody claimed the powerup!', nums.powSpawnDescriptionPos, font, 'center', colorConfig.font,
                nums.powSpawnDescriptionWidth, true
            );
        }

        CanvasUtils.drawText(
            ctx, 'Reward: %@', nums.powSpawnRewardPos, font, 'center', colorConfig.font,
            nums.powSpawnDescriptionWidth, false, this.powerupType.pluralName, colorConfig.powerup
        );

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${config.stringConfig.imageName}.png` });
    }

    private getPowerupString(num: number) {
        let usePluralName = false;

        if (num > 1 || num === 0) {
            usePluralName = true;
        }

        if (this.powerupType.name === 'Multiplier Boost') {
            return '+' + num + ' ' + this.powerupType.name;
        }

        if (this.powerupType.name === 'Extra Boar Chance') {
            return '+' + num + '% ' + this.powerupType.name;
        }

        if (this.powerupType.name === 'Boar Gift') {
            return '+' + num + ' ' + (usePluralName ? this.powerupType.pluralName : this.powerupType.name);
        }

        if (this.powerupType.name === 'Boar Enhancer') {
            return '+' + num + ' ' + (usePluralName ? this.powerupType.pluralName : this.powerupType.name);
        }
    }
}