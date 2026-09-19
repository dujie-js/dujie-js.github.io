/**
 * blog.js — 博客前端渲染器
 *
 * blog/md/<slug>.md 是一篇文章的唯一文件:没有构建产物,也没有 md/html 两份副本。
 * 本文件是全站唯一的 markdown 渲染点,三个页面各按容器是否存在生效:
 *   - blog/index.html    #posts-list    ← fetch posts.json 元数据渲染卡片
 *   - blog/post.html     #post-content  ← fetch /blog/md/<slug>.md 渲染正文
 *   - about/index.html   #about-content ← fetch /about/content.md 渲染正文
 * 另含列表页搜索(元数据 + 懒加载的正文全文)、移动端导航与回到顶部。
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
   搜索文本处理
   ============================================ */

  // 把 markdown 正文粗剥成可搜索的纯文本。刻意不用 marked:列表页没有引入
  // marked.min.js,为了建索引去加载它(约 40KB)比正文本身还重。
  function toSearchText(md) {
    return String(md)
      // 代码围栏只去掉 ``` 标记、保留内容 —— 搜命令和报错是最常见的用法
      .replace(/^[ \t]*```[^\n]*$/gm, "")
      // 图片必须先于链接替换:![alt](url) 里含有 [alt](url) 的形状
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, "") // 标题
      .replace(/^[ \t]*>[ \t]?/gm, "") // 引用
      .replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, "") // 列表
      // 强调符成对去掉。单下划线要求两侧非单词字符,否则 some_var_name
      // 会被啃成 somevarname,搜索就再也找不到这个标识符了。
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, "$1$2")
      .replace(/~~(.+?)~~/g, "$1")
      .replace(/<[^>]*>/g, "") // 裸 HTML(含注释)
      .replace(/\|/g, " "); // 表格竖线
  }

  let _hlQuery = null;
  let _hlRegex = null;

  // 在**已转义**文本上高亮。查询词必须先做同样的 HTML 转义再转义正则元字符:
  // 只转义元字符的话,搜 "<" 会在 "&lt;" 里匹配到那个 "<" 字符,
  // 产出的 <mark> 反倒把标签撑破。
  function highlightMatch(escapedText, query) {
    const safe = escapeHtml(query);
    if (!safe) return escapedText;
    if (safe !== _hlQuery) {
      _hlQuery = safe;
      _hlRegex = new RegExp(
        "(" + safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
        "gi",
      );
    }
    return escapedText.replace(
      _hlRegex,
      '<mark class="blog-highlight">$1</mark>',
    );
  }

  // 以首个命中位置为中心取窗口,返回纯文本(调用方转义后再高亮)
  function makeSnippet(text, query) {
    const idx = String(text).toLowerCase().indexOf(query);
    if (idx === -1) return "";
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 60);
    // 折叠空白:正文里的换行与缩进会让片段读起来支离破碎
    const body = text.slice(start, end).replace(/\s+/g, " ").trim();
    return (start > 0 ? "…" : "") + body + (end < text.length ? "…" : "");
  }

  function toEntry(post) {
    return { post: post, snippet: "" };
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
    // 有查询词时按 escaped→highlight 的顺序处理,顺序反了会把 <mark> 一起转义掉
    function cardHtml(entry, index, query) {
      const post = entry.post;
      const slug = escapeHtml(post.slug || "");
      let title = escapeHtml(post.title || "Untitled");
      let summary = escapeHtml(post.summary || "");
      const date = formatDate(post.date);
      const tags = Array.isArray(post.tags) ? post.tags : [];

      if (query) {
        title = highlightMatch(title, query);
        summary = highlightMatch(summary, query);
      }

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
      if (entry.snippet) {
        html +=
          '<p class="blog-post-card__match">' +
          highlightMatch(escapeHtml(entry.snippet), query) +
          "</p>";
      }
      if (tags.length) {
        html += '<div class="blog-post-card__tags">';
        tags.forEach(function (tag) {
          const escaped = escapeHtml(tag);
          html +=
            '<span class="blog-tag">' +
            (query ? highlightMatch(escaped, query) : escaped) +
            "</span>";
        });
        html += "</div>";
      }
      html += "</article>";
      return html;
    }

    // 初始渲染与搜索共用同一入口:搜索即"用过滤后的 entries 重渲一遍"
    function render(entries, query) {
      const container = document.getElementById("posts-list");
      if (!container) return;

      if (!entries.length) {
        container.innerHTML = query
          ? '<p class="blog-empty">没有匹配「' +
            escapeHtml(query) +
            "」的文章。</p>"
          : '<p class="blog-empty">还没有文章，敬请期待。</p>';
        return;
      }

      container.innerHTML = entries
        .map(function (entry, index) {
          return cardHtml(entry, index, query);
        })
        .join("\n");
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
          const list = Array.isArray(posts) ? posts : [];
          render(list.map(toEntry), "");
          // 数据到位才放行搜索框,否则首次输入必然落空
          BlogSearch.enable(list);
        })
        .catch(function (err) {
          console.error("[BlogList]", err);
          showError(container, "文章列表加载失败，请刷新重试。");
        });
    }

    return { render: render, init: init };
  })();

  /* ============================================
   搜索
   元数据来自 posts.json;正文在首次搜索时才懒加载(见 getBodyIndex),
   不搜的人不会多付这 5 个请求。
   ============================================ */
  const BlogSearch = (function () {
    const DEBOUNCE_MS = 150;

    let _posts = [];
    let _input = null;
    let _timer = null;
    let _index = null; // 已就绪的正文索引:slug → { text, lower }
    let _indexPromise = null; // 懒加载且全局复用,并发输入共用同一个 Promise

    function getBodyIndex() {
      if (_indexPromise) return _indexPromise;
      _indexPromise = Promise.all(
        _posts.map(function (post) {
          const slug = post.slug || "";
          return fetchText("/blog/md/" + slug + ".md")
            .then(function (md) {
              const text = toSearchText(stripFrontmatter(md));
              // 原文留着做片段展示(不能拿转小写的文本当片段,大小写会丢),
              // 小写副本留着比较,免得每次按键都重新 toLowerCase 一遍全文。
              return { slug: slug, text: text, lower: text.toLowerCase() };
            })
            .catch(function () {
              // 单篇拉不到不该让整个搜索失效(与 BlogPost 的降级风格一致)
              return { slug: slug, text: "", lower: "" };
            });
        }),
      ).then(function (list) {
        // 无原型对象:slug 经白名单校验后仍可能是 "__proto__"
        const map = Object.create(null);
        list.forEach(function (item) {
          map[item.slug] = item;
        });
        _index = map;
        return map;
      });
      return _indexPromise;
    }

    function syncUrl(query) {
      try {
        const url = new URL(window.location.href);
        if (query) url.searchParams.set("q", query);
        else url.searchParams.delete("q");
        // replaceState 而非 pushState:否则每敲一个字都往历史里塞一条
        window.history.replaceState(null, "", url);
      } catch (err) {
        // file:// 等受限环境下 replaceState 会抛,不影响搜索本身
        console.warn("[BlogSearch] 无法同步 URL", err);
      }
    }

    function search(query) {
      // 索引尚未就绪时 query 必然为空(run 会先等 getBodyIndex),故无需额外兜底
      const index = _index;
      const entries = [];

      _posts.forEach(function (post) {
        const body = index ? index[post.slug] : null;

        if (!query) {
          entries.push(toEntry(post));
          return;
        }

        const lower = query.toLowerCase();
        const metaHit =
          String(post.title || "")
            .toLowerCase()
            .indexOf(lower) !== -1 ||
          String(post.summary || "")
            .toLowerCase()
            .indexOf(lower) !== -1 ||
          (Array.isArray(post.tags) ? post.tags : [])
            .join(" ")
            .toLowerCase()
            .indexOf(lower) !== -1 ||
          String(post.slug || "")
            .toLowerCase()
            .indexOf(lower) !== -1;
        const bodyHit = !!body && body.lower.indexOf(lower) !== -1;

        if (!metaHit && !bodyHit) return;
        // 只有"卡片上看不出为什么匹配"时才补一行正文片段;
        // 元数据已命中的话摘要本身就是理由,再多一行反而喧宾夺主。
        entries.push({
          post: post,
          snippet: !metaHit && bodyHit ? makeSnippet(body.text, lower) : "",
        });
      });

      BlogList.render(entries, query);
      syncUrl(query);
    }

    // 索引是异步的,拉取期间用户可能已经改了输入 —— 这时要丢掉这次结果
    function run(query) {
      if (!query) {
        search("");
        return;
      }
      getBodyIndex().then(function () {
        if (_input && _input.value.trim() !== query) return;
        search(query);
      });
    }

    // 由 BlogList 在 posts.json 到位后调用
    function enable(posts) {
      _posts = posts;
      if (!_input) return;
      _input.disabled = false;

      // 从 URL 恢复搜索状态:?q=搜索词
      let initial = "";
      try {
        initial = (
          new URLSearchParams(window.location.search).get("q") || ""
        ).trim();
      } catch (err) {
        initial = "";
      }
      if (!initial) return;

      _input.value = initial;
      const clear = document.getElementById("search-clear");
      if (clear) clear.style.display = "block";
      run(initial);
    }

    function init() {
      _input = document.getElementById("search-input");
      const clear = document.getElementById("search-clear");
      if (!_input) return;

      _input.addEventListener("input", function () {
        const query = _input.value.trim();
        if (clear) clear.style.display = query ? "block" : "none";
        if (_timer) clearTimeout(_timer);
        _timer = setTimeout(function () {
          run(query);
        }, DEBOUNCE_MS);
      });

      if (!clear) return;
      const clearSearch = function () {
        _input.value = "";
        _input.focus();
        clear.style.display = "none";
        if (_timer) clearTimeout(_timer);
        run("");
      };
      clear.addEventListener("click", clearSearch);
      // 键盘可达:Enter/Space 触发
      clear.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          clearSearch();
        }
      });
    }

    return { init: init, enable: enable };
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
    // chrome、列表页与搜索只处理元数据,不依赖 marked
    initModule(BlogNav);
    initModule(BlogBackToTop);
    // 先绑事件,再由 BlogList 在数据到位后调 BlogSearch.enable() 放行输入框
    initModule(BlogSearch);
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
