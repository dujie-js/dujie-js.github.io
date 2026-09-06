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
 * 3. about/index.html 的 #about-content — 关于页正文(同源安全渲染)
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
 安全渲染(禁原始 HTML/协议白名单/img lazy;
 前端已无 markdown 渲染,此处是全站唯一渲染点)
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
  // 开启 gfm/breaks(全站唯一 markdown 渲染点,无前端 marked 调用)
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

/* ============================================
 失败即失败:任一必需文件/模板缺失、模板占位替换未命中,
 一律 console.error + process.exit(1),让 CI 红灯可查,
 杜绝"静默跳过 → 线上仍是旧页面/模板占位"。
 ============================================ */
function fail(label) {
  console.error('[generate-posts-index] ' + label);
  process.exit(1);
}

function assertArticle(slug, cond, label) {
  if (!cond) {
    fail('blog/' + slug + '/index.html: ' + label);
  }
}

/**
 * 日期统一规范为 YYYY-MM-DD:posts.json 与各静态页共用同一份规范化值,
 * 消除"json 存原始串、页面各自截取"的不一致。
 * 仅接受合法 ISO 日期(拒绝 2026-13-45 / 2026-04-31 等),缺失/非法一律返回 ''。
 */
function normalizeDate(value) {
  if (typeof value !== 'string') return '';
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
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
    return '';
  }
  return m[0]; // 只取 YYYY-MM-DD,丢弃多余时间部分
}

