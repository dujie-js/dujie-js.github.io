# DuJie Home — 渡劫的个人主页

个人博客网站，基于 GitHub Pages 构建，纯静态前端，零后端依赖。

> **活出自己的人生** — [dujie-js.github.io](https://dujie-js.github.io)

---

## 项目概览

| 项目 | 说明 |
|------|------|
| 域名 | `https://dujie-js.github.io` |
| 托管 | GitHub Pages（`gh-pages` 分支） |
| 技术栈 | 纯 HTML + CSS + JavaScript，无构建工具 |
| Markdown 渲染 | [marked.js](https://marked.js.org/) v12（CDN 加载） |
| 统计 | 不蒜子（`busuanzi.ibruce.info`） |
| 评论 | [utterances](https://utteranc.es/)（GitHub Issue 驱动） |
| CI/CD | GitHub Actions |

---

## 页面结构

```
├── index.html              # 首页 — Bing 壁纸背景、一言鸡汤、个人简介
├── blog/
│   ├── index.html          # 博客列表页 — 分页展示、实时搜索
│   └── post.html           # 博客文章页 — Markdown 渲染、TOC、评论
├── about/
│   ├── index.html          # 关于页
│   └── content.md          # 关于正文（Markdown）
├── posts/                  # 博客文章（Markdown + Frontmatter）
├── assets/
│   ├── css/
│   │   ├── vno.css         # 首页主题样式
│   │   ├── blog.css        # 博客系统样式
│   │   ├── iconfont.css    # 图标字体
│   │   └── onlinewebfonts.css  # 英文字体
│   ├── js/
│   │   ├── main.js         # 首页脚本（Bing壁纸、一言、移动端菜单）
│   │   ├── blog.js         # 博客系统（6大模块、IIFE 隔离）
│   │   ├── bing.js         # Bing 壁纸抓取（Node.js/CI）
│   │   ├── generate-posts-index.js   # 文章索引生成（Node.js/CI）
│   │   └── generate-rss-sitemap.js   # RSS + sitemap 生成（Node.js/CI）
│   ├── json/
│   │   ├── posts.json      # 文章索引（CI 自动生成）
│   │   └── images.json     # Bing 壁纸 URL（CI 每日更新）
│   └── img/
│       └── myLogo.jpg      # 头像
├── feed.xml                # RSS 2.0 Feed（月度 CI 生成）
├── sitemap.xml             # XML Sitemap（月度 CI 生成）
└── 404.html                # 自定义 404 页面
```

---

## 博客系统架构

### 前端模块（`blog.js`）

全部包裹在外层 IIFE 中防止全局污染，仅暴露 HTML 页面需要的 4 个接口：

| 模块 | 功能 | 暴露 |
|------|------|------|
| `BlogUtils` | Frontmatter 解析、日期格式化、HTML 转义 | 内部使用 |
| `BlogCards` | 文章卡片渲染、关键词高亮 | 内部使用 |
| `BlogIndex` | 博客列表加载、分页（PAGE_SIZE=5） | ✅ `window.BlogIndex` |
| `BlogPost` | 文章内容加载、Markdown 渲染、TOC 生成、OG/JSON-LD 更新 | ✅ `window.BlogPost` |
| `BlogNav` | 移动端菜单（图标切换 + 点链接关闭） | ✅ `window.BlogNav` |
| `BlogSearch` | 实时搜索（150ms 防抖 + 正则高亮缓存） | ✅ `window.BlogSearch` |

### 分页

- 每页 5 篇文章，支持上一页/下一页
- 搜索时展示所有匹配结果（不分页），清空搜索后恢复分页视图（回到第 1 页）

### 文章目录（TOC）

- 扫描文章内容中 H2/H3 标题，自动生成侧边目录
- 桌面端（≥1024px）粘性侧边栏，移动端隐藏
- 点击目录项平滑滚动到对应标题

### OG 标签 & 结构化数据

- 所有页面预置 `og:title` / `og:description` / `og:image` / `og:url` / `og:type`
- 文章页加载后 JS 动态更新 OG 标签为当前文章内容
- 文章页嵌入 Article JSON-LD Schema，加载后更新 headline/description/datePublished

### 评论

- 基于 [utterances](https://utteranc.es/)（GitHub Issue 驱动）
- 读者通过 GitHub 账号即可评论，无需后端
- 每篇文章通过 URL pathname 自动关联对应 Issue

---

## CI/CD 工作流

### 1. `generate-posts.yml` — 推送触发

```
触发：posts/** 或 generate-posts-index.js 变更
步骤：
  1. node assets/js/generate-posts-index.js  → 生成 posts.json
  2. 提交 posts.json（[skip ci] 避免循环触发）
```

### 2. `generate-feed-monthly.yml` — 月度定时

```
触发：每月 1 号 02:57 UTC 或手动 workflow_dispatch
步骤：
  1. node assets/js/generate-rss-sitemap.js  → 生成 feed.xml + sitemap.xml
  2. 提交文件（[skip ci] 避免循环触发）
```

### 3. CI 安全措施

- `concurrency` 组 + `cancel-in-progress` 避免并行冲突
- `timeout-minutes: 3` 防止脚本卡死
- `[skip ci]` 在 commit message 中阻止工作流自触发
- `workflow_dispatch` 支持手动触发
- RSS/sitemap 与 posts.json 分离，避免频繁推送触发 Pages 部署

---

## 已完成的优化项

经过多轮 open-code-review + 人工审查，已完成以下优化：

### Bug 修复
- 首页移动端菜单条件判断使用 `classList.contains` 替代 `style.display`
- 菜单动画 toggle → remove/add 防止状态泄漏
- `isAnimating` 标志位防止连点导致监听器重复绑定
- Bing 壁纸索引字符串/数字类型不匹配（`Number(index)`）
- JSON 解析 try/catch + 响应格式校验
- `process.exit` 后死代码清理

### 代码规范
- `==` → `===` 统一
- `var` → `let`/`const`（新代码、函数作用域内变量）
- `arguments.callee` → 命名函数
- XML 控制字符过滤
- URL encode/decode 正确分离
- `generate-rss-sitemap.js` 中 `var` → `const`

### 架构优化
- 全局变量 IIFE 隔离（9 个顶层 var → 4 个显式暴露）
- Open Graph 标签（4 页面 + 文章动态更新）
- JSON-LD Article Schema
- 文章目录 TOC（H2/H3 目录 + 平滑滚动）
- 博客分页（PAGE_SIZE=5）
- 图片懒加载（`loading="lazy"`）
- RSS 2.0 Feed 自动生成
- XML Sitemap 自动生成
- CI 并发控制 + 超时限制
- Bing 壁纸 URL encodeURI 防御
- utterances 评论系统

---

## SEO 配置

| 项目 | 状态 |
|------|------|
| Open Graph 标签 | ✅ 4 页面 + 文章动态更新 |
| JSON-LD Schema | ✅ Article（文章页） |
| RSS Feed | ✅ 月度 CI 生成 |
| XML Sitemap | ✅ 月度 CI 生成 |
| 语义化 HTML | ✅ article、nav、header、footer |
| lang 属性 | ✅ zh-CN（首页已补） |
| 响应式设计 | ✅ 适配桌面/移动端 |

---

## 许可

MIT License — 自由使用、修改、分发。
