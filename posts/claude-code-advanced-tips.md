---
title: Claude Code 进阶技巧：配置、命令与 Loop Engineering
date: 2026-07-17
summary: 用了 Claude Code 一段时间后，从配置项到隐藏命令，从权限管理到 Loop Engineering，整理一份进阶向的使用技巧清单。
tags: [Claude Code, 工具, 效率, 配置]
---

# Claude Code 进阶技巧：配置、命令与 Loop Engineering

Claude Code 用了有一阵了，整理下自己常用的配置、命令、还有一些进阶玩法。

分五个部分：配置 → 权限模式 → 常用命令说明 → CLI 技巧速查 → Loop Engineering。

---

## Part 1：配置篇 — 把地基打牢

`~/.claude/` 目录分三层，下面把配置相关的要点全标在树里了：

```
~/.claude/
├── 📄 配置文件层（你编辑）
│   ├── settings.json              # 全局用户配置
│   ├── settings.local.json        # 全局私有配置，不进 Git
│   ├── CLAUDE.md                  # 用户级行为指令
│   │
│   └── .claude/                   # 项目级配置
│       ├── settings.json          # 项目配置
│       ├── settings.local.json    # 项目私有配置
│       ├── CLAUDE.md              # 项目级指令
│       └── CLAUDE.local.md        # 项目私有指令
├── 🧩 能力扩展层（你增删）
│   ├── agents/                    # 子代理
│   ├── skills/                    # 技能
│   └── plugins/                   # 插件
│
└── 💾 运行时数据（Claude 自动生成）
    ├── projects/  sessions/
    ├── tasks/  jobs/  plans/
    └── cache/  backups/
```

配置优先级：**项目 local > 项目 json > 用户 local > 用户 json**。CLAUDE.md 三层依次拼接，不是覆盖。

---

## Part 2：权限与模式 — 告别反复确认

Claude Code 默认对几乎每条命令都弹确认框，用久了挺烦的。两种办法解决。

### 方式一：配置权限白名单

在 `settings.json` 里扔一段白名单，匹配的命令自动放行：

```json
{
  "permissions": {
    "allow": [
      "Bash(git status)",      // 精确匹配
      "Bash(git log *)",       // 通配符
      "Bash(mvn *)",           // 所有 mvn 命令
      "Bash(**)"               // 所有 Bash 免确认（高风险）
    ]
  }
}
```

**偷懒方式：** 跑一次 `/fewer-permission-prompts`，它会翻历史会话里你之前允许过的操作，自动写进 `.claude/settings.json`，不用手写。

### 方式二：Shift+Tab 切换工作模式

不用改配置文件，运行时随时切。四种模式的区别：

| 模式 | 能做什么 | 需要确认 | 适合场景 |
|------|---------|---------|---------|
| Default | 读文件 | 写文件、跑命令 | 初次使用或敏感操作 |
| **Accept Edits** | 读文件、写文件 | Bash 命令 | 快速迭代代码，你在旁边看着 |
| **Plan Mode** | 只读代码、只出方案 | 不执行修改 | 先对齐思路再动手 |
| **Auto mode** | 读/写/跑，大部分免确认 | 高风险操作 | 让 Claude 自己跑长任务 |

**我的用法：** Plan 出方案 → Accept Edits 改代码 → Default 做高风险操作 → Auto 丢长任务。

---

## Part 3：常用命令说明

我常用的命令分四类，挨个说。

### 3.1 代码审查套件

三个带"review"但关注点完全不同：

| 命令 | 目标 | 审查维度 | 改代码？ |
|------|------|---------|---------|
| `/simplify` | 清理代码质量 | 复用性、简化性、性能、工程质量 | ✅ 直接改 |
| `/code-review` | 找 bug | 逐行扫描、删除审计、调用链、复用、简化、性能、工程质量、规范 | ❌ 默认不改，加 `--fix` 改 |
| `/review` | GitHub PR 审查 | 指定 PR/MR 整体审查 | ❌ 只读 |

前 3 个维度偏 bug 审查，后 5 个偏工程质量。

```bash
# 搭配流程
/simplify    # 写完先清代码质量
/code-review # 再审 bug 和回归风险
/review [PR] # 上线前终审
```

### 3.2 会话管理

| 命令 | 作用 | 备注 |
|------|------|------|
| `/clear` | 清除上下文，开新话题 | 同项目切任务比重开终端快 |
| `/compact` | 压缩上下文，省 token | 建议每 5-8 轮做一次，别等 20 轮 |
| `/rewind` | 代码或对话回退 | 双击 Esc 触发，具体选项见下 |
| `/branch` | 从当前时刻分叉新会话线 | 分的是会话上下文，不是 git branch |
| `/export` | 导出对话为 Markdown | 存档或复制到别处用 |
| `/rename` | 给会话命名 | 配着 /resume 用，不然只能靠时间猜 |

