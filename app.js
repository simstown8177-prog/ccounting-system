const CLIENT_STORAGE_KEY = "shop-n-shop-client-v1";

const state = {
  categories: [],
  selectedCategoryId: null,
  activeTab: "overview",
  authToken: null,
  notificationEnabled: false,
  pushPublicKey: "",
  pushSubscribedByCategory: {},
  workspaceCategory: null,
  currentUser: null,
  lastAlarmSignatureByCategory: {},
  serviceWorkerRegistration: null,
};

const elements = {
  categoryGrid: document.querySelector("#categoryGrid"),
  globalStats: document.querySelector("#globalStats"),
  selectedCategoryBadge: document.querySelector("#selectedCategoryBadge"),
  loginForm: document.querySelector("#loginForm"),
  loginHint: document.querySelector("#loginHint"),
  workspacePanel: document.querySelector("#workspacePanel"),
  workspaceTitle: document.querySelector("#workspaceTitle"),
  currentUserBadge: document.querySelector("#currentUserBadge"),
  logoutButton: document.querySelector("#logoutButton"),
  tabs: document.querySelector("#workspaceTabs"),
  inventoryTableBody: document.querySelector("#inventoryTableBody"),
  workspaceAlert: document.querySelector("#workspaceAlert"),
  metricItems: document.querySelector("#metricItems"),
  metricLowStock: document.querySelector("#metricLowStock"),
  metricOpenOrders: document.querySelector("#metricOpenOrders"),
  metricTodayClosings: document.querySelector("#metricTodayClosings"),
  itemForm: document.querySelector("#itemForm"),
  vendorForm: document.querySelector("#vendorForm"),
  purchaseForm: document.querySelector("#purchaseForm"),
  receiptForm: document.querySelector("#receiptForm"),
  closingForm: document.querySelector("#closingForm"),
  receiptUploadForm: document.querySelector("#receiptUploadForm"),
  ocrPreviewInput: document.querySelector("#ocrPreviewInput"),
  runOcrPreviewButton: document.querySelector("#runOcrPreviewButton"),
  ocrPreviewResult: document.querySelector("#ocrPreviewResult"),
  reportDateInput: document.querySelector("#reportDateInput"),
  dailyReportCard: document.querySelector("#dailyReportCard"),
  itemList: document.querySelector("#itemList"),
  vendorList: document.querySelector("#vendorList"),
  userForm: document.querySelector("#userForm"),
  userList: document.querySelector("#userList"),
  userAdminNotice: document.querySelector("#userAdminNotice"),
  purchaseList: document.querySelector("#purchaseList"),
  closingList: document.querySelector("#closingList"),
  receiptUploadList: document.querySelector("#receiptUploadList"),
  purchaseItemSelect: document.querySelector('#purchaseForm select[name="itemId"]'),
  purchaseVendorSelect: document.querySelector('#purchaseForm select[name="vendorId"]'),
  receiptOrderSelect: document.querySelector('#receiptForm select[name="purchaseOrderId"]'),
  closingItemSelect: document.querySelector('#closingForm select[name="itemId"]'),
  receiptLineItems: document.querySelector("#receiptLineItems"),
  addReceiptLineButton: document.querySelector("#addReceiptLineButton"),
  kakaoForm: document.querySelector("#kakaoForm"),
  kakaoMessageOutput: document.querySelector("#kakaoMessageOutput"),
  copyKakaoMessageButton: document.querySelector("#copyKakaoMessageButton"),
  sendKakaoSimulationButton: document.querySelector("#sendKakaoSimulationButton"),
  kakaoDispatchStatus: document.querySelector("#kakaoDispatchStatus"),
  seedDataButton: document.querySelector("#seedDataButton"),
  enableAlertsButton: document.querySelector("#enableAlertsButton"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

bindEvents();
hydrateClientState();
initialize();

function bindEvents() {
  elements.categoryGrid.addEventListener("click", handleCategoryClick);
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.tabs.addEventListener("click", handleTabClick);
  elements.itemForm.addEventListener("submit", handleItemSubmit);
  elements.vendorForm.addEventListener("submit", handleVendorSubmit);
  elements.userForm.addEventListener("submit", handleUserSubmit);
  elements.purchaseForm.addEventListener("submit", handlePurchaseSubmit);
  elements.receiptForm.addEventListener("submit", handleReceiptSubmit);
  elements.closingForm.addEventListener("submit", handleClosingSubmit);
  elements.receiptUploadForm.addEventListener("submit", handleReceiptUploadSubmit);
  elements.runOcrPreviewButton.addEventListener("click", handleOcrPreview);
  elements.addReceiptLineButton.addEventListener("click", addReceiptLineRow);
  elements.reportDateInput.addEventListener("change", renderWorkspace);
  elements.kakaoForm.addEventListener("submit", handleKakaoSubmit);
  elements.copyKakaoMessageButton.addEventListener("click", copyKakaoMessage);
  elements.sendKakaoSimulationButton.addEventListener("click", handleKakaoSimulation);
  elements.seedDataButton.addEventListener("click", handleSeedData);
  elements.enableAlertsButton.addEventListener("click", enableAlerts);
}

async function initialize() {
  await loadBootstrap();
  await registerServiceWorker();
  if (state.authToken) {
    try {
      await loadWorkspace();
    } catch {
      clearAuth();
    }
  }
  render();
}

function hydrateClientState() {
  try {
    const stored = JSON.parse(localStorage.getItem(CLIENT_STORAGE_KEY) || "{}");
    state.selectedCategoryId = stored.selectedCategoryId || null;
    state.activeTab = stored.activeTab || "overview";
    state.authToken = stored.authToken || null;
    state.notificationEnabled = Boolean(stored.notificationEnabled);
    state.pushSubscribedByCategory = stored.pushSubscribedByCategory || {};
    state.lastAlarmSignatureByCategory = stored.lastAlarmSignatureByCategory || {};
  } catch {
    // Ignore corrupt local client state.
  }
}

function persistClientState() {
  localStorage.setItem(
    CLIENT_STORAGE_KEY,
    JSON.stringify({
      selectedCategoryId: state.selectedCategoryId,
      activeTab: state.activeTab,
      authToken: state.authToken,
      notificationEnabled: state.notificationEnabled,
      pushSubscribedByCategory: state.pushSubscribedByCategory,
      lastAlarmSignatureByCategory: state.lastAlarmSignatureByCategory,
    }),
  );
}

async function loadBootstrap() {
  const response = await fetch("/api/bootstrap");
  const payload = await response.json();
  state.categories = payload.categories || [];
  state.pushPublicKey = payload.pushPublicKey || "";
}

async function loadWorkspace() {
  const payload = await apiFetch("/api/workspace");
  state.workspaceCategory = payload.category;
  state.currentUser = payload.user;
  state.pushPublicKey = payload.pushPublicKey || state.pushPublicKey;
  upsertCategorySummary(payload.category);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  try {
    state.serviceWorkerRegistration = await navigator.serviceWorker.register("/sw.js");
  } catch {
    state.serviceWorkerRegistration = null;
  }
}

async function apiFetch(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.authToken) {
    headers.Authorization = `Bearer ${state.authToken}`;
  }

  const response = await fetch(url, { ...options, headers });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "request_failed");
  }
  return payload;
}

