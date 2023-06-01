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
    ChannelType, Client, InteractionCollector, Message, StringSelectMenuInteraction,
    TextChannel,
} from 'discord.js';
import {GuildData} from '../data/global/GuildData';
import {CollectorUtils} from '../discord/CollectorUtils';
import {BotConfig} from '../../bot/config/BotConfig';
import {Replies} from '../interactions/Replies';
import {PromptConfig} from '../../bot/config/prompts/PromptConfig';
import {NumberConfig} from '../../bot/config/NumberConfig';
import {RowConfig} from '../../bot/config/components/RowConfig';
import {PowerupImageGenerator} from '../generators/PowerupImageGenerator';
import {BoarUser} from './BoarUser';
import {PromptData} from '../data/userdata/stats/PromptData';
import {PromptTypeConfigs} from '../../bot/config/prompts/PromptTypeConfigs';
import {StringConfig} from '../../bot/config/StringConfig';
import {ItemConfig} from '../../bot/config/items/ItemConfig';
import {ItemConfigs} from '../../bot/config/items/ItemConfigs';
import {PromptConfigs} from '../../bot/config/prompts/PromptConfigs';

export class PowerupSpawner {
    private readonly intervalVal: number =
        Math.round(BoarBotApp.getBot().getConfig().numberConfig.powInterval * (Math.random() * (1.25 - .75) + .75));
    private readonly initIntervalVal: number = 0;
    private claimers: Map<string, number> = new Map<string, number>();
    private powerupType: ItemConfig = {} as ItemConfig;
    private promptTypeID: string = '';
    private promptID: string = '';
    private topOnePercent: number = -1;
    private topTenPercent: number = -1;
    private topFiftyPercent: number = -1;
    private powEndImage: AttachmentBuilder = {} as AttachmentBuilder;
    private interactions: ButtonInteraction[] = [];
    private numMsgs: number = 0;
    private numNotFinished: number = 0;
    private readyToEnd: boolean = false;

    constructor(initPowTime?: number) {
        this.initIntervalVal = initPowTime !== undefined ? Math.max(initPowTime - Date.now(), 5000) : this.intervalVal;
    }

    /**
     * Sets a timeout for when the next powerup should spawn
     */
    public startSpawning() {
        setTimeout(() => this.doSpawn(), this.initIntervalVal);
    }

    /**
     * Spawns the powerup
     *
     * @private
     */
    private async doSpawn() {
        try {
            const config: BotConfig = BoarBotApp.getBot().getConfig();
            const nums: NumberConfig = config.numberConfig;
            const allBoarChannels: TextChannel[] = [];

            LogDebug.sendDebug('Spawning powerup', config);

            setTimeout(() => this.doSpawn(),
                Math.round(config.numberConfig.powInterval * (Math.random() * (1.25 - .75) + .75))
            );

            await Queue.addQueue(() => {
                const globalData = DataHandlers.getGlobalData();
                globalData.nextPowerup = Date.now() + this.intervalVal;
                fs.writeFileSync(config.pathConfig.globalDataFile, JSON.stringify(globalData));
            }, 'pow' + 'global');

            // Get all channels to send powerups in
            for (const guildFile of fs.readdirSync(config.pathConfig.guildDataFolder)) {
                const guildData: GuildData | undefined = await DataHandlers.getGuildData(guildFile.split('.')[0]);
                if (!guildData) continue;

                const client: Client = BoarBotApp.getBot().getClient();
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

            const curTime: number = Date.now();

            const promptConfig: PromptConfigs = config.promptConfigs;
            const promptTypes: PromptTypeConfigs = promptConfig.types;
            this.promptTypeID = Object.keys(promptTypes)[Math.floor(
                Math.random() * Object.keys(promptTypes).length
            )];
            this.promptID = this.getRandPromptID(this.promptTypeID, config);
            const chosenPrompt: PromptConfig = promptTypes[this.promptTypeID][this.promptID] as PromptConfig;

            this.powerupType = this.getRandPowerup(config);

            const rightStyle: number = promptTypes[this.promptTypeID].rightStyle;
            const wrongStyle: number = promptTypes[this.promptTypeID].wrongStyle;

            const rowsConfig: RowConfig[] = promptConfig.rows;
            let rows: ActionRowBuilder<ButtonBuilder>[] = [];

            switch (this.promptTypeID) {
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

            const powerupSpawnImage: AttachmentBuilder = await PowerupImageGenerator.makePowerupSpawnImage(
                this.powerupType, promptTypes[this.promptTypeID], chosenPrompt, config
            );

            // Sends powerup message to all boar channels
            for (const channel of allBoarChannels) {
                try {
                    // if (config.maintenanceMode && channel.guild.id !== '1042593392921677975') continue;

                    const collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
                        await CollectorUtils.createCollector(channel, curTime.toString(),
                            nums, false, nums.powDuration
                        );

                    const powMsg: Message = await channel.send({
                        files: [powerupSpawnImage],
                        components: rows
                    }).catch((err) => { throw err; });

                    this.numMsgs++;

                    collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter, powMsg, config));
                    collector.on('end', async () => await this.handleEndCollect(powMsg, config));
                } catch {}
            }
        } catch (err: unknown) {
            await LogDebug.handleError((err as Error).stack);
        }
    }

