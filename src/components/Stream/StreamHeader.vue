<template>
  <div class="page-header">
    <div class="left">
      <n-button secondary strong round @click="router.push('/')">
        <template #icon>
          <n-icon :component="ArrowLeft" />
        </template>
        返回首页
      </n-button>
      <div class="title-info">
        <n-text class="main-title">全网聚合信息流</n-text>
        <n-text :depth="3" class="sub-title">
          已评分按分数降序 · 未评分按原序排列 · 共 {{ sourceCount }} 个信源 · {{ totalNewsCount }} 条内容（已评分
          {{ scoredNewsCount }}/{{ totalNewsCount }}
          <template v-if="cachedScoreCount > 0"> · 缓存命中 {{ cachedScoreCount }} 条</template>
          <template v-if="readNewsCount > 0"> · 已读 {{ readNewsCount }} 条</template>
          <template v-if="store.hideReadNews && hiddenReadCount > 0">
            · 已隐藏 {{ hiddenReadCount }} 条
          </template>）
        </n-text>
      </div>
    </div>
    <div class="right">
      <n-space align="center">
        <div class="hide-read-toggle" @click="store.hideReadNews = !store.hideReadNews">
          <n-switch
            v-model:value="store.hideReadNews"
            size="small"
            @click.stop
          />
          <span class="toggle-label">
            隐藏已看过的内容
            <template v-if="readNewsCount > 0">({{ readNewsCount }})</template>
          </span>
        </div>
        <n-tag v-if="isLoading" round type="info" size="small">
          信源加载 ({{ loadedSourcesCount }}/{{ sourceCount }})
        </n-tag>
        <n-tag v-else round type="success" size="small">信源加载完成</n-tag>
        <n-tag v-if="isScoring" round type="warning" size="small">
          AI 评分中 ({{ scoredNewsCount }}/{{ totalNewsCount }} · 并发 {{ activeScoreWorkers }}/{{ maxScoreConcurrency }})
        </n-tag>
        <n-tag v-else-if="totalNewsCount > 0 && scoredNewsCount > 0" round type="success" size="small">
          AI 评分完成 ({{ scoredNewsCount }}/{{ totalNewsCount }})
        </n-tag>
        <n-button
          secondary
          strong
          round
          :loading="isLoading"
          @click="$emit('reload')"
        >
          <template #icon>
            <n-icon :component="Refresh" />
          </template>
          重新加载全部
        </n-button>
      </n-space>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { ArrowLeft, Refresh } from "@icon-park/vue-next";
import { mainStore } from "@/store";

const router = useRouter();
const store = mainStore();

defineProps({
  sourceCount: {
    type: Number,
    default: 0,
  },
  totalNewsCount: {
    type: Number,
    default: 0,
  },
  scoredNewsCount: {
    type: Number,
    default: 0,
  },
  cachedScoreCount: {
    type: Number,
    default: 0,
  },
  readNewsCount: {
    type: Number,
    default: 0,
  },
  hiddenReadCount: {
    type: Number,
    default: 0,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  loadedSourcesCount: {
    type: Number,
    default: 0,
  },
  isScoring: {
    type: Boolean,
    default: false,
  },
  activeScoreWorkers: {
    type: Number,
    default: 0,
  },
  maxScoreConcurrency: {
    type: Number,
    default: 5,
  },
});

defineEmits(["reload"]);
</script>

<style lang="scss" scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;

  .left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;

    .title-info {
      display: flex;
      flex-direction: column;

      .main-title {
        font-size: 20px;
        font-weight: bold;
      }

      .sub-title {
        font-size: 13px;
        margin-top: 2px;
      }
    }
  }

  .right {
    .hide-read-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 16px;
      background-color: var(--n-border-color);
      cursor: pointer;
      user-select: none;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.85;
      }

      .toggle-label {
        font-size: 12px;
        line-height: 1;
      }
    }
  }
}

@media (max-width: 680px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
