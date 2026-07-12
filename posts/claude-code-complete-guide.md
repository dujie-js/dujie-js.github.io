---
title: Claude Code 安装与 cc-switch 踩坑记录
date: 2026-07-11
summary: 记录一下安装 Claude Code 和用 cc-switch 切换 API 供应商的过程，踩了一些坑，备忘。附配置方案和官方文档链接。
tags: [Claude Code, 配置, 工具]
---

# Claude Code 安装与 cc-switch 踩坑记录

最近开始用 Claude Code，记录下安装过程和碰到的坑，顺便说下 cc-switch 怎么用。后面也整理了 settings.json、CLAUDE.md 这些配置项的官方文档链接，方便查。

官方文档入口：[docs.anthropic.com/en/docs/claude-code/overview](https://docs.anthropic.com/en/docs/claude-code/overview)

## 安装 Claude Code

Claude Code 有几种安装方式，选一种就行：

### 方式一：原生安装（推荐）

macOS / Linux 一行命令，不需要装 Node.js，自带自动更新：

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Windows 先装 Node.js 22+，然后 npm 装：

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

安装后目录在 `%LOCALAPPDATA%\claude`，自动后台更新。

### 方式二：Homebrew

macOS / Linux，没有自动更新，需要手动 `brew upgrade`：

```bash
brew install --cask claude-code
```

### 方式三：npm（仅 Windows 推荐）

macOS / Linux 官方已不推荐 npm 方式，但 **Windows 下 npm 最稳定**，需要 Node.js 18+：

```bash
npm install -g @anthropic-ai/claude-code
```

### 验证安装

```bash
claude --version
claude doctor     # 看看各项配置正不正常
```

首次运行 `claude` 会弹浏览器做 OAuth 登录。但我直接用不了 Claude 模型，所以跳过，直接进下一步——配置 cc-switch 来走第三方 API。

## 怎么切 API 供应商？

问题是国内没法直接访问 Anthropic API，Claude Code 装好了用不了。需要走第三方中转或者用国产模型（DeepSeek、智谱这些）来替代。每次手动改 `~/.claude/settings.json` 切配置太烦了，然后发现了 **cc-switch**。

> GitHub: [farion1231/cc-switch](https://github.com/farion1231/cc-switch)

## cc-switch 安装

macOS 直接 brew：

```bash
brew tap farion1231/ccswitch
brew install --cask cc-switch
```

Windows 下个 `.msi` 装上就行，Linux 用 `dpkg -i` 或者 AppImage。

## cc-switch 实际能干什么

用了几天，对我来说核心就几个场景：

**1. 一键切供应商**

内置了 50 多个供应商预设（DeepSeek、智谱、MiniMax、Kimi、火山引擎、SiliconFlow 等等），填个 API Key 就能用。主界面点一下「启用」就切过去了，或者在系统托盘右键直接切。Claude Code v2.0.69 以上支持热切换，不用重启终端。

**2. MCP 服务器统一管**

我有好几个 AI CLI 工具（Claude Code、Codex、Gemini CLI），每个都要配 MCP，在 cc-switch 里一个地方改完就全同步了。

**3. 切换 CLAUDE.md**

有时候不同的供应商适合不同的系统提示词，可以在 cc-switch 里建多个 prompt 预设，切换的时候自动把对应的 `CLAUDE.md` 换过去。而且切换前会自动保存当前文件，不怕丢。

**4. 用量和花费**

Token 消耗、请求次数、花了多少钱，这些都能看到。对不同供应商的计价不一样也支持自定义价格。

## 配置参考和官方文档

Claude Code 的配置文件在几个地方，搞清楚就行。官方文档链接直接附上，不用到处搜。

**settings.json** — 核心配置文件，分项目级（`.claude/settings.json`）、用户级（`settings.local.json`）、全局级。项目级优先级最高，只写需要覆盖的字段就行。[settings 参考文档](https://docs.anthropic.com/en/docs/claude-code/settings)

**CLAUDE.md** — 放项目根目录，告诉 Claude 项目的技术栈、命令和规范。[CLAUDE.md 说明](https://docs.anthropic.com/en/docs/claude-code/settings#claudemd-files)

**MCP 服务器** — 让 Claude Code 能访问外部工具，在 settings.json 或者项目根目录的 `.mcp.json` 里配。[MCP 文档](https://docs.anthropic.com/en/docs/claude-code/mcp)

**Hooks** — 在 settings.json 里配，可以在 Claude 执行命令前后跑自定义脚本，比如记日志。[Hooks 文档](https://docs.anthropic.com/en/docs/claude-code/settings#hooks)

**环境变量** — `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`（第三方中转用）、`CLAUDE_CODE_ATTRIBUTION_HEADER=0`（第三方 API 必须设）。[环境变量文档](https://docs.anthropic.com/en/docs/claude-code/settings#environment-variables)

**快捷键** — `~/.claude/keybindings.json` 自定义快捷键。[快捷键文档](https://docs.anthropic.com/en/docs/claude-code/keyboard-shortcuts)

## 踩坑记录

折腾过程中碰到的几个坑：

1. **`CLAUDE_CODE_ATTRIBUTION_HEADER=0`** — 用第三方中转必须设置这个，不然 prompt cache 会失效，费用直接翻好几倍。cc-switch 里可以在供应商配置里加上这个环境变量。

2. **Base URL 末尾的斜杠** — 填 API 地址时末尾别带 `/`，不然请求会 404。

3. **API Key 别粘多余空格** — 从网页复制 Key 的时候有时候会带上换行或空格，先贴到编辑器里检查下。

4. **切完没生效** — Claude Code 热切换是即时的，但 Codex、OpenCode 部分版本要完全退出终端重开才行。

5. **跳过引导** — 如果用第三方 API，Claude Code 第一次启动会弹登录引导，在 cc-switch 设置里打开「跳过初次安装确认」就好了。

## 总结

Claude Code 本身够好用，cc-switch 解决了多供应商切换的痛点。
