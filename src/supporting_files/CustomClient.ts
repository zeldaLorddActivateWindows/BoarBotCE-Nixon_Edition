/***********************************************
 * CustomClient.ts
 * Weslay
 *
 * A version of the client that can store
 * commands, subcommands, and modals in the
 * client itself
 ***********************************************/

import {Client, ClientOptions, Collection} from 'discord.js';

//***************************************

export class CustomClient extends Client {
    public commandList: Collection<string, any>;
    public subcommands: Collection<string, any>;
    public modals: Collection<string, any>;

    //***************************************

    /**
     * Creates a client with commands and modals attached as collections
     * @param options
     */
    constructor(options: ClientOptions) {
        super(options);
        this.commandList = new Collection<string, any>();
        this.subcommands = new Collection<string, any>();
        this.modals = new Collection<string, any>();
    }
}