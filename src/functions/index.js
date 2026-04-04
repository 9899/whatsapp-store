const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

/**
 * Triggered whenever a new document is created in the "subscribers" collection.
 * Reads store settings (email + app password + catalogue URL) from Firestore,
 * then sends the catalogue link via the admin's own Gmail account.
 */
exports.sendCatalogueEmail = functions.firestore
  .document("subscribers/{subscriberId}")
  .onCreate(async (snap, context) => {
    const subscriber = snap.data();
    const toEmail    = subscriber.email;

    if (!toEmail) {
      console.log("No email on subscriber doc — skipping.");
      return null;
    }

    // Load store settings from Firestore
    const settingsDoc = await db.collection("settings").doc("store").get();
    if (!settingsDoc.exists) {
      console.log("No settings doc found — skipping.");
      return null;
    }

    const settings = settingsDoc.data();
    const {
      email:        fromEmail,       // e.g. yourstore@gmail.com
      gmailAppPassword,              // 16-char Gmail App Password
      storeName    = "Our Store",
      catalogueUrl,                  // PDF link saved in admin
      tagline      = "",
    } = settings;

    if (!fromEmail || !gmailAppPassword) {
      console.log("Gmail credentials not configured in settings — skipping.");
      // Mark as pending so admin knows
      await snap.ref.update({ sent: false, error: "Gmail not configured" });
      return null;
    }

    if (!catalogueUrl) {
      console.log("No catalogue URL in settings — skipping.");
      await snap.ref.update({ sent: false, error: "No catalogue URL" });
      return null;
    }

    // Create transporter using admin's Gmail + App Password
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: fromEmail,
        pass: gmailAppPassword,
      },
    });

    const mailOptions = {
      from:    `"${storeName}" <${fromEmail}>`,
      to:      toEmail,
      subject: `Your ${storeName} Catalogue 📦`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',system-ui,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

                  <!-- Header -->
                  <tr>
                    <td style="background:#22c55e;padding:28px 40px;text-align:center;">
                      <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.5px;text-transform:uppercase;">
                        ${storeName}
                      </h1>
                      ${tagline ? `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.8);">${tagline}</p>` : ""}
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <p style="margin:0 0 16px;font-size:16px;color:#0f172a;font-weight:600;">
                        Hi there! 👋
                      </p>
                      <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                        Thank you for your interest in <strong>${storeName}</strong>. 
                        Here is our product catalogue — browse our full range and 
                        place your order directly on WhatsApp.
                      </p>

                      <!-- CTA Button -->
                      <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                        <tr>
                          <td style="background:#22c55e;border-radius:8px;">
                            <a href="${catalogueUrl}" 
                               style="display:inline-block;padding:14px 32px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:.3px;">
                              📄 View / Download Catalogue
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">
                        Or copy this link:
                      </p>
                      <p style="margin:0 0 32px;font-size:12px;color:#64748b;background:#f4f6f9;padding:10px 14px;border-radius:6px;word-break:break-all;">
                        ${catalogueUrl}
                      </p>

                      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
                        Have questions? Reply to this email or reach us on WhatsApp.
                        We're happy to help!
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background:#f8f9fb;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
                      <p style="margin:0;font-size:11px;color:#94a3b8;">
                        © ${new Date().getFullYear()} ${storeName}. You received this because you requested our catalogue.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Catalogue sent to ${toEmail}`);
      await snap.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (err) {
      console.error("Email send failed:", err);
      await snap.ref.update({ sent: false, error: err.message });
    }

    return null;
  });
