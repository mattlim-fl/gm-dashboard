# Email Agent Implementation Plan

> **Status:** In Progress
> **Last Updated:** March 3, 2026

## Overview

Deploy the existing email agent system and architect for future WhatsApp integration. The email agent is largely built but needs configuration, deployment, and knowledge base population.

**Current Status:** Code complete, awaiting deployment/configuration (see `docs/IMPLEMENTATION_STATUS.md` line 40-42)

---

## Phase 1: Gmail OAuth Setup

### 1.1 Google Cloud Console Configuration

**Prerequisites:**
- Google Cloud project with Gmail API enabled
- OAuth consent screen configured (external or internal)
- OAuth 2.0 credentials created (Web application type)

**Required OAuth Scopes:**
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.labels
```

**Authorized Redirect URIs:**
```
https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/email-agent-oauth/callback
```

### 1.2 Environment Variables

Set in Supabase Dashboard → Edge Functions → Secrets:

| Variable | Value |
|----------|-------|
| `GMAIL_CLIENT_ID` | From Google Cloud Console |
| `GMAIL_CLIENT_SECRET` | From Google Cloud Console |
| `CREDENTIALS_ENCRYPTION_KEY` | 64-char hex string for AES-256 |
| `ANTHROPIC_API_KEY` | Claude API key |

### 1.3 Deploy Edge Functions

```bash
cd /Users/matthewlim/Desktop/Fractal\ Projects/gm-dashboard

# Deploy all email agent functions
npx supabase functions deploy email-agent-oauth
npx supabase functions deploy email-agent-process
npx supabase functions deploy email-agent-scheduler
```

### 1.4 Connect Gmail for Each Venue

1. Go to **Settings → API Integrations** in GM Dashboard
2. Select venue (Manor / Hippie Club)
3. Under "Email Agent (Gmail)", click **Connect Gmail**
4. Complete OAuth consent flow
5. Click **Test Connection** to verify

---

## Phase 2: Enable Scheduler (pg_cron)

### 2.1 Enable pg_cron Extension

```sql
-- Run via Supabase SQL Editor or MCP
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 2.2 Create Cron Job

```sql
-- Poll every 5 minutes
SELECT cron.schedule(
  'email-agent-poll',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/email-agent-scheduler',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  );
  $$
);
```

### 2.3 Alternative: Manual Trigger for Testing

Before enabling cron, test manually:
```bash
curl -X POST https://plksvatjdylpuhjitbfc.supabase.co/functions/v1/email-agent-scheduler \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

## Phase 3: Knowledge Base Population

### 3.1 Knowledge File Structure

Files are stored in `knowledge_files` table with:
- `venue` - which venue (or null for global)
- `category` - which email category (or null for global)
- `slug` - URL-friendly identifier
- `title` - Display name
- `content` - Markdown content

### 3.2 Required Knowledge Files

**Global Files (all venues):**
| Slug | Purpose |
|------|---------|
| `tone-guide` | Writing style, formality level, brand voice |
| `general-faqs` | Common questions across all venues |

**Per-Venue Files:**
| Slug | Purpose |
|------|---------|
| `venue-info` | Address, hours, contact details, parking |
| `booking-policy` | Booking types, deposits, cancellations |
| `lost-property-process` | How lost property is handled, timeframes |
| `complaint-handling` | Escalation process, refund policies |
| `ban-appeal-process` | How to appeal, what information needed |
| `event-info` | Current/upcoming events, ticket info |
| `function-packages` | Venue hire options, pricing, inclusions |

### 3.3 Populate via UI

1. Go to **Settings → API Integrations → Email Agent**
2. Click **Knowledge Base** tab
3. Create files for each venue using the editor
4. Assign to specific categories or mark as global

---

## Phase 4: Testing & Validation

### 4.1 End-to-End Test Flow

1. Send test email to venue inbox (e.g., hello@manorperth.com)
2. Manually trigger scheduler or wait for cron
3. Check **Activity Log** tab in Email Agent Settings
4. Verify:
   - Email classified correctly
   - Confidence score reasonable (>0.7)
   - Draft generated (if category has auto_draft enabled)
5. Check Gmail for draft in Drafts folder

### 4.2 Test Each Category

| Category | Test Email Subject |
|----------|-------------------|
| `general_enquiry` | "Question about your venue" |
| `booking` | "I'd like to book a table" |
| `lost_and_found` | "I lost my wallet last Saturday" |
| `complaint` | "Very disappointed with my experience" |
| `ban_appeal` | "I was banned and would like to appeal" |
| `event_enquiry` | "What events do you have coming up?" |
| `function_inquiry` | "Looking to host a birthday party" |

### 4.3 Monitor Costs

Check `email_agent_logs` for token usage:
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as emails_processed,
  SUM((token_usage->>'classification_tokens')::int) as classification_tokens,
  SUM((token_usage->>'draft_tokens')::int) as draft_tokens
FROM email_agent_logs
WHERE venue = 'manor'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Phase 5: WhatsApp Integration Architecture

### 5.1 Shared Message Processing Core

Refactor to create a **channel-agnostic message processor**:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Gmail     │     │  WhatsApp   │     │  (Future)   │
│   Adapter   │     │   Adapter   │     │   Adapter   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────┬───────┴───────────────────┘
                   ▼
         ┌─────────────────┐
         │ Message Router  │
         │ (normalize msg) │
         └────────┬────────┘
                  ▼
         ┌─────────────────┐
         │ Classification  │
         │ (Claude Haiku)  │
         └────────┬────────┘
                  ▼
         ┌─────────────────┐
         │ Draft Generator │
         │ (Claude Sonnet) │
         └────────┬────────┘
                  ▼
         ┌─────────────────┐
         │ Response Router │
         │ (back to channel│
         └─────────────────┘
```

