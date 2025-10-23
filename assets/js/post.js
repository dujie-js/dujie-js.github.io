/**
 * 博客文章详情页 JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    loadPost();
});

/**
 * 加载文章内容
 */
function loadPost() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (!postId) {
        showError('未找到文章ID', '请从博客列表页面访问文章。');
        return;
    }

    // 加载文章数据
    fetch('assets/json/posts.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('无法加载文章数据');
            }
            return response.json();
        })
        .then(data => {
            const post = data.posts.find(p => p.id === postId);
            
            if (!post) {
                showError('文章不存在', '找不到您要查看的文章。');
                return;
            }

            renderPost(post);
        })
        .catch(error => {
            console.error('加载文章失败:', error);
            showError('加载失败', '无法加载文章内容，请稍后再试。');
        });
}

/**
 * 渲染文章内容
 */
function renderPost(post) {
    const postContent = document.getElementById('postContent');
    
    // 更新页面标题
    document.getElementById('pageTitle').textContent = `${post.title} - DuJie`;

    // 解析 Markdown 内容
    const htmlContent = marked.parse(post.content || '暂无内容');

    // 生成文章 HTML
    const html = `
        <header class="post-header">
            <h1 class="post-title">${escapeHtml(post.title)}</h1>
            <div class="post-meta">
                <span>📅 ${formatDate(post.date)}</span>
                <span>👤 ${escapeHtml(post.author || 'DuJie')}</span>
                ${post.readTime ? `<span>⏱️ ${escapeHtml(post.readTime)}</span>` : ''}
            </div>
            ${post.tags && post.tags.length > 0 ? `
                <div class="post-tags">
                    ${post.tags.map(tag => `<span class="post-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
        </header>
        <div class="post-body">
            ${htmlContent}
        </div>
    `;

    postContent.innerHTML = html;

    // 为代码块添加语言标签和复制按钮（可选）
    enhanceCodeBlocks();

    // 平滑滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 显示错误信息
 */
function showError(title, message) {
    const postContent = document.getElementById('postContent');
    postContent.innerHTML = `
        <div class="error-state">
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(message)}</p>
            <a href="/blog.html" class="btn-back">← 返回博客列表</a>
        </div>
    `;
}

/**
 * 增强代码块显示
 */
function enhanceCodeBlocks() {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(block => {
        // 可以在这里添加代码高亮、复制按钮等功能
        // 例如使用 Prism.js 或 highlight.js
        
        // 简单的行号添加（可选）
        const lines = block.textContent.split('\n');
        if (lines.length > 3) {
            block.classList.add('has-line-numbers');
        }
    });
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
 * 配置 marked 选项
 */
if (typeof marked !== 'undefined') {
    marked.setOptions({
        breaks: true, // 支持 GFM 换行
        gfm: true, // 启用 GitHub Flavored Markdown
        headerIds: true, // 为标题生成 ID
        mangle: false, // 不混淆邮箱地址
    });
}