`/rewind` 的菜单选项：

| 选项 | 效果 |
|------|------|
| Restore code and conversation | 代码和对话都回退 |
| Restore conversation | 回退对话但保留已改代码 |
| **Restore code**（最常用） | 回退代码但保留对话——Claude 知道这条路不通，直接换方向 |
| Summarize from here | 压缩该点之后的对话 |
| Summarize up to here | 压缩该点之前的对话 |

### 3.3 辅助利器

| 命令 | 作用 | 备注 |
|------|------|------|
| `/btw` | 旁路提问，不污染上下文 | 不中断当前任务，回答后按空格消除 |
| `/fast` | Opus 加速输出 | 再按一次关闭 |
| `/cost` | 查看 token 消耗 | 含输入/输出/缓存命中明细 |
| `/resume` | 恢复历史会话 | 配合 /rename 用 |
| `/init` | 自动生成 CLAUDE.md | 新项目跑一次 |
| `/config` | 打开配置界面 | 不用手写 JSON |

`/btw` 示例：

```bash
# Claude 正在重构一个大模块，中途你想查个东西
/btw 测试文件在哪个目录？
```

### 3.4 自动化循环

三个命令负责"让 Claude 持续工作，而不是每步等人"：

| 命令 | 作用 | 适合场景 |
|------|------|---------|
| `/goal` | 设置完成条件，持续执行直到满足 | 测试通过、编译通过、checkstyle 通过 |
| `/loop` | 按时间间隔重复执行 prompt | 定时检查外部状态——等 CI、看日志 |
| `/workflows` | 多 Agent Workflow 编排 | 全项目审查、多模块迁移、方案设计 |

详见 **Part 5：Loop Engineering**，里面有完整的命令详解和选择建议。

---

## Part 4：CLI 技巧与速查

### 4.1 启动方式与一次性命令

```bash
# 一次性命令，不进入交互式会话
claude -p "解释一下这个函数的作用"
claude -p --model opus "列出所有 TODO 注释"
```

其他常用启动参数：

| 参数 | 作用 |
|------|------|
| `-c` / `--continue` | 继续最近的会话 |
| `-r` / `--resume` | 恢复指定会话 |
| `--model` | 指定模型 |
| `--permission-mode` | 指定模式启动 |
| `--bg` | 后台跑任务，立即返回 |
| `--dangerously-skip-permissions` | 跳过所有权限检查（适合 sandbox） |
| `--safe-mode` | 禁用所有自定义项，排障用 |
| `--add-dir` | 添加额外工作目录 |

### 4.2 终端小技巧

#### Ctrl+Z 挂起

想临时处理终端操作，不需要退出会话：

```bash
# 在 Claude Code 会话中按 Ctrl+Z 挂起
# 执行终端操作
git status
git commit -m "xxx"

# fg 回到 Claude Code，会话状态完整保留
fg
```

#### ! command — 行内执行

在 Claude Code 会话中，以 `!` 开头的行会被直接当作 shell 命令执行，输出会进入上下文。适合快速查文件、看日志：

```bash
! ls src/
! cat package.json | jq '.scripts'
! git log --oneline -5
```

相比 Ctrl+Z 挂起的优势在于：命令输出直接喂给 Claude，不需要手动复制粘贴。

### 4.3 快捷键一览

| 快捷键 | 作用 |
|--------|------|
| Ctrl+V | 直接粘贴截图 |
| Ctrl+J / Option+Enter | 输入框换行 |
| Ctrl+R | 搜索 prompt 历史 |
| Esc Esc | 触发 /rewind |
| Ctrl+G | 在编辑器中编辑输入 |
| Shift+Tab | 切换工作模式（详见 Part 2） |

### 4.4 命令速查总表

