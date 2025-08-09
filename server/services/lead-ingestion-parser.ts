/**
 * Lead Ingestion Parser - Extract lead data from various email formats
 * Handles OEM forms, Cars.com/Autotrader leads, website contact forms
 */

// ---- Reliability & Sanitization Knobs ----
const MAX_CONTENT_CHARS = Number(process.env.LEAD_PARSE_MAX_CONTENT ?? 200_000); // cap input size
const MAX_FIELD_CHARS = Number(process.env.LEAD_PARSE_MAX_FIELD ?? 200); // cap any single field

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_HINT_REGEX = /(?:phone|tel|mobile|cell)[:\s-]*(\+?\d[\d\s().-]{7,}\d)/i;
const PHONE_FALLBACK_REGEX = /(\+?\d{1,3}[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
function clamp(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  const t = s.toString().trim();
  return t.length > MAX_FIELD_CHARS ? t.slice(0, MAX_FIELD_CHARS) : t;
}
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
function toTitleCaseName(s?: string): { first?: string; last?: string } {
  if (!s) return {};
  const cleaned = s.replace(/<.*?>/g, '').replace(/\d+/g, '').replace(/[<>]/g, '').trim();
  if (!cleaned) return {};
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
  const tc = (x?: string) => x ? x.replace(/\b([a-z])(\w*)/gi, (_, a, rest) => a.toUpperCase() + rest.toLowerCase()) : undefined;
  return { first: tc(first), last: tc(last) };
}
function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return undefined;
  // Keep last 10-11 digits to handle leading country code
  const trimmed = digits.length > 11 ? digits.slice(-10) : digits;
  return trimmed.length === 11 ? trimmed : trimmed.slice(-10);
}

export interface ParsedLeadData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  vehicleInterest?: string;
  leadSource?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export function parseLeadEmail({ 
  subject, 
  html, 
  text, 
  from 
}: {
  subject: string; 
  html?: string; 
  text?: string; 
  from: string;
}): ParsedLeadData {
  const raw = (text && text.length > 0 ? text : (html || ''));
  const clipped = raw.length > MAX_CONTENT_CHARS ? raw.slice(0, MAX_CONTENT_CHARS) : raw;
  const content = decodeEntities(stripTags(clipped));
  const cleanContent = normalizeWhitespace(content);
  
  // Extract email - most critical field
  const foundEmail = cleanContent.match(EMAIL_REGEX)?.[0];
  const phoneMatch = cleanContent.match(PHONE_HINT_REGEX) || cleanContent.match(PHONE_FALLBACK_REGEX);
  const phone = normalizePhone(phoneMatch?.[1] || phoneMatch?.[0]);
  
  // Extract name patterns
  const namePatterns = [
    /(?:name|customer)[:\s-]+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i,
    /([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+<.*@.*>/,
    /from[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i
  ];
  
  let fullName = '';
  for (const pattern of namePatterns) {
    const match = cleanContent.match(pattern);
    if (match && match[1]) {
      fullName = match[1].trim();
      break;
    }
  }
  
  const { first: firstNameRaw, last: lastNameRaw } = toTitleCaseName(fullName);
  const firstName = clamp(firstNameRaw);
  const lastName = clamp(lastNameRaw);
  
  // Extract vehicle interest
  const vehiclePatterns = [
    /(?:vehicle|model|trim|interest|looking\s+for|interested\s+in)[:\s-]+(.{2,50})/i,
    /(?:make|brand)[:\s-]+(\w+)/i,
    /(F-?150|Silverado|RAM|Tacoma|Camry|Accord|Civic|Corolla|Prius|Model\s+[YSX3])/i
  ];
  
  let vehicleInterest = '';
  for (const pattern of vehiclePatterns) {
    const match = cleanContent.match(pattern);
    if (match && match[1]) {
      vehicleInterest = match[1].replace(/\s+/g, ' ').replace(/[\s,.;:]+$/, '').trim();
      break;
    }
  }
  vehicleInterest = clamp(vehicleInterest) || '';
  
  // Determine lead source from sender domain
  const senderDomain = from.split('@')[1]?.toLowerCase() || '';
  let leadSource = 'email_inbound';
  
  if (senderDomain.includes('cars.com')) leadSource = 'cars_com';
  else if (senderDomain.includes('autotrader')) leadSource = 'autotrader';
  else if (senderDomain.includes('kbb.com')) leadSource = 'kbb';
  else if (senderDomain.includes('cargurus')) leadSource = 'cargurus';
  else if (subject.toLowerCase().includes('website') || subject.toLowerCase().includes('contact')) {
    leadSource = 'website_form';
  }
  
  // Extract additional metadata
  const metadata: Record<string, any> = {
    originalSubject: clamp(subject),
    senderDomain,
    parsedAt: new Date().toISOString(),
    contentLength: cleanContent.length,
    hasHtml: Boolean(html && html.length),
    hasText: Boolean(text && text.length)
  };

  // Look for simple key:value lines (bounded)
  const formFields = cleanContent.match(/([A-Za-z][A-Za-z0-9_]{2,24})[:\s-]+([^\n\r]{1,100})/gi) || [];
  for (const field of formFields.slice(0, 10)) { // Limit to prevent bloat
    const m = field.match(/([A-Za-z][A-Za-z0-9_]{2,24})[:\s-]+([^\n\r]{1,100})/);
    if (!m) continue;
    const key = m[1]?.toLowerCase();
    const value = clamp(normalizeWhitespace(m[2] || ''));
    if (key && value && !(key in { originalsubject: 1, parsedat: 1, contentlength: 1 })) {
      metadata[key] = value;
    }
  }
  
  return {
    firstName,
    lastName,
    email: clamp(foundEmail || undefined),
    phone,
    vehicleInterest: vehicleInterest || undefined,
    leadSource,
    notes: clamp(subject && subject.length > 5 ? subject : undefined),
    metadata
  };
}

/**
 * Validate parsed lead data quality
 */
export function validateLeadData(data: ParsedLeadData): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!data.email) {
    issues.push('No email address found');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    issues.push('Invalid email format');
  }

  if (!data.firstName && !data.lastName) {
    issues.push('No name information found');
  }

  if (!data.phone && !data.vehicleInterest) {
    issues.push('No phone or vehicle interest - limited lead quality');
  }

  // Bound the number of surfaced issues
  const bounded = issues.slice(0, 5);
  return { valid: bounded.length === 0, issues: bounded };
}

/**
 * Check if email should be processed for lead ingestion
 */
export function shouldProcessForLeadIngestion(
  subject: string,
  from: string,
  to: string[] = []
): boolean {
  // Skip Mailgun domain emails - those go through webhook lane
  const mgDomains = [
    '@mg.onekeel.ai',
    '@mg.watchdogai.us', // Current domain
    'reply@',
    'noreply@'
  ];
  
  for (const addr of to) {
    for (const mgDomain of mgDomains) {
      if (addr.toLowerCase().includes(mgDomain)) {
        return false; // Skip - this belongs to Mailgun lane
      }
    }
  }
  
  // Skip obvious spam patterns
  const spamPatterns = [
    /viagra|casino|lottery|winner|congratulations/i,
    /\$\$\$|\[SPAM\]|FREE MONEY/i
  ];
  
  const content = subject + ' ' + from;
  for (const pattern of spamPatterns) {
    if (pattern.test(content)) {
      return false;
    }
  }
  
  // Check allowed senders if configured
  const allowedSenders = process.env.LEAD_INGEST_ALLOWED_SENDERS;
  if (allowedSenders && allowedSenders !== '*') {
    const allowed = allowedSenders.split(',').map(s => s.trim().toLowerCase());
    const senderDomain = from.split('@')[1]?.toLowerCase();
    
    if (!allowed.some(domain => senderDomain?.includes(domain))) {
      return false;
    }
  }
  
  return true;
}