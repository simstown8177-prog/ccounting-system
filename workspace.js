const CLIENT_STORAGE_KEY = "shop-n-shop-client-v1";

const clientState = readClientState();

const state = {
  selectedCategoryId: clientState.selectedCategoryId || null,
  activeTab: clientState.activeTab || "overview",
  authToken: clientState.authToken || null,
  notificationEnabled: Boolean(clientState.notificationEnabled),
  pushPublicKey: "",
  pushSubscribedByCategory: clientState.pushSubscribedByCategory || {},
  workspaceCategory: null,
  currentUser: null,
  lastAlarmSignatureByCategory: clientState.lastAlarmSignatureByCategory || {},
  serviceWorkerRegistration: null,
};

const elements = {
  workspaceBrandTitle: document.querySelector("#workspaceBrandTitle"),
  workspaceTitle: document.querySelector("#workspaceTitle"),
  workspaceSubtitle: document.querySelector("#workspaceSubtitle"),
  currentCategoryBadge: document.querySelector("#currentCategoryBadge"),
  currentUserBadge: document.querySelector("#currentUserBadge"),
  logoutButton: document.querySelector("#logoutButton"),
  enableAlertsButton: document.querySelector("#enableAlertsButton"),
  tabs: document.querySelector("#workspaceTabs"),
  workspaceAlert: document.querySelector("#workspaceAlert"),
  metricItems: document.querySelector("#metricItems"),
  metricLowStock: document.querySelector("#metricLowStock"),
  metricOpenOrders: document.querySelector("#metricOpenOrders"),
  metricTodayClosings: document.querySelector("#metricTodayClosings"),
  inventoryTableBody: document.querySelector("#inventoryTableBody"),
  itemForm: document.querySelector("#itemForm"),
  vendorForm: document.querySelector("#vendorForm"),
  userForm: document.querySelector("#userForm"),
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
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

bindEvents();
initialize();

function bindEvents() {
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.enableAlertsButton.addEventListener("click", enableAlerts);
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
}

async function initialize() {
  if (!state.authToken) {
    redirectToLogin();
    return;
  }

  await registerServiceWorker();

  try {
    await loadWorkspace();
  } catch (error) {
    clearAuth();
    redirectToLogin();
    return;
  }

  render();
}

async function loadWorkspace() {
  const payload = await apiFetch("/api/workspace");
  state.workspaceCategory = payload.category;
  state.currentUser = payload.user;
  state.pushPublicKey = payload.pushPublicKey || "";
  state.selectedCategoryId = payload.category.id;
  persistClientState();
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
    const error = new Error(payload.message || payload.error || "request_failed");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function render() {
  renderWorkspaceFrame();
  syncTabState();
  renderWorkspace();
  updateAlertButton();
}

function renderWorkspaceFrame() {
  const category = state.workspaceCategory;
  const user = state.currentUser;
  if (!category || !user) {
    return;
  }

  elements.workspaceBrandTitle.textContent = category.name;
  elements.workspaceTitle.textContent = `${category.name} 재고관리 워크스페이스`;
  elements.workspaceSubtitle.textContent = `${category.description} 운영 데이터를 이 페이지에서만 관리합니다.`;
  elements.currentCategoryBadge.textContent = `카테고리 ${category.displayOrder}`;
  elements.currentUserBadge.textContent = `${user.displayName} · ${user.role === "manager" ? "관리자" : "직원"}`;
}

function renderWorkspace() {
  const category = state.workspaceCategory;
  const user = state.currentUser;
  if (!category || !user) {
    return;
  }

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
    category.closings.map((closing) => {
      const item = findById(category.items, closing.itemId);
      return `
        <li class="activity-item">
          <p class="activity-title">${item?.name ?? "삭제된 품목"} ${formatQuantity(closing.usedQuantity)} ${item?.unit ?? ""}</p>
          <p class="activity-meta">${closing.sourceLabel} · ${closing.note || "메모 없음"} · ${formatDateTime(closing.createdAt)}</p>
        </li>
      `;
    }),
  );
}

function renderReceiptUploadList(category) {
  renderList(
    elements.receiptUploadList,
    category.receiptUploads.map((upload) => `
      <li class="activity-item">
        <p class="activity-title">${upload.fileName}</p>
        <p class="activity-meta">${upload.lines.length}개 품목 차감 · ${upload.note || "메모 없음"} · ${formatDateTime(upload.createdAt)}</p>
      </li>
    `),
  );
}

function renderDailyReport(category) {
  const dateKey = elements.reportDateInput.value || getTodayDateKey();
  if (!elements.reportDateInput.value) {
    elements.reportDateInput.value = dateKey;
  }

  const closings = getCategoryClosingsByDate(category, dateKey);
  if (!closings.length) {
    elements.dailyReportCard.innerHTML = `${dateKey} 기준 차감 이력이 없습니다.`;
    return;
  }

  const lines = closings.map((closing) => {
    const item = findById(category.items, closing.itemId);
    return `${formatTime(closing.createdAt)} · ${item?.name ?? "삭제된 품목"} · ${formatQuantity(closing.usedQuantity)} ${item?.unit ?? ""} · ${closing.sourceLabel}`;
  });
  elements.dailyReportCard.innerHTML = lines.join("<br />");
}

function renderKakaoSection(category) {
  if (category.kakaoConfig) {
    elements.kakaoForm.elements.senderName.value = category.kakaoConfig.senderName || "";
    elements.kakaoForm.elements.channelId.value = category.kakaoConfig.channelId || "";
    elements.kakaoForm.elements.notes.value = category.kakaoConfig.notes || "";
  }

  elements.kakaoMessageOutput.value = buildKakaoMessage(category);
  const dispatch = category.lastKakaoDispatch;
  elements.kakaoDispatchStatus.innerHTML = dispatch
    ? `${formatDateTime(dispatch.requestedAt)} · ${dispatch.requestedBy} · ${dispatch.mode}`
    : "아직 전송 시뮬레이션 이력이 없습니다.";
}

function renderOcrPreview(category) {
  const preview = category.lastOcrPreview;
  if (!preview) {
    elements.ocrPreviewResult.innerHTML = "영수증 텍스트를 넣고 OCR 미리보기를 실행하면 여기에 결과가 표시됩니다.";
    return;
  }

  elements.ocrPreviewResult.innerHTML = preview.matchedItems.length
    ? preview.matchedItems.map((item) => `${item.name} · 추천 수량 ${formatQuantity(item.suggestedQuantity)}`).join("<br />")
    : "일치하는 등록 품목을 찾지 못했습니다.";
}

function renderList(target, items) {
  if (!items.length) {
    target.innerHTML = elements.emptyStateTemplate.innerHTML;
    return;
  }
  target.innerHTML = items.join("");
}

function handleTabClick(event) {
  const button = event.target.closest("[data-tab]");
  if (!button) {
    return;
  }
  state.activeTab = button.dataset.tab;
  persistClientState();
  syncTabState();
  renderWorkspace();
}

async function handleLogout() {
  try {
    await apiFetch("/api/logout", { method: "POST", body: JSON.stringify({}) });
  } catch {
    // Ignore transport errors while logging out.
  }

  clearAuth();
  redirectToLogin();
}

function clearAuth() {
  state.authToken = null;
  state.workspaceCategory = null;
  state.currentUser = null;
  persistClientState();
}

function redirectToLogin() {
  const categoryId = state.selectedCategoryId ? `?categoryId=${encodeURIComponent(state.selectedCategoryId)}` : "";
  window.location.href = `/login.html${categoryId}`;
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
    persistClientState();
    event.currentTarget.reset();
    render();
  } catch (error) {
    handleWorkspaceError(error, "사용자 추가는 관리자만 가능하며, 중복 ID는 사용할 수 없습니다.");
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
    handleWorkspaceError(error, "발주 생성 중 오류가 발생했습니다.");
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
  } catch (error) {
    handleWorkspaceError(error, "입고 처리 중 오류가 발생했습니다.");
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
      body: JSON.stringify({ message: elements.kakaoMessageOutput.value }),
    });
    state.workspaceCategory.lastKakaoDispatch = response.kakao.lastDispatch;
    renderKakaoSection(state.workspaceCategory);
  } catch (error) {
    handleWorkspaceError(error, "카카오 전송 시뮬레이션 중 오류가 발생했습니다.");
  }
}

