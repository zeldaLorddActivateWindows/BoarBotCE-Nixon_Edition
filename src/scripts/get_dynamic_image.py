#***********************************************
# get_dynamic_image.ts
# Applies images and text on top of and below
# GIF files while maintaining animation.
#
# Copyright 2023 WeslayCodes
# License Info: http://www.apache.org/licenses/
#***********************************************

from PIL import Image, ImageSequence, ImageFont, ImageDraw, ImageChops
import base64
from io import BytesIO
import requests  # used to get input from pyshell send in TS file
import json
import sys
import numpy as np

# Get config file
with open('config.json') as file:
    config = json.load(file)

# Config folder path aliases
assets_path = config['paths']['assets']
other_path = assets_path['other']
announce_add_path = assets_path['announceAdd']

# Specific config folder path aliases
font_path = other_path['basePath'] + other_path['font']
base_announce_add_path = announce_add_path['basePath']
overlay_path = base_announce_add_path + announce_add_path['overlay']
circle_mask_path = base_announce_add_path + announce_add_path['circleMask']
nameplate_path = base_announce_add_path + announce_add_path['nameplate']
underlay_path = base_announce_add_path + announce_add_path['underlay']
backplate_path = base_announce_add_path + announce_add_path['backplate']

# Inputs from JS
hex_color = sys.argv[1]
main_image_path = sys.argv[2]
avatar_url = sys.argv[3]
user_tag = sys.argv[4]
title = sys.argv[5]
name = sys.argv[6]
is_boar = sys.argv[7]

# Colors for image
fontColor = config['hexColors']['font']

# Font information
nums_general = config['numbers']['general']
bigFont = nums_general['fontSizes']['big'] // 2
mediumFont = nums_general['fontSizes']['medium'] // 2
text_big = ImageFont.truetype(font_path, bigFont)
text_medium = ImageFont.truetype(font_path, mediumFont)

# Positioning and size information
announce_add_nums = config['numbers']['announceAdd']
image_size = tuple(np.floor_divide(announce_add_nums['imageSize'], 2))
avatar_size = (announce_add_nums['userAvatarWidth'] // 2, announce_add_nums['userAvatarWidth'] // 2)
nameplate_padding = announce_add_nums['nameplatePadding'] // 2
nameplate_height = announce_add_nums['nameplateHeight'] // 2

if not is_boar:
    main_image_size = tuple(np.floor_divide(announce_add_nums['badgeSize'], 2))
    main_image_pos = tuple(np.floor_divide(announce_add_nums['badgePos'], 2))
else:
    main_image_size = tuple(np.floor_divide(announce_add_nums['boarSize'], 2))
    main_image_pos = tuple(np.floor_divide(announce_add_nums['boarPos'], 2))

nameplate_pos = tuple(np.floor_divide(announce_add_nums['nameplatePos'], 2))
user_avatar_pos = tuple(np.floor_divide(announce_add_nums['userAvatarPos'], 2))
title_pos = tuple(np.floor_divide(announce_add_nums['titlePos'], 2))
name_pos = tuple(np.floor_divide(announce_add_nums['namePos'], 2))
user_tag_pos = tuple(np.floor_divide(announce_add_nums['userTagPos'], 2))

underlay_mask = Image.open(underlay_path)\
    .convert('RGBA')\
    .resize(image_size)
main_image = Image.open(main_image_path)
overlay_image = Image.open(overlay_path)\
    .convert('RGBA')\
    .resize(image_size)

underlay_color = Image.new('RGBA', image_size, color=hex_color)
underlay_color.putalpha(
    underlay_mask.getchannel('A').convert('L')
)

circle_mask = Image.open(circle_mask_path)\
    .convert('RGBA')\
    .resize(avatar_size)
user_avatar = Image.open(BytesIO(requests.get(avatar_url).content))\
    .convert('RGBA')\
    .resize(avatar_size)
user_avatar.putalpha(
    ImageChops.multiply(user_avatar.getchannel('A'), circle_mask.getchannel('A')).convert('L')
)

nameplate = Image.open(nameplate_path).convert('RGBA').resize(
    (int(text_medium.getlength(user_tag)) + nameplate_padding, nameplate_height)
)

backplate = Image.open(backplate_path)\
    .convert('RGBA')\
    .resize(image_size)

frames = []

for frame in ImageSequence.Iterator(main_image):
    new_frame = underlay_color.copy().convert('RGBA')
    new_frame.paste(backplate, mask=overlay_image)

    new_frame = new_frame.copy().convert('RGBA')
    frame = frame.copy().resize(main_image_size).convert('RGBA')
    new_frame.paste(frame, main_image_pos)

    new_frame = new_frame.copy().convert('RGBA')
    new_frame.paste(overlay_image, mask=overlay_image)

    new_frame = new_frame.copy().convert('RGBA')
    new_frame.paste(nameplate, nameplate_pos, mask=nameplate)

    new_frame = new_frame.copy().convert('RGBA')
    new_frame.paste(user_avatar, user_avatar_pos, mask=user_avatar)

    new_frame_draw = ImageDraw.Draw(new_frame)
    new_frame_draw.text(title_pos, title, fontColor, font=text_big, anchor='ms')
    new_frame_draw.text(name_pos, name, fontColor, font=text_medium, anchor='ms')
    new_frame_draw.text(
        user_tag_pos, user_tag.encode('utf-16').decode('utf-16'), fontColor, font=text_medium, anchor='ls'
    )

    frames.append(new_frame)

output = BytesIO()
frames[0].save(output, format='GIF', save_all=True, append_images=frames[1:], duration=100, loop=0, disposal=2)
img_data = output.getvalue()

print(str(base64.b64encode(img_data))[2:-1])
