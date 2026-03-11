const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const webpush = require("web-push");
const { createStoreDatabase } = require("./db");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "app.db");
const DATABASE_URL = process.env.DATABASE_URL || "";

const CATEGORY_DEFINITIONS = [
  { id: "pizza-cheese-bbal", name: "피자는치즈빨", description: "피자 브랜드 운영 공간" },
  { id: "gogiji", name: "고기지", description: "육류 중심 브랜드 운영 공간" },
  { id: "future-space-1", name: "추 후 예정", description: "추가 입점 예정 공간 1" },
  { id: "future-space-2", name: "추후 예 정", description: "추가 입점 예정 공간 2" },
  { id: "future-space-3", name: "추 후 예정", description: "추가 입점 예정 공간 3" },
];

const sessions = new Map();
let storeDb;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  await ensureStore();
  await configureWebPush();

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith("/api/")) {
        await handleApi(req, res);
        return;
      }

      await serveStatic(req, res);
    } catch (error) {
      sendJson(res, 500, { error: "server_error", message: error.message });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

async function handleApi(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const store = await readStore();
    return sendJson(res, 200, {
      categories: store.categories.map(toPublicCategory),
      notificationSupported: true,
      pushPublicKey: getPublicVapidKey(store),
    });
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readJson(req);
    const store = await readStore();
    const category = findById(store.categories, body.categoryId);
    if (!category) {
      return sendJson(res, 404, { error: "category_not_found" });
    }

    const user = category.users.find(
      (entry) => entry.username === body.username && verifyPassword(body.password, entry),
    );
    if (!user) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }

    const token = crypto.randomUUID();
    sessions.set(token, {
      categoryId: category.id,
      userId: user.id,
      createdAt: Date.now(),
    });

    return sendJson(res, 200, {
      token,
      category: toPublicCategory(category),
      user: sanitizeUser(user),
    });
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const token = getToken(req);
    if (token) {
      sessions.delete(token);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/seed") {
    const seeded = createSeedStore();
    await writeStore(seeded);
    sessions.clear();
    return sendJson(res, 200, {
      ok: true,
      categories: seeded.categories.map(toPublicCategory),
    });
  }

  const session = requireSession(req, res);
  if (!session) {
    return;
  }

  if (req.method === "GET" && pathname === "/api/workspace") {
    const store = await readStore();
    const category = findById(store.categories, session.categoryId);
    const user = category ? findById(category.users, session.userId) : null;
    if (!category || !user) {
      sessions.delete(getToken(req));
      return sendJson(res, 401, { error: "unauthorized" });
    }
    return sendJson(res, 200, {
      category: sanitizeCategory(category),
      user: sanitizeUser(user),
      pushPublicKey: getPublicVapidKey(store),
    });
  }

  if (req.method === "GET" && pathname === "/api/users") {
    const store = await readStore();
    const category = findById(store.categories, session.categoryId);
    const user = category ? findById(category.users, session.userId) : null;
    if (!category || !user) {
      sessions.delete(getToken(req));
      return sendJson(res, 401, { error: "unauthorized" });
    }
    return sendJson(res, 200, {
      users: category.users.map(sanitizeUser),
      currentUser: sanitizeUser(user),
    });
  }

  if (req.method === "GET" && pathname === "/api/export/inventory.csv") {
    const store = await readStore();
    const category = findById(store.categories, session.categoryId);
    const user = category ? findById(category.users, session.userId) : null;
    if (!category || !user) {
      sessions.delete(getToken(req));
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }
    return sendCsv(
      res,
      `${category.id}-inventory.csv`,
      buildInventoryCsv(category),
    );
  }

  if (req.method === "POST" && pathname === "/api/push/subscribe") {
    const body = await readJson(req);
    return mutateCategory(
      res,
      session,
      async (category, user) => {
        if (!user) {
          throw new Error("unauthorized");
        }
        const subscription = body.subscription;
        if (!subscription?.endpoint) {
          throw new Error("invalid_subscription");
        }
        category.pushSubscriptions = (category.pushSubscriptions || []).filter(
          (entry) => entry.endpoint !== subscription.endpoint,
        );
        category.pushSubscriptions.unshift({
          ...subscription,
          subscribedAt: new Date().toISOString(),
        });
      },
      (category) => ({
        category: sanitizeCategory(category),
        push: { subscribedCount: (category.pushSubscriptions || []).length },
      }),
    );
  }

  if (req.method === "POST" && pathname === "/api/items") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      if (body.id) {
        const item = findById(category.items, body.id);
        if (!item) {
          throw new Error("item_not_found");
        }
        item.productCode = body.productCode || "";
        item.name = body.name;
        item.category = normalizeItemCategory(body.category);
        item.unit = body.unit;
        item.origin = body.origin || "";
        item.storageType = body.storageType || "";
        item.storageLocation = body.storageLocation || "";
        item.purchasePrice = roundCurrency(body.purchasePrice);
        item.taxType = normalizeTaxType(body.taxType);
        item.currentStock = number(body.currentStock);
        item.parStock = number(body.parStock);
        return;
      }

      category.items.unshift({
        id: crypto.randomUUID(),
        productCode: body.productCode || "",
        name: body.name,
        category: normalizeItemCategory(body.category),
        unit: body.unit,
        origin: body.origin || "",
        storageType: body.storageType || "",
        storageLocation: body.storageLocation || "",
        purchasePrice: roundCurrency(body.purchasePrice),
        taxType: normalizeTaxType(body.taxType),
        currentStock: number(body.currentStock),
        parStock: number(body.parStock),
      });
    });
  }

  if (req.method === "POST" && pathname === "/api/items/import") {
    const body = await readJson(req);
    let importSummary = null;
    return mutateCategory(
      res,
      session,
      (category) => {
        importSummary = importInventoryRows(category, body.rows);
      },
      (category) => ({
        category: sanitizeCategory(category),
        importSummary,
      }),
    );
  }

  if (req.method === "POST" && pathname === "/api/item-categories/rename") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      const previousName = normalizeItemCategory(body.previousName);
      const rawNextName = String(body.nextName || "").trim();
      if (!rawNextName) {
        throw new Error("category_name_required");
      }
      const nextName = normalizeItemCategory(rawNextName);
      category.items.forEach((item) => {
        if (normalizeItemCategory(item.category) === previousName) {
          item.category = nextName;
        }
      });
    });
  }

  if (req.method === "POST" && pathname === "/api/item-categories/delete") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      const targetName = normalizeItemCategory(body.categoryName);
      category.items.forEach((item) => {
        if (normalizeItemCategory(item.category) === targetName) {
          item.category = "미분류";
        }
      });
    });
  }

  if (req.method === "POST" && pathname === "/api/items/delete") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      category.items = category.items.filter((item) => item.id !== body.id);
      category.purchaseOrders = category.purchaseOrders.filter((order) => order.itemId !== body.id);
      category.receipts = category.receipts.filter((receipt) => receipt.itemId !== body.id);
      category.menuRecipes = (category.menuRecipes || []).map((recipe) => ({
        ...recipe,
        ingredients: recipe.ingredients.filter((ingredient) => ingredient.itemId !== body.id),
      }));
    });
  }

  if (req.method === "POST" && pathname === "/api/vendors") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      if (body.id) {
        const vendor = findById(category.vendors, body.id);
        if (!vendor) {
          throw new Error("vendor_not_found");
        }
        vendor.name = body.name;
        vendor.contactPerson = body.contactPerson;
        vendor.phone = body.phone;
        vendor.kakaoId = body.kakaoId || "";
        return;
      }

      category.vendors.unshift({
        id: crypto.randomUUID(),
        name: body.name,
        contactPerson: body.contactPerson,
        phone: body.phone,
        kakaoId: body.kakaoId || "",
      });
    });
  }

  if (req.method === "POST" && pathname === "/api/vendors/delete") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      category.vendors = category.vendors.filter((vendor) => vendor.id !== body.id);
      category.purchaseOrders = category.purchaseOrders.filter((order) => order.vendorId !== body.id);
    });
  }

  if (req.method === "POST" && pathname === "/api/menu-recipes") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category, user) => {
      requireRole(user, "manager");
      validateRecipePayload(body, category.items);
      const recipe = buildMenuRecipe(body, category.items);
      category.menuRecipes = category.menuRecipes || [];
      const existingIndex = category.menuRecipes.findIndex(
        (entry) => entry.id === recipe.id || normalizeToken(entry.name) === normalizeToken(recipe.name),
      );
      if (existingIndex >= 0) {
        category.menuRecipes[existingIndex] = recipe;
      } else {
        category.menuRecipes.unshift(recipe);
      }
    });
  }

  if (req.method === "POST" && pathname === "/api/menu-recipes/delete") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category, user) => {
      requireRole(user, "manager");
      category.menuRecipes = (category.menuRecipes || []).filter((recipe) => recipe.id !== body.id);
    });
  }

  if (req.method === "POST" && pathname === "/api/purchase-orders") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      const item = findById(category.items, body.itemId);
      if (!item) {
        throw new Error("item_not_found");
      }
      const totals = calculateOrderAmounts(item, body.quantity);
      category.purchaseOrders.unshift({
        id: crypto.randomUUID(),
        itemId: body.itemId,
        vendorId: body.vendorId,
        quantity: number(body.quantity),
        taxType: totals.taxType,
        unitPrice: totals.unitPrice,
        totalAmount: totals.totalAmount,
        supplyAmount: totals.supplyAmount,
        vatAmount: totals.vatAmount,
        status: "ordered",
        createdAt: new Date().toISOString(),
      });
    });
  }

  if (req.method === "POST" && pathname === "/api/receipts") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      const order = findById(category.purchaseOrders, body.purchaseOrderId);
      if (!order || order.status === "received") {
        throw new Error("invalid_purchase_order");
      }
      const item = findById(category.items, order.itemId);
      item.currentStock = round(item.currentStock + number(body.receivedQuantity));
      order.status = "received";
      order.receivedQuantity = number(body.receivedQuantity);
      order.receivedAt = new Date().toISOString();
      category.receipts.unshift({
        id: crypto.randomUUID(),
        purchaseOrderId: order.id,
        itemId: item.id,
        quantity: number(body.receivedQuantity),
        createdAt: new Date().toISOString(),
      });
    });
  }

  if (req.method === "POST" && pathname === "/api/receipt-uploads") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      const createdAt = new Date().toISOString();
      const files = Array.isArray(body.files) ? body.files : [];
      const lines = (body.lines || []).map((line) => ({
        itemId: line.itemId,
        quantity: number(line.quantity),
      })).filter((line) => line.itemId && line.quantity > 0);

      lines.forEach((line) => {
        applyStockDeduction(category, {
          itemId: line.itemId,
          usedQuantity: line.quantity,
          note: body.note || `${files.map((file) => file.fileName).join(", ") || "영수증"} 업로드 차감`,
          sourceLabel: "영수증 업로드",
          createdAt,
        });
      });

      files.forEach((file) => {
        category.receiptUploads.unshift({
          id: crypto.randomUUID(),
          fileName: file.fileName,
          fileSize: number(file.fileSize),
          note: body.note || "",
          lines,
          previewDataUrl: file.previewDataUrl || "",
          createdAt,
        });
      });
    });
  }

  if (req.method === "POST" && pathname === "/api/receipt-deductions/preview") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      category.lastReceiptPreview = buildReceiptPreview(category, body.receiptText || "", body.files || []);
    }, (category) => ({
      category: sanitizeCategory(category),
      receiptPreview: category.lastReceiptPreview,
    }));
  }

  if (req.method === "POST" && pathname === "/api/receipt-deductions/confirm") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      const receiptText = String(body.receiptText || "").trim();
      const files = Array.isArray(body.files) ? body.files : [];
      const note = String(body.note || "").trim();
      const preview = buildReceiptPreview(category, receiptText, files);
      if (!preview.matchedMenus.length) {
        throw new Error("preview_required");
      }

      const createdAt = new Date().toISOString();
      preview.matchedMenus.forEach((matchedMenu) => {
        matchedMenu.ingredients.forEach((ingredient) => {
          applyStockDeduction(category, {
            itemId: ingredient.itemId,
            usedQuantity: ingredient.totalQuantity,
            note: `${matchedMenu.menuName} ${matchedMenu.quantity}건 자동 차감`,
            sourceLabel: "영수증 OCR 자동 차감",
            createdAt,
          });
        });
      });

      const uploadEntries = files.length
        ? files
        : [{ fileName: "ocr-auto-deduction", fileSize: 0, previewDataUrl: "" }];

      uploadEntries.forEach((file) => {
        category.receiptUploads.unshift({
          id: crypto.randomUUID(),
          fileName: file.fileName || "ocr-auto-deduction",
          fileSize: number(file.fileSize),
          note: note || "영수증 OCR 자동 차감",
          lines: preview.matchedMenus.map((matchedMenu) => ({
            menuName: matchedMenu.menuName,
            quantity: matchedMenu.quantity,
          })),
          receiptCount: uploadEntries.length,
          previewDataUrl: file.previewDataUrl || "",
          receiptText,
          createdAt,
        });
      });
      category.lastReceiptPreview = null;
    }, (category) => ({
      category: sanitizeCategory(category),
      receiptPreview: null,
    }));
  }

  if (req.method === "POST" && pathname === "/api/receipt-deductions/upload-only") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      const createdAt = new Date().toISOString();
      const files = Array.isArray(body.files) ? body.files : [];
      if (!files.length) {
        throw new Error("receipt_files_required");
      }

      files.forEach((file) => {
        category.receiptUploads.unshift({
          id: crypto.randomUUID(),
          fileName: file.fileName,
          fileSize: number(file.fileSize),
          note: String(body.note || "").trim() || "영수증 파일 업로드",
          lines: [],
          receiptCount: files.length,
          previewDataUrl: file.previewDataUrl || "",
          receiptText: "",
          createdAt,
        });
      });
      category.lastReceiptPreview = null;
    });
  }

  if (req.method === "POST" && pathname === "/api/kakao-config") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      category.kakaoConfig = {
        senderName: body.senderName || "",
        channelId: body.channelId || "",
        notes: body.notes || "",
      };
    });
  }

  if (req.method === "POST" && pathname === "/api/users") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category, user) => {
      requireRole(user, "manager");
      if (category.users.some((entry) => entry.username === body.username)) {
        throw new Error("duplicate_username");
      }
      category.users.unshift(
        createUserRecord(body.displayName, body.username, body.password, body.role || "staff"),
      );
    }, (category) => ({
      category: sanitizeCategory(category),
      users: category.users.map(sanitizeUser),
    }));
  }

  if (req.method === "POST" && pathname === "/api/integrations/kakao/send-order") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category, user) => {
      const configured = Boolean(process.env.KAKAO_REST_API_KEY && process.env.KAKAO_TEMPLATE_ID);
      category.lastKakaoDispatch = {
        requestedAt: new Date().toISOString(),
        requestedBy: user.displayName,
        messagePreview: body.message || "",
        mode: configured ? "ready_for_real_send" : "simulation_only",
      };
    }, (category) => ({
      kakao: {
        configured: Boolean(process.env.KAKAO_REST_API_KEY && process.env.KAKAO_TEMPLATE_ID),
        mode: Boolean(process.env.KAKAO_REST_API_KEY && process.env.KAKAO_TEMPLATE_ID)
          ? "ready_for_real_send"
          : "simulation_only",
        lastDispatch: category.lastKakaoDispatch || null,
      },
    }));
  }

  if (req.method === "POST" && pathname === "/api/integrations/ocr/preview") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      category.lastOcrPreview = {
        requestedAt: new Date().toISOString(),
        matchedItems: inferItemsFromReceiptText(category, body.receiptText || ""),
      };
    }, (category) => ({
      ocrPreview: category.lastOcrPreview,
    }));
  }

  sendJson(res, 404, { error: "not_found" });
}

