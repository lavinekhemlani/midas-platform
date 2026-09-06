# Loading Patterns Documentation

## Overview

This document outlines the standardized loading patterns and components used throughout the Zenith OS application. Following these patterns ensures a consistent user experience and maintainable codebase.

## Core Loading Components

### 1. LoadingSpinner

A unified spinner component using the Loader2 icon from lucide-react.

```tsx
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Basic usage
<LoadingSpinner size="sm" />

// Available sizes
<LoadingSpinner size="xs" /> // 12px
<LoadingSpinner size="sm" /> // 16px (default)
<LoadingSpinner size="md" /> // 24px
<LoadingSpinner size="lg" /> // 32px
<LoadingSpinner size="xl" /> // 48px

// Inline with text
<LoadingSpinner inline />

// Custom styling
<LoadingSpinner className="text-amber-500" />
```

### 2. CenteredSpinner

For full-page or card-level loading states.

```tsx
import { CenteredSpinner } from '@/components/ui/loading-spinner'
;<CenteredSpinner message="Loading financial data..." minHeight={400} size="lg" />
```

### 3. LoadingMessage

Standardized loading message display with optional spinner.

```tsx
import { LoadingMessage } from '@/components/ui/loading-message';

// Default variant
<LoadingMessage message="Loading..." />

// Inline variant
<LoadingMessage
  message="Processing..."
  variant="inline"
/>

// Subtle variant (smaller text)
<LoadingMessage
  message="Updating..."
  variant="subtle"
/>

// Without spinner
<LoadingMessage
  message="Please wait..."
  showSpinner={false}
/>
```

### 4. ProgressiveLoadingMessage

For long-running operations with changing messages.

```tsx
import { ProgressiveLoadingMessage } from '@/components/ui/loading-message'
;<ProgressiveLoadingMessage
  messages={[
    'Connecting to your books',
    'Fetching financial data',
    'Calculating metrics',
    'Adding finishing touches',
  ]}
  interval={2000} // Change message every 2 seconds
/>
```

### 5. ButtonLoader

Button component with built-in loading state.

```tsx
import { ButtonLoader } from '@/components/ui/button-loader';

<ButtonLoader
  loading={isLoading}
  loadingText="Saving..."
  disabled={!isValid}
  onClick={handleSubmit}
>
  Save Changes
</ButtonLoader>

// Icon button variant
<IconButtonLoader loading={isLoading}>
  <Send className="w-4 h-4" />
</IconButtonLoader>
```

### 6. LoadingState Component

Full-featured loading component with skeletons and progress messages.

```tsx
import LoadingState from '@/components/ui/LoadingState';

// Dashboard variant
<LoadingState variant="dashboard" />

// Page variant
<LoadingState variant="page" />

// Minimal variant (just skeletons)
<LoadingState variant="minimal" />

// Custom loading steps
<LoadingState
  customSteps={[
    "Step 1: Preparing data",
    "Step 2: Processing",
    "Step 3: Finalizing"
  ]}
/>
```

## Loading Message Constants

All loading messages are centralized in `/src/constants/loading-messages.ts`:

```tsx
import { LOADING_MESSAGES } from '@/constants/loading-messages'

// Authentication
LOADING_MESSAGES.AUTH.CHECKING // "Checking authentication..."
LOADING_MESSAGES.AUTH.SIGNING_IN // "Signing in..."

// Data fetching
LOADING_MESSAGES.DATA.FINANCIAL // "Loading financial data..."
LOADING_MESSAGES.DATA.REPORTS // "Loading reports..."

// Reports
LOADING_MESSAGES.REPORTS.GENERATING // "Generating report..."
LOADING_MESSAGES.REPORTS.PNL // "Loading profit & loss statement..."
LOADING_MESSAGES.REPORTS.BALANCE_SHEET // "Loading balance sheet..."

// Integrations
LOADING_MESSAGES.INTEGRATIONS.CONNECTING // "Connecting to provider..."
LOADING_MESSAGES.INTEGRATIONS.DISCONNECTING // "Disconnecting from provider..."

// Chat
LOADING_MESSAGES.CHAT.LOADING_HISTORY // "Loading chat history..."
LOADING_MESSAGES.CHAT.PROCESSING // "Processing your request..."

// Forms
LOADING_MESSAGES.FORMS.SAVING // "Saving..."
LOADING_MESSAGES.FORMS.UPDATING_PROFILE // "Updating profile..."

// Generic
LOADING_MESSAGES.GENERIC.LOADING // "Loading..."
LOADING_MESSAGES.GENERIC.REFRESHING // "Refreshing..."
```

## Common Loading Patterns

### 1. Page-Level Loading

For initial page loads or data fetching:

```tsx
function MyPage() {
  const { data, isLoading } = useData()

  if (isLoading && !data) {
    return <CenteredSpinner message={LOADING_MESSAGES.DATA.FINANCIAL} minHeight={400} />
  }

  return <PageContent data={data} />
}
```

### 2. Data Revalidation

Show overlay while keeping previous data visible:

