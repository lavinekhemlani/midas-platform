# Force Regeneration Feature for AI Analysis

## Overview

Added functionality to force regenerate AI analysis, bypassing the 15-minute cache when users explicitly click the refresh button.

## Changes Made

### 1. API Endpoint (`/api/analysis/executive-summary/route.ts`)

- Added `forceRegenerate` parameter to the request body
- Modified cache checking logic to skip cache lookup when `forceRegenerate: true`
- Added logging to track force regeneration requests

### 2. AIAnalysisCard Component (`AIAnalysisCard.tsx`)

- Modified `generateAnalysis` function to accept optional `forceRegenerate` parameter
- Updated refresh button to always pass `forceRegenerate: true` when clicked
- Added tooltip to refresh button explaining force regeneration
- Added console logging to distinguish between cached and regenerated responses

### 3. Auto-generation Behavior

- Auto-generation on page load still uses cache (calls `generateAnalysis()` without parameters)
- Manual refresh button always forces regeneration (calls `generateAnalysis(true)`)

## How It Works

### Normal Flow (Auto-generation or initial load):

1. Component loads and detects all data is ready
2. Calls `generateAnalysis()` without parameters (defaults to `forceRegenerate: false`)
3. API checks cache first
4. If valid cache exists (< 15 minutes old), returns cached result
5. If no cache or expired, generates new analysis and caches it

### Force Regeneration Flow (User clicks refresh):

1. User clicks "Refresh Analysis" button
2. Calls `generateAnalysis(true)` with force regeneration flag
3. API skips cache check entirely
4. Always generates fresh analysis using LLM
5. Overwrites previous cache entry with new analysis
6. Returns new analysis with `cached: false`

## Testing

Use the provided test script to verify functionality:

```bash
node test-force-regeneration.js
```

The test script will:

1. Make initial request (generates new analysis)
2. Make second request (uses cache)
3. Make force regenerate request (bypasses cache)
4. Make final request (uses newly generated cache)

## User Experience

- **Generate Analysis button**: First-time generation, will check cache first
- **Refresh Analysis button**: Always regenerates fresh analysis
- Button shows loading spinner during generation
- Tooltip explains that refresh bypasses cache

## Technical Details

### Cache Storage

- Analysis stored in DynamoDB with 15-minute TTL
- Key structure: `ORG#<org_id>#EXEC_SUMMARY` / `ANALYSIS#<timestamp>#<id>`
- TTL automatically removes expired entries

### Performance Considerations

- Cached responses return in ~100-200ms
- Fresh generation takes 2-5 seconds depending on LLM response time
- Force regeneration uses AI tokens (tracked and logged)

## Benefits

1. **Fresh Insights on Demand**: Users can get updated analysis whenever needed
2. **Cost Efficiency**: Auto-generation uses cache to save on AI tokens
3. **Data Accuracy**: Force regeneration ensures analysis reflects latest data
4. **User Control**: Clear UI indication of refresh capability

## Future Enhancements

Potential improvements to consider:

- Add visual indicator showing when analysis was last generated
- Allow users to see both cached and fresh versions for comparison
- Add option to auto-regenerate if data has significantly changed
- Implement rate limiting for force regeneration to prevent abuse
