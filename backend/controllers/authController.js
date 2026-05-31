// backend/controllers/authController.js
// User authentication (register, login)

const bcryptjs = require('bcryptjs');
const pino = require('pino');
const { prisma } = require('../db/client');
const { generateToken } = require('../utils/jwt');

const logger = pino();

/**
 * Register new user
 */
async function register(req, res) {
  const { email, password, username } = req.body;

  try {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email ? 'Email already registered' : 'Username already taken',
      });
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        displayName: username,
      },
    });

    // Create portfolio
    await prisma.portfolio.create({
      data: {
        userId: user.id,
        cashBalance: 100000, // ₹100,000 paper trading
      },
    });

    // Generate token
    const token = generateToken(user.id, user.email);

    logger.info({ userId: user.id, email }, 'User registered');

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Registration failed');
    return res.status(500).json({ error: 'Registration failed' });
  }
}

/**
 * Login user
 */
async function login(req, res) {
  const { email, password } = req.body;

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate token
    const token = generateToken(user.id, user.email);

    logger.info({ userId: user.id, email }, 'User logged in');

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Login failed');
    return res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * Get current user profile
 */
async function getProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        portfolios: {
          select: {
            id: true,
            cashBalance: true,
            totalValue: true,
            totalGainLoss: true,
            accountType: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        portfolios: user.portfolios,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Get profile failed');
    return res.status(500).json({ error: 'Failed to get profile' });
  }
}

module.exports = {
  register,
  login,
  getProfile,
};
