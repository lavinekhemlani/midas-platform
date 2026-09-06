# Memory System: Complete Analysis & Streamlining Plan

## Executive Summary

This document provides a comprehensive analysis of the memory system, identifying critical gaps between UI presentation and actual implementation. The plan focuses on **eliminating complexity** by removing dead code, fixing UI-backend disconnects, and ensuring the UI accurately reflects available features.

**Key Finding**: The memory system has numerous partially-implemented features, unused code, and UI elements that don't match backend capabilities.

---

## Current System Architecture

### Memory Generation Flow

#### 1. Automatic Extraction (User Input Only)

**Location**: `/src/lib/ai/memory/memoryExtractor.ts`

**Trigger**: Every user chat message

**Flow**:

```
User Message → MemoryExtractor.extractMemories()
→ MemoryValidator (conflict detection)
→ DynamoDB Storage
→ Event Dispatch (memory-created)
```

**What Gets Extracted** (Pattern-Based with Regex):

| Memory Type             | Minimum Threshold | Pattern Keywords                                                                |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------- |
| **Future Expenses**     | $200+             | "expense/cost/payment of $X for [desc] on/by/in [DATE]"                         |
| **Financial Goals**     | $10,000+          | "goal/target/aim to reach/achieve/earn $X in [TIMEFRAME]"                       |
| **Key Dates**           | N/A               | "tax/audit/deadline/expires on [DATE]"                                          |
| **Strategic Decisions** | N/A               | 27 hardcoded keywords: "decided to hire", "switching to", "investing in", etc.  |
| **Business Context**    | N/A               | "we have X employees", "we're a [TYPE] company", partnerships, HQ, founded year |
| **User Preferences**    | N/A               | **NOT automatically extracted** - only via manual commands                      |

**Critical Limitation**:

- ✅ Extracts from user input
- ❌ Does NOT extract from AI responses/recommendations
- ❌ No automatic preference detection

#### 2. Manual Commands (Agent Tool)

**Location**: `/src/lib/ai/tools/memoryManagementTool.ts`

**Trigger**: User says "Remember that..." or agent uses manage_memory tool

**Actions Available**: `add`, `update`, `delete`, `search`, `list`, `edit_fields`

#### 3. Memory Storage

**Database**: AWS DynamoDB (`ai_cfo_memories` table)

**Keys**:

- PK: `USER#${userId}#${organizationId}`
- SK: `${memoryType}#${createdAt}`
- GSI for querying by type

**Memory Data Structure**:

```typescript
interface Memory {
  id: string // MEM#{UUID}
  userId: string
  organizationId: string
  type:
    | 'future_expense'
    | 'business_context'
    | 'financial_goal'
    | 'strategic_decision'
    | 'user_preference'
    | 'key_date'
  content: string
  metadata: {
    amount?: number
    date?: string // ISO format
    category?: string
    confidence?: number // 0-1
    source?: string
    tags?: string[]
    priority?: 'low' | 'medium' | 'high'
    recurring?: boolean
    frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
    currency?: string
    displayText?: string
    // Plus 20+ additional QuickBooks-specific fields
  }
  relevanceScore: number // 0-1
  createdAt: number // timestamp
  updatedAt: number
  extractedAt?: number
  expiresAt?: number // Optional TTL
  archived: boolean
}
```

**CRUD Operations** (`/src/app/api/memories/route.ts`):

- **GET**: Search/retrieve with filters (type, date range, search query)
- **POST**: Create new memory
- **PUT**: Update memory (content, metadata, relevance score, archived status)
- **DELETE**: Permanent deletion

**Conflict Detection** (`/src/lib/ai/memory/memoryValidator.ts`):

- Detects similar memories (50%+ term overlap)
- Identifies conflicts:
  - Amount difference > $0.01
  - Date difference > 1 day
  - Different categories for same type
- Auto-archives conflicting memories

---

## UI Components Analysis

### 1. MemoryViewer (Main Interface)

**Location**: `/src/app/(main)/components/memory/MemoryViewer.tsx`

**Features Implemented**:

- ✅ Filter by memory type (6 types)
- ✅ Toggle archived memories
- ✅ Search functionality (content + tags only)
- ✅ Edit memory content inline
- ✅ Archive/delete actions
- ✅ Relevance score visualization
- ✅ Display metadata: amount, date, priority, tags

**Critical Limitations**:

