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
    ActionRowBuilder,
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

export class PowerupSpawner {
    private readonly intervalVal: number =
        Math.round(BoarBotApp.getBot().getConfig().numberConfig.powInterval * (Math.random() * (1.25 - .75) + .75));
    private readonly initIntervalVal: number = 0;
    private claimers: Map<string, number> = new Map<string, number>();
    private numMsgs: number = 0;

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

            setTimeout(() =>
                this.doSpawn(),
                Math.round(
                    config.numberConfig.powInterval * (Math.random() * (1.25 - .75) + .75)
                )
            );

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
            const prompts = this.getPrompts(randPromptType, config);
            const chosenPrompt = prompts[Math.floor(Math.random() * prompts.length)] as PromptConfig;

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

            for (const channel of allBoarChannels) {
                const collector = await CollectorUtils.createCollector(
                    channel, curTime.toString(), nums, false, nums.powDuration
                );

                const powMsg = await channel.send({
                    content: '**Powerup Prompt: **' + promptTypes[randPromptType].name + ' - ' + chosenPrompt.name,
                    components: rows
                });

                this.numMsgs++;

                collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter, powMsg, config));
                collector.on('end', async () => await this.handleEndCollect(powMsg, config));
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
                const timeToClaim = inter.createdTimestamp - powMsg.createdTimestamp;
                this.claimers.set(inter.user.id, timeToClaim);
                await Replies.handleReply(inter, "Correct! It took you " + timeToClaim + "ms to guess correctly! Wait for the powerup to end to see your placement.");
                LogDebug.sendDebug("Collected " + inter.user.username, config);
            } else if (!this.claimers.has(inter.user.id)) {
                await Replies.handleReply(inter, "Incorrect! Try again!");
                LogDebug.sendDebug("Failed attempt " + inter.user.username, config);
            } else {
                await Replies.handleReply(inter, "You've already attempted this powerup!");
                LogDebug.sendDebug("Already collected " + inter.user.username, config);
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
            const claimers = this.claimers;

            await powMsg.edit({
                components: [new ActionRowBuilder<ButtonBuilder>(config.powerupConfig.rows[1])]
            });

            this.numMsgs--;
            if (this.numMsgs === 0) {
                let fastestClaimer: [string, number] | undefined;

                for (const claimer of claimers) {
                    if (!fastestClaimer || claimer[1] < fastestClaimer[1]) {
                        fastestClaimer = claimer;
                    }
                }

                if (fastestClaimer) {
                    await powMsg.edit({
                        content: 'Fastest user: <@' + fastestClaimer[0] +
                            '> with a time of ' + fastestClaimer[1] + 'ms',
                        components: []
                    });
                } else {
                    await powMsg.edit({
                        content: 'Nobody claimed the powerup!',
                        components: []
                    });
                }

                LogDebug.sendDebug('Finished', config);
                this.claimers = new Map<string, number>();
                return;
            }

            const finishInterval = setInterval(async () => {
                if (this.numMsgs === 0) {
                    let fastestClaimer: [string, number] | undefined;

                    for (const claimer of claimers) {
                        if (!fastestClaimer || claimer[1] > fastestClaimer[1]) {
                            fastestClaimer = claimer;
                        }
                    }

                    if (fastestClaimer) {
                        await powMsg.edit({
                            content: 'Fastest user: <@' + fastestClaimer[0] +
                                '> with a time of ' + fastestClaimer[1] + 'ms',
                            components: []
                        });
                    } else {
                        await powMsg.edit({
                            content: 'Nobody claimed the powerup!',
                            components: []
                        });
                    }

                    clearInterval(finishInterval);
                }
            }, 1000);
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    private getPrompts(promptType: string, config: BotConfig) {
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

        return prompts;
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
        const emoji1 = prompt.emoji1;
        const emoji2 = prompt.emoji2;
        const randCorrectIndex = Math.floor(Math.random() * numButtons);

        let curIndex = 0;

        for (let i=0; i<numRows; i++) {
            const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>();
            for (let j=0; j<Math.min(numButtons, nums.fastCols); j++) {
                let button: ButtonBuilder;

                if (curIndex === randCorrectIndex) {
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
}