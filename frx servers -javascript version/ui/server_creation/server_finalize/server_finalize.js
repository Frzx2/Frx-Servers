// server_finalize.js
// Electron renderer (requires nodeIntegration true)

const { ipcRenderer } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const logEl = document.getElementById('log');
const confirmBtn = document.getElementById('confirm-btn');
const backBtn = document.getElementById('back-btn');
const clearLogBtn = document.getElementById('clear-log');
const saveLogBtn = document.getElementById('save-log');
const eulaCheckbox = document.getElementById('eula-checkbox');
const nxtbtn =document.getElementById('next-btn');

const srvNameEl = document.getElementById('srv-name');
const srvTypeEl = document.getElementById('srv-type');
const srvVersionEl = document.getElementById('srv-version');
const srvRamEl = document.getElementById('srv-ram');
const srvWorldEl = document.getElementById('srv-world');
const srvJavaEl = document.getElementById('srv-java');
const summaryMsg = document.getElementById('summary-msg');

const JAVA_COMPAT = {
  "1.1": 6, "1.2": 6, "1.3": 6, "1.4": 6, "1.5": 6,
  "1.6": 7, "1.7": 7, "1.8": 8, "1.9": 8, "1.10": 8,
  "1.11": 8, "1.12": 8, "1.13": 8, "1.14": 8, "1.15": 8,
  "1.16": 8, "1.17": 16, "1.18": 17, "1.19": 17,
  "1.20": 20, "1.21": 21
};

// ---- utilities ----
function appendLog(text) {
  const now = new Date().toLocaleTimeString();
  logEl.textContent += `[${now}] ${text}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(text);
}
function setProgress(percent, text) {
  progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  progressText.textContent = text || `${Math.round(percent)}%`;
}

// read server data from localStorage
function loadServerData() {
  const raw = localStorage.getItem('serverData') || localStorage.getItem('server_data') || '{}';
  let parsed = {};
  try { parsed = JSON.parse(raw || '{}'); } catch(e){ parsed = {}; }
  // fallback to some keys used earlier
  const fallback = {
    server_name: localStorage.getItem('serverName') || parsed.server_name || parsed.serverName,
    server_type: parsed.server_type || parsed.serverType || localStorage.getItem('selectedServerType'),
    version: parsed.version || parsed.selectedVersion || localStorage.getItem('selectedVersion'),
    ram: parsed.ram || localStorage.getItem('selectedRamMB'),
    world_seed: parsed.world_seed || parsed.worldSeed,
    world_folder: parsed.world_folder || parsed.worldFolder || localStorage.getItem('world_folder'),
    java_path: parsed.java_path || localStorage.getItem('selectedJavaPath') || localStorage.getItem('selectedJava'),
  };
  return Object.assign({}, parsed, fallback);
}

function shortGB(mb) {
  if (!mb) return 'N/A';
  const gb = (Number(mb) / 1024);
  return `${(+gb.toFixed(1))} GB`;
}

function displaySummary() {
  const data = loadServerData();
  srvNameEl.textContent = data.server_name || '—';
  srvTypeEl.textContent = (data.server_type || '—').toString();
  srvVersionEl.textContent = data.version || '—';
  srvRamEl.textContent = data.ram ? `${data.ram} MB (${shortGB(data.ram)})` : '—';
  srvWorldEl.textContent = data.world_folder ? data.world_folder : (data.world_seed ? `Seed: ${data.world_seed}` : '—');
  srvJavaEl.textContent = data.java_path || '—';

  // highlight version row visually if needed
  if (data.version) {
    srvVersionEl.parentElement.classList.add('value-highlight');
  }

  // check eula default unchecked
  eulaCheckbox.checked = false;
  summaryMsg.textContent = "Confirm details and Accept the EULA to start. Logs will appear on the right.";
}

// --- Download helper (fixed with live progress + smooth UI update) ---
async function downloadToFile(url, destPath, onProgress) {
  // ensure parent folder exists
  await fsp.mkdir(path.dirname(destPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirect
        return downloadToFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} when fetching ${url}`));
      }

      const total = Number(res.headers['content-length'] || 0);
      let downloaded = 0;
      const fileStream = fs.createWriteStream(destPath);

      // 🟢 progress updates (safe for UI)
      let lastUpdate = 0;
      res.on('data', chunk => {
        downloaded += chunk.length;
        if (typeof onProgress === 'function' && total > 0) {
          const pct = (downloaded / total) * 100;
          // limit update frequency to avoid DOM lag
          const now = Date.now();
          if (now - lastUpdate > 100) {
            lastUpdate = now;
            window.requestAnimationFrame(() => {
              onProgress(pct, downloaded, total);
            });
          }
        }
      });

      res.on('error', err => {
        fileStream.close();
        reject(err);
      });

      fileStream.on('error', reject);

      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(() => {
          // final UI update to 100%
          if (typeof onProgress === 'function') {
            window.requestAnimationFrame(() => onProgress(100, downloaded, total));
          }
          resolve();
        });
      });
    });

    req.on('error', reject);
  });
}


