const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process'); //
const { existsSync, readdirSync, statSync } = require('fs');
const { spawn } = require("child_process");

// === CONFIG FILE PATH ===
const CONFIG_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'config.json')  // Production
  : path.join(__dirname, 'config.json');  // Dev

// === CONFIG HELPERS ===
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw || '{}');
    }
  } catch (err) {
    console.error('[ERROR] Failed to read config.json:' + err);
  }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('[ERROR] Failed to write config.json:' + err);
  }
}

// === CREATE APP WINDOW ===
function createWindow() {
  const config = loadConfig();

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(__dirname, 'Icon', 'logo2.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  // Load starting page
  const startPage = config.setup
    ? path.join(__dirname, 'ui', 'home_screen', 'home_screen.html')
    : path.join(__dirname, 'ui', 'setup', 'setup.html');

  win.loadFile(startPage).catch((err) => {
    console.error('[ERROR] Failed to load HTML file:', err);
  });
}

// === IPC HANDLERS ===

//  1. Find Java installations
ipcMain.handle("find-java-paths", async () => {
  const paths = new Set();

  // --- 1. Check Usual Path For Java
  try {
    if (process.platform === "win32") {
      const output = execSync("where java", { encoding: "utf8" });
      output.split(/\r?\n/).forEach(line => {
        if (line.trim()) paths.add(line.trim());
      });
    } else {
      const output = execSync("which java", { encoding: "utf8" });
      if (output.trim()) paths.add(output.trim());
    }
  } catch {
    console.warn("[WARN] Could not find Java from PATH.");
  }

  // --- 2. Check JAVA_HOME environment variable
  const javaHome = process.env.JAVA_HOME;
  if (javaHome && existsSync(javaHome)) {
    const binPath = path.join(javaHome, "bin", "java");
    if (existsSync(binPath)) paths.add(binPath);
  }

  // --- 3. Windows: Check registry for Java installations
  if (process.platform === "win32") {
    try {
      const output = execSync(
        `reg query "HKLM\\SOFTWARE\\JavaSoft\\Java Runtime Environment" /s`,
        { encoding: "utf8" }
      );

      const matches = output.match(/\\Java Runtime Environment\\[^\\\r\n]+/g) || [];
      for (const match of matches) {
        try {
          const homeOutput = execSync(
            `reg query "${match}" /v "JavaHome"`,
            { encoding: "utf8" }
          );
          const homeMatch = homeOutput.match(/JavaHome\s+REG_SZ\s+([^\r\n]+)/);
          if (homeMatch && existsSync(homeMatch[1])) {
            const javaBin = path.join(homeMatch[1], "bin", "java.exe");
            if (existsSync(javaBin)) paths.add(javaBin);
          }
        } catch {}
      }
    } catch {}
  }

  // --- 4. Search common installation directories
  const commonDirs = [];

  if (process.platform === "win32") {
    const drives = ["C:", "D:"];
    for (const drive of drives) {
      commonDirs.push(
        `${drive}\\Program Files\\Java`,
        `${drive}\\Program Files (x86)\\Java`
      );
    }
  } else {
    commonDirs.push(
      "/usr/lib/jvm",
      "/usr/java",
      "/opt/java",
      "/Library/Java/JavaVirtualMachines"
    );
  }

  for (const dir of commonDirs) {
    if (existsSync(dir)) {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          if (statSync(fullPath).isDirectory()) {
            const javaBin = path.join(fullPath, "bin", "java");
            const javaExe = process.platform === "win32" ? `${javaBin}.exe` : javaBin;
            if (existsSync(javaExe)) paths.add(javaExe);
          }
        }
      } catch {}
    }
  }

  // --- 5. Filter duplicates & invalid entries
  const validPaths = Array.from(paths).filter(p => existsSync(p));

  return validPaths;
});

//  2. File picker to manually select Java.exe
ipcMain.handle('pick-java', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Java Executable',
    filters: [{ name: 'Java Executable', extensions: ['exe'] }],
    properties: ['openFile'],
  });
  return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null;
});

//  3. Folder picker (for choosing directories)
ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null;
});

//  4. Save config updates from renderer
ipcMain.handle('save-config', (event, newConfig) => {
  const current = loadConfig();
  const updated = { ...current, ...newConfig };
  saveConfig(updated);
  return updated;
});

// 5. Open Config.json
ipcMain.handle('load-config', () => {
  return loadConfig(); // uses your existing loadConfig()
});

 // 6. Give config path
  ipcMain.handle("get-config-path", () => {
  return CONFIG_PATH;
});
  
//  Playit Process Handler
let playitProcess = null;
let playitIP = null;

 // 7. Start Playit
ipcMain.handle("start-playit", async (event) => {
  try {
    // Prevent multiple playit.exe instances
    if (playitProcess) {
      return playitIP || "Fetching IP...";
    }

    const playitPath = app.isPackaged
      ? path.join(process.resourcesPath, "playit.exe") // Production
      : path.join(__dirname, "playit.exe");           // Dev

    playitProcess = spawn(playitPath, {
      cwd: path.dirname(playitPath),
      windowsHide: true,
    });

    // Decode stdout in UTF-8
    playitProcess.stdout.setEncoding("utf8");

    playitProcess.stdout.on("data", (data) => {
      const lines = data.toString().split(/\r?\n/);

      for (const line of lines) {
        if (!line.trim()) continue;

        // Detect domain like xyz123.joinmc.link
        const match = line.match(/[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-]+\.joinmc\.link/);
        if (match && !playitIP) {
          playitIP = match[0];
          console.log("[PLAYIT] ✅ Found domain:", playitIP);
          event.sender.send("playit-ip-found", playitIP);
        }
      }
    });

    // Print any errors too
    playitProcess.stderr.setEncoding("utf8");
    playitProcess.stderr.on("data", (data) => {
      const lines = data.toString().split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        console.error("[PLAYIT ERROR]", line);
      }
    });

    playitProcess.on("exit", (code) => {
      console.log(`[PLAYIT] playit.exe exited with code ${code}`);
      playitProcess = null;
      playitIP = null;
    });

    return playitIP || "Fetching IP...";
  } catch (err) {
    console.error("[PLAYIT ERROR]", err);
    return "Error starting playit.exe";
  }
});
 // 8. Stop Playit
ipcMain.handle("stop-playit", async (event) => {
  try {
    if (playitProcess) {
      playitProcess.kill();
      playitProcess = null;
      playitIP = null;

      console.log("[PLAYIT] Tunnel stopped");

      // Notify renderer
      event.sender.send("playit-stopped", "Tunnel stopped");
      return "Tunnel stopped";
    } else {
      console.log("[PLAYIT] No tunnel running");
      return "No tunnel running";
    }
  } catch (err) {
    console.error("[PLAYIT ERROR] Failed to stop tunnel:", err);
    return `Failed to stop tunnel: ${err.message}`;
  }
});



// === APP LIFECYCLE ===
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

