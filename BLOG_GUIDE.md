# 博客系统使用指南

## 📖 项目概述

这是一个纯静态的个人博客系统，集成在个人主页项目中，支持博客文章管理和分页浏览功能。

### ✨ 功能特性

- ✅ 博客文章列表展示
- ✅ 分页导航（每页5篇文章）
- ✅ 文章详情页面
- ✅ Markdown 格式支持
- ✅ 标签分类展示
- ✅ 响应式设计（支持移动端）
- ✅ 优雅的动画效果
- ✅ 文章搜索和筛选（可扩展）

---

## 📂 文件结构

```
项目根目录/
├── index.html              # 首页
├── blog.html               # 博客列表页
├── post.html               # 文章详情页
├── BLOG_GUIDE.md          # 本使用指南
├── assets/
│   ├── css/
│   │   ├── blog.css       # 博客列表样式
│   │   └── post.css       # 文章详情样式
│   ├── js/
│   │   ├── blog.js        # 博客列表逻辑
│   │   └── post.js        # 文章详情逻辑
│   └── json/
│       └── posts.json     # 博客文章数据
```

---

## 🚀 如何添加新博客文章

### 方法一：直接编辑 JSON 文件（推荐）

1. 打开 `assets/json/posts.json` 文件

2. 在 `posts` 数组中添加新的文章对象：

```json
{
  "id": "post-008",
  "title": "你的文章标题",
  "author": "渡劫",
  "date": "2024-10-23",
  "tags": ["标签1", "标签2"],
  "excerpt": "文章摘要，显示在列表页...",
  "readTime": "5分钟",
  "content": "# 文章标题\n\n这里是文章的完整内容，支持 Markdown 格式...\n\n## 二级标题\n\n段落内容..."
}
```

3. 保存文件，刷新博客页面即可看到新文章

### 字段说明

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `id` | ✅ | 文章唯一标识符 | `"post-008"` |
| `title` | ✅ | 文章标题 | `"JavaScript 入门教程"` |
| `author` | ❌ | 作者名称（默认"DuJie"） | `"渡劫"` |
| `date` | ✅ | 发布日期 | `"2024-10-23"` |
| `tags` | ❌ | 标签数组 | `["JavaScript", "教程"]` |
| `excerpt` | ❌ | 文章摘要（列表页显示） | `"本文介绍 JavaScript 基础..."` |
| `readTime` | ❌ | 预计阅读时间 | `"10分钟"` |
| `content` | ✅ | 文章完整内容（Markdown） | 见下文 |

---

## ✍️ 编写文章内容

### Markdown 语法示例

```markdown
# 一级标题

这是段落内容。

## 二级标题

### 三级标题

**加粗文本** 和 *斜体文本*

- 无序列表项1
- 无序列表项2

1. 有序列表项1
2. 有序列表项2

> 这是引用文本

\```javascript
// 代码块
function hello() {
  console.log('Hello World!');
}
\```

[链接文本](https://example.com)

![图片描述](image-url.jpg)
```

### 内容格式要求

1. **使用 `\n` 表示换行**：
   ```json
   "content": "第一段\n\n第二段"
   ```

2. **代码块使用三个反引号**：
   ```json
   "content": "```javascript\nconst x = 1;\n```"
   ```

3. **转义 JSON 特殊字符**：
   - 双引号：`\"`
   - 反斜杠：`\\`
   - 换行符：`\n`

---

## 🎨 自定义配置

### 修改每页显示文章数

编辑 `assets/js/blog.js`：

```javascript
const POSTS_PER_PAGE = 5; // 改成你想要的数量
```

### 修改颜色主题

编辑 `assets/css/blog.css`，查找渐变色定义：

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

改成你喜欢的颜色。

### 添加代码高亮

在 `post.html` 的 `<head>` 中添加：

```html
<!-- Prism.js 代码高亮 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1/themes/prism-tomorrow.css">
<script src="https://cdn.jsdelivr.net/npm/prismjs@1/prism.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-javascript.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-python.min.js"></script>
```

---

## 📝 文章模板

### 技术文章模板

