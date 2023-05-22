################################################
# get_dynamic_image.ts
# Applies images and text on top of and below
# GIF files while maintaining animation.
#
# Copyright 2023 WeslayCodes
# License Info: http://www.apache.org/licenses/
################################################

from PIL import Image, ImageSequence, ImageFont, ImageDraw
import base64
from io import BytesIO
import json
import sys

# Inputs from JS

path_config = json.loads(sys.argv[1])
color_config = json.loads(sys.argv[2])
num_config = json.loads(sys.argv[3])
back_color_key = sys.argv[4]
main_image_path = sys.argv[5]
title = sys.argv[6]
name = sys.argv[7]
is_badge = sys.argv[8]

# Configured directory paths

item_assets = path_config['itemAssets']
other_assets = path_config['otherAssets']
temp_item_assets = path_config['tempItemAssets']

# Configured asset file paths

overlay_path = item_assets + path_config['itemOverlay']
underlay_path = item_assets + path_config['itemUnderlay']
backplate_path = item_assets + path_config['itemBackplate']
font_path = other_assets + path_config['mainFont']
main_image_name = main_image_path.split('/').pop().split('.')[0]

# Configured colors

font_color = color_config['font']
rarity_color = color_config[back_color_key]

# Setting font size from configurations

medium_font = num_config['fontMedium']
text_medium = ImageFont.truetype(font_path, medium_font)

# Setting image positioning and sizes from configurations

image_size = tuple(num_config['itemImageSize'])

if is_badge == 'true':
    item_size = tuple(num_config['itemBadgeSize'])
    item_pos = tuple(num_config['itemBadgePos'])
else:
    item_size = tuple(num_config['itemBoarSize'])
    item_pos = tuple(num_config['itemBoarPos'])

title_pos = tuple(num_config['itemTitlePos'])
name_pos = tuple(num_config['itemNamePos'])

# Opening, converting, and resizing asset files

underlay_mask = Image.open(underlay_path).convert('RGBA').resize(image_size)
main_image = Image.open(main_image_path)
overlay_image = Image.open(overlay_path).convert('RGBA').resize(image_size)

underlay_color = Image.new('RGBA', image_size, color=rarity_color)
underlay_color.putalpha(underlay_mask.getchannel('A').convert('L'))

backplate = Image.open(backplate_path).convert('RGBA').resize(image_size)

# Stores all newly processed frames
frames = []

# Loops through each animation frame, applying overlays, underlays, and text
for frame in ImageSequence.Iterator(main_image):
    # Places the background/trim color

    new_frame = underlay_color.copy().convert('RGBA')
    new_frame.paste(backplate, mask=backplate)

    # Places the item image

    new_frame = new_frame.copy().convert('RGBA')
    frame = frame.copy().resize(item_size).convert('RGBA')
    new_frame.paste(frame, item_pos)

    # Places the overlay image

    new_frame = new_frame.copy().convert('RGBA')
    new_frame.paste(overlay_image, mask=overlay_image)

    # Places all text on the image

    new_frame_draw = ImageDraw.Draw(new_frame)
    new_frame_draw.text(title_pos, title, font_color, font=text_medium, anchor='ms')
    new_frame_draw.text(name_pos, name, rarity_color, font=text_medium, anchor='ms')

    frames.append(new_frame.resize((int(image_size[0] / 3), int(image_size[1] / 3))))

# Formatting the result to work with JS

output = BytesIO()
frames[0].save(output, format='GIF', save_all=True, append_images=frames[1:], duration=main_image.info['duration'], loop=0, disposal=2)
img_data = output.getvalue()

# Sends the result to JS
print(str(base64.b64encode(img_data))[2:-1])
