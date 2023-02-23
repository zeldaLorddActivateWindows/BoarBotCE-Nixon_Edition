/**
 * {@link PathConfig PathConfig.ts}
 *
 * Stores path configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class PathConfig {
    /**
     * Path of folder storing all {@link Listener listeners}
     */
    public listeners: string = '';
    /**
     * Path of folder storing all {@link Command commands}
     */
    public commands: string = '';

    // Data folder/file paths
    public guildDataFolder: string = '';
    public userDataFolder: string = '';
    public globalDataFile: string = '';

    // Base paths for images/assets
    public boarImages: string = '';
    public badgeImages: string = '';
    public itemAssets: string = '';
    public collAssets: string = '';
    public otherAssets: string = '';

    // Image/asset file names for item attachments (boars and badges)
    public itemOverlay: string = '';
    public itemUnderlay: string = '';
    public itemBackplate: string = '';
    public itemNameplate: string = '';

    // Image/asset file names for collection attachments
    public collOverlay: string = '';
    public collUnderlay: string = '';
    public enhancerOn: string = '';
    public enhancerOff: string = '';

    // Other image/asset file names
    public thankYouImage: string = '';
    public mainFont: string = '';
    public helpBackground: string = '';
    public circleMask: string = '';

    /**
     * Used for applying dynamic information to animated images
     */
    public dynamicImageScript: string = '';
}