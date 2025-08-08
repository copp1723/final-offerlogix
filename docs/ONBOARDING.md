# OneKeel Swarm Onboarding Guide

Welcome to OneKeel Swarm! This guide will walk you through setting up your automotive email campaign platform from initial configuration to launching your first successful campaign.

## Prerequisites

Before you begin, ensure you have:
- ✅ Administrative access to your OneKeel Swarm instance
- ✅ Mailgun account with verified domain
- ✅ OpenRouter API key for AI functionality
- ✅ Basic understanding of email marketing concepts

## Step 1: Initial System Configuration

### Environment Setup
Configure your essential API keys and services:

```bash
# Email Infrastructure
MAILGUN_DOMAIN=mg.yourdealership.com
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxx

# AI Services
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxx

# Database (automatically configured)
DATABASE_URL=[provided by platform]
```

### Domain Authentication
Set up proper email authentication for maximum deliverability:

1. **SPF Record**: Add to your DNS
   ```
   v=spf1 include:mailgun.org ~all
   ```

2. **DKIM Keys**: Configure in Mailgun dashboard
   - Generate DKIM keypair
   - Add public key to DNS as TXT record

3. **DMARC Policy**: Implement email authentication
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdealership.com
   ```

## Step 2: Brand Configuration

### White Label Setup
Configure your dealership branding:

1. Navigate to **Settings > Branding**
2. Upload your dealership logo (recommended: 200x60px PNG)
3. Set primary colors to match your brand
4. Configure company information:
   - Dealership name
   - Contact information
   - Physical address
   - Phone number

### Email Templates
Customize your email appearance:
- Header design with logo placement
- Footer with legal disclaimers
- Color scheme matching your website
- Typography preferences

## Step 3: User Management

### Create User Accounts
Set up your team members with appropriate roles:

**Administrator Role:**
- Full system access
- Campaign creation and management
- User management
- System configuration

**Manager Role:**
- Campaign oversight
- Lead management
- Performance analytics
- Team coordination

**Sales User Role:**
- Lead interaction
- Handover management
- Basic reporting
- Customer communication

### Permission Configuration
Define what each role can access:
- Campaign creation permissions
- Lead data visibility
- Administrative functions
- Reporting capabilities

## Step 4: Lead Import and Setup

### CSV Lead Import
Prepare your customer database:

1. **Required Fields:**
   ```csv
   email,firstName,lastName,phone,vehicleInterest,source,status
   john@email.com,John,Smith,555-0123,F-150,Website,New
   ```

2. **Upload Process:**
   - Navigate to **Leads > Import**
   - Select your CSV file
   - Map columns to system fields
   - Review and confirm import

### Lead Segmentation
Organize your leads effectively:
- **By Vehicle Interest**: F-150, Explorer, Mustang, etc.
- **By Source**: Website, Phone, Referral, Walk-in
- **By Engagement Level**: Hot, Warm, Cold
- **By Purchase Timeline**: Immediate, 30 days, 90 days

## Step 5: Your First Campaign

### AI Campaign Agent Setup
Let AI guide your campaign creation:

1. **Start Campaign Chat:**
   - Click "Create New Campaign"
   - Describe your goals in natural language
   - Example: "I want to promote our spring F-150 sale to leads interested in trucks"

2. **AI Recommendations:**
   - Campaign objectives
   - Target audience
   - Email sequence timing
   - Subject line suggestions

### Campaign Configuration
Fine-tune your campaign settings:

**Basic Information:**
- Campaign name: "Spring F-150 Special Promotion"
- Campaign type: Product Promotion
- Duration: 30 days
- Target audience: F-150 interested leads

**Email Sequence:**
- Email 1: Introduction and special offer (Day 0)
- Email 2: Feature highlights and testimonials (Day 3)
- Email 3: Limited time urgency (Day 7)
- Email 4: Final opportunity with incentive (Day 14)

**AI Personalization:**
- Dynamic content based on lead interests
- Behavioral trigger responses
- Intelligent send time optimization

## Step 6: Conversation Intelligence Setup

### Response Management
Configure automated response handling:

1. **AI Reply Settings:**
   - Enable memory-augmented responses
   - Set conversation quality standards
   - Configure escalation triggers

2. **Handover Criteria:**
   - Buying signal detection
   - Price inquiry thresholds
   - Test drive requests
   - Competitor mentions

### Quick Reply Templates
Set up standard responses:
- Pricing information requests
- Test drive scheduling
- Feature comparisons
- Financing options

## Step 7: Deliverability Optimization

### Suppression Management
Ensure clean sending practices:

1. **Automatic Quarantine:**
   - Hard bounces → immediate suppression
   - Spam complaints → review and suppress
   - Unsubscribe requests → instant removal

2. **List Hygiene:**
   - Regular validation checks
   - Engagement-based scoring
   - Re-engagement campaigns for inactive leads

### RFC 8058 Compliance
Verify one-click unsubscribe setup:
- List-Unsubscribe header configured
- List-Unsubscribe-Post header active
- Unsubscribe landing page functional

## Step 8: Testing and Validation

### Pre-Launch Checklist
Verify everything works correctly:

- [ ] Test email delivery to personal accounts
- [ ] Verify unsubscribe functionality
- [ ] Check mobile email rendering
- [ ] Validate tracking and analytics
- [ ] Test AI response generation
- [ ] Confirm handover notifications

### Campaign Testing
Run a small test campaign:
1. Select 10-20 test leads
2. Launch abbreviated campaign
3. Monitor delivery rates
4. Check engagement metrics
5. Test response handling

## Step 9: Launch and Monitor

### Campaign Launch
Execute your first campaign:

1. **Final Review:**
   - Campaign settings verification
   - Audience targeting confirmation
   - Content approval
   - Schedule validation

2. **Go Live:**
   - Click "Launch Campaign"
   - Monitor initial sends
   - Watch for immediate issues
   - Track engagement metrics

### Performance Monitoring
Track key metrics:
- **Delivery Rate**: Target >99%
- **Open Rate**: Target 25-35% (automotive industry)
- **Click Rate**: Target 3-8%
- **Response Rate**: Target 1-3%
- **Handover Rate**: Target 5-15% of responders

## Step 10: Optimization and Growth

### Continuous Improvement
Use platform intelligence for optimization:

1. **AI Insights:**
   - Subject line performance analysis
   - Send time optimization recommendations
   - Content engagement patterns
   - Lead scoring improvements

2. **A/B Testing:**
   - Email subject variations
   - Call-to-action placement
   - Content personalization levels
   - Send frequency optimization

### Advanced Features
Explore additional capabilities:
- **Predictive Analytics**: Lead conversion probability
- **Dynamic Content**: Real-time personalization
- **Multi-channel Integration**: SMS and social media
- **Advanced Segmentation**: Behavioral and demographic

## Success Metrics

Track your platform's impact:

**Operational Efficiency:**
- 80% reduction in campaign setup time
- 90% automation of routine responses
- 95% improvement in response consistency

**Marketing Performance:**
- 35% increase in email engagement
- 50% improvement in lead response rates
- 25% higher conversion to appointments

**Business Results:**
- 20% increase in overall sales
- 15% improvement in customer satisfaction
- 30% reduction in manual sales tasks

## Getting Help

**Support Resources:**
- In-platform help documentation
- Video tutorial library
- Best practices knowledge base
- Community forums

**Technical Support:**
- Email: support@onekeel.com
- Live chat: Available during business hours
- Phone: 1-800-ONEKEEL
- Emergency escalation for critical issues

**Training Options:**
- Self-paced online courses
- Live webinar sessions
- One-on-one setup assistance
- Team training workshops

---

**Next Steps:** Once onboarding is complete, explore our [Campaign Creation Workflow](./workflows/CAMPAIGN_CREATION.md) to master advanced campaign strategies.