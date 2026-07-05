// PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.cjs
// Note: .cjs extension is required so PM2 can load this as CommonJS
//       even though the project uses "type": "module"

module.exports = {
  apps: [
    {
      name         : 'tcy-yard-bot',
      script       : 'bot.js',
      interpreter  : 'node',
      watch        : false,
      autorestart  : true,
      max_restarts : 10,
      restart_delay: 5000,
      env          : { NODE_ENV: 'production' },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file   : './logs/bot-err.log',
      out_file     : './logs/bot-out.log',
      merge_logs   : true,
    },
    {
      name         : 'tcy-dashboard',
      script       : 'dashboard.js',
      interpreter  : 'node',
      watch        : false,
      autorestart  : true,
      max_restarts : 10,
      restart_delay: 5000,
      env          : { NODE_ENV: 'production' },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file   : './logs/dash-err.log',
      out_file     : './logs/dash-out.log',
      merge_logs   : true,
    },
  ],
};
