const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config.json');

// UI Elements
const startBtn = document.getElementById('start-btn');
const browseBtn = document.getElementById('browse-btn');
const confirmBtn = document.getElementById('confirm-btn');
const folderPathInput = document.getElementById('folder-path');
const statusMsg = document.getElementById('status-msg');

// Go to folder selection step
startBtn.addEventListener('click', () => {
  document.getElementById('welcome-screen').classList.remove('active');
  document.getElementById('folder-screen').classList.add('active');
});

// Folder picker dialog
browseBtn.addEventListener('click', async () => {
  const folderPath = await ipcRenderer.invoke('pick-folder');
  if (folderPath) {
    folderPathInput.value = folderPath;
    statusMsg.textContent = '';
    confirmBtn.disabled = false;
  }
});

// Confirm setup
confirmBtn.addEventListener('click', () => {
  const folder = folderPathInput.value.trim();
  if (!folder) {
    statusMsg.textContent = '⚠️ Please select a valid folder.';
    return;
  }

  // Save config
  const config = { setup: true, server_location: folder };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  statusMsg.textContent = '✅ Setup complete!';
  
  // Redirect after a moment
  setTimeout(() => {
    window.location.href = '../home_screen/home_screen.html';
  }, 1200);
});
