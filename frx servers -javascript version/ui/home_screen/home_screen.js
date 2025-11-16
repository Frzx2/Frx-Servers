const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { ipcRenderer } = require("electron");

let CONFIG_PATH = null;
const serverListDiv = document.getElementById("server-list");
const refreshBtn = document.getElementById("refresh-btn");
const configBtn = document.getElementById("config-btn");
const createBtn = document.getElementById("create-btn");


// Fetch config path from main process
async function initConfigPath() {
  CONFIG_PATH = await ipcRenderer.invoke("get-config-path");
  console.log("Config path:", CONFIG_PATH);
}

// Main setup function
async function main() {
  await initConfigPath();

  loadServers();

  refreshBtn.addEventListener("click", loadServers);
  configBtn.addEventListener(
    "click",
    () => (window.location.href = "../configuration/config.html")
  );
  createBtn.addEventListener(
    "click",
    () => (window.location.href = "../server_creation/server_type/server_type.html")
  );
}

main();

let serversData = {}; // Cache to track servers and last update times
let deleteMode = false;

// Check if folder is a valid Minecraft server
function isMinecraftServer(dirPath) {
  return (
    fs.existsSync(path.join(dirPath, "server.jar")) ||
    fs.existsSync(path.join(dirPath, "server.properties"))
  );
}

// Start the Minecraft server
function startServer(serverPath) {
  const jarPath = path.join(serverPath, "server.jar");
  if (!fs.existsSync(jarPath)) {
    alert("No server.jar found in this server directory.");
    return;
  }

  const command = `cd "${serverPath}" && java -jar server.jar nogui`;
  const process = exec(command);

  alert(`Starting server at ${serverPath}...`);
  process.stdout.on("data", data => console.log(data.toString()));
  process.stderr.on("data", data => console.error(data.toString()));
}

// Load servers initially
function loadServers() {
  serverListDiv.innerHTML = '<p class="loading">Scanning servers...</p>';

  if (!fs.existsSync(CONFIG_PATH)) {
    serverListDiv.innerHTML = "<p>No config found. Please run setup again.</p>";
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
  const baseDir = config.server_location;

  if (!fs.existsSync(baseDir)) {
    serverListDiv.innerHTML = "<p>Configured folder not found.</p>";
    return;
  }

  const folders = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter(f => f.isDirectory())
    .map(f => f.name);

  const validServers = folders.filter(name =>
    isMinecraftServer(path.join(baseDir, name))
  );

  if (validServers.length === 0) {
    serverListDiv.innerHTML = "<p>No valid servers found.</p>";
    return;
  }

  serverListDiv.innerHTML = "";

  for (const name of validServers) {
    const serverPath = path.join(baseDir, name);
    const infoPath = path.join(serverPath, "server_info.json");
    const iconPath = path.join(serverPath, "server-icon.png");

    // Default info
    let info = {
      name,
      status: "Offline",
      tps: "-",
      players: "0/0",
      ip: "No IP found"
    };

    // Try reading server info file
    if (fs.existsSync(infoPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(infoPath, "utf-8"));
        info = { ...info, ...data };
      } catch (err) {
        console.error(`Error reading ${infoPath}:`, err);
      }
    }

    // Store initial info in memory cache
    serversData[serverPath] = info;

    // Determine icon
    const defaultIcon = path.join(__dirname, "../../Icon/logo.png");
    const serverIconURL = fs.existsSync(iconPath)
      ? `file://${iconPath.replace(/\\/g, "/")}`
      : `file://${defaultIcon.replace(/\\/g, "/")}`;

    // Create card
    const card = document.createElement("div");
    card.classList.add("server-card");
    card.dataset.path = serverPath;

    card.innerHTML = `
  <div class="server-top">
    <div class="server-icon-wrapper">
      <img src="${serverIconURL}" alt="Server Icon" class="server-icon">
      <button class="edit-btn" title="Edit Server"><i data-feather="edit-3"></i></button>
      <button class="delete-btn" title="Delete Server"><i data-feather="trash-2"></i></button>
    </div>

    <div class="server-info">
      <h3 class="server-name">${info.server_name || name}</h3>
      <p><strong>${info.server_status || "Offline"}</strong></p>
      <p>Players: ${info.players}</p>
      <p>IP: ${info.ip}</p>
      <p>${info.server_type || "Unknown"}</p>
    </div>
  </div>
`;


    // Edit, Start, Details,Delete button handlers
    
   card.querySelector(".edit-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    openEditPopup(serverPath, info.name);
  });

  card.querySelector(".delete-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    DeleteServer(serverPath);
  });
  card.addEventListener("click", () => openServerDetails(serverPath));
  serverListDiv.appendChild(card);
// Render icons
  feather.replace();
  }

  // Start live updater
  startAutoUpdate();
}

// === Live Auto-Updater ===
function startAutoUpdate() {
  setInterval(() => {
    Object.keys(serversData).forEach(serverPath => {
      const infoPath = path.join(serverPath, "server_info.json");
      if (!fs.existsSync(infoPath)) return;

      try {
        const newInfo = JSON.parse(fs.readFileSync(infoPath, "utf-8"));
        const oldInfo = serversData[serverPath];
        const card = serverListDiv.querySelector(
          `.server-card[data-path="${serverPath.replace(/\\/g, "\\\\")}"]`
        );

        if (!card || !newInfo) return;

        // Update displayed info (no TPS, now uses server_type)
        card.querySelector("h3").textContent = newInfo.name || oldInfo.name;
        card.querySelector("p strong").textContent =
          newInfo.server_status || oldInfo.server_status;

        const ps = card.querySelectorAll(".server-info p");
        ps[1].textContent = `Players: ${newInfo.players || "0/0"}`;
        ps[2].textContent = `IP: ${newInfo.ip || "No IP found"}`;
        ps[3].textContent = `${newInfo.server_type || "Unknown"}`;

        // Save updated info to cache
        serversData[serverPath] = { ...oldInfo, ...newInfo };
      } catch (err) {
        console.error(`Error reading updated info for ${serverPath}:`, err);
      }
    });
  }, 2000); // every 2 seconds
}
function openServerDetails(serverPath) {
  try {
    // Save selected server path so next page can load it
    localStorage.setItem("selectedServerPath", serverPath);

    // Navigate to details page in same window
    window.location.href = "../server_details/server_details.html";
  } catch (err) {
    console.error("Failed to open server details:", err);
  }
}



