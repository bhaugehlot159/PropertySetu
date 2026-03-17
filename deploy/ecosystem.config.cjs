module.exports = {
  apps: [
    {
      name: 'propertysetu-app',
      cwd: process.env.APP_DIR || '/var/www/propertysetu',
      script: 'server/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: Number(process.env.APP_PORT || 5000),
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: Number(process.env.APP_PORT || 5000),
      },
    },
  ],
};
