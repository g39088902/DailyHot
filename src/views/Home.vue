<template>
  <div class="home">
    <div class="stream-banner" @click="router.push('/stream')">
      <div class="banner-left">
        <div class="banner-icon">
          <n-icon size="22" :component="ViewList" />
        </div>
        <div class="banner-text">
          <div class="banner-title">全网聚合信息流</div>
          <div class="banner-desc">按信源顺序连续浏览所有实时热榜与聚合资讯</div>
        </div>
      </div>
      <div class="banner-right">
        <span class="enter-btn">进入流式浏览</span>
        <n-icon size="16" :component="Right" />
      </div>
    </div>
    <n-grid
      v-if="store.newsArr[0] && store.newsArr.filter((item) => item.show)[0]"
      cols="1 560:2 800:3 1100:4 1500:5"
      :x-gap="24"
      :y-gap="24"
    >
      <n-grid-item
        class="news-card"
        v-for="(item, index) in store.newsArr.filter((item) => item.show)"
        :key="item.name"
        :style="{ animationDelay: index / 10 + 0.2 + 's' }"
      >
        <HotList :key="item.name" :hotData="item" />
      </n-grid-item>
    </n-grid>
    <div class="error" v-else>
      <n-divider dashed class="tip"> 此处暂无内容 </n-divider>
      <n-space justify="center">
        <n-button
          size="large"
          secondary
          strong
          @click="router.push('/setting')"
        >
          前往设置开启榜单
        </n-button>
        <n-button size="large" secondary strong @click="reset">
          出错了？点此重置
        </n-button>
      </n-space>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { ViewList, Right } from "@icon-park/vue-next";
import { mainStore } from "@/store";
import HotList from "@/components/HotList.vue";

const router = useRouter();
const store = mainStore();

// 重置
const reset = () => {
  $dialog.warning({
    title: "重置站点",
    content:
      "确认重置站点？你的自定义数据将会恢复为默认状态！（当设置页面能正常进入并显示时请不要执行此操作！）",
    positiveText: "重置",
    negativeText: "取消",
    onPositiveClick: () => {
      if ($timeInterval) clearInterval($timeInterval);
      localStorage.clear();
      location.reload();
    },
  });
};
</script>

<style lang="scss" scoped>
.home {
  .stream-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding: 16px 20px;
    border-radius: 12px;
    background: var(--n-color);
    border: 1px solid var(--n-border-color);
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
    transition: all 0.25s ease;

    &:hover {
      border-color: var(--n-color-target);
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);

      .banner-icon {
        background: #2080f0;
        color: #fff;
      }

      .banner-right {
        color: #2080f0;
        transform: translateX(4px);
      }
    }

    .banner-left {
      display: flex;
      align-items: center;
      gap: 14px;

      .banner-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background: rgba(32, 128, 240, 0.1);
        color: #2080f0;
        transition: all 0.25s ease;
      }

      .banner-text {
        display: flex;
        flex-direction: column;
        gap: 3px;

        .banner-title {
          font-size: 16px;
          font-weight: 600;
          line-height: 1.3;
        }

        .banner-desc {
          font-size: 13px;
          opacity: 0.7;
          line-height: 1.3;
        }
      }
    }

    .banner-right {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 500;
      opacity: 0.85;
      transition: all 0.25s ease;

      .enter-btn {
        user-select: none;
      }
    }

    @media (max-width: 600px) {
      padding: 12px 14px;
      .banner-left {
        gap: 10px;
        .banner-icon {
          width: 36px;
          height: 36px;
        }
        .banner-text {
          .banner-title {
            font-size: 14px;
          }
          .banner-desc {
            font-size: 12px;
          }
        }
      }
      .banner-right .enter-btn {
        display: none;
      }
    }
  }

  .news-card {
    opacity: 0;
    transform: translateY(20px);
    animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
    animation: cardShow 0.3s forwards ease-in-out;
  }
  .tip {
    font-size: 22px;
  }
}

// 出现动画
@keyframes cardShow {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
