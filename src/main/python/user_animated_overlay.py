################################################
# user_animated_overlay.ts
# Applies user info on top of item image.
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
image_path = sys.argv[2]
avatar_url = sys.argv[3]
user_tag = sys.argv[4]

# Configured directory paths

path_config = config['pathConfig']
item_assets = path_config['itemAssets']
other_assets = path_config['otherAssets']
temp_item_assets = path_config['tempItemAssets']

# Configured asset file paths

nameplate_path = item_assets + path_config['itemNameplate']
circle_mask_path = other_assets + path_config['circleMask']
font_path = other_assets + path_config['mainFont']

# Configured colors

font_color = config['colorConfig']['font']

# Number configurations

num_config = config['numberConfig']

# Setting font size from configurations

medium_font = num_config['fontMedium']
text_medium = ImageFont.truetype(font_path, medium_font)

# Setting image positioning and sizes from configurations

image_size = tuple(num_config['itemImageSize'])
avatar_size = (num_config['itemUserAvatarWidth'], num_config['itemUserAvatarWidth'])
nameplate_padding = num_config['itemNameplatePadding']
nameplate_height = num_config['itemNameplateHeight']

nameplate_pos = tuple(num_config['itemNameplatePos'])
user_avatar_pos = tuple(num_config['itemUserAvatarPos'])
user_tag_pos = tuple(num_config['itemUserTagPos'])

# Opening, converting, and resizing asset files

image = Image.open(image_path)

circle_mask = Image.open(circle_mask_path).convert('RGBA').resize(avatar_size)
user_avatar = Image.open(BytesIO(requests.get(avatar_url).content)).convert('RGBA').resize(avatar_size)
user_avatar.putalpha(ImageChops.multiply(user_avatar.getchannel('A'), circle_mask.getchannel('A')).convert('L'))

# Adjusts nameplate width according to user's tag length
nameplate = Image.open(nameplate_path).convert('RGBA').resize(
    (int(text_medium.getlength(user_tag)) + nameplate_padding, nameplate_height)
)

# Stores all newly processed frames
frames = []

# Loops through each animation frame, applying overlays, underlays, and text
for frame in ImageSequence.Iterator(image):
    # Places the nameplate image

    new_frame = frame.copy().resize(image_size).convert('RGBA')
    new_frame.paste(nameplate, nameplate_pos, mask=nameplate)

    # Places the user avatar image

    new_frame = new_frame.copy().convert('RGBA')
    new_frame.paste(user_avatar, user_avatar_pos, mask=user_avatar)

    # Places user tag

    new_frame_draw = ImageDraw.Draw(new_frame)
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
