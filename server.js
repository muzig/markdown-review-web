const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
require("dotenv").config();
const { scanMarkdownDirectory } = require("./utils/markdown-scanner");
const { calculateNextReview } = require("./utils/spaced-repetition");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

const app = express();
const PORT = process.env.PORT || 3030;

// 数据库设置
const adapter = new FileSync("db/data.json");
const db = low(adapter);
db.defaults({ documents: [], readingRecords: {}, folderStructure: {} }).write();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 从环境变量读取Markdown目录路径
const markdownDir = process.env.MARKDOWN_DIR
  ? path.resolve(__dirname, process.env.MARKDOWN_DIR)
  : path.resolve(__dirname, "../docs");

// API 路由
// 1. 获取配置
app.get("/api/config", (req, res) => {
  res.json({ markdownDir });
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
    // 检查文件是否存在
    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ error: "文件不存在或已被移动" });
    }

    const content = fs.readFileSync(document.path, "utf-8");
    res.json({ ...document, content });
  } catch (error) {
    console.error(`读取文件 ${document.path} 失败:`, error);
    res.status(500).json({
      error: "无法读取文档内容",
      message: error.message,
      path: document.path,
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
    if (!fs.existsSync(markdownDir)) {
      fs.ensureDirSync(markdownDir);
      console.log(`已创建目录 ${markdownDir}`);
    }

    const documents = scanMarkdownDirectory(markdownDir, db);
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
  console.log(`使用的Markdown目录: ${markdownDir}`);

  // 确保数据目录存在
  fs.ensureDirSync(path.dirname(adapter.source));

  // 初始扫描
  if (fs.existsSync(markdownDir)) {
    scanMarkdownDirectory(markdownDir, db);
    console.log(`已扫描 ${db.get("documents").value().length} 个Markdown文件`);
  } else {
    console.log(`警告: 目录 ${markdownDir} 不存在.`);
    fs.ensureDirSync(markdownDir);
    console.log(`已创建目录 ${markdownDir}`);
  }
});
