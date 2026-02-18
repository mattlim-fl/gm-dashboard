-- Email Agent Tables for Noxfolk Email Automation
-- Scope: PoC for Hippie Club only, draft-only mode

-- =====================================================
-- email_agent_config: Per-venue Gmail connection settings
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue text NOT NULL CHECK (venue IN ('hippie', 'manor')),
  mailbox_email text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  gmail_refresh_token_encrypted text, -- AES-256-GCM encrypted via _shared/crypto.ts
  poll_interval_minutes integer NOT NULL DEFAULT 5,
  last_poll_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_agent_config_venue_unique UNIQUE (venue)
);

-- Enable RLS
ALTER TABLE public.email_agent_config ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can access
CREATE POLICY "Authenticated users can read email_agent_config"
  ON public.email_agent_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update email_agent_config"
  ON public.email_agent_config FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email_agent_config"
  ON public.email_agent_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role needs full access for edge functions
CREATE POLICY "Service role has full access to email_agent_config"
  ON public.email_agent_config FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- email_categories: Classification categories (seeded)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  gmail_label_name text NOT NULL, -- e.g., "Noxfolk/Booking"
  auto_draft boolean NOT NULL DEFAULT true, -- Whether to generate draft for this category
  priority integer NOT NULL DEFAULT 0, -- Higher = more urgent
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read email_categories"
  ON public.email_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role has full access to email_categories"
  ON public.email_categories FOR ALL
  TO service_role
  USING (true);

-- Seed categories from spec
INSERT INTO public.email_categories (category_key, display_name, description, gmail_label_name, auto_draft, priority)
VALUES
  ('general_enquiry', 'General Enquiry', 'Opening hours, location questions, general info', 'Noxfolk/General', true, 1),
  ('booking', 'Booking Request', 'Table/event/VIP booking requests', 'Noxfolk/Booking', true, 3),
  ('lost_and_found', 'Lost & Found', 'Lost item reports and claims', 'Noxfolk/LostFound', true, 2),
  ('complaint', 'Complaint', 'Negative experiences, issues, refund requests', 'Noxfolk/Complaint', true, 4),
  ('ban_appeal', 'Ban Appeal', 'Requests to lift venue bans', 'Noxfolk/BanAppeal', true, 3),
  ('supplier', 'Supplier', 'Vendor and supplier communications', 'Noxfolk/Supplier', false, 1),
  ('event_enquiry', 'Event Enquiry', 'DJ/promoter pitches, event partnerships', 'Noxfolk/Event', true, 2),
  ('spam', 'Spam', 'Spam, marketing, irrelevant emails', 'Noxfolk/Spam', false, 0),
  ('other', 'Other', 'Emails that do not fit other categories', 'Noxfolk/Other', true, 1)
ON CONFLICT (category_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  gmail_label_name = EXCLUDED.gmail_label_name,
  auto_draft = EXCLUDED.auto_draft,
  priority = EXCLUDED.priority;

-- =====================================================
-- knowledge_files: Markdown content per category
-- =====================================================
CREATE TABLE IF NOT EXISTS public.knowledge_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue text NOT NULL CHECK (venue IN ('hippie', 'manor')),
  category_key text REFERENCES public.email_categories(category_key) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL, -- URL-friendly identifier
  content text NOT NULL, -- Markdown content
  is_global boolean NOT NULL DEFAULT false, -- Applies to all categories (e.g., tone guide)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_files_venue_slug_unique UNIQUE (venue, slug)
);

-- Enable RLS
ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read knowledge_files"
  ON public.knowledge_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update knowledge_files"
  ON public.knowledge_files FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert knowledge_files"
  ON public.knowledge_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete knowledge_files"
  ON public.knowledge_files FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Service role has full access to knowledge_files"
  ON public.knowledge_files FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- email_agent_logs: Processing audit trail
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue text NOT NULL CHECK (venue IN ('hippie', 'manor')),
  gmail_message_id text NOT NULL,
  gmail_thread_id text,
  from_email text,
  from_name text,
  subject text,
  received_at timestamptz,

  -- Classification
  classified_category text REFERENCES public.email_categories(category_key),
  classification_confidence numeric(3, 2), -- 0.00 to 1.00
  classification_reasoning text,

  -- Processing status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Email fetched, not yet classified
    'classified',   -- Classified but not drafted
    'drafted',      -- Draft created in Gmail
    'skipped',      -- Skipped (spam, supplier, etc.)
    'error'         -- Processing error
  )),

  -- Draft info
  draft_content text,
  gmail_draft_id text,

  -- Token usage for cost tracking
  classification_tokens_used integer,
  draft_tokens_used integer,

  -- Error tracking
  error_message text,

  -- Timestamps
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate processing
  CONSTRAINT email_agent_logs_gmail_message_unique UNIQUE (gmail_message_id)
);

-- Enable RLS
ALTER TABLE public.email_agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email_agent_logs"
  ON public.email_agent_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role has full access to email_agent_logs"
  ON public.email_agent_logs FOR ALL
  TO service_role
  USING (true);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_email_agent_logs_venue_status
  ON public.email_agent_logs (venue, status);

CREATE INDEX IF NOT EXISTS idx_email_agent_logs_created_at
  ON public.email_agent_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_agent_logs_gmail_thread_id
  ON public.email_agent_logs (gmail_thread_id);

