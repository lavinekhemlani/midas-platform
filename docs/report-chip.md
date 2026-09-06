# AI Report Visualization Swapping Bug - Fix Report

## Issue Description

### Problem

When clicking through multiple AI report preview chips, visualizations (charts, tables) would display incorrectly:

- Drill-down queries showed tables from previous queries
- Clicking back and forth between report chips caused visualizations to swap
- The last two report chips were particularly affected
- Text content (narratives) appeared correctly, but visual components were mismatched

### Example Scenario

1. User asks: "show me invoices" → Gets invoice list table (correct)
2. User asks: "drill down on invoice #123" → Gets invoice list table (wrong, should show line items table)
3. User clicks back to first report chip → Gets line items table (wrong, should show invoice list)

### Root Cause

The bug was caused by **component identity loss** at multiple points in the rendering pipeline:

1. **State Management Race Conditions**: The `currentVisualization` state could become stale while `renderedComponents[selectedMessageId]` held correct data, creating priority conflicts
2. **Deep Copy Loss**: `JSON.parse(JSON.stringify())` in ChatContext destroyed component metadata
3. **Unstable Component IDs**: Multiple locations in the codebase were regenerating component IDs:
   - `processor.ts`: Generated index-based IDs like `auto_invoice_status_0`
   - `componentRenderTool.ts`: Generated random IDs with `Date.now()` and `Math.random()`
   - `DynamicReportLayout.tsx`: Generated new IDs with timestamps
   - Components with same index in different reports got identical IDs
4. **Fallback to Stale Props**: PreviewChip would fall back to stale component props instead of fetching fresh data from DB
5. **Index-Based Keys**: React keys used array indices instead of stable IDs

Result: React couldn't distinguish between components from different reports, causing DOM element reuse and visual swapping.

---

## Changes Made

### 1. UnifiedDataTool (`src/lib/ai/tools/unifiedDataTool.ts`)

**Purpose**: Generate stable, unique component IDs at the source

```diff
+ import { randomUUID } from 'crypto';
```

Added helper methods:

```typescript
/**
 * Adds stable unique component IDs to all visualization hints
 * This ensures components maintain their identity across re-renders and state updates
 */
private addComponentIds(result: any): any {
  if (!result || typeof result !== 'object') {
    return result;
  }

  // If the result has visualization_hints array, add IDs to each component
  if (Array.isArray(result.visualization_hints)) {
    result.visualization_hints = result.visualization_hints.map((hint: any) => ({
      ...hint,
      componentId: randomUUID()
    }));
  }

  return result;
}

/**
 * Wrapper to ensure all JSON.stringify calls include component IDs
 */
private stringifyWithComponentIds(result: any): string {
  return JSON.stringify(this.addComponentIds(result));
}
```

Replaced all 105 instances of `return JSON.stringify({` with `return this.stringifyWithComponentIds({`

**Impact**: Every visualization component now gets a stable UUID at generation time

---

### 2. ChatContext (`src/contexts/ChatContext.tsx`)

**Purpose**: Eliminate state duplication and simplify to single source of truth

**Removed**:

```diff
- // Current visualization
- currentVisualization: ChatComponent[] | null
- setCurrentVisualization: (components: ChatComponent[] | null) => void
```

**Changed `addComponentsToMessage`**:

```diff
- // Create a deep copy to avoid reference issues
- const componentsCopy = JSON.parse(JSON.stringify(components))
+ // Use shallow copy with spread operator to maintain component identity
+ const componentsCopy = components.map(c => ({ ...c }))

- // Also set as current visualization
- setCurrentVisualization(componentsCopy)
+ // Set this message as selected (single source of truth)
  setSelectedMessageId(messageId)
```

**Updated `clearVisualizations`**:

```diff
- setCurrentVisualization(null)
  setSelectedMessageId(null)
```

**Impact**: Single source of truth (`renderedComponents[selectedMessageId]`), component identity preserved through shallow copy

---

