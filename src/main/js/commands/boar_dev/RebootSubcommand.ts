import {
    ChatInputCommandInteraction
} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Subcommand} from '../../api/commands/Subcommand';
import {Replies} from '../../util/interactions/Replies';
import { ChildProcess, spawn } from 'child_process';

/**
 * {@link RebootSubcommand RebootSubcommand.ts}
 *
 * Used to reboot BoarBot
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright G_cat101 2023
 */
export default class RebootSubcommand implements Subcommand {
    private config = BoarBotApp.getBot().getConfig();
    private interaction = {} as ChatInputCommandInteraction;
    private subcommandInfo = this.config.commandConfigs.boarDev.reboot;
    public readonly data = { name: this.subcommandInfo.name, path: __filename };

    /**
     * Handles the functionality for this subcommand
     *
     * @param interaction - The interaction that called the subcommand
     */
    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await Replies.handleReply(interaction, "Rebooting...");
        let process : ChildProcess = spawn("sleep 3; python3 ~/bots/reboot.py BoarBotCE", {
            shell: true,
            detached: true,
            stdio: ["ignore", "ignore", "ignore"]
        });
        process.unref();
    }
}