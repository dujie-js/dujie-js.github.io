/**
 * Blog System for dujie-js.github.io
 *
 * 博客页与文章页均为 SSG 静态化(生成器构建时渲染,SEO 可索引):
 * - 文章页 blog/<slug>/index.html:正文已渲染为静态 HTML,此处仅做增强
 *   (img lazy、代码复制、阅读进度条、TOC、相关文章)
 * - 列表页 blog/index.html:全量卡片已在 DOM,此处仅做 DOM 分页(切 hidden 类)
 * 搜索基于 /assets/json/posts.json 实时过滤重渲染。
 *
 * BlogUtils:  date formatting, HTML escaping
 * BlogCards:  Shared card rendering with keyword highlighting
 * BlogIndex:  DOM pagination for the listing page
 * BlogPost:   Static article enhancement
 * BlogNav:    Handles mobile navigation toggle
 * BlogSearch: Real-time post filtering on the index page
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
   Shared utilities
   ============================================ */
  const BlogUtils = (function () {
    // frontmatter 与 posts.json 的日期均为 YYYY-MM-DD 字符串,直接截取避免时区解析
    function formatDate(dateStr) {
      if (!dateStr) return '';
      const m = String(dateStr).match(/^\d{4}-\d{2}-\d{2}/);
      return m ? m[0] : '';
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    return {
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

      // 从 URL 恢复搜索状态:?q=搜索词
      const params = new URLSearchParams(window.location.search);
      _currentQuery = (params.get('q') || '').trim().toLowerCase();

      // 静态内容检测:生成器已渲染全量卡片(SEO 可索引),JS 仅作搜索数据源
      const hasStatic = !!container.querySelector('.blog-post-card');

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
            // 静态卡片全量在 DOM(SEO),分页仅切换显隐,不重渲染
            applyDomPagination(container, 1);
          }
        })
        .catch(function (err) {
          console.error('BlogIndex error:', err);
        });
    }

    function enableSearch() {
      const input = document.getElementById('search-input');
      if (input) input.disabled = false;
    }

    /**
     * DOM 分页:统计容器内全部 .blog-post-card,仅显示当前页,
     * 生成分页导航;翻页只切换 hidden 类,不重渲染(静态卡片保留给 SEO)。
     */
    function applyDomPagination(container, page) {
      const cards = container.querySelectorAll('.blog-post-card');
      const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
      if (totalPages <= 1) {
        return;
      }
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      currentPage = page;

      cards.forEach(function (card, index) {
        card.classList.toggle('hidden', index >= PAGE_SIZE);
      });

      renderDomPagination(container, totalPages, page);
    }

    function renderDomPagination(container, totalPages, page) {
      // 移除旧导航,重新生成
      container
        .querySelectorAll('.blog-pagination')
        .forEach(function (el) {
          el.remove();
        });

      let html = '<div class="blog-pagination">';
      if (page > 1) {
        html +=
          '<a role="button" tabindex="0" class="blog-pagination__link" data-page="' +
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
          '<a role="button" tabindex="0" class="blog-pagination__link" data-page="' +
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
          const turnPage = function () {
            applyDomPagination(
              container,
              parseInt(link.getAttribute('data-page'), 10),
            );
          };
          link.addEventListener('click', turnPage);
          // 键盘可达:Enter/Space 触发
          link.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              turnPage();
            }
          });
        });
    }

    return { init: init, applyDomPagination: applyDomPagination };
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
      return m ? m[1] : null;
    }

    function init() {
      const container = document.getElementById('post-content');
      if (!container) return;

      const slug = getSlug();
      if (!slug) return;

      // 静态文章由生成器渲染(SSG),JS 仅做增强
      if (container.querySelector('.blog-article__body')) {
        enhanceArticle(container, slug);
      }
    }

    /**
     * 文章增强:img lazy、代码复制、阅读进度条、相关文章、TOC。
     */
    function enhanceArticle(container, slug, tags) {
      const articleBody = container.querySelector('.blog-article__body');
      if (!articleBody) return;

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
      fetchRelated(container, slug, tags);

      // Generate Table of Contents
      buildToc(articleBody);
    }

    // 相关文章:静态模式未传 tags 时从 posts.json 按 slug 取(与生成器同源)
    function fetchRelated(container, slug, tags) {
      fetch(POSTS_JSON_URL)
        .then(function (res) {
          return res.json();
        })
        .then(function (allPosts) {
          if (!tags) {
            const current = allPosts.find(function (p) {
              return p.slug === slug;
            });
            tags = current && Array.isArray(current.tags) ? current.tags : [];
          }
          if (!tags.length) return;
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

    // 目录 TOC(基于静态正文中的 h2/h3 生成)
    function buildToc(articleBody) {
      const tocContainer = document.getElementById('post-toc');
      if (!tocContainer || !articleBody) return;
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

      // Data not ready yet — wait
      if (!_postsReady) return;

      // No query — show all posts (re-render 后 DOM 分页,与静态快照结构一致)
      if (!query) {
        BlogCards.renderPostCards(container, _allPosts);
        BlogIndex.applyDomPagination(container, 1);
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
      BlogIndex.applyDomPagination(container, 1);
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
