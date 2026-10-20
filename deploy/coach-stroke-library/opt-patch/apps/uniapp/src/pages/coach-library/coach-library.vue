<template>
  <view class="page" data-coach-library="true">
    <view class="hdr">
      <text class="coach">{{ coachName }}</text>
      <text class="title">{{ locale === 'zh' ? '动作库 / 我的示范' : 'Stroke library / My demos' }}</text>
      <text class="lead">{{
        locale === 'zh'
          ? '为每一项技术上传讲解文字与正确动作示范视频。'
          : 'Upload teaching copy and a correct-motion demo per stroke.'
      }}</text>
    </view>

    <view class="chips">
      <view
        v-for="id in strokes"
        :key="id"
        class="chip"
        :class="{ on: id === strokeId }"
        :data-stroke="id"
        @click="selectStroke(id)"
      >
        <text>{{ label(id) }}{{ filled[id] ? ' · ✓' : '' }}</text>
      </view>
    </view>

    <view v-if="phase === 'loading'" class="hint">{{ locale === 'zh' ? '加载中…' : 'Loading…' }}</view>
    <view v-else-if="phase === 'error'" class="hint err">
      <text>{{ locale === 'zh' ? '加载失败' : 'Failed to load' }}</text>
      <button size="mini" @click="load">{{ locale === 'zh' ? '重试' : 'Retry' }}</button>
    </view>

    <view v-else class="card">
      <text class="lbl">{{ locale === 'zh' ? '讲解 / 分析提示' : 'Teaching text / prompt' }}</text>
      <textarea v-model="prompt" class="ta" :placeholder="locale === 'zh' ? '写出教学要点…' : 'Teaching notes…'" />

      <text class="lbl">{{ locale === 'zh' ? '示范标题' : 'Demo title' }}</text>
      <input v-model="title" class="inp" :placeholder="coachName" />

      <text class="lbl">{{ locale === 'zh' ? '示范视频' : 'Demo video' }}</text>
      <video v-if="videoUrl" :src="videoUrl" controls class="vid" data-demo-video="true" />
      <text v-else class="hint">{{ locale === 'zh' ? '尚未上传' : 'No demo yet' }}</text>

      <button type="primary" size="mini" @click="chooseVideo">{{ locale === 'zh' ? '上传视频' : 'Upload video' }}</button>
      <input v-model="videoUrl" class="inp" :placeholder="locale === 'zh' ? '或粘贴链接' : 'Or paste URL'" />

      <button type="primary" :disabled="busy" @click="save">
        {{ busy ? (locale === 'zh' ? '保存中…' : 'Saving…') : locale === 'zh' ? '保存此项' : 'Save stroke' }}
      </button>
      <text v-if="flash" class="ok">{{ flash }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  COACH_DISPLAY_NAME_ZH,
  COACH_LIBRARY_STROKES,
  type CoachLibraryStrokeId,
  readLibrary,
  upsertEntry,
  writeLibrary,
} from "../../lib/coach-stroke-library";

const apiBase = "https://yqchen.blog/tennis";
const coachId = "poppy";
const coachName = COACH_DISPLAY_NAME_ZH;
const locale = ref<"zh" | "en">("zh");
const strokes = COACH_LIBRARY_STROKES;
const strokeId = ref<CoachLibraryStrokeId>("fh-topspin");
const prompt = ref("");
const title = ref("");
const videoUrl = ref("");
const phase = ref<"loading" | "ready" | "error">("loading");
const busy = ref(false);
const flash = ref("");
const lib = ref(readLibrary(coachId));

const labelsZh: Record<string, string> = {
  "fh-topspin": "正手上旋",
  "fh-slice": "正手切削",
  "fh-volley": "正手截击",
  "bh-topspin": "反手上旋",
  "bh-slice": "反手切削",
  "bh-volley": "反手截击",
  serve: "发球",
  smash: "高压球",
};
const labelsEn: Record<string, string> = {
  "fh-topspin": "Forehand topspin",
  "fh-slice": "Forehand slice",
  "fh-volley": "Forehand volley",
  "bh-topspin": "Backhand topspin",
  "bh-slice": "Backhand slice",
  "bh-volley": "Backhand volley",
  serve: "Serve",
  smash: "Overhead smash",
};

function label(id: string) {
  return (locale.value === "zh" ? labelsZh : labelsEn)[id] || id;
}

