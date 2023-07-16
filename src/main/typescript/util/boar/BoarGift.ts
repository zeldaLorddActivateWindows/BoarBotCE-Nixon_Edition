import {BoarUser} from './BoarUser';
import {
    ActionRowBuilder, ButtonBuilder,
    ButtonInteraction,
    Collection,
    InteractionCollector, Message, MessageComponentInteraction, StringSelectMenuBuilder,
    StringSelectMenuInteraction, TextChannel
} from 'discord.js';
import {CollectorUtils} from '../discord/CollectorUtils';
import {ComponentUtils} from '../discord/ComponentUtils';
import {BotConfig} from '../../bot/config/BotConfig';
import {CollectionImageGenerator} from '../generators/CollectionImageGenerator';
import {OutcomeConfig} from '../../bot/config/items/OutcomeConfig';
import {OutcomeSubConfig} from '../../bot/config/items/OutcomeSubConfig';
import {Queue} from '../interactions/Queue';
import {BoarUtils} from './BoarUtils';
import {DataHandlers} from '../data/DataHandlers';
import {ItemImageGenerator} from '../generators/ItemImageGenerator';
import {LogDebug} from '../logging/LogDebug';
import {Replies} from '../interactions/Replies';
import {RowConfig} from '../../bot/config/components/RowConfig';

/**
 * {@link BoarGift BoarGift.ts}
 *
 * Handles the creation of boar gift messages and
 * interactions with those messages
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */

export class BoarGift {
    private readonly config: BotConfig;
    public boarUser: BoarUser;
    public giftedUser: BoarUser = {} as BoarUser;
    private imageGen: CollectionImageGenerator;
    private firstInter: MessageComponentInteraction = {} as MessageComponentInteraction;
    private compInters: ButtonInteraction[] = [];
    private giftMessage: Message = {} as Message;
    private completedGift = false;
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;

    /**
     * Creates a new BoarUser from data file.
     *
     * @param boarUser - The information of the user that sent the gift
     * @param imageGen - The image generator used to send attachments
     * @param config - Used to get several configurations
     */
    constructor(boarUser: BoarUser, imageGen: CollectionImageGenerator, config: BotConfig) {
        this.boarUser = boarUser;
        this.config = config;
        this.imageGen = imageGen;
    }

    /**
     * Sends the gift message that others can claim
     *
     * @param interaction - The interaction to follow up
     */
    public async sendMessage(interaction: MessageComponentInteraction): Promise<void> {
        if (!interaction.channel) return;

        this.collector = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig, true, 30000
        );

        this.firstInter = interaction;

        const giftFieldConfig: RowConfig[] = this.config.commandConfigs.boar.collection.componentFields[2];

        const claimRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
            ComponentUtils.makeRows(giftFieldConfig);

        ComponentUtils.addToIDs(giftFieldConfig, claimRows, interaction.id, interaction.user.id);

        claimRows[0].components[0].setDisabled(false);

