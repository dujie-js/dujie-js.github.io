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
        let content = text;
        const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
        if (match) {
            const lines = match[1].split(/\r?\n/);
            lines.forEach(function (line) {
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    let value = line.substring(colonIndex + 1).trim();
                    if (value.startsWith('[') && value.endsWith(']')) {
                        value = value.slice(1, -1).split(',').map(function (s) {
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
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const year = d.getFullYear();
        const month = ('0' + (d.getMonth() + 1)).slice(-2);
        const day = ('0' + d.getDate()).slice(-2);
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
        escapeHtml: escapeHtml
    };
})();


/* ============================================
   Shared card rendering (used by both index and search)
   ============================================ */
const BlogCards = (function () {
    function renderPostCards(container, posts, highlightQuery) {
        if (!posts || !posts.length) {
            container.innerHTML = '<p class="blog-empty">还没有文章，敬请期待。</p>';
            return;
        }

        let html = '';
        posts.forEach(function (post) {
            let title = BlogUtils.escapeHtml(post.title || 'Untitled');
            const date = BlogUtils.formatDate(post.date);
            let summary = BlogUtils.escapeHtml(post.summary || '');
            const slug = BlogUtils.escapeHtml(post.slug || '');
            const tags = post.tags || [];

            if (highlightQuery) {
                title = highlightMatch(title, highlightQuery);
                summary = highlightMatch(summary, highlightQuery);
            }

            html += '<article class="blog-post-card blog-fade-in">';
            html += '  <h2 class="blog-post-card__title">';
            html += '    <a href="/blog/post.html?slug=' + slug + '">' + title + '</a>';
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
                    html += '<span class="blog-tag">' + BlogUtils.escapeHtml(tag) + '</span>';
                });
                html += '  </div>';
            }
            html += '</article>';
        });

        container.innerHTML = html;

        // Dynamically stagger animation delays for all cards
        const cards = container.querySelectorAll('.blog-post-card');
        cards.forEach(function (card, index) {
            card.style.animationDelay = (index * 0.08) + 's';
        });
    }

    let _cachedQuery = '';
    let _cachedRegex = null;

    function highlightMatch(text, query) {
        if (!query || !text) return text;
        if (query !== _cachedQuery) {
            _cachedQuery = query;
            _cachedRegex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        }
        return text.replace(_cachedRegex, '<mark class="blog-highlight">$1</mark>');
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

        fetch(POSTS_JSON_URL)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to fetch posts index');
                return res.json();
            })
            .then(function (posts) {
                _allPosts = posts;
                _postsReady = true;
                enableSearch();
                goToPage(1);
            })
            .catch(function (err) {
                container.innerHTML = '<p class="blog-error">加载文章失败，请稍后再试。</p>';
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
        if (!container || !_allPosts.length) return;

        const totalPages = Math.ceil(_allPosts.length / PAGE_SIZE);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentPage = page;

        const start = (page - 1) * PAGE_SIZE;
        const pagePosts = _allPosts.slice(start, start + PAGE_SIZE);

        BlogCards.renderPostCards(container, pagePosts);
        renderPagination(container, totalPages, page);
    }

    function renderPagination(container, totalPages, page) {
        if (totalPages <= 1) return;

        let html = '<div class="blog-pagination">';
        if (page > 1) {
            html += '<a href="#" class="blog-pagination__link" data-page="' + (page - 1) + '">« 上一页</a>';
        }
        html += '<span class="blog-pagination__info">' + page + ' / ' + totalPages + '</span>';
        if (page < totalPages) {
            html += '<a href="#" class="blog-pagination__link" data-page="' + (page + 1) + '">下一页 »</a>';
        }
        html += '</div>';

        const div = document.createElement('div');
        div.innerHTML = html;
        container.appendChild(div.firstElementChild);

        container.querySelectorAll('.blog-pagination__link').forEach(function (link) {
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
    function init() {
        const container = document.getElementById('post-content');
        if (!container) return;

        const params = new URLSearchParams(window.location.search);
        const slug = params.get('slug');

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
                renderPost(container, markdown);
            })
            .catch(function (err) {
                container.innerHTML = '<p class="blog-error">文章未找到，请检查链接是否正确。</p>';
                console.error('BlogPost error:', err);
            });
    }

    function renderPost(container, markdown) {
        const parsed = BlogUtils.parseFrontmatter(markdown);
        const meta = parsed.meta;
        const content = parsed.content;

        let html = '';
        html += '<a href="/blog/" class="blog-article__back">&larr; 返回博客列表</a>';
        html += '<header class="blog-article__header">';
        html += '  <h1 class="blog-article__title">' + BlogUtils.escapeHtml(meta.title || 'Untitled') + '</h1>';
        html += '  <div class="blog-article__meta">';
        if (meta.date) {
            html += '    <time class="blog-article__date">' + BlogUtils.formatDate(meta.date) + '</time>';
        }
        const tags = Array.isArray(meta.tags) ? meta.tags : [];
        if (tags.length) {
            html += '    <div class="blog-article__tags">';
            tags.forEach(function (tag) {
                html += '<span class="blog-tag">' + BlogUtils.escapeHtml(tag) + '</span>';
            });
            html += '    </div>';
        }
        html += '  </div>';
        html += '</header>';

        if (typeof marked !== 'undefined') {
            marked.setOptions({ breaks: true, gfm: true });
            html += '<div class="blog-article__body">' + marked.parse(content) + '</div>';
        } else {
            html += '<div class="blog-article__body"><pre>' + BlogUtils.escapeHtml(content) + '</pre></div>';
        }

        container.innerHTML = html;

        // Add loading="lazy" to images in article body
        const articleBody = container.querySelector('.blog-article__body');
        if (articleBody) {
            articleBody.querySelectorAll('img').forEach(function (img) {
                img.loading = 'lazy';
            });
        }

        if (meta.title) {
            document.title = meta.title + ' - DuJie Blog';
        }

        // Update OG meta tags for this post
        const ogTitle = meta.title + ' - DuJie Blog';
        const ogDesc = meta.summary || meta.title || '';
        const ogUrl = window.location.href;

        setMeta('og:title', ogTitle);
        setMeta('og:description', ogDesc);
        setMeta('og:url', ogUrl);

        // Update JSON-LD structured data
        const ldEl = document.getElementById('json-ld-post');
        if (ldEl) {
            const ldData = JSON.parse(ldEl.textContent);
            ldData.headline = meta.title || 'DuJie Blog';
            ldData.description = meta.summary || '';
            if (meta.date) {
                ldData.datePublished = meta.date;
            }
            ldEl.textContent = JSON.stringify(ldData, null, 4);
        }

        // Generate Table of Contents
        const tocContainer = document.getElementById('post-toc');
        if (tocContainer && articleBody) {
            const headings = articleBody.querySelectorAll('h2, h3');
            if (headings.length > 1) {
                let tocHtml = '<nav class="blog-toc__nav"><h3 class="blog-toc__title">目录</h3><ul class="blog-toc__list">';
                headings.forEach(function (h, i) {
                    const id = 'toc-' + i;
                    h.setAttribute('id', id);
                    const text = h.textContent || '';
                    const tag = h.tagName.toLowerCase();
                    tocHtml += '<li class="blog-toc__item blog-toc__item--' + tag + '"><a href="#' + id + '">' + BlogUtils.escapeHtml(text) + '</a></li>';
                });
                tocHtml += '</ul></nav>';
                tocContainer.innerHTML = tocHtml;

                // Smooth scroll for TOC links
                tocContainer.addEventListener('click', function (e) {
                    const target = e.target.closest('a');
                    if (target && target.getAttribute('href').charAt(0) === '#') {
                        e.preventDefault();
                        const el = document.getElementById(target.getAttribute('href').slice(1));
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                });
            }
        }
    }

    function setMeta(property, value) {
        const el = document.querySelector('meta[property="' + property + '"], meta[name="' + property + '"]');
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

        btn.addEventListener('click', function () {
            nav.classList.toggle('visible');
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = nav.classList.contains('visible')
                    ? 'social iconfont icon-angleup'
                    : 'social iconfont icon-list';
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
            clear.addEventListener('click', function () {
                input.value = '';
                input.focus();
                clear.style.display = 'none';
                filterPosts('');
            });
        }
    }

    function filterPosts(query) {
        const container = document.getElementById('posts-list');
        if (!container) return;

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
            const tags = (post.tags || []).join(' ').toLowerCase();
            const slug = (post.slug || '').toLowerCase();
            return title.indexOf(query) !== -1 ||
                   summary.indexOf(query) !== -1 ||
                   tags.indexOf(query) !== -1 ||
                   slug.indexOf(query) !== -1;
        });

        if (!filtered.length) {
            container.innerHTML = '<p class="blog-search__empty">没有找到匹配 "<strong>' +
                BlogUtils.escapeHtml(query) + '</strong>" 的文章</p>';
            return;
        }

        BlogCards.renderPostCards(container, filtered, query);
    }

    return { init: init };
})();

// Expose only the modules that HTML pages call directly
window.BlogNav = BlogNav;
window.BlogIndex = BlogIndex;
window.BlogPost = BlogPost;
window.BlogSearch = BlogSearch;
})();
