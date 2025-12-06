module.exports = {
  apps: [
    {
      name: 'cola-space',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M'
    }
  ]
};
