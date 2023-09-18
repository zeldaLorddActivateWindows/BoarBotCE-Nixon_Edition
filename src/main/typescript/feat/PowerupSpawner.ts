/**
 * {@link PowerupSpawner PowerupSpawner.ts}
 *
 * Handles sending powerups and collecting user interactions
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
import {LogDebug} from '../util/logging/LogDebug';
import {BoarBotApp} from '../BoarBotApp';
import {Queue} from '../util/interactions/Queue';
import {DataHandlers} from '../util/data/DataHandlers';
import fs from 'fs';
import {
    ActionRowBuilder, AttachmentBuilder,
    ButtonBuilder, ButtonInteraction, Channel,
    Client, InteractionCollector, Message, StringSelectMenuInteraction,
    TextChannel,
} from 'discord.js';
import {CollectorUtils} from '../util/discord/CollectorUtils';
import {BotConfig} from '../bot/config/BotConfig';
import {Replies} from '../util/interactions/Replies';
import {PromptConfig} from '../bot/config/prompts/PromptConfig';
import {NumberConfig} from '../bot/config/NumberConfig';
import {RowConfig} from '../bot/config/commands/RowConfig';
import {PowerupImageGenerator} from '../util/generators/PowerupImageGenerator';
import {BoarUser} from '../util/boar/BoarUser';
import {PromptData} from '../bot/data/user/stats/PromptData';
import {PromptTypeConfigs} from '../bot/config/prompts/PromptTypeConfigs';
import {StringConfig} from '../bot/config/StringConfig';
import {ItemConfig} from '../bot/config/items/ItemConfig';
import {PromptConfigs} from '../bot/config/prompts/PromptConfigs';
import {InteractionUtils} from '../util/interactions/InteractionUtils';
import {ColorConfig} from '../bot/config/ColorConfig';
import {PowerupData} from '../bot/data/global/PowerupData';
import {GuildData} from '../bot/data/global/GuildData';
import {QuestData} from '../bot/data/global/QuestData';

export class PowerupSpawner {
    private readonly initIntervalVal: number = 0;
    private claimers: Map<string, number> = new Map<string, number>();
    private failers: Map<string, number> = new Map<string, number>();
    private powerupType: ItemConfig = {} as ItemConfig;
    private powerupTypeID = '';
    private promptTypeID = '';
    private promptID = '';
    private powEndImage: AttachmentBuilder = {} as AttachmentBuilder;
    private interactions: ButtonInteraction[] = [];
    private numMsgs = 0;
    private numNotFinished = 0;
    private msgsToDelete: Message[] = [];
    private failedServers: Record<string, number> = {};
    private readyToEnd = false;

    constructor(initPowTime?: number) {
        this.initIntervalVal = initPowTime !== undefined
            ? Math.max(initPowTime - Date.now(), 5000)
            : Math.round(
                BoarBotApp.getBot().getConfig().numberConfig.powInterval * (Math.random() * (1.01 - .99) + .99)
            );
    }

    /**
     * Sets a timeout for when the next powerup should spawn
     */
    public async startSpawning(): Promise<void> {
        const powerupData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Powerups);

        Object.keys((powerupData as PowerupData).messagesInfo).forEach(async channelID => {
            try {
                const channel = await BoarBotApp.getBot().getClient().channels.fetch(channelID) as TextChannel;
                (powerupData as PowerupData).messagesInfo[channelID].forEach(async msgID => {
                    try {
                        this.msgsToDelete.push(await channel.messages.fetch(msgID));
                    } catch {}
                });
            } catch {}
        });

        setTimeout(() => this.removeMsgs(), this.initIntervalVal);
        setTimeout(() => this.doSpawn(), this.initIntervalVal);
    }

    /**
     * Removes all messages to delete
     */
    public async removeMsgs(): Promise<void> {
        const arrCopy = [...this.msgsToDelete];
        this.msgsToDelete = [];

        await Queue.addQueue(async () => {
            try {
                const powerupData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Powerups) as PowerupData;
                (powerupData as PowerupData).messagesInfo = {};
                DataHandlers.saveGlobalData(powerupData, DataHandlers.GlobalFile.Powerups);
            } catch (err: unknown) {
                await LogDebug.handleError(err);
            }
        }, 'powDelMsgs' + 'global').catch((err) => { throw err });

        arrCopy.forEach(async (msg, index) => {
            LogDebug.log('Deleting message ' + (index + 1) + '/' + arrCopy.length, BoarBotApp.getBot().getConfig());
            await msg.delete().catch((err) => LogDebug.handleError(err));
        });
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

            let newInterval = Math.round(config.numberConfig.powInterval * (Math.random() * (1.01 - .99) + .99));
            if (config.maintenanceMode) {
                newInterval = 30000;
            }

            setTimeout(() => this.removeMsgs(), newInterval);
            setTimeout(() => this.doSpawn(), newInterval);

            await Queue.addQueue(async () => {
                try {
                    const powerupData = DataHandlers.getGlobalData(
                        DataHandlers.GlobalFile.Powerups
                    ) as PowerupData;
                    powerupData.nextPowerup = Date.now() + newInterval;
                    DataHandlers.saveGlobalData(powerupData, DataHandlers.GlobalFile.Powerups);
                } catch (err: unknown) {
                    await LogDebug.handleError(err);
                }
            }, 'powUpdateTimer' + 'global').catch((err) => { throw err });

            if (config.maintenanceMode) return;

            const guildDataFolder = config.pathConfig.databaseFolder + config.pathConfig.guildDataFolder;

            // Get all channels to send powerups in
            for (const guildFile of fs.readdirSync(guildDataFolder)) {
                const guildID = guildFile.split('.')[0];
                const guildData: GuildData | undefined = await DataHandlers.getGuildData(guildID);
                if (!guildData) continue;

                const client: Client = BoarBotApp.getBot().getClient();

                try {
                    await client.guilds.fetch(guildFile.split('.')[0]);
                    if (this.failedServers[guildID] !== undefined) {
                        delete this.failedServers[guildID];
                    }
                } catch {
                    if (this.failedServers[guildID] === undefined) {
                        this.failedServers[guildID] = 0;
                    }

                    this.failedServers[guildID]++;

                    if (this.failedServers[guildID] && this.failedServers[guildID] >= 3) {
                        try {
                            fs.rmSync(guildDataFolder + guildFile);
                            delete this.failedServers[guildID];
                        } catch {}
                    }

                    continue;
                }

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

            this.powerupTypeID = this.getRandPowerup(config);
            this.powerupType = config.itemConfigs.powerups[this.powerupTypeID];

            LogDebug.log(
                `Powerup Event spawning for ${this.powerupType.pluralName}, Prompt: ${chosenPrompt.name}`, config
            );

            const rightStyle: number = promptTypes[this.promptTypeID].rightStyle;
            const wrongStyle: number = promptTypes[this.promptTypeID].wrongStyle;

            const rowsConfig: RowConfig[] = promptConfig.rows;
            let rows: ActionRowBuilder<ButtonBuilder>[] = [];

            const powerupSpawnImage: AttachmentBuilder = await PowerupImageGenerator.makePowerupSpawnImage(
                this.powerupTypeID, promptTypes[this.promptTypeID], chosenPrompt, config
            );

            // Sends powerup message to all boar channels
            allBoarChannels.forEach(async channel => {
                try {
                    const collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
                        await CollectorUtils.createCollector(channel, curTime.toString(),
                            nums, false, nums.powDuration
                        );

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
                        case 'time':
                            rows = this.makeClockRows(
                                chosenPrompt, rightStyle, wrongStyle, rowsConfig, curTime, nums, config
                            );
                            break;
                    }

                    const powMsg: {msg: Message} = { msg: {} as Message };

                    collector.on('collect', async (inter: ButtonInteraction) =>
                        await this.handleCollect(inter, powMsg.msg, config)
                    );
                    collector.on('end', async (collected, reason) =>
                        await this.handleEndCollect(reason, powMsg.msg, config)
                    );

                    try {
                        powMsg.msg = await channel.send({
                            files: [powerupSpawnImage],
                            components: rows
                        });
                    } catch (err: unknown) {
                        collector.stop(CollectorUtils.Reasons.Error);
                        return;
                    }

                    this.numMsgs++;
                    this.numNotFinished++;

                    this.msgsToDelete.push(powMsg.msg);
                    await Queue.addQueue(async () => {
                        try {
                            const powerupData =
                                DataHandlers.getGlobalData(DataHandlers.GlobalFile.Powerups) as PowerupData;

                            if (!(powerupData as PowerupData).messagesInfo[channel.id]) {
                                (powerupData as PowerupData).messagesInfo[channel.id] = [];
                            }
                            (powerupData as PowerupData).messagesInfo[channel.id].push(powMsg.msg.id);

                            DataHandlers.saveGlobalData(powerupData, DataHandlers.GlobalFile.Powerups);
                        } catch (err: unknown) {
                            await LogDebug.handleError(err);
                        }
                    }, 'powAddMsg' + 'global').catch((err) => { throw err });
                } catch {}
            });
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

            const hasClaimed = this.claimers.has(inter.user.id);
            const fullyFailed = this.failers.has(inter.user.id)
                ? (this.failers.get(inter.user.id) as number) > 1
                : false;

            if (!hasClaimed && !fullyFailed &&inter.customId.toLowerCase().includes('correct')) {
                const isBanned = await InteractionUtils.handleBanned(inter, config, true);
                if (isBanned) return;

                LogDebug.log(
                    `${inter.user.username} (${inter.user.id}) guessed CORRECT in Powerup Event`, config
                );

                const correctString: string = config.stringConfig.powRightFull;
                const rewardString: string = this.powerupType.rewardAmt + ' ' +
                    (this.powerupType.rewardAmt as number > 1
                        ? this.powerupType.pluralName
                        : this.powerupType.name);
                const timeToClaim: number = inter.createdTimestamp - powMsg.createdTimestamp;

                this.claimers.set(inter.user.id, timeToClaim);
                this.interactions.push(inter);

                await Replies.handleReply(
                    inter, correctString, config.colorConfig.font,
                    [config.stringConfig.powRight, timeToClaim.toLocaleString() + 'ms', rewardString],
                    [config.colorConfig.green, config.colorConfig.silver, config.colorConfig.powerup], true
                );
            } else if (!hasClaimed && !fullyFailed) {
                LogDebug.log(
                    `${inter.user.username} (${inter.user.id}) guessed INCORRECT in Powerup Event`, config
                );

                if (this.failers.has(inter.user.id)) {
                    this.failers.set(inter.user.id, 2);

                    await Queue.addQueue(async () => {
                        const questData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Quest) as QuestData;
                        const powFailIndex = questData.curQuestIDs.indexOf('powFail');
                        const boarUser = new BoarUser(inter.user, true);

                        boarUser.stats.quests.progress[powFailIndex]++;
                        boarUser.updateUserData();
                    }, inter.id + inter.user.id).catch((err) => { throw err });

                    await Replies.handleReply(
                        inter, config.stringConfig.powWrongSecond, config.colorConfig.font,
                        [config.stringConfig.powWrong], [config.colorConfig.error], true
                    );
                } else {
                    this.failers.set(inter.user.id, 1);

                    await Replies.handleReply(
                        inter, config.stringConfig.powWrongFirst, config.colorConfig.font,
                        [config.stringConfig.powWrong], [config.colorConfig.error], true
                    );
                }
            } else if (fullyFailed) {
                await Replies.handleReply(
                    inter, config.stringConfig.powNoMore, config.colorConfig.error, undefined, undefined, true
                );
            } else {
                await Replies.handleReply(
                    inter, config.stringConfig.eventParticipated, config.colorConfig.error, undefined, undefined, true
                );
            }
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    /**
     * Handles when the powerup ends, editing the message and
     * replying to all user interactions.
     *
     * @param reason - Reason for ending collection
     * @param powMsg - The powerup message to edit
     * @param config - Used to get config info
     * @private
     */
    private async handleEndCollect(
        reason: string,
        powMsg: Message,
        config: BotConfig
    ) {
        try {
            if (reason === CollectorUtils.Reasons.Error) {
                return;
            }

            try {
                await powMsg.edit({
                    components: [new ActionRowBuilder<ButtonBuilder>(config.promptConfigs.rows[1])]
                });
            } catch {}

            // Gets percentages once all powerup messages are waiting for tabulation
            if (--this.numMsgs === 0) {
                this.claimers = new Map([...this.claimers.entries()].sort((a, b) => a[1] - b[1]));

                let topClaimer: [string, number] | undefined;
                let avgTime: number | undefined;

                if (this.claimers.size > 0) {
                    topClaimer = [...this.claimers][0];
                    avgTime = Math.round(
                        [...this.claimers.values()].reduce((sum, val) => sum + val, 0) / this.claimers.size
                    );
                }

                this.powEndImage = await PowerupImageGenerator.makePowerupEndImage(
                    this.powerupTypeID, topClaimer, avgTime, this.claimers.size,
                    this.promptID, this.promptTypeID, config
                );

                await this.finishPow(powMsg, config);

                this.readyToEnd = true;
                return;
            }


            // Waits until percentages have been calculated to finish (after last message has tabulated)
            const finishInterval = setInterval(async () => {
                if (this.readyToEnd) {
                    clearInterval(finishInterval);
                    await this.finishPow(powMsg, config);
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
     * Gets a random powerup by ID
     *
     * @param config - Used to get all powerup types
     * @private
     */
    private getRandPowerup(config: BotConfig): string {
        const powerups = config.itemConfigs.powerups;
        const powerupIDs = Object.keys(powerups);

        let powerupID = powerupIDs[Math.floor(Math.random() * powerupIDs.length)];
        while (powerupID === 'enhancer') {
            powerupID = powerupIDs[Math.floor(Math.random() * powerupIDs.length)];
        }
        return powerupID;
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

    private makeClockRows(
        prompt: PromptConfig,
        rightStyle: number,
        wrongStyle: number,
        rowsConfig: RowConfig[],
        id: number,
        nums: NumberConfig,
        config: BotConfig
    ) {
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];

        const clocks = [];
        const rightClock = prompt.rightClock;

        for (const clockPrompt of Object.values(config.promptConfigs.types.time)) {
            if (typeof clockPrompt === 'string' || typeof clockPrompt === 'number') continue;
            clocks.push(clockPrompt.rightClock);
        }

        let curIndex = 0;

        for (let i=0; i<nums.emojiRows; i++) {
            const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>();
            for (let j=0; j<nums.emojiCols; j++) {
                const randChoice: string = clocks[Math.floor(Math.random() * clocks.length)];
                let button: ButtonBuilder;

                if (randChoice === rightClock) {
                    button = new ButtonBuilder(rowsConfig[0].components[0]);
                    button.setEmoji(randChoice).setStyle(rightStyle).setCustomId(
                        rowsConfig[0].components[0].customId + '|' + id
                    );
                } else {
                    button = new ButtonBuilder(rowsConfig[0].components[1]);
                    button.setEmoji(randChoice).setStyle(wrongStyle).setCustomId(
                        rowsConfig[0].components[1].customId + curIndex + '|' + id
                    );
                }

                clocks.splice(clocks.indexOf(randChoice), 1);
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
        try {
            try {
                await powMsg.edit({
                    files: [this.powEndImage],
                    components: []
                });
            } catch {}

            // Updates and restores information to what it should be once the final message is done processing
            if (--this.numNotFinished === 0) {
                LogDebug.log('Attempting to conclude Powerup Event', config);

                const topUserID: string | undefined = this.claimers.size > 0
                    ? [...this.claimers][0][0]
                    : undefined;

                this.interactions.forEach(async interaction => {
                    const strConfig: StringConfig = config.stringConfig;
                    const colorConfig: ColorConfig = config.colorConfig;

                    const userTime: number | undefined = this.claimers.get(interaction.user.id);
                    const userPercent: number = (
                        ([...this.claimers.keys()].indexOf(interaction.user.id) + 1) /
                        this.claimers.size
                    ) * 100;

                    if (!userTime) {
                        await LogDebug.handleError('Failed to find user\'s powerup data.', interaction);
                        return;
                    }

                    await Queue.addQueue(async () => {
                        try {
                            const questConfig = config.questConfigs;
                            const questData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Quest) as QuestData;
                            const powFirstIndex = questData.curQuestIDs.indexOf('powFirst');

                            const boarUser: BoarUser = new BoarUser(interaction.user, true);

                            if (
                                powFirstIndex >= 0 &&
                                userTime <= questConfig['powFirst'].questVals[Math.floor(powFirstIndex / 2)][0]
                            ) {
                                boarUser.stats.quests.progress[powFirstIndex]++;
                            }

                            if (boarUser.stats.general.firstDaily === 0) {
                                boarUser.stats.general.firstDaily = Date.now();
                            }

                            if (boarUser.user.id === topUserID) {
                                boarUser.stats.powerups.oneAttempts++;
                            }

                            if (
                                !boarUser.stats.powerups.fastestTime || userTime < boarUser.stats.powerups.fastestTime
                            ) {
                                boarUser.stats.powerups.fastestTime = userTime;
                            }

                            if (!boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID]) {
                                boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID] = new PromptData();
                            }

                            boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID].avg =
                                (boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID].avg *
                                    boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID].attempts++ +
                                    userPercent
                                ) / boarUser.stats.powerups.prompts[this.promptTypeID][this.promptID].attempts;

                            boarUser.stats.powerups.attempts++;

                            boarUser.itemCollection.powerups[this.powerupTypeID].numTotal +=
                                this.powerupType.rewardAmt as number;

                            boarUser.updateUserData();

                            const rewardString: string = this.powerupType.rewardAmt + ' ' +
                                (this.powerupType.rewardAmt as number > 1
                                    ? this.powerupType.pluralName
                                    : this.powerupType.name);

                            if (boarUser.stats.powerups.attempts > config.numberConfig.powExperiencedNum) {
                                await Replies.handleReply(
                                    interaction, strConfig.powResponseShort, config.colorConfig.font,
                                    [rewardString, 'Powerup Event'], [colorConfig.powerup, colorConfig.powerup], true
                                ).catch(() => {});
                            } else {
                                await Replies.handleReply(
                                    interaction, strConfig.powResponse, config.colorConfig.font,
                                    [
                                        rewardString, 'Powerup Event', '/boar collection',
                                        'Powerups', '/boar help', 'Powerups'
                                    ],
                                    [
                                        colorConfig.powerup, colorConfig.powerup, colorConfig.silver,
                                        colorConfig.powerup, colorConfig.silver, colorConfig.powerup
                                    ], true
                                ).catch(() => {});
                            }

                            await Queue.addQueue(
                                async () => DataHandlers.updateLeaderboardData(boarUser, config, interaction),
                                interaction.id + 'global'
                            ).catch((err) => { throw err });
                        } catch (err: unknown) {
                            await LogDebug.handleError(err, interaction);
                        }
                    }, interaction.id + interaction.user.id).catch((err) => { throw err });
                });

                this.claimers = new Map<string, number>();
                this.failers = new Map<string, number>();
                this.interactions = [];
                this.readyToEnd = false;

                LogDebug.log('Powerup Event finished.', config);
            }
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }
}