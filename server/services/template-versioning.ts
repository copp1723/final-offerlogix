import crypto from 'crypto';
import { toError } from '../utils/error';
import logger from '../logging/logger';

export interface TemplateVariant {
  subject: string;
  content: string;
}

export interface VersionedTemplate {
  subject?: string;
  content?: string;
  versions?: Record<string, TemplateVariant>;
  ab?: Record<string, number>; // {A:50,B:50}
}

export interface VersionSelectionResult {
  versionKey: string;
  template: TemplateVariant;
  bucketAssignment: number;
}

/**
 * Hash leadId deterministically to bucket 0-99
 * Uses SHA-256 for cryptographically strong deterministic distribution
 */
export function hashToBucket(leadId: string, buckets = 100): number {
  if (!leadId || typeof leadId !== 'string') {
    logger.warn('Invalid leadId provided to hashToBucket', { leadId });
    return 0;
  }

  const hash = crypto.createHash('sha256').update(leadId.toString()).digest('hex');
  const int = parseInt(hash.slice(0, 8), 16);
  return int % buckets;
}

/**
 * Select a template version for a given lead based on AB split
 * Provides consistent, deterministic assignment for reliable A/B testing
 */
export function selectTemplateVersion(
  template: VersionedTemplate, 
  leadId: string
): VersionSelectionResult {
  // Handle empty or invalid template
  if (!template || typeof template !== 'object') {
    logger.warn('Invalid template provided', { template, leadId });
    return {
      versionKey: 'default',
      template: { subject: 'Default Subject', content: 'Default Content' },
      bucketAssignment: 0
    };
  }

  // Initialize versions - support both legacy and versioned templates
  const versions: Record<string, TemplateVariant> = template.versions || {
    default: {
      subject: template.subject || 'Default Subject',
      content: template.content || 'Default Content'
    }
  };

  const versionKeys = Object.keys(versions).filter(key => 
    versions[key] && 
    typeof versions[key] === 'object' &&
    versions[key].subject !== undefined &&
    versions[key].content !== undefined
  );

  if (versionKeys.length === 0) {
    logger.warn('No valid versions found in template', { template, leadId });
    return {
      versionKey: 'fallback',
      template: { subject: 'Fallback Subject', content: 'Fallback Content' },
      bucketAssignment: 0
    };
  }

  // If no AB config or invalid config, return latest version (alphabetically last)
  if (!template.ab || typeof template.ab !== 'object' || Object.keys(template.ab).length === 0) {
    const latestKey = versionKeys.sort().slice(-1)[0];
    const bucketAssignment = hashToBucket(leadId);
    
    logger.debug('No A/B test config, using latest version', {
      leadId,
      latestKey,
      bucketAssignment,
      availableVersions: versionKeys
    });

    return {
      versionKey: latestKey,
      template: versions[latestKey],
      bucketAssignment
    };
  }

  // Validate A/B split percentages
  const abConfig = template.ab;
  const totalPercentage = Object.values(abConfig).reduce((sum, pct) => sum + (Number(pct) || 0), 0);
  
  if (totalPercentage !== 100) {
    logger.warn('A/B test percentages do not sum to 100, normalizing', {
      leadId,
      abConfig,
      totalPercentage
    });
    
    // Normalize percentages to sum to 100
    const factor = 100 / totalPercentage;
    for (const [variant, pct] of Object.entries(abConfig)) {
      abConfig[variant] = Math.round((Number(pct) || 0) * factor);
    }
  }

  // Assign lead to bucket (0-99)
  const bucket = hashToBucket(leadId);
  let cumulative = 0;

  // Find which variant the bucket falls into
  for (const [variant, percent] of Object.entries(abConfig)) {
    const percentNum = Number(percent) || 0;
    cumulative += percentNum;
    
    if (bucket < cumulative) {
      // Check if this variant exists in versions
      const chosenTemplate = versions[variant] || versions[versionKeys.sort().slice(-1)[0]];
      
      logger.debug('A/B test assignment completed', {
        leadId,
        bucket,
        variant,
        cumulative,
        percentAssigned: percentNum
      });

      return {
        versionKey: variant,
        template: chosenTemplate,
        bucketAssignment: bucket
      };
    }
  }

  // Fallback to latest version if no assignment found
  const fallbackKey = versionKeys.sort().slice(-1)[0];
  logger.warn('A/B test assignment fell through, using fallback', {
    leadId,
    bucket,
    fallbackKey,
    abConfig
  });

  return {
    versionKey: fallbackKey,
    template: versions[fallbackKey],
    bucketAssignment: bucket
  };
}

