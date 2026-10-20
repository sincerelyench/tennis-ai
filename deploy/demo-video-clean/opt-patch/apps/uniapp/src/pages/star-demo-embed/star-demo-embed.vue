<template>
  <!-- 涨球小程序：全页只播 embed，无署名/换源 -->
  <web-view v-if="src" :src="src" />
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";

const src = ref("");

onLoad((query) => {
  const raw = (query && (query.src as string)) || "";
  try {
    src.value = decodeURIComponent(raw);
  } catch {
    src.value = raw;
  }
});
</script>
