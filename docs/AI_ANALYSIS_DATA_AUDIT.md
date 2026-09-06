# AI Analysis Data Audit - Current vs. Available Data

**Date:** November 19, 2025
**Purpose:** Identify what data is currently passed to AI vs. what's available for richer analysis

---

## Executive Summary

Currently, we're passing **only aggregated metrics** to the AI Analysis API. However, the API responses contain **much richer data** including:

- Line-item breakdowns (revenue/expense categories)
- Detailed cash flow activities (operating/investing/financing breakdowns)
- Asset/liability composition
- Historical trends and comparisons
- Calculated ratios and health metrics

**Opportunity:** By passing this detailed data, AI can provide:

- Category-level insights (e.g., "Marketing spend up 40% while CAC worsening")
- Line-item anomaly detection
- Cross-category correlation analysis
- More specific, actionable recommendations

---

## 1. P&L Page Analysis

### Currently Passed ❌ Limited

```typescript
data: {
  metrics: {
    totalRevenue,        // Just the total
    totalExpenses,       // Just the total
    netIncome,
    grossMargin,
    operatingMargin,
  },
  previousPeriod: {
    previousRevenue,
    previousExpenses,
    previousNetIncome,
  }
}
```

### Available But NOT Passed ✅ Rich Data

```typescript
// From `data` object (API response):
{
  revenueByCategory: [
    { name: "Product Sales", value: 150000 },
    { name: "Service Revenue", value: 50000 },
    { name: "Subscriptions", value: 30000 },
    // ... top 10 categories
  ],

  expenseCategories: [
    { name: "Marketing", amount: 45000 },
    { name: "Salaries", amount: 80000 },
    { name: "Infrastructure", amount: 25000 },
    // ... all categories
  ],

  kpis: {
    costOfGoodsSold,
    operatingExpenses,
    otherExpenses,
    grossProfit,
    ebitda,
    netProfitMargin,
    // ... many more
  }
}

// Calculated in component:
{
  incomeBreakdown,        // Top 10 revenue sources
  expenseBreakdown,       // All expense categories with COGS
  plFlowData,            // Waterfall data
  costOfGoodsSold,
  operatingExpenses,
  otherExpenses,
  grossBurnRate,
  netBurnRate,
  runway,
}
```

### Impact of Missing Data

- ❌ AI can't identify which revenue stream is growing/declining
- ❌ AI can't spot which expense category is ballooning
- ❌ AI can't correlate expense categories with revenue performance
- ❌ AI can't recommend specific category-level actions

---

## 2. Cash Flow Page Analysis

### Currently Passed ❌ Limited

```typescript
data: {
  metrics: {
    operatingCashFlow,      // Just totals
    investingCashFlow,
    financingCashFlow,
    cashBalance: cashEnding,
    burnRate: data.cashMetrics?.burnRate,
  }
},
context: {
  dso: data.cashMetrics?.dso,
  dpo: data.cashMetrics?.dpo,
  runway: data.cashMetrics?.runway,
  ...contextData,
}
```

### Available But NOT Passed ✅ Rich Data

```typescript
// From API response:
{
  kpis: {
    operatingCashFlow,
    investingCashFlow,
    financingCashFlow,
    netCashFlow,
    cashBeginning,
    cashEnding,
  },

  operatingActivities: [
    { name: "Customer Collections", value: 180000 },
    { name: "Vendor Payments", value: -120000 },
    { name: "Payroll", value: -80000 },
    // ... breakdown of operating activities
  ],

  investingActivities: [
    { name: "Equipment Purchase", value: -25000 },
    { name: "Asset Sale", value: 10000 },
    // ... breakdown
  ],

  financingActivities: [
    { name: "Loan Proceeds", value: 50000 },
    { name: "Debt Repayment", value: -15000 },
    // ... breakdown
  ],

  cashMetrics: {
    dso,  // Days Sales Outstanding
    dpo,  // Days Payable Outstanding
    dio,  // Days Inventory Outstanding
    burnRate,
    runway,
    cashConversionCycle,
    freeCashFlow,
    // ... more metrics
  }
}

// Calculated in component:
{
  waterfallData,         // Detailed cash flow waterfall
  monthlyFlowData,       // Time-series data
  periodMonths,
}
```

### Impact of Missing Data

- ❌ AI can't identify which operating activities are cash drains
- ❌ AI can't spot investment patterns or CapEx trends
- ❌ AI can't analyze financing structure changes
- ❌ AI can't provide specific recommendations on collections/payables

---

## 3. Balance Sheet Page Analysis

### Currently Passed ❌ Limited

```typescript
data: {
  metrics: {
    totalAssets,           // Just totals
    totalLiabilities,
    totalEquity,
    currentAssets: data.kpis?.currentAssets,
    currentLiabilities: data.kpis?.currentLiabilities,
  }
}
```

### Available But NOT Passed ✅ Rich Data

