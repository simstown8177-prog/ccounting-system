const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const RUNTIME_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ccounting-runtime-"));
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ccounting-data-"));
const PORT = 3210;
const HOST = "127.0.0.1";

main().catch(async (error) => {
  console.error(error.message || error);
  await bestEffortStop();
  process.exit(1);
});

async function main() {
  await runManager("start");

  const healthResponse = await fetch(`http://${HOST}:${PORT}/api/health`);
  assert(healthResponse.ok, "Health endpoint did not return 200");
  const health = await healthResponse.json();
  assert(health.ok === true, "Health endpoint did not report ready");

  const bootstrapResponse = await fetch(`http://${HOST}:${PORT}/api/bootstrap`);
  assert(bootstrapResponse.ok, "Bootstrap endpoint did not return 200");
  const bootstrap = await bootstrapResponse.json();
  assert(Array.isArray(bootstrap.categories), "Bootstrap payload is missing categories");

  const status = await runManager("status");
  assert(status.includes("healthy=true"), "Runtime manager did not report healthy status");

  await runManager("stop");

  const finalStatus = await runManager("status");
  assert(finalStatus.trim() === "stopped", "Runtime manager did not fully stop the server");

  console.log("runtime smoke test passed");
}

async function bestEffortStop() {
  try {
    await runManager("stop");
  } catch (error) {
    // Ignore cleanup failures in the failure path.
  }
}

function runManager(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts/runtime-manager.js"), command], {
      cwd: ROOT,
      env: {
        ...process.env,
        HOST,
        PORT: String(PORT),
        RUNTIME_DIR,
        DB_PATH: path.join(DATA_DIR, "app.db"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `${command} failed with code ${code}`));
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
