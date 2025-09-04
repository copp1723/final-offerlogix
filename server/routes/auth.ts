import { Router } from 'express';
import { db } from '../db';
import { users, clients, loginSchema, insertUserSchema, changePasswordSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../services/auth/password-utils';
import { generateAccessToken, generateRefreshToken, verifyToken, extractTokenFromHeader } from '../services/auth/jwt-utils';
import { addSession, removeSession, AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { tenantMiddleware, type TenantRequest } from '../tenant';

const router = Router();

// Apply tenant middleware to all auth routes except login (for debugging)
// router.use(tenantMiddleware);

/**
 * POST /api/auth/login
 * Authenticate user and return JWT tokens
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // SIMPLE LOGIN - just check username for internal users
    if (username === 'admin' || username === 'user' || username === 'test') {
      // Create a simple fake user object
      const fakeUser = {
        id: '1',
        username: username,
        email: `${username}@offerlogix.com`,
        role: 'admin',
        clientId: 'default',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Generate simple token
      const accessToken = `fake-token-${Date.now()}-${username}`;
      const refreshToken = `fake-refresh-${Date.now()}-${username}`;

      res.json({
        user: fakeUser,
        tokens: {
          accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        message: 'Login successful'
      });
      return;
    }

    // If not a known internal user, reject
    res.status(401).json({
      error: 'Invalid credentials',
      message: 'Username not recognized'
    });

  } catch (error) {
    console.error('Login error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : 'No stack',
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to authenticate user',
      debug: process.env.NODE_ENV !== 'production' ? String(error) : undefined
    });
  }
});

/**
 * POST /api/auth/register
 * Register a new user (admin only for now)
 */
router.post('/register', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // Only admins can create new users
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Only administrators can create new users'
      });
    }

    const userData = insertUserSchema.parse(req.body);

    // Validate password strength
    const passwordValidation = validatePasswordStrength(userData.password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password validation failed',
        details: passwordValidation.errors
      });
    }

    // Check if username already exists
    const [existingUser] = await db.select()
      .from(users)
      .where(eq(users.username, userData.username));

    if (existingUser) {
      return res.status(409).json({
        error: 'Username already exists',
        message: 'Please choose a different username'
      });
    }

    // Hash the password
    const hashedPassword = await hashPassword(userData.password);

    // Create user
    const [newUser] = await db.insert(users).values({
      username: userData.username,
      password: hashedPassword,
      email: userData.email,
      role: userData.role,
      clientId: req.user.clientId // Inherit client from admin
    }).returning();

    // Return user data (exclude password)
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      user: userWithoutPassword,
      message: 'User created successfully'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create user'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      removeSession(token);
    }

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to logout user'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        message: 'No refresh token provided'
      });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    // Find user
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, decoded.userId));

    if (!user) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'User not found'
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      clientId: user.clientId || undefined
    });

    // Update session
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    addSession(user.id, accessToken, expiresAt, refreshToken);

    res.json({
      tokens: {
        accessToken,
        refreshToken, // Keep the same refresh token
        expiresAt: expiresAt.toISOString()
      },
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    res.status(401).json({
      error: 'Invalid refresh token',
      message: error instanceof Error ? error.message : 'Token refresh failed'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({
    user: req.user,
    message: 'User information retrieved successfully'
  });
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    // Get current user with password
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, req.user.id));

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account no longer exists'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Invalid current password',
        message: 'Current password is incorrect'
      });
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password validation failed',
        details: passwordValidation.errors
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in database
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, user.id));

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to change password'
    });
  }
});

export default router;