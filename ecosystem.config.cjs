module.exports = {
  apps: [
    {
      name: 'exams',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'exams-tunnel',
      script: 'cloudflared',
      args: 'tunnel run --token eyJhIjoiZWQzYTVjYmY4YjBmMGMwYTk4ZGFhY2E3OTg0MGQwZjkiLCJ0IjoiZjFmYjJkZmMtYmNhMS00ZjgzLWJmM2YtMTAxY2MyMjQ5ZTcwIiwicyI6IllUVXlNREl3WVdFdFl6a3lOeTAwTVdZNExXRTRaRGt0TmpJMk5URmlaVGRrWlRoaSJ9',
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
