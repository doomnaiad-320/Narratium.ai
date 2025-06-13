# Narratium

> **世界很大，幻想先行**

![Narratium.ai](https://socialify.git.ci/Narratium/Narratium.ai/image?custom_description=Next+Vscode+in+AI+Role+Play&description=1&font=Rokkitt&forks=1&language=1&logo=https%3A%2F%2Fraw.githubusercontent.com%2FNarratium%2FResource%2Fmain%2Flogo.svg&name=1&owner=1&pattern=Circuit+Board&stargazers=1&theme=Dark)

![GitHub stars](https://img.shields.io/github/stars/Narratium/Narratium.ai?style=social)
![GitHub commits](https://img.shields.io/github/commit-activity/m/Narratium/Narratium.ai)
![GitHub Downloads](https://img.shields.io/github/downloads/Narratium/Narratium.ai/total)

## Quick Access

- 🔗 [Live Demo](https://narratium.org)
- 📖 [DeepWiki Documentation](https://deepwiki.com/Narratium/Narratium.ai/)
- ⭐ [Give us a Star!](https://github.com/Narratium/Narratium.ai/stargazers)
- 💾 [Download](https://github.com/Narratium/Narratium.ai/releases)

**Narratium** 是一个自由创造和冒险的故事宇宙，致力打造 AI Role Play 领域的 vscode；在这里，你的想象力将创造出前所未有的个人化冒险。无论是突破次元的情感共鸣、极地世界的生存挑战还是历史王朝的风起云涌，Narratium.ai 都将随你的每一个选择而演变，编织出独一无二的传奇故事 

## 产品概述

Narratium 目标打造一套轻量化故事引擎，结合上下文压缩、记忆系统、图结构知识检索（Graph-RAG），支持在长篇故事中保持角色一致性和世界逻辑连续性，显著提升 AI 生成故事的沉浸感和连贯性。

## 页面预览

<div align="center">
  <table>
    <tr>
      <td align="center" style="padding: 10px;">
        <img src="public/show_1.png" width="300" alt="screenshot 1" style="border: 2px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
        <br/><em>主界面</em>
      </td>
      <td align="center" style="padding: 10px;">
        <img src="public/show_2.png" width="300" alt="screenshot 2" style="border: 2px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
        <br/><em>角色卡</em>
      </td>
      <td align="center" style="padding: 10px;">
        <img src="public/show_3.png" width="300" alt="screenshot 3" style="border: 2px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
        <br/><em>对话界面</em>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 10px;">
        <img src="public/show_4.png" width="300" alt="screenshot 4" style="border: 2px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
        <br/><em>世界书编辑</em>
      </td>
      <td align="center" style="padding: 10px;">
        <img src="public/show_5.png" width="300" alt="screenshot 5" style="border: 2px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
        <br/><em>剧情分支</em>
      </td>
      <td align="center" style="padding: 10px;">
        <img src="public/show_6.png" width="300" alt="screenshot 5" style="border: 2px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
        <br/><em>正则化编辑</em>
      </td>
    </tr>
  </table>
</div>

## 当前功能

- 🎭 **沉浸式冒险模式**: 创建个性化世界，做出重要决策。
- 🧠 **可视化记忆管理**: 基于 React Flow 的会话追踪和分支管理。
- 🧾 **角色卡与世界观**: 兼容 SillyTavern 角色卡，一站式管理所有内容。

## 目标规划

Narratium 正处于快速迭代阶段，当前已实现以下功能：

* ✅ 支持 SillyTavern 角色卡导入与兼容
* ✅ 角色卡中心化管理、角色状态上下文整合
* ✅ 世界书 + 正则化表达兼容
* ✅ 多模型支持（OpenAI / Ollama）
* ✅ 高效记忆管理（React Flow 流程图式 Session）

下一步规划

* 🚧 **自动化角色卡生成器**

  计划构建角色卡智能生成器，基于用户输入的世界观、角色描述，自动生成符合 SillyTavern 格式的角色卡，降低创作门槛。

* 🚧 **基于 IndexedDB 的本地数据自动化管理**

  支持自动化 RAG（基于上下文知识检索增强）功能，提升 AI 叙事的知识连续性。

* 🚧 **宏大叙事支持**

  支持宏大叙事，构建如《巫师》、《龙族》等世界关故事，让玩家拥有绝对真实的故事体验。

* 🚧 **开放角色/故事分享社区**

  支持用户上传、分享、讨论角色卡与故事剧本，构建开放的内容创作与分享社区。

## 快速开始

### 克隆项目

```bash
git clone https://github.com/Narratium/Narratium.ai.git
cd Narratium
```

### 安装依赖

```bash
pnpm install
```

### 运行项目

```bash
pnpm run dev
```

访问：[http://localhost:3000](http://localhost:3000)

### 自己打包

```bash
npm install -g pake-cli
```

对于 macOS 使用以下命令：

```bash
pnpm pake-mac
```
对于 Linux 使用以下命令：

```bash
pnpm pake-linux
```

对于 Windows 使用以下命令：

```bash
pnpm pake-win
```
mac 安装后显示损坏解决方案：打开命令行，输入：

```bash
xattr -d com.apple.quarantine /Applications/Narratium.app
```

## 为什么选择 Narratium

在 AI 驱动的互动叙事领域，许多用户会遇到以下难题：

### SillyTavern

功能强大，却对新手不友好。复杂的设置、难懂的角色卡格式、混乱的生态，让很多玩家在开始冒险前就被劝退。它更像是高级玩家的实验室，而非每个人都能轻松享受的冒险平台。

### AI Dungeon

曾经开启无限故事的先驱，如今却逐渐筑起高墙。上下文受限、模型封闭、难以自定义世界，让玩家无法真正拥有自己的冒险。它给了世界，却不给钥匙。

### Narratium 想要改变这一切。

我们希望改变这一切。
Narratium 让讲故事变得简单又强大：

新手友好：即开即玩，界面直观，冒险、角色、记忆一目了然。

自由开放：开源接入任意 LLM，自由扩展角色、世界、记忆。

持续沉浸：专注连贯故事、世界逻辑、角色一致性，让每一次冒险都是有温度、可回溯的个人传奇。

## 许可概览

本项目包含两个部分，分别适用独立的许可协议：

- ✅ 代码：MIT 许可 — 允许商业和非商业使用，需保留署名。
- 🔒 内容：CC BY-NC-SA 4.0 — 仅限非商业使用，需署名并采用相同许可协议分发。

> 详细许可条款请参见 [LICENSE.txt](./LICENSE.txt)。

## 📬 联系与支持

* GitHub Issues
* QQ 和 Discord 社区（筹建中）

感谢 SillyTavern 社区和无数角色卡贡献值，在演示版本中，Narratium 使用了 SillyTavern 的角色卡数据，请联系我加入贡献者行列：\[[qianzhang.happyfox@gmail.com](mailto:qianzhang.happyfox@gmail.com)]

## 代码贡献者

[![Contributors](https://contrib.rocks/image?repo=Narratium/Narratium.ai)](https://github.com/Narratium/Narratium.ai/graphs/contributors)

## 角色卡贡献者

[![Contributors](https://contrib.rocks/image?repo=Narratium/Character-Card)](https://github.com/Narratium/Narratium.ai/graphs/contributors)

## 其他

贝露喵预设（Belle Cat）：由 @beilusaiying 赞助

## Star Growth

[![Stargazers over time](https://starchart.cc/Narratium/Narratium.ai.svg?variant=adaptive)](https://starchart.cc/Narratium/Narratium.ai)
