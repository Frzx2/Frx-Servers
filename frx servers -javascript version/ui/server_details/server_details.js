const { shell } = require("electron");
const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const { start } = require("repl");
const home_screen =document.getElementById("home_menu");
const { spawn } = require("child_process");
const process = require("process");
const os = require("os");
const { app } = require('electron');
const si = require("systeminformation");
const pidusage = require("pidusage");

// === Initialization ===
document.addEventListener("DOMContentLoaded", () => {
  const serverPath = localStorage.getItem("selectedServerPath");

  if (!serverPath || !fs.existsSync(serverPath)) {
    console.error("⚠️ No valid server path found.");
    alert("Server folder not found.");
    return;
  }

  window.serverPath = serverPath;
  loadServerInfo(serverPath);


  // 🪶 Initialize Feather icons
  if (typeof feather !== "undefined") {
    feather.replace();
  } else {
    console.warn("⚠️ Feather icons not loaded. Make sure feather.min.js is included in your HTML.");
  }

  // 🧩 Copy button logic
  const copyBtn = document.getElementById("copy-ip-btn");
  const ipElement = document.getElementById("server-ip");

  if (copyBtn && ipElement) {
    copyBtn.addEventListener("click", () => {
      const ipText = ipElement.textContent.replace("IP:", "").trim();
      if (!ipText || ipText === "--.--.--.--") {
        alert("No IP address to copy yet!");
        return;
      }

      navigator.clipboard.writeText(ipText)
        .then(() => {
          copyBtn.innerHTML = '<i data-feather="check"></i>';
          feather.replace();
          setTimeout(() => {
            copyBtn.innerHTML = '<i data-feather="copy"></i>';
            feather.replace();
          }, 1500);
        })
        .catch(err => {
          console.error("Clipboard error:", err);
          alert("Failed to copy IP!");
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
function ShowToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";}



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

function toggleButtons(state) {
  const running = state === "running";
  startBtn.classList.toggle("hidden", running);
  stopBtn.classList.toggle("hidden", !running);
  restartBtn.classList.toggle("hidden", !running);
  killBtn.classList.toggle("hidden", !running);
  enableButtons();
}


// === Server Fucntions ===

let isServerRunning = false;
let serverProcess = null;
let usageInterval = null;

async function startServer() {
  toggleButtons("running");
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
  appendConsole("Clearing Logs",false,true)

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
    toggleButtons("hidden");
    setServerState("offline");
    return;
  }
  // === Verify and enforce RCON configuration ===
  if (!fs.existsSync(propertiesPath)) {
    appendConsole("⚠️ server.properties not found — cannot verify RCON.", "error");
    toggleButtons("hidden");
    toggleServerStatus(false);
    return;
  }

try {
  let properties = fs.readFileSync(propertiesPath, "utf8");
  let modified = false;

  // === Ensure RCON is enabled ===
  if (/enable-rcon\s*=\s*false/i.test(properties)) {
    properties = properties.replace(/enable-rcon\s*=\s*false/i, "enable-rcon=true");
    modified = true;
  } else if (!/enable-rcon\s*=\s*true/i.test(properties)) {
    properties += "\nenable-rcon=true";
    modified = true;
  }

  //=== Always overwrite RCON password with 123 ===
  if (/rcon\.password\s*=.*/i.test(properties)) {
    properties = properties.replace(/rcon\.password\s*=.*/i, "rcon.password=123");
  } else {
    properties += "\nrcon.password=123";
  }
  modified = true; // always mark as modified since password is forced

  // === Ensure RCON port exists ===
  if (/rcon\.port\s*=\s*\d+/i.test(properties)) {
  } else {
    properties += "\nrcon.port=25575";
    modified = true;
  }

  // === Save file & allow OS to flush ===
  if (modified) {
    fs.writeFileSync(propertiesPath, properties, "utf8");
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // === Reverify file contents ===
  const verify = fs.readFileSync(propertiesPath, "utf8");
  if (!/enable-rcon\s*=\s*true/i.test(verify) ||
      !/rcon\.password\s*=\s*123/i.test(verify) ||
      !/rcon\.port\s*=\s*\d+/i.test(verify)) {
    appendConsole("❌ RCON verification failed after save — cannot continue.", "error");
    toggleButtons("hidden");
    setServerState("offline");
    return;
  }


} catch (err) {
  appendConsole(`❌ Failed to verify or update RCON: ${err}`, "error");
  toggleButtons("hidden");
  setServerState("offline");
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
      }
    });

    serverProcess.stderr.on("data", (data) => {
      appendConsole(data.toString(), "error");
    });

    serverProcess.on("exit", (code) => {
      appendConsole(`🛑 Server exited with code ${code}`, "error");
      toggleButtons("hidden");
      setServerState("stopped");
      stopPlayit();
    });

    // Make serverProcess globally accessible
    window.serverProcess = serverProcess;

  } catch (err) {
    appendConsole(`❌ Failed to start server process: ${err}`, "error");
    toggleButtons("hidden");
    setServerState("stopped");
    stopPlayit();
  }
}


async function stopServer() {
  appendConsole("Stopping server...");
  if (!serverProcess || !isServerRunning) {
    appendConsole("No running server process found.");
    toggleButtons("hidden");
    setServerState("stopped");
    return;
  }

  toggleButtons("hidden");
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

  clearAllPlayerCards?.();
  appendConsole("Server fully stopped.");
  setServerState("offline");
}

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

async function restartServer() {
  appendConsole("Restarting server...");
  disableButtons();
  setServerState("restarting");

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

async function killServer() {
  appendConsole("Forcing server termination...");

  if (!serverProcess) {
    appendConsole("No active server process found.");
    toggleButtons("hidden");
    setServerState("offline");
    return;
  }

  try {
    setServerState("stopping");
    toggleButtons("hidden");

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
    try { stopMonitoring?.(); } catch {}
    try { stopUptime?.(); } catch {}
    try { stopBatteryMonitor?.(); } catch {}

    // --- Update info file ---
    try {
      const baseDir = localStorage.getItem("selectedServerPath");
      const infoPath = path.join(baseDir, "server_info.json");
      if (fs.existsSync(infoPath)) {
        const data = JSON.parse(fs.readFileSync(infoPath, "utf8"));
        data.server_status = "Offline (Force Stopped)";
        data.server_players = "Players: N/A";
        data.player_list = [];
        data.server_tps = "N/A";
        fs.writeFileSync(infoPath, JSON.stringify(data, null, 2), "utf8");
        appendConsole("Updated server_info.json -> Force stopped");
      }
    } catch (err) {
      appendConsole(`Error updating server_info.json: ${err.message}`);
    }

    clearAllPlayerCards?.();

    appendConsole("Server process killed successfully.");
    setServerState("offline");
    toggleButtons("stopped");

    // Reset IP / tunnel
    server_ip = "IP: Tunnel Stopped";
  } catch (err) {
    appendConsole(`Kill server error: ${err.message}`);
    setServerState("offline");
  }
}

// === Playit.gg Integration ===
async function fetchPlayitIP() {
  try {
    let ipStatus = await ipcRenderer.invoke("start-playit");
    document.getElementById("server-ip").innerText = ipStatus;

    // Keep checking until we get a real joinmc.link domain
    if (ipStatus === "Fetching IP...") {
      const interval = setInterval(async () => {
        const status = await ipcRenderer.invoke("start-playit");
        if (status.includes(".joinmc.link")) {
          clearInterval(interval);
          document.getElementById("server-ip").innerText = status;
          console.log("✅ Playit IP fetched:", status);
        }
      }, 3000); // check every 3 seconds
    }

    return ipStatus;
  } catch (err) {
    console.error("Failed to fetch Playit IP:", err);
    return "Error fetching IP";
  }
}
async function stopPlayit() {
  try {
    const result = await ipcRenderer.invoke("stop-playit");
    document.getElementById("server-ip").innerText = "Tunnel Stopped";
  } catch (err) {
    console.error("❌ Failed to stop Playit:", err);
  }
}


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
// === Monitor Players ===


// === Navigation Menu ===
document.querySelectorAll(".menu-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
    document.getElementById(btn.dataset.section)?.classList.add("active");
  });
});

// === Graph Time Buttons ===
document.querySelectorAll(".graph-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".graph-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    console.log(`Graph range switched to: ${btn.dataset.range} minutes`);
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

  appendConsole("📊 Starting system CPU/RAM monitoring...", "info");

  // Warm up systeminformation
  await getSystemUsage();
  await new Promise(res => setTimeout(res, 1000));

  graphInterval = setInterval(async () => {
    try {
      const usage = await getSystemUsage();
      const totalCPU = usage.cpu;
      console.log(`cpu usage is ${totalCPU}`)
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
      chart.data.labels.push(timeLabel);
      chart.data.datasets[0].data.push(totalCPU);
      chart.data.datasets[1].data.push(totalRAMPercent);

      while (chart.data.labels.length > maxPoints) {
        chart.data.labels.shift();
        chart.data.datasets.forEach((d) => d.data.shift());
      }

      chart.update("none");
    } catch (err) {
      console.error("⚠️ Graph update failed:", err);
    }
  }, 2000); // 2 second interval for more stable readings
}

// === Stop Monitoring Graph ===
function stopGraph() {
  try {
    if (graphInterval) {
      clearInterval(graphInterval);
      graphInterval = null;
    }

    if (typeof stopUptime === "function") stopUptime();

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

// === Range Buttons ===
document.querySelectorAll(".graph-btn[data-range]").forEach((btn) => {
  btn.addEventListener("click", () => {
    // Update button states
    document.querySelectorAll(".graph-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    
    // Update range and points limit
    selectedRange = parseInt(btn.dataset.range);
    maxPoints = selectedRange * 60; // Update the global maxPoints variable
    
    // Trim existing data if longer than new range
    if (chart.data.labels.length > maxPoints) {
      const keepCount = Math.min(chart.data.labels.length, maxPoints);
      chart.data.labels = chart.data.labels.slice(-keepCount);
      chart.data.datasets.forEach((dataset) => {
        dataset.data = dataset.data.slice(-keepCount);
      });
    }
    
    // Clear existing interval and start a new one with updated range
    if (graphInterval) {
      clearInterval(graphInterval);
      startGraph(); // Restart the graph with new range
    }
    
    chart.update('none'); // Update without animation
  });
});

// === Uptime ===
function startUptime() {
  clearInterval(uptimeInterval);
  uptimeSeconds = 0;
  uptimeInterval = setInterval(() => {
    uptimeSeconds++;
    const h = String(Math.floor(uptimeSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((uptimeSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(uptimeSeconds % 60).padStart(2, "0");
    uptimeEl.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function stopUptime() {
  clearInterval(uptimeInterval);
  uptimeEl.textContent = "--:--:--";
}
// dummy fucntions Later will be used 
function loadConfig() {
  console.log("Loading config file...");
  return { server_location: "C:/Servers", server_type: "vanilla" };
}

function replaceLog(msg) {
  console.log(`[LOG] ${msg}`);
}




function monitorPlayers() {
  console.log("Monitoring player list...");
}
function stopMonitoring() { console.log("[DEBUG] stopMonitoring() called"); }
function stopBatteryMonitor() { console.log("[DEBUG] stopBatteryMonitor() called"); }
function clearAllPlayerCards() { console.log("[DEBUG] clearAllPlayerCards() called"); }

