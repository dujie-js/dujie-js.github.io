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
| Markdown 渲染 | [marked.js](https://marked.js.org/) v12（本地托管，浏览器端运行时渲染）     |
| 统计          | 不蒜子                                                                      |
| 评论          | [utterances](https://utteranc.es/)（GitHub Issue 驱动，`github-dark` 主题） |
| CI/CD         | GitHub Actions（2 个工作流：Bing 壁纸 / 博客元数据）                       |

---

## 页面结构

```
├── index.html              # 首页 — Bing 壁纸背景、一言鸡汤、个人简介
├── blog/
│   ├── index.html          # 博客列表页 — fetch posts.json 渲染卡片
│   ├── post.html           # 文章页 — 读取 ?slug= 后 fetch 对应 md 渲染正文
│   └── md/                 # 博客文章（Markdown + Frontmatter，当前 5 篇）
│       └── <slug>.md       # 一篇文章就是这一个文件，没有生成的 HTML 副本
├── about/
│   ├── index.html          # 关于页（正文由 content.md 运行时渲染）
│   └── content.md          # 关于正文（Markdown）
├── resume/
│   └── resume.pdf          # 个人简历
├── assets/
│   ├── css/                # 4 个 CSS 文件
│   │   ├── vno.css             # 主页主题（vno，含公众号弹窗样式）
│   │   ├── blog.css            # 博客系统专用样式
│   │   ├── iconfont.css        # 图标字体
│   │   └── onlinewebfonts.css  # Web 字体
│   ├── js/
│   │   ├── main.js         # 首页脚本（Bing 壁纸轮播、一言、微信弹窗、移动端菜单含动画防连点）
│   │   ├── blog.js         # 博客前端渲染器（IIFE 隔离，DOMContentLoaded 自初始化）
│   │   ├── og-adapt.js     # OG 元数据域名运行时自适应（自定义域名分享用）
│   │   ├── bing.js         # Bing 壁纸抓取（Node.js/CI，输出 JSONP 格式）
│   │   ├── marked.min.js   # marked.js v12（本地，浏览器端渲染正文用）
│   │   └── generate-blog-meta.js  # 博客元数据生成（Node.js/CI，不产出 HTML）
│   ├── json/
│   │   ├── posts.json      # 文章元数据索引（CI 自动生成，不含正文）
│   │   └── images.json     # Bing 壁纸 URL（CI 每日更新，JSONP 回调格式）
│   ├── img/
│   │   ├── myLogo.jpg      # 头像（JPEG 回退）
│   │   ├── myLogo.webp     # 头像（WebP，通过 <picture> 优先加载）
│   │   ├── wechat.svg      # 公众号图标（社交栏导航使用）
│   │   └── wechat.png      # 公众号二维码（弹窗展示）
│   └── fonts/              # 标题装饰字体（Engravers 老式英文体，本地；图标字体已 base64 内联进 css/iconfont.css）
├── apple-touch-icon.png    # iOS 书签图标
├── favicon.ico             # 站点图标
├── feed.xml                # RSS 2.0 Feed（随推送即时生成，月度任务兜底）
├── robots.txt              # robots（含 Sitemap 指向，随推送即时生成）
├── sitemap.xml             # XML Sitemap（随推送即时生成，月度任务兜底）
└── 404.html                # 自定义 404 页面（SVG 猴子）
```

---

## 博客系统

### 设计原则：一篇文章一个文件

`blog/md/<slug>.md` 是文章的唯一文件——没有构建出的 HTML 副本，没有 md/html 两份要同步。正文由浏览器端 `blog.js` 取回后用本地 marked 渲染，因此**文章页没有构建步骤**：新增文章只需新建一个 `.md`，不用跑生成器，也不会产生任何需要提交的产物。

`blog.js` 分 6 个模块，全部包裹在外层 IIFE 中防止全局污染，加载后自行按容器是否存在初始化（三个页面共用同一份脚本，无需各自的 init 代码）：

| 模块             | 功能                                                             |
| ---------------- | ---------------------------------------------------------------- |
| `renderMarkdown` | 全站唯一渲染点（禁原始 HTML、协议白名单、图片 lazy）             |
| `BlogList`       | 列表页：fetch `posts.json` 元数据渲染卡片                        |
| `BlogPost`       | 文章页：读 `?slug=` → fetch `/blog/md/<slug>.md` 渲染正文        |
| `BlogAbout`      | 关于页：fetch `/about/content.md` 渲染正文                       |
| `BlogNav`        | 移动端菜单（图标切换 + 点击链接关闭）                            |
| `BlogBackToTop`  | 回到顶部按钮（滚动 >300px 显示）                                 |

文章 URL 形如 `/blog/post.html?slug=<slug>`。列表页与文章页的元数据（标题/日期/tags）统一来自 `posts.json`，浏览器端只负责剥掉 frontmatter，不重复实现解析器；`slug` 参数经正则白名单校验，阻断 `../` 路径穿越。

> ⚠️ 页面内容由 JS 渲染，搜索引擎抓到的 HTML 是空壳。RSS 与 sitemap 仍会正确列出全部文章 URL。

### OG 标签

所有页面预置 `og:title` / `og:description` / `og:image` / `og:locale`。文章页的 slug 由 URL 决定、且不产出任何 HTML，因此不再输出 Article JSON-LD。

### 图片

- 文章正文中的 `<img>` 由渲染器直接输出 `loading="lazy"`。
- 首页头像使用 `<picture>` 标签优先加载 WebP 格式，降级 JPEG。
- 首页 Bing 壁纸 URL 经过正则白名单校验（`/th?id=OHR.*`），防止 CSS 注入。

### 公众号弹窗

- 导航「公众号」点击弹出微信二维码（`assets/img/wechat.png`）。

### 评论

基于 [utterances](https://utteranc.es/)，通过完整 URL（含 slug）关联 GitHub Issue，每篇文章独立评论区，使用 `github-dark` 主题，读者用 GitHub 账号即可评论。

### 首页脚本

`main.js` 负责 Bing 壁纸轮播（8 张循环，URL 白名单校验防注入）、一言鸡汤加载（文本节点渲染防 XSS）、微信二维码弹窗、头像渐入动画、移动端菜单（附带防连点机制和动画状态管理）。Bing 壁纸 URL 通过 `images.json` 以 JSONP 回调加载（文件内容为 `getBingImages([...])`，回调函数名由 bing.js 输出约定）。

### 新增一篇文章

1. 在 `blog/md/` 下新建 `<slug>.md`，文件名（去掉 `.md`）即 slug，也是 URL 里的 `?slug=`。**文件名只能用字母、数字、下划线、连字符、点**，且不能含 `..` —— 生成器与 `blog.js` 共用同一套白名单，不合规的文件名会让生成器直接失败（早失败好过产出点进去报错的死链）。
2. 写 frontmatter：`title` / `date`（YYYY-MM-DD）/ `summary` / `tags: [a, b]`，可选 `lastmod`。标题只写在这里，正文里不要再写 `# 标题`。
3. 提交推送。CI 自动更新 `posts.json` / `feed.xml` / `sitemap.xml`，文章即出现在列表页与 RSS 中。

没有第 4 步——不需要跑生成器，不需要提交任何 HTML 产物。

### 关于页面

`about/index.html` 的 `#about-content` 由 `blog.js` 运行时读取 `about/content.md` 渲染（与文章页共用同一个渲染器），`content.md` 保持唯一源，不再有构建时写进 HTML 的第二份。

### RSS

博客列表页、文章页、关于页底部均提供 RSS Feed 链接，指向 `/feed.xml`。

---

## CI/CD 工作流

### 推送触发 + 月度兜底 — `generate-blog-meta.yml`

```
触发：blog/md/**、generate-blog-meta.js、或 workflow 文件自身变更（支持 workflow_dispatch）
     另有每月 1 号 02:57 UTC 的定时兜底
步骤：
  1. actions/checkout@v4
  2. actions/setup-node@v4 (Node 20)
  3. node assets/js/generate-blog-meta.js → 生成 posts.json + feed.xml + sitemap.xml + robots.txt
  4. 提交这 4 个文件（[skip ci]，无变更时跳过）
```

这个工作流**只产出元数据，不产出任何 HTML 页面**——文章页与关于页由浏览器端渲染，没有构建产物需要提交。所有工作流均配置 `concurrency` 组防并行冲突、`timeout-minutes` 防卡死。

> `robots.txt` 由本工作流接管：手工编辑后，下一次推送文章会被生成值覆盖回去（要改规则请改生成器里的 `writeRobots()`）。
>
> 两个工作流都会向 `main` 推送，定时点虽然错开但文章推送可以发生在任意时刻，因此推送步骤带 `pull --rebase` 重试。

### 每日定时 — `auto-bing.yml`

```
触发：每天 01:00 UTC（北京 09:00），或手动 workflow_dispatch
步骤：
  1. actions/checkout@v4
  2. actions/setup-node@v4 (Node 20)
  3. node assets/js/bing.js → 生成 images.json（8 张最新 Bing 壁纸）
  4. 提交 images.json（[bot] update images.json）
```

两个工作流都使用内置 `GITHUB_TOKEN`，无需配置任何 Secrets。

---

## 自定义域名（预留扩展）

当前使用默认域名 `dujie-js.github.io`，未配置自定义域名。日后拥有自己的域名时，按以下清单切换（GitHub Pages 原生机制：**CNAME 文件存在即使用自定义域名，删除即自动回退默认域名**，无需修改任何路由代码）：

1. **添加 CNAME 文件**：仓库根目录创建 `CNAME`，内容为域名（如 `example.com`），提交推送后 Pages 自动生效。
2. **DNS 解析**：在域名服务商处添加 CNAME 记录指向 `dujie-js.github.io`（或按 GitHub 文档配置 A 记录）。
3. **更新站点域名**：修改 `generate-blog-meta.yml` 顶层的 `SITE_URL` 环境变量（如 `https://example.com`）；推送文章或手动触发工作流，feed/sitemap/robots 即全部生效。
4. **更新页面 OG 标签**：以下 4 处硬编码域名同步替换为新域名（社交爬虫要求绝对 URL，无法省略）：
   - `index.html`（`og:image` / `og:url`）
   - `about/index.html`（`og:image` / `og:url`）
   - `blog/index.html`（`og:image` / `og:url`）
   - `blog/post.html`（`og:image`）
5. **robots.txt 自动更新**：`robots.txt` 由生成器输出（Sitemap 随 SITE_URL），推送文章或手动触发工作流即更新，无需手动改。
6. **自适应兜底**：`assets/js/og-adapt.js` 会在页面域名与硬编码不一致时自动修正分享元数据（canonical/og:url/og:image），静态文件漏改也不会分享出错误链接（爬虫仍读静态值，建议按上述清单改全）。

> 站内链接全部使用相对路径或根路径绝对引用（`/blog/`、`/about/`），自定义域名下无需改动，直接生效。

---

## SEO

| 项目            | 状态                                                          |
| --------------- | ------------------------------------------------------------- |
| Open Graph 标签 | ✅ 4 页面（首页/博客列表/文章/关于），站点级静态值             |
| RSS Feed        | ✅ 随文章推送即时生成，全站底部可见                           |
| XML Sitemap     | ✅ 随文章推送即时生成                                         |
| 语义化 HTML     | ✅ article / nav / header / footer                            |
| lang 属性       | ✅ zh-CN                                                      |
| 响应式设计      | ✅ 适配桌面和移动端                                           |
| 页面内容可索引  | ❌ 列表页与文章页由 JS 渲染，爬虫拿到空壳（方案选定的代价）   |

---

## 外部依赖

纯静态托管,但以下资源来自第三方服务:

| 服务                                    | 用途     | 备注                     |
| --------------------------------------- | -------- | ------------------------ |
| [不蒜子](https://busuanzi.ibruce.info/) | 访问统计 | 国内 CDN                 |
| [一言 Hitokoto](https://hitokoto.cn/)   | 首页鸡汤 | 不可用时保留静态默认文案 |
| [utterances](https://utteranc.es/)      | 文章评论 | GitHub Issue 驱动        |

> Markdown 渲染已本地化（`assets/js/marked.min.js`，v12.0.2），无外部依赖。

## 许可

MIT License
