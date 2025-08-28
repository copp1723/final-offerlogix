#!/usr/bin/env node

// Create a new OfferLogix campaign
async function createNewCampaign() {
  console.log('🚀 Creating a new OfferLogix campaign...');
  
  const campaignData = {
    name: "OfferLogix Payment Solutions Outreach - Q1 2025",
    context: `OfferLogix helps automotive dealerships advertise accurate, compliant payment calculations across all platforms. We solve the pain points of:

    1. Manual payment calculations that often contain errors
    2. Inconsistent payment displays across website, ads, and CRM
    3. Compliance issues across different states and regulations  
    4. Time-consuming updates when rates or inventory changes
    5. Poor lead quality from inaccurate payment advertising

    Our patented single-call API integrates with existing dealer management systems and automatically generates penny-perfect, compliant payment calculations for any vehicle in inventory. Currently serving 8,000+ automotive stores with proven results like +134% lead volume increases.

    This campaign targets:
    - Independent automotive dealerships (5-50 vehicles)
    - Multi-location dealer groups 
    - Digital marketing agencies serving automotive clients
    - Technology partners needing payment calculation solutions

    Value proposition: Save time, ensure compliance, improve lead quality, increase sales velocity.`,
    
    targetAudience: "Automotive dealership decision makers (owners, general managers, finance managers) and digital marketing professionals serving the automotive industry. Focus on dealers struggling with payment advertising accuracy and compliance.",
    
    handoverGoals: `Hand over to human sales when prospects show:
    - Interest in pricing or implementation details
    - Questions about integration with their current DMS
    - Request for a demo or meeting
    - Mention specific compliance concerns or state regulations
    - Ask about ROI metrics or case studies
    - Want to discuss multi-location implementations
    - Express urgency ("need this soon", "looking to implement")`,
    
    handoverPrompt: `When handing over to human sales, provide context about:
    1. Prospect's role and dealership type (independent vs multi-location)
    2. Specific pain points mentioned (compliance, accuracy, lead quality)
    3. Technology stack mentioned (DMS, website platform, advertising tools)
    4. Timeline or urgency indicators
    5. Any competitor solutions they've mentioned
    6. Budget or scale indicators (number of locations, inventory size)`,
    
    status: "draft",
    numberOfTemplates: 5,
    daysBetweenMessages: 3,
    templates: [
      {
        subject: "Quick question about your dealership's payment ads",
        content: `Hi {{firstName}},

I work with OfferLogix and noticed your dealership's online presence. We help automotive dealers ensure their payment calculations are accurate and compliant across all platforms - website, ads, CRM.

Many dealers we work with were struggling with:
- Payment calculations that didn't match between their website and ads
- Compliance headaches across different states  
- Time wasted manually updating payments when rates changed

We've automated this for 8,000+ stores with our single-call API. Dealers typically see better lead quality and fewer compliance issues.

Quick question - how are you currently handling payment calculations for your online advertising?

Best,
Brittany
OfferLogix Team`
      },
      {
        subject: "Saw your inventory - payment accuracy question",
        content: `Hi {{firstName}},

Quick follow-up from my previous email about payment advertising.

I was looking at your current inventory online and wondering - when your rates change or you add new vehicles, how long does it take to update all your payment displays?

Most dealers tell us it's a manual process that takes hours and often has errors. We've solved this for dealers by automating accurate, compliant payments across all platforms.

For example, one dealer group went from 4 hours of manual updates to instant, automatic updates across 12 locations.

Would something like that be helpful for your operation?

Brittany`
      },
      {
        subject: "Payment compliance - quick reality check",
        content: `{{firstName}},

Hope you don't mind me reaching out again. I'm curious about something specific.

How confident are you that your current payment ads are 100% compliant across all the states where you advertise?

I ask because we just helped a dealer avoid a $50,000 compliance fine. Their payment calculations were off by a few dollars, but that was enough to trigger regulatory issues.

Our system automatically handles compliance across all 50 states. Takes that worry off the table completely.

Worth a quick conversation?

Brittany`
      },
      {
        subject: "Your competition is doing this (payment advertising)",
        content: `{{firstName}},

I probably shouldn't tell you this, but several dealerships in your area are already using our payment automation system.

They're advertising accurate, compliant payments that update automatically when rates change. While their competitors are still doing manual calculations (with errors), they're capturing higher-quality leads.

The difference in lead volume has been significant - typically 30-40% increases in qualified prospects.

I'd hate for you to get left behind on this. Want to see how it works?

Brittany`
      },
      {
        subject: "Last note on payment advertising automation",
        content: `{{firstName}},

I know I've reached out a few times about automating your payment calculations. This will be my last email unless I hear from you.

Just wanted to share one final thought: every day you're manually calculating payments is a day you could be doing more strategic work for your dealership.

Our clients save 10-15 hours per week on payment updates alone. That's time they can spend with customers, analyzing performance, or growing the business.

If you ever want to see how this works, I'm here. Otherwise, I respect your time and won't reach out again.

All the best,
Brittany
OfferLogix`
      }
    ],
    subjectLines: [
      "Quick payment advertising question",
      "Compliance question for your dealership",
      "Your payment ads - accuracy concern", 
      "Payment calculations - 2 minute question",
      "Dealership payment compliance check"
    ]
  };

  try {
    console.log('📝 Campaign details:');
    console.log(`Name: ${campaignData.name}`);
    console.log(`Templates: ${campaignData.numberOfTemplates}`);
    console.log(`Target: ${campaignData.targetAudience.substring(0, 100)}...`);
    console.log('');
    
    const response = await fetch('https://final-offerlogix.onrender.com/api/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(campaignData)
    });
    
    if (response.ok) {
      const campaign = await response.json();
      console.log('✅ Campaign created successfully!');
      console.log(`Campaign ID: ${campaign.id}`);
      console.log(`Status: ${campaign.status}`);
      console.log(`Created: ${new Date(campaign.createdAt).toLocaleDateString()}`);
      console.log('');
      
      console.log('🎯 Campaign Features:');
      console.log('- 5 email templates focused on OfferLogix value proposition');
      console.log('- Targets automotive dealership decision makers');
      console.log('- Emphasizes compliance, accuracy, and lead quality benefits');
      console.log('- Smart handover triggers for sales-ready prospects');
      console.log('- 3-day intervals between messages');
      console.log('');
      
      console.log('📋 Next steps:');
      console.log('1. Upload your lead list (CSV with dealership contacts)');
      console.log('2. Review and adjust templates if needed');
      console.log('3. Launch the campaign');
      console.log('4. Monitor responses and handovers');
      console.log('');
      
      console.log(`🌐 View campaign: https://final-offerlogix.onrender.com/campaigns/${campaign.id}`);
      
      return campaign;
      
    } else {
      console.log('❌ Failed to create campaign');
      const errorText = await response.text();
      console.log(`Status: ${response.status}`);
      console.log(`Error: ${errorText}`);
    }
    
  } catch (error) {
    console.error('💥 Error creating campaign:', error.message);
  }
}

createNewCampaign();