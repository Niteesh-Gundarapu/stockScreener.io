// backend/middleware/security.js
// Production-grade security middleware

const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const pino = require('pino');

const logger = pino();

/**
 * CORS Whitelist - Only allow trusted origins
 */
const corsOptions = {
  origin: function (origin, callback) {
    const whitelist = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3000', // dev
      'http://localhost:5173', // vite default
    ];

    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin }, 'CORS request rejected from untrusted origin');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

/**
 * Global Rate Limiter (all endpoints)
 */
const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

/**
 * Strict Rate Limiter for trading endpoints
 */
const tradingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 trades per minute per user
  message: 'Too many trading requests',
  keyGenerator: (req) => {
    // Rate limit by userId, not IP (per-user limit)
    return req.body?.userId || req.query?.userId || req.ip;
  },
});

/**
 * Input Validation Schemas (Joi)
 */
const validationSchemas = {
  // Trading
  buyTrade: Joi.object({
    userId: Joi.string().required(),
    ticker: Joi.string().uppercase().regex(/^[A-Z0-9.]{1,10}$/).required(),
    quantity: Joi.number().integer().min(1).max(1000000).required(),
    currentPrice: Joi.number().positive().required(),
  }),

  sellTrade: Joi.object({
    userId: Joi.string().required(),
    ticker: Joi.string().uppercase().regex(/^[A-Z0-9.]{1,10}$/).required(),
    quantity: Joi.number().integer().min(1).max(1000000).required(),
    currentPrice: Joi.number().positive().required(),
  }),

  priceAlert: Joi.object({
    userId: Joi.string().required(),
    ticker: Joi.string().uppercase().regex(/^[A-Z0-9.]{1,10}$/).required(),
    alertType: Joi.string().valid('ABOVE', 'BELOW').required(),
    targetPrice: Joi.number().positive().required(),
  }),

  createPortfolio: Joi.object({
    userId: Joi.string().required(),
    username: Joi.string().min(3).max(50).required(),
  }),

  // Auth (future)
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};

/**
 * Middleware: Validate request body against schema
 */
function validateRequest(schemaKey) {
  return (req, res, next) => {
    const schema = validationSchemas[schemaKey];
    if (!schema) {
      logger.error({ schemaKey }, 'Validation schema not found');
      return res.status(500).json({ error: 'Server validation error' });
    }

    const { error, value } = schema.validate(req.body);
    if (error) {
      logger.warn({ error: error.details }, 'Validation failed');
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((d) => d.message),
      });
    }

    // Replace req.body with validated value
    req.body = value;
    next();
  };
}

/**
 * Middleware: Log requests to audit trail
 */
function auditLog(req, res, next) {
  const originalSend = res.send;

  res.send = function (data) {
    const logEntry = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.body?.userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    };

    if (res.statusCode >= 400) {
      logger.warn(logEntry, 'Request failed');
    } else if (['/api/portfolio/buy', '/api/portfolio/sell'].includes(req.path)) {
      logger.info(logEntry, 'Trade executed');
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Error handler for validation/rate limit errors
 */
function errorHandler(err, req, res, next) {
  logger.error({ error: err.message, path: req.path }, 'Middleware error');

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = {
  corsOptions,
  globalRateLimiter,
  tradingRateLimiter,
  validateRequest,
  auditLog,
  errorHandler,
};
