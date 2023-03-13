#***********************************************
# verify_config.ts
# Verifies that the config file has no potential
# issues.
#
# Copyright 2023 WeslayCodes
# License Info: http://www.apache.org/licenses/
#***********************************************


import json

with open('config.json') as file:
    config = json.load(file)

rarities = config['raritiesInfo']
boarIDs = config['boarIDs']
badgeIDs = config['badgeIDs']

paths = config['paths']

assetsFolder = paths['assets']
boarFolder = assetsFolder['boars']
badgeFolder = assetsFolder['badges']
dailyFolder = assetsFolder['announceAdd']['basePath']
collectionFolder = assetsFolder['collection']['basePath']
otherFolder = assetsFolder['other']['basePath']
scriptsFolder = paths['scripts']['basePath']

dailyAssets = assetsFolder['announceAdd']
collectionAssets = assetsFolder['collection']
otherAssets = assetsFolder['other']
scripts = paths['scripts']
globalFile = paths['data']['globalFile']

hexColorsKeys = config['hexColors'].keys()

verified_boars = []
verified_rarity_colors = []

for rarity in rarities.keys():
    boars = rarities[rarity]['boars']
    for boar in boars:
        if boar not in boarIDs.keys():
            print(f'Invalid boar ID \'{boar}\' found used in rarities')
            continue
        if boar in verified_boars:
            print(f'Boar ID \'{boar}\' is used more than once')
            continue
        verified_boars.append(boar)
    for key in hexColorsKeys:
        if key == rarity:
            verified_rarity_colors.append(key)

for rarity in rarities.keys():
    if rarity not in verified_rarity_colors:
        print(f'Rarity \'{rarity}\' has no color assigned')

for boar in boarIDs:
    if boar not in verified_boars:
        print(f'Unused boar ID \'{boar}\'')
    try:
        open(boarFolder + config['boarIDs'][boar]['file'])
    except:
        print(f'Boar \'{boar}\' references an invalid file path')

for badge in badgeIDs:
    try:
        open(badgeFolder + config['badgeIDs'][badge]['file'])
    except:
        print(f'Badge \'{badge}\' references an invalid file path')

if 'badge_hunter' not in badgeIDs.keys():
    print(f'Hunter badge ID is wrong!')

for asset in dailyAssets.keys():
    if asset == 'basePath':
        continue

    try:
        open(dailyFolder + dailyAssets[asset])
    except:
        print(f'Asset \'{asset}\' references an invalid file path')

for asset in collectionAssets.keys():
    if asset == 'basePath':
        continue

    try:
        open(collectionFolder + collectionAssets[asset])
    except:
        print(f'Asset \'{asset}\' references an invalid file path')

for asset in otherAssets.keys():
    if asset == 'basePath':
        continue

    try:
        open(otherFolder + otherAssets[asset])
    except:
        print(f'Asset \'{asset}\' references an invalid file path')

for script in scripts.keys():
    if script == 'basePath':
        continue

    try:
        open(scriptsFolder + scripts[script])
    except:
        print(f'Script \'{script}\' references an invalid file path')

try:
    open(globalFile)
except:
    print(f'Global file references an invalid path')
