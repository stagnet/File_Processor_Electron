// main.js
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('main.js');

let mainWindow = null;
let childProcess = null;
let healthInterval = null;
let lastHeartbeatTime = null;
let lastFilePath = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (childProcess) {
    childProcess.kill(); // child listens for SIGTERM
    childProcess = null;
  }
  if (healthInterval) {
    clearInterval(healthInterval);
  }
  if (process.platform !== 'darwin') app.quit();
});

// ===================== IPC Listeners ====================== //

// (A) Start Processing
ipcMain.on('start-processing', (event, filePath) => {
  startChild(filePath);
});

// (B) Stop Processing
ipcMain.on('stop-processing', () => {
  console.log('[DEBUG: Received stop-processing]');

  if (childProcess) {
    childProcess.kill(); // Send SIGTERM by default
    console.log('[DEBUG: called childProcess.kill]');

    mainWindow.webContents.send(
      'log-update',
      'CHILD PROCESS WAS STOPPED BY USER.'
    );
    childProcess = null;
  }
});

// (C) Open File Dialog
ipcMain.on('open-file-dialog', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Text & CSV files', extensions: ['text', 'csv'] }],
  });
  if (!canceled && filePaths && filePaths.length > 0) {
    event.sender.send('file-chosen', filePaths[0]);
  }
});

// (D) restart-process listener from the renderer
ipcMain.on('restart-processing', () => {
  if (!lastFilePath) {
    mainWindow.webContents.send(
      'log-update',
      'No previous file found to restart.'
    );
    return;
  }
  mainWindow.webContents.send('log-update', 'Restarting the process...');
  startChild(lastFilePath);
});

// extract the child spawn logic to re-use in different IPCs
function startChild(filePath) {
  if (childProcess) {
    mainWindow.webContents.send('log-update', 'A process is already running!');
    return;
  }
  if (!filePath) {
    mainWindow.webContents.send('log-update', 'No file specified.');
    return;
  }
  lastFilePath = filePath;

  childProcess = spawn(
    // Use Node's own executable
    process.execPath,
    [path.join(__dirname, 'child.js'), filePath],
    { cwd: __dirname }
  );

  lastHeartbeatTime = Date.now();
  startHealthCheck();

  // stdout
  childProcess.stdout.on('data', (data) => {
    const text = data.toString();
    // check for heartBeat
    if (text.includes('HEARTBEAT')) {
      lastHeartbeatTime = Date.now(); //child is alive
    } else {
      //otherwise, it's a normal log
      mainWindow.webContents.send('log-update', text);
    }
    mainWindow.webContents.send('log-update', data.toString());
  });

  //  stderr
  childProcess.stderr.on('data', (data) => {
    mainWindow.webContents.send('log-update', `ERROR: ${data.toString()}`);
  });

  // On exit
  childProcess.on('exit', (code, signal) => {
    clearHealthCheckInterval();
    if (code === 0) {
      mainWindow.webContents.send(
        'log-update',
        'CHILD PROCESS FINISHED SUCCESSFULLY.'
      );
    } else {
      mainWindow.webContents.send(
        'log-update',
        `Child process exited with code ${code}, signal ${signal}.`
      );

      // send an IPC event to let the renderer optionally restart
      mainWindow.webContents.send('child-crashed', {
        code,
        signal,
        lastFilePath,
      });
    }
    childProcess = null;
  });

  mainWindow.webContents.send('log-update', 'Child process started...');
}

// check if child is still sending heartbeats.
function startHealthCheck() {
  // clear a existing interval, before starting a new one
  clearHealthCheckInterval();

  healthInterval = setInterval(() => {
    if (!childProcess) {
      //child is no longer running, so no need to check
      clearHealthCheckInterval();
      return;
    }
    const now = Date.now();
    // here we are checking if last heartbeat hasn't logged in last 15 seconds, we forcibly kill it.
    if (now - lastHeartbeatTime > 15000) {
      mainWindow.webContents.send(
        'log-update',
        'Child Process is unresponsive for > 15, Forcing termination...'
      );
      childProcess.kill('SIGKILL');
      childProcess = null;

      // clear interval
      clearHealthCheckInterval();
    }
  });
}

function clearHealthCheckInterval() {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
}