// --- Find server download URL & download -->
async function downloadServerJar(server_type, version, serverFolder) {
  const jarTarget = path.join(serverFolder, 'server.jar');

  // === VANILLA ===
  if (server_type === 'vanilla') {
    appendLog(`Downloading vanilla ${version} metadata...`);
    const manifestUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
    const manifest = await (await fetch(manifestUrl)).json();
    const vinfo = manifest.versions.find(v => v.id === version);
    if (!vinfo) throw new Error(`Vanilla version ${version} not found in manifest`);
    const versionJson = await (await fetch(vinfo.url)).json();
    const serverUrl = versionJson.downloads.server.url;

    appendLog(`Downloading vanilla server JAR...`);
    await downloadToFile(serverUrl, jarTarget, (pct) => setProgress(pct, `Downloading: ${pct.toFixed(1)}%`));
    setProgress(100, 'Download complete'); // ✅ Added
    appendLog(`Downloaded vanilla server.jar`);
    return jarTarget;
  }

  // === PAPER ===
  if (server_type === 'paper') {
    appendLog(`Querying Paper API for ${version}...`);
    const api = `https://api.papermc.io/v2/projects/paper/versions/${version}`;
    const data = await (await fetch(api)).json();
    const builds = data.builds || [];
    if (!builds.length) throw new Error(`No Paper builds for ${version}`);
    const latest = Math.max(...builds);
    const jarUrl = `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latest}/downloads/paper-${version}-${latest}.jar`;

    appendLog(`Downloading Paper ${version} build ${latest}`);
    await downloadToFile(jarUrl, jarTarget, (pct) => setProgress(pct, `Downloading: ${pct.toFixed(1)}%`));
    setProgress(100, 'Download complete'); // ✅ Added
    appendLog(`Downloaded paper jar`);
    return jarTarget;
  }

  // === FABRIC ===
  if (server_type === 'fabric') {
    appendLog(`Downloading Fabric server for Minecraft ${version}...`);

    try {
      const loaderVersion = "0.15.7";
      const installerVersion = "1.0.0";
      const fabricUrl = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVersion}/${installerVersion}/server/jar`;
      const jarPath = path.join(serverFolder, "server.jar");

      appendLog(`⬇ Fetching Fabric server jar from: ${fabricUrl}`);

      // ✅ Changed: Use downloadToFile for real progress
      await downloadToFile(fabricUrl, jarPath, (pct) => setProgress(pct, `Downloading: ${pct.toFixed(1)}%`));
      setProgress(100, 'Download complete'); // ✅ Added

      appendLog(`Fabric server downloaded successfully as server.jar`);
      return jarPath;

    } catch (err) {
      appendLog(`Failed to download Fabric server jar: ${err}`);
      throw new Error(`Fabric server for version ${version} could not be downloaded.`);
    }
  }

  // === FORGE ===
  if (server_type === 'forge') {
    appendLog(`Querying Forge promos for ${version}...`);
    const promos = await (await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')).json();
    const promosObj = promos.promos || {};
    const key = `${version}-recommended`;
    const forgeVersion = promosObj[key];
    if (!forgeVersion) throw new Error(`No Forge recommended release for ${version}`);

    const installerName = `forge-${version}-${forgeVersion}-installer.jar`;
    const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${forgeVersion}/${installerName}`;
    const installerTarget = path.join(serverFolder, installerName);

    appendLog(`Downloading Forge installer ${installerName}...`);
    await downloadToFile(installerUrl, installerTarget, (pct) => setProgress(pct, `Downloading installer: ${pct.toFixed(1)}%`));
    setProgress(100, 'Download complete'); // ✅ Added

    appendLog(`Downloaded Forge installer`);
    return installerTarget; // return installer so caller can run it
  }

  throw new Error(`Unsupported server type: ${server_type}`);
}

