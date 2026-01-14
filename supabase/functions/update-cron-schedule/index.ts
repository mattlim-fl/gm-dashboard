// @ts-expect-error - Deno remote import types are not available in this toolchain
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno remote import types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.1"

// Minimal declaration for Deno global
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-api-key, x-client-info",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

/**
 * Get the edge function URL for a notification type
 */
function getFunctionUrl(notificationType: string): string {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const functionName = notificationType === 'trade_report' ? 'trade-report' : 'business-performance'
  return `${SUPABASE_URL}/functions/v1/${functionName}`
}

/**
 * Get the authorization header for cron jobs
 */
function getAuthHeader(): string {
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  return `Bearer ${SUPABASE_ANON_KEY}`
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Supabase credentials not configured' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Parse request body
    const body = await req.json()
    const { notification_type, day_of_week, hour_awst } = body

    if (!notification_type || day_of_week === undefined || hour_awst === undefined) {
      return json({ 
        error: 'Missing required fields: notification_type, day_of_week, hour_awst' 
      }, 400)
    }

    // Validate inputs
    if (!['trade_report', 'business_performance'].includes(notification_type)) {
      return json({ error: 'Invalid notification_type' }, 400)
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return json({ error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)' }, 400)
    }

    if (hour_awst < 0 || hour_awst > 23) {
      return json({ error: 'hour_awst must be between 0 and 23' }, 400)
    }

    // Get cron expression using database function
    const { data: cronData, error: cronError } = await supabase
      .rpc('get_cron_expression', {
        day_of_week,
        hour_awst
      })

    if (cronError) {
      console.error('Error getting cron expression:', cronError)
      return json({ error: 'Failed to calculate cron expression' }, 500)
    }

    const cronExpression = cronData as string
    const jobName = `${notification_type}-notification`
    const functionUrl = getFunctionUrl(notification_type)
    const authHeader = getAuthHeader()

    console.log(`Updating cron job: ${jobName}`)
    console.log(`New schedule: ${cronExpression} (Day ${day_of_week}, Hour ${hour_awst} AWST)`)

    // Unschedule existing job
    try {
      await supabase.rpc('cron.unschedule', { job_name: jobName })
      console.log(`Unscheduled existing job: ${jobName}`)
    } catch (error) {
      // Job might not exist, that's okay
      console.log(`No existing job to unschedule: ${jobName}`)
    }

    // Create new cron job
    const { error: scheduleError } = await supabase.rpc('cron.schedule', {
      job_name: jobName,
      schedule: cronExpression,
      command: `SELECT net.http_post(url:='${functionUrl}', headers:='{"Content-Type": "application/json", "Authorization": "${authHeader}"}'::jsonb, body:='{}'::jsonb) as request_id;`
    })

    if (scheduleError) {
      console.error('Error scheduling cron job:', scheduleError)
      return json({ error: 'Failed to schedule cron job' }, 500)
    }

    // Update notification_settings with new schedule
    const { error: updateError } = await supabase
      .from('notification_settings')
      .update({
        schedule_day_of_week: day_of_week,
        schedule_hour_awst: hour_awst,
        cron_job_name: jobName,
      })
      .eq('notification_type', notification_type)

    if (updateError) {
      console.error('Error updating notification settings:', updateError)
      return json({ error: 'Failed to update notification settings' }, 500)
    }

    console.log(`Successfully updated cron schedule for ${notification_type}`)

    return json({
      success: true,
      message: 'Cron schedule updated successfully',
      job_name: jobName,
      schedule: cronExpression,
      day_of_week,
      hour_awst,
    })
  } catch (error) {
    console.error('Error in update-cron-schedule function:', error)
    const message = error instanceof Error ? error.message : String(error)
    return json({ success: false, error: message }, 500)
  }
})
