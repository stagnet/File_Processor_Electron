const chooseFileBtn = document.getElementById('choose-file-btn');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const logWindow = document.getElementById('log-window');
console.log('renderer');

let selectedFilePath = '';

// 1) Ask the main process to open the file dialog
chooseFileBtn.addEventListener('click', () => {
  window.electronAPI.openFileDialog();
});

// 2) Listen for the chosen file path
window.electronAPI.onFileChosen((filePath) => {
  selectedFilePath = filePath;
  console.log('User chose file:', selectedFilePath);
  appendLog(`Selected: ${selectedFilePath}`);
});

// 3) Start processing
startButton.addEventListener('click', () => {
  if (!selectedFilePath) {
    appendLog('Please choose a file first.');
    return;
  }
  window.electronAPI.startProcessing(selectedFilePath);
});

// 4) Stop processing
stopButton.addEventListener('click', () => {
  window.electronAPI.stopProcessing();
});

// 5) Listen for log updates from main process
window.electronAPI.onLogUpdate((message) => {
  appendLog(message);
});

// 6) Listen for "child-crashed" event
window.electronAPI.onChildCrashed((info) => {
  const { code, signal, lastFilePath } = info;
  appendLog(
    `[Child crashed]: code=${code},  signal=${signal}. File was: ${lastFilePath}`
  );

  // ask use to restart
  const restart = confirm(
    `Child process crashed (code = ${code}), Would you like to restart ?`
  );

  if (restart) {
    window.electronAPI.restartProcessing();
  }
});

// Helper function to append logs to the log window
function appendLog(msg) {
  const logEntry = document.createElement('div');
  logEntry.innerText = msg;
  logWindow.appendChild(logEntry);
  logWindow.scrollTop = logWindow.scrollHeight;
}