- ❌ **Edit button only edits `.content` field**
- ❌ Cannot edit: amount, date, category, priority, tags through UI
- ❌ Search doesn't cover all metadata fields
- ❌ No indication of memory source (auto vs manual)

### 2. MemorySummaryWidget (Dashboard)

**Location**: `/src/app/(main)/components/memory/MemorySummaryWidget.tsx`

**Features Implemented**:

- ✅ Count grid of each memory type
- ✅ Total memories count
- ✅ Upcoming expenses with total amount
- ✅ Active financial goals count
- ✅ Refresh on memory-created event
- ✅ "View All" link to memories page

**Dead Code**:

- ❌ **Calculates `nextKeyDate` but NEVER displays it**
- ❌ Data fetched but unused

### 3. MemoryPreviewChip (Chat Integration)

**Location**: `/src/app/(main)/chat/components/MemoryPreviewChip.tsx`

**Features**:

- ✅ Memory type badge with navigation
- ✅ Links to memories page

**Issue**:

- ❌ **Passes `highlight` parameter in URL but MemoryViewer doesn't use it**

### 4. MemoryCitationBadge (QuickBooks)

**Location**: `/src/components/quickbooks/shared/MemoryCitationBadge.tsx`

- ✅ Shows memory source citations (working as intended)

---

## Critical Issues & Gaps

### Category A: Features Shown in UI But Not Fully Implemented

#### 1. Memory Editing Interface

**Issue**: Edit button suggests full editing capability

**Reality**:

- Only edits `.content` text field
- Cannot edit structured metadata:
  - ❌ Amount
  - ❌ Date
  - ❌ Category
  - ❌ Priority
  - ❌ Tags
  - ❌ Recurring flag
  - ❌ Frequency

**Backend Support**: Full metadata editing exists via `memoryManagementTool.editMemoryFields`

**Gap**: UI doesn't expose 90% of editable fields

#### 2. Next Key Date Display

**Issue**: MemorySummaryWidget calculates but never displays next key date

**Code Location**: Line ~180-190 in MemorySummaryWidget.tsx

```typescript
const nextKeyDate =
  keyDates.length > 0
    ? new Date(Math.min(...keyDates.map((m) => new Date(m.metadata.date!).getTime())))
    : null
```

**Gap**: Variable assigned but not rendered in JSX

#### 3. Memory Highlight Navigation

**Issue**: MemoryPreviewChip passes `?highlight=${memoryId}` parameter

**Gap**: MemoryViewer captures parameter but doesn't scroll to or highlight the memory

---

### Category B: Implemented Features NOT Exposed in UI

#### 1. Memory Metadata Editing (Backend-Only)

**Available via memoryManagementTool**:

- Edit date
- Edit amount
- Edit currency
- Edit category
- Edit priority
- Set recurring flag
- Set frequency (daily/weekly/monthly/quarterly/yearly)

**How to Access**: Only through chat commands like "Remember that the $5000 expense should be on March 15th instead"

**Gap**: Zero UI interface for this functionality

#### 2. Memory Expiration (TTL)

**Infrastructure**: DynamoDB TTL support with `expiresAt` field

**Reality**:

- Field is optional
- Never set in code
- No UI to configure expiration
- Memories never auto-expire

**Gap**: Feature exists but unused

#### 3. Relevance Score Updates

**Backend Method**: `memoryManager.updateRelevance(memoryId, newScore)`

**UI**: Shows relevance score as progress bar

**Gap**: No way to recalculate or manually adjust relevance

#### 4. Memory Statistics

**Backend Method**: `memoryManager.getStats()`

**Returns**:

- Total count
- Count by type
- Archived count
- Recent count (last 7/30 days)

**Gap**: Never called or displayed anywhere

#### 5. Recurring Memory Support

**Data Structure**: Supports `recurring` boolean and `frequency` enum

**Reality**:

- Never extracted automatically
- Can only be set via manual commands
- Not displayed in UI
- No recurring memory logic

**Gap**: Half-implemented feature with no clear use case

---

### Category C: Inconsistent Behavior

#### 1. Confidence vs Relevance Score

**Extraction**: Sets `metadata.confidence` (0.7-0.9 based on pattern match quality)

**Storage**: Converts to `relevanceScore` field

**Manual Memories**: Default `relevanceScore = 0.8`

**UI**: Displays as "relevance"

**Issue**: Inconsistent naming creates confusion

#### 2. Memory Source Tracking

