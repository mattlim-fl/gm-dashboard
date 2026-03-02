-- Migration: Rename organization 'fractal' to 'noxfolk'
-- The organization that owns Manor and Hippie Club is Noxfolk, not Fractal

-- Step 1: Insert the new organization
INSERT INTO public.organizations (id, name)
VALUES ('noxfolk', 'Noxfolk')
ON CONFLICT (id) DO NOTHING;

-- Step 2: Update venue_organizations references to point to new org
UPDATE public.venue_organizations
SET organization_id = 'noxfolk'
WHERE organization_id = 'fractal';

-- Step 3: Update any existing credentials that reference the old org
UPDATE public.venue_api_credentials
SET organization_id = 'noxfolk'
WHERE organization_id = 'fractal';

-- Step 4: Delete the old organization (now has no references)
DELETE FROM public.organizations
WHERE id = 'fractal';

-- Update comment
COMMENT ON TABLE public.organizations IS 'Organization groupings for venues (e.g., Noxfolk owns Manor and Hippie)';
