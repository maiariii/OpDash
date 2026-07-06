const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REMOTE_USER  = "Administrator1";
const REMOTE_HOST  = "20.24.58.49";
const REMOTE_ROOT  = "/var/www/html/opdash";
const SSH_KEY_PATH = path.join(process.env.USERPROFILE || process.env.HOME || '', '.ssh/id_rsa');
const ARCHIVE_NAME = "opdash-deploy.tar.gz";
const ECOSYSTEM_CONFIG = "ecosystem.opdash.config.cjs";
const PM2_NAME     = "opdash-backend";

function runLocal(cmd, cwd) {
    console.log(`Executing: ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit', cwd, env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" } });
    } catch (err) {
        console.error(`Error executing command: ${cmd}`, err);
        process.exit(1);
    }
}

function main() {
    console.log("\n============================================================");
    console.log("[DEPLOY] OPDASH: DEPLOYMENT VIA NODE.JS (v1.0)");
    console.log("============================================================\n");

    // 1. Build frontend
    console.log("[1/5] Building client frontend...");
    runLocal("npm run build", "client");

    // 2. Archive files using system tar
    console.log(`[2/5] Archiving deployment payload -> ${ARCHIVE_NAME}...`);
    const filesToInclude = ["api", "client/dist", "package.json", "package-lock.json", ECOSYSTEM_CONFIG, ".env", "db.json"];
    
    // Remove old archive if exists
    if (fs.existsSync(ARCHIVE_NAME)) {
        fs.unlinkSync(ARCHIVE_NAME);
    }
    
    // Run system tar
    runLocal(`tar -czf ${ARCHIVE_NAME} ${filesToInclude.join(' ')}`);

    // 3. Upload archive
    console.log(`[3/5] Uploading archive to ${REMOTE_HOST} inside ${REMOTE_ROOT}...`);
    const sshKeyOption = fs.existsSync(SSH_KEY_PATH) ? `-i "${SSH_KEY_PATH}"` : '';
    
    // Ensure remote directory exists
    const mkdirCmd = `ssh ${sshKeyOption} -o ConnectTimeout=10 ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_ROOT}"`;
    runLocal(mkdirCmd);
    
    // Copy file
    const scpCmd = `scp ${sshKeyOption} ${ARCHIVE_NAME} ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_ROOT}/`;
    runLocal(scpCmd);

    // 4. Remote execution
    console.log("[4/5] Remote extraction, production install, and PM2 reset...");
    const remoteScript = [
        `mkdir -p ${REMOTE_ROOT}/logs`,
        `cd ${REMOTE_ROOT}`,
        `tar -xzf ${ARCHIVE_NAME}`,
        `rm -rf assets index.html sw.js favicon.png manifest.json`,
        `mv client/dist/* .`,
        `rm -rf client`,
        `sudo chown -R ${REMOTE_USER}:${REMOTE_USER} ${REMOTE_ROOT}`,
        `sed -i 's/20.24.58.49:6432/stride-posgre-prod-01.postgres.database.azure.com:5432/g' .env`,
        `echo "       → Running production npm install..."`,
        `npm install --omit=dev --legacy-peer-deps --prefer-offline --no-audit --no-fund 2>&1 | tail -n 10`,
        `pm2 flush ${PM2_NAME}`,
        `pm2 delete ${PM2_NAME} 2>/dev/null || true`,
        `pm2 start ${ECOSYSTEM_CONFIG}`,
        `rm ${ARCHIVE_NAME}`
    ].join(' && ');

    const sshExecuteCmd = `ssh -t ${sshKeyOption} -o ConnectTimeout=10 ${REMOTE_USER}@${REMOTE_HOST} "${remoteScript}"`;
    runLocal(sshExecuteCmd);

    console.log("\n============================================================");
    console.log("[DEPLOY] SUCCESSFUL!");
    console.log("============================================================\n");
}

main();
