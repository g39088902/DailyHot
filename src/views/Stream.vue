<template>
  <div class="stream-view">
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
            {{ scoredNewsCount }}/{{ totalNewsCount }}）
          </n-text>
        </div>
      </div>
      <div class="right">
        <n-space align="center">
          <n-tag v-if="isLoading" round type="info" size="small">
            信源加载 ({{ loadedSourcesCount }}/{{ sourceCount }})
          </n-tag>
          <n-tag v-else round type="success" size="small">信源加载完成</n-tag>
          <n-tag v-if="isScoring" round type="warning" size="small">
            AI 评分中 ({{ scoredNewsCount }}/{{ totalNewsCount }} · 并发 {{ activeScoreWorkers }}/{{ MAX_SCORE_CONCURRENCY }})
          </n-tag>
          <n-tag v-else-if="totalNewsCount > 0 && scoredNewsCount > 0" round type="success" size="small">
            AI 评分完成 ({{ scoredNewsCount }}/{{ totalNewsCount }})
          </n-tag>
          <n-button
            secondary
            strong
            round
            :loading="isLoading"
            @click="loadAllSourcesSequentially(true)"
          >
            <template #icon>
              <n-icon :component="Refresh" />
            </template>
            重新加载全部
          </n-button>
        </n-space>
      </div>
    </div>

    <!-- 顶部信源快捷导航 -->
    <n-card
      v-if="activeSources.length > 0"
      class="anchor-bar"
      size="small"
      :bordered="false"
    >
      <div class="source-nav">
        <div
          v-for="source in activeSources"
          :key="source.name"
          class="source-nav-tag"
          :class="{
            active: currentSourceFilter === source.name,
            loading: sourceLoadingMap[source.name],
          }"
          @click="filterBySource(source.name)"
        >
          <img
            :src="`/logo/${source.name}.png`"
            class="source-nav-logo"
            @error="(e) => (e.target.style.display = 'none')"
          />
          <span class="source-nav-label">{{ source.label }}</span>
          <span class="source-nav-count">
            {{
              sourceLoadingMap[source.name]
                ? "..."
                : sourceDataMap[source.name]?.data?.length || 0
            }}
          </span>
        </div>
      </div>
    </n-card>

    <!-- 聚合主列表（不分页，已打分按分数降序，未打分按原顺序） -->
    <n-card class="stream-card" :bordered="false">
      <!-- 初始无任何数据且正在加载第一个信源时的骨架 -->
      <div
        v-if="isLoading && allArticles.length === 0"
        class="loading-state"
      >
        <div class="first-load-tip">
          <n-spin size="medium" />
          <n-text :depth="2" style="margin-left: 12px">
            正在优先请求第 1 个信源（{{ currentFetchingSourceLabel }}），获取后立即呈现在列表...
          </n-text>
        </div>
        <n-skeleton text round :repeat="10" height="38px" style="margin-top: 20px" />
      </div>

      <div v-else-if="allArticles.length === 0 && !isLoading" class="empty-state">
        <n-empty description="暂无热点资讯或所有信源已在设置中关闭">
          <template #extra>
            <n-button
              size="small"
              secondary
              strong
              @click="router.push('/setting')"
            >
              前往设置开启榜单
            </n-button>
          </template>
        </n-empty>
      </div>

      <div v-else class="stream-list">
        <n-list hoverable clickable>
          <n-list-item
            v-for="(item, index) in allArticles"
            :key="item._uniqueKey || `${item._sourceName}-${item.id || index}`"
            @click="jumpLink(item)"
            class="stream-item"
          >
            <!-- 连续序号 -->
            <template #prefix>
              <n-text
                class="num"
                :class="{
                  top1: index === 0,
                  top2: index === 1,
                  top3: index === 2,
                }"
                :depth="2"
              >
                {{ index + 1 }}
              </n-text>
            </template>

            <!-- 标题、热度、评分标签和信源标签 -->
            <div class="content">
              <div class="header-line">
                <n-tag
                  size="small"
                  round
                  :bordered="false"
                  class="source-tag"
                  @click.stop="filterBySource(item._sourceName)"
                >
                  <template #avatar>
                    <img
                      :src="`/logo/${item._sourceName}.png`"
                      class="tag-logo"
                      @error="(e) => (e.target.style.display = 'none')"
                    />
                  </template>
                  {{ item._sourceLabel }}
                </n-tag>

                <!-- 热度标签（紧跟渠道后面） -->
                <div class="hot-badge" v-if="item.hot">
                  <n-icon :component="Fire" />
                  <n-text class="hot-text" :depth="3" v-html="item.hot" />
                </div>

                <!-- AI 评分徽章（鼠标悬浮转为进度条，随松开鼠标即时修正生效） -->
                <div
                  v-if="typeof item._score === 'number'"
                  class="score-interactive-wrap"
                  @mouseenter="onScoreMouseEnter(item._uniqueKey)"
                  @mouseleave="onScoreMouseLeave(item._uniqueKey)"
                  @click.stop
                  @mousedown.stop
                >
                  <!-- 悬浮或拖拽态：可拖动进度条 -->
                  <div
                    v-if="isScoreSliderActive(item._uniqueKey)"
                    :class="['score-progress-slider', getScoreClass(getDisplayScore(item))]"
                  >
                    <div
                      class="score-progress-fill"
                      :style="{ width: `${getDisplayScore(item)}%` }"
                    />
                    <span class="score-progress-label">
                      {{ getDisplayScore(item) }}分 · {{ getLayerByScore(getDisplayScore(item)) }}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      class="score-range-input"
                      :value="getDisplayScore(item)"
                      @mousedown.stop="onScoreDragStart(item)"
                      @touchstart.stop="onScoreDragStart(item)"
                      @input="onScoreSliderInput(item, $event)"
                      @change="onScoreSliderCommit(item, $event)"
                      @click.stop
                    />
                  </div>

                  <!-- 默认态：分数胶囊 Tag -->
                  <n-tag
                    v-else
                    size="small"
                    round
                    :bordered="false"
                    :class="[
                      'score-tag',
                      getScoreClass(item._score),
                      { 'user-modified': item._isUserModified },
                    ]"
                  >
                    {{ item._score }}分
                    <span v-if="item._layer" class="score-layer">· {{ item._layer }}</span>
                    <span v-if="item._isUserModified" class="manual-dot" title="已手动修正">✎</span>
                  </n-tag>
                </div>
                <n-tag
                  v-else-if="item._scoreStatus === 'scoring'"
                  size="small"
                  round
                  :bordered="false"
                  class="score-tag scoring"
                >
                  评分中...
                </n-tag>

                <n-text class="item-title" :style="{ fontSize: store.listFontSize + 'px' }">
                  {{ item.title }}
                </n-text>

                <!-- 命中/排除依据简述 -->
                <n-text v-if="item._reason" :depth="3" class="score-reason">
                  {{ item._reason }}
                </n-text>
              </div>

              <!-- 描述内容（若有） -->
              <n-text
                v-if="item.desc"
                class="item-desc"
                :depth="3"
                v-html="item.desc"
              />
            </div>
          </n-list-item>
        </n-list>
      </div>

      <!-- 底部加载进度条（当信源请求或 AI 评分未全部完成时展示） -->
      <div v-if="isLoading || isScoring" class="bottom-progress-panel">
        <div class="progress-info">
          <div class="info-left">
            <n-spin size="small" />
            <n-text v-if="isLoading" class="progress-text">
              正在获取：<strong class="current-label">{{ currentFetchingSourceLabel }}</strong>
              （已加载 {{ loadedSourcesCount }} / {{ sourceCount }} 个信源 · 已评分 {{ scoredNewsCount }} / {{ totalNewsCount }} 条）
            </n-text>
            <n-text v-else class="progress-text">
              正在进行 AI 个性化评分（已评分 <strong class="current-label">{{ scoredNewsCount }}</strong> / {{ totalNewsCount }} 条 ·
              并发数 {{ activeScoreWorkers }}/{{ MAX_SCORE_CONCURRENCY }}）
            </n-text>
          </div>
          <n-text :depth="3" class="percentage-text">
            {{ isLoading ? progressPercentage : scoreProgressPercentage }}%
          </n-text>
        </div>
        <n-progress
          type="line"
          :percentage="isLoading ? progressPercentage : scoreProgressPercentage"
          :show-indicator="false"
          :status="isLoading ? 'info' : 'warning'"
          processing
        />
      </div>

      <!-- 全部加载完成提示 -->
      <div v-else-if="allArticles.length > 0" class="completed-footer">
        <n-divider dashed>
          <n-text :depth="3">
            已加载全部 {{ sourceCount }} 个信源共 {{ totalNewsCount }} 条内容（已完成 AI 评分 {{ scoredNewsCount }} 条并按分数降序排列）
          </n-text>
        </n-divider>
      </div>
    </n-card>
  </div>
