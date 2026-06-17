/* ============================================================
   Generador de plantillas de correo (Auth de Supabase)
   - Escribe los .html de marca Dreamtec en esta carpeta.
   - Si hay SUPABASE_TOKEN en el entorno, los aplica al proyecto
     vía Management API (asuntos + contenido).
   Uso:  node supabase/email-templates/build.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const REF = 'qzsdurpcrnkiyhjzhpks';
const LOGO = 'https://experienciasdreamtec.netlify.app/assets/dreamtec-logo.png';
const ACCENT = '#2563eb';
const DARK = '#11151c';

// Shell de marca. `url` es la variable de Supabase, p.ej. '{{ .ConfirmationURL }}'.
function shell({ title, intro, btn, url, note }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#eceef1;padding:28px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.08);border:1px solid #e6e8ec">
    <tr><td style="padding:22px 28px 18px;border-bottom:1px solid #eef0f3">
      <img src="${LOGO}" alt="Dreamtec" height="26" style="height:26px;display:block;border:0">
    </td></tr>
    <tr><td style="height:4px;background:${ACCENT};font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:30px 28px 8px">
      <h1 style="margin:0 0 10px;font-size:23px;line-height:1.25;color:${DARK}">${title}</h1>
      <p style="margin:0 0 24px;font-size:14.5px;color:#5b6472;line-height:1.6">${intro}</p>
      <a href="${url}" style="display:inline-block;background:${DARK};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:10px">${btn} &rarr;</a>
      <p style="margin:24px 0 0;font-size:12.5px;color:#9aa3b2;line-height:1.6">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><span style="color:${ACCENT};word-break:break-all">${url}</span></p>
      ${note ? `<p style="margin:18px 0 0;font-size:12.5px;color:#9aa3b2;line-height:1.6">${note}</p>` : ''}
    </td></tr>
    <tr><td style="padding:22px 28px 26px;border-top:1px solid #eef0f3;background:#fafbfc">
      <p style="margin:0;font-size:12px;color:#9aa3b2;line-height:1.6"><strong style="color:#6b7280">Dreamtec · Eventos de Experiencia</strong><br>Acceso interno. Si no esperabas este correo, puedes ignorarlo.</p>
    </td></tr>
  </table>
</body></html>`;
}

const T = {
  confirmation: {
    subject: 'Confirma tu cuenta · Dreamtec Eventos',
    html: shell({
      title: 'Confirma tu cuenta',
      intro: 'Estás a un paso de entrar al tablero de <strong>Eventos de Experiencia</strong> de Dreamtec. Confirma tu correo para activar tu cuenta y empezar a marcar las tareas de tu área.',
      btn: 'Confirmar mi cuenta', url: '{{ .ConfirmationURL }}',
      note: 'Si tú no creaste esta cuenta, ignora este correo.',
    }),
  },
  recovery: {
    subject: 'Restablece tu contraseña · Dreamtec Eventos',
    html: shell({
      title: 'Restablece tu contraseña',
      intro: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva.',
      btn: 'Restablecer contraseña', url: '{{ .ConfirmationURL }}',
      note: 'El enlace caduca en 1 hora. Si no pediste esto, ignora el correo: tu contraseña no cambiará.',
    }),
  },
  magic_link: {
    subject: 'Tu enlace de acceso · Dreamtec Eventos',
    html: shell({
      title: 'Tu enlace de acceso',
      intro: 'Usa este enlace para ingresar al tablero de Eventos de Experiencia sin escribir tu contraseña.',
      btn: 'Ingresar', url: '{{ .ConfirmationURL }}',
      note: 'El enlace caduca pronto y es de un solo uso.',
    }),
  },
  email_change: {
    subject: 'Confirma tu nuevo correo · Dreamtec Eventos',
    html: shell({
      title: 'Confirma tu nuevo correo',
      intro: 'Para terminar de cambiar tu correo a <strong>{{ .NewEmail }}</strong>, confírmalo con el botón.',
      btn: 'Confirmar correo', url: '{{ .ConfirmationURL }}',
      note: 'Si no solicitaste este cambio, ignora este correo.',
    }),
  },
};

// 1) Escribir los .html
for (const k of Object.keys(T)) {
  fs.writeFileSync(path.join(__dirname, k + '.html'), T[k].html);
}
console.log('Plantillas escritas:', Object.keys(T).join(', '));

// 2) Aplicar a Supabase (si hay token)
const token = process.env.SUPABASE_TOKEN;
if (!token) { console.log('Sin SUPABASE_TOKEN: solo se generaron los archivos.'); return; }
const body = {
  mailer_subjects_confirmation: T.confirmation.subject,
  mailer_templates_confirmation_content: T.confirmation.html,
  mailer_subjects_recovery: T.recovery.subject,
  mailer_templates_recovery_content: T.recovery.html,
  mailer_subjects_magic_link: T.magic_link.subject,
  mailer_templates_magic_link_content: T.magic_link.html,
  mailer_subjects_email_change: T.email_change.subject,
  mailer_templates_email_change_content: T.email_change.html,
};
fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(async (r) => {
  console.log('PATCH config/auth:', r.status, r.ok ? 'OK' : await r.text());
}).catch((e) => console.log('error:', e.message));
