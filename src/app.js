const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

const corsOptions = {
  origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim()),
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Univora API',
    version: '1.0.0',
    docs: '/api/v1/health',
  });
});

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