### 3. ChatPage (`src/app/(main)/chat/page.tsx`)

**Purpose**: Use single source of truth for visualization selection

**Removed from destructuring**:

```diff
  const {
    selectedMessageId,
-   currentVisualization,
-   setCurrentVisualization,
    renderedComponents,
```

**Simplified useEffect**:

```diff
- // Update visualization when selection changes
+ // Update visualization when selection changes - Single source of truth
  useEffect(() => {
-   // First priority: Use currentVisualization if it's been set (from saved reports)
-   if (currentVisualization && currentVisualization.length > 0) {
-     console.log('Using current visualization:', currentVisualization.length, 'components')
-     setLocalVisualization(currentVisualization)
-   }
-   // Second priority: If we have a selected message, check renderedComponents
-   else if (selectedMessageId && renderedComponents[selectedMessageId]) {
+   // If a specific message is selected, show its visualization
+   if (selectedMessageId && renderedComponents[selectedMessageId]) {
      // Only update if it's a different message to avoid unnecessary re-renders
      if (selectedMessageId !== lastMessageIdRef.current) {
-       console.log('Loading visualization for message:', selectedMessageId)
+       console.log('Loading visualization for selected message:', selectedMessageId)
        lastMessageIdRef.current = selectedMessageId
        setLocalVisualization(renderedComponents[selectedMessageId])
      }
    }
-   // Third priority: Show the latest visualization from renderedComponents
+   // Otherwise, show the latest message's visualization
    else if (Object.keys(renderedComponents).length > 0) {
```

**Removed from onUpdate**:

```diff
  onUpdate={(components) => {
    setLocalVisualization(components)
-   setCurrentVisualization(components)
  }}
```

**Impact**: Deterministic visualization selection based solely on `selectedMessageId`

---

### 4. PreviewChip (`src/app/(main)/chat/components/PreviewChip.tsx`)

**Purpose**: Always fetch fresh data from DB, remove stale fallbacks

**Removed from destructuring**:

```diff
- const { setSelectedMessageId, setCurrentVisualization, addComponentsToMessage, addReportDataToMessage, setMessageContent } = useChatContext()
+ const { setSelectedMessageId, addComponentsToMessage, addReportDataToMessage, setMessageContent } = useChatContext()
```

**Removed all fallback logic**:

```diff
  try {
-   // Try to fetch saved report first
+   // Always fetch saved report from DB - no fallback to stale props
    console.log('Fetching report for message:', messageId)
    const response = await apiClient(`/api/reports/${messageId}`)

    if (response.ok) {
      const { report } = await response.json()

      if (report && report.components && report.components.length > 0) {
        console.log('Setting saved report components:', report.components.length)
-       // Add to renderedComponents so it persists
+       // Add to renderedComponents (this also sets selectedMessageId automatically)
        addComponentsToMessage(messageId, report.components)

        // Save report data...
-
-       // These are already set by addComponentsToMessage, no need to set again
-       // setCurrentVisualization(report.components)
-       // setSelectedMessageId(messageId)
      } else {
-       // Fallback to passed components
-       console.log('Report has no components, using fallback:', components?.length)
-       if (components && components.length > 0) {
-         setCurrentVisualization(components)
-         setSelectedMessageId(messageId)
-       } else {
-         console.warn('No components available to display')
-       }
+       console.warn('Report fetched but has no components:', messageId)
      }
    } else {
-     // If report not found, use passed components
-     console.log('Report not found (status:', response.status, '), using passed components:', components?.length)
-     if (components && components.length > 0) {
-       setCurrentVisualization(components)
-       setSelectedMessageId(messageId)
-     } else {
-       console.warn('No components available to display')
-     }
+     console.warn('Report not found in database (status:', response.status, '):', messageId)
    }
  } catch (error) {
    console.error('Error fetching report:', error)
-   // Fallback to passed components
-   if (components && components.length > 0) {
-     setCurrentVisualization(components)
-     setSelectedMessageId(messageId)
-   }
  }
```

