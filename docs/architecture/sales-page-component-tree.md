# Sales Page Component Tree Diagram

## Visual Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SalesPage (Container)                          │
│                         [200 lines - Orchestration]                     │
│                                                                          │
│  State: activeTab, period, dateRange                                    │
│  Data: useSalesCustomer(), useSalesProduct()                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌─────────────────────┐         ┌──────────────────────┐
        │    SalesHeader      │         │     SalesTabs        │
        │   [80 lines]        │         │   [120 lines]        │
        │                     │         │                      │
        │  - PeriodSelector   │         │  Tab: Overview       │
        │  - DateRangeDisplay │         │  Tab: Customers      │
        │                     │         │  Tab: Products       │
        └─────────────────────┘         │  Tab: Outstanding    │
                                        └──────────────────────┘
                                                   │
                ┌──────────────────────────────────┼──────────────────────────────────┐
                ▼                                  ▼                                  ▼
    ┌─────────────────────┐          ┌─────────────────────┐          ┌─────────────────────┐
    │  OverviewSection    │          │  CustomersSection   │          │  ProductsSection    │
    │   [200 lines]       │          │   [250 lines]       │          │   [300 lines]       │
    └─────────────────────┘          └─────────────────────┘          └─────────────────────┘
                │                                 │                                 │
                │                                 │                                 │
    ┌───────────┴────────────┐      ┌────────────┴───────────┐      ┌────────────┴────────────┐
    ▼                        ▼      ▼                        ▼      ▼                         ▼
┌─────────┐          ┌──────────┐ ┌──────────┐        ┌──────────┐ ┌──────────┐        ┌──────────┐
│ Summary │          │  Charts  │ │   KPIs   │        │  Table   │ │   KPIs   │        │  Charts  │
│  KPIs   │          │  Grid    │ │(4 cards) │        │          │ │(4 cards) │        │  Grid    │
│         │          │          │ │          │        │          │ │          │        │  (4)     │
└─────────┘          └──────────┘ └──────────┘        └──────────┘ └──────────┘        └──────────┘


                                                                  ┌─────────────────────┐
                                                                  │ OutstandingSection  │
                                                                  │   [150 lines]       │
                                                                  └─────────────────────┘
                                                                              │
                                                                  ┌───────────┴───────────┐
                                                                  ▼                       ▼
                                                          ┌──────────────┐        ┌─────────────┐
                                                          │    Header    │        │    Table    │
                                                          │  (total,     │        │             │
                                                          │   count)     │        │             │
                                                          └──────────────┘        └─────────────┘
```

---

## Tab-Based Navigation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Page Header                                  │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Sales Analysis  │  [This Year ▼]  │  Jan 1 - Dec 26, 2025   │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                          Tab Navigation                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐       │
│  │ Overview │  │Customers │  │ Products │  │ Outstanding (12) │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┬───────────────┐
                    ▼               ▼               ▼               ▼
            ┌─────────────┐  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  Overview   │  │  Customers  │ │  Products   │ │ Outstanding │
            │   Content   │  │   Content   │ │   Content   │ │   Content   │
            │             │  │             │ │             │ │             │
            │  - KPIs     │  │  - KPIs     │ │  - KPIs     │ │  - Header   │
            │  - Top 10   │  │  - Table    │ │  - Charts   │ │  - Table    │
            │  - Charts   │  │  - Detail   │ │  - Table    │ │  - Insights │
            │  - AI       │  │    Panel    │ │  - Detail   │ │             │
            │             │  │             │ │    Panel    │ │             │
            └─────────────┘  └─────────────┘ └─────────────┘ └─────────────┘
```

---

