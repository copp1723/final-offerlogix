/**
 * Lead Ingestion Parser - Extract lead data from various email formats
 * Handles OEM forms, Cars.com/Autotrader leads, website contact forms
 */

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
  const content = text || html || '';
  const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Extract email - most critical field
  const foundEmail = cleanContent.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  
  // Extract phone with various formats
  const phoneMatch = cleanContent.match(/(?:phone|tel|mobile|cell)[:\s-]*(\+?\d[\d\s().-]{7,}\d)/i) ||
                    cleanContent.match(/(\+?\d{1,3}[\s.-]?\(??\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  const phone = phoneMatch?.[1] || phoneMatch?.[0];
  
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
  
  // Split name into first/last
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
  
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
      vehicleInterest = match[1].trim();
      break;
    }
  }
  
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
    originalSubject: subject,
    senderDomain,
    parsedAt: new Date().toISOString(),
    contentLength: cleanContent.length
  };
  
  // Look for specific form fields
  const formFields = cleanContent.match(/(\w+)[:\s-]+([^\n\r]{1,100})/gi) || [];
  for (const field of formFields.slice(0, 10)) { // Limit to prevent bloat
    const [, key, value] = field.match(/(\w+)[:\s-]+([^\n\r]{1,100})/) || [];
    if (key && value && key.length > 2 && value.trim().length > 1) {
      metadata[key.toLowerCase()] = value.trim();
    }
  }
  
  return {
    firstName,
    lastName,
    email: foundEmail,
    phone: phone?.replace(/\D/g, '').replace(/^1/, '') || undefined, // Clean phone format
    vehicleInterest: vehicleInterest || undefined,
    leadSource,
    notes: subject.length > 5 ? subject : undefined,
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
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Check if email should be processed for lead ingestion
 */
export function shouldProcessForLeadIngestion(
  subject: string, 
  from: string, 
  to: string[]
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