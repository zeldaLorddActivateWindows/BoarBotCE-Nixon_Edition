/***********************************************
 * DeployCommands.ts
 * Handles the deployment of application
 * commands.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import {REST} from '@discordjs/rest';
import {Routes} from 'discord-api-types/v10';
import dotenv from 'dotenv';
import {getConfigFile} from '../supporting_files/DataHandlers';
import {sendDebug} from '../logging/LogDebug';

dotenv.config();

//***************************************

const commandList = [require(getConfigFile().paths.commandList).data.toJSON()];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN as string);

// Delete a command for a test server
// rest.delete(Routes.applicationCommand(process.env.CLIENT_ID as string, '1042828007955517502'))
// 	.then(() => console.log('Successfully deleted guild command'))
// 	.catch(console.error);

// Registers application commands to test server only
// rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID as string, process.env.GUILD_ID as string), { body: commandList })
// 	.then(() => console.log('Successfully registered application commands to test server.'))
// 	.catch(console.error);

// Registers application commands to all servers
rest.put(Routes.applicationCommands(process.env.CLIENT_ID as string), { body: commandList })
	.then(() => sendDebug(getConfigFile().strings.general.registeredCommands))
	.catch(console.error);