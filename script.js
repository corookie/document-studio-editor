const STORAGE_KEY = "doc_studio_workspace_v2";
const defaultContent = "<h1>请输入文档标题</h1><p>这里可以输入正文内容，支持选择字体、字号以及常见标题级别。</p><p>需要整理图片或视频时，点击上方“添加素材区域”即可在文档中插入素材模块。</p>";

const editor = document.getElementById("editor");
const fileTree = document.getElementById("fileTree");
const currentDocumentName = document.getElementById("currentDocumentName");
const assetSectionTemplate = document.getElementById("assetSectionTemplate");

let workspace = loadWorkspace();
let activeDocId = workspace.activeDocId;

init();

function init() {
  bindToolbar();
  bindWorkspaceButtons();
  if (!findNode(workspace.tree, activeDocId)) {
    const firstDoc = findFirstDocument(workspace.tree);
    activeDocId = firstDoc ? firstDoc.id : createDocument("示例文档");
  }
  openDocument(activeDocId);
}

function loadWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      return saved;
    }
  } catch (error) {
    console.warn(error);
  }
  const firstId = uid();
  return {
    activeDocId: firstId,
    tree: [{ id: firstId, type: "file", name: "示例文档", content: defaultContent }]
  };
}

function persist() {
  workspace.activeDocId = activeDocId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === "folder") {
      const child = findNode(node.children, id);
      if (child) return child;
    }
  }
  return null;
}

function findParent(targetId, nodes = workspace.tree) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === targetId) return { list: nodes, index, node };
    if (node.type === "folder") {
      const found = findParent(targetId, node.children);
      if (found) return found;
    }
  }
  return null;
}

function findFirstDocument(nodes) {
  for (const node of nodes) {
    if (node.type === "file") return node;
    if (node.type === "folder") {
      const child = findFirstDocument(node.children);
      if (child) return child;
    }
  }
  return null;
}

function activeDoc() {
  return findNode(workspace.tree, activeDocId);
}

function saveCurrentDocument() {
  const doc = activeDoc();
  if (!doc || doc.type !== "file") return;
  doc.content = editor.innerHTML;
  persist();
  renderTree();
}

function createDocument(name, parentFolderId = null) {
  const doc = { id: uid(), type: "file", name, content: defaultContent };
  if (parentFolderId) {
    const folder = findNode(workspace.tree, parentFolderId);
    if (folder && folder.type === "folder") folder.children.push(doc);
  } else {
    workspace.tree.push(doc);
  }
  persist();
  return doc.id;
}

function createFolder(name, parentFolderId = null) {
  const folder = { id: uid(), type: "folder", name, children: [] };
  if (parentFolderId) {
    const parent = findNode(workspace.tree, parentFolderId);
    if (parent && parent.type === "folder") parent.children.push(folder);
  } else {
    workspace.tree.push(folder);
  }
  persist();
  return folder.id;
}

function openDocument(docId) {
  saveCurrentDocument();
  const doc = findNode(workspace.tree, docId);
  if (!doc || doc.type !== "file") return;
  activeDocId = docId;
  editor.innerHTML = doc.content || defaultContent;
  currentDocumentName.textContent = doc.name;
  bindExistingAssetSections();
  renderTree();
}

function bindToolbar() {
  document.querySelectorAll(".format-btn").forEach((button) => {
    button.addEventListener("click", () => exec(button.dataset.command));
  });

  document.getElementById("fontFamilySelect").addEventListener("change", (event) => {
    exec("fontName", event.target.value);
  });

  document.getElementById("fontSizeSelect").addEventListener("change", (event) => {
    applyFontSize(event.target.value);
  });

  document.getElementById("blockTypeSelect").addEventListener("change", (event) => {
    exec("formatBlock", event.target.value);
  });

  document.getElementById("addAssetSectionBtn").addEventListener("click", () => {
    const section = assetSectionTemplate.content.firstElementChild.cloneNode(true);
    bindAssetSection(section);
    insertAtCursor(section);
    appendEditableParagraph(section);
    saveCurrentDocument();
  });

  document.getElementById("saveDocBtn").addEventListener("click", saveCurrentDocument);
  editor.addEventListener("input", saveCurrentDocument);
}

