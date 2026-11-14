// MalerTreff: Texte der E-Mails (testbar)
export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const wrap = (inner: string) =>
  `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c2430">${inner}<p style="color:#888;font-size:12px;margin-top:28px">MalerTreff – die Community für Maler, Lackierer und verwandte Gewerke · betrieben von MalerSaaS</p></div>`;
const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${esc(label)}</a>`;

export function decisionMail(o: { name: string; approved: boolean; reason?: string | null; link: string }) {
  if (o.approved) {
    return {
      subject: "Ihr MalerTreff-Konto ist freigeschaltet",
      html: wrap(
        `<p>Hallo ${esc(o.name)},</p><p>wir haben Ihren Nachweis geprüft – Ihr Konto ist jetzt freigeschaltet. Willkommen im MalerTreff!</p><p>${button(o.link, "Zum MalerTreff")}</p>`,
      ),
    };
  }
  return {
    subject: "Ihr Nachweis für den MalerTreff",
    html: wrap(
      `<p>Hallo ${esc(o.name)},</p><p>leider konnten wir Ihren Nachweis noch nicht annehmen.</p><p><strong>Grund:</strong> ${esc(o.reason ?? "")}</p><p>Sie können jederzeit einen neuen Nachweis hochladen:</p><p>${button(o.link, "Nachweis hochladen")}</p>`,
    ),
  };
}
