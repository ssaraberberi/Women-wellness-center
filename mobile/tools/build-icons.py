#!/usr/bin/env python3
"""Cuts the store icons from the studio's own mark.

assets/img/logo-dua-mark.png at the repository root is an alpha mask (the
website paints it with currentColor). Here it is painted cream on wine, the
way app/icons/ already does for the home-screen app, at the sizes the two
stores ask for:

  icon.png                      1024 — iOS and the Play listing (no alpha on iOS)
  android-icon-foreground.png   1024 — the mark inside the adaptive safe zone
  android-icon-background.png   1024 — wine
  android-icon-monochrome.png   1024 — the mark alone, for themed icons
  splash-icon.png               1024 — the full lockup, cream, on transparent
  notification-icon.png          96  — white on transparent, as Android wants

Run from anywhere: python3 mobile/tools/build-icons.py
"""
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = HERE.parent / 'assets'
WINE = (125, 47, 73, 255)
CREAM = (255, 251, 234, 255)

def mask(name):
    return Image.open(ROOT / 'assets' / 'img' / name).convert('RGBA').getchannel('A')

def placed(alpha, size, width_frac, colour, bg=(0, 0, 0, 0)):
    """The mask scaled to a fraction of the canvas width, centred, painted."""
    w = int(size * width_frac)
    h = int(alpha.height * w / alpha.width)
    a = alpha.resize((w, h), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), bg)
    ink = Image.new('RGBA', (w, h), colour)
    canvas.paste(ink, ((size - w) // 2, (size - h) // 2), a)
    return canvas

mark = mask('logo-dua-mark.png')
lockup = mask('logo-dua-lockup.png')

placed(mark, 1024, 0.62, CREAM, WINE).convert('RGB').save(OUT / 'icon.png')
# Android crops adaptive icons to a circle of ~66% of the canvas.
placed(mark, 1024, 0.46, CREAM).save(OUT / 'android-icon-foreground.png')
Image.new('RGBA', (1024, 1024), WINE).save(OUT / 'android-icon-background.png')
placed(mark, 1024, 0.46, (255, 255, 255, 255)).save(OUT / 'android-icon-monochrome.png')
placed(lockup, 1024, 0.7, CREAM).save(OUT / 'splash-icon.png')
placed(mark, 96, 0.8, (255, 255, 255, 255)).save(OUT / 'notification-icon.png')
placed(mark, 196, 0.7, CREAM, WINE).save(OUT / 'favicon.png')
print('icons written to', OUT)
