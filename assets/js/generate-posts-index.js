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
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (match) {
        const lines = match[1].split('\n');
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
            summary: meta.summary || '',
            tags: Array.isArray(meta.tags) ? meta.tags : []
        };
    });

    // Sort by date descending (newest first)
    posts.sort(function (a, b) {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date > a.date ? 1 : b.date < a.date ? -1 : 0;
    });

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write output
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(posts, null, 2));
    console.log('Generated ' + OUTPUT_FILE + ' with ' + posts.length + ' post(s).');
}

generate();