function requireSession(req, res) {
  const token = getToken(req);
  const session = token ? sessions.get(token) : null;
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return null;
  }
  return session;
}

async function mutateCategory(res, session, updater, formatter) {
  try {
    const store = await readStore();
    const category = findById(store.categories, session.categoryId);
    if (!category) {
      return sendJson(res, 404, { error: "category_not_found" });
    }
    const actingUser = findById(category.users, session.userId);
    const previousSignature = computeLowStockSignature(category);
    await updater(category, actingUser, store);
    category.lastLowStockSignature = computeLowStockSignature(category);
    await writeStore(store);
    await maybeSendLowStockPush(store, category, previousSignature);
    const payload = formatter ? formatter(category) : { category: sanitizeCategory(category) };
    return sendJson(res, 200, payload.category ? payload : { category: sanitizeCategory(category), ...payload });
  } catch (error) {
    const statusCode = error.message === "forbidden" ? 403 : 400;
    return sendJson(res, statusCode, { error: "invalid_request", message: error.message });
  }
}

async function ensureStore() {
  storeDb = await createStoreDatabase({
    dataDir: DATA_DIR,
    dbPath: DB_PATH,
    legacyStorePath: STORE_PATH,
    initialStoreFactory: createInitialStore,
    migrateStore,
    databaseUrl: DATABASE_URL,
  });
}

