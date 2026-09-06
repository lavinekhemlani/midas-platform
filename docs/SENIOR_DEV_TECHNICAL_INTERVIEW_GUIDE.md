# Technical Interview Guide - Senior Developer Position

## Overview

This guide provides structured interview questions and evaluation criteria for assessing senior developer candidates for the Midas platform.

## Technical Screen Questions (60 minutes)

### Part 1: React/TypeScript Fundamentals (20 min)

**Question 1: Server vs Client Components**
"In our Next.js 15 app, when would you use Server Components vs Client Components? Give specific examples from a financial dashboard."

_Look for:_

- Understanding of React Server Components
- Knowledge of hydration and interactivity requirements
- Performance considerations
- Data fetching patterns

**Question 2: TypeScript Type Safety**
"We have financial data coming from multiple providers (QuickBooks, Zoho). How would you design TypeScript interfaces to ensure type safety while handling provider-specific differences?"

_Look for:_

- Use of generics and discriminated unions
- Interface composition and extension
- Type guards and runtime validation (Zod mention is a plus)

### Part 2: Live Coding Challenge (25 min)

**Challenge: Build a Financial KPI Calculator**

```typescript
// Task: Implement a function that calculates key financial metrics
// Input: Array of transactions from the last 30 days
// Output: Object with calculated KPIs

interface Transaction {
  id: string
  date: string
  amount: number
  type: 'income' | 'expense'
  category: string
  vendor?: string
}

interface KPIResult {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  burnRate: number
  topExpenseCategories: Array<{ category: string; total: number }>
  dailyAverageRevenue: number
}

// Implement this function
function calculateKPIs(transactions: Transaction[]): KPIResult {
  // Your code here
}
```

_Evaluation Criteria:_

- Code organization and readability
- Proper TypeScript usage
- Edge case handling
- Performance considerations
- Testing approach discussion

### Part 3: System Design Discussion (15 min)

**Question: Caching Strategy**
"Our users query financial reports frequently. Design a caching strategy that balances data freshness with performance. Consider that financial data changes when new transactions are added."

_Look for:_

- Multi-layer caching approach (Redis + in-memory)
- Cache invalidation strategies
- Understanding of TTL and cache keys
- Consideration of user-specific data

## Code Review Exercise (Async - Take Home)

### Instructions for Candidate

Review this pull request from our codebase and provide feedback:

```typescript
// File: src/lib/providers/quickbooks/reports.ts
// PR Title: "Add profit margin calculation to reports"

export async function getProfitAndLoss(realm_id: string, period: string) {
  const data = await fetchFromQuickBooks(`/reports/profitandloss`, {
    realm_id,
    period,
  })

  // New addition
  const revenue = data.rows.find((r) => r.type === 'revenue').total
  const expenses = data.rows.find((r) => r.type === 'expenses').total
  const profitMargin = ((revenue - expenses) / revenue) * 100

  return {
    ...data,
    profitMargin: profitMargin.toFixed(2) + '%',
  }
}
```

_What we're looking for in the review:_

1. Error handling issues (division by zero, missing rows)
2. Type safety concerns
3. Business logic accuracy
4. Code organization suggestions
5. Performance considerations

## System Design Interview (90 minutes)

### Challenge: Design a Real-Time Financial Alert System

**Requirements:**

- Monitor transactions across multiple accounting providers
- Send alerts for anomalies, low cash balance, large transactions
- Support custom alert rules per organization
- Handle 10,000 organizations with average 100 transactions/day
- Sub-minute alert latency requirement

**Discussion Points:**

1. Architecture diagram
2. Data flow design
3. Technology choices and trade-offs
4. Scaling strategy
5. Failure handling
6. Testing approach

### Evaluation Rubric

| Area                 | Junior                | Mid                 | Senior               | Staff                            |
| -------------------- | --------------------- | ------------------- | -------------------- | -------------------------------- |
| **Problem Solving**  | Needs guidance        | Solves with hints   | Independent solution | Optimal solution with trade-offs |
| **Code Quality**     | Basic implementation  | Clean code          | Production-ready     | Exemplary patterns               |
| **System Design**    | Component level       | Service level       | System level         | Enterprise level                 |
| **Communication**    | Unclear explanations  | Clear when prompted | Proactive clarity    | Teaches concepts                 |
| **Domain Knowledge** | No fintech experience | Some B2B SaaS       | Fintech familiar     | Deep financial systems           |

## AI/LangChain Specific Questions

### Question 1: Agent Architecture

"Our AI system uses multiple specialized agents. How would you handle agent communication and prevent infinite loops?"

### Question 2: Token Optimization

"LLM API costs are significant. How would you optimize token usage while maintaining response quality?"

### Question 3: Memory Management

"Design a conversation memory system that maintains context across sessions but respects token limits."

## Cultural Fit Questions

1. **Startup Experience**
   "Describe a time when requirements changed dramatically mid-project. How did you adapt?"

2. **Technical Leadership**
   "How would you mentor our junior developers while maintaining your own velocity?"

3. **Competing Against Giants**
   "Intuit could copy our features. What technical advantages could we maintain?"

4. **Quality vs Speed**
   "We need to ship fast but can't compromise on financial data accuracy. How do you balance this?"

## Red Flags to Watch For

- Over-engineering simple problems
- Inability to explain technical decisions
- No experience with production-scale systems
- Rigid thinking about technology choices
- Poor communication skills
- Lack of interest in the fintech domain
- No questions about our technical challenges

## Green Flags to Look For

- Experience with similar technical stacks
- Thoughtful approach to trade-offs
- Clear communication of complex ideas
- Passion for the problem space
- Examples of technical leadership
- Understanding of startup constraints
- Questions about our architecture and scale

## Post-Interview Evaluation

### Must Have

- [ ] Strong React/Next.js skills demonstrated
- [ ] TypeScript proficiency
- [ ] System design capabilities
- [ ] Clear communication
- [ ] Problem-solving ability

### Nice to Have

- [ ] LangChain/LLM experience
- [ ] Financial domain knowledge
- [ ] AWS expertise
- [ ] Startup experience
- [ ] Technical leadership examples

### Decision Framework

- **Strong Yes**: Exceeds senior level in 3+ areas
- **Yes**: Meets senior level across all areas
- **Maybe**: Meets most areas, coachable on others
- **No**: Missing critical skills or cultural fit

## Sample Scoring Sheet

```
Candidate: ________________  Date: ________________

Technical Screen (60 min)
- React/TypeScript: ___/10
- Live Coding: ___/10
- System Discussion: ___/10

Code Review (Async)
- Issue Identification: ___/10
- Solution Quality: ___/10

System Design (90 min)
- Architecture: ___/10
- Scalability: ___/10
- Trade-offs: ___/10

Cultural Fit (60 min)
- Communication: ___/10
- Startup Fit: ___/10

Total: ___/100

Recommendation: [ ] Strong Yes [ ] Yes [ ] Maybe [ ] No

Notes:
_________________________________________________
```