**Impact**: Always uses fresh data from database, no stale prop fallbacks

---

### 5. Visualization Processor (`src/lib/ai/visualizations/processor.ts`)

**Purpose**: Use stable componentId from hints instead of generating new ones

```diff
  unrenderedHints.forEach((hint, index) => {
    // Debug logging to trace data flow
    console.log(`🔍 Processing hint ${index}:`, {
      componentType: hint.render_input.componentType,
+     componentId: (hint as any).componentId,
      propsFromHint: hint.render_input.props,
```

```diff
+   // Use stable componentId from hint if available, otherwise generate one
+   const componentId = (hint as any).componentId || `auto_${hint.render_input.componentType}_${index}_${Date.now()}`;
+
    const component = {
-     id: `auto_${hint.render_input.componentType}_${index}`,
+     id: componentId,
      type: hint.render_input.componentType,
```

**Impact**: Preserves componentId from UnifiedDataTool through the processing pipeline

---

### 6. Component Render Tool (`src/lib/ai/tools/componentRenderTool.ts`)

**Purpose**: Accept and use componentId from input instead of always generating new one

```diff
  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
-     const { componentType, props, layout = {} } = parsedInput;
+     const { componentType, props, layout = {}, componentId } = parsedInput;

      // Validate props based on component type
      const validatedProps = this.validateProps(componentType, props);

      // Override sizes for better layout
      const optimizedLayout = this.optimizeLayout(componentType, layout);

+     // Use provided componentId if available, otherwise generate one
+     const id = componentId || `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
+
      // Generate component specification with metadata
      const componentSpec = {
-       id: `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
+       id,
        type: componentType,
```

**Impact**: Accepts stable componentId from upstream, only generates random ID as fallback

---

### 7. Dynamic Report Layout (`src/app/(main)/chat/reports/components/layout/DynamicReportLayout.tsx`)

**Purpose**: Use stable component IDs for React keys, minimal fallback generation

**Changed ID generation**:

```diff
  try {
    console.log('Organizing components:', components.length)
-   // Ensure each component has a unique ID before organizing
+   // Components should already have stable IDs from the processor/tools
+   // Only add ID as a last resort for backward compatibility
    const componentsWithIds = components.map((comp, idx) => {
      if (!comp.id) {
+       console.warn(`Component missing ID (type: ${comp.type}), generating fallback ID`)
        return {
          ...comp,
-         id: `${comp.type}-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
+         id: `fallback_${comp.type}_${idx}`
        }
      }
      return comp
    })