| 命令 | 分类 | 一句话作用 | 参考 |
|------|------|-----------|------|
| `/clear` | 会话管理 | 清除上下文，开新话题 | 3.2 |
| `/compact` | 会话管理 | 压缩上下文，省 token | 3.2 |
| `/rewind` | 会话管理 | 代码或对话回退 | 3.2 |
| `/branch` | 会话管理 | 对话分叉 | 3.2 |
| `/export` | 会话管理 | 导出对话为 Markdown | 3.2 |
| `/rename` | 会话管理 | 会话重命名 | 3.2 |
| `/simplify` | 代码审查 | 四合一代码质量清理 | 3.1 |
| `/code-review` | 代码审查 | 逐行 diff 全面 bug 审查 | 3.1 |
| `/review` | 代码审查 | GitHub PR 审查 | 3.1 |
| `/btw` | 辅助 | 不污染上下文的旁路提问 | 3.3 |
| `/fast` | 辅助 | Opus 加速输出 | 3.3 |
| `/cost` | 辅助 | 查看 token 消耗 | 3.3 |
| `/resume` | 辅助 | 恢复历史会话 | 3.3 |
| `/init` | 辅助 | 自动生成 CLAUDE.md | 3.3 |
| `/config` | 辅助 | 打开配置界面 | 3.3 |
| `/goal` | 自动化 | 设置完成条件，持续执行 | 3.4 / Part 5 |
| `/loop` | 自动化 | 按时间间隔重复 | 3.4 / Part 5 |
| `/workflows` | 自动化 | 多 Agent 工作流 | 3.4 / Part 5 |
| `! command` | CLI | 行内执行 shell 命令 | 4.2 |
| `-p` flag | CLI | 一次性命令 | 4.1 |

---

## Part 5：Loop Engineering — 循环逼近的 Agent 实践

前面讲的配置、权限、命令，解决的都是"单次任务怎么做得更好"。

但 Claude Code 还能干一件事：把任务设计成自动推进的循环，人不用一直在中间手推——这就是 **Loop Engineering**。

### 什么是 Loop Engineering

传统模式：

```
我提需求 → Claude 执行一次 → 我看结果 → 我再补一句 → Claude 再执行一次
```

人一直在中间手动驱动：下一步做什么、什么时候停、怎么验证、失败了怎么改。

Loop Engineering 反过来：

```
人设计一个 loop → loop 驱动 Agent 持续执行、检查、修正 → 直到达到目标
```

从"写 prompt"升级到"设计工作流闭环"。一个好的 loop 包含：

```
目标：要完成什么
上下文：参考哪些代码、文档、规范
动作：Claude 要做哪些事
验证：怎么判断做对了
停止条件：什么时候结束
```

比如，不再只说"帮我修一下这个 bug"，而是设计成：

```
持续修复 user-service 模块，直到所有测试通过；
每次失败都分析失败原因，只修改必要的代码；
如果 10 轮后仍未完成，停止并总结阻塞点。
```

### Claude Code 里的 Loop 能力

Claude Code 中和 Loop Engineering 最直接相关的三个命令：

#### /goal — 持续朝目标工作

设置一个"完成条件"，Claude 每轮结束后检查是否达成，未达成继续下一轮。

**建议实践方式：** 先和 AI 把需求聊清楚，沉淀出完整 plan（需求目标、改动范围、边界场景、验收标准），再用 `/goal` 进入开发 → 测试 → review 的闭环。不建议一上来就 `/goal 帮我实现需求`。

#### /loop — 按时间间隔重复

适合"外部状态会变化"的任务：定时检查应用日志是否还有错误、持续观察接口错误率、消息积压等。

#### /workflows — 多 Agent 编排

适合全项目 API 审查、多模块迁移、大规模代码异味扫描、复杂方案设计（多 Agent 分别出方案再汇总）、技术调研（多来源搜索+交叉验证）。

**创建方式：**

1. 在 prompt 中声明 `ultracode`，或
2. 开启 `/effort ultracode`，让 Claude 自动判断是否生成 workflow

执行中用 `/workflows` 管理：

| 操作 | 作用 |
|------|------|
| Enter | 进入 workflow 或 Agent 详情 |
| p | 暂停/恢复 |
| x | 停止 workflow 或某个 Agent |
| r | 重启某个 Agent |
| s | 保存为可复用命令 |

**注意：** workflow 执行比较耗 token 且慢，非特别复杂的任务尽量不选。

### 如何选择

| 任务类型 | 推荐 | 例子 |
|---------|------|------|
| 有明确完成条件 | `/goal` | 单测通过、编译通过、接口契约不变 |
| 需要定时检查外部状态 | `/loop` | 等 CI、等部署、看消息积压 |
| 范围大，需要多 Agent 并行 | `/workflows` | 全项目审查、多模块迁移、技术调研 |
| 只是问一个问题 | 普通 prompt | 解释代码、查配置、总结文件 |

---

## 参考资源

- [Claude Code 官方文档](https://code.claude.com/docs/en/settings)
- [Claude Code 权限模式](https://code.claude.com/docs/en/permission-modes)
- [Claude Code CLI 参考](https://code.claude.com/docs/en/cli-reference)
- [Claude Code Commands](https://code.claude.com/docs/en/commands)
- [Claude Code Goals](https://code.claude.com/docs/en/goal)
- [Claude Code Dynamic Workflows](https://code.claude.com/docs/en/workflows)
- [Loop Engineering - Addy Osmani](https://addyosmani.com/blog/loop-engineering/)
