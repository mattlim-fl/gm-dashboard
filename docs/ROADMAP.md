# GM Dashboard Roadmap

## Overview

This roadmap outlines the phased development of the GM Dashboard system, designed to systematically reduce manual administrative work and embed operational intelligence into venue management.

---

## Phase 1: Financial & Inbound Control

**Timeline:** Now → mid-February  
**Status:** Mostly built — focus on hardening and embedding  
**Goal:** Remove manual reporting work and reduce weekly cognitive load

### A. Venue Performance & Financial Reporting

**Sunday: Trade Snapshot**
- Revenue summary
- Attendance figures
- Sales mix highlights

**Wednesday: Weekly Financial Performance**
- Labour %
- Security %
- COGS %
- Variance vs benchmark P&L

**Status:** ✅ Already implemented  
**Needs:**
- Final prompt tuning
- Lock timing + distribution (eliminate manual sends)
- Establish as source of truth

### B. Contractor Invoice Pipeline

**Capabilities:**
- Auto-forward all invoices to Xero/Hubdoc
- System flags:
  - Variance vs historical norms
  - Missing details
- Human review becomes exception-based, not manual triage

### C. Inbound Email & Customer Enquiries

**Central Inbox Management** (hello@ / operations@)

**Auto-routing + templated responses for:**
- Lost property
- Function enquiries
- Scantek bans
- Opening hours

**Escalation:** Only exceptions reach Michael or Emily

### Phase 1 Success Metrics

- [ ] No manual report compilation required
- [ ] No manual email routing
- [ ] All previous manual workflows replaced by systems

---

## Phase 2: Venue Operations & Control

**Timeline:** mid-February → March  
**Goal:** Remove ongoing admin drag without removing ownership

### A. Inventory Intelligence

**Workflow:**
1. Square sales data → prefilled stocktake
2. GM confirms actual count
3. System auto-calculates:
   - Variance / wastage
   - Recommended reorder quantities

### B. Ordering Workflow

**GM Dashboard generates:**
- Booze order list
- Consumables order list

**GM's task:** Execute in supplier portals (no thinking, no calculations)

### C. Venue Maintenance & Contractors

**Issue Tracking:**
- Log issues (photo + note)
- Track until resolved
- Embedded contractor list
- Status visibility: Open / In Progress / Done

### D. Operating Rhythm

**Monday Debrief (Scaffolded):**
- What went well
- What didn't
- What changes this week
- Auto-generated agenda using weekend data

### Phase 2 Success Metrics

- [ ] GMs spend time running venues, not managing lists
- [ ] Maintenance doesn't rely on memory
- [ ] Leadership has visibility without direct involvement

---

## Phase 3: Role Systemisation & Scale Layer

**Timeline:** Late March  
**Goal:** Make roles survive people leaving — create institutional memory

### Capabilities

**Embedded SOPs per Role**
- Clear ownership definitions:
  - What Michael owns
  - What Pat owns
  - What Emily owns

**Task Flows**
- Live inside the dashboard
- Reusable across venues

**Scale Architecture**
- New venue = reuse system, not re-invent operations
- Dashboard becomes institutional memory

### Phase 3 Success Metrics

- [ ] Hiring doesn't create complexity explosion
- [ ] Role transitions don't lose operational knowledge
- [ ] New venues can be onboarded with existing systems

---

## Technical Dependencies

### Phase 1
- Email integration (hello@, operations@)
- Xero/Hubdoc API integration
- Automated report generation and distribution
- Template response system

### Phase 2
- Square POS integration
- Inventory management system
- Contractor database
- Issue tracking system
- Agenda generation from data

### Phase 3
- SOP management system
- Role-based access control
- Multi-venue architecture
- Knowledge base system

---

## Notes

- Each phase builds on the previous
- Focus is on embedding systems, not adding complexity
- Success = reduced manual work, not more features
- System should make roles scalable and transferable
