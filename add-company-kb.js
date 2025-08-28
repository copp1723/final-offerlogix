import axios from 'axios';

// Script to add OfferLogix company information to knowledge base
const API_BASE = 'http://127.0.0.1:5050/api';

async function addOfferLogixKnowledgeBase() {
  console.log('🏢 Adding OfferLogix Company Information to Knowledge Base...');
  
  const testClientId = '88a6733c-132f-479d-ad53-67ffe51bcee0'; // Using existing client

  try {
    // Step 1: Create OfferLogix company knowledge base
    console.log('\n📚 Step 1: Creating OfferLogix company knowledge base...');
    const createKbResponse = await axios.post(`${API_BASE}/knowledge-base`, {
      name: 'OfferLogix Company Knowledge Base',
      description: 'Comprehensive information about OfferLogix company, services, and solutions',
      clientId: testClientId,
      settings: {
        autoIndex: true,
        chunkSize: 1200,
        overlap: 100
      }
    });
    
    const knowledgeBaseId = createKbResponse.data.id;
    console.log('✅ Knowledge base created:', knowledgeBaseId);

    // Step 2: Add comprehensive company documents
    console.log('\n📄 Step 2: Adding OfferLogix company documents...');
    
    const documents = [
      {
        title: 'OfferLogix Company Overview',
        content: `OfferLogix is the premier fintech solution provider specializing in instant credit decision technology for automotive, retail, and e-commerce industries. We revolutionize the customer experience by providing real-time financing decisions that eliminate waiting periods and reduce abandonment rates.

**Core Mission**: To transform how businesses offer credit by making instant decisions accessible, accurate, and seamless.

**Key Value Propositions**:
- Instant credit decisions in under 30 seconds
- 95% accuracy rate in credit assessments
- Seamless integration with existing systems
- Multi-industry application (automotive, retail, e-commerce)
- Advanced AI-driven risk assessment
- Customizable decision criteria
- Real-time API connectivity
- Comprehensive reporting and analytics

**Industries Served**:
1. Automotive Dealerships - Vehicle financing and lease decisions
2. Retail Finance - Point-of-sale credit for high-ticket items
3. E-commerce Platforms - Online purchase financing
4. Equipment Finance - Industrial and commercial equipment
5. Healthcare Finance - Medical procedure and equipment financing

**Competitive Advantages**:
- Proprietary AI algorithms with 95% accuracy
- Sub-30-second decision times
- Integration capability with 500+ systems
- Multi-bureau credit data aggregation
- Real-time fraud detection
- Customizable risk parameters
- White-label solutions available`,
        documentType: 'note',
        tags: ['company', 'overview', 'fintech', 'credit-decisions', 'automotive'],
        metadata: { 
          category: 'company-info', 
          type: 'overview',
          priority: 'high',
          department: 'general'
        }
      },
      {
        title: 'OfferLogix Instant Credit Solutions',
        content: `**INSTANT CREDIT DECISION PLATFORM**

Our flagship instant credit solution provides real-time financing decisions across multiple verticals:

**Automotive Solutions**:
- Vehicle Purchase Financing: Real-time auto loan approvals
- Lease Decision Engine: Instant lease qualification
- Trade-In Value Integration: Automated equity calculations
- Extended Warranty Financing: Service contract approvals
- Aftermarket Financing: Parts and accessories credit

**Core Technology Features**:
- Multi-bureau credit pulls (Experian, Equifax, TransUnion)
- Alternative data integration (bank statements, utility payments)
- Income verification through third-party services
- Employment verification automation
- Fraud detection algorithms
- Risk-based pricing engines
- State compliance automation
- OFAC and identity verification

**Decision Criteria Customization**:
- Minimum credit scores (configurable by client)
- Debt-to-income ratio limits
- Employment history requirements
- Residency verification
- Bankruptcy lookback periods
- Maximum loan amounts
- Term length restrictions
- Down payment requirements

**Integration Capabilities**:
- RESTful API architecture
- Webhook notifications
- Real-time status updates
- Multi-format data export
- CRM integration ready
- DMS (Dealer Management System) compatible
- E-commerce platform plugins
- Mobile SDK available

**Performance Metrics**:
- Average decision time: 28 seconds
- System uptime: 99.9%
- Accuracy rate: 95.2%
- Customer satisfaction: 4.8/5
- Integration success rate: 98%`,
        documentType: 'note',
        tags: ['instant-credit', 'technology', 'api', 'automotive', 'integration'],
        metadata: { 
          category: 'solutions', 
          type: 'technical-specs',
          priority: 'high',
          department: 'product'
        }
      },
      {
        title: 'Payment Calculation Solutions',
        content: `**ADVANCED PAYMENT CALCULATION ENGINE**

OfferLogix provides sophisticated payment calculation tools that deliver accurate financing scenarios in real-time:

**Payment Calculator Features**:
- Real-time interest rate determination
- Multiple loan structure options
- Balloon payment calculations
- Lease payment computations
- Trade-in equity integration
- Tax and fee calculations
- Regional compliance adjustments
- Multiple payment scenarios

**Calculation Types**:

**Standard Auto Loans**:
- Principal and interest calculations
- Term options: 24, 36, 48, 60, 72, 84 months
- APR ranges: 2.9% - 29.9% (based on credit tier)
- Down payment minimums by credit score
- Payment-to-income ratio validation

**Lease Calculations**:
- Money factor to APR conversions
- Residual value determinations
- Acquisition fee integration
- Multiple security deposit options
- Mileage allowance calculations
- Wear and tear provisions
- Early termination calculations

**Trade-In Integration**:
- Real-time vehicle valuation (KBB, Edmunds, NADA)
- Payoff amount verification
- Equity/negative equity calculations
- Title verification status
- Lien holder information
- State-specific requirements

**Advanced Features**:
- Gap insurance calculations
- Extended warranty integration
- Service contract pricing
- Aftermarket product financing
- Multiple co-signer scenarios
- Joint application handling
- Business vs. personal credit options

**Customization Options**:
- Client-specific rate sheets
- Promotional rate integration
- Seasonal adjustment factors
- Volume-based rate improvements
- Credit tier customization
- Regional compliance variations
- Dealer reserve calculations
- Markup limitations

**Integration Benefits**:
- Seamless DMS integration
- F&I menu presentation
- Automated compliance checks
- Real-time rate shopping
- Lender comparison tools
- Profit margin calculations
- Commission tracking
- Regulatory reporting automation`,
        documentType: 'note',
        tags: ['payment-calculator', 'financing', 'lease', 'trade-in', 'integration'],
        metadata: { 
          category: 'solutions', 
          type: 'payment-systems',
          priority: 'high',
          department: 'product'
        }
      },
      {
        title: 'OfferLogix Implementation Guide',
        content: `**IMPLEMENTATION AND ONBOARDING PROCESS**

**Phase 1: Discovery and Planning (Week 1-2)**
- Business requirements analysis
- Current system architecture review
- Integration points identification
- Compliance requirements assessment
- Custom configuration planning
- Timeline and milestone establishment

**Phase 2: Technical Setup (Week 2-4)**
- API credential provisioning
- Sandbox environment setup
- Initial integration development
- Test data configuration
- Security protocol implementation
- Performance optimization

**Phase 3: Configuration and Testing (Week 4-6)**
- Decision criteria configuration
- Rate sheet integration
- Workflow customization
- User acceptance testing
- Load testing and optimization
- Security penetration testing

**Phase 4: Training and Go-Live (Week 6-8)**
- Staff training sessions
- Process documentation
- Soft launch with limited users
- Performance monitoring
- Issue resolution and refinement
- Full production deployment

**Technical Requirements**:
- Internet connectivity (minimum 10 Mbps)
- HTTPS/SSL support
- JSON handling capability
- Webhook support (recommended)
- Database storage capacity
- User authentication system
- Error logging and monitoring

**Support Services**:
- 24/7 technical support
- Dedicated implementation manager
- Training materials and documentation
- Regular system health checks
- Performance optimization reviews
- Compliance updates and monitoring
- Custom reporting development
- Integration troubleshooting

**Success Metrics**:
- Decision time reduction: 80%+ improvement
- Customer satisfaction increase: 25%+ improvement
- Abandonment rate reduction: 30%+ improvement
- Staff efficiency improvement: 40%+ improvement
- Revenue per customer increase: 15%+ improvement`,
        documentType: 'note',
        tags: ['implementation', 'onboarding', 'training', 'support', 'technical-requirements'],
        metadata: { 
          category: 'implementation', 
          type: 'process-guide',
          priority: 'medium',
          department: 'implementation'
        }
      },
      {
        title: 'OfferLogix Pricing and Packages',
        content: `**PRICING STRUCTURE AND PACKAGES**

**Starter Package - $2,999/month**
- Up to 500 credit decisions per month
- Basic payment calculator
- Standard integrations (3 systems)
- Email support (business hours)
- Basic reporting dashboard
- 30-second average decision time
- Single location support

**Professional Package - $5,999/month**
- Up to 2,000 credit decisions per month
- Advanced payment calculator with trade-in integration
- Premium integrations (10 systems)
- Priority phone and email support
- Advanced analytics and reporting
- 25-second average decision time
- Multi-location support (up to 5)
- Custom rate sheets
- Fraud detection included

**Enterprise Package - $12,999/month**
- Unlimited credit decisions
- Full-featured payment calculator suite
- Custom integrations (unlimited)
- Dedicated account manager
- 24/7 priority support
- Real-time analytics dashboard
- 20-second average decision time
- Unlimited locations
- White-label options
- Advanced fraud protection
- Custom decision workflows
- API rate limiting: 1000 calls/minute

**Enterprise Plus - Custom Pricing**
- Everything in Enterprise
- Custom AI model training
- Dedicated infrastructure
- SLA guarantees (99.99% uptime)
- Custom compliance modules
- Advanced security features
- Dedicated technical support team
- Custom reporting and analytics
- Integration consulting services
- Priority feature development

**Additional Services**:
- Implementation support: $5,000 one-time
- Custom integration development: $150/hour
- Training sessions: $1,000 per session
- Additional locations: $500/month each
- Extra decision volume: $0.50 per decision
- Advanced fraud protection: $1,000/month
- Custom reporting: $2,000 one-time setup
- Priority support upgrade: $1,000/month

**Contract Terms**:
- Minimum 12-month commitment
- Month-to-month available with 20% premium
- Volume discounts available for 10,000+ decisions
- Multi-year discounts: 10% (2 years), 15% (3 years)
- Setup fees waived for Annual payments
- 30-day money-back guarantee`,
        documentType: 'note',
        tags: ['pricing', 'packages', 'enterprise', 'professional', 'starter'],
        metadata: { 
          category: 'pricing', 
          type: 'packages',
          priority: 'high',
          department: 'sales'
        }
      },
      {
        title: 'OfferLogix API Documentation Summary',
        content: `**API DOCUMENTATION OVERVIEW**

**Authentication**:
- API Key-based authentication
- OAuth 2.0 support available
- Rate limiting: 100-1000 calls/minute (package dependent)
- HTTPS required for all requests
- Request signing for enhanced security

**Core Endpoints**:

**Credit Decision API**:
- POST /api/v1/credit-decision
- Real-time credit evaluation
- Response time: <30 seconds
- Includes decision, terms, and conditions

**Payment Calculator API**:
- POST /api/v1/calculate-payment
- Multiple calculation scenarios
- Supports loans, leases, and refinancing
- Trade-in integration included

**Vehicle Valuation API**:
- GET /api/v1/vehicle-value/{vin}
- Real-time trade-in values
- Multiple valuation sources
- Condition adjustments available

**Status and Webhook API**:
- GET /api/v1/status/{transaction-id}
- POST webhook endpoints for real-time updates
- Status tracking throughout process
- Error handling and retry logic

**Data Requirements**:
- Customer information (name, address, SSN)
- Employment details
- Income verification
- Requested loan amount and terms
- Vehicle information (if applicable)
- Trade-in details (if applicable)

**Response Formats**:
- JSON standard format
- XML available upon request
- Real-time webhook notifications
- Batch processing for high volume
- Error codes and descriptions included

**Security Features**:
- 256-bit SSL encryption
- Data masking for PII
- GDPR compliance ready
- SOC 2 Type II certified
- Regular security audits
- Fraud detection algorithms

**Integration Examples**:
- CRM systems (Salesforce, HubSpot)
- DMS platforms (DealerSocket, vAuto)
- E-commerce (Shopify, Magento)
- Custom applications
- Mobile applications
- Point-of-sale systems

**Testing and Development**:
- Sandbox environment available
- Test data sets provided
- Documentation and code samples
- SDKs for popular languages
- Postman collections available
- Integration testing support`,
        documentType: 'note',
        tags: ['api', 'documentation', 'integration', 'technical', 'development'],
        metadata: { 
          category: 'technical', 
          type: 'api-docs',
          priority: 'medium',
          department: 'technical'
        }
      }
    ];

    const addedDocuments = [];
    for (const [index, doc] of documents.entries()) {
      console.log(`📄 Adding document ${index + 1}/${documents.length}: ${doc.title}`);
      
      try {
        const response = await axios.post(`${API_BASE}/knowledge-base/documents`, {
          knowledgeBaseId,
          ...doc
        });
        addedDocuments.push(response.data);
        console.log(`✅ Added: ${doc.title}`);
        
        // Small delay between documents
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed to add ${doc.title}:`, error.response?.data || error.message);
      }
    }

    // Step 3: Wait for processing
    console.log('\n⏳ Step 3: Waiting for document processing and indexing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 4: Test knowledge base search
    console.log('\n🔍 Step 4: Testing knowledge base search functionality...');
    
    const testQueries = [
      'What is OfferLogix and what services do they provide?',
      'What are the pricing packages available?',
      'How does the instant credit decision process work?',
      'What industries does OfferLogix serve?',
      'What are the payment calculation features?',
      'How long does the implementation process take?'
    ];

    for (const query of testQueries) {
      try {
        console.log(`\n🔍 Testing query: "${query}"`);
        
        const searchResponse = await axios.post(`${API_BASE}/knowledge-base/search`, {
          knowledgeBaseIds: [knowledgeBaseId],
          query,
          clientId: testClientId,
          limit: 3,
          threshold: 0.7
        });

        if (searchResponse.data.results && searchResponse.data.results.length > 0) {
          console.log(`✅ Found ${searchResponse.data.results.length} results`);
          console.log(`💡 Top result: ${searchResponse.data.results[0].content?.slice(0, 100)}...`);
        } else {
          console.log('❌ No results found');
        }
      } catch (error) {
        console.error(`❌ Search failed for "${query}":`, error.response?.data || error.message);
      }
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n🎉 OfferLogix company knowledge base setup completed successfully!');
    
    // Summary
    console.log('\n📊 SETUP SUMMARY:');
    console.log(`   📚 Knowledge Base ID: ${knowledgeBaseId}`);
    console.log(`   📄 Documents Added: ${addedDocuments.length}/${documents.length}`);
    console.log(`   🏢 Company: OfferLogix`);
    console.log(`   📋 Categories: Company Info, Solutions, Pricing, Technical, Implementation`);
    console.log(`   ✅ Ready for AI agent integration`);
    
    return {
      knowledgeBaseId,
      documentsAdded: addedDocuments.length,
      totalDocuments: documents.length,
      success: true
    };
    
  } catch (error) {
    console.error('❌ OfferLogix KB setup failed:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

// Run the setup
addOfferLogixKnowledgeBase().catch(console.error);