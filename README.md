# DuJie Home — 渡劫的个人主页

个人博客网站，基于 GitHub Pages 构建，纯静态前端，零后端依赖。

> **活出自己的人生** — [dujie-js.github.io](https://dujie-js.github.io)

---

## 项目概览

| 项目 | 说明 |
|------|------|
| 域名 | `https://dujie-js.github.io` |
| 托管 | GitHub Pages |
| 技术栈 | 纯 HTML + CSS + JavaScript，无构建工具 |
| Markdown 渲染 | [marked.js](https://marked.js.org/) v12（CDN 加载） |
| 统计 | 不蒜子 |
| 评论 | [utterances](https://utteranc.es/)（GitHub Issue 驱动，`github-dark` 主题） |
| CI/CD | GitHub Actions |

---

## 页面结构

```
├── index.html              # 首页 — Bing 壁纸背景、一言鸡汤、个人简介
├── blog/
│   ├── index.html          # 博客列表页 — 分页展示、实时搜索（含清除按钮）
│   └── post.html           # 博客文章页 — Markdown 渲染、TOC、评论
├── about/
│   ├── index.html          # 关于页（marked.js 渲染 content.md）
│   └── content.md          # 关于正文（Markdown）
├── resume/
│   └── resume.pdf          # 个人简历
├── posts/                  # 博客文章（Markdown + Frontmatter，当前 4 篇）
├── assets/
│   ├── css/                # 4 个 CSS 文件
│   │   ├── vno.css             # 主页主题（vno）
│   │   ├── blog.css            # 博客系统专用样式
│   │   ├── iconfont.css        # 图标字体
│   │   └── onlinewebfonts.css  # Web 字体
│   ├── js/
│   │   ├── main.js         # 首页脚本（Bing 壁纸轮播、一言、移动端菜单含动画防连点）
│   │   ├── blog.js         # 博客系统（6 大模块，IIFE 隔离）
│   │   ├── bing.js         # Bing 壁纸抓取（Node.js/CI，输出 JSONP 格式）
│   │   ├── generate-posts-index.js   # 文章索引生成（Node.js/CI）
│   │   └── generate-rss-sitemap.js   # RSS + sitemap 生成（Node.js/CI）
│   ├── json/
│   │   ├── posts.json      # 文章索引（CI 自动生成）
│   │   └── images.json     # Bing 壁纸 URL（CI 每日更新，JSONP 回调格式）
│   ├── img/
│   │   ├── myLogo.jpg      # 头像（JPEG 回退）
│   │   └── myLogo.webp     # 头像（WebP，通过 <picture> 优先加载）
│   └── fonts/              # Web 字体文件
├── apple-touch-icon.png    # iOS 书签图标
├── feed.xml                # RSS 2.0 Feed（月度 CI 生成）
├── sitemap.xml             # XML Sitemap（月度 CI 生成）
└── 404.html                # 自定义 404 页面（SVG 猴子）
```

---

## 博客系统

### 前端模块

`blog.js` 分 6 个模块，全部包裹在外层 IIFE 中防止全局污染，仅暴露 HTML 页面需要的 4 个接口：

| 模块 | 功能 | 暴露 |
|------|------|------|
| `BlogUtils` | Frontmatter 解析、日期格式化、HTML 转义 | 内部使用 |
| `BlogCards` | 文章卡片渲染、关键词高亮（正则缓存） | 内部使用 |
| `BlogIndex` | 博客列表加载、分页（`PAGE_SIZE=5`） | ✅ `window.BlogIndex` |
| `BlogPost` | 文章加载、Markdown 渲染、TOC 生成、OG/JSON-LD 动态更新 | ✅ `window.BlogPost` |
| `BlogNav` | 移动端菜单（图标切换 + 点击链接关闭） | ✅ `window.BlogNav` |
| `BlogSearch` | 实时搜索（150ms 防抖，含一键清除按钮） | ✅ `window.BlogSearch` |

### 分页

每页 5 篇文章，支持上一页/下一页导航。搜索时展示所有匹配结果（不分页），清空搜索后恢复分页视图。

### 文章目录（TOC）

文章加载后自动扫描 H2/H3 标题，生成粘性侧边目录。桌面端（≥1024px）右侧显示，点击平滑滚动。

### OG 标签 & 结构化数据

所有页面预置 `og:title` / `og:description` / `og:image` / `og:url` / `og:locale`。文章页加载后 JS 动态更新 OG 标签和 Article JSON-LD Schema（headline/description/datePublished）。

### 图片

- 文章正文中的 `<img>` 在渲染后自动添加 `loading="lazy"`。
- 首页头像使用 `<picture>` 标签优先加载 WebP 格式，降级 JPEG。
- 首页 Bing 壁纸 URL 使用 `encodeURI()` 拼接防注入。

### 评论

基于 [utterances](https://utteranc.es/)，通过 URL pathname 关联 GitHub Issue，使用 `github-dark` 主题，读者用 GitHub 账号即可评论。

### 首页脚本

`main.js` 负责 Bing 壁纸轮播（7 张循环）、一言鸡汤加载、头像渐入动画、移动端菜单（附带防连点机制和动画状态管理）。Bing 壁纸 URL 通过 `images.json?cb=getBingImages` 以 JSONP 回调方式加载。

### 关于页面

`about/index.html` 同样使用 marked.js（CDN 加载）渲染 `content.md`，样式复用 `blog.css`，与博客文章页风格一致。

### RSS

博客列表页、文章页、关于页底部均提供 RSS Feed 链接，指向 `/feed.xml`。

---

## CI/CD 工作流

### 推送触发 — `generate-posts.yml`

```
触发：posts/**、generate-posts-index.js、或 workflow 文件自身变更
     （支持手动 workflow_dispatch）
步骤：
  1. actions/checkout@v4
  2. actions/setup-node@v4 (Node 20)
  3. node assets/js/generate-posts-index.js → 生成 posts.json
  4. 提交 posts.json（[skip ci]）
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

RSS/sitemap 与 posts.json 分离，避免频繁推送触发 Pages 部署。两个工作流均配置 `concurrency` 组防并行冲突、`timeout-minutes: 3` 防卡死。

---

## SEO

| 项目 | 状态 |
|------|------|
| Open Graph 标签 | ✅ 5 页面（首页/博客列表/文章/关于/404） + 文章动态更新 |
| JSON-LD Schema | ✅ Article（文章页） |
| RSS Feed | ✅ 月度 CI 生成，全站底部可见 |
| XML Sitemap | ✅ 月度 CI 生成 |
| 语义化 HTML | ✅ article / nav / header / footer |
| lang 属性 | ✅ zh-CN |
| 响应式设计 | ✅ 适配桌面和移动端 |

---

## 许可

MIT License
