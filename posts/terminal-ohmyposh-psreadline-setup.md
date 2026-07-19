---
title: Windows Terminal + Oh My Posh + PSReadLine 终端美化
date: 2026-07-16
lastmod: 2026-07-19
summary: 从零开始配置 Windows 终端，Oh My Posh 美化 + PSReadLine 预测式补全。避开 Nerd Font 字体问题，用纯文本主题也能很清爽。
tags: [Windows, Terminal, OhMyPosh, PSReadLine, 美化]
---

# Windows Terminal + Oh My Posh + PSReadLine 终端美化

这周折腾了下终端，把 PowerShell 从白底蓝字变成了带 git 分支的彩色提示符，输入命令还能自动补全。

记录下步骤，下次重装不用再查一遍。

---

## 环境

- Windows 11 Pro（自带 Windows Terminal）
- 以下基于 **PowerShell 7**，PowerShell 5.1 同理但 `$PROFILE` 路径不同

---

## 1. 装 PowerShell 7

和系统自带的 5.1 互不干扰，用 winget 装 MSI 版：

```powershell
winget install "Microsoft.PowerShell" --source winget
```

装完运行 `pwsh` 进入 PS7。winget 下不动的话，去 [GitHub Releases](https://github.com/PowerShell/PowerShell/releases) 下载 `PowerShell-7.x.x-win-x64.msi`。

> Microsoft Store 版装在受保护的 WindowsApps 目录下，后续取主题文件不方便，建议 MSI 版。

---

## 2. 装 Oh My Posh

```powershell
winget install "JanDeDobbeleer.OhMyPosh" --source winget
```

winget 下不动的话，去 [GitHub Releases](https://github.com/JanDeDobbeleer/oh-my-posh/releases) 下载 `oh-my-posh-amd64.exe`，重命名成 `oh-my-posh.exe`，扔到 `C:\Users\你的用户名\AppData\Local\Microsoft\WindowsApps\` 里。

验证：

```powershell
oh-my-posh --version
# 我装的是 29.31.1
```

---

## 3. 装 PSReadLine（自动补全）

PS7 自带新版 PSReadLine，PS5.1 自带的是 2.0.0（无预测式补全）。检查当前版本：

```powershell
Get-Module -Name PSReadLine -ListAvailable | Format-Table Name, Version
```

低于 2.2.0 或没装的话，用 PowerShell Gallery 装：

```powershell
Install-PackageProvider -Name NuGet -Force -Scope CurrentUser
Install-Module -Name PSReadLine -Force -Scope CurrentUser -AllowClobber -SkipPublisherCheck
```

我装的是 **2.4.5**。

网不行就手动下载 [PSReadLine Releases](https://github.com/PowerShell/PSReadLine/releases)，解压到 `$HOME\Documents\WindowsPowerShell\Modules\PSReadLine\`（PS5.1 用）。PS7 自带 PSReadLine，不需要手动装。

---

## 4. 配 $PROFILE

PS7 和 PS5.1 的配置路径不同，可以共用一套配置，也可以各配各的。我在 **PS7 上加载 Oh My Posh**，PS5.1 保持极简。

| 版本 | $PROFILE 路径 |
|---|---|
| PowerShell 7 | `$HOME\Documents\PowerShell\Microsoft.PowerShell_profile.ps1` |
| PowerShell 5.1 | `$HOME\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1` |

### PowerShell 7（主力终端）

```powershell
# --- Oh My Posh 主题 ---
oh-my-posh init pwsh --config "$PSScriptRoot\minimal.omp.json" | Invoke-Expression

# --- PSReadLine 自动补全 ---
if (Get-Module -ListAvailable -Name PSReadLine) {
    Import-Module PSReadLine
    if ((Get-Module PSReadLine).Version -ge [Version]'2.2.0') {
        Set-PSReadLineOption -PredictionSource History
        Set-PSReadLineOption -PredictionViewStyle InlineView
    }
    Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete
}
```

### PowerShell 5.1（备用终端）

```powershell
# --- PSReadLine 自动补全（同上）---
if (Get-Module -ListAvailable -Name PSReadLine) {
    Import-Module PSReadLine
    if ((Get-Module PSReadLine).Version -ge [Version]'2.2.0') {
        Set-PSReadLineOption -PredictionSource History
        Set-PSReadLineOption -PredictionViewStyle InlineView
    }
    Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete
}

# --- 极简提示符（不加载 Oh My Posh）---
function prompt { "> " }
```

配置写完执行 `. $PROFILE` 或重启 Terminal 生效。

---

## 5. 选主题

去 [官网主题页](https://ohmyposh.dev/docs/themes) 预览，挑一个喜欢的。自带主题在 Oh My Posh 安装目录的 `themes\` 下，复制到 `$PROFILE` 同目录便可稳定引用。

我用的是自写的极简主题，**不需要 Nerd Font**，任何字体都能正常显示。在 `$PROFILE` 同目录新建 `minimal.omp.json`，写入以下内容：

```json
{
  "$schema": "https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/main/themes/schema.json",
  "version": 4,
  "final_space": true,
  "console_title_template": "{{ .Folder }}",
  "blocks": [
    {
      "type": "prompt",
      "alignment": "left",
      "segments": [
        {
          "type": "path",
          "style": "plain",
          "foreground": "#84a0c6",
          "template": " ~ {{ .Path }} ",
          "properties": {
            "style": "agnoster_short"
          }
        },
        {
          "type": "git",
          "style": "plain",
          "foreground": "#7ec8a3",
          "template": "({{ .HEAD }}{{ if .Working.Changed }}*{{ end }}) ",
          "properties": {
            "branch_icon": "",
            "fetch_status": true,
            "fetch_upstream_icon": false
          }
        }
      ]
    },
    {
      "type": "prompt",
      "alignment": "left",
      "segments": [
        {
          "type": "text",
          "style": "plain",
          "foreground": "#4cc9f0",
          "template": "> "
        }
      ]
    }
  ]
}
```

效果：

```
 ~/some/path (main*)    ← 目录 + Git 分支
>                        ← 干净的提示符
```

从自带主题里挑了别的，用相同方式引用到 `$PROFILE` 即可。

---

## 6.（选做）Nerd Font

**只有用带图标的主题才需要。** 用了上面的 minimal 主题则跳过。

官网下载 zip 包：[https://www.nerdfonts.com/font-downloads](https://www.nerdfonts.com/font-downloads)，我选的 **Meslo Nerd Font**。

**安装注意：** 右键 .ttf → "安装" 是当前用户安装（`%LOCALAPPDATA%\Microsoft\Windows\Fonts\`），Windows Terminal 可能识别不到。建议全选 .ttf 后右键选"为所有用户安装"，或管理员运行 `Install.ps1`。

装完在 Terminal 设置（`Ctrl+,`）→ 配置文件 → 默认值 → 外观，字体改成 `MesloLGL Nerd Font`。方框/问号说明字体没生效。

---

## 7. 最终效果

终端看起来是这样的：

- 左侧 prompt：当前目录路径 + git 分支信息（有变更显示 `*`）
- 第二行：干净的 `>` 提示符
- 命令执行时：Tab 键弹出补全菜单，灰色文字预测历史命令
- 0 配置：PS5.1 备用终端也带了自动补全

---

## 8. 清理冗余

升级后旧文件可能残留，检查后手动清除：

```powershell
# Oh My Posh 多版本
Get-ChildItem "$env:ProgramFiles\WindowsApps\ohmyposh.cli_*" -Directory
# Remove-Item "路径\旧版本目录" -Recurse

# PSReadLine 内置版与用户版重复
Get-Module -Name PSReadLine -ListAvailable | Format-Table Version, ModuleBase
# 版本相同则删用户版：Remove-Item "$HOME\Documents\PowerShell\Modules\PSReadLine" -Recurse -Force

# Nerd Font 装多套
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Fonts\*Nerd*" | Select-Object Name
```

---

## 可能遇到的问题

**图标显示方框/问号：** 字体没对上。检查 Terminal 设置的字体名是否和已安装的 Nerd Font 一致。或者换 minimal 主题。

**oh-my-posh 找不到命令：** winget 装完别名在 `%LOCALAPPDATA%\Microsoft\WindowsApps\`，检查 PATH。

**升级后版本没变：** winget 装了新版但别名没更新，重启 Terminal。

**预测补全灰色字看不清：** `$PROFILE` 里加 `Set-PSReadLineOption -Colors @{ InlinePrediction = "#808080" }`。

**PS7 启动慢：** Oh My Posh 首次加载稍慢正常。在意的话把 `oh-my-posh init pwsh` 的输出预存成 .ps1，`$PROFILE` 里直接 dot-source。

---

## 参考

- [Oh My Posh GitHub](https://github.com/JanDeDobbeleer/oh-my-posh)
- [Oh My Posh 主题预览](https://ohmyposh.dev/docs/themes)
- [Nerd Fonts 官网](https://www.nerdfonts.com/font-downloads)
- [PSReadLine GitHub](https://github.com/PowerShell/PSReadLine)
