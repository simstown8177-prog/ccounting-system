const CLIENT_STORAGE_KEY = "shop-n-shop-client-v1";

const state = {
  categories: [],
  selectedCategoryId: readClientState().selectedCategoryId || null,
  appDownload: null,
};

const elements = {
  categoryGrid: document.querySelector("#categoryGrid"),
  globalStats: document.querySelector("#globalStats"),
  selectedCategorySummary: document.querySelector("#selectedCategorySummary"),
  appDownloadPanel: document.querySelector("#appDownloadPanel"),
  goLoginButton: document.querySelector("#goLoginButton"),
  seedDataButton: document.querySelector("#seedDataButton"),
};

bindEvents();
initialize();

function bindEvents() {
  elements.categoryGrid.addEventListener("click", handleCategoryClick);
  elements.goLoginButton.addEventListener("click", goToLogin);
  elements.seedDataButton.addEventListener("click", handleSeedData);
}

async function initialize() {
  await loadBootstrap();
  if (!state.selectedCategoryId && state.categories.length) {
    state.selectedCategoryId = state.categories[0].id;
    persistClientState();
  }
  render();
}

async function loadBootstrap() {
  const response = await fetch("/api/bootstrap");
  const payload = await response.json();
  state.categories = payload.categories || [];
  state.appDownload = payload.appDownload || null;
}

function render() {
  renderGlobalStats();
  renderAppDownloadPanel();
  renderCategoryGrid();
  renderSelectedCategorySummary();
}

function renderAppDownloadPanel() {
  const appDownload = state.appDownload;
  if (!appDownload?.available) {
    elements.appDownloadPanel.hidden = true;
    elements.appDownloadPanel.innerHTML = "";
    return;
  }

  elements.appDownloadPanel.hidden = false;
  elements.appDownloadPanel.innerHTML = `
    <div class="download-panel-copy">
      <strong>안드로이드 앱 설치</strong>
      <p class="helper-text">
        폰에서 APK를 내려받아 직접 설치할 수 있습니다. 설치가 막히면 "알 수 없는 앱 설치 허용"을 켜세요.
      </p>
    </div>
    <a class="primary-button" href="${appDownload.url}" download="${appDownload.filename}">
      Android 앱 다운로드
    </a>
  `;
}

function renderGlobalStats() {
  const totalItems = state.categories.reduce((sum, category) => sum + category.stats.items, 0);
  const totalLowStock = state.categories.reduce((sum, category) => sum + category.stats.lowStock, 0);
  elements.globalStats.innerHTML = [
    `<span class="stat-chip">전체 카테고리 ${state.categories.length}</span>`,
    `<span class="stat-chip">전체 품목 ${totalItems}</span>`,
    `<span class="stat-chip">전체 경고 ${totalLowStock}</span>`,
  ].join("");
}

function renderCategoryGrid() {
  elements.categoryGrid.innerHTML = state.categories
    .map((category, index) => {
      const selected = category.id === state.selectedCategoryId;
      return `
        <button class="category-card ${selected ? "selected" : ""}" type="button" data-category-id="${category.id}">
          <p class="section-label">Category ${index + 1}</p>
          <strong>${category.name}</strong>
          <small>${category.description}</small>
          <div class="card-stats">
            <span class="stat-chip">품목 ${category.stats.items}</span>
            <span class="stat-chip">경고 ${category.stats.lowStock}</span>
            <span class="stat-chip">${selected ? "선택됨" : "선택 가능"}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderSelectedCategorySummary() {
  const category = state.categories.find((entry) => entry.id === state.selectedCategoryId);
  if (!category) {
    elements.selectedCategorySummary.textContent = "먼저 운영할 매장을 선택하세요.";
    return;
  }

  elements.selectedCategorySummary.innerHTML = `
    <strong>${category.name}</strong>
    <div class="summary-line">${category.description}</div>
    <div class="summary-line">이제 상단 Login 버튼으로 로그인 페이지로 이동합니다.</div>
  `;
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

function goToLogin() {
  const categoryId = state.selectedCategoryId;
  const nextUrl = categoryId ? `/login.html?categoryId=${encodeURIComponent(categoryId)}` : "/login.html";
  window.location.href = nextUrl;
}

async function handleSeedData() {
  await fetch("/api/seed", { method: "POST" });
  const nextState = readClientState();
  nextState.authToken = null;
  persistClientState(nextState);
  await loadBootstrap();
  render();
  window.alert("데모 데이터로 초기화했습니다.");
}

function readClientState() {
  try {
    return JSON.parse(localStorage.getItem(CLIENT_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function persistClientState(nextState = null) {
  const baseState = nextState || readClientState();
  const merged = {
    ...baseState,
    selectedCategoryId: state.selectedCategoryId,
  };
  localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(merged));
}
