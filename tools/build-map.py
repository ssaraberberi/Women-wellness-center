#!/usr/bin/env python3
"""Build the static fallback map for the location section.

Stitches OpenStreetMap tiles around Sheshi Wilson into one image, tones it to
match the palette and drops a marker on the studio. Run again to regenerate:

    python3 tools/build-map.py
"""
import io, math, os, urllib.request
from PIL import Image, ImageDraw, ImageEnhance

LAT, LON, ZOOM = 41.3185, 19.8145, 17
OUT_W, OUT_H = 1280, 880                      # 16:11, matches .findus__frame
DEST = 'assets/img/map-sheshi-wilson-1280.jpg'
UA = 'beci-studio-site/1.0 (static map asset; contact hello@beci.al)'


def deg2tile(lat, lon, z):
    n = 2.0 ** z
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    y = (1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n
    return x, y


def fetch(z, x, y):
    url = 'https://tile.openstreetmap.org/%d/%d/%d.png' % (z, x, y)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')


def main():
    cx, cy = deg2tile(LAT, LON, ZOOM)
    # tile range covering the output box, centred on the studio
    half_w, half_h = OUT_W / 512.0, OUT_H / 512.0
    x0, x1 = math.floor(cx - half_w), math.ceil(cx + half_w)
    y0, y1 = math.floor(cy - half_h), math.ceil(cy + half_h)

    sheet = Image.new('RGB', ((x1 - x0) * 256, (y1 - y0) * 256), '#efe7e2')
    for tx in range(x0, x1):
        for ty in range(y0, y1):
            sheet.paste(fetch(ZOOM, tx, ty), ((tx - x0) * 256, (ty - y0) * 256))

    # crop so the studio sits dead centre
    px, py = (cx - x0) * 256, (cy - y0) * 256
    box = (round(px - OUT_W / 2), round(py - OUT_H / 2),
           round(px + OUT_W / 2), round(py + OUT_H / 2))
    img = sheet.crop(box)

    # warm it towards the studio palette
    img = ImageEnhance.Color(img).enhance(0.34)
    img = ImageEnhance.Brightness(img).enhance(1.04)
    wash = Image.new('RGB', img.size, (255, 238, 232))
    img = Image.blend(img, wash, 0.20)

    # marker on the studio
    d = ImageDraw.Draw(img, 'RGBA')
    mx, my = OUT_W // 2, OUT_H // 2
    d.ellipse([mx - 26, my - 26, mx + 26, my + 26], fill=(217, 167, 158, 70))
    d.ellipse([mx - 11, my - 11, mx + 11, my + 11], fill=(46, 33, 36, 255))
    d.ellipse([mx - 4, my - 4, mx + 4, my + 4], fill=(255, 255, 255, 255))

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    img.save(DEST, 'JPEG', quality=86, optimize=True, progressive=True)
    print('wrote %s (%dx%d)' % (DEST, img.width, img.height))


if __name__ == '__main__':
    main()
