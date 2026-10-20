<template>
  <view class="page" data-coach-picker="true">
    <view class="brand">涨球</view>
    <view class="title">{{ locale === 'en' ? 'Choose a coach' : '选择教练' }}</view>
    <view class="lead">{{
      locale === 'en'
        ? 'Published coaches only. Each is a different style.'
        : '仅显示已发布教练。不同教练 = 不同风格。'
    }}</view>
    <view class="hint">{{
      locale === 'en' ? 'Default persona: Zhangqiu Coach' : '默认人格：涨球教练'
    }}</view>

    <view v-if="phase === 'loading'" class="hint">{{ locale === 'en' ? 'Loading…' : '加载中…' }}</view>
    <view v-else-if="phase === 'error'" class="hint err">
      <text>{{ locale === 'en' ? 'Failed' : '加载失败' }}</text>
      <button size="mini" @click="load">{{ locale === 'en' ? 'Retry' : '重试' }}</button>
    </view>
    <view v-else-if="!coaches.length" class="empty" data-empty="true">
      {{ locale === 'en' ? 'No published coaches yet.' : '暂无已发布教练。' }}
    </view>
    <view v-else>
      <view
        v-for="c in coaches"
        :key="c.coachId"
        class="card"
        :class="{ on: c.coachId === selectedId }"
        :data-coach-id="c.coachId"
      >
        <view class="name" data-coach-name="true">{{ c.displayName }}</view>
        <view v-if="c.styleTagline" class="style">{{ c.styleTagline }}</view>
        <button
          size="mini"
          type="primary"
          :disabled="c.coachId === selectedId"
          @click="pick(c.coachId)"
        >
          {{
            c.coachId === selectedId
              ? locale === 'en'
                ? 'Selected'
                : '当前选用'
              : locale === 'en'
                ? 'Select'
                : '选用'
          }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  DEFAULT_COACH_NAME_ZH,
  getSelectedCoachId,
  listPublished,
  normalizeDisplayName,
  setSelectedCoachId,
} from "../../lib/coach-publish";

const apiBase = "https://yqchen.blog/tennis";
const locale = ref<"zh" | "en">("zh");
const phase = ref<"loading" | "ready" | "error">("loading");
const coaches = ref<
  Array<{
    coachId: string;
    displayName: string;
    styleTagline: string;
    publishedAt: string | null;
    libraryStrokeCount: number;
  }>
>([]);
const selectedId = ref(getSelectedCoachId());

async function load() {
  phase.value = "loading";
  try {
    const res = await fetch(`${apiBase}/api/coaches?published=1`);
    if (res.ok) {
      const data = await res.json();
      coaches.value = (data.coaches || []).map((c: any) => ({
        ...c,
        displayName: normalizeDisplayName(c.displayName),
      }));
    } else {
      coaches.value = listPublished().map((p) => ({
        coachId: p.coachId,
        displayName: normalizeDisplayName(p.displayName) || DEFAULT_COACH_NAME_ZH,
        styleTagline: p.styleTagline,
        publishedAt: p.publishedAt,
        libraryStrokeCount: p.libraryStrokeCount,
      }));
    }
    const sel = await fetch(`${apiBase}/api/player/coach`);
    if (sel.ok) {
      const data = await sel.json();
      selectedId.value = data.coachId || getSelectedCoachId();
    }
    phase.value = "ready";
  } catch {
    coaches.value = listPublished().map((p) => ({
      coachId: p.coachId,
      displayName: normalizeDisplayName(p.displayName) || DEFAULT_COACH_NAME_ZH,
      styleTagline: p.styleTagline,
      publishedAt: p.publishedAt,
      libraryStrokeCount: p.libraryStrokeCount,
    }));
    phase.value = "ready";
  }
}

async function pick(coachId: string) {
  setSelectedCoachId(coachId);
  selectedId.value = coachId;
  try {
    await fetch(`${apiBase}/api/player/coach`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coachId }),
    });
  } catch {
    /* local ok */
  }
}

onMounted(() => {
  void load();
});
</script>

<style scoped>
.page { padding: 24rpx 32rpx 80rpx; background: #f4f7f5; min-height: 100vh; }
.brand { font-weight: 800; font-size: 32rpx; color: #1f7a4c; }
.title { font-size: 40rpx; font-weight: 800; margin: 16rpx 0 8rpx; }
.lead { color: #5b6b63; font-size: 24rpx; line-height: 1.5; }
.hint { color: #5b6b63; font-size: 22rpx; margin: 12rpx 0; }
.err { color: #b42318; }
.empty {
  margin-top: 24rpx;
  padding: 32rpx;
  border: 1px dashed #d7e3dc;
  border-radius: 16rpx;
  color: #5b6b63;
  font-size: 24rpx;
}
.card {
  background: #fff;
  border: 1px solid #d7e3dc;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-top: 16rpx;
}
.card.on { border-color: #1f7a4c; background: #eef8f2; }
.name { font-size: 30rpx; font-weight: 800; }
.style { color: #5b6b63; font-size: 24rpx; margin: 8rpx 0 12rpx; }
</style>
