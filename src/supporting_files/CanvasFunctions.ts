/***********************************************
 * CanvasFunctions.ts
 * Weslay
 *
 * A collection of functions to make canvas
 * editing easier/cleaner
 ***********************************************/

import Canvas from 'canvas';

//***************************************

function drawText(ctx: Canvas.CanvasRenderingContext2D, text: string, pos: number[], font: string, align: CanvasTextAlign, color: string) {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.fillStyle = color;

    ctx.fillText(text, pos[0], pos[1]);
}

//***************************************

function drawCircle(ctx: Canvas.CanvasRenderingContext2D, img: Canvas.Image, pos: number[], width: number) {
    const radius = width / 2;

    ctx.beginPath();
    ctx.arc(pos[0] + radius, pos[1] + radius, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, pos[0], pos[1], width, width);
}

//***************************************

function drawLine(ctx: Canvas.CanvasRenderingContext2D, pos1: number[], pos2: number[], width: number, color: string) {
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.strokeStyle = color;

    ctx.moveTo(pos1[0], pos1[1]);
    ctx.lineTo(pos2[0], pos2[1]);

    ctx.stroke();
}

//***************************************

function drawRect(ctx: Canvas.CanvasRenderingContext2D, pos: number[], size: number[], color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(pos[0], pos[1], size[0], size[1]);
}

//***************************************

function drawImageCompact(ctx: Canvas.CanvasRenderingContext2D, img: Canvas.Image, pos: number[], size: number[]) {
    ctx.drawImage(img, pos[0], pos[1], size[0], size[1]);
}

//***************************************

export {
    drawText,
    drawCircle,
    drawLine,
    drawRect,
    drawImageCompact
}