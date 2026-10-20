<template>
  <view class="zq-fd" v-if="axes.length || speeds">
    <text class="h2">{{ t.fourTitle }}</text>
    <view class="dim-grid">
      <view class="card" v-for="a in axes" :key="a.key">
        <text class="lab">{{ a.label }}</text>
        <view class="val">
          <text class="num">{{ a.value }}</text>
          <text class="max"> / {{ a.max }}</text>
        </view>
        <view class="bar"><view class="fill" :style="{ width: a.pct + '%' }" /></view>
      </view>
    </view>

    <text class="h2">{{ t.speedTitle }}</text>
    <text v-if="!speeds" class="note">{{ t.speedEmpty }}</text>
    <block v-else>
      <view class="speed-grid">
        <view class="card" v-for="s in speedCells" :key="s.key">
          <text class="lab">{{ s.label }}</text>
          <view class="sval">
            <text>{{ s.value }}</text>
            <text v-if="s.unit" class="unit"> {{ s.unit }}</text>
          </view>
        </view>
      </view>
      <text class="note">{{ speedNote }}</text>
    </block>

    <view class="charts" v-if="axes.length">
      <view class="panel">
        <text class="ptitle">{{ t.radarTitle }}</text>
        <!-- #ifdef H5 -->
        <view v-html="radarSvg"></view>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <view class="hbar" v-for="a in axes" :key="'r'+a.key">
          <text class="hlab">{{ a.label }}</text>
          <view class="htrack"><view class="hfill" :style="{ width: a.pct + '%' }" /></view>
          <text class="hnum">{{ a.value }}</text>
        </view>
        <!-- #endif -->
      </view>
      <view class="panel">
        <text class="ptitle">{{ t.barsTitle }}</text>
        <view class="hbar" v-for="a in axes" :key="'b'+a.key">
          <text class="hlab">{{ a.label }}</text>
          <view class="htrack"><view class="hfill" :style="{ width: a.pct + '%' }" /></view>
          <text class="hnum">{{ a.value }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
const AXIS = [
  { key: "重心", max: 25, label: "重心" },
  { key: "击球点", max: 20, label: "击球点" },
  { key: "动力链", max: 30, label: "动力链" },
  { key: "击球效果", max: 25, label: "击球效果" },
];

function asKmh(v) {
  if (typeof v !== "number" || !isFinite(v) || v < 0 || v > 250) return null;
  return v < 20 ? Math.round(v * 10) / 10 : Math.round(v);
}

function fmtKmh(v) {
  if (v == null) return "";
  return v >= 20 ? String(Math.round(v)) : Number(v).toFixed(1);
}

function pickSpeeds(report) {
  const sources = [];
  const overall = (report && report.overall) || {};
  if (overall.speeds) sources.push(overall.speeds);
  const clips = (report && report.clips) || [];
  clips.forEach((c) => {
    if (c && c.summary && c.summary.speeds) sources.push(c.summary.speeds);
    (c && c.swings || []).forEach((s) => {
      if (s && s.speeds) sources.push(s.speeds);
    });
  });
  if (!sources.length) return null;
  const first = (...keys) => {
    for (const src of sources) {
      for (const k of keys) {
        const n = asKmh(src[k]);
        if (n != null) return n;
      }
    }
    return null;
  };
  let swingFrom = null;
  for (const src of sources) {
    if (src.swing_from === "racket" || src.swing_from === "wrist") {
      swingFrom = src.swing_from;
      break;
    }
  }
  const out = {
    racket_kmh: first("swing_kmh", "racket_kmh"),
    wrist_kmh: first("wrist_kmh"),
    hip_kmh: first("hip_kmh"),
    ball_in_kmh: first("ball_in_kmh"),
    ball_out_kmh: first("ball_out_kmh"),
    racket_kmh_max: first("swing_kmh_max", "racket_kmh_max"),
    swing_from: swingFrom,
  };
  if (
    out.racket_kmh == null &&
    out.wrist_kmh == null &&
    out.hip_kmh == null &&
    out.ball_in_kmh == null &&
    out.ball_out_kmh == null
  ) {
    return null;
  }
  return out;
}

export default {
  name: "ReportFourDim",
  props: {
    report: { type: Object, default: null },
    scores: { type: Object, default: null },
  },
  data() {
    return {
      t: {
        fourTitle: "四维评分",
        speedTitle: "速度估计",
        speedEmpty: "这次没有可用的画面速度估计。",
        speedNote: "按身高或拍长把画面位移换成公里每小时，不是测速雷达。侧面更准，正面会偏慢。",
        radarTitle: "四维雷达",
        barsTitle: "分项条形",
      },
    };
  },
  computed: {
    axes() {
      const block = this.scores || (this.report && this.report.overall && this.report.overall.scores) || {};
      return AXIS.map((d) => {
        const raw = Number(block[d.key]);
        const value = Number.isFinite(raw) ? Math.round(raw) : null;
        const pct = value != null ? Math.max(0, Math.min(100, Math.round((value / d.max) * 100))) : 0;
        return { ...d, value: value == null ? "—" : value, pct, known: value != null };
      }).filter((a) => a.known);
    },
    speeds() {
      return pickSpeeds(this.report || { overall: { speeds: this.scores && this.scores.__speeds } });
    },
    speedCells() {
      const s = this.speeds;
      if (!s) return [];
      const racket = s.swing_from === "wrist" ? "拍头·腕推算" : "拍头";
      return [
        ["racket", racket, s.racket_kmh],
        ["wrist", "手腕", s.wrist_kmh],
        ["hip", "转髋", s.hip_kmh],
        ["ballIn", "来球", s.ball_in_kmh],
        ["ballOut", "出球", s.ball_out_kmh],
      ].map(([key, label, val]) => {
        const n = fmtKmh(val);
        return { key, label, value: n || "—", unit: n ? "km/h" : "" };
      });
    },
    speedNote() {
      const s = this.speeds;
      if (!s) return "";
      const max = fmtKmh(s.racket_kmh_max);
      return max ? this.t.speedNote + `最快一拍拍头约 ${max} km/h。` : this.t.speedNote;
    },
    radarSvg() {
      const axes = this.axes;
      if (!axes.length) return "";
      const cx = 100, cy = 100, r = 72, n = axes.length;
      const grid = [0.4, 0.7, 1]
        .map((k) => {
          const g = axes
            .map((_, i) => {
              const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
              return `${cx + Math.cos(ang) * r * k},${cy + Math.sin(ang) * r * k}`;
            })
            .join(" ");
          return `<polygon points="${g}" fill="none" stroke="#d5e0d9" />`;
        })
        .join("");
      const pts = axes
        .map((a, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const v = typeof a.value === "number" ? a.value / a.max : 0;
          return `${cx + Math.cos(ang) * r * v},${cy + Math.sin(ang) * r * v}`;
        })
        .join(" ");
      const labs = axes
        .map((a, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const x = cx + Math.cos(ang) * 94;
          const y = cy + Math.sin(ang) * 94;
          return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#5b6b62">${a.label}</text>`;
        })
        .join("");
      return `<svg viewBox="0 0 200 200" width="220" height="220">${grid}<polygon points="${pts}" fill="rgba(13,148,136,.22)" stroke="#0d9488" stroke-width="1.8"/>${labs}</svg>`;
    },
  },
};
</script>

<style scoped>
.zq-fd { color: #0f1f16; margin-bottom: 24rpx; }
.h2 { display: block; font-size: 32rpx; font-weight: 700; margin: 8rpx 0 16rpx; }
.dim-grid, .speed-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-bottom: 16rpx; }
.card { background: #fff; border: 1px solid #d5e0d9; border-radius: 20rpx; padding: 18rpx; }
.lab { display: block; font-size: 22rpx; color: #5b6b62; }
.val { display: flex; align-items: baseline; gap: 6rpx; margin: 8rpx 0 12rpx; }
.num { font-size: 48rpx; font-weight: 750; }
.max { font-size: 24rpx; color: #5b6b62; }
.bar { height: 12rpx; border-radius: 99rpx; background: #f4faf7; overflow: hidden; }
.fill { height: 100%; background: #0d9488; }
.sval { margin-top: 10rpx; font-size: 40rpx; font-weight: 750; }
.unit { font-size: 22rpx; color: #5b6b62; font-weight: 500; }
.note { display: block; font-size: 22rpx; color: #5b6b62; line-height: 1.45; margin-bottom: 16rpx; }
.panel { background: #f4faf7; border: 1px solid #d5e0d9; border-radius: 20rpx; padding: 18rpx; margin-bottom: 16rpx; }
.ptitle { display: block; font-size: 24rpx; color: #5b6b62; margin-bottom: 12rpx; }
.hbar { display: grid; grid-template-columns: 4.5em 1fr 2em; gap: 12rpx; align-items: center; margin-bottom: 12rpx; }
.hlab { font-size: 24rpx; color: #5b6b62; }
.htrack { height: 18rpx; border-radius: 99rpx; background: #e7eeea; overflow: hidden; }
.hfill { height: 100%; background: #0f766e; }
.hnum { text-align: right; font-weight: 700; font-size: 26rpx; }
</style>
