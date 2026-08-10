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

// Combinación de TODAS las páginas SEO: 21 originales + 45 + 20 = 86 páginas (+home = 87 URLs)
const ALL_SEO_PAGES = [...SEO_PAGES, ...SEO_PAGES_EXTRA, ...SEO_PAGES_BATCH2];

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

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
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${page.titleSEO}" />
  <meta name="twitter:description" content="${page.metaDescription}" />
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
  return ALL_SEO_PAGES
    .filter(p => p.slug !== page.slug && p.caseType === page.caseType)
    .slice(0, 4)
    .map(p => ({ slug: p.slug, h1: p.h1 }));
}

// Homepage SSR: static crawlable content inside #root (React replaces it on hydration)
function renderHomeContent() {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
  const links = [...new Map(ALL_SEO_PAGES.map(p => [p.slug, p])).values()]
    .slice(0, 24)
    .map(p => `<li><a href="${baseUrl}${p.slug}">${p.h1}</a></li>`)
    .join('');
  return `<main style="max-width:820px;margin:0 auto;padding:40px 20px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;line-height:1.6;">
    <h1 style="font-size:2.2rem;font-weight:800;">Diagnóstico legal con IA en Chile</h1>
    <p style="font-size:1.05rem;color:#334155;">Analiza tu demanda o citación, calcula tus plazos fatales y recibe orientación legal para arriendo, laboral, deudas, familia, civil y penal. Sin costo inicial y sin reemplazar el patrocinio de un abogado.</p>
    <h2 style="font-size:1.3rem;margin-top:32px;">Guías y consultas legales frecuentes</h2>
    <ul style="columns:2;gap:24px;list-style:none;padding:0;">${links}</ul>
    <p style="margin-top:32px;font-size:0.85rem;color:#64748b;">Herramienta de orientación legal adaptada a la legislación chilena (CPC, Código del Trabajo, Ley 19.968). No constituye asesoría legal formal.</p>
  </main>`;
}

function serveHomePage(_req: express.Request, res: express.Response) {
  const indexPath = path.join(distPath, "index.html");
  const html = fs.readFileSync(indexPath, "utf-8");
  const content = renderHomeContent();
  const withContent = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(withContent);
}

// Register SEO static routes + sitemap + robots
function registerSEORoutes() {
  for (const page of ALL_SEO_PAGES) {
    app.get(page.slug, (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderSEOPage(page));
    });
  }

  // Sitemap
  app.get("/sitemap.xml", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const urls = ALL_SEO_PAGES.map(p => `  <url>\n    <loc>${baseUrl}${p.slug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`).join('\n');
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n${urls}\n</urlset>`);
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
Allow: /
Disallow: /*?*

User-Agent: CCBot
User-Agent: Bytespider
User-Agent: meta-externalagent
Disallow: /

Sitemap: https://legalhelp.cl/sitemap.xml
`);
  });

  // llms.txt (GEO): contexto para LLMs y AI Overviews
  app.get("/llms.txt", (_req, res) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalhelp.cl';
    const topLinks = [...new Map(ALL_SEO_PAGES.map(p => [p.slug, p])).values()]
      .slice(0, 30)
      .map(p => `- [${p.h1}](${baseUrl}${p.slug}): ${p.metaDescription}`)
      .join('\n');
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(`# LegalHelp Chile

> Diagnóstico legal con IA en Chile. Orientación sobre demandas, plazos fatales (CPC, Código del Trabajo, Ley 19.968), arriendo, laboral, deudas, familia, civil y penal. No constituye asesoría legal formal; no reemplaza el patrocinio de un abogado habilitado en Chile.

## Guías y consultas frecuentes

${topLinks}

## Recursos oficiales

- [Poder Judicial de Chile](https://www.pjud.cl)
- [Biblioteca del Congreso Nacional - Ley Fácil](https://www.bcn.cl)
- [SERNAC](https://www.sernac.cl)
- [Dirección del Trabajo](https://www.dt.gob.cl)
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
  // SPA fallback: preserve original behavior of serving index.html for unmatched routes
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