function render() {
  renderCategoryCards();
  renderGlobalStats();
  renderLoginPanel();
  renderWorkspace();
  updateAlertButton();
}

function renderCategoryCards() {
  elements.categoryGrid.innerHTML = state.categories
    .map((category, index) => {
      const isSelected = state.selectedCategoryId === category.id;
      const isActive = state.workspaceCategory?.id === category.id;
      return `
        <button class="category-card ${isSelected ? "active" : ""}" data-category-id="${category.id}">
          <p class="section-label">카테고리 ${index + 1}</p>
          <strong>${category.name}</strong>
          <small>${category.description}</small>
          <span class="stat-chip">품목 ${category.stats.items}</span>
          <span class="stat-chip">경고 ${category.stats.lowStock}</span>
          <span class="stat-chip">${isActive ? "현재 접속중" : "선택 가능"}</span>
        </button>
      `;
    })
    .join("");
}

function renderGlobalStats() {
  const totalItems = state.categories.reduce((sum, category) => sum + category.stats.items, 0);
  const totalLowStock = state.categories.reduce((sum, category) => sum + category.stats.lowStock, 0);
  const activeName = state.workspaceCategory?.name || "없음";
  elements.globalStats.innerHTML = `
    <span class="stat-chip">전체 카테고리 ${state.categories.length}</span>
    <span class="stat-chip">전체 품목 ${totalItems}</span>
    <span class="stat-chip">전체 경고 ${totalLowStock}</span>
    <span class="stat-chip">현재 작업 ${activeName}</span>
  `;
}

