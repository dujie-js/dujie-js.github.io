/**
 * generate-rss-sitemap.js
 *
 * Reads assets/json/posts.json and generates:
 * 1. /feed.xml - RSS 2.0 feed
 * 2. /sitemap.xml - XML sitemap for search engines
 *
 * Usage: node assets/js/generate-rss-sitemap.js
 * Intended to be run via GitHub Actions after generate-posts-index.js
 */

const fs = require('fs');
const path = require('path');

const POSTS_JSON = path.resolve(__dirname, '../json/posts.json');
const OUTPUT_DIR = path.resolve(__dirname, '../../');

const SITE_URL = process.env.SITE_URL || 'https://dujie-js.github.io';
const SITE_TITLE = '渡劫 - DuJie Blog';
const SITE_DESC = '活出自己的人生';

function generate() {
    // Read posts.json
    if (!fs.existsSync(POSTS_JSON)) {
        console.log('No posts.json found. Skipping RSS/sitemap generation.');
        return;
    }

    const posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf-8'));
    if (!Array.isArray(posts)) {
        console.log('Invalid posts.json format. Skipping.');
        return;
    }

    // --- Generate RSS feed ---
    const validPosts = posts.filter(function (post) { return post.slug; });
    const feedItems = validPosts.map(function (post) {
        const slugUrl = encodeURIComponent(post.slug);
        const title = escapeXml(post.title || 'Untitled');
        const summary = escapeXml(post.summary || '');
        const date = post.date || '';
        const dateObj = date ? new Date(date) : null;
        const pubDate = (dateObj && !isNaN(dateObj.getTime())) ? dateObj.toUTCString() : '';
        const tags = Array.isArray(post.tags) ? post.tags : [];
        const categories = tags.map(function (tag) {
            return '      <category>' + escapeXml(tag) + '</category>';
        }).join('\n');

        return [
            '    <item>',
            '      <title>' + title + '</title>',
            '      <link>' + SITE_URL + '/blog/post.html?slug=' + slugUrl + '</link>',
            '      <guid>' + SITE_URL + '/blog/post.html?slug=' + slugUrl + '</guid>',
            '      <description>' + summary + '</description>',
            pubDate ? '      <pubDate>' + pubDate + '</pubDate>' : '',
            categories,
            '    </item>'
        ].filter(Boolean).join('\n');
    });

    const feed = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        '    <title>' + escapeXml(SITE_TITLE) + '</title>',
        '    <link>' + SITE_URL + '</link>',
        '    <description>' + escapeXml(SITE_DESC) + '</description>',
        '    <language>zh-CN</language>',
        '    <atom:link href="' + SITE_URL + '/feed.xml" rel="self" type="application/rss+xml"/>',
        feedItems.join('\n'),
        '  </channel>',
        '</rss>',
        ''
    ].join('\n');

    const feedPath = path.join(OUTPUT_DIR, 'feed.xml');
    fs.writeFileSync(feedPath, feed);
    console.log('Generated ' + feedPath + ' with ' + validPosts.length + ' item(s).');

    // --- Generate sitemap ---
    const staticPages = [
        '/',
        '/blog/',
        '/about/',
        '/resume/resume.pdf'
    ];

    const urls = staticPages.map(function (page) {
        return [
            '  <url>',
            '    <loc>' + SITE_URL + page + '</loc>',
            '    <priority>0.8</priority>',
            '  </url>'
        ].join('\n');
    });

    validPosts.forEach(function (post) {
        let lastmod = '';
        if (post.date) {
            const dateObj = new Date(post.date);
            if (!isNaN(dateObj.getTime())) {
                lastmod = '    <lastmod>' + dateObj.toISOString() + '</lastmod>';
            }
        }
        urls.push([
            '  <url>',
            '    <loc>' + SITE_URL + '/blog/post.html?slug=' + encodeURIComponent(post.slug) + '</loc>',
            lastmod,
            '    <priority>0.6</priority>',
            '  </url>'
        ].filter(Boolean).join('\n'));
    });

    const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        urls.join('\n'),
        '</urlset>',
        ''
    ].join('\n');

    const sitemapPath = path.join(OUTPUT_DIR, 'sitemap.xml');
    fs.writeFileSync(sitemapPath, sitemap);
    console.log('Generated ' + sitemapPath + ' with ' + (staticPages.length + validPosts.length) + ' URL(s).');
}

function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

try {
    generate();
} catch (err) {
    console.error('Failed to generate RSS/sitemap:', err.message);
    process.exit(1);
}