const filled = computed(() => {
  const m: Record<string, boolean> = {};
  for (const id of strokes) {
    const e = lib.value.entries[id];
    m[id] = Boolean(e && (e.prompt?.trim() || e.videoUrl?.trim()));
  }
  return m;
});

function applyStroke() {
  const e = lib.value.entries[strokeId.value];
  prompt.value = e?.prompt || "";
  title.value = e?.title || "";
  videoUrl.value = e?.videoUrl || "";
}

async function load() {
  phase.value = "loading";
  try {
    const res = await fetch(
      `${apiBase}/api/coach/library?coachId=${encodeURIComponent(coachId)}`,
    );
    if (res.ok) {
      const data = await res.json();
      lib.value = data.library || readLibrary(coachId);
      writeLibrary(lib.value);
    } else {
      lib.value = readLibrary(coachId);
    }
    applyStroke();
    phase.value = "ready";
  } catch {
    lib.value = readLibrary(coachId);
    applyStroke();
    phase.value = "ready";
  }
}

function selectStroke(id: CoachLibraryStrokeId) {
  strokeId.value = id;
  applyStroke();
}

async function save() {
  busy.value = true;
  try {
    const res = await fetch(
      `${apiBase}/api/coach/library?coachId=${encodeURIComponent(coachId)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          strokeId: strokeId.value,
          prompt: prompt.value,
          title: title.value,
          videoUrl: videoUrl.value,
        }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      lib.value = data.library;
      writeLibrary(lib.value);
    } else {
      lib.value = upsertEntry(
        strokeId.value,
        { prompt: prompt.value, title: title.value, videoUrl: videoUrl.value },
        coachId,
      );
    }
    flash.value = locale.value === "zh" ? "已保存" : "Saved";
  } catch {
    lib.value = upsertEntry(
      strokeId.value,
      { prompt: prompt.value, title: title.value, videoUrl: videoUrl.value },
      coachId,
    );
    flash.value = locale.value === "zh" ? "已保存" : "Saved";
  } finally {
    busy.value = false;
    setTimeout(() => (flash.value = ""), 2000);
  }
}

function chooseVideo() {
  // #ifdef APP-PLUS || H5 || MP-WEIXIN
  uni.chooseVideo({
    sourceType: ["album", "camera"],
    compressed: true,
    success: (res) => {
      videoUrl.value = res.tempFilePath;
      // Persist path locally; server upload when API is live.
      lib.value = upsertEntry(
        strokeId.value,
        { prompt: prompt.value, title: title.value || res.name, videoUrl: res.tempFilePath },
        coachId,
      );
      flash.value = locale.value === "zh" ? "已选视频（本地）" : "Video selected (local)";
    },
  });
  // #endif
}

watch(strokeId, applyStroke);
load();
</script>

<style scoped>
.page {
  padding: 16px;
  max-width: 480px;
  margin: 0 auto;
}
.hdr {
  margin-bottom: 12px;
}
.coach {
  display: block;
  color: #1f7a4c;
  font-size: 12px;
  font-weight: 700;
}
.title {
  display: block;
  font-size: 20px;
  font-weight: 800;
  margin-top: 4px;
}
.lead {
  display: block;
  color: #5b6b63;
  font-size: 13px;
  margin-top: 6px;
  line-height: 1.45;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef3f0;
  font-size: 12px;
}
.chip.on {
  background: #1f7a4c;
  color: #fff;
}
.card {
  border: 1px solid #d7e3dc;
  border-radius: 12px;
  padding: 12px;
  background: #fff;
}
.lbl {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin: 8px 0 4px;
}
.ta {
  width: 100%;
  min-height: 100px;
  border: 1px solid #d7e3dc;
  border-radius: 8px;
  padding: 8px;
  font-size: 14px;
}
.inp {
  width: 100%;
  border: 1px solid #d7e3dc;
  border-radius: 8px;
  padding: 8px;
  font-size: 14px;
  margin-bottom: 8px;
}
.vid {
  width: 100%;
  border-radius: 8px;
  margin-bottom: 8px;
  background: #000;
}
.hint {
  font-size: 12px;
  color: #5b6b63;
  margin: 8px 0;
}
.err {
  color: #b42318;
}
.ok {
  margin-left: 8px;
  color: #1f7a4c;
  font-size: 12px;
  font-weight: 700;
}
</style>