async function readStore() {
  return storeDb.readStore();
}

async function writeStore(store) {
  await storeDb.writeStore(store);
}

function createInitialStore() {
  return {
    config: {
      vapidKeys: createVapidKeys(),
    },
    categories: CATEGORY_DEFINITIONS.map((definition, index) => ({
      ...definition,
      displayOrder: index + 1,
      users: [
        createUserRecord(`${definition.name} 관리자`, "manager", "1234", "manager"),
        createUserRecord(`${definition.name} 직원`, "staff", "1111", "staff"),
      ],
      vendors: [],
      items: [],
      purchaseOrders: [],
      receipts: [],
      receiptUploads: [],
      pushSubscriptions: [],
      lastLowStockSignature: "",
      menuRecipes: [],
      lastReceiptPreview: null,
      kakaoConfig: {
        senderName: "샵앤샵 평택1호점",
        channelId: "",
        notes: "",
      },
    })),
  };
}

function createSeedStore() {
  const store = createInitialStore();
  const pizza = findById(store.categories, "pizza-cheese-bbal");
  const meat = findById(store.categories, "gogiji");

  pizza.items = [
    createItem("모짜렐라치즈", "kg", 3, 8),
    createItem("도우", "개", 12, 10),
    createItem("토마토소스", "통", 1, 3),
    createItem("페퍼로니", "kg", 2, 4),
    createItem("양파", "kg", 3, 4),
  ];
  pizza.vendors = [
    createVendor("평택유제품", "김대리", "010-2222-1111", "pt-cheese"),
    createVendor("도우베이스", "이과장", "010-3333-2222", "dough-center"),
  ];
  pizza.purchaseOrders = [
    createPurchaseOrder(pizza.items[0].id, pizza.vendors[0].id, 10, "ordered"),
  ];
  pizza.menuRecipes = [
    createMenuRecipe("충성콤비네이션M", ["충성콤비", "충성콤비네이션", "충성콤비 M"], [
      createRecipeIngredient(pizza.items[1].id, "도우", "개", 1),
      createRecipeIngredient(pizza.items[0].id, "모짜렐라치즈", "kg", 0.18),
      createRecipeIngredient(pizza.items[2].id, "토마토소스", "통", 0.12),
      createRecipeIngredient(pizza.items[3].id, "페퍼로니", "kg", 0.04),
      createRecipeIngredient(pizza.items[4].id, "양파", "kg", 0.03),
    ]),
  ];

  meat.items = [
    createItem("삼겹살", "kg", 14, 12),
    createItem("상추", "box", 1, 2),
    createItem("참기름", "병", 2, 3),
    createItem("쌈장", "통", 3, 2),
  ];
  meat.vendors = [
    createVendor("평택정육", "박실장", "010-4444-3333", "pt-meat"),
    createVendor("채소나라", "정주임", "010-5555-4444", "vege-land"),
  ];
  meat.purchaseOrders = [
    createPurchaseOrder(meat.items[1].id, meat.vendors[1].id, 3, "received", 2),
  ];
  meat.menuRecipes = [
    createMenuRecipe("삼겹살세트", ["삼겹세트", "삼겹 세트"], [
      createRecipeIngredient(meat.items[0].id, "삼겹살", "kg", 0.22),
      createRecipeIngredient(meat.items[1].id, "상추", "box", 0.08),
      createRecipeIngredient(meat.items[2].id, "참기름", "병", 0.03),
      createRecipeIngredient(meat.items[3].id, "쌈장", "통", 0.05),
    ]),
  ];
  applyStockDeduction(pizza, {
    itemId: pizza.items[0].id,
    usedQuantity: 2,
    note: "주문 영수증 일괄 차감",
    sourceLabel: "영수증 업로드",
    createdAt: new Date().toISOString(),
  });
  applyStockDeduction(meat, {
    itemId: meat.items[1].id,
    usedQuantity: 1,
    note: "점심 영업 마감",
    sourceLabel: "수동 마감",
    createdAt: new Date().toISOString(),
  });

  return store;
}

