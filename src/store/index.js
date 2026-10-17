import { defineStore } from "pinia";

export const mainStore = defineStore("mainData", {
  state: () => {
    return {
      // 系统主题
      siteTheme: "light",
      siteThemeAuto: true,
      // 新闻类别
      defaultNewsArr: [
        {
          label: "哔哩哔哩",
          name: "bilibili",
          order: 0,
          show: true,
        },
        {
          label: "抖音",
          name: "douyin",
          order: 1,
          show: true,
        },
        {
          label: "快手",
          name: "kuaishou",
          order: 2,
          show: true,
        },
        {
          label: "36氪",
          name: "36kr",
          order: 3,
          show: true,
        },
        {
          label: "少数派",
          name: "sspai",
          order: 4,
          show: true,
        },
        {
          label: "IT之家",
          name: "ithome",
          order: 5,
          show: true,
        },
        {
          label: "澎湃新闻",
          name: "thepaper",
          order: 6,
          show: true,
        },
        {
          label: "今日头条",
          name: "toutiao",
          order: 7,
          show: true,
        },
        {
          label: "稀土掘金",
          name: "juejin",
          order: 8,
          show: true,
        },
        {
          label: "腾讯新闻",
          name: "qq-news",
          order: 9,
          show: true,
        },
        {
          label: "网易新闻",
          name: "netease-news",
          order: 10,
          show: true,
        },
        {
          label: "豆瓣讨论小组",
          name: "douban-group",
          order: 11,
          show: true,
        },
        {
          label: "NGA",
          name: "ngabbs",
          order: 12,
          show: true,
        },
        {
          label: "HelloGitHub",
          name: "hellogithub",
          order: 13,
          show: true,
        },
        {
          label: "GitHub",
          name: "github",
          order: 14,
          show: true,
        },
        {
          label: "V2EX",
          name: "v2ex",
          order: 15,
          show: true,
        },
      ],
      newsArr: [],
      // 链接跳转方式
      linkOpenType: "open",
      // 页头固定
      headerFixed: true,
      // 时间数据
      timeData: null,
      // 字体大小
      listFontSize: 16,
    };
  },
  getters: {},
  actions: {
    // 更改系统主题
    setSiteTheme(val) {
      $message.info(`已切换至${val === "dark" ? "深色模式" : "浅色模式"}`, {
        showIcon: false,
      });
      this.siteTheme = val;
      this.siteThemeAuto = false;
    },
    // 检查更新
    checkNewsUpdate() {
      const mainData = JSON.parse(localStorage.getItem("mainData"));
      let updatedNum = 0;
      if (!mainData) return false;
      console.log("列表尝试更新", this.defaultNewsArr, this.newsArr);
      // 执行比较并迁移
      if (this.newsArr.length > 0) {
        // 过滤掉已移除的分类
        this.newsArr = this.newsArr.filter((news) =>
          this.defaultNewsArr.some((item) => item.name === news.name)
        );
        for (const newItem of this.defaultNewsArr) {
          const exists = this.newsArr.some(
            (news) => newItem.name === news.name
          );
          if (!exists) {
            console.log("列表有更新：", newItem);
            updatedNum++;
            this.newsArr.push({ ...newItem, show: true });
          }
        }
        // 确保所有信源在前端打开展示
        this.newsArr.forEach((item) => {
          item.show = true;
        });
        if (updatedNum) $message.success(`成功更新 ${updatedNum} 个榜单数据`);
      } else {
        console.log("列表无内容，写入默认");
        this.newsArr = this.defaultNewsArr;
      }
    },
  },
  persist: [
    {
      storage: localStorage,
      paths: [
        "siteTheme",
        "siteThemeAuto",
        "newsArr",
        "linkOpenType",
        "headerFixed",
        "listFontSize",
      ],
    },
  ],
});
