import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import mammoth from "mammoth";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import crypto from "crypto";
import { saveOrder, getOrderByOrderId, getOrderByPreferenceId, updateOrder } from "./src/lib/orderStore.js";
import { checkRateLimit, getClientIp, PAYMENT_RATE_LIMIT, ANALYZE_RATE_LIMIT } from "./src/lib/rateLimit.js";
import { SEO_PAGES } from "./src/data/seoPages.js";
import { SEO_PAGES_EXTRA } from "./src/data/seoPagesExtra.js";
import { SEO_PAGES_BATCH2 } from "./src/data/seoPagesBatch2.js";
import { resolvePseoRedirect } from "./src/data/redirects.js";
import { ALL_SEO_PAGES as ALL_SEO_PAGES_SHARED, renderHomeContent } from "./src/lib/homeSsr.js";
import { CALCULATOR_PAGES, getCalculatorPage } from "./src/data/calculators.js";
import { COMUNAS_RM } from "./src/data/tribunales.js";

// Combinación de TODAS las páginas SEO: 21 originales + 45 + 20 = 86 páginas (+home = 87 URLs)
const ALL_SEO_PAGES = ALL_SEO_PAGES_SHARED;

dotenv.config();

const app = express();
const PORT = 3000;

// Security: disable X-Powered-By header
app.disable("x-powered-by");

app.use(express.json({ limit: "50mb" }));

// SEO: eliminar soft-duplicates por query string (utm, fbclid, p=, s=, page=, etc.)
// excepto los parametros que usa la app (payment/orderId del redirect de MercadoPago).
const ALLOWED_QUERY_PARAMS = new Set(["payment", "orderId"]);
app.use((req, res, next) => {
  const queryKeys = Object.keys(req.query);
  if (queryKeys.length > 0 && queryKeys.some(k => !ALLOWED_QUERY_PARAMS.has(k))) {
    const cleanUrl = `${req.protocol}://${req.get("host")}${req.path}`;
    return res.redirect(301, cleanUrl);
  }
  next();
});

// Initialize MercadoPago client (token SOLO desde variables de entorno, nunca hardcodeado)
const envToken = process.env.MP_ACCESS_TOKEN;
const mpAccessToken = (envToken && (envToken.startsWith("APP_USR-") || envToken.startsWith("TEST-")))
  ? envToken
  : undefined;
const isMpConfigured = Boolean(mpAccessToken);
const isSandbox = Boolean(mpAccessToken && mpAccessToken.startsWith("TEST-"));
const mp = isMpConfigured && mpAccessToken ? new MercadoPagoConfig({ accessToken: mpAccessToken }) : null;

// Initialize Gemini API
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY no configurada en las variables de entorno.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

const SYSTEM_INSTRUCTION_LAWYER = `Eres un Abogado Litigante Senior en Chile, experto en derecho civil, laboral, penal y de familia, con profundo conocimiento del funcionamiento del Poder Judicial (PJUD) y la Oficina Judicial Virtual (OJV).

Tu objetivo es analizar los documentos legales (resoluciones, demandas, notificaciones) subidos por el usuario, cruzar esa información con el relato de su problema, y entregar un diagnóstico legal preciso, estructurado y en lenguaje comprensible para una persona sin estudios de derecho.

REGLAS ESTRICTAS DE OPERACIÓN (CUMPLIMIENTO OBLIGATORIO):
1. CERO ALUCINACIONES DE PLAZOS: Los plazos en Chile son fatales. Si identificas un plazo para contestar, apelar o presentar pruebas, debes citar el artículo exacto del código respectivo (Ej: Código de Procedimiento Civil Art. 258, Art. 303, Art. 462; Código del Trabajo Art. 453, Art. 480, Art. 510; Ley 19.968 de Familia Art. 58, Art. 67; Código Procesal Penal Art. 366; Ley 18.287 de Juzgados de Policía Local, etc.) y advertir claramente si los días son hábiles (lunes a sábado según el CPC Art. 66, o lunes a viernes en procedimiento laboral/administrativo) o corridos. Si el documento no especifica la fecha de notificación, debes indicar explícitamente que el plazo fatídico comienza a correr desde el día siguiente a la notificación legal.
2. NEUTRALIDAD Y PRECISIÓN: No des falsas esperanzas. Si la situación es grave (ej. embargo inminente, citación bajo apercibimiento de arresto, lanzamiento con fuerza pública, declaración de rebeldía), dilo con absoluta claridad y urgencia en **negritas**.
3. LENGUAJE CLARO: Traduce el "leguleyo" (jerga legal procesal chilena) a español simple y coloquial chileno comprensible. Explica qué significa términos como "traslado", "autos en relación", "rebeldía", "despáchese mandamiento de ejecución y embargo", "resolución que cita a audiencia de juicio", "concluidos para fallo", "reserva de derechos", etc., si aparecen en el texto o la causa.
4. DESCARGO DE RESPONSABILIDAD: Siempre debes incluir la advertencia obligatoria de que este análisis es una orientación inicial basada en IA y no reemplaza el patrocinio y poder de un abogado habilitado para el ejercicio de la profesión en Chile.

ESTRUCTURA OBLIGATORIA DE TU RESPUESTA:
Debes responder SIEMPRE utilizando estrictamente la siguiente estructura en formato Markdown:

## 1. Resumen de tu Situación Legal
[Explica en 2-3 párrafos de qué se trata la demanda o resolución recibida, integrando el relato del usuario y los datos del documento (RIT/ROL, Tribunal, demandante, materia)].

## 2. Normativa y Leyes Aplicables
[Enumera en viñetas las leyes principales que rigen este caso en Chile. Ej: Ley 19.968 que crea los Tribunales de Familia, Código de Procedimiento Civil, Código del Trabajo, Ley 18.287, etc. Explica brevemente por qué aplican a su situación].

## 3. Plazos Críticos (Plazos Fatales)
[Identifica exactamente qué acciones deben tomarse y en cuánto tiempo. Cita los artículos legales exactos. Advierte explícitamente si son días hábiles (lunes a sábado según el CPC Art. 66, o lunes a viernes en laboral/administrativo) o corridos. Si hay riesgo de embargo, pérdida de derechos o rebeldía por inacción, destácalo en **negritas**].

## 4. Riesgos Actuales
[Análisis objetivo y sin anestesia de lo que pasa si el usuario no hace nada o no actúa a tiempo].

## 5. Próximos Pasos Recomendados
[Pasos accionables inmediatos: qué documentos extras debe reunir en OJV/PJUD con su ClaveÚnica, qué debe consultar urgentemente a un abogado o Corporación de Asistencia Judicial (CAJ), y cómo prepararse].

---
*Descargo de responsabilidad: Este análisis constituye una orientación informativa y técnica generada mediante Inteligencia Artificial adaptada a la legislación chilena. No constituye asesoría legal formal ni reemplaza el patrocinio y poder otorgado a un abogado habilitado para el ejercicio de la profesión en Chile (Ley 18.120).*
`;

const SYSTEM_INSTRUCTION_DOCUMENT_GENERATOR = `Eres un Abogado Litigante Senior en Chile con 20 años de experiencia en redacción de escritos judiciales para el Poder Judicial Chileno (PJUD) y la Oficina Judicial Virtual (OJV).

Tu tarea es redactar un documento legal chileno formal, listo para ser presentado ante el tribunal correspondiente. Debes generar el documento en formato Markdown estructurado, siguiendo EXACTAMENTE las formalidades procesales chilenas.

REGLAS OBLIGATORIAS:
1. FORMATO PJUD: Usa el formato estándar de escritos del Poder Judicial chileno: EN LO PRINCIPAL, PRIMER OTROSÍ, SEGUNDO OTROSÍ.
2. ENCABEZADO: Incluye S.J.L. (Señor Juez Letrado), identificación del tribunal (si se proporciona), RIT/ROL, y carátula.
3. FIRMA: Incluye espacio para firma del abogado patrocinante con nombre, RUT y cédula profesional.
4. FUNDAMENTACIÓN JURÍDICA: Cita artículos exactos del código correspondiente (CPC, Código del Trabajo, Ley 19.968, CPP, Ley 18.287, etc.).
5. CERO ALUCINACIONES: No inventes jurisprudencia ni números de rol. Si no tienes un dato, usa [COMPLETAR] como marcador.
6. PATROCINIO Y PODER: Incluye la cláusula estándar de patrocinio y poder según Ley 18.120.
7. DESCARGO: Al final del documento incluye la advertencia de que este es un modelo generado por IA que debe ser revisado y firmado por un abogado habilitado.

Responde ÚNICAMENTE con el documento legal redactado en markdown, sin comentarios adicionales ni introducciones.`;

