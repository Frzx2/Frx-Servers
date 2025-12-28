const { shell } = require("electron");
const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const { start } = require("repl");
const home_screen =document.getElementById("home_menu");
const { spawn } = require("child_process");
const process = require("process");
const os = require("os");
const si = require("systeminformation");
const { error } = require("console");
const { exec,execSync } = require("child_process");
const https = require("https");
const { Rcon } = require("rcon-client");
const crypto = require("crypto");
// Main Window On closing // 

ipcRenderer.on("app-close", async () => {
  console.log("App is trying to close, running cleanup...");

  try {
    await stopServer(); 
  } catch (err) {
    console.error("Cleanup failed:", err);
  }

  // Notify main process that cleanup is done
  ipcRenderer.send("app-close-confirmed");
});

// === Initialization ===
document.addEventListener("DOMContentLoaded", () => {
  const serverPath = localStorage.getItem("selectedServerPath");
  document.getElementById("player-search").addEventListener("input", filterPlayers);

  if (!serverPath || !fs.existsSync(serverPath)) {
    console.error("⚠️ No valid server path found.");
    showToast("Server folder not found!", "error", true);
    return;
  }

  window.serverPath = serverPath;
  loadServerInfo(serverPath);
  loadServerProperties(serverPath);
  // === Restart Toggle Logic ===
   // Get restart UI elements
  const restartToggle = document.getElementById("restart-toggle");
  const restartIntervalInput = document.getElementById("restart-interval");
  const restartCard = document.getElementById("restart-card");

  if (!restartToggle || !restartIntervalInput || !restartCard) {
    appendConsole("Restart UI elements missing", "error");
    return;
  }

  // Load saved auto-restart state into UI
  LoadAutoRestart();

  // Toggle ON / OFF behavior
  restartToggle.addEventListener("change", () => {
    const enabled = restartToggle.checked;

    restartCard.classList.toggle("active", enabled);
    restartIntervalInput.disabled = !enabled;

    SaveAutoRestart(); // optional but recommended
  });

  // Restart interval input handling
  restartIntervalInput.addEventListener("input", () => {
    let value = parseInt(restartIntervalInput.value, 10);

    if (isNaN(value)) return;

    if (value < 1) value = 1;
    if (value > 24) value = 24;

    restartIntervalInput.value = value;

    SaveAutoRestart(); // optional
  });

  // 🪶 Initialize Feather icons
  if (typeof feather !== "undefined") {
    feather.replace();
  } else {
    console.warn("⚠️ Feather icons not loaded. Make sure feather.min.js is included in your HTML.");
    showToast("Feather icons not loaded", "warning");
  }
  // Server Management 
  const tabButtons = document.querySelectorAll(".tab-btn");
  const playerList = document.getElementById("pm-list");
  setupPropertyChangeDetection(); 

  setupPlayerTabs();
  // 🧩 Copy button logic
  const copyBtn = document.getElementById("copy-ip-btn");
  const ipElement = document.getElementById("server-ip");

  if (copyBtn && ipElement) {
    copyBtn.addEventListener("click", () => {
      const ipText = ipElement.textContent.replace("IP:", "").trim();

      if (!ipText || ipText === "--.--.--.--") {
        showToast("No IP address to copy yet!", "warning", true);
        return;
      }

      navigator.clipboard.writeText(ipText)
        .then(() => {
          copyBtn.innerHTML = '<i data-feather="check"></i>';
          feather.replace();
          showToast("IP copied to clipboard!", "success");

          setTimeout(() => {
            copyBtn.innerHTML = '<i data-feather="copy"></i>';
            feather.replace();
          }, 1500);
        })
        .catch(err => {
          console.error("Clipboard error:", err);
          showToast("Failed to copy IP!", "error", true);
        });
    });
  }
});

home_screen.addEventListener("click",()=>{
  window.location.href = "../home_screen/home_screen.html";
});

function toggleHomeButton(enable) {
  const wrapper = home_screen.parentElement;
  if (!home_screen) return;

  if (enable) {
    home_screen.disabled = false;
    home_screen.classList.remove("disabled-btn");
    wrapper.removeAttribute("title");
  } else {
    home_screen.disabled = true;
    home_screen.classList.add("disabled-btn");
    wrapper.setAttribute("title", "When server is online you can't go into Home Menu");
  }
}

// === Load Basic Server Info ===
function loadServerInfo(serverPath) {
  const infoPath = path.join(serverPath, "server_info.json");
  const defaultIcon = path.join(__dirname, "../../Icon/logo.png");
  const iconPath = path.join(serverPath, "server-icon.png");

  // === Load JSON data ===
  if (fs.existsSync(infoPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(infoPath, "utf-8"));

      setText("server-name", data.server_name || "Unnamed Server");
      setText("server-ip", `IP: ${data.server_ip || "N/A"}`);
      setText("server-version", `Version: ${data.server_version || "Unknown"}`);
      setText("server-status", `Status: ${data.server_status || "Offline"}`);
      setText("server-type", `Type: ${data.server_type || "Unknown"}`);
      setText("player-count", `Players: ${data.players}` )

    } catch (err) {
      console.error("❌ Failed to read server_info.json:", err);
    }
  }

  // === Set icon ===
  const iconSrc = fs.existsSync(iconPath)
    ? `file://${normalize(iconPath)}`
    : `file://${normalize(defaultIcon)}`;

  const iconEl = document.getElementById("server-icon");
  if (iconEl) iconEl.src = iconSrc;
}


// === Helpers ===
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function normalize(p) {
  return p.replace(/\\/g, "/");
}

// === Server Status Update Function ===
// Pass true for Online, false for Offline

const statusCard = document.querySelector(".status-mini-card");
const statusText = document.getElementById("server-status");

function toggleServerStatus(isOnline) {
  // === Update UI ===
  if (isOnline) {
    statusCard.classList.remove("offline");
    statusCard.classList.add("online");
    statusText.textContent = "Status: Online";
  } else {
    statusCard.classList.remove("online");
    statusCard.classList.add("offline");
    statusText.textContent = "Status: Offline";
  }

  // === Update server_info.json ===
  const infoPath = path.join(serverPath, "server_info.json");

  try {
    // Create file if it doesn't exist
    let data = {};
    if (fs.existsSync(infoPath)) {
      data = JSON.parse(fs.readFileSync(infoPath, "utf-8"));
    }

    // Update the status
    data.server_status = isOnline ? "online" : "offline";

    // Write it back to file
    fs.writeFileSync(infoPath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`Updated server_info.json: ${data.server_status}`);
  } catch (error) {
    console.error(`Error reading or writing server_info.json: ${error.message}`);
  }
}


// === Set Server State (css style changing) === 
function setServerState(state) {
  const validStates = ["online", "offline", "starting", "stopping", "restarting"];
  statusCard.classList.remove(...validStates); // clear previous state
  statusCard.classList.add(state);

  let text = "";

  switch (state) {
    case "online":
      text = "Status: Online";
      toggleHomeButton(false)
      break;

    case "offline":
      text = "Status: Offline";
      toggleHomeButton(true)
      break;

    case "starting":
      text = "Status: Starting<span class='dots'></span>";
      toggleHomeButton(false)
      break;

    case "stopping":
      text = "Status: Stopping<span class='dots'></span>";
      break;

    case "restarting":
      text = "Status: Restarting<span class='dots'></span>";
      toggleHomeButton(false)
      break;
  }

  statusText.innerHTML = text;
}


// === Server Control Buttons ===
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const restartBtn = document.getElementById("restart-btn");
const killBtn = document.getElementById("kill-btn");

