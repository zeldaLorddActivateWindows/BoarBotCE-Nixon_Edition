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
     * @param color - Color of text
     * @param wrap
     * @param width
     */
    public static drawText(
        ctx: Canvas.CanvasRenderingContext2D,
        text: string,
        pos: number[],
        font: string,
        align: CanvasTextAlign,
        color: string,
        width?: number,
        wrap: boolean = false
    ): void {
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = color;

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

            lines.push(curLine);

            newHeight -= lineHeight * lines.length / 2;

            for (const line of lines) {
                ctx.fillText(line, pos[0], newHeight);
                newHeight += lineHeight;
            }
        } else if (width != undefined) {
            while (ctx.measureText(text).width > width) {
                font = (parseInt(font)-1) + font.substring(font.indexOf('px'));
                ctx.font = font;
            }
            ctx.textBaseline = 'middle';
            ctx.fillText(text, pos[0], pos[1]);
        } else {
            ctx.fillText(text, pos[0], pos[1]);
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
        ctx.clip();
        ctx.drawImage(img, pos[0], pos[1], diameter, diameter);
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