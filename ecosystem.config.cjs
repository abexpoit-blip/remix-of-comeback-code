// 8 fork-mode instances behind nginx least_conn (ports 4000..4007)
// Env is loaded from /opt/sleepox-app-new/.env via --env-file on the node interpreter.
module.exports = {
  apps: Array.from({ length: 8 }, (_, i) => ({
    name: `sleepox-${i}`,
    cwd: "/opt/sleepox-app-new",
    script: ".output/server/index.mjs",
    interpreter: "node",
    interpreter_args: "--env-file=/opt/sleepox-app-new/.env --import=/opt/sleepox-app-new/scripts/uri-guard.mjs",
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "1536M",
    watch: false,
    autorestart: true,
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: "10s",
    // Give workers up to 15s to flush in-memory click batch queue before SIGKILL.
    // Without this, every `pm2 stop` drops ~100 queued clicks (real data loss).
    kill_timeout: 15000,

    env: {
      PORT: String(4000 + i),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      INSTANCE_ID: String(i),
    },
  })),
};
