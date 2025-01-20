import fs from 'fs';
import readline from 'readline';
console.log('child.js');

/**
 *  Grab the file path from command-line arguments. Exit if missing.
 */
const filePath = process.argv[2];
if (!filePath) {
  console.error('No file path provided to child process.');
  process.exit(1);
}

/**
 * Add a heartbeat interval
 */
const heartbeatInterval = setInterval(() => {
  console.log('[ HEARTBEAT ]\n');
}, 5000);

/**
 *  Create a read stream and use readline to process the file line by line.
 */
const readStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

/**
 *  Helper function to simulate a short delay asynchronously (non-blocking).
 *    This ensures Node's event loop is not blocked, allowing signals (like SIGTERM) to be handled.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 *  On each line: check for "error", otherwise "process" it.
 *    Use async/await so we can await delay without blocking the entire thread.
 */
rl.on('line', async (line) => {
  rl.pause();
  processLine(line).then(() => {
    rl.resume();
  });
});

/**
 *  When the file is fully read, log success and exit with code 0.
 */
rl.on('close', () => {
  console.log('File processing complete.'.toUpperCase());
  // clear heartbeatInterval on normal exit
  clearInterval(heartbeatInterval);
  process.exit(0);
});

/**
 *  Handle SIGTERM for graceful shutdown.
 *    This is triggered when the parent calls childProcess.kill() (default signal = "SIGTERM").
 */
process.on('SIGTERM', () => {
  console.error('Received SIGTERM, stopping child process gracefully...');

  // Safely close the readline interface and file stream.
  if (rl) rl.close();
  if (readStream) readStream.destroy();

  // Exit with code 0 (success).
  process.exit(0);
});

async function processLine(line) {
  // If line contains "error", simulate a crash
  if (line.toLowerCase().includes('error')) {
    console.error(`[Simulated error on line]: "${line}"`);
    process.exit(1);
  }

  // Process the line (log it)
  console.log(`[Processed line]: ${line}`);

  // Delay 3 seconds
  await delay(3000);
}
