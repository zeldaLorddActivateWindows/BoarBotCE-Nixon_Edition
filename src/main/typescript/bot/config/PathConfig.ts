/**
 * {@link PathConfig PathConfig.ts}
 *
 * Stores path configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class PathConfig {
    [pathKey: string]: string;

    // Path of folder storing all {@link Listener listeners}
    public readonly listeners: string = '';
    // Path of folder storing all {@link Command commands}
    public readonly commands: string = '';

    // Data folder/file paths

    public readonly guildDataFolder: string = '';
    public readonly userDataFolder: string = '';
    public readonly globalDataFolder: string = '';
    public readonly itemDataFileName: string = '';
    public readonly leaderboardsFileName: string = '';
    public readonly bannedUsersFileName: string = '';
    public readonly powerupDataFileName: string = '';
    public readonly questDataFileName: string = '';
    public readonly githubFileName: string = '';
    public readonly logsFolder: string = '';
    public readonly prodStartScript: string = '';
    public readonly prodRemotePath: string = '';

    // Base paths for images/assets

    public readonly boars: string = '';
    public readonly badges: string = '';
    public readonly powerups: string = '';
    public readonly itemAssets: string = '';
    public readonly tempItemAssets: string = '';
    public readonly collAssets: string = '';
    public readonly otherAssets: string = '';

    // Image/asset file names for item attachments (boars and badges)

    public readonly itemOverlay: string = '';
    public readonly itemUnderlay: string = '';
    public readonly itemBackplate: string = '';

    // Image/asset file names for collection attachments

    public readonly collOverlay: string = '';
    public readonly collUnderlay: string = '';
    public readonly collDetailOverlay: string = '';
    public readonly collDetailUnderlay: string = '';
    public readonly collPowerOverlay: string = '';
    public readonly collPowerUnderlay: string = '';
    public readonly collPowerUnderlay2: string = '';
    public readonly collPowerUnderlay3: string = '';
    public readonly collEnhanceUnderlay: string = '';
    public readonly collGiftUnderlay: string = '';
    public readonly clanNone: string = '';
    public readonly cellNone: string = '';
    public readonly cellCommon: string = '';
    public readonly cellUncommon: string = '';
    public readonly cellRare: string = '';
    public readonly cellEpic: string = '';
    public readonly cellLegendary: string = '';
    public readonly cellMythic: string = '';
    public readonly cellDivine: string = '';
    public readonly favorite: string = '';

    // Other image/asset file names

    public readonly eventUnderlay: string = '';
    public readonly questsUnderlay: string = '';
    public readonly leaderboardUnderlay: string = '';
    public readonly marketOverviewUnderlay: string = '';
    public readonly marketOverviewOverlay: string = '';
    public readonly marketBuySellUnderlay: string = '';
    public readonly marketBuySellOverlay: string = '';
    public readonly marketOrdersUnderlay: string = '';
    public readonly mainFont: string = '';
    public readonly helpGeneral1: string = '';
    public readonly helpPowerup1: string = '';
    public readonly helpPowerup2: string = '';
    public readonly helpMarket1: string = '';
    public readonly helpMarket2: string = '';
    public readonly helpBadgeBoar1: string = '';
    public readonly helpBadgeBoar2: string = '';
    public readonly helpBadgeBoar3: string = '';
    public readonly circleMask: string = '';
    public readonly bucks: string = '';
    public readonly powerup: string = '';

    // Python scripts

    public readonly dynamicImageScript: string = '';
    public readonly userOverlayScript: string = '';
}