if (startBtn && stopBtn && restartBtn && killBtn) {
  startBtn.onclick = () => {
    console.log("▶️ Starting server...");
    startServer();
  };

  stopBtn.onclick = () => {
    console.log("🛑 Stopping server...");
    stopServer();
    
  }

  killBtn.onclick = () => {
    console.log("💀 Killing server...");
    killServer();
  };

  restartBtn.onclick = () => {
    console.log("🔁 Restarting server...")
    restartServer();
  } 
}

function disableButtons() {
  [startBtn, stopBtn, restartBtn, killBtn].forEach(b => b.disabled = true);
}

function enableButtons() {
  [startBtn, stopBtn, restartBtn, killBtn].forEach(b => b.disabled = false);
}

// Set Server Controls 
function toggleButtons(state) {
  const starting = state === "starting";
  const stopping = state === "stopping";
  const running = state === "running";
  const stopped = state === "stopped";

  // Disable actions during transition
  const disableAll = starting || stopping;

  startBtn.disabled = disableAll;
  stopBtn.disabled = disableAll;
  restartBtn.disabled = disableAll;
  killBtn.disabled = disableAll;

  // Starting: hide everything
  if (starting) {
    startBtn.classList.add("hidden");
    stopBtn.classList.add("hidden");
    restartBtn.classList.add("hidden");
    killBtn.classList.add("hidden");
  }

  // Running
  if (running) {
    startBtn.classList.add("hidden");
    stopBtn.classList.remove("hidden");
    restartBtn.classList.remove("hidden");
    killBtn.classList.remove("hidden");
  }

  // Stopping: hide everything
  if (stopping) {
    startBtn.classList.add("hidden");
    stopBtn.classList.add("hidden");
    restartBtn.classList.add("hidden");
    killBtn.classList.add("hidden");
  }

  // Stopped
  if (stopped) {
    startBtn.classList.remove("hidden");
    stopBtn.classList.add("hidden");
    restartBtn.classList.add("hidden");
    killBtn.classList.add("hidden");
  }
}

// === Server Fucntions ===

let isServerRunning = false;
let serverProcess = null;
let usageInterval = null;

//Starting Server 
async function startServer() {
  toggleButtons("starting");
  setServerState("starting");
  startUptime();
  startGraph();
  
  const consoleBox = document.getElementById("console-output");
  const baseDir = localStorage.getItem("selectedServerPath");
  const infoPath = path.join(baseDir, "server_info.json");
  const jarPath = path.join(baseDir, "server.jar");
  const propertiesPath = path.join(baseDir, "server.properties");
  // Reset Console Messages
  consoleBox.textContent = "";
  appendConsole("Clearing Logs", "info");

  // === Read server_info.json ===
  let serverInfo = {};
  let javaPath = "java";
  let serverRAM = 2048;
  let serverType = "vanilla";

  if (fs.existsSync(infoPath)) {
    try {
      serverInfo = JSON.parse(fs.readFileSync(infoPath, "utf8"));
      javaPath = serverInfo.java_path || "java";
      serverRAM = serverInfo.server_ram || 2048;
      serverType = (serverInfo.server_type || "vanilla").toLowerCase();
    } catch (err) {
      appendConsole(`Error reading server_info.json: ${err}`, "error");
      return;
    }
  } else {
    appendConsole("⚠️ server_info.json not found. Using defaults.", "error");
  }

  // === Check for server.jar ===
  if (!fs.existsSync(jarPath)) {
    appendConsole(`❌ server.jar not found in: ${jarPath}`, "error");
    toggleButtons("stopped");
    setServerState("offline");
    stopPlayerMonitor();
    return;
  }
  // === Check for server.properties ===
  if (!fs.existsSync(propertiesPath)) {
    appendConsole("⚠️ server.properties not found — cannot verify RCON.", "error");
    toggleButtons("stopped");
    toggleServerStatus(false);
    stopPlayerMonitor();
    setServerState("offline");
    return;
  }

try {
  // ---------- Load server.properties ----------
  let properties = fs.readFileSync(propertiesPath, "utf8");
  let modified = false;

  // ---------- Parse properties ----------
  const propMap = {};
  for (const line of properties.split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [k, ...v] = line.split("=");
    propMap[k.trim()] = v.join("=").trim();
  }

  // ---------- Ensure server_info.json password ----------
  let rconPassword = serverInfo.rcon_password;
  let rconPort = serverInfo.rcon_port || Number(propMap["rcon.port"]) || 25575;

  if (!rconPassword) {
    rconPassword = crypto.randomBytes(16).toString("hex");
    serverInfo.rcon_password = rconPassword;
    serverInfo.rcon_port = rconPort;
  }

  // ---------- Sync server_info.json (always) ----------
  serverInfo.rcon_password = rconPassword;
  serverInfo.rcon_port = rconPort;
  fs.writeFileSync(infoPath, JSON.stringify(serverInfo, null, 2), "utf8");

  // ---------- enable-rcon ----------
  if (propMap["enable-rcon"] !== "true") {
    propMap["enable-rcon"] = "true";
    modified = true;
  }

  // ---------- rcon.password (FORCE MATCH info) ----------
  if (propMap["rcon.password"] !== rconPassword) {
    propMap["rcon.password"] = rconPassword;
    modified = true;
  }

  // ---------- rcon.port ----------
  if (!propMap["rcon.port"]) {
    propMap["rcon.port"] = String(rconPort);
    modified = true;
  }

  // ---------- Rebuild properties ----------
  if (modified) {
    const rebuilt = Object.entries(propMap)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    fs.writeFileSync(propertiesPath, rebuilt + "\n", "utf8");
    await new Promise(res => setTimeout(res, 300));
  }

  // ---------- Verify ----------
  const verify = fs.readFileSync(propertiesPath, "utf8");
  if (
    !/enable-rcon\s*=\s*true/i.test(verify) ||
    !new RegExp(`rcon\\.password\\s*=\\s*${rconPassword}`).test(verify) ||
    !new RegExp(`rcon\\.port\\s*=\\s*${rconPort}`).test(verify)
  ) {
    throw new Error("RCON verification failed after sync");
  }

} catch (err) {
  appendConsole(`❌ Failed to setup RCON: ${err.message}`, "error");
  toggleButtons("stopped");
  setServerState("offline");
  stopPlayerMonitor();
  return;
}

    
  // === Calculate RAM ===
  const ramMax = `${Math.floor(serverRAM / 1024)}G`;

  // === Start Playit tunnel ===
  try {
    fetchPlayitIP();
  } catch {
    appendConsole(" fetchPlayitIP() not available or failed to start.", "error");
  }

  // === Prepare Java command ===
  const args = [
    `-Xmx${ramMax}`,
    "-Xms1G",
    "-jar",
    "server.jar",
    "nogui"
  ];

  appendConsole("🚀 Launching process:", "info");
  appendConsole(`"${javaPath}" ${args.join(" ")}`, "info");

  try {
      serverProcess = spawn(`"${javaPath}"`, args, {
      cwd: baseDir,
      shell: true
    });

    let serverStarted = false;

    serverProcess.stdout.on("data", (data) => {
      const text = data.toString();
      appendConsole(text, "info");

      // Detect server start message
      if (!serverStarted && /Done\s*\(\d+\.\d+s\)!.*type "help"/i.test(text)) {
        serverStarted = true;
        appendConsole("✅ Server started successfully and is now running!", "success");
        setServerState("online");
        isServerRunning = true;
        showToast("Server Started!", "success");
        startPlayerMonitor();
        toggleButtons("running");
        ExecuteAutoRestart();
      }
    });

    serverProcess.stderr.on("data", (data) => {
      appendConsole(data.toString(), "error");
    });

    serverProcess.on("exit", (code) => {
      appendConsole(`🛑 Server exited with code ${code}`, "error");
      showToast("Server Stopped", "error");
      toggleButtons("stopped");
      setServerState("offline");
      stopPlayit();
    });

    // Make serverProcess globally accessible
    window.serverProcess = serverProcess;

  } catch (err) {
    appendConsole(`❌ Failed to start server process: ${err}`, "error");
    showToast("Server Stoped!","error");
    toggleButtons("stopped");
    stopPlayit();
    stopPlayerMonitor();
    setServerState("offline");
  }
}
// Stoping Server
async function stopServer() {
  appendConsole("Stopping server...");
  if (!serverProcess || !isServerRunning) {
    appendConsole("No running server process found.");
    toggleButtons("stopping");
    stopPlayerMonitor();
    setServerState("offline");
    return;
  }

  toggleButtons("stopping");
  setServerState("stopping");
  stopGraph();
  stopUptime();

  let stopped = false;

  // === Try RCON stop ===
  try {
    const { password, port } = ensureRconCredentials();
    if (password && port) {
      const { Rcon } = require("rcon-client");
      const rcon = await Rcon.connect({ host: "127.0.0.1", port, password });
      await rcon.send("stop");
      await rcon.end();
      appendConsole("Sent 'stop' via RCON");
      stopped = true;
    }
  } catch (err) {
    appendConsole(`RCON stop failed: ${err.message}`);
  }

  // === Fallback: stdin stop ===
  if (!stopped) {
    try {
      if (serverProcess.stdin && !serverProcess.stdin.destroyed) {
        serverProcess.stdin.write("stop\n");
        appendConsole("Sent 'stop' via stdin");
        stopped = true;
      }
    } catch (err) {
      appendConsole(`Failed to send stop via stdin: ${err.message}`);
    }
  }

  // === Wait for graceful exit ===
  const waitForExit = (proc, timeout) => new Promise((resolve, reject) => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    proc.once("exit", finish);
    proc.once("close", finish);
    const timer = setTimeout(() => { if (!done) { done = true; reject(); } }, timeout);
  });

  try {
    await waitForExit(serverProcess, 10_000);
    appendConsole("Server stopped gracefully.");
  } catch {
    appendConsole("Server did not exit in 10s. Forcing termination...");
    try {
      if (process.platform === "win32") {
        try {
          serverProcess.kill();
          await waitForExit(serverProcess, 5_000);
          appendConsole("Server terminated via kill()");
        } catch {
          execSync(`taskkill /PID ${serverProcess.pid} /T /F`);
          appendConsole("Server killed via taskkill");
        }
      } else {
        serverProcess.kill("SIGTERM");
        try {
          await waitForExit(serverProcess, 5_000);
          appendConsole("Server terminated with SIGTERM");
        } catch {
          serverProcess.kill("SIGKILL");
          appendConsole("Server killed with SIGKILL");
        }
      }
    } catch (err) {
      appendConsole(`Error terminating process: ${err.message}`);
    }
  }

  // === Cleanup ===
  isServerRunning = false;
  serverProcess = null;
  stopPlayit();

  try {
    const baseDir = localStorage.getItem("selectedServerPath");
    const infoPath = path.join(baseDir, "server_info.json");
    if (fs.existsSync(infoPath)) {
      const data = JSON.parse(fs.readFileSync(infoPath, "utf8"));
      data.server_status = "Offline";
      data.server_players = "Players: N/A";
      data.player_list = [];
      data.server_tps = "N/A";
      fs.writeFileSync(infoPath, JSON.stringify(data, null, 2), "utf8");
    }
  } catch (err) {
    appendConsole(`Error updating server_info.json: ${err.message}`);
  }
  appendConsole("Server fully stopped.");
  stopPlayerMonitor();
  setServerState("offline");
  toggleButtons("stopped")
  stopAutoRestart();
}

