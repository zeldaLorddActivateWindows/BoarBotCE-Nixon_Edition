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

    public readonly originPos: number[] = [];

    // Font sizes

    public readonly fontBig: number = 0;
    public readonly fontMedium: number = 0;
    public readonly fontSmallMedium: number = 0;

    // Maximum values

    public readonly maxUsernameLength: number = 0;
    public readonly maxTrackedEditions: number = 0;
    public readonly maxScore: number = 0;
    public readonly maxBoars: number = 0;
    public readonly maxStreak: number = 0;

    // Item image positions, sizes, and values

    public readonly itemImageSize: number[] = [];
    public readonly itemBoarPos: number[] = [];
    public readonly itemBoarSize: number[] = [];
    public readonly itemBadgePos: number[] = [];
    public readonly itemBadgeSize: number[] = [];
    public readonly itemTitlePos: number[] = [];
    public readonly itemNamePos: number[] = [];
    public readonly itemNameplatePos: number[] = [];
    public readonly itemNameplatePadding: number = 0;
    public readonly itemNameplateHeight: number = 0;
    public readonly itemUserTagPos: number[] = [];
    public readonly itemUserAvatarPos: number[] = [];
    public readonly itemUserAvatarWidth: number = 0;

    // Collection image positions, sizes, and values

    public readonly collImageSize: number[] = [];
    public readonly collUserAvatarPos: number[] = [];
    public readonly collUserAvatarSize: number[] = [];
    public readonly collUserTagPos: number[] = [];
    public readonly collDatePos: number[] = [];
    public readonly collNoBadgePos: number[] = [];
    public readonly collBadgeStart: number = 0;
    public readonly collBadgeSpacing: number = 0;
    public readonly collBadgeY: number = 0;
    public readonly collBadgeSize: number[] = [];
    public readonly collScorePos: number[] = [];
    public readonly collTotalPos: number[] = [];
    public readonly collUniquePos: number[] = [];
    public readonly collMultiplierPos: number[] = [];
    public readonly collStreakPos: number[] = [];
    public readonly collBoarStartX: number = 0;
    public readonly collBoarStartY: number = 0;
    public readonly collBoarSpacingX: number = 0;
    public readonly collBoarSpacingY: number = 0;
    public readonly collBoarCols: number = 0;
    public readonly collBoarRows: number = 0;
    public readonly collBoarSize: number[] = [];
    public readonly collLastDailyPos: number[] = [];
    public readonly collRarityStartX: number = 0;
    public readonly collRarityStartY: number = 0;
    public readonly collRarityEndDiff: number = 0;
    public readonly collRarityWidth: number = 0;
    public readonly collLastBoarPos: number[] = [];
    public readonly collLastBoarSize: number[] = [];
    public readonly collLastRarityPos: number[] = [];
    public readonly collLastRaritySize: number[] = [];
    public readonly collFavBoarPos: number[] = [];
    public readonly collFavBoarSize: number[] = [];
    public readonly collFavRarityPos: number[] = [];
    public readonly collFavRaritySize: number[] = [];
}