// Toast to show Confirmation
function showToast(message) {
  // Remove existing toast if one is active
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger fade-in animation
  setTimeout(() => toast.classList.add('show'), 50);

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500); // Wait for fade-out animation
  }, 3000);
}
  
// --- run server flow ---
async function runSetupFlow() {
  try {
    confirmBtn.disabled = true;
    const data = loadServerData();

    if (!data.server_name || !data.server_type || !data.version) {
      appendLog('Error: Missing server name / type / version in configuration.');
      alert('Missing required server information. Go back and fill the details.');
      confirmBtn.disabled = false;
      return;
    }

    // EULA check
    if (!eulaCheckbox.checked) {
      appendLog('EULA not accepted.');
      alert('You must accept the EULA to continue.');
      confirmBtn.disabled = false;
      return;
    }

    // Java path validation
    const javaPath = data.java_path || 'java';
    try {
      const verify = spawn(javaPath, ['-version']);
      verify.on('error', () => { throw new Error('Java not found'); });
      // let it exit quickly
    } catch (e) {
      appendLog(`Java executable not available at ${javaPath}`);
      alert('Java not found or invalid. Please select a valid Java executable before proceeding.');
      nxtbtn.disabled = false;
      showToast('Setup failed: Java not found.');
      return;
    }

    // Setup destination
    const configFile = await ipcRenderer.invoke('get-config-path')

    let config = {};
    try {
        const raw = await fsp.readFile(configFile, 'utf8');
        config = JSON.parse(raw || '{}');
    } catch (e) {
        config = {};
    }

    const base = config.server_location || process.cwd();
    const serverFolder = path.join(base, data.server_name);
    await fsp.mkdir(serverFolder, { recursive: true });
    appendLog(`Server folder: ${serverFolder}`);

    setProgress(0, 'Preparing download...');

    // Download server jar or installer
    const downloadPath = await downloadServerJar(data.server_type.toLowerCase(), data.version, serverFolder);

    // If forge installer was returned -> run installer to create server.jar
    let serverJarPath = path.join(serverFolder, 'server.jar');
    if (data.server_type.toLowerCase() === 'forge') {
      // run installer: java -jar installer.jar --installServer
      appendLog('Running Forge installer (this may take a while) ...');
      setProgress(0, 'Installing Forge...');
      await new Promise((resolve, reject) => {
        const proc = spawn(javaPath, ['-jar', downloadPath, '--installServer'], { cwd: serverFolder });
        proc.stdout?.on('data', d => appendLog(d.toString()));
        proc.stderr?.on('data', d => appendLog(d.toString()));
        proc.on('exit', code => {
          if (code === 0) resolve();
          else reject(new Error('Forge installer failed with code ' + code));
        });
      });
      // find any jar created in folder
      const files = await fsp.readdir(serverFolder);
      const foundJar = files.find(n => n.endsWith('.jar') && !n.includes('installer'));
      if (!foundJar) throw new Error('Forge jar not found after installer');
      const foundPath = path.join(serverFolder, foundJar);
      // copy/rename to server.jar
      await fsp.copyFile(foundPath, serverJarPath);
      appendLog('Forge jar prepared as server.jar');
    } else {
      // For non-forge, downloadPath may already be server.jar
      if (downloadPath && downloadPath.endsWith('.jar')) {
        if (downloadPath !== serverJarPath) {
          await fsp.copyFile(downloadPath, serverJarPath).catch(()=>{});
        }
      }
    }

    setProgress(10, 'Finalizing files...');
    // Accept EULA
    await fsp.writeFile(path.join(serverFolder, 'eula.txt'), 'eula=true\n', 'utf8');
    appendLog('EULA accepted.');

    // Apply custom world or seed if provided (copy tree for folder)
    if (data.world_folder) {
      // copy tree into server_folder/world
      const src = data.world_folder;
      const dest = path.join(serverFolder, 'world');
      appendLog('Copying custom world (if provided)...');
      // naive copy: create dest and copy files recursively (synchronous for simplicity)
      // We'll attempt a simple recursive copy using Node 16+ fs.cp if available
      try {
        if (fs.cp) {
          await fsp.rm(dest, { recursive: true, force: true }).catch(()=>{});
          await fsp.cp(src, dest, { recursive: true });
        } else {
          // fallback simple copy
          appendLog('Note: Node <16 copy fallback; custom world may not copy correctly.');
        }
        appendLog('Custom world copied.');
      } catch (copyErr) {
        appendLog('Custom world copy failed: ' + String(copyErr));
      }
    } else if (data.world_seed) {
      // Append level-seed to server.properties
      const propsPath = path.join(serverFolder, 'server.properties');
      try {
        await fsp.appendFile(propsPath, `\nlevel-seed=${data.world_seed}\n`, 'utf8');
        appendLog('Applied custom seed.');
      } catch(e){ appendLog('Failed to write server.properties: ' + String(e)); }
    }

    // Save server_info.json
    const serverInfo = {
      server_name: data.server_name,
      server_ram: Number(data.ram) || 2048,
      server_type: data.server_type,
      server_version: data.version,
      server_status: "Offline",
      java_path: javaPath,
      players: "N/A",
      player_list: [],
      server_tps: "N/A"
    };
    await fsp.writeFile(path.join(serverFolder, 'server_info.json'), JSON.stringify(serverInfo, null, 2), 'utf8');
    appendLog('server_info.json saved.');

    // Run server for initial start
    appendLog('Starting server (initial run) ...');
    setProgress(20, 'Starting server...');
    await new Promise((resolveStart) => {
      const memFlag = `-Xmx${serverInfo.server_ram}M`;
      const proc = spawn(javaPath, [memFlag, '-Xms1024M', '-jar', serverJarPath, 'nogui'], { cwd: serverFolder });

      // stream output
      proc.stdout.on('data', d => appendLog(d.toString()));
      proc.stderr.on('data', d => appendLog(d.toString()));

      let doneSeen = false;
      proc.stdout.on('data', d => {
        const s = d.toString();
        if (s.includes('Done') || s.includes('Done (') || s.toLowerCase().includes('timings reset')) {
          doneSeen = true;
        }
      });

      // After some time or when doneSeen => stop server
      const shutdown = async () => {
        try {
          appendLog('Stopping initial server...');
          proc.stdin.write('stop\n');
        } catch (e) {
          proc.kill();
        }
      };

      // safety timeout: after 40 seconds if not done, send stop
      const timeout = setTimeout(() => { shutdown(); }, 40_000);

      proc.on('exit', (code) => {
        clearTimeout(timeout);
        appendLog('Server initial run exited (code ' + code + ')');
        setProgress(100, 'Setup Complete');
        // update server_info.json status to Offline
        serverInfo.server_status = "Offline";
        fsp.writeFile(path.join(serverFolder, 'server_info.json'), JSON.stringify(serverInfo, null, 2)).catch(()=>{});
        resolveStart();
      });
    });

    appendLog('Setup flow complete.');
    nxtbtn.disabled = false;
    showToast('Setup complete! You can start the server from Home Screen.');

  } catch (err) {
    appendLog('Fatal error: ' + (err && err.message ? err.message : String(err)));
    setProgress(0, 'Error');
    nxtbtn.disabled = false;
    showToast('Setup failed: ' + (err && err.message ? err.message : String(err)));
  }
}

// ---- UI events ----
confirmBtn.addEventListener('click', () => {
  runSetupFlow();
});

nxtbtn.addEventListener('click', () => {
  window.location.href = '../../home_screen/home_screen.html';
});

backBtn.addEventListener('click', () => {
  window.location.href = '../server_java/server_java.html';
});

clearLogBtn.addEventListener('click', () => {
  logEl.textContent = '';
});

saveLogBtn.addEventListener('click', async () => {
  const suggested = `server-log-${Date.now()}.txt`;
  const { canceled, filePath } = await ipcRenderer.invoke('show-save-dialog', { defaultPath: suggested });
  if (!canceled && filePath) {
    await fsp.writeFile(filePath, logEl.textContent, 'utf8');
    appendLog('Saved log to ' + filePath);
  }
});

// show summary on load
displaySummary();
appendLog('Ready. Review summary and click Confirm & Start.');
