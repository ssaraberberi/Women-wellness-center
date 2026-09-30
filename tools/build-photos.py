#!/usr/bin/env python3
"""Cut the studio's own photographs into the sizes each slot needs.

Sources are the originals as supplied; nothing is upscaled, so where a
photograph is smaller than the slot used to be, the slot gets smaller
rather than softer.

    python3 tools/build-photos.py <dir-with-originals>
"""
import sys, os
from PIL import Image, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = 'assets/img'

# name, source, width, height, vertical focus (0 top .. 1 bottom), horizontal focus
JOBS = [
    # hero — the widest photograph, at its own resolution
    ('hero-reformer-1700.jpg',        '1c291f84-image.png', 1700, 887,  0.50),
    ('hero-reformer-1100.jpg',        '1c291f84-image.png', 1100, 574,  0.50),
    ('hero-reformer-mobile-900.jpg',  '08a72316-image.png',  900, 1598, 0.50),
    # the idea — the wide daylight room, and an evening correction
    ('studio-reformers-1400.jpg',     '7528c0f2-image.png', 1400, 1050, 0.50),
    ('studio-correction-1000.jpg',    '5a95efe9-image.jpg', 1000, 1250, 0.56),
    # rituals card, and the pinned image beside the scrolling words
    ('reformer-evening-1200.jpg',     'ea9b5f05-image.jpg', 1200, 1500, 0.46),
    # The pinned frame beside the scrolling words is nearly square, not tall.
    # It squares the tall daylight frame, held high enough to keep the woman
    # crossing the room, the wall behind her and the tops of the reformers.
    ('reformer-room-900.jpg',         '08a72316-image.png',  900, 900,  0.32),
]


def cover(im, w, h, focus, focus_x=0.5):
    """Fill w×h, cropping around (focus_x, focus) rather than the middle."""
    sw, sh = im.size
    scale = max(w / sw, h / sh)
    nw, nh = round(sw * scale), round(sh * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    left = max(0, min(nw - w, round((nw - w) * focus_x)))
    top = max(0, min(nh - h, round((nh - h) * focus)))
    return im.crop((left, top, left + w, top + h))


def main():
    os.makedirs(OUT, exist_ok=True)
    for job in JOBS:
        name, src, w, h, focus = job[:5]
        focus_x = job[5] if len(job) > 5 else 0.5
        path = os.path.join(SRC, src)
        im = Image.open(path).convert('RGB')
        sw, sh = im.size
        # Never ask for more pixels than the photograph has: shrink the slot
        # to the largest box of the same shape that fits inside the source.
        shrink = min(1.0, sw / w, sh / h)
        tw, th = round(w * shrink), round(h * shrink)
        if shrink < 1:
            print('  · %s capped to %dx%d by a %dx%d source' % (name, tw, th, sw, sh))
        out = cover(im, tw, th, focus, focus_x)
        out = out.filter(ImageFilter.UnsharpMask(radius=1.1, percent=62, threshold=3))
        dest = os.path.join(OUT, name)
        out.save(dest, 'JPEG', quality=84, optimize=True, progressive=True, subsampling=1)
        print('  %-34s %dx%d  %5.0f KB' % (name, out.width, out.height, os.path.getsize(dest) / 1024))


if __name__ == '__main__':
    main()
