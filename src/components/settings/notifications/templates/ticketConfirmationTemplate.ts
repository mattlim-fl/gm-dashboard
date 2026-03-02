interface TicketConfirmationData {
  venue: 'manor' | 'hippie';
  customerName: string;
  bookingDate: string;
  occasionName: string;
  ticketQuantity: string;
  referenceCode: string;
  customerEmail: string;
}

export function generateTicketConfirmationHtml(data: TicketConfirmationData): string {
  const venueDisplayName = data.venue === 'manor' ? 'Manor' : 'Hippie Club';
  const instagramHandle = data.venue === 'manor' ? 'manorleederville' : 'hipeclubperth';
  const facebookHandle = data.venue === 'manor' ? 'manorleederville' : 'hipeclubperth';
  const qty = Number(data.ticketQuantity);
  const ticketLabel = qty === 1 ? 'ticket' : 'tickets';
  const isAre = qty === 1 ? 'is' : 'are';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ticket Confirmation - ${venueDisplayName}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,.1);">
          <div style="text-align: center; color: #6c757d; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px;">
            ${venueDisplayName}
          </div>
          <h1 style="margin: 0 0 8px 0; color: #333; font-size: 24px; font-weight: 600; text-align: center;">
            You're on the list, ${data.customerName}!
          </h1>
          <p style="text-align: center; color: #495057; font-size: 16px; margin: 0 0 32px 0;">
            Your ${data.ticketQuantity} ${ticketLabel} ${isAre} confirmed for ${data.bookingDate}.
          </p>
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); border-radius: 12px; padding: 24px; margin: 0 0 32px 0; text-align: center;">
            <p style="margin: 0 0 8px 0; color: white; font-size: 18px; font-weight: 600;">
              Who's coming with you?
            </p>
            <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.9); font-size: 14px;">
              Add your guest names now so they're on the door list when they arrive.
            </p>
            <a href="#" style="display: inline-block; background: white; color: #ee5a24; padding: 14px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px;">
              Add Guest Names
            </a>
          </div>
          <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin: 0 0 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Event</td>
                <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${data.occasionName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Date</td>
                <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${data.bookingDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #495057; font-weight: 600; border-bottom: 1px solid #e9ecef;">Tickets</td>
                <td style="padding: 10px 0; color: #333; text-align: right; border-bottom: 1px solid #e9ecef;">${data.ticketQuantity}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6c757d; font-size: 13px;">Reference</td>
                <td style="padding: 10px 0; color: #6c757d; font-size: 13px; text-align: right; font-family: 'Courier New', monospace;">${data.referenceCode}</td>
              </tr>
            </table>
          </div>
          <div style="margin: 0 0 32px 0;">
            <h3 style="margin: 0 0 16px 0; color: #333; font-size: 16px; font-weight: 600;">
              On the night
            </h3>
            <div style="background: #fff8e6; border-radius: 8px; padding: 20px; border-left: 4px solid #ffc107;">
              <p style="margin: 0 0 12px 0; color: #495057;">
                <strong>1.</strong> Head to ${venueDisplayName} on the night of your event
              </p>
              <p style="margin: 0 0 12px 0; color: #495057;">
                <strong>2.</strong> Give your name at the door - you're on the guest list!
              </p>
              <p style="margin: 0; color: #495057;">
                <strong>3.</strong> Enjoy your night!
              </p>
            </div>
          </div>
          <p style="color: #6c757d; font-size: 14px; margin: 0 0 32px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
            <strong>Tip:</strong> Make sure all your guests are added to the list before the event. They'll need to give their name at the door.
          </p>
          <div style="text-align: center; margin: 0 0 32px 0;">
            <p style="color: #333; font-size: 16px; margin: 0 0 8px 0;">
              See you there! 🎉
            </p>
            <p style="color: #6c757d; font-size: 14px; margin: 0;">
              The ${venueDisplayName} Team
            </p>
          </div>
          <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e9ecef;">
            <p style="margin: 0 0 12px 0;">
              <a href="https://instagram.com/${instagramHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
                Instagram
              </a>
              <span style="color: #dee2e6;">|</span>
              <a href="https://facebook.com/${facebookHandle}" style="color: #6c757d; text-decoration: none; margin: 0 12px;">
                Facebook
              </a>
            </p>
            <p style="margin: 16px 0 0 0; font-size: 12px; color: #adb5bd;">
              This confirmation was sent to ${data.customerEmail}
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}