**Field**: `metadata.source` exists

**Automatic Extraction**: Implicitly set (not explicitly tracked)

**Manual Commands**: Sets to `undefined`

**UI**: No indication of source

**Issue**: Can't distinguish auto-extracted vs manually added memories

#### 3. Date Context Parameter

**Code**: `MemoryExtractor.extractMemories(input, currentDate?)`

**Reality**:

- Chat route passes `new Date()`
- Parameter documented
- **BUT**: `parseDate()` function ALWAYS uses `new Date()` internally, ignoring parameter

**Issue**: Dead parameter that doesn't affect behavior

#### 4. Currency Handling

**Extraction**: Auto-detects currency or uses organization default

**Storage**: Stores as-is (no conversion)

**Display**: Formats using currency code

**Issue**: No validation, potential for inconsistent currencies

---

### Category D: Dead Code & Unused Features

#### 1. MemoryEnhancer (Completely Unused)

**Location**: `/src/lib/ai/memory/memoryEnhancer.ts`

**Methods**:

- `getEnhancedContext()` - For report generation with memory insights
- `storeReportInsights()` - Store analysis results as memories
- `analyzeHistoricalPatterns()` - Find trends in memories

**Reality**: **NEVER called anywhere in codebase**

**Impact**: 300+ lines of dead code

#### 2. MemorySearchTool (Not Wired Up)

**Location**: `/src/lib/ai/tools/memorySearchTool.ts`

**Purpose**: Agent tool for searching memories with timeframe filters and grouping

**Reality**: Created but not added to any agent's tool list

**Impact**: Tool exists but inaccessible

#### 3. Metric Explanation Type (Removed but Referenced)

**Issue**: `metric_explanation` type was removed from `MemoryType` enum

**Still Referenced In**:

- MemorySearchTool description (line 16)
- MemoryEnhancer categorization logic

**Fallback**: Converts to `business_context`

**Impact**: Confusing code with references to non-existent type

#### 4. MemoryCommandParser Usage Unclear

**Location**: `/src/lib/ai/utils/memoryCommandParser.ts`

**Purpose**: Parse natural language memory commands

**Features**:

- Date confirmation logic
- Generates confirmation messages

**Reality**: Exists but unclear if actively used in agent flow

#### 5. Memory Statistics (Calculated but Unused)

**Method**: `memoryManager.getStats()`

**Reality**: Method exists, never called

**Impact**: Wasted computation potential

---

## Memory Integration with Chat

### Current Flow

#### 1. Memory Search in Chat (Line 413-417 of route.ts)

```
User Input → MemoryManager.search(query, limit: 5)
→ Top 5 relevant memories
→ Included in agent context
```

#### 2. Memory Extraction (Line 638-672)

```
User Input → MemoryExtractor.extractMemories()
→ MemoryValidator.validateAndStore() (conflict detection)
→ Store in DynamoDB
→ Dispatch memory-created event
```

#### 3. Agent Tools (Line 387-396)

```
Agent created with memoryManagementTool
User says "Remember..." → Tool processes command
Tool calls MemoryManager methods
Created memories tracked in tool.getCreatedMemories()
```

#### 4. Response Streaming (Lines 800-850+)

```
Memory events sent via SSE as type: 'memory_created'
Hook processes event → dispatches custom event
UI components listen for 'memory-created' event
Components refresh data
```

### Integration Issues

1. **Memory Usage in Reports**: Memories searched but rarely used contextually in financial reports
2. **No AI Output Extraction**: Only learns from explicit user statements, not from recommendations
3. **Limited Contextual Use**: Memories retrieved but not deeply integrated into analysis
4. **Event-Driven Architecture Risk**: Custom events could miss updates if components unmount during processing

---

## Streamlining Plan

### Phase 1: Fix Critical UI-Backend Disconnects (HIGH PRIORITY)

#### Task 1.1: Remove Unimplemented UI Elements

**Files**:

- `/src/app/(main)/components/memory/MemorySummaryWidget.tsx`

**Actions**:

- Remove `nextKeyDate` calculation (lines ~180-190)
- Remove related state/variables
- Or implement display if deemed valuable

**Impact**: Removes confusing dead code

#### Task 1.2: Fix Memory Highlight Navigation

**Files**:

- `/src/app/(main)/components/memory/MemoryViewer.tsx`
- `/src/app/(main)/chat/components/MemoryPreviewChip.tsx`

