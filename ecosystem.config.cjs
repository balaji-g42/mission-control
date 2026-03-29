module.exports = {
  apps: [
    {
      name: 'mission-control',
      cwd: __dirname,
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '4000'
      },
      // PM2 settings
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
