module.exports = {
  apps: [
    {
      name: 'opdash-backend',
      script: 'api/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      node_args: '--max-old-space-size=4096',
      error_file: '/var/www/html/opdash/logs/error.log',
      out_file: '/var/www/html/opdash/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
};