function renderLoginPanel() {
  const category = getSelectedCategory();
  if (!category) {
    elements.selectedCategoryBadge.textContent = "카테고리를 선택하세요.";
    elements.loginHint.textContent = "";
    return;
  }

  elements.selectedCategoryBadge.textContent = `${category.name} 로그인`;
  elements.loginHint.textContent =
    "기본 계정 예시: manager / 1234, staff / 1111. 카테고리별 계정은 각각 분리됩니다.";
}

function renderWorkspace() {
  const category = state.workspaceCategory;
  const user = state.currentUser;

  if (!category || !user) {
    elements.workspacePanel.classList.add("hidden");
    return;
  }

  elements.workspacePanel.classList.remove("hidden");
  elements.workspaceTitle.textContent = `${category.name} 재고 관리`;
  elements.currentUserBadge.textContent = `${user.displayName} · ${user.role === "manager" ? "관리자" : "직원"}`;
  syncTabState();
  renderWorkspaceStats(category);
  renderInventoryTable(category);
  renderItemList(category);
  renderVendorList(category);
  renderUserSection(category, user);
  renderOrderForms(category);
  renderOrderList(category);
  renderClosingList(category);
  renderReceiptUploadList(category);
  renderDailyReport(category);
  renderKakaoSection(category);
  renderOcrPreview(category);
  syncReceiptLineRows(category);
}

function syncTabState() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.activeTab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === state.activeTab);
  });
}

function renderWorkspaceStats(category) {
  const lowStockItems = getLowStockItems(category);
  const todaysClosings = getCategoryClosingsByDate(category, getTodayDateKey());
  const openOrders = category.purchaseOrders.filter((order) => order.status !== "received");

  elements.metricItems.textContent = String(category.items.length);
  elements.metricLowStock.textContent = String(lowStockItems.length);
  elements.metricOpenOrders.textContent = String(openOrders.length);
  elements.metricTodayClosings.textContent = String(todaysClosings.length);

  if (!lowStockItems.length) {
    elements.workspaceAlert.classList.add("hidden");
    elements.workspaceAlert.textContent = "";
    state.lastAlarmSignatureByCategory[category.id] = "";
    persistClientState();
    return;
  }

  const names = lowStockItems.map((item) => item.name).join(", ");
  elements.workspaceAlert.classList.remove("hidden");
  elements.workspaceAlert.textContent = `${names} 품목이 기준 재고 이하입니다. 발주 검토가 필요합니다.`;
  triggerAlertsIfNeeded(category, lowStockItems);
}

function renderInventoryTable(category) {
  elements.inventoryTableBody.innerHTML = category.items.length
    ? category.items
        .map((item) => {
          const shortage = roundNumber(Math.max(0, item.parStock - item.currentStock));
          const status =
            shortage === 0
              ? '<span class="status-chip status-ok">정상</span>'
              : shortage <= item.parStock * 0.3
                ? '<span class="status-chip status-warning">발주 필요</span>'
                : '<span class="status-chip status-danger">긴급</span>';

          return `
            <tr class="${shortage > 0 ? "low-stock" : ""}">
              <td>${item.name}</td>
              <td>${formatQuantity(item.currentStock)} ${item.unit}</td>
              <td>${formatQuantity(item.parStock)} ${item.unit}</td>
              <td>${formatQuantity(shortage)} ${item.unit}</td>
              <td>${status}</td>
            </tr>
          `;
        })
        .join("")
    : '<tr><td colspan="5">품목을 먼저 등록하세요.</td></tr>';
}

