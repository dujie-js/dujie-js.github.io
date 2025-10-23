### 个人主页

>这是我的个人主页，集成了博客系统。

## ✨ 功能特性

- 🏠 **个人主页**：展示个人信息、社交链接
- 📝 **博客系统**：支持文章发布、分页浏览
- 🎨 **精美设计**：响应式布局、动画效果
- 🖼️ **Bing 壁纸**：每日自动更新背景图
- 💬 **一言集成**：动态显示诗词格言

## 📂 项目结构

```
├── index.html          # 主页
├── blog.html          # 博客列表页
├── post.html          # 文章详情页
├── assets/
│   ├── css/           # 样式文件
│   ├── js/            # JavaScript 文件
│   ├── json/          # 数据文件（博客文章）
│   ├── img/           # 图片资源
│   └── fonts/         # 字体文件
└── BLOG_GUIDE.md      # 博客使用指南
```

## 🚀 博客系统使用

### 快速开始

1. **添加文章**：编辑 `assets/json/posts.json`
2. **文章格式**：支持 Markdown 语法
3. **自动分页**：每页显示5篇文章
4. **详细说明**：查看 [BLOG_GUIDE.md](./BLOG_GUIDE.md)

### 添加新文章示例

```json
{
  "id": "post-008",
  "title": "我的新文章",
  "author": "渡劫",
  "date": "2024-10-23",
  "tags": ["技术", "分享"],
  "excerpt": "文章摘要...",
  "readTime": "5分钟",
  "content": "# 文章标题\n\n文章内容（Markdown 格式）..."
}
```

## 🛠️ 技术栈

- **前端**：纯 HTML + CSS + JavaScript
- **博客引擎**：Marked.js（Markdown 解析）
- **部署**：GitHub Pages
- **CI/CD**：GitHub Actions

## 📝 更新日志

### v1.0.5 (2024-10-23)
- ✅ 新增博客系统
- ✅ 支持文章分页浏览
- ✅ Markdown 格式支持
- ✅ 响应式设计优化

### v1.0.0
- ✅ 个人主页上线
- ✅ Bing 壁纸集成
- ✅ 一言 API 集成

## 📖 使用指南

详细的博客系统使用指南请查看：[BLOG_GUIDE.md](./BLOG_GUIDE.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

DuJie License