function applyStockDeduction(category, payload) {
  const item = findById(category.items, payload.itemId);
  if (!item) {
    throw new Error("item_not_found");
  }
  item.currentStock = round(Math.max(0, item.currentStock - number(payload.usedQuantity)));
}

function createUser(categoryName, username, password) {
  return createUserRecord(
    `${categoryName} ${username === "manager" ? "관리자" : "직원"}`,
    username,
    password,
    username === "manager" ? "manager" : "staff",
  );
}

function createItem(
  name,
  unit,
  currentStock,
  parStock,
  storageType = "",
  storageLocation = "",
  purchasePrice = 0,
  taxType = "taxable",
  productCode = "",
  category = "미분류",
  origin = "",
) {
  return {
    id: crypto.randomUUID(),
    productCode,
    name,
    category: normalizeItemCategory(category),
    unit,
    currentStock,
    parStock,
    origin,
    storageType,
    storageLocation,
    purchasePrice: roundCurrency(purchasePrice),
    taxType: normalizeTaxType(taxType),
  };
}

function createMenuRecipe(name, aliases, ingredients) {
  return {
    id: crypto.randomUUID(),
    name,
    aliases,
    ingredients,
    updatedAt: new Date().toISOString(),
  };
}

function createRecipeIngredient(itemId, itemName, unit, quantity) {
  return {
    itemId,
    itemName,
    unit,
    quantity,
  };
}

