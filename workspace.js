const CLIENT_STORAGE_KEY = "shop-n-shop-client-v1";
const XLSX_CDN_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
const TESSERACT_CDN_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const INVENTORY_IMPORT_ALIASES = {
  id: ["id", "품목id", "itemid", "itemcode", "item_id"],
  productCode: ["상품코드", "상품 코드", "품목코드", "품목 코드", "productcode", "product_code", "code"],
  name: ["품목명", "품명", "상품명", "상품 명", "품목", "name", "itemname", "productname", "item"],
  category: ["카테고리", "category"],
  unit: ["단위", "단위명", "규격", "unit", "unitname"],
  quantityUnit: ["입수량", "입수 수량", "수량단위", "수량 단위", "quantityunit", "quantity_unit", "packunit", "pack_unit"],
  origin: ["원산지", "origin"],
  storageType: ["보관방법", "보관 방법", "보관방식", "보관 방식", "storagetype", "storagemethod"],
  storageLocation: ["보관위치", "보관 위치", "위치", "storagelocation", "storage_location", "location"],
  purchasePrice: ["구매금액", "구매 금액", "매입가", "금액", "총금액", "purchaseprice", "purchase_price", "price", "amount", "totalamount"],
  taxType: ["과세구분", "과세 구분", "과/면세", "과세여부", "과세 여부", "과세", "면세", "taxtype", "taxstatus", "taxcategory"],
  currentStock: ["현재재고", "현재 재고", "현재수량", "현재 수량", "재고", "currentstock", "current_stock", "stock", "quantity"],
  parStock: ["기준재고", "기준 재고", "최소재고", "최소 재고", "안전재고", "안전 재고", "parstock", "par_stock", "minstock", "safetystock"],
};

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
  inventorySearch: "",
  inventoryStatusFilter: "all",
  inventoryCategoryFilter: clientState.inventoryCategoryFilter || "all",
};

