/**
 * generate-posts-index.js
 * 
 * Scans the ./posts/ directory for .md files,
 * parses YAML-like frontmatter from each file,
 * and generates ./assets/json/posts.json as the blog index.
 * 
 * Usage: node assets/js/generate-posts-index.js
 * Intended to be run via GitHub Actions on every push.
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.resolve(__dirname, '../../posts');
const OUTPUT_FILE = path.resolve(__dirname, '../json/posts.json');

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
    const text = content.replace(/^\uFEFF/, '');
    const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
    if (match) {
        const lines = match[1].split(/\r?\n/);
        lines.forEach(function (line) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                let value = line.substring(colonIndex + 1).trim();
                // Handle inline arrays: [tag1, tag2]
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1).split(',').map(function (s) {
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
    return meta;
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
        const meta = parseFrontmatter(content);
        return {
            slug: file.replace(/\.md$/, ''),
            title: meta.title || file.replace(/\.md$/, '').replace(/-/g, ' '),
            date: meta.date || '',
            lastmod: meta.lastmod || '',
            summary: meta.summary || '',
            tags: Array.isArray(meta.tags) ? meta.tags : []
        };
    });

    // Sort by date descending (newest first); 无日期统一排最后
    posts.sort(function (a, b) {
        const da = /^\d{4}-\d{2}-\d{2}/.test(a.date) ? a.date.slice(0, 10) : '';
        const db = /^\d{4}-\d{2}-\d{2}/.test(b.date) ? b.date.slice(0, 10) : '';
        if (da && db) return da < db ? 1 : (da > db ? -1 : 0);
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
    console.log('Generated ' + OUTPUT_FILE + ' with ' + posts.length + ' post(s).');

    // 为每篇文章生成目录式页面 blog/<slug>/index.html(GitHub Pages 静态托管)
    generatePostPages(posts);
}

/**
 * 从 blog/post.html 模板生成每篇文章的目录页。
 * 替换 canonical/og:url 为目录式 URL,其余(渲染逻辑)复用模板。
 */
function generatePostPages(posts) {
    const templatePath = path.resolve(__dirname, '../../blog/post.html');
    if (!fs.existsSync(templatePath)) {
        console.log('blog/post.html template not found. Skipping post page generation.');
        return;
    }
    const template = fs.readFileSync(templatePath, 'utf-8');
    const siteUrl = (process.env.SITE_URL || 'https://dujie-js.github.io').replace(/\/+$/, '');

    posts.forEach(function (post) {
        if (!post.slug) return;
        const slug = post.slug;
        const postUrl = siteUrl + '/blog/' + slug + '/';
        // 替换 canonical 与 og:url(模板中两处 hardcode 的 post.html 地址)
        let page = template
            .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + postUrl + '">')
            .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + postUrl + '">');

        const dir = path.resolve(__dirname, '../../blog', slug);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), page);
        console.log('Generated blog/' + slug + '/index.html');
    });
}

generate();
