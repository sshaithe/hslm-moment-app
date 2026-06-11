module.exports = {
  apps: [{
    name: 'vowvault-server',
    script: './dist/server.js',
    instances: 2,        // Start conservative with 2 instances, can increase to 3 if needed
    exec_mode: 'cluster',
    watch: false,
    autorestart: true,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file:   './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
