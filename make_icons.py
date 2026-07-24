#!/usr/bin/env python3
"""むしずかん の アイコンを つくる（かわいい てんとうむし）。"""
from PIL import Image, ImageDraw
import math

S = 1024  # こうかいぞうどで えがいて あとで ちいさくする


def rounded_bg(draw, size, pad=0, radius_ratio=0.235):
    r = int(size * radius_ratio)
    # そらから くさへの グラデーション
    for y in range(size):
        t = y / size
        r1, g1, b1 = 0x6f, 0xd6, 0x8a   # あかるい みどり
        r2, g2, b2 = 0x1f, 0x7a, 0x44   # ふかい みどり
        col = (int(r1 + (r2 - r1) * t), int(g1 + (g2 - g1) * t), int(b1 + (b2 - b1) * t))
        draw.line([(0, y), (size, y)], fill=col)


def draw_leaf(d, cx, cy, size):
    # そこに はっぱ
    lw = size * 0.9
    lh = size * 0.34
    box = [cx - lw / 2, cy - lh / 2, cx + lw / 2, cy + lh / 2]
    d.ellipse(box, fill=(60, 150, 80))
    d.line([(cx - lw / 2 + 20, cy), (cx + lw / 2 - 20, cy)], fill=(40, 120, 60), width=8)


def draw_ladybug(d, cx, cy, r):
    black = (30, 28, 30)
    red = (233, 57, 70)
    # あし
    for dx in (-1, 1):
        for i, ay in enumerate((-0.35, 0.05, 0.45)):
            x1 = cx + dx * r * 0.55
            y1 = cy + r * ay
            x2 = cx + dx * (r * 1.15)
            y2 = cy + r * (ay - 0.28 + i * 0.28)
            d.line([(x1, y1), (x2, y2)], fill=black, width=int(r * 0.09))
    # あたま
    hr = r * 0.42
    d.ellipse([cx - hr, cy - r * 1.02, cx + hr, cy - r * 0.2], fill=black)
    # め
    er = r * 0.1
    for dx in (-1, 1):
        ex = cx + dx * hr * 0.5
        ey = cy - r * 0.72
        d.ellipse([ex - er, ey - er, ex + er, ey + er], fill=(255, 255, 255))
        d.ellipse([ex - er * 0.5, ey - er * 0.5, ex + er * 0.5, ey + er * 0.5], fill=black)
    # からだ（あかい ドーム）
    d.ellipse([cx - r, cy - r * 0.55, cx + r, cy + r * 1.25], fill=red)
    # まんなかの せん
    d.line([(cx, cy - r * 0.5), (cx, cy + r * 1.2)], fill=black, width=int(r * 0.08))
    # くろい ほし
    sp = r * 0.17
    for (px, py) in [(-0.45, 0.05), (0.45, 0.05), (-0.32, 0.6), (0.32, 0.6), (0, 0.95)]:
        d.ellipse([cx + px * r - sp, cy + py * r - sp, cx + px * r + sp, cy + py * r + sp], fill=black)
    # ハイライト
    hl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    hd.ellipse([cx - r * 0.7, cy - r * 0.35, cx - r * 0.25, cy + r * 0.3], fill=(255, 255, 255, 60))
    return hl


def build(masks_pad=False):
    img = Image.new("RGB", (S, S), (0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded_bg(d, S)
    # マスカブル ようは なかみを ちいさく（セーフゾーン）
    scale = 0.72 if masks_pad else 0.92
    cx, cy = S / 2, S / 2
    draw_leaf(d, cx, cy + S * 0.24 * scale, S * scale)
    hl = draw_ladybug(d, cx, cy - S * 0.03 * scale, S * 0.28 * scale)
    img = img.convert("RGBA")
    img.alpha_composite(hl)
    return img.convert("RGB")


def rounded_mask(size, radius_ratio=0.235):
    m = Image.new("L", (size, size), 0)
    dd = ImageDraw.Draw(m)
    r = int(size * radius_ratio)
    dd.rounded_rectangle([0, 0, size, size], radius=r, fill=255)
    return m


# --- ふつうの アイコン（かどまる）---
base = build(masks_pad=False)
mask = rounded_mask(S)
rounded = Image.new("RGBA", (S, S), (0, 0, 0, 0))
rounded.paste(base, (0, 0), mask)

for sz, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
    out = rounded.resize((sz, sz), Image.LANCZOS)
    if name == "apple-touch-icon.png":
        # iOS は じどうで かどを まるめるので しかくで OK
        flat = build(masks_pad=False).resize((sz, sz), Image.LANCZOS)
        flat.save(f"icons/{name}")
    else:
        out.save(f"icons/{name}")

# --- マスカブル（せいほうけい、ぜんめん、パディングあり）---
mask_full = build(masks_pad=True)
mask_full.resize((512, 512), Image.LANCZOS).save("icons/icon-maskable-512.png")

print("icons done")