**Option A** (Implement):

- Add URL parameter parsing in MemoryViewer
- Auto-scroll to highlighted memory
- Add visual highlight effect (background flash/border)

**Option B** (Remove):

- Remove `highlight` parameter from MemoryPreviewChip navigation

**Recommendation**: Implement (useful feature, small effort)

#### Task 1.3: Standardize Memory Editing

**Decision Required**: Choose one approach

**Option A** (Full Metadata Editing):

- Extend MemoryViewer edit modal with structured form
- Add fields for: amount, date, category, priority, tags, recurring, frequency
- Use existing PUT endpoint

**Option B** (Content-Only Editing):

- Keep current UI as-is
- Remove metadata editing from `memoryManagementTool`
- Remove editMemoryFields functionality
- Simplify backend API

**Recommendation**: Option A (metadata editing is valuable, backend already supports it)

**Files to Modify**:

- `/src/app/(main)/components/memory/MemoryViewer.tsx` - Add expanded edit form
- Keep backend as-is

---

### Phase 2: Clean Up Dead Code (MEDIUM PRIORITY)

#### Task 2.1: Remove metric_explanation References

**Files**:

- `/src/lib/ai/tools/memorySearchTool.ts` (line 16)
- `/src/lib/ai/memory/memoryEnhancer.ts` (categorization logic)
- Any other references

**Actions**:

- Remove type from descriptions
- Update categorization to only use valid 6 types
- Add comment explaining why removed

**Impact**: Eliminates type confusion

#### Task 2.2: Remove MemoryEnhancer Class

**File**: `/src/lib/ai/memory/memoryEnhancer.ts`

**Action**: Delete entire file (never used anywhere)

**Verify**: Search codebase for imports before deletion

**Impact**: Removes 300+ lines of dead code

#### Task 2.3: Remove or Wire Up MemorySearchTool

**File**: `/src/lib/ai/tools/memorySearchTool.ts`

**Option A** (Remove):

- Delete file if not needed

**Option B** (Wire Up):

- Add to agent tools array in chat route
- Test functionality

**Decision**: Check with user if memory search tool is needed for agents

**Recommendation**: Remove (standard memory search already available via memoryManagementTool)

#### Task 2.4: Remove Unused Memory Statistics

**File**: `/src/lib/ai/memory/memoryManager.ts`

**Action**: Remove `getStats()` method (never called)

**Impact**: Simplifies codebase

---

### Phase 3: Standardize Memory Extraction (HIGH PRIORITY)

#### Task 3.1: Remove Unused currentDate Parameter

**File**: `/src/lib/ai/memory/memoryExtractor.ts`

**Action**:

- Remove `currentDate?: Date` parameter from `extractMemories()`
- Update all call sites
- `parseDate()` already uses `new Date()` internally

**Impact**: Cleaner API, removes confusion

#### Task 3.2: Standardize Confidence vs Relevance Score

**Files**:

- `/src/lib/ai/memory/memoryExtractor.ts`
- `/src/lib/ai/memory/types.ts`

**Action**:

- Rename `metadata.confidence` to `extractionConfidence` (clarify purpose)
- Keep `relevanceScore` as top-level field
- Add comment explaining difference:
  - `extractionConfidence`: How confident the extraction pattern was
  - `relevanceScore`: Overall relevance to user (used for search ranking)

**Impact**: Clear semantics

#### Task 3.3: Properly Set metadata.source

**File**: `/src/lib/ai/memory/memoryExtractor.ts`

**Action**:

- Set `metadata.source = 'automatic_extraction'` for all extracted memories
- Ensure manual commands set `metadata.source = 'manual'`
- Add source filter option in UI

**Impact**: Transparency about memory origin

---

### Phase 4: Complete Partial Features (MEDIUM PRIORITY)

#### Task 4.1: Add Full Metadata Editing UI

**File**: `/src/app/(main)/components/memory/MemoryViewer.tsx`

**Actions**:

1. Create expandable edit form with sections:
   - **Content**: Textarea for content
   - **Financial**: Amount, currency fields
   - **Scheduling**: Date picker, recurring toggle, frequency dropdown
   - **Organization**: Category dropdown, priority radio, tags input

2. Use existing PUT `/api/memories` endpoint

3. Add validation:
   - Amount must be number
   - Date must be valid ISO format
   - Frequency requires recurring=true

**Impact**: Full memory management capability

