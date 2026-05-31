// backend/middleware/auth.js
// JWT authentication middleware

const pino = require('pino');
const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');

const logger = pino();

/**
 * Middleware: Verify JWT token and attach user to request
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    return res.status(401).json({ error: 'Invalid authorization header format' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // Attach user info to request
    next();
  } catch (error) {
    logger.warn({ error: error.message }, 'JWT verification failed');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: Optional authentication (doesn't fail if missing)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = extractTokenFromHeader(authHeader);
    if (token) {
      try {
        const decoded = verifyToken(token);
        req.user = decoded;
      } catch (error) {
        logger.warn({ error: error.message }, 'Optional JWT verification failed, continuing as anonymous');
      }
    }
  }

  next();
}

module.exports = {
  authenticateJWT,
  optionalAuth,
};
