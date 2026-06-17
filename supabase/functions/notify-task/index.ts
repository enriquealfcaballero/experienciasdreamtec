// ============================================================
// Edge Function: notify-task
// ------------------------------------------------------------
// Envía correos vía Resend cuando "le toca" una tarea a un área.
//
// Se dispara por Database Webhooks de Supabase:
//   1) INSERT en public.task_status  -> tareas recién desbloqueadas
//      (todos sus prereq quedaron completos por esta marca).
//   2) INSERT en public.eventos       -> tareas iniciales del evento
//      (sin prereq y que arrancan el día 0).
//
// Para cada tarea a notificar, busca a TODOS los usuarios del área
// (profiles.area) y manda UN solo correo con todos en el "Para:",
// para que el área lo vea como un hilo grupal.
//
// Variables de entorno (secrets de la función):
//   RESEND_API_KEY     (obligatoria)  API key de Resend
//   MAIL_FROM          remitente, ej. 'Dreamtec Experiencias <notificaciones@verticecorp.cl>'
//   SITE_URL           URL del tablero (Netlify), ej. https://....netlify.app/Tablero.html
//   WEBHOOK_SECRET     (opcional) si se define, el webhook debe enviar
//                      el header  x-webhook-secret  con el mismo valor.
//   FALLBACK_EMAIL     (opcional) destino si el área no tiene usuarios.
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solos.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- Grafo de tareas (espejo de window.GANTT_DATA en Tablero.html) ----
// Mantener en sincronía con Tablero.html si cambian tareas/áreas/dependencias.
type Task = { id: string; area: string; label: string; pago: "ambos" | "contado" | "credito"; prereq: string[]; start: number };

const AREAS: Record<string, string> = {
  comercial: "Ventas",
  facturacion: "Facturación y Cobranza",
  finanzas: "Finanzas",
  contabilidad: "Contabilidad",
  logistica: "Logística",
  bodega: "Bodega",
  mesa: "Mesa de Ayuda",
  compras: "Compras",
  marketing: "Marketing",
};

// Colores por área (hex, para los correos — equivalentes a los oklch del Tablero).
const AREA_COLORS: Record<string, string> = {
  comercial: "#4f6bd8",
  facturacion: "#4a9d5b",
  finanzas: "#2f9e8f",
  contabilidad: "#7a5bd0",
  logistica: "#3b82c4",
  bodega: "#b07d2e",
  mesa: "#c2683a",
  compras: "#b4509a",
  marketing: "#c2415a",
};