## Customer Section Detail (Example)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         CustomersSection Component                         │
│                              [250 lines total]                             │
└────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌───────────────────┐       ┌──────────────────┐      ┌─────────────────────┐
│  CustomerKPIs     │       │ CustomersTable   │      │ CustomerDetailPanel │
│  [100 lines]      │       │  [200 lines]     │      │   [existing]        │
│                   │       │                  │      │                     │
│  ┌─────────────┐  │       │  ┌────────────┐  │      │  Conditional render │
│  │ Total Sales │  │       │  │   Header   │  │      │  if customer        │
│  │  KPICard    │  │       │  │ (sortable) │  │      │  selected           │
│  └─────────────┘  │       │  └────────────┘  │      │                     │
│  ┌─────────────┐  │       │  ┌────────────┐  │      │  ┌────────────────┐ │
│  │  Customers  │  │       │  │    Body    │  │      │  │   Summary      │ │
│  │  KPICard    │  │       │  │  (rows)    │  │      │  └────────────────┘ │
│  └─────────────┘  │       │  └────────────┘  │      │  ┌────────────────┐ │
│  ┌─────────────┐  │       │                  │      │  │  Transactions  │ │
│  │Transactions │  │       │  Props:          │      │  │     List       │ │
│  │  KPICard    │  │       │  - customers     │      │  └────────────────┘ │
│  └─────────────┘  │       │  - onSort        │      │  ┌────────────────┐ │
│  ┌─────────────┐  │       │  - onRowClick    │      │  │   Transaction  │ │
│  │ Avg/Customer│  │       │  - selectedId    │      │  │     Detail     │ │
│  │  KPICard    │  │       │                  │      │  │  (conditional) │ │
│  └─────────────┘  │       └──────────────────┘      │  └────────────────┘ │
└───────────────────┘                                  └─────────────────────┘
                                                                  │
                                                       Uses hook: │
                                                                  ▼
                                                      ┌──────────────────────┐
                                                      │  useCustomerSort.ts  │
                                                      │   [80 lines]         │
                                                      │                      │
                                                      │  - sortedCustomers   │
                                                      │  - sortBy            │
                                                      │  - sortOrder         │
                                                      │  - handleSort()      │
                                                      └──────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         External Data Sources                            │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │ useSalesCustomer()    │       │ useSalesProduct()     │
        │                       │       │                       │
        │  - Fetches data       │       │  - Fetches data       │
        │  - Handles loading    │       │  - Handles loading    │
        │  - Handles errors     │       │  - Handles errors     │
        │  - SWR caching        │       │  - SWR caching        │
        └───────────────────────┘       └───────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                        ┌───────────────────────┐
                        │   SalesPage (parent)  │
                        │                       │
                        │  Receives:            │
                        │  - customerData       │
                        │  - productData        │
                        │  - loading states     │
                        │  - errors             │
                        └───────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
        │ CustomersSection│ │ ProductsSection │ │OutstandingSection│
        │                 │ │                 │ │                  │
        │ Props:          │ │ Props:          │ │ Props:           │
        │ - data          │ │ - data          │ │ - data           │
        │ - loading       │ │ - loading       │ │ - loading        │
        │ - error         │ │ - error         │ │ - error          │
        │ - dateRange     │ │ - dateRange     │ │ - dateRange      │
        └─────────────────┘ └─────────────────┘ └──────────────────┘
                │                   │                     │
                ▼                   ▼                     ▼
        ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐
        │ useCustomerSort │ │ useProductSort  │ │useOutstandingSort│
        │                 │ │                 │ │                  │
        │  Processes:     │ │  Processes:     │ │  Processes:      │
        │  - Sorting      │ │  - Sorting      │ │  - Sorting       │
        │  - Filtering    │ │  - Filtering    │ │  - Filtering     │
        │                 │ │                 │ │                  │
        └─────────────────┘ └─────────────────┘ └──────────────────┘
                │                   │                     │
                ▼                   ▼                     ▼
        ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐
        │  Table          │ │  Table          │ │  Table           │
        │  Component      │ │  Component      │ │  Component       │
        │                 │ │                 │ │                  │
        │  Renders:       │ │  Renders:       │ │  Renders:        │
        │  - Sorted data  │ │  - Sorted data  │ │  - Sorted data   │
        │  - Headers      │ │  - Headers      │ │  - Headers       │
        │  - Rows         │ │  - Rows         │ │  - Rows          │
        └─────────────────┘ └─────────────────┘ └──────────────────┘
```

---

## State Management Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│                          GLOBAL CONTEXT LAYER                          │
│                                                                        │
│  SalesContext              CurrencyContext         CompanyContext     │
│  - period                  - currency              - companyData      │
│  - dateRange               - setCurrency           - metadata         │
│  - setPeriod               - formatCurrency        - settings         │
│  - setDateRange                                                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ consumed by
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         PAGE-LEVEL STATE LAYER                         │
│                          (SalesPage component)                         │
│                                                                        │
│  Navigation State:         Data State:              Derived State:    │
│  - activeTab               - customerData           - outstandingTotal│
│                            - productData            - topCustomers    │
│                            - loading                - productInsights │
│                            - error                                    │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ passed as props
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SECTION-LEVEL STATE LAYER                        │
│                    (CustomersSection, ProductsSection)                 │
│                                                                        │
│  Selection State:          Interaction State:                         │
│  - selectedCustomer        - expandedRows                             │
│  - selectedProduct         - filters                                  │
│  - selectedTransaction     - localSearch                              │
│                                                                        │
│  Sorting State (via hook):                                            │
│  - sortBy                                                              │
│  - sortOrder                                                           │
│  - sortedData                                                          │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ passed as props
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION COMPONENTS LAYER                       │
│              (Tables, Charts, Detail Panels - NO STATE)                │
│                                                                        │
│  Pure Components:                                                      │
│  - Receive data via props                                              │
│  - Fire callbacks for interactions                                     │
│  - No internal state (except UI ephemeral state like hover)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Interaction Flow: Customer Selection

```
User clicks customer row
        │
        ▼
