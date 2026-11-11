// Verificacion normativa determinista contra Ley Chile (BCN).
// Canal base: servicios legacy de Ley Chile (obtxml), que no requieren API key.
// API v1 (BCN_API_KEY) esta activada? no: la key entregada responde 401 incluso en
// endpoints basicos, por lo que el motor base es el canal legacy; si la key se activa
// puede migrarse a /api/v1 (servicio 7) sin cambiar la interfaz.
//
// Fase 4 — resolucion generica de leyes:
// - Ademas de la tabla semilla NORMA_IDS (los cuerpos mas citados), CUALQUIER
//   "Ley N. X.XXX" detectada en el texto se resuelve con el canal documentado
//   `obtxml?opt=7&idLey=<numero>` (verificado 2026-10-22: idLey=18290 -> XML
//   completo con <Tipo>Ley</Tipo><Numero>18290</Numero> y normaId="29708").
//   El Identificador del XML SE VERIFICA que sea Tipo=Ley con ese numero exacto
//   (evita resolver "DL 2.306" u "DFL" contra una "Ley 2.306" distinta que vive
//   en otro id). DFL/DL genericos y codigos fuera de la semilla NO se resuelven
//   por este canal; quedan como pendientes con motivo "norma_no_resoluble".
// - El indice nombre->idNorma se persiste en la tabla `leyes` de Postgres
//   (si DATABASE_URL existe). La cache de XML en proceso (TTL 24h) sigue
//   siendo solo para no redescargar el mismo cuerpo.
export interface BcnArticuloVerificado {
  keyNorma: string;
  nombreNorma: string;
  idNorma: number;
  articulo: string;
  idParte?: string;
  vigente: boolean;
  fechaVersion?: string;
  texto: string;
  url: string;
  /** Fase I.3: artículo traido como texto BASE de una ley invocada en el caso
   *  sin artículo citado (arts. semilla) — no es una cita del documento. */
  viaSemilla?: boolean;
}

export interface BcnNormaSinArticulo {
  keyNorma: string;
  nombreNorma: string;
  idNorma: number;
  articulosPedidos: string[];
  motivo: "articulo_no_encontrado" | "norma_no_disponible" | "limite_diario" | "norma_no_resoluble";
}

