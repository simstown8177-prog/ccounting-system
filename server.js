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

const CATEGORY_DEFINITIONS = [
  { id: "pizza-cheese-bbal", name: "피자는치즈빨", description: "피자 브랜드 운영 공간" },
  { id: "gogiji", name: "고기지", description: "육류 중심 브랜드 운영 공간" },
  { id: "future-space-1", name: "추 후 예정", description: "추가 입점 예정 공간 1" },
  { id: "future-space-2", name: "추후 예 정", description: "추가 입점 예정 공간 2" },
  { id: "future-space-3", name: "추 후 예정", description: "추가 입점 예정 공간 3" },
];

const sessions = new Map();
let storeDb;

ensureStore();
configureWebPush();

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

async function handleApi(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const store = readStore();
    return sendJson(res, 200, {
      categories: store.categories.map(toPublicCategory),
      notificationSupported: true,
      pushPublicKey: getPublicVapidKey(store),
    });
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readJson(req);
    const store = readStore();
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
    writeStore(seeded);
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
    const store = readStore();
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
    const store = readStore();
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
      category.items.unshift({
        id: crypto.randomUUID(),
        name: body.name,
        unit: body.unit,
        currentStock: number(body.currentStock),
        parStock: number(body.parStock),
      });
    });
  }

  if (req.method === "POST" && pathname === "/api/vendors") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      category.vendors.unshift({
        id: crypto.randomUUID(),
        name: body.name,
        contactPerson: body.contactPerson,
        phone: body.phone,
        kakaoId: body.kakaoId || "",
      });
    });
  }

  if (req.method === "POST" && pathname === "/api/purchase-orders") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      category.purchaseOrders.unshift({
        id: crypto.randomUUID(),
        itemId: body.itemId,
        vendorId: body.vendorId,
        quantity: number(body.quantity),
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

  if (req.method === "POST" && pathname === "/api/closings") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      applyClosing(category, {
        itemId: body.itemId,
        usedQuantity: number(body.usedQuantity),
        note: body.note || "",
        sourceLabel: body.sourceLabel || "수동 마감",
        createdAt: body.createdAt || new Date().toISOString(),
      });
    });
  }

  if (req.method === "POST" && pathname === "/api/receipt-uploads") {
    const body = await readJson(req);
    return mutateCategory(res, session, (category) => {
      const uploadId = crypto.randomUUID();
      const createdAt = body.createdAt || new Date().toISOString();
      const lines = (body.lines || []).map((line) => ({
        itemId: line.itemId,
        quantity: number(line.quantity),
      }));
      lines.forEach((line) => {
        applyClosing(category, {
          itemId: line.itemId,
          usedQuantity: line.quantity,
          note: body.note || `${body.fileName} 업로드 차감`,
          sourceLabel: "영수증 업로드",
          createdAt,
        });
      });
      category.receiptUploads.unshift({
        id: uploadId,
        fileName: body.fileName,
        fileSize: number(body.fileSize),
        note: body.note || "",
        lines,
        previewDataUrl: body.previewDataUrl || "",
        createdAt,
      });
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
      requireRole(user, "manager");
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
    const store = readStore();
    const category = findById(store.categories, session.categoryId);
    if (!category) {
      return sendJson(res, 404, { error: "category_not_found" });
    }
    const actingUser = findById(category.users, session.userId);
    const previousSignature = computeLowStockSignature(category);
    await updater(category, actingUser, store);
    category.lastLowStockSignature = computeLowStockSignature(category);
    writeStore(store);
    await maybeSendLowStockPush(store, category, previousSignature);
    const payload = formatter ? formatter(category) : { category: sanitizeCategory(category) };
    return sendJson(res, 200, payload.category ? payload : { category: sanitizeCategory(category), ...payload });
  } catch (error) {
    const statusCode = error.message === "forbidden" ? 403 : 400;
    return sendJson(res, statusCode, { error: "invalid_request", message: error.message });
  }
}

function ensureStore() {
  storeDb = createStoreDatabase({
    dataDir: DATA_DIR,
    dbPath: DB_PATH,
    legacyStorePath: STORE_PATH,
    initialStoreFactory: createInitialStore,
    migrateStore,
  });
}

function readStore() {
  return storeDb.readStore();
}

function writeStore(store) {
  storeDb.writeStore(store);
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
      closings: [],
      receiptUploads: [],
      pushSubscriptions: [],
      lastLowStockSignature: "",
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
  ];
  pizza.vendors = [
    createVendor("평택유제품", "김대리", "010-2222-1111", "pt-cheese"),
    createVendor("도우베이스", "이과장", "010-3333-2222", "dough-center"),
  ];
  pizza.purchaseOrders = [
    createPurchaseOrder(pizza.items[0].id, pizza.vendors[0].id, 10, "ordered"),
  ];

  meat.items = [
    createItem("삼겹살", "kg", 14, 12),
    createItem("상추", "box", 1, 2),
    createItem("참기름", "병", 2, 3),
  ];
  meat.vendors = [
    createVendor("평택정육", "박실장", "010-4444-3333", "pt-meat"),
    createVendor("채소나라", "정주임", "010-5555-4444", "vege-land"),
  ];
  meat.purchaseOrders = [
    createPurchaseOrder(meat.items[1].id, meat.vendors[1].id, 3, "received", 2),
  ];
  applyClosing(pizza, {
    itemId: pizza.items[0].id,
    usedQuantity: 2,
    note: "주문 영수증 일괄 차감",
    sourceLabel: "영수증 업로드",
    createdAt: new Date().toISOString(),
  });
  applyClosing(meat, {
    itemId: meat.items[1].id,
    usedQuantity: 1,
    note: "점심 영업 마감",
    sourceLabel: "수동 마감",
    createdAt: new Date().toISOString(),
  });

  return store;
}

