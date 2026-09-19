#!/usr/bin/env python3
"""Cut the DUA logo out of the supplied artwork as alpha masks.

The brand artwork arrives as flat two-colour PNGs (wine on cream). Keying the
cream out leaves a clean anti-aliased coverage mask, which the stylesheet paints
with `mask-image` + `currentColor` — so one asset renders the mark in any colour
and follows the navigation as it flips between the hero and the scrolled state.

    python3 tools/build-logo.py <source.png>
"""
import sys
from PIL import Image
import numpy as np

CREAM = np.array([255, 251, 234], np.float32)
WINE = np.array([125, 47, 73], np.float32)
CUT = 0.06                      # ink threshold used to find the bounding boxes

# (destination, first band, last band) — band 0 is DUA, band 1 the descriptor
TARGETS = [
    ('assets/img/logo-dua-lockup.png', 0, 1),
    ('assets/img/logo-dua-mark.png', 0, 0),
]


def bands(mask):
    rows = mask.sum(axis=1)
    out, start = [], None
    for y, n in enumerate(rows):
        if n > 0 and start is None:
            start = y
        elif n == 0 and start is not None:
            out.append((start, y - 1))
            start = None
    if start is not None:
        out.append((start, len(rows) - 1))
    return out


def main(src):
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    alpha = (((CREAM - rgb) / (CREAM - WINE)).mean(axis=2)).clip(0, 1)
    mask = alpha > CUT
    bs = bands(mask)
    if len(bs) < 2:
        raise SystemExit('expected a wordmark and a descriptor, found %d band(s)' % len(bs))

    for dest, first, last in TARGETS:
        top, bottom = bs[first][0], bs[last][1]
        strip = mask[top:bottom + 1]
        cols = np.where(strip.any(axis=0))[0]
        box = alpha[top:bottom + 1, cols.min():cols.max() + 1]

        h, w = box.shape
        out = np.zeros((h, w, 4), np.uint8)
        out[..., :3] = 255                       # white ink; CSS supplies the colour
        out[..., 3] = (box * 255).round().astype(np.uint8)
        Image.fromarray(out, 'RGBA').save(dest, optimize=True)
        print('wrote %s (%dx%d)' % (dest, w, h))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'logo.png')
