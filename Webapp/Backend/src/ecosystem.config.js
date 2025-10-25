module.exports = {
    apps: [
        {
            name: 'erc20-indexer',
            script: './index.js',
            instances: 1,
            exec_mode: 'fork',

            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            max_memory_restart: '500M',

            output: './logs/out.log',
            error: './logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

            env: {
                NODE_ENV: 'production'
            },

            kill_timeout: 5000,
            listen_timeout: 3000,
            monitoring: true
        }
    ],

    deploy: {
        production: {
            user: 'node',
            host: 'your-server.com',
            ref: 'origin/main',
            repo: 'git@github.com:your-repo.git',
            path: '/var/www/erc20-indexer',
            'post-deploy': 'npm install && pm2 restart ecosystem.config.js --env production'
        }
    }
};