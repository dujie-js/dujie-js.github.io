---
title: OpenClaw（龙虾）+ DeepSeek WSL 部署配置完整记录
date: 2026-07-12
summary: Windows 11 + WSL2 部署 OpenClaw 并接入 DeepSeek 模型的完整过程，含版本专属报错及解决方案。
tags: [OpenClaw, DeepSeek, AI, WSL, 配置]
---

# OpenClaw（龙虾）+ DeepSeek WSL 部署配置完整记录

OpenClaw 社区叫"小龙虾"（简称龙虾），是一个开源的本地 AI 智能体框架。

部署环境：Windows 11 + WSL2（Ubuntu）

当前 OpenClaw 运行版本：**v1.20.7**

以下所有问题、报错、操作限制均在当前版本原生复现，为该版本专属踩坑解决方案。

> 以下所有 bash 命令均在 WSL 终端内执行，不是在 Windows PowerShell / CMD。

## 一、环境清理与安装

### 1. 彻底清理旧版本

如果之前装过旧版，先清干净：

```bash
# 终止所有运行中的 OpenClaw 进程
pkill -f openclaw

# 卸载全局旧版本
npm uninstall -g openclaw

# 清空用户配置目录
rm -rf ~/.openclaw
```

首次安装跳过这步，直接装就行。

### 2. 安装最新正式版

```bash
npm install -g openclaw@latest
```

## 二、前置校验：DeepSeek API 连通性测试

配置之前先确认 API Key 能不能用，免得配了半天发现是 Key 的问题。

### 1. 获取可用模型列表

```bash
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer sk-你的Key"
```

正常会返回 `deepseek-v4-pro`、`deepseek-v4-flash` 等模型列表。

### 2. 对话接口测试

```bash
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-你的Key" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [{"role": "user", "content": "你好，介绍一下自己"}]
  }'
```

能正常返回对话内容，说明 API 没问题。

## 三、启动网关并进入管理端

### 1. 初始化配置

首次启动需要先初始化：

```bash
openclaw setup
```

这一步只是创建默认目录结构，Provider 还没配，所以后面启动要跳过校验。

### 2. 启动网关

```bash
openclaw gateway run --allow-unconfigured
```

启动成功会输出 `Dashboard URL: http://127.0.0.1:18789/`。

**这个终端窗口要保持运行，不能关。**

### 3. 获取带令牌的访问链接

新开一个终端：

```bash
openclaw dashboard --no-open
```

正常会输出类似 `Dashboard URL: http://127.0.0.1:18789/?token=xxxxxxx` 的链接。

**复制完整链接，不要手动拆分或修改令牌。**

> ⚠️ **实测坑**：有时候这个命令不输出 token，只输出 `http://127.0.0.1:18789/` 后面不带 `?token=`。遇到的话先跑 `openclaw doctor --fix` 再试。还不行就直接浏览器访问那个地址，页面登录框里会显示 token，复制出来拼到 URL 后面（见下方报错汇总问题 3）。

### 4. 进入 Web 管理端

把上一步拿到的完整链接粘贴到浏览器访问，自动携带令牌，跳过登录直接进主界面。

> 接下来配置 DeepSeek 提供商就在这个页面里操作。

## 四、配置 DeepSeek 模型提供商

### 1. 进入配置页面

1. 点击左侧底部齿轮图标【设置】
2. 选择【AI 与代理】标签页
3. 切换二级菜单至【Models】

### 2. 新增 DeepSeek 提供商

点击右下角【+ Add Entry】，按以下参数填写：

| 配置项 | 填写内容 |
|--------|---------|
| Provider ID | `deepseek` |
| Model Provider API Adapter | `openai-completions` |
| Model Provider API Key | `sk-你的Key` |
| Model Provider Auth Mode | `token` |
| Model Provider Base URL | `https://api.deepseek.com/v1` |
| Model Provider Context Tokens | `131072` |
| Model Provider Context Window | `131072` |

填写完依次点 **Save → Apply**。

### 3. 添加具体模型

返回 Models 页面，点击刚创建的 deepseek 提供商，下滑到底部【Model Provider Model List】区域。

**添加 deepseek-v4-pro：**

| 配置项 | 填写内容 |
|--------|---------|
| Id | `deepseek-v4-pro` |
| Name | `DeepSeek V4 Pro` |
| Api | `openai-completions` |
| Context Tokens | `8192` |
| Context Window | `131072` |

**添加 deepseek-v4-flash（可选）：**

| 配置项 | 填写内容 |
|--------|---------|
| Id | `deepseek-v4-flash` |
| Name | `DeepSeek V4 Flash` |
| Api | `openai-completions` |
| Context Tokens | `8192` |
| Context Window | `131072` |

全部添加完后，再次点击 **Save → Apply**。

## 五、验证

1. 回到聊天主界面，下拉框选择 **DeepSeek V4 Pro**
2. 发条消息测试，能正常回复就搞定了

## 六、版本专属报错汇总（v1.20.7）

### 问题 1：Missing config

**现象**：启动网关提示缺少配置文件，无法加载默认配置

**解决**：先执行 `openclaw setup` 初始化，再用 `--allow-unconfigured` 跳过校验启动。

### 问题 2：网关令牌不匹配 / 无法登录

**现象**：网页访问认证失败，提示令牌无效或已失效

**解决**：

```bash
openclaw doctor --fix          # 一键修复
openclaw dashboard --no-open   # 重新获取带令牌链接
```

> 如果 `dashboard --no-open` 不输出 token，参考下方问题 3。

### 问题 3：dashboard --no-open 不输出 token

**现象**：执行 `openclaw dashboard --no-open` 只返回 `http://127.0.0.1:18789/`，后面没有 `?token=xxx`

**解决**：先跑 `openclaw doctor --fix` 修复后再试。如果还是不显示，直接浏览器访问那个地址，页面上的登录框里能看到 token，复制出来手动拼到 URL 后面。

> 这个坑我浪费了很多时间，一直以为是自己哪步配错了，其实是版本问题没输出 token。

### 问题 4：GatewayRequestError: contextTokens: Too small

**现象**：配置提供商后校验失败，提示数值过小

**原因**：该版本默认 contextTokens 为 0，必须手动设置

**解决**：Context Tokens 和 Context Window 统一填 `131072`。

### 问题 5：models.0.name: expected string, received undefined

**现象**：新增模型保存报错

**原因**：该版本强制要求 Name 字段为必填

**解决**：补全模型 Name 字段，不能留空。

### 问题 6：找不到 Add Model 按钮

**现象**：进到提供商配置页，没有模型添加入口

**原因**：必须先保存 Provider 配置才展示模型列表

**解决**：先 Save + Apply 保存提供商，再下滑页面就能看到了。

### 问题 7：Unknown model: openai/deepseek-chat

**现象**：调用模型提示不存在

**解决**：去掉 `openai/` 前缀，适配器选 `openai-completions`，用官方标准模型 ID。

## 七、最后

以上配置过程在 v1.20.7 版本上完整复现，如果版本不同可能有些差异。跑起来之后就可以在本地用 DeepSeek 跑 AI Agent 了。

官方文档：[docs.openclaw.ai](https://docs.openclaw.ai/platforms/windows.md)
