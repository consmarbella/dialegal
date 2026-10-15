import { chromium } from 'playwright';
import * as fs from 'fs';

// Matriz de 10 casos para el piloto (escalable a 50)
const CASOS_PILOTO = [
  // Casos con Plazo Fatal
  { id: 1, tipo: "Laboral", texto: "S.J.L. del Trabajo de Santiago. Notificado el 13/10/2026 por despido injustificado art. 161. Demanda exige $6.500.000." },
  { id: 2, tipo: "Civil Ejecutivo", texto: "S.J.L. en lo Civil de San Bernardo. Notificación personal con mandamiento de embargo el 14/10/2026 por pagaré vencido de 12.000.000." },
  { id: 3, tipo: "Arriendo", texto: "2° Juzgado Civil de Santiago. Demanda de terminación de contrato por no pago de rentas. Notificado por Art. 44 del CPC el 12/10/2026 en Providencia." },
  { id: 4, tipo: "Familia", texto: "Juzgado de Familia de Pudahuel. Citación a audiencia preparatoria por alimentos mayores notificada por cédula el 09/10/2026." },
  { id: 5, tipo: "Policía Local", texto: "1° JPL de Las Condes. Parte por colisión sin lesionados. Citación para el 22/10/2026." },

  // Casos de Borde / Sin Fecha (Para probar que NO fuerce badges ni alucine)
  { id: 6, tipo: "Laboral Sin Fecha", texto: "Consulta laboral: Me enviaron carta de despido por necesidades de la empresa pero no me han notificado judicialmente ni firmado finiquito." },
  { id: 7, tipo: "Civil Exhorto", texto: "1° Juzgado de Letras de Antofagasta. Demandado notificado mediante exhorto en la comuna de Buin el 10/10/2026." },
  { id: 8, tipo: "Familia Medida Cautelar", texto: "Juzgado de Familia de Santiago. Medida de protección y prohibición de acercamiento notificada el 14/10/2026." },
  { id: 9, tipo: "Cobranza Domicilio Falso", texto: "Notificación de embargo enviada a domicilio antiguo en Valparaíso donde el demandado no reside hace 3 años." },
  { id: 10, tipo: "Laboral Autodespido", texto: "Carta de autodespido enviada a la Inspección del Trabajo y al empleador con fecha 05/10/2026 sin demanda interpuesta aún." },
];

