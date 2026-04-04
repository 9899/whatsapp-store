module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ status: "ok" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to, storeName, catalogueUrl, tagline, resendApiKey } = req.body;

  if (!to || !resendApiKey || !catalogueUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:#22c55e;padding:28px 40px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;text-transform:uppercase;">${storeName || "Our Store"}</h1>
        ${tagline ? `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.85);">${tagline}</p>` : ""}
      </div>
      <div style="background:#fff;padding:40px;border:1px solid #e2e8f0;">
        <p style="font-size:16px;color:#0f172a;font-weight:600;margin:0 0 12px;">Hi there! 👋</p>
        <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 24px;">
          Thanks for your interest in <strong>${storeName || "our store"}</strong>.
          Here is our product catalogue — browse our full range and order via WhatsApp.
        </p>
        <a href="${catalogueUrl}" style="display:inline-block;padding:14px 32px;background:#22c55e;color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;margin-bottom:24px;">
          📄 View / Download Catalogue
        </a>
        <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">Or copy this link:</p>
        <p style="font-size:12px;color:#64748b;background:#f4f6f9;padding:10px 14px;border-radius:6px;word-break:break-all;margin:0 0 24px;">${catalogueUrl}</p>
        <p style="font-size:13px;color:#64748b;margin:0;">Have questions? Reply to this email — we're happy to help!</p>
      </div>
      <div style="background:#f8f9fb;padding:16px 40px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">© ${new Date().getFullYear()} ${storeName || "Our Store"}.</p>
      </div>
    </div>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${storeName || "Our Store"} <onboarding@resend.dev>`,
        to: [to],
        subject: `Your ${storeName || "Store"} Catalogue 📦`,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.message || "Failed to send" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
