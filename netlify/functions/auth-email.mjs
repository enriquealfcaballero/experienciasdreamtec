// Correos de autenticación de Experiencias Dreamtec (confirmación de cuenta y recuperación de contraseña)
// enviados por RESEND con marca DREAMTEC — NO por el email por defecto de Supabase (limitado + marca genérica).
// Genera el token con la Admin API de Supabase (generate_link) y arma el enlace que cae en LA APP
// (expdt.verticecorp.cl), donde el token se verifica con verifyOtp — nunca redirige al portal password-protected.
const SB = process.env.EXPDT_SUPABASE_URL || 'https://qzsdurpcrnkiyhjzhpks.supabase.co';
const KEY = process.env.EXPDT_SERVICE_KEY;               // service_role del proyecto Experiencias (secreto)
const RESEND = process.env.RESEND_API_KEY;
const FROM = 'Dreamtec <no-reply@verticecorp.cl>';       // remitente Dreamtec (dominio verificado en Resend)
const APP = 'https://expdt.verticecorp.cl';              // la aplicación (NO el portal principal)
const LOGO = APP + '/assets/dreamtec-logo.png';
const ALLOWED = ['dreamtec.cl', 'ofimundo.cl'];
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });

async function generateLink(type, email, password, data) {
  const body = { type, email, redirect_to: APP };
  if (type === 'signup') { body.password = password || Math.random().toString(36).slice(2) + 'A9!'; body.data = data || {}; }
  const r = await fetch(SB + '/auth/v1/admin/generate_link', {
    method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: j.msg || j.error_description || j.error || j.message || ('HTTP ' + r.status) };
  const props = j.properties || {};
  return { tokenHash: j.hashed_token || props.hashed_token || '', actionLink: j.action_link || props.action_link || '' };
}

// Enlace que cae en la APP con el token (la app lo verifica con verifyOtp). Recovery lleva ?dt=recovery para el flujo.
function appLink(tokenHash, vt, fallback) {
  if (!tokenHash) return fallback || APP;
  const q = 'th=' + encodeURIComponent(tokenHash) + '&vt=' + encodeURIComponent(vt) + (vt === 'recovery' ? '&dt=recovery' : '');
  return APP + '/?' + q;
}

function authHtml(title, intro, href, label, note) {
  return '<div style="background:#EEF2F7;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">'
    + '<div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E6EBF2;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(15,23,42,0.07);">'
    + '<div style="padding:22px 30px;border-bottom:1px solid #EEF1F6;text-align:left;"><img src="' + LOGO + '" alt="Dreamtec" style="height:30px;width:auto;display:block;"></div>'
    + '<div style="padding:28px 30px;color:#0F172A;">'
    + '<h1 style="font-size:20px;font-weight:700;margin:0 0 12px;color:#0B2440;letter-spacing:-0.01em;">' + title + '</h1>'
    + '<p style="font-size:14.5px;color:#475569;line-height:1.6;margin:0 0 6px;">' + intro + '</p>'
    + '<p style="margin:26px 0 10px;text-align:center;"><a href="' + href + '" target="_blank" style="background:#0E9DB0;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 34px;border-radius:10px;display:inline-block;">' + label + '</a></p>'
    + '<p style="font-size:11.5px;color:#94A3B8;text-align:center;margin:10px 0 0;line-height:1.55;">Si el botón no funciona, copia y pega este enlace:<br><span style="color:#64748B;word-break:break-all;">' + href + '</span></p>'
    + '<p style="font-size:11.5px;color:#94A3B8;line-height:1.55;margin:20px 0 0;border-top:1px solid #EEF1F6;padding-top:14px;">' + note + '</p>'
    + '</div>'
    + '<div style="padding:14px 30px;background:#FBFCFE;border-top:1px solid #EEF1F6;font-size:11px;color:#94A3B8;">Experiencias Dreamtec</div>'
    + '</div></div>';
}

const TPL = {
  signup:   { subject: 'Confirma tu cuenta · Experiencias Dreamtec', title: 'Confirma tu cuenta', intro: 'Creaste una cuenta en Experiencias Dreamtec. Confirma tu correo para activarla.', label: 'Confirmar mi cuenta', note: 'Si no creaste esta cuenta, ignora este correo.' },
  recovery: { subject: 'Restablece tu contraseña · Experiencias Dreamtec', title: 'Restablece tu contraseña', intro: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta de Experiencias Dreamtec. El enlace vence en 1 hora.', label: 'Crear nueva contraseña', note: 'Si no pediste esto, ignora este correo: tu contraseña actual sigue vigente.' },
  magiclink:{ subject: 'Tu acceso · Experiencias Dreamtec', title: 'Entra a Experiencias Dreamtec', intro: 'Usa este enlace para entrar a tu cuenta.', label: 'Entrar a la app', note: 'Si no solicitaste este acceso, ignora este correo.' },
};

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'método no permitido' }, 405);
  if (!KEY || !RESEND) return json({ ok: false, error: 'faltan env (EXPDT_SERVICE_KEY / RESEND_API_KEY)' }, 500);
  let b = {}; try { b = await req.json(); } catch (e) {}
  const email = String(b.email || '').trim().toLowerCase();
  const modeIn = String(b.mode || '').trim();
  const type = modeIn === 'resend' ? 'magiclink' : modeIn;
  if (!email || !/.+@.+\..+/.test(email)) return json({ ok: false, error: 'correo inválido' }, 400);
  if (!TPL[type]) return json({ ok: false, error: 'modo inválido' }, 400);
  const dom = (email.split('@')[1] || '');
  if (ALLOWED.indexOf(dom) === -1) return json({ ok: false, error: 'Solo se permiten correos @dreamtec.cl o @ofimundo.cl.' }, 400);

  const gen = await generateLink(type, email, b.password, b.data);
  if (gen.error) {
    if (type !== 'signup') return json({ ok: true, sent: false });   // recuperación: no revelar si el correo existe
    const msg = /already/i.test(gen.error) ? 'Ese correo ya tiene una cuenta. Ingresa o recupera tu contraseña.' : gen.error;
    return json({ ok: false, error: msg }, 400);
  }
  if (!gen.tokenHash && !gen.actionLink) return json({ ok: false, error: 'no se pudo generar el enlace' }, 500);

  const t = TPL[type]; const href = appLink(gen.tokenHash, type, gen.actionLink);
  const html = authHtml(t.title, t.intro, href, t.label, t.note);
  try {
    const er = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + RESEND, 'content-type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [email], subject: t.subject, html }) });
    const ej = await er.json().catch(() => ({}));
    if (!er.ok) return json({ ok: false, error: (ej && (ej.message || ej.name)) || 'Resend error' }, 502);
    return json({ ok: true, sent: true, id: ej.id || null });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
};
