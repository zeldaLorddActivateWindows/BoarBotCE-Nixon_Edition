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
     * @param coloredText - Text to use secondary color on
     * @param color2 - Secondary color
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
        wrap: boolean = false,
        coloredText: string = '',
        color2: string = color
    ): number {
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = color;

        let replaceIndex = text.indexOf('%@');
        text = text.replace('%@', coloredText);

        let heightDiff = 0;

        if (width != undefined && wrap) {
            const words: string[] = text.split(' ');
            const lineHeight: number = (ctx.measureText('Sp').actualBoundingBoxAscent +
                ctx.measureText('Sp').actualBoundingBoxDescent) * 1.1;
            let newHeight = pos[1];
            let lines: string[] = [];
            let curLine: string = '';

            for (let i=0; i<words.length; i++) {
                const word: string = words[i];

                if (ctx.measureText(curLine + word + ' ').width < width) {
                    curLine += word + ' ';
                } else {
                    lines.push(curLine.substring(0, curLine.length-1));
                    curLine = word + ' ';
                }
            }

            lines.push(curLine.substring(0, curLine.length-1));

            newHeight -= lineHeight * (lines.length-1) / 2;

            let charIndex = 0;
            const originalColorLength = coloredText.length;
            for (const line of lines) {
                let prevCharIndex = charIndex;
                charIndex += line.length;

                if (charIndex > replaceIndex && prevCharIndex < replaceIndex + originalColorLength) {
                    const relReplaceIndex = replaceIndex-prevCharIndex;
                    const textPart1 = line.substring(0, Math.min(relReplaceIndex, line.length));
                    const textPart2 = line.substring(Math.min(relReplaceIndex+coloredText.length, line.length));
                    let coloredToPlace = coloredText;

                    if (relReplaceIndex+coloredText.length > line.length) {
                        coloredToPlace = line.substring(replaceIndex, line.length);
                        replaceIndex = charIndex;
                    }

                    ctx.fillText(textPart1, pos[0] - ctx.measureText(coloredToPlace+textPart2).width/2, newHeight);
                    ctx.fillStyle = color2;
                    ctx.fillText(
                        coloredToPlace, pos[0] + ctx.measureText(textPart1).width/2 -
                        ctx.measureText(textPart2).width/2, newHeight
                    );
                    ctx.fillStyle = color;
                    ctx.fillText(textPart2, pos[0] + ctx.measureText(textPart1+coloredToPlace).width/2, newHeight);

                    coloredText = coloredText.replace(coloredToPlace + ' ', '');
                } else {
                    ctx.fillText(line, pos[0], newHeight);
                }

                heightDiff += lineHeight;
                newHeight += lineHeight;
            }
        } else if (width != undefined) {
            ctx.textBaseline = 'middle';
            while (ctx.measureText(text).width > width) {
                font = (parseInt(font)-1) + font.substring(font.indexOf('px'));
                ctx.font = font;
            }
            this.drawColoredText(ctx, text, align, pos, replaceIndex, coloredText, color, color2);
        } else {
            this.drawColoredText(ctx, text, align, pos, replaceIndex, coloredText, color, color2);
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
     * @param replaceIndex - The index to start replacing with colored text
     * @param coloredText - The actual text that's colored
     * @param color - Base color of text
     * @param color2 - Secondary color
     * @private
     */
    private static drawColoredText(
        ctx: Canvas.CanvasRenderingContext2D,
        text: string,
        align: string,
        pos: [number, number],
        replaceIndex: number,
        coloredText: string,
        color: string,
        color2: string
    ): void {
        const textPart1 = text.substring(0, replaceIndex);
        const textPart2 = text.substring(replaceIndex+coloredText.length);

        if (align === 'center') {
            ctx.fillText(textPart1, pos[0] - ctx.measureText(coloredText+textPart2).width/2, pos[1]);
            ctx.fillStyle = color2;
            ctx.fillText(
                coloredText, pos[0] + ctx.measureText(textPart1).width/2 - ctx.measureText(textPart2).width/2, pos[1]
            );
            ctx.fillStyle = color;
            ctx.fillText(textPart2, pos[0] + ctx.measureText(textPart1+coloredText).width/2, pos[1]);
        } else if (align === 'left') {
            ctx.fillText(textPart1, pos[0], pos[1]);
            ctx.fillStyle = color2;
            ctx.fillText(
                coloredText, pos[0] + ctx.measureText(textPart1).width, pos[1]
            );
            ctx.fillStyle = color;
            ctx.fillText(textPart2, pos[0] + ctx.measureText(textPart1+coloredText).width, pos[1]);
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
        const radius = diameter / 2;

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