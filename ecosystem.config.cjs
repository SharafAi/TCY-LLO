// PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.cjs
// Note: .cjs extension is required so PM2 can load this as CommonJS
//       even though the project uses "type": "module"

module.exports = {
  apps: [
    {
      name        : 'tcy-yard-bot',
      script      : 'bot.js',
      interpreter : 'node',
      watch       : false,
      autorestart : true,
      max_restarts: 10,
      restart_delay: 5000,       // wait 5 s before restarting after a crash
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file  : './logs/err.log',
      out_file    : './logs/out.log',
      merge_logs  : true,
    },
  ],
};