#### Task 4.2: Display Memory Source in UI

**File**: `/src/app/(main)/components/memory/MemoryViewer.tsx`

**Action**:

- Add badge/icon showing source (automatic vs manual)
- Add tooltip explaining source
- Filter option for source type

**Impact**: User transparency

#### Task 4.3: Show Recurring Information

**File**: `/src/app/(main)/components/memory/MemoryViewer.tsx`

**Action**:

- Display recurring badge if `metadata.recurring = true`
- Show frequency (e.g., "Monthly", "Quarterly")
- Add icon/visual indicator

**Impact**: Complete feature implementation

---

### Phase 5: Improve Memory Lifecycle (LOW PRIORITY)

#### Task 5.1: Implement Auto-Archiving

**Files**:

- `/src/lib/ai/memory/memoryManager.ts` (add method)
- Create cron job or scheduled task

**Actions**:

- Add `archiveOldMemories(daysOld: number)` method
- Archive memories older than 90 days (configurable)
- Exclude memories with future dates
- Run daily via cron

**Impact**: Prevents memory bloat

#### Task 5.2: Add Memory Count Limits

**File**: `/src/lib/ai/memory/memoryValidator.ts`

**Action**:

- Check total memory count before adding new
- If > limit (e.g., 1000), archive oldest memories
- Prioritize by relevance score
- Keep high-priority memories

**Impact**: Performance optimization

#### Task 5.3: Add TTL to Old Memories

**File**: `/src/lib/ai/memory/memoryManager.ts`

**Action**:

- Set `expiresAt` for archived memories (e.g., archived + 180 days)
- DynamoDB will auto-delete after TTL
- Add UI warning before archiving

**Impact**: Automatic cleanup

---

### Phase 6: Consider Removing Unused Features (OPTIONAL)

#### Option: Remove Recurring Memory Support

**Rationale**:

- Never automatically extracted
- Unclear use case
- Adds complexity to data model

**Action**: Remove `recurring` and `frequency` fields entirely

**Alternative**: Keep fields but add documentation for future use

---

## Implementation Priority Matrix

| Priority     | Task                                  | Effort | Impact | Files Modified |
| ------------ | ------------------------------------- | ------ | ------ | -------------- |
| **CRITICAL** | Remove nextKeyDate dead code          | Low    | Low    | 1              |
| **CRITICAL** | Implement memory highlight navigation | Low    | Medium | 2              |
| **CRITICAL** | Add full metadata editing UI          | High   | High   | 1              |
| **CRITICAL** | Remove metric_explanation refs        | Low    | Low    | 2-3            |
| **HIGH**     | Remove unused currentDate param       | Low    | Low    | 2              |
| **HIGH**     | Standardize confidence/relevance      | Low    | Medium | 2              |
| **HIGH**     | Set metadata.source properly          | Low    | Medium | 2              |
| **HIGH**     | Delete MemoryEnhancer class           | Low    | Low    | 1              |
| **MEDIUM**   | Display memory source in UI           | Medium | Medium | 1              |
| **MEDIUM**   | Show recurring info in UI             | Low    | Low    | 1              |
| **MEDIUM**   | Remove/wire MemorySearchTool          | Low    | Low    | 1              |
| **MEDIUM**   | Remove unused getStats()              | Low    | Low    | 1              |
| **LOW**      | Implement auto-archiving              | Medium | Medium | 2              |
| **LOW**      | Add memory count limits               | Medium | Low    | 1              |
| **LOW**      | Add TTL to archived memories          | Low    | Low    | 1              |

---

## Recommended Implementation Order

### Sprint 1: Critical Fixes (1-2 days)

1. ✅ Remove nextKeyDate dead code
2. ✅ Remove metric_explanation references
3. ✅ Delete MemoryEnhancer class
4. ✅ Remove unused currentDate parameter
5. ✅ Remove unused getStats() method

**Goal**: Clean up dead code, zero functional changes

### Sprint 2: UI-Backend Alignment (2-3 days)

1. ✅ Implement memory highlight navigation
2. ✅ Add full metadata editing UI with form
3. ✅ Set metadata.source properly in extraction
4. ✅ Display memory source badges in UI

**Goal**: Make UI accurately reflect backend capabilities

### Sprint 3: Standardization (1 day)

1. ✅ Standardize confidence vs relevance naming
2. ✅ Show recurring info in UI
3. ✅ Remove MemorySearchTool (if not needed)