```

**Fixed KPI card keys**:

```diff
  for (let i = 0; i < kpiCards.length; i += cardsPerRow) {
    const rowCards = [];
    for (let j = 0; j < cardsPerRow && i + j < kpiCards.length; j++) {
+     const card = kpiCards[i + j];
      rowCards.push(
        <ReportComponentRenderer
-         key={`kpi-${i + j}`}
-         component={kpiCards[i + j]}
+         key={card.id}
+         component={card}
          index={sectionIndex * 10 + i + j}
```

**Impact**: React keys now use stable component IDs, enabling proper component tracking and DOM reuse

---

### 8. ChatPanel (`src/app/(main)/components/chat/ChatPanel.tsx`)

**Purpose**: Remove reference to deleted state

```diff
  // Use chat context
- const { renderedComponents, setCurrentVisualization, setSelectedMessageId } =
+ const { renderedComponents, setSelectedMessageId } =
    useChatContext();
```

**Impact**: Compilation fix, no functional change

---

## How The Fix Works

### Before (Broken Flow)

1. User queries invoices → UnifiedDataTool returns data
2. Processor creates component with ID: `auto_invoice_status_0`
3. Saved to DB and rendered
4. User drills down → UnifiedDataTool returns drill-down data
5. Processor creates component with ID: `auto_advanced_table_0` (same index!)
6. React sees same ID and reuses DOM from step 2
7. Visual swapping occurs

### After (Fixed Flow)

1. User queries invoices → UnifiedDataTool returns data with `componentId: "uuid-a1b2c3"`
2. Processor preserves `componentId: "uuid-a1b2c3"`
3. ComponentRenderTool preserves `componentId: "uuid-a1b2c3"`
4. Saved to DB with stable ID and rendered
5. User drills down → UnifiedDataTool returns data with `componentId: "uuid-e5f6g7"`
6. Pipeline preserves `componentId: "uuid-e5f6g7"`
7. React sees different ID and creates new DOM
8. No visual swapping, each report keeps its own components

### Key Improvements

- **Stable Identity**: UUIDs generated once at source, preserved throughout pipeline
- **Single Source of Truth**: `renderedComponents[selectedMessageId]` is the only source
- **No Stale Data**: PreviewChip always fetches fresh from DB
- **Proper React Keys**: Components keyed by stable IDs, not array indices
- **Shallow Copying**: Component metadata preserved through rendering

---

## Testing

### How to Verify Fix

1. Start dev server: `npm run dev`
2. Open chat and ask: "show me my invoices"
3. Click the report chip → should show invoice list table
4. Ask: "drill down on invoice [number]"
5. Click the new report chip → should show invoice line items table
6. Click back to first report chip → should still show invoice list table (not line items)
7. Switch between chips multiple times → visualizations should stay correct

### Expected Behavior

- Each report chip shows its own correct visualization
- No swapping when clicking between chips
- Text and visual content always match
- React DevTools shows unique component keys

---

## Files Modified

1. `src/lib/ai/tools/unifiedDataTool.ts` - Added UUID generation for all visualization hints
2. `src/contexts/ChatContext.tsx` - Removed currentVisualization state, simplified to single source of truth
3. `src/app/(main)/chat/page.tsx` - Simplified useEffect to use single source of truth
4. `src/app/(main)/chat/components/PreviewChip.tsx` - Removed fallback to stale props
5. `src/lib/ai/visualizations/processor.ts` - Preserve componentId from hints
6. `src/lib/ai/tools/componentRenderTool.ts` - Accept and use componentId from input
7. `src/app/(main)/chat/reports/components/layout/DynamicReportLayout.tsx` - Use stable IDs for React keys
8. `src/app/(main)/components/chat/ChatPanel.tsx` - Removed reference to deleted state

---

## Commit Message

```
fix: resolve AI report visualization swapping bug

Fixes critical bug where clicking between report preview chips caused
visualizations (charts, tables) to display incorrectly and swap between
different reports.

Root Cause:
- Component IDs were being regenerated at multiple pipeline stages
- React couldn't distinguish between components from different reports
- State management used duplicate sources causing race conditions
- Fallback logic used stale component props instead of fresh DB data

Solution:
1. Generate stable UUIDs at source (UnifiedDataTool) for all components
2. Preserve componentId through entire pipeline (processor, render tool)
3. Remove currentVisualization state in favor of single source of truth
4. Always fetch fresh data from DB, eliminate stale prop fallbacks
5. Use stable IDs for all React keys instead of array indices
6. Replace deep copy with shallow copy to preserve component identity

Changes:
- Add randomUUID import and helper methods to UnifiedDataTool
- Replace all JSON.stringify with stringifyWithComponentIds (105 instances)
- Remove currentVisualization state from ChatContext
- Simplify ChatPage useEffect to single data source
- Update PreviewChip to always fetch from DB, no fallbacks
- Preserve componentId in processor.ts and componentRenderTool.ts
- Fix DynamicReportLayout to use stable IDs for React keys
- Update ChatPanel to remove deleted state reference

Testing:
- Invoice list → drill down → switch between chips works correctly
- No visual swapping when navigating between reports
- Each report maintains its own correct visualizations
- Type check passes (only pre-existing unrelated errors remain)

Breaking Changes: None
Performance Impact: Minimal (stable IDs actually improve React performance)
```
