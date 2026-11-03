// Linter determinista post-LLM: reglas de oro procesales chilenas (contestación laboral).
// Intercepta fórmulas de futuro (Ley Bustos / art. 162 CT) y allanamientos a feriado/HE.

export interface HallazgoTactico {
  regla: "BUSTOS_FUTURO" | "ALLAN_FERIADO_HE" | "CARGA_INVERTIDA" | "PRESCRIPCION_VAGA" | "ROL_INVENTADO";
  snippet: string;
  severidad: "bloqueante" | "warn";
  sugerencia: string;
}

const RE_BUSTOS_FUTURO = [
  /\b(?:proceder[áa]|proceder[aá]\s+a|se\s+proceder[áa]\s+a)\s+(?:pagar|regularizar|enterar|cotizar)/gi,
  /\b(?:se\s+)?(?:pagar[áa]|regularizar[áa]|enterar[áa])\s+(?:las\s+)?(?:cotizaciones|imposiciones|deudas?\s+previsionales?)/gi,
  /\b(?:una\s+vez\s+)?(?:pagad[oa]s?|regularizad[oa]s?)\s+(?:las\s+)?(?:cotizaciones|imposiciones).{0,40}(?:convalid|subsanar|sanear)/gi,
  /\bconvalidaci[oó]n\s+(?:del\s+)?despido.{0,60}(?:tras|luego|despu[eé]s|cuando).{0,40}(?:pag|regulariz)/gi,
  /\b(?:el\s+empleador\s+)?(?:se\s+compromete|ofrece|se\s+obliga)\s+a\s+(?:pagar|regularizar).{0,30}cotizaci/gi,
];

const RE_ALLAN_FERIADO_HE = [
  /\bsi\s+(?:existiere|existiera|hubiere|hubiera|existe|resultare)\s+(?:alg[uú]n\s+)?(?:saldo|diferencia|monto).{0,40}(?:feriado|hora\s*s?\s*extra)/gi,
  /\b(?:se\s+)?(?:pagar[áa]|liquidar[áa]|abon[áa]r[áa])\s+(?:el\s+)?(?:feriado|hora\s*s?\s*extra).{0,30}(?:pendiente|adeudad|si\s+corresponde)/gi,
  /\b(?:en\s+cuanto\s+a|respecto\s+del?)\s+(?:feriado|horas?\s+extraordinarias?).{0,50}(?:se\s+est[áa]\s+a\s+lo|se\s+estar[áa]|se\s+remite|sin\s+perjuicio)/gi,
  /\ballan(?:amiento|a)\s+(?:parcialmente\s+)?(?:al|a\s+la|los|las).{0,30}(?:feriado|hora)/gi,
  /\b(?:no\s+se\s+opone|no\s+objeta|acepta)\s+(?:el\s+)?(?:cobro|pago)\s+del?\s+(?:feriado|horas?\s+extra)/gi,
];

const RE_CARGA_INVERTIDA = [
  /\b(?:corresponde|incumbe|toca)\s+al\s+(?:empleador|demandad[oa])\s+(?:probar|acreditar)\s+que\s+no\s+(?:adeuda|existe\s+saldo)/gi,
];

export function lintTacticoProcesal(texto: string, area: string | null | undefined): HallazgoTactico[] {
  const out: HallazgoTactico[] = [];
  if (area && area !== "laboral") return out;

  const scan = (
    res: RegExp[],
    regla: HallazgoTactico["regla"],
    sugerencia: string,
    sev: HallazgoTactico["severidad"] = "bloqueante",
  ) => {
    for (const re of res) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(texto)) !== null) {
        out.push({ regla, snippet: m[0].slice(0, 120), severidad: sev, sugerencia });
        if (out.length >= 12) return;
      }
    }
  };

  scan(
    RE_BUSTOS_FUTURO,
    "BUSTOS_FUTURO",
    "Reemplazar por: (i) convalidación EFECTIVA con fecha de pago + notificación previa al término y prueba; o (ii) negar perjuicio/fundamento y exigir carga al actor. NUNCA promesa de pago futuro.",
  );
  scan(
    RE_ALLAN_FERIADO_HE,
    "ALLAN_FERIADO_HE",
    "Negar categóricamente saldo de feriado/HE. Trasladar carga probatoria al demandante. Eliminar condicionales ('si existiere').",
  );
  scan(
    RE_CARGA_INVERTIDA,
    "CARGA_INVERTIDA",
    "La carga de acreditar el saldo de feriado/HE y la mora previsional corresponde al actor, no al empleador.",
    "warn",
  );
  // Prescripción alegada sin anclar plazo legal ni dies a quo → riesgo de excepción mal fundada.
  scan(
    [
      /\b(?:opone|alega|invoca)\s+(?:la\s+)?prescripci[oó]n\b(?![\s\S]{0,80}(?:art\.|art[ií]culo|plazo\s+de\s+\d))/gi,
      /\bprescripci[oó]n\s+(?:de\s+la\s+acci[oó]n|extintiva)\b(?![\s\S]{0,60}(?:d[ií]as|meses|a[nñ]os|art\.))/gi,
    ],
    "PRESCRIPCION_VAGA",
    "Fundar la prescripción con plazo legal concreto, dies a quo y norma (p. ej. art. 510 CT / 2515 CC). No alegar en abstracto.",
    "warn",
  );
  // Roles de fallo con formato típico inventados suelen aparecer sin fuente; marcar para revisión.
  scan(
    [/\b(?:Rol|ROL)\s*N[°º]?\s*\d{1,3}\.?\d{3}-\d{4}\b/g],
    "ROL_INVENTADO",
    "Verificar que el rol cite un fallo del bloque CRITERIO JURISPRUDENCIAL / fuentes del caso. Si no está en fuentes, eliminar el número y citar doctrina genérica de la CS.",
    "warn",
  );
  return out;
}

/** Reescribe de forma determinista los hallazgos bloqueantes más peligrosos. */
export function sanitizarTactico(
  texto: string,
  hallazgos: HallazgoTactico[],
): { texto: string; corregidos: number } {
  let t = texto;
  let n = 0;
  for (const h of hallazgos.filter((x) => x.severidad === "bloqueante")) {
    const escaped = h.snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (h.regla === "BUSTOS_FUTURO") {
      t = t.replace(
        new RegExp(escaped, "gi"),
        "se niega la existencia de mora previsional que prive de efectos al despido, sin perjuicio de que cualquier convalidación solo procede si se acredita pago y notificación previos al término; la carga de probar el perjuicio y la causal recae en el actor",
      );
      n++;
    }
    if (h.regla === "ALLAN_FERIADO_HE") {
      t = t.replace(
        new RegExp(escaped, "gi"),
        "se niega categóricamente la existencia de saldo pendiente por feriado legal u horas extraordinarias; corresponde al demandante acreditar con prueba fehaciente la existencia, liquidación y no pago de tales rubros",
      );
      n++;
    }
  }
  return { texto: t, corregidos: n };
}
