// ==================== Imports ====================
const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

// ==================== DOM Elements ====================
const serverLocationInput = document.getElementById("serverLocation");
const browseBtn = document.getElementById("browseBtn");
const statusMsg = document.getElementById("statusMsg");
const backBtn = document.getElementById("backBtn");

const javaPathInput = document.getElementById("javaPath");
const javaBrowseBtn = document.getElementById("javaBrowseBtn");
const javaList = document.getElementById("javaList");

const modal = document.getElementById("licenseModal");
const link = document.getElementById("licenseLink");
const closeBtn = document.querySelector(".close");

// ==================== Paths & Config ====================
const configPath = path.join(__dirname, "../../config.json");
let config = {};

// ==================== Utility Functions ====================

// Save configuration file
function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("[INFO] Configuration saved:", config);
    return true;
  } catch (err) {
    console.error("[ERROR] Saving configuration failed:", err);
    return false;
  }
}

// Load configuration file
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8") || "{}";
      config = JSON.parse(raw);
    } else {
      config = {};
    }
  } catch (err) {
    console.error("[ERROR] Loading configuration failed:", err);
    config = {};
  }
}

// ==================== Initialization ====================
window.addEventListener("DOMContentLoaded", async () => {
  loadConfig();

  if (config.server_location) {
    serverLocationInput.value = config.server_location;
  }

  if (config.java_path) {
    javaPathInput.value = config.java_path;
  }

  await loadJavaList();
});

// ==================== Server Location Logic ====================
browseBtn.addEventListener("click", async () => {
  try {
    const folder = await ipcRenderer.invoke("pick-folder");
    if (!folder) return;

    serverLocationInput.value = folder;
    config.server_location = folder;

    if (saveConfig()) {
      console.log(`[INFO] Server location set to: ${folder}`);
    } else {
      alert("❌ Failed to save server location.");
    }
  } catch (err) {
    console.error("[ERROR] Selecting server location:", err);
  }
});

// ==================== Java Path Logic ====================
javaBrowseBtn.addEventListener("click", async () => {
  try {
    const folder = await ipcRenderer.invoke("pick-folder");
    if (!folder) return;

    javaPathInput.value = folder;
    config.java_path = folder;

    if (saveConfig()) {
      console.log(`[INFO] Java path manually set to: ${folder}`);
      await loadJavaList(); // Refresh detected list
    } else {
      alert("❌ Failed to save Java path.");
    }
  } catch (err) {
    console.error("[ERROR] Selecting Java path:", err);
  }
});

// ==================== Load Java Installations ====================
async function loadJavaList() {
  javaList.innerHTML = "";

  const loadingLi = document.createElement("li");
  loadingLi.textContent = "🔍 Searching for Java installations...";
  loadingLi.style.color = "#aaa";
  loadingLi.style.textAlign = "center";
  javaList.appendChild(loadingLi);

  try {
    const javaPaths = await ipcRenderer.invoke("find-java-paths");

    javaList.innerHTML = ""; // Clear loading message

    if (!javaPaths || javaPaths.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No Java installations detected";
      li.style.color = "#777";
      li.style.textAlign = "center";
      javaList.appendChild(li);
      return;
    }

    javaPaths.forEach((javaPath) => {
      const li = document.createElement("li");
      li.textContent = javaPath;
      li.classList.add("java-path-item");
      li.style.cursor = "pointer";

      if (config.java_path === javaPath) {
        li.style.background = "#1e88e5";
        li.style.color = "#fff";
      }

      li.onclick = () => {
        javaPathInput.value = javaPath;
        config.java_path = javaPath;

        if (saveConfig()) {
          console.log(`[INFO] Java path set to: ${javaPath}`);
          // Highlight selection
          document.querySelectorAll(".java-path-item").forEach((el) => {
            el.style.background = "";
            el.style.color = "";
          });
          li.style.background = "#1e88e5";
          li.style.color = "#fff";
        } else {
          alert("❌ Failed to save Java path.");
        }
      };

      javaList.appendChild(li);
    });
  } catch (err) {
    console.error("[ERROR] Could not fetch Java paths:", err);
    javaList.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = "⚠️ Failed to fetch Java paths.";
    li.style.color = "red";
    li.style.textAlign = "center";
    javaList.appendChild(li);
  }
}

// ==================== Navigation ====================
backBtn.addEventListener("click", () => {
  saveConfig();
  window.location.href = "../home_screen/home_screen.html";
});

// ==================== License Modal ====================
link.addEventListener("click", (e) => {
  e.preventDefault();
  modal.style.display = "flex";
});

closeBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});
