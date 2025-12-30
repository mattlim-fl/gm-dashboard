-- RBAC v3: Enqueue staff invite email when a new allowed_emails row is created

CREATE OR REPLACE FUNCTION public.enqueue_staff_invite_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  existing_user auth.users;
BEGIN
  -- If a user already exists for this email, don't send an invite
  SELECT u.*
  INTO existing_user
  FROM auth.users u
  WHERE u.email = NEW.email
  LIMIT 1;

  IF FOUND THEN
    RETURN NEW;
  END IF;

  -- Enqueue an invite email; the email system is responsible for turning this into
  -- a link like /auth?mode=invite&email=<email>
  INSERT INTO public.email_events (recipient_email, template, status, metadata)
  VALUES (
    NEW.email,
    'staff_invite',
    'queued',
    jsonb_build_object(
      'email', NEW.email,
      'invited_by', NEW.invited_by,
      'source', 'allowed_emails'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_allowed_emails_insert_invite ON public.allowed_emails;

CREATE TRIGGER on_allowed_emails_insert_invite
AFTER INSERT ON public.allowed_emails
FOR EACH ROW
EXECUTE PROCEDURE public.enqueue_staff_invite_email();


















