# Memory System Testing Checklist

## Overview

This checklist covers all changes made during the memory system streamlining effort, including dead code removal, standardization, and new metadata editing UI.

---

## Phase 1: UI Fixes Testing

### 1.1 Memory Highlight Navigation ✓

**Feature**: Clicking memory badge in chat navigates to memory page with highlight

**Test Steps**:

1. [ ] Open AI chat interface
2. [ ] Have a conversation that creates a memory (e.g., "We have an expense of $500 for office supplies on December 15th")
3. [ ] Verify memory badge appears in chat message
4. [ ] Click on the memory badge
5. [ ] **Expected**: Should navigate to `/memories` page
6. [ ] **Expected**: Memory should scroll into view smoothly
7. [ ] **Expected**: Memory should have blue ring highlight for 3 seconds
8. [ ] **Expected**: Highlight should fade away after 3 seconds
9. [ ] Try with different memory types (expense, goal, decision, etc.)

**Edge Cases**:

- [ ] Click memory badge when already on memories page
- [ ] Click memory badge for archived memory
- [ ] Click memory badge for memory that no longer exists

### 1.2 MemorySummaryWidget Cleanup ✓

**Change**: Removed nextKeyDate calculation (dead code)

**Test Steps**:

1. [ ] Navigate to dashboard/home page
2. [ ] Locate "AI Memory" widget
3. [ ] **Expected**: Widget displays correctly with memory counts
4. [ ] **Expected**: No console errors
5. [ ] **Expected**: No missing UI elements
6. [ ] Create a new key_date memory
7. [ ] **Expected**: Widget refreshes and shows updated count
8. [ ] **Expected**: No JavaScript errors in console

---

## Phase 2: Dead Code Removal Testing

### 2.1 metric_explanation Type Removal ✓

**Change**: Removed all references to deprecated memory type

**Test Steps**:

1. [ ] Create memories of all 6 valid types:
   - [ ] future_expense
   - [ ] financial_goal
   - [ ] strategic_decision
   - [ ] business_context
   - [ ] user_preference
   - [ ] key_date
2. [ ] **Expected**: All memory types create successfully
3. [ ] View memories in MemoryViewer
4. [ ] **Expected**: All memories display with correct type badges
5. [ ] Check MemoryPreviewChip in chat
6. [ ] **Expected**: No "Metric Insight" label appears
7. [ ] **Expected**: No console errors about invalid types

### 2.2 MemoryEnhancer Deletion ✓

**Change**: Deleted unused 300+ line class

**Test Steps**:

1. [ ] Run TypeScript compilation: `npx tsc --noEmit`
2. [ ] **Expected**: No import errors for MemoryEnhancer
3. [ ] Test memory creation from chat
4. [ ] **Expected**: Memories still created successfully
5. [ ] Test memory search functionality
6. [ ] **Expected**: Memory search works normally
7. [ ] Check application startup
8. [ ] **Expected**: No errors in console about missing modules

### 2.3 currentDate Parameter Removal ✓

**Change**: Removed unused parameter from MemoryExtractor

**Test Steps**:

1. [ ] Create memory with relative date: "We have a meeting in 3 days"
2. [ ] **Expected**: Memory created with correct future date
3. [ ] Create memory with absolute date: "Tax deadline on April 15th"
4. [ ] **Expected**: Memory created with specified date
5. [ ] Create memory with past date
6. [ ] **Expected**: Memory NOT created (past dates filtered out)
7. [ ] Test multiple memories in single chat message
8. [ ] **Expected**: All valid memories extracted correctly

---

## Phase 3: Standardization Testing

### 3.1 extractionConfidence vs relevanceScore ✓

**Change**: Renamed metadata.confidence to metadata.extractionConfidence

**Test Steps**:

