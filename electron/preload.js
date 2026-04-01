const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  onIndexProgress: (callback) => ipcRenderer.on('index-progress', (_, data) => callback(data)),
  removeIndexProgress: () => ipcRenderer.removeAllListeners('index-progress'),
});