const app = require('./app');
const env = require('./config/env');

const startServer = async () => {
  const server = app.listen(env.port, () => {
    console.log(`Univora API running in ${env.nodeEnv} mode on port ${env.port}`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
