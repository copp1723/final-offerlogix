# Template Versioning & A/B Testing Guide

## Overview

MailMind supports advanced template versioning and A/B testing capabilities that allow you to:
- Create multiple versions of email templates
- Automatically distribute leads across different template variants
- Track performance metrics for each variant
- Make data-driven decisions about your email campaigns

## Template Format

### Legacy Templates
Simple templates with just subject and content:
```json
{
  "subject": "Your Email Subject",
  "content": "Email body content with {{variables}}"
}
```

### Versioned Templates
Advanced templates with multiple variants:
```json
{
  "versions": {
    "A": {
      "subject": "Subject Version A",
      "content": "Content A with {{firstName}}"
    },
    "B": {
      "subject": "Subject Version B", 
      "content": "Content B with {{firstName}}"
    }
  },
  "ab": {
    "A": 50,
    "B": 50
  }
}
```

## A/B Testing Configuration

### Split Configuration
The `ab` object defines the percentage split:
```json
{
  "ab": {
    "control": 70,
    "variant": 30
  }
}
```
- Percentages must sum to 100
- Leads are deterministically assigned using hashing
- Same lead always gets same variant (consistent experience)

### Lead Assignment Algorithm
1. Lead ID is hashed using SHA-256
2. Hash is converted to number 0-99 
3. Number is mapped to variant based on cumulative percentages
4. Assignment is deterministic and consistent

Example with 30/70 split:
- Bucket 0-29 → Variant A (30%)
- Bucket 30-99 → Variant B (70%)

## API Usage

### Creating Versioned Templates
```http
PUT /api/campaigns/{id}/templates
Content-Type: application/json

{
  "templates": [
    {
      "versions": {
        "short": {
          "subject": "Quick Update",
          "content": "Brief message here"
        },
        "detailed": {
          "subject": "Detailed Information",
          "content": "Comprehensive information here"
        }
      },
      "ab": {
        "short": 40,
        "detailed": 60
      }
    }
  ]
}
```

### Sending with A/B Testing
```http
POST /api/campaigns/{id}/send-followup
Content-Type: application/json

{
  "templateIndex": 0,
  "leadIds": ["lead-1", "lead-2", "lead-3"]
}
```

Response includes variant distribution:
```json
{
  "message": "Follow-up emails queued",
  "successful": 100,
  "failed": 0,
  "suppressed": 5,
  "variants": {
    "short": 42,
    "detailed": 58
  }
}
```

## Best Practices

### 1. Test Design
- **Single Variable**: Test only one element at a time (subject vs content, not both)
- **Sample Size**: Ensure sufficient leads for statistical significance
- **Duration**: Run tests long enough to account for behavioral variations

### 2. Variant Creation
```json
{
  "versions": {
    "control": {
      "subject": "Original Subject Line",
      "content": "Existing content that performs well"
    },
    "test": {
      "subject": "New Subject Line Variation", 
      "content": "Same content as control"
    }
  },
  "ab": { "control": 50, "test": 50 }
}
```

### 3. Statistical Significance
- Minimum 100 leads per variant for basic insights
- 1000+ leads per variant for reliable statistical significance
- Consider conversion rate differences of 10%+ as meaningful

### 4. Naming Conventions
- Use descriptive variant names: `"original"`, `"personalized"`, `"urgent"`
- Avoid generic names like `"A"`, `"B"` for long-term maintenance
- Document the hypothesis being tested

## Advanced Features

### Multi-Variant Testing
Support for more than 2 variants:
```json
{
  "versions": {
    "control": { "subject": "Control", "content": "..." },
    "variant_1": { "subject": "Variant 1", "content": "..." },
    "variant_2": { "subject": "Variant 2", "content": "..." },
    "variant_3": { "subject": "Variant 3", "content": "..." }
  },
  "ab": {
    "control": 40,
    "variant_1": 20,
    "variant_2": 20,
    "variant_3": 20
  }
}
```

### Gradual Rollout
Start with small test percentage:
```json
{
  "versions": {
    "stable": { "subject": "Proven Template", "content": "..." },
    "new": { "subject": "Experimental Template", "content": "..." }
  },
  "ab": {
    "stable": 90,
    "new": 10
  }
}
```

### Metadata Tracking
Each email includes variant metadata for analytics:
```json
{
  "metadata": {
    "templateVersion": "variant_1",
    "campaignId": "camp-123",
    "testName": "subject_line_test_q4"
  }
}
```

## Migration Guide

### From Legacy to Versioned Templates
1. Identify existing high-performing templates
2. Create versioned format with original as "control"
3. Add new variant as "test"
4. Start with conservative 80/20 split
5. Monitor performance and adjust

Example migration:
```javascript
// Before (legacy)
const legacyTemplate = {
  subject: "Monthly Newsletter",
  content: "Here's your monthly update..."
};

// After (versioned)
const versionedTemplate = {
  versions: {
    control: {
      subject: "Monthly Newsletter", 
      content: "Here's your monthly update..."
    },
    personal: {
      subject: "{{firstName}}, your monthly update is here",
      content: "Here's your monthly update..."
    }
  },
  ab: { control: 80, personal: 20 }
};
```

## Performance Monitoring

### Key Metrics to Track
- **Open Rate** by variant
- **Click Rate** by variant  
- **Conversion Rate** by variant
- **Unsubscribe Rate** by variant
- **Bounce Rate** by variant

### Analytics Integration
Use campaign metrics endpoint:
```http
GET /api/campaigns/{id}/metrics
```

Filter by template version in your analytics dashboard to compare variant performance.

## Troubleshooting

### Common Issues
1. **Percentages don't sum to 100**: System will normalize automatically but log warning
2. **Variant not found in versions**: Falls back to latest available version
3. **Empty versions object**: Falls back to legacy subject/content fields
4. **Invalid lead ID**: Assigns to bucket 0 (first variant)

### Validation
Use the validation service to check templates:
```javascript
import { validateVersionedTemplate } from './services/template-versioning';

const validation = validateVersionedTemplate(template);
if (!validation.isValid) {
  console.log('Errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
}
```

## Examples

### Subject Line A/B Test
```json
{
  "versions": {
    "question": {
      "subject": "Are you ready for our biggest sale?",
      "content": "Our annual sale starts tomorrow..."
    },
    "statement": {
      "subject": "Our biggest sale starts tomorrow",
      "content": "Our annual sale starts tomorrow..."
    }
  },
  "ab": { "question": 50, "statement": 50 }
}
```

### Content Length Test
```json
{
  "versions": {
    "short": {
      "subject": "Quick Update",
      "content": "Brief 2-sentence update with clear CTA."
    },
    "detailed": {
      "subject": "Quick Update", 
      "content": "Comprehensive 3-paragraph explanation with context, benefits, and clear call-to-action button."
    }
  },
  "ab": { "short": 50, "detailed": 50 }
}
```

### Personalization Test
```json
{
  "versions": {
    "generic": {
      "subject": "Important Update",
      "content": "Dear Customer, we have an important update..."
    },
    "personalized": {
      "subject": "{{firstName}}, important update for you",
      "content": "Hi {{firstName}}, we have an important update..."
    }
  },
  "ab": { "generic": 40, "personalized": 60 }
}
```

This system provides powerful A/B testing capabilities while maintaining backward compatibility with existing templates.