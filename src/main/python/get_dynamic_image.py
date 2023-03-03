################################################
# get_dynamic_image.ts
# Applies images and text on top of and below
# GIF files while maintaining animation.
#
# Copyright 2023 WeslayCodes
# License Info: http://www.apache.org/licenses/
################################################

from PIL import Image, ImageSequence, ImageFont, ImageDraw, ImageChops
import base64
from io import BytesIO
import requests  # used to get input from pyshell send in TS file
import json
import sys
import numpy as np

# Inputs from JS

config = json.loads(sys.argv[1])
back_color = sys.argv[2]
main_image_path = sys.argv[3]
avatar_url = sys.argv[4]
user_tag = sys.argv[5]
title = sys.argv[6]
name = sys.argv[7]
is_boar = sys.argv[8]

# Configured directory paths

path_config = config['pathConfig']
item_assets = path_config['itemAssets']
other_assets = path_config['otherAssets']

# Configured asset file paths

overlay_path = item_assets + path_config['itemOverlay']
nameplate_path = item_assets + path_config['itemNameplate']
underlay_path = item_assets + path_config['itemUnderlay']
backplate_path = item_assets + path_config['itemBackplate']
circle_mask_path = other_assets + path_config['circleMask']
font_path = other_assets + path_config['mainFont']

# Configured font color

fontColor = config['colorConfig']['font']

# Number configurations

num_config = config['numberConfig']

# Setting font size from configurations

bigFont = num_config['fontBig'] // 2
mediumFont = num_config['fontMedium'] // 2
text_big = ImageFont.truetype(font_path, bigFont)
text_medium = ImageFont.truetype(font_path, mediumFont)

# Setting image positioning and sizes from configurations

image_size = tuple(np.floor_divide(num_config['itemImageSize'], 2))
avatar_size = (num_config['itemUserAvatarWidth'] // 2, num_config['itemUserAvatarWidth'] // 2)
nameplate_padding = num_config['itemNameplatePadding'] // 2
nameplate_height = num_config['itemNameplateHeight'] // 2

if not is_boar:
    item_size = tuple(np.floor_divide(num_config['itemBadgeSize'], 2))
    item_pos = tuple(np.floor_divide(num_config['itemBadgePos'], 2))
else:
    item_size = tuple(np.floor_divide(num_config['itemBoarSize'], 2))
    item_pos = tuple(np.floor_divide(num_config['itemBoarPos'], 2))

nameplate_pos = tuple(np.floor_divide(num_config['itemNameplatePos'], 2))
user_avatar_pos = tuple(np.floor_divide(num_config['itemUserAvatarPos'], 2))
title_pos = tuple(np.floor_divide(num_config['itemTitlePos'], 2))
name_pos = tuple(np.floor_divide(num_config['itemNamePos'], 2))
user_tag_pos = tuple(np.floor_divide(num_config['itemUserTagPos'], 2))

# Opening, converting, and resizing asset files

underlay_mask = Image.open(underlay_path).convert('RGBA').resize(image_size)
main_image = Image.open(main_image_path)
overlay_image = Image.open(overlay_path).convert('RGBA').resize(image_size)

underlay_color = Image.new('RGBA', image_size, color=back_color)
underlay_color.putalpha(underlay_mask.getchannel('A').convert('L'))

circle_mask = Image.open(circle_mask_path).convert('RGBA').resize(avatar_size)
user_avatar = Image.open(BytesIO(requests.get(avatar_url).content)).convert('RGBA').resize(avatar_size)
user_avatar.putalpha(ImageChops.multiply(user_avatar.getchannel('A'), circle_mask.getchannel('A')).convert('L'))

# Adjusts nameplate width according to user's tag length
nameplate = Image.open(nameplate_path).convert('RGBA').resize(
    (int(text_medium.getlength(user_tag)) + nameplate_padding, nameplate_height)
)

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

    # Places the nameplate image

    new_frame = new_frame.copy().convert('RGBA')
    new_frame.paste(nameplate, nameplate_pos, mask=nameplate)

    # Places the user avatar image

    new_frame = new_frame.copy().convert('RGBA')
    new_frame.paste(user_avatar, user_avatar_pos, mask=user_avatar)

    # Places all text on the image

    new_frame_draw = ImageDraw.Draw(new_frame)
    new_frame_draw.text(title_pos, title, fontColor, font=text_big, anchor='ms')
    new_frame_draw.text(name_pos, name, fontColor, font=text_medium, anchor='ms')
    new_frame_draw.text(
        user_tag_pos, user_tag.encode('utf-16').decode('utf-16'), fontColor, font=text_medium, anchor='ls'
    )

    frames.append(new_frame)

# Formatting the result to work with JS

output = BytesIO()
frames[0].save(output, format='GIF', save_all=True, append_images=frames[1:], duration=100, loop=0, disposal=2)
img_data = output.getvalue()

# Sends the result to JS
print(str(base64.b64encode(img_data))[2:-1])
