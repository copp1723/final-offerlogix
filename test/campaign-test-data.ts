// Campaign test scenarios for conversation flow testing

export const testCampaigns = [
  {
    name: "Dog Days Blowout",
    context: `Summer's cooked, and we've got tons of last season's models just sittin' here. Goal is to clear the lot before the new stuff lands. We're targeting value shoppers and families who are smart enough to know a 2024 model is just as good as a 2025 but for way less cash.`,
    handoverGoals: [
      "Generate showroom visits for end-of-season models",
      "Collect trade-in evaluations",
      "Convert price-sensitive buyers",
    ],
  handoverRecipients: ["Sales Manager", "BDC Manager", "Floor Lead"],
    targetAudience: "Value shoppers and families looking for previous year models at deep discounts",
    handoverCriteria: [
      "Asks about specific model pricing or availability",
      "Requests trade-in value estimate",
      "Wants to schedule a test drive",
      "Shows urgency about making a purchase",
      "Asks about financing options",
    ],
    daysBetweenMessages: 3,
    numberOfTemplates: 5,
  },
  {
    name: "Truckpocalypse 2025",
    context: `We are absolutely choked with trucks. Ram, Ford, Chevy—you name it, we got too many. This is a straight-up inventory dump targeting working professionals and weekend warriors who need a work truck or just want something big.`,
    handoverGoals: [
      "Move excess truck inventory",
      "Capture commercial buyers",
      "Generate trade-up opportunities",
    ],
  handoverRecipients: ["Sales Manager", "Fleet Coordinator", "BDC Manager"],
    targetAudience: "Contractors, landscapers, and weekend warriors looking for work trucks or recreational vehicles",
    handoverCriteria: [
      "Inquires about specific truck specs or towing capacity",
      "Asks about commercial fleet pricing",
      "Mentions business use or work requirements",
      "Requests multiple vehicle quotes",
      "Shows interest in financing or leasing options",
    ],
    daysBetweenMessages: 2,
    numberOfTemplates: 4,
  },
  {
    name: "The Boss's Bad Bet Sale",
    context: `The GM went to auction and bought way too many used sedans. Now they're our problem. This is a flash sale targeting anyone looking for a cheap commuter car—students, first-time buyers, budget-conscious shoppers.`,
    handoverGoals: [
      "Quick turnover of excess sedan inventory",
      "Attract first-time buyers",
      "Generate immediate sales",
    ],
  handoverRecipients: ["Sales Manager", "BDC Manager", "Finance Manager"],
    targetAudience: "Budget-conscious buyers, students, first-time car owners looking for reliable commuter vehicles",
    handoverCriteria: [
      "Asks about student/first-time buyer programs",
      "Inquires about fuel efficiency or commute costs",
      "Requests payment calculations",
      "Mentions immediate need for transportation",
      "Shows interest in vehicle history or warranty",
    ],
    daysBetweenMessages: 1,
    numberOfTemplates: 3,
  },
  {
    name: "Labor Day Mega Savings",
    context: "Promotional push for the Labor Day weekend sale event targeting budget-conscious buyers and trade-in prospects. Emphasize aggressive markdowns on 2022-2024 models, bonus trade-in credits, and same-day financing approvals.",
    handoverGoals: [
      "Drive showroom traffic during holiday weekend",
      "Maximize trade-in opportunities",
      "Close same-day sales",
    ],
  handoverRecipients: ["Sales Manager", "Event Team Lead", "BDC Manager"],
    targetAudience: "Holiday bargain hunters and trade-in prospects looking for limited-time deals",
    handoverCriteria: [
      "Requests holiday weekend appointment",
      "Asks about limited-time offers",
      "Inquires about trade-in values",
      "Shows immediate purchase intent",
      "Mentions competitor holiday offers",
    ],
    daysBetweenMessages: 1,
    numberOfTemplates: 4,
  },
  {
    name: "Fresh Start Credit Event",
    context: "Re-engagement campaign targeting subprime audiences and prior declined applicants. Focus on flexible financing, guaranteed approvals, and second-chance loan programs.",
    handoverGoals: [
      "Convert previously declined customers",
      "Generate subprime applications",
      "Fill weekday appointment slots",
    ],
  handoverRecipients: ["Finance Manager", "Credit Specialist", "BDC Manager"],
    targetAudience: "Credit-challenged customers and previously declined applicants seeking vehicle financing",
    handoverCriteria: [
      "Mentions past credit challenges",
      "Asks about down payment options",
      "Inquires about approval odds",
      "Requests payment scenarios",
      "Shows willingness to provide proof of income",
    ],
    daysBetweenMessages: 2,
    numberOfTemplates: 5,
  }
];