/**
 * Validate a versioned template structure
 */
export function validateVersionedTemplate(template: VersionedTemplate): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!template || typeof template !== 'object') {
    errors.push('Template must be an object');
    return { isValid: false, errors, warnings };
  }

  // Check if it's a legacy template (subject/content) or versioned template
  const hasLegacyFields = template.subject || template.content;
  const hasVersions = template.versions && typeof template.versions === 'object';

  if (!hasLegacyFields && !hasVersions) {
    errors.push('Template must have either subject/content or versions object');
  }

  // Validate versions if present
  if (hasVersions && template.versions) {
    const versionKeys = Object.keys(template.versions);
    
    if (versionKeys.length === 0) {
      warnings.push('Versions object is empty');
    }

    for (const [key, variant] of Object.entries(template.versions)) {
      if (!variant || typeof variant !== 'object') {
        errors.push(`Version '${key}' must be an object`);
        continue;
      }

      if (!variant.subject || typeof variant.subject !== 'string') {
        errors.push(`Version '${key}' must have a subject string`);
      }

      if (!variant.content || typeof variant.content !== 'string') {
        errors.push(`Version '${key}' must have a content string`);
      }

      if (variant.subject && variant.subject.length > 200) {
        warnings.push(`Version '${key}' subject is very long (${variant.subject.length} chars)`);
      }
    }
  }

  // Validate A/B configuration if present
  if (template.ab && typeof template.ab === 'object') {
    const abConfig = template.ab;
    const variants = Object.keys(abConfig);
    const percentages = Object.values(abConfig);

    if (variants.length === 0) {
      warnings.push('A/B configuration is empty');
    }

    const totalPercentage = percentages.reduce((sum, pct) => sum + (Number(pct) || 0), 0);
    if (totalPercentage !== 100) {
      warnings.push(`A/B test percentages sum to ${totalPercentage}%, not 100%`);
    }

    for (const [variant, percent] of Object.entries(abConfig)) {
      if (typeof percent !== 'number' || percent < 0 || percent > 100) {
        errors.push(`A/B variant '${variant}' percentage must be 0-100, got: ${percent}`);
      }

      // Check if variant exists in versions
      if (hasVersions && template.versions && !template.versions[variant]) {
        warnings.push(`A/B variant '${variant}' not found in versions object`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create a simple A/B test configuration
 */
export function createSimpleABTest(
  variantA: TemplateVariant,
  variantB: TemplateVariant,
  splitPercentage: number = 50
): VersionedTemplate {
  if (splitPercentage < 0 || splitPercentage > 100) {
    throw new Error('Split percentage must be between 0 and 100');
  }

  return {
    versions: {
      A: variantA,
      B: variantB
    },
    ab: {
      A: splitPercentage,
      B: 100 - splitPercentage
    }
  };
}

/**
 * Get A/B test statistics for analysis
 */
export function getABTestStats(
  leadAssignments: Array<{ leadId: string; versionKey: string }>
): Record<string, { count: number; percentage: number }> {
  const stats: Record<string, number> = {};
  const total = leadAssignments.length;

  // Count assignments
  for (const assignment of leadAssignments) {
    stats[assignment.versionKey] = (stats[assignment.versionKey] || 0) + 1;
  }

  // Convert to percentages
  const result: Record<string, { count: number; percentage: number }> = {};
  for (const [variant, count] of Object.entries(stats)) {
    result[variant] = {
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0
    };
  }

  return result;
}

/**
 * Migrate legacy template to versioned template
 */
export function migrateLegacyTemplate(legacyTemplate: {
  subject?: string;
  content?: string;
}): VersionedTemplate {
  return {
    versions: {
      v1: {
        subject: legacyTemplate.subject || 'Migrated Template',
        content: legacyTemplate.content || 'Migrated Content'
      }
    }
  };
}