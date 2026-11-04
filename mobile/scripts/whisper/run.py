import sys, time, io
from faster_whisper import WhisperModel
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import av, numpy as np
def load(p):
    out=[]
    with av.open(p) as c:
        rs=av.AudioResampler(format="s16", layout="mono", rate=16000)
        for f in c.decode(audio=0):
            for r in rs.resample(f): out.append(r.to_ndarray().reshape(-1))
        for r in rs.resample(None): out.append(r.to_ndarray().reshape(-1))
    return np.concatenate(out).astype(np.float32)/32768.0
path, size = sys.argv[1], sys.argv[2]
lang = (sys.argv[3] or None) if len(sys.argv) > 3 else None
t0 = time.time()
m = WhisperModel(size, device="cpu", compute_type="int8", cpu_threads=4)
t1 = time.time()
segs, info = m.transcribe(load(path), language=lang, vad_filter=(len(sys.argv)<5), beam_size=1, condition_on_previous_text=False)
print(f"idioma={info.language} p={info.language_probability:.2f} dur={info.duration:.0f}s carga={t1-t0:.0f}s")
for s in segs:
    print(f"[{int(s.start//60):02d}:{s.start%60:05.2f}] {s.text.strip()}")
print(f"TOTAL {time.time()-t1:.0f}s de proceso para {info.duration:.0f}s de audio")