function renderItemList(category) {
  renderList(
    elements.itemList,
    category.items.map(
      (item) => `
        <li class="activity-item">
          <p class="activity-title">${item.name}</p>
          <p class="activity-meta">현재 ${formatQuantity(item.currentStock)} ${item.unit} / 기준 ${formatQuantity(item.parStock)} ${item.unit}</p>
        </li>
      `,
    ),
  );
}

function renderVendorList(category) {
  renderList(
    elements.vendorList,
    category.vendors.map(
      (vendor) => `
        <li class="activity-item">
          <p class="activity-title">${vendor.name}</p>
          <p class="activity-meta">${vendor.contactPerson} · ${vendor.phone} · 카카오 ${vendor.kakaoId || "미등록"}</p>
        </li>
      `,
    ),
  );
}

function renderUserSection(category, user) {
  const isManager = user.role === "manager";
  elements.userAdminNotice.textContent = isManager
    ? "관리자 권한으로 사용자 계정을 추가할 수 있습니다."
    : "직원 계정은 사용자 목록만 볼 수 있습니다.";
  [...elements.userForm.elements].forEach((field) => {
    field.disabled = !isManager;
  });

  renderList(
    elements.userList,
    category.users.map(
      (member) => `
        <li class="activity-item">
          <p class="activity-title">${member.displayName}</p>
          <p class="activity-meta">${member.username} · ${member.role === "manager" ? "관리자" : "직원"}</p>
        </li>
      `,
    ),
  );
}

function renderOrderForms(category) {
  elements.purchaseItemSelect.innerHTML = buildItemOptions(category.items);
  elements.closingItemSelect.innerHTML = buildItemOptions(category.items);
  elements.purchaseVendorSelect.innerHTML = category.vendors.length
    ? category.vendors.map((vendor) => `<option value="${vendor.id}">${vendor.name}</option>`).join("")
    : '<option value="">거래처를 먼저 등록하세요</option>';
  elements.receiptOrderSelect.innerHTML = category.purchaseOrders.filter((order) => order.status !== "received").length
    ? category.purchaseOrders
        .filter((order) => order.status !== "received")
        .map((order) => {
          const item = findById(category.items, order.itemId);
          const vendor = findById(category.vendors, order.vendorId);
          return `<option value="${order.id}">${item?.name ?? "삭제된 품목"} / ${formatQuantity(order.quantity)} / ${vendor?.name ?? "삭제된 거래처"}</option>`;
        })
        .join("")
    : '<option value="">처리할 발주가 없습니다</option>';
}

function buildItemOptions(items) {
  return items.length
    ? items
        .map(
          (item) =>
            `<option value="${item.id}">${item.name} (${formatQuantity(item.currentStock)} ${item.unit})</option>`,
        )
        .join("")
    : '<option value="">품목을 먼저 등록하세요</option>';
}

function renderOrderList(category) {
  renderList(
    elements.purchaseList,
    category.purchaseOrders.map((order) => {
      const item = findById(category.items, order.itemId);
      const vendor = findById(category.vendors, order.vendorId);
      const statusLabel =
        order.status === "received"
          ? `입고 완료 ${formatQuantity(order.receivedQuantity)} ${item?.unit ?? ""}`
          : "입고 대기";
      return `
        <li class="activity-item">
          <p class="activity-title">${item?.name ?? "삭제된 품목"} ${formatQuantity(order.quantity)} ${item?.unit ?? ""}</p>
          <p class="activity-meta">${vendor?.name ?? "삭제된 거래처"} · ${statusLabel} · ${formatDateTime(order.createdAt)}</p>
        </li>
      `;
    }),
  );
}

function renderClosingList(category) {
  renderList(
    elements.closingList,
    [...category.closings]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((closing) => {
        const item = findById(category.items, closing.itemId);
        return `
          <li class="activity-item">
            <p class="activity-title">${item?.name ?? "삭제된 품목"} ${formatQuantity(closing.usedQuantity)} ${item?.unit ?? ""} 차감</p>
            <p class="activity-meta">${closing.sourceLabel} · ${closing.note || "메모 없음"} · ${formatDateTime(closing.createdAt)}</p>
          </li>
        `;
      }),
  );
}

