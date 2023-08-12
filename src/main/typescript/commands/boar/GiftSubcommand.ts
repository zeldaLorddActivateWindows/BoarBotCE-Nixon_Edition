import {
    ChatInputCommandInteraction
} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {BotConfig} from '../../bot/config/BotConfig';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {GuildData} from '../../util/data/global/GuildData';
import {LogDebug} from '../../util/logging/LogDebug';
import {Replies} from '../../util/interactions/Replies';
import {Queue} from '../../util/interactions/Queue';
import {BoarUser} from '../../util/boar/BoarUser';
import {BoarGift} from '../../util/boar/BoarGift';

/**
 * {@link GiftSubcommand GiftSubcommand.ts}
 *
 * Allows a user to send a Boar Gift if they have one
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class GiftSubcommand implements Subcommand {
    private config: BotConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo: SubcommandConfig = this.config.commandConfigs.boar.gift;
    private guildData: GuildData | undefined;
    private interaction: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.guildData = await InteractionUtils.handleStart(interaction, this.config);
        if (!this.guildData) return;

        const isBanned = await InteractionUtils.handleBanned(interaction, this.config);
        if (isBanned) return;

        await interaction.deferReply({ ephemeral: true });
        this.interaction = interaction;

        await this.sendGift();
    }

    private async sendGift() {
        await Queue.addQueue(async () => {
            try {
                const boarUser = new BoarUser(this.interaction.user);
                if (boarUser.itemCollection.powerups.gift.numTotal > 0) {
                    const curOutVal = boarUser.itemCollection.powerups.gift.curOut;
                    if (!curOutVal || curOutVal + 30000 < Date.now()) {
                        boarUser.itemCollection.powerups.gift.curOut = Date.now();
                        boarUser.updateUserData();
                        await new BoarGift(boarUser, this.config).sendMessage(this.interaction);
                        await Replies.handleReply(
                            this.interaction, this.config.stringConfig.giftSent, this.config.colorConfig.green
                        );
                    } else {
                        await Replies.handleReply(
                            this.interaction, this.config.stringConfig.giftOut, this.config.colorConfig.error
                        );
                    }
                } else {
                    await Replies.handleReply(
                        this.interaction, this.config.stringConfig.giftNone, this.config.colorConfig.error
                    );
                }
            } catch (err) {
                LogDebug.handleError(err, this.interaction);
            }
        }, this.interaction.id + this.interaction.user.id);
    }
}