# Square Integration Refactor Summary

## Overview
This document summarizes the refactoring and simplification of the Square API integration system, both backend and frontend.

## Backend Changes

### Removed Functions
- `supabase/functions/square-api-test/` - Manual testing function (not needed in production)
- `supabase/functions/sync-square-locations/` - Redundant (location sync is part of main sync)
- `supabase/functions/reprocess-venues/` - Legacy reprocessing function

### Kept Functions
- `supabase/functions/square-sync/` - Main sync function for payments and locations
- `supabase/functions/square-cron/` - Scheduled sync trigger
- `supabase/functions/universal-api-proxy/` - General API proxy (used by other integrations)

## Frontend Changes

### Removed Pages
- `src/pages/RevenueNew.tsx` - Merged into main Revenue page
- `src/pages/ApiTest.tsx` - Removed (was for manual testing only)

### Removed Components
- `src/components/revenue/RevenueComparisonTable.tsx` - Replaced with unified table
- `src/components/revenue/RevenueTableRows.tsx` - No longer needed
- `src/components/revenue/WeekSelector.tsx` - Replaced with tab interface
- `src/components/revenue/RevenueDataProcessor.tsx` - Logic moved to main page
- All components in `src/components/square/` - Debug/testing components
- All components in `src/components/api/` - API testing components

### Removed Hooks
- `src/hooks/useRevenue.ts` - Logic moved to main Revenue page
- `src/hooks/useVenues.ts` - Logic moved to main Revenue page

### Removed Types
- `src/types/api.ts` - No longer needed
- `src/types/square.ts` - No longer needed

## Simplified Architecture

### Before (Complex)
```
Multiple sync functions → Multiple data tables → Multiple frontend pages → Multiple components
```

### After (Simplified)
```
square-sync function → revenue_events table → Unified Revenue page
```

## Data Flow

1. **Square API** provides payment and location data
2. **square-sync function** processes and stores data in `revenue_events` table
3. **square-cron** triggers regular syncs
4. **Revenue page** displays analytics with monthly/weekly/yearly views
5. **Charts and tables** show revenue breakdown by venue and time period

## Benefits

- **Reduced Complexity**: Single source of truth for revenue data
- **Better Performance**: Fewer components and API calls
- **Easier Maintenance**: Consolidated logic in fewer files
- **Cleaner Codebase**: Removed unused/debug components
- **Better UX**: Unified interface for revenue analytics

## Next Steps

1. Update Supabase types to include `revenue_events` table and revenue functions
2. Test the unified revenue page with real data
3. Verify that scheduled syncs are working correctly
4. Update any remaining references to removed components

## Files Modified

- `src/pages/Revenue.tsx` - Unified revenue page with all features
- `src/App.tsx` - Removed routes for RevenueNew and ApiTest
- `README.md` - Updated with new architecture documentation
- Various files deleted (see "Removed" sections above) 