// Exportadas para scripts/qa-semilla-bcn.ts (guardián de la semilla). El resto
// del código debe seguir usando verificarCitasBCN, no estas tablas a pelo.
// artsSemilla (Fase I.3): artículos base de la ley que se traen del XML oficial
// cuando la ley es DETECTADA en el caso pero sin artículos citados (p. ej. la
// demanda invoca "competencia desleal" sin citar arts. de la Ley 20.169: el
// prompt recibe su texto oficial y el modelo puede auditar la cita).
export const NORMA_IDS: Record<string, { id: number; nombre: string; detect: RegExp; artsSemilla?: string[] }> = {
  // ── Códigos ────────────────────────────────────────────────────────────────
  // detect exige el DENOMINADOR del DFL (1/2000, 2/2003): el patrón anterior
  // ("DFL N" pelado) hacía que cualquier "DFL N° 1"/"DFL N° 2" del mundo cayera
  // en CC/CT. Verificación de TODAS las entradas: scripts/qa-semilla-bcn.ts.
  // Fase I.3: \bCC\b acepta la abreviatura ("Art. 1459 CC") que el par de
  // proximidad empareja igual que la forma completa.
  CC: { id: 172986, nombre: "Codigo Civil (DFL 1, 2000)", detect: /\bC[oó]digo\s+Civil\b|\bDFL\s*(?:N[°º.]?\s*)?1\s*(?:\/|de)?\s*2000\b|\bCC\b/i },
  CP: { id: 1984, nombre: "Codigo Penal", detect: /\bC[oó]digo\s+Penal\b/i },
  CT: { id: 207436, nombre: "Codigo del Trabajo (DFL 2, 2003)", detect: /\bC[oó]digo\s+del\s+Trabajo\b|\bDFL\s*(?:N[°º.]?\s*)?2\s*(?:\/|de)?\s*2003\b/i },
  CPC: { id: 22740, nombre: "Codigo de Procedimiento Civil (Ley 1.552)", detect: /\bC[oó]digo\s+de\s+Procedimiento\s+Civil\b|\bLey\s*n?[°º.\s]*1\.?\s?552\b|\bCPC\b/i },
  CPP: { id: 176595, nombre: "Codigo Procesal Penal (Ley 19.696)", detect: /\bC[oó]digo\s+Procesal\s+Penal\b|\bLey\s*n?[°º.\s]*19\.?\s?696\b/i },
  CCom: { id: 1974, nombre: "Codigo de Comercio", detect: /\bC[oó]digo\s+de\s+Comercio\b/i },
  CTrib: { id: 6374, nombre: "Codigo Tributario (DL 830)", detect: /\bC[oó]digo\s+Tributario\b/i },
  CAguas: { id: 5605, nombre: "Codigo de Aguas (DFL 1122)", detect: /\bC[oó]digo\s+de\s+Aguas\b/i },
  CSan: { id: 5595, nombre: "Codigo Sanitario (DFL 725)", detect: /\bC[oó]digo\s+Sanitario\b/i },
  CMiner: { id: 29668, nombre: "Codigo de Mineria (Ley 18.248)", detect: /\bC[oó]digo\s+de\s+Miner[ií]a\b/i },
  CJM: { id: 18914, nombre: "Codigo de Justicia Militar (D. 2226)", detect: /\bC[oó]digo\s+de\s+Justicia\s+Militar\b/i },
  CAero: { id: 30287, nombre: "Codigo Aeronautico (Ley 18.916)", detect: /\bC[oó]digo\s+Aeron[aá]utico\b/i },
  LGUC: { id: 13560, nombre: "Ley General de Urbanismo y Construcciones (DFL 458)", detect: /\bLey\s+General\s+de\s+Urbanismo\b|\bLGUC\b/i },
  // Fase I.3 (hallazgo del caso real software/competencia desleal): la demanda
  // citaba "Ley N° 20.165" pero la ley chilena de competencia desleal es la
  // 20.169 (idNorma 258377, verificado en leychile.cl). Con la semilla + arts.
  // base, el sistema trae el texto oficial y puede AUDITAR la cita equivocada.
  L20169: {
    id: 258377,
    nombre: "Ley 20.169 (Competencia Desleal)",
    detect: /\bLey\s*N?[°º.\s]*20[.,\s]?169\b|\bcompetencia\s+desleal\b/i,
    artsSemilla: ["1", "2", "3", "4", "5", "6", "7", "8"],
  },
  // ── Leyes especiales / sectoriales ─────────────────────────────────────────
  // Lote 2026-11-02: frecuencia medida sobre data/corpus-full (16,1 MB) + gap
  // de citas SIN número ("Ley del Consumidor", "Estatuto Administrativo") que
  // el canal genérico idLey no puede resolver. Cada idNorma verificado contra
  // el XML oficial (obtxml: <Tipo>, <Numero>, normaId y <TituloNorma>).
  L14908: { id: 27977, nombre: "Ley 14.908 (pensiones alimenticias)", detect: /\bLey\s*n?[°º.\s]*14\.?\s?908\b/i },
  L15231: { id: 28104, nombre: "Ley 15.231 (organizacion y atribuciones de los juzgados de policia local)", detect: /\bLey\s*n?[°º.\s]*15\.?\s?231\b/i },
  L16744: { id: 28650, nombre: "Ley 16.744 (accidentes del trabajo)", detect: /\bLey\s*n?[°º.\s]*16\.?\s?744\b|\bLey\s+de\s+Accidentes\s+del\s+Trabajo\b/i },
  L17336: { id: 28933, nombre: "Ley 17.336 (propiedad intelectual)", detect: /\bLey\s*n?[°º.\s]*17\.?\s?336\b|\bLey\s+de\s+Propiedad\s+Intelectual\b|\bpropiedad\s+intelectual\b|\bderechos?\s+de\s+autor\b/i, artsSemilla: ["1", "2", "3", "4", "5"] },
  L18046: { id: 29473, nombre: "Ley 18.046 (sociedades anonimas)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?046\b|\bLey\s+de\s+Sociedades\s+An[oó]nimas\b|\bsociedad(?:es)?\s+an[oó]nimas?\b|\bsociedad(?:es)?\s+por\s+acciones\b|\bjunta\s+de\s+accionistas\b/i, artsSemilla: ["1", "2", "424", "425", "426"] },
  L18101: { id: 29526, nombre: "Ley 18.101 (arrendamiento urbano)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?101\b|\bLey\s*n?[°º.\s]*21\.?\s?461\b/i },
  L18216: { id: 29636, nombre: "Ley 18.216 (penas sustitutivas)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?216\b/i },
  L18287: { id: 29705, nombre: "Ley 18.287 (justicia de policia local)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?287\b/i },
  L18290: { id: 29708, nombre: "Ley 18.290 (transito)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?290\b|\bLey\s+de\s+Tr[aá]nsito\b/i },
  L18314: { id: 29731, nombre: "Ley 18.314 (conductas terroristas)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?314\b/i },
  L18490: { id: 29893, nombre: "Ley 18.490 (seguro obligatorio de accidentes personales SOAP)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?490\b/i },
  L18575: { id: 29967, nombre: "Ley 18.575 (bases generales de la administracion)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?575\b/i },
  L18695: { id: 30077, nombre: "Ley 18.695 (LOC de municipalidades)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?695\b|\bLey\s+Org[aá]nica\s+Constitucional\s+de\s+Municipalidades\b/i },
  L18834: { id: 30210, nombre: "Ley 18.834 (estatuto administrativo)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?834\b|\bEstatuto\s+Administrativo(?!\s+(?:Municipal|para\s+Funcionarios\s+Municipales))\b/i },
  L18883: { id: 30256, nombre: "Ley 18.883 (estatuto administrativo municipal)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?883\b|\bEstatuto\s+Administrativo\s+(?:Municipal|para\s+Funcionarios\s+Municipales)\b/i },
  L19039: { id: 30406, nombre: "Ley 19.039 (propiedad industrial)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?039\b|\bLey\s+de\s+Propiedad\s+Industrial\b|\bpropiedad\s+industrial\b|\bINAPI\b|\bmodelo\s+de\s+utilidad\b|\bregistro\s+de\s+(?:la\s+)?marca\b|\bmarcas?\s+(?:registrada|comercial|colectiva|de\s+f[aá]brica)\b/i, artsSemilla: ["1", "2", "3", "4"] },
  L19300: { id: 30667, nombre: "Ley 19.300 (bases del medio ambiente)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?300\b|\bLey\s+de\s+Bases\s+(?:Generales\s+)?del\s+Medio\s+Ambiente\b/i },
  L19496: { id: 61438, nombre: "Ley 19.496 (proteccion del consumidor)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?496\b|\bLey\s+del\s+Consumidor\b|\bprotecci[oó]n\s+(?:de\s+los\s+)?(?:derechos\s+de\s+los\s+)?consumidores?\b|\bSERNAC\b|\bderechos?\s+del\s+consumidor\b/i, artsSemilla: ["1", "2", "3", "23"] },
  L19628: { id: 141599, nombre: "Ley 19.628 (proteccion de la vida privada)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?628\b|\bprotecci[oó]n\s+de\s+(?:la\s+)?vida\s+privada\b|\bdatos?\s+personales\b|\btratamiento\s+de\s+datos\b/i, artsSemilla: ["1", "2", "4"] },
  // Ley Bustos: modifica art. 162 CT (cotizaciones al despido). idNorma verificado obtxml 2026-11-03.
  L19631: { id: 144318, nombre: "Ley 19.631 (Ley Bustos — cotizaciones al despido)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?631\b|\bLey\s+Bustos\b/i },
  L19880: { id: 210676, nombre: "Ley 19.880 (procedimiento administrativo)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?880\b/i },
  L19886: { id: 213004, nombre: "Ley 19.886 (compras publicas)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?886\b|\bLey\s+de\s+Compras\s+P[uú]blicas\b/i },
  L19947: { id: 225128, nombre: "Ley 19.947 (matrimonio civil)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?947\b|\bLey\s+de\s+Matrimonio\s+Civil\b/i },
  L19968: { id: 229557, nombre: "Ley 19.968 (familia)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?968\b/i },
  L20000: { id: 235507, nombre: "Ley 20.000 (trafico ilicito de estupefacientes)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?000\b|\bLey\s+de\s+Drogas\b/i },
  L20009: { id: 236736, nombre: "Ley 20.009 (fraudes tarjetas de pago)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?009\b/i },
  L20066: { id: 242648, nombre: "Ley 20.066 (violencia intrafamiliar)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?066\b|\bLey\s+de\s+Violencia\s+Intrafamiliar\b/i },
  L20084: { id: 244803, nombre: "Ley 20.084 (responsabilidad penal adolescente)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?084\b/i },
  L20720: { id: 1058072, nombre: "Ley 20.720 (reorganizacion y liquidacion)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?720\b|\breorganizaci[oó]n\s+(?:judicial|concursal|empresarial)\b|\bliquidaci[oó]n\s+(?:judicial|concursal|forzosa)\b|\bprocedimiento\s+concursal\b|\bquiebra\b/i, artsSemilla: ["1", "2", "4"] },
  L21325: { id: 1158549, nombre: "Ley 21.325 (migracion y extranjeria)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?325\b|\bLey\s+de\s+Migraci[oó]n\b/i },
  L21430: { id: 1173643, nombre: "Ley 21.430 (garantias y proteccion de la ninez)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?430\b/i },
  L21561: { id: 1191554, nombre: "Ley 21.561 (reduccion de jornada, 40 horas)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?561\b|\bLey\s+de\s+40\s+Horas\b/i },
  L21643: { id: 1200096, nombre: "Ley 21.643 (Ley Karin, acoso laboral)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?643\b|\bLey\s+Karin\b/i },
  L21719: { id: 1209272, nombre: "Ley 21.719 (proteccion de datos personales)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?719\b|\bnueva\s+ley\s+de\s+(?:protecci[oó]n\s+de\s+)?datos\s+personales\b|\bagencia\s+de\s+protecci[oó]n\s+de\s+datos\b/i, artsSemilla: ["1", "2", "4"] },
  // Lote frecuencia foro 2026-11-03 — normaId verificado obtxml
  L18010: { id: 29438, nombre: "Ley 18.010 (operaciones de credito de dinero)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?010\b|\boperaciones?\s+de\s+cr[eé]dito\s+de\s+dinero\b/i },
  L18092: { id: 29517, nombre: "Ley 18.092 (letra de cambio y pagare)", detect: /\bLey\s*n?[°º.\s]*18\.?\s?092\b|\bletras?\s+de\s+cambio\b|\bpagar[eé]s?\b/i },
  L16271: { id: 28367, nombre: "Ley 16.271 (impuesto a las herencias y donaciones)", detect: /\bLey\s*n?[°º.\s]*16\.?\s?271\b|\bimpuesto\s+a\s+las\s+herencias\b/i },
  L17322: { id: 28919, nombre: "Ley 17.322 (cobranza judicial de cotizaciones)", detect: /\bLey\s*n?[°º.\s]*17\.?\s?322\b|\bcobranza\s+judicial\s+de\s+cotizaciones\b/i },
  L19728: { id: 184979, nombre: "Ley 19.728 (seguro de desempleo / cesantia)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?728\b|\bseguro\s+de\s+(?:desempleo|cesant[ií]a)\b/i },
  L19913: { id: 219119, nombre: "Ley 19.913 (UAF / lavado de activos)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?913\b|\bUnidad\s+de\s+An[aá]lisis\s+Financiero\b|\bUAF\b/i },
  L20585: { id: 1039952, nombre: "Ley 20.585 (licencias medicas)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?585\b|\blicencias?\s+m[eé]dicas?\b/i },
  L21400: { id: 1169572, nombre: "Ley 21.400 (matrimonio en igualdad de condiciones)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?400\b|\bmatrimonio\s+igualitario\b/i },
  // Lote P1+P2 2026-11-03 — frecuencia corpus-full + foro (normaId = obtxml)
  L20886: { id: 1085545, nombre: "Ley 20.886 (tramitacion electronica de juicios)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?886\b|\btramitaci[oó]n\s+electr[oó]nica\b|\btramitaci[oó]n\s+digital\s+de\s+los\s+procedimientos\b/i },
  L19537: { id: 81505, nombre: "Ley 19.537 (copropiedad inmobiliaria)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?537\b|\bcopropiedad\s+inmobiliaria\b|\bgastos\s+comunes\b/i },
  L20830: { id: 1075210, nombre: "Ley 20.830 (acuerdo de union civil)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?830\b|\bacuerdo\s+de\s+uni[oó]n\s+civil\b|\bAUC\b/i },
  L20609: { id: 1042092, nombre: "Ley 20.609 (medidas contra la discriminacion / Zamudio)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?609\b|\bLey\s+Zamudio\b|\bmedidas\s+contra\s+la\s+discriminaci[oó]n\b/i },
  L20393: { id: 1008668, nombre: "Ley 20.393 (responsabilidad penal de personas juridicas)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?393\b|\bresponsabilidad\s+penal\s+de\s+(?:las\s+)?personas\s+jur[ií]dicas\b|\bmodelo\s+de\s+prevenci[oó]n\s+de\s+delitos\b/i, artsSemilla: ["1", "3", "4"] },
  L20285: { id: 276363, nombre: "Ley 20.285 (acceso a la informacion publica / transparencia)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?285\b|\bacceso\s+a\s+la\s+informaci[oó]n\s+p[uú]blica\b|\bLey\s+de\s+Transparencia\b/i },
  L21220: { id: 1143741, nombre: "Ley 21.220 (trabajo a distancia / teletrabajo)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?220\b|\btrabajo\s+a\s+distancia\b|\bteletrabajo\b/i },
  L19585: { id: 126366, nombre: "Ley 19.585 (filiacion)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?585\b|\bfiliaci[oó]n\b/i },
  L20422: { id: 1010903, nombre: "Ley 20.422 (inclusion de personas con discapacidad)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?422\b|\binclusi[oó]n\s+social\s+de\s+personas\s+con\s+discapacidad\b/i },
  L20584: { id: 1039348, nombre: "Ley 20.584 (derechos y deberes de los pacientes)", detect: /\bLey\s*n?[°º.\s]*20\.?\s?584\b|\bderechos\s+(?:y\s+deberes\s+)?(?:de\s+las\s+)?personas\s+en\s+relaci[oó]n\s+con\s+acciones\s+de\s+salud\b|\bderechos\s+del\s+paciente\b/i },
  L16618: { id: 28581, nombre: "Ley 16.618 (ley de menores)", detect: /\bLey\s*n?[°º.\s]*16\.?\s?618\b|\bLey\s+de\s+Menores\b/i },
  L19799: { id: 196640, nombre: "Ley 19.799 (documentos y firma electronica)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?799\b|\bfirma\s+electr[oó]nica\b|\bdocumentos\s+electr[oó]nicos\b/i },
  L19966: { id: 229834, nombre: "Ley 19.966 (regimen de garantias en salud / GES)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?966\b|\bgarant[ií]as\s+expl[ií]citas\s+en\s+salud\b|\bGES\b|\bAUGE\b/i },
  L21120: { id: 1126480, nombre: "Ley 21.120 (identidad de genero)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?120\b|\bidentidad\s+de\s+g[eé]nero\b/i },
  L21302: { id: 1154203, nombre: "Ley 21.302 (proteccion especializada a la ninez y adolescencia)", detect: /\bLey\s*n?[°º.\s]*21\.?\s?302\b|\bServicio\s+Nacional\s+de\s+Protecci[oó]n\s+Especializada\b/i },
  L19253: { id: 30620, nombre: "Ley 19.253 (proteccion de pueblos indigenas)", detect: /\bLey\s*n?[°º.\s]*19\.?\s?253\b|\bpueblos?\s+ind[ií]genas?\b|\bLey\s+Ind[ií]gena\b/i },

};


// Leyes notorias citadas por NUMERO que conviene tener resueltas sin pasar por
// el canal genérico idLey (ahorra 1 consulta y evita el tope MAX_GENERICOS).
// VALOR = idNorma VERIFICADO contra el XML oficial (2026-11-02,
// scripts/qa-semilla-bcn.ts). ANTES este mapa guardaba el NUMERO DE LEY en el
// campo idNorma: "Ley 18.916" descargaba idNorma=18916 = "Decreto 2226:
// pension por gracia a Santiago Florio Cvitanic" — texto de OTRO cuerpo
// inyectado como verdad normativa (hallazgo de la auditoria de semilla).
// "Ley 8.274" no existe en el indice de Ley Chile (idLey=8274 responde vacio):
// esa etiqueta falsa se elimino; el Codigo de Justicia Militar (Decreto 2226,
// idNorma 18914) vive ahora en NORMA_IDS detectado por su nombre.
const LEY_EXTRA: Record<string, { nombre: string; idNorma: number }> = {
  "18916": { nombre: "Codigo Aeronautico (Ley 18.916)", idNorma: 30287 },
  "18248": { nombre: "Codigo de Mineria (Ley 18.248)", idNorma: 29668 },
  "20886": { nombre: "Ley 20.886 (tramitacion electronica)", idNorma: 1085545 },
  "19537": { nombre: "Ley 19.537 (copropiedad inmobiliaria)", idNorma: 81505 },
  "20830": { nombre: "Ley 20.830 (AUC)", idNorma: 1075210 },
  "20609": { nombre: "Ley 20.609 (no discriminacion)", idNorma: 1042092 },
  "20393": { nombre: "Ley 20.393 (RP personas juridicas)", idNorma: 1008668 },
  "20285": { nombre: "Ley 20.285 (transparencia)", idNorma: 276363 },
  "21220": { nombre: "Ley 21.220 (teletrabajo)", idNorma: 1143741 },
  "19585": { nombre: "Ley 19.585 (filiacion)", idNorma: 126366 },
  "20422": { nombre: "Ley 20.422 (discapacidad)", idNorma: 1010903 },
  "20584": { nombre: "Ley 20.584 (derechos pacientes)", idNorma: 1039348 },
  "16618": { nombre: "Ley 16.618 (menores)", idNorma: 28581 },
  "19799": { nombre: "Ley 19.799 (firma electronica)", idNorma: 196640 },
  "19966": { nombre: "Ley 19.966 (GES)", idNorma: 229834 },
  "21120": { nombre: "Ley 21.120 (identidad de genero)", idNorma: 1126480 },
  "21302": { nombre: "Ley 21.302 (proteccion ninez)", idNorma: 1154203 },
  "19253": { nombre: "Ley 19.253 (pueblos indigenas)", idNorma: 30620 },
};
export { LEY_EXTRA };

const LIMITA_DIARIO = 300;
const TTL_NORMA = 24 * 60 * 60 * 1000;

interface NormaCacheEntry { xml: string; fechaVersion: string; derogado: boolean; normaId?: number; fetchedAt: number; }
type NormaCacheState = { ok: NormaCacheEntry } | { error: string; fetchedAt: number };

const normaCache = new Map<number, NormaCacheState>();
let contadorDiario = 0;
let contadorDia = "";

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function puedeConsultar(): boolean {
  const d = hoy();
  if (contadorDia !== d) { contadorDia = d; contadorDiario = 0; }
  return contadorDiario < LIMITA_DIARIO;
}

function registrarConsulta(): void {
  contadorDiario += 1;
}

function decodeXml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, d: string) => {
      const n = parseInt(d, 10);
      if (n === 160) return " ";
      try { return String.fromCharCode(n); } catch { return " "; }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => {
      const n = parseInt(h, 16);
      if (n === 160) return " ";
      try { return String.fromCharCode(n); } catch { return " "; }
    })
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function quitarTags(s: string): string {
  return s.replace(/<\/?[A-Za-z][^>]*>/g, "");
}

function limpiarTexto(s: string): string {
  return quitarTags(decodeXml(s))
    .replace(/\r/g, "")
    .replace(/\s{3,}(?:L\.\s*\d|D\.?(?:F\.)?L\.\s*\d|D\.O\.)[^\n]*$/gm, "")
    .split("\n")
    .map((l) => {
      const t = l.trim();
      if (!t) return "";
      if (/^\d+(?:[.,)]\s*)?$/.test(t)) return "";
      if (t.length <= 26 && /^(?:L\.|D\.?L\.|D\.F\.L\.|D\.O\.|Ley\s|Art\.(?:\s|\d)*$)/i.test(t)) return "";
      return t;
    })
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchXMLOnce(id: number, byLey = false): Promise<string> {
  const url = byLey
    ? `https://www.leychile.cl/Consulta/obtxml?opt=7&idLey=${id}`
    : `https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=${id}`;
  // La cuota diaria cuenta INTENTOS (no solo exitos): es la cortesia real
  // hacia leychile (un retry cuenta como consulta).
  registrarConsulta();
  const res = await fetch(url, {
    headers: { "User-Agent": "legalhelp.cl/1.0 (uso verificacion normativa; contacto soporte@legalhelp.cl)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`obtxml status ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();
  if (!ct.includes("xml") && !body.includes("<Identificador") && !body.includes("<Norma")) throw new Error("obtxml sin XML");
  return body;
}

// ── Resiliencia de ingesta BCN (2026-10-29, auditoria post-prod) ────────────
// Evidencia: prod funciona (draft con citas -> XML oficial vigente), pero un
// blip transitorio (conn refused, 5xx, HTML sin XML) dejaba el bloque BCN
// ciego para ese draft: 1 solo intento, error cacheado 3 min en la lambda y
// catchs silenciosos. Ahora: 1 retry SOLO si la falla fue rapida (<5s). Un
// timeout largo (25s) NO se reintenta para no duplicar la latencia del draft.
// maxMs inyectable para QA determinista.
export const RETRY_UMBRAL_MS = 5000;

export async function conReintentosRapido(fn: () => Promise<string>, maxMs: number = RETRY_UMBRAL_MS): Promise<string> {
  const t0 = Date.now();
  try {
    return await fn();
  } catch (e) {
    if (Date.now() - t0 >= maxMs) throw e;
    return await fn();
  }
}

function fetchXML(id: number, byLey = false): Promise<string> {
  return conReintentosRapido(() => fetchXMLOnce(id, byLey));
}

async function getNorma(id: number, byLey = false): Promise<NormaCacheEntry | null> {
  const cached = normaCache.get(id);
  if (cached) {
    if ("ok" in cached && Date.now() - cached.ok.fetchedAt < TTL_NORMA) return cached.ok;
    if ("error" in cached && Date.now() - cached.fetchedAt < 3 * 60 * 1000) return null;
  }
  try {
    const xml = await fetchXML(id, byLey);
    const enc = xml.slice(0, 4000);
    const fvM = enc.match(/fechaVersion="([0-9-]{8,10})"/);
    // Fase I.4 — guardia de sanidad: el XML del Código Civil (DFL 1, 2000)
    // trae fechaVersion="2222-02-02" (dato del BCN, verificado contra el
    // XML real). Una fecha fuera de [1990, año actual+1] no se publica como
    // versión: se omite (queda vigente+URL, que es lo verificable). Nunca se
    // inventa una fecha de reemplazo.
    const fvBruta = fvM ? decodeXml(fvM[1]) : "";
    const fvAnio = fvBruta ? parseInt(fvBruta.slice(0, 4), 10) : NaN;
    const fvValida = !Number.isNaN(fvAnio) && fvAnio >= 1990 && fvAnio <= new Date().getFullYear() + 1;
    const derM = enc.match(/derogado="([^"]+)"/);
    const niM = xml.match(/normaId="(\d+)"/);
    const entry: NormaCacheEntry = {
      xml,
      fechaVersion: fvValida ? fvBruta : "",
      derogado: derM ? decodeXml(derM[1]).startsWith("derogado") : false,
      // El normaId canónico vive más allá del encabezado (en normas grandes
      // queda fuera de los primeros 4000 chars): se busca en TODO el cuerpo.
      normaId: niM ? parseInt(niM[1], 10) : undefined,
      fetchedAt: Date.now(),
    };
    normaCache.set(id, { ok: entry });
    return entry;
  } catch {
    normaCache.set(id, { error: "fetch", fetchedAt: Date.now() });
    return null;
  }
}

function extraerPartes(xml: string): Array<{ idParte?: string; nombre?: string; texto: string }> {
  const out: Array<{ idParte?: string; nombre?: string; texto: string }> = [];
  const re = /<EstructuraFuncional[^>]*tipoParte="Art(?:[^\w>]|&#\d+;|[^\s>])*[^>]*>([\s\S]*?)<\/EstructuraFuncional>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attr = m[0].slice(0, m[0].indexOf(">"));
    const idParteM = attr.match(/idParte="(\d+)"/);
    const nombreM = m[1].match(/<NombreParte[^>]*>([\s\S]*?)<\/NombreParte>/);
    const textoM = m[1].match(/<Texto>([\s\S]*?)<\/Texto>/);
    out.push({
      idParte: idParteM ? idParteM[1] : undefined,
      nombre: nombreM ? limpiarTexto(nombreM[1]) : undefined,
      texto: textoM ? limpiarTexto(textoM[1]) : "",
    });
  }
  return out;
}

function normNum(s: string): string {
  const base = decodeXml(s).trim().replace(/[°º]+/g, "").replace(/\./g, "").replace(/\s+/g, " ").trim();
  const mLetra = base.match(/^0*(\d+)\s*[-–\s]\s*([A-Za-z])$/);
  if (mLetra) return `${mLetra[1] || "0"}-${mLetra[2].toUpperCase()}`;
  return base.replace(/\s+/g, "").replace(/^0+/, "") || "0";
}

// Reconoce singular y plural ("artículo", "artículos", "art.", "arts."),
// sufijos con guion-letra ("18-A", "18-C"), rangos ("18-A a 18-K") y listas
// ("artículos 1545, 1552, 1924 y 1927", "artículos 1567 N° 1 y 1568",
// "Artículos 254, 309"), saltando sub-numerales ("N° 1", "N° 2 y 3", "inciso 2°")
// y glosas entre paréntesis para no confundir un numeral con otro artículo.
const ART_HEAD_RE = /\b(?:art[ií]culos?|arts?\.?)\s*(?:n[°ºo.]?\s*)?(\d{1,4}(?:\.\d{3})?(?:\s*[-–]\s*[A-Za-z])?)[°º]?/gi;

function extraerMencionesArticulos(textoLimpio: string): Array<{ n: string; idx: number; endIdx: number }> {
  const out: Array<{ n: string; idx: number; endIdx: number }> = [];
  ART_HEAD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ART_HEAD_RE.exec(textoLimpio)) !== null) {
    const startIdx = m.index;
    const primero = normNum(m[1]);
    let cursor = startIdx + m[0].length;
    const items: string[] = [primero];

    // ¿Rango con letra del mismo artículo base? Ej: "Artículos 18-A a 18-K"
    const mRango = textoLimpio.slice(cursor, cursor + 36).match(/^\s*(?:a|al|hasta)\s+(?:el\s+)?(?:art[ií]culos?|arts?\.?)?\s*(\d{1,4})\s*[-–]\s*([A-Za-z])\b/i);
    const mBaseLetra = primero.match(/^(\d+)-([A-Z])$/);
    if (mRango && mBaseLetra && mRango[1] === mBaseLetra[1]) {
      const cIni = mBaseLetra[2].charCodeAt(0);
      const cFin = mRango[2].toUpperCase().charCodeAt(0);
      if (cFin > cIni && cFin - cIni <= 15) {
        for (let c = cIni + 1; c <= cFin; c++) items.push(`${mBaseLetra[1]}-${String.fromCharCode(c)}`);
        cursor += mRango[0].length;
      }
    }

    // Consumir lista posterior (", 1552, 1924 y 1927", "N° 1 y 1568", "(glosa), 1552")
    for (let pasos = 0; pasos < 10; pasos++) {
      const resto = textoLimpio.slice(cursor, cursor + 180);
      const mMod = resto.match(/^(?:\s*(?:n[°ºo.]?\s*\d{1,2}(?:\s+y\s+\d{1,2})?\b|incisos?\s+(?:primero|segundo|tercero|cuarto|quinto|final|\d+[°º]?)|\([^()\n]{1,90}\)))+/i);
      const offsetMod = mMod ? mMod[0].length : 0;
      const trasMod = resto.slice(offsetMod);
      const mSig = trasMod.match(/^\s*(?:,\s*(?:y\s+)?|\b(?:y|e)\s+)(\d{1,4}(?:\.\d{3})?(?:\s*[-–]\s*[A-Za-z])?)[°º]?(?!\s*(?:de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)|a[ñn]os?|d[ií]as?|meses|uf\b|utm\b|pesos|clp|%))/i);
      if (!mSig) {
        cursor += offsetMod;
        break;
      }
      items.push(normNum(mSig[1]));
      cursor += offsetMod + mSig[0].length;
    }

    for (const it of items) {
      out.push({ n: it, idx: startIdx, endIdx: cursor });
    }
  }
  return out;
}

// ====== Fase 4: indice de leyes en Postgres (si DATABASE_URL existe) ======
// Tabla leyes: numero de ley -> idNorma canónico. La resolución de una ley
// apenas cambia (ids estables), por eso vive en DB y no en caché efímera.
type PgPool = { query: (sql: string, vals?: any[]) => Promise<{ rows: any[] }> };
let leyesPool: PgPool | null = null;
let leyesSchemaP: Promise<void> | null = null;
let warnedDbLeyes = false;

async function getLeyesPool(): Promise<PgPool | null> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  if (leyesPool) return leyesPool;
  try {
    const mod: any = await import("pg");
    // Supabase: CA propia no incluida en Node (ver orderStore).
    const pool: PgPool = new mod.Pool({ connectionString: url, ssl: url.includes("sslmode=") ? { rejectUnauthorized: false } : undefined, max: 2, connectionTimeoutMillis: 8000 });
    leyesSchemaP = pool
      .query(`CREATE TABLE IF NOT EXISTS leyes (
         ley_num     INTEGER PRIMARY KEY,
         tipo        TEXT,
         numero      TEXT,
         nombre      TEXT,
         idnorma     BIGINT NOT NULL,
         resuelto_en TIMESTAMPTZ NOT NULL DEFAULT now()
       );`)
      .then(() => undefined)
      .catch((e: any) => { leyesSchemaP = null; throw e; });
    leyesPool = pool;
    return pool;
  } catch (e: any) {
    warnDbLeyes(`No se abrió el índice de leyes en DB (${String(e?.message || e).slice(0, 120)}). Sigo con el índice en memoria.`);
    return null;
  }
}

function warnDbLeyes(msg: string): void {
  if (warnedDbLeyes) return;
  console.error(`[leyes] ${msg}`);
  warnedDbLeyes = true;
}

// resolverLeyGenerica: resuelve "Ley N° X" -> { idNorma canónico, nombre }.
// Capas: (1) memoria de proceso, (2) tabla leyes de Postgres, (3) Ley Chile
// vía idLey (verificando Tipo=Ley y Numero=X) y persistencia en DB.
const resolucionMem = new Map<string, { idNorma: number; nombre: string }>();
const resolucionFallada = new Map<string, number>();
const FALLA_TTL = 30 * 60 * 1000;

async function resolverLeyGenerica(leyNum: string): Promise<{ idNorma: number; nombre: string } | null> {
  // Tolera "18.290", "18290" y "Ley 18575" (parseInt pelado corta los miles).
  const numNorma = String(parseInt(String(leyNum).replace(/\./g, ""), 10));
  if (!numNorma || numNorma === "NaN") return null;
  const mem = resolucionMem.get(numNorma);
  if (mem) return mem;
  const falla = resolucionFallada.get(numNorma);
  if (falla && Date.now() - falla < FALLA_TTL) return null;

  // (2) índice persistente
  try {
    const pool = await getLeyesPool();
    if (pool && leyesSchemaP) await leyesSchemaP;
    if (pool) {
      const r = await pool.query(`SELECT idnorma, nombre FROM leyes WHERE ley_num = $1 LIMIT 1`, [parseInt(numNorma, 10)]);
      if (r.rows[0]) {
        const hit = { idNorma: Number(r.rows[0].idnorma), nombre: String(r.rows[0].nombre || `Ley ${numNorma}`) };
        resolucionMem.set(numNorma, hit);
        return hit;
      }
    }
  } catch (e: any) {
    warnDbLeyes(`Lectura del índice de leyes falló (${String(e?.message || e).slice(0, 120)}). Sigo con la resolución en vivo.`);
  }

  // (3) canal directo idLey
  if (!puedeConsultar()) return null;
  try {
    const entry = await getNorma(parseInt(numNorma, 10), true);
    if (!entry) { resolucionFallada.set(numNorma, Date.now()); return null; }
    // Verificación del Identificador: el cuerpo DEBE ser una Ley con ese num.
    const idm = entry.xml.slice(0, 4000).match(/<Tipo>\s*([A-Za-zÓóÉé\.Áá\s]+?)\s*<\/Tipo>\s*<Numero>\s*(\d+)\s*<\/Numero>/);
    const tipo = idm ? decodeXml(idm[1]).trim() : "";
    const num = idm ? idm[2] : "";
    if (tipo !== "Ley" || num !== numNorma) {
      resolucionFallada.set(numNorma, Date.now());
      return null; // DL/DFL no debe cachearse como si fuera esta Ley.
    }
    const tituloM = entry.xml.slice(0, 20000).match(/<TituloNorma[^>]*>([\s\S]{0,300}?)<\/TituloNorma>/);
    const nombre = tituloM ? limpiarTexto(tituloM[1]).slice(0, 100) : `Ley ${numNorma}`;
    const idNorma = entry.normaId || parseInt(numNorma, 10);
    const hit = { idNorma, nombre };
    resolucionMem.set(numNorma, hit);
    // Sembrar la caché bajo el idNorma canónico: el fetch posterior del
    // articulado (getNorma(idNorma)) reutiliza este XML en vez de re-descargar.
    if (entry.normaId) normaCache.set(entry.normaId, { ok: entry });
    // Persistir en DB (fire and forget: no bloquea la respuesta).
    try {
      const pool = await getLeyesPool();
      if (pool) {
        if (leyesSchemaP) await leyesSchemaP;
        await pool.query(
          `INSERT INTO leyes (ley_num, tipo, numero, nombre, idnorma) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (ley_num) DO UPDATE SET tipo=EXCLUDED.tipo, numero=EXCLUDED.numero, nombre=EXCLUDED.nombre, idnorma=EXCLUDED.idnorma, resuelto_en=now()`,
          [parseInt(numNorma, 10), tipo, num, nombre, idNorma]
        );
      }
    } catch (e: any) {
      warnDbLeyes(`Escritura del índice de leyes falló (${String(e?.message || e).slice(0, 120)}).`);
    }
    return hit;
  } catch {
    resolucionFallada.set(numNorma, Date.now());
    return null;
  }
}

// ====== Fase 4: cruce articulo <-> norma (determinístico, sin red) ======
// Union de la tabla semilla + patrones genericos "Ley N° X.XXX" (+ fuentes extra).
export interface NormaDetectada { key: string; nombre?: string; idNorma: number | null; leyNum?: string; idx: number; end: number; resuelta: boolean; }
export interface CitaPareada { num: string; idx: number; norma: NormaDetectada | null; }

function detectarNormas(textoPost: string): NormaDetectada[] {
  const out: NormaDetectada[] = [];
  for (const [key, def] of Object.entries(NORMA_IDS)) {
    const re = new RegExp(def.detect.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(textoPost)) !== null) {
      out.push({ key, nombre: def.nombre, idNorma: def.id, idx: m.index, end: m.index + m[0].length, resuelta: true });
    }
  }
  const reLey = /\bLey\s*(?:N[°º.]?\s*)?(\d{1,2}(?:\.\d{3})|\d{4,5})\b/gi;
  let lm: RegExpExecArray | null;
  while ((lm = reLey.exec(textoPost)) !== null) {
    const numNorma = String(parseInt(lm[1].replace(/\./g, ""), 10));
    // skip si este span ya lo cubre al semilla (evita duplicar "Ley 18.290").
    const spanA = lm.index, spanB = lm.index + lm[0].length;
    if (out.some((n) => n.resuelta && spanA >= n.idx - 8 && spanB <= n.end + 8)) continue;
    const extra = LEY_EXTRA[numNorma];
    out.push({
      key: `LEY${numNorma}`,
      nombre: extra ? extra.nombre : undefined,
      idNorma: extra ? extra.idNorma : null,
      leyNum: numNorma,
      idx: spanA, end: spanB,
      resuelta: Boolean(extra),
    });
  }
  return out.sort((a, b) => a.idx - b.idx);
}

export function extraerCitadasPorNorma(texto: string): { pares: CitaPareada[]; sinNorma: string[]; normas: NormaDetectada[] } {
  const textoLimpio = texto
    .replace(/\s{3,}(?:L\.?\s*\d|D\.?(?:F\.)?L\.|D\.O\.)[^\n]*$/gm, "")
    .replace(/\s{3,}(?:Art(?:\.|ículo)?\s*\d+[^\n]*)$/gm, "");
  const normas = detectarNormas(textoLimpio);
  const arts = extraerMencionesArticulos(textoLimpio);
  const pares: CitaPareada[] = [];
  // Tope por artículos ÚNICOS por norma (antes contaba ocurrencias repetidas
  // y al llegar a 12 menciones en el texto dejaba el resto de los artículos de
  // esa misma ley con norma=null).
  const unicosPorNorma = new Map<string, Set<string>>();
  for (const a of arts) {
    // ventana de emparejamiento: primero el cuerpo mas cercano DESPUES del
    // articulo o fin de lista ("Arts. 1545, 1552 y 1924 del Código Civil") hasta
    // 140 chars; si no hay, el cuerpo anterior mas cercano hasta 400 chars atras.
    const refFin = a.endIdx ?? a.idx;
    const despues = normas
      .filter((n) => {
        if (n.idx < a.idx || n.idx - refFin >= 140) return false;
        const entre = textoLimpio.slice(refFin, n.idx);
        if (/[;:\n]/.test(entre)) return false;
        if (/\b(?:art[ií]culos?|arts?\.?)\s*\d/i.test(entre)) return false;
        return true;
      })
      .sort((x, y) => x.idx - y.idx)[0];
    const anterior = normas.filter((c) => c.idx < a.idx && a.idx - c.idx < 400).sort((x, y) => y.idx - x.idx)[0];
    // "Norma, Art. N" (a ±3 chars) manda; si no, gana la norma que viene después.
    const preNominalInmediata = anterior && a.idx - anterior.end <= 3;
    let elegida = preNominalInmediata ? anterior : (despues ?? anterior ?? null);
    // Fase I.3 — construcción gramatical "Artículos N (y siguientes) DEL
    // <cuerpo>": el cuerpo que sigue conectado por del/de la/de los MANDA sobre
    // cualquier norma nombrada antes. Caso real: "Competencia Desleal
    // (Artículos 2314 y siguientes del Código Civil, en relación con la Ley
    // 20.165)" emparejaba el 2314 a la Ley de Competencia Desleal por la regla
    // prenominal, cuando el 2314 es del Código Civil.
    if (despues) {
      const entreDespues = textoLimpio.slice(refFin, despues.idx);
      if (/^\s*(?:(?:y|,)\s*\w+\s+){0,3}(?:del|de\s+la|de\s+los|de)\s*$/i.test(entreDespues)) {
        elegida = despues;
      }
    }
    const nk = normNum(a.n);
    if (elegida) {
      let setU = unicosPorNorma.get(elegida.key);
      if (!setU) { setU = new Set(); unicosPorNorma.set(elegida.key, setU); }
      if (setU.has(nk) || setU.size < 16) {
        setU.add(nk);
        pares.push({ num: nk, idx: a.idx, norma: elegida });
      } else {
        pares.push({ num: nk, idx: a.idx, norma: elegida });
      }
    } else {
      pares.push({ num: nk, idx: a.idx, norma: null });
    }
  }
  // arts que quedaron sin norma: los distintos
  const sinNorma: string[] = [];
  for (const p of pares) if (!p.norma && !sinNorma.includes(p.num)) sinNorma.push(p.num);
  return { pares, sinNorma: sinNorma.slice(0, 20), normas };
}

export async function verificarCitasBCN(
  textos: string[],
  opts?: { permitirSemilla?: boolean },
): Promise<{ verificados: BcnArticuloVerificado[]; pendientes: BcnNormaSinArticulo[] }> {
  const texto = textos.filter(Boolean).join("\n");
  if (!texto) return { verificados: [], pendientes: [] };

  const { pares, normas } = extraerCitadasPorNorma(texto);
  if (!pares.length) return { verificados: [], pendientes: [] };

  // Resolver las normas genericas (idLey) que tengan al menos un articulo pareado.
  // Tope por llamada: el texto del usuario puede citar muchas leyes y cada
  // resolucion cuesta una descarga BCN (latencia + cuota diaria).
  const MAX_GENERICOS = 8;
  let genericasResueltas = 0;
  for (const n of normas) {
    if (n.resuelta || !n.leyNum) continue;
    if (!pares.some((p) => p.norma === n)) continue;
    if (!puedeConsultar() || genericasResueltas >= MAX_GENERICOS) { n.resuelta = false; continue; }
    genericasResueltas += 1;
    const r = await resolverLeyGenerica(n.leyNum);
    if (r) { n.idNorma = r.idNorma; n.nombre = r.nombre; n.resuelta = true; }
    else n.resuelta = false;
  }

  const verificados: BcnArticuloVerificado[] = [];
  const pendientes: BcnNormaSinArticulo[] = [];
  const vistas = new Map<string, Set<string>>(); // keyNorma -> art nums pendientes de resolver

  for (const p of pares) {
    if (!p.norma) continue;
    let setV = vistas.get(p.norma.key);
    if (!setV) { setV = new Set(); vistas.set(p.norma.key, setV); }
    if (!setV.has(p.num) && setV.size < 12) setV.add(p.num);
  }

  for (const [key, numeros] of vistas) {
    const n = normas.find((x) => x.key === key);
    if (!n) continue;
    const articulos = Array.from(numeros);
    const idNorma = n.idNorma;
    const nombre = n.nombre || `Ley ${n.leyNum || key}`;
    if (!idNorma || !n.resuelta) {
      pendientes.push({
        keyNorma: key, nombreNorma: nombre, idNorma: idNorma || 0,
        articulosPedidos: articulos,
        motivo: !puedeConsultar() ? "limite_diario" : "norma_no_resoluble",
      });
      continue;
    }
    const norma = puedeConsultar() ? await getNorma(idNorma) : null;
    if (!norma) {
      pendientes.push({
        keyNorma: key, nombreNorma: nombre, idNorma,
        articulosPedidos: articulos,
        motivo: puedeConsultar() ? "norma_no_disponible" : "limite_diario",
      });
      continue;
    }
    const partes = extraerPartes(norma.xml);
    const faltantes: string[] = [];
    for (const num of articulos) {
      const parte = partes.find((p) => {
        const nom = p.nombre ? normNum(p.nombre) : "";
        if (nom === num) return true;
        const head = p.texto.match(/^(?:Art(?:[íi]culo|\.)\s*)?(\d{1,4}(?:\s*[-–]\s*[A-Za-z])?)/i);
        return Boolean(head) && normNum(head![1]) === num;
      });
      if (!parte || !parte.texto) { faltantes.push(num); continue; }
      verificados.push({
        keyNorma: key,
        nombreNorma: nombre,
        idNorma,
        articulo: num,
        idParte: parte.idParte,
        vigente: !norma.derogado,
        fechaVersion: norma.fechaVersion,
        texto: parte.texto.slice(0, 1600),
        url: `https://www.bcn.cl/leychile/navegar?idNorma=${idNorma}${parte.idParte ? `&idParte=${parte.idParte}` : ""}`,
      });
    }
    if (faltantes.length === articulos.length) {
      pendientes.push({
        keyNorma: key, nombreNorma: nombre, idNorma,
        articulosPedidos: faltantes, motivo: "articulo_no_encontrado",
      });
    }
  }

  // ── Fase I.3: ley especial detectada SIN artículos citados ────────────────
  // Si el caso invoca una ley de la semilla por su materia ("competencia
  // desleal") pero sin artículos, se traen sus arts. semilla del XML oficial:
  // el prompt recibe el texto base y el modelo puede auditar la cita (p. ej.
  // una demanda que cita "Ley 20.165" cuando la de competencia desleal es la
  // 20.169). Tope: una ley semilla por llamada.
  // Fase I.4 — SOLO en el pase sobre el TEXTO DEL CASO (pre-pase, default):
  // sobre texto GENERADO por el modelo la semilla inyecta leyes que el relato
  // nunca invocó (caso real: el informe mencionó "insolvencia punible" —un
  // delito penal— y el pie llenó arts. 1/2/4 de la Ley 20.720 en un cobro de
  // pagaré). Los post-pases pasan { permitirSemilla: false }.
  let semillasTraidas = 0;
  const semillaHabilitada = opts?.permitirSemilla !== false;
  for (const n of normas) {
    if (!semillaHabilitada || semillasTraidas >= 1) break;
    const seed = NORMA_IDS[n.key]?.artsSemilla;
    if (!seed || !seed.length || !n.idNorma) continue;
    if (vistas.has(n.key)) continue; // el caso ya citó artículos de esta ley
    if (!puedeConsultar()) continue;
    semillasTraidas += 1;
    try {
      const norma = await getNorma(n.idNorma);
      if (!norma) continue;
      const partes = extraerPartes(norma.xml);
      for (const num of seed) {
        const parte = partes.find((p) => {
          const nom = p.nombre ? normNum(p.nombre) : "";
          if (nom === num) return true;
          const head = p.texto.match(/^(?:Art(?:[íi]culo|\.)\s*)?(\d{1,4}(?:\s*[-–]\s*[A-Za-z])?)/i);
          return Boolean(head) && normNum(head![1]) === num;
        });
        if (!parte || !parte.texto) continue;
        verificados.push({
          keyNorma: n.key,
          nombreNorma: n.nombre || NORMA_IDS[n.key].nombre,
          idNorma: n.idNorma,
          articulo: num,
          idParte: parte.idParte,
          vigente: !norma.derogado,
          fechaVersion: norma.fechaVersion,
          texto: parte.texto.slice(0, 1600),
          url: `https://www.bcn.cl/leychile/navegar?idNorma=${n.idNorma}${parte.idParte ? `&idParte=${parte.idParte}` : ""}`,
          viaSemilla: true,
        });
      }
    } catch { /* semilla best-effort: nunca rompe la verificación */ }
  }

  verificados.sort((a, b) => a.nombreNorma.localeCompare(b.nombreNorma) || Number(a.articulo) - Number(b.articulo));
  return { verificados, pendientes };
}

/**
 * Fecha de CONSULTA del canal BCN: es HOY (cuándo consultamos Ley Chile), no
 * la fecha de versión de la norma. Fase I.4: antes devolvía max(fechaVersion)
 * y el pie decía "consultado el 2222-02-02" — un dato de versionamiento de
 * DFL del BCN presentado como fecha de consulta. La versión de cada norma se
 * muestra por artículo ("versión vigente ..."), no aquí.
 */
export function fechaConsultaBCN(_fechas: string[]): string {
  return new Date().toISOString().slice(0, 10);
}

export function bloquePromptBCN(v: { verificados: BcnArticuloVerificado[]; pendientes: BcnNormaSinArticulo[] }): string {
  if (v.verificados.length === 0 && v.pendientes.length === 0) return "";
  const fecha = fechaConsultaBCN(v.verificados.map((x) => x.fechaVersion).filter(Boolean));
  let s = `\n\nVERIFICACION NORMATIVA OFICIAL (Ley Chile - BCN, consultado el ${fecha}). ` +
    `Estos textos fueron extraidos del XML oficial de Ley Chile Y SON FUENTE MAS PRIORITARIA QUE CUALQUIER RESULTADO DE BUSQUEDA WEB. ` +
    `Usalos como VERDAD NORMATIVA al revisar articulos citados en el dictamen:\n`;
  for (const a of v.verificados.slice(0, 24)) {
    if (a.viaSemilla) {
      s += `\n[LEY INVOCADA EN EL CASO SIN ARTICULO CITADO — texto base oficial] ${a.nombreNorma}, Art. ${a.articulo}:\n${a.texto}\n`;
    } else {
      s += `\n[ACTUAL ${a.fechaVersion || ""}] ${a.nombreNorma}, Art. ${a.articulo}:\n${a.texto}\n`;
    }
  }
  if (v.verificados.some((a) => a.viaSemilla)) {
    s += `\nSi el caso o el dictamen cita esa ley con un NUMERO distinto al oficial de arriba (p. ej. cita "Ley 20.165" y el texto oficial es la Ley 20.169), senalalo expresamente: es un error de cita del documento. Si el contexto del caso corresponde a esa ley, usala como fuente normativa.\n`;
  }
  if (v.pendientes.length > 0) {
    s += `\nCuerpos citados que NO se pudieron validar por este canal (verificalos con la web como antes):\n`;
    for (const p of v.pendientes.slice(0, 12)) {
      s += `- ${p.nombreNorma} (arts. ${p.articulosPedidos.join(", ")})\n`;
    }
  }
  s += `\nSi el dictamen contradice el texto ACTUAL que ves arriba, senalalo expresamente con la seccion 2 ("verificado en Ley Chile - BCN").\n`;
  return s;
}

export const ATRIBUCION_BCN = "Fuente: Ley Chile - Biblioteca del Congreso Nacional de Chile (BCN), consultado el {fecha}. Textos con licencia CC BY-NC-ND 4.0.";

/** Fase I.2: pie de verificación para el diagnóstico GRATUITO. Cada cita del
 *  análisis generado se contrastó contra el XML oficial de Ley Chile; el
 *  resultado se agrega al final del propio análisis (✅ verificado con URL /
 *  ⚠️ no confirmado con motivo). Solo nombres, artículos y URLs: no reproduce
 *  textos de artículos (la atribución de licencia va igual, por corrección). */
export function pieVerificacionBCN(
  v: { verificados: BcnArticuloVerificado[]; pendientes: BcnNormaSinArticulo[] },
  degradado: boolean,
): string {
  if (v.verificados.length === 0 && v.pendientes.length === 0) return "";
  const fecha = fechaConsultaBCN(v.verificados.map((x) => x.fechaVersion).filter(Boolean) as string[]);
  const lineas: string[] = [`## Verificación de citas — Ley Chile (BCN), consultado el ${fecha}`];
  if (v.verificados.length > 0) {
    lineas.push(`**Artículos verificados contra el texto oficial:**`);
    for (const a of v.verificados.slice(0, 12)) {
      lineas.push(`- ✅ ${a.nombreNorma}, Art. ${a.articulo}${a.vigente ? "" : " (⚠️ el texto traído NO está vigente)"} — [ver en Ley Chile](${a.url})`);
    }
  }
  if (v.pendientes.length > 0) {
    lineas.push(`**Citas no confirmadas por BCN (verifícalas antes de usarlas):**`);
    for (const p of v.pendientes.slice(0, 8)) {
      const arts = (p.articulosPedidos || []).length ? `, art. ${p.articulosPedidos.join(", ")}` : "";
      lineas.push(`- ⚠️ ${p.nombreNorma}${arts} — no confirmado (${p.motivo})`);
    }
  }
  if (degradado) {
    lineas.push(`_Ley Chile no respondió en este request: la verificación quedó incompleta. Reintenta más tarde._`);
  }
  lineas.push(`Fuente: Ley Chile - Biblioteca del Congreso Nacional de Chile (BCN). Textos con licencia CC BY-NC-ND 4.0.`);
  return lineas.join("\n");
}
