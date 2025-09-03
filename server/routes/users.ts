import { Router } from 'express';
import { db } from '../db';
import { users, insertUserSchema, updateUserSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateToken, requireAdmin, requireManagerOrAdmin, AuthenticatedRequest } from '../middleware/auth';
import { hashPassword, validatePasswordStrength } from '../services/auth/password-utils';
import { storage } from '../storage';
import { tenantMiddleware, type TenantRequest } from '../tenant';

const router = Router();

// Apply tenant middleware to all user routes
router.use(tenantMiddleware);

/**
 * GET /api/users
 * Get all users (admin and managers only)
 */
router.get('/', authenticateToken, requireManagerOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const users = await storage.getUsers(100); // Get up to 100 users
    
    // Remove passwords from response
    const safeUsers = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json({
      users: safeUsers,
      total: safeUsers.length,
      message: 'Users retrieved successfully'
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve users'
    });
  }
});

/**
 * GET /api/users/:id
 * Get specific user by ID (admin, managers, or own profile)
 */
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    
    if (!currentUser) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }
    
    // Users can only view their own profile unless they're admin/manager
    if (currentUser.id !== id && !['admin', 'manager'].includes(currentUser.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You can only view your own profile'
      });
    }
    
    const user = await storage.getUser(id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    res.json({
      user: userWithoutPassword,
      message: 'User retrieved successfully'
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve user'
    });
  }
});

/**
 * POST /api/users
 * Create new user (admin only)
 */
router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const userData = insertUserSchema.parse(req.body);
    const currentUser = req.user;
    
    if (!currentUser) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(userData.password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password validation failed',
        details: passwordValidation.errors
      });
    }

    // Check if username already exists
    const existingUser = await storage.getUserByUsername(userData.username);
    if (existingUser) {
      return res.status(409).json({
        error: 'Username already exists',
        message: 'Please choose a different username'
      });
    }

    // Hash the password
    const hashedPassword = await hashPassword(userData.password);

    // Create user with admin's client ID
    const newUser = await storage.createUser({
      ...userData,
      password: hashedPassword,
      clientId: currentUser.clientId // Inherit client from admin
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = newUser;

    res.status(201).json({
      user: userWithoutPassword,
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create user'
    });
  }
});

/**
 * PUT /api/users/:id
 * Update user information (admin, managers for others, users for own profile)
 */
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    
    if (!currentUser) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    const userData = updateUserSchema.parse(req.body);
    
    // Check if user exists
    const existingUser = await storage.getUser(id);
    if (!existingUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Permission checks
    const canEdit = currentUser.id === id || ['admin', 'manager'].includes(currentUser.role);
    if (!canEdit) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You can only edit your own profile'
      });
    }

    // Only admins can change roles
    if (userData.role && currentUser.role !== 'admin') {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Only administrators can change user roles'
      });
    }

    // If username is being changed, check for conflicts
    if (userData.username && userData.username !== existingUser.username) {
      const conflictUser = await storage.getUserByUsername(userData.username);
      if (conflictUser && conflictUser.id !== id) {
        return res.status(409).json({
          error: 'Username already exists',
          message: 'Please choose a different username'
        });
      }
    }

    // Update user
    const [updatedUser] = await db.update(users)
      .set({ ...userData })
      .where(eq(users.id, id))
      .returning();

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;

    res.json({
      user: userWithoutPassword,
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user'
    });
  }
});

/**
 * PUT /api/users/:id/role
 * Update user role (admin only)
 */
router.put('/:id/role', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'manager', 'user'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be admin, manager, or user'
      });
    }

    const updatedUser = await storage.updateUserRole(id, role);
    
    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;
    
    res.json({
      user: userWithoutPassword,
      message: 'User role updated successfully'
    });

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user role'
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (admin only, cannot delete self)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    
    if (!currentUser) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    // Prevent self-deletion
    if (currentUser.id === id) {
      return res.status(400).json({
        error: 'Cannot delete self',
        message: 'You cannot delete your own account'
      });
    }

    // Check if user exists
    const existingUser = await storage.getUser(id);
    if (!existingUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Delete user
    await db.delete(users).where(eq(users.id, id));

    res.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete user'
    });
  }
});

export default router;