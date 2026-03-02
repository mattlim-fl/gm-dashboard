# Inventory Management Feature - Implementation Plan

**Status:** Planned (saved for later implementation)
**Created:** 2026-02-18

## Overview

Build an inventory management system that:
1. Imports items from Square catalog (plus manual additions)
2. Lets managers do stocktake (count actual quantities)
3. Calculates wastage (expected vs actual variance)
4. Generates reorder suggestions

## User Flow

### Stocktake Flow
1. Manager opens Inventory > Stocktake
2. Starts new stocktake session
3. System pre-calculates expected stock per item:
   - Last stocktake count + purchases - Square sales
4. Manager enters actual counts
5. For variances, manager selects reason (breakage, spillage, theft, comp, other)
6. Complete stocktake → creates stock movement records

### Reorder Flow
1. View items where `current_stock <= reorder_point`
2. Shows: current stock, daily sales velocity, days until stockout, suggested order qty
3. Export to CSV for ordering

---

## Database Schema

### Tables

**`inventory_items`** - Master item catalog
- `id`, `venue`, `name`, `category`, `sku`, `unit`
- `square_catalog_object_id` (for Square-linked items)
- `cost_per_unit_cents`
- `reorder_point`, `reorder_quantity`, `par_level`, `lead_time_days`
- `is_active`, `is_archived`

**`stocktake_sessions`** - Each stocktake event
- `id`, `venue`, `session_date`, `status` (in_progress/completed/cancelled)
- `sales_period_start`, `sales_period_end` (for expected calc)
- `completed_by`, `completed_at`

**`stocktake_counts`** - Item counts within a session
- `id`, `session_id`, `item_id`
- `opening_stock`, `expected_stock`, `actual_count`
- `variance` (generated column: actual - expected)
- `adjustment_reason`, `adjustment_notes`
- `counted_by`, `counted_at`

**`stock_movements`** - Audit trail of all changes
- `id`, `item_id`, `venue`
- `movement_type` (purchase, sale, adjustment, waste, transfer, initial)
- `quantity` (positive = in, negative = out)
- `stocktake_session_id`, `square_order_id` (references)
- `reason`, `notes`, `unit_cost_cents`

**`inventory_current_stock`** - Materialized view
- Aggregates `stock_movements` for current levels
- Auto-refreshes on movement changes
- Includes `needs_reorder` flag

### Key Functions

- `extract_sales_for_stocktake(venue, start, end)` - Get sales from Square orders
- `calculate_sales_velocity(item_id, venue, days)` - Average daily sales
- `get_reorder_suggestions(venue)` - Items needing reorder with projections

---

## Frontend Structure

### Navigation
Add "Inventory" to Operations section in sidebar (between Booth Management and Settings)

### Page: `/inventory`

```
Inventory Page
├── Venue selector (header)
├── Tabs
│   ├── Stock Levels (default)
│   │   ├── Stats: Total items, Low stock alerts, Stock value
│   │   ├── Filters: category, search, "needs reorder" toggle
│   │   └── Table: Current stock by item
│   │
│   ├── Stocktake
│   │   ├── Active session banner (if in progress)
│   │   ├── "Start New Stocktake" button
│   │   ├── Count entry form (when active)
│   │   └── Session history table
│   │
│   ├── Wastage
│   │   ├── Date range picker
│   │   ├── Summary: total variance, top categories
│   │   └── Detailed variance table
│   │
│   └── Reorder
│       ├── Items below reorder point
│       ├── Days until stockout
│       └── Export CSV button
│
└── Side Panel: Item details / edit
```

### Components

| Component | Purpose |
|-----------|---------|
| `InventoryTable` | Main stock list with sorting/filtering |
| `StocktakeSession` | Active stocktake with count inputs |
| `StocktakeRow` | Single item count entry |
| `WastageReport` | Variance analysis |
| `ReorderSuggestions` | Items needing reorder |
| `ItemDetailPanel` | Edit item, set thresholds |
| `ImportCatalogDialog` | Sync from Square |
| `AddItemDialog` | Manual item creation |

### Hooks

```typescript
// Items
useInventoryItems(filters)
useCreateInventoryItem()
useUpdateInventoryItem()

// Stock
useCurrentStock(venue)
useLowStockItems(venue)

// Stocktake
useActiveStocktake(venue)
useStartStocktake()
useUpdateStocktakeCount()
useCompleteStocktake()

// Reports
useWastageReport(venue, dateRange)
useReorderSuggestions(venue)
```

---

## Edge Functions

### `sync-square-catalog`
- Fetches catalog items from Square API
- Upserts into `inventory_items` matching on `square_catalog_object_id`
- Reuses existing Square auth pattern

---

## Integration Points

| System | Integration |
|--------|-------------|
| Square Orders | Extract `line_items` for sales calculation |
| Square Catalog | One-way sync to populate items |
| Existing Auth | RLS via `allowed_emails` |
| Venue Filter | Consistent multi-venue pattern |

---

## Implementation Phases

### Phase 1: Database (Migration)
- [ ] Create `inventory_items` table
- [ ] Create `stocktake_sessions` table
- [ ] Create `stocktake_counts` table
- [ ] Create `stock_movements` table
- [ ] Create `inventory_current_stock` materialized view
- [ ] Add RLS policies
- [ ] Create helper functions

### Phase 2: Square Integration
- [ ] Create `sync-square-catalog` edge function
- [ ] Map Square categories to inventory categories

### Phase 3: Frontend - Core
- [ ] Add route and nav entry
- [ ] Create `Inventory.tsx` page with tabs
- [ ] Create `InventoryTable` component
- [ ] Create service layer and hooks
- [ ] Add item import/create dialogs

### Phase 4: Frontend - Stocktake
- [ ] Create `StocktakeSession` component
- [ ] Implement start/complete flow
- [ ] Add variance reason selection
- [ ] Session history view

### Phase 5: Frontend - Reports
- [ ] Create `WastageReport` component
- [ ] Create `ReorderSuggestions` component
- [ ] Add CSV export

---

## Key Files to Modify/Create

**Existing (modify):**
- `src/components/layout/AppSidebar.tsx` - Add Inventory nav
- `src/App.tsx` - Add route

**New (create):**
- `supabase/migrations/YYYYMMDD_create_inventory_tables.sql`
- `supabase/functions/sync-square-catalog/index.ts`
- `src/pages/Inventory.tsx`
- `src/components/inventory/*.tsx` (6-8 components)
- `src/hooks/useInventory.ts`
- `src/services/inventoryService.ts`

---

## Scope Decisions

- **Item level**: Finished products (what Square sells) - maps directly to Square line items
- **Categories**: Bar stock only (spirits, beer, wine, mixers) - high-value items
- **Venues**: Both Manor and Hippie Club from the start

---

## Verification

After implementation, verify by:

1. **Database**: Run `SELECT * FROM inventory_items LIMIT 5` to confirm items imported
2. **Square sync**: Trigger catalog sync, verify items appear in UI
3. **Stocktake flow**:
   - Start a session
   - Enter counts for a few items
   - Complete session
   - Verify stock movements created
4. **Wastage**: Create intentional variance, confirm it appears in wastage report
5. **Reorder**: Set low reorder point on an item, verify it appears in suggestions
