<!-- Drop into pages/analysis waiting branch. Brand 涨球; coach 涨球教练. -->
<template>
  <view
    class="zq-ap"
    data-analyze-progress="true"
    :data-job-id="jobId"
    :data-progress-percent="String(percent)"
    :data-progress-step="stepName"
  >
    <view class="zq-ap-head">
      <view>
        <text class="zq-ap-kicker">涨球</text>
        <text class="zq-ap-title">{{ title }}</text>
        <text class="zq-ap-msg" v-if="message">{{ message }}</text>
      </view>
      <text class="zq-ap-pct">{{ percent }}%</text>
    </view>

    <view class="zq-ap-steps" data-analyze-steps="true">
      <view
        v-for="s in steps"
        :key="s.step"
        class="zq-ap-step"
        :class="{ on: s.step === activeStep, done: s.step < activeStep }"
      >
        <text class="zq-ap-step-name">{{ s.step }}. {{ s.name }}</text>
        <text class="zq-ap-blurb">{{ s.blurb }}</text>
        <text class="zq-ap-eta">{{ s.eta }}</text>
      </view>
    </view>

    <view class="zq-ap-bar"><view class="zq-ap-fill" :style="{ width: percent + '%' }" /></view>

    <view class="zq-ap-live">
      <view class="zq-ap-card">
        <text class="zq-ap-h3">分析预览</text>
        <image v-if="previewSrc" class="zq-ap-preview" :src="previewSrc" mode="aspectFill" />
        <video v-else-if="localVideo" class="zq-ap-preview" :src="localVideo" :controls="false" object-fit="cover" />
        <text v-else class="zq-ap-empty">上传后这里会显示你的录像预览</text>
      </view>
      <view class="zq-ap-card">
        <text class="zq-ap-h3">当前步骤</text>
        <text v-if="sourceName" class="zq-ap-file">{{ sourceName }}</text>
        <text class="zq-ap-step-line">{{ stepName }} · {{ percent }}%</text>
        <text class="zq-ap-hint">{{ etaHint }}</text>
      </view>
    </view>
  </view>
</template>

<script>
/** Map job → steps/percent; keep stroke submit path untouched. */
const FALLBACK = [
  { step: 1, name: "读取视频", blurb: "打开你的录像", eta: "约 15 秒" },
  { step: 2, name: "识别动作", blurb: "看清挥拍动作", eta: "约 3–6 分钟" },
  { step: 3, name: "找出挥拍", blurb: "标出每一次击球", eta: "约 30 秒" },
  { step: 4, name: "整理数据", blurb: "整理评分依据", eta: "约 1 分钟" },
  { step: 5, name: "教练点评", blurb: "涨球教练生成练习建议", eta: "约 2 分钟，最慢" },
];
const STEP_PCT = { 0: 3, 1: 8, 2: 40, 3: 78, 4: 86, 5: 92 };

export default {
  name: "ZqAnalyzeProgress",
  props: {
    job: { type: Object, default: null },
    submitting: { type: Boolean, default: false },
    localVideo: { type: String, default: "" },
    taiBase: { type: String, default: "https://yqchen.blog/tai" },
    title: { type: String, default: "正在分析挥拍" },
  },
  computed: {
    jobId() {
      return (this.job && this.job.id) || "";
    },
    activeStep() {
      const s = Number(this.job && this.job.step);
      if (Number.isFinite(s) && s > 0) return Math.min(5, Math.round(s));
      return this.submitting ? 1 : 0;
    },
    percent() {
      if (String((this.job && this.job.status) || "") === "done") return 100;
      const raw = Number(this.job && this.job.progress);
      if (Number.isFinite(raw)) return Math.max(0, Math.min(99, Math.round(raw)));
      return STEP_PCT[this.activeStep] || (this.submitting ? 2 : 8);
    },
    steps() {
      const api = (this.job && this.job.eta_steps) || [];
      return FALLBACK.map((base) => {
        const hit = api.find((x) => Number(x.step) === base.step) || {};
        return {
          step: base.step,
          name: hit.name || base.name,
          blurb: base.blurb,
          eta: hit.label || base.eta,
        };
      });
    },
    stepName() {
      return (this.job && this.job.step_name) || (this.submitting ? "提交" : "准备中");
    },
    message() {
      return (this.job && this.job.message) || "";
    },
    sourceName() {
      return (this.job && this.job.source_name) || "";
    },
    etaHint() {
      const h = ((this.job && this.job.eta_hint) || "").trim();
      return h || "关掉页面也不会中断，回来可继续查看进度。";
    },
    previewSrc() {
      const id = this.jobId;
      const rev = this.job && this.job.preview_rev;
      if (!id || rev == null || rev === "") return "";
      const base = String(this.taiBase || "").replace(/\/$/, "");
      return base + "/api/jobs/" + encodeURIComponent(id) + "/preview?r=" + encodeURIComponent(String(rev));
    },
  },
};
</script>

<style scoped>
.zq-ap { border: 1px solid #d5e0d9; border-radius: 16px; padding: 14px; background: #fff; }
.zq-ap-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.zq-ap-kicker {
  display: inline-block; font-size: 11px; font-weight: 700; color: #0f3d36;
  background: #ccfbf1; border-radius: 999px; padding: 2px 8px; margin-bottom: 4px;
}
.zq-ap-title { display: block; font-size: 18px; font-weight: 750; }
.zq-ap-msg { display: block; margin-top: 4px; font-size: 13px; color: #5b6b62; }
.zq-ap-pct { font-size: 28px; font-weight: 800; color: #0d9488; }
.zq-ap-steps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }
.zq-ap-step { border: 1px solid #d5e0d9; border-radius: 12px; padding: 10px 8px; background: #f7faf8; }
.zq-ap-step.on { border-color: #0d9488; background: #f0fdfa; }
.zq-ap-step.done { border-color: #99f6e4; }
.zq-ap-step-name { display: block; font-size: 12px; font-weight: 700; color: #0f1f16; }
.zq-ap-blurb, .zq-ap-eta { display: block; font-size: 11px; color: #5b6b62; }
.zq-ap-eta { margin-top: 4px; }
.zq-ap-bar { height: 8px; border-radius: 99px; background: #e7eeea; overflow: hidden; margin-bottom: 12px; }
.zq-ap-fill { height: 100%; background: linear-gradient(90deg, #14b8a6, #0d9488); }
.zq-ap-live { display: grid; grid-template-columns: 1fr; gap: 10px; }
.zq-ap-card { border: 1px solid #d5e0d9; border-radius: 14px; padding: 12px; background: #fbfdfc; }
.zq-ap-h3 { display: block; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
.zq-ap-preview { width: 100%; height: 160px; border-radius: 10px; background: #0b1712; }
.zq-ap-empty, .zq-ap-hint, .zq-ap-file { display: block; font-size: 12px; color: #5b6b62; line-height: 1.45; }
.zq-ap-step-line { display: block; font-size: 14px; font-weight: 650; margin: 6px 0; }
</style>
