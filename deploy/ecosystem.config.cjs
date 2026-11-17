// PM2 di VPS: backend (port 3110) dan web admin (port 3111). Nginx meneruskan domain ke keduanya.
const APP_DIR = '/var/www/hris-app';

module.exports = {
  apps: [
    {
      name: 'hris-app-api',
      cwd: `${APP_DIR}/backend`,
      script: 'dist/main.js',
      env: { NODE_ENV: 'production', PORT: 3110 },
      max_memory_restart: '600M',
    },
    {
      name: 'hris-app-web',
      cwd: `${APP_DIR}/web-admin`,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3111 -H 127.0.0.1',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
    },
  ],
};
