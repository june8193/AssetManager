module.exports = {
  apps: [
    {
      name: "asset-manager-prod",
      script: "scripts/run_prod.py",
      interpreter: "uv",
      interpreter_args: "run python",
      cwd: "./",
      env: {
        APP_ENV: "production",
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      error_file: "backups/logs/pm2-err.log",
      out_file: "backups/logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "asset-manager-gh-runner",
      script: "actions-runner/run.sh",
      cwd: "./",
      autorestart: true,
      watch: false,
      error_file: "backups/logs/runner-err.log",
      out_file: "backups/logs/runner-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