-- =====================================================
-- Seed initial knowledge files for Hippie Club
-- Placeholder content - staff will edit via Settings UI
-- =====================================================
INSERT INTO public.knowledge_files (venue, category_key, title, slug, content, is_global)
VALUES
  -- Global files (apply to all categories)
  ('hippie', NULL, 'Venue Information', 'venue-info', '# Hippie Club

## Location
Hippie Club is located in Perth, Western Australia.

## Opening Hours
- Friday & Saturday: 9pm - 5am
- Other nights: Check our social media for special events

## Capacity
Licensed for [X] patrons.

## Dress Code
Smart casual. No thongs, singlets, or workwear.

## Age Restriction
18+ only. Valid photo ID required.', true),

  ('hippie', NULL, 'FAQs', 'faqs', '# Frequently Asked Questions

## What time does the club open?
We open at 9pm on Friday and Saturday nights.

## Do I need to book?
Walk-ins are welcome, but we recommend booking for groups of 6+.

## Is there a cover charge?
Entry fees vary by night. Check our website or socials for current pricing.

## Can I bring my own drinks?
No. All beverages must be purchased from our bars.

## Do you have parking?
Street parking is available nearby. We recommend using Uber or taxi.', true),

  ('hippie', NULL, 'Tone Guide', 'tone-guide', '# Brand Voice Guidelines

## Tone
- Friendly and welcoming
- Professional but not stuffy
- Helpful and solution-oriented
- Confident but not arrogant

## Language
- Use "we" and "our" when referring to Hippie Club
- Address customers by their first name when known
- Avoid jargon or overly formal language
- Keep responses concise but complete

## Sign-off
End emails with:
"See you on the dancefloor!"
or
"Cheers,"

Followed by:
"The Hippie Club Team"', true),

  -- Category-specific files
  ('hippie', 'booking', 'Booking Policy', 'booking-policy', '# Booking Policy

## Table Bookings
- Minimum spend applies for booth/table bookings
- Bookings require a deposit (non-refundable unless cancelled 48h+ in advance)
- Arrive within 30 minutes of your booking time or forfeit your reservation

## Group Bookings
- For groups of 10+, please contact us directly
- Function packages available for private events

## How to Book
Direct customers to our website booking form or ask them to DM us on Instagram.', false),

  ('hippie', 'lost_and_found', 'Lost & Found Process', 'lost-and-found-process', '# Lost & Found

## If a customer has lost something:
1. Ask for a description of the item
2. Ask what date they visited
3. Check our lost property storage
4. Items are held for 30 days

## Collection
Items can be collected during venue hours with valid ID.

## Shipping
We can arrange shipping for a fee if the customer cannot collect in person.', false),

  ('hippie', 'complaint', 'Complaint Handling', 'complaint-handling', '# Handling Complaints

## Approach
- Acknowledge their frustration
- Apologize for their experience (not necessarily admitting fault)
- Ask for specifics to investigate
- Promise to follow up within 48 hours

## Do NOT:
- Make promises about refunds without manager approval
- Argue or become defensive
- Share internal information about staff or security

## Escalation
Serious complaints should be flagged for manager review.', false),

  ('hippie', 'complaint', 'Refund Policy', 'refund-policy', '# Refund Policy

## Ticket Refunds
- Refunds available up to 48 hours before the event
- No refunds for no-shows

## Booking Deposits
- Deposits are non-refundable unless:
  - We cancel the event
  - Customer cancels 48+ hours in advance

## Complaints
Refunds for poor experiences are at management discretion. Do not promise refunds - escalate to a manager.', false),

  ('hippie', 'ban_appeal', 'Ban Policy', 'ban-policy', '# Ban Appeals

## Standard Response
Thank the customer for reaching out. Explain that bans are reviewed on a case-by-case basis.

## Information Needed
- Full name
- Date of incident
- Brief explanation of what they believe happened
- Why they should be reconsidered

## Process
Forward the appeal details to management for review. Response time is typically 5-7 business days.', false),

  ('hippie', 'event_enquiry', 'Event Submissions', 'event-submissions', '# DJ/Promoter Enquiries

## What We Need
- Name and artist/company name
- Genre/style
- Links to mixes, social media, or previous events
- Proposed dates/availability

## Response
Thank them for their interest. Explain that our bookings team reviews submissions monthly.

## Note
We do not guarantee responses to all submissions.', false)

ON CONFLICT (venue, slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  category_key = EXCLUDED.category_key,
  is_global = EXCLUDED.is_global,
  updated_at = now();

-- =====================================================
-- Seed initial config for Hippie Club (disabled by default)
-- =====================================================
INSERT INTO public.email_agent_config (venue, mailbox_email, enabled, poll_interval_minutes)
VALUES ('hippie', 'info@hippieclub.com', false, 5)
ON CONFLICT (venue) DO NOTHING;

-- =====================================================
-- Update trigger for updated_at columns
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_email_agent_config_updated_at ON public.email_agent_config;
CREATE TRIGGER update_email_agent_config_updated_at
  BEFORE UPDATE ON public.email_agent_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_knowledge_files_updated_at ON public.knowledge_files;
CREATE TRIGGER update_knowledge_files_updated_at
  BEFORE UPDATE ON public.knowledge_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_agent_logs_updated_at ON public.email_agent_logs;
CREATE TRIGGER update_email_agent_logs_updated_at
  BEFORE UPDATE ON public.email_agent_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
