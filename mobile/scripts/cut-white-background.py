"""
Makes the white background of a pixel-art GIF transparent for the lyric interludes (src/interludes.ts): fills from
the edges through white, so whites inside the character (eyes, highlights) stay; crops every frame to one box
around the character in all frames, snapped to the art's pixel grid; brings the art down to one real pixel per
art pixel (`grid`: how many image pixels one art pixel takes, 3 for the Goku sprite; found by checking that
blocks of that size are all one colour) and scales it back up by a whole number (nearest neighbour, so the pixels
stay sharp and all the same size); saves a GIF with transparency.

    python scripts/cut-white-background.py in.gif preview.png out.gif [scale] [grid]

Needs Pillow (pip install pillow).
"""
import sys
from collections import deque
from PIL import Image

src, preview, out = sys.argv[1], sys.argv[2], sys.argv[3]
scale = int(sys.argv[4]) if len(sys.argv) > 4 else 2
grid = int(sys.argv[5]) if len(sys.argv) > 5 else 1

im = Image.open(src)
W, H = im.size
frames, durations = [], []
for f in range(im.n_frames):
    im.seek(f)
    frames.append(im.convert("RGB"))
    durations.append(im.info.get("duration", 100))

def is_white(p):
    return p[0] >= 246 and p[1] >= 246 and p[2] >= 246

masks = []  # True = background
for fr in frames:
    px = fr.load()
    bg = bytearray(W * H)
    q = deque((x, y) for x in range(W) for y in (0, H - 1))
    q.extend((x, y) for y in range(H) for x in (0, W - 1))
    while q:
        x, y = q.popleft()
        i = y * W + x
        if bg[i] or not is_white(px[x, y]):
            continue
        bg[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < W - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < H - 1: q.append((x, y + 1))
    masks.append(bg)

boxes = []
for bg in masks:
    m = Image.frombytes("L", (W, H), bytes(0 if v else 255 for v in bg))
    boxes.append(m.getbbox())
print("boxes per frame", boxes)
box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
box = (box[0] // grid * grid, box[1] // grid * grid, min(W, -(-box[2] // grid) * grid), min(H, -(-box[3] // grid) * grid))
art = ((box[2] - box[0] + grid - 1) // grid, (box[3] - box[1] + grid - 1) // grid)
size = (art[0] * scale, art[1] * scale)
print("box", box, "art pixels", art, "->", size)

outs = []
for fr, bg in zip(frames, masks):
    rgba = fr.convert("RGBA")
    rgba.putalpha(Image.frombytes("L", (W, H), bytes(0 if v else 255 for v in bg)))
    outs.append(rgba.crop(box).resize(art, Image.Resampling.NEAREST).resize(size, Image.Resampling.NEAREST))

sheet = Image.new("RGB", (size[0] * 6, size[1] * 2), (150, 20, 30))
for i, o in enumerate(outs[:12]):
    sheet.paste(o, ((i % 6) * size[0], (i // 6) * size[1]), o)
sheet.save(preview)

def to_p(c):
    # 255 colours plus index 255 for transparency
    p = c.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    px, al = p.load(), c.getchannel("A").load()
    for y in range(c.height):
        for x in range(c.width):
            if al[x, y] < 128:
                px[x, y] = 255
    p.putpalette(p.getpalette()[:765] + [0, 0, 0])
    return p

ps = [to_p(o) for o in outs]
ps[0].save(out, save_all=True, append_images=ps[1:], duration=durations, loop=0, transparency=255, disposal=2, optimize=False)
print("saved", out, len(ps), "frames")
