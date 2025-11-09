const { ipcRenderer } = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const AdmZip = require("adm-zip");
const https = require("https");
const fs = require("fs");
const { addAbortListener } = require("events");


const javaList = document.getElementById("java-list");
const javaInfo = document.getElementById("java-info");
const nextBtn = document.getElementById("next-btn");
const backBtn = document.getElementById("back-btn");
const error_label = document.getElementById("error_label");
const browseBtn = document.getElementById("browse-btn");
const refreshBtn = document.getElementById("refresh-btn");
const inputBox = document.getElementById("java-path-input");

const JAVA_COMPATIBILITY = {
  "1.1": 6, "1.2": 6, "1.3": 6, "1.4": 6, "1.5": 6,
  "1.6": 7, "1.7": 7, "1.8": 8, "1.9": 8, "1.10": 8,
  "1.11": 8, "1.12": 8, "1.13": 8, "1.14": 8, "1.15": 8,
  "1.16": 8, "1.17": 16, "1.18": 17, "1.19": 17,
  "1.20": 20, "1.21": 21
};

const serverData = JSON.parse(localStorage.getItem("serverData") || "{}");
const mcVersion = serverData.version || "1.20.1";
const mcMajorMinor = mcVersion.split(".").slice(0, 2).join(".");
const requiredJava = JAVA_COMPATIBILITY[mcMajorMinor] || 8;

javaInfo.textContent = `For Minecraft ${mcVersion}, Java ${requiredJava}+ is recommended.`;



