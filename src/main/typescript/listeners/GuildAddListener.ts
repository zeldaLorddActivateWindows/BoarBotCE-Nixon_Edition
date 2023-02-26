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
        const strConfig = this.config.stringConfig;
        const pathConfig = this.config.pathConfig;
        const setupCommandConfig = this.config.commandConfigs.boarManage.setup;

        // DM information to be sent
        const thankYouImage = pathConfig.otherAssets + pathConfig.thankYouImage;
        const thankYouMessage = strConfig.guildAdd
            .replace('%@', this.userToThank.username)
            .replace('%@', this.guild.name)
            .replace('%@', setupCommandConfig.name);

        await this.userToThank.send({
            content: thankYouMessage,
            files: [new AttachmentBuilder(fs.readFileSync(thankYouImage))]
        });
    }
}