insert into public.email_templates(name, subject, html)
values ('karaoke-confirmation', 'Karaoke Booking Confirmation - Manor Perth', $$<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Karaoke Booking Confirmation - Manor Perth</title>
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
        <h1 style="margin:0;color:#333;font-size:24px;">Karaoke Booking Confirmed</h1>
      </div>

      <p>Hi {{customerName}},</p>
      <p>Your karaoke booking at Manor has been confirmed. We look forward to hosting you!</p>

      <div class="reference-code">
        <div class="reference-code-label">Reference Code</div>
        <div class="reference-code-value">{{referenceCode}}</div>
      </div>

      <div class="booking-details">
        <h3 style="margin-top:0;color:#333;">Booking Details</h3>
        <div class="detail-row"><span class="detail-label">Venue:</span><span class="detail-value">{{venue}}</span></div>
        <div class="detail-row"><span class="detail-label">Booth:</span><span class="detail-value">{{boothName}}</span></div>
        <div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">{{bookingDate}}</span></div>
        <div class="detail-row"><span class="detail-label">Time:</span><span class="detail-value">{{startTime}} - {{endTime}}</span></div>
        <div class="detail-row"><span class="detail-label">Guests:</span><span class="detail-value">{{guestCount}} people</span></div>
      </div>

      <div class="message">
        <strong>Need to make a change?</strong><br />
        Reply to this email and our team will assist you shortly.
      </div>

      <div class="footer">
        <p><strong>Manor Perth</strong></p>
        <p style="margin-top:20px;font-size:12px;color:#adb5bd;">This email was sent to {{customerEmail}} for your karaoke booking.</p>
      </div>
    </div>
  </body>
</html>$$)
ON CONFLICT (name) DO UPDATE SET subject = excluded.subject, html = excluded.html, updated_at = now();;