// ========== DOCUMENT GENERATION ENDPOINT ==========
app.post("/api/generate-document", async (req, res) => {
  try {
    const { templateId, caseData } = req.body;

    if (!templateId || !caseData) {
      return res.status(400).json({ error: "templateId y caseData son requeridos" });
    }

    // Rate limiting
    const ip = getClientIp(req.headers as Record<string, string | string[] | undefined>);
    const rl = checkRateLimit(`generate-doc:${ip}`, ANALYZE_RATE_LIMIT);
    if (!rl.allowed) {
      return res.status(429).json({
        error: "Demasiadas solicitudes. Intenta en unos segundos.",
        retryAfter: Math.ceil(rl.resetMs / 1000),
      });
    }

    const ai = getGeminiClient();

    const templatePrompts: Record<string, string> = {
      contestacion_civil: `Redacta una CONTESTACIÓN DE DEMANDA CIVIL en formato PJUD. 
DATOS: Demandante: ${caseData.demandante || "[COMPLETAR]"}, Demandado: ${caseData.demandado || "[COMPLETAR]"}, Tribunal: ${caseData.tribunal || "[COMPLETAR]"}, ROL: ${caseData.rol || "[COMPLETAR]"}.
Incluye: personería, opone excepciones dilatorias y perentorias, controvierte los hechos uno a uno, ofrece medios de prueba, y solicita rechazo total de la demanda con costas. Cita artículos del CPC.`,

      oposicion_ejecutivo: `Redacta una OPOSICIÓN DE EXCEPCIONES A LA EJECUCIÓN (Art. 464 CPC) en formato PJUD.
DATOS: Ejecutado: ${caseData.nombre || "[COMPLETAR]"}, Ejecutante: ${caseData.demandante || "[COMPLETAR]"}, Tribunal: ${caseData.tribunal || "[COMPLETAR]"}, ROL: ${caseData.rol || "[COMPLETAR]"}, Monto: ${caseData.materia || "[COMPLETAR]"}.
Opón al menos 3 excepciones del Art. 464 CPC (pago, prescripción, falsedad del título, etc.), ofrece prueba documental y solicita el rechazo de la ejecución con costas.`,

      demanda_despido: `Redacta una DEMANDA POR DESPIDO INJUSTIFICADO EN SEDE LABORAL en formato PJUD.
DATOS: Trabajador: ${caseData.nombre || "[COMPLETAR]"}, Empleador: ${caseData.demandado || "[COMPLETAR]"}, Tribunal: ${caseData.tribunal || "[COMPLETAR]"}.
Incluye: relación circunstanciada de los hechos, fecha de inicio y término, causal invocada, razones por las que es injustificada, solicitud de indemnización sustitutiva del aviso previo, indemnización por años de servicio con recargo legal, feriado proporcional, y tutela laboral si corresponde. Cita Código del Trabajo Arts. 162, 163, 168, 485 y siguientes.`,

      demanda_alimentos: `Redacta una DEMANDA DE ALIMENTOS en formato PJUD para Juzgado de Familia.
DATOS: Demandante: ${caseData.nombre || "[COMPLETAR]"}, Demandado: ${caseData.demandado || "[COMPLETAR]"}, Tribunal: ${caseData.tribunal || "[COMPLETAR]"}.
Incluye: individualización de las partes, relación de los hijos, necesidades de los alimentarios, capacidad económica del alimentante, monto solicitado, solicitud de alimentos provisorios (Art. 54 Ley 19.968), y medidas de apremio en caso de incumplimiento. Cita Ley 19.968 y Ley 14.908.`,

      querella_penal: `Redacta una QUERELLA CRIMINAL en formato PJUD ante Juzgado de Garantía.
DATOS: Querellante: ${caseData.nombre || "[COMPLETAR]"}, Querellado: ${caseData.demandado || "[COMPLETAR]"}, Tribunal: ${caseData.tribunal || "[COMPLETAR]"}.
Incluye: individualización del querellante y querellado, relación circunstanciada de los hechos constitutivos de delito, calificación jurídica, participación, diligencias solicitadas al Ministerio Público, y solicitud de diligencias de investigación. Cita artículos del Código Penal y Código Procesal Penal.`,

      recurso_apelacion: `Redacta un RECURSO DE APELACIÓN en formato PJUD ante Corte de Apelaciones.
DATOS: Apelante: ${caseData.nombre || "[COMPLETAR]"}, Tribunal recurrido: ${caseData.tribunal || "[COMPLETAR]"}, ROL: ${caseData.rol || "[COMPLETAR]"}.
Incluye: individualización de la resolución recurrida, fundamentos de hecho y de derecho del recurso, peticiones concretas, y solicitud de elevación del expediente. Cita CPC Arts. 186, 187, 189 y siguientes.`,
    };

    const prompt = templatePrompts[templateId] || templatePrompts.contestacion_civil;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_DOCUMENT_GENERATOR,
        temperature: 0.15,
        maxOutputTokens: 8192,
      },
    });

    const document = response.text || "Error generando el documento. Por favor intenta nuevamente.";

    res.json({ document, templateId });
  } catch (err: any) {
    console.error("Error en /api/generate-document:", err);
    res.status(500).json({
      error: "Error generando el documento legal: " + (err.message || "Error interno"),
    });
  }
});

// ========== DOCUMENT DOWNLOAD ENDPOINT ==========
app.post("/api/download-document", async (req, res) => {
  try {
    const { content, filename, format } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Contenido del documento requerido" });
    }

    const safeName = (filename || "documento-legal").replace(/[^a-zA-Z0-9_\-áéíóúñ]/g, "_");

    if (format === "txt") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.txt"`);
      return res.send(content);
    }

    // Default: Markdown download
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.md"`);
    return res.send(content);
  } catch (err: any) {
    console.error("Error en /api/download-document:", err);
    res.status(500).json({ error: "Error descargando documento" });
  }
});

// Route to analyze legal case / documents
app.post("/api/analyze", async (req, res) => {
  try {
    const { userStory, documentText, area, files, notificationDate } = req.body;

    if (!userStory && !documentText && (!files || files.length === 0)) {
      return res.status(400).json({
        error: "Debes ingresar al menos el relato de tu caso, el texto del documento o adjuntar una imagen/archivo legal.",
      });
    }

    const ai = getGeminiClient();

    const parts: any[] = [];

    // Add user story and context
    let promptContent = `ÁREA/MATERIA DECLARADA: ${area || "No especificada / A determinar"}\n`;
    if (notificationDate) {
      promptContent += `FECHA DE NOTIFICACIÓN INDICADA POR EL USUARIO: ${notificationDate}\n`;
    }
    promptContent += `\nRELATO O PROBLEMA DEL USUARIO:\n${userStory || "Sin relato textual adicional."}\n\n`;

    if (documentText) {
      promptContent += `TEXTO O DOCUMENTO LEGAL TRANSCRITO/PEGADO:\n${documentText}\n\n`;
    }

    promptContent += `Por favor, como Abogado Litigante Senior en Chile, analiza meticulosamente esta información, determina las consecuencias procesales conforme al Derecho Chileno y genera el diagnóstico con la estructura obligatoria de 5 secciones.`;

    // Process attached base64 files (Word docs, PDFs, images, text)
    if (files && Array.isArray(files)) {
      for (const file of files) {
        if (file.data) {
          const fileName = (file.name || "").toLowerCase();
          const mime = (file.mimeType || "").toLowerCase();
          const isWordDoc =
            mime.includes("word") ||
            mime.includes("officedocument") ||
            mime.includes("msword") ||
            fileName.endsWith(".docx") ||
            fileName.endsWith(".doc");

          if (isWordDoc) {
            try {
              const buffer = Buffer.from(file.data, "base64");
              const result = await mammoth.extractRawText({ buffer });
              const extractedText = result.value;
              if (extractedText && extractedText.trim()) {
                promptContent += `\n\n--- DOCUMENTO WORD ADJUNTADO: ${file.name || "documento.docx"} ---\n${extractedText.trim()}\n`;
              }
            } catch (docxErr) {
              console.error("Error extrayendo texto del archivo Word:", docxErr);
            }
          } else if (mime.startsWith("text/") || fileName.endsWith(".txt") || fileName.endsWith(".rtf")) {
            try {
              const textContent = Buffer.from(file.data, "base64").toString("utf-8");
              if (textContent && textContent.trim()) {
                promptContent += `\n\n--- DOCUMENTO TEXTO ADJUNTADO: ${file.name || "archivo.txt"} ---\n${textContent.trim()}\n`;
              }
            } catch (txtErr) {
              console.error("Error leyendo texto adjunto:", txtErr);
            }
          } else {
            // PDF or Image native Gemini inlineData
            const safeMime = mime || (fileName.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
            parts.push({
              inlineData: {
                mimeType: safeMime,
                data: file.data,
              },
            });
          }
        }
      }
    }

    parts.push({ text: promptContent });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_LAWYER,
        temperature: 0.2, // Low temperature for high precision legal facts
      },
    });

    const analysis = response.text || "No se pudo generar el análisis legal. Por favor intenta nuevamente.";

    res.json({ analysis });
  } catch (err: any) {
    console.error("Error en /api/analyze:", err);
    res.status(500).json({
      error: "Error procesando el análisis legal: " + (err.message || "Error interno del servidor"),
    });
  }
});

// Follow-up chat endpoint for asking specific legal questions about the case
app.post("/api/chat", async (req, res) => {
  try {
    const { history, userMessage, currentCaseContext } = req.body;

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Mensaje de usuario requerido." });
    }

    const ai = getGeminiClient();

    const contents: any[] = [];

    // Filter and sanitize past history to ensure strict alternating roles
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (!msg.content || typeof msg.content !== "string") continue;
        const role = msg.role === "user" ? "user" : "model";
        // Do not add if it repeats the exact same role as the previous element
        if (contents.length === 0 || contents[contents.length - 1].role !== role) {
          contents.push({ role, parts: [{ text: msg.content }] });
        }
      }
    }

    // Ensure history does not end with a 'user' turn before pushing the current user prompt
    if (contents.length > 0 && contents[contents.length - 1].role === "user") {
      contents.pop();
    }

    let fullPrompt = "";
    if (currentCaseContext) {
      fullPrompt += `[CONTEXTO DEL CASO Y DIAGNÓSTICO EN OBSERVACIÓN]:\n${currentCaseContext}\n\n`;
    }
    fullPrompt += `[CONSULTA DEL CLIENTE SOBRE SU CASO]:\n${userMessage}`;

    contents.push({ role: "user", parts: [{ text: fullPrompt }] });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        systemInstruction:
          SYSTEM_INSTRUCTION_LAWYER +
          "\n\nInstrucción adicional para el chat de consultas: El cliente está haciendo una pregunta específica de orientación legal sobre su caso o sobre el diagnóstico preliminar. Responde de forma clara, precisa, tranquilizadora y fundada en el derecho chileno.",
        temperature: 0.3,
      },
    });

    const reply =
      response.text ||
      "Estimado cliente, conforme a la legislación procesal chilena y los antecedentes aportados, le sugiero verificar la fecha exacta de notificación y revisar las actuaciones en la Oficina Judicial Virtual (OJV).";
    res.json({ reply });
  } catch (err: any) {
    console.error("Error en /api/chat:", err);
    res.status(500).json({
      error: "Error procesando la consulta: " + (err.message || "Error interno del servidor"),
    });
  }
});

// MercadoPago Integration Endpoints (reference: legalhelp-chile)
app.post("/api/payment/create", async (req, res) => {
  try {
    const { name, rut, email, amount = 9990, title = "Dictamen Técnico Legal Completo" } = req.body;
    const orderId = crypto.randomUUID();

    // Determine correct public base URL from request or environment
    const host = req.get("host") || "localhost:3000";
    const proto = req.get("x-forwarded-proto") || (req.secure ? "https" : "http");
    const scheme = (proto === "https" || !host.includes("localhost")) ? "https" : "http";

    let baseUrl = process.env.APP_URL;
    if (!baseUrl || baseUrl.includes("localhost")) {
      const origin = req.get("origin") || req.get("referer");
      if (origin && !origin.includes("localhost")) {
        baseUrl = origin.replace(/\/$/, "");
      } else {
        baseUrl = `${scheme}://${host}`;
      }
    }

    const payerEmail = typeof email === "string" && email.includes("@") ? email : undefined;

    if (mp && isMpConfigured) {
      try {
        const preferenceBody: any = {
          external_reference: orderId,
          items: [
            {
              id: "dictamen-completo",
              title: `${title} - LegalHelp Chile`,
              quantity: 1,
              unit_price: Number(amount),
              currency_id: "CLP",
            },
          ],
          ...(payerEmail ? { payer: { email: payerEmail } } : {}),
          back_urls: {
            success: `${baseUrl}/?payment=success&orderId=${orderId}`,
            failure: `${baseUrl}/?payment=failure&orderId=${orderId}`,
            pending: `${baseUrl}/?payment=pending&orderId=${orderId}`,
          },
          binary_mode: true,
          auto_return: "approved",
          statement_descriptor: "LegalHelp",
          payment_methods: {
            installments: 1,
            default_installments: 1,
          },
        };

        // MercadoPago requires notification_url to be HTTPS
        if (baseUrl.startsWith("https://")) {
          preferenceBody.notification_url = `${baseUrl}/api/payment/webhook`;
        }

        console.log("Creating MP Preference with body:", JSON.stringify(preferenceBody, null, 2));
        const preference = await new Preference(mp).create({ body: preferenceBody });

        saveOrder({
          orderId,
          preferenceId: preference.id!,
          status: "pending",
          amount: Number(amount),
          title,
          payerEmail,
          createdAt: Date.now(),
        });

        const checkoutUrl = isSandbox
          ? (preference.sandbox_init_point || preference.init_point)
          : preference.init_point;

        return res.json({
          ok: true,
          orderId,
          preferenceId: preference.id,
          checkoutUrl,
          isRealMP: true,
        });
      } catch (mpErr: any) {
        console.error("Error al crear preferencia en MercadoPago SDK:", mpErr?.message || mpErr);
        if (mpErr?.cause) console.error("mpErr cause:", JSON.stringify(mpErr.cause));
        if (mpErr?.status) console.error("mpErr status:", mpErr.status);
        return res.status(500).json({
          ok: false,
          error: "Error creando preferencia en MercadoPago",
          detail: mpErr?.message || String(mpErr),
          cause: mpErr?.cause || null,
        });
      }
    }

    // Fallback order saving if MP token is not provided in environment or during test mode
    saveOrder({
      orderId,
      preferenceId: `pref-${orderId}`,
      status: "pending",
      amount: Number(amount),
      title,
      payerEmail,
      createdAt: Date.now(),
    });

    return res.json({
      ok: true,
      orderId,
      preferenceId: `pref-${orderId}`,
      checkoutUrl: null,
      isRealMP: false,
      message: "MercadoPago simulado listo para confirmación previa a producción.",
    });

  } catch (err: any) {
    console.error("Error en /api/payment/create:", err);
    res.status(500).json({ error: "Error iniciando pago con MercadoPago: " + (err.message || String(err)) });
  }
});

