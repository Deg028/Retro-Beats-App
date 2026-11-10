# Whisper words with times -> JSON. usage: whw.py audio model lang out.json
import sys, json
from faster_whisper import WhisperModel
import av, numpy as np
def load(p):
    out=[]
    with av.open(p) as c:
        rs=av.AudioResampler(format="s16", layout="mono", rate=16000)
        for f in c.decode(audio=0):
            for r in rs.resample(f): out.append(r.to_ndarray().reshape(-1))
        for r in rs.resample(None): out.append(r.to_ndarray().reshape(-1))
    return np.concatenate(out).astype(np.float32)/32768.0
m = WhisperModel(sys.argv[2], device="cpu", compute_type="int8", cpu_threads=4)
segs, info = m.transcribe(load(sys.argv[1]), language=sys.argv[3], vad_filter=False, beam_size=5, condition_on_previous_text=False, word_timestamps=True)
out = [{"start": s.start, "end": s.end, "text": s.text.strip(), "words": [{"w": w.word.strip(), "t": w.start, "e": w.end, "p": w.probability} for w in (s.words or [])]} for s in segs]
json.dump({"duration": info.duration, "segments": out}, open(sys.argv[4], "w", encoding="utf-8"), ensure_ascii=False)
print(len(out), "segmentos")