</template>

<script setup>
import { computed, ref, reactive, watch, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { Fire, Refresh, ArrowLeft } from "@icon-park/vue-next";
import { mainStore } from "@/store";
import { getHotLists, scoreNews, updateManualScore } from "@/api";

const router = useRouter();
const store = mainStore();

// 最大评分并发数
const MAX_SCORE_CONCURRENCY = 5;

// 筛选状态
const currentSourceFilter = ref(null);

// 信源数据缓存映射
const sourceDataMap = reactive({});
const sourceLoadingMap = reactive({});
const isLoading = ref(false);
const currentFetchingSourceLabel = ref("");
let abortController = { aborted: false };

// 新闻评分状态映射与并发队列
// key: _uniqueKey -> { status: 'pending' | 'scoring' | 'done' | 'error', score?: number, layer?: string, reason?: string, newsHash?: string, isUserModified?: boolean }
const scoreMap = reactive({});
const scoreQueue = [];
const activeScoreWorkers = ref(0);
const pendingQueueCount = ref(0);
let currentScoreRunId = 0;

// 评分悬浮进度条与实时拖拽状态
const hoveredScoreKey = ref(null);
const draggingScoreKey = ref(null);
const previewScoreMap = reactive({});

// 获取有效信源列表（严格按照当前用户设置好的先后顺序与显示状态）
const activeSources = computed(() => {
  return store.newsArr.filter((item) => Boolean(item.show));
});

const sourceCount = computed(() => activeSources.value.length);

const loadedSourcesCount = computed(() => {
  return activeSources.value.filter((s) => !sourceLoadingMap[s.name] && sourceDataMap[s.name]).length;
});

const progressPercentage = computed(() => {
  if (sourceCount.value === 0) return 0;
  return Math.min(100, Math.round((loadedSourcesCount.value / sourceCount.value) * 100));
});

// 汇总并排序新闻列表：
// 1. 已打分的新闻按分数降序排列（同分按原顺序排列）
// 2. 未打分的新闻排在已打分新闻之后，并严格保持原顺序排列
const allArticles = computed(() => {
  const merged = [];
  let originalIndex = 0;

  for (const source of activeSources.value) {
    if (currentSourceFilter.value && currentSourceFilter.value !== source.name) {
      continue;
    }
    const res = sourceDataMap[source.name];
    if (res && Array.isArray(res.data)) {
      res.data.forEach((item, index) => {
        const uniqueKey = `${source.name}-${item.id || item.url || index}`;
        const scoreInfo = scoreMap[uniqueKey];
        const hasScore = scoreInfo && scoreInfo.status === "done" && typeof scoreInfo.score === "number";

        merged.push({
          ...item,
          _sourceName: source.name,
          _sourceLabel: source.label,
          _sourceOrder: source.order ?? 0,
          _indexInSource: index,
          _originalIndex: originalIndex++,
          _uniqueKey: uniqueKey,
          _scoreStatus: scoreInfo?.status || "idle",
          _score: hasScore ? scoreInfo.score : undefined,
          _layer: hasScore ? scoreInfo.layer : undefined,
          _reason: hasScore ? scoreInfo.reason : undefined,
          _newsHash: hasScore ? scoreInfo.newsHash : undefined,
          _isUserModified: hasScore ? Boolean(scoreInfo.isUserModified) : false,
        });
      });
    }
  }

  merged.sort((a, b) => {
    const aScored = typeof a._score === "number";
    const bScored = typeof b._score === "number";

    // 两篇都已打分：按分数降序，同分按原顺序
    if (aScored && bScored) {
      if (b._score !== a._score) {
        return b._score - a._score;
      }
      return a._originalIndex - b._originalIndex;
    }

    // 已打分排在未打分之前
    if (aScored !== bScored) {
      return aScored ? -1 : 1;
    }

    // 两篇都未打分：按原顺序排列
    return a._originalIndex - b._originalIndex;
  });

  return merged;
});

const totalNewsCount = computed(() => allArticles.value.length);

const scoredNewsCount = computed(() => {
  return allArticles.value.filter((item) => typeof item._score === "number").length;
});

const isScoring = computed(() => {
  return activeScoreWorkers.value > 0 || pendingQueueCount.value > 0;
});

const scoreProgressPercentage = computed(() => {
  if (totalNewsCount.value === 0) return 0;
  return Math.min(100, Math.round((scoredNewsCount.value / totalNewsCount.value) * 100));
});

// 根据分数段返回对应的视觉样式类名
const getScoreClass = (score) => {
  if (score >= 90) return "score-l1";
  if (score >= 75) return "score-l2";
  if (score >= 60) return "score-l4";
  if (score >= 40) return "score-neutral";
  return "score-l5";
};

// 根据分数段推断对应的层级标签
const getLayerByScore = (score) => {
  if (score >= 90) return "L1";
  if (score >= 75) return "L2";
  if (score >= 60) return "L4";
  if (score >= 40) return "Uncertain";
  return "L5";
};

// 判断某条新闻是否处于进度条激活态（鼠标悬浮或正在拖动中）
const isScoreSliderActive = (uniqueKey) => {
  return hoveredScoreKey.value === uniqueKey || draggingScoreKey.value === uniqueKey;
};

// 获取当前展示的分数（拖拽中优先展示实时预览分，未拖拽展示实际分）
const getDisplayScore = (item) => {
  const preview = previewScoreMap[item._uniqueKey];
  if (typeof preview === "number") return preview;
  return typeof item._score === "number" ? item._score : 0;
};

const onScoreMouseEnter = (uniqueKey) => {
  hoveredScoreKey.value = uniqueKey;
};

const onScoreMouseLeave = (uniqueKey) => {
  if (hoveredScoreKey.value === uniqueKey) {
    hoveredScoreKey.value = null;
  }
  if (draggingScoreKey.value !== uniqueKey) {
    delete previewScoreMap[uniqueKey];
  }
};

const onScoreDragStart = (item) => {
  draggingScoreKey.value = item._uniqueKey;
  if (typeof item._score === "number") {
    previewScoreMap[item._uniqueKey] = item._score;
  }
};

const onScoreSliderInput = (item, event) => {
  const val = Math.max(0, Math.min(100, Math.round(Number(event.target.value))));
  draggingScoreKey.value = item._uniqueKey;
  previewScoreMap[item._uniqueKey] = val;
};

// 松开鼠标即时提交并生效
const onScoreSliderCommit = async (item, event) => {
  const uniqueKey = item._uniqueKey;
  const newScore = Math.max(0, Math.min(100, Math.round(Number(event.target.value))));
  const newLayer = getLayerByScore(newScore);

  draggingScoreKey.value = null;
  delete previewScoreMap[uniqueKey];

  const prevInfo = scoreMap[uniqueKey] ? { ...scoreMap[uniqueKey] } : null;
  if (prevInfo && prevInfo.score === newScore && prevInfo.isUserModified) {
    return;
  }

  // 乐观更新本地状态，随松开鼠标立刻重排生效
  scoreMap[uniqueKey] = {
    ...(prevInfo || {}),
    status: "done",
    score: newScore,
    layer: newLayer,
    isUserModified: true,
  };

  try {
    const res = await updateManualScore({
      newsHash: item._newsHash || prevInfo?.newsHash,
      title: item.title || "",
      desc: item.desc || "",
      source: item._sourceLabel || item._sourceName || "",
      url: item.url || item.mobileUrl || "",
      userScore: newScore,
      userLayer: newLayer,
    });

    const savedData = res?.data || res;
    if (savedData && typeof savedData.score === "number") {
      scoreMap[uniqueKey] = {
        ...(scoreMap[uniqueKey] || {}),
        status: "done",
        score: savedData.score,
        layer: savedData.layer || newLayer,
        reason: savedData.reason || prevInfo?.reason || "",
        newsHash: savedData.newsHash || prevInfo?.newsHash,
        isUserModified: true,
      };
    }
    window.$message?.success(`已修正评分为 ${newScore} 分 (${newLayer})`);
  } catch (err) {
    console.error("保存手动评分修正失败:", err);
    if (prevInfo) {
      scoreMap[uniqueKey] = prevInfo;
    }
    window.$message?.error("保存手动评分失败");
  }
};

// 启动并发打分 Worker（最多同时 5 个请求在途）
const pumpScoreQueue = (runId) => {
  while (
    activeScoreWorkers.value < MAX_SCORE_CONCURRENCY &&
    scoreQueue.length > 0 &&
    runId === currentScoreRunId &&
    !abortController.aborted
  ) {
    activeScoreWorkers.value++;

    (async () => {
      try {
        while (
          scoreQueue.length > 0 &&
          runId === currentScoreRunId &&
          !abortController.aborted
        ) {
          const task = scoreQueue.shift();
          pendingQueueCount.value = scoreQueue.length;
          if (!task) break;

          scoreMap[task.uniqueKey] = {
            status: "scoring",
          };

          try {
            const res = await scoreNews(
              {
                title: task.title,
                desc: task.desc,
                source: task.source,
              },
              task.isNew
            );

            if (runId !== currentScoreRunId || abortController.aborted) break;

            const scoreVal = res?.score ?? res?.data?.score;
            const layerVal = res?.layer ?? res?.data?.layer;
            const reasonVal = res?.reason ?? res?.data?.reason;
            const newsHashVal = res?.newsHash ?? res?.data?.newsHash;
            const isUserModifiedVal = Boolean(
              res?.isUserModified ?? res?.data?.isUserModified
            );

            if (typeof scoreVal === "number" && !Number.isNaN(scoreVal)) {
              scoreMap[task.uniqueKey] = {
                status: "done",
                score: scoreVal,
                layer: layerVal || "",
                reason: reasonVal || "",
                newsHash: newsHashVal || "",
                isUserModified: isUserModifiedVal,
              };
            } else {
              scoreMap[task.uniqueKey] = {
                status: "error",
              };
            }
          } catch (err) {
            if (runId !== currentScoreRunId || abortController.aborted) break;
            console.error(`新闻评分失败 [${task.title}]:`, err);
            scoreMap[task.uniqueKey] = {
              status: "error",
            };
          }
        }
      } finally {
        activeScoreWorkers.value = Math.max(0, activeScoreWorkers.value - 1);
      }
    })();
  }
};

// 将某个信源的新闻加入打分队列并立即触发并发 worker
const enqueueSourceArticlesForScoring = (source, items, isNew, runId) => {
  if (!Array.isArray(items) || items.length === 0) return;

  items.forEach((item, index) => {
    const uniqueKey = `${source.name}-${item.id || item.url || index}`;
    const existing = scoreMap[uniqueKey];

    // 非强制刷新时，已完成打分的条目直接复用
    if (!isNew && existing && existing.status === "done" && typeof existing.score === "number") {
      return;
    }

    // 避免同一轮重复入队
    if (existing && (existing.status === "pending" || existing.status === "scoring")) {
      return;
    }

    scoreMap[uniqueKey] = {
      status: "pending",
    };

    scoreQueue.push({
      uniqueKey,
      title: item.title || "",
      desc: item.desc || "",
      source: source.label || source.name,
      isNew,
    });
  });

  pendingQueueCount.value = scoreQueue.length;
  pumpScoreQueue(runId);
};

// 从第一个信源开始顺序链式请求并实时渲染 + 流式并发打分
const loadAllSourcesSequentially = async (isNew = false) => {
  // 取消可能正在进行的请求与打分循环
  abortController.aborted = true;
  const currentAbort = { aborted: false };
  abortController = currentAbort;

  // 重置待处理打分队列
  currentScoreRunId++;
  const runId = currentScoreRunId;
  scoreQueue.length = 0;
  pendingQueueCount.value = 0;

  if (isNew) {
    Object.keys(scoreMap).forEach((key) => {
      delete scoreMap[key];
    });
  } else {
    // 清理上一轮排队中但尚未开始打分的条目，以便按照最新信源排序与开启状态重新排队
    Object.keys(scoreMap).forEach((key) => {
      if (scoreMap[key]?.status === "pending") {
        delete scoreMap[key];
      }
    });
  }

  const sources = activeSources.value;
  if (!sources || sources.length === 0) {
    isLoading.value = false;
    currentFetchingSourceLabel.value = "";
    return;
  }

  const hasUnloadedSource = isNew || sources.some((s) => !sourceDataMap[s.name]);
  if (hasUnloadedSource) {
    isLoading.value = true;
  }

  for (let i = 0; i < sources.length; i++) {
    if (currentAbort.aborted) break;

    const source = sources[i];

    // 非强制刷新且已有缓存数据时，直接复用缓存并按当前排序入队未打分条目
    if (!isNew && sourceDataMap[source.name]?.code === 200) {
      sourceLoadingMap[source.name] = false;
      enqueueSourceArticlesForScoring(source, sourceDataMap[source.name].data, false, runId);
      continue;
    }

    sourceLoadingMap[source.name] = true;
    currentFetchingSourceLabel.value = source.label;

    try {
      const res = await getHotLists(source.name, isNew, source.params);
      if (currentAbort.aborted) break;

      if (res && res.code === 200) {
        // 请求到立刻存入并触发响应式立即渲染到界面中
        sourceDataMap[source.name] = res;
        // 立即将该信源下的新闻推入最多 5 并发的打分队列
        enqueueSourceArticlesForScoring(source, res.data, isNew, runId);
      }
    } catch (err) {
      console.error(`信源 ${source.label} 加载失败:`, err);
    } finally {
      sourceLoadingMap[source.name] = false;
    }
  }

  if (!currentAbort.aborted) {
    isLoading.value = false;
    currentFetchingSourceLabel.value = "";
  }
};

// 监听设置中信源排序或开启状态的变化，实时同步流式浏览
watch(
  () => activeSources.value.map((s) => s.name).join(","),
  () => {
    if (
      currentSourceFilter.value &&
      !activeSources.value.some((s) => s.name === currentSourceFilter.value)
    ) {
      currentSourceFilter.value = null;
    }
    loadAllSourcesSequentially(false);
  }
);

// 点击信源筛选或取消筛选
const filterBySource = (sourceName) => {
  if (currentSourceFilter.value === sourceName) {
    currentSourceFilter.value = null;
  } else {
    currentSourceFilter.value = sourceName;
  }
};

// 链接跳转处理
const jumpLink = (data) => {
  if (!data.url && !data.mobileUrl) {
    window.$message?.error("链接不存在");
    return;
  }
  const url = (window.innerWidth > 680 ? data.url : data.mobileUrl) || data.url;
  if (store.linkOpenType === "open") {
    window.open(url, "_blank");
  } else if (store.linkOpenType === "href") {
    window.location.href = url;
  }
};

onMounted(() => {
  loadAllSourcesSequentially(false);
});

onBeforeUnmount(() => {
  abortController.aborted = true;
  currentScoreRunId++;
  scoreQueue.length = 0;
  pendingQueueCount.value = 0;
});
</script>

<style lang="scss" scoped>
.stream-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 60px;

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
  }

  .anchor-bar {
    border-radius: 12px;
    background-color: var(--n-color);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

    .source-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .source-nav-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 16px;
        background-color: var(--n-border-color);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;

        .source-nav-logo {
          width: 16px;
          height: 16px;
          border-radius: 50%;
        }

        .source-nav-count {
          font-size: 11px;
          opacity: 0.7;
          background: rgba(0, 0, 0, 0.08);
          padding: 1px 6px;
          border-radius: 10px;
        }

        &:hover {
          opacity: 0.85;
          transform: translateY(-1px);
        }

        &.active {
          background-color: var(--n-color-primary, #18a058);
          color: #fff;

          .source-nav-count {
            background: rgba(255, 255, 255, 0.25);
            color: #fff;
          }
        }

        &.loading {
          animation: pulse 1.5s infinite;
        }
      }
    }
  }

  .stream-card {
    border-radius: 12px;

    .loading-state {
      padding: 24px;
      .first-load-tip {
        display: flex;
        align-items: center;
      }
    }

    .empty-state {
      padding: 60px 0;
    }

    .stream-list {
      .stream-item {
        padding: 12px 8px;
        border-radius: 8px;
        transition: background-color 0.2s;

        .num {
          font-size: 14px;
          font-weight: bold;
          min-width: 38px;
          display: inline-block;
          text-align: center;

          &.top1 {
            color: #ea4444;
          }
          &.top2 {
            color: #ea7044;
          }
          &.top3 {
            color: #ea9b44;
          }
        }

        .content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100%;

          .header-line {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;

            .source-tag {
              cursor: pointer;
              background-color: var(--n-border-color);
              font-size: 12px;
              height: 22px;
              line-height: 22px;

              .tag-logo {
                width: 14px;
                height: 14px;
                border-radius: 50%;
              }

              &:hover {
                filter: brightness(0.95);
              }
            }

            .hot-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-size: 12px;
              height: 22px;
              line-height: 22px;
              background: rgba(234, 68, 68, 0.08);
              color: #ea4444;
              padding: 0 8px;
              border-radius: 11px;
              white-space: nowrap;

              .hot-text {
                color: inherit;
              }
            }

            .score-interactive-wrap {
              display: inline-flex;
              align-items: center;
              height: 22px;
            }

            .score-progress-slider {
              position: relative;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 146px;
              height: 22px;
              border-radius: 11px;
              overflow: hidden;
              background: rgba(128, 128, 128, 0.14);
              box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
              user-select: none;
              cursor: ew-resize;

              .score-progress-fill {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                border-radius: 11px 0 0 11px;
                transition: width 0.03s linear, background-color 0.15s ease;
              }

              .score-progress-label {
                position: relative;
                z-index: 1;
                font-size: 12px;
                font-weight: 600;
                line-height: 22px;
                padding: 0 8px;
                white-space: nowrap;
                pointer-events: none;
              }

              .score-range-input {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                opacity: 0;
                cursor: ew-resize;
                z-index: 2;
              }

              &.score-l1 {
                background: rgba(234, 68, 68, 0.1);
                color: #b31412;
                .score-progress-fill {
                  background: rgba(234, 68, 68, 0.32);
                }
              }

              &.score-l2 {
                background: rgba(240, 138, 0, 0.1);
                color: #ad4e00;
                .score-progress-fill {
                  background: rgba(240, 138, 0, 0.32);
                }
              }

              &.score-l4 {
                background: rgba(24, 160, 88, 0.1);
                color: #0e7a43;
                .score-progress-fill {
                  background: rgba(24, 160, 88, 0.32);
                }
              }

              &.score-neutral {
                background: rgba(32, 128, 240, 0.1);
                color: #1060c9;
                .score-progress-fill {
                  background: rgba(32, 128, 240, 0.3);
                }
              }

              &.score-l5 {
                background: rgba(128, 128, 128, 0.1);
                color: #555;
                .score-progress-fill {
                  background: rgba(128, 128, 128, 0.3);
                }
              }
            }

            .score-tag {
              font-size: 12px;
              font-weight: 600;
              height: 22px;
              line-height: 22px;
              padding: 0 8px;
              cursor: pointer;

              .score-layer {
                font-weight: 500;
                opacity: 0.9;
                margin-left: 2px;
              }

              .manual-dot {
                margin-left: 3px;
                font-size: 11px;
                opacity: 0.85;
              }

              &.user-modified {
                box-shadow: inset 0 0 0 1px currentColor;
              }

              &.score-l1 {
                background: rgba(234, 68, 68, 0.14);
                color: #d93025;
              }

              &.score-l2 {
                background: rgba(240, 138, 0, 0.14);
                color: #d46b08;
              }

              &.score-l4 {
                background: rgba(24, 160, 88, 0.14);
                color: #18a058;
              }

              &.score-neutral {
                background: rgba(32, 128, 240, 0.12);
                color: #2080f0;
              }

              &.score-l5 {
                background: rgba(128, 128, 128, 0.12);
                color: #888;
              }

              &.scoring {
                background: rgba(240, 160, 32, 0.1);
                color: #d48806;
                font-weight: 400;
                cursor: default;
              }
            }

            .item-title {
              font-weight: 500;
              line-height: 1.4;
              word-break: break-all;
              transition: color 0.2s;

              &:hover {
                color: var(--n-color-primary, #18a058);
              }
            }

            .score-reason {
              font-size: 12px;
              opacity: 0.75;
            }
          }

          .item-desc {
            font-size: 13px;
            line-height: 1.5;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            word-break: break-all;
          }
        }
      }
    }

    .bottom-progress-panel {
      margin-top: 24px;
      padding: 16px 20px;
      border-radius: 10px;
      background-color: var(--n-color-modal, rgba(0, 0, 0, 0.03));
      border: 1px dashed var(--n-border-color);

      .progress-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;

        .info-left {
          display: flex;
          align-items: center;
          gap: 10px;

          .progress-text {
            font-size: 13px;

            .current-label {
              color: var(--n-color-primary, #18a058);
            }
          }
        }

        .percentage-text {
          font-size: 13px;
          font-weight: bold;
        }
      }
    }

    .completed-footer {
      margin-top: 32px;
      padding-bottom: 12px;
    }
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

@media (max-width: 680px) {
  .stream-view {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
}
</style>
