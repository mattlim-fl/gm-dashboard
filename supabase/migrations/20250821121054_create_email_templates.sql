create table if not exists public.email_templates (
  name text primary key,
  subject text,
  html text not null,
  updated_at timestamptz default now()
);

insert into public.email_templates(name, subject, html)
values
('venue-confirmation', 'Booking Confirmation - Manor Perth', $$<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Booking Confirmation - Manor Perth</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
      .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,.1); }
      .header { text-align: center; margin-bottom: 30px; }
      .logo { font-size: 28px; font-weight: bold; color: #8B4513; margin-bottom: 10px; }
      .reference-code { background: linear-gradient(135deg,#f8f9fa 0%,#e9ecef 100%); border: 2px solid #dee2e6; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0; }
      .reference-code-label { font-size: 14px; font-weight: 600; color: #6c757d; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .5px; }
      .reference-code-value { font-size: 24px; font-weight: bold; font-family: 'Courier New', monospace; color: #495057; letter-spacing: 2px; }
      .booking-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; }
      .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e9ecef; }
      .detail-row:last-child { border-bottom: none; margin-bottom: 0; }
      .detail-label { font-weight: 600; color: #495057; }
      .detail-value { color: #6c757d; }
      .message { background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }
      .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">MANOR</div>
        <h1 style="margin:0;color:#333;font-size:24px;">Booking Enquiry Received</h1>
      </div>

      <p>Hi {{customerName}},</p>
      <p>Thank you for your venue booking enquiry with Manor Perth! We've received your request and our team will review it within the next two business days.</p>

      <div class="reference-code">
        <div class="reference-code-label">Reference Code</div>
        <div class="reference-code-value">{{referenceCode}}</div>
      </div>

      <div class="booking-details">
        <h3 style="margin-top:0;color:#333;">Booking Details</h3>
        <div class="detail-row"><span class="detail-label">Venue:</span><span class="detail-value">{{venue}}</span></div>
        <div class="detail-row"><span class="detail-label">Area:</span><span class="detail-value">{{venueArea}}</span></div>
        <div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">{{bookingDate}}</span></div>
        <div class="detail-row"><span class="detail-label">Time:</span><span class="detail-value">{{startTime}} - {{endTime}}</span></div>
        <div class="detail-row"><span class="detail-label">Guests:</span><span class="detail-value">{{guestCount}} people</span></div>
        {{#specialRequests}}
        <div class="detail-row"><span class="detail-label">Special Requests:</span><span class="detail-value">{{specialRequests}}</span></div>
        {{/specialRequests}}
      </div>

      <div class="message">
        <strong>What happens next?</strong><br />
        Our team will review your enquiry and get in touch within the next two business days to discuss availability, pricing, and confirm your booking details.
      </div>

      <p>Please keep your reference code handy for any future correspondence about this booking.</p>

      <div class="footer">
        <p><strong>Manor Perth</strong></p>
        <p style="margin-top:20px;font-size:12px;color:#adb5bd;">This email was sent to {{customerEmail}} in response to your booking enquiry.</p>
      </div>
    </div>
  </body>
</html>$$),
('venue-internal-notification', 'New Venue Enquiry', $$<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Venue Enquiry</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 640px; margin: 0 auto; padding: 20px; }
      h1 { font-size: 20px; margin: 0 0 16px; }
      .section { border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; margin: 12px 0; }
      .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f3f5; }
      .row:last-child { border-bottom: none; }
      .label { color: #495057; font-weight: 600; }
      .value { color: #212529; }
      .muted { color: #868e96; font-size: 12px; }
      .code { font-family: 'Courier New', monospace; background: #f8f9fa; padding: 2px 6px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>New Venue Enquiry <span class="muted">(<span class="code">{{referenceCode}}</span>)</span></h1>

    <div class="section">
      <div class="row"><div class="label">Customer</div><div class="value">{{customerName}}</div></div>
      <div class="row"><div class="label">Email</div><div class="value">{{customerEmail}}</div></div>
      <div class="row"><div class="label">Phone</div><div class="value">{{customerPhone}}</div></div>
      <div class="row"><div class="label">Guests</div><div class="value">{{guestCount}}</div></div>
    </div>

    <div class="section">
      <div class="row"><div class="label">Venue</div><div class="value">{{venue}}</div></div>
      <div class="row"><div class="label">Area</div><div class="value">{{venueArea}}</div></div>
      <div class="row"><div class="label">Date</div><div class="value">{{bookingDate}}</div></div>
      <div class="row"><div class="label">Time</div><div class="value">{{startTime}} - {{endTime}}</div></div>
    </div>

    {{#specialRequests}}
    <div class="section">
      <div class="label">Special Requests</div>
      <div class="value">{{specialRequests}}</div>
    </div>
    {{/specialRequests}}

    <p class="muted">Sent automatically from website. Replying will use the customer's email as reply-to when available.</p>
  </body>
  </html>$$)
ON CONFLICT (name) DO UPDATE SET subject = excluded.subject, html = excluded.html, updated_at = now();;
