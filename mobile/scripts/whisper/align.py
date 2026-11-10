# Align lyric lines to Whisper word times. usage: align.py words.json reference.txt out.lrc
# reference: LRC or plain lyrics (times in it are ignored). Lines the recording does not sing are dropped;
# what Whisper hears and the reference lacks is added from Whisper's own text.
import sys, json, re, unicodedata
from difflib import SequenceMatcher
def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^\w\s]", " ", s).split()
data = json.load(open(sys.argv[1], encoding="utf-8"))
W = []  # (token, start, end, segment index, prob)
for si, seg in enumerate(data["segments"]):
    for w in seg["words"]:
        for tok in norm(w["w"]):
            W.append((tok, w["t"], w["e"], si, w["p"]))
ref = [re.sub(r"\[\d+:\d+(?:[.:]\d+)?\]", "", l).strip() for l in open(sys.argv[2], encoding="utf-8").read().splitlines()]
ref = [l for l in ref if norm(l)]
used = [False] * len(W)
placed = []  # (start, end, text)
p = 0
for line in ref:
    toks = norm(line); n = len(toks); target = " ".join(toks)
    def score(s):
        best = (0, None)
        for k in (n - 1, n, n + 1):
            if k < 1 or s + k > len(W): continue
            r = SequenceMatcher(None, target, " ".join(x[0] for x in W[s:s + k])).ratio()
            if r > best[0]: best = (r, (s, k))
        return best
    # The first stretch that reads like the line, then the best fit right around it: a repeated chorus line must not
    # jump to its later repetition and leave everything in between out
    hit = None
    for s in range(p, min(len(W), p + 160)):
        # a line not sung within 60 s of the previous one belongs to a part this recording does not have
        if placed and W[s][1] - placed[-1][1] > 60: break
        r, at = score(s)
        if r >= 0.6:
            hit = max((score(x) for x in range(s, min(len(W), s + 6))), key=lambda b: b[0])
            break
    if hit:
        s, k = hit[1]
        placed.append((W[s][1], W[s + k - 1][2], line))
        for i in range(s, s + k): used[i] = True
        p = s + k
print("versos de la letra colocados:", len(placed), "de", len(ref), file=sys.stderr)
# Sung parts the reference lacks: runs of unused words, cut at Whisper's segment boundaries
extra = []
run = []
def flush():
    if len(run) >= 4 and sum(W[i][4] for i in run) / len(run) >= 0.45:
        seg = data["segments"][W[run[0]][3]]
        # Whisper's own words for that stretch, as heard (with accents and capitals)
        words = [w for w in seg["words"] if w["t"] >= W[run[0]][1] - 0.01 and w["e"] <= W[run[-1]][2] + 0.01]
        extra.append((W[run[0]][1], W[run[-1]][2], " ".join(w["w"] for w in words).strip()))
    run.clear()
for i, u in enumerate(W):
    if used[i] or (run and W[run[-1]][3] != W[i][3]): flush()
    if not used[i]: run.append(i)
flush()
print("versos añadidos desde lo que oye Whisper:", len(extra), file=sys.stderr)
rows = sorted(placed + extra)
out = []
for i, (a, b, text) in enumerate(rows):
    out.append((a, text))
    nxt = rows[i + 1][0] if i + 1 < len(rows) else None
    if nxt is None or nxt - b > 6: out.append((b + 0.5, ""))
fmt = lambda t: f"[{int(t // 60):02d}:{t % 60:05.2f}]"
open(sys.argv[3], "w", encoding="utf-8").write("\n".join(fmt(t) + x for t, x in out) + "\n")
for t, x in out: print(fmt(t), x)
