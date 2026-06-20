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
    }
  ]
};
