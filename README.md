# Markdown回顾系统

这是一个基于艾宾浩斯记忆曲线的Markdown文档回顾工具，帮助你定期复习重要的知识点。

## 功能特点

- 自动扫描并索引项目根目录下的`docs`目录中的所有Markdown文件
- 按照文件夹结构组织和显示文档，便于浏览
- 基于艾宾浩斯记忆曲线安排复习计划
- 支持文档搜索功能，快速找到需要的内容
- 支持多种排序方式（按名称、修改日期、复习次数）
- 支持暗黑模式，保护眼睛
- 支持添加笔记功能，记录学习心得
- 支持收藏功能，标记重要文档
- 跟踪每个文档的复习次数和下次复习日期
- 支持Markdown语法高亮显示

## 安装与运行

1. 确保已安装Node.js (推荐v14或更高版本)

2. 安装依赖:

```bash
cd markdown-review-app
npm install -g pnpm
pnpm install
```

3. 启动应用:

```bash
pnpm start
```

4. 在浏览器中访问: <http://localhost:3030>

## 使用说明

- 应用启动后会自动扫描项目根目录下的`docs`目录中的所有Markdown文件
- 在左侧边栏可以看到搜索框和文档浏览区域
- 文档浏览区域允许您按照文件夹结构浏览所有文档
  - 点击文件夹图标进入该文件夹
  - 点击向上箭头返回上级目录
  - 使用面包屑导航快速跳转到上级目录
  - 使用排序按钮按不同方式排序文档
- 搜索功能
  - 在搜索框中输入关键词可以搜索文档标题、文件名和路径
  - 点击X按钮清除搜索结果，返回文件夹浏览
- 文档阅读
  - 点击文档名称可以查看文档内容
  - 文档头部显示文档的元数据（修改日期、复习次数等）
  - 点击星标按钮可以收藏/取消收藏文档
  - 点击"添加笔记"按钮可以为当前文档添加学习笔记
- 复习功能
  - 阅读完成后，点击"标记为已复习"按钮，系统会根据艾宾浩斯记忆曲线安排下次复习日期
- 其他功能
  - 点击右上角的月亮/太阳图标可以切换暗黑/明亮模式
  - 如果有新增或修改的Markdown文件，可以点击顶部的"重新扫描"按钮更新索引

## 复习间隔

应用使用以下间隔安排复习计划:

- 第一次复习：1天后
- 第二次复习：2天后
- 第三次复习：4天后
- 第四次复习：7天后
- 第五次复习：15天后
- 第六次及以后：30天后

## 技术栈

- 前端: Vue.js 3, Bootstrap 5
- 后端: Node.js, Express
- 数据存储: LowDB (JSON文件数据库)
- Markdown解析: Marked.js
- 代码高亮: Highlight.js

## Project Description

This application allows users to review markdown documents based on the Ebbinghaus forgetting curve. It helps users retain information by scheduling reviews at optimal intervals.

## API Endpoints

- **GET /api/config**: Get the current configuration.
- **POST /api/config**: Update the configuration.
- **GET /api/folders**: Get the directory structure.
- **GET /api/folders/:folderPath?**: Get documents in a specific directory.
- **GET /api/documents**: Get all documents.
- **GET /api/documents/due-today**: Get documents due for review today.
- **GET /api/documents/:id**: Get the content of a specific document.
- **POST /api/documents/:id/mark-reviewed**: Mark a document as reviewed.
- **POST /api/scan**: Rescan the markdown directory.

## Dependencies

- express
- cors
- fs-extra
- lowdb
- marked

## License

This project is licensed under the ISC License.
