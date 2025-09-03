-- Create admin users for each Kunes dealership
-- Note: Passwords will need to be hashed. Use the MailMind user creation API or admin interface

-- You'll run these through the MailMind API or admin interface, not directly in SQL
-- This is a reference for the users you need to create

/*
POST /api/users (for each dealership)

Kunes Auto Group of Macomb:
{
  "username": "admin_macomb",
  "password": "SecurePassword123!",
  "email": "admin@kunesautomacomb.com", 
  "role": "admin",
  "clientId": "[CLIENT_ID_FROM_PREVIOUS_QUERY]"
}

Kunes Honda of Quincy:
{
  "username": "admin_honda_quincy",
  "password": "SecurePassword123!",
  "email": "admin@kuneshondaquincy.com",
  "role": "admin", 
  "clientId": "[CLIENT_ID_FROM_PREVIOUS_QUERY]"
}

Kunes Hyundai of Quincy:
{
  "username": "admin_hyundai_quincy", 
  "password": "SecurePassword123!",
  "email": "admin@kuneshyundaiquincy.com",
  "role": "admin",
  "clientId": "[CLIENT_ID_FROM_PREVIOUS_QUERY]"
}

Kunes Ford of East Moline:
{
  "username": "admin_ford_eastmoline",
  "password": "SecurePassword123!",
  "email": "admin@kunesfordeastmoline.com", 
  "role": "admin",
  "clientId": "[CLIENT_ID_FROM_PREVIOUS_QUERY]"
}

Kunes Nissan of Davenport:
{
  "username": "admin_nissan_davenport",
  "password": "SecurePassword123!",
  "email": "admin@kunesnissandavenport.com",
  "role": "admin",
  "clientId": "[CLIENT_ID_FROM_PREVIOUS_QUERY]"
}

Kunes Toyota of Galesburg:
{
  "username": "admin_toyota_galesburg",
  "password": "SecurePassword123!", 
  "email": "admin@kunestoyotagalesburg.com",
  "role": "admin",
  "clientId": "[CLIENT_ID_FROM_PREVIOUS_QUERY]"
}
*/

-- Alternative: Use the create-admin-user script for each dealership
-- node server/scripts/create-admin-user.ts --username admin_macomb --password SecurePassword123! --email admin@kunesautomacomb.com --client-id [CLIENT_ID]