**Goal**: Consistent naming and complete features

### Sprint 4: Lifecycle Management (Optional, 1-2 days)

1. ⚠️ Implement auto-archiving for old memories
2. ⚠️ Add memory count limits
3. ⚠️ Add TTL to archived memories

**Goal**: Prevent memory bloat over time

---

## Testing Checklist

### Phase 1 Testing

- [ ] MemorySummaryWidget renders without nextKeyDate variable
- [ ] Clicking memory in chat scrolls to and highlights it in MemoryViewer
- [ ] Edit modal allows changing amount, date, category, priority, tags
- [ ] Edited metadata persists after save
- [ ] Validation prevents invalid amounts/dates

### Phase 2 Testing

- [ ] No TypeScript errors after removing metric_explanation
- [ ] No import errors after deleting MemoryEnhancer
- [ ] Memory extraction still works without currentDate param
- [ ] Search functionality unaffected by dead code removal

### Phase 3 Testing

- [ ] metadata.source set to 'automatic_extraction' for auto memories
- [ ] metadata.source set to 'manual' for manual commands
- [ ] Source badge displays correctly in UI
- [ ] Confidence vs relevance scores calculated correctly

### Phase 4 Testing

- [ ] Recurring badge shows when recurring=true
- [ ] Frequency displays correctly (Monthly, Quarterly, etc.)
- [ ] Auto-archiving runs on schedule
- [ ] Memory count limits enforced
- [ ] TTL set on archived memories

---

## Files Requiring Changes

### Delete Entirely

- `/src/lib/ai/memory/memoryEnhancer.ts` (unused)
- `/src/lib/ai/tools/memorySearchTool.ts` (unused, optional)

### Major Modifications

- `/src/app/(main)/components/memory/MemoryViewer.tsx` (add full editing UI)
- `/src/lib/ai/memory/memoryExtractor.ts` (remove param, set source)
- `/src/app/(main)/components/memory/MemorySummaryWidget.tsx` (remove dead code)

### Minor Modifications

- `/src/lib/ai/memory/types.ts` (rename confidence field)
- `/src/lib/ai/memory/memoryManager.ts` (remove getStats, add archiving)
- `/src/lib/ai/tools/memoryManagementTool.ts` (update descriptions)
- `/src/app/(main)/chat/components/MemoryPreviewChip.tsx` (ensure highlight param)

---

## Success Metrics

### Code Quality

- **Lines of Code Removed**: Target 400+ lines (dead code)
- **Unused Methods Removed**: Target 5+ methods
- **Type Inconsistencies Fixed**: 1 (metric_explanation)

### UI-Backend Alignment

- **UI Features Without Backend**: 0 (currently 1 - nextKeyDate display)
- **Backend Features Without UI**: 0 (currently 5 - metadata editing, source, stats, TTL, recurring display)

### User Experience

- **Edit Capabilities**: 8 fields editable (currently 1)
- **Memory Source Transparency**: 100% (currently 0%)
- **Dead UI Elements**: 0 (currently 2)

---

## Risks & Mitigation

### Risk 1: Breaking Existing Functionality

**Mitigation**:

- Comprehensive testing after each phase
- Keep git commits atomic
- Deploy to staging first

### Risk 2: User Confusion from UI Changes

**Mitigation**:

- Add tooltips explaining new fields
- Provide examples in edit form
- Add help documentation

### Risk 3: Performance Impact from Auto-Archiving

**Mitigation**:

- Run during low-traffic hours
- Batch process memories
- Monitor execution time

---

## Post-Implementation Recommendations

### Documentation Needed

1. Memory type definitions and when each is used
2. Extraction patterns with examples
3. Metadata field purposes and usage
4. Memory lifecycle (creation → archiving → deletion)

### Future Enhancements (Out of Scope)

1. AI output memory extraction (analyze recommendations)
2. Automatic preference detection from behavior
3. Memory clustering/categorization
4. Memory timeline visualization
5. Bulk memory operations
6. Memory export/import functionality

---

## Conclusion

The memory system has solid foundations but suffers from incomplete implementation and dead code. This plan focuses on **honesty over features**: making the UI accurately reflect what's implemented, removing what's unused, and completing half-finished features.

**Key Principle**: Every UI element should have a working backend, and every backend feature should be accessible via UI.

By following this plan, we'll have a streamlined, maintainable memory system that's easier to extend and debug in the future.
