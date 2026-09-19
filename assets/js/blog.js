/**
 * blog.js — 博客前端渲染器
 *
 * blog/md/<slug>.md 是一篇文章的唯一文件:没有构建产物,也没有 md/html 两份副本。
 * 本文件是全站唯一的 markdown 渲染点,三个页面各按容器是否存在生效:
 *   - blog/index.html    #posts-list    ← fetch posts.json 元数据渲染卡片
 *   - blog/post.html     #post-content  ← fetch /blog/md/<slug>.md 渲染正文
 *   - about/index.html   #about-content ← fetch /about/content.md 渲染正文
 * 另含移动端导航与回到顶部两个页面 chrome。
 *
 * 元数据(标题/日期/tags)统一取自 posts.json,由 assets/js/generate-blog-meta.js
 * 生成;浏览器端只负责剥掉 frontmatter,不重复实现解析器。
 */

(function () {
  const POSTS_JSON_URL = "/assets/json/posts.json";

  /* ============================================
   工具
   ============================================ */
  // 同时转义引号:textNode + innerHTML 的写法不转义引号,而本文件把它用在了
  // href="..." / src="..." 这类属性上下文里,slug 或图片 URL 带引号会撑破属性。
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fetchText(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + " → HTTP " + res.status);
      return res.text();
    });
  }

  // frontmatter 的日期为 YYYY-MM-DD 字符串,直接截取避免时区解析
  function formatDate(value) {
    const m = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : "";
  }

  // 浏览器侧只需剥掉 frontmatter 块,字段一律按 slug 从 posts.json 反查
  function stripFrontmatter(text) {
    return String(text)
      .replace(/^﻿/, "")
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  }

  function showError(container, message) {
    container.innerHTML =
      '<p class="blog-error">' + escapeHtml(message) + "</p>";
  }

  /* ============================================
   Markdown 渲染
   安全策略沿用原构建期渲染器:禁原始 HTML、协议白名单、图片强制 lazy。
   renderer 延迟到首次渲染才创建,这样 marked 万一没加载,
   也只影响正文,移动导航/回到顶部等 chrome 仍然可用。
   ============================================ */
  let _renderer = null;

  // 仅允许 http(s)/mailto/#/相对路径,禁 javascript:/data:
  function safeProtocol(value) {
    if (!value) return true;
    const v = String(value).trim().toLowerCase();
    return (
      /^(https?:|mailto:|#|\/|\.\.?\/)/.test(v) && !/javascript:|data:/i.test(v)
    );
  }

  function getRenderer() {
    if (_renderer) return _renderer;

    const renderer = new marked.Renderer();
    renderer.html = function () {
      return "";
    };
    const origLink = renderer.link.bind(renderer);
    renderer.link = function (href, title, text) {
      return safeProtocol(href) ? origLink(href, title, text) : text;
    };
    renderer.image = function (href, title, text) {
      if (!safeProtocol(href)) return "";
      const src = escapeHtml(href);
      const alt = escapeHtml(text || "");
      const titleAttr = title ? ' title="' + escapeHtml(title) + '"' : "";
      return (
        '<img src="' +
        src +
        '" alt="' +
        alt +
        '"' +
        titleAttr +
        ' loading="lazy">'
      );
    };

    _renderer = renderer;
    return renderer;
  }

  function renderMarkdown(md) {
    return marked.parse(md, {
      gfm: true,
      breaks: true,
      renderer: getRenderer(),
    });
  }

  /* ============================================
   列表页
   ============================================ */
  const BlogList = (function () {
    function cardHtml(post, index) {
      const slug = escapeHtml(post.slug || "");
      const title = escapeHtml(post.title || "Untitled");
      const date = formatDate(post.date);
      const summary = escapeHtml(post.summary || "");
      const tags = Array.isArray(post.tags) ? post.tags : [];

      let html =
        '<article class="blog-post-card blog-fade-in" style="animation-delay:' +
        index * 0.08 +
        's">';
      html +=
        '<h2 class="blog-post-card__title"><a href="/blog/post.html?slug=' +
        slug +
        '">' +
        title +
        "</a></h2>";
      if (date) {
        html += '<time class="blog-post-card__date">' + date + "</time>";
      }
      if (summary) {
        html += '<p class="blog-post-card__summary">' + summary + "</p>";
      }
      if (tags.length) {
        html += '<div class="blog-post-card__tags">';
        tags.forEach(function (tag) {
          html += '<span class="blog-tag">' + escapeHtml(tag) + "</span>";
        });
        html += "</div>";
      }
      html += "</article>";
      return html;
    }

    function init() {
      const container = document.getElementById("posts-list");
      if (!container) return;

      fetch(POSTS_JSON_URL)
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (posts) {
          if (!Array.isArray(posts) || !posts.length) {
            container.innerHTML =
              '<p class="blog-empty">还没有文章，敬请期待。</p>';
            return;
          }
          container.innerHTML = posts.map(cardHtml).join("\n");
        })
        .catch(function (err) {
          console.error("[BlogList]", err);
          showError(container, "文章列表加载失败，请刷新重试。");
        });
    }

    return { init: init };
  })();

  /* ============================================
   文章页
   ============================================ */
  const BlogPost = (function () {
    // slug 即文件名。放行字母数字下划线连字符和点(v1.2-notes.md 这类文件名带点),
    // 但显式拒绝 ".." —— 且 "/" 已被字符集挡掉,故无法穿越到 /blog/md/ 之外。
    const SLUG_RE = /^[a-zA-Z0-9_.-]+$/;

    function isSafeSlug(slug) {
      return SLUG_RE.test(slug) && slug.indexOf("..") === -1;
    }

    function headerHtml(post, slug) {
      const title = post && post.title ? post.title : slug;
      const date = post ? formatDate(post.date) : "";
      const lastmod = post ? formatDate(post.lastmod) : "";
      const tags = post && Array.isArray(post.tags) ? post.tags : [];

      let html =
        '<a href="/blog/" class="blog-article__back">&larr; 返回博客列表</a>';
      html += '<header class="blog-article__header">';
      html += '<h1 class="blog-article__title">' + escapeHtml(title) + "</h1>";
      html += '<div class="blog-article__meta">';
      if (date) {
        html += '<time class="blog-article__date">' + date + "</time>";
        if (lastmod && lastmod !== date) {
          html +=
            '<span class="blog-article__updated">更新于 ' + lastmod + "</span>";
        }
      }
      if (tags.length) {
        html += '<div class="blog-article__tags">';
        tags.forEach(function (tag) {
          html += '<span class="blog-tag">' + escapeHtml(tag) + "</span>";
        });
        html += "</div>";
      }
      html += "</div></header>";
      return html;
    }

    function init() {
      const container = document.getElementById("post-content");
      if (!container) return;

      const slug = new URLSearchParams(window.location.search).get("slug") || "";
      if (!isSafeSlug(slug)) {
        showError(container, "缺少或非法的文章参数，请从博客列表进入。");
        return;
      }

      // 元数据失败不该拖垮正文:posts.json 拿不到时降级为 slug 当标题
      const meta = fetch(POSTS_JSON_URL)
        .then(function (res) {
          return res.ok ? res.json() : [];
        })
        .catch(function () {
          return [];
        });

      Promise.all([meta, fetchText("/blog/md/" + slug + ".md")])
        .then(function (results) {
          const post = results[0].find(function (p) {
            return p.slug === slug;
          });
          document.title =
            (post && post.title ? post.title : slug) + " - DuJie Blog";
          container.innerHTML =
            headerHtml(post, slug) +
            '<div class="blog-article__body">' +
            renderMarkdown(stripFrontmatter(results[1])) +
            "</div>";
        })
        .catch(function (err) {
          console.error("[BlogPost]", err);
          showError(container, "文章加载失败，可能已删除或链接有误。");
        });
    }

    return { init: init };
  })();

  /* ============================================
   关于页
   ============================================ */
  const BlogAbout = (function () {
    function init() {
      const container = document.getElementById("about-content");
      if (!container) return;

      fetchText("/about/content.md")
        .then(function (md) {
          container.innerHTML = renderMarkdown(md);
        })
        .catch(function (err) {
          console.error("[BlogAbout]", err);
          showError(container, "关于页内容加载失败，请刷新重试。");
        });
    }

    return { init: init };
  })();

  /* ============================================
   移动端导航
   ============================================ */
  const BlogNav = (function () {
    function init() {
      const btn = document.querySelector(".blog-mobile-menu-btn");
      const nav = document.querySelector(".blog-header__nav");
      if (!btn || !nav) return;

      function toggle() {
        const isVisible = nav.classList.toggle("visible");
        const icon = btn.querySelector("i");
        if (icon) {
          icon.className = isVisible
            ? "social iconfont icon-angleup"
            : "social iconfont icon-list";
        }
        btn.setAttribute("aria-expanded", isVisible ? "true" : "false");
      }

      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", toggle);
      // 键盘可达:Enter/Space 触发
      btn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });

      nav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          nav.classList.remove("visible");
          const icon = btn.querySelector("i");
          if (icon) {
            icon.className = "social iconfont icon-list";
          }
        });
      });
    }

    return { init: init };
  })();

  /* ============================================
   回到顶部
   ============================================ */
  const BlogBackToTop = (function () {
    function init() {
      const btn = document.getElementById("backtotop");
      if (!btn) return;

      // 直接 toggle,不依赖 rAF(低功耗模式/iframe 等环境下 rAF 可能被冻结)
      window.addEventListener(
        "scroll",
        function () {
          btn.classList.toggle("visible", window.scrollY > 300);
        },
        { passive: true },
      );

      btn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    return { init: init };
  })();

  /* ============================================
   初始化
   各模块自身按容器存在与否空返回,三页共用一份入口。
   ============================================ */
  function initModule(mod) {
    try {
      mod.init();
    } catch (err) {
      console.error("[blog.js]", err);
    }
  }

  function boot() {
    // chrome 与列表页只处理元数据,不依赖 marked
    initModule(BlogNav);
    initModule(BlogBackToTop);
    initModule(BlogList);

    if (typeof marked === "undefined") {
      console.error("[blog.js] marked 未加载，正文无法渲染");
      return;
    }
    initModule(BlogPost);
    initModule(BlogAbout);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
