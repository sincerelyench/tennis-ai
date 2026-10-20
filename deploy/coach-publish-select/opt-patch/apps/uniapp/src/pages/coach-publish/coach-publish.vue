<template>
  <view class="page" data-coach-publish="true">
    <view class="brand">涨球</view>
    <view class="coach">{{ coachLabel }}</view>
    <view class="title">{{ locale === 'en' ? 'Publish & training' : '发布与训练' }}</view>
    <view class="lead">{{
      locale === 'en'
        ? 'Submit library for style training, then request publish.'
        : '把动作库送训，完成后申请发布；球员可选择已发布风格。'
    }}</view>

    <view v-if="phase === 'loading'" class="hint">{{ locale === 'en' ? 'Loading…' : '加载中…' }}</view>
    <view v-else-if="phase === 'error'" class="hint err">
      <text>{{ locale === 'en' ? 'Failed' : '加载失败' }}</text>
      <button size="mini" @click="load">{{ locale === 'en' ? 'Retry' : '重试' }}</button>
    </view>
    <view v-else class="card">
      <view class="row">{{ locale === 'en' ? 'Status' : '状态' }}：{{ statusText }}</view>
      <view v-if="profile.trainJob && (profile.status === 'queued' || profile.status === 'training')" class="row">
        {{ locale === 'en' ? 'Progress' : '进度' }}：{{ profile.trainJob.progress }}%
      </view>
      <input v-model="displayName" class="inp" :placeholder="coachLabel" />
      <input
        v-model="styleTagline"
        class="inp"
        :placeholder="locale === 'en' ? 'Style blurb' : '风格简介'"
      />
      <button v-if="canTrain" type="primary" :loading="busy" @click="onTrain">
        {{ locale === 'en' ? 'Submit for training' : '提交训练' }}
      </button>
      <button v-if="canPublish" type="primary" :loading="busy" @click="onPublish">
        {{ locale === 'en' ? 'Request publish' : '申请发布' }}
      </button>
      <button v-if="canWithdrawBtn" :loading="busy" @click="onWithdraw">
        {{ locale === 'en' ? 'Withdraw' : '撤回' }}
      </button>
      <view v-if="flash" class="ok">{{ flash }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  DEFAULT_COACH_NAME_EN,
  DEFAULT_COACH_NAME_ZH,
  emptyProfile,
  readPublish,
  requestPublish,
  submitForTraining,
  withdraw,
  writePublish,
  type CoachPublishProfile,
} from "../../lib/coach-publish";

const apiBase = "https://yqchen.blog/tennis";
const locale = ref<"zh" | "en">("zh");
const phase = ref<"loading" | "ready" | "error">("loading");
const busy = ref(false);
const flash = ref("");
const profile = ref<CoachPublishProfile>(emptyProfile());
const displayName = ref(DEFAULT_COACH_NAME_ZH);
const styleTagline = ref("");

const coachLabel = computed(() =>
  locale.value === "en" ? DEFAULT_COACH_NAME_EN : DEFAULT_COACH_NAME_ZH,
);
const statusText = computed(() => {
  const m: Record<string, [string, string]> = {
    draft: ["草稿", "Draft"],
    queued: ["训练排队中", "Training queued"],
    training: ["训练中", "Training"],
    ready: ["可申请发布", "Ready to publish"],
    pending_review: ["待审核", "Pending review"],
    published: ["已发布", "Published"],
    rejected: ["已驳回", "Rejected"],
  };
  const pair = m[profile.value.status] || m.draft;
  return locale.value === "en" ? pair[1] : pair[0];
});
const canTrain = computed(
  () =>
    profile.value.libraryStrokeCount > 0 &&
    (profile.value.status === "draft" || profile.value.status === "rejected"),
);
const canPublish = computed(() => profile.value.status === "ready");
const canWithdrawBtn = computed(() =>
  ["queued", "training", "ready", "pending_review", "published"].includes(profile.value.status),
);

function apply(p: CoachPublishProfile) {
  profile.value = writePublish(p);
  displayName.value = p.displayName || DEFAULT_COACH_NAME_ZH;
  styleTagline.value = p.styleTagline || "";
}

async function load() {
  phase.value = "loading";
  try {
    const res = await fetch(`${apiBase}/api/coach/publish?coachId=poppy`);
    if (res.ok) {
      const data = await res.json();
      apply(data.profile || readPublish());
    } else {
      apply(readPublish());
    }
    phase.value = "ready";
  } catch {
    apply(readPublish());
    phase.value = "ready";
  }
  if (profile.value.status === "queued" || profile.value.status === "training") {
    setTimeout(() => void load(), 2000);
  }
}

async function onTrain() {
  busy.value = true;
  const next = submitForTraining(
    { ...profile.value, displayName: displayName.value, styleTagline: styleTagline.value },
    Math.max(1, profile.value.libraryStrokeCount || 1),
  );
  apply(next);
  flash.value = locale.value === "en" ? "Submitted" : "已提交训练";
  try {
    await fetch(`${apiBase}/api/coach/train?coachId=poppy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        libraryStrokeCount: next.libraryStrokeCount,
        displayName: displayName.value,
        styleTagline: styleTagline.value,
      }),
    });
  } catch {
    /* local ok */
  }
  busy.value = false;
  setTimeout(() => void load(), 2000);
}

async function onPublish() {
  busy.value = true;
  apply(requestPublish(profile.value, displayName.value, styleTagline.value));
  flash.value = locale.value === "en" ? "Published" : "已申请发布";
  try {
    await fetch(`${apiBase}/api/coach/publish?coachId=poppy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "request",
        displayName: displayName.value,
        styleTagline: styleTagline.value,
      }),
    });
  } catch {
    /* local ok */
  }
  busy.value = false;
}

async function onWithdraw() {
  busy.value = true;
  apply(withdraw(profile.value));
  flash.value = locale.value === "en" ? "Withdrawn" : "已撤回";
  try {
    await fetch(`${apiBase}/api/coach/publish?coachId=poppy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "withdraw" }),
    });
  } catch {
    /* local ok */
  }
  busy.value = false;
}

onMounted(() => {
  void load();
});
</script>

<style scoped>
.page { padding: 24rpx 32rpx 80rpx; background: #f4f7f5; min-height: 100vh; }
.brand { font-weight: 800; font-size: 32rpx; }
.coach { color: #1f7a4c; font-size: 22rpx; font-weight: 700; margin-top: 16rpx; }
.title { font-size: 40rpx; font-weight: 800; margin: 8rpx 0; }
.lead { color: #5b6b63; font-size: 24rpx; line-height: 1.5; margin-bottom: 24rpx; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; border: 1px solid #d7e3dc; }
.row { font-size: 26rpx; margin-bottom: 12rpx; }
.inp { border: 1px solid #d7e3dc; border-radius: 12rpx; padding: 16rpx; margin: 12rpx 0; font-size: 26rpx; }
.hint { color: #5b6b63; font-size: 24rpx; }
.err { color: #b42318; }
.ok { color: #1f7a4c; font-size: 22rpx; font-weight: 700; margin-top: 12rpx; }
button { margin-top: 16rpx; }
</style>
