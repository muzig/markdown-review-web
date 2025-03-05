- [引言](#引言)
- [系统功能与特点](#系统功能与特点)
- [安装与运行](#安装与运行)
- [使用说明](#使用说明)
- [搭配使用](#搭配使用)
- [技术栈与实现](#技术栈与实现)
- [相关背景与类似工具](#相关背景与类似工具)
- [项目描述与许可](#项目描述与许可)
- [贡献与联系](#贡献与联系)
- [关键引用](#关键引用)

## 引言

Markdown回顾系统是一个定制的工具，旨在帮助用户通过基于艾宾浩斯记忆曲线的定期复习来保留Markdown文档中的重要知识点。该系统的设计结合了文档管理和间隔重复学习法，旨在优化学习效率。以下是系统的详细功能、安装步骤、使用说明以及相关背景信息。

## 系统功能与特点

Markdown回顾系统提供了一系列功能，以支持高效的文档管理和复习计划：

- **自动扫描与索引**：系统会自动扫描项目根目录下的`docs`目录，索引所有Markdown文件，便于组织和管理。
- **文件夹结构浏览**：文档按文件夹结构显示，支持点击文件夹图标进入子目录，或使用向上箭头和面包屑导航返回上级目录。
- **基于艾宾浩斯记忆曲线的复习计划**：系统根据记忆曲线安排复习时间，具体间隔如下：

| 复习次数 | 间隔时间 |
|----------|----------|
| 第一次复习 | 1天后    |
| 第二次复习 | 2天后    |
| 第三次复习 | 4天后    |
| 第四次复习 | 7天后    |
| 第五次复习 | 15天后   |
| 第六次及以后 | 30天后   |

- **搜索与排序**：支持通过关键词搜索文档标题、文件名和路径，并提供按名称、修改日期、复习次数等多种排序方式。
- **用户体验优化**：包括暗黑模式保护眼睛，支持Markdown语法高亮显示。
- **个性化功能**：用户可以为文档添加笔记，标记收藏，系统会跟踪每个文档的复习次数和下次复习日期。

## 安装与运行

要使用Markdown回顾系统，用户需要确保已安装Node.js（推荐版本v14或更高）。安装步骤如下：

1. 安装依赖：运行命令`npm install`
2. 配置环境变量：复制`.env.example`文件为`.env`并根据需要修改配置

   ```
   # 服务器端口
   PORT=3030
   
   # Markdown文档目录（相对于项目根目录）
   MARKDOWN_DIR=../docs
   ```

3. 启动应用：运行`npm start`
4. 在浏览器中访问：<http://localhost:3030>

应用启动后，会自动扫描配置的Markdown目录中的文件。用户可以通过左侧边栏的搜索框查找文档，或在浏览区域按文件夹结构查看。点击文档名称可查看内容，文档头部显示元数据如修改日期和复习次数。用户可点击"标记为已复习"按钮安排下次复习，或使用"重新扫描"按钮更新索引。

## 使用说明

- **文档浏览**：点击文件夹图标进入子目录，使用向上箭头或面包屑导航返回上级目录。排序按钮支持按不同方式排列文档。
- **搜索功能**：在搜索框输入关键词可搜索文档，点击X按钮清除搜索结果，返回文件夹浏览。
- **文档操作**：点击星标按钮可收藏/取消收藏文档，点击"添加笔记"按钮记录学习心得。
- **模式切换**：右上角的月亮/太阳图标可切换暗黑/明亮模式。

## 搭配使用

推荐跟 [VitePress](https://vitepress.dev/zh/guide/what-is-vitepress) 一起使用，渲染 markdown 文件，同时使用本系统进行复习。

## 技术栈与实现

该系统采用以下技术栈：

- 前端：Vue.js 3 ([Vue.js 官方文档](https://vuejs.org/)), Bootstrap 5 ([Bootstrap 官方文档](https://getbootstrap.com/))
- 后端：Node.js ([Node.js 官方文档](https://nodejs.org/en/)), Express ([Express 官方文档](https://expressjs.com/))
- 数据存储：LowDB ([LowDB GitHub 页面](https://github.com/typicode/lowdb)) (JSON文件数据库)
- Markdown解析：Marked.js ([Marked.js GitHub 页面](https://github.com/markedjs/marked))
- 代码高亮：Highlight.js ([Highlight.js 官方文档](https://highlightjs.org/))

API端点包括：

- GET /api/config：获取当前配置
- POST /api/config：更新配置
- GET /api/folders：获取目录结构
- GET /api/documents/due-today：获取今天需复习的文档
- POST /api/documents/:id/mark-reviewed：标记文档为已复习
- POST /api/scan：重新扫描Markdown目录

依赖包包括express, cors, fs-extra, lowdb, marked等。

## 相关背景与类似工具

艾宾浩斯记忆曲线是一种心理学概念，描述了记忆随时间衰减的规律，通过定期复习可增强记忆保留。该系统的设计正是基于此原理，旨在帮助用户在最佳时间点复习文档内容。

尽管搜索结果中未找到名为"Markdown Review System"的具体项目，但存在一些类似工具：

- **Mochi**：允许使用Markdown创建并复习闪卡，采用间隔重复算法优化学习，适合个人笔记管理 ([Mochi — Spaced repetition made easy](https://mochi.cards/))。
- **Anki**：一个基于间隔重复的闪卡工具，但主要针对单个知识点而非整篇文档 ([Anki 官方网站](https://apps.ankisrs.net/))。
- **Obsidian**：支持Markdown笔记管理，提供链接和回顾功能，但缺乏自动根据记忆曲线安排复习的特性。

这些工具与Markdown回顾系统有一定功能重叠，但没有完全匹配其描述，尤其是针对整篇Markdown文档的复习调度功能。

## 项目描述与许可

该项目被描述为一个帮助用户通过最佳间隔复习Markdown文档的应用，以增强信息保留。许可采用ISC License，适合开源开发和社区贡献。

## 贡献与联系

- **贡献**：欢迎贡献！请查看[贡献指南](https://github.com/yourusername/markdown-review-system/blob/master/contributing.md)以了解详情。
- **联系**：如有任何问题或反馈，请联系[您的邮箱](mailto:your.email@example.com)。

## 关键引用

- [Vue.js 官方文档](https://vuejs.org/)
- [Bootstrap 官方文档](https://getbootstrap.com/)
- [Node.js 官方文档](https://nodejs.org/en/)
- [Express 官方文档](https://expressjs.com/)
- [LowDB GitHub 页面](https://github.com/typicode/lowdb)
- [Marked.js GitHub 页面](https://github.com/markedjs/marked)
- [Highlight.js 官方文档](https://highlightjs.org/)
- [Mochi — Spaced repetition made easy](https://mochi.cards/)
- [Anki 官方网站](https://apps.ankisrs.net/)
