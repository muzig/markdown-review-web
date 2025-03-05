const app = Vue.createApp({
  data() {
    return {
      documents: [],
      dueDocuments: [],
      currentDocument: null,
      folderStructure: {},
      currentFolder: "",
      currentFolders: [],
      currentDocuments: [],
      darkMode: localStorage.getItem("darkMode") === "true",
      searchQuery: "",
      isSearching: false,
      sortOption: localStorage.getItem("sortOption") || "name",
      favorites: JSON.parse(localStorage.getItem("favorites") || "[]"),
      showNoteDialog: false,
      newNote: "",
    };
  },
  computed: {
    // 按文件夹分组的待复习文档
    groupedDueDocuments() {
      const grouped = {};

      this.dueDocuments.forEach((doc) => {
        const folder = doc.folderPath || "根目录";
        if (!grouped[folder]) {
          grouped[folder] = [];
        }
        grouped[folder].push(doc);
      });

      return grouped;
    },
    // 计算已复习的文档数量
    reviewedCount() {
      return this.documents.filter((doc) => doc.reviewCount > 0).length;
    },

    // 获取收藏的文档
    favoriteDocuments() {
      return this.documents
        .filter((doc) => this.favorites.includes(doc.id))
        .sort((a, b) => a.fileName.localeCompare(b.fileName));
    },

    // 当前文件夹的路径部分
    folderParts() {
      return this.currentFolder
        ? this.currentFolder.split("/").filter((part) => part !== "")
        : [];
    },

    // 排序后的文件夹
    sortedFolders() {
      return [...this.currentFolders].sort();
    },

    // 排序后的文档
    sortedDocuments() {
      if (!this.currentDocuments.length) return [];

      const docs = [...this.currentDocuments];

      switch (this.sortOption) {
        case "name":
          return docs.sort((a, b) => a.fileName.localeCompare(b.fileName));
        case "date":
          return docs.sort(
            (a, b) => new Date(b.modified) - new Date(a.modified)
          );
        case "reviewCount":
          return docs.sort(
            (a, b) => (b.reviewCount || 0) - (a.reviewCount || 0)
          );
        default:
          return docs;
      }
    },
  },
  methods: {
    async scanDirectory() {
      try {
        const response = await fetch("/api/scan", {
          method: "POST",
        });
        const data = await response.json();
        if (data.success) {
          await this.fetchFolderStructure();
          await this.fetchDocuments();
          this.loadCurrentFolder(this.currentFolder);
          this.showToast("扫描完成", `已找到 ${data.count} 个Markdown文件`);
        } else {
          this.showToast("扫描失败", data.error, "error");
        }
      } catch (error) {
        console.error("扫描目录失败:", error);
        this.showToast("扫描失败", "请检查网络连接", "error");
      }
    },
    async fetchFolderStructure() {
      try {
        const response = await fetch("/api/folders");
        this.folderStructure = await response.json();
      } catch (error) {
        console.error("获取目录结构失败:", error);
        this.showToast("获取目录结构失败", "请检查网络连接", "error");
      }
    },
    async fetchDocuments() {
      try {
        const response = await fetch("/api/documents");
        this.documents = await response.json();

        // 恢复笔记和收藏状态
        this.documents.forEach((doc) => {
          const savedData = localStorage.getItem(`doc_${doc.id}`);
          if (savedData) {
            const data = JSON.parse(savedData);
            doc.notes = data.notes || [];
          } else {
            doc.notes = [];
          }
        });
      } catch (error) {
        console.error("获取文档列表失败:", error);
        this.showToast("获取文档列表失败", "请检查网络连接", "error");
      }
    },
    async loadCurrentFolder(folder = "") {
      try {
        this.isSearching = false;
        this.currentFolder = folder;

        // 获取当前目录下的文件夹
        this.currentFolders = this.getFoldersInPath(folder);

        // 获取当前目录下的文档
        const encodedPath = encodeURIComponent(folder);
        const response = await fetch(`/api/folders/${encodedPath}`);
        this.currentDocuments = await response.json();
      } catch (error) {
        console.error("加载当前目录失败:", error);
        this.showToast("加载目录失败", "请检查网络连接", "error");
      }
    },
    // 获取指定路径下的文件夹
    getFoldersInPath(folderPath) {
      let structure = this.folderStructure;

      if (folderPath) {
        const parts = folderPath.split("/");
        for (const part of parts) {
          if (structure[part]) {
            structure = structure[part];
          } else {
            return [];
          }
        }
      }

      return Object.keys(structure);
    },
    // 打开文件夹
    openFolder(folder) {
      if (!folder) return;

      const newPath = this.currentFolder
        ? `${this.currentFolder}/${folder}`.replace(/\/+/g, "/")
        : folder;

      this.loadCurrentFolder(newPath);
    },
    // 返回上级目录
    goToParentFolder() {
      if (!this.currentFolder) return;

      const parts = this.currentFolder.split("/").filter((part) => part !== "");
      parts.pop();
      const parentPath = parts.join("/");

      this.loadCurrentFolder(parentPath);
    },
    // 导航到面包屑中的特定部分
    navigateToFolderPart(index) {
      const parts = this.folderParts.slice(0, index + 1);
      const path = parts.join("/");
      this.loadCurrentFolder(path);
    },
    // 搜索文档
    searchDocuments() {
      if (!this.searchQuery.trim()) {
        this.clearSearch();
        return;
      }

      this.isSearching = true;
      const query = this.searchQuery.toLowerCase();

      // 搜索文件名、标题和路径
      this.currentDocuments = this.documents.filter(
        (doc) =>
          doc.fileName.toLowerCase().includes(query) ||
          doc.title.toLowerCase().includes(query) ||
          doc.relativePath.toLowerCase().includes(query)
      );

      this.currentFolders = [];
    },
    // 清除搜索
    clearSearch() {
      this.searchQuery = "";
      this.isSearching = false;
      this.loadCurrentFolder(this.currentFolder);
    },
    // 设置排序选项
    setSortOption(option) {
      this.sortOption = option;
      localStorage.setItem("sortOption", option);
    },
    // 切换暗黑模式
    toggleDarkMode() {
      this.darkMode = !this.darkMode;
      document.body.classList.toggle("dark-mode", this.darkMode);
      localStorage.setItem("darkMode", this.darkMode);

      // 切换代码高亮主题
      const darkTheme = document.getElementById("highlight-dark-theme");
      if (darkTheme) {
        darkTheme.disabled = !this.darkMode;
      }
    },
    // 添加到收藏
    addToFavorites(doc) {
      const index = this.favorites.indexOf(doc.id);
      if (index === -1) {
        this.favorites.push(doc.id);
        this.showToast("已添加到收藏", doc.fileName);
      } else {
        this.favorites.splice(index, 1);
        this.showToast("已从收藏中移除", doc.fileName);
      }
      localStorage.setItem("favorites", JSON.stringify(this.favorites));
    },
    // 添加当前视图中的所有文档到收藏
    addAllToFavorites() {
      let addedCount = 0;
      this.sortedDocuments.forEach((doc) => {
        if (!this.favorites.includes(doc.id)) {
          this.favorites.push(doc.id);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        localStorage.setItem("favorites", JSON.stringify(this.favorites));
        this.showToast("批量添加到收藏", `已添加 ${addedCount} 个文档到收藏夹`);
      } else {
        this.showToast("提示", "当前视图中的文档已全部添加到收藏夹", "info");
      }
    },
    // 清空收藏夹
    clearFavorites() {
      if (confirm("确定要清空收藏夹吗？此操作不可恢复。")) {
        this.favorites = [];
        localStorage.setItem("favorites", JSON.stringify(this.favorites));
        this.showToast("已清空收藏夹", "所有收藏的文档已被移除");
      }
    },
    // 检查是否收藏
    isFavorite(doc) {
      return this.favorites.includes(doc.id);
    },
    // 添加笔记
    addNote() {
      this.showNoteDialog = true;
      this.newNote = "";
    },
    // 保存笔记
    saveNote() {
      if (!this.newNote.trim()) {
        this.showNoteDialog = false;
        return;
      }

      if (!this.currentDocument.notes) {
        this.currentDocument.notes = [];
      }

      this.currentDocument.notes.push({
        text: this.newNote,
        date: new Date().toISOString(),
      });

      // 保存到本地存储
      this.saveDocumentData(this.currentDocument);

      this.showNoteDialog = false;
      this.showToast("笔记已添加", "");
    },
    // 删除笔记
    deleteNote(index) {
      if (confirm("确定要删除这条笔记吗？")) {
        this.currentDocument.notes.splice(index, 1);
        this.saveDocumentData(this.currentDocument);
        this.showToast("笔记已删除", "");
      }
    },
    // 保存文档数据到本地存储
    saveDocumentData(doc) {
      const data = {
        notes: doc.notes || [],
      };
      localStorage.setItem(`doc_${doc.id}`, JSON.stringify(data));
    },
    // 显示提示消息
    showToast(title, message, type = "success") {
      // 简单的提示实现，可以替换为更复杂的UI组件
      alert(`${title}${message ? ": " + message : ""}`);
    },
    async openDocument(doc) {
      try {
        const response = await fetch(`/api/documents/${doc.id}`);
        const data = await response.json();

        // 使用marked将Markdown转换为HTML
        if (data.content) {
          try {
            data.content = marked.parse(data.content);
          } catch (error) {
            console.error("Markdown解析失败:", error);
            data.content = `<div class="alert alert-danger">Markdown解析失败: ${error.message}</div>
                           <pre>${data.content}</pre>`;
          }
        }

        // 恢复笔记
        if (this.currentDocument && this.currentDocument.id === data.id) {
          data.notes = this.currentDocument.notes;
        }

        this.currentDocument = data;
      } catch (error) {
        console.error("打开文档失败:", error);
        this.showToast("打开文档失败", error.message, "error");
      }
    },
    async markReviewed(doc) {
      try {
        const response = await fetch(`/api/documents/${doc.id}/mark-reviewed`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          // 保存当前文档的笔记
          const notes = this.currentDocument ? this.currentDocument.notes : [];

          this.currentDocument = data.document;

          // 使用marked将Markdown转换为HTML
          if (this.currentDocument.content) {
            try {
              this.currentDocument.content = marked.parse(
                this.currentDocument.content
              );
            } catch (error) {
              console.error("Markdown解析失败:", error);
              this.currentDocument.content = `<div class="alert alert-danger">Markdown解析失败: ${error.message}</div>
                                             <pre>${this.currentDocument.content}</pre>`;
            }
          }

          // 恢复笔记
          this.currentDocument.notes = notes;

          await this.fetchDocuments();

          if (this.isSearching) {
            this.searchDocuments();
          } else {
            this.loadCurrentFolder(this.currentFolder);
          }

          this.showToast("复习完成", "已更新下次复习日期");
        } else {
          this.showToast("标记复习失败", "", "error");
        }
      } catch (error) {
        console.error("标记复习失败:", error);
        this.showToast("标记复习失败", error.message, "error");
      }
    },
    formatPath(relativePath) {
      if (!relativePath) return "";

      // 统一使用正斜杠，避免Windows系统上的反斜杠问题
      const normalizedPath = relativePath.replace(/\\/g, "/");

      // 如果路径是空字符串或者"."，显示为"根目录"
      if (normalizedPath === "" || normalizedPath === ".") {
        return "根目录";
      }

      return normalizedPath;
    },
    formatDate(dateString) {
      if (!dateString) return "";
      const date = new Date(dateString);
      return (
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    },
  },
  async mounted() {
    // Configure marked.js to properly handle code blocks
    marked.setOptions({
      highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {
            console.error("Highlight.js error:", err);
          }
        }
        return hljs.highlightAuto(code).value;
      },
      langPrefix: "hljs language-",
      breaks: true,
      gfm: true,
    });

    // Check if dark mode is enabled
    if (this.darkMode) {
      document.body.classList.add("dark-mode");

      // 启用暗黑模式的代码高亮主题
      const darkTheme = document.getElementById("highlight-dark-theme");
      if (darkTheme) {
        darkTheme.disabled = false;
      }
    }

    await this.fetchFolderStructure();
    await this.fetchDocuments();
    this.loadCurrentFolder("");
  },
});

app.mount("#app");