function renderReceiptUploadList(category) {
  renderList(
    elements.receiptUploadList,
    [...category.receiptUploads]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((upload) => {
        const preview = upload.previewDataUrl
          ? `<img src="${upload.previewDataUrl}" alt="영수증 미리보기" class="receipt-preview" />`
          : "";
        const summary = upload.lines
          .map((line) => {
            const item = findById(category.items, line.itemId);
            return `${item?.name ?? "삭제된 품목"} ${formatQuantity(line.quantity)}${item?.unit ?? ""}`;
          })
          .join(", ");
        return `
          <li class="activity-item">
            ${preview}
            <p class="activity-title">${upload.fileName}</p>
            <p class="activity-meta">${summary}</p>
            <p class="activity-meta">${upload.note || "메모 없음"} · ${formatDateTime(upload.createdAt)}</p>
          </li>
        `;
      }),
  );
}

function renderDailyReport(category) {
  const dateKey = elements.reportDateInput.value || getTodayDateKey();
  if (!elements.reportDateInput.value) {
    elements.reportDateInput.value = dateKey;
  }
  const closings = getCategoryClosingsByDate(category, dateKey);
  const totalUsage = closings.reduce((sum, closing) => sum + closing.usedQuantity, 0);
  const lines = closings
    .map((closing) => {
      const item = findById(category.items, closing.itemId);
      return `${item?.name ?? "삭제된 품목"} ${formatQuantity(closing.usedQuantity)} ${item?.unit ?? ""} / ${closing.sourceLabel}`;
    })
    .join("<br />");

  elements.dailyReportCard.innerHTML = `
    <p class="activity-title">${formatDateOnly(dateKey)} 리포트</p>
    <p class="activity-meta">차감 건수 ${closings.length}건 / 총 사용량 ${formatQuantity(totalUsage)}</p>
    <p class="activity-meta">기준 재고 이하 품목 ${getLowStockItems(category).length}건</p>
    <p class="activity-meta">${lines || "해당 날짜의 차감 기록이 없습니다."}</p>
  `;
}

function renderKakaoSection(category) {
  elements.kakaoForm.senderName.value = category.kakaoConfig.senderName || "";
  elements.kakaoForm.channelId.value = category.kakaoConfig.channelId || "";
  elements.kakaoForm.notes.value = category.kakaoConfig.notes || "";
  elements.kakaoMessageOutput.value = buildKakaoMessage(category);
  elements.kakaoDispatchStatus.innerHTML = category.lastKakaoDispatch
    ? `
        <p class="activity-title">최근 전송 요청</p>
        <p class="activity-meta">${category.lastKakaoDispatch.mode} · ${category.lastKakaoDispatch.requestedBy}</p>
        <p class="activity-meta">${formatDateTime(category.lastKakaoDispatch.requestedAt)}</p>
      `
    : '<p class="activity-meta">아직 전송 요청이 없습니다.</p>';
}

function renderOcrPreview(category) {
  const preview = category.lastOcrPreview;
  elements.ocrPreviewResult.innerHTML = preview
    ? `
        <p class="activity-title">최근 OCR 미리보기</p>
        <p class="activity-meta">${formatDateTime(preview.requestedAt)}</p>
        <p class="activity-meta">${
          preview.matchedItems.length
            ? preview.matchedItems.map((item) => `${item.name} ${item.suggestedQuantity}`).join(", ")
            : "매칭된 품목이 없습니다."
        }</p>
      `
    : '<p class="activity-meta">아직 실행된 OCR 미리보기가 없습니다.</p>';
}

function renderList(container, lines) {
  container.innerHTML = lines.length ? lines.join("") : elements.emptyStateTemplate.innerHTML;
}

function handleCategoryClick(event) {
  const button = event.target.closest("[data-category-id]");
  if (!button) {
    return;
  }
  state.selectedCategoryId = button.dataset.categoryId;
  persistClientState();
  render();
}

