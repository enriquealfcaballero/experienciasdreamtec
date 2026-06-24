// ============================================================
// Widget de Mejoras — buzón de solicitudes compartido del Grupo Vértice.
// Reutilizable en cualquier app: incluir este <script> y abrir con:
//   window.VxMejoras.open({ url, anonKey, app:'catalogo', userName, userEmail, isAdmin });
// Usa la tabla `mejoras` + bucket `mejoras-fotos` del Supabase compartido.
// Crea su propio cliente supabase (reutiliza la sesión autenticada persistida del host).
// ============================================================
(function () {
  var cfg = null, sb = null, photoUrl = '', tipo = 'mejora', busy = false;

  function client() { if (!sb) sb = window.supabase.createClient(cfg.url, cfg.anonKey); return sb; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtDate(s) { return (s || '').slice(0, 10); }

  var STT = {
    enviada: { l: 'Enviada', bg: '#EEF2FF', c: '#4338CA' }, aprobada: { l: 'Aprobada', bg: '#E7F7ED', c: '#15803D' },
    en_progreso: { l: 'En progreso', bg: '#E2F7FB', c: '#0E7C8C' }, completada: { l: 'Completada', bg: '#DCFCE7', c: '#15803D' },
    rechazada: { l: 'Rechazada', bg: '#FEF2F2', c: '#DC2626' }
  };
  var TIPO = { mejora: 'Mejora', bug: 'Error/Bug', idea: 'Idea' };

  function el(id) { return document.getElementById(id); }

  function scoreInfo() {
    var t = (el('vxm-title').value || '').trim(), d = (el('vxm-desc').value || '').trim();
    var sc = (t ? 20 : 0) + Math.min(50, Math.round((d.length / 120) * 50)) + (photoUrl ? 30 : 0);
    var msg, col, bg, bd;
    if (sc >= 80) { msg = '¡Excelente nivel de detalle! Será fácil y rápida de procesar.'; col = '#15803D'; bg = '#ECFDF5'; bd = '#A7F3D0'; }
    else if (sc >= 50) { msg = 'Vas bien. Un poco más de detalle (o una foto) ayuda a procesarla más rápido.'; col = '#0E7C8C'; bg = '#E2F7FB'; bd = '#BAE6FD'; }
    else { msg = 'Mientras más detalle y una foto agregues, más fácil y rápido será procesar tu solicitud.'; col = '#B45309'; bg = '#FFF7ED'; bd = '#FED7AA'; }
    return { sc: sc, msg: msg, col: col, bg: bg, bd: bd };
  }
  function paintScore() {
    var s = scoreInfo(); var box = el('vxm-warn'), bar = el('vxm-bar'), txt = el('vxm-warntxt');
    if (!box) return; box.style.background = s.bg; box.style.borderColor = s.bd; bar.style.width = s.sc + '%'; bar.style.background = s.col; txt.style.color = s.col; txt.textContent = s.msg;
  }

  async function uploadPhoto(file) {
    if (!file) return; busy = true; el('vxm-photolbl').textContent = 'Subiendo…';
    try {
      var path = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var up = await client().storage.from('mejoras-fotos').upload(path, file, { upsert: true });
      if (up.error) throw up.error;
      photoUrl = client().storage.from('mejoras-fotos').getPublicUrl(path).data.publicUrl;
      el('vxm-photolbl').textContent = '✓ Foto adjuntada';
      el('vxm-preview').innerHTML = '<img src="' + esc(photoUrl) + '" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid #E8ECF3"/>';
    } catch (e) { el('vxm-photolbl').textContent = 'Error al subir'; }
    busy = false; paintScore();
  }

  async function submit() {
    if (busy) return;
    var t = (el('vxm-title').value || '').trim();
    if (!t) { el('vxm-msg').innerHTML = '<span style="color:#DC2626">Ponle un título a tu solicitud.</span>'; return; }
    var row = { app: cfg.app || 'app', tipo: tipo, title: t, description: (el('vxm-desc').value || '').trim(), photo_url: photoUrl || null, status: 'enviada', user_name: cfg.userName || '', user_email: cfg.userEmail || '' };
    try { var u = await client().auth.getUser(); if (u && u.data && u.data.user) { var au = u.data.user; row.user_id = au.id; if (!row.user_email) row.user_email = au.email || ''; if (!row.user_name) row.user_name = (au.user_metadata && (au.user_metadata.full_name || au.user_metadata.name)) || au.email || 'Usuario'; } } catch (e) {}
    if (!row.user_name) row.user_name = 'Usuario';
    el('vxm-msg').textContent = 'Enviando…';
    var r = await client().from('mejoras').insert(row);
    if (r.error) { el('vxm-msg').innerHTML = '<span style="color:#DC2626">Error: ' + esc(r.error.message) + '</span>'; return; }
    photoUrl = ''; tipo = 'mejora';
    el('vxm-title').value = ''; el('vxm-desc').value = ''; el('vxm-preview').innerHTML = ''; el('vxm-photolbl').textContent = 'Adjuntar foto';
    el('vxm-msg').innerHTML = '<span style="color:#15803D">¡Gracias! Tu solicitud fue enviada.</span>';
    paintTipo(); paintScore(); refresh();
  }

  async function setStatus(id, status) {
    var note = null;
    if (status === 'rechazada' && window.prompt) note = window.prompt('Motivo del rechazo (opcional):') || '';
    var patch = { status: status, updated_at: new Date().toISOString(), updated_by: cfg.userName || '' };
    if (note != null) patch.admin_note = note;
    await client().from('mejoras').update(patch).eq('id', id); refresh();
  }

  async function refresh() {
    var list = el('vxm-list'); if (!list) return; list.innerHTML = '<div style="padding:18px;text-align:center;color:#94A3B8;font-size:13px">Cargando…</div>';
    var r = await client().from('mejoras').select('*').eq('app', cfg.app).order('created_at', { ascending: false }).limit(100);
    var rows = (r.data || []);
    if (!rows.length) { list.innerHTML = '<div style="padding:24px;text-align:center;color:#94A3B8;font-size:13px">Sin solicitudes aún.</div>'; return; }
    list.innerHTML = rows.map(function (m) {
      var st = STT[m.status] || { l: m.status, bg: '#EEF1F6', c: '#64748B' };
      var admin = cfg.isAdmin ? (
        (m.status === 'enviada' ? '<button data-act="aprobada" data-id="' + m.id + '" class="vxm-act" style="padding:5px 10px;border-radius:7px;background:#16A34A;color:#fff;font-size:11px;font-weight:700">Aprobar</button>' : '') +
        (m.status === 'aprobada' ? '<button data-act="en_progreso" data-id="' + m.id + '" class="vxm-act" style="padding:5px 10px;border-radius:7px;background:#0E7C8C;color:#fff;font-size:11px;font-weight:700">En progreso</button>' : '') +
        ((m.status === 'aprobada' || m.status === 'en_progreso') ? '<button data-act="completada" data-id="' + m.id + '" class="vxm-act" style="padding:5px 10px;border-radius:7px;background:#15803D;color:#fff;font-size:11px;font-weight:700">Completada</button>' : '') +
        ((m.status === 'enviada' || m.status === 'aprobada' || m.status === 'en_progreso') ? '<button data-act="rechazada" data-id="' + m.id + '" class="vxm-act" style="padding:5px 10px;border-radius:7px;background:#FFF7F7;color:#DC2626;border:1px solid #FCA5A5;font-size:11px;font-weight:700">Rechazar</button>' : '')
      ) : '';
      return '<div style="background:#fff;border:1px solid #E8ECF3;border-radius:12px;padding:13px 15px;margin-bottom:10px">' +
        '<div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:180px"><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-size:9.5px;font-weight:700;color:#0E7C8C;background:#E2F7FB;padding:2px 8px;border-radius:999px;text-transform:uppercase">' + esc(TIPO[m.tipo] || m.tipo) + '</span><span style="font-size:9px;color:#94A3B8;text-transform:uppercase;font-weight:700">' + esc(m.app) + '</span><b style="font-size:13.5px;color:#0F172A">' + esc(m.title) + '</b></div>' +
        '<div style="font-size:11px;color:#94A3B8;margin-top:3px">' + esc(m.user_name) + ' · ' + fmtDate(m.created_at) + '</div>' +
        (m.description ? '<div style="font-size:12px;color:#475569;margin-top:7px;line-height:1.5">' + esc(m.description) + '</div>' : '') +
        (m.admin_note ? '<div style="font-size:11px;color:#991B1B;background:#FEF2F2;border:1px solid #FECACA;border-radius:7px;padding:6px 9px;margin-top:7px">Nota admin: ' + esc(m.admin_note) + '</div>' : '') + '</div>' +
        (m.photo_url ? '<a href="' + esc(m.photo_url) + '" target="_blank"><img src="' + esc(m.photo_url) + '" style="width:70px;height:70px;object-fit:cover;border-radius:9px;border:1px solid #E8ECF3"/></a>' : '') +
        '<span style="font-size:10px;font-weight:700;padding:4px 10px;border-radius:999px;background:' + st.bg + ';color:' + st.c + ';text-transform:uppercase;white-space:nowrap">' + st.l + '</span></div>' +
        (admin ? '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">' + admin + '</div>' : '') + '</div>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('.vxm-act'), function (b) { b.onclick = function () { setStatus(b.getAttribute('data-id'), b.getAttribute('data-act')); }; });
  }

  function paintTipo() {
    ['mejora', 'bug', 'idea'].forEach(function (k) { var b = el('vxm-tipo-' + k); if (!b) return; var on = tipo === k; b.style.background = on ? '#0E7C8C' : '#F1F5F9'; b.style.color = on ? '#fff' : '#475569'; });
  }

  function open(opts) {
    cfg = opts || {}; photoUrl = ''; tipo = 'mejora';
    if (root) root.remove();
    root = document.createElement('div'); root.id = 'vxm-root';
    root.innerHTML =
      '<div id="vxm-ov" style="position:fixed;inset:0;background:rgba(15,23,42,0.45);backdrop-filter:blur(4px);z-index:9998"></div>' +
      '<div style="position:fixed;top:4vh;left:50%;transform:translateX(-50%);width:640px;max-width:95vw;max-height:92vh;overflow-y:auto;background:#F8FAFC;border-radius:16px;z-index:9999;box-shadow:0 30px 80px rgba(15,23,42,.3);font-family:system-ui,sans-serif">' +
      '<div style="padding:16px 22px;border-bottom:1px solid #E8ECF3;display:flex;align-items:center;justify-content:space-between;background:#fff;position:sticky;top:0;border-radius:16px 16px 0 0">' +
      '<div><div style="font-size:16px;font-weight:700;color:#0F172A">Mejoras</div><div style="font-size:12px;color:#64748B">Propón una mejora y sigue su estado</div></div>' +
      '<button id="vxm-close" style="width:32px;height:32px;border-radius:8px;background:#F6F8FB;border:1px solid #E6EBF2;color:#64748B;font-size:16px;cursor:pointer">✕</button></div>' +
      '<div style="padding:18px 22px">' +
      '<div id="vxm-warn" style="border:1px solid #FED7AA;background:#FFF7ED;border-radius:10px;padding:10px 12px;margin-bottom:14px"><div style="font-size:12px;font-weight:600" id="vxm-warntxt">Mientras más detalle y una foto agregues, más fácil y rápido será procesar tu solicitud.</div><div style="height:6px;background:rgba(255,255,255,.6);border-radius:5px;overflow:hidden;margin-top:8px"><div id="vxm-bar" style="height:100%;width:0;background:#B45309;border-radius:5px;transition:width .2s"></div></div></div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' +
      '<button id="vxm-tipo-mejora" class="vxm-tp" style="padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;border:none">Mejora</button>' +
      '<button id="vxm-tipo-bug" class="vxm-tp" style="padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;border:none">Error/Bug</button>' +
      '<button id="vxm-tipo-idea" class="vxm-tp" style="padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;border:none">Idea</button></div>' +
      '<input id="vxm-title" placeholder="Título *" style="width:100%;padding:9px 11px;border:1px solid #D9E2EC;border-radius:8px;font-size:13px;margin-bottom:10px;box-sizing:border-box"/>' +
      '<textarea id="vxm-desc" placeholder="Descripción: ¿qué mejorar? ¿en qué pantalla? ¿qué esperas? pasos si es un error…" style="width:100%;min-height:110px;padding:10px 11px;border:1px solid #D9E2EC;border-radius:8px;font-size:13px;box-sizing:border-box;resize:vertical;font-family:inherit;margin-bottom:10px"></textarea>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">' +
      '<label style="padding:8px 13px;border-radius:9px;background:#F1F5F9;color:#0F172A;font-size:13px;font-weight:600;cursor:pointer" id="vxm-photolbl-wrap"><span id="vxm-photolbl">Adjuntar foto</span><input id="vxm-photo" type="file" accept="image/*" style="display:none"/></label>' +
      '<span id="vxm-preview"></span><span style="flex:1"></span>' +
      '<button id="vxm-send" style="padding:10px 18px;border-radius:9px;background:linear-gradient(180deg,#16C7DE,#0E9DB0);color:#fff;font-weight:700;font-size:13px;cursor:pointer;border:none">Enviar</button></div>' +
      '<div id="vxm-msg" style="font-size:12px;min-height:16px;margin-top:4px"></div>' +
      '<div style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;margin:18px 0 10px">Solicitudes</div>' +
      '<div id="vxm-list"></div></div></div>';
    document.body.appendChild(root);
    el('vxm-close').onclick = close; el('vxm-ov').onclick = close;
    el('vxm-tipo-mejora').onclick = function () { tipo = 'mejora'; paintTipo(); };
    el('vxm-tipo-bug').onclick = function () { tipo = 'bug'; paintTipo(); };
    el('vxm-tipo-idea').onclick = function () { tipo = 'idea'; paintTipo(); };
    el('vxm-title').oninput = paintScore; el('vxm-desc').oninput = paintScore;
    el('vxm-photo').onchange = function (e) { uploadPhoto(e.target.files && e.target.files[0]); };
    el('vxm-send').onclick = submit;
    paintTipo(); paintScore(); refresh();
  }
  function close() { if (root) { root.remove(); root = null; } }

  window.VxMejoras = { open: open, close: close };
})();
