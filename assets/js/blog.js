/**
 * Blog System for dujie-js.github.io
 *
 * BlogUtils:   Frontmatter parser, date formatting, HTML escaping
 * BlogCards:   Shared card rendering with keyword highlighting
 * BlogIndex:   Renders the blog post listing page
 * BlogPost:    Renders individual blog posts from Markdown
 * BlogNav:     Handles mobile navigation toggle
 * BlogSearch:  Real-time post filtering on the index page
 */

(function () {
  /* ============================================
   Shared data
   ============================================ */
  const POSTS_JSON_URL = '/assets/json/posts.json';
  let _allPosts = [];
  let _postsReady = false;
  let _currentQuery = ''; // 当前搜索词(分页/搜索状态共享)

  /* ============================================
   Frontmatter Parser
   ============================================ */
  const BlogUtils = (function () {
    /**
     * Parse YAML-like frontmatter from markdown text.
     * Supports: key: value and key: [item1, item2]
     * Handles both LF and CRLF line endings.
     */
    function parseFrontmatter(text) {
      const meta = {};
      // 去掉 UTF-8 BOM（Windows 编辑器常见）
      let content = text.replace(/^\uFEFF/, '');
      const match = content.match(
        /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/,
      );
      if (match) {
        const lines = match[1].split(/\r?\n/);
        lines.forEach(function (line) {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            if (value.startsWith('[') && value.endsWith(']')) {
              value = value
                .slice(1, -1)
                .split(',')
                .map(function (s) {
                  return s.trim().replace(/^['"]|['"]$/g, '');
                });
            }
            if (typeof value === 'string') {
              value = value.replace(/^['"]|['"]$/g, '');
            }
            meta[key] = value;
          }
        });
        content = match[2];
      }
      return { meta: meta, content: content };
    }

    function formatDate(dateStr) {
      if (!dateStr) return '';
      // YYYY-MM-DD 直接按字符串处理，避免 UTC 解析与本地时区错位
      const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return m[1] + '-' + m[2] + '-' + m[3];
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const year = d.getUTCFullYear();
      const month = ('0' + (d.getUTCMonth() + 1)).slice(-2);
      const day = ('0' + d.getUTCDate()).slice(-2);
      return year + '-' + month + '-' + day;
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    return {
      parseFrontmatter: parseFrontmatter,
      formatDate: formatDate,
      escapeHtml: escapeHtml,
    };
  })();

  /* ============================================
   Shared card rendering (used by both index and search)
   ============================================ */
  const BlogCards = (function () {
    function renderPostCards(container, posts, highlightQuery) {
      if (!posts || !posts.length) {
        container.innerHTML =
          '<p class="blog-empty">还没有文章，敬请期待。</p>';
        return;
      }

      let html = '';
      posts.forEach(function (post) {
        let title = BlogUtils.escapeHtml(post.title || 'Untitled');
        const date = BlogUtils.formatDate(post.date);
        let summary = BlogUtils.escapeHtml(post.summary || '');
        const slug = BlogUtils.escapeHtml(post.slug || '');
        const tags = Array.isArray(post.tags) ? post.tags : [];

        if (highlightQuery) {
          title = highlightMatch(title, highlightQuery);
          summary = highlightMatch(summary, highlightQuery);
        }

        html += '<article class="blog-post-card blog-fade-in">';
        html += '  <h2 class="blog-post-card__title">';
        html += '    <a href="/blog/' + slug + '/">' + title + '</a>';
        html += '  </h2>';
        if (date) {
          html += '  <time class="blog-post-card__date">' + date + '</time>';
        }
        if (summary) {
          html += '  <p class="blog-post-card__summary">' + summary + '</p>';
        }
        if (tags.length) {
          html += '  <div class="blog-post-card__tags">';
          tags.forEach(function (tag) {
            html +=
              '<span class="blog-tag">' + BlogUtils.escapeHtml(tag) + '</span>';
          });
          html += '  </div>';
        }
        html += '</article>';
      });

      container.innerHTML = html;

      // Dynamically stagger animation delays for all cards
      const cards = container.querySelectorAll('.blog-post-card');
      cards.forEach(function (card, index) {
        card.style.animationDelay = index * 0.08 + 's';
      });
    }

    let _cachedQuery = '';
    let _cachedRegex = null;

    function highlightMatch(text, query) {
      if (!query || !text) return text;
      if (query !== _cachedQuery) {
        _cachedQuery = query;
        _cachedRegex = new RegExp(
          '(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')',
          'gi',
        );
      }
      return text.replace(
        _cachedRegex,
        '<mark class="blog-highlight">$1</mark>',
      );
    }

    return { renderPostCards: renderPostCards };
  })();

  /* ============================================
   Blog Index Page
   ============================================ */
  const BlogIndex = (function () {
    const PAGE_SIZE = 5;
    let currentPage = 1;

    function init() {
      const container = document.getElementById('posts-list');
      if (!container) return;

      // 从 URL 恢复状态:?q=搜索词 &page=N
      const params = new URLSearchParams(window.location.search);
      _currentQuery = (params.get('q') || '').trim().toLowerCase();
      const urlPage = parseInt(params.get('page'), 10) || 1;

      fetch(POSTS_JSON_URL)
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch posts index');
          return res.json();
        })
        .then(function (posts) {
          _allPosts = posts;
          _postsReady = true;
          enableSearch();
          if (_currentQuery) {
            // 恢复搜索状态
            const input = document.getElementById('search-input');
            if (input) {
              input.value = _currentQuery;
              const clear = document.getElementById('search-clear');
              if (clear) clear.style.display = 'block';
            }
            BlogSearch.filterPosts(_currentQuery);
          } else {
            goToPage(urlPage);
          }
        })
        .catch(function (err) {
          container.innerHTML =
            '<p class="blog-error">加载文章失败，请稍后再试。</p>';
          console.error('BlogIndex error:', err);
        });
    }

    function enableSearch() {
      const input = document.getElementById('search-input');
      if (input) input.disabled = false;
    }

    function goToPage(page) {
      currentPage = page;
      const container = document.getElementById('posts-list');
      if (!container) return;

      const totalPages = Math.max(1, Math.ceil(_allPosts.length / PAGE_SIZE));
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      currentPage = page;

      // 页码写入 URL(替换而非新增历史,避免产生历史噪音)
      syncUrlState(page, _currentQuery);

      const start = (page - 1) * PAGE_SIZE;
      const pagePosts = _allPosts.slice(start, start + PAGE_SIZE);

      BlogCards.renderPostCards(container, pagePosts);
      renderPagination(container, totalPages, page);
    }

    // 分页/搜索状态同步到 URL,支持刷新/分享/回退
    function syncUrlState(page, query) {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (page > 1) params.set('page', page);
      const search = params.toString();
      try {
        history.replaceState(
          null,
          '',
          search ? '?' + search : window.location.pathname,
        );
      } catch (e) {
        /* 环境限制时忽略 */
      }
    }

    function renderPagination(container, totalPages, page) {
      if (totalPages <= 1) return;

      let html = '<div class="blog-pagination">';
      if (page > 1) {
        html +=
          '<a href="#" class="blog-pagination__link" data-page="' +
          (page - 1) +
          '">« 上一页</a>';
      }
      html +=
        '<span class="blog-pagination__info">' +
        page +
        ' / ' +
        totalPages +
        '</span>';
      if (page < totalPages) {
        html +=
          '<a href="#" class="blog-pagination__link" data-page="' +
          (page + 1) +
          '">下一页 »</a>';
      }
      html += '</div>';

      const div = document.createElement('div');
      div.innerHTML = html;
      container.appendChild(div.firstElementChild);

      container
        .querySelectorAll('.blog-pagination__link')
        .forEach(function (link) {
          link.addEventListener('click', function (e) {
            e.preventDefault();
            goToPage(parseInt(this.getAttribute('data-page')));
          });
        });
    }

    return { init: init, goToPage: goToPage };
  })();

  /* ============================================
   Blog Post Page
   ============================================ */
  const BlogPost = (function () {
    function getSlug() {
      // 目录式 URL:/blog/<slug>/ 或 /blog/<slug>/index.html
      const m = window.location.pathname.match(
        /^\/blog\/([a-zA-Z0-9_\-.]+)\/(?:index\.html)?$/,
      );
      if (m) return m[1];
      // 兼容旧链接:post.html?slug=xxx(页面会重定向,双保险)
      return new URLSearchParams(window.location.search).get('slug') || null;
    }

    function init() {
      const container = document.getElementById('post-content');
      if (!container) return;

      const slug = getSlug();

      if (!slug || !/^[a-zA-Z0-9_\-.]+$/.test(slug)) {
        container.innerHTML = '<p class="blog-error">文章未找到。</p>';
        return;
      }

      fetch('/posts/' + encodeURIComponent(slug) + '.md')
        .then(function (res) {
          if (!res.ok) throw new Error('Post not found');
          return res.text();
        })
        .then(function (markdown) {
          renderPost(container, markdown, slug);
        })
        .catch(function (err) {
          container.innerHTML =
            '<p class="blog-error">文章未找到，请检查链接是否正确。</p>';
          console.error('BlogPost error:', err);
        });
    }

    function renderPost(container, markdown, slug) {
      const parsed = BlogUtils.parseFrontmatter(markdown);
      const meta = parsed.meta;
      const content = parsed.content;

      let html = '';
      html +=
        '<a href="/blog/" class="blog-article__back">&larr; 返回博客列表</a>';
      html += '<header class="blog-article__header">';
      html +=
        '  <h1 class="blog-article__title">' +
        BlogUtils.escapeHtml(meta.title || 'Untitled') +
        '</h1>';
      html += '  <div class="blog-article__meta">';
      if (meta.date) {
        html +=
          '    <time class="blog-article__date">' +
          BlogUtils.formatDate(meta.date) +
          '</time>';
        if (
          meta.lastmod &&
          String(meta.lastmod).slice(0, 10) !== String(meta.date).slice(0, 10)
        ) {
          html +=
            '    <span class="blog-article__updated">更新于 ' +
            BlogUtils.formatDate(meta.lastmod) +
            '</span>';
        }
      }
      const tags = Array.isArray(meta.tags) ? meta.tags : [];
      if (tags.length) {
        html += '    <div class="blog-article__tags">';
        tags.forEach(function (tag) {
          html +=
            '<span class="blog-tag">' + BlogUtils.escapeHtml(tag) + '</span>';
        });
        html += '    </div>';
      }
      html += '  </div>';
      html += '</header>';

      if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });

        // 安全渲染：禁用原始 HTML，链接/图片仅允许 http(s)/mailto/#/相对路径
        const renderer = new marked.Renderer();
        const safeProtocol = function (value) {
          if (!value) return true;
          const v = String(value).trim().toLowerCase();
          return (
            /^(https?:|mailto:|#|\/|\.\.?\/)/.test(v) &&
            !/javascript:|data:/i.test(v)
          );
        };
        renderer.html = function () {
          return '';
        };
        const origLink = renderer.link.bind(renderer);
        const origImage = renderer.image.bind(renderer);
        renderer.link = function (href, title, text) {
          return safeProtocol(href) ? origLink(href, title, text) : text;
        };
        renderer.image = function (href, title, text) {
          return safeProtocol(href) ? origImage(href, title, text) : '';
        };

        marked.use({ renderer: renderer });
        html +=
          '<div class="blog-article__body">' + marked.parse(content) + '</div>';
      } else {
        html +=
          '<div class="blog-article__body"><pre>' +
          BlogUtils.escapeHtml(content) +
          '</pre></div>';
      }

      container.innerHTML = html;

      // Add loading="lazy" to images in article body
      const articleBody = container.querySelector('.blog-article__body');
      if (articleBody) {
        articleBody.querySelectorAll('img').forEach(function (img) {
          img.loading = 'lazy';
        });

        // 代码块复制按钮
        articleBody.querySelectorAll('pre').forEach(function (pre) {
          pre.classList.add('blog-code-block');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'blog-copy-btn';
          btn.textContent = '复制';
          btn.setAttribute('aria-label', '复制代码');
          btn.addEventListener('click', function () {
            const code = pre.querySelector('code');
            const text = code ? code.textContent : pre.textContent;
            const done = function () {
              btn.textContent = '已复制 ✓';
              setTimeout(function () {
                btn.textContent = '复制';
              }, 1500);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(done).catch(done);
            } else {
              const ta = document.createElement('textarea');
              ta.value = text;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              ta.remove();
              done();
            }
          });
          pre.appendChild(btn);
        });
      }

      // 阅读进度条(仅文章页)
      if (!document.querySelector('.blog-progress-bar')) {
        const progressBar = document.createElement('div');
        progressBar.className = 'blog-progress-bar';
        progressBar.setAttribute('aria-hidden', 'true');
        document.body.appendChild(progressBar);
        const updateProgress = function () {
          const doc = document.documentElement;
          const total = doc.scrollHeight - window.innerHeight;
          progressBar.style.width =
            (total > 0 ? (window.scrollY / total) * 100 : 0) + '%';
        };
        window.addEventListener('scroll', updateProgress, { passive: true });
        updateProgress();
      }

      // 相关文章推荐:基于 tags 匹配
      if (tags.length) {
        fetch(POSTS_JSON_URL)
          .then(function (res) {
            return res.json();
          })
          .then(function (allPosts) {
            const related = allPosts
              .filter(function (p) {
                return p.slug !== slug;
              })
              .map(function (p) {
                const pTags = Array.isArray(p.tags) ? p.tags : [];
                const shared = pTags.filter(function (t) {
                  return tags.indexOf(t) !== -1;
                }).length;
                return { post: p, shared: shared };
              })
              .filter(function (item) {
                return item.shared > 0;
              })
              .sort(function (a, b) {
                return b.shared - a.shared;
              })
              .slice(0, 3);
            if (related.length) {
              let relHtml =
                '<section class="blog-related"><h3 class="blog-related__title">相关阅读</h3><ul class="blog-related__list">';
              related.forEach(function (item) {
                const p = item.post;
                relHtml +=
                  '<li><a href="/blog/' +
                  BlogUtils.escapeHtml(p.slug) +
                  '/">' +
                  BlogUtils.escapeHtml(p.title || p.slug) +
                  '</a>' +
                  (p.date
                    ? '<span class="blog-related__date">' +
                      BlogUtils.formatDate(p.date) +
                      '</span>'
                    : '') +
                  '</li>';
              });
              relHtml += '</ul></section>';
              container.insertAdjacentHTML('beforeend', relHtml);
            }
          })
          .catch(function () {
            /* 推荐失败不影响文章 */
          });
      }

      if (meta.title) {
        document.title = meta.title + ' - DuJie Blog';
      }

      // Update OG meta tags + canonical for this post
      const ogTitle = meta.title + ' - DuJie Blog';
      const ogDesc = meta.summary || meta.title || '';
      // file:// 下 location.origin 为 "null",兜底到站点域名
      const origin =
        window.location.origin && window.location.origin.startsWith('http')
          ? window.location.origin
          : 'https://dujie-js.github.io';
      const ogUrl = origin + '/blog/' + slug + '/';

      setMeta('og:title', ogTitle);
      setMeta('og:description', ogDesc);
      setMeta('og:url', ogUrl);
      const canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink) {
        canonicalLink.setAttribute('href', ogUrl);
      }

      // Update JSON-LD structured data
      const ldEl = document.getElementById('json-ld-post');
      if (ldEl) {
        try {
          const ldData = JSON.parse(ldEl.textContent);
          ldData.headline = meta.title || 'DuJie Blog';
          ldData.description = meta.summary || '';
          if (meta.date) {
            ldData.datePublished = meta.date;
          }
          if (meta.lastmod) {
            ldData.dateModified = meta.lastmod;
          }
          ldEl.textContent = JSON.stringify(ldData, null, 4);
        } catch (ldErr) {
          console.warn('JSON-LD update failed:', ldErr);
        }
      }

      // Generate Table of Contents
      const tocContainer = document.getElementById('post-toc');
      if (tocContainer && articleBody) {
        const headings = articleBody.querySelectorAll('h2, h3');
        if (headings.length > 0) {
          let tocHtml =
            '<nav class="blog-toc__nav"><h3 class="blog-toc__title">目录</h3><ul class="blog-toc__list">';
          headings.forEach(function (h, i) {
            const id = 'toc-' + i;
            h.setAttribute('id', id);
            const text = h.textContent || '';
            const tag = h.tagName.toLowerCase();
            tocHtml +=
              '<li class="blog-toc__item blog-toc__item--' +
              tag +
              '"><a href="#' +
              id +
              '">' +
              BlogUtils.escapeHtml(text) +
              '</a></li>';
          });
          tocHtml += '</ul></nav>';
          tocContainer.innerHTML = tocHtml;

          // Smooth scroll for TOC links
          tocContainer.addEventListener('click', function (e) {
            const target = e.target.closest('a');
            if (target && target.getAttribute('href').charAt(0) === '#') {
              e.preventDefault();
              const el = document.getElementById(
                target.getAttribute('href').slice(1),
              );
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }
          });
        }
      }
    }

    function setMeta(property, value) {
      const el = document.querySelector(
        'meta[property="' + property + '"], meta[name="' + property + '"]',
      );
      if (el) {
        el.setAttribute('content', value);
      }
    }

    return { init: init };
  })();

  /* ============================================
   Blog Mobile Navigation
   ============================================ */
  const BlogNav = (function () {
    function init() {
      const btn = document.querySelector('.blog-mobile-menu-btn');
      const nav = document.querySelector('.blog-header__nav');
      if (!btn || !nav) return;

      function toggle() {
        const isVisible = nav.classList.toggle('visible');
        const icon = btn.querySelector('i');
        if (icon) {
          icon.className = isVisible
            ? 'social iconfont icon-angleup'
            : 'social iconfont icon-list';
        }
        btn.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
      }

      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', toggle);
      // 键盘可达:Enter/Space 触发
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });

      const links = nav.querySelectorAll('a');
      links.forEach(function (link) {
        link.addEventListener('click', function () {
          nav.classList.remove('visible');
          const icon = btn.querySelector('i');
          if (icon) {
            icon.className = 'social iconfont icon-list';
          }
        });
      });
    }

    return { init: init };
  })();

  /* ============================================
   Blog Search
   ============================================ */
  const BlogSearch = (function () {
    let _timer = null;

    function init() {
      const input = document.getElementById('search-input');
      const clear = document.getElementById('search-clear');
      if (!input) return;

      input.addEventListener('input', function () {
        const query = input.value.trim().toLowerCase();
        if (clear) {
          clear.style.display = query ? 'block' : 'none';
        }
        if (_timer) clearTimeout(_timer);
        _timer = setTimeout(function () {
          filterPosts(query);
        }, 150);
      });

      if (clear) {
        const clearSearch = function () {
          input.value = '';
          input.focus();
          clear.style.display = 'none';
          filterPosts('');
        };
        clear.addEventListener('click', clearSearch);
        // 键盘可达:Enter/Space 触发
        clear.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clearSearch();
          }
        });
      }
    }

    function filterPosts(query) {
      const container = document.getElementById('posts-list');
      if (!container) return;

      _currentQuery = query;

      // Data not ready yet — wait (show loading state)
      if (!_postsReady) return;

      // No query — show all posts with pagination
      if (!query) {
        BlogIndex.goToPage(1);
        return;
      }

      const filtered = _allPosts.filter(function (post) {
        const title = (post.title || '').toLowerCase();
        const summary = (post.summary || '').toLowerCase();
        const tags = (Array.isArray(post.tags) ? post.tags : [])
          .join(' ')
          .toLowerCase();
        const slug = (post.slug || '').toLowerCase();
        return (
          title.indexOf(query) !== -1 ||
          summary.indexOf(query) !== -1 ||
          tags.indexOf(query) !== -1 ||
          slug.indexOf(query) !== -1
        );
      });

      if (!filtered.length) {
        container.innerHTML =
          '<p class="blog-search__empty">没有找到匹配 "<strong>' +
          BlogUtils.escapeHtml(query) +
          '</strong>" 的文章</p>';
        return;
      }

      BlogCards.renderPostCards(container, filtered, query);
    }

    return { init: init, filterPosts: filterPosts };
  })();

  /* ============================================
   Back to Top Button
   ============================================ */
  const BlogBackToTop = (function () {
    function init() {
      const btn = document.getElementById('backtotop');
      if (!btn) return;

      // 直接 toggle,不依赖 rAF(低功耗模式/iframe 等环境下 rAF 可能被冻结)
      window.addEventListener(
        'scroll',
        function () {
          btn.classList.toggle('visible', window.scrollY > 300);
        },
        { passive: true },
      );

      btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    return { init: init };
  })();

  // Expose only the modules that HTML pages call directly
  window.BlogNav = BlogNav;
  window.BlogIndex = BlogIndex;
  window.BlogPost = BlogPost;
  window.BlogSearch = BlogSearch;
  window.BlogBackToTop = BlogBackToTop;
})();