async function correrAuditoria() {
  console.log("🚀 Iniciando auditoría piloto (10 casos) en http://localhost:3000 ...");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const resultados: Array<any> = [];
  let exitosos = 0, cuotaSaturada = 0, fallosUI = 0;

  for (const caso of CASOS_PILOTO) {
    const inicio = Date.now();
    console.log(`\n----------------------------------------`);
    console.log(`[Caso ${caso.id}/${CASOS_PILOTO.length}] Procesando (${caso.tipo})...`);

    let reintento = 0;
    let completado = false;

    while (reintento <= 1 && !completado) {
      try {
        await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

        // Selector real del frontend: textarea del relato + botón exacto de análisis
        await page.fill('textarea', caso.texto);
        await page.click('button:has-text("Generar Diagnóstico Legal con IA Senior")');

        // Hasta 180s: se pinta la Card de Alerta O aparece el aviso de cuota saturada
        // (firma: waitForFunction(fn, arg, options) — el arg debe ir explícito)
        await page.waitForFunction(
          () => {
            const t = document.body.innerText;
            return t.includes('ALERTA DE URGENCIA') || t.includes('temporalmente saturado');
          },
          undefined,
          { timeout: 180000 }
        );

        const textoPagina = await page.innerText('body');
        const textoLower = textoPagina.toLowerCase();

        if (textoPagina.includes('temporalmente saturado')) {
          throw new Error('CUOTA_SATURADA_DETECTADA');
        }

        // Evaluación de variables de la vista previa
        const tieneBadgeFatal = textoPagina.includes('Plazo Fatal en Curso');
        const contieneEstimado = textoPagina.includes('Estimado'); // Debe ser FALSE
        // Case-insensitive: el card usa casing distinto al label esperado
        const camposBloqueadosOk =
          textoLower.includes('fecha exacta de vencimiento') &&
          textoLower.includes('pasos de defensa');
        const tieneBarrasRedact = textoPagina.includes('█');
        const tieneSelloPreview = textoPagina.includes('VISTA PREVIA');

        // Extracción de riesgos desde la ol de la Card de Alerta (hasta 3)
        const riesgosExtraidos = await page.$$eval('ol li span.flex-1', (nodes) =>
          nodes.map((n) => (n.textContent || '').trim()).filter((t) => t.length > 10).slice(0, 3)
        );

        const duracion = Math.round((Date.now() - inicio) / 1000);

        resultados.push({
          id: caso.id,
          tipo: caso.tipo,
          estado: 'EXITO',
          duracionSegundos: duracion,
          tieneBadgeFatal,
          alucinacionEstimado: contieneEstimado,
          camposBloqueadosOk,
          tieneBarrasRedact,
          tieneSelloPreview,
          riesgosExtraidos,
          riesgosDetectadosCount: riesgosExtraidos.length,
          reintentos: reintento,
        });

        console.log(
          `✅ [Caso ${caso.id}] OK en ${duracion}s | Badge: ${tieneBadgeFatal} | Estimado: ${contieneEstimado} | CamposBloq: ${camposBloqueadosOk} | Barras: ${tieneBarrasRedact} | Riesgos: ${riesgosExtraidos.length}`
        );
        exitosos++;
        completado = true;
      } catch (error: any) {
        const errorStr = String(error);
        const esCuota =
          errorStr.includes('CUOTA_SATURADA_DETECTADA') ||
          errorStr.includes('temporalmente saturado') ||
          errorStr.includes('429');

        if (esCuota && reintento === 0) {
          console.warn(`⚠️ [Caso ${caso.id}] Cuota saturada. Pausando 20s antes de reintentar (1/1)...`);
          await page.waitForTimeout(20000);
          reintento++;
        } else if (esCuota) {
          console.error(`❌ [Caso ${caso.id}] FALLO_CUOTA tras reintento.`);
          resultados.push({ id: caso.id, tipo: caso.tipo, estado: 'FALLO_CUOTA', error: 'Cuota saturada tras reintento' });
          cuotaSaturada++;
          completado = true;
        } else {
          // Timeout u otro error: verificar en la página si había cuota saturada
          let quotaEnPagina = false;
          try {
            const t = await page.innerText('body');
            quotaEnPagina = t.includes('temporalmente saturado');
          } catch {
            /* página inaccesible */
          }

          if (quotaEnPagina && reintento === 0) {
            console.warn(`⚠️ [Caso ${caso.id}] Cuota saturada (tras timeout). Reintentando...`);
            await page.waitForTimeout(20000);
            reintento++;
          } else if (quotaEnPagina) {
            resultados.push({ id: caso.id, tipo: caso.tipo, estado: 'FALLO_CUOTA', error: 'Cuota saturada tras reintento' });
            cuotaSaturada++;
            completado = true;
          } else {
            console.error(`❌ [Caso ${caso.id}] FALLO_UI / TIMEOUT:`, errorStr.substring(0, 150));
            resultados.push({ id: caso.id, tipo: caso.tipo, estado: 'FALLO_UI', error: errorStr.substring(0, 200) });
            fallosUI++;
            completado = true;
          }
        }
      }
    }

    // Pausa de 5 segundos entre casos para respetar el rate limit del servidor
    await page.waitForTimeout(5000);
  }

  await browser.close();

  const resumen = {
    totalCasos: CASOS_PILOTO.length,
    exitosos,
    fallosCuota: cuotaSaturada,
    fallosUI,
    fecha: new Date().toISOString(),
  };

  fs.writeFileSync('reporte_auditoria_piloto10.json', JSON.stringify({ resumen, detalles: resultados }, null, 2));
  console.log('\n========================================');
  console.log(`🏁 Auditoría finalizada. Exitosos: ${exitosos} | Cuota 429: ${cuotaSaturada} | UI/Timeout: ${fallosUI}`);
  console.log("Resultados en 'reporte_auditoria_piloto10.json'.");
}

correrAuditoria();
