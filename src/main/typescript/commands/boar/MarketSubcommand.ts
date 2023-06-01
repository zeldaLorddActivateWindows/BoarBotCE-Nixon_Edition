import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction,
    InteractionCollector,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel
} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {GuildData} from '../../util/data/global/GuildData';
import {SubcommandConfig} from '../../bot/config/commands/SubcommandConfig';
import {BotConfig} from '../../bot/config/BotConfig';
import {Replies} from '../../util/interactions/Replies';
import {CollectorUtils} from '../../util/discord/CollectorUtils';
import {RowConfig} from '../../bot/config/components/RowConfig';
import {ComponentUtils} from '../../util/discord/ComponentUtils';
import {LogDebug} from '../../util/logging/LogDebug';

enum View {
    Overview,
    BuySell,
}

/**
 * {@link MarketSubcommand MarketSubcommand.ts}
 *
 * Used to buy and sell boars and items
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class MarketSubcommand implements Subcommand {
    private config: BotConfig = BoarBotApp.getBot().getConfig();
    private subcommandInfo: SubcommandConfig = this.config.commandConfigs.boar.market;
    private firstInter: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private curView: View = View.Overview;
    private baseRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
    private buySellRow: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder> =
        new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>();
    private collector: InteractionCollector<ButtonInteraction | StringSelectMenuInteraction> =
        {} as InteractionCollector<ButtonInteraction | StringSelectMenuInteraction>;
    public readonly data = { name: this.subcommandInfo.name, path: __filename, cooldown: this.subcommandInfo.cooldown };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildData: GuildData | undefined = await InteractionUtils.handleStart(interaction, this.config);
        if (!guildData) return;

        await interaction.deferReply();

        this.firstInter = interaction;

        this.curView = interaction.options.getInteger(this.subcommandInfo.args[0].name) as View;
        const pageInput: string = interaction.options.getString(this.subcommandInfo.args[1].name)
            ? (interaction.options.getString(this.subcommandInfo.args[1].name) as string)
                .toLowerCase().replace(/\s+/g, '')
            : '1';

        this.collector = await CollectorUtils.createCollector(
            interaction.channel as TextChannel, interaction.id, this.config.numberConfig
        );

        await this.showMarket();

        this.collector.on('collect', async (inter: ButtonInteraction) => await this.handleCollect(inter));
        this.collector.once('end', async (collected, reason) => await this.handleEndCollect(reason));
    }

    private async handleCollect(inter: ButtonInteraction) {
        return;
    }

    private async handleEndCollect(reason: string) {
        try {
            LogDebug.sendDebug('Ended collection with reason: ' + reason, this.config, this.firstInter);

            if (reason == CollectorUtils.Reasons.Error) {
                await Replies.handleReply(
                    this.firstInter, this.config.stringConfig.setupError,
                    this.config.colorConfig.error, undefined, undefined, true
                );
            }

            await this.firstInter.editReply({
                components: []
            });
        } catch (err: unknown) {
            await LogDebug.handleError(err);
        }
    }

    private async showMarket() {
        this.disableButtons();

        this.initButtons();

        await this.firstInter.editReply({
            content: "market",
            components: this.baseRows
        });
    }

    private disableButtons(): void {
        for (const row of this.baseRows) {
            for (const component of row.components) {
                component.setDisabled(true);
            }
        }

        for (const component of this.buySellRow.components) {
            component.setDisabled(true);
        }
    }

    private initButtons() {
        const marketFieldConfigs: RowConfig[][] = this.config.commandConfigs.boar.market.componentFields;

        for (let i=0; i<marketFieldConfigs.length; i++) {
            const newRows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] =
                ComponentUtils.makeRows(marketFieldConfigs[i]);

            ComponentUtils.addToIDs(marketFieldConfigs[i], newRows, this.firstInter.id, this.firstInter.user.id);
            this.baseRows = newRows
        }
    }
}