/**
 * generate-blog-meta.js
 *
 * 博客唯一的构建脚本:扫描 blog/md/*.md,产出四份元数据文件:
 *   - assets/json/posts.json  列表页数据源(仅元数据,不含正文)
 *   - feed.xml                RSS 2.0
 *   - sitemap.xml             搜索引擎 Sitemap
 *   - robots.txt
 *
 * 正文不在这里渲染:文章页与关于页由 assets/js/blog.js 在浏览器端 fetch
 * markdown 后用本地 marked 渲染。因此本脚本不产出任何 HTML 页面,
 * 也不需要 marked —— 一篇 md 就是一个文件,没有构建出的孪生副本。
 *
 * Usage: node assets/js/generate-blog-meta.js
 * 由 .github/workflows/generate-blog-meta.yml 在 blog/md/ 变更时执行。
 */

const fs = require("fs");
const path = require("path");

// 博客目录内区分内容与页面:blog/md/ 放文章 .md,blog/ 根放 index.html / post.html
const POSTS_DIR = path.resolve(__dirname, "../../blog/md");
const POSTS_JSON = path.resolve(__dirname, "../json/posts.json");
const SITE_ROOT = path.resolve(__dirname, "../../");
// 去除尾部斜杠,避免拼接出 //blog 双斜杠
const SITE_URL = (process.env.SITE_URL || "https://dujie-js.github.io").replace(
  /\/+$/,
  "",
);
const SITE_TITLE = "渡劫 - DuJie Blog";
const SITE_DESC = "活出自己的人生";

/**
 * 文章页是 query 参数形式的单页(见 blog/post.html),
 * URL 构造集中在这里一处,避免 posts.json 之外的 feed/sitemap 各拼一次。
 */
function postUrl(slug) {
  return SITE_URL + "/blog/post.html?slug=" + encodeURIComponent(slug);
}

/**
 * slug 即文件名(去掉 .md),也是 URL 里的 ?slug= 参数。
 * 必须与 blog.js 的 SLUG_RE 保持一致:否则文件名含空格/中文/引号时会被正常索引进
 * posts.json、列表页也照常生成链接,但点进去必然报"缺少或非法的文章参数"——死链,
 * 而且只有线上才发现。两道白名单要么同时放行,要么在这里就把错误挡在 CI。
 */
const SLUG_RE = /^[a-zA-Z0-9_.-]+$/;

function isSafeSlug(slug) {
  // "/" 已被字符集挡掉,再显式拒绝 ".." 即无法穿越到 blog/md/ 之外
  return SLUG_RE.test(slug) && slug.indexOf("..") === -1;
}

/* ============================================
 frontmatter 解析
 ============================================ */
function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Parse YAML-like frontmatter from markdown content.
 *
 * Expected format:
 * ---
 * title: My Post Title
 * date: 2026-07-10
 * summary: A brief description
 * tags: [tag1, tag2]
 * ---
 */
function parseFrontmatter(content) {
  const meta = {};
  // 去掉 UTF-8 BOM,兼容 CRLF 与结尾无换行的文件
  const text = content.replace(/^﻿/, "");
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!match) return meta;

  const lines = match[1].split(/\r?\n/);
  lines.forEach(function (line) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      // Handle inline arrays: [tag1, tag2]
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map(function (s) {
            return s.trim().replace(/^['"]|['"]$/g, "");
          });
      } else {
        // Strip surrounding quotes
        value = value.replace(/^['"]|['"]$/g, "");
      }
      meta[key] = value;
    }
  });
  return meta;
}

function toTags(meta) {
  return Array.isArray(meta.tags) ? meta.tags : [];
}

/**
 * 日期统一规范为 YYYY-MM-DD:posts.json / feed / sitemap 共用同一份规范化值。
 * 仅接受合法 ISO 日期(拒绝 2026-13-45 / 2026-04-31 等),缺失/非法一律返回 ''。
 */
function normalizeDate(value) {
  if (typeof value !== "string") return "";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  // 用 UTC 解析做真实日历校验,避免本地时区与大小月造成的误判
  const t = new Date(Date.UTC(year, month - 1, day));
  if (
    t.getUTCFullYear() !== year ||
    t.getUTCMonth() !== month - 1 ||
    t.getUTCDate() !== day
  ) {
    return "";
  }
  return m[0]; // 只取 YYYY-MM-DD,丢弃多余时间部分
}

/* ============================================
 失败即失败:必需目录缺失一律退出,让 CI 红灯可查,
 杜绝"静默跳过 → 线上仍是旧列表 / 旧 feed"。
 ============================================ */
function fail(label) {
  console.error("[generate-blog-meta] " + label);
  process.exit(1);
}

/* ============================================
 扫描 blog/md/*.md
 ============================================ */
