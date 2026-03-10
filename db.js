const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function createStoreDatabase({ dataDir, dbPath, legacyStorePath, initialStoreFactory, migrateStore }) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_store (
      key TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const upsertStatement = database.prepare(`
    INSERT INTO app_store (key, json, updated_at)
    VALUES (@key, @json, @updatedAt)
    ON CONFLICT(key) DO UPDATE SET
      json = excluded.json,
      updated_at = excluded.updated_at
  `);

  const deleteStatement = database.prepare(`DELETE FROM app_store WHERE key = ?`);
  const selectAllStatement = database.prepare(`SELECT key, json FROM app_store`);

  function initialize() {
    const existingCount = database.prepare(`SELECT COUNT(*) AS count FROM app_store`).get().count;
    if (existingCount > 0) {
      const migrated = migrateStore(readStore());
      writeStore(migrated);
      return;
    }

    let sourceStore = initialStoreFactory();
    if (legacyStorePath && fs.existsSync(legacyStorePath)) {
      sourceStore = migrateStore(JSON.parse(fs.readFileSync(legacyStorePath, "utf8")));
    }

    writeStore(sourceStore);
  }

  function readStore() {
    const rows = selectAllStatement.all();
    const configRow = rows.find((row) => row.key === "config");
    const categoryRows = rows
      .filter((row) => row.key.startsWith("category:"))
      .map((row) => JSON.parse(row.json))
      .sort((left, right) => left.displayOrder - right.displayOrder);

    return {
      config: configRow ? JSON.parse(configRow.json) : {},
      categories: categoryRows,
    };
  }

  function writeStore(store) {
    const transaction = database.transaction((nextStore) => {
      const updatedAt = new Date().toISOString();
      upsertStatement.run({
        key: "config",
        json: JSON.stringify(nextStore.config || {}),
        updatedAt,
      });

      const nextKeys = new Set(["config"]);
      for (const category of nextStore.categories || []) {
        const key = `category:${category.id}`;
        nextKeys.add(key);
        upsertStatement.run({
          key,
          json: JSON.stringify(category),
          updatedAt,
        });
      }

      const currentKeys = database.prepare(`SELECT key FROM app_store`).all();
      for (const row of currentKeys) {
        if (!nextKeys.has(row.key)) {
          deleteStatement.run(row.key);
        }
      }
    });

    transaction(store);
  }

  function close() {
    database.close();
  }

  initialize();

  return {
    database,
    readStore,
    writeStore,
    close,
  };
}

module.exports = {
  createStoreDatabase,
};