const elements = {
  workspaceBrandTitle: document.querySelector("#workspaceBrandTitle"),
  currentCategoryBadge: document.querySelector("#currentCategoryBadge"),
  currentUserBadge: document.querySelector("#currentUserBadge"),
  sidebarBrandButton: document.querySelector("#sidebarBrandButton"),
  sidebarMenuButton: document.querySelector("#sidebarMenuButton"),
  sidebarMenu: document.querySelector("#sidebarMenu"),
  sidebarExportButton: document.querySelector("#sidebarExportButton"),
  sidebarAlertsButton: document.querySelector("#sidebarAlertsButton"),
  sidebarLogoutButton: document.querySelector("#sidebarLogoutButton"),
  openUsersTabButton: document.querySelector("#openUsersTabButton"),
  inventorySearchInput: document.querySelector("#inventorySearchInput"),
  inventoryStatusFilter: document.querySelector("#inventoryStatusFilter"),
  tabs: document.querySelector("#workspaceTabs"),
  metricItems: document.querySelector("#metricItems"),
  metricLowStock: document.querySelector("#metricLowStock"),
  metricOpenOrders: document.querySelector("#metricOpenOrders"),
  metricTodayClosings: document.querySelector("#metricTodayClosings"),
  inventoryTableBody: document.querySelector("#inventoryTableBody"),
  itemForm: document.querySelector("#itemForm"),
  itemModal: document.querySelector("#itemModal"),
  itemModalTitle: document.querySelector("#itemModalTitle"),
  openItemModalButton: document.querySelector("#openItemModalButton"),
  closeItemModalButton: document.querySelector("#closeItemModalButton"),
  resetItemFormButton: document.querySelector("#resetItemFormButton"),
  itemSubmitButton: document.querySelector("#itemSubmitButton"),
  inventoryImportFile: document.querySelector("#inventoryImportFile"),
  inventoryImportButton: document.querySelector("#inventoryImportButton"),
  inventoryCategoryTabs: document.querySelector("#inventoryCategoryTabs"),
  inventoryCategoryNotice: document.querySelector("#inventoryCategoryNotice"),
  renameCategoryButton: document.querySelector("#renameCategoryButton"),
  deleteCategoryButton: document.querySelector("#deleteCategoryButton"),
  vendorForm: document.querySelector("#vendorForm"),
  userForm: document.querySelector("#userForm"),
  purchaseForm: document.querySelector("#purchaseForm"),
  purchaseEstimateCard: document.querySelector("#purchaseEstimateCard"),
  orderSummaryCard: document.querySelector("#orderSummaryCard"),
  receiptForm: document.querySelector("#receiptForm"),
  receiptUploadForm: document.querySelector("#receiptUploadForm"),
  resetRecipeFormButton: document.querySelector("#resetRecipeFormButton"),
  menuRecipeForm: document.querySelector("#menuRecipeForm"),
  extractReceiptTextButton: document.querySelector("#extractReceiptTextButton"),
  ocrPreviewInput: document.querySelector("#ocrPreviewInput"),
  runOcrPreviewButton: document.querySelector("#runOcrPreviewButton"),
  confirmOcrDeductionButton: document.querySelector("#confirmOcrDeductionButton"),
  ocrPreviewResult: document.querySelector("#ocrPreviewResult"),
  itemList: document.querySelector("#itemList"),
  vendorList: document.querySelector("#vendorList"),
  userList: document.querySelector("#userList"),
  menuRecipeList: document.querySelector("#menuRecipeList"),
  userAdminNotice: document.querySelector("#userAdminNotice"),
  purchaseList: document.querySelector("#purchaseList"),
  receiptUploadList: document.querySelector("#receiptUploadList"),
  purchaseItemSelect: document.querySelector('#purchaseForm select[name="itemId"]'),
  purchaseVendorSelect: document.querySelector('#purchaseForm select[name="vendorId"]'),
  receiptOrderSelect: document.querySelector('#receiptForm select[name="purchaseOrderId"]'),
  recipeIngredients: document.querySelector("#recipeIngredients"),
  addRecipeIngredientButton: document.querySelector("#addRecipeIngredientButton"),
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
  elements.sidebarBrandButton.addEventListener("click", toggleSidebarMenu);
  elements.sidebarMenuButton.addEventListener("click", toggleSidebarMenu);
  elements.sidebarExportButton.addEventListener("click", handleSidebarExport);
  elements.sidebarAlertsButton.addEventListener("click", handleSidebarAlerts);
  elements.sidebarLogoutButton.addEventListener("click", handleLogout);
  elements.openUsersTabButton.addEventListener("click", openUsersTab);
  elements.inventorySearchInput.addEventListener("input", handleInventorySearch);
  elements.inventoryStatusFilter.addEventListener("change", handleInventoryFilterChange);
  elements.tabs.addEventListener("click", handleTabClick);
  elements.itemList.addEventListener("click", handleItemListAction);
  elements.vendorList.addEventListener("click", handleVendorListAction);
  elements.menuRecipeList.addEventListener("click", handleMenuRecipeListAction);
  elements.itemForm.addEventListener("submit", handleItemSubmit);
  elements.openItemModalButton.addEventListener("click", openNewItemModal);
  elements.closeItemModalButton.addEventListener("click", closeItemModal);
  elements.resetItemFormButton.addEventListener("click", resetItemForm);
  elements.inventoryImportButton.addEventListener("click", handleInventoryImport);
  elements.inventoryCategoryTabs.addEventListener("click", handleInventoryCategoryTabClick);
  elements.renameCategoryButton.addEventListener("click", handleRenameCategory);
  elements.deleteCategoryButton.addEventListener("click", handleDeleteCategory);
  elements.vendorForm.addEventListener("submit", handleVendorSubmit);
  elements.userForm.addEventListener("submit", handleUserSubmit);
  elements.purchaseForm.addEventListener("submit", handlePurchaseSubmit);
  elements.purchaseForm.addEventListener("input", handlePurchaseEstimateChange);
  elements.purchaseForm.addEventListener("change", handlePurchaseEstimateChange);
  elements.receiptForm.addEventListener("submit", handleReceiptSubmit);
  elements.receiptUploadForm.addEventListener("submit", suppressSubmit);
  elements.resetRecipeFormButton.addEventListener("click", resetRecipeForm);
  elements.menuRecipeForm.addEventListener("submit", handleMenuRecipeSubmit);
  elements.extractReceiptTextButton.addEventListener("click", handleReceiptTextExtraction);
  elements.runOcrPreviewButton.addEventListener("click", handleOcrPreview);
  elements.confirmOcrDeductionButton.addEventListener("click", handleOcrDeductionConfirm);
  elements.addRecipeIngredientButton.addEventListener("click", addRecipeIngredientRow);
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
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(payload.message || payload.error || payload || "request_failed");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function render() {
  renderWorkspaceFrame();
  syncTabState();
  renderWorkspace();
  updateSidebarAlertsButton();
}

function renderWorkspaceFrame() {
  const category = state.workspaceCategory;
  const user = state.currentUser;
  if (!category || !user) {
    return;
  }

  elements.workspaceBrandTitle.textContent = category.name;
  elements.currentCategoryBadge.textContent = `카테고리 ${category.displayOrder}`;
  elements.currentUserBadge.textContent = `${user.displayName} · ${user.role === "manager" ? "관리자" : "직원"}`;
}

function renderWorkspace() {
  const category = state.workspaceCategory;
  const user = state.currentUser;
  if (!category || !user) {
    return;
  }

  syncInventoryCategoryFilter(category);
  renderWorkspaceStats(category);
  renderInventoryTable(category);
  renderInventoryCategoryTabs(category);
  renderItemList(category);
  renderVendorList(category);
  renderUserSection(category, user);
  renderOrderForms(category);
  renderOrderList(category);
  renderReceiptUploadList(category);
  renderKakaoSection(category);
  renderMenuRecipeSection(category, user);
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
  const todaysClosings = (category.receiptUploads || []).filter((entry) => toDateKey(entry.createdAt) === getTodayDateKey());
  const openOrders = category.purchaseOrders.filter((order) => order.status !== "received");

  elements.metricItems.textContent = String(category.items.length);
  elements.metricLowStock.textContent = String(lowStockItems.length);
  elements.metricOpenOrders.textContent = String(openOrders.length);
  elements.metricTodayClosings.textContent = String(todaysClosings.length);

  if (!lowStockItems.length) {
    state.lastAlarmSignatureByCategory[category.id] = "";
    persistClientState();
    return;
  }

  triggerAlertsIfNeeded(category, lowStockItems);
}

function renderInventoryTable(category) {
  const items = getOverviewItems(category);
  elements.inventoryTableBody.innerHTML = items.length
    ? items
        .map((item) => {
          const shortage = roundNumber(Math.max(0, item.parStock - item.currentStock));
          const isUrgent = item.currentStock <= 0 || shortage > item.parStock * 0.3;
          const isPriorityUrgent = Boolean(item.isPriority && isUrgent);
          const status = isUrgent
            ? '<span class="status-chip status-danger">긴급</span>'
            : '<span class="status-chip status-warning">발주 필요</span>';
          const priorityBadge = isPriorityUrgent ? ' <span class="status-chip status-priority">강제</span>' : '';

          return `
            <tr class="low-stock${isPriorityUrgent ? " priority-row" : ""}">
              <td>${escapeHtml(item.name)}${priorityBadge}</td>
              <td>${escapeHtml(item.storageType || "-")}</td>
              <td>${escapeHtml(item.storageLocation || "-")}</td>
              <td>${formatQuantity(item.currentStock)} ${escapeHtml(item.unit)}</td>
              <td>${formatQuantity(item.parStock)} ${escapeHtml(item.unit)}</td>
              <td>${formatQuantity(shortage)} ${escapeHtml(item.unit)}</td>
              <td>${status}</td>
            </tr>
          `;
        })
        .join("")
    : '<tr><td colspan="7">기준 재고 이하 품목이 없습니다.</td></tr>';
}

function renderItemList(category) {
  const items = getVisibleItems(category);
  if (!items.length) {
    elements.itemList.innerHTML = '<tr><td colspan="6">품목을 먼저 등록하세요.</td></tr>';
    return;
  }

  elements.itemList.innerHTML = items
    .map((item) => {
      return `
        <tr>
          <td>${escapeHtml(item.productCode || "-")}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${formatTaxType(item.taxType)}</td>
          <td>${escapeHtml(item.unit || "-")}</td>
          <td>${escapeHtml(item.origin || "-")}</td>
          <td>
            <div class="row-actions">
              <button class="secondary-button compact-button" type="button" data-action="edit-item" data-id="${item.id}">수정</button>
              <button class="secondary-button compact-button danger-button" type="button" data-action="delete-item" data-id="${item.id}">삭제</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderInventoryCategoryTabs(category) {
  const categories = getInventoryCategories(category);
  elements.inventoryCategoryTabs.innerHTML = categories
    .map((entry) => {
      const activeClass = entry.value === state.inventoryCategoryFilter ? " active" : "";
      return `<button type="button" class="category-tab${activeClass}" data-category="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</button>`;
    })
    .join("");

  const activeCategory = state.inventoryCategoryFilter === "all" ? "전체" : state.inventoryCategoryFilter;
  elements.inventoryCategoryNotice.textContent = `${activeCategory} 카테고리 ${getVisibleItems(category).length}개 품목 표시 중`;
  const disabled = state.inventoryCategoryFilter === "all";
  elements.renameCategoryButton.disabled = disabled;
  elements.deleteCategoryButton.disabled = disabled;
}

function renderVendorList(category) {
  if (!category.vendors.length) {
    elements.vendorList.innerHTML = '<div class="erp-grid-empty">등록된 거래처가 없습니다.</div>';
    return;
  }

  elements.vendorList.innerHTML = category.vendors
    .map((vendor) => `
      <div class="erp-grid-row vendor-grid">
        <strong>${vendor.name}</strong>
        <span>${vendor.contactPerson}</span>
        <span>${vendor.phone}</span>
        <span>${vendor.kakaoId || "미등록"}</span>
        <div class="row-actions">
          <button class="secondary-button compact-button" type="button" data-action="edit-vendor" data-id="${vendor.id}">수정</button>
          <button class="secondary-button compact-button danger-button" type="button" data-action="delete-vendor" data-id="${vendor.id}">삭제</button>
        </div>
      </div>
    `)
    .join("");
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
  const itemOptions = buildItemOptions(category.items);
  elements.purchaseItemSelect.innerHTML = itemOptions;
  elements.purchaseVendorSelect.innerHTML = category.vendors.length
    ? category.vendors.map((vendor) => `<option value="${vendor.id}">${vendor.name}</option>`).join("")
    : '<option value="">거래처를 먼저 등록하세요</option>';
  elements.receiptOrderSelect.innerHTML = category.purchaseOrders.filter((order) => order.status !== "received").length
    ? category.purchaseOrders
        .filter((order) => order.status !== "received")
        .map((order) => {
          const item = findById(category.items, order.itemId);
          const vendor = findById(category.vendors, order.vendorId);
          return `<option value="${order.id}">${item?.name ?? "삭제된 품목"} / ${formatQuantity(order.quantity)} / ${vendor?.name ?? "삭제된 거래처"} / ${formatCurrency(order.totalAmount || 0)}원</option>`;
        })
        .join("")
    : '<option value="">처리할 발주가 없습니다</option>';
  renderPurchaseEstimate();
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
  const openSummary = summarizeOrders(category.purchaseOrders.filter((order) => order.status !== "received"));
  elements.orderSummaryCard.innerHTML = [
    `<strong>미입고 발주 합계 ${formatCurrency(openSummary.totalAmount)}원</strong>`,
    `<div class="summary-line">공급가액 ${formatCurrency(openSummary.supplyAmount)}원 · 부가세 ${formatCurrency(openSummary.vatAmount)}원</div>`,
    `<div class="summary-line">발주 ${openSummary.count}건</div>`,
  ].join("");

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
          <p class="activity-meta">${vendor?.name ?? "삭제된 거래처"} · ${statusLabel} · ${formatTaxType(order.taxType)} · 총액 ${formatCurrency(order.totalAmount || 0)}원 · 공급가액 ${formatCurrency(order.supplyAmount || 0)}원 · 부가세 ${formatCurrency(order.vatAmount || 0)}원 · ${formatDateTime(order.createdAt)}</p>
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
        <p class="activity-meta">${describeReceiptUpload(upload)} · ${upload.note || "메모 없음"} · ${formatDateTime(upload.createdAt)}</p>
      </li>
    `),
  );
}

function renderMenuRecipeSection(category, user) {
  const isManager = user.role === "manager";
  [...elements.menuRecipeForm.elements].forEach((field) => {
    field.disabled = !isManager;
  });

  if (!elements.recipeIngredients.children.length && category.items.length) {
    addRecipeIngredientRow();
  }

  if (!(category.menuRecipes || []).length) {
    elements.menuRecipeList.innerHTML = '<div class="erp-grid-empty">등록된 메뉴 레시피가 없습니다.</div>';
    return;
  }

  elements.menuRecipeList.innerHTML = (category.menuRecipes || [])
    .map((recipe) => `
      <div class="erp-grid-row recipe-grid">
        <strong>${recipe.name}</strong>
        <span>${(recipe.aliases || []).join(", ") || "별칭 없음"}</span>
        <span>${recipe.ingredients.map((ingredient) => `${ingredient.itemName} ${formatQuantity(ingredient.quantity)} ${ingredient.unit}`).join(" / ")}</span>
        <div class="row-actions">
          <button class="secondary-button compact-button" type="button" data-action="edit-recipe" data-id="${recipe.id}">수정</button>
          <button class="secondary-button compact-button danger-button" type="button" data-action="delete-recipe" data-id="${recipe.id}">삭제</button>
        </div>
      </div>
    `)
    .join("");
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
    : "아직 카카오 알림 기록이 없습니다.";
}

function renderOcrPreview(category) {
  const preview = category.lastReceiptPreview;
  if (!preview) {
    elements.ocrPreviewResult.innerHTML = "영수증 파일을 고르고 OCR 텍스트를 넣은 뒤 자동 차감 검토를 실행하면 메뉴별 차감 예정 재료가 표시됩니다.";
    elements.confirmOcrDeductionButton.disabled = true;
    return;
  }

  elements.confirmOcrDeductionButton.disabled = !preview.matchedMenus.length;
  if (!preview.matchedMenus.length) {
    elements.ocrPreviewResult.innerHTML = preview.unmatchedLines.length
      ? `매칭 실패: ${preview.unmatchedLines.join(" / ")}`
      : "차감 가능한 메뉴를 찾지 못했습니다.";
    return;
  }

  elements.ocrPreviewResult.innerHTML = preview.matchedMenus
    .map((menu) => `
      <div class="preview-block">
        <strong>${menu.menuName}</strong>
        <div class="summary-line">영수증 라인: ${(menu.sourceLines || []).join(" / ")}</div>
        <div class="summary-line">수량 ${formatQuantity(menu.quantity)} · 신뢰도 ${menu.confidence}</div>
        <div class="summary-line">${menu.ingredients.map((ingredient) => `${ingredient.itemName} ${formatQuantity(ingredient.totalQuantity)} ${ingredient.unit}`).join(" / ")}</div>
      </div>
    `)
    .join("");
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
  closeSidebarMenu();
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

async function exportInventoryCsv() {
  try {
    const response = await fetch("/api/export/inventory.csv", {
      headers: { Authorization: `Bearer ${state.authToken}` },
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "export_failed");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.workspaceCategory.id}-inventory.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    window.alert(`재고 CSV 다운로드 중 오류가 발생했습니다.${error.message && error.message !== "export_failed" ? `\n${error.message}` : ""}`);
  }
}

function handleSidebarExport() {
  closeSidebarMenu();
  exportInventoryCsv();
}

function handleSidebarAlerts() {
  closeSidebarMenu();
  enableAlerts();
}

async function handleItemSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  await mutateWorkspace("/api/items", {
    id: String(formData.get("id") || "").trim(),
    productCode: String(formData.get("productCode") || "").trim(),
    name: String(formData.get("name")).trim(),
    category: String(formData.get("category") || "").trim(),
    unit: String(formData.get("unit")).trim(),
    origin: String(formData.get("origin") || "").trim(),
    storageType: String(formData.get("storageType") || "").trim(),
    storageLocation: String(formData.get("storageLocation") || "").trim(),
    purchasePrice: Number(formData.get("purchasePrice") || 0),
    taxType: normalizeTaxType(String(formData.get("taxType") || "taxable")),
    currentStock: Number(formData.get("currentStock")),
    parStock: Number(formData.get("parStock")),
    isPriority: formData.get("isPriority") === "on",
  });
  resetItemForm();
  closeItemModal();
}

async function handleVendorSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  await mutateWorkspace("/api/vendors", {
    id: String(formData.get("id") || "").trim(),
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
    renderPurchaseEstimate();
  } catch (error) {
    handleWorkspaceError(error, "발주 생성 중 오류가 발생했습니다.");
  }
}

function handlePurchaseEstimateChange() {
  renderPurchaseEstimate();
}

function handleInventoryCategoryTabClick(event) {
  const button = event.target.closest("[data-category]");
  if (!button) {
    return;
  }
  state.inventoryCategoryFilter = button.dataset.category;
  persistClientState();
  renderWorkspace();
}

async function handleRenameCategory() {
  if (state.inventoryCategoryFilter === "all") {
    return;
  }
  const nextName = window.prompt("새 카테고리 이름을 입력하세요.", state.inventoryCategoryFilter);
  if (nextName === null) {
    return;
  }
  const trimmed = nextName.trim();
  if (!trimmed) {
    window.alert("카테고리 이름을 입력하세요.");
    return;
  }
  const previousName = state.inventoryCategoryFilter;
  await mutateWorkspace("/api/item-categories/rename", { previousName, nextName: trimmed });
  state.inventoryCategoryFilter = trimmed;
  persistClientState();
  renderWorkspace();
}

async function handleDeleteCategory() {
  if (state.inventoryCategoryFilter === "all") {
    return;
  }
  const categoryName = state.inventoryCategoryFilter;
  if (!window.confirm(`'${categoryName}' 카테고리를 삭제하고 품목을 미분류로 이동할까요?`)) {
    return;
  }
  await mutateWorkspace("/api/item-categories/delete", { categoryName });
  state.inventoryCategoryFilter = "미분류";
  persistClientState();
  renderWorkspace();
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

function suppressSubmit(event) {
  event.preventDefault();
}

async function handleMenuRecipeSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const ingredients = readRecipeIngredients();
  if (!ingredients.length) {
    window.alert("재료를 한 줄 이상 입력하세요.");
    return;
  }

  await mutateWorkspace("/api/menu-recipes", {
    id: String(formData.get("id") || "").trim(),
    name: String(formData.get("name")).trim(),
    aliases: String(formData.get("aliases")).trim(),
    ingredients,
  });
  resetRecipeForm();
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
    const draftConfig = readKakaoConfig();
    if (!draftConfig.senderName || !draftConfig.channelId) {
      window.alert("카카오 발신 매장명과 채널/ID를 먼저 입력하세요.");
      return;
    }
    await mutateWorkspace("/api/kakao-config", draftConfig);
    const response = await apiFetch("/api/integrations/kakao/send-order", {
      method: "POST",
      body: JSON.stringify({ message: elements.kakaoMessageOutput.value }),
    });
    state.workspaceCategory.lastKakaoDispatch = response.kakao.lastDispatch;
    state.workspaceCategory.kakaoConfig = {
      ...(state.workspaceCategory.kakaoConfig || {}),
      ...draftConfig,
    };
    renderKakaoSection(state.workspaceCategory);
  } catch (error) {
    handleWorkspaceError(error, "카카오 알림 기록 중 오류가 발생했습니다.");
  }
}

async function handleOcrPreview() {
  const payload = await buildReceiptDeductionPayload();
  if (!payload.receiptText) {
    window.alert("영수증 OCR 텍스트를 입력하세요.");
    return;
  }
  try {
    const response = await mutateWorkspace("/api/receipt-deductions/preview", payload);
    state.workspaceCategory.lastReceiptPreview = response.receiptPreview;
    renderOcrPreview(state.workspaceCategory);
  } catch (error) {
    handleWorkspaceError(error, "자동 차감 검토 중 오류가 발생했습니다.");
  }
}

async function handleReceiptTextExtraction() {
  const formData = new FormData(elements.receiptUploadForm);
  const files = formData.getAll("receiptImage").filter((file) => file && file.size > 0);
  if (!files.length) {
    window.alert("영수증 파일을 한 개 이상 선택하세요.");
    return;
  }

  try {
    await ensureExternalScript("Tesseract", TESSERACT_CDN_URL);
  } catch {
    window.alert("OCR 엔진을 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
    return;
  }

  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  const skippedFiles = files.filter((file) => !file.type.startsWith("image/"));

  if (!imageFiles.length) {
    window.alert("현재 자동 OCR은 이미지 파일만 지원합니다. PDF는 OCR 텍스트를 직접 붙여넣어 주세요.");
    return;
  }

  setReceiptExtractionState(true, `OCR 준비 중... (${imageFiles.length}개 이미지)`);
  const extractedBlocks = [];

  try {
    for (let index = 0; index < imageFiles.length; index += 1) {
      const file = imageFiles[index];
      setReceiptExtractionState(true, `${file.name} 인식 중... (${index + 1}/${imageFiles.length})`);
      const text = await recognizeReceiptFile(file, index + 1, imageFiles.length);
      if (text) {
        extractedBlocks.push(text);
      }
    }

    if (!extractedBlocks.length) {
      throw new Error("ocr_empty_result");
    }

    elements.ocrPreviewInput.value = extractedBlocks.join("\n");
    const skippedNotice = skippedFiles.length
      ? `<div class="summary-line">자동 OCR 제외: ${skippedFiles.map((file) => file.name).join(", ")}</div>`
      : "";
    elements.ocrPreviewResult.innerHTML = `
      <div class="preview-block">
        <strong>텍스트 추출 완료</strong>
        <div class="summary-line">이미지 ${imageFiles.length}건에서 OCR 텍스트를 추출했습니다.</div>
        ${skippedNotice}
      </div>
    `;

    await handleOcrPreview();
  } catch (error) {
    const message = error.message === "ocr_empty_result"
      ? "이미지에서 읽어낸 텍스트가 없습니다. 사진 선명도나 영수증 방향을 확인하세요."
      : "영수증 OCR 처리 중 오류가 발생했습니다.";
    handleWorkspaceError(error, message);
  } finally {
    setReceiptExtractionState(false);
  }
}

async function handleOcrDeductionConfirm() {
  if (!state.workspaceCategory?.lastReceiptPreview) {
    window.alert("먼저 자동 차감 검토를 실행하세요.");
    return;
  }

  try {
    const payload = await buildReceiptDeductionPayload();
    await mutateWorkspace("/api/receipt-deductions/confirm", payload);
    resetReceiptDeductionForm();
  } catch (error) {
    handleWorkspaceError(error, "자동 차감 확정 중 오류가 발생했습니다.");
  }
}

async function recognizeReceiptFile(file, index, total) {
  const result = await window.Tesseract.recognize(file, "kor+eng", {
    logger: (message) => {
      if (message.status === "recognizing text") {
        const progress = Math.round((message.progress || 0) * 100);
        setReceiptExtractionState(true, `${file.name} 인식 중... (${index}/${total}) ${progress}%`);
      }
    },
  });

  return String(result.data?.text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
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

  if (typeof error.message === "string" && error.message.startsWith("import_row_invalid:")) {
    const [, rowNumber] = error.message.split(":");
    window.alert(`엑셀 업로드 ${rowNumber}행을 확인하세요. 품목명과 단위(또는 입수량)는 필수입니다.`);
    return;
  }

  const messageMap = {
    menu_name_required: "판매 메뉴명을 입력하세요.",
    recipe_ingredients_required: "레시피 재료를 한 줄 이상 입력하세요.",
    recipe_ingredient_item_not_found: "레시피 재료 품목이 유효하지 않습니다. 품목을 다시 선택하세요.",
    preview_required: "자동 차감 검토 결과가 없습니다. OCR 텍스트를 다시 검토하세요.",
    receipt_files_required: "영수증 파일을 한 개 이상 선택하세요.",
    ocr_empty_result: "영수증 이미지에서 읽어낸 텍스트가 없습니다.",
    import_rows_required: "엑셀 파일에서 반영할 재고 행을 찾지 못했습니다.",
    category_name_required: "카테고리 이름을 입력하세요.",
  };

  window.alert(messageMap[error.message] || fallbackMessage);
}

function handleInventorySearch(event) {
  state.inventorySearch = event.target.value.trim().toLowerCase();
  renderWorkspace();
}

function handleInventoryFilterChange(event) {
  state.inventoryStatusFilter = event.target.value;
  renderWorkspace();
}

function toggleSidebarMenu() {
  elements.sidebarMenu.classList.toggle("hidden");
}

function closeSidebarMenu() {
  elements.sidebarMenu.classList.add("hidden");
}

function openUsersTab() {
  state.activeTab = "users";
  persistClientState();
  closeSidebarMenu();
  syncTabState();
  renderWorkspace();
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
    updateSidebarAlertsButton();
    return;
  }

  if (!("PushManager" in window) || !state.serviceWorkerRegistration || !state.pushPublicKey) {
    persistClientState();
    updateSidebarAlertsButton();
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
  updateSidebarAlertsButton();
}

function updateSidebarAlertsButton() {
  const categoryId = state.workspaceCategory?.id;
  const pushSubscribed = categoryId ? state.pushSubscribedByCategory[categoryId] : false;
  if (pushSubscribed) {
    elements.sidebarAlertsButton.textContent = "브라우저 푸시 활성화됨";
  } else if (state.notificationEnabled) {
    elements.sidebarAlertsButton.textContent = "브라우저 알림 허용됨";
  } else {
    elements.sidebarAlertsButton.textContent = "브라우저 알림";
  }
  elements.sidebarAlertsButton.disabled = Boolean(pushSubscribed);
}

function setReceiptExtractionState(isProcessing, message = "") {
  elements.extractReceiptTextButton.disabled = isProcessing;
  elements.runOcrPreviewButton.disabled = isProcessing;
  elements.confirmOcrDeductionButton.disabled = isProcessing || !state.workspaceCategory?.lastReceiptPreview?.matchedMenus?.length;
  if (isProcessing) {
    elements.ocrPreviewResult.innerHTML = `<div class="summary-line">${message}</div>`;
  }
}

function addRecipeIngredientRow(existing = null) {
  const items = state.workspaceCategory?.items || [];
  const wrapper = document.createElement("div");
  wrapper.className = "line-item";
  wrapper.innerHTML = `
    <select name="recipeItemId" required>${buildItemOptions(items)}</select>
    <input name="recipeQuantity" type="number" min="0.1" step="0.1" placeholder="레시피 수량" required />
    <button type="button" class="secondary-button">삭제</button>
  `;
  if (existing) {
    wrapper.querySelector('[name="recipeItemId"]').value = existing.itemId;
    wrapper.querySelector('[name="recipeQuantity"]').value = existing.quantity;
  }
  wrapper.querySelector("button").addEventListener("click", () => wrapper.remove());
  elements.recipeIngredients.appendChild(wrapper);
}

function syncReceiptLineRows(category) {
  if (state.activeTab === "recipes" && !elements.recipeIngredients.children.length && category.items.length) {
    addRecipeIngredientRow();
  }
}

function readRecipeIngredients() {
  return [...elements.recipeIngredients.querySelectorAll(".line-item")]
    .map((row) => {
      const itemId = row.querySelector('[name="recipeItemId"]').value;
      const item = findById(state.workspaceCategory.items, itemId);
      return {
        itemId,
        itemName: item?.name || "",
        unit: item?.unit || "",
        quantity: Number(row.querySelector('[name="recipeQuantity"]').value),
      };
    })
    .filter((row) => row.itemId && row.quantity > 0);
}

function handleItemListAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }
  const item = findById(state.workspaceCategory.items, button.dataset.id);
  if (!item) {
    return;
  }
  if (button.dataset.action === "edit-item") {
    state.activeTab = "items";
    persistClientState();
    syncTabState();
    setItemFormValues(item);
    openItemModal();
    return;
  }
  if (button.dataset.action === "delete-item" && window.confirm("이 품목을 삭제할까요?")) {
    mutateWorkspace("/api/items/delete", { id: item.id });
  }
}

function setItemFormValues(item = null) {
  elements.itemForm.reset();
  elements.itemForm.elements.id.value = item?.id || "";
  elements.itemForm.elements.productCode.value = item?.productCode || "";
  elements.itemForm.elements.name.value = item?.name || "";
  elements.itemForm.elements.category.value = item?.category || "";
  elements.itemForm.elements.unit.value = item?.unit || "";
  elements.itemForm.elements.origin.value = item?.origin || "";
  elements.itemForm.elements.storageType.value = item?.storageType || "";
  elements.itemForm.elements.storageLocation.value = item?.storageLocation || "";
  elements.itemForm.elements.purchasePrice.value = item ? item.purchasePrice || 0 : "";
  elements.itemForm.elements.taxType.value = normalizeTaxType(item?.taxType || "taxable");
  elements.itemForm.elements.currentStock.value = item ? item.currentStock : "";
  elements.itemForm.elements.parStock.value = item ? item.parStock : "";
  elements.itemForm.elements.isPriority.checked = Boolean(item?.isPriority);
  elements.itemSubmitButton.textContent = item ? "품목 수정" : "품목 저장";
  elements.itemModalTitle.textContent = item ? "재고 품목 수정" : "재고 품목 등록";
}

function resetItemForm() {
  setItemFormValues();
  if (!elements.itemModal.classList.contains("hidden")) {
    elements.itemForm.elements.name.focus();
  }
}

function openNewItemModal() {
  resetItemForm();
  openItemModal();
}

function openItemModal() {
  elements.itemModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  elements.itemForm.elements.name.focus();
}

function closeItemModal() {
  elements.itemModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function handleVendorListAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }
  const vendor = findById(state.workspaceCategory.vendors, button.dataset.id);
  if (!vendor) {
    return;
  }
  if (button.dataset.action === "edit-vendor") {
    state.activeTab = "vendors";
    syncTabState();
    elements.vendorForm.elements.id.value = vendor.id;
    elements.vendorForm.elements.name.value = vendor.name;
    elements.vendorForm.elements.contactPerson.value = vendor.contactPerson;
    elements.vendorForm.elements.phone.value = vendor.phone;
    elements.vendorForm.elements.kakaoId.value = vendor.kakaoId || "";
    return;
  }
  if (button.dataset.action === "delete-vendor" && window.confirm("이 거래처를 삭제할까요?")) {
    mutateWorkspace("/api/vendors/delete", { id: vendor.id });
  }
}

function handleMenuRecipeListAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }
  const recipe = findById(state.workspaceCategory.menuRecipes || [], button.dataset.id);
  if (!recipe) {
    return;
  }
  if (button.dataset.action === "edit-recipe") {
    state.activeTab = "recipes";
    syncTabState();
    elements.menuRecipeForm.elements.id.value = recipe.id;
    elements.menuRecipeForm.elements.name.value = recipe.name;
    elements.menuRecipeForm.elements.aliases.value = (recipe.aliases || []).join(", ");
    elements.recipeIngredients.innerHTML = "";
    recipe.ingredients.forEach((ingredient) => addRecipeIngredientRow(ingredient));
    return;
  }
  if (button.dataset.action === "delete-recipe" && window.confirm("이 메뉴 레시피를 삭제할까요?")) {
    mutateWorkspace("/api/menu-recipes/delete", { id: recipe.id });
  }
}

function resetRecipeForm() {
  elements.menuRecipeForm.reset();
  elements.menuRecipeForm.elements.id.value = "";
  elements.recipeIngredients.innerHTML = "";
  addRecipeIngredientRow();
}

async function buildReceiptDeductionPayload() {
  const formData = new FormData(elements.receiptUploadForm);
  const files = formData.getAll("receiptImage").filter((file) => file && file.size > 0);
  const receiptText = String(elements.ocrPreviewInput.value || "").trim();
  const filePayloads = await Promise.all(
    files.map(async (file) => ({
      fileName: file.name,
      fileSize: file.size,
      previewDataUrl: file.type.startsWith("image/") ? await fileToDataUrl(file) : "",
    })),
  );

  return {
    files: filePayloads,
    receiptText,
    note: String(formData.get("note") || "").trim(),
  };
}

function resetReceiptDeductionForm() {
  elements.receiptUploadForm.reset();
  elements.ocrPreviewInput.value = "";
  state.workspaceCategory.lastReceiptPreview = null;
  renderOcrPreview(state.workspaceCategory);
}

function readKakaoConfig() {
  return {
    senderName: String(elements.kakaoForm.elements.senderName.value || "").trim(),
    channelId: String(elements.kakaoForm.elements.channelId.value || "").trim(),
    notes: String(elements.kakaoForm.elements.notes.value || "").trim(),
  };
}

function describeReceiptUpload(upload) {
  if (upload.receiptCount) {
    return `${upload.receiptCount}개 영수증 · ${upload.lines.length}개 메뉴`;
  }
  if (upload.lines?.length) {
    return `${upload.lines.length}개 항목`;
  }
  return "기록";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

async function handleInventoryImport() {
  const file = elements.inventoryImportFile.files?.[0];
  if (!file) {
    window.alert("업로드할 엑셀 파일을 먼저 선택하세요.");
    return;
  }

  try {
    await ensureExternalScript("XLSX", XLSX_CDN_URL);
  } catch {
    window.alert("엑셀 처리 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
    return;
  }

  try {
    const rows = await parseInventoryImportFile(file);
    if (!rows.length) {
      throw new Error("import_rows_required");
    }

    const response = await mutateWorkspace("/api/items/import", { rows });
    resetItemForm();
    elements.inventoryImportFile.value = "";
    const summary = response.importSummary || {};
    window.alert(`엑셀 반영 완료: 신규 ${summary.created || 0}건, 수정 ${summary.updated || 0}건`);
  } catch (error) {
    if (error.status) {
      return;
    }
    handleWorkspaceError(error, "엑셀 업로드 중 오류가 발생했습니다.");
  }
}

async function parseInventoryImportFile(file) {
  const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  return window.XLSX.utils
    .sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" })
    .map((row, index) => normalizeInventoryImportRow(row, index))
    .filter(Boolean);
}

function normalizeInventoryImportRow(row, index) {
  const normalizedRow = Object.entries(row).reduce((result, [key, value]) => {
    result[normalizeImportHeader(key)] = value;
    return result;
  }, {});

  const item = {
    id: String(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.id) || "").trim(),
    productCode: String(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.productCode) || "").trim(),
    name: String(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.name) || "").trim(),
    category: String(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.category) || "").trim(),
    unit: String(
      getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.quantityUnit) ||
        getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.unit) ||
        "",
    ).trim(),
    origin: String(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.origin) || "").trim(),
    storageType: String(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.storageType) || "").trim(),
    storageLocation: String(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.storageLocation) || "").trim(),
    purchasePrice: parseInventoryImportNumber(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.purchasePrice)),
    taxType: normalizeTaxType(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.taxType)),
    currentStock: parseInventoryImportNumber(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.currentStock)),
    parStock: parseInventoryImportNumber(getInventoryImportValue(normalizedRow, INVENTORY_IMPORT_ALIASES.parStock)),
  };

  if (
    !item.id &&
    !item.productCode &&
    !item.name &&
    !item.category &&
    !item.unit &&
    !item.origin &&
    !item.storageType &&
    !item.storageLocation &&
    item.purchasePrice === 0 &&
    item.taxType === "taxable" &&
    item.currentStock === 0 &&
    item.parStock === 0
  ) {
    return null;
  }

  if (!item.name || !item.unit) {
    throw new Error(`import_row_invalid:${index + 2}`);
  }

  return item;
}

function getInventoryImportValue(row, aliases) {
  for (const alias of aliases) {
    const value = row[normalizeImportHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function parseInventoryImportNumber(value) {
  const normalized = String(value || "")
    .replace(/,/g, "")
    .trim();
  return normalized ? Number(normalized) || 0 : 0;
}

function normalizeImportHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]\-_/.:]/g, "");
}

function buildKakaoMessage(category) {
  const lowStockLines = getLowStockItems(category)
    .map((item) => {
      const shortage = Math.max(0, item.parStock - item.currentStock);
      const totals = calculateFinancialTotals(shortage * Number(item.purchasePrice || 0), item.taxType);
      return `- ${item.name}: 현재 ${formatQuantity(item.currentStock)} ${item.unit} / 기준 ${formatQuantity(item.parStock)} ${item.unit} / 예상 ${formatCurrency(totals.totalAmount)}원`;
    })
    .join("\n");
  const orderLines = category.purchaseOrders
    .filter((order) => order.status !== "received")
    .map((order) => {
      const item = findById(category.items, order.itemId);
      const vendor = findById(category.vendors, order.vendorId);
      return `- ${item?.name ?? "삭제된 품목"} ${formatQuantity(order.quantity)} ${item?.unit ?? ""} / 거래처 ${vendor?.name ?? "미등록"} / 총액 ${formatCurrency(order.totalAmount || 0)}원`;
    })
    .join("\n");
  const openSummary = summarizeOrders(category.purchaseOrders.filter((order) => order.status !== "received"));

  return [
    `[발주 알림] ${category.kakaoConfig.senderName || "샵앤샵 평택1호점"} / ${category.name}`,
    `카카오 채널: ${category.kakaoConfig.channelId || "미설정"}`,
    "",
    "기준 재고 이하 품목",
    lowStockLines || "- 없음",
    "",
    "미입고 발주 현황",
    orderLines || "- 없음",
    `미입고 발주 합계: 총액 ${formatCurrency(openSummary.totalAmount)}원 / 공급가액 ${formatCurrency(openSummary.supplyAmount)}원 / 부가세 ${formatCurrency(openSummary.vatAmount)}원`,
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
    .map((item) => `${item.id}:${item.currentStock}:${item.purchasePrice || 0}:${normalizeTaxType(item.taxType)}`)
    .sort()
    .join("|");

  if (state.lastAlarmSignatureByCategory[category.id] === signature) {
    return;
  }

  state.lastAlarmSignatureByCategory[category.id] = signature;
  persistClientState();
  playAlarm();
  const lowStockCost = getLowStockFinancialTotals(category);
  if (state.notificationEnabled && "Notification" in window && Notification.permission === "granted") {
    new Notification(`${category.name} 재고 경고`, {
      body: `${lowStockItems.map((item) => item.name).join(", ")} 기준 재고 이하 · 예상 ${formatCurrency(lowStockCost.totalAmount)}원`,
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

function getOverviewItems(category) {
  return [...(category.items || [])]
    .filter((item) => number(item.currentStock) <= number(item.parStock))
    .sort((left, right) => {
      const leftShortage = Math.max(0, number(left.parStock) - number(left.currentStock));
      const rightShortage = Math.max(0, number(right.parStock) - number(right.currentStock));
      const leftUrgent = number(left.currentStock) <= 0 || leftShortage > number(left.parStock) * 0.3;
      const rightUrgent = number(right.currentStock) <= 0 || rightShortage > number(right.parStock) * 0.3;
      const leftPriority = Boolean(left.isPriority && leftUrgent);
      const rightPriority = Boolean(right.isPriority && rightUrgent);

      if (leftPriority !== rightPriority) {
        return leftPriority ? -1 : 1;
      }
      if (leftUrgent !== rightUrgent) {
        return leftUrgent ? -1 : 1;
      }
      if (leftShortage !== rightShortage) {
        return rightShortage - leftShortage;
      }
      return left.name.localeCompare(right.name, "ko");
    });
}

function getVisibleItems(category) {
  return (category.items || []).filter((item) => {
    const matchesCategory =
      state.inventoryCategoryFilter === "all" || getItemCategoryLabel(item) === state.inventoryCategoryFilter;
    if (!matchesCategory) {
      return false;
    }
    const matchesSearch =
      !state.inventorySearch ||
      item.name.toLowerCase().includes(state.inventorySearch) ||
      String(item.productCode || "").toLowerCase().includes(state.inventorySearch);
    if (!matchesSearch) {
      return false;
    }
    if (state.inventoryStatusFilter === "low") {
      return item.currentStock > 0 && item.currentStock <= item.parStock;
    }
    if (state.inventoryStatusFilter === "out") {
      return item.currentStock <= 0;
    }
    return true;
  });
}

function syncInventoryCategoryFilter(category) {
  const availableCategories = getInventoryCategories(category).map((entry) => entry.value);
  if (!availableCategories.includes(state.inventoryCategoryFilter)) {
    state.inventoryCategoryFilter = "all";
    persistClientState();
  }
}

function getInventoryCategories(category) {
  const categoryNames = Array.from(new Set((category.items || []).map((item) => getItemCategoryLabel(item)))).sort(
    (left, right) => left.localeCompare(right, "ko-KR"),
  );
  return [{ value: "all", label: "전체" }, ...categoryNames.map((name) => ({ value: name, label: name }))];
}

function getItemCategoryLabel(item) {
  return String(item?.category || "").trim() || "미분류";
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
  return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
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
  return Math.round(Number(value) * 100) / 100;
}

function renderPurchaseEstimate() {
  const item = findById(state.workspaceCategory?.items || [], elements.purchaseForm.elements.itemId.value);
  const quantity = Number(elements.purchaseForm.elements.quantity.value || 0);
  if (!item || quantity <= 0) {
    elements.purchaseEstimateCard.innerHTML = "품목과 수량을 선택하면 발주 예상 금액이 계산됩니다.";
    return;
  }

  const estimate = calculateOrderAmount(item, quantity);
  elements.purchaseEstimateCard.innerHTML = [
    `<strong>이번 발주 예상 총액 ${formatCurrency(estimate.totalAmount)}원</strong>`,
    `<div class="summary-line">공급가액 ${formatCurrency(estimate.supplyAmount)}원 · 부가세 ${formatCurrency(estimate.vatAmount)}원</div>`,
    `<div class="summary-line">기준 단가 ${formatCurrency(item.purchasePrice || 0)}원 · ${formatTaxType(item.taxType)}</div>`,
  ].join("");
}

function getLowStockFinancialTotals(category) {
  return summarizeOrders(
    getLowStockItems(category).map((item) => {
      const shortage = Math.max(0, item.parStock - item.currentStock);
      return calculateOrderAmount(item, shortage);
    }),
  );
}

function summarizeOrders(orders) {
  return orders.reduce(
    (totals, order) => {
      totals.count += 1;
      totals.totalAmount += Number(order.totalAmount || 0);
      totals.supplyAmount += Number(order.supplyAmount || 0);
      totals.vatAmount += Number(order.vatAmount || 0);
      return totals;
    },
    { count: 0, totalAmount: 0, supplyAmount: 0, vatAmount: 0 },
  );
}

function calculateOrderAmount(item, quantity) {
  const totalAmount = roundCurrency(Number(quantity || 0) * Number(item?.purchasePrice || 0));
  const totals = calculateFinancialTotals(totalAmount, item?.taxType);
  return {
    ...totals,
    taxType: normalizeTaxType(item?.taxType || "taxable"),
  };
}

function calculateFinancialTotals(totalAmount, taxType) {
  const normalizedTotal = roundCurrency(totalAmount);
  const normalizedTaxType = normalizeTaxType(taxType);
  if (normalizedTaxType === "exempt") {
    return {
      totalAmount: normalizedTotal,
      supplyAmount: normalizedTotal,
      vatAmount: 0,
    };
  }

  const supplyAmount = roundCurrency(normalizedTotal / 1.1);
  return {
    totalAmount: normalizedTotal,
    supplyAmount,
    vatAmount: normalizedTotal - supplyAmount,
  };
}

function normalizeTaxType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["면세", "exempt", "free", "non-tax", "nontax"].includes(normalized)) {
    return "exempt";
  }
  return "taxable";
}

function formatTaxType(value) {
  return normalizeTaxType(value) === "exempt" ? "면세" : "과세";
}

function roundCurrency(value) {
  return Math.round(Number(value) || 0);
}

function formatCurrency(value) {
  return roundCurrency(value).toLocaleString("ko-KR");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function ensureExternalScript(globalName, src) {
  if (window[globalName]) {
    return;
  }

  const existing = document.querySelector(`script[data-global="${globalName}"]`);
  if (existing) {
    await waitForScriptLoad(existing, globalName);
    return;
  }

  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.dataset.global = globalName;
  document.body.appendChild(script);
  await waitForScriptLoad(script, globalName);
}

function waitForScriptLoad(script, globalName) {
  return new Promise((resolve, reject) => {
    if (window[globalName]) {
      resolve();
      return;
    }

    const handleLoad = () => {
      cleanup();
      if (window[globalName]) {
        resolve();
      } else {
        reject(new Error(`${globalName}_load_failed`));
      }
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`${globalName}_load_failed`));
    };
    const cleanup = () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
  });
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
      inventoryCategoryFilter: state.inventoryCategoryFilter,
      notificationEnabled: state.notificationEnabled,
      pushSubscribedByCategory: state.pushSubscribedByCategory,
      lastAlarmSignatureByCategory: state.lastAlarmSignatureByCategory,
    }),
  );
}
