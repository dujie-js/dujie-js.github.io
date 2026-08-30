# DuJie Home — 渡劫的个人主页

个人博客网站，基于 GitHub Pages 构建，纯静态前端，零后端依赖。

> **活出自己的人生** — [dujie-js.github.io](https://dujie-js.github.io)

---

## 项目概览

| 项目          | 说明                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| 域名          | `https://dujie-js.github.io`                                                |
| 托管          | GitHub Pages                                                                |
| 技术栈        | 纯 HTML + CSS + JavaScript，无构建工具                                      |
| Markdown 渲染 | [marked.js](https://marked.js.org/) v12（本地托管）                         |
| 统计          | 不蒜子                                                                      |
| 评论          | [utterances](https://utteranc.es/)（GitHub Issue 驱动，`github-dark` 主题） |
| 每日主题      | WakaTime 编码时长驱动（6 档主题 + AI 周报弹窗）                             |
| CI/CD         | GitHub Actions（4 个工作流：Bing 壁纸 / 每日主题 / 文章索引 / RSS）         |

---

## 页面结构

```
├── index.html              # 首页 — Bing 壁纸背景、一言鸡汤、个人简介
├── blog/
│   ├── index.html          # 博客列表页 — 分页展示、实时搜索（含清除按钮）
│   ├── post.html           # 文章页模板（生成器据此渲染 blog/<slug>/index.html）
│   └── <slug>/             # 每篇文章目录页（CI 生成，如 /blog/claude-code-guide/）
├── about/
│   ├── index.html          # 关于页（marked.js 渲染 content.md）
│   └── content.md          # 关于正文（Markdown）
├── resume/
│   └── resume.pdf          # 个人简历
├── posts/                  # 博客文章（Markdown + Frontmatter，当前 4 篇）
├── assets/
│   ├── css/                # 5 个 CSS 文件
│   │   ├── vno.css             # 主页主题（vno）
│   │   ├── wakatime-theme.css  # WakaTime 每日主题动效（头像发光、状态胶囊、周报弹窗、粒子）
│   │   ├── blog.css            # 博客系统专用样式
│   │   ├── iconfont.css        # 图标字体
│   │   └── onlinewebfonts.css  # Web 字体
│   ├── js/
│   │   ├── main.js         # 首页脚本（Bing 壁纸轮播、一言、微信弹窗、移动端菜单含动画防连点）
│   │   ├── theme-loader.js # WakaTime 主题加载器（应用每日主题 + 周报弹窗交互）
│   │   ├── blog.js         # 博客系统（6 大模块，IIFE 隔离）
│   │   ├── bing.js         # Bing 壁纸抓取（Node.js/CI，输出 JSONP 格式）
│   │   ├── generate-posts-index.js   # 文章索引生成（Node.js/CI）
│   │   └── generate-rss-sitemap.js   # RSS + sitemap 生成（Node.js/CI）
│   ├── json/
│   │   ├── posts.json      # 文章索引（CI 自动生成）
│   │   ├── images.json     # Bing 壁纸 URL（CI 每日更新，JSONP 回调格式）
│   │   ├── config.js       # 今日主题配置（CI 自动生成，window.WAKATIME_CONFIG）
│   │   └── weekly.js       # 本周编码统计 + 分级点评文案（CI 自动生成，window.WAKATIME_WEEKLY）
│   ├── img/
│   │   ├── myLogo.jpg      # 头像（JPEG 回退）
│   │   ├── myLogo.webp     # 头像（WebP，通过 <picture> 优先加载）
│   │   ├── wechat.svg      # 公众号图标（社交栏导航使用）
│   │   └── wechat.png      # 公众号二维码（弹窗展示）
│   └── fonts/              # 图标字体文件（iconfont + 标题装饰字体，均本地）
├── apple-touch-icon.png    # iOS 书签图标
├── feed.xml                # RSS 2.0 Feed（随推送即时生成，月度任务兜底）
├── sitemap.xml             # XML Sitemap（随推送即时生成，月度任务兜底）
└── 404.html                # 自定义 404 页面（SVG 猴子）
```

---

## 博客系统

### 前端模块

`blog.js` 分 7 个模块，全部包裹在外层 IIFE 中防止全局污染，仅暴露 HTML 页面需要的 5 个接口：

| 模块            | 功能                                                   | 暴露                      |
| --------------- | ------------------------------------------------------ | ------------------------- |
| `BlogUtils`     | 日期格式化、HTML 转义                                  | 内部使用                  |
| `BlogCards`     | 文章卡片渲染、关键词高亮（正则缓存）                   | 内部使用                  |
| `BlogIndex`     | 列表页 DOM 分页（`PAGE_SIZE=5`，静态卡片仅切显隐）     | ✅ `window.BlogIndex`     |
| `BlogPost`      | 静态文章增强（复制按钮/进度条/TOC/相关文章）           | ✅ `window.BlogPost`      |
| `BlogNav`       | 移动端菜单（图标切换 + 点击链接关闭）                  | ✅ `window.BlogNav`       |
| `BlogSearch`    | 实时搜索（150ms 防抖，含一键清除按钮）                 | ✅ `window.BlogSearch`    |
| `BlogBackToTop` | 回到顶部按钮（滚动 >300px 显示）                       | ✅ `window.BlogBackToTop` |

### 分页与搜索

文章 URL 采用目录式（`/blog/<slug>/`）。文章正文与列表卡片均为 CI 构建时静态渲染（SSG），爬虫可直接索引；分页是纯前端 DOM 分页（每页 5 篇，仅切换显隐，不重渲染），搜索词 `?q=xxx` 支持 URL 恢复。搜索时重渲染匹配卡片并应用同样分页。

### 文章目录（TOC）

文章加载后自动扫描 H2/H3 标题，生成粘性侧边目录。桌面端（≥1024px）右侧显示，点击平滑滚动。

### OG 标签 & 结构化数据

所有页面预置 `og:title` / `og:description` / `og:image` / `og:url` / `og:locale`。文章页 OG 标签与 Article JSON-LD Schema（headline/description/datePublished）由生成器构建时写入真实数据。

### 图片

- 文章正文中的 `<img>` 在渲染后自动添加 `loading="lazy"`。
- 首页头像使用 `<picture>` 标签优先加载 WebP 格式，降级 JPEG。
- 首页 Bing 壁纸 URL 经过正则白名单校验（`/th?id=OHR.*`），防止 CSS 注入。

### 每日主题 + AI 周报（WakaTime）

- 每日由 CI 拉取 WakaTime 编码数据，按**昨日编码时长**判定主题：休息日 🛌 → 轻松日 🌱 → 充实日 ⚡ → 专注日 🔥 → 极限日 🌟 → 超神日 💥。
- 页面右下角显示玻璃拟态状态胶囊（emoji + 主题名 + 编码小时数），点击弹出 **SYSTEM MONITOR 周报弹窗**：SVG 平滑折线图（近 7 天）、按日均时长分级的静态点评文案、总时长/日均/巅峰统计。
- 主题附带头像脉冲发光、粒子特效；`intense`/`legendary` 主题额外启用粒子效果。
- 调试：`?theme=focused&hours=6` URL 参数可临时预览任意主题，仅在本地（file:// 或 localhost）生效，防止线上链接被参数覆盖主题。

### 公众号弹窗

- 导航「公众号」点击弹出微信二维码（`assets/img/wechat.png`）。

### 评论

基于 [utterances](https://utteranc.es/)，通过完整 URL（含 slug）关联 GitHub Issue，每篇文章独立评论区，使用 `github-dark` 主题，读者用 GitHub 账号即可评论。

### 首页脚本

`main.js` 负责 Bing 壁纸轮播（8 张循环，URL 白名单校验防注入）、一言鸡汤加载（文本节点渲染防 XSS）、微信二维码弹窗、头像渐入动画、移动端菜单（附带防连点机制和动画状态管理）。Bing 壁纸 URL 通过 `images.json?cb=getBingImages` 以 JSONP 回调方式加载；`theme-loader.js` 负责每日主题与周报弹窗。

### 关于页面

`about/index.html` 由生成器构建时将 `content.md` 静态渲染进 `#about-content`（与文章页同源安全渲染），无运行时 Markdown 依赖。

### RSS

博客列表页、文章页、关于页底部均提供 RSS Feed 链接，指向 `/feed.xml`。

---

## CI/CD 工作流

### 推送触发 — `generate-posts.yml`

```
触发：posts/**、generate-posts-index.js、generate-rss-sitemap.js、或 workflow 文件自身变更
     （支持手动 workflow_dispatch）
步骤：
  1. actions/checkout@v4
  2. actions/setup-node@v4 (Node 20)
  3. node assets/js/generate-posts-index.js → 生成 posts.json
  4. node assets/js/generate-rss-sitemap.js → 同步生成 feed.xml + sitemap.xml
  5. 提交 posts.json/feed.xml/sitemap.xml（[skip ci]，无变更时跳过）
```

### 月度定时 — `generate-feed-monthly.yml`

```
触发：每月 1 号 02:57 UTC，或手动 workflow_dispatch
步骤：
  1. actions/checkout@v4
  2. actions/setup-node@v4 (Node 20)
  3. node assets/js/generate-rss-sitemap.js → 生成 feed.xml + sitemap.xml
  4. 提交文件（[skip ci]）
```

RSS/sitemap 现随文章推送即时更新（generate-posts.yml），月度任务保留作为兜底。所有工作流均配置 `concurrency` 组防并行冲突、`timeout-minutes` 防卡死。

### 每日定时 — `auto-bing.yml`

```
触发：每天 01:00 UTC（北京 09:00），或手动 workflow_dispatch
步骤：
  1. actions/checkout@v4
  2. actions/setup-node@v4 (Node 20)
  3. node assets/js/bing.js → 生成 images.json（8 张最新 Bing 壁纸）
  4. 提交 images.json（[bot] update images.json）
```

### 每日定时 — `daily-theme-update.yml`

```
触发：每天 08:07（北京）自动运行，或手动 workflow_dispatch（支持 hours/theme 参数调试）
步骤：
  1. 拉取 WakaTime 近 7 天 summaries（需要 WAKATIME_TOKEN）
  2. 按昨日编码时长判定主题 + 按日均时长生成分级点评文案（休养生息/渐入佳境/火力全开/代码永动机/赛博飞升）
  3. 生成 assets/json/config.js + weekly.js
  4. 提交（Update daily theme & weekly stats: <主题名>）
```

### Secrets 配置

在仓库 Settings → Secrets and variables → Actions 中配置：

| 名称             |        必需 | 用途                                                        |
| ---------------- | ----------: | ----------------------------------------------------------- |
| `WAKATIME_TOKEN` | 仅主题/周报 | 拉取 WakaTime summaries（`waka_` 开头或 Bearer token 均可） |

> `auto-bing.yml` 使用内置 `GITHUB_TOKEN`，无需额外配置。

---

## 自定义域名（预留扩展）

当前使用默认域名 `dujie-js.github.io`，未配置自定义域名。日后拥有自己的域名时，按以下清单切换（GitHub Pages 原生机制：**CNAME 文件存在即使用自定义域名，删除即自动回退默认域名**，无需修改任何路由代码）：

1. **添加 CNAME 文件**：仓库根目录创建 `CNAME`，内容为域名（如 `example.com`），提交推送后 Pages 自动生效。
2. **DNS 解析**：在域名服务商处添加 CNAME 记录指向 `dujie-js.github.io`（或按 GitHub 文档配置 A 记录）。
3. **更新站点域名**：修改两个 workflow 顶层的 `SITE_URL` 环境变量（`generate-posts.yml` 与 `generate-feed-monthly.yml`，如 `https://example.com`）；推送文章或手动触发工作流即生效。
4. **更新页面 OG 标签**：以下 4 处硬编码域名同步替换为新域名（社交爬虫要求绝对 URL，无法省略）：
   - `index.html`（`og:image` / `og:url`）
   - `about/index.html`（`og:image` / `og:url`）
   - `blog/index.html`（`og:image` / `og:url`）
   - `blog/post.html`（`og:image` / `og:url` / JSON-LD `image`）
5. **重新生成文章目录页**：`blog/<slug>/index.html` 是生成物（CI 写入 SITE_URL），推送任意文章或手动触发 `generate-posts.yml` 即自动更新为新域名。
6. **robots.txt 自动更新**：`robots.txt` 现由生成器输出（Sitemap 随 SITE_URL），推送文章或手动触发工作流即更新，无需手动改。
7. **自适应兜底**：`assets/js/og-adapt.js` 会在页面域名与硬编码不一致时自动修正分享元数据（canonical/og:url/og:image/JSON-LD），静态文件漏改也不会分享出错误链接（爬虫仍读静态值，建议按上述清单改全）。

> 站内链接全部使用相对路径或根路径绝对引用（`/blog/`、`/about/`），自定义域名下无需改动，直接生效。

---

## SEO

| 项目            | 状态                                                |
| --------------- | --------------------------------------------------- |
| Open Graph 标签 | ✅ 4 页面（首页/博客列表/文章/关于），文章页构建时写入真实数据 |
| JSON-LD Schema  | ✅ Article（文章页）                                |
| RSS Feed        | ✅ 随文章推送即时生成，全站底部可见                 |
| XML Sitemap     | ✅ 随文章推送即时生成                               |
| 语义化 HTML     | ✅ article / nav / header / footer                  |
| lang 属性       | ✅ zh-CN                                            |
| 响应式设计      | ✅ 适配桌面和移动端                                 |

---

## 外部依赖

### 静态资源版本戳

所有页面引用本地 CSS/JS 时统一携带 `?v=YYYYMMDD` 版本戳（如 `?v=20260830`）。**修改任何 CSS/JS 后需同步更新版本戳**，否则浏览器可能命中 GitHub Pages 缓存导致旧样式/脚本残留（不同浏览器刷新时间不同会看到不一致效果）。

纯静态托管,但以下资源来自第三方服务:

| 服务                                    | 用途     | 备注                     |
| --------------------------------------- | -------- | ------------------------ |
| [不蒜子](https://busuanzi.ibruce.info/) | 访问统计 | 国内 CDN                 |
| [一言 Hitokoto](https://hitokoto.cn/)   | 首页鸡汤 | 不可用时保留静态默认文案 |
| [utterances](https://utteranc.es/)      | 文章评论 | GitHub Issue 驱动        |

> Markdown 渲染已本地化（`assets/js/marked.min.js`，v12.0.2），无外部依赖。

## 许可

MIT License
