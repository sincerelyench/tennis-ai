<template>
  <!-- 涨球：只播球星示范，无署名 / 源切换 / 原页链接 -->
  <view
    class="star-demo-player"
    :data-stroke="demo.strokeId"
    data-clean-demo="1"
  >
    <!-- #ifdef H5 || APP-PLUS -->
    <view class="star-demo-frame">
      <iframe
        class="star-demo-iframe"
        :src="embedUrl"
        :title="aria"
        allow="fullscreen; encrypted-media; picture-in-picture"
        frameborder="0"
        allowfullscreen
      />
    </view>
    <!-- #endif -->
    <!-- #ifdef MP-WEIXIN -->
    <view class="star-demo-frame star-demo-mp" @tap="openMpEmbed">
      <view class="star-demo-mp-play" aria-hidden="true">▶</view>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { starDemoForStroke } from "../lib/star-demos";

const props = withDefaults(
  defineProps<{
    strokeId: string;
    locale?: "zh" | "en";
    overrideEmbedUrl?: string;
    preferBilibili?: boolean;
  }>(),
  {
    locale: "zh",
    preferBilibili: true,
  },
);

const demo = computed(() => starDemoForStroke(props.strokeId, props.preferBilibili));
const embedUrl = computed(() => props.overrideEmbedUrl || demo.value.embedUrl);
const aria = computed(() =>
  props.locale === "zh" ? "示范视频" : "Demo video",
);

function openMpEmbed() {
  // Full-page web-view: video only — no credit / switch-source chrome.
  uni.navigateTo({
    url: `/pages/star-demo-embed/star-demo-embed?src=${encodeURIComponent(embedUrl.value)}`,
  });
}
</script>

<style scoped>
.star-demo-player {
  width: 100%;
}
.star-demo-frame {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  overflow: hidden;
  border-radius: 12px;
  background: #0b1220;
}
.star-demo-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #0b1220;
}
.star-demo-mp {
  display: flex;
  align-items: center;
  justify-content: center;
}
.star-demo-mp-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f8fafc;
  font-size: 36px;
  opacity: 0.9;
}
</style>
