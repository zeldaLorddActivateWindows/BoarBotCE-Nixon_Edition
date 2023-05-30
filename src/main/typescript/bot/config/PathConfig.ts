/**
 * {@link PathConfig PathConfig.ts}
 *
 * Stores path configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class PathConfig {
    // Path of folder storing all {@link Listener listeners}
    public readonly listeners: string = '';
    // Path of folder storing all {@link Command commands}
    public readonly commands: string = '';

    // Data folder/file paths

    public readonly guildDataFolder: string = '';
    public readonly userDataFolder: string = '';
    public readonly globalDataFile: string = '';

    // Base paths for images/assets

    public readonly boarImages: string = '';
    public readonly badgeImages: string = '';
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
    public readonly collGiftConfirm: string = '';
    public readonly collGiftUnderlay: string = '';
    public readonly clanNone: string = '';
    public readonly enhancerOn: string = '';
    public readonly enhancerOff: string = '';
    public readonly favorite: string = '';

    // Other image/asset file names

    public readonly powerupSpawn: string = '';
    public readonly powerupEnd: string = '';
    public readonly leaderboardUnderlay: string = '';
    public readonly thankYouImage: string = '';
    public readonly mainFont: string = '';
    public readonly helpBackground: string = '';
    public readonly circleMask: string = '';
    public readonly bucks: string = '';
    public readonly powerup: string = '';

    // Python scripts

    public readonly dynamicImageScript: string = '';
    public readonly userOverlayScript: string = '';
}