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

# Inputs from JS

config = json.loads(sys.argv[1])
back_color_key = sys.argv[2]
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
temp_item_assets = path_config['tempItemAssets']

# Configured asset file paths

overlay_path = item_assets + path_config['itemOverlay']
nameplate_path = item_assets + path_config['itemNameplate']
underlay_path = item_assets + path_config['itemUnderlay']
backplate_path = item_assets + path_config['itemBackplate']
circle_mask_path = other_assets + path_config['circleMask']
font_path = other_assets + path_config['mainFont']
main_image_name = main_image_path.split('/').pop().split('.')[0]

# Configured colors

font_color = config['colorConfig']['font']
back_color = config['colorConfig'][back_color_key]

# Number configurations

num_config = config['numberConfig']

# Setting font size from configurations

big_font = num_config['fontBig']
medium_font = num_config['fontMedium']
text_big = ImageFont.truetype(font_path, medium_font)
text_medium = ImageFont.truetype(font_path, medium_font)

# Setting image positioning and sizes from configurations

image_size = tuple(num_config['itemImageSize'])
avatar_size = (num_config['itemUserAvatarWidth'], num_config['itemUserAvatarWidth'])
nameplate_padding = num_config['itemNameplatePadding']
nameplate_height = num_config['itemNameplateHeight']

if not is_boar:
    item_size = tuple(num_config['itemBadgeSize'])
    item_pos = tuple(num_config['itemBadgePos'])
else:
    item_size = tuple(num_config['itemBoarSize'])
    item_pos = tuple(num_config['itemBoarPos'])

nameplate_pos = tuple(num_config['itemNameplatePos'])
user_avatar_pos = tuple(num_config['itemUserAvatarPos'])
title_pos = tuple(num_config['itemTitlePos'])
name_pos = tuple(num_config['itemNamePos'])
user_tag_pos = tuple(num_config['itemUserTagPos'])

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
    new_frame_draw.text(title_pos, title, font_color, font=text_big, anchor='ms')
    new_frame_draw.text(name_pos, name, font_color, font=text_medium, anchor='ms')
    new_frame_draw.text(
        user_tag_pos, user_tag.encode('utf-16').decode('utf-16'), font_color, font=text_medium, anchor='ls'
    )

    frames.append(new_frame.resize((int(image_size[0] / 3), int(image_size[1] / 3))))

# Formatting the result to work with JS

output = BytesIO()
frames[0].save(output, format='GIF', save_all=True, append_images=frames[1:], duration=100, loop=0, disposal=2)
img_data = output.getvalue()

# Sends the result to JS
print(str(base64.b64encode(img_data))[2:-1])