async function handleOcrPreview() {
  try {
    const response = await apiFetch("/api/integrations/ocr/preview", {
      method: "POST",
      body: JSON.stringify({ receiptText: elements.ocrPreviewInput.value }),
    });
    state.workspaceCategory.lastOcrPreview = response.ocrPreview;
    renderOcrPreview(state.workspaceCategory);
  } catch (error) {
    handleWorkspaceError(error, "OCR 미리보기 실행 중 오류가 발생했습니다.");
  }
}

async function mutateWorkspace(url, payload) {
  try {
    const response = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.workspaceCategory = response.category;
    persistClientState();
    render();
    return response;
  } catch (error) {
    handleWorkspaceError(error, "처리 중 오류가 발생했습니다.");
    throw error;
  }
}

function handleWorkspaceError(error, fallbackMessage) {
  if (error.status === 401) {
    clearAuth();
    redirectToLogin();
    return;
  }

  window.alert(fallbackMessage);
}

async function enableAlerts() {
  if (!state.workspaceCategory) {
    window.alert("먼저 로그인하고 워크스페이스를 여세요.");
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
    updateAlertButton();
    return;
  }

  if (!("PushManager" in window) || !state.serviceWorkerRegistration || !state.pushPublicKey) {
    persistClientState();
    updateAlertButton();
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
  updateAlertButton();
}

function updateAlertButton() {
  const categoryId = state.workspaceCategory?.id;
  const pushSubscribed = categoryId ? state.pushSubscribedByCategory[categoryId] : false;
  if (pushSubscribed) {
    elements.enableAlertsButton.textContent = "브라우저 푸시 활성화됨";
  } else if (state.notificationEnabled) {
    elements.enableAlertsButton.textContent = "브라우저 알림 허용됨";
  } else {
    elements.enableAlertsButton.textContent = "브라우저 알림";
  }
  elements.enableAlertsButton.disabled = Boolean(pushSubscribed);
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

function copyKakaoMessage() {
  const message = elements.kakaoMessageOutput.value;
  navigator.clipboard.writeText(message).catch(() => {
    elements.kakaoMessageOutput.select();
    document.execCommand("copy");
  });
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
    // Browsers may block audio until a user gesture exists.
  }
}

function getLowStockItems(category) {
  return category.items.filter((item) => item.currentStock <= item.parStock);
}

function getCategoryClosingsByDate(category, dateKey) {
  return category.closings.filter((closing) => toDateKey(closing.createdAt) === dateKey);
}

function getTodayDateKey() {
  return toDateKey(new Date().toISOString());
}

function toDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function findById(collection, id) {
  return collection.find((entry) => entry.id === id) || null;
}

function formatQuantity(value) {
  return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function roundNumber(value) {
  return Math.round(Number(value) * 10) / 10;
}

function urlBase64ToUint8Array(base64String) {
  const padded = `${base64String}=`.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
}

function readClientState() {
  try {
    return JSON.parse(localStorage.getItem(CLIENT_STORAGE_KEY) || "{}");
  } catch {
    return {};
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