// Ensuring Rcon is Set to True
function ensureRconCredentials() {
  // Attempt to read RCON credentials from server_info.json
  try {
    const infoPath = path.join(serverPath || ".", "server_info.json");
    if (fs.existsSync(infoPath)) {
      const info = JSON.parse(fs.readFileSync(infoPath, "utf8") || "{}");
      const pw = info.rcon_password || info.rconPass || null;
      const port = info.rcon_port || info.rconPort || null;
      console.log(`[DEBUG] ensureRconCredentials -> pw:${pw ? "***" : "null"}, port:${port}`);
      return { password: pw, port: port };
    }
  } catch (e) {
    console.log("[DEBUG] ensureRconCredentials error:", e);
  }
  return { password: null, port: null };
}
// Generating Rcon Password 
function RconPassword() {
  const info_path = path.join(serverPath || ".", "server_info.json");

  // Default empty object
  let data = {};

  // Read existing file if present
  if (fs.existsSync(info_path)) {
    try {
      data = JSON.parse(fs.readFileSync(info_path, "utf8"));
    } catch (err) {
      console.error("Failed to read server_info.json:", err.message);
      data = {};
    }
  }

  // If password already exists, return it
  if (data.rcon_password && typeof data.rcon_password === "string") {
    return data.rcon_password;
  }

  // Generate secure password
  const password = crypto.randomBytes(16).toString("hex");

  // Append (not overwrite) password
  data.rcon_password = password;

  // Save back to file
  try {
    fs.writeFileSync(info_path, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write RCON password:", err.message);
  }

  return password;
}

//Restarting Server 
async function restartServer() {
  appendConsole("Restarting server...");
  disableButtons();
  setServerState("restarting");
  showToast("Restarting Server", "problem");

  try {
    // --- Stop current server ---
    appendConsole("Stopping current server before restart...");
    await stopServer();

    // Wait a short moment to ensure clean shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));

    // --- Start server again ---
    appendConsole("Starting server again...");
    await startServer();
    enableButtons();
    toggleButtons("running");
    appendConsole("Server restart complete.");
  } catch (err) {
    appendConsole(`Failed to restart server: ${err.message}`);
    setServerState("offline");
    enableButtons();
    
  }
}
//Killing Server
async function killServer() {
  appendConsole("Forcing server termination...");

  if (!serverProcess) {
    appendConsole("No active server process found.");
    toggleButtons("stopped");
    setServerState("offline");
    return;
  }

  try {
    setServerState("stopping");
    toggleButtons("stopping");

    // --- Kill process forcefully ---
    if (process.platform === "win32") {
      try {
        const { execSync } = require("child_process");
        execSync(`taskkill /PID ${serverProcess.pid} /T /F`);
        appendConsole("Server force-killed via taskkill (Windows).");
      } catch (err) {
        appendConsole(`taskkill failed: ${err.message}`);
      }
    } else {
      try {
        serverProcess.kill("SIGKILL");
        appendConsole("Server force-killed via SIGKILL (Unix/Linux).");
      } catch (err) {
        appendConsole(`SIGKILL failed: ${err.message}`);
      }
    }

    // --- Cleanup ---
    isServerRunning = false;
    serverProcess = null;
    stopPlayit();

    // --- Update info file ---
    try {
      const baseDir = localStorage.getItem("selectedServerPath");
      const infoPath = path.join(baseDir, "server_info.json");
      if (fs.existsSync(infoPath)) {
        const data = JSON.parse(fs.readFileSync(infoPath, "utf8"));
        data.server_status = "Offline";
        data.server_players = "Players: N/A";
        data.player_list = [];
        data.server_tps = "N/A";
        fs.writeFileSync(infoPath, JSON.stringify(data, null, 2), "utf8");
      }
    } catch (err) {
      appendConsole(`Error updating server_info.json: ${err.message}`);
    }

    clearAllPlayerCards?.();

    appendConsole("Server process killed successfully.");
    showToast("Server Killed", "error");
    stopPlayerMonitor();
    stopAutoRestart();
    setServerState("offline");
    toggleButtons("stopped");

    // Reset IP / tunnel
    server_ip = "IP: Tunnel Stopped";
    
  } catch (err) {
    appendConsole(`Kill server error: ${err.message}`);
    setServerState("offline");
  }
}

// === Playit.gg Opertaion ===
let playitPollInterval = null;

async function fetchPlayitIP() {

  try {
    const ipStatus = await ipcRenderer.invoke("start-playit");
    document.getElementById("server-ip").innerText = ipStatus;
    // ✅ Prevent multiple polling loops
    if (playitPollInterval) return ipStatus;

    // ✅ Start polling ONLY if still fetching
    if (ipStatus === "Fetching IP...") {

      playitPollInterval = setInterval(async () => {
        try {
          const status = await ipcRenderer.invoke("start-playit");
          if (status && status.includes(".joinmc.link")) {           

            clearInterval(playitPollInterval);
            playitPollInterval = null;

            document.getElementById("server-ip").innerText = status;

            //  Update server_info.json safely
            try {
              const baseDir = localStorage.getItem("selectedServerPath");
              if (!baseDir) {
                const msg = "Server path not selected.";
                showToast(msg, "error");
                appendConsole(msg, "error");
                return;
              }

              const infoPath = path.join(baseDir, "server_info.json");

              if (!fs.existsSync(infoPath)) {
                const msg = "server_info.json not found.";
                showToast(msg, "error");
                appendConsole(msg, "error");
                return;
              }

              const data = JSON.parse(fs.readFileSync(infoPath, "utf8"));
              data.server_ip = status;

              fs.writeFileSync(infoPath, JSON.stringify(data, null, 2), "utf8");

              console.log("💾 [DEBUG] server_info.json updated.");

            } catch (fsErr) {
              const msg = "Failed to update server_info.json: " + fsErr.message;
              console.error("❌", msg);
              showToast(msg, "error");
              appendConsole(msg, "error");
            }
          }

        } catch (pollErr) {
          const msg = "Playit polling failed: " + pollErr.message;
          console.error("❌", msg);
          showToast(msg, "error");
          appendConsole(msg, "error");
        }
      }, 2000);
    }

    return ipStatus;

  } catch (err) {
    const msg = "Failed to start Playit: " + err.message;
    console.error("❌", msg);
    showToast(msg, "error");
    appendConsole(msg, "error");
    return "Error";
  }
}


// STOP PLAYIT (
async function stopPlayit() {
  try {
    const result = await ipcRenderer.invoke("stop-playit");

    document.getElementById("server-ip").innerText = "Tunnel Stopped";

    if (playitPollInterval) {
      clearInterval(playitPollInterval);
      playitPollInterval = null;
    }

  } catch (err) {
    const msg = "Failed to stop Playit: " + err.message;
    console.error("❌", msg);
    showToast(msg, "error");
    appendConsole(msg, "error");
  }
}


// DISCONNECT LISTENER FROM MAIN
ipcRenderer.on("playit-disconnected", (event, msg) => {
  console.warn("⚠️ Playit disconnected:", msg);

  document.getElementById("server-ip").innerText = "Tunnel Disconnected";

  showToast("Playit disconnected: " + msg, "error");
  appendConsole("Playit disconnected: " + msg, "error");

  if (playitPollInterval) {
    clearInterval(playitPollInterval);
    playitPollInterval = null;
  }
});


//  IP FOUND LISTENER (INSTANT UPDATE)
ipcRenderer.on("playit-ip-found", (event, ip) => {
  console.log("✅ Instant Playit IP received:", ip);

  if (playitPollInterval) {
    clearInterval(playitPollInterval);
    playitPollInterval = null;
  }

  document.getElementById("server-ip").innerText = ip;
});

// === Append console messages ===
function appendConsole(msg, type = "info", clearLog = false) {
  const consoleBox = document.getElementById("console-output");
  if (consoleBox) {
    // === Display message in UI ===
    const message = document.createElement("div");
    message.classList.add("console-message", `type-${type}`);
    message.textContent = msg;
    consoleBox.appendChild(message);
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }

  try {
    // === Get server folder path ===
    const baseDir = localStorage.getItem("selectedServerPath");
    if (!baseDir) return;

    const logPath = path.join(baseDir, "log.json");

    // === Clear log if requested ===
    if (clearLog) {
      fs.writeFileSync(logPath, JSON.stringify([], null, 2), "utf8");
      return;
    }

    // === Read existing log.json or initialize empty array ===
    let logs = [];
    if (fs.existsSync(logPath)) {
      const raw = fs.readFileSync(logPath, "utf8");
      try {
        logs = JSON.parse(raw);
        if (!Array.isArray(logs)) logs = [];
      } catch {
        logs = [];
      }
    }

    // === Append new entry ===
    logs.push({ type, msg });

    // === Write back updated log ===
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write log.json:", err);
  }
}

// === Send Command to Server Through Console ===
function SendConsoleCommand(command) {
  command = command.trim();
  if (!command) return;

  if (serverProcess && isServerRunning) {
    // === Stop command ===
    if (command.toLowerCase() === "stop" || command.toLowerCase() === "/stop") {
      stopServer();
      return;
    }

    try {
      // === Send command to server's stdin ===
      serverProcess.stdin.write(command + "\n");
      appendConsole(`> ${command}`, "command");
    } catch (err) {
      appendConsole(`❌ Failed to send command: ${err}`, "error");
    }
  } else {
    appendConsole("⚠️ Cannot send command — server is not running.", "error");
  }
}


// === Console Input Handlers ===
document.addEventListener("DOMContentLoaded", () => {
  const sendButton = document.getElementById("send-command-btn");
  const consoleInput = document.getElementById("console-input");

  // Handle button click
  sendButton.addEventListener("click", () => {
    const command = consoleInput.value.trim();
    if (command) {
      SendConsoleCommand(command);
      consoleInput.value = ""; // Clear input after sending
    }
  });

  // Handle Enter key press
  consoleInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      const command = consoleInput.value.trim();
      if (command) {
        SendConsoleCommand(command);
        consoleInput.value = ""; // Clear input after sending
      }
    }
  });
});