// Main logic
function generate() {
  if (!fs.existsSync(POSTS_DIR)) {
    fail('posts/ 目录缺失:' + POSTS_DIR + '(仓库结构异常,停止生成)');
  }

  // Read all .md files
  const files = fs.readdirSync(POSTS_DIR).filter(function (f) {
    return f.endsWith('.md');
  });

  if (files.length === 0) {
    console.log('No .md files found in posts/. posts.json 已置空,页面重新生成。');
  }

  // 每篇只解析一次:frontmatter + 正文一起保留,文章页构建直接复用 content,
  // 不再二次读盘/二次解析(原 readPostMeta 已删除)。
  const posts = files.map(function (file) {
    const filePath = path.join(POSTS_DIR, file);
    const parsed = parseFrontmatter(fs.readFileSync(filePath, 'utf-8'));
    const meta = parsed.meta;
    return {
      slug: file.replace(/\.md$/, ''),
      title: meta.title || file.replace(/\.md$/, '').replace(/-/g, ' '),
      date: normalizeDate(meta.date),
      lastmod: normalizeDate(meta.lastmod),
      summary: meta.summary || '',
      tags: toTags(meta),
      content: parsed.content, // 仅供 generatePostPages 使用,发布的 JSON 不含此字段
    };
  });

  // Sort by date descending (newest first); 无日期统一排最后
  posts.sort(function (a, b) {
    const da = a.date;
    const db = b.date;
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

  // posts.json 只发布公开字段(剔除 content,避免把正文写进索引)
  const publicPosts = posts.map(function (post) {
    return {
      slug: post.slug,
      title: post.title,
      date: post.date,
      lastmod: post.lastmod,
      summary: post.summary,
      tags: post.tags,
    };
  });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(publicPosts, null, 2));
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
  if (!fs.existsSync(aboutPath)) {
    fail('about/index.html 缺失,无法生成关于页');
  }
  if (!fs.existsSync(contentPath)) {
    fail('about/content.md 缺失,无法生成关于页');
  }
  let page = fs.readFileSync(aboutPath, 'utf-8');
  const bodyHtml = renderMarkdown(fs.readFileSync(contentPath, 'utf-8'));

  // 结构未匹配即失败(模板被改动却静默产出旧正文,CI 应直接红灯)
  if (
    !/<div class="blog-article__body" id="about-content">[\s\S]*?<\/div>/.test(
      page,
    )
  ) {
    fail('about/index.html: #about-content 结构未匹配,请同步生成器与模板');
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
    fail('blog/post.html 模板缺失,无法生成文章页');
  }
  const template = fs.readFileSync(templatePath, 'utf-8');

  posts.forEach(function (post) {
    if (!post.slug) return;
    const slug = post.slug;
    const postUrl = SITE_URL + '/blog/' + slug + '/';
    // 直接复用 generate() 已解析并规范化(date→YYYY-MM-DD)的字段与正文
    const title = post.title || slug;
    const summary = post.summary || '';
    const tags = post.tags;
    const date = post.date;
    const lastmod = post.lastmod;

    // 正文构建时渲染(安全 renderer:禁原始 HTML、协议白名单、img lazy)
    const bodyHtml = renderMarkdown(post.content);

    // 文章头部结构(SSG 构建时生成,类名对齐 blog.css)
    // 逐行拼接 + 换行缩进,生成可读 HTML(与模板 <article> 的 8 空格缩进对齐)
    const IND = '        '; // 8 空格:blog/post.html 中 <article> 的缩进
    const lines = [
      IND + '<a href="/blog/" class="blog-article__back">&larr; 返回博客列表</a>',
      IND + '<header class="blog-article__header">',
      IND + '  <h1 class="blog-article__title">' + escapeHtml(title) + '</h1>',
      IND + '  <div class="blog-article__meta">',
    ];
    if (date) {
      lines.push(
        IND + '    <time class="blog-article__date">' + date + '</time>',
      );
      if (lastmod && lastmod !== date) {
        lines.push(
          IND +
            '    <span class="blog-article__updated">更新于 ' +
            lastmod +
            '</span>',
        );
      }
    }
    if (tags.length) {
      lines.push(IND + '    <div class="blog-article__tags">');
      tags.forEach(function (tag) {
        lines.push(
          IND + '      <span class="blog-tag">' + escapeHtml(tag) + '</span>',
        );
      });
      lines.push(IND + '    </div>');
    }
    lines.push(IND + '  </div>', IND + '</header>');
    const bodyLines = bodyHtml.replace(/\n+$/, ''); // 去掉正文结尾多余换行
    const articleHtml =
      lines.join('\n') +
      '\n' +
      IND +
      '<div class="blog-article__body">\n' +
      bodyLines +
      '\n' +
      IND +
      '</div>';

    // JSON-LD 结构化数据(真实文章数据)
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: summary,
      author: { '@type': 'Person', name: 'DuJie' },
      image: SITE_URL + '/assets/img/myLogo.jpg',
    };
    if (date) ld.datePublished = date;
    if (lastmod) ld.dateModified = lastmod;
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
      // 跨行 + 自闭合兼容:只替换引号内的 URL 值(模板格式变化也不会静默失败)
      .replace(
        /(<link\s+rel="canonical"[^>]*?href=")[^"]*(")/,
        '$1' + postUrl + '$2',
      )
      .replace(
        /(<meta\s+property="og:url"[^>]*?content=")[^"]*(")/,
        '$1' + postUrl + '$2',
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
      // 正文静态化(替换模板骨架);模板中 <article> 与 </article> 之间的
      // 原始缩进/换行在 [\s\S]*? 中被一并吞掉,故开头结尾的换行+缩进自行补齐
      .replace(
        /(<article id="post-content" class="blog-article">)[\s\S]*?(<\/article>)/,
        '$1\n' + articleHtml + '\n' + IND + '$2',
      )
      // 剥离模板占位页的 noindex meta(连同其上方一行说明注释):模板用于阻止
      // post.html 被收录,真实文章页必须保持可索引。下方断言保证剥离确实发生。
      .replace(
        /\n[ \t]*(?:<!--[^\n]*-->\n[ \t]*)?<meta name="robots"[^>]*\/>/,
        '',
      );

    // 生成后强校验:模板 5 处占位若未被命中(模板被改动),任一失败立即退出。
    // 断言命中即证明替换真的发生,杜绝"页面生成了但仍是模板占位"的静默失败。
    assertArticle(
      slug,
      page.indexOf(
        '<title>' + escapeHtml(title) + ' - DuJie Blog</title>',
      ) !== -1,
      '<title> 未替换为文章标题(模板 <title> 格式可能已变)',
    );
    assertArticle(
      slug,
      page.indexOf(
        'property="og:title" content="' +
          escapeHtml(title + ' - DuJie Blog') +
          '"',
      ) !== -1,
      'og:title 未替换(模板 og:title 格式可能已变)',
    );
    assertArticle(
      slug,
      page.indexOf(
        'property="og:description" content="' + escapeHtml(summary) + '"',
      ) !== -1,
      'og:description 未替换(模板 og:description 格式可能已变)',
    );
    const mHeadline = page.match(/"headline":\s*("(?:[^"\\]|\\.)*")/);
    assertArticle(
      slug,
      mHeadline && JSON.parse(mHeadline[1]) === title,
      'JSON-LD headline 未替换为真实标题(模板 json-ld 结构可能已变)',
    );
    assertArticle(
      slug,
      page.indexOf(
        '<h1 class="blog-article__title">' + escapeHtml(title) + '</h1>',
      ) !== -1,
      '<article> 正文未渲染(标题 h1 缺失,模板 article 骨架格式可能已变)',
    );
    assertArticle(
      slug,
      page.indexOf('name="robots"') === -1 &&
        page.indexOf('<!-- 占位页模板') === -1,
      '模板的 noindex meta/注释未剥离干净(真实文章页不应带占位页标记)',
    );
    assertArticle(
      slug,
      new RegExp('rel="canonical"[^>]*href="' + postUrl + '"').test(page) &&
        new RegExp('property="og:url"[^>]*content="' + postUrl + '"').test(
          page,
        ),
      'canonical/og:url 未指向文章目录 URL(模板 head 格式可能已变)',
    );

    const dir = path.resolve(__dirname, '../../blog', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), page);
    console.log('Generated blog/' + slug + '/index.html (static)');
  });
}

/**
 * 列表页 blog/index.html 的 #posts-list 静态化:生成全量文章卡片,
 * 结构对齐前端 blog.js renderPostCards(搜索过滤时 JS 复用同一结构)。
 */
function generateIndexPage(posts) {
  const indexPath = path.resolve(__dirname, '../../blog/index.html');
  if (!fs.existsSync(indexPath)) {
    fail('blog/index.html 缺失,无法生成列表页');
  }
  let page = fs.readFileSync(indexPath, 'utf-8');

  // 卡片逐行拼接 + 换行缩进,生成可读 HTML
  // (#posts-list 处于 6 空格,卡片 8 空格起,内部每层 +2)
  const P0 = '        '; // 8 空格:<article> 本身
  const P1 = '          '; // 10 空格:<article> 一级子元素
  const P2 = '            '; // 12 空格:二级子元素
  const cards = posts
    .map(function (post, index) {
      const lines = [
        P0 +
          '<article class="blog-post-card blog-fade-in" style="animation-delay:' +
          index * 0.08 +
          's">',
        P1 + '<h2 class="blog-post-card__title">',
        P2 +
          '<a href="/blog/' +
          post.slug +
          '/">' +
          escapeHtml(post.title || 'Untitled') +
          '</a>',
        P1 + '</h2>',
      ];
      if (post.date) {
        lines.push(
          P1 +
            '<time class="blog-post-card__date">' +
            String(post.date).slice(0, 10) +
            '</time>',
        );
      }
      if (post.summary) {
        lines.push(
          P1 +
            '<p class="blog-post-card__summary">' +
            escapeHtml(post.summary) +
            '</p>',
        );
      }
      if (post.tags && post.tags.length) {
        lines.push(P1 + '<div class="blog-post-card__tags">');
        post.tags.forEach(function (tag) {
          lines.push(
            P2 + '<span class="blog-tag">' + escapeHtml(tag) + '</span>',
          );
        });
        lines.push(P1 + '</div>');
      }
      lines.push(P0 + '</article>');
      return lines.join('\n');
    })
    .join('\n');

  // 结构未匹配即失败(模板被改动会静默保留旧卡片,CI 应直接红灯);
  // 内容无变化(上次已生成相同卡片)属正常幂等
  if (!/<div id="posts-list" class="blog-posts">[\s\S]*?<\/div>\s*<\/main>/.test(page)) {
    fail('blog/index.html: #posts-list 结构未匹配,请同步生成器与模板');
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
