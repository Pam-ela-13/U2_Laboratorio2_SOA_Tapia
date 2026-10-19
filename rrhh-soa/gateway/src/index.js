require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const winston   = require('winston');
const auth      = require('./middlewares/auth');

const app = express();
app.use(express.json());

const logger = winston.createLogger({
  transports: [new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message }) =>
        `[${timestamp}] ${level}: ${message}`)
    )
  })]
});

app.use(rateLimit({
  windowMs: 60_000, max: 100,
  message: { error: 'Demasiadas peticiones, intenta en 1 minuto.' }
}));

app.use((req, _, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.use('/auth/login', require('./routes/auth'));

const proxyOpts = (target, name) => ({
  target,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      logger.error(`[${name}] ${err.message}`);
      res.status(503).json({
        error: `Servicio ${name} no disponible`,
        detalle: err.message
      });
    }
  }
});

app.use('/api/empleados',
  auth,
  createProxyMiddleware(proxyOpts(
    process.env.EMPLEADOS_URL || 'http://localhost:3001',
    'Empleados'
  ))
);

app.use('/api/nomina',
  auth,
  createProxyMiddleware(proxyOpts(
    process.env.NOMINA_URL || 'http://localhost:3002',
    'Nomina'
  ))
);

app.use('/api/reclutamiento',
  auth,
  createProxyMiddleware(proxyOpts(
    process.env.RECLUTAMIENTO_URL || 'http://localhost:3003',
    'Reclutamiento'
  ))
);

app.get('/health', (_, res) => res.json({
  status: 'ok',
  servicios: {
    empleados:     process.env.EMPLEADOS_URL     || 'http://localhost:3001',
    nomina:        process.env.NOMINA_URL        || 'http://localhost:3002',
    reclutamiento: process.env.RECLUTAMIENTO_URL || 'http://localhost:3003',
  }
}));

app.use((req, res) =>
  res.status(404).json({ error: `Ruta ${req.url} no encontrada` })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  logger.info(`Gateway corriendo en http://localhost:${PORT}`)
);