async function handleLogin(event) {
  event.preventDefault();
  const category = getSelectedCategory();
  if (!category) {
    window.alert("먼저 카테고리를 선택하세요.");
    return;
  }
  const formData = new FormData(event.currentTarget);
  try {
    const payload = await apiFetch("/api/login", {
      method: "POST",
      body: JSON.stringify({
        categoryId: category.id,
        username: String(formData.get("username")).trim(),
        password: String(formData.get("password")).trim(),
      }),
    });
    state.authToken = payload.token;
    state.currentUser = payload.user;
    state.activeTab = "overview";
    persistClientState();
    await loadWorkspace();
    event.currentTarget.reset();
    render();
  } catch {
    window.alert("로그인 정보가 맞지 않습니다.");
  }
}

async function handleLogout() {
  try {
    await apiFetch("/api/logout", { method: "POST", body: JSON.stringify({}) });
  } catch {
    // Ignore logout transport errors.
  }
  clearAuth();
  render();
}

function clearAuth() {
  state.authToken = null;
  state.workspaceCategory = null;
  state.currentUser = null;
  persistClientState();
}

function handleTabClick(event) {
  const button = event.target.closest("[data-tab]");
  if (!button) {
    return;
  }
  state.activeTab = button.dataset.tab;
  persistClientState();
  renderWorkspace();
}

async function handleItemSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  await mutateWorkspace("/api/items", {
    name: String(formData.get("name")).trim(),
    unit: String(formData.get("unit")).trim(),
    currentStock: Number(formData.get("currentStock")),
    parStock: Number(formData.get("parStock")),
  });
  event.currentTarget.reset();
}

async function handleVendorSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  await mutateWorkspace("/api/vendors", {
    name: String(formData.get("name")).trim(),
    contactPerson: String(formData.get("contactPerson")).trim(),
    phone: String(formData.get("phone")).trim(),
    kakaoId: String(formData.get("kakaoId")).trim(),
  });
  event.currentTarget.reset();
}

async function handleUserSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const response = await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify({
        username: String(formData.get("username")).trim(),
        displayName: String(formData.get("displayName")).trim(),
        role: String(formData.get("role")).trim(),
        password: String(formData.get("password")).trim(),
      }),
    });
    state.workspaceCategory = response.category;
    event.currentTarget.reset();
    render();
  } catch {
    window.alert("사용자 추가는 관리자만 가능하며, 중복 ID는 사용할 수 없습니다.");
  }
}

async function handlePurchaseSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    await mutateWorkspace("/api/purchase-orders", {
      itemId: String(formData.get("itemId")),
      quantity: Number(formData.get("quantity")),
      vendorId: String(formData.get("vendorId")),
    });
    event.currentTarget.reset();
  } catch (error) {
    window.alert("발주 생성 중 오류가 발생했습니다.");
  }
}

async function handleReceiptSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    await mutateWorkspace("/api/receipts", {
      purchaseOrderId: String(formData.get("purchaseOrderId")),
      receivedQuantity: Number(formData.get("receivedQuantity")),
    });
    event.currentTarget.reset();
  } catch {
    window.alert("입고 처리 중 오류가 발생했습니다.");
  }
}

async function handleClosingSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  await mutateWorkspace("/api/closings", {
    itemId: String(formData.get("itemId")),
    usedQuantity: Number(formData.get("usedQuantity")),
    note: String(formData.get("note")).trim(),
    sourceLabel: "수동 마감",
    createdAt: new Date().toISOString(),
  });
  event.currentTarget.reset();
}

async function handleReceiptUploadSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const file = formData.get("receiptImage");
  const lines = readReceiptRows();
  if (!file || file.size === 0) {
    window.alert("영수증 이미지를 선택하세요.");
    return;
  }
  if (!lines.length) {
    window.alert("차감할 품목을 한 줄 이상 입력하세요.");
    return;
  }
  const previewDataUrl = await fileToDataUrl(file);
  await mutateWorkspace("/api/receipt-uploads", {
    fileName: file.name,
    fileSize: file.size,
    note: String(formData.get("note")).trim(),
    createdAt: formData.get("usageDate")
      ? new Date(String(formData.get("usageDate"))).toISOString()
      : new Date().toISOString(),
    previewDataUrl,
    lines,
  });
  event.currentTarget.reset();
  elements.receiptLineItems.innerHTML = "";
  addReceiptLineRow();
}

