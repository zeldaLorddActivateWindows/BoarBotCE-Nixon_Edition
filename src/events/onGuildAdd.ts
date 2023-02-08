/***********************************************
 * onGuildAdd.ts
 * An event that runs once the bot is added to
 * a server.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {AttachmentBuilder, AuditLogEvent, Events, Guild} from 'discord.js';
import fs from 'fs';

//***************************************

module.exports = {
	name: Events.GuildCreate,
	async execute(guild: Guild) {
        if (!guild.members.me || !guild.members.me.permissions.has('ViewAuditLog'))
            return;

        guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 }).then(log => {
            const firstEntry = log.entries.first();

            if (!firstEntry)
                return;

            const userAdded = firstEntry.executor;

            if (!userAdded)
                return;

            const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

            // Aliases for config
            const configStrings = config.strings;
            const otherAssetsPath = config.paths.assets.other;

            // DM information to be sent
            const thankYouImage = otherAssetsPath.basePath + otherAssetsPath.thankYou;
            const thankYouMessage = configStrings.general.guildAdd
                .replace('%@', userAdded.username)
                .replace('%@', guild.name)
                .replace('%@', configStrings.commands.config.name);

            userAdded.send({
                content: thankYouMessage,
                files: [new AttachmentBuilder(fs.readFileSync(thankYouImage))]
            });
        });
    }
};