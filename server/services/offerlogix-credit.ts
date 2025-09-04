import { z } from 'zod';
import { 
  OfferLogixCreditDecisionSchema, 
  type OfferLogixCreditDecision,
  getOfferLogixCreditSchemaPrompt,
  parseAndValidate
} from './prompt-schemas';

/**
 * OfferLogix Instant Credit Decision Service
 * Provides real-time credit decisions for automotive financing
 */

export interface CreditApplication {
  // Applicant Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Financial Information
  creditScore?: number;
  creditTier?: 'excellent' | 'good' | 'fair' | 'challenged';
  monthlyIncome: number;
  monthlyExpenses?: number;
  employmentStatus: 'employed' | 'self_employed' | 'retired' | 'other';
  employmentDuration?: string;
  
  // Vehicle & Financing
  vehiclePrice: number;
  downPayment: number;
  tradeInValue?: number;
  requestedTerm: number; // in months
  
  // Additional
  housingStatus: 'own' | 'rent' | 'other';
  bankruptcy?: boolean;
  coApplicant?: boolean;
}

export class OfferLogixCreditService {
  /**
   * Process instant credit decision
   */
  async processInstantDecision(
    application: CreditApplication,
    openaiClient: any
  ): Promise<OfferLogixCreditDecision> {
    const prompt = this.buildCreditPrompt(application);
    
    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an OfferLogix instant credit specialist. Evaluate applications and provide immediate financing decisions.
            ${getOfferLogixCreditSchemaPrompt()}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      return parseAndValidate(content, OfferLogixCreditDecisionSchema, 'OfferLogixCredit');
    } catch (error) {
      console.error('Credit decision error:', error);
      return this.getFallbackDecision(application);
    }
  }

  /**
   * Build credit evaluation prompt
   */
  private buildCreditPrompt(app: CreditApplication): string {
    const loanAmount = app.vehiclePrice - app.downPayment - (app.tradeInValue || 0);
    const dti = app.monthlyExpenses ? (app.monthlyExpenses / app.monthlyIncome * 100).toFixed(1) : 'unknown';
    const ltv = ((loanAmount / app.vehiclePrice) * 100).toFixed(1);
    
    return `Evaluate this instant credit application:

APPLICANT: ${app.firstName} ${app.lastName}
Credit Score: ${app.creditScore || 'Not provided'}
Credit Tier: ${app.creditTier || 'Unknown'}
Monthly Income: $${app.monthlyIncome.toLocaleString()}
Employment: ${app.employmentStatus} ${app.employmentDuration ? `for ${app.employmentDuration}` : ''}
Housing: ${app.housingStatus}
${app.bankruptcy ? 'Previous bankruptcy: Yes' : ''}
${app.coApplicant ? 'Co-applicant available: Yes' : ''}

FINANCING REQUEST:
Vehicle Price: $${app.vehiclePrice.toLocaleString()}
Down Payment: $${app.downPayment.toLocaleString()}
Trade-In Value: $${(app.tradeInValue || 0).toLocaleString()}
Loan Amount: $${loanAmount.toLocaleString()}
Requested Term: ${app.requestedTerm} months
LTV: ${ltv}%
DTI: ${dti}${dti !== 'unknown' ? '%' : ''}

Provide instant decision with approval amount, rate estimate, and next steps.`;
  }

  /**
   * Fallback decision when API fails
   */
  private getFallbackDecision(app: CreditApplication): OfferLogixCreditDecision {
    const tier = app.creditTier || 'unknown';
    const score = app.creditScore || 0;
    
    if (tier === 'excellent' || score >= 750) {
      return {
        decision: 'approved',
        approvalAmount: app.vehiclePrice - (app.tradeInValue || 0),
        estimatedRate: 4.9,
        monthlyPayment: this.calculatePayment(
          app.vehiclePrice - app.downPayment - (app.tradeInValue || 0),
          4.9,
          app.requestedTerm
        ),
        requiredDocs: ['Proof of income', 'Proof of identity'],
        conditions: [],
        alternativeOptions: [],
        nextSteps: ['Complete online application', 'Upload documents', 'Schedule delivery'],
        complianceNotes: ['ECOA compliant', 'Rate subject to verification']
      };
    } else if (tier === 'good' || score >= 650) {
      return {
        decision: 'conditional',
        approvalAmount: app.vehiclePrice * 0.9,
        estimatedRate: 7.9,
        requiredDocs: ['Proof of income', 'Bank statements', 'References'],
        conditions: ['Income verification required', 'Insurance verification'],
        alternativeOptions: [
          { type: 'larger_downpayment', description: 'Increase down payment to 20% for better terms' }
        ],
        nextSteps: ['Submit full application', 'Provide documentation', 'Await final approval'],
        complianceNotes: ['Conditional approval pending verification']
      };
    } else {
      return {
        decision: 'pending',
        requiredDocs: ['Full application', 'Proof of income', 'Bank statements'],
        conditions: ['Manual review required'],
        alternativeOptions: [
          { type: 'co_signer', description: 'Add a co-signer to strengthen application' },
          { type: 'special_finance', description: 'Explore special finance programs' }
        ],
        nextSteps: ['Complete detailed application', 'Speak with finance specialist'],
        complianceNotes: ['Further review needed']
      };
    }
  }

  /**
   * Calculate monthly payment
   */
  private calculatePayment(principal: number, apr: number, months: number): number {
    const rate = apr / 100 / 12;
    const payment = principal * (rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
    return Math.round(payment);
  }

  /**
   * Get pre-qualification without full application
   */
  async getPreQualification(
    creditTier: string,
    income: number,
    vehiclePrice: number
  ): Promise<Partial<OfferLogixCreditDecision>> {
    const maxLoan = income * 0.15 * 48; // 15% of income for 48 months
    const qualified = maxLoan >= vehiclePrice * 0.8;
    
    return {
      decision: qualified ? 'conditional' : 'pending',
      approvalAmount: Math.min(maxLoan, vehiclePrice),
      requiredDocs: ['Income verification', 'Identity verification'],
      nextSteps: qualified 
        ? ['Complete full application for instant decision']
        : ['Speak with finance specialist for options']
    };
  }
}