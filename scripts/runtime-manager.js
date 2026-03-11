const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const RUNTIME_DIR = path.resolve(process.env.RUNTIME_DIR || path.join(ROOT, ".runtime"));
const PID_PATH = path.join(RUNTIME_DIR, "server.pid");
const META_PATH = path.join(RUNTIME_DIR, "server-meta.json");
const LOG_PATH = path.join(RUNTIME_DIR, "server.log");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const SERVER_ENTRY = path.join(ROOT, "server.js");
const COMMAND = process.argv[2] || "status";

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  ensureRuntimeDir();

  if (COMMAND === "start") {
    await startServer();
    return;
  }

  if (COMMAND === "stop") {
    await stopServer();
    return;
  }

  if (COMMAND === "status") {
    await printStatus();
    return;
  }

  throw new Error(`Unsupported command: ${COMMAND}`);
}

async function startServer() {
  const current = readPid();
  if (current && isProcessAlive(current)) {
    const healthy = await isHealthy();
    if (healthy) {
      console.log(`Server already running (pid ${current})`);
      return;
    }
  }

  cleanupPidIfStale();

  const logStream = fs.openSync(LOG_PATH, "a");
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", logStream, logStream],
    env: {
      ...process.env,
      HOST,
      PORT: String(PORT),
    },
  });

  child.unref();

  writeJson(PID_PATH, `${child.pid}\n`);
  writeJson(
    META_PATH,
    JSON.stringify(
      {
        pid: child.pid,
        host: HOST,
        port: PORT,
        startedAt: new Date().toISOString(),
        logPath: LOG_PATH,
      },
      null,
      2,
    ),
  );

  await waitForHealth(15000);
  console.log(`Server started in background on http://${HOST}:${PORT} (pid ${child.pid})`);
}

async function stopServer() {
  const pid = readPid();
  if (!pid) {
    console.log("Server is not running");
    return;
  }

  if (!isProcessAlive(pid)) {
    cleanupRuntimeFiles();
    console.log("Removed stale runtime state");
    return;
  }

  process.kill(pid, "SIGTERM");
  const stopped = await waitForExit(pid, 5000);
  if (!stopped) {
    process.kill(pid, "SIGKILL");
    await waitForExit(pid, 2000);
  }

  cleanupRuntimeFiles();
  console.log(`Server stopped (pid ${pid})`);
}

async function printStatus() {
  const pid = readPid();
  const healthy = await isHealthy();

  if (!pid) {
    console.log("stopped");
    return;
  }

  if (!isProcessAlive(pid)) {
    cleanupRuntimeFiles();
    console.log("stale");
    return;
  }

  console.log(healthy ? `running pid=${pid} healthy=true` : `running pid=${pid} healthy=false`);
}

function ensureRuntimeDir() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

function readPid() {
  try {
    return Number(fs.readFileSync(PID_PATH, "utf8").trim()) || null;
  } catch (error) {
    return null;
  }
}

function cleanupPidIfStale() {
  const pid = readPid();
  if (pid && !isProcessAlive(pid)) {
    cleanupRuntimeFiles();
  }
}

function cleanupRuntimeFiles() {
  for (const filePath of [PID_PATH, META_PATH]) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

async function isHealthy() {
  try {
    const response = await fetch(`http://${HOST}:${PORT}/api/health`);
    if (!response.ok) {
      return false;
    }
    const body = await response.json();
    return body.ok === true;
  } catch (error) {
    return false;
  }
}

async function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy()) {
      return;
    }
    await delay(250);
  }

  throw new Error(`Server did not become healthy within ${timeoutMs}ms. Check ${LOG_PATH}`);
}

async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    await delay(150);
  }
  return !isProcessAlive(pid);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJson(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}