async function handleKakaoSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  await mutateWorkspace("/api/kakao-config", {
    senderName: String(formData.get("senderName")).trim(),
    channelId: String(formData.get("channelId")).trim(),
    notes: String(formData.get("notes")).trim(),
  });
}

async function handleKakaoSimulation() {
  try {
    const response = await apiFetch("/api/integrations/kakao/send-order", {
      method: "POST",
      body: JSON.stringify({
        message: elements.kakaoMessageOutput.value,
      }),
    });
    state.workspaceCategory.lastKakaoDispatch = response.kakao.lastDispatch;
    renderWorkspace();
  } catch {
    window.alert("카카오 전송 시뮬레이션은 관리자만 실행할 수 있습니다.");
  }
}

async function handleOcrPreview() {
  try {
    const response = await apiFetch("/api/integrations/ocr/preview", {
      method: "POST",
      body: JSON.stringify({
        receiptText: elements.ocrPreviewInput.value,
      }),
    });
    state.workspaceCategory.lastOcrPreview = response.ocrPreview;
    renderWorkspace();
  } catch {
    window.alert("OCR 미리보기 실행 중 오류가 발생했습니다.");
  }
}

async function copyKakaoMessage() {
  const message = elements.kakaoMessageOutput.value;
  try {
    await navigator.clipboard.writeText(message);
  } catch {
    elements.kakaoMessageOutput.select();
    document.execCommand("copy");
  }
}

async function handleSeedData() {
  await fetch("/api/seed", { method: "POST" });
  clearAuth();
  await loadBootstrap();
  render();
}

async function mutateWorkspace(url, payload) {
  try {
    const response = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.workspaceCategory = response.category;
    upsertCategorySummary(response.category);
    persistClientState();
    render();
  } catch (error) {
    window.alert("처리 중 오류가 발생했습니다.");
    throw error;
  }
}

async function enableAlerts() {
  if (!state.workspaceCategory) {
    window.alert("먼저 카테고리를 선택하고 로그인하세요.");
    return;
  }
  if (!("Notification" in window)) {
    window.alert("이 브라우저는 알림을 지원하지 않습니다.");
    return;
  }
  const permission = await Notification.requestPermission();
  state.notificationEnabled = permission === "granted";
  if (!state.notificationEnabled) {
    persistClientState();
    render();
    return;
  }

  if (!("PushManager" in window) || !state.serviceWorkerRegistration || !state.pushPublicKey) {
    persistClientState();
    render();
    return;
  }

  try {
    const subscription =
      (await state.serviceWorkerRegistration.pushManager.getSubscription()) ||
      (await state.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(state.pushPublicKey),
      }));

    await apiFetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    });
    state.pushSubscribedByCategory[state.workspaceCategory.id] = true;
  } catch {
    window.alert("브라우저 푸시 구독 중 오류가 발생했습니다.");
  }
  persistClientState();
  render();
}

function addReceiptLineRow() {
  const items = state.workspaceCategory?.items || [];
  const wrapper = document.createElement("div");
  wrapper.className = "line-item";
  wrapper.innerHTML = `
    <select name="receiptItemId" required>${buildItemOptions(items)}</select>
    <input name="receiptQuantity" type="number" min="0.1" step="0.1" placeholder="차감 수량" required />
    <button type="button" class="secondary-button">삭제</button>
  `;
  wrapper.querySelector("button").addEventListener("click", () => wrapper.remove());
  elements.receiptLineItems.appendChild(wrapper);
}

function syncReceiptLineRows(category) {
  if (state.activeTab !== "receipt") {
    return;
  }
  if (!elements.receiptLineItems.children.length && category.items.length) {
    addReceiptLineRow();
  }
}