const TASKS: Task[] = [
  { id: "t01", area: "comercial", label: "Generar cotización", pago: "ambos", prereq: [], start: 0 },
  { id: "t02", area: "comercial", label: "Negociación con cliente", pago: "ambos", prereq: ["t01"], start: 0 },
  { id: "t03", area: "comercial", label: "Definir forma de pago", pago: "ambos", prereq: ["t02"], start: 0 },
  { id: "t04", area: "comercial", label: "Recibir cotización aprobada", pago: "ambos", prereq: ["t03"], start: 0 },
  { id: "t05", area: "comercial", label: "Envío de NV a Contabilidad", pago: "ambos", prereq: ["t04"], start: 0 },
  { id: "t06", area: "comercial", label: "Envío de contrato y firma cliente", pago: "ambos", prereq: ["t04"], start: 0 },
  { id: "t11", area: "contabilidad", label: "Revisar NV (receta de la operación)", pago: "ambos", prereq: ["t05"], start: 1 },
  { id: "t11b", area: "comercial", label: "Completar NV si vuelve de Contabilidad", pago: "ambos", prereq: ["t11"], start: 1 },
  { id: "t12", area: "contabilidad", label: "Aprobar NV y validar factibilidad", pago: "ambos", prereq: ["t11b"], start: 2 },
  { id: "t07", area: "facturacion", label: "Emitir factura post OC", pago: "contado", prereq: ["t12"], start: 2 },
  { id: "t08", area: "facturacion", label: "Enviar factura al cliente", pago: "contado", prereq: ["t07"], start: 2 },
  { id: "t09", area: "comercial", label: "Gestión de cobranza", pago: "contado", prereq: ["t08"], start: 2 },
  { id: "t09b", area: "facturacion", label: "Conciliación diaria de pagos", pago: "contado", prereq: ["t07"], start: 2 },
  { id: "t10", area: "finanzas", label: "Validar / aprobar crédito", pago: "credito", prereq: ["t12"], start: 2 },
  { id: "t10b", area: "contabilidad", label: "Validación contable del crédito", pago: "credito", prereq: ["t12"], start: 2 },
  { id: "t_vta_insumos", area: "comercial", label: "Definir insumos y activos a comprar", pago: "ambos", prereq: ["t12"], start: 2 },
  { id: "t_mesa_def", area: "mesa", label: "Definir anfitriones y técnicos", pago: "ambos", prereq: ["t12"], start: 2 },
  { id: "t_log_def", area: "logistica", label: "Definir proveedor de transporte/servicios", pago: "ambos", prereq: ["t12"], start: 2 },
  { id: "t21b", area: "compras", label: "Emitir OCs (servicios e insumos)", pago: "ambos", prereq: ["t_mesa_def", "t_log_def", "t_vta_insumos"], start: 2 },
  { id: "t20", area: "compras", label: "Gestionar insumos", pago: "ambos", prereq: ["t21b"], start: 2 },
  { id: "t21", area: "compras", label: "Gestionar activos no existentes", pago: "ambos", prereq: ["t21b"], start: 2 },
  { id: "t13", area: "logistica", label: "Preparar equipos / productos", pago: "ambos", prereq: ["t12"], start: 3 },
  { id: "t14", area: "logistica", label: "Guía de salida", pago: "ambos", prereq: ["t13"], start: 5 },
  { id: "t15", area: "logistica", label: "Coordinar despacho y retiro", pago: "ambos", prereq: ["t14", "t21b"], start: 6 },
  { id: "t17", area: "mesa", label: "Coordinar anfitriones", pago: "ambos", prereq: ["t21b"], start: 3 },
  { id: "t19", area: "mesa", label: "Coordinar técnicos y montaje", pago: "ambos", prereq: ["t21b"], start: 3 },
  { id: "t_brief_anf", area: "comercial", label: "Brief con el anfitrión", pago: "ambos", prereq: ["t17"], start: 6 },
  { id: "t_bod_recep", area: "bodega", label: "Recepción de insumos y activos (D−1)", pago: "ambos", prereq: ["t20", "t21"], start: 4 },
  { id: "t_orq", area: "comercial", label: "Orquestar el evento", pago: "ambos", prereq: ["t12"], start: 2 },
  { id: "t22", area: "finanzas", label: "Pago a proveedores", pago: "ambos", prereq: ["t30"], start: 8 },
  { id: "t23", area: "finanzas", label: "Revisión de pagos a proveedores", pago: "ambos", prereq: ["t22"], start: 9 },
  { id: "t24", area: "marketing", label: "Brief y coordinación foto / video", pago: "ambos", prereq: ["t21b"], start: 3 },
  { id: "t25", area: "marketing", label: "Ploteo y gráfica", pago: "ambos", prereq: ["t12"], start: 5 },
  { id: "t_go", area: "facturacion", label: "Confirmación go / no-go (−72h)", pago: "ambos", prereq: ["t12"], start: 4 },
  { id: "t26", area: "mesa", label: "Montaje", pago: "ambos", prereq: ["t15", "t_go", "t_bod_recep"], start: 7 },
  { id: "t27", area: "comercial", label: "Validación en terreno", pago: "ambos", prereq: ["t26"], start: 7 },
  { id: "t29", area: "logistica", label: "Ejecutar retiro", pago: "ambos", prereq: ["t15"], start: 8 },
  { id: "t30", area: "bodega", label: "Recepción y verificación post-evento", pago: "ambos", prereq: ["t29"], start: 8 },
  { id: "t31", area: "marketing", label: "Subir a RRSS", pago: "ambos", prereq: [], start: 8 },
  { id: "t32", area: "contabilidad", label: "Conciliación del evento", pago: "ambos", prereq: ["t30"], start: 8 },
  { id: "t33", area: "facturacion", label: "Emitir factura (D+1)", pago: "credito", prereq: ["t30"], start: 8 },
  { id: "t33b", area: "contabilidad", label: "Registro contable de factura", pago: "credito", prereq: ["t33"], start: 8 },
  { id: "t34", area: "facturacion", label: "Cobranza a 30 días (D+30)", pago: "credito", prereq: ["t33"], start: 11 },
];

const TASK_BY_ID: Record<string, Task> = Object.fromEntries(TASKS.map((t) => [t.id, t]));

// ---- Helpers ----
const env = (k: string) => Deno.env.get(k) ?? "";