1. [ ] Create a new future_expense memory via chat
2. [ ] View memory in MemoryViewer
3. [ ] Open browser DevTools → Network tab
4. [ ] Click refresh to reload memories
5. [ ] Check GET `/api/memories` response
6. [ ] **Expected**: Memory metadata contains `extractionConfidence` field
7. [ ] **Expected**: Memory has `relevanceScore` at top level
8. [ ] **Expected**: No `confidence` field at top level
9. [ ] Verify for all memory types:
   - [ ] future_expense (extractionConfidence: 0.8)
   - [ ] financial_goal (extractionConfidence: 0.7)
   - [ ] key_date (extractionConfidence: 0.8)
   - [ ] strategic_decision (extractionConfidence: 0.9)
   - [ ] business_context (extractionConfidence: 0.85)

**API Testing**:

```bash
# Get memories and check structure
curl -X GET http://localhost:3000/api/memories \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.memories[0]'
```

Expected JSON structure:

```json
{
  "id": "MEM#...",
  "type": "future_expense",
  "content": "...",
  "metadata": {
    "extractionConfidence": 0.8,
    "source": "automatic_extraction",
    ...
  },
  "relevanceScore": 0.8
}
```

### 3.2 metadata.source Tracking ✓

**Change**: All memories now tagged with source origin

**Test Steps**:

**Automatic Extraction**:

1. [ ] Create memory via chat: "We have an expense of $1000 for equipment"
2. [ ] Check memory in database/API
3. [ ] **Expected**: `metadata.source === "automatic_extraction"`
4. [ ] Test all memory types via chat
5. [ ] **Expected**: All have `source: "automatic_extraction"`

**Manual Command**:

1. [ ] In chat, say: "Remember that our fiscal year ends on June 30th"
2. [ ] Check memory in database/API
3. [ ] **Expected**: `metadata.source === "manual_command"`
4. [ ] Create several manual memories
5. [ ] **Expected**: All have `source: "manual_command"`

**API Verification**:

```bash
# Check automatic memory
curl -X GET http://localhost:3000/api/memories?type=future_expense \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.memories[].metadata.source'
# Expected: "automatic_extraction"

# Check manual memory
curl -X GET http://localhost:3000/api/memories?type=user_preference \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.memories[].metadata.source'
# Expected: "manual_command" (if created via chat command)
```

---

## Phase 4: Metadata Editing UI Testing

### 4.1 Basic Edit Functionality ✓

**Test Steps**:

1. [ ] Navigate to `/memories` page
2. [ ] Locate any memory
3. [ ] Click the edit button (pencil icon)
4. [ ] **Expected**: Inline edit form expands showing:
   - [ ] Content input field
   - [ ] Conditionally: Amount field (for expenses/goals)
   - [ ] Conditionally: Date field (if memory has date)
   - [ ] Priority selector (all types)
   - [ ] Tags input (all types)
   - [ ] Save button (green)
   - [ ] Cancel button (red)

### 4.2 Content Editing ✓

**Test Steps**:

1. [ ] Click edit on a memory
2. [ ] Change the content text
3. [ ] Click Save
4. [ ] **Expected**: Edit mode closes
5. [ ] **Expected**: Updated content displays immediately
6. [ ] Refresh page
7. [ ] **Expected**: Content persists after refresh
8. [ ] Try with empty content
9. [ ] **Expected**: Should not save (validation)

### 4.3 Amount Editing ✓

**Test for**: future_expense, financial_goal

**Test Steps**:

1. [ ] Create expense: "Expense of $500 for software on Jan 15th"
2. [ ] Navigate to memories page
3. [ ] Click edit on the expense
4. [ ] **Expected**: Amount field shows "500"
5. [ ] Change amount to "750"
6. [ ] Click Save
7. [ ] **Expected**: Memory displays with $750
8. [ ] Refresh and verify persistence
9. [ ] Try negative amount
10. [ ] **Expected**: Should accept (backend validates)
11. [ ] Try non-numeric input
12. [ ] **Expected**: Field shows 0 or NaN (number input behavior)

**Test for**: Other memory types

1. [ ] Edit business_context memory
2. [ ] **Expected**: No amount field shown
3. [ ] Edit key_date memory
4. [ ] **Expected**: No amount field shown

### 4.4 Date Editing ✓

**Test Steps**:

