---
title: Windows Terminal + Oh My Posh + PSReadLine 终端美化
date: 2026-07-16
summary: 从零开始配置 Windows 终端，Oh My Posh 美化 + Nerd Font 图标 + PSReadLine 预测式补全。命令下不动就手动下载。
tags: [Windows, Terminal, OhMyPosh, PSReadLine, 美化]
---

# Windows Terminal + Oh My Posh + PSReadLine 终端美化

这周折腾了下终端，把 PowerShell 从白底蓝字变成了带 git 分支的彩色提示符，输入命令还能自动补全。

记录下步骤，下次重装不用再查一遍。

---

## 环境

- Windows 11 Pro
- 已有 Windows Terminal（系统自带的那个）
- PowerShell 5.1（没升 7）

---

## 1. 装 Oh My Posh

Oh My Posh 就是负责让你的命令行变好看的东西。用 winget 装：

```powershell
winget install "JanDeDobbeleer.OhMyPosh" --source winget
```

如果 winget 下不动，直接去 [GitHub Releases](https://github.com/JanDeDobbeleer/oh-my-posh/releases) 下载 `oh-my-posh-amd64.exe`，重命名成 `oh-my-posh.exe`，扔到 `C:\Users\你的用户名\AppData\Local\Microsoft\WindowsApps\` 里。

装完验证：

```powershell
oh-my-posh --version
# 看到版本号就行，我装的是 29.30.0
```

---

## 2. 装 Nerd Font（这个必须装）

Oh My Posh 的图标都是特殊字符，普通字体显示不出来，装个 Nerd Font 才行。

我选的 **Meslo Nerd Font**，直接去官网下载 zip 包：

> [https://www.nerdfonts.com/font-downloads](https://www.nerdfonts.com/font-downloads)

解压之后全选所有 .ttf 文件，右键点"安装"就行。等几秒钟就装好了。

其他备选字体：JetBrainsMono、CaskaydiaCove（Cascadia Code 魔改版）、FiraCode，官网都有。

---

## 3. Windows Terminal 改字体

打开 Windows Terminal，按 `Ctrl+,` 打开 settings.json，在 `profiles.defaults` 里加一行：

```json
"profiles": {
    "defaults": {
        "font": {
            "face": "MesloLGL Nerd Font"
        }
    },
    "list": []  // 你原来的配置
}
```

我是直接全局默认字体统一改了，省的每个配置单独设。保存，关掉 Terminal 重开，图标应该正常了。

---

## 4. 升级 PSReadLine（自动补全就是它）

PowerShell 自带的 PSReadLine 是 2.0.0，没有预测式补全。需要装新版。

用 PowerShell Gallery 装：

```powershell
Install-PackageProvider -Name NuGet -Force -Scope CurrentUser
Install-Module -Name PSReadLine -Force -Scope CurrentUser -AllowClobber -SkipPublisherCheck
```

如果网不行，手动方案：去 [PSReadLine GitHub Releases](https://github.com/PowerShell/PSReadLine/releases) 下载最新版，解压到 `$HOME\Documents\WindowsPowerShell\Modules\PSReadLine\` 目录下。

验证：

```powershell
Get-Module -Name PSReadLine -ListAvailable | Format-Table Name, Version
```

我装的是 2.4.5，能看到这个版本说明安装成功。

---

## 5. 写 $PROFILE 配置文件

配置文件路径是 `$HOME\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`。新建这个文件，写入：

```powershell
# PSReadLine 自动补全
if (Get-Module -ListAvailable -Name PSReadLine) {
    Import-Module PSReadLine
    Set-PSReadLineOption -PredictionSource History
    Set-PSReadLineOption -PredictionViewStyle InlineView
    Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete
}

# Oh My Posh 加载
if (Get-Command oh-my-posh -ErrorAction SilentlyContinue) {
    oh-my-posh init pwsh --config "https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/main/themes/jandedobbeleer.omp.json" | Invoke-Expression
}
```

关于主题：`jandedobbeleer` 是 Oh My Posh 的默认主题，信息比较全（git 分支、执行时间、上条命令是否报错）。也可以去[官网主题页](https://ohmyposh.dev/docs/themes)预览别的，想换就把 `--config` 后面的 URL 替换掉。

写完之后让配置生效：

```powershell
. $PROFILE
```

或者直接重启 Windows Terminal。

---

## 可能遇到的问题

**图标显示方框/问号：**
字体的名字写错了。去注册表 `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` 里搜一下正确的字体全名，填到 settings.json 里。

**提示 oh-my-posh 找不到命令：**
winget 装完后在 `%LOCALAPPDATA%\Microsoft\WindowsApps\` 目录下，检查下 PATH 里有没有这个路径。

**预测补全的灰色字看不清：**
可以在 $PROFILE 里加一句调颜色：

```powershell
Set-PSReadLineOption -Colors @{ InlinePrediction = "#808080" }
```

---

## 参考

- [Oh My Posh GitHub](https://github.com/JanDeDobbeleer/oh-my-posh)
- [Nerd Fonts 官网](https://www.nerdfonts.com/font-downloads)
- [PSReadLine GitHub](https://github.com/PowerShell/PSReadLine)
