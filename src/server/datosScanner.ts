// Scanner Express Ley 21.719 (determinista, sin LLM).
// Extrae atomicamente la estructura del DOM via HTTP + regex y evalua reglas fijas.
// Sin costos de APIs externas, sin alucinaciones: cada hallazgo lleva evidencia.

export function contieneTexto(s: string, re: RegExp): boolean {
  return re.test(s);
}

export interface HallazgoDatos {
  id: string;
  gravedad: 'critica' | 'alta' | 'media';
  titulo: string;
  detalle: string;
  evidencia?: string;
  pagina?: string;
  fundamento: string;
}

export interface ResultadoDatosScanner {
  version: 'datos-scanner-v1';
  url: string;
  destinoFuera: boolean;
  score: number; // 0-100 (100 = sin hallazgos)
  nivel: 'Bajo' | 'Medio' | 'Alto' | 'Critico';
  hallazgos: HallazgoDatos[];
  tiempoMs: number;
  disclaimer: string;
}

export interface DomSnapshot {
  html: string;
  texto: string;
  urlFinal: string;
  terceros: string[];
  enlaces: Array<{ text: string; href: string }>;
  checkboxes: Array<{
    inputHtml: string;
    checked: boolean;
    nombre: string;
    contexto: string;
  }>;
}

export interface ScannerOptions {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
}

// ---------- utilidades de parsing textual sin dependecias ----------

function decodificarEntidades(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'").replace(/&amp;/gi, '&');
}