// --- Extract version safely ---
function extractJavaVersion(text) {
  const lower = text.toLowerCase();
  let match = lower.match(/version\s+"?([0-9._]+)/);
  if (!match) match = lower.match(/openjdk\s+([0-9]+)/);

  if (match) {
    const version = match[1];
    const major = version.startsWith("1.")
      ? parseInt(version.split(".")[1])
      : parseInt(version.split(".")[0]);
    return { full: major.toString(), major };
  }
  return { full: "Unknown", major: 0 };
}

// --- Validate Java Path ---
function validateJavaPath(javaPath) {
  return new Promise((resolve) => {
    execFile(javaPath, ["-version"], { timeout: 2000 }, (err, stdout, stderr) => {
      const output = stderr.toString() || stdout.toString();
      const version = extractJavaVersion(output);
      if (version.major > 0) resolve(version);
      else resolve(null);
    });
  });
}

// --- Asynchronously get version (fast and parallel) ---
function getJavaVersion(javaPath) {
  return new Promise((resolve) => {
    execFile(javaPath, ["-version"], { timeout: 2000 }, (error, stdout, stderr) => {
      const out = stderr.toString() || stdout.toString();
      const version = extractJavaVersion(out);
      resolve({ path: javaPath, ...version });
    });
  });
}

// --- Render detected Javas ---
async function renderJavaList() {
  error_label.textContent = "Scanning for installed Java versions...";
  javaList.innerHTML = "";

  const appDir = path.dirname(process.execPath);
  const portableJavaDir = path.join(appDir, "java");

  //  Check if portable Java exists
  let portableJavaPath = null;
  if (fs.existsSync(portableJavaDir)) {
    try {
      const subfolders = fs
        .readdirSync(portableJavaDir)
        .filter((f) => fs.statSync(path.join(portableJavaDir, f)).isDirectory());

      const extracted = subfolders.find((f) => f.includes("jdk"));
      if (extracted) {
        const candidate = path.join(portableJavaDir, extracted, "bin", "java.exe");
        if (fs.existsSync(candidate)) {
          portableJavaPath = candidate;
          console.log("[INFO] Found portable Java:", candidate);
        }
      }
    } catch (err) {
      console.error("[ERROR] Checking portable Java failed:", err);
    }
  }

  //  Get system-installed Javas via IPC
  const paths = await ipcRenderer.invoke("find-java-paths");
  const allPaths = paths || [];

  // If portable Java found, include it in the list
  if (portableJavaPath && !allPaths.includes(portableJavaPath)) {
    allPaths.unshift(portableJavaPath);
  }

  // If still nothing, prompt for installation
  if (allPaths.length === 0) {
    error_label.textContent = "No Java installations found. Please browse manually or install portable Java.";
    installJava();
    return;
  }

  const versionResults = await Promise.allSettled(allPaths.map(getJavaVersion));

  let validCount = 0;

  versionResults.forEach((res) => {
    if (!res.value) return;
    const { path, full, major } = res.value;

    const card = document.createElement("div");
    card.className = "java-card";

    const infoDiv = document.createElement("div");
    const versionText = document.createElement("div");
    versionText.className = "version-text";
    const pathText = document.createElement("div");
    pathText.className = "path-text";
    pathText.textContent = path;

    if (major >= requiredJava) {
      versionText.textContent = `Java ${full} ✓`;
      versionText.style.color = "#4caf50";
    } else if (major > 0) {
      versionText.textContent = `Java ${full} (Older than ${requiredJava}+)`;
      versionText.style.color = "#ff6b6b";
    } else {
      versionText.textContent = "Unknown Java version";
      versionText.style.color = "#ffb74d";
    }

    const selectBtn = document.createElement("button");
    selectBtn.className = "btn primary";
    selectBtn.textContent = "Select";
    selectBtn.onclick = () => {
      inputBox.value = path;
      handleJavaSelection(path, full, major);
    };

    infoDiv.appendChild(versionText);
    infoDiv.appendChild(pathText);
    card.appendChild(infoDiv);
    card.appendChild(selectBtn);
    javaList.appendChild(card);
    validCount++;
  });

  if (validCount > 0) {
    error_label.textContent = `Found ${validCount} Java installation(s).`;
  } else {
    error_label.textContent = "No valid Java installations detected.";
  }
}
// show progress popup
function showProgressPopup(title) {
  let popup = document.getElementById("progress-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "progress-popup";
    popup.innerHTML = `
      <h4>${title}</h4>
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <div id="progress-text">0%</div>
    `;
    document.body.appendChild(popup);
  } else {
    popup.querySelector("h4").textContent = title;
    popup.style.display = "block";
  }
}

function updateProgress(percent) {
  const fill = document.querySelector("#progress-popup .progress-fill");
  const text = document.querySelector("#progress-popup #progress-text");
  if (fill && text) {
    fill.style.width = percent + "%";
    text.textContent = percent.toFixed(1) + "%";
  }
}

function hideProgressPopup() {
  const popup = document.getElementById("progress-popup");
  if (popup) {
    popup.style.opacity = "0";
    setTimeout(() => (popup.style.display = "none"), 300);
  }
}

// ✅ Download function with progress updates
function downloadFile(url, dest, callback) {
  console.log("[INFO] Starting download from:", url);
  const file = fs.createWriteStream(dest);
  https
    .get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        console.log("[DEBUG] Redirecting to:", response.headers.location);
        file.close();
        fs.unlink(dest, () => downloadFile(response.headers.location, dest, callback));
        return;
      }

      if (response.statusCode !== 200) {
        return callback(new Error(`Download failed: HTTP ${response.statusCode}`));
      }

      const total = parseInt(response.headers["content-length"] || "0");
      let downloaded = 0;
      showProgressPopup("☕ Downloading Java 21 ZIP...");

      response.on("data", (chunk) => {
        downloaded += chunk.length;
        if (total) {
          const percent = (downloaded / total) * 100;
          updateProgress(percent);
        }
      });

      response.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          console.log("[INFO] Download completed.");
          hideProgressPopup();
          callback(null);
        });
      });
    })
    .on("error", (err) => {
      fs.unlink(dest, () => callback(err));
    });
}

