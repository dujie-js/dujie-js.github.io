---
title: Claude Code 安装与 cc-switch 踩坑记录
date: 2026-07-16
tags: [Claude Code, 配置, 工具]
summary: 记录一下安装 Claude Code 和用 cc-switch 切换 API 供应商的过程，踩了一些坑，备忘。附配置方案和官方文档链接。
---

# Claude Code 安装与 cc-switch 踩坑记录

最近开始用 Claude Code，记录下安装过程和碰到的坑，顺便说下 cc-switch 怎么用。后面也整理了 settings.json、CLAUDE.md 这些配置项的官方文档链接，方便查。

官方文档入口：[docs.anthropic.com/en/docs/claude-code/overview](https://docs.anthropic.com/en/docs/claude-code/overview)

---

## 安装 Claude Code

Claude Code 有几种安装方式，按系统选一种就行：

### 方式一：原生安装（macOS / Linux 推荐）

一行命令，不需要装 Node.js，自带自动更新：

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

安装到 `~/.local/bin/claude`，自动在后台更新。

### 方式二：Homebrew（macOS / Linux）

没有自动更新，需要手动 `brew upgrade`：

```bash
brew install --cask claude-code
```

### 方式三：npm（Windows 推荐）

Windows 建议用 npm 装，先确保装了 Node.js 22+：

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

安装到 npm 全局目录（一般 `%USERPROFILE%\AppData\Roaming\npm\node_modules`）。

### 验证安装

```bash
claude --version
claude doctor     # 看看各项配置正不正常
```

首次运行 `claude` 会弹浏览器做 OAuth 登录。但我直接用不了 Claude 模型，所以跳过，直接进下一步——配置 cc-switch 来走第三方 API。

---

## cc-switch（切换 API 供应商）

### 为什么需要它

国内没法直接访问 Anthropic API，Claude Code 装好了用不了。好在 DeepSeek 这类国产模型能力也够用，走第三方中转就行。

手动改 `~/.claude/settings.json` 也能用，但要改 API Key、Base URL、模型名，切来切去很烦。**cc-switch** 就是解决这个问题的——GUI 界面管理供应商配置，点一下切换，不用手写配置。

> GitHub: [farion1231/cc-switch](https://github.com/farion1231/cc-switch)

### 安装

- **macOS：** `brew tap farion1231/ccswitch && brew install --cask cc-switch`
- **Windows：** 去 [GitHub Releases](https://github.com/farion1231/cc-switch/releases) 下载 `.msi` 安装包
- **Linux：** 下载 `.deb` 用 `dpkg -i` 装，或者用 AppImage
- **SSH/无桌面环境：** 用命令行版 `npm install -g @thtmf/cc-switch-cli`，`ccs add/switch/list` 操作

### 怎么用

打开主界面点「Add Provider」，选 DeepSeek 预设，填名字和 API Key 保存就行。预设会自动填好 endpoint 和模型映射。

之后在供应商卡片点「启用」或右键系统托盘图标切换，一两秒生效。

模型映射我直接全走 DeepSeek：sonnet/opus 用 v4-pro，haiku 用 v4。日常 v4-pro 完全够用，机械任务切到 v4 省点 token。

---

## 踩坑记录

折腾过程中碰到的几个坑：

1. **`CLAUDE_CODE_ATTRIBUTION_HEADER=0`** — 用第三方中转必须设置这个环境变量，不然 prompt cache 会失效，费用翻好几倍。cc-switch 里可以在供应商配置里加上。

2. **Base URL 末尾别带斜杠** — 填 API 地址时末尾多了个 `/`，请求就 404。

3. **API Key 粘了多余空格** — 从网页复制 Key 有时候会带上换行或空格，先贴到编辑器里检查下。

4. **切完没生效** — Claude Code 热切换是即时的，但 Codex、OpenCode 部分版本要完全退出终端重开才能生效。

5. **模型版本来回切可能报错** — 同个会话里切 DeepSeek 版本可能遇到配置残留问题。切版本前先 `/compact` 压缩上下文或直接开新会话，更干净。

---

## 配置参考

Claude Code 的配置文件分几个地方，搞清楚就行：

**settings.json** — 核心配置文件，分项目级（`.claude/settings.json`）、用户级（`settings.local.json`）、全局级。项目级优先级最高，只写需要覆盖的字段就行。[settings 参考文档](https://docs.anthropic.com/en/docs/claude-code/settings)

**CLAUDE.md** — 放项目根目录，告诉 Claude 项目的技术栈、命令和规范。[CLAUDE.md 说明](https://docs.anthropic.com/en/docs/claude-code/settings#claudemd-files)

**MCP 服务器** — 让 Claude Code 能访问外部工具，在 settings.json 或者项目根目录的 `.mcp.json` 里配。[MCP 文档](https://docs.anthropic.com/en/docs/claude-code/mcp)

**Hooks** — 在 settings.json 里配，可以在 Claude 执行命令前后跑自定义脚本，比如记日志。[Hooks 文档](https://docs.anthropic.com/en/docs/claude-code/settings#hooks)

**环境变量** — `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`（第三方中转用）、`CLAUDE_CODE_ATTRIBUTION_HEADER=0`（第三方 API 必须设）。[环境变量文档](https://docs.anthropic.com/en/docs/claude-code/settings#environment-variables)

**快捷键** — `~/.claude/keybindings.json` 自定义快捷键。[快捷键文档](https://docs.anthropic.com/en/docs/claude-code/keyboard-shortcuts)

---

## 总结

Claude Code 本身够好用，cc-switch 解决了多供应商切换的痛点。主要就三个价值：不用手改配置文件、点一下就能切、MCP 和 CLAUDE.md 这些附带配置也能一起管。
