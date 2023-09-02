import {
    ActionRowBuilder, ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction,
    InteractionCollector,
    MessageComponentInteraction, StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel
} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {BotConfig} from '../../bot/config/BotConfig';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {GuildData} from '../../util/data/global/GuildData';
import {BoarUser} from '../../util/boar/BoarUser';
import {QuestsImageGenerator} from '../../util/generators/QuestsImageGenerator';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {RowConfig} from '../../bot/config/components/RowConfig';
import {LogDebug} from '../../util/logging/LogDebug';
import {Replies} from '../../util/interactions/Replies';
import {ComponentUtils} from '../../util/discord/ComponentUtils';
import {DataHandlers} from '../../util/data/DataHandlers';
import {QuestData} from '../../util/data/global/QuestData';
import {Queue} from '../../util/interactions/Queue';

/**
 * {@link QuestsSubcommand QuestsSubcommand.ts}
 *
 * Allows a user to view their weekly boar quests
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class QuestsSubcommand implements Subcommand {
    private config: BotConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo: SubcommandConfig = this.config.commandConfigs.boar.quests;
    private guildData: GuildData | undefined;
    private firstInter: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private compInter: MessageComponentInteraction = {} as MessageComponentInteraction;
    private boarUser: BoarUser = {} as BoarUser;
    private baseRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
    private hasStopped = false;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.guildData = await InteractionUtils.handleStart(interaction, this.config);
        if (!this.guildData) return;

        await interaction.deferReply({ ephemeral: true });
        this.firstInter = interaction;

        if (CollectorUtils.questsCollectors[interaction.user.id]) {
            const oldCollector = CollectorUtils.questsCollectors[interaction.user.id];
            setTimeout(() => { oldCollector.stop(CollectorUtils.Reasons.Expired) }, 1000);
        }

        this.collector = CollectorUtils.questsCollectors[interaction.user.id] = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        this.collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter));
        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(reason));

        this.boarUser = new BoarUser(interaction.user);

        this.showQuests(true);
    }

    public async handleCollect(inter: ButtonInteraction) {
        try {
            this.compInter = inter;

            const questsRowConfig: RowConfig[][] = this.config.commandConfigs.boar.quests.componentFields;
            const questsComponents = {
                claim: questsRowConfig[0][0].components[0]
            };

            await inter.deferUpdate();

            const shouldClaimFull =
                (this.baseRows[0].components[0] as ButtonBuilder).data.label === 'Claim Full Completion Bonus';
            const claimAmts: Record<string, number> = {};
            let itemsNotFit = false;

            if (inter.customId.split('|')[0] === questsComponents.claim.customId && shouldClaimFull) {
                const nums = this.config.numberConfig;

                await Queue.addQueue(async () => {
                    this.boarUser.refreshUserData();
                    const roomLeft = nums.maxEnhancers - this.boarUser.itemCollection.powerups.enhancer.numTotal;
                    const rewardLeft = nums.questFullAmt -
                        this.boarUser.stats.quests.claimed[this.boarUser.stats.quests.claimed.length-1];
                    const amtToAdd = Math.min(roomLeft, rewardLeft);

                    this.boarUser.itemCollection.powerups.enhancer.numTotal += amtToAdd;
                    this.boarUser.stats.quests.claimed[this.boarUser.stats.quests.claimed.length-1] += amtToAdd;

                    if (amtToAdd > 0) {
                        claimAmts.enhancer = amtToAdd;
                    }

                    const numFullClaimed =
                        this.boarUser.stats.quests.claimed[this.boarUser.stats.quests.claimed.length-1];
                    if (numFullClaimed < nums.questFullAmt) {
                        itemsNotFit = true;
                    }

                    this.boarUser.updateUserData();
                }, inter.id + inter.user.id);
            } else if (inter.customId.split('|')[0] === questsComponents.claim.customId) {
                const questConfigs = this.config.questConfigs;
                const nums = this.config.numberConfig;
                const questData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Quest) as QuestData;

                let index = 0;
                for (const id of questData.curQuestIDs) {
                    const questConfig = questConfigs[id];
                    const valIndex = Math.floor(index / 2);

                    await Queue.addQueue(async () => {
                        this.boarUser.refreshUserData();

                        const numToComplete = questConfig.valType === 'number'
                            ? questConfig.questVals[valIndex][0]
                            : 1;
                        const questProgress = this.boarUser.stats.quests
                            ? this.boarUser.stats.quests.progress[index]
                            : 0;
                        const questRewardLeft = this.boarUser.stats.quests
                            ? questConfig.questVals[valIndex][1] - this.boarUser.stats.quests.claimed[index]
                            : questConfig.questVals[valIndex][1];
                        const rewardType = valIndex < 2
                            ? questConfig.lowerReward
                            : questConfig.higherReward;

                        if (questProgress >= numToComplete && questRewardLeft > 0) {
                            let roomLeft = nums.maxScore;

                            switch (rewardType) {
                                case 'enhancer':
                                    roomLeft = nums.maxEnhancers -
                                        this.boarUser.itemCollection.powerups[rewardType].numTotal;
                                    break;
                                case 'gift':
                                case 'clone':
                                    roomLeft = nums.maxSmallPow -
                                        this.boarUser.itemCollection.powerups[rewardType].numTotal;
                                    break;
                                case 'miracle':
                                    roomLeft = nums.maxPowBase -
                                        this.boarUser.itemCollection.powerups[rewardType].numTotal;
                                    break;
                            }

                            const amtToAdd = Math.min(roomLeft, questRewardLeft);

                            if (!claimAmts[rewardType] && amtToAdd > 0) {
                                claimAmts[rewardType] = amtToAdd;
                            } else if (claimAmts[rewardType]) {
                                claimAmts[rewardType] += amtToAdd;
                            }

                            if (rewardType === 'bucks') {
                                this.boarUser.stats.general.boarScore += amtToAdd;
                            } else {
                                this.boarUser.itemCollection.powerups[rewardType].numTotal += amtToAdd;
                            }

                            this.boarUser.stats.quests.claimed[index] += amtToAdd;

                            if (this.boarUser.stats.quests.claimed[index] < questConfig.questVals[valIndex][1]) {
                                itemsNotFit = true;
                            }
                        }

                       this.boarUser.updateUserData();
                    }, inter.id + inter.user.id);

                    index++;
                }
            }

            let claimString = 'You claimed';
            const coloredParts: string[] = [];
            const colors: string[] = [];

            Object.keys(claimAmts).forEach((rewardType, index, rewardTypes) => {
                if (index === 0) {
                    claimString += ' %@';
                }
                if (index !== 0 && index !== rewardTypes.length-1) {
                    claimString += ', %@';
                }
                if (index === rewardTypes.length-1 && index === 1) {
                    claimString += ' and %@';
                }
                if (index === rewardTypes.length-1 && index > 1) {
                    claimString += ', and %@';
                }
                if (index === rewardTypes.length-1) {
                    claimString += '!';
                }

                if (rewardType === 'bucks') {
                    coloredParts.push('$' + claimAmts[rewardType].toLocaleString());
                    colors.push(this.config.colorConfig.bucks);
                } else {
                    coloredParts.push(claimAmts[rewardType].toLocaleString() + ' ' + (claimAmts[rewardType] > 1
                        ? this.config.itemConfigs.powerups[rewardType].pluralName
                        : this.config.itemConfigs.powerups[rewardType].name));
                    colors.push(this.config.colorConfig.powerup);
                }
            });

            if (coloredParts.length > 0) {
                await Replies.handleReply(
                    inter, claimString, this.config.colorConfig.font, coloredParts, colors, true
                );
            }

            if (itemsNotFit) {
                await Replies.handleReply(
                    inter, this.config.stringConfig.questInvFull, this.config.colorConfig.error,
                    undefined, undefined, true
                );
            }

            await this.showQuests();
        } catch (err: unknown) {
            const canStop: boolean = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }
    }

    public async handleEndCollect(reason: string) {
        try {
            this.hasStopped = true;

            LogDebug.log('Ended collection with reason: ' + reason, this.config, this.firstInter);

            if (reason == CollectorUtils.Reasons.Error) {
                await Replies.handleReply(
                    this.firstInter, this.config.stringConfig.setupError, this.config.colorConfig.error
                );
            }

            await this.firstInter.editReply({
                components: []
            });
        } catch (err: unknown) {
            await LogDebug.handleError(err, this.firstInter);
        }
    }

    /**
     * Updates the deletion process message and buttons
     *
     * @private
     */
    private async showQuests(firstRun = false) {
        try {
            this.disableButtons();

            const questImage = await QuestsImageGenerator.makeImage(this.boarUser, this.config);

            if (firstRun) {
                this.initButtons();
            }

            (this.baseRows[0].components[0] as ButtonBuilder).setStyle(2);
            (this.baseRows[0].components[0] as ButtonBuilder).setLabel(
                this.config.commandConfigs.boar.quests.componentFields[0][0].components[0].label
            );

            const nums = this.config.numberConfig;
            const questConfigs = this.config.questConfigs;

            const questData = DataHandlers.getGlobalData(DataHandlers.GlobalFile.Quest) as QuestData;

            const fullCompleteRewardLeft = this.boarUser.stats.quests
                ? nums.questFullAmt - this.boarUser.stats.quests.claimed[this.boarUser.stats.quests.claimed.length-1]
                : nums.questFullAmt;

            let fullComplete = true;
            questData.curQuestIDs.every((id, index) => {
                if (fullCompleteRewardLeft < nums.questFullAmt) return false;

                const questConfig = questConfigs[id];
                const valIndex = Math.floor(index / 2);
                const numToComplete = questConfig.valType === 'number'
                    ? questConfig.questVals[valIndex][0]
                    : 1;
                const questProgress = this.boarUser.stats.quests
                    ? this.boarUser.stats.quests.progress[index]
                    : 0;
                const questRewardLeft = this.boarUser.stats.quests
                    ? questConfig.questVals[valIndex][1] - this.boarUser.stats.quests.claimed[index]
                    : questConfig.questVals[valIndex][1];

                if (questProgress >= numToComplete && questRewardLeft > 0) {
                    this.baseRows[0].components[0].setDisabled(false);
                    (this.baseRows[0].components[0] as ButtonBuilder).setStyle(3);
                    fullComplete = false;
                    return false;
                } else if (questRewardLeft > 0) {
                    fullComplete = false;
                }

                return true;
            });

            if (fullComplete && fullCompleteRewardLeft > 0) {
                this.baseRows[0].components[0].setDisabled(false);
                (this.baseRows[0].components[0] as ButtonBuilder).setStyle(3);
                (this.baseRows[0].components[0] as ButtonBuilder).setLabel('Claim Full Completion Bonus');
            }

            if (this.hasStopped) return;

            await this.firstInter.editReply({
                files: [questImage],
                components: this.baseRows
            });
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }
    }

    /**
     * Creates the buttons and rows used for collection by adding information to IDs
     *
     * @private
     */
    private initButtons(): void {
        const selfWipeFieldConfigs: RowConfig[][] = this.config.commandConfigs.boar.quests.componentFields;
        const newRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
            ComponentUtils.makeRows(selfWipeFieldConfigs[0]);

        ComponentUtils.addToIDs(selfWipeFieldConfigs[0], newRows, this.firstInter.id, this.firstInter.user.id);

        this.baseRows = newRows;
    }

    /**
     * Disables all buttons
     *
     * @private
     */
    private disableButtons(): void {
        for (const row of this.baseRows) {
            for (const component of row.components) {
                component.setDisabled(true);
            }
        }
    }
}