import { db } from '../db';
import { clients } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface TenantEmailSettings {
  mailgunDomain?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface TenantSmsSettings {
  twilioPhoneNumber?: string;
}

export async function getTenantEmailSettingsByClientId(clientId?: string): Promise<TenantEmailSettings> {
  if (!clientId) return {};
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  const settings = (client?.settings || {}) as any;
  // Support both flat keys and nested objects for forward/backward compatibility
  return {
    mailgunDomain: settings.mailgunDomain ?? settings.email?.mailgunDomain,
    fromEmail: settings.mailgunFromEmail ?? settings.email?.fromEmail,
    fromName: settings.mailgunFromName ?? settings.email?.fromName,
  };
}

export async function getTenantSmsSettingsByClientId(clientId?: string): Promise<TenantSmsSettings> {
  if (!clientId) return {};
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  const settings = (client?.settings || {}) as any;
  return {
    twilioPhoneNumber: settings.twilioPhoneNumber ?? settings.sms?.twilioPhoneNumber,
  };
}

