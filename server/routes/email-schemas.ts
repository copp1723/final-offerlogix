import { z } from 'zod';

export const emailSendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
  textContent: z.string().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
});

export const emailValidationSchema = z.object({
  emails: z.array(z.string().email()).min(1),
});

export const emailContentSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
});