// === Bind save button ===
document.getElementById("save-properties-btn").addEventListener("click", saveServerProperties);

// === Detect Property Changes ===
let lastToastTime = 0;

function setupPropertyChangeDetection() {
  const propertiesSection = document.getElementById("properties");
  const inputs = propertiesSection.querySelectorAll("input, select");

  inputs.forEach(input => {
    input.addEventListener("change", () => {
      const now = Date.now();
      if (now - lastToastTime > 500) { // 0.5 seconds cooldown
        showToast(`Property "${input.id || input.name || 'unknown'}" changed. Save Properties to Apply the Changes`, "problem");
        lastToastTime = now;
      }
    });
  });
}
// load Server Properties

function loadServerProperties(serverPath) {
  try {
    const propertiesFile = path.join(serverPath, "server.properties");

    if (!fs.existsSync(propertiesFile)) {
      console.error("❌ server.properties not found at:", propertiesFile);
      return;
    }

    const fileData = fs.readFileSync(propertiesFile, "utf8");
    const lines = fileData.split(/\r?\n/);

    // Parse properties into an object
    const properties = {};
    for (const line of lines) {
      if (!line || line.startsWith("#")) continue; // Skip comments or empty lines
      const [key, value] = line.split("=");
      if (key && value !== undefined) {
        properties[key.trim()] = value.trim();
      }
    }

    // Apply each property to the UI
    Object.entries(properties).forEach(([key, value]) => {
      const element = document.getElementById(key);
      if (!element) return; // skip if UI doesn't have a matching ID

      // Handle different input types
      if (element.tagName === "SELECT") {
        element.value = value;
      } else if (element.tagName === "INPUT") {
        if (element.type === "number") {
          element.value = parseInt(value, 10);
        } else if (element.type === "checkbox") {
          element.checked = value === "true";
        } else {
          element.value = value;
        }
      }
    });

    console.log("✅ Server properties loaded into UI successfully!");
  } catch (error) {
    console.error("⚠️ Error loading server.properties:", error);
  }
}

