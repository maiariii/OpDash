const { exec } = require('child_process');

const PORT = 3000;
const isWin = process.platform === "win32";

console.log(`Attempting to kill process on port ${PORT}...`);

if (isWin) {
    exec(`netstat -ano | findstr :${PORT}`, (err, stdout, stderr) => {
        if (err || !stdout) {
            console.log(`Port ${PORT} seems free or no matching process found.`);
            return;
        }

        const lines = stdout.trim().split('\n');
        const pids = new Set();

        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid) && pid !== '0') {
                pids.add(pid);
            }
        });

        if (pids.size === 0) {
            console.log(`No valid PIDs found for port ${PORT}.`);
            return;
        }

        pids.forEach(pid => {
            exec(`taskkill /PID ${pid} /F`, (err, stdout, stderr) => {
                if (err) {
                    console.error(`Failed to kill PID ${pid}: ${err.message}`);
                } else {
                    console.log(`Successfully killed process ${pid} on port ${PORT}.`);
                }
            });
        });
    });
} else {
    // Linux/Mac
    exec(`lsof -i :${PORT} -t`, (err, stdout, stderr) => {
        if (err || !stdout) {
            console.log(`Port ${PORT} seems free.`);
            return;
        }

        const pids = stdout.trim().split('\n');
        pids.forEach(pid => {
            if (pid) {
                exec(`kill -9 ${pid}`, (err) => {
                    if (err) console.error(`Failed to kill PID ${pid}`);
                    else console.log(`Killed process ${pid} on port ${PORT}`);
                });
            }
        });
    });
}
