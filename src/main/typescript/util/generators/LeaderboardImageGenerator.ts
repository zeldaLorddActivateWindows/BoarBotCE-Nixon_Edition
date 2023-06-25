import Canvas from 'canvas';
import {BotConfig} from '../../bot/config/BotConfig';
import {CanvasUtils} from './CanvasUtils';
import {AttachmentBuilder} from 'discord.js';
import {BoarBotApp} from '../../BoarBotApp';
import {Queue} from '../interactions/Queue';
import {DataHandlers} from '../data/DataHandlers';

enum Board {
    Bucks = 'bucks',
    Total = 'total',
    Uniques = 'uniques',
    UniquesSB = 'uniquesSB',
    Streak = 'streak',
    Attempts = 'attempts',
    TopAttempts = 'topAttempts',
    GiftsUsed = 'giftsUsed',
    Multiplier = 'multiplier'
}

/**
 * {@link LeaderboardImageGenerator LeaderboardImageGenerator.ts}
 *
 * Creates the dynamic leaderboard image.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class LeaderboardImageGenerator {
    private config: BotConfig = {} as BotConfig;
    private curBoard: Board = Board.Bucks;
    private boardData: [string, number][] = [];
    private madeImage: boolean = false;

    /**
     * Creates a new leaderboard image generator
     *
     * @param boardData
     * @param board
     * @param config - Used to get strings, paths, and other information
     */
    constructor(boardData: [string, number][], board: Board, config: BotConfig) {
        this.curBoard = board;
        this.boardData = boardData;
        this.config = config;
    }

    /**
     * Used when leaderboard boar type has changed
     *
     * @param boardData
     * @param board
     * @param config - Used to get strings, paths, and other information
     */
    public updateInfo(boardData: [string, number][], board: Board, config: BotConfig): void {
        this.curBoard = board;
        this.boardData = boardData;
        this.config = config;
    }

    public async makeLeaderboardImage(page: number): Promise<AttachmentBuilder> {
        const strConfig = this.config.stringConfig;
        const nums = this.config.numberConfig;
        const topChoices = this.config.commandConfigs.boar.top.args[0].choices;
        const colorConfig = this.config.colorConfig;

        const underlay = this.config.pathConfig.otherAssets + this.config.pathConfig.leaderboardUnderlay;

        const curShowing = this.boardData.slice(
            page * nums.leaderboardNumPlayers, (page+1) * nums.leaderboardNumPlayers
        );
        let leaderboardTypeStr = '';

        switch(this.curBoard) {
            case (Board.Bucks):
                leaderboardTypeStr = topChoices[0].name;
                break;
            case (Board.Total):
                leaderboardTypeStr = topChoices[1].name;
                break;
            case (Board.Uniques):
                leaderboardTypeStr = topChoices[2].name;
                break;
            case (Board.UniquesSB):
                leaderboardTypeStr = topChoices[3].name;
                break;
            case (Board.Streak):
                leaderboardTypeStr = topChoices[4].name;
                break;
            case (Board.Attempts):
                leaderboardTypeStr = topChoices[5].name;
                break;
            case (Board.TopAttempts):
                leaderboardTypeStr = topChoices[6].name;
                break;
            case (Board.GiftsUsed):
                leaderboardTypeStr = topChoices[7].name;
                break;
            case (Board.Multiplier):
                leaderboardTypeStr = topChoices[8].name;
                break;
        }

        const numUsers = this.boardData.length;
        const maxPages = Math.ceil(this.boardData.length / nums.leaderboardNumPlayers) - 1;

        const bigFont = `${nums.fontBig}px ${strConfig.fontName}`;
        const mediumFont = `${nums.fontMedium}px ${strConfig.fontName}`;

        const canvas = Canvas.createCanvas(...nums.collImageSize);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(await Canvas.loadImage(underlay), ...nums.originPos);

        CanvasUtils.drawText(
            ctx, strConfig.boardHeader.replace('%@', leaderboardTypeStr.toUpperCase()),
            nums.leaderboardHeaderPos, bigFont, 'left', colorConfig.font, nums.leaderboardTopBotWidth
        );

        CanvasUtils.drawText(
            ctx,
            strConfig.boardFooter
                .replace('%@', numUsers.toLocaleString())
                .replace('%@', (page+1).toLocaleString())
                .replace('%@', (maxPages+1).toLocaleString())
                .replace('%@', (page * nums.leaderboardNumPlayers + 1).toLocaleString())
                .replace('%@', Math.min(((page+1) * nums.leaderboardNumPlayers), numUsers).toLocaleString()),
            nums.leaderboardFooterPos, mediumFont, 'center',
            colorConfig.font, nums.leaderboardTopBotWidth
        );

        for (let i=0; i<curShowing.length; i++) {
            const userPos: [number, number] = [
                nums.leaderboardStart[0] + Math.floor(i / nums.leaderboardRows) * nums.leaderboardIncX,
                nums.leaderboardStart[1] + i % nums.leaderboardRows * nums.leaderboardIncY
            ];
            const userID = curShowing[i][0];
            const userVal = curShowing[i][1].toLocaleString();
            const position: number = (page*nums.leaderboardNumPlayers)+1+i;
            let username: string = strConfig.deletedUsername;
            let positionColor: string;

            try {
                username = (await BoarBotApp.getBot().getClient().users.fetch(userID)).username;
            } catch {
                await Queue.addQueue(async () => await DataHandlers.removeLeaderboardUser(userID),
                    userID + 'global'
                ).catch((err) => { throw err });
            }

            switch (position) {
                case 1:
                    positionColor = colorConfig.gold;
                    break;
                case 2:
                    positionColor = colorConfig.silver;
                    break;
                case 3:
                    positionColor = colorConfig.bronze;
                    break;
                default:
                    positionColor = colorConfig.font;
            }

            CanvasUtils.drawText(
                ctx, '%@ ' + username + ' - ' + userVal, userPos,
                mediumFont, 'center', colorConfig.font, nums.leaderboardEntryWidth, false,
                '#' + position, positionColor
            );
        }

        return new AttachmentBuilder(canvas.toBuffer(), { name: `${strConfig.imageName}.png` })
    }

    public hasMadeImage(): boolean { return this.madeImage }
}