function quitarEtiquetas(html: string): string {
  return decodificarEntidades(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

function clasificarTercero(src: string): string {
  const u = src.toLowerCase();
  if (u.includes('googletagmanager.com') || u.includes('gtag(') || u.includes('google-analytics')) return 'Google Tag Manager/Analytics';
  if (u.includes('connect.facebook.net') || u.includes('facebook.com/tr') || u.includes('fbevents.js')) return 'Meta Pixel';
  if (u.includes('hotjar')) return 'Hotjar';
  if (u.includes('clarity') || u.includes('clarity.microsoft')) return 'Microsoft Clarity';
  if (u.includes('qualtrics')) return 'Qualtrics';
  if (u.includes('intercom')) return 'Intercom';
  if (u.includes('cdn.jsdelivr.net/npm/tiktok-events') || u.includes('analytics.tiktok.com')) return 'TikTok Pixel';
  return 'Tercero genérico (script externo)';
}

export function parsearDom(htmlRaw: string): Omit<DomSnapshot, 'urlFinal' | 'html'> & { html: string } {
  const html = htmlRaw;
  const terceros = [...html.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((m) => clasificarTercero(m[1]));
  const enlaces = [...html.matchAll(/<a[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    text: quitarEtiquetas(m[2]),
    href: m[1].trim(),
  }));
  const checkboxes = [...html.matchAll(/<input[^>]*\btype\s*=\s*["']?checkbox["']?[^>]*>/gi)].map((m) => {
    const tag = m[0];
    const checkedAttr = /\bchecked\b/i.test(tag);
    const name = (tag.match(/\b(?:name|id)\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    const inicio = Math.max(0, m.index - 300);
    const contexto = quitarEtiquetas(html.slice(inicio, m.index + tag.length)).slice(-220);
    return { inputHtml: tag.slice(0, 200), checked: checkedAttr, nombre: name, contexto };
  });
  return { html, texto: quitarEtiquetas(html), terceros, enlaces, checkboxes };
}

export function evaluarReglas(snap: DomSnapshot, entrada: { url: string }): HallazgoDatos[] {
  const h: HallazgoDatos[] = [];
  const url = entrada.url;
  const textoLower = snap.texto.toLowerCase();
  const htmlLower = snap.html.toLowerCase();

  // R0: HTTPS
  if (url.startsWith('http://')) {
    h.push({
      id: 'R0-https',
      gravedad: 'critica',
      titulo: 'Sitio sin HTTPS',
      detalle: 'El sitio se sirve por HTTP: los datos personales se transmiten sin cifrado (principio de seguridad, Ley 21.719 art. 3 letra f).',
      evidencia: url.split('/')[0] + '://',
      pagina: url,
      fundamento: 'Ley 21.719 art. 3 f) y art. 14 quinquies (deber de seguridad)',
    });
  }

  // R1: checkbox marketing pre-marcado
  const reOptin = /(acepto|aceptar|suscri|newsletter|marketing|promocion|publicidad|novedad|oferta)/i;
  for (const cb of snap.checkboxes) {
    if (!cb.checked) continue;
    if (!reOptin.test(`${cb.nombre} ${cb.contexto}`) && !reOptin.test(cb.inputHtml)) continue;
    h.push({
      id: 'R1-checkbox-premarcado',
      gravedad: 'critica',
      titulo: 'Checkbox de marketing/términos pre-marcado por defecto',
      detalle: 'Checkbox de consentimiento opcional marcado por defecto: el consentimiento debe ser libre, específico, previo e inequívoco mediante acto afirmativo (Ley 21.719 art. 12; hoy también Ley 19.628 art. 12 vigente).',
      evidencia: `${cb.inputHtml} … ${cb.contexto.slice(0, 80)}`,
      fundamento: 'Ley 21.719 art. 12; Ley 19.628 art. 12 (vigente)',
    });
  }

  // R2: politica de privacidad accesible (enlace o texto con responsable/finalidades)
  const rePrivLink = /(pol[ií]tica|privacidad|protecci[oó]n\s+de\s+datos|aviso\s+de\s+(?:datos|privacidad)|tratamiento\s+de\s+datos|ley\s+19\.?628|ley\s+21\.?719)/i;
  const tienePrivacidad =
    snap.enlaces.some((e) => rePrivLink.test(`${e.text} ${e.href}`)) || /privacidad/i.test(snap.texto) || /ley\s+19\.?628/i.test(snap.texto);
  // Si solo aparece "ley 19.628" suelta sin enlace de política, cuenta como ausente de política accesible.
  const tienePrivacidadAccesible = snap.enlaces.some((e) => rePrivLink.test(`${e.text} ${e.href}`));
  if (!tienePrivacidadAccesible && !/privacidad/i.test(snap.texto)) {
    h.push({
      id: 'R2-politica-ausente',
      gravedad: 'alta',
      titulo: 'Política de privacidad no accesible',
      detalle: 'No se detectó enlace ni texto de política de privacidad en la página principal: los titulares no pueden conocer responsable, finalidades ni derechos.',
      fundamento: 'Ley 21.719 art. 3 g) y art. 14 ter',
    });
  }
  // R5: politica incompleta (contenido minimo)
  if (tienePrivacidadAccesible || /privacidad/i.test(snap.texto)) {
    const faltaResponsable = !/(nombre|raz[oó]n\s+social|empresa|responsable\s+de\s+datos|quien(es)\s+somos)/i.test(textoLower);
    const faltaDerechos = !/(acceso|rectificaci[oó]n|supresi[oó]n|oposici[oó]n|portabilidad|bloqueo)/i.test(textoLower);
    const faltaContacto = !/(correo|email|contacto|escribenos|escribanos|domicilio|direccion)/i.test(textoLower);
    if (faltaResponsable || faltaDerechos || faltaContacto) {
      h.push({
        id: 'R5-politica-incompleta',
        gravedad: 'alta',
        titulo: 'Política de privacidad incompleta',
        detalle: `Contenido mínimo faltante: ${[faltaResponsable ? 'identidad del responsable' : null, faltaDerechos ? 'derechos del titular' : null, faltaContacto ? 'datos de contacto' : null].filter(Boolean).join(', ')}.`,
        fundamento: 'Ley 21.719 art. 14 ter (deber de información)',
      });
    }
  }

  // R3: canal de derechos ARSOPB
  const reARSOPB = /(derechos\s+(?:arsop|arsopb|arco)|rectificaci[oó]n|supresi[oó]n|cancelaci[oó]n|oposici[oó]n|portabilidad|bloqueo\s+de\s+datos|eliminar\s+mis\s+datos|baja\s+de\s+datos|ejerce\s+tus\s+derechos)/i;
  if (!reARSOPB.test(snap.texto) && !snap.enlaces.some((e) => reARSOPB.test(`${e.text} ${e.href}`))) {
    h.push({
      id: 'R3-arsopb-ausente',
      gravedad: 'alta',
      titulo: 'No se identifica canal de derechos ARSOPB',
      detalle: 'No se encontró procedimiento/correo visible para ejercer acceso, rectificación, supresión, oposición, portabilidad ni bloqueo.',
      fundamento: 'Ley 21.719 arts. 5 a 11; plazos de respuesta art. 11 (30 días corridos)',
    });
  }

  // R4: actualización normativa (19.628 sin 21.719)
  if (/ley\s*19\.?628\b/i.test(snap.texto) && !/ley\s*21\.?719\b/i.test(snap.texto)) {
    h.push({
      id: 'R4-normativa-obsoleta',
      gravedad: 'media',
      titulo: 'Referencias a la antigua normativa sin adaptación',
      detalle: 'El sitio cita la Ley 19.628 en su versión anterior sin mencionar la reforma Ley 21.719: revisar política y formularios antes de la vigencia.',
      fundamento: 'Ley 21.719 (vigencia diferida 1-dic-2026 / proyecto al 15-oct-2027)',
    });
  }

  // R6: CMP con solo "aceptar todo"
  const ventanaAceptar = /aceptar\s+todo|aceptar\s+todas/i.test(snap.texto);
  const tieneRechazar = /rechazar|rechaza\s+todo|no\s+aceptar|configurar|personalizar|guardar\s+preferencias/i.test(snap.texto);
  if (ventanaAceptar && !tieneRechazar) {
    h.push({
      id: 'R6-cmp-sin-rechazo',
      gravedad: 'media',
      titulo: 'Banner de consentimiento sin opción de rechazo equivalente',
      detalle: 'Se detectó botón de aceptación completa sin alternativa de rechazo/configuración visible: el consentimiento debe ser revocable y libre.',
      fundamento: 'Ley 21.719 art. 12 (consentimiento libre y revocable)',
    });
  }

  // R7: terceros sin marco
  if (snap.terceros.length) {
    const marco = /(terceros|encargados|compartimos|transferimos|transferencia|meta|google|tecnolog[ií]a\s+de\s+terceros)/i.test(textoLower);
    if (!marco) {
      h.push({
        id: 'R7-terceros-sin-marco',
        gravedad: 'media',
        titulo: 'Scripts de terceros activos sin marco declarado',
        detalle: `${snap.terceros.length} recurso(s) de terceros detectado(s): ${snap.terceros.slice(0, 4).join(', ')}. La política debe identificar finalidades, encargados y transferencias internacionales.`,
        fundamento: 'Ley 21.719 arts. 14, 15 bis y título de transferencias internacionales',
      });
    }
  }

  return h;
}

function scoreDesdeHallazgos(h: HallazgoDatos[]): { score: number; nivel: ResultadoDatosScanner['nivel'] } {
  const pesos: Record<HallazgoDatos['gravedad'], number> = { critica: 40, alta: 25, media: 10 };
  const puntos = h.reduce((acc, x) => acc + (pesos[x.gravedad] || 10), 0);
  const score = Math.max(0, 100 - puntos);
  const nivel = score >= 80 ? 'Bajo' : score >= 50 ? 'Medio' : score >= 25 ? 'Alto' : 'Critico';
  return { score, nivel };
}

// ---------- seguridad SSRF ----------

function ipEsPrivada(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4) return false;
  if (p[0] === 10) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 127) return true;
  if (p[0] === 169 && p[1] === 254) return true;
  if (p[0] === 0) return true;
  return false;
}

function hostnameEsPrivada(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.startsWith('[') && h.endsWith(']')) {
    const inner = h.slice(1, -1);
    if (inner === '::1' || inner === '::' || inner.startsWith('fd') || inner.startsWith('fc')) return true;
    if (inner.startsWith('::ffff:')) return ipEsPrivada(inner.slice(7));
    return false;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return ipEsPrivada(h);
  return false;
}

export function validarUrlAuditable(urlRaw: string): { ok: boolean; url?: URL; motivo?: string } {
  const cruda = (urlRaw || '').trim();
  if (!cruda) return { ok: false, motivo: 'URL vacía' };
  let u: URL;
  try {
    u = new URL(cruda);
  } catch {
    return { ok: false, motivo: 'URL con formato inválido' };
  }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, motivo: 'Solo se permiten URLs http/https' };
  if (u.username || u.password) return { ok: false, motivo: 'URLs con credenciales embebidas no permitidas' };
  if (!u.hostname) return { ok: false, motivo: 'Hostname vacío' };
  if (hostnameEsPrivada(u.hostname)) return { ok: false, motivo: 'URL privada o interna no auditable' };
  return { ok: true, url: u };
}

async function dnsSinPrivados(hostname: string): Promise<boolean> {
  try {
    const dns = await import('node:dns/promises');
    const v4 = await dns.resolve4(hostname).catch(() => []);
    const v6 = await dns.resolve6(hostname).catch(() => []);
    if (v4.some(ipEsPrivada)) return false;
    if (v6.some((ip) => {
      const i = ip.toLowerCase();
      return i === '::1' || i === '::' || i.startsWith('fd') || i.startsWith('fc') || i.startsWith('fe8') || i.startsWith('fe9') || i.startsWith('fea') || i.startsWith('feb');
    })) return false;
    return v4.length > 0 || v6.length > 0;
  } catch {
    // Sin DNS disponible: seguir con la validación textual (no bloquear por fallo DNS)
    return true;
  }
}

async function fetchLimitado(url: URL, opts: ScannerOptions): Promise<string> {
  const timeoutMs = Math.min(opts.timeoutMs ?? 8000, 15000);
  const maxBytes = Math.min(opts.maxBytes ?? 4_000_000, 8_000_000);
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'User-Agent': opts.userAgent || 'LegalHelp-Scanner/1.0 (+https://legalhelp.cl; contacto soporte@legalhelp.cl)',
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    },
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (!loc) return '';
    const siguiente = new URL(loc, url);
    if (hostnameEsPrivada(siguiente.hostname)) throw new Error('Redirect a URL interna no permitida');
    if (!/^https?:$/.test(siguiente.protocol)) throw new Error('Redirect a protocolo no permitido');
    return fetchLimitado(siguiente, { ...opts, timeoutMs });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (ct && !/html|textml|text\/plain|application\/xhtml/i.test(ct)) {
    throw new Error(`Content-Type no auditable (${ct})`);
  }
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* noop */ }
      throw new Error('Página demasiado grande (límite 4 MB)');
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return buf.toString('utf-8');
}

// ---------- API pública ----------

export async function auditarUrlDatos(
  entrada: { url: string; email: string; autorizado: boolean },
  opts: ScannerOptions = {},
): Promise<ResultadoDatosScanner> {
  const t0 = Date.now();
  const disclaimer =
    'Diagnóstico automatizado de preparación para la Ley 21.719 (vigencia diferida; proyecto en trámite al 15-oct-2027). No constituye asesoría jurídica. Resultado sujeto a revisión profesional.';
  const urlInput = entrada.url.trim();

  const val = validarUrlAuditable(urlInput);
  if (!val.ok || !val.url) {
    return {
      version: 'datos-scanner-v1',
      url: urlInput,
      destinoFuera: false,
      score: 0,
      nivel: 'Critico',
      hallazgos: [{
        id: 'R-url-invalida',
        gravedad: 'critica',
        titulo: 'URL no auditable',
        detalle: val.motivo || 'URL inválida',
        fundamento: 'Política de seguridad del scanner (SSRF)',
      }],
      tiempoMs: Date.now() - t0,
      disclaimer,
    };
  }
  const destinoFuera = val.url.hostname.toLowerCase() !== 'legalhelp.cl' && !val.url.hostname.toLowerCase().endsWith('.legalhelp.cl');

  if (!(await dnsSinPrivados(val.url.hostname))) {
    return {
      version: 'datos-scanner-v1',
      url: urlInput,
      destinoFuera,
      score: 0,
      nivel: 'Critico',
      hallazgos: [{
        id: 'R-ssrf',
        gravedad: 'critica',
        titulo: 'URL resuelve a red interna',
        detalle: 'El hostname resuelve a una IP privada/interna: escaneo bloqueado por seguridad.',
        fundamento: 'Política de seguridad del scanner (SSRF)',
      }],
      tiempoMs: Date.now() - t0,
      disclaimer,
    };
  }

  const t1 = Date.now();
  const html = await fetchLimitado(val.url, opts);
  const parsed = parsearDom(html);
  const snap: DomSnapshot = { ...parsed, urlFinal: val.url.toString(), html };
  const hallazgos = evaluarReglas(snap, { url: urlInput });
  const { score, nivel } = scoreDesdeHallazgos(hallazgos);

  return {
    version: 'datos-scanner-v1',
    url: urlInput,
    destinoFuera,
    score,
    nivel,
    hallazgos,
    tiempoMs: Date.now() - t1,
    disclaimer,
  };
}