// GET /api/payment/status?orderId=xxx
app.get("/api/payment/status", async (req, res) => {
  const orderId = req.query.orderId as string;
  if (!orderId) {
    return res.status(400).json({ error: "orderId es requerido" });
  }

  const order = getOrderByOrderId(orderId);
  if (!order) {
    return res.status(404).json({ error: "Orden no encontrada" });
  }

  if (order.status !== "pending") {
    return res.json({
      orderId: order.orderId,
      status: order.status,
      paidAt: order.paidAt || null,
    });
  }

  // Fallback direct check to Mercado Pago API using external_reference
  if (isMpConfigured && mpAccessToken) {
    try {
      const searchRes = await fetch(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${orderId}&sort=date_created&criteria=desc&limit=1`,
        {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = searchData.results;
        if (results && results.length > 0) {
          const paymentItem = results[0];
          if (paymentItem.status === "approved") {
            updateOrder(orderId, {
              status: "approved",
              mpPaymentId: String(paymentItem.id),
              paidAt: Date.now(),
            });
            return res.json({ orderId, status: "approved", paidAt: Date.now() });
          } else if (paymentItem.status === "rejected") {
            updateOrder(orderId, { status: "failed" });
            return res.json({ orderId, status: "failed" });
          }
        }
      }
    } catch (e) {
      console.error("Error verificando pago en MP API:", e);
    }
  }

  return res.json({
    orderId: order.orderId,
    status: order.status,
    paidAt: order.paidAt || null,
  });
});

// Webhook endpoint for MercadoPago IPN notifications
app.post("/api/payment/webhook", async (req, res) => {
  try {
    const body = req.body || {};
    const type = body.type || req.query.topic;
    const rawId = body.data?.id || req.query.id;

    if (type !== "payment" || !rawId) {
      return res.json({ ok: true });
    }

    const paymentId = String(rawId);
    if (mp && isMpConfigured) {
      const paymentData = await new Payment(mp).get({ id: paymentId });
      const status = paymentData.status;
      const externalRef = paymentData.external_reference;

      if (externalRef) {
        if (status === "approved") {
          updateOrder(externalRef, {
            status: "approved",
            mpPaymentId: paymentId,
            paidAt: Date.now(),
          });
        } else if (status === "rejected" || status === "cancelled") {
          updateOrder(externalRef, { status: "failed" });
        }
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error en webhook de MercadoPago:", err);
    return res.json({ ok: true });
  }
});

// Test/Instant approval endpoint for developer mode / instant checkout fallback
app.post("/api/payment/confirm-test", (req, res) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: "orderId requerido" });
  }
  const updated = updateOrder(orderId, { status: "approved", paidAt: Date.now() });
  return res.json({ ok: true, order: updated });
});

// ========== SEO LANDING PAGES (Long-Tail) ==========
function renderSEOPage(page: typeof ALL_SEO_PAGES[0]) {
  const roleLabel = page.role === 'demandante' ? 'Quiero demandar' : page.role === 'demandado' ? 'Me demandaron' : 'Consulta legal';
  const roleColor = page.role === 'demandante' ? '#2563eb' : page.role === 'demandado' ? '#dc2626' : '#0891b2';
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  const faqSchema = page.faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }));
  const related = getRelatedPages(page);
  const pageDate = process.env.SEO_PAGE_DATE || "2026-08-01";

  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.titleSEO}</title>
  <meta name="description" content="${page.metaDescription}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}${page.slug}" />
  <meta property="og:locale" content="es_CL" />
  <meta property="og:title" content="${page.titleSEO}" />
  <meta property="og:description" content="${page.metaDescription}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}${page.slug}" />
  <meta property="og:site_name" content="LegalHelp Chile" />
  <meta property="og:image" content="${baseUrl}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${page.titleSEO}" />
  <meta name="twitter:description" content="${page.metaDescription}" />
  <meta name="twitter:image" content="${baseUrl}/og-image.png" />
  <script type="application/ld+json">
  [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "${page.titleSEO}",
    "url": "${baseUrl}${page.slug}",
    "description": "${page.metaDescription}",
    "inLanguage": "es-CL",
    "isPartOf": { "@type": "WebSite", "name": "LegalHelp Chile", "url": "${baseUrl}/" },
    "datePublished": "${pageDate}",
    "dateModified": "${pageDate}",
    "author": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" },
    "publisher": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" }
  },
  {
    "@context": "https://schema.org",
    "@type": "LegalService",
    "name": "LegalHelp Chile",
    "description": "${page.metaDescription}",
    "areaServed": { "@type": "Country", "name": "Chile" },
    "serviceType": "Orientación Legal con IA",
    "provider": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" },
    "url": "${baseUrl}${page.slug}"
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": ${JSON.stringify(faqSchema)}
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "${baseUrl}/" },
      { "@type": "ListItem", "position": 2, "name": "${page.h1}", "item": "${baseUrl}${page.slug}" }
    ]
  }
  ]
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.6; }
    .nav-bar { background: #0b1f3a; padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
    .nav-bar .logo { color: #fff; font-weight: 800; font-size: 18px; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-bar .logo span.blue { color: #60a5fa; }
    .main-wrap { max-width: 820px; margin: 0 auto; padding: 40px 20px 60px; }
    .breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .breadcrumb a { color: #64748b; text-decoration: none; }
    .breadcrumb a:hover { color: #0f172a; }
    .role-badge { display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
    h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; margin-bottom: 24px; line-height: 1.2; }
    .section-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; }
    .diagnos-text { font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 28px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; }
    .cta-box { background: #2563eb; color: #fff; border-radius: 12px; padding: 18px 24px; text-align: center; margin-bottom: 32px; display: block; text-decoration: none; font-weight: 700; font-size: 15px; transition: background 0.15s; box-shadow: 0 4px 14px rgba(37,99,235,0.25); }
    .cta-box:hover { background: #1d4ed8; }
    .cta-box .arrow { display: inline-block; margin-left: 6px; transition: transform 0.15s; }
    .cta-box:hover .arrow { transform: translateX(3px); }
    .bullets { list-style: none; margin-bottom: 36px; }
    .bullets li { padding: 10px 0 10px 28px; position: relative; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9; line-height: 1.6; }
    .bullets li::before { content: '•'; position: absolute; left: 8px; color: #2563eb; font-weight: 700; }
    .faq-section { margin-top: 36px; }
    .faq-section h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
    .faq-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 10px; }
    .faq-item .q { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .faq-item .a { font-size: 13px; color: #475569; line-height: 1.6; }
    .footer-bar { border-top: 1px solid #e2e8f0; padding: 24px 20px; text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px; }
    .footer-bar strong { color: #64748b; }
    @media (max-width: 640px) { h1 { font-size: 1.5rem; } .main-wrap { padding: 24px 16px 40px; } }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <span style="font-size:22px;">⚖️</span>
    <a href="/" class="logo">Diagnóstico<span class="blue">Legal</span> Chile</a>
  </nav>
  <main class="main-wrap">
    <div class="breadcrumb"><a href="/">Inicio</a> &rsaquo; ${page.caseType === 'arriendo' ? 'Arriendo' : page.caseType === 'laboral' ? 'Laboral' : page.caseType === 'deuda' ? 'Deudas' : page.caseType === 'civil' ? 'Civil' : page.caseType === 'familia' ? 'Familia' : page.caseType === 'penal' ? 'Penal' : 'Legal'}</div>
    <span class="role-badge" style="background:${roleColor}15;color:${roleColor}">${roleLabel}</span>
    <h1>${page.h1}</h1>
    <p class="section-label">Diagnóstico del caso</p>
    <div class="diagnos-text">${page.diagnosText}</div>
    <a href="/" class="cta-box">${page.ctaText} <span class="arrow">→</span></a>
    <ul class="bullets">
      ${page.bullets.map(b => `<li>${b}</li>`).join('')}
    </ul>
    <section class="faq-section">
      <h2>Preguntas frecuentes</h2>
      ${page.faqs.map(f => `<div class="faq-item"><p class="q">${f.q}</p><p class="a">${f.a}</p></div>`).join('')}
    </section>
    ${related.length > 0 ? `<section style="margin-top:36px;"><h2 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;color:#0f172a;">Casos relacionados</h2><div style="display:flex;flex-wrap:wrap;gap:8px;">${related.map(r => `<a href="${r.slug}" style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;text-decoration:none;">${r.h1}</a>`).join('')}</div></section>` : ''}
    <div class="footer-bar">
      <p><strong>LegalHelp Chile</strong> &mdash; Diagnóstico Legal Chile, herramienta de orientación legal adaptada a la legislación chilena.</p>
      <p style="margin-top:4px;">No constituye asesoría legal formal. Consulta con un abogado habilitado (Ley 18.120).</p>
    </div>
  </main>
</body>
</html>`;
}

function getRelatedPages(page: typeof ALL_SEO_PAGES[0]) {
  const sameType = ALL_SEO_PAGES.filter(p => p.slug !== page.slug && p.caseType === page.caseType);
  const crossType = ALL_SEO_PAGES.filter(p => p.slug !== page.slug && p.caseType !== page.caseType);
  const order = (a: typeof ALL_SEO_PAGES[0], b: typeof ALL_SEO_PAGES[0]) => {
    const aHub = a.slug.includes('abogado') ? 0 : 1;
    const bHub = b.slug.includes('abogado') ? 0 : 1;
    return aHub - bHub || a.slug.localeCompare(b.slug);
  };
  return [...sameType.sort(order).slice(0, 6), ...crossType.sort(order).slice(0, 4)]
    .map(p => ({ slug: p.slug, h1: p.h1 }));
}

// Página hub de herramientas
function renderHerramientasPage() {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Herramientas Legales Gratis Chile 2026 | Calculadoras y Verificadores</title>
  <meta name="description" content="Herramientas legales gratis para Chile: calculadora de prescripción de multas, calculadora de condonación 80%, verificador de multas TAG. Actualizado 2026." />
  <link rel="canonical" href="${baseUrl}/herramientas" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Herramientas Legales Gratis Chile 2026",
    "url": "${baseUrl}/herramientas",
    "description": "Herramientas legales gratis para Chile: calculadoras de prescripción y condonación de multas TAG.",
    "isPartOf": { "@type": "WebSite", "name": "LegalHelp Chile", "url": "${baseUrl}/" }
  }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.6; }
    .nav-bar { background: #0b1f3a; padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
    .nav-bar .logo { color: #fff; font-weight: 800; font-size: 18px; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-bar .logo span.blue { color: #60a5fa; }
    .main-wrap { max-width: 820px; margin: 0 auto; padding: 40px 20px 60px; }
    .breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .breadcrumb a { color: #64748b; text-decoration: none; }
    h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 12px; line-height: 1.2; }
    .subtitle { font-size: 15px; color: #475569; margin-bottom: 32px; }
    .tools-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 36px; }
    .tool-card { background: #fff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 28px; transition: border-color 0.15s, box-shadow 0.15s; }
    .tool-card:hover { border-color: #2563eb; box-shadow: 0 4px 20px rgba(37,99,235,0.1); }
    .tool-card .icon { font-size: 2rem; margin-bottom: 12px; }
    .tool-card h2 { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .tool-card p { font-size: 14px; color: #475569; margin-bottom: 16px; line-height: 1.6; }
    .tool-card .btn { display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; transition: background 0.15s; }
    .tool-card .btn:hover { background: #1d4ed8; }
    .info-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-top: 28px; }
    .info-box h2 { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .info-box p { font-size: 14px; color: #475569; line-height: 1.7; margin-bottom: 12px; }
    .info-box ul { margin-left: 20px; margin-bottom: 12px; }
    .info-box li { font-size: 14px; color: #475569; margin-bottom: 6px; line-height: 1.6; }
    .cta-whatsapp { display: block; background: #25d366; color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; margin-top: 16px; transition: background 0.15s; }
    .cta-whatsapp:hover { background: #1fb855; }
    .footer-bar { border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px; }
    .footer-bar strong { color: #64748b; }
    @media (max-width: 640px) { h1 { font-size: 1.5rem; } .main-wrap { padding: 24px 16px 40px; } .tools-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <span style="font-size:22px;">⚖️</span>
    <a href="/" class="logo">Diagnóstico<span class="blue">Legal</span> Chile</a>
  </nav>
  <main class="main-wrap">
    <div class="breadcrumb"><a href="/">Inicio</a> &rsaquo; Herramientas</div>
    <h1>Herramientas Legales Gratis Chile 2026</h1>
    <p class="subtitle">Calculadoras, verificadores y herramientas legales para resolver tus problemas con multas de tránsito y TAG en Chile.</p>

    <div class="tools-grid">
      <div class="tool-card">
        <div class="icon">⏳</div>
        <h2>Calculadora de Prescripción de Multas</h2>
        <p>¿Tu multa TAG ya prescribió? Ingresa la fecha de anotación y te decimos si puedes eliminarla legalmente.</p>
        <a href="/calculadora-prescripcion-multas" class="btn">Calcular Prescripción →</a>
      </div>
      <div class="tool-card">
        <div class="icon">💰</div>
        <h2>Calculadora de Condonación 80%</h2>
        <p>¿Cuánto pagas con el 80% de descuento? Ingresa el monto original y descubre tu precio final.</p>
        <a href="/calculadora-condonacion-multas" class="btn">Calcular Descuento →</a>
      </div>
    </div>

    <div class="info-box">
      <h2>¿Qué hacer con tus multas TAG?</h2>
      <p>Si tienes multas de tránsito o TAG pendientes, tienes opciones:</p>
      <ul>
        <li><strong>Prescripción:</strong> Si han pasado más de 12 meses desde la anotación, tu multa prescribió y puedes eliminarla</li>
        <li><strong>Condonación 80%:</strong> Si pagas antes del 30 de septiembre de 2026, solo pagas el 20%</li>
        <li><strong>Defensa técnica:</strong> Si la multa tiene errores administrativos, puedes impugnarla</li>
      </ul>
      <p>Nuestro equipo de abogados puede ayudarte con el proceso completo.</p>
      <a href="https://wa.me/56967658939?text=Hola%2C+necesito+ayuda+con+mis+multas+TAG" class="cta-whatsapp" target="_blank">💬 Consultar Gratis por WhatsApp</a>
    </div>

    <div class="footer-bar">
      <p><strong>LegalHelp Chile</strong> &mdash; Herramientas legales adaptadas a la legislación chilena vigente.</p>
      <p style="margin-top:4px;">No constituye asesoría legal formal. Consulta con un abogado habilitado (Ley 18.120).</p>
    </div>
  </main>
</body>
</html>`;
}

// Calculadoras interactivas (prescripción y condonación)
function renderCalculatorPage(calc: { slug: string; titleSEO: string; metaDescription: string; h1: string; description: string }) {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  const pageDate = process.env.SEO_PAGE_DATE || "2026-09-01";
  const isPrescripcion = calc.slug.includes('prescripcion');
  const calculatorJS = isPrescripcion ? `
<script>
function calcularPrescripcion() {
  const input = document.getElementById('fecha-anotacion');
  const resultado = document.getElementById('resultado');
  const error = document.getElementById('error-msg');
  if (!input.value) { error.textContent = 'Selecciona la fecha de anotación'; resultado.innerHTML = ''; return; }
  error.textContent = '';
  const fechaAnotacion = new Date(input.value);
  const hoy = new Date();
  const diffMs = hoy - fechaAnotacion;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffAnios = diffDias / 365.25;
  const prescrita = diffAnios >= 1;
  const diasRestantes = prescrita ? 0 : Math.ceil((365.25 - diffDias));
  const mesesRestantes = Math.floor(diasRestantes / 30);
  const diasFinales = diasRestantes % 30;
  if (prescrita) {
    resultado.innerHTML = '<div class="result-box result-green"><h3>✅ Tu multa YA PRESCRIBIÓ</h3><p>Desde el ' + fechaAnotacion.toLocaleDateString('es-CL') + ' han pasado <strong>' + Math.floor(diffAnios) + ' años</strong>.</p><p>Según el art. 2497 del Código Civil chileno, tu multa prescribió el <strong>' + new Date(fechaAnotacion.getTime() + 365.25*24*60*60*1000).toLocaleDateString('es-CL') + '</strong>.</p><p><strong>Puedes solicitar la eliminación de esta multa.</strong></p><a href="https://wa.me/56967658939?text=Hola%2C+mi+multa+TAG+ya+prescribió.+Fecha+de+anotaci%C3%B3n%3A+' + input.value + '" class="cta-whatsapp" target="_blank">💬 Consultar Gratis por WhatsApp</a></div>';
  } else {
    resultado.innerHTML = '<div class="result-box result-yellow"><h3>⏳ Tu multa AÚN NO prescribe</h3><p>Desde el ' + fechaAnotacion.toLocaleDateString('es-CL') + ' han pasado <strong>' + Math.floor(diffAnios) + ' años y ' + Math.floor((diffAnios % 1) * 12) + ' meses</strong>.</p><p>Tu multa prescribirá el <strong>' + new Date(fechaAnotacion.getTime() + 365.25*24*60*60*1000).toLocaleDateString('es-CL') + '</strong>.</p><p><strong>Faltan ' + mesesRestantes + ' meses y ' + diasFinales + ' días.</strong></p><a href="https://wa.me/56967658939?text=Hola%2C+quiero+saber+cuando+prescribe+mi+multa+TAG.+Fecha%3A+' + input.value + '" class="cta-whatsapp" target="_blank">💬 Consultar Gratis por WhatsApp</a></div>';
  }
}
</script>` : `
<script>
function calcularCondonacion() {
  const input = document.getElementById('monto-original');
  const resultado = document.getElementById('resultado');
  const error = document.getElementById('error-msg');
  if (!input.value || parseFloat(input.value) <= 0) { error.textContent = 'Ingresa un monto válido'; resultado.innerHTML = ''; return; }
  error.textContent = '';
  const monto = parseFloat(input.value);
  const descuento = monto * 0.8;
  const final = monto * 0.2;
  const ahorro = descuento;
  resultado.innerHTML = '<div class="result-box result-green"><h3>💰 Con el 80% de descuento pagas</h3><div class="monto-final">$' + Math.round(final).toLocaleString('es-CL') + ' CLP</div><div class="detail-row"><span>Monto original:</span><span>$' + monto.toLocaleString('es-CL') + '</span></div><div class="detail-row"><span>Descuento (80%):</span><span class="ahorro">-$' + Math.round(ahorro).toLocaleString('es-CL') + '</span></div><div class="detail-row"><span>Fecha límite:</span><span>30 de septiembre 2026</span></div><p style="margin-top:16px;font-size:13px;color:#475569;">El 80% de descuento se aplica al valor total de la multa. Solo pagas el 20% restante.</p><a href="https://wa.me/56967658939?text=Hola%2C+quiero+aplicar+el+80%25+de+condonaci%C3%B3n+de+mi+multa+TAG.+Monto%3A+$' + monto + '" class="cta-whatsapp" target="_blank">💬 Aplicar Descuento por WhatsApp</a></div>';
}
</script>`;

  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${calc.titleSEO}</title>
  <meta name="description" content="${calc.metaDescription}" />
  <link rel="canonical" href="${baseUrl}${calc.slug}" />
  <meta property="og:title" content="${calc.titleSEO}" />
  <meta property="og:description" content="${calc.metaDescription}" />
  <meta property="og:url" content="${baseUrl}${calc.slug}" />
  <meta property="og:type" content="website" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "${calc.h1}",
    "operatingSystem": "Web",
    "applicationCategory": "LegalApplication",
    "url": "${baseUrl}${calc.slug}",
    "description": "${calc.metaDescription}",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CLP" },
    "datePublished": "${pageDate}",
    "dateModified": "${pageDate}",
    "provider": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" }
  }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.6; }
    .nav-bar { background: #0b1f3a; padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
    .nav-bar .logo { color: #fff; font-weight: 800; font-size: 18px; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-bar .logo span.blue { color: #60a5fa; }
    .main-wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px 60px; }
    .breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .breadcrumb a { color: #64748b; text-decoration: none; }
    h1 { font-size: 1.8rem; font-weight: 800; color: #0f172a; margin-bottom: 12px; line-height: 1.2; }
    .subtitle { font-size: 15px; color: #475569; margin-bottom: 28px; }
    .calc-box { background: #fff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 28px; margin-bottom: 28px; }
    .calc-box label { display: block; font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 8px; }
    .calc-box input { width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; margin-bottom: 8px; transition: border-color 0.15s; }
    .calc-box input:focus { outline: none; border-color: #2563eb; }
    .error-msg { color: #dc2626; font-size: 13px; margin-bottom: 12px; min-height: 20px; }
    .btn-calc { width: 100%; background: #2563eb; color: #fff; border: none; border-radius: 10px; padding: 16px; font-size: 16px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
    .btn-calc:hover { background: #1d4ed8; }
    .result-box { border-radius: 12px; padding: 24px; margin-top: 20px; }
    .result-green { background: #f0fdf4; border: 2px solid #86efac; }
    .result-yellow { background: #fefce8; border: 2px solid #fde047; }
    .result-box h3 { font-size: 18px; margin-bottom: 12px; }
    .result-box p { font-size: 14px; color: #334155; margin-bottom: 8px; }
    .monto-final { font-size: 2.5rem; font-weight: 800; color: #16a34a; margin: 16px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .detail-row .ahorro { color: #16a34a; font-weight: 700; }
    .cta-whatsapp { display: block; background: #25d366; color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; margin-top: 16px; transition: background 0.15s; }
    .cta-whatsapp:hover { background: #1fb855; }
    .info-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-top: 28px; }
    .info-section h2 { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .info-section p { font-size: 14px; color: #475569; margin-bottom: 12px; line-height: 1.7; }
    .info-section ul { margin-left: 20px; margin-bottom: 12px; }
    .info-section li { font-size: 14px; color: #475569; margin-bottom: 6px; line-height: 1.6; }
    .footer-bar { border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px; }
    .footer-bar strong { color: #64748b; }
    @media (max-width: 640px) { h1 { font-size: 1.4rem; } .main-wrap { padding: 24px 16px 40px; } .monto-final { font-size: 2rem; } }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <span style="font-size:22px;">⚖️</span>
    <a href="/" class="logo">Diagnóstico<span class="blue">Legal</span> Chile</a>
  </nav>
  <main class="main-wrap">
    <div class="breadcrumb"><a href="/">Inicio</a> &rsaquo; <a href="/herramientas">Herramientas</a> &rsaquo; ${calc.h1}</div>
    <h1>${calc.h1}</h1>
    <p class="subtitle">${calc.description}</p>

    <div class="calc-box">
      ${isPrescripcion ? `
      <label for="fecha-anotacion">Fecha de anotación de la multa:</label>
      <input type="date" id="fecha-anotacion" />
      <div id="error-msg" class="error-msg"></div>
      <button class="btn-calc" onclick="calcularPrescripcion()">Calcular Prescripción</button>
      ` : `
      <label for="monto-original">Monto original de la multa (CLP):</label>
      <input type="number" id="monto-original" placeholder="Ej: 80000" min="1" />
      <div id="error-msg" class="error-msg"></div>
      <button class="btn-calc" onclick="calcularCondonacion()">Calcular Descuento 80%</button>
      `}
      <div id="resultado"></div>
    </div>

    <div class="info-section">
      ${isPrescripcion ? `
      <h2>¿Cómo funciona la prescripción de multas TAG?</h2>
      <p>Según el art. 2497 del Código Civil chileno, las multas de tránsito prescriben a <strong>1 año</strong> desde su anotación en el Registro de Vehículos Recuperados o en el Registro Nacional de Vehículos Motorizados.</p>
      <ul>
        <li>El plazo de 1 año es improrrogable</li>
        <li>La prescripción se cuenta desde la fecha de anotación, no desde la fecha de la infracción</li>
        <li>Una vez prescrita, la multa no puede ser cobrada</li>
        <li>Puedes solicitar la eliminación ante el Juzgado de Policía Local</li>
      </ul>
      <p><strong>Artículo 2497 del Código Civil:</strong> "Las acciones prescriben por el transcurso del tiempo señalado por la ley."</p>
      <h2 style="margin-top:20px;">¿Qué hacer si tu multa ya prescribió?</h2>
      <ul>
        <li>Obtén el certificado de anotaciones vigentes en <a href="https://www.registrocivil.cl" target="_blank">registrocivil.cl</a></li>
        <li>Identifica la fecha exacta de anotación de cada multa</li>
        <li>Si han pasado más de 12 meses, la multa prescribió</li>
        <li>Presenta un recurso de apelación ante el Juzgado de Policía Local</li>
        <li>O solicita la eliminación directa en la Municipalidad</li>
      </ul>
      ` : `
      <h2>¿Cómo funciona el 80% de condonación de multas TAG?</h2>
      <p>El Decreto Supremo del Ministerio Público de Transito y Telecomunicaciones establece un <strong>80% de descuento</strong> sobre el valor total de multas de tránsito para pagos realizados antes del <strong>30 de septiembre de 2026</strong>.</p>
      <ul>
        <li>El descuento es del 80% sobre el monto original</li>
        <li>Solo pagas el 20% restante</li>
        <li>Aplica a multas de tránsito y TAG</li>
        <li>La fecha límite es el 30 de septiembre de 2026</li>
        <li>Se puede pagar en cualquier Banco o portal de pago autorizado</li>
      </ul>
      <p><strong>Ejemplo:</strong> Si tu multa es de $80.000, con el 80% de descuento pagas solo $16.000.</p>
      <h2 style="margin-top:20px;">¿Cómo aplicar el descuento?</h2>
      <ul>
        <li>Ingresa a <a href="https://consultas.mtt.cl" target="_blank">consultas.mtt.cl</a> con tu RUT</li>
        <li>Selecciona las multas que quieres pagar</li>
        <li>El sistema aplicará automáticamente el 80% de descuento</li>
        <li>Elige el medio de pago y completa la transacción</li>
        <li>Guarda el comprobante de pago</li>
      </ul>
      `}
    </div>

    <div class="info-section" style="margin-top:20px;">
      <h2>¿Necesitas ayuda profesional?</h2>
      <p>Nuestro equipo de abogados puede ayudarte con el proceso completo de prescripción o condonación de multas TAG. Consulta gratis por WhatsApp.</p>
      <a href="https://wa.me/56967658939?text=Hola%2C+necesito+ayuda+con+mis+multas+TAG" class="cta-whatsapp" target="_blank">💬 Consultar Gratis por WhatsApp</a>
    </div>

    <div class="footer-bar">
      <p><strong>LegalHelp Chile</strong> &mdash; Herramienta de orientación legal adaptada a la legislación chilena vigente.</p>
      <p style="margin-top:4px;">No constituye asesoría legal formal. Consulta con un abogado habilitado (Ley 18.120).</p>
    </div>
  </main>
  ${calculatorJS}
</body>
</html>`;
}

// Homepage SSR: static crawlable content inside #root (React replaces it on hydration)
function serveHomePage(_req: express.Request, res: express.Response) {
  const indexPath = path.join(distPath, "index.html");
  const html = fs.readFileSync(indexPath, "utf-8");
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  const content = renderHomeContent(baseUrl);
  const withContent = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(withContent);
}

// Renderiza página de prescripción por comuna (pSEO anti-thin content)
function renderTribunalPage(comuna: typeof COMUNAS_RM[0]) {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  const slug = `/prescripcion-multas/${comuna.slug}`;
  const titleSEO = `Prescripción de Multas y TAG en ${comuna.comuna} | LegalHelp Chile`;
  const metaDescription = `Prescripción de multas y TAG en ${comuna.comuna}. JPLs: ${comuna.juzgados.map(j => j.nombre).join(', ')}. Canal: ${comuna.juzgados[0].canalIngreso}. Escrito $25.000. Consulta gratis.`;
  const h1 = `Prescripción de Multas y TAG en ${comuna.comuna}: Trámite ante ${comuna.juzgados[0].nombre}`;
  const pageDate = process.env.SEO_PAGE_DATE || "2026-08-01";

  // Detectar tipo de canal principal
  const canales = comuna.juzgados.map(j => j.canalIngreso);
  const tieneOnline = canales.includes('ONLINE');
  const tienePresencial = canales.includes('PRESENCIAL');
  const tieneHibrido = canales.includes('HÍBRIDO');

  // Generar contenido único según tipo de canal
  let canalBloque = '';
  let procesoPasos = '';
  let erroresComunes = '';
  let faqEspecificas: { q: string; a: string }[] = [];

  if (tieneOnline && !tienePresencial) {
    // Todas las jpl son ONLINE
    canalBloque = `
      <h2>Cómo Presentar tu Escrito de Prescripción en ${comuna.comuna}</h2>
      <p>Los Juzgados de Policía Local de ${comuna.comuna} aceptan escritos de prescripción <strong>exclusivamente por vía digital</strong>. Esto significa que no necesitas acudir presencialmente al tribunal.</p>
      <p>Para presentar tu escrito, debes utilizar la plataforma oficial que cada JPL habilita. En el caso del ${comuna.juzgados[0].nombre}, el canal de ingreso es ${comuna.juzgados[0].detalleCanal.toLowerCase()}.</p>
      <h3>Requisitos para el canal digital</h3>
      <ul>
        <li><strong>Firma electrónica:</strong> Debes contar con firma electrónica avanzada o certificado digital vigente. La firma simple no es aceptada para escritos de prescripción.</li>
        <li><strong>Formato del escrito:</strong> El documento debe estar en formato PDF con firma electrónica incluida. No se aceptan archivos Word ni imágenes.</li>
        <li><strong>Plataforma:</strong> ${comuna.juzgados[0].correo.startsWith('http') ? 'Utiliza la plataforma de Clave Única (claveunica.gob.cl)' : `Envía tu escrito a la dirección de correo electrónico: ${comuna.juzgados[0].correo}`}</li>
        <li><strong>Confirmación:</strong> Después de enviar, debes conservar el comprobante de envío y la respuesta de recepción del tribunal.</li>
      </ul>`;
    procesoPasos = `
      <h2>Proceso de Prescripción de Multas en ${comuna.comuna} (Canal Digital)</h2>
      <ol>
        <li><strong>Verifica tus multas:</strong> Ingresa a la página de la Juzgado de Policía Local de ${comuna.comuna} con tu RUT y revisa las multas vigentes associadas a tu patente o RUT de conductor.</li>
        <li><strong>Identifica las prescribibles:</strong> Las multas de tránsito prescriben a 1 año desde la fecha de la infracción. Las multas de TAG (autopista) prescriben a 3 años. Las de permiso de circulación prescriben a 3 años.</li>
        <li><strong>Redacta tu escrito:</strong> El escrito debe indicar: tu nombre completo, RUT, patente del vehículo, número de la multa, fecha de la infracción y la causal de prescripción (Art. 24 Ley 18.287).</li>
        <li><strong>Firma electrónicamente:</strong> Utiliza tu certificado digital o firma electrónica avanzada para firmar el documento PDF.</li>
        <li><strong>Envía por la plataforma:</strong> ${comuna.juzgados[0].correo.startsWith('http') ? 'Ingresa a la plataforma de Clave Única y sube tu escrito firmado' : 'Envía tu escrito a ' + comuna.juzgados[0].correo + ' con el asunto "Solicitud de Prescripción de Multa"'}</li>
        <li><strong>Guarda el comprobante:</strong> Descarga o captura el comprobante de envío y la respuesta de recepción del tribunal.</li>
        <li><strong>Espera la resolución:</strong> El juez resolverá tu solicitud en un plazo de 1 a 3 meses. Si es favorable, la multa quedará prescrita y no podrás ser ejecutada.</li>
      </ol>`;
    erroresComunes = `
      <h2>Errores Comunes al Prescribir Multas en ${comuna.comuna}</h2>
      <ul>
        <li><strong>Enviar sin firma electrónica:</strong> El escrito será rechazado si no tiene firma electrónica avanzada. La firma manuscrita escaneada no es válida.</li>
        <li><strong>No verificar la prescripción:</strong> Si la multa aún no ha cumplido el plazo de prescripción (1 año para tránsito, 3 años para TAG), el juez rechazará tu solicitud.</li>
        <li><strong>Confundir plazos:</strong> Las multas de tránsito (conductor) prescriben a 1 año. Las de TAG/autopista prescriben a 3 años. No son iguales.</li>
        <li><strong>No adjuntar antecedentes:</strong> Debes adjuntar copia de la multa, tu cédula de identidad y cualquier documento que acredite la fecha de la infracción.</li>
        <li><strong>Enviar al juzgado incorrecto:</strong> Verifica que estás enviando al JPL correcto según la comuna donde se cometió la infracción.</li>
      </ul>`;
    faqEspecificas = [
      { q: `¿Puedo prescribir multas de TAG en ${comuna.comuna} por internet?`, a: `Sí. Los JPL de ${comuna.comuna} aceptan escritos de prescripción por canal digital. Debes enviar tu escrito firmado electrónicamente a la dirección de correo o plataforma habilitada.` },
      { q: `¿Cuánto cuesta prescribir multas en ${comuna.comuna}?`, a: `Nuestro servicio de prescripción tiene un costo de $25.000 CLP por el primer escrito y $5.000 CLP por cada escrito adicional por juzgado. La consulta inicial es gratuita.` },
      { q: `¿Cuánto tarda el proceso de prescripción en ${comuna.comuna}?`, a: `El proceso completo tarda entre 1 y 3 meses desde la presentación del escrito hasta la resolución del juez. El plazo depende de la carga de trabajo del tribunal.` },
      { q: `¿Qué pasa si me rechazan la solicitud de prescripción?`, a: `Si el juez rechaza tu solicitud, puedes apelar dentro de 5 días hábiles. Las causales de rechazo más comunes son: multa no prescrita, escrito sin firma electrónica, o juzgado incorrecto.` },
    ];
  } else if (tienePresencial && !tieneOnline) {
    // Todas las jpl son PRESENCIAL
    canalBloque = `
      <h2>Cómo Presentar tu Escrito de Prescripción en ${comuna.comuna}</h2>
      <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="font-weight:700;color:#92400e;margin-bottom:8px;">⚠️ IMPORTANTE</p>
        <p style="color:#92400e;font-size:14px;">Los Juzgados de Policía Local de ${comuna.comuna} <strong>NO aceptan escritos por correo electrónico</strong>. Debes presentar tu escrito presencialmente en el buzón de partes del tribunal. Enviar por correo resultará en un rechazo automático.</p>
      </div>
      <p>Para prescribir tus multas de tránsito o TAG en ${comuna.comuna}, debes acudir físicamente al Juzgado de Policía Local correspondiente y depositar tu escrito en el buzón de partes.</p>
      <h3>¿Qué necesitas llevar?</h3>
      <ul>
        <li><strong>Escrito impreso:</strong> Tu solicitud de prescripción debe estar en formato papel, firmada a mano. No se aceptan copias digitales.</li>
        <li><strong>Cédula de identidad:</strong> Lleva tu cédula de identidad vigente (original y copia).</li>
        <li><strong>Copia de la multa:</strong> Si tienes la notificación de la multa, adjúntala. Si no la tienes, el juzgado puede consultarla.</li>
        <li><strong>Copia sellada:</strong> Pide que sellen una copia de tu escrito como constancia de presentación.</li>
      </ul>`;
    procesoPasos = `
      <h2>Proceso de Prescripción de Multas en ${comuna.comuna} (Canal Presencial)</h2>
      <ol>
        <li><strong>Verifica tus multas:</strong> Acude al JPL de ${comuna.comuna} o consulta en línea (si tienen portal) para revisar las multas vigentes.</li>
        <li><strong>Identifica las prescribibles:</strong> Las multas de tránsito prescriben a 1 año. Las de TAG prescriben a 3 años. Las de permiso de circulación prescriben a 3 años.</li>
        <li><strong>Redacta tu escrito:</strong> El escrito debe incluir: nombre completo, RUT, patente, número de la multa, fecha de infracción y causal de prescripción (Art. 24 Ley 18.287).</li>
        <li><strong>Imprime y firma:</strong> Imprime tu escrito en papel A4 y fírmalo a mano. No se aceptan firmas digitales en el canal presencial.</li>
        <li><strong>Acude al buzón de partes:</strong> Ve al JPL de ${comuna.comuna} y deposita tu escrito en el buzón de partes. Verifica el horario de atención.</li>
        <li><strong>Pide constancia:</strong> Solicita que sellen una copia de tu escrito como comprobante de presentación.</li>
        <li><strong>Espera la resolución:</strong> El juez resolverá en 1 a 3 meses. Si es favorable, la multa quedará prescrita.</li>
      </ol>`;
    erroresComunes = `
      <h2>Errores Comunes al Prescribir Multas en ${comuna.comuna}</h2>
      <ul>
        <li><strong>Enviar por correo electrónico:</strong> ⚠️ Los JPL de ${comuna.comuna} NO aceptan escritos por correo. Enviar por email resultará en rechazo automático.</li>
        <li><strong>No llevar cédula:</strong> Sin tu cédula de identidad no te recibirán el escrito.</li>
        <li><strong>No pedir sello:</strong> Sin la constancia sellada no tienes prueba de que presentaste el escrito a tiempo.</li>
        <li><strong>Ir fuera de horario:</strong> Verifica los horarios de atención del buzón de partes antes de acudir.</li>
        <li><strong>Confundir el juzgado:</strong> Asegúrate de ir al JPL correcto según la comuna donde se cometió la infracción.</li>
      </ul>`;
    faqEspecificas = [
      { q: `¿Puedo enviar mi escrito de prescripción por correo en ${comuna.comuna}?`, a: `No. Los JPL de ${comuna.comuna} NO aceptan escritos por correo electrónico. Debes presentar tu escrito presencialmente en el buzón de partes del tribunal.` },
      { q: `¿Cuánto cuesta prescribir multas en ${comuna.comuna}?`, a: `Nuestro servicio tiene un costo de $25.000 CLP por el primer escrito y $5.000 CLP por cada escrito adicional. La consulta es gratuita.` },
      { q: `¿Dónde está el buzón del JPL de ${comuna.comuna}?`, a: `El buzón de partes se encuentra en la dirección oficial del Juzgado de Policía Local de ${comuna.comuna}. Te recomendamos verificar la dirección exacta en el sitio web de la municipalidad antes de acudir.` },
      { q: `¿Cuánto tarda el proceso de prescripción en ${comuna.comuna}?`, a: `El proceso completo tarda entre 1 y 3 meses desde la presentación del escrito hasta la resolución del juez.` },
    ];
  } else if (tieneHibrido) {
    // JPLs HÍBRIDOS
    canalBloque = `
      <h2>Cómo Presentar tu Escrito de Prescripción en ${comuna.comuna}</h2>
      <p>Los Juzgados de Policía Local de ${comuna.comuna} operan en <strong>modalidad híbrida</strong>. Esto significa que aceptan notificaciones por correo electrónico, pero los escritos de prescripción deben ser presentados presencialmente en el buzón de partes.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="font-weight:700;color:#1d4ed8;margin-bottom:8px;">📋 Diferencia importante</p>
        <p style="color:#1e40af;font-size:14px;">El <strong>correo electrónico</strong> sirve para notificaciones y comunicaciones, pero el <strong>escrito de prescripción</strong> debe ser depositado en el buzón físico del tribunal.</p>
      </div>
      <h3>¿Qué puedes hacer por correo?</h3>
      <ul>
        <li>Notificar tu dirección de correo para recibir actualizaciones del caso.</li>
        <li>Enviar consultas sobre el estado de tu trámite.</li>
        <li>Solicitar información sobre el JPL.</li>
      </ul>
      <h3>¿Qué debes hacer presencialmente?</h3>
      <ul>
        <li>Presentar el escrito original de prescripción en el buzón de partes.</li>
        <li>Entregar la cédula de identidad (original y copia).</li>
        <li>Pedir constancia sellada de presentación.</li>
      </ul>`;
    procesoPasos = `
      <h2>Proceso de Prescripción de Multas en ${comuna.comuna} (Canal Híbrido)</h2>
      <ol>
        <li><strong>Verifica tus multas:</strong> Consulta las multas vigentes en el portal del JPL o acude presencialmente.</li>
        <li><strong>Identifica las prescribibles:</strong> Multas de tránsito: 1 año. Multas de TAG: 3 años. Permiso de circulación: 3 años.</li>
        <li><strong>Redacta tu escrito:</strong> Incluye: nombre, RUT, patente, número de multa, fecha de infracción y causal de prescripción (Art. 24 Ley 18.287).</li>
        <li><strong>Imprime y firma a mano:</strong> El escrito debe estar en papel, firmado manuscritamente.</li>
        <li><strong>Acude al buzón de partes:</strong> Ve al JPL de ${comuna.comuna} y deposita tu escrito. Verifica horarios.</li>
        <li><strong>Pide constancia sellada:</strong> Solicita que sellen una copia como comprobante.</li>
        <li><strong>Registra tu correo:</strong> Si aún no lo has hecho, envía un correo al JPL para registrar tu dirección y recibir notificaciones.</li>
        <li><strong>Espera la resolución:</strong> El juez resolverá en 1 a 3 meses.</li>
      </ol>`;
    erroresComunes = `
      <h2>Errores Comunes al Prescribir Multas en ${comuna.comuna}</h2>
      <ul>
        <li><strong>Enviar el escrito por correo:</strong> Aunque el JPL acepta correos para notificaciones, el escrito de prescripción DEBE ser presentado en el buzón físico.</li>
        <li><strong>No registrar correo:</strong> Si no registras tu correo, no recibirás notificaciones importantes sobre el estado de tu trámite.</li>
        <li><strong>No pedir sello:</strong> Sin constancia sellada no tienes prueba de presentación.</li>
        <li><strong>Olvidar la cédula:</strong> Sin cédula no te recibirán el escrito.</li>
      </ul>`;
    faqEspecificas = [
      { q: `¿Puedo enviar mi escrito de prescripción por correo en ${comuna.comuna}?`, a: `No. Aunque el JPL acepta correos para notificaciones, el escrito de prescripción debe ser presentado presencialmente en el buzón de partes.` },
      { q: `¿Cuánto cuesta prescribir multas en ${comuna.comuna}?`, a: `Nuestro servicio tiene un costo de $25.000 CLP por el primer escrito y $5.000 CLP por cada escrito adicional. La consulta es gratuita.` },
      { q: `¿Cómo registro mi correo en el JPL de ${comuna.comuna}?`, a: `Envía un correo al JPL desde tu dirección de correo electrónico con tu nombre, RUT y número de causa (si lo tienes). El JPL registrará tu dirección para notificaciones futuras.` },
      { q: `¿Cuánto tarda el proceso de prescripción en ${comuna.comuna}?`, a: `El proceso completo tarda entre 1 y 3 meses desde la presentación del escrito hasta la resolución del juez.` },
    ];
  }

  // Generar tabla de JPLs
  const tablaJplRows = comuna.juzgados.map(j => {
    const canalIcon = j.canalIngreso === 'ONLINE' ? '🟢' : j.canalIngreso === 'HÍBRIDO' ? '🟡' : '🔴';
    const canalLabel = j.canalIngreso === 'ONLINE' ? 'Online' : j.canalIngreso === 'HÍBRIDO' ? 'Híbrido' : 'Presencial';
    const certezaColor = j.certeza === 'Alto' ? '#16a34a' : j.certeza === 'Medio' ? '#ca8a04' : '#dc2626';
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">${j.nombre}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${canalIcon} ${canalLabel}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${j.detalleCanal}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${j.correo}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;"><span style="color:${certezaColor};font-weight:600;">${j.certeza}</span></td>
      </tr>`;
  }).join('');

  // Comparación entre JPLs (solo si hay mixed channels)
  let comparacionBloque = '';
  if (tieneOnline && tienePresencial) {
    comparacionBloque = `
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="font-weight:700;color:#166534;margin-bottom:8px;">💡 Dato importante para ${comuna.comuna}</p>
        <p style="color:#166534;font-size:14px;">En ${comuna.comuna}, algunos JPL aceptan escritos por correo electrónico mientras que otros solo operan de forma presencial. Si tienes multas asignadas a diferentes juzgados, es posible que necesites presentar escritos separados por cada canal. Verifica en la tabla anterior cuál es el canal de cada JPL.</p>
      </div>`;
  }

  // FAQs generales
  const faqs = [
    { q: `¿Qué es la prescripción de multas de tránsito?`, a: `La prescripción es un derecho legal que extingue la obligación de pagar una multa de tránsito después de un plazo determinado (1 año para multas de conductor, 3 años para TAG y permiso de circulación). Una vez prescrita, la multa no puede ser cobrada ni ejecutada.` },
    { q: `¿Cuánto cuesta el servicio de prescripción de multas?`, a: `El costo es de $25.000 CLP por el primer escrito de prescripción y $5.000 CLP por cada escrito adicional por cada juzgado con multas agrupadas. La consulta inicial es gratuita.` },
    { q: `¿Puedo prescribir multas de TAG junto con multas de tránsito?`, a: `Sí. Nuestro servicio cubre tanto multas de tránsito (conductor) como multas de TAG (autopista) y permiso de circulación. Cada tipo de multa tiene un plazo de prescripción diferente.` },
    ...faqEspecificas
  ];

  const faqSchema = faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }));

  // Comunas relacionadas (otras comunas RM)
  const comunasRelacionadas = COMUNAS_RM.filter(c => c.slug !== comuna.slug).slice(0, 8);

  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleSEO}</title>
  <meta name="description" content="${metaDescription}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}${slug}" />
  <meta property="og:locale" content="es_CL" />
  <meta property="og:title" content="${titleSEO}" />
  <meta property="og:description" content="${metaDescription}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}${slug}" />
  <meta property="og:site_name" content="LegalHelp Chile" />
  <meta property="og:image" content="${baseUrl}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${titleSEO}" />
  <meta name="twitter:description" content="${metaDescription}" />
  <meta name="twitter:image" content="${baseUrl}/og-image.png" />
  <meta name="ai-content-declaration" content="human-authored" />
  <script type="application/ld+json">
  [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "${titleSEO}",
    "url": "${baseUrl}${slug}",
    "description": "${metaDescription}",
    "inLanguage": "es-CL",
    "isPartOf": { "@type": "WebSite", "name": "LegalHelp Chile", "url": "${baseUrl}/" },
    "datePublished": "${pageDate}",
    "dateModified": "${pageDate}",
    "author": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" },
    "publisher": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" },
    "speakable": {
      "@type": "Speakable",
      "cssSelector": [".diagnos-text", ".faq-section"]
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "LegalService",
    "name": "LegalHelp Chile",
    "description": "${metaDescription}",
    "areaServed": { "@type": "City", "name": "${comuna.comuna}" },
    "serviceType": "Prescripción de Multas y TAG",
    "provider": { "@type": "Organization", "name": "LegalHelp Chile", "url": "https://legalhelp.cl" },
    "url": "${baseUrl}${slug}"
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": ${JSON.stringify(faqSchema)}
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "${baseUrl}/" },
      { "@type": "ListItem", "position": 2, "name": "Prescripción de Multas", "item": "${baseUrl}/prescripcion-multas-tag" },
      { "@type": "ListItem", "position": 3, "name": "${comuna.comuna}", "item": "${baseUrl}${slug}" }
    ]
  }
  ]
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.6; }
    .nav-bar { background: #0b1f3a; padding: 16px 24px; display: flex; align-items: center; gap: 10px; }
    .nav-bar .logo { color: #fff; font-weight: 800; font-size: 18px; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .nav-bar .logo span.blue { color: #60a5fa; }
    .main-wrap { max-width: 820px; margin: 0 auto; padding: 40px 20px 60px; }
    .breadcrumb { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .breadcrumb a { color: #64748b; text-decoration: none; }
    .breadcrumb a:hover { color: #0f172a; }
    h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; margin-bottom: 24px; line-height: 1.2; }
    h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 24px 0 12px; }
    h3 { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 16px 0 8px; }
    .section-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; }
    .diagnos-text { font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 28px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; }
    .cta-box { background: #2563eb; color: #fff; border-radius: 12px; padding: 18px 24px; text-align: center; margin-bottom: 32px; display: block; text-decoration: none; font-weight: 700; font-size: 15px; transition: background 0.15s; box-shadow: 0 4px 14px rgba(37,99,235,0.25); }
    .cta-box:hover { background: #1d4ed8; }
    .cta-box .arrow { display: inline-block; margin-left: 6px; transition: transform 0.15s; }
    .cta-box:hover .arrow { transform: translateX(3px); }
    .cta-whatsapp { display: block; background: #25d366; color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; margin-top: 16px; transition: background 0.15s; }
    .cta-whatsapp:hover { background: #1fb855; }
    .jpl-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .jpl-table th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .diagnos-text ul, .diagnos-text ol { margin: 12px 0; padding-left: 24px; }
    .diagnos-text li { margin-bottom: 8px; font-size: 14px; line-height: 1.6; }
    .faq-section { margin-top: 36px; }
    .faq-section h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
    .faq-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 10px; }
    .faq-item .q { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .faq-item .a { font-size: 13px; color: #475569; line-height: 1.6; }
    .comunas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; margin-top: 16px; }
    .comunas-grid a { display: block; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 600; text-decoration: none; text-align: center; transition: all 0.15s; }
    .comunas-grid a:hover { background: #dbeafe; border-color: #93c5fd; }
    .footer-bar { border-top: 1px solid #e2e8f0; padding: 24px 20px; text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px; }
    .footer-bar strong { color: #64748b; }
    @media (max-width: 640px) { h1 { font-size: 1.5rem; } .main-wrap { padding: 24px 16px 40px; } .jpl-table { font-size: 12px; } .jpl-table th, .jpl-table td { padding: 8px 6px; } }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <span style="font-size:22px;">⚖️</span>
    <a href="/" class="logo">Diagnóstico<span class="blue">Legal</span> Chile</a>
  </nav>
  <main class="main-wrap">
    <div class="breadcrumb"><a href="/">Inicio</a> &rsaquo; <a href="/prescripcion-multas-tag">Prescripción de Multas</a> &rsaquo; ${comuna.comuna}</div>
    <h1>${h1}</h1>
    <p class="section-label">Ficha del Juzgado de Policía Local</p>
    <div class="diagnos-text">
      <table class="jpl-table">
        <thead>
          <tr>
            <th>Juzgado</th>
            <th>Canal</th>
            <th>Detalle</th>
            <th>Contacto</th>
            <th>Certeza</th>
          </tr>
        </thead>
        <tbody>
          ${tablaJplRows}
        </tbody>
      </table>
    </div>
    ${comparacionBloque}
    <div class="diagnos-text">
      ${canalBloque}
    </div>
    <div class="diagnos-text">
      ${procesoPasos}
    </div>
    <div class="diagnos-text">
      <h2>Marcos Legales Aplicables</h2>
      <ul>
        <li><strong>Art. 24 Ley 18.287:</strong> Plazo de prescripción de 1 año para multas de tránsito asociadas al conductor.</li>
        <li><strong>Ley 21.241:</strong> Prescripción de 3 años para multas de TAG y permiso de circulación.</li>
        <li><strong>Ley 20.886:</strong> Normalización de documentos y tramitación digital en Chile.</li>
        <li><strong>Código Civil Art. 2516:</strong> Prescripción adquisitiva de obligaciones.</li>
      </ul>
    </div>
    <div class="diagnos-text">
      ${erroresComunes}
    </div>
    <a href="https://wa.me/56967658939?text=Hola,%20necesito%20prescribir%20mis%20multas%20y%20TAG%20para%20el%20Juzgado%20de%20${encodeURIComponent(comuna.comuna)}.%20¿Me%20ayudan?" class="cta-whatsapp">📱 Consultar prescripción de multas en ${comuna.comuna} por WhatsApp</a>
    <section class="faq-section">
      <h2>Preguntas frecuentes sobre prescripción de multas en ${comuna.comuna}</h2>
      ${faqs.map(f => `<div class="faq-item"><p class="q">${f.q}</p><p class="a">${f.a}</p></div>`).join('')}
    </section>
    <section style="margin-top:36px;">
      <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;color:#0f172a;">Otras comunas de la Región Metropolitana</h2>
      <div class="comunas-grid">
        ${comunasRelacionadas.map(c => `<a href="/prescripcion-multas/${c.slug}">${c.comuna}</a>`).join('')}
      </div>
    </section>
    <div class="footer-bar">
      <p><strong>LegalHelp Chile</strong> &mdash; Prescripción de multas y TAG, orientación legal adaptada a la legislación chilena.</p>
      <p style="margin-top:4px;">No constituye asesoría legal formal. Consulta con un abogado habilitado (Ley 18.120).</p>
      <p style="margin-top:4px;">Datos de JPL verificados en ${pageDate}. Fuente: <a href="https://www.bcn.cl/leychile/navegar?idNorma=1170498" style="color:#64748b;">Ley Chile BCN</a>.</p>
    </div>
  </main>
</body>
</html>`;
}

// Register SEO static routes + sitemap + robots
function registerSEORoutes() {
  // Redirecciones 301 para URLs legadas /p/* (SEO histórico) hacia páginas actuales
  app.get("/p/:slug", (req, res) => {
    res.redirect(301, resolvePseoRedirect(req.params.slug));
  });

  // Página estática: prescripción multas TAG (reemplaza la dinámica)
  app.get("/prescripcion-multas-tag", (_req, res) => {
    const htmlPath = path.join(process.cwd(), "public", "prescripcion-multas-tag.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(htmlPath);
  });

  // Páginas programáticas: prescripción de multas por comuna (RM)
  app.get("/prescripcion-multas/:comuna", (req, res) => {
    const comuna = COMUNAS_RM.find(c => c.slug === req.params.comuna);
    if (!comuna) return res.redirect(301, "/prescripcion-multas-tag");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderTribunalPage(comuna));
  });

  for (const page of ALL_SEO_PAGES) {
    app.get(page.slug, (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderSEOPage(page));
    });
  }

  // Herramientas / calculadoras interactivas
  app.get("/herramientas", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderHerramientasPage());
  });

  for (const calc of CALCULATOR_PAGES) {
    app.get(calc.slug, (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderCalculatorPage(calc));
    });
  }

  // Redirecciones 301 para URLs directas (no /p/*) — city-specific slugs
  // IMPORTANTE: debe ir DESPUÉS de las rutas SEO para no interferir
  app.get("/:slug", (req, res, next) => {
    const dest = resolvePseoRedirect(req.params.slug);
    if (dest && dest !== '/') return res.redirect(301, dest);
    next();
  });

  // Sitemap Index: pointing to 3 sub-sitemaps
  app.get("/sitemap.xml", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const lastmod = process.env.SEO_PAGE_DATE || "2026-08-19";
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-new.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-redirects.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-home.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>`);
  });

  // Sitemap: new SEO pages + calculadoras
  app.get("/sitemap-new.xml", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const lastmod = process.env.SEO_PAGE_DATE || "2026-08-19";
    const seoUrls = ALL_SEO_PAGES.map(p => {
      const priority = p.slug === '/' ? '1.0' : '0.8';
      return `  <url>
    <loc>${baseUrl}${p.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    }).join('\n');
    const calcUrls = CALCULATOR_PAGES.map(c => `  <url>
    <loc>${baseUrl}${c.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`).join('\n');
    const herramientasUrl = `  <url>
    <loc>${baseUrl}/herramientas</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`;
    const comunasUrls = COMUNAS_RM.map(c => `  <url>
    <loc>${baseUrl}/prescripcion-multas/${c.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n');
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${seoUrls}
${herramientasUrl}
${calcUrls}
${comunasUrls}
</urlset>`);
  });

  // Sitemap: old /p/* URLs (708 redirects) — helps Google discover the 301s
  app.get("/sitemap-redirects.xml", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    // Import redirects data
    const fs = require("fs");
    const pathMod = require("path");
    const redirectsPath = pathMod.join(process.cwd(), "dist", "redirects.json");
    let redirectEntries: Array<[string, string]> = [];
    try {
      const raw = fs.readFileSync(redirectsPath, "utf-8");
      const data = JSON.parse(raw);
      redirectEntries = Object.entries(data) as Array<[string, string]>;
    } catch {
      // Fallback: read from source
      try {
        const srcPath = pathMod.join(process.cwd(), "src", "data", "redirects.ts");
        const src = fs.readFileSync(srcPath, "utf-8");
        const matches = src.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g);
        for (const m of matches) {
          redirectEntries.push([m[1], m[2]]);
        }
      } catch { /* skip */ }
    }
    const urls = redirectEntries.map(([oldSlug, dest]) => {
      return `  <url>
    <loc>${baseUrl}/p/${oldSlug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;
    }).join('\n');
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
  });

  // Sitemap: home only
  app.get("/sitemap-home.xml", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const lastmod = process.env.SEO_PAGE_DATE || "2026-08-19";
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
  });

  // robots.txt
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(`User-Agent: *
Allow: /
Disallow: /api/
Disallow: /*?*

User-Agent: GPTBot
User-Agent: OAI-SearchBot
User-Agent: PerplexityBot
User-Agent: ClaudeBot
User-Agent: Google-Extended
User-Agent: CCBot
User-Agent: Bytespider
User-Agent: meta-externalagent
User-Agent: Applebot-Extended
User-Agent: anthropic-ai
User-Agent: Amazonbot
Allow: /

Sitemap: https://legalhelp.cl/sitemap.xml
`);
  });

  // Bing Site Verification (Bing Webmaster Tools)
  app.get("/BingSiteAuth.xml", (_req, res) => {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0"?>
<users>
	<user>5FA314B20BB93FD6E5357FBFF4B76C39</user>
</users>`);
  });

  // IndexNow key (Bing/Yandex/Seznam): https://www.indexnow.org/documentation
  const INDEXNOW_KEY = "28ff68bc2e761ea86f7ba9b100045687";
  app.get(`/${INDEXNOW_KEY}.txt`, (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(INDEXNOW_KEY);
  });

  // llms.txt (GEO): contexto para LLMs y AI Overviews
  app.get("/llms.txt", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const sections: Record<string, string> = {
      arriendo: "Arriendo y desalojo",
      laboral: "Laboral y despidos",
      deuda: "Deudas, cobranza y embargos",
      familia: "Familia, alimentos y divorcio",
      civil: "Civil, contratos y herencias",
      penal: "Penal, denuncias y detención",
      general: "General y abogados",
    };
    const byType: Record<string, typeof ALL_SEO_PAGES> = {};
    for (const p of ALL_SEO_PAGES) {
      (byType[p.caseType] ||= []).push(p);
    }
    const parts: string[] = [
      "# LegalHelp Chile",
      "",
      "> Diagnóstico legal con IA en Chile. Orientación sobre demandas, plazos fatales (CPC, Código del Trabajo, Ley 19.968), arriendo, laboral, deudas, familia, civil y penal. No constituye asesoría legal formal; no reemplaza el patrocinio de un abogado habilitado en Chile.",
      "",
      "> Consulta gratuita con IA: sube tu caso y recibe diagnóstico con plazos, riesgos y pasos a seguir. Enlaces: [Diagnóstico](https://legalhelp.cl/) · [Orientación legal](https://legalhelp.cl/necesito-orientacion-legal) · [Abogado urgente](https://legalhelp.cl/abogado-urgente)",
      "",
      "## Guías por tema",
      "",
    ];
    for (const [type, label] of Object.entries(sections)) {
      const pages = (byType[type] || []).sort((a, b) => a.slug.localeCompare(b.slug));
      if (!pages.length) continue;
      parts.push(`### ${label}`, "");
      for (const p of pages) {
        parts.push(`- [${p.h1}](${baseUrl}${p.slug}): ${p.metaDescription}`);
      }
      parts.push("");
    }
    parts.push(
      "## Recursos oficiales de Chile",
      "",
      "- [Poder Judicial de Chile](https://www.pjud.cl)",
      "- [Biblioteca del Congreso Nacional - Ley Fácil](https://www.bcn.cl)",
      "- [SERNAC](https://www.sernac.cl)",
      "- [Dirección del Trabajo](https://www.dt.gob.cl)",
      "",
      "## Prescripción de multas por comuna (Región Metropolitana)",
      "",
    );
    for (const c of COMUNAS_RM.sort((a, b) => a.comuna.localeCompare(b.comuna))) {
      parts.push(`- [Prescripción de multas en ${c.comuna}](${baseUrl}/prescripcion-multas/${c.slug}): JPLs: ${c.juzgados.map(j => j.nombre).join(', ')}. Canal: ${c.juzgados[0].canalIngreso}.`);
    }
    parts.push("");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(parts.join("\n"));
  });

  // llms-full.txt: version ampliada con el texto de diagnostico completo de cada pagina
  app.get("/llms-full.txt", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const blocks = ALL_SEO_PAGES
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(p => `# ${p.h1}\n\nURL: ${baseUrl}${p.slug}\n\n${p.diagnosText}\n\nPuntos clave:\n${p.bullets.map(b => `- ${b}`).join('\n')}\n\nPreguntas frecuentes:\n${p.faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}`)
      .join('\n\n---\n\n');
    const comunasBlocks = COMUNAS_RM
      .sort((a, b) => a.comuna.localeCompare(b.comuna))
      .map(c => {
        const canalLabel = c.juzgados[0].canalIngreso;
        return `# Prescripción de Multas y TAG en ${c.comuna}\n\nURL: ${baseUrl}/prescripcion-multas/${c.slug}\n\nJPLs: ${c.juzgados.map(j => `${j.nombre} (${j.canalIngreso})`).join(', ')}\n\nCanal de ingreso: ${canalLabel}\n\nDetalle: ${c.juzgados[0].detalleCanal}`;
      })
      .join('\n\n---\n\n');
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(`# LegalHelp Chile - Contenido completo\n\n> Orientación legal con IA para Chile. Fuente oficial del sitio https://legalhelp.cl. No constituye asesoría legal formal.\n\n${blocks}\n\n---\n\n${comunasBlocks}`);
  });

  // ai.txt: información para LLMs y crawlers de IA
  app.get("/ai.txt", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(`# LegalHelp Chile - Información para IA

> Sitio web de orientación legal con inteligencia artificial para Chile.
> No constituye asesoría legal formal ni reemplaza un abogado habilitado.

## Contenido disponible

- Prescripción de multas y TAG por comuna (24 comunas Región Metropolitana)
- Prescripción de multas de tránsito
- Defensa de infracciones de tránsito
- Limpieza de hoja de vida del conductor
- Calculadoras legales interactivas

## Datos estructurados

- Schema.org: LegalService, FAQPage, BreadcrumbList, Speakable
- Formato: JSON-LD
- Idioma: es-CL (español de Chile)

## Contacto

- WhatsApp: +56967658939
- Web: ${baseUrl}

## Comunas disponibles

${COMUNAS_RM.map(c => `- ${c.comuna}: ${baseUrl}/prescripcion-multas/${c.slug}`).join('\n')}
`);
  });
}

const distPath = path.join(process.cwd(), "dist");

// Serve static build in production
if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  app.use(express.static(distPath, { index: false }));
  app.get("/", serveHomePage);
}

// Vercel / Serverless export: handler receives all requests (routes SEO + API + SPA fallback)
export const handler = app;
export default app;

// Only run the persistent server locally (not on Vercel)
if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
  registerSEORoutes();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor de Diagnóstico Legal Chile corriendo en http://localhost:${PORT}`);
  });
} else {
  registerSEORoutes();
  // Custom 404: serve 404.html for unmatched routes instead of SPA fallback
  app.get("*", (req, res) => {
    const notFoundPath = path.join(distPath, "404.html");
    if (require("fs").existsSync(notFoundPath)) {
      res.status(404).sendFile(notFoundPath);
    } else {
      res.status(404).send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>404 - Página no encontrada | LegalHelp Chile</title><meta name="robots" content="noindex"><style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#05070f;color:#e0e6f0}.box{text-align:center;max-width:480px;padding:2rem}h1{font-size:4rem;margin:0;color:#00d4ff}p{font-size:1.1rem;line-height:1.6;color:#a0aec0}a{color:#00d4ff;text-decoration:none;border:1px solid #00d4ff;padding:.5rem 1.5rem;border-radius:6px;display:inline-block;margin-top:1rem;transition:all .2s}a:hover{background:#00d4ff;color:#05070f}</style></head><body><div class="box"><h1>404</h1><p>Esta página no existe o fue movida. Puedes volver al inicio para encontrar lo que necesitas.</p><a href="/">Volver al inicio</a></div></body></html>`);
    }
  });
}
