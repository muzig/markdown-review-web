const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const marked = require("marked");

/**
 * 扫描目录中的所有Markdown文件
 */
function scanMarkdownDirectory(dirPath, db) {
  console.log(`扫描目录: ${dirPath}`);
  const documents = [];
  const folderStructure = {};

  function scanDir(currentPath) {
    try {
      const files = fs.readdirSync(currentPath);

      files.forEach((file) => {
        try {
          const filePath = path.join(currentPath, file);
          const stats = fs.statSync(filePath);

          if (stats.isDirectory()) {
            scanDir(filePath);
          } else if (path.extname(file).toLowerCase() === ".md") {
            try {
              const content = fs.readFileSync(filePath, "utf-8");
              const relativePath = path.relative(dirPath, filePath);
              // 统一使用正斜杠作为路径分隔符，避免Windows系统上的路径问题
              const normalizedRelativePath = relativePath.replace(/\\/g, "/");
              const id = generateFileId(normalizedRelativePath);
              const title = extractTitle(content) || path.basename(file, ".md");
              const folderPath =
                path.dirname(normalizedRelativePath) === "."
                  ? ""
                  : path.dirname(normalizedRelativePath).replace(/\\/g, "/");
              const fileName = path.basename(file);

              // 构建目录结构
              if (folderPath !== "" && folderPath !== ".") {
                // 使用正斜杠分割路径，确保跨平台一致性
                const folders = folderPath.split("/");
                let currentLevel = folderStructure;

                folders.forEach((folder) => {
                  if (!currentLevel[folder]) {
                    currentLevel[folder] = {};
                  }
                  currentLevel = currentLevel[folder];
                });
              }

              documents.push({
                id,
                title,
                fileName,
                relativePath: normalizedRelativePath,
                folderPath: folderPath,
                size: stats.size,
              });
            } catch (error) {
              console.error(`处理文件 ${filePath} 时出错:`, error);
            }
          }
        } catch (error) {
          console.error(
            `处理项目 ${path.join(currentPath, file)} 时出错:`,
            error
          );
        }
      });
    } catch (error) {
      console.error(`读取目录 ${currentPath} 时出错:`, error);
    }
  }

  try {
    scanDir(dirPath);

    // 更新数据库
    db.set("documents", documents).write();
    db.set("folderStructure", folderStructure).write();
    console.log(`找到 ${documents.length} 个Markdown文件`);

    return documents;
  } catch (error) {
    console.error("扫描目录失败:", error);
    throw error;
  }
}

/**
 * 从Markdown内容中提取标题
 */
function extractTitle(content) {
  try {
    // 尝试从第一个标题中提取
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) return titleMatch[1];

    // 如果没有标题，尝试从第一行提取
    const firstLine = content.trim().split("\n")[0];
    if (firstLine) return firstLine;

    return null;
  } catch (error) {
    console.error("提取标题失败:", error);
    return null;
  }
}

/**
 * 为文件生成唯一ID
 */
function generateFileId(relativePath) {
  try {
    return crypto.createHash("md5").update(relativePath).digest("hex");
  } catch (error) {
    console.error("生成文件ID失败:", error);
    // 使用时间戳作为备用ID
    return Date.now().toString() + Math.random().toString(36).substring(2, 15);
  }
}

module.exports = { scanMarkdownDirectory };
