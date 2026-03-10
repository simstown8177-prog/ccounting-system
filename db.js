const fs = require("fs");
const Database = require("better-sqlite3");
const { Pool } = require("pg");

async function createStoreDatabase({
  dataDir,
  dbPath,
  legacyStorePath,
  initialStoreFactory,
  migrateStore,
  databaseUrl,
}) {
  if (databaseUrl) {
    return createPostgresStore({
      legacyStorePath,
      initialStoreFactory,
      migrateStore,
      databaseUrl,
    });
  }

  return createSqliteStore({
    dataDir,
    dbPath,
    legacyStorePath,
    initialStoreFactory,
    migrateStore,
  });
}

async function createSqliteStore({
  dataDir,
  dbPath,
  legacyStorePath,
  initialStoreFactory,
  migrateStore,
}) {
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

  const api = {
    async initialize() {
      const existingCount = database.prepare(`SELECT COUNT(*) AS count FROM app_store`).get().count;
      if (existingCount > 0) {
        const migrated = migrateStore(await api.readStore());
        await api.writeStore(migrated);
        return;
      }

      let sourceStore = initialStoreFactory();
      if (legacyStorePath && fs.existsSync(legacyStorePath)) {
        sourceStore = migrateStore(JSON.parse(fs.readFileSync(legacyStorePath, "utf8")));
      }

      await api.writeStore(sourceStore);
    },

    async readStore() {
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
    },

    async writeStore(store) {
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
    },

    async close() {
      database.close();
    },
  };

  await api.initialize();
  return api;
}

async function createPostgresStore({
  legacyStorePath,
  initialStoreFactory,
  migrateStore,
  databaseUrl,
}) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=require") || databaseUrl.includes("render.com")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const api = {
    async initialize() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_store (
          key TEXT PRIMARY KEY,
          json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM app_store`);
      if (countResult.rows[0].count > 0) {
        const migrated = migrateStore(await api.readStore());
        await api.writeStore(migrated);
        return;
      }

      let sourceStore = initialStoreFactory();
      if (legacyStorePath && fs.existsSync(legacyStorePath)) {
        sourceStore = migrateStore(JSON.parse(fs.readFileSync(legacyStorePath, "utf8")));
      }

      await api.writeStore(sourceStore);
    },

    async readStore() {
      const result = await pool.query(`SELECT key, json FROM app_store`);
      const configRow = result.rows.find((row) => row.key === "config");
      const categoryRows = result.rows
        .filter((row) => row.key.startsWith("category:"))
        .map((row) => row.json)
        .sort((left, right) => left.displayOrder - right.displayOrder);

      return {
        config: configRow ? configRow.json : {},
        categories: categoryRows,
      };
    },

    async writeStore(store) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `
            INSERT INTO app_store (key, json, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT(key) DO UPDATE
            SET json = EXCLUDED.json,
                updated_at = NOW()
          `,
          ["config", JSON.stringify(store.config || {})],
        );

        const nextKeys = new Set(["config"]);
        for (const category of store.categories || []) {
          const key = `category:${category.id}`;
          nextKeys.add(key);
          await client.query(
            `
              INSERT INTO app_store (key, json, updated_at)
              VALUES ($1, $2::jsonb, NOW())
              ON CONFLICT(key) DO UPDATE
              SET json = EXCLUDED.json,
                  updated_at = NOW()
            `,
            [key, JSON.stringify(category)],
          );
        }

        const currentKeys = await client.query(`SELECT key FROM app_store`);
        for (const row of currentKeys.rows) {
          if (!nextKeys.has(row.key)) {
            await client.query(`DELETE FROM app_store WHERE key = $1`, [row.key]);
          }
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    },
  };

  await api.initialize();
  return api;
}

module.exports = {
  createStoreDatabase,
};
