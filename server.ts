import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import mammoth from "mammoth";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import crypto from "crypto";
import { saveOrder, getOrderByOrderId, getOrderByPreferenceId, updateOrder } from "./src/lib/orderStore.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Initialize MercadoPago client
const envToken = process.env.MP_ACCESS_TOKEN;
const defaultToken = "APP_USR-8910760867269099-050716-f6dc2b4b33b05a7b18a5a9d4d02fbae2-3031953787";
const mpAccessToken = (envToken && (envToken.startsWith("APP_USR-") || envToken.startsWith("TEST-")))
  ? envToken
  : defaultToken;
const isMpConfigured = Boolean(mpAccessToken);
const isSandbox = mpAccessToken.startsWith("TEST-");
const mp = isMpConfigured ? new MercadoPagoConfig({ accessToken: mpAccessToken }) : null;

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

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor de Diagnóstico Legal Chile corriendo en http://localhost:${PORT}`);
  });
}

startServer();
