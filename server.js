const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const { scanMarkdownDirectory } = require("./utils/markdown-scanner");
const { calculateNextReview } = require("./utils/spaced-repetition");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const { marked } = require("marked");
const hljs = require("highlight.js");
const dotenv = require("dotenv");

dotenv.config();

// Configure marked to use highlight.js
const renderer = new marked.Renderer();
renderer.code = (code, language) => {
  const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
  const highlighted = hljs.highlight(code, { language: validLanguage }).value;
  return `<pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`;
};

marked.setOptions({
  renderer: renderer,
  gfm: true,
  breaks: true,
});

const app = express();
const PORT = process.env.PORT || 3030;

// 支持通过环境变量配置docs和db目录
const MARKDOWN_DIR =
  process.env.MARKDOWN_DIR || path.resolve(__dirname, "../docs");
const DB_FILE =
  process.env.DB_FILE || path.resolve(__dirname, "../db/data.json");

// 如果DB_FILE不存在，自动创建其父文件夹和空文件
if (!fs.existsSync(DB_FILE)) {
  fs.ensureDirSync(path.dirname(DB_FILE));
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      { documents: [], readingRecords: {}, folderStructure: {} },
      null,
      2
    )
  );
}

// 数据库设置
const adapter = new FileSync(DB_FILE);
const db = low(adapter);
db.defaults({ documents: [], readingRecords: {}, folderStructure: {} }).write();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// API 路由
// 1. 获取配置
app.get("/api/config", (req, res) => {
  res.json({ markdownDir: MARKDOWN_DIR, dbFile: DB_FILE });
});

// 2. 获取目录结构
app.get("/api/folders", (req, res) => {
  const folderStructure = db.get("folderStructure").value();
  res.json(folderStructure);
});

// 3. 获取特定目录下的文档
app.get("/api/folders/:folderPath?", (req, res) => {
  let { folderPath } = req.params;
  folderPath = folderPath || "";

  // 解码URL编码的路径
  folderPath = decodeURIComponent(folderPath);

  const documents = db
    .get("documents")
    .filter((doc) => {
      // 如果请求的是根目录，返回所有没有folderPath的文档
      if (folderPath === "") {
        return doc.folderPath === "";
      }
      // 否则返回指定目录下的文档
      return doc.folderPath === folderPath;
    })
    .value();

  const readingRecords = db.get("readingRecords").value();

  // 为每个文档添加阅读状态信息
  const docsWithReadingInfo = documents.map((doc) => {
    const record = readingRecords[doc.id] || {
      reviewCount: 0,
      lastReviewed: null,
      nextReviewDate: null,
    };

    return {
      ...doc,
      reviewCount: record.reviewCount,
      lastReviewed: record.lastReviewed,
      nextReviewDate: record.nextReviewDate,
      dueForReview: record.nextReviewDate
        ? new Date(record.nextReviewDate) <= new Date()
        : true,
    };
  });

  res.json(docsWithReadingInfo);
});

// 4. 获取所有文档
app.get("/api/documents", (req, res) => {
  const documents = db.get("documents").value();
  const readingRecords = db.get("readingRecords").value();

  // 为每个文档添加阅读状态信息
  const docsWithReadingInfo = documents.map((doc) => {
    const record = readingRecords[doc.id] || {
      reviewCount: 0,
      lastReviewed: null,
      nextReviewDate: null,
    };

    return {
      ...doc,
      reviewCount: record.reviewCount,
      lastReviewed: record.lastReviewed,
      nextReviewDate: record.nextReviewDate,
      dueForReview: record.nextReviewDate
        ? new Date(record.nextReviewDate) <= new Date()
        : true,
    };
  });

  res.json(docsWithReadingInfo);
});

// 5. 获取今日待复习文档
app.get("/api/documents/due-today", (req, res) => {
  const documents = db.get("documents").value();
  const readingRecords = db.get("readingRecords").value();
  const today = new Date();

  const dueDocuments = documents.filter((doc) => {
    const record = readingRecords[doc.id];
    if (!record || !record.nextReviewDate) return true; // 从未阅读过的文档
    return new Date(record.nextReviewDate) <= today;
  });

  res.json(dueDocuments);
});

// 6. 获取单个文档内容
app.get("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  const document = db.get("documents").find({ id }).value();

  if (!document) {
    return res.status(404).json({ error: "文档不存在" });
  }

  try {
    // 用 relativePath 拼接出实际文件路径
    const filePath = path.join(MARKDOWN_DIR, document.relativePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在或已被移动" });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    // 使用 marked 解析 markdown 内容
    const parsedContent = marked(content);
    res.json({ ...document, content: parsedContent });
  } catch (error) {
    console.error(`读取文件 ${document.relativePath} 失败:`, error);
    res.status(500).json({
      error: "无法读取文档内容",
      message: error.message,
      path: document.relativePath,
    });
  }
});

// 7. 标记文档已复习
app.post("/api/documents/:id/mark-reviewed", (req, res) => {
  const { id } = req.params;
  const document = db.get("documents").find({ id }).value();

  if (!document) {
    return res.status(404).json({ error: "文档不存在" });
  }

  const now = new Date();
  const readingRecords = db.get("readingRecords").value();
  const currentRecord = readingRecords[id] || { reviewCount: 0 };

  // 更新阅读记录
  const updatedRecord = {
    reviewCount: currentRecord.reviewCount + 1,
    lastReviewed: now.toISOString(),
    nextReviewDate: calculateNextReview(currentRecord.reviewCount, now),
  };

  db.get("readingRecords").set(id, updatedRecord).write();

  res.json({
    success: true,
    document: { ...document, ...updatedRecord },
  });
});

// 8. 重新扫描目录
app.post("/api/scan", (req, res) => {
  try {
    // 确保目录存在
    if (!fs.existsSync(MARKDOWN_DIR)) {
      fs.ensureDirSync(MARKDOWN_DIR);
      console.log(`已创建目录 ${MARKDOWN_DIR}`);
    }

    const documents = scanMarkdownDirectory(MARKDOWN_DIR, db);
    res.json({ success: true, count: documents.length });
  } catch (error) {
    console.error("扫描失败:", error);
    res.status(500).json({ error: "扫描失败", message: error.message });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error("服务器错误:", err);
  res.status(500).json({
    error: "服务器错误",
    message: err.message,
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`使用的Markdown目录: ${MARKDOWN_DIR}`);
  console.log(`使用的DB文件: ${DB_FILE}`);

  // 确保数据目录存在
  fs.ensureDirSync(path.dirname(adapter.source));

  // 初始扫描
  if (fs.existsSync(MARKDOWN_DIR)) {
    scanMarkdownDirectory(MARKDOWN_DIR, db);
    // 启动时自动清理无效的阅读记录
    const documents = db.get("documents").value();
    const validIds = new Set(documents.map((doc) => doc.id));
    const readingRecords = db.get("readingRecords").value();
    let removed = 0;
    for (const id of Object.keys(readingRecords)) {
      if (!validIds.has(id)) {
        db.get("readingRecords").unset(id).write();
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`已自动清理 ${removed} 条无效的阅读记录`);
    }
    console.log(`已扫描 ${documents.length} 个Markdown文件`);
  } else {
    console.log(`警告: 目录 ${MARKDOWN_DIR} 不存在.`);
    fs.ensureDirSync(MARKDOWN_DIR);
    console.log(`已创建目录 ${MARKDOWN_DIR}`);
  }
});