function bindWorkspaceButtons() {
  document.getElementById("newFolderBtn").addEventListener("click", () => {
    const target = pickFolder();
    const name = window.prompt("请输入目录名称", "新建目录");
    if (!name) return;
    createFolder(name.trim(), target);
    renderTree();
  });

  document.getElementById("newFileBtn").addEventListener("click", () => {
    const target = pickFolder();
    const name = window.prompt("请输入文件名称", "未命名文档");
    if (!name) return;
    const id = createDocument(name.trim(), target);
    openDocument(id);
  });
}

function pickFolder() {
  const folders = [];
  collectFolders(workspace.tree, folders);
  if (folders.length === 0) return null;
  const value = window.prompt(`输入要放入的目录名，留空为根目录：${folders.map((item) => item.name).join("、")}`, "");
  if (!value) return null;
  const found = folders.find((item) => item.name === value.trim());
  return found ? found.id : null;
}

function collectFolders(nodes, result) {
  for (const node of nodes) {
    if (node.type === "folder") {
      result.push(node);
      collectFolders(node.children, result);
    }
  }
}

function renderTree() {
  fileTree.innerHTML = "";
  workspace.tree.forEach((node) => fileTree.appendChild(renderNode(node)));
}

function renderNode(node) {
  const wrap = document.createElement("div");
  wrap.className = "tree-node";

  const row = document.createElement("div");
  row.className = "tree-node-row";

  const main = document.createElement("div");
  main.className = "tree-node-main";
  main.innerHTML = `<span>${node.type === "folder" ? "📁" : "📄"}</span>`;

  const nameBtn = document.createElement("button");
  nameBtn.type = "button";
  nameBtn.className = "tree-node-name";
  nameBtn.textContent = node.name;
  if (node.id === activeDocId) nameBtn.classList.add("active");
  if (node.type === "file") nameBtn.addEventListener("click", () => openDocument(node.id));

  const label = document.createElement("span");
  label.className = "tree-node-label";
  label.textContent = node.type === "folder" ? "目录" : "文档";
  main.append(nameBtn, label);

  const actions = document.createElement("div");
  actions.className = "tree-node-actions";

  if (node.type === "folder") {
    actions.append(actionButton("+文件", () => {
      const name = window.prompt("请输入文件名称", "未命名文档");
      if (!name) return;
      const id = createDocument(name.trim(), node.id);
      openDocument(id);
    }));
    actions.append(actionButton("+目录", () => {
      const name = window.prompt("请输入目录名称", "新建目录");
      if (!name) return;
      createFolder(name.trim(), node.id);
      renderTree();
    }));
  }

  actions.append(actionButton("重命名", () => {
    const name = window.prompt("请输入新的名称", node.name);
    if (!name) return;
    node.name = name.trim();
    if (node.id === activeDocId) currentDocumentName.textContent = node.name;
    persist();
    renderTree();
  }));

  actions.append(actionButton("删除", () => {
    if (!window.confirm(`确认删除“${node.name}”吗？`)) return;
    const found = findParent(node.id);
    if (!found) return;
    found.list.splice(found.index, 1);
    if (node.id === activeDocId || containsDoc(node, activeDocId)) {
      const next = findFirstDocument(workspace.tree);
      activeDocId = next ? next.id : createDocument("未命名文档");
      openDocument(activeDocId);
    }
    persist();
    renderTree();
  }));

  row.append(main, actions);
  wrap.appendChild(row);

  if (node.type === "folder" && node.children.length) {
    const children = document.createElement("div");
    children.className = "tree-children";
    node.children.forEach((child) => children.appendChild(renderNode(child)));
    wrap.appendChild(children);
  }
  return wrap;
}

function containsDoc(folderNode, docId) {
  if (folderNode.type !== "folder") return false;
  return folderNode.children.some((child) => child.id === docId || containsDoc(child, docId));
}

function actionButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function exec(command, value = null) {
  editor.focus();
  document.execCommand(command, false, value);
}

function applyFontSize(size) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const span = document.createElement("span");
  span.style.fontSize = size;
  span.textContent = range.toString();
  range.deleteContents();
  range.insertNode(span);
}