function createVendor(name, contactPerson, phone, kakaoId) {
  return { id: crypto.randomUUID(), name, contactPerson, phone, kakaoId };
}

function createPurchaseOrder(itemId, vendorId, quantity, status, receivedQuantity = 0) {
  return {
    id: crypto.randomUUID(),
    itemId,
    vendorId,
    quantity,
    status,
    createdAt: new Date().toISOString(),
    receivedQuantity,
    receivedAt: status === "received" ? new Date().toISOString() : null,
  };
}

async function serveStatic(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const relativePath = pathname === "/" ? "index.html" : path.normalize(pathname).replace(/^[/\\]+/, "");
  const filePath = path.join(ROOT, relativePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json; charset=utf-8",
  };

  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function toPublicCategory(category) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    displayOrder: category.displayOrder,
    stats: {
      items: category.items.length,
      lowStock: category.items.filter((item) => item.currentStock <= item.parStock).length,
      openOrders: category.purchaseOrders.filter((order) => order.status !== "received").length,
    },
  };
}

function sanitizeCategory(category) {
  return {
    ...category,
    items: (category.items || []).map((item) => ({
      ...item,
      productCode: item.productCode || "",
      category: normalizeItemCategory(item.category),
      origin: item.origin || "",
      storageType: item.storageType || "",
      storageLocation: item.storageLocation || "",
      purchasePrice: roundCurrency(item.purchasePrice),
      taxType: normalizeTaxType(item.taxType),
    })),
    purchaseOrders: (category.purchaseOrders || []).map((order) => enrichPurchaseOrder(order, category.items || [])),
    users: category.users.map(sanitizeUser),
    menuRecipes: (category.menuRecipes || []).map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients || [],
      aliases: recipe.aliases || [],
    })),
    lastReceiptPreview: category.lastReceiptPreview || null,
  };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role || "staff",
  };
}

function createUserRecord(displayName, username, password, role) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    id: crypto.randomUUID(),
    username,
    displayName,
    role,
    passwordHash: hashPassword(password, salt),
    passwordSalt: salt,
  };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

function verifyPassword(password, user) {
  if (user.passwordHash && user.passwordSalt) {
    return hashPassword(password, user.passwordSalt) === user.passwordHash;
  }
  return user.password === password;
}

