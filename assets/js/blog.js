/**
 * Blog System for dujie-js.github.io
 *
 * BlogUtils:   Frontmatter parser, date formatting, HTML escaping
 * BlogIndex:   Renders the blog post listing page
 * BlogPost:    Renders individual blog posts from Markdown
 * BlogNav:     Handles mobile navigation toggle
 * BlogSearch:  Real-time post filtering on the index page
 */

/* ============================================
   Shared data
   ============================================ */
var POSTS_JSON_URL = '/assets/json/posts.json';
var _allPosts = [];
var _postsReady = false;

/* ============================================
   Frontmatter Parser
   ============================================ */
var BlogUtils = (function () {
    /**
     * Parse YAML-like frontmatter from markdown text.
     * Supports: key: value and key: [item1, item2]
     * Handles both LF and CRLF line endings.
     */
    function parseFrontmatter(text) {
        var meta = {};
        var content = text;
        var match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
        if (match) {
            var lines = match[1].split('\n');
            lines.forEach(function (line) {
                var colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    var key = line.substring(0, colonIndex).trim();
                    var value = line.substring(colonIndex + 1).trim();
                    // Handle inline arrays: [tag1, tag2, tag3]
                    if (value.startsWith('[') && value.endsWith(']')) {
                        value = value.slice(1, -1).split(',').map(function (s) {
                            return s.trim().replace(/^['"]|['"]$/g, '');
                        });
                    }
                    // Strip surrounding quotes
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

    /**
     * Format a date string for display.
     * Accepts: YYYY-MM-DD, YYYY/MM/DD, or any Date-parseable string.
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        var year = d.getFullYear();
        var month = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        return year + '-' + month + '-' + day;
    }

    /**
     * Escape HTML entities for safe insertion.
     */
    function escapeHtml(str) {
        var div = document.createElement('div');
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
function renderPostCards(container, posts, highlightQuery) {
    if (!posts || !posts.length) {
        container.innerHTML = '<p class="blog-empty">还没有文章，敬请期待。</p>';
        return;
    }

    var html = '';
    posts.forEach(function (post) {
        var title = BlogUtils.escapeHtml(post.title || 'Untitled');
        var date = BlogUtils.formatDate(post.date);
        var summary = BlogUtils.escapeHtml(post.summary || '');
        var slug = BlogUtils.escapeHtml(post.slug || '');
        var tags = post.tags || [];

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
}

function highlightMatch(text, query) {
    if (!query || !text) return text;
    var re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(re, '<mark class="blog-highlight">$1</mark>');
}


/* ============================================
   Blog Index Page
   ============================================ */
var BlogIndex = (function () {
    function init() {
        var container = document.getElementById('posts-list');
        if (!container) return;

        fetch(POSTS_JSON_URL)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to fetch posts index');
                return res.json();
            })
            .then(function (posts) {
                _allPosts = posts;
                _postsReady = true;
                renderPostCards(container, posts);
            })
            .catch(function (err) {
                container.innerHTML = '<p class="blog-error">加载文章失败，请稍后再试。</p>';
                console.error('BlogIndex error:', err);
            });
    }

    return { init: init };
})();


/* ============================================
   Blog Post Page
   ============================================ */
var BlogPost = (function () {
    function init() {
        var container = document.getElementById('post-content');
        if (!container) return;

        var params = new URLSearchParams(window.location.search);
        var slug = params.get('slug');

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
            .catch(function () {
                container.innerHTML = '<p class="blog-error">文章未找到，请检查链接是否正确。</p>';
            });
    }

    function renderPost(container, markdown) {
        var parsed = BlogUtils.parseFrontmatter(markdown);
        var meta = parsed.meta;
        var content = parsed.content;

        // Build header
        var html = '';
        html += '<a href="/blog/" class="blog-article__back">&larr; 返回博客列表</a>';
        html += '<header class="blog-article__header">';
        html += '  <h1 class="blog-article__title">' + BlogUtils.escapeHtml(meta.title || 'Untitled') + '</h1>';
        html += '  <div class="blog-article__meta">';
        if (meta.date) {
            html += '    <time class="blog-article__date">' + BlogUtils.formatDate(meta.date) + '</time>';
        }
        if (meta.tags && Array.isArray(meta.tags) && meta.tags.length) {
            html += '    <div class="blog-article__tags">';
            meta.tags.forEach(function (tag) {
                html += '<span class="blog-tag">' + BlogUtils.escapeHtml(tag) + '</span>';
            });
            html += '    </div>';
        }
        html += '  </div>';
        html += '</header>';

        // Render markdown body
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            html += '<div class="blog-article__body">' + marked.parse(content) + '</div>';
        } else {
            html += '<div class="blog-article__body"><pre>' + BlogUtils.escapeHtml(content) + '</pre></div>';
        }

        container.innerHTML = html;

        if (meta.title) {
            document.title = meta.title + ' - DuJie Blog';
        }
    }

    return { init: init };
})();


/* ============================================
   Blog Mobile Navigation
   ============================================ */
var BlogNav = (function () {
    function init() {
        var btn = document.querySelector('.blog-mobile-menu-btn');
        var nav = document.querySelector('.blog-header__nav');
        if (!btn || !nav) return;

        btn.addEventListener('click', function () {
            nav.classList.toggle('visible');
            var icon = btn.querySelector('i');
            if (icon) {
                icon.className = nav.classList.contains('visible')
                    ? 'social iconfont icon-angleup'
                    : 'social iconfont icon-list';
            }
        });

        // Close menu when clicking a nav link
        var links = nav.querySelectorAll('a');
        links.forEach(function (link) {
            link.addEventListener('click', function () {
                nav.classList.remove('visible');
                var icon = btn.querySelector('i');
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
var BlogSearch = (function () {
    function init() {
        var input = document.getElementById('search-input');
        var clear = document.getElementById('search-clear');
        if (!input) return;

        input.addEventListener('input', function () {
            var query = input.value.trim().toLowerCase();
            if (clear) {
                clear.style.display = query ? 'block' : 'none';
            }
            filterPosts(query);
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
        var container = document.getElementById('posts-list');
        if (!container) return;

        // If data not ready yet or no query, show all posts
        if (!_postsReady || !query) {
            renderPostCards(container, _allPosts);
            return;
        }

        var filtered = _allPosts.filter(function (post) {
            var title = (post.title || '').toLowerCase();
            var summary = (post.summary || '').toLowerCase();
            var tags = (post.tags || []).join(' ').toLowerCase();
            return title.indexOf(query) !== -1 ||
                   summary.indexOf(query) !== -1 ||
                   tags.indexOf(query) !== -1;
        });

        if (!filtered.length) {
            container.innerHTML = '<p class="blog-search__empty">没有找到匹配 "<strong>' +
                BlogUtils.escapeHtml(query) + '</strong>" 的文章</p>';
            return;
        }

        renderPostCards(container, filtered, query);
    }

    return { init: init };
})();