// === Save Properties ===
async function saveServerProperties() {
  if (!serverPath) {
    showToast("Server path not found.", "error");
    return;
  }

  // Read all property values
  const propertiesSection = document.getElementById("properties");
  const allInputs = propertiesSection.querySelectorAll("input, select");
  const newProperties = {};

  allInputs.forEach(el => {
    const id = el.id;
    let value = el.value;
    newProperties[id] = value;
  });

  // If server running, ask confirmation
  if (isServerRunning && serverProcess) {
    const ask = await showToast(
      "Server must be restarted to apply these properties. Restart now?",
      "problem",
      true
    );

    if (ask) {
      await writePropertiesToFile(newProperties);
      restartServer();
    } else {
      await writePropertiesToFile(newProperties);
      showToast("Properties saved. Changes will take effect after restart.", "success");
    }
  } else {
    await writePropertiesToFile(newProperties);
    showToast("Properties saved successfully.", "success");
  }

  propertiesChanged = false;
}

// === Write to server.properties file ===
async function writePropertiesToFile(newProperties) {
  const filePath = path.join(serverPath, "server.properties");
  console.log("📝 Saving properties to:", filePath);

  try {
    // === Step 1: Read existing file ===
    let existing = {};
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim() || line.startsWith("#")) continue;
        const [key, ...rest] = line.split("=");
        existing[key.trim()] = rest.join("=").trim();
      }
    }

    // === Step 2: Merge with new changes ===
    const updated = { ...existing, ...newProperties };

    // === Step 3: Build new content ===
    const header = `#Minecraft server properties\n#${new Date().toString()}\n`;
    let content = header;
    for (const [key, value] of Object.entries(updated)) {
      content += `${key}=${value}\n`;
    }

    fs.writeFileSync(filePath, content, "utf-8");
    console.log("✅ Properties saved successfully!");
    return true;
  } catch (err) {
    console.error("❌ Error writing server.properties:", err);
    showToast("Failed to save properties.", "error");
    return false;
  }
}

// === Show Toast === //
async function showToast(msg, type = "success", ask = false) {
  return new Promise((resolve) => {
    // Create the container if it doesn’t exist
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    // Create the toast element
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-msg">${msg}</span>`;

    // If ask=true, add Yes/No buttons
    if (ask) {
      const btns = document.createElement("div");
      btns.className = "toast-buttons";

      const yesBtn = document.createElement("button");
      yesBtn.textContent = "Yes";
      yesBtn.className = "toast-btn yes";

      const noBtn = document.createElement("button");
      noBtn.textContent = "No";
      noBtn.className = "toast-btn no";

      btns.appendChild(yesBtn);
      btns.appendChild(noBtn);
      toast.appendChild(btns);

      // Set up listeners
      yesBtn.onclick = () => closeToast(true);
      noBtn.onclick = () => closeToast(false);
    }

    container.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add("show"), 100);

    // Timeout handling
    const timeout = setTimeout(() => {
      closeToast(false);
    }, ask ? 10000 : 3000);

    // Close toast function
    function closeToast(value) {
      clearTimeout(timeout);
      toast.classList.remove("show");
      setTimeout(() => {
        toast.remove();
        resolve(value);
      }, 400);
    }

    // Auto-close if not ask
    if (!ask) {
      setTimeout(() => closeToast(true), 5000);
    }
  });
}

// === Play Sound === //
function playSound(type) {
  let file = "../sound/success.mp3"; // default

  if (type === "error") {
    file = "../sound/error.mp3";
  }

  const audio = new Audio(file);
  audio.currentTime = 0;
  audio.play().catch(err => console.error("Audio play failed:", err));
}

// === Navigation Menu ===
document.querySelectorAll(".menu-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    // Update active menu button
    document.querySelectorAll(".menu-btn").forEach(b =>
      b.classList.remove("active")
    );
    btn.classList.add("active");

    // Update active section
    document.querySelectorAll(".section").forEach(sec =>
      sec.classList.remove("active")
    );

    const sectionId = btn.dataset.section;
    const sectionEl = document.getElementById(sectionId);

    if (sectionEl) {
      sectionEl.classList.add("active");

      // ✅ Call this ONLY when Properties is selected
      if (sectionId === "properties") {
        loadServerProperties(serverPath);
      }
    }
  });
});



// === Open Folder ===
const openFolderBtn = document.getElementById("open-folder-btn");
if (openFolderBtn) {
  openFolderBtn.onclick = () => {
    if (window.serverPath) shell.openPath(window.serverPath);
  };
}
// === CPU/RAM Graphing ===
let chart, graphInterval, uptimeInterval;
let uptimeSeconds = 0;
let selectedRange = 5; // default 5 minutes (300 seconds)
let maxPoints = selectedRange * 60; // Make this variable not constant so we can update it
let lastCpuLoad = 0;

let allLabels = []; // stores full-time labels (timestamps)
let allCPU = [];    // stores full CPU history
let allRAM = [];    // stores full RAM history

// === UI Elements ===
const cpuUsageEl = document.getElementById("cpu-usage");
const ramUsageEl = document.getElementById("ram-usage");
const uptimeEl = document.getElementById("uptime");

// === Chart.js Setup ===
const ctx = document.getElementById("usage-graph").getContext("2d");

chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "CPU (%)",
        data: [],
        borderColor: "rgba(255, 99, 132, 1)",
        backgroundColor: "rgba(255, 99, 132, 0.15)",
        tension: 0.25,
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        yAxisID: "y",
      },
      {
        label: "RAM (%)",
        data: [],
        borderColor: "rgba(0, 255, 136, 1)",
        backgroundColor: "rgba(0, 255, 136, 0.15)",
        tension: 0.25,
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        yAxisID: "y",
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    plugins: {
      legend: {
        display: true,
        labels: { color: "#ccc", boxWidth: 12 },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        titleColor: "#fff",
        bodyColor: "#ccc",
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
          title: () => "",
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#ccc", maxTicksLimit: 6 },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { color: "#ccc", stepSize: 20 },
        grid: { color: "rgba(255,255,255,0.05)" },
        title: { display: true, text: "Usage (%)", color: "#ccc" },
      },
    },
  },
});


