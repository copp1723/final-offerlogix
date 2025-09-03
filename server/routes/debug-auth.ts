import { Router } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Debug endpoint to check auth setup - REMOVE IN PRODUCTION
router.get('/debug-auth', async (req, res) => {
  try {
    // Check if users table exists and has admin
    const adminUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      clientId: users.clientId
    })
    .from(users)
    .where(eq(users.role, 'admin'));

    res.json({
      adminCount: adminUsers.length,
      admins: adminUsers,
      env: {
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: String(error)
    });
  }
});

export default router;