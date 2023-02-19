/***********************************************
 * GuildAddListener.ts
 * An event that runs once the bot is added to
 * a server.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {AttachmentBuilder, AuditLogEvent, Events, Guild, GuildAuditLogsEntry, User} from 'discord.js';
import fs from 'fs';
import {Listener} from '../api/listeners/Listener';
import {BoarBotApp} from '../BoarBotApp';
import {BotConfig} from '../bot/config/BotConfig';

//***************************************

export default class GuildAddListener implements Listener {
    public readonly eventName: Events = Events.GuildMemberAdd;
    private guild: Guild | null = null;
    private config: BotConfig | null = null;
    private userToThank: User | null = null;

    public async execute(guild: Guild): Promise<void> {
        if (!guild.members.me || !guild.members.me.permissions.has('ViewAuditLog'))
            return;

        this.guild = guild;
        this.config = BoarBotApp.getBot().getConfig();

        const logInfo = await this.getBotAddLogInfo();
        if (!logInfo) return;

        this.userToThank = logInfo.executor;
        if (!this.userToThank) return;

        await this.sendThankYou();
    }

    private async getBotAddLogInfo(): Promise<GuildAuditLogsEntry<AuditLogEvent.BotAdd> | undefined> {
        if (!this.guild) return undefined;

        const log = await this.guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 });
        return log.entries.first();
    }

    private async sendThankYou(): Promise<void> {
        if (!this.guild || !this.userToThank || !this.config) return;

        // Aliases for config
        const configStrings = this.config.stringConfig;
        const otherAssetsPath = this.config.pathConfig.resources.other;

        // DM information to be sent
        const thankYouImage = otherAssetsPath.basePath + otherAssetsPath.thankYou;
        const thankYouMessage = configStrings.general.guildAdd
            .replace('%@', this.userToThank.username)
            .replace('%@', this.guild.name)
            .replace('%@', configStrings.commands.config.name);

        await this.userToThank.send({
            content: thankYouMessage,
            files: [new AttachmentBuilder(fs.readFileSync(thankYouImage))]
        });
    }
}