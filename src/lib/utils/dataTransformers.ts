// src/lib/utils/dataTransformers.ts

/**
 * Calculate customer metrics from raw data
 */
export function calculateCustomerMetrics(
  customers: any[],
  invoices: any[],
  payments: any[]
) {
  const metrics = {
    totalCustomers: customers.length,
    activeCustomers: 0,
    newCustomersThisMonth: 0,
    averageRevenue: 0,
    topPayingCustomers: [] as any[],
    paymentBehavior: {
      excellent: 0,
      good: 0,
      needsAttention: 0
    },
    creditRisk: {
      low: 0,
      medium: 0,
      high: 0
    }
  };

  // Calculate active customers (those with invoices in last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const customerMap = new Map<string, {
    revenue: number;
    invoiceCount: number;
    lastInvoiceDate: Date | null;
    paidOnTime: number;
    totalPaid: number;
    outstanding: number;
  }>();

  // Initialize customer map
  customers.forEach(customer => {
    customerMap.set(customer.contact_id, {
      revenue: 0,
      invoiceCount: 0,
      lastInvoiceDate: null,
      paidOnTime: 0,
      totalPaid: 0,
      outstanding: parseFloat(customer.outstanding_receivable_amount || '0')
    });
  });

  // Process invoices
  invoices.forEach(invoice => {
    const customerId = invoice.customer_id;
    const customer = customerMap.get(customerId);
    
    if (customer) {
      customer.revenue += parseFloat(invoice.total || '0');
      customer.invoiceCount++;
      
      const invoiceDate = new Date(invoice.date);
      if (!customer.lastInvoiceDate || invoiceDate > customer.lastInvoiceDate) {
        customer.lastInvoiceDate = invoiceDate;
      }
      
      // Check if paid on time
      if (invoice.status === 'paid' && invoice.due_date && invoice.last_payment_date) {
        const dueDate = new Date(invoice.due_date);
        const paymentDate = new Date(invoice.last_payment_date);
        if (paymentDate <= dueDate) {
          customer.paidOnTime++;
        }
      }
      
      customer.totalPaid += parseFloat(invoice.payment_made || '0');
    }
  });

  // Calculate metrics
  let totalRevenue = 0;
  customerMap.forEach((data, customerId) => {
    totalRevenue += data.revenue;
    
    // Active if invoiced in last 90 days
    if (data.lastInvoiceDate && data.lastInvoiceDate > ninetyDaysAgo) {
      metrics.activeCustomers++;
    }
    
    // Payment behavior
    if (data.invoiceCount > 0) {
      const onTimeRate = data.paidOnTime / data.invoiceCount;
      if (onTimeRate >= 0.9) {
        metrics.paymentBehavior.excellent++;
      } else if (onTimeRate >= 0.7) {
        metrics.paymentBehavior.good++;
      } else {
        metrics.paymentBehavior.needsAttention++;
      }
    }
    
    // Credit risk based on outstanding amount
    if (data.outstanding === 0) {
      metrics.creditRisk.low++;
    } else if (data.outstanding < data.revenue * 0.1) {
      metrics.creditRisk.medium++;
    } else {
      metrics.creditRisk.high++;
    }
  });

  // Average revenue per customer
  metrics.averageRevenue = metrics.totalCustomers > 0 
    ? totalRevenue / metrics.totalCustomers 
    : 0;

  // Top paying customers
  const customerArray = Array.from(customerMap.entries())
    .map(([id, data]) => ({
      customerId: id,
      customerName: customers.find(c => c.contact_id === id)?.contact_name || 'Unknown',
      ...data
    }))
    .sort((a, b) => b.revenue - a.revenue);
  
  metrics.topPayingCustomers = customerArray.slice(0, 10);

  // New customers this month (created in current month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  metrics.newCustomersThisMonth = customers.filter(customer => {
    const createdDate = new Date(customer.created_time);
    return createdDate.getMonth() === currentMonth && 
           createdDate.getFullYear() === currentYear;
  }).length;

  return metrics;
}

/**
 * Transform expense data into category breakdown
 */
export function transformExpenseData(expenses: any[]) {
  const categoryMap = new Map<string, {
    amount: number;
    count: number;
    percentage?: number;
  }>();
  
  let totalAmount = 0;
  
  expenses.forEach(expense => {
    const category = expense.category_name || 'Uncategorized';
    const amount = parseFloat(expense.total || expense.amount || '0');
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { amount: 0, count: 0 });
    }
    
    const cat = categoryMap.get(category)!;
    cat.amount += amount;
    cat.count++;
    totalAmount += amount;
  });
  
  // Calculate percentages and convert to array
  const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
    name,
    amount: data.amount,
    count: data.count,
    percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
  }));
  
  return {
    categories: categories.sort((a, b) => b.amount - a.amount),
    totalAmount
  };
}

/**
 * Calculate invoice aging
 */
