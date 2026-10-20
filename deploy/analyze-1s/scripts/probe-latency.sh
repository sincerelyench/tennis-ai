#!/usr/bin/env bash
# Measure sample analyze submit→done→report (and cache inline path).
set -euo pipefail
export TAI_BASE="${TAI_BASE:-https://yqchen.blog/tai}"
export EVIDENCE_DIR="${EVIDENCE_DIR:-/tmp/analyze-1s-probe}"
mkdir -p "$EVIDENCE_DIR"
python3 - <<'PY'
import json, os, time, urllib.request
from pathlib import Path

BASE = os.environ["TAI_BASE"].rstrip("/")
out = Path(os.environ["EVIDENCE_DIR"])
out.mkdir(parents=True, exist_ok=True)

def get(url):
    t0 = time.perf_counter()
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "analyze-1s"}), timeout=60) as r:
        data = r.read()
    return data, (time.perf_counter() - t0) * 1000

def post_sample(stroke="forehand"):
    boundary = "----zq1s"
    fields = {"sample": "1", "stroke": stroke, "level": "3.0", "refresh": "0", "title": "1s-probe"}
    body = b""
    for k, v in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        BASE + "/api/analyze",
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "analyze-1s"},
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    return json.loads(data), (time.perf_counter() - t0) * 1000

health, hms = get(BASE + "/api/health")
(out / "health.json").write_text(json.dumps({"ms": round(hms, 1), "body": json.loads(health)}, ensure_ascii=False, indent=2))
print("health", round(hms, 1), json.loads(health).get("busy"))

for label, stroke in (("after-sample-forehand", "forehand"), ("after-sample-serve", "serve")):
    try:
        body, submit_ms = post_sample(stroke)
    except Exception as e:
        (out / f"{label}-error.txt").write_text(str(e))
        print("ERR", label, e)
        continue
    job_id = body.get("job_id")
    cached = body.get("cached")
    inline = isinstance(body.get("report"), dict)
    t_poll0 = time.perf_counter()
    stages = []
    if not (cached and body.get("status") == "done"):
        while True:
            raw, pms = get(BASE + f"/api/jobs/{job_id}")
            job = json.loads(raw)
            stages.append({
                "t_ms": round((time.perf_counter() - t_poll0) * 1000, 1),
                "poll_ms": round(pms, 1),
                "status": job.get("status"),
                "progress": job.get("progress"),
                "eta_remaining_s": job.get("eta_remaining_s"),
                "analyze_mode": job.get("analyze_mode"),
            })
            if job.get("status") in ("done", "error", "cancelled"):
                break
            if time.perf_counter() - t_poll0 > 120:
                break
            time.sleep(0.15)
    if inline:
        score = (body.get("report") or {}).get("overall", {}).get("score")
        report_ms = 0.0
        e2e = submit_ms
    else:
        raw, report_ms = get(BASE + f"/api/jobs/{job_id}/report")
        score = (json.loads(raw).get("overall") or {}).get("score")
        e2e = submit_ms + (stages[-1]["t_ms"] if stages else 0) + report_ms
    summary = {
        "stroke": stroke,
        "submit_ms": round(submit_ms, 1),
        "cached": cached,
        "inline_report": inline,
        "job_id": job_id,
        "end_to_end_ms": round(e2e, 1),
        "report_fetch_ms": None if report_ms is None else round(report_ms, 1),
        "score": score,
        "leq_1000ms": e2e <= 1000,
        "stages": stages,
    }
    (out / f"{label}.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps({k: summary[k] for k in summary if k != "stages"}, ensure_ascii=False))
print("wrote", out)
PY
