import { ref, reactive, computed } from "vue";
import { scoreNews, updateManualScore } from "@/api";

export const MAX_SCORE_CONCURRENCY = 5;

export function useStreamScoring({ onScoreReadSync, isAborted = () => false } = {}) {
  // key: _uniqueKey -> { status: 'pending' | 'scoring' | 'done' | 'error', score?: number, layer?: string, reason?: string, newsHash?: string, isUserModified?: boolean, fromCache?: boolean, isRead?: boolean }
  const scoreMap = reactive({});
  const scoreQueue = [];
  const activeScoreWorkers = ref(0);
  const pendingQueueCount = ref(0);
  let currentScoreRunId = 0;

  const isScoring = computed(() => {
    return activeScoreWorkers.value > 0 || pendingQueueCount.value > 0;
  });

  const resetScoreQueue = (isNew = false) => {
    currentScoreRunId++;
    scoreQueue.length = 0;
    pendingQueueCount.value = 0;

    if (isNew) {
      Object.keys(scoreMap).forEach((key) => {
        delete scoreMap[key];
      });
    } else {
      Object.keys(scoreMap).forEach((key) => {
        if (scoreMap[key]?.status === "pending") {
          delete scoreMap[key];
        }
      });
    }

    return currentScoreRunId;
  };

  const pumpScoreQueue = (runId) => {
    while (
      activeScoreWorkers.value < MAX_SCORE_CONCURRENCY &&
      scoreQueue.length > 0 &&
      runId === currentScoreRunId &&
      !isAborted()
    ) {
      activeScoreWorkers.value++;

      (async () => {
        try {
          while (
            scoreQueue.length > 0 &&
            runId === currentScoreRunId &&
            !isAborted()
          ) {
            const task = scoreQueue.shift();
            pendingQueueCount.value = scoreQueue.length;
            if (!task) break;

            const prev = scoreMap[task.uniqueKey];
            scoreMap[task.uniqueKey] = {
              ...(prev || {}),
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

              if (runId !== currentScoreRunId || isAborted()) break;

              const scoreVal = res?.score ?? res?.data?.score;
              const layerVal = res?.layer ?? res?.data?.layer;
              const reasonVal = res?.reason ?? res?.data?.reason;
              const newsHashVal = res?.newsHash ?? res?.data?.newsHash;
              const isUserModifiedVal = Boolean(
                res?.isUserModified ?? res?.data?.isUserModified
              );
              const fromCacheVal = Boolean(
                res?.fromCache ?? res?.data?.fromCache
              );
              const isReadFromDb = Boolean(
                res?.isRead ?? res?.data?.isRead
              );

              onScoreReadSync?.({
                uniqueKey: task.uniqueKey,
                newsHash: newsHashVal,
                isReadFromDb,
              });

              if (typeof scoreVal === "number" && !Number.isNaN(scoreVal)) {
                scoreMap[task.uniqueKey] = {
                  status: "done",
                  score: scoreVal,
                  layer: layerVal || "",
                  reason: reasonVal || "",
                  newsHash: newsHashVal || "",
                  isUserModified: isUserModifiedVal,
                  fromCache: fromCacheVal,
                  isRead:
                    isReadFromDb ||
                    scoreMap[task.uniqueKey]?.isRead,
                };
              } else {
                scoreMap[task.uniqueKey] = {
                  status: "error",
                };
              }
            } catch (err) {
              if (runId !== currentScoreRunId || isAborted()) break;
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
        ...(existing || {}),
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

  const commitManualScore = async ({ item, newScore, newLayer }) => {
    const uniqueKey = item._uniqueKey;
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
          fromCache: Boolean(savedData.fromCache ?? prevInfo?.fromCache),
          isRead: Boolean(savedData.isRead ?? prevInfo?.isRead ?? item._isRead),
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

  const cleanupScoring = () => {
    currentScoreRunId++;
    scoreQueue.length = 0;
    pendingQueueCount.value = 0;
  };

  return {
    MAX_SCORE_CONCURRENCY,
    scoreMap,
    activeScoreWorkers,
    pendingQueueCount,
    isScoring,
    getScoreRunId: () => currentScoreRunId,
    resetScoreQueue,
    pumpScoreQueue,
    enqueueSourceArticlesForScoring,
    commitManualScore,
    cleanupScoring,
  };
}