function migrateStore(store) {
  return {
    ...store,
    config: {
      vapidKeys: store.config?.vapidKeys || createVapidKeys(),
    },
    categories: (store.categories || []).map((category, index) => ({
      ...CATEGORY_DEFINITIONS[index],
      ...category,
      items: (category.items || []).map((item) => ({
        ...item,
        productCode: item.productCode || "",
        category: normalizeItemCategory(item.category),
        origin: item.origin || "",
        storageType: item.storageType || "",
        storageLocation: item.storageLocation || "",
        purchasePrice: roundCurrency(item.purchasePrice),
        taxType: normalizeTaxType(item.taxType),
      })),
      purchaseOrders: (category.purchaseOrders || []).map((order) => enrichPurchaseOrder(order, category.items || [])),
      users: (category.users || []).map((user) => migrateUser(user)),
      pushSubscriptions: category.pushSubscriptions || [],
      lastLowStockSignature: category.lastLowStockSignature || "",
      menuRecipes: (category.menuRecipes || []).map((recipe) => migrateMenuRecipe(recipe, category.items || [])),
      lastReceiptPreview: category.lastReceiptPreview || null,
    })),
  };
}

function migrateMenuRecipe(recipe, items) {
  return {
    id: recipe.id || crypto.randomUUID(),
    name: recipe.name || "",
    aliases: Array.isArray(recipe.aliases) ? recipe.aliases : [],
    ingredients: (recipe.ingredients || []).map((ingredient) => ({
      itemId: ingredient.itemId,
      itemName: ingredient.itemName || findById(items, ingredient.itemId)?.name || "",
      unit: ingredient.unit || findById(items, ingredient.itemId)?.unit || "",
      quantity: number(ingredient.quantity),
    })),
    updatedAt: recipe.updatedAt || new Date().toISOString(),
  };
}

function migrateUser(user) {
  if (user.passwordHash && user.passwordSalt) {
    return {
      ...user,
      role: user.role || (user.username === "manager" ? "manager" : "staff"),
    };
  }

  const migrated = createUserRecord(
    user.displayName || user.username,
    user.username,
    user.password || "1111",
    user.role || (user.username === "manager" ? "manager" : "staff"),
  );

  return {
    ...migrated,
    id: user.id || migrated.id,
  };
}

function requireRole(user, requiredRole) {
  if (!user || user.role !== requiredRole) {
    throw new Error("forbidden");
  }
}

function inferItemsFromReceiptText(category, receiptText) {
  return buildReceiptPreview(category, receiptText).matchedMenus.map((matchedMenu) => ({
    name: matchedMenu.menuName,
    suggestedQuantity: matchedMenu.quantity,
    confidence: matchedMenu.confidence,
  }));
}

async function configureWebPush() {
  const store = await readStore();
  webpush.setVapidDetails(
    "mailto:shopnshop@example.com",
    getPublicVapidKey(store),
    store.config?.vapidKeys?.privateKey || "",
  );
}

function createVapidKeys() {
  return webpush.generateVAPIDKeys();
}

function getPublicVapidKey(store) {
  return store.config?.vapidKeys?.publicKey || "";
}

function computeLowStockSignature(category) {
  return (category.items || [])
    .filter((item) => item.currentStock <= item.parStock)
    .map((item) => `${item.id}:${item.currentStock}:${roundCurrency(item.purchasePrice)}:${normalizeTaxType(item.taxType)}`)
    .sort()
    .join("|");
}

