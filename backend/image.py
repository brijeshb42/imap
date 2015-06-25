import os
import random
import string
import time
import re
from urlparse import urlparse
from base64 import decodestring

from cStringIO import StringIO

from PIL import Image
import requests

from config import Settings


IMG_DIR = "images"
IMG_DIR_ABS = os.path.join(
    os.path.dirname(
        os.path.dirname(os.path.realpath(__file__)),
    ),
    IMG_DIR
)

DATA_URI_EXT = "^data:image\/(png|jpeg|jpg|jpe|gif|webp);base64,.*$"
URL_REGEX = regex = re.compile(
    r'^(?:http|ftp)s?://'
    r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'
    r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|'
    r'\[?[A-F0-9]*:[A-F0-9:]+\]?)'
    r'(?::\d+)?'
    r'(?:/?|[/?]\S+)$', re.IGNORECASE)


def get_random_part():
    """Generate a random string of length 10."""
    random_pad = "".join(
        random.choice(string.ascii_lowercase) for i in range(10))
    time_s = int(time.time())
    return "%s-%d" % (random_pad, time_s)


def construct_image_file_name(url):
    """Return absolute path of the image to be saved in DATA_DIR."""
    disassembled = urlparse(url)
    filename, file_ext = os.path.splitext(
        os.path.basename(disassembled.path))
    file_ext = file_ext.lower()
    filename = "" + get_random_part()
    if file_ext == "" or file_ext not in [
            ".jpg", ".png", ".gif", ".jpeg", ".webp"]:
            file_ext = ".jpg"
    filename = filename + file_ext
    return file_ext


def crop_image(image, size, name, extension):
    x1 = int(round(size["x"]))
    y1 = int(round(size["y"]))
    x2 = int(round(size["x"]+size["width"]))
    y2 = int(round(size["y"]+size["height"]))
    new_width = int(round(size["origWidth"]))
    new_height = int(round(size["origHeight"]))
    region = image.crop((x1, y1, x2, y2))
    region.load()
    region.thumbnail((new_width, new_height), Image.ANTIALIAS)
    if extension in ["jpeg", "jpg", "jpe"]:
        format = "JPEG"
    elif extension == "gif":
        format = "GIF"
    elif extension == "png":
        format = "PNG"
    else:
        format = None
    region.save(os.path.join(
        IMG_DIR_ABS, name
        ),
        format=format,
        quality=90,
        optimize=True
    )


def save_image(content, extension, sizes):
    img = Image.open(
        StringIO(content))
    res = {}
    suffix = "-"+get_random_part()+"."+extension
    for key in sizes:
        crop_image(img, sizes[key], key+suffix, extension)
        res[key] = Settings.HOSTNAME + "/images/"+key+suffix
    return res


def download_from_url(url, sizes):
    if url.startswith("data:image/"):
        mtch = re.match(DATA_URI_EXT, url)
        if not mtch:
            return False, "Invalid file format."
        extension = mtch.groups()[0]
        return True, save_image(
            decodestring(url.split(",")[1]), extension, sizes)
    if URL_REGEX.match(url):
        extension = construct_image_file_name(url)
        img = requests.get(url)
        if img.status_code != 200:
            return False, "Not a valid image."
        return True, save_image(img.content, extension[1:], sizes)
    return False, "Not a valid URL."