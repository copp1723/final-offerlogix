/**
 * Create Initial Admin User Script
 * Run this to create the first admin user for the MailMind system
 */

import dotenv from 'dotenv';
dotenv.config();

import { db } from '../db';
import { users, clients } from '@shared/schema';
import { hashPassword } from '../services/auth/password-utils';
import { eq } from 'drizzle-orm';

async function createAdminUser() {
  try {
    console.log('🔧 Creating initial admin user...');

    // Check if any admin users already exist
    const existingAdmins = await db.select()
      .from(users)
      .where(eq(users.role, 'admin'));

    if (existingAdmins.length > 0) {
      console.log('✅ Admin user already exists:');
      existingAdmins.forEach(admin => {
        console.log(`   - ${admin.username} (${admin.email || 'no email'})`);
      });
      return;
    }

    // Get or create default client
    let [defaultClient] = await db.select()
      .from(clients)
      .where(eq(clients.name, 'Default Client'));

    if (!defaultClient) {
      console.log('📦 Creating default client...');
      [defaultClient] = await db.insert(clients).values({
        name: 'Default Client',
        domain: 'localhost',
        brandingConfig: {
          primaryColor: '#2563eb',
          secondaryColor: '#1e40af',
          logoUrl: '',
          companyName: 'MailMind',
          favicon: '',
          customCss: ''
        },
        settings: {
          maxUsers: 100,
          maxCampaigns: 1000,
          allowRegistration: false
        }
      }).returning();
      
      console.log(`✅ Default client created: ${defaultClient.id}`);
    }

    // Create admin user
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'MailMind2024!';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mailmind.com';

    console.log(`👤 Creating admin user: ${adminUsername}`);
    
    // Hash the password
    const hashedPassword = await hashPassword(adminPassword);

    // Create the admin user
    const [adminUser] = await db.insert(users).values({
      username: adminUsername,
      password: hashedPassword,
      email: adminEmail,
      role: 'admin',
      clientId: defaultClient.id,
      notificationPreferences: {
        emailNotifications: true,
        campaignAlerts: true,
        leadAlerts: true,
        systemAlerts: true,
        monthlyReports: true,
        highEngagementAlerts: true,
        quotaWarnings: true
      }
    }).returning();

    console.log('✅ Admin user created successfully!');
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   User ID: ${adminUser.id}`);
    
    console.log('\n🔑 Login credentials:');
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');

  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createAdminUser()
    .then(() => {
      console.log('\n🎉 Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

export { createAdminUser };