1. [ ] Edit a future_expense with date
2. [ ] **Expected**: Date field shows date in YYYY-MM-DD format
3. [ ] Change date using date picker
4. [ ] Click Save
5. [ ] **Expected**: Updated date displays
6. [ ] Refresh and verify persistence
7. [ ] Edit memory without date
8. [ ] **Expected**: No date field shown
9. [ ] Try setting date to past
10. [ ] **Expected**: Should save (no client-side validation, backend handles)

### 4.5 Priority Editing ✓

**Test Steps**:

1. [ ] Edit any memory
2. [ ] **Expected**: Priority dropdown shown
3. [ ] **Expected**: Current priority pre-selected (or "medium" default)
4. [ ] Change priority to "high"
5. [ ] Click Save
6. [ ] **Expected**: Priority badge updates to red/high
7. [ ] Change priority to "low"
8. [ ] **Expected**: Priority badge updates to blue/low
9. [ ] Test all three options:
   - [ ] Low
   - [ ] Medium
   - [ ] High

### 4.6 Tags Editing ✓

**Test Steps**:

1. [ ] Edit memory without tags
2. [ ] **Expected**: Empty tags input field
3. [ ] Add tags: "finance, urgent, q1"
4. [ ] Click Save
5. [ ] **Expected**: Tags save successfully
6. [ ] Refresh page
7. [ ] Edit same memory
8. [ ] **Expected**: Tags input shows "finance, urgent, q1"
9. [ ] Add another tag: "finance, urgent, q1, reviewed"
10. [ ] Click Save
11. [ ] **Expected**: All tags persist
12. [ ] Remove all tags (empty input)
13. [ ] Click Save
14. [ ] **Expected**: Tags field empty/cleared

**Edge Cases**:

- [ ] Tags with spaces: "tag one, tag two"
- [ ] Tags with special characters: "Q1-2025, 50%"
- [ ] Extra commas: "tag1,, , tag2"
- [ ] **Expected**: Trimmed and filtered correctly

### 4.7 Cancel Functionality ✓

**Test Steps**:

1. [ ] Click edit on any memory
2. [ ] Make changes to multiple fields:
   - [ ] Change content
   - [ ] Change amount
   - [ ] Change date
   - [ ] Change priority
   - [ ] Add tags
3. [ ] Click Cancel button
4. [ ] **Expected**: Edit mode closes
5. [ ] **Expected**: Original values unchanged
6. [ ] **Expected**: No API call made
7. [ ] Edit again
8. [ ] **Expected**: Original values still show

### 4.8 Multiple Memory Types ✓

**Test each memory type**:

**Future Expense**:

- [ ] Edit content, amount, date, priority, tags
- [ ] **Expected**: All fields editable and persist

**Financial Goal**:

- [ ] Edit content, amount, priority, tags
- [ ] **Expected**: All fields editable (no date expected)

**Key Date**:

- [ ] Edit content, date, priority, tags
- [ ] **Expected**: All fields editable (no amount expected)

**Strategic Decision**:

- [ ] Edit content, priority, tags
- [ ] **Expected**: All fields editable (no amount/date expected)

**Business Context**:

- [ ] Edit content, priority, tags
- [ ] **Expected**: All fields editable (no amount/date expected)

**User Preference**:

- [ ] Edit content, priority, tags
- [ ] **Expected**: All fields editable (no amount/date expected)

### 4.9 Concurrent Editing ✓

**Test Steps**:

1. [ ] Click edit on memory #1
2. [ ] Try clicking edit on memory #2
3. [ ] **Expected**: Memory #1 stays in edit mode (single edit at a time)
4. [ ] **Expected**: Memory #2 edit button disabled or doesn't respond
5. [ ] Cancel memory #1
6. [ ] Click edit on memory #2
7. [ ] **Expected**: Memory #2 enters edit mode successfully

### 4.10 Error Handling ✓

**Test Steps**:

1. [ ] Disconnect internet/network
2. [ ] Edit a memory and try to save
3. [ ] **Expected**: Error logged to console
4. [ ] **Expected**: Edit mode stays open (doesn't close prematurely)
5. [ ] Reconnect network
6. [ ] Try saving again
7. [ ] **Expected**: Should save successfully

**API Error Simulation**:

1. [ ] Edit memory with invalid ID
2. [ ] **Expected**: 404 error logged
3. [ ] Edit with malformed data
4. [ ] **Expected**: Appropriate error handling

---

## Integration Testing

### 5.1 End-to-End Memory Lifecycle ✓

**Test Steps**:

1. [ ] **Create**: Say in chat "We have a $5000 marketing budget for March campaign"
2. [ ] **Expected**: Memory created with:
   - Type: future_expense
   - Amount: 5000
   - Date: March (future date)
   - Source: automatic_extraction
   - ExtractionConfidence: 0.8
3. [ ] **Navigate**: Click memory badge in chat
4. [ ] **Expected**: Navigates to memories page with highlight
5. [ ] **Edit**: Click edit button
6. [ ] **Modify**:
   - Change amount to 7500
   - Change priority to "high"
   - Add tags: "marketing, q1, approved"
7. [ ] **Save**: Click save button
8. [ ] **Expected**: All changes persist
9. [ ] **Archive**: Click archive button
10. [ ] **Expected**: Memory becomes 60% opaque
11. [ ] **Toggle**: Enable "Show Archived"
12. [ ] **Expected**: Memory visible
13. [ ] **Unarchive**: Click archive button again
14. [ ] **Expected**: Memory restored to normal
15. [ ] **Delete**: Click delete button
16. [ ] **Expected**: Confirmation dialog (if implemented)
17. [ ] **Expected**: Memory removed from list

### 5.2 Memory Search with Metadata ✓

**Test Steps**:

1. [ ] Create memories with various tags and priorities
2. [ ] Use search bar to search by:
   - [ ] Content: "marketing"
   - [ ] Tags: search doesn't find tags (limitation - search only content)
   - [ ] Priority: search doesn't find priority (limitation)
3. [ ] Filter by memory type
4. [ ] Edit filtered memory
5. [ ] **Expected**: Edit works correctly
6. [ ] Save changes
7. [ ] **Expected**: Memory stays in filtered view if still matches

### 5.3 Memory Widget Integration ✓

**Test Steps**:

1. [ ] Create 3 future expenses
2. [ ] Check MemorySummaryWidget
3. [ ] **Expected**: Shows count of 3 for future_expense
4. [ ] Edit one expense to change amount
5. [ ] Return to dashboard
6. [ ] **Expected**: Count still 3
7. [ ] Delete one expense
8. [ ] Return to dashboard
9. [ ] **Expected**: Count shows 2
10. [ ] Create memory via chat
11. [ ] **Expected**: Widget auto-refreshes with new count

---

## Performance Testing

### 6.1 Large Dataset ✓

**Test Steps**:

1. [ ] Create 50+ memories via chat/manual
2. [ ] Navigate to memories page
3. [ ] **Expected**: Page loads within 2 seconds
4. [ ] Edit a memory in the middle of the list
5. [ ] **Expected**: Edit mode opens instantly
6. [ ] Save changes
7. [ ] **Expected**: Save completes within 1 second
8. [ ] Scroll through all memories
9. [ ] **Expected**: Smooth scrolling, no lag

### 6.2 Rapid Operations ✓

**Test Steps**:

1. [ ] Click edit on a memory
2. [ ] Immediately click cancel
3. [ ] **Expected**: No errors, clean state
4. [ ] Click edit again
5. [ ] Make rapid changes to all fields
6. [ ] Click save immediately
7. [ ] **Expected**: All changes captured
8. [ ] Edit → Cancel → Edit → Save rapidly
9. [ ] **Expected**: No race conditions or errors

---

## Browser Compatibility Testing

### 7.1 Cross-Browser Testing ✓

Test all features in:

- [ ] **Chrome** (latest)
- [ ] **Firefox** (latest)
- [ ] **Safari** (latest)
- [ ] **Edge** (latest)

For each browser, verify:

- [ ] Memory highlight navigation works
- [ ] Inline edit form displays correctly
- [ ] Date picker functions properly
- [ ] Select dropdowns work
- [ ] Save/cancel buttons functional
- [ ] No console errors

### 7.2 Mobile Responsiveness ✓

**Test Steps**:

1. [ ] Open memories page on mobile device (or DevTools mobile view)
2. [ ] **Expected**: Memories display in responsive layout
3. [ ] Click edit on a memory
4. [ ] **Expected**: Edit form fits screen width
5. [ ] **Expected**: All inputs accessible
6. [ ] **Expected**: Date picker mobile-friendly
7. [ ] Try editing on:
   - [ ] iPhone Safari
   - [ ] Android Chrome
   - [ ] Tablet view

---

## Regression Testing

### 8.1 Existing Features Still Work ✓

**Memory Creation**:

- [ ] Create memory via chat (automatic extraction)
- [ ] Create memory via "Remember that..." (manual command)
- [ ] Create memories of all 6 types
- [ ] **Expected**: All creation methods still work

**Memory Viewing**:

- [ ] View all memories
- [ ] Filter by type
- [ ] Toggle archived
- [ ] Search memories
- [ ] **Expected**: All viewing features work

**Memory Management**:

- [ ] Archive memory
- [ ] Unarchive memory
- [ ] Delete memory
- [ ] **Expected**: All management features work

**Chat Integration**:

- [ ] Memory badges appear in chat
- [ ] Clicking badge navigates correctly
- [ ] Multiple memories in one message
- [ ] **Expected**: Chat integration intact

### 8.2 No Side Effects ✓

**Test Steps**:

1. [ ] Test other dashboard widgets
2. [ ] **Expected**: No impact from memory changes
3. [ ] Test chat functionality
4. [ ] **Expected**: Chat still works normally
5. [ ] Test reports/analytics
6. [ ] **Expected**: No errors related to memory
7. [ ] Check application startup
8. [ ] **Expected**: No new console warnings/errors

---

## Security Testing

### 9.1 Input Validation ✓

**Test Steps**:

1. [ ] Try editing with malicious content:
   - [ ] `<script>alert('xss')</script>` in content
   - [ ] `'; DROP TABLE memories; --` in tags
   - [ ] Very long strings (10000+ chars)
2. [ ] **Expected**: Proper sanitization/escaping
3. [ ] **Expected**: No XSS vulnerabilities
4. [ ] **Expected**: No SQL injection (uses DynamoDB, but test anyway)

### 9.2 Authorization ✓

**Test Steps**:

1. [ ] Try editing memory from different user (if multi-tenant)
2. [ ] **Expected**: 401/403 error
3. [ ] Try accessing `/api/memories` without auth token
4. [ ] **Expected**: 401 Unauthorized
5. [ ] Try updating memory with wrong organization ID
6. [ ] **Expected**: Cannot update other org's memories

---

## Accessibility Testing

### 10.1 Keyboard Navigation ✓

**Test Steps**:

1. [ ] Use Tab key to navigate to edit button
2. [ ] Press Enter to activate edit
3. [ ] **Expected**: Edit mode opens
4. [ ] Tab through all form fields
5. [ ] **Expected**: Logical tab order
6. [ ] Press Escape
7. [ ] **Expected**: Cancel edit (if implemented)
8. [ ] Use Enter in input fields
9. [ ] **Expected**: Appropriate behavior (save or next field)

### 10.2 Screen Reader Testing ✓

**Test Steps**:

1. [ ] Enable screen reader (VoiceOver/NVDA/JAWS)
2. [ ] Navigate to memories page
3. [ ] **Expected**: Memory items announced
4. [ ] Navigate to edit button
5. [ ] **Expected**: "Edit" button announced
6. [ ] Activate edit
7. [ ] **Expected**: Form labels announced
8. [ ] Navigate through form
9. [ ] **Expected**: All fields have accessible labels

### 10.3 Visual Accessibility ✓

**Test Steps**:

1. [ ] Increase browser zoom to 200%
2. [ ] **Expected**: Edit form still usable
3. [ ] Test with high contrast mode
4. [ ] **Expected**: All elements visible
5. [ ] Check color contrast for:
   - [ ] Labels
   - [ ] Input borders
   - [ ] Buttons
6. [ ] **Expected**: Meets WCAG AA standards

---

## Data Integrity Testing

### 11.1 Metadata Preservation ✓

**Test Steps**:

1. [ ] Create memory with all metadata fields populated
2. [ ] Edit only content field
3. [ ] Save
4. [ ] **Expected**: All other metadata unchanged
5. [ ] Edit only amount
6. [ ] **Expected**: Content and other fields unchanged
7. [ ] Verify in database/API that all fields persist correctly

### 11.2 Concurrent Updates ✓

**Test Steps** (requires two browser sessions):

1. [ ] Open memory in two browsers
2. [ ] Edit in browser 1, change content
3. [ ] Edit in browser 2, change amount
4. [ ] Save in browser 1
5. [ ] Save in browser 2
6. [ ] **Expected**: Last save wins (or proper conflict resolution)
7. [ ] Refresh both browsers
8. [ ] **Expected**: Consistent state across both

---

## Automated Testing Checklist

### 12.1 Unit Tests (if applicable)

- [ ] MemoryExtractor tests still pass
- [ ] Memory type validation tests pass
- [ ] Date parsing tests pass
- [ ] extractionConfidence calculation tests pass

### 12.2 Integration Tests (if applicable)

- [ ] Memory API tests pass
- [ ] Memory creation tests pass
- [ ] Memory update tests pass
- [ ] Memory deletion tests pass

### 12.3 E2E Tests (if applicable)

- [ ] Memory creation flow test passes
- [ ] Memory editing flow test passes
- [ ] Memory highlight navigation test passes

---

## Sign-off Checklist

### Before Deploying to Production

- [ ] All critical tests passed
- [ ] No console errors in any tested browser
- [ ] TypeScript compilation successful: `npx tsc --noEmit`
- [ ] No ESLint errors: `npm run lint` (if configured)
- [ ] Performance tests show acceptable load times
- [ ] Security tests show no vulnerabilities
- [ ] Accessibility tests meet WCAG standards
- [ ] Regression tests confirm no broken features
- [ ] Database migration successful (if applicable)
- [ ] API backward compatibility verified
- [ ] Documentation updated
- [ ] Changelog updated

### Deployment Verification

After deploying to production:

- [ ] Smoke test: Create one memory
- [ ] Smoke test: Edit one memory
- [ ] Smoke test: Navigate from chat to memories
- [ ] Check error logs for first hour
- [ ] Monitor performance metrics
- [ ] User acceptance testing with 2-3 users

---

## Known Limitations (Document These)

### Expected Behavior:

1. **Search limitations**: Search only works on content and tags, not on amount/date/priority
2. **Single edit mode**: Can only edit one memory at a time (by design)
3. **No undo**: Once saved, changes cannot be undone (consider documenting)
4. **Date validation**: Client allows past dates, backend filters them
5. **Amount precision**: Stored as float, may have precision issues (document if needed)

### Future Enhancements (Optional):

1. Bulk editing multiple memories
2. Memory version history/audit log
3. Advanced search with metadata filters
4. Undo/redo functionality
5. Category management UI
6. Currency conversion for amounts

---

## Bug Report Template

If issues are found during testing, use this template:

```markdown
**Bug Title**: [Brief description]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:

1.
2.
3.

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Environment**:

- Browser: [Chrome 120, Firefox 115, etc.]
- OS: [Windows 11, macOS 14, etc.]
- Device: [Desktop, Mobile, etc.]

**Screenshots/Videos**:
[Attach if available]

**Console Errors**:
[Copy any error messages]

**Additional Context**:
[Any other relevant information]
```

---

## Testing Sign-off

**Tester Name**: ******\_\_\_******
**Date**: ******\_\_\_******
**Test Results**: PASS / FAIL / PARTIAL
**Notes**:

---

---

---