async function getSystemUsage() {
  try {
    // Get detailed CPU information
    const cpuLoad = await si.currentLoad();
    
    // Calculate average CPU load across all cores
    let cpuUsage = 0;
    if (cpuLoad && cpuLoad.cpus && cpuLoad.cpus.length > 0) {
      // Use per-core loads for more accurate reading
      cpuUsage = cpuLoad.cpus.reduce((sum, core) => sum + core.load, 0) / cpuLoad.cpus.length;
    } else if (cpuLoad && cpuLoad.currentLoad > 0) {
      // Fallback to overall CPU load
      cpuUsage = cpuLoad.currentLoad;
    } else {
      // Final fallback to OS load average
      cpuUsage = Math.min(os.loadavg()[0] * 100 / os.cpus().length, 100);
    }

    // Smooth the value with previous reading to prevent jumps
    if (lastCpuLoad > 0) {
      cpuUsage = (cpuUsage + lastCpuLoad) / 2;
    }
    
    lastCpuLoad = cpuUsage;

    // === RAM ===
    const mem = await si.mem();
    const memUsed = mem.active ?? mem.used ?? 0;
    const memTotal = mem.total ?? 1;
    const memPercent = (memUsed / memTotal) * 100;
    const usedRAMMB = memUsed / 1024 / 1024;

    return {
      cpu: parseFloat(cpuUsage.toFixed(1)),
      ramPercent: parseFloat(memPercent.toFixed(1)),
      ramUsedMB: parseFloat(usedRAMMB.toFixed(1)),
    };
  } catch (err) {
    console.error("⚠️ Failed to read system usage:", err);
    return { cpu: 0, ramPercent: 0, ramUsedMB: 0 };
  }
}

// === Start Monitoring Graph ===
async function startGraph() {
  if (graphInterval) return;
  startUptime();

  appendConsole(" Starting system CPU/RAM monitoring...", "info");

  // Warm up systeminformation
  await getSystemUsage();
  await new Promise(res => setTimeout(res, 1000));

  graphInterval = setInterval(async () => {
    try {
      const usage = await getSystemUsage();
      const totalCPU = usage.cpu;
      const totalRAMPercent = usage.ramPercent;
      const usedRAMMB = usage.ramUsedMB;

      // === Update UI ===
      const cpuUsageEl = document.getElementById("cpu-usage");
      const ramUsageEl = document.getElementById("ram-usage");

      if (cpuUsageEl) cpuUsageEl.textContent = `${totalCPU.toFixed(1)}%`;
      if (ramUsageEl) {
        ramUsageEl.textContent =
          usedRAMMB >= 1500
            ? `${(usedRAMMB / 1024).toFixed(2)} GB`
            : `${usedRAMMB.toFixed(0)} MB`;
      }

      // === Update Chart ===
      const timeLabel = new Date().toLocaleTimeString();
      // Store full history
        allLabels.push(timeLabel);
        allCPU.push(totalCPU);
        allRAM.push(totalRAMPercent);

        // Update visible range
        updateChartData();

    } catch (err) {
      console.error("⚠️ Graph update failed:", err);
    }
  }, 1000); // Update every 2 seconds
}

// === Function to show data of current selectedRange ===
function updateChartData() {
  const keepCount = maxPoints;
  const totalPoints = allLabels.length;
  const startIndex = Math.max(0, totalPoints - keepCount);

  chart.data.labels = allLabels.slice(startIndex);
  chart.data.datasets[0].data = allCPU.slice(startIndex);
  chart.data.datasets[1].data = allRAM.slice(startIndex);

  chart.update("none");
}

// === Stop Monitoring Graph ===
function stopGraph() {
  try {
    if (graphInterval) {
      clearInterval(graphInterval);
      graphInterval = null;
    }

    if (typeof stopUptime === "function") stopUptime();

    // Clear stored data completely
    allLabels = [];
    allCPU = [];
    allRAM = [];

    if (chart && chart.data) {
      chart.data.labels = [];
      chart.data.datasets.forEach((dataset) => (dataset.data = []));
      chart.update();
    }

    const cpuUsageEl = document.getElementById("cpu-usage");
    const ramUsageEl = document.getElementById("ram-usage");

    if (cpuUsageEl) cpuUsageEl.textContent = "--%";
    if (ramUsageEl) ramUsageEl.textContent = "--%";

    appendConsole("🛑 Stopped system usage monitoring and cleared graph.", "info");
  } catch (err) {
    console.error("⚠️ Failed to stop graph cleanly:", err);
  }
}