function readReceiptRows() {
  return [...elements.receiptLineItems.querySelectorAll(".line-item")]
    .map((row) => ({
      itemId: row.querySelector('[name="receiptItemId"]').value,
      quantity: Number(row.querySelector('[name="receiptQuantity"]').value),
    }))
    .filter((row) => row.itemId && row.quantity > 0);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

function upsertCategorySummary(category) {
  const summary = {
    id: category.id,
    name: category.name,
    description: category.description,
    displayOrder: category.displayOrder,
    stats: {
      items: category.items.length,
      lowStock: getLowStockItems(category).length,
      openOrders: category.purchaseOrders.filter((order) => order.status !== "received").length,
    },
  };
  const index = state.categories.findIndex((entry) => entry.id === category.id);
  if (index >= 0) {
    state.categories[index] = summary;
  } else {
    state.categories.push(summary);
  }
}

function buildKakaoMessage(category) {
  const lowStockLines = getLowStockItems(category)
    .map((item) => `- ${item.name}: 현재 ${formatQuantity(item.currentStock)} ${item.unit} / 기준 ${formatQuantity(item.parStock)} ${item.unit}`)
    .join("\n");
  const orderLines = category.purchaseOrders
    .filter((order) => order.status !== "received")
    .map((order) => {
      const item = findById(category.items, order.itemId);
      const vendor = findById(category.vendors, order.vendorId);
      return `- ${item?.name ?? "삭제된 품목"} ${formatQuantity(order.quantity)} ${item?.unit ?? ""} / 거래처 ${vendor?.name ?? "미등록"}`;
    })
    .join("\n");

  return [
    `[발주 알림] ${category.kakaoConfig.senderName || "샵앤샵 평택1호점"} / ${category.name}`,
    `카카오 채널: ${category.kakaoConfig.channelId || "미설정"}`,
    "",
    "기준 재고 이하 품목",
    lowStockLines || "- 없음",
    "",
    "미입고 발주 현황",
    orderLines || "- 없음",
    "",
    `메모: ${category.kakaoConfig.notes || "없음"}`,
    "",
    "실제 자동 전송은 서버와 카카오 API 연동이 추가로 필요합니다.",
  ].join("\n");
}

function triggerAlertsIfNeeded(category, lowStockItems) {
  const signature = lowStockItems
    .map((item) => `${item.id}:${item.currentStock}`)
    .sort()
    .join("|");
  if (state.lastAlarmSignatureByCategory[category.id] === signature) {
    return;
  }
  state.lastAlarmSignatureByCategory[category.id] = signature;
  persistClientState();
  playAlarm();
  if (state.notificationEnabled && "Notification" in window && Notification.permission === "granted") {
    new Notification(`${category.name} 재고 경고`, {
      body: `${lowStockItems.map((item) => item.name).join(", ")} 기준 재고 이하`,
    });
  }
}

function updateAlertButton() {
  const categoryId = state.workspaceCategory?.id;
  const pushSubscribed = categoryId ? state.pushSubscribedByCategory[categoryId] : false;
  if (pushSubscribed) {
    elements.enableAlertsButton.textContent = "브라우저 푸시 활성화됨";
  } else if (state.notificationEnabled) {
    elements.enableAlertsButton.textContent = "브라우저 알림 허용됨";
  } else {
    elements.enableAlertsButton.textContent = "브라우저 푸시 켜기";
  }
  elements.enableAlertsButton.disabled = Boolean(pushSubscribed);
}

function playAlarm() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(420, audioContext.currentTime + 0.4);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.55);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.55);
  } catch {
    // Browsers may block audio until there is a user gesture.
  }
}

function getSelectedCategory() {
  return state.categories.find((category) => category.id === state.selectedCategoryId) || null;
}

function getLowStockItems(category) {
  return category.items.filter((item) => item.currentStock <= item.parStock);
}

function getCategoryClosingsByDate(category, dateKey) {
  return category.closings.filter((closing) => toDateKey(closing.createdAt) === dateKey);
}

function findById(collection, id) {
  return collection.find((entry) => entry.id === id) || null;
}

function formatQuantity(value) {
  return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
}

function getTodayDateKey() {
  return toDateKey(new Date().toISOString());
}

function toDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function roundNumber(value) {
  return Math.round(value * 10) / 10;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