async function maybeSendLowStockPush(store, category, previousSignature) {
  const nextSignature = computeLowStockSignature(category);
  if (!nextSignature || nextSignature === previousSignature || !(category.pushSubscriptions || []).length) {
    return;
  }

  const lowStockItems = category.items.filter((item) => item.currentStock <= item.parStock);
  const lowStockTotals = lowStockItems.reduce(
    (totals, item) => {
      const shortage = Math.max(0, number(item.parStock) - number(item.currentStock));
      const breakdown = calculateFinancialTotals(shortage * number(item.purchasePrice), item.taxType);
      totals.totalAmount += breakdown.totalAmount;
      totals.supplyAmount += breakdown.supplyAmount;
      totals.vatAmount += breakdown.vatAmount;
      return totals;
    },
    { totalAmount: 0, supplyAmount: 0, vatAmount: 0 },
  );
  const payload = JSON.stringify({
    title: `${category.name} 재고 경고`,
    body: `${lowStockItems.map((item) => item.name).join(", ")} 기준 재고 이하 · 예상 ${roundCurrency(lowStockTotals.totalAmount)}원`,
    url: "/",
    categoryId: category.id,
  });

  const results = await Promise.allSettled(
    category.pushSubscriptions.map((subscription) => webpush.sendNotification(subscription, payload)),
  );

  const validSubscriptions = category.pushSubscriptions.filter((subscription, index) => {
    const result = results[index];
    if (result.status === "fulfilled") {
      return true;
    }
    const statusCode = result.reason?.statusCode;
    return statusCode !== 404 && statusCode !== 410;
  });

  if (validSubscriptions.length !== category.pushSubscriptions.length) {
    category.pushSubscriptions = validSubscriptions;
    await writeStore(store);
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function sendCsv(res, fileName, csvText) {
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
  });
  res.end(`\uFEFF${csvText}`);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function getToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function findById(collection, id) {
  return collection.find((entry) => entry.id === id) || null;
}

function number(value) {
  return Number(value) || 0;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function validateRecipePayload(body, items) {
  if (!String(body.name || "").trim()) {
    throw new Error("menu_name_required");
  }

  if (!Array.isArray(body.ingredients) || !body.ingredients.length) {
    throw new Error("recipe_ingredients_required");
  }

  const validIngredients = body.ingredients.filter((ingredient) => {
    if (!ingredient?.itemId || number(ingredient.quantity) <= 0) {
      return false;
    }
    return Boolean(findById(items, ingredient.itemId));
  });

  if (!validIngredients.length) {
    throw new Error("recipe_ingredient_item_not_found");
  }
}

function importInventoryRows(category, rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error("import_rows_required");
  }

  const summary = { created: 0, updated: 0 };

  rows.forEach((rawRow, index) => {
    const row = normalizeInventoryImportRow(rawRow, index);
    const existingItem =
      (row.id ? findById(category.items, row.id) : null) ||
      (row.productCode
        ? category.items.find((item) => String(item.productCode || "").trim() === row.productCode)
        : null) ||
      category.items.find((item) => normalizeToken(item.name) === normalizeToken(row.name));

    if (existingItem) {
      existingItem.productCode = row.productCode || "";
      existingItem.name = row.name;
      existingItem.category = normalizeItemCategory(row.category);
      existingItem.unit = row.unit;
      existingItem.origin = row.origin || "";
      existingItem.storageType = row.storageType || "";
      existingItem.storageLocation = row.storageLocation || "";
      existingItem.purchasePrice = roundCurrency(row.purchasePrice);
      existingItem.taxType = normalizeTaxType(row.taxType);
      existingItem.currentStock = row.currentStock;
      existingItem.parStock = row.parStock;
      summary.updated += 1;
      return;
    }

    category.items.unshift({
      id: crypto.randomUUID(),
      productCode: row.productCode || "",
      name: row.name,
      category: normalizeItemCategory(row.category),
      unit: row.unit,
      origin: row.origin || "",
      storageType: row.storageType || "",
      storageLocation: row.storageLocation || "",
      purchasePrice: roundCurrency(row.purchasePrice),
      taxType: normalizeTaxType(row.taxType),
      currentStock: row.currentStock,
      parStock: row.parStock,
    });
    summary.created += 1;
  });

  return summary;
}

function normalizeInventoryImportRow(rawRow, index) {
  const row = rawRow && typeof rawRow === "object" ? rawRow : {};
  const name = String(row.name || "").trim();
  const unit = String(row.unit || "").trim();

  if (!name || !unit) {
    throw new Error(`import_row_invalid:${index + 1}`);
  }

  return {
    id: String(row.id || "").trim(),
    productCode: String(row.productCode || "").trim(),
    name,
    category: normalizeItemCategory(row.category),
    unit,
    origin: String(row.origin || "").trim(),
    storageType: String(row.storageType || "").trim(),
    storageLocation: String(row.storageLocation || "").trim(),
    purchasePrice: roundCurrency(row.purchasePrice),
    taxType: normalizeTaxType(row.taxType),
    currentStock: round(number(row.currentStock)),
    parStock: round(number(row.parStock)),
  };
}

function buildMenuRecipe(body, items) {
  return {
    id: body.id || crypto.randomUUID(),
    name: String(body.name || "").trim(),
    aliases: String(body.aliases || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    ingredients: (body.ingredients || []).map((ingredient) => {
      const item = findById(items, ingredient.itemId);
      return {
        itemId: ingredient.itemId,
        itemName: item?.name || "",
        unit: item?.unit || "",
        quantity: number(ingredient.quantity),
      };
    }).filter((ingredient) => ingredient.itemId && ingredient.quantity > 0),
    updatedAt: new Date().toISOString(),
  };
}

function buildReceiptPreview(category, receiptText, files = []) {
  const lines = String(receiptText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matchedMenus = [];
  const unmatchedLines = [];

  for (const line of lines) {
    const parsed = parseReceiptLine(line);
    if (!parsed.name) {
      continue;
    }

    const match = findMenuRecipeMatch(category.menuRecipes || [], parsed.name);
    if (!match) {
      unmatchedLines.push(line);
      continue;
    }

    const existing = matchedMenus.find((entry) => entry.menuId === match.id);
    if (existing) {
      existing.quantity = round(existing.quantity + parsed.quantity);
      existing.sourceLines.push(line);
      existing.ingredients = existing.ingredients.map((ingredient) => ({
        ...ingredient,
        totalQuantity: round(ingredient.totalQuantity + ingredient.quantity * parsed.quantity),
      }));
      if (existing.confidence !== "exact" && match.confidence === "exact") {
        existing.confidence = "exact";
      }
      continue;
    }

    matchedMenus.push({
      menuId: match.id,
      menuName: match.name,
      quantity: parsed.quantity,
      sourceLines: [line],
      confidence: match.confidence,
      ingredients: match.ingredients.map((ingredient) => ({
        ...ingredient,
        totalQuantity: round(ingredient.quantity * parsed.quantity),
      })),
    });
  }

  return {
    requestedAt: new Date().toISOString(),
    receiptText,
    files: files.map((file) => ({
      fileName: file.fileName || "",
      fileSize: number(file.fileSize),
    })),
    matchedMenus,
    unmatchedLines,
  };
}

function parseReceiptLine(line) {
  const cleaned = String(line || "").trim();
  if (shouldIgnoreReceiptLine(cleaned)) {
    return { name: "", quantity: 0 };
  }

  const tokens = cleaned.split(/\s+/);
  let quantity = 1;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const normalizedToken = token.toLowerCase();
    if (/^x?\d+$/.test(normalizedToken) && Number(normalizedToken.replace("x", "")) > 0 && Number(normalizedToken.replace("x", "")) <= 20) {
      quantity = Number(normalizedToken.replace("x", ""));
      tokens.splice(index, 1);
      break;
    }
    if (/^\d+(개|ea|잔|판)$/i.test(normalizedToken)) {
      quantity = Number(normalizedToken.replace(/(개|ea|잔|판)$/i, ""));
      tokens.splice(index, 1);
      break;
    }
  }
  const name = tokens
    .join(" ")
    .replace(/\d[\d,]*원.*$/, "")
    .replace(/[xX]\d+$/, "")
    .trim();
  return {
    name: normalizeToken(name),
    quantity,
  };
}

function shouldIgnoreReceiptLine(line) {
  const normalized = normalizeToken(line);
  if (!normalized) {
    return true;
  }

  if (/^(합계|총액|카드|승인|전화|사업자|주문번호|매장명|주소|vat|부가세)/.test(String(line).trim().toLowerCase())) {
    return true;
  }

  return /^[\d,.:/-]+$/.test(normalized);
}

function findMenuRecipeMatch(menuRecipes, inputName) {
  const normalizedInput = normalizeToken(inputName);
  if (!normalizedInput) {
    return null;
  }

  let best = null;
  for (const recipe of menuRecipes) {
    const names = [recipe.name, ...(recipe.aliases || [])]
      .map((entry) => normalizeToken(entry))
      .filter(Boolean);
    if (names.includes(normalizedInput)) {
      return { ...recipe, confidence: "exact" };
    }
    const partialMatch = names.find((entry) => normalizedInput.includes(entry) || entry.includes(normalizedInput));
    if (partialMatch && !best) {
      best = { ...recipe, confidence: "partial" };
    }
  }
  return best;
}

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\-_/]/g, "");
}