function readPosts() {
  if (!fs.existsSync(POSTS_DIR)) {
    fail("blog/md/ 目录缺失:" + POSTS_DIR + "(仓库结构异常,停止生成)");
  }

  const files = fs.readdirSync(POSTS_DIR).filter(function (f) {
    return f.endsWith(".md");
  });

  if (files.length === 0) {
    fail("blog/md/ 下没有任何 .md 文件(拒绝用空索引覆盖线上数据)");
  }

  // 先整体校验文件名,一次列全部不合规的,避免改一个报一个
  const badNames = files.filter(function (file) {
    return !isSafeSlug(file.replace(/\.md$/, ""));
  });
  if (badNames.length) {
    fail(
      "以下文件名不符合 slug 规范(只允许字母、数字、下划线、连字符、点,且不含 ..):\n  " +
        badNames.join("\n  ") +
        "\nblog.js 会拒绝这类 slug,提交后会产出点进去报错的死链。请重命名后重试。",
    );
  }

  const posts = files.map(function (file) {
    const meta = parseFrontmatter(
      fs.readFileSync(path.join(POSTS_DIR, file), "utf-8"),
    );
    const slug = file.replace(/\.md$/, "");
    return {
      slug: slug,
      title: meta.title || slug.replace(/-/g, " "),
      date: normalizeDate(meta.date),
      lastmod: normalizeDate(meta.lastmod),
      summary: meta.summary || "",
      tags: toTags(meta),
    };
  });

  // Sort by date descending (newest first); 无日期统一排最后
  posts.sort(function (a, b) {
    if (a.date && b.date) return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  return posts;
}

/* ============================================
 四个 writer
 ============================================ */
function writePostsJson(posts) {
  const dir = path.dirname(POSTS_JSON);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2) + "\n");
  console.log("Generated " + POSTS_JSON + " with " + posts.length + " post(s).");
}

function writeFeed(posts) {
  const items = posts.map(function (post) {
    // pubDate 是"发布时间",一律取 date:列表是按 date 排序的,这里若改用 lastmod,
    // 有更新时间的文章就会带着更新的日期留在旧位置上,feed 顺序与日期自相矛盾。
    // lastmod 只服务于 sitemap(见 writeSitemap)。
    const dateObj = post.date ? new Date(post.date) : null;
    const pubDate =
      dateObj && !isNaN(dateObj.getTime()) ? dateObj.toUTCString() : "";
    const categories = post.tags
      .map(function (tag) {
        return "      <category>" + escapeXml(tag) + "</category>";
      })
      .join("\n");

    return [
      "    <item>",
      "      <title>" + escapeXml(post.title) + "</title>",
      "      <link>" + postUrl(post.slug) + "</link>",
      "      <guid>" + postUrl(post.slug) + "</guid>",
      "      <description>" + escapeXml(post.summary) + "</description>",
      pubDate ? "      <pubDate>" + pubDate + "</pubDate>" : "",
      categories,
      "    </item>",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const feed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>" + escapeXml(SITE_TITLE) + "</title>",
    "    <link>" + SITE_URL + "</link>",
    "    <description>" + escapeXml(SITE_DESC) + "</description>",
    "    <language>zh-CN</language>",
    '    <atom:link href="' +
      SITE_URL +
      '/feed.xml" rel="self" type="application/rss+xml"/>',
    items.join("\n"),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  const feedPath = path.join(SITE_ROOT, "feed.xml");
  fs.writeFileSync(feedPath, feed);
  console.log("Generated " + feedPath + " with " + posts.length + " item(s).");
}

function writeSitemap(posts) {
  const staticPages = ["/", "/blog/", "/about/", "/resume/resume.pdf"];

  const urls = staticPages.map(function (page) {
    return [
      "  <url>",
      "    <loc>" + SITE_URL + page + "</loc>",
      "    <priority>0.8</priority>",
      "  </url>",
    ].join("\n");
  });

  posts.forEach(function (post) {
    const lastmodSource = post.lastmod || post.date;
    let lastmod = "";
    if (lastmodSource) {
      const dateObj = new Date(lastmodSource);
      if (!isNaN(dateObj.getTime())) {
        lastmod = "    <lastmod>" + dateObj.toISOString() + "</lastmod>";
      }
    }
    urls.push(
      [
        "  <url>",
        "    <loc>" + escapeXml(postUrl(post.slug)) + "</loc>",
        lastmod,
        "    <priority>0.6</priority>",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  });

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls.join("\n"),
    "</urlset>",
    "",
  ].join("\n");

  const sitemapPath = path.join(SITE_ROOT, "sitemap.xml");
  fs.writeFileSync(sitemapPath, sitemap);
  console.log(
    "Generated " +
      sitemapPath +
      " with " +
      (staticPages.length + posts.length) +
      " URL(s).",
  );
}

function writeRobots() {
  const robots = [
    "User-agent: *",
    "Allow: /",
    "Sitemap: " + SITE_URL + "/sitemap.xml",
    "",
  ].join("\n");
  const robotsPath = path.join(SITE_ROOT, "robots.txt");
  fs.writeFileSync(robotsPath, robots);
  console.log("Generated " + robotsPath);
}

function generate() {
  const posts = readPosts();
  writePostsJson(posts);
  writeFeed(posts);
  writeSitemap(posts);
  writeRobots();
}

generate();
