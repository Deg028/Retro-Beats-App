"""
Cuts the background out of an anime GIF for the lyric interludes (src/interludes.ts) with a rembg model (runs on
the PC, no GPU needed; the first run downloads the model). Unlike cut-gif-background.py, which fills a flat colour,
this one tells the character from a busy background (glow, blur). The default model is `birefnet-general-lite`
(about 170 MB, ~2 min per frame on a 2-core i3): on the Goku GIF `isnet-anime` left the blue glow stuck to the
hair and `isnet-general-use` lost the character.

    python scripts/remove-gif-background.py in.gif preview.png out.gif [width] [model]

Each cut frame is saved in `out.gif.cache/`, so an interrupted run goes on where it stopped.

Every frame is cut on its own, the alpha is smoothed across neighbouring frames so the outline does not flicker,
all frames are cropped to one box around the character, and the GIF is saved with 1-bit transparency (GIF has no
soft edges). `width` scales the result down (default 300). Needs `pip install "rembg[cpu]" pillow`.
"""
import os
import sys
from PIL import Image, ImageFilter
from rembg import new_session, remove

src, preview, out = sys.argv[1], sys.argv[2], sys.argv[3]
width = int(sys.argv[4]) if len(sys.argv) > 4 else 300
model = sys.argv[5] if len(sys.argv) > 5 else "birefnet-general-lite"

im = Image.open(src)
frames, durations = [], []
for f in range(im.n_frames):
    im.seek(f)
    frames.append(im.convert("RGB"))
    durations.append(im.info.get("duration", 70))

cache = out + ".cache"
os.makedirs(cache, exist_ok=True)
session = new_session(model)
cut = []
for i, fr in enumerate(frames):
    path = os.path.join(cache, "%03d.png" % i)
    if not os.path.exists(path):
        remove(fr, session=session).save(path)
    print("frame", i + 1, "of", len(frames), flush=True)
    cut.append(Image.open(path).convert("RGBA"))
alphas = [c.getchannel("A") for c in cut]

# Smooth each alpha with its neighbours (the loop wraps around): a pixel stays when most nearby frames keep it
n = len(alphas)
smooth = []
for i in range(n):
    prev, nxt = alphas[(i - 1) % n], alphas[(i + 1) % n]
    avg = Image.blend(Image.blend(prev, nxt, 0.5), alphas[i], 0.5)
    smooth.append(avg.filter(ImageFilter.GaussianBlur(0.6)).point(lambda v: 255 if v >= 128 else 0))

# One crop box for the whole loop, so the picture does not jump
box = None
for a in smooth:
    b = a.getbbox()
    if b:
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
pad = 4
box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
print("box", box, "of", im.size)

scale = width / (box[2] - box[0])
size = (width, round((box[3] - box[1]) * scale))
outs = []
for fr, a in zip(frames, smooth):
    rgba = fr.convert("RGBA")
    rgba.putalpha(a)
    outs.append(rgba.crop(box).resize(size, Image.Resampling.LANCZOS))

prev_img = Image.new("RGB", (size[0] * 3, size[1] * 2), (150, 20, 30))
for i, o in enumerate(outs[:6]):
    prev_img.paste(o, ((i % 3) * size[0], (i // 3) * size[1]), o)
prev_img.save(preview)

def to_p(c):
    # 255 colours plus index 255 for transparency
    a = c.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    p = c.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    px, al = p.load(), a.load()
    for y in range(c.height):
        for x in range(c.width):
            if al[x, y] == 0:
                px[x, y] = 255
    p.putpalette(p.getpalette()[:765] + [0, 0, 0])
    return p

ps = [to_p(o) for o in outs]
ps[0].save(out, save_all=True, append_images=ps[1:], duration=durations, loop=0, transparency=255, disposal=2, optimize=False)
print("saved", out, len(ps), "frames", size)
