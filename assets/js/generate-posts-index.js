/**
 * generate-posts-index.js
 *
 * Scans the ./posts/ directory for .md files,
 * parses YAML-like frontmatter from each file,
 * and generates ./assets/json/posts.json as the blog index.
 *
 * 同时静态化生成:
 * 1. blog/<slug>/index.html — 每篇文章的完整静态页面(正文用本地 marked 构建时渲染,
 *    SEO 可直接索引;浏览器端 blog.js 仅做 TOC/进度条/复制等增强)
 * 2. blog/index.html 的 #posts-list — 全量文章卡片(SEO 可索引全部标题)
 *
 * Usage: node assets/js/generate-posts-index.js
 * Intended to be run via GitHub Actions on every push.
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.resolve(__dirname, '../../posts');
const OUTPUT_FILE = path.resolve(__dirname, '../json/posts.json');
// 去除尾部斜杠,避免拼接出 //blog 双斜杠
const SITE_URL = (process.env.SITE_URL || 'https://dujie-js.github.io').replace(
  /\/+$/,
  '',
);

// 本地化 marked(UMD 格式,Node 可直接 require),零外部依赖
const marked = require(path.resolve(__dirname, 'marked.min.js'));

/* ============================================
 安全渲染(与前端 blog.js renderPost 保持一致)
 ============================================ */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createSafeRenderer() {
  const renderer = new marked.Renderer();
  // 链接/图片仅允许 http(s)/mailto/#/相对路径,禁 javascript:/data:
  const safeProtocol = function (value) {
    if (!value) return true;
    const v = String(value).trim().toLowerCase();
    return (
      /^(https?:|mailto:|#|\/|\.\.?\/)/.test(v) && !/javascript:|data:/i.test(v)
    );
  };
  // 禁用原始 HTML
  renderer.html = function () {
    return '';
  };
  const origLink = renderer.link.bind(renderer);
  renderer.link = function (href, title, text) {
    return safeProtocol(href) ? origLink(href, title, text) : text;
  };
  renderer.image = function (href, title, text) {
    if (!safeProtocol(href)) return '';
    // 直接输出带 loading="lazy" 的 img(替换 blog.js 渲染后的 lazy 步骤)
    const src = escapeHtml(href);
    const alt = escapeHtml(text || '');
    const titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
    return '<img src="' + src + '" alt="' + alt + '"' + titleAttr + ' loading="lazy">';
  };
  return renderer;
}

const SAFE_RENDERER = createSafeRenderer();

function renderMarkdown(md) {
  // gfm/breaks 选项与前端 marked.setOptions 一致
  return marked.parse(md, {
    gfm: true,
    breaks: true,
    renderer: SAFE_RENDERER,
  });
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
 *
 * # Content starts here...
 */
function parseFrontmatter(content) {
  const meta = {};
  // 去掉 UTF-8 BOM,兼容 CRLF 与结尾无换行的文件
  const text = content.replace(/^﻿/, '');
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  let body = text;
  if (match) {
    body = match[2];
    const lines = match[1].split(/\r?\n/);
    lines.forEach(function (line) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();
        // Handle inline arrays: [tag1, tag2]
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value
            .slice(1, -1)
            .split(',')
            .map(function (s) {
              return s.trim().replace(/^['"]|['"]$/g, '');
            });
        } else {
          // Strip surrounding quotes
          value = value.replace(/^['"]|['"]$/g, '');
        }
        meta[key] = value;
      }
    });
  }
  return { meta: meta, content: body };
}

function toTags(meta) {
  return Array.isArray(meta.tags) ? meta.tags : [];
}

// Main logic
function generate() {
  // Ensure posts directory exists
  if (!fs.existsSync(POSTS_DIR)) {
    console.log('No posts/ directory found. Creating empty posts.json.');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2));
    return;
  }

  // Read all .md files
  const files = fs.readdirSync(POSTS_DIR).filter(function (f) {
    return f.endsWith('.md');
  });

  if (files.length === 0) {
    console.log('No .md files found in posts/. Creating empty posts.json.');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2));
    return;
  }

  // Parse each file
  const posts = files.map(function (file) {
    const filePath = path.join(POSTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const meta = parseFrontmatter(content).meta;
    return {
      slug: file.replace(/\.md$/, ''),
      title: meta.title || file.replace(/\.md$/, '').replace(/-/g, ' '),
      date: meta.date || '',
      lastmod: meta.lastmod || '',
      summary: meta.summary || '',
      tags: toTags(meta),
    };
  });

  // Sort by date descending (newest first); 无日期统一排最后
  posts.sort(function (a, b) {
    const da = /^\d{4}-\d{2}-\d{2}/.test(a.date) ? a.date.slice(0, 10) : '';
    const db = /^\d{4}-\d{2}-\d{2}/.test(b.date) ? b.date.slice(0, 10) : '';
    if (da && db) return da < db ? 1 : da > db ? -1 : 0;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(posts, null, 2));
  console.log(
    'Generated ' + OUTPUT_FILE + ' with ' + posts.length + ' post(s).',
  );

  // 为每篇文章生成目录式页面 blog/<slug>/index.html(GitHub Pages 静态托管)
  generatePostPages(posts);
  // 列表页 #posts-list 静态化(全量卡片,SEO 可索引)
  generateIndexPage(posts);
  // 关于页 SSG 化(与文章页同源渲染)
  generateAboutPage();
}

/**
 * 关于页 SSG 化:about/content.md 构建时渲染进 #about-content,
 * 消除浏览器端 marked 渲染(爬虫可见,与文章页方案一致)。
 */
function generateAboutPage() {
  const aboutPath = path.resolve(__dirname, '../../about/index.html');
  const contentPath = path.resolve(__dirname, '../../about/content.md');
  if (!fs.existsSync(aboutPath) || !fs.existsSync(contentPath)) {
    console.log('about/content.md not found. Skipping about page generation.');
    return;
  }
  let page = fs.readFileSync(aboutPath, 'utf-8');
  const bodyHtml = renderMarkdown(fs.readFileSync(contentPath, 'utf-8'));

  // 结构未匹配(模板被改动)才警告;内容无变化属正常幂等
  if (
    !/<div class="blog-article__body" id="about-content">[\s\S]*?<\/div>/.test(
      page,
    )
  ) {
    console.warn('about/index.html: #about-content 结构未匹配,未静态化');
    return;
  }
  const replaced = page.replace(
    /(<div class="blog-article__body" id="about-content">)[\s\S]*?(<\/div>)/,
    '$1\n' + bodyHtml + '\n    $2',
  );
  if (replaced === page) {
    console.log('about/index.html already up to date.');
    return;
  }
  fs.writeFileSync(aboutPath, replaced);
  console.log('Generated about/index.html (static)');
}

/**
 * 从 blog/post.html 模板生成每篇文章的目录页。
 * 构建时渲染:正文由本地 marked 生成完整静态 HTML,og/JSON-LD/title 填入真实值;
 * 浏览器端 blog.js 仅做 TOC/进度条/复制按钮等增强。
 */
function generatePostPages(posts) {
  const templatePath = path.resolve(__dirname, '../../blog/post.html');
  if (!fs.existsSync(templatePath)) {
    console.log(
      'blog/post.html template not found. Skipping post page generation.',
    );
    return;
  }
  const template = fs.readFileSync(templatePath, 'utf-8');

  posts.forEach(function (post) {
    if (!post.slug) return;
    const slug = post.slug;
    const postUrl = SITE_URL + '/blog/' + slug + '/';
    const postData = readPostMeta(slug);
    if (!postData) return;
    const meta = postData.meta;
    const title = meta.title || slug;
    const summary = meta.summary || '';
    const tags = toTags(meta);

    // 正文构建时渲染(安全 renderer:禁原始 HTML、协议白名单、img lazy)
    const bodyHtml = renderMarkdown(postData.content);

    // 文章头部结构(与前端 blog.js renderPost 输出一致,类名对齐 blog.css)
    let header =
      '<a href="/blog/" class="blog-article__back">&larr; 返回博客列表</a>' +
      '<header class="blog-article__header">' +
      '  <h1 class="blog-article__title">' + escapeHtml(title) + '</h1>' +
      '  <div class="blog-article__meta">';
    if (meta.date) {
      const date = String(meta.date).slice(0, 10);
      header +=
        '    <time class="blog-article__date">' + date + '</time>';
      if (
        meta.lastmod &&
        String(meta.lastmod).slice(0, 10) !== date
      ) {
        header +=
          '    <span class="blog-article__updated">更新于 ' +
          String(meta.lastmod).slice(0, 10) +
          '</span>';
      }
    }
    if (tags.length) {
      header += '    <div class="blog-article__tags">';
      tags.forEach(function (tag) {
        header +=
          '      <span class="blog-tag">' + escapeHtml(tag) + '</span>';
      });
      header += '    </div>';
    }
    header += '  </div>' + '</header>';
    const articleHtml =
      header + '<div class="blog-article__body">' + bodyHtml + '</div>';

    // JSON-LD 结构化数据(真实文章数据)
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: summary,
      author: { '@type': 'Person', name: 'DuJie' },
      image: SITE_URL + '/assets/img/myLogo.jpg',
    };
    if (meta.date) ld.datePublished = String(meta.date).slice(0, 10);
    if (meta.lastmod) ld.dateModified = String(meta.lastmod).slice(0, 10);
    const ldJson = JSON.stringify(ld, null, 2)
      .replace(/</g, '\\u003c') // 防 </script> 逃逸
      .split('\n')
      .map(function (line) {
        return '      ' + line;
      })
      .join('\n');

    // 全量替换模板中的硬编码域名(当前为 https://dujie-js.github.io):
    // canonical/og:url/og:image/JSON-LD image 全部随 SITE_URL 走,换域名零漏网
    let page = template
      .split('https://dujie-js.github.io')
      .join(SITE_URL)
      .replace(
        /<link rel="canonical" href="[^"]*">/,
        '<link rel="canonical" href="' + postUrl + '">',
      )
      .replace(
        /<meta property="og:url" content="[^"]*">/,
        '<meta property="og:url" content="' + postUrl + '">',
      )
      // 真实标题/摘要:title、og:title、og:description
      .replace(
        /<title>[\s\S]*?<\/title>/,
        '<title>' + escapeHtml(title) + ' - DuJie Blog</title>',
      )
      .replace(
        /(<meta property="og:title" content=")[^"]*(" \/>)/,
        '$1' + escapeHtml(title + ' - DuJie Blog') + '$2',
      )
      .replace(
        /(<meta property="og:description" content=")[^"]*(" \/>)/,
        '$1' + escapeHtml(summary) + '$2',
      )
      // JSON-LD 真实数据
      .replace(
        /(<script type="application\/ld\+json" id="json-ld-post">)[\s\S]*?(<\/script>)/,
        '$1\n' + ldJson + '\n    $2',
      )
      // 正文静态化(替换模板骨架)
      .replace(
        /(<article id="post-content" class="blog-article">)[\s\S]*?(<\/article>)/,
        '$1' + articleHtml + '$2',
      );

    const dir = path.resolve(__dirname, '../../blog', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), page);
    console.log('Generated blog/' + slug + '/index.html (static)');
  });
}

