# OfferLogix Smart Dashboard

A clean, fast React + TypeScript dashboard with integrated knowledge base that implements the "memory over metrics" philosophy.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server (runs on port 3001)
npm run dev

# Build for production
npm run build
```

## 🏗️ Architecture

### Single API Endpoint
The entire dashboard hydrates from one endpoint:
```
GET /api/dashboard
```

This returns leads with embedded insights, intelligence patterns, and AI suggestions - no separate calls needed.

### Progressive Disclosure
- **Level 1 (Default):** AI Campaign Agent - hero interface
- **Level 2 (One click):** Lead cards with context snippets
- **Level 3 (Deep dive):** Full lead details in drawer

### Tech Stack
- **Vite** - Lightning fast dev server and build
- **React 18** - UI framework
- **TypeScript** - Full type safety
- **React Query** - Server state management
- **Tailwind CSS** - Utility-first styling
- **Lucide Icons** - Clean icon set

## 📁 Project Structure

```
dashboard/
├── src/
│   ├── api/          # API client with mock fallback
│   ├── components/   # Reusable UI components
│   │   ├── AIAgentPanel.tsx      # Campaign chat interface
│   │   ├── LeadList.tsx          # Lead cards grid
│   │   ├── LeadDetailsDrawer.tsx # Deep dive panel
│   │   └── InsightsPanel.tsx     # Intelligence cards
│   ├── hooks/        # Custom React hooks
│   ├── pages/        # Page components
│   └── types/        # TypeScript definitions
└── vite.config.ts    # Proxies /api to backend
```

## 🎯 Key Features

### What We Show
✅ **Contextual snippets:** "Bob has twins, needs 7-seater ASAP"  
✅ **Memory-based insights:** "Sarah said call in 3 months"  
✅ **Behavior scoring:** "Opened last 5 emails, mentioned competitor"  
✅ **Pattern recognition:** "8 leads mentioned tax refunds"  

### What We DON'T Show
❌ Vanity metrics like "Resolution Rate: 89%"  
❌ Abstract scores without context  
❌ Predictions without evidence  
❌ Charts for the sake of charts  

## 🔧 Development

### Environment Variables
Create `.env.local`:
```env
VITE_API_URL=http://localhost:3000  # Your backend URL
```

### Proxy Configuration
The Vite dev server proxies `/api` requests to your backend (port 3000 by default).

### Mock Data
When the API is unavailable, the app automatically falls back to realistic mock data for development.

## 🚢 Deployment

```bash
# Build production bundle
npm run build

# Preview production build locally
npm run preview

# Output is in dist/ folder
```

## 💡 Design Principles

1. **AI Agent as Hero** - It's the differentiator, keep it central
2. **Memory Over Metrics** - Show what customers said, not percentages
3. **Progressive Disclosure** - Don't overwhelm, reveal on demand
4. **Action-Oriented** - Every insight should suggest what to do
5. **Fast & Focused** - Single endpoint, minimal dependencies

## 🔄 API Contract

The dashboard expects this shape from `/api/dashboard`:

```typescript
{
  leads: Lead[];           // Leads with embedded insights
  intelligence: {
    followUps: [];         // Time-based reminders
    callList: [];          // Behavior-scored priorities
    campaigns: [];         // Pattern-based opportunities
  };
  agent: {
    suggestions: [];       // AI campaign ideas
    recentActivity: [];    // What's been happening
  };
  summary: {
    hotLeadsNeedingAttention: number;
    competitorMentions: string[];
    expiringOpportunities: string[];
  };
}
```

## 📝 Notes

- Uses React Query for caching - data refreshes every 60 seconds
- Drawer pattern for lead details keeps context while diving deep
- Tab navigation with counts shows where attention is needed
- Responsive design works on mobile through desktop

---

Built with the philosophy: **"If it doesn't help close a deal, it doesn't belong in the UI"**