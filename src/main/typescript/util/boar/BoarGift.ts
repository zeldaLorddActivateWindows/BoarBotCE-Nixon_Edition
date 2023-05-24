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
import {OutcomeConfig} from '../../bot/config/powerups/OutcomeConfig';
import {OutcomeSubConfig} from '../../bot/config/powerups/OutcomeSubConfig';
import {Queue} from '../interactions/Queue';
import {BoarUtils} from './BoarUtils';
import {DataHandlers} from '../data/DataHandlers';
import {ItemImageGenerator} from '../generators/ItemImageGenerator';
import {LogDebug} from '../logging/LogDebug';
import {Replies} from '../interactions/Replies';

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
            interaction.channel as TextChannel, interaction.id, true, 10000
        );

        this.firstInter = interaction;

        const giftFieldConfig = this.config.commandConfigs.boar.collection.componentFields[2];

        const claimRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
            ComponentUtils.makeRows(giftFieldConfig);

        ComponentUtils.addToIDs(giftFieldConfig, claimRows, interaction.id, interaction.user.id);

        claimRows[0].components[0].setDisabled(false);

        try {
            this.giftMessage = await interaction.channel.send({
                files: [await this.imageGen.finalizeGift()],
                components: [claimRows[0]]
            });
        } catch {
            await Replies.handleReply(interaction, this.config.stringConfig.giftFail);
            return;
        }

        this.collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter));
        this.collector.once('end', async (collected) => await this.handleEndCollect(collected));
    }

    /**
     * Handles when a user clicks the claim button
     *
     * @param inter - The interaction of the button press
     * @private
     */
    private async handleCollect(inter: ButtonInteraction): Promise<void> {
        try {
            await inter.deferUpdate();
            this.compInters.push(inter);
            this.collector.stop();
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
        }
    }

    /**
     * Handles the logic of getting the first claimer and giving the gift to them
     *
     * @param collected - Collection of all collected information
     * @private
     */
    private async handleEndCollect(
        collected:  Collection<string, ButtonInteraction | StringSelectMenuInteraction>
    ): Promise<void> {
        try {
            if (collected.size === 0) {
                await this.giftMessage.edit({
                    components: []
                });
                return;
            }

            for (const inter of this.compInters) {
                if (inter.user.id === collected.at(0)?.user.id) {
                    await this.doGift(inter);
                    break;
                }
            }
        } catch (err: unknown) {
            await LogDebug.handleError(err);
            this.collector.stop(CollectorUtils.Reasons.Error);
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
        let subOutcome: number = this.getOutcome(outcome);
        const claimedButton = new ButtonBuilder()
            .setDisabled(true)
            .setCustomId('GIFT_CLAIMED')
            .setLabel('Claiming...')
            .setStyle(3);

        this.giftedUser = new BoarUser(inter.user, true);

        await inter.editReply({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(claimedButton)] });

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

        await Queue.addQueue(() => {
            this.giftedUser.refreshUserData();
            this.giftedUser.powerups.giftsOpened++;
            this.giftedUser.updateUserData();
        }, inter.id + inter.user.id);
    }

    /**
     * Gets the index of an outcome or suboutcome based on weight
     *
     * @param outcomeVal - The outcome index, used to get suboutcomes
     * @private
     */
    private getOutcome(outcomeVal?: number): number {
        const outcomeConfig: OutcomeConfig[] = this.config.powerupConfig.gift.outcomes;
        const probabilities: number[] = [];
        const randVal: number = Math.random();
        let outcomes: OutcomeConfig[] | OutcomeSubConfig[] = outcomeConfig;
        let weightTotal: number = 0;

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
        await this.giftedUser.addBoars(['gamebreaker'], inter, this.config);

        await inter.editReply({
            files: [
                await new ItemImageGenerator(
                    this.giftedUser.user,
                    'gamebreaker',
                    this.config.stringConfig.giftOpenTitle,
                    this.config
                ).handleImageCreate(false, this.firstInter.user)
            ],
            components: []
        });
    }

    /**
     * Handles the boar bucks category
     *
     * @param suboutcome - The chosen suboutcome to handle
     * @param inter - The interaction to respond to
     * @private
     */
    private async giveBucks(suboutcome: number, inter: ButtonInteraction): Promise<void> {
        const outcomeConfig = this.config.powerupConfig.gift.outcomes[1];
        let outcomeName = outcomeConfig.suboutcomes[suboutcome].name;
        let numBucks: number = 0;

        if (suboutcome === 0) {
            numBucks = Math.round(Math.random() * (25 - 1) + 1)
        } else if (suboutcome === 1) {
            numBucks = Math.round(Math.random() * (100 - 50) + 50)
        } else {
            numBucks = Math.round(Math.random() * (300 - 200) + 200)
        }

        outcomeName = outcomeName.replace('%@', numBucks.toString());

        await Queue.addQueue(() => {
            this.giftedUser.refreshUserData();
            this.giftedUser.boarScore += numBucks;
            this.giftedUser.updateUserData();
        }, inter.id + inter.user.id);

        await inter.editReply({
            files: [
                await new ItemImageGenerator(
                    this.giftedUser.user,
                    outcomeConfig.category.toLowerCase().replace(/\s+/g, '') + suboutcome,
                    this.config.stringConfig.giftOpenTitle,
                    this.config
                ).handleImageCreate(
                    false,
                    this.firstInter.user,
                    outcomeName.substring(outcomeName.indexOf(' ')),
                    {
                        name: outcomeName,
                        file: this.config.pathConfig.bucks,
                        colorKey: 'bucks'
                    }
                )
            ],
            components: []
        });
    }

    /**
     * Handles the powerup category
     *
     * @param suboutcome - The chosen suboutcome to handle
     * @param inter - The interaction to respond to
     * @private
     */
    private async givePowerup(suboutcome: number, inter: ButtonInteraction): Promise<void> {
        const outcomeConfig = this.config.powerupConfig.gift.outcomes[2];
        const outcomeName = outcomeConfig.suboutcomes[suboutcome].name;

        await Queue.addQueue(() => {
            this.giftedUser.refreshUserData();

            if (suboutcome === 0) {
                this.giftedUser.powerups.multiBoostTotal += 15;
                this.giftedUser.powerups.highestMultiBoost = Math.max(
                    this.giftedUser.powerups.multiBoostTotal, this.giftedUser.powerups.highestMultiBoost
                )
            } else if (suboutcome === 1) {
                this.giftedUser.powerups.extraChanceTotal += 3;
                this.giftedUser.powerups.highestExtraChance = Math.max(
                    this.giftedUser.powerups.extraChanceTotal, this.giftedUser.powerups.highestExtraChance
                )
            } else {
                this.giftedUser.powerups.numEnhancers++;
            }

            this.giftedUser.updateUserData();
        }, inter.id + inter.user.id);

        await inter.editReply({
            files: [
                await new ItemImageGenerator(
                    this.giftedUser.user,
                    outcomeConfig.category.toLowerCase().replace(/\s+/g, '') + suboutcome,
                    this.config.stringConfig.giftOpenTitle,
                    this.config
                ).handleImageCreate(
                    false,
                    this.firstInter.user,
                    outcomeName.substring(outcomeName.indexOf(' ')),
                    {
                        name: outcomeConfig.suboutcomes[suboutcome].name,
                        file: this.config.pathConfig.powerup,
                        colorKey: 'powerup'
                    }
                )
            ],
            components: []
        });
    }

    /**
     * Handles the regular boar category
     *
     * @param inter - The interaction to respond to
     * @private
     */
    private async giveBoar(inter: ButtonInteraction): Promise<void> {
        const rarityWeights = BoarUtils.getBaseRarityWeights(this.config);

        const boarIDs = BoarUtils.getRandBoars(
            await DataHandlers.getGuildData(inter.guild?.id, inter), inter, rarityWeights, false, 0, this.config
        );

        await this.giftedUser.addBoars(boarIDs, inter, this.config);

        await inter.editReply({
            files: [
                await new ItemImageGenerator(
                    this.giftedUser.user,
                    boarIDs[0],
                    this.config.stringConfig.giftOpenTitle,
                    this.config
                ).handleImageCreate(false, this.firstInter.user)
            ],
            components: []
        });
    }
}