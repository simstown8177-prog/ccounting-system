const CLIENT_STORAGE_KEY = "shop-n-shop-client-v1";

const state = {
  categories: [],
  selectedCategoryId: new URL(window.location.href).searchParams.get("categoryId")
    || readClientState().selectedCategoryId
    || null,
};

const elements = {
  loginForm: document.querySelector("#loginForm"),
  categorySelect: document.querySelector("#categorySelect"),
  loginCategoryPreview: document.querySelector("#loginCategoryPreview"),
  loginError: document.querySelector("#loginError"),
};

bindEvents();
initialize();

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.categorySelect.addEventListener("change", handleCategoryChange);
}

async function initialize() {
  await loadBootstrap();
  if (!state.selectedCategoryId && state.categories.length) {
    state.selectedCategoryId = state.categories[0].id;
  }
  render();
}

async function loadBootstrap() {
  const response = await fetch("/api/bootstrap");
  const payload = await response.json();
  state.categories = payload.categories || [];
}

function render() {
  elements.categorySelect.innerHTML = state.categories
    .map(
      (category) => `
        <option value="${category.id}" ${category.id === state.selectedCategoryId ? "selected" : ""}>
          ${category.name}
        </option>
      `,
    )
    .join("");

  const category = getSelectedCategory();
  if (!category) {
    elements.loginCategoryPreview.textContent = "선택된 매장이 없습니다. 메인에서 다시 선택하거나 여기서 선택하세요.";
    return;
  }

  elements.loginCategoryPreview.innerHTML = `
    <strong>${category.name}</strong>
    <div class="summary-line">${category.description}</div>
    <div class="summary-line">품목 ${category.stats.items} · 경고 ${category.stats.lowStock}</div>
  `;
}

function handleCategoryChange(event) {
  state.selectedCategoryId = event.target.value;
  persistClientState({
    ...readClientState(),
    selectedCategoryId: state.selectedCategoryId,
  });
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("categoryId", state.selectedCategoryId);
  window.history.replaceState({}, "", nextUrl);
  render();
}

async function handleLogin(event) {
  event.preventDefault();
  hideError();
  const formData = new FormData(event.currentTarget);

  try {
    const payload = await apiFetch("/api/login", {
      method: "POST",
      body: JSON.stringify({
        categoryId: state.selectedCategoryId,
        username: String(formData.get("username")).trim(),
        password: String(formData.get("password")).trim(),
      }),
    });

    persistClientState({
      ...readClientState(),
      selectedCategoryId: state.selectedCategoryId,
      authToken: payload.token,
      activeTab: "overview",
    });
    window.location.href = "/workspace.html";
  } catch (error) {
    if (error.status === 401) {
      showError("로그인 정보가 맞지 않습니다.");
      return;
    }
    showError("로그인 처리 중 오류가 발생했습니다.");
  }
}

async function apiFetch(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "request_failed");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function getSelectedCategory() {
  return state.categories.find((entry) => entry.id === state.selectedCategoryId) || null;
}

function showError(message) {
  elements.loginError.textContent = message;
  elements.loginError.classList.remove("hidden");
}

function hideError() {
  elements.loginError.textContent = "";
  elements.loginError.classList.add("hidden");
}

function readClientState() {
  try {
    return JSON.parse(localStorage.getItem(CLIENT_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function persistClientState(nextState) {
  localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(nextState));
}
