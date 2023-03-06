/***********************************************
 * CanvasFunctions.ts
 * A collection of functions to make canvas
 * editing easier/cleaner.
 *
 * Copyright 2023 WeslayCodes
 * License Info: http://www.apache.org/licenses/
 ***********************************************/

import Canvas from 'canvas';

//***************************************

/**
 * Draws text onto CanvasRenderingContext
 * @param ctx - CanvasRenderingContext
 * @param text - Text to draw
 * @param pos - Position to place text
 * @param font - Font to use for text
 * @param align - Alignment of text
 * @param color - Color of text
 */
function drawText(ctx: Canvas.CanvasRenderingContext2D, text: string, pos: number[], font: string, align: CanvasTextAlign, color: string) {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.fillStyle = color;

    ctx.fillText(text, pos[0], pos[1]);
}

//***************************************

/**
 * Draws circle onto CanvasRenderingContext
 * @param ctx - CanvasRenderingContext
 * @param img - Image to convert into circle
 * @param pos - Position to place circle
 * @param diameter - Diameter of circle
 */
function drawCircleImage(ctx: Canvas.CanvasRenderingContext2D, img: Canvas.Image, pos: number[], diameter: number) {
    const radius = diameter / 2;

    ctx.beginPath();
    ctx.arc(pos[0] + radius, pos[1] + radius, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, pos[0], pos[1], diameter, diameter);
}

//***************************************

/**
 * Draws a line
 * @param ctx - CanvasRenderingContext
 * @param pos1 - Position the line starts at
 * @param pos2 - Position the line ends at
 * @param width - Width of the line
 * @param color - Color of the line
 */
function drawLine(ctx: Canvas.CanvasRenderingContext2D, pos1: number[], pos2: number[], width: number, color: string) {
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.strokeStyle = color;

    ctx.moveTo(pos1[0], pos1[1]);
    ctx.lineTo(pos2[0], pos2[1]);

    ctx.stroke();
}

//***************************************

/**
 * Draws a rectangle
 * @param ctx - CanvasRenderingContext
 * @param pos - Position of rectangle
 * @param size - Dimensions of rectangle
 * @param color - Color of rectangle
 */
function drawRect(ctx: Canvas.CanvasRenderingContext2D, pos: number[], size: number[], color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(pos[0], pos[1], size[0], size[1]);
}

//***************************************

/**
 * Image drawing but in a more compact function
 * @param ctx - CanvasRenderingContext
 * @param img - Image to draw
 * @param pos - Position of image
 * @param size - Dimensions of image
 */
function drawImageCompact(ctx: Canvas.CanvasRenderingContext2D, img: Canvas.Image | Canvas.Canvas, pos: number[], size: number[]) {
    ctx.drawImage(img, pos[0], pos[1], size[0], size[1]);
}

//***************************************

export {
    drawText,
    drawCircleImage,
    drawLine,
    drawRect,
    drawImageCompact
}