```typescript
// From API response:
{
  kpis: {
    totalAssets,
    totalLiabilities,
    totalEquity,
    currentAssets,
    currentLiabilities,
    cashAndEquivalents,
    accountsReceivable,
    inventory,
    accountsPayable,
    // ... many more
  },

  assetComposition: [
    { category: "Current Assets", amount: 500000, percentage: 45 },
    { category: "Fixed Assets", amount: 300000, percentage: 27 },
    { category: "Intangible Assets", amount: 200000, percentage: 18 },
    // ... breakdown
  ],

  liabilityBreakdown: [
    { category: "Current Liabilities", amount: 200000, percentage: 40 },
    { category: "Long-term Debt", amount: 250000, percentage: 50 },
    // ... breakdown
  ],

  equityComposition: [
    { category: "Retained Earnings", amount: 150000 },
    { category: "Common Stock", amount: 400000 },
    // ... breakdown
  ],

  ratios: {
    currentRatio,
    quickRatio,
    debtToEquity,
    debtToAssets,
    equityMultiplier,
    // ... calculated ratios
  }
}

// Calculated in component:
{
  currentRatio,
  debtToEquity,
  monthlyTrendData,      // Time-series balance sheet trends
}
```

### Impact of Missing Data

- ❌ AI can't analyze asset composition efficiency
- ❌ AI can't identify liability structure issues
- ❌ AI can't provide specific recommendations on working capital components
- ❌ AI can't detect balance sheet trends over time

---

## 4. Executive Summary Page Analysis

### Currently Passed ⚠️ Partially Rich

```typescript
data: {
  pnlMetrics,            // Object with totals
  bsMetrics,             // Object with totals
  cfMetrics,             // Object with totals
  cfExtendedMetrics,     // Extended cash metrics
  cashBalance,
  grossBurnRate,
  periodMonths,
},
context: {
  ...contextData,        // Has some calculated metrics
  healthScore,           // Health score object
  previousPeriodData: {
    revenue,
    expenses,
    cashBalance,
    burnRate,
    twoPeriodAgoRevenue,
  },
}
```

### Available But NOT Passed ✅ Very Rich Data

```typescript
// From API responses (pnlData, cashFlowData, balanceSheetData):
{
  pnlData: {
    data: {
      kpis: { /* all P&L KPIs */ },
      revenueByCategory: [ /* breakdown */ ],
      expenseCategories: [ /* breakdown */ ],
      previousRevenue,
      previousExpenses,
      twoPeriodAgoRevenue,
    }
  },

  cashFlowData: {
    data: {
      kpis: { /* all CF KPIs */ },
      operatingActivities: [ /* breakdown */ ],
      investingActivities: [ /* breakdown */ ],
      financingActivities: [ /* breakdown */ ],
      cashMetrics: { /* DSO, DPO, DIO, etc. */ },
      previousCashBalance,
      previousBurnRate,
    }
  },

  balanceSheetData: {
    data: {
      kpis: { /* all BS KPIs */ },
      assetComposition: [ /* breakdown */ ],
      liabilityBreakdown: [ /* breakdown */ ],
      equityComposition: [ /* breakdown */ ],
      ratios: { /* all calculated ratios */ },
    }
  },

  // Additional context calculated in component:
  bills: {
    totalUnpaid,
    overdueAmount,
    upcomingAmount,
    breakdown: [ /* vendor breakdown */ ],
  },

  payments: {
    totalOutstanding,
    overdueAmount,
    upcomingAmount,
    breakdown: [ /* customer breakdown */ ],
  },

  healthScore: {
    score: 85,
    rating: "Good",
    components: [
      { metricId: "gross_margin", name: "Gross Margin", score: 90, weight: 25, status: "excellent" },
      { metricId: "cash_runway", name: "Cash Runway", score: 75, weight: 25, status: "good" },
      // ... all 4 metrics with details
    ]
  },

  // Rich KPI list (15+ KPIs with calculated values):
  kpiList: [
    { id: "revenue", label: "Total Revenue", value: "$230K", ... },
    { id: "gross_margin", label: "Gross Margin", value: "65%", ... },
    { id: "operating_margin", label: "Operating Margin", value: "25%", ... },
    // ... 15+ more KPIs
  ]
}
```

### Impact of Missing Data

- ⚠️ Summary has more data than individual pages, but still missing breakdowns
- ❌ AI can't see which revenue/expense categories drive overall health
- ❌ AI can't correlate health score components with underlying data
- ❌ AI can't analyze bills/payments patterns affecting cash flow
- ❌ AI can't provide category-specific recommendations in summary

---

## Recommended Enhancements

### Priority 1: Add Category Breakdowns ⭐⭐⭐

**P&L Page:**

```typescript
data: {
  metrics: { /* existing */ },
  revenueByCategory: incomeBreakdown,      // ADD
  expenseCategories: expenseBreakdown,      // ADD
  previousPeriod: { /* existing */ },
}
```

**Impact:** AI can identify which categories are growing/shrinking

---

### Priority 2: Add Activity Breakdowns ⭐⭐⭐