### 5.2 Database Schema Updates

```sql
-- Rename/extend tables for multi-channel support
ALTER TABLE email_agent_config RENAME TO message_agent_config;
ALTER TABLE message_agent_config ADD COLUMN channel TEXT DEFAULT 'email';

-- Add WhatsApp-specific fields
ALTER TABLE message_agent_config ADD COLUMN whatsapp_phone_id TEXT;
ALTER TABLE message_agent_config ADD COLUMN whatsapp_access_token_encrypted TEXT;

-- Extend logs for multi-channel
ALTER TABLE email_agent_logs RENAME TO message_agent_logs;
ALTER TABLE message_agent_logs ADD COLUMN channel TEXT DEFAULT 'email';
```

### 5.3 WhatsApp Business API Setup

**Prerequisites:**
- Meta Business Account
- WhatsApp Business API access
- Phone number registered with WhatsApp Business

**Required Environment Variables:**
```
WHATSAPP_BUSINESS_API_KEY   # Already in config.ts
WHATSAPP_PHONE_NUMBER_ID    # Per-venue, stored in DB
WHATSAPP_VERIFY_TOKEN       # For webhook verification
```

### 5.4 New Edge Functions

| Function | Purpose |
|----------|---------|
| `whatsapp-webhook` | Receive incoming messages from WhatsApp |
| `whatsapp-send` | Send messages/templates via WhatsApp API |
| `message-agent-process` | Unified processor for all channels |

### 5.5 WhatsApp-Specific Considerations

1. **Response Time** - WhatsApp expects faster responses than email
   - Consider auto-acknowledgment: "Thanks for your message! We'll get back to you shortly."
   - Process immediately vs. batch polling

2. **Message Templates** - WhatsApp requires pre-approved templates for business-initiated messages
   - Create templates for common responses
   - Use freeform only within 24-hour customer service window

3. **Rich Media** - WhatsApp supports images, documents, locations
   - Adapt responses to include relevant media (maps, menus, etc.)

4. **Conversation Threading** - WhatsApp threads differently than email
   - Track conversation state in database
   - Handle multi-turn conversations

---

## Implementation Order

### Immediate (This Session) - COMPLETED
1. ✅ Document this plan
2. ✅ Deploy edge functions (email-agent-oauth, email-agent-process, email-agent-scheduler)
3. ✅ Create pg_cron job (job ID 11, runs every 5 minutes)
4. ✅ Add Manor venue configuration
5. ✅ Seed knowledge files for Manor (9 files)
6. ⏳ User configures Google Cloud OAuth credentials
7. ⏳ User sets environment variables in Supabase (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, ANTHROPIC_API_KEY)

### Short-term (After OAuth Setup)
1. Connect Gmail for Hippie Club (test venue)
2. Enable email agent for Hippie Club
3. End-to-end testing with test emails
4. Connect Gmail for Manor

### Medium-term
1. Connect Gmail for all venues
2. Comprehensive knowledge base
3. Monitor and tune classification accuracy
4. Add inbox UI to dashboard (optional)

### Future
1. WhatsApp Business API setup
2. Refactor to shared message processor
3. WhatsApp adapter implementation
4. Multi-channel inbox UI

---

## Key Files Reference

| Purpose | Path |
|---------|------|
| Gmail OAuth | `supabase/functions/email-agent-oauth/index.ts` |
| Email processor | `supabase/functions/email-agent-process/index.ts` |
| Scheduler | `supabase/functions/email-agent-scheduler/index.ts` |
| Gmail client | `supabase/functions/_shared/gmail.ts` |
| Claude client | `supabase/functions/_shared/claude.ts` |
| Settings UI | `src/components/settings/EmailAgentSettings.tsx` |
| Knowledge editor | `src/components/settings/KnowledgeFileEditor.tsx` |
| DB schema | `supabase/migrations/20260218000000_create_email_agent_tables.sql` |

---

## Verification Checklist

- [ ] Google Cloud OAuth credentials created
- [ ] Environment variables set in Supabase (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, ANTHROPIC_API_KEY)
- [x] Edge functions deployed (email-agent-oauth, email-agent-process, email-agent-scheduler)
- [ ] Gmail connected for at least one venue
- [x] pg_cron enabled and job scheduled (job ID 11, */5 * * * *)
- [x] Knowledge files populated for both venues (Hippie: 9 files, Manor: 9 files)
- [ ] Test email sent and processed successfully
- [ ] Draft appears in Gmail
- [ ] Activity log shows correct classification

---

## Deployment Log

### March 3, 2026
- Deployed 3 edge functions to production
- Created cron job for email-agent-scheduler (every 5 minutes)
- Added Manor venue to email_agent_config
- Seeded 9 knowledge files for Manor (matching Hippie structure)
- **Next steps:** Configure Google Cloud OAuth credentials and set Supabase secrets