```tsx
function ReportView() {
  const { data, isLoading, isValidating } = useSWR(...);

  return (
    <>
      {isValidating && (
        <CenteredSpinner
          message="Updating data..."
          minHeight={400}
        />
      )}

      {!isValidating && data && (
        <ReportContent data={data} />
      )}
    </>
  );
}
```

### 3. Button Loading States

```tsx
function SubmitForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <ButtonLoader
      loading={isSubmitting}
      loadingText={LOADING_MESSAGES.FORMS.SAVING}
      onClick={handleSubmit}
    >
      Submit
    </ButtonLoader>
  )
}
```

### 4. Inline Loading

For small components or sections:

```tsx
function DataCard() {
  const { data, isLoading } = useData()

  if (isLoading) {
    return (
      <Card>
        <LoadingMessage message="Loading metrics..." variant="inline" />
      </Card>
    )
  }

  return <Card>{/* content */}</Card>
}
```

### 5. Chat/Streaming Loading

For progressive content loading:

```tsx
function ChatPanel() {
  const { messages, loading, status } = useChat()

  return (
    <>
      {loading && (
        <LoadingMessage message={status || LOADING_MESSAGES.CHAT.PROCESSING} variant="inline" />
      )}
    </>
  )
}
```

## Best Practices

### 1. Use Consistent Spinners

✅ **Do:**

```tsx
<LoadingSpinner size="sm" />
```

❌ **Don't:**

```tsx
<div className="animate-spin rounded-full border-2 border-amber-500" />
```

### 2. Use Standardized Messages

✅ **Do:**

```tsx
<LoadingMessage message={LOADING_MESSAGES.DATA.FINANCIAL} />
```

❌ **Don't:**

```tsx
<p>Loading...</p>
```

### 3. Handle Loading States Properly

✅ **Do:**

```tsx
// Distinguish between initial load and revalidation
if (isLoading && !data) {
  return <LoadingState />
}

if (isValidating) {
  return <LoadingOverlay />
}
```

❌ **Don't:**

```tsx
// Don't show loading for every state change
if (isLoading || isValidating) {
  return <LoadingState />
}
```

### 4. Use ButtonLoader for Form Submissions

✅ **Do:**

```tsx
<ButtonLoader loading={isSubmitting} loadingText="Saving...">
  Save
</ButtonLoader>
```

❌ **Don't:**

```tsx
<button disabled={isLoading}>{isLoading ? <Spinner /> : 'Save'}</button>
```

### 5. Provide Context in Loading Messages

✅ **Do:**

```tsx
message = 'Loading financial reports...'
```

❌ **Don't:**

```tsx
message = 'Loading...'
```

## Loading State Management

### Using LoadingContext

For global loading states (like top progress bar):

```tsx
import { useLoading } from '@/contexts/LoadingContext'

function MyComponent() {
  const { isLoading, startLoading, stopLoading } = useLoading()

  const fetchData = async () => {
    startLoading()
    try {
      await apiCall()
    } finally {
      stopLoading()
    }
  }
}
```

### SWR Integration

The app uses SWR for data fetching with built-in loading states:

```tsx
const { data, error, isLoading, isValidating } = useSWR(key, fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 30 * 60 * 1000, // 30 minutes
})

// isLoading: true on initial fetch
// isValidating: true on background revalidation
```

## Migration Guide

When updating existing loading implementations:

1. **Replace custom spinners:**
   - Search for `animate-spin` classes
   - Replace with `<LoadingSpinner />`

2. **Standardize loading messages:**
   - Search for hardcoded loading text
   - Replace with constants from `LOADING_MESSAGES`

3. **Update buttons:**
   - Search for buttons with conditional loading
   - Replace with `<ButtonLoader />`

4. **Consolidate skeleton screens:**
   - Use the shadcn/ui `<Skeleton />` component
   - Remove custom skeleton implementations

## Performance Considerations

1. **Debounce loading states** - Don't show loading for operations < 200ms
2. **Keep previous data visible** during revalidation when possible
3. **Use progressive loading messages** for long operations (> 3 seconds)
4. **Implement optimistic UI** where appropriate to reduce perceived loading time
5. **Cache aggressively** using SWR's caching strategies

## Accessibility

All loading components include proper ARIA attributes:

- `role="status"` for loading indicators
- `aria-live="polite"` for status updates
- `aria-label="Loading"` for spinners
- Proper disabled states for interactive elements

## Testing

When testing loading states:

```tsx
// Mock loading state
const { rerender } = render(<Component isLoading={true} />)
expect(screen.getByText('Loading...')).toBeInTheDocument()

// Test loading to loaded transition
rerender(<Component isLoading={false} data={mockData} />)
expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
```

## Troubleshooting

### Common Issues

1. **Loading state flashing:**
   - Add debouncing for short operations
   - Use `isInitialLoading` flag to distinguish first load

2. **Stuck in loading:**
   - Ensure `finally` blocks clear loading state
   - Check for error boundaries catching errors

3. **Multiple loading indicators:**
   - Coordinate loading states through context
   - Use single source of truth for loading state

## Future Improvements

Potential enhancements to consider:

- Add loading state analytics/telemetry
- Implement smart debouncing based on historical load times
- Create loading state devtools for debugging
- Add skeleton screen generator utility
- Implement predictive loading for common user flows
