// src/utils/file_opener.js
const { dialog } = require('electron');

/**
 * Opens a folder picker or file picker dialog.
 *
 * @param {Object} options
 * @param {'folder'|'file'} options.type - Type of picker to open.
 * @param {string[]} [options.filters] - File filters, e.g. ['json', 'exe'].
 * @returns {Promise<string|null>} - Selected path or null if cancelled.
 */
async function openDialog({ type = 'folder', filters = [] } = {}) {
  const dialogOptions = {};

  if (type === 'folder') {
    dialogOptions.properties = ['openDirectory'];
  } else if (type === 'file') {
    dialogOptions.properties = ['openFile'];

    if (filters.length > 0) {
      dialogOptions.filters = [
        {
          name: 'Allowed Files',
          extensions: filters
        }
      ];
    }
  } else {
    throw new Error(`Invalid type '${type}' — must be 'folder' or 'file'`);
  }

  const result = await dialog.showOpenDialog(dialogOptions);
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
}

module.exports = { openDialog };

//5. DUmmy
ipcMain.on("open-server-details", (event, serverPath) => {
  const detailsWin = new BrowserWindow({
    width: 1280,
    height: 720,
    title: "Server Details",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  // Load the details page
  detailsWin.loadFile(path.join(__dirname, "ui/server_details/server_details.html"));

  // Once loaded, send serverPath to that window
  detailsWin.webContents.on("did-finish-load", () => {
    detailsWin.webContents.send("init-server-details", serverPath);
  });
});