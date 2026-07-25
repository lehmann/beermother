import os
import glob
from pathlib import Path

import json_flatter

output = './data/recipes/'

recipes_path = './analyzer/simulation/**/request.json'
files = []
for file in glob.glob(recipes_path):
    files.append(Path(file))

for file in files:
    newfolder = output + file.parent.name
    if not os.path.exists(newfolder):
        os.makedirs(newfolder)

    json_flatter.convert_json_to_csv(file, Path(newfolder + '/request.csv'))