// === Range Buttons Logic ===
document.querySelectorAll(".graph-btn[data-range]").forEach((btn) => {
  btn.addEventListener("click", () => {
    // Update button states
    document.querySelectorAll(".graph-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Update range and max points
    selectedRange = parseInt(btn.dataset.range);
    maxPoints = selectedRange * 60; // assume 1 point/sec (adjust if using different interval)

    // Update chart view window based on stored data
    updateChartData();
  });
});

// === Uptime ===
let uptimeStart = null;

function startUptime() {
  clearInterval(uptimeInterval);
  uptimeStart = Date.now();
  uptimeInterval = setInterval(() => {
    const diff = Math.floor((Date.now() - uptimeStart) / 1000);
    const h = String(Math.floor(diff / 3600)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const s = String(diff % 60).padStart(2, "0");
    uptimeEl.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function stopUptime() {
  clearInterval(uptimeInterval);
  uptimeEl.textContent = "--:--:--";
}

// === Monitoring  Players ===
let playerList = [];
let playerMonitorActive = false;
let maxPlayers = 0;
let serverProc;
let rconClient = null;
let rconInterval = null;


function getMaxPlayers() {
  try {
    const baseDir = localStorage.getItem("selectedServerPath");
    const propertiesPath = path.join(baseDir, "server.properties");

    if (fs.existsSync(propertiesPath)) {
      const lines = fs.readFileSync(propertiesPath, "utf8").split("\n");
      for (const line of lines) {
        if (line.startsWith("max-players=")) {
          return parseInt(line.split("=")[1].trim()) || 0;
        }
      }
    }
  } catch (err) {
    appendConsole(`⚠️ Could not read max-players: ${err.message}`, "error");
  }
  return 0;
}

async function startPlayerMonitor() {
  if (playerMonitorActive) return;
  playerMonitorActive = true;

  playerList = [];
  maxPlayers = getMaxPlayers();

  // --- Load RCON info from server_info.json ---
  let rconPort, rconPassword;
  try {
    const baseDir = localStorage.getItem("selectedServerPath");
    const infoPath = path.join(baseDir, "server_info.json");

    if (!fs.existsSync(infoPath)) throw new Error("server_info.json not found");

    const serverInfo = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    rconPort = serverInfo.rcon_port || 25575;
    rconPassword = serverInfo.rcon_password;
    if (!rconPassword) throw new Error("RCON password missing in server_info.json");
  } catch (err) {
    appendConsole(`❌ Failed to read RCON info: ${err.message}`, "error");
    playerMonitorActive = false;
    return;
  }

  try {
    rconClient = await Rcon.connect({
      host: "127.0.0.1",
      port: rconPort,
      password: rconPassword
    });

    appendConsole("🔌 RCON connected (player monitor)", "success");

    // Poll every 2 seconds
    rconInterval = setInterval(async () => {
      if (!playerMonitorActive) return;

      try {
        const res = await rconClient.send("list");

        // Example output:
        // There are 2 of a max of 20 players online: Steve, Alex
        let currentPlayers = [];
        if (res.includes(":")) {
          const listPart = res.split(":")[1];
          currentPlayers = listPart
            .split(",")
            .map(p => p.trim())
            .filter(Boolean);
        }

        // ---- Joins ----
        for (const p of currentPlayers) {
          if (!playerList.includes(p)) {
            playerList.push(p);
            updatePlayerCard(p, true);
          }
        }

        // ---- Leaves ----
        for (const p of [...playerList]) {
          if (!currentPlayers.includes(p)) {
            playerList = playerList.filter(x => x !== p);
            updatePlayerCard(p, false);
          }
        }

        updatePlayerInfoFile();

      } catch (err) {
        appendConsole(`⚠️ RCON list failed: ${err.message}`, "error");
      }
    }, 2000);

  } catch (err) {
    appendConsole(`❌ RCON monitor failed: ${err.message}`, "error");
    playerMonitorActive = false;
  }
}

function stopPlayerMonitor() {
  if (!playerMonitorActive) return;
  playerMonitorActive = false;

  if (rconInterval) {
    clearInterval(rconInterval);
    rconInterval = null;
  }

  if (rconClient) {
    try {
      rconClient.end();
    } catch {}
    rconClient = null;
  }

  playerList = [];

  const listContainer = document.getElementById("player-list");
  if (listContainer) listContainer.innerHTML = "";

  updatePlayerInfoFile(true);
  appendConsole("🛑 Player Monitor Stopped (RCON)", "info");
}

function updatePlayerCard(playerName, joined) {
  const playerListContainer = document.getElementById("player-list");
  const playerCountEl = document.getElementById("player-count");

  // Update player count text
  playerCountEl.textContent = `Players: ${playerList.length}/${maxPlayers}`;

  if (joined) {
    // If player already exists, skip
    if (document.getElementById(`player-${playerName}`)) return;

    // === Create player card ===
    const card = document.createElement("div");
    card.classList.add("player-card");
    card.id = `player-${playerName}`;

    card.innerHTML = `
      <img src="https://minotar.net/helm/${playerName}/32.png" class="player-avatar" alt="${playerName}" />
      <span class="player-name">${playerName}</span>
      <button class="kick-btn" onclick="kickPlayer('${playerName}')">Kick</button>
      <button class="ban-btn" onclick="banPlayer('${playerName}')">Ban</button>
    `;

    playerListContainer.appendChild(card);
  } else {
    // === Remove player card ===
    const card = document.getElementById(`player-${playerName}`);
    if (card) card.remove();
    playerCountEl.textContent = `Players: ${playerList.length}/${maxPlayers}`;
  }
}

function updatePlayerInfoFile(clear = false) {
  try {
    const baseDir = localStorage.getItem("selectedServerPath");
    const infoPath = path.join(baseDir, "server_info.json");

    if (fs.existsSync(infoPath)) {
      const data = JSON.parse(fs.readFileSync(infoPath, "utf8"));

      if (clear) {
        data.players = "N/A";
        data.player_list = [];
      } else {
        data.players = `${playerList.length}/${maxPlayers}`;
        data.player_list = playerList;
      }

      fs.writeFileSync(infoPath, JSON.stringify(data, null, 2), "utf8");
    }
  } catch (err) {
    appendConsole(`Error updating player info: ${err.message}`, "error");
  }
}

function filterPlayers() {
  const searchBox = document.getElementById("player-search");
  console.log("player scearched")
  if (!searchBox) return; // safety check

  const filter = searchBox.value.toLowerCase();
  const playerCards = document.querySelectorAll(".player-card");

  playerCards.forEach(card => {
    const nameEl = card.querySelector(".player-name");
    if (!nameEl) return; // safety check if player-name element doesn’t exist

    const playerName = nameEl.textContent.toLowerCase();
    if (playerName.includes(filter)) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });
}

// === KICK PLAYER ===
function kickPlayer(playerName) {
  if (!serverProc || !playerMonitorActive) {
    appendConsole("⚠️ Server process not active. Cannot kick player.", "error");
    return;
  }

  try {
    serverProc.stdin.write(`kick ${playerName}\n`);
    appendConsole(`👢 Kicked player: ${playerName}`, "warn");
  } catch (err) {
    appendConsole(`❌ Failed to kick ${playerName}: ${err.message}`, "error");
  }
}

// === BAN PLAYER ===
function banPlayer(playerName) {
  if (!serverProc || !playerMonitorActive) {
    appendConsole("⚠️ Server process not active. Cannot ban player.", "error");
    return;
  }

  try {
    serverProc.stdin.write(`ban ${playerName}\n`);
    appendConsole(`⛔ Banned player: ${playerName}`, "error");
  } catch (err) {
    appendConsole(`❌ Failed to ban ${playerName}: ${err.message}`, "error");
  }
}
// === PLAYER MANAGEMENT (Whitelist / Banned / Ops) ===

// Player File Utilities  //
function getFilePath(type) {
  const fileMap = {
    ops: "ops.json",
    whitelist: "whitelist.json",
    banned: "banned-players.json"
  };
  return path.join(serverPath, fileMap[type]);
}

function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    }
    return [];
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
  }
}

// ==================== Mojang API ==================== //
function fetchUUID(playerName) {
  const online_mode = isOnlineModeEnabled(serverPath);
  if(!online_mode){
    showToast("Cannot fetch UUIDs when Online Mode is disabled.", "error");
    return null;  
  }
  return new Promise((resolve) => {
    const url = `https://api.mojang.com/users/profiles/minecraft/${playerName}`;
    
    https.get(url, (res) => {
      let data = "";

      res.on("data", (chunk) => (data += chunk));

      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const rawUUID = json?.id;

          if (!rawUUID) return resolve(null);

          // Convert to dashed format: 8-4-4-4-12
          const dashedUUID = rawUUID.replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5"
          );

          resolve(dashedUUID);
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => resolve(null));
  });
}

// ==================== Check Online Mode ==================== //
function isOnlineModeEnabled(serverPath) {
  try {
    const propertiesFile = path.join(serverPath, "server.properties");

    if (!fs.existsSync(propertiesFile)) {
      console.error("❌ server.properties not found at:", propertiesFile);
      return null;
    }

    const fileData = fs.readFileSync(propertiesFile, "utf8");
    const lines = fileData.split(/\r?\n/);

    for (const line of lines) {
      if (!line || line.startsWith("#")) continue;

      const [key, value] = line.split("=");

      if (key?.trim() === "online-mode") {
        const enabled = value?.trim().toLowerCase() === "true";

        console.log(
          `✅ Online Mode is currently: ${enabled ? "ENABLED" : "DISABLED"}`
        );

        return enabled;
      }
    }

    console.warn("⚠️ online-mode not found in server.properties");
    return null;
  } catch (error) {
    console.error("⚠️ Error reading online-mode:", error);
    return null;
  }
}

// ==================== Player List UI ==================== //
function renderPlayerList(type, playerListEl) {
  playerListEl.innerHTML = "";
  const filePath = getFilePath(type);
  const players = readJSON(filePath);

  if (players.length === 0) {
    playerListEl.innerHTML = `<p class="pm-empty">No players found in ${type}.</p>`;
    return;
  }

  players.forEach((player) => {
    const card = document.createElement("div");
    card.classList.add("pm-player-card");

    card.innerHTML = `
      <img src="https://mc-heads.net/avatar/${player.name || player.uuid}/32" class="pm-player-pic" />
      <span class="pm-player-name">${player.name || player.uuid}</span>
      <button class="pm-remove-btn">✖</button>
    `;

    card.querySelector(".pm-remove-btn").addEventListener("click", () => {
      removePlayer(type, player.name || player.uuid, playerListEl);
    });

    playerListEl.appendChild(card);
  });
}

// ==================== Add / Remove Players ==================== //
async function addPlayer(type, playerName, inputEl, playerListEl) {
  const filePath = getFilePath(type);
  const players = readJSON(filePath);

  if (!playerName.trim()) return;
  if (players.some(p => p.name === playerName)) {
    showToast("Player already exists", "error");
    return;
  }

  let newEntry;
  let whitelistChanged = false;
  let opchanged = false;
  let banchanged = false;

  if (type === "whitelist") {
    const uuid = await fetchUUID(playerName);
    newEntry = uuid
      ? { uuid, name: playerName }
      : { name: playerName };

    whitelistChanged = true;

    if (!uuid) {
      appendConsole(`Could not fetch UUID for "${playerName}" — added by name only.`, "warn");
    }
  }

  else if (type === "ops") {
    const uuid = await fetchUUID(playerName);
    opchanged = true;
    if (!uuid) {
      showToast("Cannot add OP without UUID", "error");
      return;
    }

    newEntry = {
      uuid,
      name: playerName,
      level: 4,
      bypassesPlayerLimit: false
    };
  }

  else if (type === "banned") {
    const uuid = await fetchUUID(playerName);
    newEntry = {
      uuid: uuid || "",
      name: playerName,
      created: new Date().toISOString(),
      source: "Server",
      expires: "forever",
      reason: "Banned by an operator."
    };
    banchanged = true;
  }

  // Save the new record
  players.push(newEntry);
  writeJSON(filePath, players);
  inputEl.value = "";
  renderPlayerList(type, playerListEl);

  // Ask to apply changes only for whitelist
  if (whitelistChanged) {
    askforapply();
  };
  if (opchanged || banchanged){
    askforrestart();
  }
}

async function removePlayer(type, playerName, playerListEl) {
  askforrestart(); 
  const filePath = getFilePath(type);
  let players = readJSON(filePath);
  players = players.filter((p) => p.name !== playerName);
  writeJSON(filePath, players);
  renderPlayerList(type, playerListEl);

}
// ==================== Ask to Apply Whitelist ==================== //
async function askforapply(){
  if (!isServerRunning || !serverProcess) {
    return;
  }
  const reply = await showToast("Do You Want to Apply Whitelist?","success",true)
  if (!reply){
    appendConsole("Whitelist will be applied once server restarts",)
  }
  else{
    if (serverProcess && isServerRunning) {
    try {
      // === Send command to server's stdin ===
      serverProcess.stdin.write("whitelist reload" + "\n");
      appendConsole(`> whitelist reload`, "command");
    } catch (err) {
      appendConsole(`❌ Failed to send command: ${err}`, "error");
    }
  } else {
    appendConsole("⚠️ Cannot send command — server is not running.", "error");
  }
  }
}
// ==================== Ask to Restart for OP Changes ==================== //
async function askforrestart() {
  // If server is not running, no restart needed
  if (!isServerRunning || !serverProcess) {
    return;
  }

  const reply = await showToast(
    "Server needs to restart to apply changes. Restart now?",
    "success",
    true
  );

  if (!reply) {
    showToast("changes will be applied once the server restarts.", "success");
  } else {
    restartServer();
  }
}
// ==================== Tab Setup ==================== //
function setupPlayerTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const playerList = document.getElementById("pm-list");
  const addBtn = document.getElementById("pm-add-btn");
  const addInput = document.getElementById("pm-add-player-input");
  let currentTab = "ops";

  function switchTab(event) {
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    event.target.classList.add("active");
    currentTab = event.target.getAttribute("data-type");
    renderPlayerList(currentTab, playerList);
  }

  tabButtons.forEach((button) => button.addEventListener("click", switchTab));
  addBtn.addEventListener("click", () => addPlayer(currentTab, addInput.value, addInput, playerList));

  renderPlayerList(currentTab, playerList);
  setupPlayerFilter?.();
}
// ==================== Player Search Filter ==================== //
function setupPlayerFilter() {
  const searchInput = document.getElementById("pm-search-input");
  const playerList = document.getElementById("pm-list");

  if (!searchInput || !playerList) return;

  searchInput.addEventListener("input", () => {
    const searchValue = searchInput.value.toLowerCase().trim();
    const players = playerList.querySelectorAll(".pm-player-card");

    players.forEach(card => {
      const playerName = card.querySelector(".pm-player-name").textContent.toLowerCase();
      card.style.display = playerName.includes(searchValue) ? "flex" : "none";
    });
  });
}

// === Server Fuctions === //
let autoRestartTimer = null;

function LoadAutoRestart() {
  const info_path = path.join(serverPath, "server_info.json");

  // Defaults
  let autoRestart = false;
  let restartInterval = 6;

  if (fs.existsSync(info_path)) {
    try {
      const serverInfo = JSON.parse(fs.readFileSync(info_path, "utf8"));

      if (typeof serverInfo.auto_restart === "boolean") {
        autoRestart = serverInfo.auto_restart;
      }

      if (typeof serverInfo.restart_interval === "number") {
        restartInterval = serverInfo.restart_interval;
      }

    } catch (err) {
      appendConsole(`Failed to read server_info.json: ${err}`, "error");
    }
  }

  // ---- Update UI ----
  const restartToggle = document.getElementById("restart-toggle");
  const restartIntervalInput = document.getElementById("restart-interval");
  const restartCard = document.getElementById("restart-card");

  if (!restartToggle || !restartIntervalInput || !restartCard) {
    appendConsole("Auto-restart UI elements not found", "error");
    return;
  }

  restartToggle.checked = autoRestart;
  restartIntervalInput.value = restartInterval;

  restartCard.classList.toggle("active", autoRestart);
  restartIntervalInput.disabled = !autoRestart;
}

function SaveAutoRestart() {
  const info_path = path.join(serverPath, "server_info.json");

  const restartToggle = document.getElementById("restart-toggle");
  const restartIntervalInput = document.getElementById("restart-interval");

  if (!restartToggle || !restartIntervalInput) {
    appendConsole("Cannot save auto-restart: UI elements missing", "error");
    return;
  }

  // Read UI values
  const autoRestart = restartToggle.checked;
  let restartInterval = parseInt(restartIntervalInput.value, 10);

  // Validate interval
  if (isNaN(restartInterval) || restartInterval < 1) restartInterval = 1;
  if (restartInterval > 24) restartInterval = 24;

  // Load existing JSON (if any)
  let serverInfo = {};
  if (fs.existsSync(info_path)) {
    try {
      serverInfo = JSON.parse(fs.readFileSync(info_path, "utf8"));
    } catch (err) {
      appendConsole("server_info.json is corrupted, recreating", "warn");
      serverInfo = {};
    }
  }

  // Update fields
  serverInfo.auto_restart = autoRestart;
  serverInfo.restart_interval = restartInterval;

  // Write back to file
  try {
    fs.writeFileSync(info_path, JSON.stringify(serverInfo, null, 2), "utf8");
  } catch (err) {
    appendConsole(`Failed to save server_info.json: ${err}`, "error");
  }
  if (isServerRunning) {
    showToast("Changes will take effect after server restarts", "success");
  }
}

function ExecuteAutoRestart() {
  const info_path = path.join(serverPath, "server_info.json");

  // Clear any existing timer (safety)
  stopAutoRestart();

  if (!fs.existsSync(info_path)) {
    return;
  }

  let serverInfo;
  try {
    serverInfo = JSON.parse(fs.readFileSync(info_path, "utf8"));
  } catch (err) {
    appendConsole(`Failed to read server_info.json: ${err}`, "error");
    return;
  }

  // Check if auto restart is enabled
  if (serverInfo.auto_restart !== true) {
    return;
  }

  let hours = parseInt(serverInfo.restart_interval, 10);

  // Validate interval
  if (isNaN(hours) || hours < 1) hours = 1;
  if (hours > 24) hours = 24;

  const delayMs = hours * 60 * 60 * 1000;

  appendConsole(`Auto-restart scheduled in ${hours} hour(s)`, "info");

  autoRestartTimer = setTimeout(() => {
    appendConsole("Auto-restart triggered", "warn");

    restartServer(); 

    // Schedule next restart
    ExecuteAutoRestart();
  }, delayMs);
}

function stopAutoRestart() {
  if (autoRestartTimer !== null) {
    clearTimeout(autoRestartTimer);
    autoRestartTimer = null;
    appendConsole("Auto-restart stopped", "info");
  }
}


