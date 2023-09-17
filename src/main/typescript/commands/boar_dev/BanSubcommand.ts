import {
    ChatInputCommandInteraction,
    User
} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {InteractionUtils} from '../../util/interactions/InteractionUtils';
import {Replies} from '../../util/interactions/Replies';
import {StringConfig} from '../../bot/config/StringConfig';
import {Queue} from '../../util/interactions/Queue';
import {LogDebug} from '../../util/logging/LogDebug';
import {DataHandlers} from '../../util/data/DataHandlers';
import {GuildData} from '../../bot/data/global/GuildData';

/**
 * {@link BanSubcommand BanSubcommand.ts}
 *
 * Used to ban a user from BoarBot
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export default class BanSubcommand implements Subcommand {
    private config = BoarBotApp.getBot().getConfig();
    private interaction: ChatInputCommandInteraction = {} as ChatInputCommandInteraction;
    private subcommandInfo = this.config.commandConfigs.boarDev.ban;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        this.config = BoarBotApp.getBot().getConfig();

        const guildData: GuildData | undefined = await InteractionUtils.handleStart(interaction, this.config);
        if (!guildData) return;

        if (!this.config.devs.includes(interaction.user.id)) {
            await Replies.noPermsReply(interaction, this.config);
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        this.interaction = interaction;

        const strConfig: StringConfig = this.config.stringConfig;

        const userInput: User | null = interaction.options.getUser(this.subcommandInfo.args[0].name);
        const timeInput: number = interaction.options.getInteger(this.subcommandInfo.args[1].name)
            ?? 24;

        if (!userInput) {
            await Replies.handleReply(interaction, strConfig.nullFound);
            return;
        }

        await Queue.addQueue(async () => {
            try {
                const bannedUserData: Record<string, number> = DataHandlers.getGlobalData(
                    DataHandlers.GlobalFile.BannedUsers
                ) as Record<string, number>;
                bannedUserData[userInput.id] = Date.now() + timeInput * 60 * 60 * 1000;
                DataHandlers.saveGlobalData(bannedUserData, DataHandlers.GlobalFile.BannedUsers);

                await Replies.handleReply(
                    interaction, this.config.stringConfig.banSuccess
                        .replace('%@', userInput.username)
                        .replace('%@', timeInput.toLocaleString())
                );
            } catch (err: unknown) {
                await LogDebug.handleError(err, this.interaction);
            }
        }, this.interaction.id + 'global').catch((err) => { throw err });
    }
}