export function calculateInvoiceAging(invoices: any[]) {
  const today = new Date();
  const aging = {
    current: { count: 0, amount: 0 },
    days1_30: { count: 0, amount: 0 },
    days31_60: { count: 0, amount: 0 },
    days61_90: { count: 0, amount: 0 },
    over90: { count: 0, amount: 0 }
  };
  
  invoices.forEach(invoice => {
    if (invoice.status === 'paid' || invoice.balance === 0) return;
    
    const dueDate = new Date(invoice.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const amount = parseFloat(invoice.balance || '0');
    
    if (daysOverdue <= 0) {
      aging.current.count++;
      aging.current.amount += amount;
    } else if (daysOverdue <= 30) {
      aging.days1_30.count++;
      aging.days1_30.amount += amount;
    } else if (daysOverdue <= 60) {
      aging.days31_60.count++;
      aging.days31_60.amount += amount;
    } else if (daysOverdue <= 90) {
      aging.days61_90.count++;
      aging.days61_90.amount += amount;
    } else {
      aging.over90.count++;
      aging.over90.amount += amount;
    }
  });
  
  return aging;
}

/**
 * Calculate cash flow trends
 */
export function calculateCashFlowTrends(transactions: any[], days: number = 30) {
  const dailyFlow = new Map<string, { inflow: number; outflow: number }>();
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - days);
  
  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    dailyFlow.set(dateStr, { inflow: 0, outflow: 0 });
  }
  
  // Process transactions
  transactions.forEach(transaction => {
    const date = transaction.date;
    const amount = Math.abs(parseFloat(transaction.amount || '0'));
    
    if (dailyFlow.has(date)) {
      const flow = dailyFlow.get(date)!;
      if (transaction.debit_or_credit === 'debit') {
        flow.inflow += amount;
      } else {
        flow.outflow += amount;
      }
    }
  });
  
  // Convert to array and calculate cumulative
  let cumulativeBalance = 0;
  const trends = Array.from(dailyFlow.entries()).map(([date, flow]) => {
    const net = flow.inflow - flow.outflow;
    cumulativeBalance += net;
    
    return {
      date,
      inflow: flow.inflow,
      outflow: flow.outflow,
      net,
      balance: cumulativeBalance
    };
  });
  
  return trends;
}

/**
 * Transform bank transactions for cash flow chart
 * This is the function used by the cashflow page
 */
export function transformBankTransactionsForCashFlow(transactions: any[], days: number = 30) {
  const dailyMap = new Map<string, { inflow: number; outflow: number }>();
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - days);
  
  // Initialize all days with zero values
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    dailyMap.set(dateStr, { inflow: 0, outflow: 0 });
  }
  
  // Process transactions
  transactions.forEach(transaction => {
    const transactionDate = new Date(transaction.date);
    // Only include transactions within the specified period
    if (transactionDate >= startDate && transactionDate <= today) {
      const dateStr = transaction.date.split('T')[0]; // Ensure consistent date format
      const rawAmount = parseFloat(transaction.amount || '0');
      const amount = Math.abs(rawAmount);
      
      if (dailyMap.has(dateStr)) {
        const daily = dailyMap.get(dateStr)!;
        
        // Handle different transaction formats
        if (transaction.type) {
          // New format from transformedTransactions: type field indicates direction
          if (transaction.type === 'invoice') {
            daily.inflow += amount;
          } else if (transaction.type === 'expense') {
            daily.outflow += amount;
          }
        } else if (transaction.debit_or_credit) {
          // Bank transaction format: debit = money IN, credit = money OUT
          if (transaction.debit_or_credit === 'debit') {
            daily.inflow += amount;
          } else if (transaction.debit_or_credit === 'credit') {
            daily.outflow += amount;
          }
        } else {
          // Fallback: positive = inflow, negative = outflow
          if (rawAmount > 0) {
            daily.inflow += amount;
          } else {
            daily.outflow += amount;
          }
        }
      }
    }
  });
  
  // Convert to array format for DailyCashFlowChart component
  return Array.from(dailyMap.entries())
    .map(([date, flows]) => ({
      date,
      day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      inflow: Math.round(flows.inflow * 100) / 100,
      outflow: Math.round(flows.outflow * 100) / 100,
      net: Math.round((flows.inflow - flows.outflow) * 100) / 100
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Format currency based on locale and currency code
 */
export function formatCurrency(
  amount: number, 
  currencyCode: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Calculate financial ratios
 */
export function calculateFinancialRatios(financialData: any) {
  const ratios = {
    currentRatio: 0,
    quickRatio: 0,
    debtToEquity: 0,
    grossMargin: 0,
    netMargin: 0,
    returnOnAssets: 0,
    workingCapital: 0
  };
  
  // Current Ratio = Current Assets / Current Liabilities
  if (financialData.currentLiabilities > 0) {
    ratios.currentRatio = financialData.currentAssets / financialData.currentLiabilities;
  }
  
  // Quick Ratio = (Current Assets - Inventory) / Current Liabilities
  if (financialData.currentLiabilities > 0) {
    ratios.quickRatio = (financialData.currentAssets - (financialData.inventory || 0)) / financialData.currentLiabilities;
  }
  
  // Debt to Equity = Total Debt / Total Equity
  if (financialData.totalEquity > 0) {
    ratios.debtToEquity = financialData.totalDebt / financialData.totalEquity;
  }
  
  // Gross Margin = (Revenue - COGS) / Revenue
  if (financialData.revenue > 0) {
    ratios.grossMargin = ((financialData.revenue - financialData.cogs) / financialData.revenue) * 100;
  }
  
  // Net Margin = Net Income / Revenue
  if (financialData.revenue > 0) {
    ratios.netMargin = (financialData.netIncome / financialData.revenue) * 100;
  }
  
  // Return on Assets = Net Income / Total Assets
  if (financialData.totalAssets > 0) {
    ratios.returnOnAssets = (financialData.netIncome / financialData.totalAssets) * 100;
  }
  
  // Working Capital = Current Assets - Current Liabilities
  ratios.workingCapital = financialData.currentAssets - financialData.currentLiabilities;
  
  return ratios;
}