function insertAtCursor(node) {
  editor.focus();
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    editor.appendChild(node);
    return;
  }
  const range = selection.getRangeAt(0);
  range.collapse(false);
  range.insertNode(node);
}

function appendEditableParagraph(section) {
  const p = document.createElement("p");
  p.innerHTML = "<br>";
  section.insertAdjacentElement("afterend", p);
  const range = document.createRange();
  range.selectNodeContents(p);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  editor.focus();
}

function createEmptyState() {
  const node = document.createElement("div");
  node.className = "empty-text";
  node.textContent = "当前还没有素材，点击上方按钮添加图片或视频。";
  return node;
}

function ensureEmptyState(grid) {
  if (!grid.children.length) grid.appendChild(createEmptyState());
}

function removeEmptyState(grid) {
  const empty = grid.querySelector(".empty-text");
  if (empty) empty.remove();
}

function createAssetCard({ name, kind, previewUrl, fileUrl }) {
  const card = document.createElement("article");
  card.className = "asset-card";
  card.dataset.fileUrl = fileUrl || "";
  card.dataset.downloadName = name;
  card.innerHTML = `
    <div class="asset-preview">${previewUrl ? `<img src="${previewUrl}" alt="${name}">` : '<div class="video-fallback">VIDEO</div>'}</div>
    <div class="asset-meta">
      <div class="asset-name">${name}</div>
      <div class="asset-kind">${kind}</div>
      <div class="asset-card-actions">
        <button type="button" class="asset-mini-btn" data-action="download-asset">另存为</button>
        <button type="button" class="asset-mini-btn danger" data-action="delete-asset">删除</button>
      </div>
    </div>
  `;
  return card;
}

function createVideoThumbnail(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const fileUrl = URL.createObjectURL(file);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = fileUrl;
    video.addEventListener("loadeddata", () => {
      video.currentTime = Math.min(1, video.duration || 0);
    });
    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 180;
      const context = canvas.getContext("2d");
      if (context) context.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve({ previewUrl: canvas.toDataURL("image/png"), fileUrl });
    });
    video.addEventListener("error", () => resolve({ previewUrl: "", fileUrl }));
  });
}

async function addImages(files, grid) {
  removeEmptyState(grid);
  for (const file of Array.from(files)) {
    const url = URL.createObjectURL(file);
    grid.appendChild(createAssetCard({ name: file.name, kind: "图片", previewUrl: url, fileUrl: url }));
  }
}

async function addVideos(files, grid) {
  removeEmptyState(grid);
  for (const file of Array.from(files)) {
    const data = await createVideoThumbnail(file);
    grid.appendChild(createAssetCard({ name: file.name, kind: "视频", previewUrl: data.previewUrl, fileUrl: data.fileUrl }));
  }
}

function bindAssetSection(section) {
  if (section.dataset.bound === "true") return;
  section.dataset.bound = "true";
  const grid = section.querySelector(".asset-grid");
  ensureEmptyState(grid);

  section.addEventListener("click", (event) => {
    const card = event.target.closest(".asset-card");
    if (!card) return;
    if (event.target.dataset.action === "delete-asset") {
      releaseCardUrls(card);
      card.remove();
      ensureEmptyState(grid);
      saveCurrentDocument();
    }
    if (event.target.dataset.action === "download-asset") {
      if (!card.dataset.fileUrl) return;
      const link = document.createElement("a");
      link.href = card.dataset.fileUrl;
      link.download = card.dataset.downloadName || "素材";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  });

  section.addEventListener("change", async (event) => {
    const input = event.target;
    if (!input.files || !input.files.length) return;
    if (input.dataset.action === "add-image") await addImages(input.files, grid);
    if (input.dataset.action === "add-video") await addVideos(input.files, grid);
    input.value = "";
    saveCurrentDocument();
  });
}

function bindExistingAssetSections() {
  editor.querySelectorAll(".asset-section").forEach((section) => bindAssetSection(section));
}

function releaseCardUrls(card) {
  const img = card.querySelector("img");
  const fileUrl = card.dataset.fileUrl;
  if (img && img.src.startsWith("blob:") && img.src !== fileUrl) URL.revokeObjectURL(img.src);
  if (fileUrl && fileUrl.startsWith("blob:")) URL.revokeObjectURL(fileUrl);
}