function applies(t: Task, paymentMode: string): boolean {
  return t.pago === "ambos" || t.pago === paymentMode;
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function emailHtml(opts: { areaLabel: string; areaColor: string; task: Task; eventName: string; client: string; eventDate: string; paymentMode: string; link: string; reason: string; logo: string }): string {
  const { areaLabel, areaColor, task, eventName, client, eventDate, paymentMode, link, reason, logo } = opts;
  const pago = paymentMode === "contado" ? "Contado" : "Crédito";
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#8a93a3;font-size:13px;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;color:#1f2430;font-size:14px;font-weight:600">${v}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#eceef1;padding:28px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.08);border:1px solid #e6e8ec">
    <tr><td style="padding:22px 28px 18px;border-bottom:1px solid #eef0f3">
      <img src="${esc(logo)}" alt="Dreamtec" height="26" style="height:26px;display:block;border:0">
    </td></tr>
    <tr><td style="height:4px;background:${esc(areaColor)};font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:30px 28px 8px">
      <span style="display:inline-block;background:${esc(areaColor)}1a;color:${esc(areaColor)};font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 11px;border-radius:999px">${esc(areaLabel)}</span>
      <h1 style="margin:14px 0 6px;font-size:23px;line-height:1.25;color:#11151c">Te toca: ${esc(task.label)}</h1>
      <p style="margin:0 0 22px;font-size:14px;color:#6b7280;line-height:1.5">${esc(reason)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;border-collapse:collapse">
        ${row("Evento", esc(eventName))}
        ${client ? row("Cliente", esc(client)) : ""}
        ${eventDate ? row("Fecha del evento", esc(fmtDate(eventDate))) : ""}
        ${row("Modalidad", esc(pago))}
      </table>
      ${link ? `<a href="${esc(link)}" style="display:inline-block;background:#11151c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 26px;border-radius:10px">Abrir el tablero →</a>` : ""}
    </td></tr>
    <tr><td style="padding:22px 28px 26px;border-top:1px solid #eef0f3;background:#fafbfc">
      <p style="margin:0;font-size:12px;color:#9aa3b2;line-height:1.6">Recibes este correo porque perteneces al área <strong style="color:#6b7280">${esc(areaLabel)}</strong>. Todas las personas de tu área están en copia en este mismo correo.<br>Dreamtec · Eventos de Experiencia</p>
    </td></tr>
  </table>
</body></html>`;
}

async function sendResend(to: string[], subject: string, html: string): Promise<void> {
  const from = env("MAIL_FROM") || "Dreamtec Experiencias <notificaciones@verticecorp.cl>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

// ---- Handler ----
Deno.serve(async (req: Request) => {
  try {
    // Seguridad opcional por header compartido con el webhook.
    const secret = env("WEBHOOK_SECRET");
    if (secret && req.headers.get("x-webhook-secret") !== secret) {
      return new Response("forbidden", { status: 401 });
    }

    const payload = await req.json().catch(() => null);
    if (!payload || payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: "no-insert" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const table: string = payload.table;
    const record = payload.record ?? {};
    const eventId: string = table === "eventos" ? record.id : record.event_id;
    if (!eventId) return new Response(JSON.stringify({ skipped: "no-event" }), { status: 200 });

    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

    // Evento + modalidad
    const { data: ev } = await admin.from("eventos").select("id,data").eq("id", eventId).single();
    const data = (ev?.data ?? {}) as Record<string, unknown>;
    const paymentMode = String(data.paymentMode ?? "contado");
    const eventName = String(data.name ?? eventId);
    const client = String(data.client ?? "");
    const eventDate = String(data.eventDate ?? "");

    // Tareas completas del evento
    const { data: tsRows } = await admin.from("task_status").select("task_id").eq("event_id", eventId);
    const done = new Set((tsRows ?? []).map((r: { task_id: string }) => r.task_id));

    // ¿Qué tareas notificar?
    let toNotify: Task[] = [];
    let reason = "";
    if (table === "eventos") {
      reason = "Evento nuevo creado — tarea inicial.";
      toNotify = TASKS.filter((t) => applies(t, paymentMode) && t.prereq.length === 0 && t.start === 0);
    } else {
      const justDone: string = record.task_id;
      reason = "Se completaron los pasos previos — ya puedes avanzar.";
      toNotify = TASKS.filter(
        (t) =>
          applies(t, paymentMode) &&
          t.prereq.includes(justDone) && // afectada por esta marca
          !done.has(t.id) && // aún no completa
          t.prereq.every((p) => done.has(p)), // todos sus prereq completos
      );
    }

    const link = env("SITE_URL");
    const results: Array<Record<string, unknown>> = [];

    for (const task of toNotify) {
      // De-duplicación: una sola notificación "disponible" por (evento, tarea).
      const ins = await admin.from("task_notifications").insert({ event_id: eventId, task_id: task.id, kind: "disponible" });
      if (ins.error) {
        // 23505 = ya notificada antes (re-marca, reintento del webhook, etc.)
        results.push({ task: task.id, skipped: "ya-notificada" });
        continue;
      }

      // Destinatarios: todos los usuarios del área de la tarea.
      const { data: members } = await admin.from("profiles").select("email").eq("area", task.area);
      let to = (members ?? []).map((m: { email: string }) => m.email).filter((e: string) => !!e);
      if (to.length === 0) {
        const fb = env("FALLBACK_EMAIL");
        if (fb) to = [fb];
        else {
          results.push({ task: task.id, skipped: "sin-destinatarios" });
          continue;
        }
      }

      const areaLabel = AREAS[task.area] ?? task.area;
      const areaColor = AREA_COLORS[task.area] ?? "#2563eb";
      let logo = "https://experienciasdreamtec.netlify.app/assets/dreamtec-logo.png";
      try { logo = new URL("/assets/dreamtec-logo.png", link || "https://experienciasdreamtec.netlify.app").href; } catch { /* usa fallback */ }
      const subject = `Le toca a ${areaLabel}: ${task.label} · ${eventName}`;
      const html = emailHtml({ areaLabel, areaColor, task, eventName, client, eventDate, paymentMode, link, reason, logo });
      try {
        await sendResend(to, subject, html);
        results.push({ task: task.id, sent_to: to });
      } catch (e) {
        // Si Resend falla, soltamos el candado para reintentar luego.
        await admin.from("task_notifications").delete().match({ event_id: eventId, task_id: task.id, kind: "disponible" });
        results.push({ task: task.id, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, event: eventId, notified: results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