        this.collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter));
        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(collected, reason));

        try {
            this.giftMessage = await interaction.channel.send({
                files: [await this.imageGen.finalizeGift()],
                components: [claimRows[0]]
            });
        } catch {
            this.completedGift = true;
            await Replies.handleReply(
                interaction, this.config.stringConfig.giftFail, this.config.colorConfig.error,
                undefined, undefined, true
            ).catch(() => {});
            return;
        }
    }

    public isCompleted(): boolean {
        return this.completedGift;
    }

    /**
     * Handles when a user clicks the claim button
     *
     * @param inter - The interaction of the button press
     * @private
     */
    private async handleCollect(inter: ButtonInteraction): Promise<void> {
        try {
            LogDebug.sendDebug(`${inter.user.username} tried to open gift`, this.config, inter);
            await inter.deferUpdate();
            this.compInters.push(inter);
            this.collector.stop();
        } catch (err: unknown) {
            const canStop = await LogDebug.handleError(err, this.firstInter);
            if (canStop && Object.keys(this.collector).length > 0) {
                this.collector.stop(CollectorUtils.Reasons.Error);
            }
        }
    }

    /**
     * Handles the logic of getting the first claimer and giving the gift to them
     *
     * @param collected - Collection of all collected information
     * @param reason - Reason collection ended
     * @private
     */
    private async handleEndCollect(
        collected:  Collection<string, ButtonInteraction | StringSelectMenuInteraction>,
        reason: string
    ): Promise<void> {
        try {
            if (this.compInters.length === 0 || reason === CollectorUtils.Reasons.Error) {
                LogDebug.sendDebug(`Gift expired`, this.config, this.firstInter);
                this.completedGift = true;
                await this.giftMessage.delete().catch(() => {});
                return;
            }

            await this.doGift(this.compInters[0]);
        } catch (err: unknown) {
            await LogDebug.handleError(err, this.firstInter);
        }
    }

    /**
     * Handles giving the gift and responding
     *
     * @param inter - The button interaction of the first user that clicked claim
     * @private
     */
    private async doGift(inter: ButtonInteraction): Promise<void> {
        const outcome: number = this.getOutcome();
        const subOutcome = this.getOutcome(outcome);
        const claimedButton: ButtonBuilder = new ButtonBuilder()
            .setDisabled(true)
            .setCustomId('GIFT_CLAIMED')
            .setLabel('Claiming...')
            .setStyle(3);

        this.giftedUser = new BoarUser(inter.user, true);

        await inter.editReply({
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(claimedButton)]
        }).catch(() => {});

        let canGift = true;
        await Queue.addQueue(async () => {
            try {
                this.boarUser.refreshUserData();

                if (this.boarUser.itemCollection.powerups.gift.numTotal === 0) {
                    canGift = false;
                    return;
                }

                this.boarUser.itemCollection.powerups.gift.numTotal--;
                this.boarUser.itemCollection.powerups.gift.numUsed++;
                this.boarUser.updateUserData();
            } catch (err: unknown) {
                await LogDebug.handleError(err, this.firstInter);
            }
        }, this.firstInter.id + this.boarUser.user.id).catch((err) => { throw err });

        this.completedGift = true;

        if (!canGift) {
            await this.giftMessage.delete().catch(() => {});
            return;
        }

        switch (outcome) {
            case 0:
                await this.giveSpecial(inter);
                break;
            case 1:
                await this.giveBucks(subOutcome, inter);
                break;
            case 2:
                await this.givePowerup(subOutcome, inter);
                break;
            case 3:
                await this.giveBoar(inter);
                break;
        }

        await Queue.addQueue(async () => {
            try {
                this.giftedUser.refreshUserData();

                (this.giftedUser.itemCollection.powerups.gift.numOpened as number)++;
                if (this.giftedUser.stats.general.firstDaily === 0) {
                    this.giftedUser.stats.general.firstDaily = Date.now();
                }

                this.giftedUser.updateUserData();
            } catch (err: unknown) {
                await LogDebug.handleError(err, inter);
            }
        }, inter.id + this.giftedUser.user.id).catch((err) => { throw err });

        await Queue.addQueue(async () => await DataHandlers.updateLeaderboardData(this.boarUser, inter, this.config),
            inter.id + this.boarUser.user.id + 'global'
        ).catch((err) => { throw err });

        await Queue.addQueue(async () => await DataHandlers.updateLeaderboardData(this.giftedUser, inter, this.config),
            inter.id + this.giftedUser.user.id + 'global'
        ).catch((err) => { throw err });
    }

    /**
     * Gets the index of an outcome or suboutcome based on weight
     *
     * @param outcomeVal - The outcome index, used to get suboutcomes
     * @private
     */
    private getOutcome(outcomeVal?: number): number {
        const outcomeConfig: OutcomeConfig[] = this.config.itemConfigs.powerups.gift.outcomes as OutcomeConfig[];
        const probabilities: number[] = [];
        const randVal: number = Math.random();
        let outcomes: OutcomeConfig[] | OutcomeSubConfig[] = outcomeConfig;
        let weightTotal = 0;

        if (outcomeVal !== undefined) {
            outcomes = outcomeConfig[outcomeVal].suboutcomes;
        }

        if (outcomes.length === 0) return -1;

        for (const outcome of outcomes) {
            weightTotal += outcome.weight;
        }

        for (let i=0; i<outcomes.length; i++) {
            const weight = outcomes[i].weight;

            probabilities.push(weight / weightTotal);

            if (probabilities.length === 1) continue;

            probabilities[i] += probabilities[i-1];
        }

        for (let i=0; i<probabilities.length; i++) {
            if (randVal < probabilities[i]) {
                return i;
            }
        }

        return probabilities.length-1;
    }

    /**
     * Handles the special boar category
     *
     * @param inter - The interaction to respond to
     * @private
     */
    private async giveSpecial(inter: ButtonInteraction): Promise<void> {
        await this.giftedUser.addBoars(['underwear'], inter, this.config);
        await this.boarUser.addBoars(['underwear'], inter, this.config);

        await inter.editReply({
            files: [
                await new ItemImageGenerator(
                    this.giftedUser.user, 'underwear', this.config.stringConfig.giftOpenTitle, this.config
                ).handleImageCreate(false, this.firstInter.user)
            ],
            components: []
        }).catch(() => {});
    }

    /**
     * Handles the boar bucks category
     *
     * @param suboutcome - The chosen suboutcome to handle
     * @param inter - The interaction to respond to
     * @private
     */
    private async giveBucks(suboutcome: number, inter: ButtonInteraction): Promise<void> {
        const outcomeConfig: OutcomeConfig = (this.config.itemConfigs.powerups.gift.outcomes as OutcomeConfig[])[1];
        let outcomeName: string = outcomeConfig.suboutcomes[suboutcome].name;
        let numBucks = 0;

        if (suboutcome === 0) {
            numBucks = Math.round(Math.random() * (3 - 1) + 1)
        } else if (suboutcome === 1) {
            numBucks = Math.round(Math.random() * (40 - 10) + 10)
        } else {
            numBucks = Math.round(Math.random() * (400 - 100) + 100)
        }

        outcomeName = outcomeName.replace('%@', numBucks.toString());

        await Queue.addQueue(async () => {
            try {
                this.giftedUser.refreshUserData();
                this.giftedUser.stats.general.boarScore += numBucks;
                this.giftedUser.updateUserData();
            } catch (err: unknown) {
                await LogDebug.handleError(err, inter);
            }
        }, inter.id + this.giftedUser.user.id).catch((err) => { throw err });

        await Queue.addQueue(async () => {
            try {
                this.boarUser.refreshUserData();
                this.boarUser.stats.general.boarScore += numBucks;
                this.boarUser.updateUserData();
            } catch (err: unknown) {
                await LogDebug.handleError(err, inter);
            }
        }, inter.id + this.boarUser.user.id).catch((err) => { throw err });

        await inter.editReply({
            files: [
                await new ItemImageGenerator(
                    this.giftedUser.user,
                    outcomeConfig.category.toLowerCase().replace(/\s+/g, '') + suboutcome + numBucks,
                    this.config.stringConfig.giftOpenTitle, this.config
                ).handleImageCreate(
                    false, this.firstInter.user,
                    outcomeName.substring(outcomeName.indexOf(' ')),
                    {
                        name: outcomeName,
                        file: this.config.pathConfig.bucks,
                        colorKey: 'bucks'
                    }
                )
            ],
            components: []
        }).catch(() => {});
    }

    /**
     * Handles the powerup category
     *
     * @param suboutcome - The chosen suboutcome to handle
     * @param inter - The interaction to respond to
     * @private
     */
    private async givePowerup(suboutcome: number, inter: ButtonInteraction): Promise<void> {
        const outcomeConfig: OutcomeConfig = (this.config.itemConfigs.powerups.gift.outcomes as OutcomeConfig[])[2];
        const outcomeName: string = outcomeConfig.suboutcomes[suboutcome].name;

        await Queue.addQueue(async () => {
            try {
                this.giftedUser.refreshUserData();

                if (suboutcome === 0) {
                    this.giftedUser.itemCollection.powerups.multiBoost.numTotal += 15;
                    this.giftedUser.itemCollection.powerups.multiBoost.highestTotal = Math.max(
                        this.giftedUser.itemCollection.powerups.multiBoost.numTotal,
                        this.giftedUser.itemCollection.powerups.multiBoost.highestTotal
                    )
                } else if (suboutcome === 1) {
                    this.giftedUser.itemCollection.powerups.extraChance.numTotal += 3;
                    this.giftedUser.itemCollection.powerups.extraChance.highestTotal = Math.max(
                        this.giftedUser.itemCollection.powerups.extraChance.numTotal,
                        this.giftedUser.itemCollection.powerups.extraChance.highestTotal
                    )
                } else {
                    this.giftedUser.itemCollection.powerups.enhancer.numTotal++;
                    this.giftedUser.itemCollection.powerups.enhancer.highestTotal = Math.max(
                        this.giftedUser.itemCollection.powerups.enhancer.numTotal,
                        this.giftedUser.itemCollection.powerups.enhancer.highestTotal
                    )
                }

                this.giftedUser.updateUserData();
            } catch (err: unknown) {
                await LogDebug.handleError(err, inter);
            }
        }, inter.id + this.giftedUser.user.id).catch((err) => { throw err });

        await Queue.addQueue(async () => {
            try {
                this.boarUser.refreshUserData();

                if (suboutcome === 0) {
                    this.boarUser.itemCollection.powerups.multiBoost.numTotal += 15;
                    this.boarUser.itemCollection.powerups.multiBoost.highestTotal = Math.max(
                        this.boarUser.itemCollection.powerups.multiBoost.numTotal,
                        this.boarUser.itemCollection.powerups.multiBoost.highestTotal
                    )
                } else if (suboutcome === 1) {
                    this.boarUser.itemCollection.powerups.extraChance.numTotal += 3;
                    this.boarUser.itemCollection.powerups.extraChance.highestTotal = Math.max(
                        this.boarUser.itemCollection.powerups.extraChance.numTotal,
                        this.boarUser.itemCollection.powerups.extraChance.highestTotal
                    )
                } else {
                    this.boarUser.itemCollection.powerups.enhancer.numTotal++;
                    this.boarUser.itemCollection.powerups.enhancer.highestTotal = Math.max(
                        this.boarUser.itemCollection.powerups.enhancer.numTotal,
                        this.boarUser.itemCollection.powerups.enhancer.highestTotal
                    )
                }

                this.boarUser.updateUserData();
            } catch (err: unknown) {
                await LogDebug.handleError(err, inter);
            }
        }, inter.id + this.boarUser.user.id).catch((err) => { throw err });

        await inter.editReply({
            files: [
                await new ItemImageGenerator(
                    this.giftedUser.user, outcomeConfig.category.toLowerCase().replace(/\s+/g, '') + suboutcome,
                    this.config.stringConfig.giftOpenTitle, this.config
                ).handleImageCreate(
                    false, this.firstInter.user,
                    outcomeName.substring(outcomeName.indexOf(' ')),
                    {
                        name: outcomeConfig.suboutcomes[suboutcome].name,
                        file: this.config.pathConfig.powerup,
                        colorKey: 'powerup'
                    }
                )
            ],
            components: []
        }).catch(() => {});
    }

    /**
     * Handles the regular boar category
     *
     * @param inter - The interaction to respond to
     * @private
     */
    private async giveBoar(inter: ButtonInteraction): Promise<void> {
        const rarityWeights: Map<number, number> = BoarUtils.getBaseRarityWeights(this.config);

        const boarIDs: string[] = BoarUtils.getRandBoars(
            await DataHandlers.getGuildData(inter.guild?.id, inter), inter, rarityWeights, false, 0, this.config
        );

        const editions: number[] = await this.giftedUser.addBoars(boarIDs, inter, this.config);
        await this.boarUser.addBoars(boarIDs, inter, this.config);

        await inter.editReply({
            files: [
                await new ItemImageGenerator(
                    this.giftedUser.user, boarIDs[0], this.config.stringConfig.giftOpenTitle, this.config
                ).handleImageCreate(false, this.firstInter.user)
            ],
            components: []
        }).catch(() => {});

        for (const edition of editions) {
            if (edition !== 1) continue;
            await inter.followUp({
                files: [
                    await new ItemImageGenerator(
                        this.giftedUser.user, 'bacteria', this.config.stringConfig.giveTitle, this.config
                    ).handleImageCreate()
                ]
            });
        }
    }
}