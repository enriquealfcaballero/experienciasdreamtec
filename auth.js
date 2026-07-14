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
    + ".dtauth-link{background:none;border:0;color:oklch(0.55 0.13 264);font-size:12px;cursor:pointer;text-decoration:underline;font-family:inherit;padding:2px 4px}"
    + ".dtauth-link:hover{color:oklch(0.45 0.15 264)}"
    + "#dtauth-chip{position:fixed;top:12px;right:12px;z-index:2147482000;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid oklch(0.90 0.01 260);border-radius:100px;padding:5px 6px 5px 14px;font-family:'IBM Plex Sans',sans-serif;font-size:12px;box-shadow:0 2px 8px oklch(0 0 0 /.06)}"
    + "#dtauth-chip b{font-weight:600}#dtauth-chip .dtauth-chip-area{color:oklch(0.42 0.02 260)}"
    + "#dtauth-chip .dtauth-adm{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;background:oklch(0.55 0.13 264);color:#fff;padding:2px 6px;border-radius:100px}"
    + "#dtauth-chip button{border:1px solid oklch(0.90 0.01 260);background:oklch(0.97 0.005 80);border-radius:100px;padding:5px 12px;cursor:pointer;font-size:12px;font-family:inherit}"
    + "#dtauth-chip button:hover{background:oklch(0.93 0.01 260)}";
  function injectCss() { var s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }

  // ---------- modal ----------
  var overlay, mode = "login";
  function buildOverlay() {
    var existing = document.getElementById("dtauth-ov");
    if (existing) { overlay = existing; return; } // evita overlays duplicados
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
      + '    <div class="dtauth-field email-field"><label>Correo</label><input name="email" type="email" autocomplete="email" placeholder="nombre@dreamtec.cl" required/></div>'
      + '    <div class="dtauth-field reg-only" style="display:none"><label>Área</label><select name="area">' + AREAS.map(function (a) { return '<option value="' + a.key + '">' + a.label + '</option>'; }).join("") + '</select></div>'
      + '    <div class="dtauth-field pass-field"><label id="dtauth-pass-label">Contraseña</label><input name="password" type="password" autocomplete="current-password" placeholder="••••••••" minlength="6" required/></div>'
      + '    <button id="dtauth-submit" type="submit">Ingresar</button>'
      + '    <div class="dtauth-msg" id="dtauth-msg"></div>'
      + '    <div id="dtauth-actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"></div>'
      + '    <div id="dtauth-links" style="margin-top:12px;text-align:center">'
      + '      <button type="button" id="dtauth-forgot" class="dtauth-link">¿Olvidaste tu contraseña?</button>'
      + '      <button type="button" id="dtauth-back" class="dtauth-link" style="display:none">← Volver a ingresar</button>'
      + '    </div>'
      + '  </form>'
      + '  <p class="dtauth-hint">Al registrarte eliges tu área una sola vez; luego el tablero ya sabe qué tareas puedes aprobar.</p>'
      + '</div>';
    document.body.appendChild(overlay);

    var tabs = overlay.querySelectorAll(".dtauth-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener("click", function () { setMode(this.getAttribute("data-mode")); });
    overlay.querySelector("#dtauth-form").addEventListener("submit", onSubmit);
    overlay.querySelector("#dtauth-forgot").addEventListener("click", function () { setMode("recover"); });
    overlay.querySelector("#dtauth-back").addEventListener("click", function () { setMode("login"); });
  }
  function setMode(m) {
    mode = m;
    var isReg = m === "register", isRecover = m === "recover", isNew = m === "newpass", isArea = m === "area";
    var tabsEl = overlay.querySelector(".dtauth-tabs"); if (tabsEl) tabsEl.style.display = (isRecover || isNew || isArea) ? "none" : "flex";
    var tabs = overlay.querySelectorAll(".dtauth-tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("on", tabs[i].getAttribute("data-mode") === m);
    var regs = overlay.querySelectorAll(".reg-only");
    for (var j = 0; j < regs.length; j++) {
      var hasArea = !!regs[j].querySelector('select[name="area"]');
      regs[j].style.display = (isReg || (isArea && hasArea)) ? "flex" : "none";
    }
    // email visible salvo al fijar nueva contraseña o elegir área; password idem
    var emailField = overlay.querySelector(".email-field"); emailField.style.display = (isNew || isArea) ? "none" : "flex";
    var passField = overlay.querySelector(".pass-field"); passField.style.display = (isRecover || isArea) ? "none" : "flex";
    var emailInput = overlay.querySelector('input[name="email"]'); emailInput.required = !(isNew || isArea);
    var passInput = overlay.querySelector('input[name="password"]'); passInput.required = !(isRecover || isArea);
    passInput.setAttribute("autocomplete", (isReg || isNew) ? "new-password" : "current-password");
    overlay.querySelector("#dtauth-pass-label").textContent = isNew ? "Nueva contraseña" : "Contraseña";
    var labels = { login: "Ingresar", register: "Crear cuenta", recover: "Enviar enlace de recuperación", newpass: "Guardar nueva contraseña", area: "Guardar mi área" };
    overlay.querySelector("#dtauth-submit").textContent = labels[m] || "Ingresar";
    overlay.querySelector("#dtauth-forgot").style.display = (m === "login") ? "inline-block" : "none";
    overlay.querySelector("#dtauth-back").style.display = isRecover ? "inline-block" : "none";
    setMsg("", "");
  }
  function setMsg(t, cls) { clearActions(); var el = overlay.querySelector("#dtauth-msg"); el.textContent = t; el.className = "dtauth-msg " + (cls || ""); }
  function clearActions() { var a = overlay && overlay.querySelector("#dtauth-actions"); if (a) a.innerHTML = ""; }
  function addAction(label, fn) {
    var a = overlay && overlay.querySelector("#dtauth-actions"); if (!a) return;
    var b = document.createElement("button"); b.type = "button"; b.className = "dtauth-tab";
    b.style.cssText = "border:1px solid #d8d8e0;background:#fff;padding:7px 12px;border-radius:7px;cursor:pointer;font-size:12.5px;color:#2a2a2a;flex:none";
    b.textContent = label; b.addEventListener("click", fn); a.appendChild(b);
  }
  // Llama a la Edge Function de Supabase (auth-email) que genera el enlace y manda el correo branded
  // DREAMTEC por Resend (con link a la app). Se autentica con la anon key.
  function authEmail(mode, email, extra) {
    var body = { mode: mode, email: email };
    if (extra) { for (var k in extra) body[k] = extra[k]; }
    return fetch(CFG.url + "/functions/v1/auth-email", {
      method: "POST",
      headers: { "content-type": "application/json", "apikey": CFG.anonKey, "Authorization": "Bearer " + CFG.anonKey },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "respuesta inválida del servidor" }; }); })
      .catch(function () { return { ok: false, error: "No se pudo enviar el correo. Inténtalo de nuevo." }; });
  }
  function resendConfirmation(email) {
    if (!email) return;
    setMsg("Reenviando enlace de acceso…", "");
    authEmail("resend", email).then(function (r) {
      if (!r.ok) { setMsg(translateErr(r.error), "err"); }
      else { setMsg("Listo: reenviamos un enlace de acceso a " + email + " (desde Dreamtec). Revisa tu bandeja y la carpeta de spam.", "ok"); }
    });
  }
  function getUrlError() {
    var out = {};
    function parse(s) { if (!s) return; s.replace(/^[#?]/, "").split("&").forEach(function (kv) { var p = kv.split("="); if (p[0]) out[p[0]] = decodeURIComponent((p[1] || "").replace(/\+/g, " ")); }); }
    parse(window.location.hash); parse(window.location.search);
    return out;
  }
  function cleanUrl() { if (window.history && window.history.replaceState && (window.location.hash || window.location.search)) { try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {} } }
  function translateUrlErr(e) {
    var d = (e.error_description || e.error || "").toLowerCase();
    var c = (e.error_code || "").toLowerCase();
    if (c.indexOf("otp_expired") !== -1 || d.indexOf("expired") !== -1) return "El enlace de confirmación expiró o ya se usó. Ingresa con tu correo y contraseña; si no puedes, pide un nuevo correo de confirmación.";
    if (c.indexOf("access_denied") !== -1 || d.indexOf("access") !== -1) return "El enlace no es válido. Intenta confirmar de nuevo o regístrate otra vez.";
    return "Hubo un problema al confirmar la cuenta: " + (e.error_description || e.error);
  }
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

    // Cuenta del hub sin perfil de tablero: guardar el área elegida y entrar
    if (mode === "area") {
      if (!DT.user) { setMode("login"); return; }
      btn.disabled = true; setMsg("Guardando tu área…", "");
      DT.client.from("exp_profiles").insert({
        id: DT.user.id, email: DT.user.email,
        full_name: (DT.user.user_metadata || {}).full_name || "",
        area: f.area.value, role: "member"
      }).then(function (res) {
        btn.disabled = false;
        if (res.error && res.error.code !== "23505") { setMsg("No se pudo guardar: " + res.error.message, "err"); return; }
        location.reload();
      });
      return;
    }

    // Fijar nueva contraseña (volviste desde el enlace de recuperación)
    if (mode === "newpass") {
      if (!password || password.length < 6) { setMsg("La contraseña debe tener al menos 6 caracteres.", "err"); return; }
      btn.disabled = true; setMsg("Guardando tu nueva contraseña…", "");
      DT.client.auth.updateUser({ password: password }).then(function (r) {
        btn.disabled = false;
        if (r.error) { setMsg(translateErr(r.error.message), "err"); return; }
        DT._recovery = false;
        setMsg("Listo: tu contraseña fue actualizada. Ya puedes ingresar.", "ok");
        DT.client.auth.signOut().then(function () { cleanUrl(); setMode("login"); });
      });
      return;
    }

    if (!domainOk(email)) { setMsg("Solo se permiten correos @dreamtec.cl o @ofimundo.cl.", "err"); return; }

    // Pedir enlace de recuperación (correo DREAMTEC, link a la app).
    if (mode === "recover") {
      btn.disabled = true; setMsg("Enviando enlace de recuperación…", "");
      authEmail("recovery", email).then(function (r) {
        btn.disabled = false;
        if (!r.ok) { setMsg(translateErr(r.error), "err"); return; }
        setMsg("Si existe una cuenta con " + email + ", te enviamos un enlace para restablecer la contraseña (desde Dreamtec). Revisa tu bandeja y el spam.", "ok");
      });
      return;
    }

    btn.disabled = true;
    setMsg(mode === "register" ? "Creando cuenta…" : "Ingresando…", "");

    // Registro: crea la cuenta y manda la confirmación DREAMTEC (link a la app), no el correo por defecto de Supabase.
    if (mode === "register") {
      authEmail("signup", email, { password: password, data: { area: f.area.value, full_name: f.full_name.value.trim() } }).then(function (r) {
        btn.disabled = false;
        if (!r.ok) { setMsg(translateErr(r.error), "err"); return; }
        setMode("login");
        setMsg("Te enviamos un correo de confirmación a " + email + " (desde Dreamtec). Ábrelo, confirma tu cuenta y luego ingresa aquí.", "ok");
      });
      return;
    }

    DT.client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      btn.disabled = false;
      if (res.error) {
        var em = (res.error.message || "").toLowerCase();
        setMsg(translateErr(res.error.message), "err");
        if (em.indexOf("not confirmed") !== -1 || em.indexOf("not_confirmed") !== -1) addAction("Reenviar correo de confirmación", function () { resendConfirmation(email); });
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
    if (m.indexOf("invalid login") !== -1 || m.indexOf("invalid credentials") !== -1) return "Correo o contraseña incorrectos. Si aún no tienes cuenta, usa 'Registrarse'; si ya te registraste, confirma tu correo antes de ingresar.";
    if (m.indexOf("password should be") !== -1) return "La contraseña debe tener al menos 6 caracteres.";
    if (m.indexOf("email not confirmed") !== -1 || m.indexOf("not_confirmed") !== -1) return "Tu correo aún no está confirmado. Abre el enlace que te enviamos (revisa spam) o pide reenviarlo.";
    if (m.indexOf("rate limit") !== -1 || m.indexOf("too many") !== -1) return "Demasiados intentos o correos en poco tiempo. Espera unos minutos e inténtalo de nuevo.";
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
    return DT.client.from("exp_profiles").select("*").eq("id", user.id).maybeSingle().then(function (res) {
      if (res.error || !res.data) {
        if (attempt < 2) return new Promise(function (r) { setTimeout(r, 400); }).then(function () { return loadProfile(user, attempt + 1); });
        throw (res.error || new Error("perfil no encontrado"));
      }
      return res.data;
    });
  }
  // MIGRADO al hub: ya no hay trigger que cree el perfil al registrarse. La app lo crea:
  // con el área del registro (metadata) si existe; si no (cuenta del hub que entra por
  // primera vez al tablero), se le pide elegir área una única vez.
  function ensureProfile(user) {
    var md = user.user_metadata || {};
    if (md.area) {
      return DT.client.from("exp_profiles").insert({
        id: user.id, email: user.email, full_name: md.full_name || "", area: md.area, role: "member"
      }).then(function (res) {
        if (res.error && res.error.code !== "23505") throw res.error;
        return loadProfile(user);
      });
    }
    return Promise.reject({ __needArea: true });
  }
  function onSignedIn(session) {
    if (DT._recovery) return; // en recuperación mostramos el form de nueva contraseña, no la app
    if (DT.profile || DT._loadingProfile) return; // evita doble carga (INITIAL_SESSION + getSession)
    DT._loadingProfile = true;
    DT.user = session.user;
    try { DT.client.realtime.setAuth(session.access_token); } catch (e) {}
    loadProfile(session.user).then(function (profile) {
      DT._loadingProfile = false;
      DT.profile = profile;
      // En la Gantt: si entramos sin sesión, el bundler abortó el render; recargar para mostrarla.
      if (window.__DT_GANTT_PAGE && !window.__DT_AUTHED) {
        if (!sessionStorage.getItem("dt_reloaded")) { try { sessionStorage.setItem("dt_reloaded", "1"); } catch (e) {} location.reload(); return; }
      }
      var ovs = document.querySelectorAll("#dtauth-ov"); // quita TODOS los overlays
      for (var i = 0; i < ovs.length; i++) ovs[i].remove();
      overlay = null;
      showChip();
      // El bundler de la Gantt reemplaza el DOM; re-insertar el chip de sesión.
      if (window.__DT_GANTT_PAGE) { setTimeout(showChip, 1000); setTimeout(showChip, 2600); }
      fireReady();
    }).catch(function () {
      // Perfil ausente → intentar crearlo (metadata del registro) o pedir el área una vez
      ensureProfile(DT.user).then(function (profile) {
        DT._loadingProfile = false;
        DT.profile = profile;
        var ovs = document.querySelectorAll("#dtauth-ov");
        for (var i = 0; i < ovs.length; i++) ovs[i].remove();
        overlay = null;
        showChip();
        fireReady();
      }).catch(function (err2) {
        DT._loadingProfile = false;
        if (!overlay) buildOverlay();
        if (err2 && err2.__needArea) {
          setMode("area");
          setMsg("Tu cuenta existe en el hub pero aún no tiene área en este tablero. Elígela una vez para continuar.", "");
        } else {
          setMode("login");
          setMsg("No pudimos preparar tu perfil: " + ((err2 && err2.message) || "error desconocido") + ". Intenta de nuevo o avísale al administrador.", "err");
          DT.client.auth.signOut();
        }
      });
    });
  }

  function start() {
    if (!CONFIGURED) {
      document.body.innerHTML = '<div style="max-width:560px;margin:80px auto;font-family:sans-serif;color:#333"><h2>Falta configurar Supabase</h2><p>Edita <code>supabase-config.js</code> con la URL y anon key del proyecto.</p></div>';
      return;
    }
    injectCss();
    // Detectar recuperación ANTES de crear el cliente, para que el flujo de
    // "ya logueado" no gane la carrera y borre el formulario de nueva contraseña.
    if (/[?&]dt=recovery/.test(window.location.search) || getUrlError().type === "recovery") DT._recovery = true;
    DT.client = window.supabase.createClient(CFG.url, CFG.anonKey);
    DT.client.auth.onAuthStateChange(function (event, session) {
      if (event === "PASSWORD_RECOVERY") {
        DT._recovery = true;
        if (!overlay) buildOverlay();
        setMode("newpass");
        setMsg("Define tu nueva contraseña para terminar la recuperación.", "");
        return;
      }
      if (session && session.user) {
        try { DT.client.realtime.setAuth(session.access_token); } catch (e) {} // mantener token de realtime al refrescar
        if (!DT.profile) onSignedIn(session);
      } else {
        DT.profile = null; DT.user = null;
        var c = document.getElementById("dtauth-chip"); if (c) c.remove();
        if (!overlay) { buildOverlay(); }
      }
    });
    // Enlace del correo (función auth-email): ?th=<token_hash>&vt=<recovery|signup|magiclink> → se verifica acá,
    // cae en LA APP (no en el portal). recovery → form de nueva contraseña; signup/magiclink → sesión.
    var _lp = getUrlError();
    if (_lp.th && _lp.vt) {
      if (_lp.vt === "recovery") DT._recovery = true;
      DT.client.auth.verifyOtp({ token_hash: _lp.th, type: _lp.vt }).then(function (r) {
        if (r.error) { cleanUrl(); if (!overlay) buildOverlay(); setMode("login"); setMsg("El enlace expiró o ya se usó. Solicítalo de nuevo.", "err"); return; }
        cleanUrl();
        if (_lp.vt === "recovery") { DT._recovery = true; if (!overlay) buildOverlay(); setMode("newpass"); setMsg("Define tu nueva contraseña para terminar la recuperación.", ""); }
        // signup/magiclink → verifyOtp creó la sesión → onAuthStateChange carga el perfil y la app.
      });
      return;
    }
    DT.client.auth.getSession().then(function (res) {
      var url = getUrlError();
      if (DT._recovery || url.type === "recovery") { // volviste desde el enlace de recuperación
        DT._recovery = true;
        if (!overlay) buildOverlay();
        setMode("newpass");
        setMsg("Define tu nueva contraseña para terminar la recuperación.", "");
        return;
      }
      if (res.data && res.data.session) { onSignedIn(res.data.session); cleanUrl(); }
      else {
        buildOverlay();
        if (url.error || url.error_description || url.error_code) { setMsg(translateUrlErr(url), "err"); }
        cleanUrl();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