function normalizeItemCategory(value) {
  return String(value || "").trim() || "미분류";
}

function buildInventoryCsv(category) {
  const headers = [
    "매장카테고리",
    "상품코드",
    "품목명",
    "카테고리",
    "원산지",
    "입수량",
    "과세구분",
    "보관방법",
    "보관위치",
    "구매금액",
    "공급가액",
    "부가세",
    "현재재고",
    "기준재고",
    "부족수량",
    "부족예상금액",
    "부족예상공급가액",
    "부족예상부가세",
    "상태",
  ];
  const rows = (category.items || []).map((item) => {
    const shortage = round(Math.max(0, item.parStock - item.currentStock));
    const itemTotals = calculateFinancialTotals(item.purchasePrice, item.taxType);
    const shortageTotals = calculateFinancialTotals(shortage * number(item.purchasePrice), item.taxType);
    return [
      category.name,
      item.productCode || "",
      item.name,
      normalizeItemCategory(item.category),
      item.origin || "",
      item.unit,
      formatTaxType(item.taxType),
      item.storageType || "",
      item.storageLocation || "",
      roundCurrency(item.purchasePrice),
      itemTotals.supplyAmount,
      itemTotals.vatAmount,
      item.currentStock,
      item.parStock,
      shortage,
      shortageTotals.totalAmount,
      shortageTotals.supplyAmount,
      shortageTotals.vatAmount,
      shortage > 0 ? "경고" : "정상",
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function enrichPurchaseOrder(order, items) {
  const item = findById(items, order.itemId);
  const baseItem = {
    purchasePrice: order.unitPrice ?? item?.purchasePrice ?? 0,
    taxType: order.taxType || item?.taxType || "taxable",
  };
  const totals = calculateOrderAmounts(baseItem, order.quantity);

  return {
    ...order,
    taxType: normalizeTaxType(order.taxType || totals.taxType),
    unitPrice: roundCurrency(order.unitPrice ?? totals.unitPrice),
    totalAmount: roundCurrency(order.totalAmount ?? totals.totalAmount),
    supplyAmount: roundCurrency(order.supplyAmount ?? totals.supplyAmount),
    vatAmount: roundCurrency(order.vatAmount ?? totals.vatAmount),
  };
}

function calculateOrderAmounts(item, quantity) {
  const unitPrice = roundCurrency(item.purchasePrice);
  const totalAmount = roundCurrency(number(quantity) * unitPrice);
  const totals = calculateFinancialTotals(totalAmount, item.taxType);
  return {
    unitPrice,
    taxType: normalizeTaxType(item.taxType),
    ...totals,
  };
}

function calculateFinancialTotals(totalAmount, taxType) {
  const normalizedTotal = roundCurrency(totalAmount);
  if (normalizeTaxType(taxType) === "exempt") {
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
  return Math.round(number(value));
}
