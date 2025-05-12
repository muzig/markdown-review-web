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
      favorites: [],
      showNoteDialog: false,
      newNote: "",
      currentLang: localStorage.getItem("lang") || "zh",
      favoriteSortOption:
        localStorage.getItem("favoriteSortOption") || "reviewDate",
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
      let docs = this.documents.filter((doc) => doc.favorite);
      switch (this.favoriteSortOption) {
        case "name":
          docs = docs.sort((a, b) => a.fileName.localeCompare(b.fileName));
          break;
        case "date":
          docs = docs.sort(
            (a, b) => new Date(b.modified) - new Date(a.modified)
          );
          break;
        case "reviewCount":
          docs = docs.sort(
            (a, b) => (b.reviewCount || 0) - (a.reviewCount || 0)
          );
          break;
        case "reviewDate":
          docs = docs.sort((a, b) => {
            if (!a.nextReviewDate) return 1;
            if (!b.nextReviewDate) return -1;
            return new Date(a.nextReviewDate) - new Date(b.nextReviewDate);
          });
          break;
        default:
          break;
      }
      return docs;
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
    $t() {
      // 返回当前语言的文本对象
      return LANGS[this.currentLang] || LANGS.zh;
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
          this.showToast(
            this.$t.scanDone,
            this.$t.foundCount.replace("{count}", data.count)
          );
        } else {
          this.showToast(this.$t.scanFailed, data.error, "error");
        }
      } catch (error) {
        console.error("扫描目录失败:", error);
        this.showToast(this.$t.scanFailed, "", "error");
      }
    },
    async fetchFolderStructure() {
      try {
        const response = await fetch("/api/folders");
        this.folderStructure = await response.json();
      } catch (error) {
        console.error("获取目录结构失败:", error);
        this.showToast(this.$t.fetchFoldersFailed, "", "error");
      }
    },
    async fetchDocuments() {
      try {
        const response = await fetch("/api/documents");
        this.documents = await response.json();
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
        this.showToast(this.$t.fetchDocsFailed, "", "error");
      }
    },
    async loadCurrentFolder(folder = "") {
      try {
        this.isSearching = false;
        this.currentFolder = folder;
        this.currentFolders = this.getFoldersInPath(folder);
        const encodedPath = encodeURIComponent(folder);
        const response = await fetch(`/api/folders/${encodedPath}`);
        this.currentDocuments = await response.json();
      } catch (error) {
        console.error("加载当前目录失败:", error);
        this.showToast(this.$t.loadFolderFailed, "", "error");
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
    async addToFavorites(doc) {
      if (!doc.favorite) {
        // 调用后端收藏接口
        try {
          const res = await fetch(`/api/documents/${doc.id}/favorite`, {
            method: "POST",
          });
          if (!res.ok) throw new Error("收藏失败");
          this.showToast(this.$t.addedToFavorites, doc.fileName);
          await this.fetchDocuments(); // 刷新文档数据，确保favorite状态同步
        } catch (e) {
          this.showToast("收藏失败", e.message, "error");
        }
      } else {
        // 调用后端取消收藏接口
        try {
          const res = await fetch(`/api/documents/${doc.id}/unfavorite`, {
            method: "POST",
          });
          if (!res.ok) throw new Error("取消收藏失败");
          this.showToast(this.$t.removedFromFavorites, doc.fileName);
          await this.fetchDocuments();
        } catch (e) {
          this.showToast("取消收藏失败", e.message, "error");
        }
      }
    },
    // 添加当前视图中的所有文档到收藏
    async addAllToFavorites() {
      let addedCount = 0;
      for (const doc of this.sortedDocuments) {
        if (!doc.favorite) {
          try {
            const res = await fetch(`/api/documents/${doc.id}/favorite`, {
              method: "POST",
            });
            if (res.ok) {
              addedCount++;
            }
          } catch (e) {
            // 忽略单个失败
          }
        }
      }
      if (addedCount > 0) {
        await this.fetchDocuments();
        this.showToast(
          this.$t.batchAddFavorites,
          this.$t.batchAddFavoritesMsg.replace("{count}", addedCount)
        );
      } else {
        this.showToast(this.$t.tip, this.$t.allAdded, "info");
      }
    },
    // 清空收藏夹
    async clearFavorites() {
      if (confirm(this.$t.confirmClearFavorites)) {
        for (const doc of this.documents) {
          if (doc.favorite) {
            try {
              await fetch(`/api/documents/${doc.id}/unfavorite`, {
                method: "POST",
              });
            } catch (e) {}
          }
        }
        await this.fetchDocuments();
        this.showToast(this.$t.clearFavorites, this.$t.removedAllFavorites);
      }
    },
    // 检查是否收藏
    isFavorite(doc) {
      return !!doc.favorite;
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
      this.saveDocumentData(this.currentDocument);
      this.showNoteDialog = false;
      this.showToast(this.$t.noteAdded, "");
    },
    // 删除笔记
    deleteNote(index) {
      if (confirm(this.$t.confirmDeleteNote)) {
        this.currentDocument.notes.splice(index, 1);
        this.saveDocumentData(this.currentDocument);
        this.showToast(this.$t.noteDeleted, "");
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
      alert(`${title}${message ? ": " + message : ""}`);
    },
    async openDocument(doc) {
      try {
        const response = await fetch(`/api/documents/${doc.id}`);
        const data = await response.json();
        if (data.content) {
          try {
            data.content = marked.parse(data.content);
          } catch (error) {
            console.error("Markdown解析失败:", error);
            data.content = `<div class="alert alert-danger">Markdown解析失败: ${error.message}</div><pre>${data.content}</pre>`;
          }
        }
        if (this.currentDocument && this.currentDocument.id === data.id) {
          data.notes = this.currentDocument.notes;
        }
        this.currentDocument = data;
      } catch (error) {
        console.error("打开文档失败:", error);
        this.showToast(this.$t.openDocFailed, error.message, "error");
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
          const notes = this.currentDocument ? this.currentDocument.notes : [];
          this.currentDocument = data.document;
          if (this.currentDocument.content) {
            try {
              this.currentDocument.content = marked.parse(
                this.currentDocument.content
              );
            } catch (error) {
              console.error("Markdown解析失败:", error);
              this.currentDocument.content = `<div class=\"alert alert-danger\">Markdown解析失败: ${error.message}</div><pre>${this.currentDocument.content}</pre>`;
            }
          }
          this.currentDocument.notes = notes;
          await this.fetchDocuments();
          if (this.isSearching) {
            this.searchDocuments();
          } else {
            this.loadCurrentFolder(this.currentFolder);
          }
          this.showToast(this.$t.reviewDone, this.$t.reviewDoneMsg);
        } else {
          this.showToast(this.$t.markReviewFailed, "", "error");
        }
      } catch (error) {
        console.error("标记复习失败:", error);
        this.showToast(this.$t.markReviewFailed, error.message, "error");
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
    switchLang(lang) {
      this.currentLang = lang;
      localStorage.setItem("lang", lang);
    },
    // 计算距离下次复习的剩余时间（返回友好字符串）
    timeUntilNextReview(doc) {
      if (!doc.nextReviewDate) return this.$t.nextReview + ": --";
      const now = new Date();
      const next = new Date(doc.nextReviewDate);
      const diff = next - now;
      if (diff <= 0) return this.$t.toReview;
      // 计算天、小时、分钟
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      let str = "";
      if (days > 0) str += days + this.$t.days;
      if (hours > 0) str += (str ? " " : "") + hours + this.$t.hours;
      if (days === 0 && minutes > 0)
        str += (str ? " " : "") + minutes + this.$t.minutes;
      return this.$t.nextReview + ": " + str;
    },
    setFavoriteSortOption(option) {
      this.favoriteSortOption = option;
      localStorage.setItem("favoriteSortOption", option);
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