// === Edit Popup ===
function openEditPopup(serverPath, currentName) {
  const popup = document.createElement("div");
  popup.className = "edit-popup-overlay";
  popup.innerHTML = `
    <div class="edit-popup">
      <h3>Edit Server</h3>
      <label>Server Name:</label>
      <input type="text" id="edit-name" value="${currentName}" />

      <label>Server Icon:</label>
      <div class="icon-preview-wrapper">
        <img id="icon-preview"
             src="${path
               .join(serverPath, "server-icon.png")
               .replace(/\\/g, "/")}"
             alt="Preview"
             onerror="this.onerror=null; this.src='../../assets/default-icon.png';">
      </div>
      <input type="file" id="edit-icon" accept="image/*" />

      <div class="popup-buttons">
        <button id="save-edit">Save</button>
        <button id="cancel-edit">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  const fileInput = popup.querySelector("#edit-icon");
  const previewImg = popup.querySelector("#icon-preview");

  // === Live icon preview ===
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => (previewImg.src = e.target.result);
      reader.readAsDataURL(file);
    }
  });

  popup.querySelector("#cancel-edit").onclick = () => popup.remove();

  popup.querySelector("#save-edit").onclick = async () => {
  const newName = popup.querySelector("#edit-name").value.trim();
  const iconFile = popup.querySelector("#edit-icon").files[0];

  const oldFolder = path.basename(serverPath);
  const parentDir = path.dirname(serverPath);
  const newFolderName = newName.replace(/[<>:"/\\|?*]/g, ""); // sanitize
  const newFolderPath = path.join(parentDir, newFolderName);

  try {
    // === Rename folder first ===
    if (newFolderName && newFolderName !== oldFolder) {
      fs.renameSync(serverPath, newFolderPath);
      console.log(`✅ Renamed folder to: ${newFolderName}`);

      // Update cache reference
      if (serversData[serverPath]) {
        serversData[newFolderPath] = serversData[serverPath];
        delete serversData[serverPath];
      }
    }

    // === Update info.json inside the renamed folder ===
    const infoPath = path.join(newFolderPath, "server_info.json");
    const data = fs.existsSync(infoPath)
      ? JSON.parse(fs.readFileSync(infoPath, "utf-8"))
      : {};

    if (newName) data.server_name = newName;
    fs.writeFileSync(infoPath, JSON.stringify(data, null, 2));

    // === Update icon (if any) ===
    if (iconFile) {
      const reader = new FileReader();
      reader.onload = () => {
        fs.writeFileSync(
          path.join(newFolderPath, "server-icon.png"),
          Buffer.from(new Uint8Array(reader.result))
        );
      };
      reader.readAsArrayBuffer(iconFile);
    }

    // === Refresh server list after all operations ===
    if (typeof loadServers === "function") {
      setTimeout(loadServers, 400); // slight delay ensures folder settled
    }

  } catch (err) {
    console.error("❌ Error updating server:", err);
  }

  popup.remove();
};}
// Delete Server
function DeleteServer(serverPath) {
  // Remove any old popup
  const existing = document.getElementById("deleteModal");
  if (existing) existing.remove();

  // Create popup dynamically
  const modalHTML = `
    <div id="deleteModal" class="delete-modal">
      <div class="delete-modal-content">
        <h2>Confirm Delete</h2>
        <p>This action <strong>cannot be undone</strong>.<br>
        Are you sure you want to delete this server?</p>
        <div class="delete-modal-buttons">
          <button id="cancelDelete">Cancel</button>
          <button id="confirmDelete" class="danger">Delete</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Button actions
  const modal = document.getElementById("deleteModal");
  const cancelBtn = document.getElementById("cancelDelete");
  const confirmBtn = document.getElementById("confirmDelete");

  cancelBtn.onclick = () => modal.remove();

  confirmBtn.onclick = () => {
    try {
      if (fs.existsSync(serverPath)) {
        fs.rmSync(serverPath, { recursive: true, force: true });
      } else {
        alert("Server folder not found.");
      }
    } catch (err) {
      alert("❌ Failed to delete server:", err);
    }

    modal.remove();

    // Refresh server list if the function exists
    if (typeof loadServers === "function") {
      setTimeout(loadServers, 400); // short delay to ensure file deletion completes
    }
  };
}




//Scearch Box
document.addEventListener("DOMContentLoaded", () => {
  const searchBox = document.getElementById("search-box");

  searchBox.addEventListener("input", () => {
    const query = searchBox.value.toLowerCase().trim();

    // Always re-fetch cards each time (because loadServers recreates them)
    const cards = document.querySelectorAll(".server-card");

    cards.forEach(card => {
      const name = card.querySelector(".server-name")?.textContent.toLowerCase() || "";
      if (name.includes(query)) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    });
  });
});


// === Navigation ===
refreshBtn.addEventListener("click", loadServers);
configBtn.addEventListener(
  "click",
  () => (window.location.href = "../configuration/config.html")
);
createBtn.addEventListener(
  "click",
  () => (window.location.href = "../server_creation/server_type/server_type.html")
);
// Initial load
loadServers();