┌─────────────────────┐
│  CustomersTable     │  ← Calls onRowClick(customer)
│  onClick handler    │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ CustomersSection    │  ← Updates local state
│ setSelected(cust)   │     setSelectedCustomer(customer)
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ React re-renders    │  ← Conditional rendering
│                     │     {selected && <DetailPanel />}
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ CustomerDetailPanel │  ← Receives customer via props
│ appears (slide-in)  │     Shows summary + transactions
└─────────────────────┘
        │
        │ User clicks transaction
        ▼
┌─────────────────────┐
│ CustomerDetailPanel │  ← Calls onTransactionClick()
│ onClick handler     │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ CustomersSection    │  ← Updates state again
│ setTransaction(txn) │     setSelectedTransaction(txn)
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ CustomerDetailPanel │  ← Re-renders with transaction detail
│ shows txn detail    │     Shows invoice/receipt info
└─────────────────────┘
```

---

## Sorting Flow Diagram

```
User clicks "Total Sales" column header
        │
        ▼
┌──────────────────────────┐
│  SortableTableHeader     │  ← Calls onSort('totalSales')
│  onClick handler         │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  useCustomerSort hook    │  ← Updates sort state
│                          │     if (sortBy === field)
│  handleSort(field)       │       toggle sortOrder
│                          │     else
│                          │       setSortBy(field)
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  useMemo recalculates    │  ← Sorts data array
│                          │     [...data].sort((a,b) => {
│  sortedData              │       // sort logic
│                          │     })
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  CustomersTable          │  ← Receives new sortedData
│  re-renders with         │     Updates header indicators
│  new order               │     Shows ↑ or ↓ arrow
└──────────────────────────┘
```

---

## Responsive Layout Breakpoints

```
Mobile (<768px)
┌─────────────────────┐
│      Header         │
│   [Period Selector] │
├─────────────────────┤
│   Tab Navigation    │
│  (horizontal scroll)│
├─────────────────────┤
│                     │
│   Active Tab        │
│   Content           │
│   (full width)      │
│                     │
│   - KPIs stack      │
│   - Tables scroll   │
│   - Detail panels   │
│     overlay         │
│                     │
└─────────────────────┘

Tablet (768px - 1280px)
┌──────────────────────────────┐
│         Header               │
│      [Period Selector]       │
├──────────────────────────────┤
│      Tab Navigation          │
│   [Overview][Customers]...   │
├──────────────────────────────┤
│                              │
│    Active Tab Content        │
│                              │
│  ┌─────────┐  ┌─────────┐   │
│  │  KPI    │  │  KPI    │   │
│  └─────────┘  └─────────┘   │
│  ┌─────────┐  ┌─────────┐   │
│  │  KPI    │  │  KPI    │   │
│  └─────────┘  └─────────┘   │
│                              │
│  ┌────────────────────────┐ │
│  │      Table             │ │
│  │  (horizontal scroll)   │ │
│  └────────────────────────┘ │
│                              │
└──────────────────────────────┘

Desktop (>1280px)
┌───────────────────────────────────────────────────────┐
│              Header + Period Selector                 │
├───────────────────────────────────────────────────────┤
│          Tab Navigation                               │
│  [Overview] [Customers] [Products] [Outstanding]      │
├───────────────────────────────────────────────────────┤
│                                                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │  KPI   │ │  KPI   │ │  KPI   │ │  KPI   │        │
│  └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                       │
│  ┌──────────────────────────┐ ┌──────────────────┐   │
│  │                          │ │                  │   │
│  │     Table                │ │  Detail Panel    │   │
│  │     (2/3 width)          │ │  (1/3 width)     │   │
│  │                          │ │  (conditional)   │   │
│  │                          │ │                  │   │
│  └──────────────────────────┘ └──────────────────┘   │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Component Reusability Matrix

| Component              | Used In             | Times Reused |
| ---------------------- | ------------------- | ------------ |
| KPICard                | All sections        | 12+ times    |
| SortableTableHeader    | All tables          | 3 tables     |
| DetailPanel pattern    | Customers, Products | 2 sections   |
| useTableSort hook      | All tables          | 3 tables     |
| useSelectionState hook | Customers, Products | 2 sections   |
| SectionHeader          | All sections        | 4 sections   |
| BackgroundPattern      | KPICard             | 12+ times    |

---

**Document Version:** 1.0
**Last Updated:** 2025-12-26
**Companion to:** sales-page-redesign.md
