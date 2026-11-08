"""
Cuts the background out of a pixel-art GIF for the lyric interludes (src/interludes.ts): fills from the edges
through the dark purple background colours, drops leftover specks of compression noise, crops all frames to one
square around the characters and saves a GIF with transparency.

    python scripts/cut-gif-background.py in.gif preview.png out.gif

The background test (`bg`) is tuned for otonoke.gif; another GIF needs its own colour ranges (check preview.png).
Needs Pillow (pip install pillow).
"""
import sys
from collections import deque
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src)
W, H = im.size

def bg(p):
    r, g, b = p
    return 38 <= r <= 82 and 26 <= g <= 56 and 38 <= b <= 76 and abs(r - b) <= 14 and r - g <= 30

frames, masks = [], []
for f in range(im.n_frames):
    im.seek(f)
    fr = im.convert("RGB")
    px = fr.load()
    seen = bytearray(W * H)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        i = y * W + x
        if seen[i] or not bg(px[x, y]):
            continue
        seen[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < W - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < H - 1: q.append((x, y + 1))
    frames.append(fr)
    masks.append(seen)


MIN = 80  # opaque blobs smaller than this many pixels are compression noise, not part of the characters
for m in masks:
    lab = bytearray(W * H)
    for start in range(W * H):
        if m[start] or lab[start]:
            continue
        comp, q = [], deque([start])
        lab[start] = 1
        while q:
            i = q.popleft(); comp.append(i)
            x, y = i % W, i // W
            for j in ((i - 1) if x > 0 else -1, (i + 1) if x < W - 1 else -1, (i - W) if y > 0 else -1, (i + W) if y < H - 1 else -1):
                if j >= 0 and not m[j] and not lab[j]:
                    lab[j] = 1; q.append(j)
        if len(comp) < MIN:
            for i in comp: m[i] = 1

# one crop box for all frames, square, with a small margin, so the characters do not jump
xs, ys = [], []
for m in masks:
    for i, v in enumerate(m):
        if not v: xs.append(i % W); ys.append(i // W)
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
side = max(x1 - x0, y1 - y0) + 8
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
box = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)
print("box", box)

im.seek(0)
durations = []
for f in range(im.n_frames):
    im.seek(f); durations.append(im.info.get("duration", 100))
out_frames, prev = [], Image.new("RGB", (side * 3, side * 2), (0, 200, 0))
for f, (fr, m) in enumerate(zip(frames, masks)):
    rgba = fr.convert("RGBA")
    rgba.putalpha(Image.frombytes("L", (W, H), bytes(0 if v else 255 for v in m)))
    c = rgba.crop(box)
    out_frames.append(c)
    prev.paste(c, ((f % 3) * side, (f // 3) * side), c)
prev.save(out)

def to_p(c):
    # 255 colours plus index 255 for transparency
    p = c.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    alpha = c.getchannel("A").load()
    pp = p.load()
    for y in range(c.height):
        for x in range(c.width):
            if alpha[x, y] < 128: pp[x, y] = 255
    pal = p.getpalette()[:765] + [0, 0, 0]
    p.putpalette(pal)
    return p
ps = [to_p(c) for c in out_frames]
ps[0].save(sys.argv[3], save_all=True, append_images=ps[1:], duration=durations, loop=0, transparency=255, disposal=2, optimize=False)
