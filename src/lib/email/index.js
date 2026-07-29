/**
 * TX Localist — transactional email via Resend.
 *
 * All outbound email goes through the `sendEmail` helper here so we have
 * one place to swap providers, add logging, or mock in tests.
 *
 * Usage:
 *   import { sendEmail } from "@/lib/email";
 *   await sendEmail({ to, subject, html });
 */

import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "Texas Localist <hello@txlocalist.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://txlocalist.com";

// ─────────────────────────────────────────────────────────────────────────────
// Low-level send helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a single transactional email.
 * Returns { success: true } or { success: false, error }.
 * Never throws — email failures are logged but should not crash the action.
 */
export async function sendEmail({ to, subject, html, text }) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || stripHtml(html),
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return { success: false, error };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[email] Unexpected error:", err);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transactional email functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Welcome email — sent when a new user registers.
 */
export async function sendWelcomeEmail({ to, isOwner = false }) {
  const subject = isOwner
    ? "Welcome to TX Localist — let's build your listing"
    : "Welcome to TX Localist";

  const html = welcomeTemplate({ email: to, isOwner, siteUrl: SITE });
  return sendEmail({ to, subject, html });
}

/**
 * Listing published — sent when a business goes ACTIVE.
 */
export async function sendListingPublishedEmail({ to, businessName, businessSlug }) {
  const listingUrl = `${SITE}/business/${businessSlug}`;
  const subject = `Your listing is live: ${businessName}`;
  const html = listingPublishedTemplate({ businessName, listingUrl, siteUrl: SITE });
  return sendEmail({ to, subject, html });
}

/**
 * Listing suspended — sent by admin when a business is suspended.
 */
export async function sendListingSuspendedEmail({ to, businessName, reason }) {
  const subject = `Important: Your listing has been suspended`;
  const html = listingSuspendedTemplate({ businessName, reason, siteUrl: SITE });
  return sendEmail({ to, subject, html });
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML templates  (inline styles for email client compatibility)
// ─────────────────────────────────────────────────────────────────────────────

function emailShell({ title, body, siteUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2D241E;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background:#2D241E;padding:24px 32px;border-radius:8px 8px 0 0;text-align:center;">
              <span style="font-size:22px;font-weight:800;color:#F9C846;letter-spacing:0.05em;">TX LOCALIST</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-left:1px solid #e8e0d4;border-right:1px solid #e8e0d4;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f5f0ea;padding:20px 32px;border-radius:0 0 8px 8px;border:1px solid #e8e0d4;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6A4A31;">
                © ${new Date().getFullYear()} TX Localist · Texas Business Directory<br>
                <a href="${siteUrl}" style="color:#4A9D9C;text-decoration:none;">txlocalist.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#4A9D9C;color:#ffffff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:100px;text-decoration:none;letter-spacing:0.04em;margin:8px 0;">${label}</a>`;
}

function welcomeTemplate({ email, isOwner, siteUrl }) {
  const ownerBody = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#2D241E;">You're in. Let's build your listing.</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a3a30;">
      Welcome to TX Localist! Your owner account is ready. The next step is creating your first listing so local customers can find you.
    </p>
    <p style="margin:0 0 28px;text-align:center;">${btn(`${siteUrl}/dashboard/businesses/new`, "Create Your Listing →")}</p>
    <p style="margin:0 0 8px;font-size:14px;color:#6A4A31;"><strong>What's included on a free listing:</strong></p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#4a3a30;line-height:1.8;">
      <li>Your business name in city + keyword results</li>
      <li>1 photo</li>
      <li>Description and category tags</li>
    </ul>
    <p style="margin:0;font-size:14px;color:#6A4A31;">
      Ready to show contact info, your website, and more?
      <a href="${siteUrl}/about#pricing" style="color:#4A9D9C;">View paid plans →</a>
    </p>`;

  const userBody = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#2D241E;">Welcome to TX Localist!</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a3a30;">
      Your account is ready. Start exploring local Texas businesses, save your favorites, and discover what's happening in your city.
    </p>
    <p style="margin:0 0 28px;text-align:center;">${btn(`${siteUrl}/search`, "Explore Businesses →")}</p>
    <p style="margin:0;font-size:14px;color:#6A4A31;">
      Own a local business?
      <a href="${siteUrl}/post-your-business" style="color:#4A9D9C;">Add your listing →</a>
    </p>`;

  return emailShell({
    title: isOwner ? "Welcome — TX Localist" : "Welcome to TX Localist",
    body: isOwner ? ownerBody : userBody,
    siteUrl,
  });
}

function listingPublishedTemplate({ businessName, listingUrl, siteUrl }) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#2D241E;">Your listing is live! 🎉</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a3a30;">
      <strong>${businessName}</strong> is now visible to local customers searching TX Localist. Here's your live listing:
    </p>
    <p style="margin:0 0 28px;text-align:center;">${btn(listingUrl, "View Your Listing →")}</p>
    <p style="margin:0 0 8px;font-size:14px;color:#6A4A31;"><strong>Boost your visibility:</strong></p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#4a3a30;line-height:1.8;">
      <li>Add your phone, email, and website with a paid plan</li>
      <li>Upload more photos to attract more clicks</li>
      <li>Post a job opening to reach local candidates</li>
    </ul>
    <p style="margin:0;text-align:center;">${btn(`${siteUrl}/about#pricing`, "Upgrade Your Plan")}</p>`;

  return emailShell({ title: `${businessName} is live on TX Localist`, body, siteUrl });
}

function listingSuspendedTemplate({ businessName, reason, siteUrl }) {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#D64933;">Listing Suspended</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a3a30;">
      Your listing <strong>${businessName}</strong> has been temporarily suspended.
      ${reason ? `<br><br><em>Reason: ${reason}</em>` : ""}
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#4a3a30;">
      If you believe this was a mistake or have questions, please reach out to our support team.
    </p>
    <p style="margin:0;text-align:center;">${btn(`${siteUrl}/contact`, "Contact Support")}</p>`;

  return emailShell({ title: `Listing suspended — ${businessName}`, body, siteUrl });
}

// ─────────────────────────────────────────────────────────────────────────────
// Util
// ─────────────────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
