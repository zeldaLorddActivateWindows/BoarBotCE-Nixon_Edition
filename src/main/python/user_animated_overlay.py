################################################
# user_animated_overlay.ts
# Applies user info on top of item image.
#
# Copyright 2023 WeslayCodes
# License Info: http://www.apache.org/licenses/
################################################

from PIL import Image, ImageSequence, ImageFont, ImageDraw, ImageChops
import numpy as np
import base64
from io import BytesIO
import requests  # used to get input from pyshell send in TS file
import json
import sys

# Inputs from JS

path_config = json.loads(sys.argv[1])
color_config = json.loads(sys.argv[2])
num_config = json.loads(sys.argv[3])
image_path = sys.argv[4]
avatar_url = sys.argv[5]
user_tag = sys.argv[6]
score = sys.argv[7]

# Configured directory paths

item_assets = path_config['itemAssets']
other_assets = path_config['otherAssets']
temp_item_assets = path_config['tempItemAssets']

# Configured asset file paths

circle_mask_path = other_assets + path_config['circleMask']
font_path = other_assets + path_config['mainFont']

# Configured colors

font_color = color_config['font']
bucks_color = color_config['bucks']

# Setting font size from configurations

small_medium_font = num_config['fontSmallMedium'] // 3
text_small_medium = ImageFont.truetype(font_path, small_medium_font)

# Setting image positioning and sizes from configurations

avatar_size = (num_config['itemUserAvatarWidth'] // 3, num_config['itemUserAvatarWidth'] // 3)

user_avatar_pos = tuple(np.floor_divide(num_config['itemUserAvatarPos'], 3))
user_tag_pos = tuple(np.floor_divide(num_config['itemUserTagPos'], 3))
user_box_pos = tuple(np.floor_divide(num_config['itemUserBoxPos'], 3))
user_box_extra = num_config['itemUserBoxExtra'] // 3
bucks_pos = tuple(np.floor_divide(num_config['itemBucksPos'], 3))
bucks_box_pos = tuple(np.floor_divide(num_config['itemBucksBoxPos'], 3))
bucks_box_extra = num_config['itemBucksBoxExtra'] // 3
box_height = num_config['itemBoxHeight'] // 3

# Opening, converting, and resizing asset files

image = Image.open(image_path)

circle_mask = Image.open(circle_mask_path).convert('RGBA').resize(avatar_size)
user_avatar = Image.open(BytesIO(requests.get(avatar_url).content)).convert('RGBA').resize(avatar_size)
user_avatar.putalpha(ImageChops.multiply(user_avatar.getchannel('A'), circle_mask.getchannel('A')).convert('L'))

# Stores all newly processed frames
frames = []

# Loops through each animation frame, applying overlays, underlays, and text
for frame in ImageSequence.Iterator(image):
    # Places the nameplate image

    new_frame = frame.copy().convert('RGBA')
    new_frame_draw = ImageDraw.Draw(new_frame)
    new_frame_draw.rounded_rectangle(
        xy=(
            user_box_pos[0]+1, user_box_pos[1],
            user_box_pos[0]+text_small_medium.getlength(user_tag)+user_box_extra,
            user_box_pos[1]+box_height
        ), radius=25/3, fill='#151518'
    )
    new_frame_draw.text(
        user_tag_pos, user_tag.encode('utf-16').decode('utf-16'), font_color, font=text_small_medium, anchor='ls'
    )

    if score != '':
        new_frame_draw.rounded_rectangle(
            xy=(
                bucks_box_pos[0]+1, bucks_box_pos[1],
                bucks_box_pos[0]+text_small_medium.getlength('+$' + score)+bucks_box_extra,
                bucks_box_pos[1]+box_height
            ), radius=25/3, fill='#151518'
        )
        new_frame_draw.text(
            bucks_pos, '+', font_color, font=text_small_medium, anchor='ls'
        )
        new_frame_draw.text(
            (bucks_pos[0] + text_small_medium.getlength('+'),
             bucks_pos[1]), '$', bucks_color, font=text_small_medium, anchor='ls'
        )
        new_frame_draw.text(
            (bucks_pos[0] + text_small_medium.getlength('+$'),
             bucks_pos[1]), score, font_color, font=text_small_medium, anchor='ls'
        )

    # Places the user avatar image

    new_frame = new_frame.copy().convert('RGBA')
    new_frame.paste(user_avatar, user_avatar_pos, mask=user_avatar)

    frames.append(new_frame)

# Formatting the result to work with JS

output = BytesIO()
frames[0].save(output, format='GIF', save_all=True, append_images=frames[1:], loop=0, disposal=2)
img_data = output.getvalue()

# Sends the result to JS
print(str(base64.b64encode(img_data))[2:-1])
