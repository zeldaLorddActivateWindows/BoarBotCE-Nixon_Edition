import Canvas from 'canvas';

/**
 * {@link CanvasUtils CanvasUtils.ts}
 *
 * A collection of functions to make canvas
 * editing easier/cleaner.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class CanvasUtils {
    /**
     * Draws text onto CanvasRenderingContext
     *
     * @param ctx - CanvasRenderingContext
     * @param text - Text to draw
     * @param pos - Position to place text
     * @param font - Font to use for text
     * @param align - Alignment of text
     * @param color - Base color of text
     * @param coloredContents - Texts to use secondary colors on
     * @param secondaryColors - Secondary colors
     * @param wrap - Whether to wrap the text
     * @param width - Width to wrap/shrink at
     */
    public static drawText(
        ctx: Canvas.CanvasRenderingContext2D,
        text: string,
        pos: [number, number],
        font: string,
        align: CanvasTextAlign,
        color: string,
        width?: number,
        wrap = false,
        coloredContents = [''],
        secondaryColors = [color]
    ): number {
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = color;

        const replaceIndexes: number[] = [];

        for (let i=0; i<coloredContents.length; i++) {
            replaceIndexes.push(text.indexOf('%@', i === 0
                ? 0
                : replaceIndexes[i-1]
            ));
            text = text.replace('%@', coloredContents[i]);
        }

        let heightDiff = 0;

        if (width != undefined && wrap) {
            const words: string[] = text.split(' ');
            const lineHeight: number = (ctx.measureText('Sp').actualBoundingBoxAscent +
                ctx.measureText('Sp').actualBoundingBoxDescent) * 1.1;
            let newHeight: number = pos[1];
            const lines: string[] = [];
            let curLine = '';

            let totalChars = 0;
            for (let i=0; i<words.length; i++) {
                const word: string = words[i];

                if (ctx.measureText(curLine + word).width < width) {
                    curLine += word + ' ';
                } else {
                    lines.push(curLine.trim());
                    totalChars--;
                    for (let i=0; i<replaceIndexes.length; i++) {
                        if (replaceIndexes[i] >= totalChars) {
                            replaceIndexes[i]--;
                        }
                    }
                    curLine = word + ' ';
                }
                totalChars += (word + ' ').length;
            }

            lines.push(curLine.trim());

            newHeight -= lineHeight * (lines.length-1) / 2;

            let charIndex = 0;

            for (const line of lines) {
                const prevCharIndex = charIndex;
                charIndex += line.length;

                let firstIndex = -1;
                let lastIndex = -1;

                for (let i=0; i<replaceIndexes.length; i++) {
                    if (replaceIndexes[i] >= charIndex) {
                        lastIndex = i-1;
                        break;
                    }

                    if (replaceIndexes[i] >= prevCharIndex) {
                        firstIndex = firstIndex >= 0 ? firstIndex : i;
                        lastIndex = i;
                    }
                }

                const relReplaceIndexes = lastIndex >= 0
                    ? replaceIndexes.slice(firstIndex, lastIndex+1).map(val => val - prevCharIndex)
                    : [-1];
                const contentToReplace = lastIndex >= 0
                    ? coloredContents.slice(firstIndex, lastIndex+1)
                    : [''];
                const colorsToUse = lastIndex >= 0
                    ? secondaryColors.slice(firstIndex, lastIndex+1)
                    : [color];

                if (lastIndex >= 0 && replaceIndexes[lastIndex] + coloredContents[lastIndex].length >= charIndex) {
                    const numCharsToColor = charIndex - replaceIndexes[lastIndex] + 1;

                    contentToReplace[contentToReplace.length-1] = contentToReplace[contentToReplace.length-1]
                        .substring(0, numCharsToColor).trimEnd();
                    replaceIndexes[lastIndex] = charIndex;
                    coloredContents[lastIndex] = coloredContents[lastIndex].substring(numCharsToColor).trimEnd();
                }

                this.drawColoredText(
                    ctx, line, 'center', [pos[0], newHeight], relReplaceIndexes,
                    contentToReplace, color, colorsToUse
                );

                newHeight += lineHeight;
                heightDiff += lineHeight;
            }
        } else if (width != undefined) {
            ctx.textBaseline = 'middle';
            while (ctx.measureText(text).width > width) {
                font = (parseInt(font)-1) + font.substring(font.indexOf('px'));
                ctx.font = font;
            }
            this.drawColoredText(ctx, text, align, pos, replaceIndexes, coloredContents, color, secondaryColors);
        } else {
            this.drawColoredText(ctx, text, align, pos, replaceIndexes, coloredContents, color, secondaryColors);
        }

        return heightDiff;
    }

    /**
     * Draws the secondary colored text
     *
     * @param ctx - CanvasRenderingContext
     * @param text - Text to draw
     * @param align - Alignment of text
     * @param pos - Position to place text
     * @param replaceIndexes - The indexes to start replacing with colored text
     * @param coloredContents - The actual texts that are colored
     * @param color - Base color of text
     * @param secondaryColors - Secondary colors
     * @private
     */
    private static drawColoredText(
        ctx: Canvas.CanvasRenderingContext2D,
        text: string,
        align: string,
        pos: [number, number],
        replaceIndexes: number[],
        coloredContents: string[],
        color: string,
        secondaryColors: string[]
    ): void {
        const priorNormText: string[] = [];
        let textEnd = '';

        for (let i=0; i<replaceIndexes.length; i++) {
            if (i === 0) {
                priorNormText.push(text.substring(0, replaceIndexes[i]));
            } else {
                priorNormText.push(text.substring(replaceIndexes[i-1] + coloredContents[i-1].length, replaceIndexes[i]));
            }

            if (i === replaceIndexes.length - 1) {
                textEnd = text.substring(replaceIndexes[i] + coloredContents[i].length);
            }
        }

        if (align === 'center') {
            for (let i=0; i<replaceIndexes.length; i++) {
                ctx.fillStyle = color;
                ctx.fillText(
                    priorNormText[i],
                    pos[0] - ctx.measureText(text.substring(replaceIndexes[i])).width / 2 + (i > 0
                        ? ctx.measureText(text.substring(0, replaceIndexes[i-1] + 1)).width / 2
                        : 0),
                    pos[1]
                );

                if (replaceIndexes[i] === -1) break;

                ctx.fillStyle = secondaryColors[i];
                ctx.fillText(
                    coloredContents[i],
                    pos[0] + ctx.measureText(text.substring(0, replaceIndexes[i])).width / 2 - ctx.measureText(
                        text.substring(replaceIndexes[i] + coloredContents[i].length)
                    ).width / 2,
                    pos[1]
                );
            }

            ctx.fillStyle = color;
            ctx.fillText(
                textEnd,
                pos[0] + ctx.measureText(
                    text.substring(
                        0, replaceIndexes[replaceIndexes.length-1] + coloredContents[coloredContents.length-1].length
                    )
                ).width / 2,
                pos[1]
            );
        } else if (align === 'left') {
            for (let i=0; i<replaceIndexes.length; i++) {
                ctx.fillStyle = color;
                ctx.fillText(priorNormText[i], pos[0], pos[1]);

                if (replaceIndexes[i] === -1) break;

                ctx.fillStyle = secondaryColors[i];
                ctx.fillText(
                    coloredContents[i], pos[0] + ctx.measureText(text.substring(0, replaceIndexes[i])).width, pos[1]
                );
            }

            ctx.fillStyle = color;
            ctx.fillText(
                textEnd,
                pos[0] + ctx.measureText(
                    text.substring(
                        0, replaceIndexes[replaceIndexes.length-1] + coloredContents[coloredContents.length-1].length
                    )
                ).width,
                pos[1]
            );
        }
    }

    /**
     * Draws circle onto CanvasRenderingContext
     *
     * @param ctx - CanvasRenderingContext
     * @param img - Image to convert into circle
     * @param pos - Position to place circle
     * @param diameter - Diameter of circle
     */
    public static drawCircleImage(
        ctx: Canvas.CanvasRenderingContext2D,
        img: Canvas.Image,
        pos: number[],
        diameter: number
    ): void {
        const radius: number = diameter / 2;

        ctx.beginPath();
        ctx.arc(pos[0] + radius, pos[1] + radius, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.save();
        ctx.clip();
        ctx.drawImage(img, pos[0], pos[1], diameter, diameter);
        ctx.restore();
    }

    /**
     * Draws a line
     *
     * @param ctx - CanvasRenderingContext
     * @param pos1 - Position the line starts at
     * @param pos2 - Position the line ends at
     * @param width - Width of the line
     * @param color - Color of the line
     */
    public static drawLine(
        ctx: Canvas.CanvasRenderingContext2D,
        pos1: number[],
        pos2: number[],
        width: number,
        color: string
    ): void {
        ctx.lineWidth = width;

        ctx.beginPath();
        ctx.strokeStyle = color;

        ctx.moveTo(pos1[0], pos1[1]);
        ctx.lineTo(pos2[0], pos2[1]);

        ctx.stroke();
    }

    /**
     * Draws a rectangle
     *
     * @param ctx - CanvasRenderingContext
     * @param pos - Position of rectangle
     * @param size - Dimensions of rectangle
     * @param color - Color of rectangle
     */
    public static drawRect(
        ctx: Canvas.CanvasRenderingContext2D,
        pos: number[],
        size: number[],
        color: string
    ): void {
        ctx.fillStyle = color;
        ctx.fillRect(pos[0], pos[1], size[0], size[1]);
    }
}