"use client";

import {
  jobPercent,
  jobStep,
  leaveHint,
  mergedSteps,
  previewUrlFor,
  type TaiJobLike,
} from "../lib/job-progress";

type Props = {
  job?: TaiJobLike | null;
  /** True while upload has not yet returned a job id. */
  submitting?: boolean;
  /** Local object URL for the clip the user just picked (preferred while waiting). */
  localPreviewUrl?: string | null;
  /** Base for /tai preview, e.g. https://yqchen.blog/tai or /tai */
  taiBase?: string;
  title?: string;
  className?: string;
};

/**
 * 涨球 analyze waiting UI — multi-step roadmap wired to /tai job phases.
 * Brand: 涨球 / 涨球教练. No NTRP picker. Do not touch stroke pass-through.
 */
export function AnalyzeProgress({
  job,
  submitting = false,
  localPreviewUrl = null,
  taiBase = "/tai",
  title = "正在分析挥拍",
  className = "",
}: Props) {
  const steps = mergedSteps(job);
  const cur = submitting && !job?.step ? 0 : jobStep(job);
  const active = cur > 0 ? cur : submitting ? 1 : 0;
  const pct = jobPercent(job, submitting);
  const stepName =
    (job && job.step_name) ||
    (submitting ? "提交" : steps.find((s) => s.step === active)?.name) ||
    "准备中";
  const message = (job && job.message) || (submitting ? "正在提交视频…" : "");
  const eta = leaveHint(job);
  const preview = previewUrlFor(job, { taiBase, localObjectUrl: localPreviewUrl });
  const source = (job && job.source_name) || "";

  return (
    <div
      className={`zq-analyze-progress ${className}`.trim()}
      data-analyze-progress="true"
      data-job-id={job?.id || ""}
      data-progress-percent={String(pct)}
      data-progress-step={stepName}
      data-progress-eta={eta}
      role="status"
      aria-live="polite"
    >
      <style>{css}</style>

      <div className="zq-ap-head">
        <div>
          <p className="zq-ap-kicker">涨球</p>
          <h2 className="zq-ap-title">{title}</h2>
          {message ? <p className="zq-ap-msg">{message}</p> : null}
        </div>
        <div className="zq-ap-pct" data-progress-value="true">
          {pct}%
        </div>
      </div>

      <ol className="zq-ap-steps" data-analyze-steps="true">
        {steps.map((s) => {
          const state =
            active > 0 && s.step < active
              ? "done"
              : s.step === active
                ? "on"
                : "";
          return (
            <li key={s.step} className={`zq-ap-step ${state}`.trim()}>
              <b>
                {s.step}. {s.name}
              </b>
              <span className="zq-ap-blurb">{s.blurb}</span>
              <span className="zq-ap-eta">{s.eta}</span>
            </li>
          );
        })}
      </ol>

      <div className="zq-ap-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>

      <div className="zq-ap-live">
        <div className="zq-ap-card">
          <h3>分析预览</h3>
          <div className="zq-ap-preview">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" />
            ) : (
              <p className="zq-ap-empty">上传后这里会显示你的录像预览</p>
            )}
          </div>
        </div>
        <div className="zq-ap-card">
          <h3>当前步骤</h3>
          {source ? <p className="zq-ap-file">{source}</p> : null}
          <p className="zq-ap-step-line" data-progress-step-label="true">
            {stepName} · {pct}%
          </p>
          <p className="zq-ap-hint" data-progress-time="true" data-leave-hint="true">
            {eta}
          </p>
        </div>
      </div>
    </div>
  );
}

export default AnalyzeProgress;

const css = `
.zq-analyze-progress{
  border:1px solid #d5e0d9;border-radius:16px;padding:14px 14px 16px;
  background:#fff;color:#0f1f16;
}
.zq-ap-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
.zq-ap-kicker{
  margin:0 0 4px;display:inline-flex;align-items:center;
  font-size:11px;font-weight:700;letter-spacing:.08em;
  color:#0f3d36;background:#ccfbf1;border-radius:999px;padding:2px 8px;
}
.zq-ap-title{margin:0;font-size:18px;font-weight:750;letter-spacing:-.02em}
.zq-ap-msg{margin:4px 0 0;font-size:13px;color:#5b6b62}
.zq-ap-pct{font-size:28px;font-weight:800;letter-spacing:-.04em;color:#0d9488;line-height:1}
.zq-ap-steps{
  list-style:none;margin:0 0 10px;padding:0;
  display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;
}
.zq-ap-step{
  border:1px solid #d5e0d9;border-radius:12px;padding:10px 8px;
  background:#f7faf8;color:#5b6b62;font-size:11px;line-height:1.35;
}
.zq-ap-step b{display:block;color:#0f1f16;font-size:12px;margin-bottom:3px}
.zq-ap-step.on{border-color:#0d9488;background:#f0fdfa;color:#0f766e;box-shadow:0 0 0 1px rgba(13,148,136,.2)}
.zq-ap-step.done{border-color:#99f6e4;color:#0f766e}
.zq-ap-blurb{display:block}
.zq-ap-eta{display:block;margin-top:5px;opacity:.9;font-size:10px}
.zq-ap-bar{height:8px;border-radius:99px;background:#e7eeea;overflow:hidden;margin:0 0 12px}
.zq-ap-bar>i{
  display:block;height:100%;
  background:linear-gradient(90deg,#14b8a6,#0d9488,#5eead4);
  transition:width .35s ease;
}
.zq-ap-live{display:grid;grid-template-columns:1.05fr .95fr;gap:10px}
.zq-ap-card{
  border:1px solid #d5e0d9;border-radius:14px;padding:12px;background:#fbfdfc;
}
.zq-ap-card h3{margin:0 0 8px;font-size:13px;font-weight:700}
.zq-ap-preview{
  width:100%;aspect-ratio:16/10;border-radius:10px;overflow:hidden;background:#0b1712;
}
.zq-ap-preview img{width:100%;height:100%;object-fit:cover;display:block}
.zq-ap-empty{margin:0;padding:22px 10px;text-align:center;color:#8aa094;font-size:12px}
.zq-ap-file{margin:0 0 6px;font-size:12px;color:#5b6b62;word-break:break-all}
.zq-ap-step-line{margin:0 0 8px;font-size:14px;font-weight:650}
.zq-ap-hint{margin:0;font-size:12px;color:#5b6b62;line-height:1.45}
@media (max-width:560px){
  .zq-ap-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .zq-ap-live{grid-template-columns:1fr}
}
`;