**Cash Flow Page:**

```typescript
data: {
  metrics: { /* existing */ },
  operatingActivities: data.operatingActivities,      // ADD
  investingActivities: investingActivities,           // ADD
  financingActivities: financingActivities,           // ADD
}
```

**Impact:** AI can pinpoint specific cash flow sources/uses

---

### Priority 3: Add Composition Data ⭐⭐

**Balance Sheet Page:**

```typescript
data: {
  metrics: { /* existing */ },
  assetComposition: data.assetComposition || [],      // ADD
  liabilityBreakdown: data.liabilityBreakdown || [],  // ADD
  equityComposition: data.equityComposition || [],    // ADD
  ratios: data.ratios || {},                          // ADD
}
```

**Impact:** AI can analyze asset/liability structure

---

### Priority 4: Enhance Summary Page ⭐⭐⭐

**Executive Summary:**

```typescript
data: {
  pnlMetrics,
  bsMetrics,
  cfMetrics,
  cfExtendedMetrics,

  // ADD DETAILED BREAKDOWNS:
  revenueByCategory: pnlData?.data?.revenueByCategory || [],
  expenseCategories: pnlData?.data?.expenseCategories || [],
  operatingActivities: cashFlowData?.data?.operatingActivities || [],
  investingActivities: cashFlowData?.data?.investingActivities || [],
  financingActivities: cashFlowData?.data?.financingActivities || [],
  assetComposition: balanceSheetData?.data?.assetComposition || [],
  liabilityBreakdown: balanceSheetData?.data?.liabilityBreakdown || [],

  // ADD CALCULATED METRICS:
  cashBalance,
  grossBurnRate,
  netBurnRate,
  runway,
  periodMonths,

  // ADD BILLS/PAYMENTS:
  unpaidBills: unpaidBillsData?.data || {},
  outstandingPayments: paymentsData?.data || {},
}
```

**Impact:** Most comprehensive analysis with cross-functional insights

---

## Expected Benefits

### With Current Data (Totals Only):

- ✅ High-level trend analysis
- ✅ Basic predictions
- ✅ Generic recommendations

### With Enhanced Data (Breakdowns + Details):

- ✅ **Category-level insights** ("Marketing ROI declining")
- ✅ **Anomaly detection** ("Utilities cost spiked 150% this month")
- ✅ **Correlation analysis** ("Revenue mix shifting to lower-margin products")
- ✅ **Specific actions** ("Reduce AWS spend by $5K/mo" vs "Cut expenses")
- ✅ **Root cause analysis** ("Collections slowing: DSO up 15 days")
- ✅ **Predictive patterns** ("Q4 shows seasonal 30% revenue drop")

---

## Implementation Complexity

| Change           | Files | Lines   | Complexity  | Impact        |
| ---------------- | ----- | ------- | ----------- | ------------- |
| P&L Categories   | 1     | +5      | Low         | High          |
| CF Activities    | 1     | +7      | Low         | High          |
| BS Composition   | 1     | +8      | Low         | Medium        |
| Summary Enhanced | 1     | +20     | Medium      | Very High     |
| **Total**        | **4** | **~40** | **Low-Med** | **Very High** |

**Time Estimate:** 30-45 minutes

---

## Next Steps

1. ✅ **Audit Complete** - Documented what data is available
2. ⏭️ **Get Approval** - Confirm which data to add
3. ⏭️ **Implement Changes** - Update 4 view files
4. ⏭️ **Test AI Output** - Verify richer insights
5. ⏭️ **Iterate** - Add more data if needed

---

## Sample AI Output Comparison

### Before (Current - Totals Only):

```
## STRATEGIC INSIGHTS
- Revenue grew 15% while expenses increased 12%, improving net margin
- Cash runway of 8 months provides adequate buffer
- Operating cash flow positive, indicating healthy operations

## PRIORITIZED ACTIONS
1. Monitor expense growth rate to maintain margin expansion
2. Consider deploying excess cash for growth investments
3. Review pricing strategy to sustain revenue momentum
```

### After (With Breakdowns):

```
## STRATEGIC INSIGHTS
- **Product revenue up 25% BUT Service revenue down 10%** = Revenue mix shifting to lower-margin products (45% vs 65% GM)
- **Marketing spend up 40% ($18K→$25K) while CAC increased 30%** = Marketing efficiency degrading
- **DSO extended from 35→47 days** = $45K cash trapped in receivables, not revenue growth issue

## PRIORITIZED ACTIONS
1. **Optimize marketing channels**: Cut bottom 3 channels ($8K/mo) showing >$200 CAC, keep top 2 at $75 CAC (immediate +$8K/mo)
2. **Accelerate collections**: Implement net-15 terms for new customers, reduce DSO to 35 days = unlock $45K cash (30 days)
3. **Shift product mix**: Upsell high-GM services to top 20 customers = +$12K/mo margin (60 days)
```

**Difference:** Generic → Specific, Vague → Quantified, Surface → Root Cause
