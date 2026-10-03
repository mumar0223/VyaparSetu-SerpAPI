import { fetchLiveBankLendingRates, BankLoanRateInfo } from "../serpapi-service";

export interface EMICalculatorPayload {
  principal: number;
  annualInterestRate: number;
  tenureMonths: number;
  monthlyEMI: number;
  totalInterest: number;
  totalPayment: number;
  amortizationPreview: Array<{
    month: number;
    principalPaid: number;
    interestPaid: number;
    remainingBalance: number;
  }>;
  bankComparisons: BankLoanRateInfo[];
  insights: {
    monthlyBurden: "comfortable" | "moderate" | "high";
    recommendation: string;
    mudraEligible: boolean;
  };
}

export function calculateEMI(principal: number, annualRate: number, months: number): {
  monthlyEMI: number;
  totalInterest: number;
  totalPayment: number;
  amortizationPreview: Array<{
    month: number;
    principalPaid: number;
    interestPaid: number;
    remainingBalance: number;
  }>;
} {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) {
    const emi = principal / months;
    return {
      monthlyEMI: Math.round(emi),
      totalInterest: 0,
      totalPayment: principal,
      amortizationPreview: [],
    };
  }

  const factor = Math.pow(1 + monthlyRate, months);
  const emi = (principal * monthlyRate * factor) / (factor - 1);
  const monthlyEMI = Math.round(emi);
  const totalPayment = monthlyEMI * months;
  const totalInterest = totalPayment - principal;

  // Generate 6-month preview
  let balance = principal;
  const preview: Array<{
    month: number;
    principalPaid: number;
    interestPaid: number;
    remainingBalance: number;
  }> = [];

  for (let m = 1; m <= Math.min(months, 12); m++) {
    const interest = Math.round(balance * monthlyRate);
    const principalPaid = Math.min(balance, monthlyEMI - interest);
    balance = Math.max(0, balance - principalPaid);

    preview.push({
      month: m,
      principalPaid,
      interestPaid: interest,
      remainingBalance: balance,
    });
  }

  return {
    monthlyEMI,
    totalInterest,
    totalPayment,
    amortizationPreview: preview,
  };
}

/**
 * Autonomous Sub-Agent for Credit, Loan & EMI Evaluation.
 * Woken up by the Head Agent with user requirements.
 */
export async function runCreditEMISubAgent(params: {
  amount?: number;
  tenureYears?: number;
  interestRate?: number;
  monthlyRevenue?: number;
  purpose?: string;
}): Promise<EMICalculatorPayload> {
  const principal = params.amount || 500000; // Default ₹5 Lakh
  const years = params.tenureYears || 3;
  const months = years * 12;
  const rate = params.interestRate || 10.5;

  // 1. Fetch live bank benchmarks via SerpApi
  const bankComparisons = await fetchLiveBankLendingRates(principal <= 1000000 ? "mudra" : "msme");

  // 2. Perform EMI computation
  const { monthlyEMI, totalInterest, totalPayment, amortizationPreview } = calculateEMI(principal, rate, months);

  // 3. Assess financial viability
  const monthlyRevenue = params.monthlyRevenue || (principal * 0.4);
  const debtRatio = (monthlyEMI / monthlyRevenue) * 100;

  let burden: "comfortable" | "moderate" | "high" = "comfortable";
  let recommendation = "Viable debt structure. Monthly EMI consumes under 25% of estimated net cash flow.";

  if (debtRatio > 40) {
    burden = "high";
    recommendation = `High debt servicing burden (${debtRatio.toFixed(0)}% of monthly revenue). Consider extending tenure from ${years} to ${years + 2} years or availing CGTMSE collateral-free support.`;
  } else if (debtRatio > 25) {
    burden = "moderate";
    recommendation = `Moderate EMI burden (${debtRatio.toFixed(0)}% of monthly revenue). Ensure a 2-month working capital buffer.`;
  }

  return {
    principal,
    annualInterestRate: rate,
    tenureMonths: months,
    monthlyEMI,
    totalInterest,
    totalPayment,
    amortizationPreview,
    bankComparisons,
    insights: {
      monthlyBurden: burden,
      recommendation,
      mudraEligible: principal <= 1000000,
    },
  };
}