```json
{
  "id": "post-xxx",
  "title": "技术文章标题",
  "author": "渡劫",
  "date": "2024-10-23",
  "tags": ["技术分类", "具体技术"],
  "excerpt": "简短介绍这篇文章的主要内容，控制在100字以内...",
  "readTime": "10分钟",
  "content": "# 技术文章标题\n\n## 背景介绍\n\n介绍技术背景和问题...\n\n## 解决方案\n\n详细说明解决方案...\n\n```javascript\n// 示例代码\n```\n\n## 总结\n\n总结要点..."
}
```

### 生活随笔模板

```json
{
  "id": "post-xxx",
  "title": "生活随笔标题",
  "author": "渡劫",
  "date": "2024-10-23",
  "tags": ["生活", "随笔"],
  "excerpt": "分享生活中的感悟和思考...",
  "readTime": "3分钟",
  "content": "# 生活随笔标题\n\n今天发生了一件有趣的事...\n\n## 我的感悟\n\n通过这件事，我明白了..."
}
```

---

## 🔍 功能扩展

### 添加搜索功能

在 `blog.html` 添加搜索框：

```html
<div class="search-box">
  <input type="text" id="searchInput" placeholder="搜索文章...">
</div>
```

在 `blog.js` 添加搜索逻辑：

```javascript
function searchPosts(keyword) {
  return allPosts.filter(post => 
    post.title.includes(keyword) || 
    post.excerpt.includes(keyword) ||
    post.tags.some(tag => tag.includes(keyword))
  );
}
```

### 添加标签筛选

在 `blog.js` 添加：

```javascript
function filterByTag(tag) {
  return allPosts.filter(post => post.tags.includes(tag));
}
```

### 添加文章目录

在 `post.js` 的 `renderPost` 函数中：

```javascript
function generateTOC() {
  const headings = document.querySelectorAll('.post-body h2, .post-body h3');
  const toc = [];
  
  headings.forEach((heading, index) => {
    const id = `heading-${index}`;
    heading.id = id;
    toc.push({
      level: heading.tagName,
      text: heading.textContent,
      id: id
    });
  });
  
  return toc;
}
```

---

## 🐛 常见问题

### Q1: 文章不显示怎么办？

**A:** 检查以下几点：
1. `posts.json` 格式是否正确（可用 JSON 验证工具检查）
2. 文件路径是否正确
3. 浏览器控制台是否有错误信息

### Q2: Markdown 不能正确渲染？

**A:** 确保：
1. 已正确引入 `marked.js` 库
2. JSON 中的换行符使用 `\n`
3. 特殊字符已正确转义

### Q3: 如何批量导入文章？

**A:** 可以编写脚本将 Markdown 文件批量转换为 JSON：

```javascript
const fs = require('fs');
const path = require('path');

// 读取 markdown 文件夹
const files = fs.readdirSync('./markdown-posts');

const posts = files.map((file, index) => {
  const content = fs.readFileSync(`./markdown-posts/${file}`, 'utf-8');
  return {
    id: `post-${String(index + 1).padStart(3, '0')}`,
    title: file.replace('.md', ''),
    date: new Date().toISOString().split('T')[0],
    content: content
  };
});

fs.writeFileSync('./posts.json', JSON.stringify({ posts }, null, 2));
```

### Q4: 如何优化加载速度？

**A:** 可以考虑：
1. 只在 JSON 中存储摘要，完整文章用单独文件
2. 使用 CDN 加速静态资源
3. 启用浏览器缓存
4. 图片使用懒加载

---

## 📦 部署到 GitHub Pages

1. 确保所有文件已提交到 Git

2. 推送到 GitHub：
   ```bash
   git add .
   git commit -m "添加博客系统"
   git push origin main
   ```

3. 在 GitHub 仓库设置中启用 GitHub Pages

4. 访问：`https://你的用户名.github.io`

---

## 🎯 最佳实践

1. **定期更新**：保持博客内容的新鲜度
2. **分类明确**：使用清晰的标签分类
3. **摘要精炼**：列表页摘要控制在100字左右
4. **代码规范**：代码示例要有注释说明
5. **图文并茂**：适当添加配图增强可读性
6. **SEO 优化**：文章标题和描述要有关键词

---

## 🤝 贡献指南

如果你想改进这个博客系统，欢迎：

1. Fork 这个项目
2. 创建新的功能分支
3. 提交你的改进
4. 发起 Pull Request

---

## 📄 许可证

本项目遵循原项目许可证。

---

## 🙏 致谢

感谢以下开源项目：
- [Marked.js](https://marked.js.org/) - Markdown 解析器
- GitHub Pages - 免费托管服务
- Bing 壁纸 API - 背景图片服务

---

**祝你写作愉快！** ✨

如有问题，请查看 [Issues](https://github.com/dujie-js/dujie-js.github.io/issues) 或联系作者。

