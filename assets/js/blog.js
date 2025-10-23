/**
 * 博客系统 JavaScript
 * 实现博客列表展示和翻页功能
 */

// 配置
const POSTS_PER_PAGE = 5; // 每页显示的博客数量
let currentPage = 1;
let totalPages = 1;
let allPosts = [];

/**
 * 初始化博客系统
 */
document.addEventListener('DOMContentLoaded', function() {
    loadBlogPosts();
});

/**
 * 加载博客文章数据
 */
function loadBlogPosts() {
    const blogList = document.getElementById('blogList');
    blogList.innerHTML = '<div class="loading">加载中</div>';

    // 从 JSON 文件加载博客数据
    fetch('assets/json/posts.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('无法加载博客数据');
            }
            return response.json();
        })
        .then(data => {
            allPosts = data.posts || [];
            // 按日期降序排序
            allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
            totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);
            
            // 从 URL 获取页码
            const urlParams = new URLSearchParams(window.location.search);
            const page = parseInt(urlParams.get('page')) || 1;
            currentPage = Math.max(1, Math.min(page, totalPages));
            
            renderBlogList();
            renderPagination();
        })
        .catch(error => {
            console.error('加载博客失败:', error);
            blogList.innerHTML = `
                <div class="empty-state">
                    <h2>暂无博客</h2>
                    <p>博客内容即将更新，敬请期待！</p>
                </div>
            `;
        });
}

/**
 * 渲染博客列表
 */
function renderBlogList() {
    const blogList = document.getElementById('blogList');
    
    if (allPosts.length === 0) {
        blogList.innerHTML = `
            <div class="empty-state">
                <h2>暂无博客</h2>
                <p>博客内容即将更新，敬请期待！</p>
            </div>
        `;
        return;
    }

    // 计算当前页的文章
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    const currentPosts = allPosts.slice(startIndex, endIndex);

    // 生成 HTML
    blogList.innerHTML = currentPosts.map(post => `
        <article class="blog-item" onclick="goToPost('${post.id}')">
            <div class="blog-item-header">
                <h2><a href="post.html?id=${post.id}">${escapeHtml(post.title)}</a></h2>
            </div>
            <div class="blog-meta">
                <span>📅 ${formatDate(post.date)}</span>
                <span>👤 ${escapeHtml(post.author || 'DuJie')}</span>
                ${post.readTime ? `<span>⏱️ ${post.readTime}</span>` : ''}
            </div>
            ${post.tags && post.tags.length > 0 ? `
                <div class="blog-tags">
                    ${post.tags.map(tag => `<span class="blog-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="blog-excerpt">
                ${escapeHtml(post.excerpt || post.summary || '暂无摘要...')}
            </div>
            <a href="post.html?id=${post.id}" class="read-more">阅读全文 →</a>
        </article>
    `).join('');

    // 平滑滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 渲染分页导航
 */
function renderPagination() {
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // 上一页按钮
    html += `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        ‹ 上一页
    </button>`;

    // 页码按钮
    const pageNumbers = getPageNumbers();
    pageNumbers.forEach(page => {
        if (page === '...') {
            html += '<span style="color: white; padding: 0 0.5rem;">...</span>';
        } else {
            html += `<button onclick="goToPage(${page})" class="${page === currentPage ? 'active' : ''}">
                ${page}
            </button>`;
        }
    });

    // 下一页按钮
    html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        下一页 ›
    </button>`;

    pagination.innerHTML = html;
}

/**
 * 获取要显示的页码数组
 */
function getPageNumbers() {
    const pages = [];
    const maxVisible = 7; // 最多显示7个页码按钮

    if (totalPages <= maxVisible) {
        // 如果总页数不多，显示所有页码
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        // 总是显示第一页
        pages.push(1);

        // 计算中间显示的页码
        let start = Math.max(2, currentPage - 2);
        let end = Math.min(totalPages - 1, currentPage + 2);

        // 如果当前页靠近开始，多显示后面的页码
        if (currentPage <= 3) {
            end = Math.min(totalPages - 1, 5);
        }

        // 如果当前页靠近结束，多显示前面的页码
        if (currentPage >= totalPages - 2) {
            start = Math.max(2, totalPages - 4);
        }

        // 添加省略号
        if (start > 2) {
            pages.push('...');
        }

        // 添加中间的页码
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        // 添加省略号
        if (end < totalPages - 1) {
            pages.push('...');
        }

        // 总是显示最后一页
        pages.push(totalPages);
    }

    return pages;
}

/**
 * 跳转到指定页
 */
function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }

    currentPage = page;
    
    // 更新 URL
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);

    renderBlogList();
    renderPagination();
}

/**
 * 跳转到文章详情页
 */
function goToPost(postId) {
    window.location.href = `post.html?id=${postId}`;
}

/**
 * 格式化日期
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * HTML 转义，防止 XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 监听浏览器后退/前进按钮
 */
window.addEventListener('popstate', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page')) || 1;
    currentPage = Math.max(1, Math.min(page, totalPages));
    renderBlogList();
    renderPagination();
});

