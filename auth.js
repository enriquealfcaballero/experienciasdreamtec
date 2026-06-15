/* ============================================================
   auth.js — Login/registro compartido (Dreamtec Eventos)
   - Crea el cliente Supabase (window.DT.client) y lo comparte.
   - Bloquea la página con un modal de login/registro hasta que
     haya sesión válida.
   - Registro restringido a @dreamtec.cl / @ofimundo.cl (validado
     además en el servidor por trigger).
   - El área se elige en el registro y queda en el perfil.
   Requiere cargar antes: supabase-config.js y @supabase/supabase-js.
   ============================================================ */
(function () {
  "use strict";

  var AREAS = [
    { key: "comercial",    label: "Ventas" },
    { key: "facturacion",  label: "Facturación y Cobranza" },
    { key: "finanzas",     label: "Finanzas" },
    { key: "contabilidad", label: "Contabilidad" },
    { key: "logistica",    label: "Logística" },
    { key: "bodega",       label: "Bodega" },
    { key: "mesa",         label: "Mesa de Ayuda" },
    { key: "compras",      label: "Compras" },
    { key: "marketing",    label: "Marketing" }
  ];
  var ALLOWED_DOMAINS = ["dreamtec.cl", "ofimundo.cl"];
  function areaLabel(key) {
    for (var i = 0; i < AREAS.length; i++) if (AREAS[i].key === key) return AREAS[i].label;
    return key;
  }

  var CFG = window.SUPABASE_CONFIG || {};
  var CONFIGURED = CFG.url && CFG.anonKey && !/TU-PROYECTO|TU-ANON-KEY/.test(CFG.url + CFG.anonKey);

  var DT = window.DT = {
    client: null,
    user: null,
    profile: null,
    AREAS: AREAS,
    areaLabel: areaLabel,
    isAdmin: function () { return !!(DT.profile && DT.profile.role === "admin"); },
    area: function () { return DT.profile ? DT.profile.area : null; },
    _ready: false,
    _cbs: [],
    onReady: function (cb) { if (DT._ready) cb(DT.profile); else DT._cbs.push(cb); },
    signOut: function () { if (DT.client) DT.client.auth.signOut().then(function () { location.reload(); }); }
  };

  // ---------- estilos ----------
  var css = ""
    + "#dtauth-ov{position:fixed;inset:0;z-index:2147483000;background:oklch(0.97 0.005 80);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'IBM Plex Sans',-apple-system,system-ui,sans-serif;color:oklch(0.22 0.02 260);overflow:auto}"
    + "#dtauth-card{width:100%;max-width:400px;background:#fff;border:1px solid oklch(0.90 0.01 260);border-radius:14px;padding:28px;box-shadow:0 10px 40px oklch(0 0 0 / 0.08)}"
    + "#dtauth-card img{height:26px;margin-bottom:18px;opacity:.9}"
    + "#dtauth-card h2{font-size:19px;margin:0 0 4px;font-weight:600}"
    + "#dtauth-card .dtauth-sub{font-size:12.5px;color:oklch(0.42 0.02 260);margin:0 0 18px}"
    + ".dtauth-tabs{display:flex;gap:4px;background:oklch(0.96 0.005 80);border:1px solid oklch(0.90 0.01 260);border-radius:10px;padding:4px;margin-bottom:18px}"
    + ".dtauth-tab{flex:1;padding:8px;border:0;background:transparent;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600;color:oklch(0.42 0.02 260)}"
    + ".dtauth-tab.on{background:#fff;color:oklch(0.22 0.02 260);box-shadow:0 1px 2px oklch(0 0 0 /.08)}"
    + ".dtauth-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}"
    + ".dtauth-field label{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:oklch(0.62 0.02 260)}"
    + ".dtauth-field input,.dtauth-field select{padding:9px 11px;border:1px solid oklch(0.90 0.01 260);border-radius:6px;font-size:13.5px;background:#fff;font-family:inherit}"
    + ".dtauth-field input:focus,.dtauth-field select:focus{outline:none;border-color:oklch(0.55 0.13 264)}"
    + "#dtauth-submit{width:100%;padding:11px;border:0;border-radius:8px;background:oklch(0.22 0.02 260);color:#fff;font-weight:600;font-size:14px;cursor:pointer;margin-top:4px}"
    + "#dtauth-submit:hover{background:oklch(0.30 0.02 260)}"
    + "#dtauth-submit:disabled{opacity:.6;cursor:default}"
    + ".dtauth-msg{font-size:12.5px;margin-top:12px;min-height:16px}"
    + ".dtauth-msg.err{color:oklch(0.50 0.18 25)}"
    + ".dtauth-msg.ok{color:oklch(0.45 0.13 150)}"
    + ".dtauth-hint{font-size:11px;color:oklch(0.62 0.02 260);margin-top:14px;line-height:1.5}"
    + "#dtauth-chip{position:fixed;top:12px;right:12px;z-index:2147482000;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid oklch(0.90 0.01 260);border-radius:100px;padding:5px 6px 5px 14px;font-family:'IBM Plex Sans',sans-serif;font-size:12px;box-shadow:0 2px 8px oklch(0 0 0 /.06)}"
    + "#dtauth-chip b{font-weight:600}#dtauth-chip .dtauth-chip-area{color:oklch(0.42 0.02 260)}"
    + "#dtauth-chip .dtauth-adm{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;background:oklch(0.55 0.13 264);color:#fff;padding:2px 6px;border-radius:100px}"
    + "#dtauth-chip button{border:1px solid oklch(0.90 0.01 260);background:oklch(0.97 0.005 80);border-radius:100px;padding:5px 12px;cursor:pointer;font-size:12px;font-family:inherit}"
    + "#dtauth-chip button:hover{background:oklch(0.93 0.01 260)}";
  function injectCss() { var s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }

  // ---------- modal ----------
  var overlay, mode = "login";
  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.id = "dtauth-ov";
    overlay.innerHTML = ''
      + '<div id="dtauth-card">'
      + '  <img src="assets/dreamtec-logo.png" alt="Dreamtec" onerror="this.style.display=\'none\'"/>'
      + '  <h2>Eventos de Experiencia</h2>'
      + '  <p class="dtauth-sub">Acceso interno · solo correos @dreamtec.cl / @ofimundo.cl</p>'
      + '  <div class="dtauth-tabs">'
      + '    <button class="dtauth-tab on" data-mode="login">Ingresar</button>'
      + '    <button class="dtauth-tab" data-mode="register">Registrarse</button>'
      + '  </div>'
      + '  <form id="dtauth-form">'
      + '    <div class="dtauth-field reg-only" style="display:none"><label>Nombre completo</label><input name="full_name" type="text" autocomplete="name" placeholder="Tu nombre"/></div>'
      + '    <div class="dtauth-field"><label>Correo</label><input name="email" type="email" autocomplete="email" placeholder="nombre@dreamtec.cl" required/></div>'
      + '    <div class="dtauth-field reg-only" style="display:none"><label>Área</label><select name="area">' + AREAS.map(function (a) { return '<option value="' + a.key + '">' + a.label + '</option>'; }).join("") + '</select></div>'
      + '    <div class="dtauth-field"><label>Contraseña</label><input name="password" type="password" autocomplete="current-password" placeholder="••••••••" minlength="6" required/></div>'
      + '    <button id="dtauth-submit" type="submit">Ingresar</button>'
      + '    <div class="dtauth-msg" id="dtauth-msg"></div>'
      + '  </form>'
      + '  <p class="dtauth-hint">Al registrarte eliges tu área una sola vez; luego el tablero ya sabe qué tareas puedes aprobar.</p>'
      + '</div>';
    document.body.appendChild(overlay);

    var tabs = overlay.querySelectorAll(".dtauth-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener("click", function () { setMode(this.getAttribute("data-mode")); });
    overlay.querySelector("#dtauth-form").addEventListener("submit", onSubmit);
  }
  function setMode(m) {
    mode = m;
    var tabs = overlay.querySelectorAll(".dtauth-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("on", tabs[i].getAttribute("data-mode") === m);
    var regs = overlay.querySelectorAll(".reg-only");
    for (var j = 0; j < regs.length; j++) regs[j].style.display = (m === "register") ? "flex" : "none";
    overlay.querySelector("#dtauth-submit").textContent = (m === "register") ? "Crear cuenta" : "Ingresar";
    overlay.querySelector('input[name="password"]').setAttribute("autocomplete", m === "register" ? "new-password" : "current-password");
    setMsg("", "");
  }
  function setMsg(t, cls) { var el = overlay.querySelector("#dtauth-msg"); el.textContent = t; el.className = "dtauth-msg " + (cls || ""); }
  function domainOk(email) {
    var d = (email.split("@")[1] || "").toLowerCase();
    return ALLOWED_DOMAINS.indexOf(d) !== -1;
  }

  function onSubmit(e) {
    e.preventDefault();
    var f = e.target;
    var email = f.email.value.trim().toLowerCase();
    var password = f.password.value;
    var btn = overlay.querySelector("#dtauth-submit");
    if (!domainOk(email)) { setMsg("Solo se permiten correos @dreamtec.cl o @ofimundo.cl.", "err"); return; }
    btn.disabled = true;
    setMsg(mode === "register" ? "Creando cuenta…" : "Ingresando…", "");

    var p;
    if (mode === "register") {
      p = DT.client.auth.signUp({
        email: email, password: password,
        options: {
          data: { area: f.area.value, full_name: f.full_name.value.trim() },
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });
    } else {
      p = DT.client.auth.signInWithPassword({ email: email, password: password });
    }
    p.then(function (res) {
      btn.disabled = false;
      if (res.error) { setMsg(translateErr(res.error.message), "err"); return; }
      if (!res.data.session) {
        // Confirmación por correo activada: no hay sesión hasta confirmar
        setMode("login");
        setMsg("Te enviamos un correo de confirmación a " + email + ". Ábrelo, confirma tu cuenta y luego ingresa aquí.", "ok");
        return;
      }
      // onAuthStateChange se encarga de cargar perfil y cerrar el modal
    }).catch(function (err) {
      btn.disabled = false; setMsg(translateErr(err && err.message), "err");
    });
  }
  function translateErr(m) {
    m = (m || "").toLowerCase();
    if (m.indexOf("dreamtec.cl") !== -1 || m.indexOf("ofimundo.cl") !== -1) return "Solo se permiten correos @dreamtec.cl o @ofimundo.cl.";
    if (m.indexOf("already registered") !== -1 || m.indexOf("already been registered") !== -1) return "Ese correo ya está registrado. Usa 'Ingresar'.";
    if (m.indexOf("invalid login") !== -1 || m.indexOf("invalid credentials") !== -1) return "Correo o contraseña incorrectos.";
    if (m.indexOf("password should be") !== -1) return "La contraseña debe tener al menos 6 caracteres.";
    if (m.indexOf("email not confirmed") !== -1) return "Debes confirmar tu correo antes de ingresar.";
    return "No se pudo completar: " + m;
  }

  // ---------- chip de sesión ----------
  function showChip() {
    if (window.DT_HIDE_CHIP) return;
    var old = document.getElementById("dtauth-chip"); if (old) old.remove();
    var chip = document.createElement("div");
    chip.id = "dtauth-chip";
    chip.innerHTML = '<span><b>' + (DT.profile.full_name || DT.profile.email) + '</b> '
      + (DT.isAdmin() ? '<span class="dtauth-adm">Admin</span>' : '<span class="dtauth-chip-area">· ' + areaLabel(DT.profile.area) + '</span>')
      + '</span><button type="button">Salir</button>';
    chip.querySelector("button").addEventListener("click", DT.signOut);
    document.body.appendChild(chip);
  }

  // ---------- ciclo de sesión ----------
  function fireReady() {
    DT._ready = true;
    var cbs = DT._cbs.slice(); DT._cbs = [];
    cbs.forEach(function (cb) { try { cb(DT.profile); } catch (e) { console.error(e); } });
  }
  function loadProfile(user, attempt) {
    attempt = attempt || 0;
    return DT.client.from("profiles").select("*").eq("id", user.id).single().then(function (res) {
      if (res.error || !res.data) {
        if (attempt < 3) return new Promise(function (r) { setTimeout(r, 400); }).then(function () { return loadProfile(user, attempt + 1); });
        throw (res.error || new Error("perfil no encontrado"));
      }
      return res.data;
    });
  }
  function onSignedIn(session) {
    DT.user = session.user;
    loadProfile(session.user).then(function (profile) {
      DT.profile = profile;
      if (overlay) { overlay.remove(); overlay = null; }
      showChip();
      fireReady();
    }).catch(function (err) {
      // Perfil ausente: forzar salida con mensaje
      if (!overlay) buildOverlay();
      setMode("login");
      setMsg("Tu cuenta no tiene perfil asociado. Contacta al administrador.", "err");
      DT.client.auth.signOut();
    });
  }

  function start() {
    if (!CONFIGURED) {
      document.body.innerHTML = '<div style="max-width:560px;margin:80px auto;font-family:sans-serif;color:#333"><h2>Falta configurar Supabase</h2><p>Edita <code>supabase-config.js</code> con la URL y anon key del proyecto.</p></div>';
      return;
    }
    injectCss();
    DT.client = window.supabase.createClient(CFG.url, CFG.anonKey);
    DT.client.auth.onAuthStateChange(function (event, session) {
      if (session && session.user) {
        if (!DT.profile) onSignedIn(session);
      } else {
        DT.profile = null; DT.user = null;
        var c = document.getElementById("dtauth-chip"); if (c) c.remove();
        if (!overlay) { buildOverlay(); }
      }
    });
    DT.client.auth.getSession().then(function (res) {
      if (res.data && res.data.session) { onSignedIn(res.data.session); }
      else { buildOverlay(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