// ✅ Fetch the latest Adoptium Java 21 ZIP
async function getLatestJavaZipUrl() {
  const apiUrl =
    "https://api.adoptium.net/v3/assets/latest/21/hotspot?os=windows&architecture=x64&image_type=jdk";

  return new Promise((resolve, reject) => {
    console.log("[INFO] Fetching latest Java 21 info...");
    https
      .get(apiUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json?.length && json[0]?.binary?.package?.link) {
              const asset = json[0].binary.package.link;
              resolve(asset);
            } else {
              reject("No valid package link found in JSON.");
            }
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

// ✅ Main Java install logic
async function installJava() {
  const confirm = await showToast(
    "No Java found. Do you want to download a portable Java 21 (Adoptium ZIP)?",
    true
  );

  if (!confirm) {
    showToast("Installation cancelled.", false);
    return;
  }

  showToast("☕ Fetching latest Java 21 ZIP info...", false);

  let downloadUrl;
  try {
    downloadUrl = await getLatestJavaZipUrl();
    console.log("[INFO] Downloading from:", downloadUrl);
  } catch (err) {
    console.error("Failed to fetch latest Java info:", err);
    showToast("❌ Failed to fetch latest Java ZIP link.", false);
    return;
  }

  const appDir = path.dirname(process.execPath);
  const javaDir = path.join(appDir, "java");
  const downloadPath = path.join(javaDir, "temurin21.zip");

  if (!fs.existsSync(javaDir)) fs.mkdirSync(javaDir, { recursive: true });

  // Start downloading
  downloadFile(downloadUrl, downloadPath, (err) => {
    if (err) {
      console.error("Download failed:", err);
      showToast("❌ Failed to download Java ZIP.", false);
      hideProgressPopup();
      return;
    }

    showToast("📦 Extracting Java...", false);

    try {
      const zip = new AdmZip(downloadPath);
      zip.extractAllTo(javaDir, true);
      fs.unlinkSync(downloadPath);

      const subfolders = fs
        .readdirSync(javaDir)
        .filter((f) => fs.statSync(path.join(javaDir, f)).isDirectory());

      const extracted = subfolders.find((f) => f.toLowerCase().includes("jdk"));
      const javaBin = extracted
        ? path.join(javaDir, extracted, "bin", "java.exe")
        : null;

      if (javaBin && fs.existsSync(javaBin)) {
        localStorage.setItem("customJavaPath", javaBin);
        showToast("✅ Java 21 installed (portable, no admin needed)!", false);
        setTimeout(renderJavaList, 3000);
      } else {
        showToast("❌ Java installation failed (bin/java.exe not found).", false);
      }
    } catch (e) {
      console.error("Extraction error:", e);
      showToast("❌ Failed to extract Java ZIP.", false);
    }
  });
}
// --- Selection handler ---
function handleJavaSelection(javaPath, fullVersion = "Unknown", major = 0,showPopup = true ) {
  localStorage.setItem("selectedJavaPath", javaPath);
  localStorage.setItem("selectedJavaVersion", fullVersion);

  let message = `Selected Java ${fullVersion}`;
  if (major < requiredJava && major > 0)
    message = ` Java ${fullVersion} may be incompatible (requires ${requiredJava}+)`;

  error_label.textContent = `${message} — ${javaPath}`;

  if (showPopup) showSavePopup(javaPath);
}
// msg Toast
function showToast(message, buttons = false) {
  return new Promise((resolve) => {
    // Remove existing toast if any
    let toast = document.getElementById("toast-popup");
    if (toast) toast.remove();

    // Create base
    toast = document.createElement("div");
    toast.id = "toast-popup";
    toast.style.position = "fixed";
    toast.style.bottom = "40px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "linear-gradient(145deg, #1e293b, #0f172a)";
    toast.style.color = "#fff";
    toast.style.padding = "16px 28px";
    toast.style.borderRadius = "12px";
    toast.style.fontFamily = "Poppins, sans-serif";
    toast.style.boxShadow = "0 0 20px rgba(0,0,0,0.5)";
    toast.style.zIndex = "9999";
    toast.style.textAlign = "center";
    toast.style.transition = "opacity 0.4s ease";
    toast.style.opacity = "1";

    const msgDiv = document.createElement("div");
    msgDiv.textContent = message;
    msgDiv.style.marginBottom = buttons ? "12px" : "0";
    toast.appendChild(msgDiv);

    // If buttons are required (Yes/No confirmation)
    if (buttons) {
      const btnYes = document.createElement("button");
      const btnNo = document.createElement("button");

      [btnYes, btnNo].forEach((btn) => {
        btn.style.margin = "0 8px";
        btn.style.padding = "6px 14px";
        btn.style.border = "none";
        btn.style.borderRadius = "6px";
        btn.style.cursor = "pointer";
        btn.style.fontSize = "14px";
        btn.style.fontFamily = "Poppins, sans-serif";
        btn.style.transition = "background 0.2s ease";
      });

      btnYes.textContent = "Yes";
      btnYes.style.background = "#22c55e";
      btnYes.onclick = () => {
        cleanup();
        resolve(true);
      };

      btnNo.textContent = "No";
      btnNo.style.background = "#ef4444";
      btnNo.onclick = () => {
        cleanup();
        resolve(false);
      };

      toast.appendChild(btnYes);
      toast.appendChild(btnNo);
    } else {
      // Auto hide after 3 seconds
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
      }, 3000);
    }

    document.body.appendChild(toast);

    function cleanup() {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }
  });
}
// --- Browse for Java manually ---
browseBtn.onclick = async () => {
  const filePath = await ipcRenderer.invoke("pick-java");
  if (filePath) {
    inputBox.value = filePath;
    const version = await validateJavaPath(filePath);
    if (version) handleJavaSelection(filePath, version.full, version.major);
    else {
      alert("Invalid Java path selected!");
      error_label.textContent = " The selected file is not a valid Java executable.";
    }
  }
};
//Load existing selection
function loadExistingSelection() {
  try {
    const fs = require("fs");
    const path = require("path");
    const configPath = path.join(__dirname, "../../../config.json");

    // Check if config file exists
    if (!fs.existsSync(configPath)) {
      console.warn("[INFO] No config.json found yet.");
      return;
    }

    // Parse config
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw || "{}");

    // Find the input element (ensure it exists)
    const inputBox = document.getElementById("java-path-input");
    if (!inputBox) {
      console.error("[ERROR] No input box with id 'java-path-input' found in DOM");
      return;
    }

    // Apply loaded path if available
    if (config.java_path) {
      inputBox.value = config.java_path;
      console.log(`[INFO] Loaded saved Java path: ${config.java_path}`);
    } else {
      console.log("[INFO] No Java path saved in config.json yet.");
    }

  } catch (err) {
    alert("[ERROR] Failed to load configuration: " + err.message);
    console.error(err);
  }
}

// --- Toast Popup Creator + Logic ---
function showSavePopup(javaPath) {
  const fs = require("fs");
  const path = require("path");
  const configPath = path.join(__dirname, "../../../config.json");

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8") || "{}");
    } catch (err) {
      console.error("[ERROR] Failed to parse config:", err);
    }
  }

  // Only show popup if a java_path doesn’t already exist
  if (config.java_path) return;

  // Create popup dynamically if not already there
  let popup = document.getElementById("save-java-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "save-java-popup";
    popup.innerHTML = `
      <div class="popup-content">
        <p>Do you want to save this as your default Java path?</p>
        <button id="popup-save-btn">Save</button>
      </div>
    `;
    document.body.appendChild(popup);
  }

  // Reset state and make visible
  popup.style.display = "block";
  popup.classList.add("visible");
  popup.classList.remove("fade-out");

  // Auto-hide after 5 seconds
  const hideTimeout = setTimeout(() => hidePopup(), 5000);

  // Save button
  const saveBtn = popup.querySelector("#popup-save-btn");
  saveBtn.onclick = () => {
    try {
      config.java_path = javaPath;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`[INFO] Default Java path saved: ${javaPath}`);
      clearTimeout(hideTimeout);
      hidePopup();
    } catch (err) {
      alert("[ERROR] Failed to save config: " + err.message);
    }
  };

  // Hide helper
  function hidePopup() {
    popup.classList.remove("visible");
    popup.classList.add("fade-out");
    setTimeout(() => {
      popup.classList.remove("fade-out");
      popup.style.display = "none";
    }, 400);
  }
}




// --- Refresh List ---
refreshBtn.onclick = renderJavaList;


// --- Next Navigation ---
nextBtn.onclick = async () => {
  const javaPath = inputBox.value.trim();
  if (!javaPath) {
    alert("⚠️ Please enter or select a Java path before continuing!");
    error_label.textContent = "❌ Java path is required.";
    return;
  }

  const version = await validateJavaPath(javaPath);
  if (!version) {
    alert("❌ Invalid Java path! Please select a valid Java executable.");
    error_label.textContent = "❌ Invalid Java path provided.";
    return;
  }

  handleJavaSelection(javaPath, version.full, version.major,false);
  window.location.href = "../server_finalize/server_finalize.html";
};
// --- Back Navigation ---
backBtn.onclick = () => window.location.href = "../server_world/server_world.html";

// --- Load on start ---
renderJavaList();
loadExistingSelection();