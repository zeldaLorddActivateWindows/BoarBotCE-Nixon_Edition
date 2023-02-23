/**
 * {@link NumberConfig NumberConfig.ts}
 *
 * Stores number configurations for a bot instance.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class NumberConfig {
    // First pixel of an image location

    public originPos: number[] = [];

    // Font sizes

    public fontBig: number = 0;
    public fontMedium: number = 0;
    public fontSmallMedium: number = 0;

    // Maximum values

    public maxUsernameLength: number = 0;
    public maxTrackedEditions: number = 0;
    public maxScore: number = 0;
    public maxBoars: number = 0;
    public maxStreak: number = 0;

    // Item image positions, sizes, and values

    public itemImageSize: number[] = [];
    public itemBoarPos: number[] = [];
    public itemBoarSize: number[] = [];
    public itemBadgePos: number[] = [];
    public itemBadgeSize: number[] = [];
    public itemTitlePos: number[] = [];
    public itemNamePos: number[] = [];
    public itemNameplatePos: number[] = [];
    public itemNameplatePadding: number = 0;
    public itemNameplateHeight: number = 0;
    public itemUserTagPos: number[] = [];
    public itemUserAvatarPos: number[] = [];
    public itemUserAvatarWidth: number = 0;

    // Collection image positions, sizes, and values

    public collImageSize: number[] = [];
    public collUserAvatarPos: number[] = [];
    public collUserAvatarSize: number[] = [];
    public collUserTagPos: number[] = [];
    public collDatePos: number[] = [];
    public collNoBadgePos: number[] = [];
    public collBadgeStart: number = 0;
    public collBadgeSpacing: number = 0;
    public collBadgeY: number = 0;
    public collBadgeSize: number[] = [];
    public collScorePos: number[] = [];
    public collTotalPos: number[] = [];
    public collUniquePos: number[] = [];
    public collMultiplierPos: number[] = [];
    public collStreakPos: number[] = [];
    public collBoarStartX: number = 0;
    public collBoarStartY: number = 0;
    public collBoarSpacingX: number = 0;
    public collBoarSpacingY: number = 0;
    public collBoarCols: number = 0;
    public collBoarRows: number = 0;
    public collBoarSize: number[] = [];
    public collLastDailyPos: number[] = [];
    public collRarityStartX: number = 0;
    public collRarityStartY: number = 0;
    public collRarityEndDiff: number = 0;
    public collRarityWidth: number = 0;
    public collLastBoarPos: number[] = [];
    public collLastBoarSize: number[] = [];
    public collLastRarityPos: number[] = [];
    public collLastRaritySize: number[] = [];
    public collFavBoarPos: number[] = [];
    public collFavBoarSize: number[] = [];
    public collFavRarityPos: number[] = [];
    public collFavRaritySize: number[] = [];
}