function applyClosing(category, payload) {
  const item = findById(category.items, payload.itemId);
  if (!item) {
    throw new Error("item_not_found");
  }
  item.currentStock = round(Math.max(0, item.currentStock - number(payload.usedQuantity)));
  category.closings.unshift({
    id: crypto.randomUUID(),
    itemId: payload.itemId,
    usedQuantity: number(payload.usedQuantity),
    note: payload.note || "",
    sourceLabel: payload.sourceLabel || "수동 마감",
    createdAt: payload.createdAt || new Date().toISOString(),
  });
}

function createUser(categoryName, username, password) {
  return createUserRecord(
    `${categoryName} ${username === "manager" ? "관리자" : "직원"}`,
    username,
    password,
    username === "manager" ? "manager" : "staff",
  );
}

function createItem(name, unit, currentStock, parStock) {
  return { id: crypto.randomUUID(), name, unit, currentStock, parStock };
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
    users: category.users.map(sanitizeUser),
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
      users: (category.users || []).map((user) => migrateUser(user)),
      pushSubscriptions: category.pushSubscriptions || [],
      lastLowStockSignature: category.lastLowStockSignature || "",
    })),
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
  const normalized = String(receiptText).toLowerCase();
  return category.items
    .filter((item) => normalized.includes(String(item.name).toLowerCase()))
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      suggestedQuantity: 1,
    }));
}

function configureWebPush() {
  const store = readStore();
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
    .map((item) => `${item.id}:${item.currentStock}`)
    .sort()
    .join("|");
}

async function maybeSendLowStockPush(store, category, previousSignature) {
  const nextSignature = computeLowStockSignature(category);
  if (!nextSignature || nextSignature === previousSignature || !(category.pushSubscriptions || []).length) {
    return;
  }

  const lowStockItems = category.items.filter((item) => item.currentStock <= item.parStock);
  const payload = JSON.stringify({
    title: `${category.name} 재고 경고`,
    body: `${lowStockItems.map((item) => item.name).join(", ")} 기준 재고 이하`,
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
    writeStore(store);
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
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
