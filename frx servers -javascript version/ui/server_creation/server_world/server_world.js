const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

const seedInput = document.getElementById("seed-input");
const selectFolderBtn = document.getElementById("select-folder-btn");
const selectedLabel = document.getElementById("selected-folder-label");
const errorLabel = document.getElementById("error-label");
const nextBtn = document.getElementById("next-btn");
const backBtn = document.getElementById("back-btn");

let selectedFolder = null;

// -----------------------------
// Helper: Check if folder contains a valid Minecraft world
// -----------------------------
function isValidWorldFolder(folder) {
  try {
    // Direct check
    const levelDatPath = path.join(folder, "level.dat");
    if (fs.existsSync(levelDatPath)) return true;

    // Also check one level deeper (in case user selects /saves instead of /saves/MyWorld)
    const subdirs = fs.readdirSync(folder, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(folder, d.name));

    return subdirs.some(sub => fs.existsSync(path.join(sub, "level.dat")));
  } catch (err) {
    console.error("[ERROR] Failed to validate folder:", err);
    return false;
  }
}

// -----------------------------
// Disable folder selection if seed is entered
// -----------------------------
seedInput.addEventListener("input", () => {
  if (seedInput.value.trim()) {
    selectFolderBtn.disabled = true;
    selectFolderBtn.style.background = "#555"; // grey when disabled
    selectedFolder = null;
    selectedLabel.textContent = "📄 Folder disabled (using Seed)";
  } else {
    selectFolderBtn.disabled = false;
    selectFolderBtn.style.background = "#007bff"; // blue when re-enabled
    selectedLabel.textContent = "No folder selected";
  }
});

// -----------------------------
// Folder Picker (Electron IPC)
// -----------------------------
selectFolderBtn.addEventListener("click", async () => {
  if (seedInput.value.trim()) {
    errorLabel.textContent = "⚠️ Clear the seed to select a folder!";
    return;
  }

  try {
    const folder = await ipcRenderer.invoke("pick-folder");
    if (folder) {
      if (isValidWorldFolder(folder)) {
        selectedFolder = folder;
        selectedLabel.textContent = `✅ Selected: ${folder}`;
        errorLabel.textContent = "";
      } else {
        selectedFolder = null;
        selectedLabel.textContent = "❌ Invalid world folder (no level.dat found)";
      }
    } else {
      selectedFolder = null;
      selectedLabel.textContent = "No folder selected";
    }
  } catch (err) {
    console.error("Error picking folder:", err);
    errorLabel.textContent = "⚠️ Folder picker failed. Check console.";
  }
});

// -----------------------------
// Next Button
// -----------------------------
nextBtn.addEventListener("click", () => {
  const seed = seedInput.value.trim();

  if (seed && selectedFolder) {
    errorLabel.textContent = "⚠️ Choose either Seed or Folder — not both!";
    return;
  }

  const serverData = JSON.parse(localStorage.getItem("serverData") || "{}");

  if (seed) {
    serverData.world_seed = seed;
    delete serverData.world_folder;
  } else if (selectedFolder) {
    serverData.world_folder = selectedFolder;
    delete serverData.world_seed;
  } else {
    delete serverData.world_folder;
    delete serverData.world_seed;
  }

  localStorage.setItem("serverData", JSON.stringify(serverData));
  window.location.href = "../server_java/server_java.html";
});

// -----------------------------
// Back Button
// -----------------------------
backBtn.addEventListener("click", () => {
  window.location.href = "../server_ram/server_ram.html";
});
