// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// preload.js
const { contextBridge, ipcRenderer } = require('electron');
console.log('preload.js');

contextBridge.exposeInMainWorld('electronAPI', {
  // Start/Stop child process
  startProcessing: (filePath) => ipcRenderer.send('start-processing', filePath),
  stopProcessing: () => ipcRenderer.send('stop-processing'),
  restartProcessing: () => ipcRenderer.send('restart-processing'),

  // Open file dialog
  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  onFileChosen: (callback) =>
    ipcRenderer.on('file-chosen', (_, path) => callback(path)),

  // Log updates
  onLogUpdate: (callback) =>
    ipcRenderer.on('log-update', (_, message) => callback(message)),

  // child crashed event
  onChildCrashed: (callback) =>
    ipcRenderer.on('child-crashed', (_, info) => callback(info)),
});