    /**
     * Handles collecting and users  interacting with the powerup. Also
     * responds depending on correctness and attempt status
     *
     * @param inter - The interaction made by the user
     * @param powMsg - Used to get accurate timing of interaction speed
     * @param config - Used to get config info
     * @private
     */
    private async handleCollect(inter: ButtonInteraction, powMsg: Message, config: BotConfig) {
        try {
            await inter.deferUpdate();

            if (!this.claimers.has(inter.user.id) && inter.customId.toLowerCase().includes('correct')) {
                let correctString: string = config.stringConfig.powRightFull;
                const timeToClaim: number = inter.createdTimestamp - powMsg.createdTimestamp;

                this.claimers.set(inter.user.id, timeToClaim);
                this.interactions.push(inter);

                // Modify the 2nd modifiable value
                let occur: number = 0;
                correctString = correctString.replace(/%@/g, match => ++occur === 2 ? timeToClaim.toString() : match);

                await Replies.handleReply(inter, correctString, config.colorConfig.font,
                    config.stringConfig.powRight, config.colorConfig.green
                );
                LogDebug.sendDebug('Collected: ' + inter.user.username + ' (' + inter.user.id + ')', config);
            } else if (!this.claimers.has(inter.user.id)) {
                await Replies.handleReply(inter, config.stringConfig.powWrongFull, config.colorConfig.font,
                    config.stringConfig.powWrong, config.colorConfig.error
                );
                LogDebug.sendDebug('Failed attempt: ' + inter.user.username + ' (' + inter.user.id + ')', config);
            } else {
                await Replies.handleReply(inter, config.stringConfig.powAttempted, config.colorConfig.error);
                LogDebug.sendDebug('Already collected: ' + inter.user.username + ' (' + inter.user.id + ')', config);
            }
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    /**
     * Handles when the powerup ends, editing the message and
     * replying to all user interactions.
     *
     * @param powMsg - The powerup message to edit
     * @param config - Used to get config info
     * @private
     */
    private async handleEndCollect(
        powMsg: Message,
        config: BotConfig
    ) {
        try {
            this.numNotFinished++;

            await powMsg.edit({
                components: [new ActionRowBuilder<ButtonBuilder>(config.promptConfigs.rows[1])]
            }).catch((err) => { throw err; });

            // Gets percentages once all powerup messages are waiting for tabulation
            if (--this.numMsgs === 0) {
                this.claimers = new Map([...this.claimers.entries()].sort((a, b) => a[1] - b[1]));

                const values: number[] = [...this.claimers.values()];
                const topOneIndex: number = Math.floor(this.claimers.size * .01);
                let topTenIndex: number = Math.floor(this.claimers.size * .1);
                let topFiftyIndex: number = Math.floor(this.claimers.size * .5);

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

                this.powEndImage = await PowerupImageGenerator.makePowerupEndImage(
                    this.topOnePercent, this.topTenPercent, this.topFiftyPercent, this.powerupType, config
                );

                await this.finishPow(powMsg, config);

                this.readyToEnd = true;
                return;
            }

            // Waits until percentages have been calculated to finish (after last message has tabulated)
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

    /**
     * Gets a random prompt ID
     *
     * @param promptType - Used to get a prompt within the prompt type
     * @param config - Used for config info
     * @private
     */
    private getRandPromptID(promptType: string, config: BotConfig): string {
        const promptTypes: PromptTypeConfigs = config.promptConfigs.types;
        const prompts: string[] = [];

        for (const promptTypeProperty of Object.keys(promptTypes[promptType])) {
            if (
                typeof promptTypes[promptType][promptTypeProperty] === 'string' ||
                typeof promptTypes[promptType][promptTypeProperty] === 'number'
            ) {
                continue;
            }

            prompts.push(promptTypeProperty);
        }

        return prompts[Math.floor(Math.random() * prompts.length)];
    }

    /**
     * Gets a random powerup
     *
     * @param config - Used to get all powerup types
     * @private
     */
    private getRandPowerup(config: BotConfig): ItemConfig {
        const powerups = config.itemConfigs.powerups;
        const powerupIDs = Object.keys(powerups);

        return powerups[powerupIDs[Math.floor(Math.random() * powerupIDs.length)]] as ItemConfig;
    }

    /**
     * Creates a 4x4 button array of emojis with one being different
     *
     * @param prompt - Used to get which emojis to place
     * @param rightStyle - The style of button for right emoji
     * @param wrongStyle - The style of button for wrong emoji
     * @param rowsConfig - The buttons and their IDs
     * @param id - ID to place at the end of each button (timestamp of message)
     * @param nums - Used to get number configurations
     * @private
     */
    private makeEmojiRows(
        prompt: PromptConfig,
        rightStyle: number,
        wrongStyle: number,
        rowsConfig: RowConfig[],
        id: number,
        nums: NumberConfig
    ): ActionRowBuilder<ButtonBuilder>[] {
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];

        const randEmojiIndex: number = Math.floor(Math.random() * nums.emojiRows * nums.emojiCols);

        const emoji1: string = prompt.emoji1;
        const emoji2: string = prompt.emoji2;

        let curIndex: number = 0;

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

    /**
     * Makes a 2x2 button array of possible answer choices to a trivia question
     *
     * @param prompt - Used to get choices
     * @param rightStyle - The style of button for right answer
     * @param wrongStyle - The style of button for wrong answer
     * @param rowsConfig - The buttons and their IDs
     * @param id - ID to place at the end of each button (timestamp of message)
     * @param nums - Used to get number configurations
     * @private
     */
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
                const randChoice: string = choices[Math.floor(Math.random() * choices.length)];
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

    /**
     * Makes a predetermined array of green and red buttons
     *
     * @param prompt - Used to get the number of buttons
     * @param rightStyle - The style of button for right answer
     * @param wrongStyle - The style of button for wrong answer
     * @param rowsConfig - The buttons and their IDs
     * @param id - ID to place at the end of each button (timestamp of message)
     * @param nums - Used to get number configurations
     * @private
     */
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

    /**
     * Handles when the powerup ends. Edits the spawn message and updates all user info
     *
     * @param powMsg - The message to update
     * @param config - Used to get config info
     * @private
     */
    private async finishPow(powMsg: Message, config: BotConfig) {
        const powItemConfigs: ItemConfigs = config.itemConfigs.powerups;
        const strConfig: StringConfig = config.stringConfig;

        try {
            await powMsg.edit({
                files: [this.powEndImage],
                components: []
            });
        } catch {}

        // Updates and restores information to what it should be once the final message is done processing
        if (--this.numNotFinished === 0) {
            for (const interaction of this.interactions) {
                const userTime: number | undefined = this.claimers.get(interaction.user.id);
                const userPercent: number = (
                    ([...this.claimers.keys()].indexOf(interaction.user.id) + 1) /
                    this.claimers.size
                ) * 100;
                let userPowTier: number = -1;
                let responseString: string = strConfig.powNoRewardResponse;

                if (!userTime) {
                    await LogDebug.handleError('Failed to find user\'s powerup data.', interaction);
                    continue;
                }

                if (userTime <= this.topOnePercent) {
                    userPowTier = 0;
                    responseString = strConfig.powTopOneResponse;
                } else if (userTime <= this.topTenPercent) {
                    userPowTier = 1;
                    responseString = strConfig.powTopTenResponse;
                } else if (userTime <= this.topFiftyPercent) {
                    userPowTier = 2;
                    responseString = strConfig.powTopFiftyResponse;

                }

                if ((this.powerupType.tiers as number[])[userPowTier] === 0) {
                    responseString = strConfig.powNoRewardResponse;
                }

                await Replies.handleReply(
                    interaction,
                    responseString.replace('%@', userTime.toString()), config.colorConfig.font,
                    PowerupImageGenerator.getPowerupString(
                        this.powerupType, (this.powerupType.tiers as number[])[userPowTier], config
                    ),
                    config.colorConfig.powerup
                );

                Queue.addQueue(async () => {
                    try {
                        const boarUser: BoarUser = new BoarUser(interaction.user, true);

                        if (!boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID]) {
                            boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID] = new PromptData();
                        }

                        boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID].avg =
                            (boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID].avg *
                                boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID].attempts++ +
                                userPercent
                            ) / boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID].attempts;

                        boarUser.stats.powerups.attempts++;

                        if (userPowTier === 0) {
                            boarUser.stats.powerups.oneAttempts++;
                        } else if (userPowTier === 1) {
                            boarUser.stats.powerups.tenAttempts++;
                        } else if (userPowTier === 2) {
                            boarUser.stats.powerups.fiftyAttempts++;
                        }

                        if (userPowTier !== -1 && this.powerupType.name === powItemConfigs.multiBoost.name) {
                            boarUser.itemCollection.powerups.multiBoost.numTotal +=
                                (this.powerupType.tiers as number[])[userPowTier];
                            boarUser.itemCollection.powerups.multiBoost.numClaimed++;
                            boarUser.itemCollection.powerups.multiBoost.highestTotal = Math.max(
                                boarUser.itemCollection.powerups.multiBoost.highestTotal,
                                boarUser.itemCollection.powerups.multiBoost.numTotal
                            );
                        }

                        if (userPowTier !== -1 && this.powerupType.name === powItemConfigs.extraChance.name) {
                            boarUser.itemCollection.powerups.extraChance.numTotal +=
                                (this.powerupType.tiers as number[])[userPowTier];
                            boarUser.itemCollection.powerups.extraChance.numClaimed++;
                            boarUser.itemCollection.powerups.extraChance.highestTotal = Math.max(
                                boarUser.itemCollection.powerups.extraChance.highestTotal,
                                boarUser.itemCollection.powerups.extraChance.numTotal
                            );
                        }

                        if (userPowTier !== -1 && this.powerupType.name === powItemConfigs.gift.name) {
                            boarUser.itemCollection.powerups.gift.numTotal +=
                                (this.powerupType.tiers as number[])[userPowTier];
                            boarUser.itemCollection.powerups.gift.numClaimed++;
                            boarUser.itemCollection.powerups.gift.highestTotal = Math.max(
                                boarUser.itemCollection.powerups.gift.highestTotal,
                                boarUser.itemCollection.powerups.gift.numTotal
                            );
                        }

                        if (userPowTier !== -1 && this.powerupType.name === powItemConfigs.enhancer.name) {
                            boarUser.itemCollection.powerups.enhancer.numTotal +=
                                (this.powerupType.tiers as number[])[userPowTier];
                            boarUser.itemCollection.powerups.enhancer.numClaimed++;
                            boarUser.itemCollection.powerups.enhancer.highestTotal = Math.max(
                                boarUser.itemCollection.powerups.enhancer.highestTotal,
                                boarUser.itemCollection.powerups.enhancer.numTotal
                            );
                        }

                        boarUser.updateUserData();
                        await Queue.addQueue(() =>
                            DataHandlers.updateLeaderboardData(boarUser), interaction.id + 'global'
                        );
                    } catch (err: unknown) {
                        LogDebug.handleError(err, interaction);
                    }
                }, interaction.id + interaction.user.id);
            }

            this.claimers = new Map<string, number>();
            this.interactions = [];
            this.topOnePercent = -1;
            this.topTenPercent = -1;
            this.topFiftyPercent = -1;
            this.powerupType = {} as ItemConfig;
            this.readyToEnd = false;

            LogDebug.sendDebug('Finished', config);
        }
    }
}