function readPostMeta(slug) {
  const filePath = path.join(POSTS_DIR, slug + '.md');
  if (!fs.existsSync(filePath)) return null;
  return parseFrontmatter(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * 列表页 blog/index.html 的 #posts-list 静态化:生成全量文章卡片,
 * 结构对齐前端 blog.js renderPostCards(搜索过滤时 JS 复用同一结构)。
 */
function generateIndexPage(posts) {
  const indexPath = path.resolve(__dirname, '../../blog/index.html');
  if (!fs.existsSync(indexPath)) {
    console.log('blog/index.html not found. Skipping index page generation.');
    return;
  }
  let page = fs.readFileSync(indexPath, 'utf-8');

  const cards = posts
    .map(function (post, index) {
      let html =
        '<article class="blog-post-card blog-fade-in" style="animation-delay:' +
        index * 0.08 +
        's">';
      html +=
        '  <h2 class="blog-post-card__title">' +
        '    <a href="/blog/' +
        post.slug +
        '/">' +
        escapeHtml(post.title || 'Untitled') +
        '</a>' +
        '  </h2>';
      if (post.date) {
        html +=
          '  <time class="blog-post-card__date">' +
          String(post.date).slice(0, 10) +
          '</time>';
      }
      if (post.summary) {
        html +=
          '  <p class="blog-post-card__summary">' +
          escapeHtml(post.summary) +
          '</p>';
      }
      if (post.tags && post.tags.length) {
        html += '  <div class="blog-post-card__tags">';
        post.tags.forEach(function (tag) {
          html +=
            '    <span class="blog-tag">' + escapeHtml(tag) + '</span>';
        });
        html += '  </div>';
      }
      html += '</article>';
      return html;
    })
    .join('\n');

  // 结构未匹配(模板被改动)才警告;内容无变化(上次已生成相同卡片)属正常幂等
  if (!/<div id="posts-list" class="blog-posts">[\s\S]*?<\/div>\s*<\/main>/.test(page)) {
    console.warn('blog/index.html: #posts-list 结构未匹配,列表页未静态化');
    return;
  }
  const replaced = page.replace(
    /(<div id="posts-list" class="blog-posts">)[\s\S]*?(<\/div>\s*<\/main>)/,
    '$1\n' + cards + '\n      $2',
  );
  if (replaced === page) {
    console.log('blog/index.html already up to date.');
    return;
  }
  fs.writeFileSync(indexPath, replaced);
  console.log('Generated blog/index.html with ' + posts.length + ' card(s).');
}

generate();
