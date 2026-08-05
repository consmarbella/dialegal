export interface SEOPage {
  slug: string;
  h1: string;
  diagnosText: string;
  ctaText: string;
  bullets: string[];
  faqs: { q: string; a: string }[];
  titleSEO: string;
  metaDescription: string;
  intent: string;
  caseType: string;
  role: 'demandante' | 'demandado' | 'consulta';
}

export const SEO_PAGES_BATCH2: SEOPage[] = [
  // ═════════ LABORAL (3) ═════════
  {
    slug: '/que-hacer-si-no-me-pagan-el-finiquito',
    h1: 'Qué hacer si no me pagan el finiquito en Chile',
    diagnosText: 'Cuando el empleador no paga el finiquito o paga menos de lo correspondiente, no es solo una molestia: es un incumplimiento que puedes reclamar. Tienes 60 días hábiles desde el término de la relación laboral para demandar el cobro. Antes de demandar, envía una carta de reclamo a la Inspección del Trabajo y, si el empleador insiste, presenta la demanda en el Juzgado de Letras del Trabajo.',
    ctaText: 'Analizar mi finiquito impago',
    bullets: [
      'El finiquito debe pagarse y ratificarse ante la Inspección del Trabajo o un notario; la falta de pago es una infracción sancionable por la Inspección.',
      'Puedes demandar el cobro del finiquito dentro de los 60 días hábiles siguientes al término de la relación laboral.',
      'Si el empleador no tiene cómo pagar, la Inspección del Trabajo puede aplicar multas y, en casos graves, el automático de la empresa se declara en la práctica.',
      'Documentos que debes reunir: finiquito firmado o propuesto, liquidaciones de sueldo, contrato de trabajo y comprobante del aviso de despido.',
    ],
    faqs: [
      { q: '¿Cuánto tiempo tengo para reclamar el finiquito?', a: 'La acción para demandar el cobro del finiquito prescribe a los 60 días hábiles desde el término del vínculo laboral.' },
      { q: '¿Necesito abogado para reclamar el finiquito?', a: 'Sí. La demanda laboral requiere patrocinio de abogado, aunque puedes acudir a la Corporación de Asistencia Judicial si no puedes costear uno.' },
    ],
    titleSEO: 'Qué Hacer si No Me Pagan el Finiquito | Cobro Laboral Chile',
    metaDescription: 'Tu empleador no te paga el finiquito. Aprende cómo reclamar ante la Inspección del Trabajo y demandar el cobro en el plazo de 60 días hábiles.',
    intent: 'Mi empleador no me pagó el finiquito y quiero saber cómo reclamarlo.',
    caseType: 'laboral',
    role: 'demandante',
  },
  {
    slug: '/que-hago-si-me-quieren-despedir',
    h1: 'Qué hacer si me quieren despedir | Protege tus derechos',
    diagnosText: 'Si sabes que te van a despedir, puedes prepararte para no perder derechos. No firmes documentos bajo presión, revisa si tienes fuero laboral (embarazo, dirigente sindical, ley Sanna), verifica que tus cotizaciones estén al día y no aceptes una renuncia voluntaria si la causal real es otra. El autodespido puede ser tu alternativa si el empleador incumple.',
    ctaText: 'Analizar mi situación laboral',
    bullets: [
      'El fuero laboral prohíbe el despido sin autorización judicial previa: embarazo, lactancia, dirigentes sindicales y trabajadores con fuero maternal o paternal.',
      'Si firmas una renuncia simulada, puedes demandar la nulidad del despido indirecto y recuperar las indemnizaciones.',
      'Revisa en la Inspección del Trabajo o previred.com que tus cotizaciones previsionales y de salud estén pagadas al día.',
      'Documentos que debes reunir: contrato, liquidaciones, registro de asistencia y cualquier comunicación escrita del empleador.',
    ],
    faqs: [
      { q: '¿Puedo ser despedido estando embarazada?', a: 'No sin autorización judicial. El fuero maternal exige que el empleador solicite la desafuero al tribunal, o el despido es nulo.' },
      { q: '¿Qué hago si me presionan a renunciar?', a: 'No firmes. Si renuncias pierdes indemnizaciones. Reúne evidencia de la presión y, si el empleador incumple, ejercita el autodespido (Art. 171 CT).' },
    ],
    titleSEO: 'Qué Hacer si Me Quieren Despedir | Protege tus Derechos',
    metaDescription: 'Te quieren despedir y quieres protegerte: fuero laboral, cotizaciones al día, renuncia simulada y cuándo ejercer el autodespido en Chile.',
    intent: 'Me quieren despedir y quiero saber cómo protegerme antes de que ocurra.',
    caseType: 'laboral',
    role: 'demandante',
  },
  {
    slug: '/como-saber-si-mi-despido-fue-legal',
    h1: 'Cómo saber si mi despido fue legal en Chile',
    diagnosText: 'Para que el despido sea legal, el empleador debe invocar una causal real de las del Código del Trabajo, comunicarla por escrito dentro de los 3 días hábiles y poner las cotizaciones al día. Si la causal invocada no fue la real, no se comunicó por escrito o las cotizaciones no están pagadas, el despido probablemente sea injustificado o nulo.',
    ctaText: 'Analizar si mi despido fue legal',
    bullets: [
      'La carta de despido debe expresar la causal y los hechos exactos que la fundamentan; si no coincide con lo sucedido, el despido es injustificado.',
      'La comunicación de la causal debe entregarse al trabajador dentro de los 3 días hábiles siguientes al despido (Art. 162 CT).',
      'Si las cotizaciones previsionales no están enteradas al momento del despido, procede la nulidad del despido (Ley Bustos) y el pago de remuneraciones hasta la convalidación.',
      'Documentos que debes reunir: carta de despido, finiquito, liquidaciones y certificado de cotizaciones al día.',
    ],
    faqs: [
      { q: '¿Qué pasa si la carta de despido no tiene causal real?', a: 'El despido se considera injustificado e indebido, y tienes derecho a las indemnizaciones legales (años de servicio, aviso previo y recargos).' },
      { q: '¿Cuándo el despido es nulo y no solo injustificado?', a: 'Es nulo cuando el trabajador tiene fuero y no se obtuvo autorización judicial, o cuando no se pagaron las cotizaciones al momento del despido (nulidad de la Ley Bustos).' },
    ],
    titleSEO: 'Cómo Saber si Mi Despido Fue Legal | Causal y Formalidades',
    metaDescription: 'Aprende a detectar un despido injustificado o nulo en Chile: causal real, carta dentro de 3 días, cotizaciones al día y tus derechos.',
    intent: 'Quiero saber si mi despido cumplió los requisitos legales o puedo demandarlo.',
    caseType: 'laboral',
    role: 'demandante',
  },

  // ═════════ ARRIENDO (1) ═════════
  {
    slug: '/que-pasa-si-no-pago-el-arriendo',
    h1: '¿Qué pasa si no pago el arriendo? Consecuencias en Chile',
    diagnosText: 'No pagar el arriendo tiene consecuencias progresivas: el arrendador puede exigir el pago con intereses, demandar la terminación del contrato por incumplimiento grave y, finalmente, solicitar el lanzamiento o desalojo con auxilio de la fuerza pública. Si estás en mora, actúa rápido: llega a un acuerdo, consigna el pago o prepárate para defenderte.',
    ctaText: 'Analizar mi deuda de arriendo',
    bullets: [
      'Con un mes de renta impaga el arrendador puede demandar la terminación del contrato y el desalojo; con dos o más meses, la acción es más contundente.',
      'El lanzamiento se ejecuta con orden judicial y ayuda de Carabineros: resistirse es un delito, pero puedes pedir plazos de entrega voluntaria.',
      'Si enfrentas un juicio, tienes 5 días hábiles en Policía Local para contestar y oponer excepciones, como el pago o los vicios del inmueble.',
      'Documentos que debes reunir: contrato de arriendo, comprobantes de pago de las rentas anteriores, informes de daños y tu cédula de identidad.',
    ],
    faqs: [
      { q: '¿Cuánto tiempo tengo antes de que me desalojen?', a: 'El proceso varía: un desalojo sin oposición puede tomar 2 a 4 meses desde la demanda. Con contestación, puede extenderse a 8-14 meses.' },
      { q: '¿Puedo evitar el desalojo si pago la deuda?', a: 'Sí. Acreditar el pago o consignar las rentas adeudadas puede suspender el juicio y evitar el lanzamiento.' },
    ],
    titleSEO: '¿Qué Pasa si No Pago el Arriendo? | Consecuencias en Chile',
    metaDescription: 'No pagar el arriendo en Chile: mora, demanda de terminación de contrato, desalojo y cómo defenderte o llegar a un acuerdo.',
    intent: 'No puedo pagar el arriendo y quiero saber qué consecuencias tiene.',
    caseType: 'arriendo',
    role: 'demandado',
  },

  // ═════════ DEUDAS (3) ═════════
  {
    slug: '/que-pasa-si-me-embargan',
    h1: '¿Qué pasa si me embargan? Proceso y qué hacer',
    diagnosText: 'El embargo es la traba de tus bienes ordenada por un tribunal para asegurar el pago de una deuda. Suele ser el resultado de un juicio ejecutivo: el receptor va a tu domicilio o trabajo e inventaría bienes embargables. No es el fin del mundo: puedes alzar el embargo pagando, oponiendo excepciones o acreditando que los bienes son inembargables.',
    ctaText: 'Analizar mi embargo',
    bullets: [
      'El embargo debe ser ordenado por un tribunal mediante un mandamiento de ejecución; sin ese documento, el receptor no puede embargar legítimamente.',
      'Tras el embargo tienes 8 días hábiles para oponer excepciones (Art. 464 CPC) y solicitar el alzamiento.',
      'Los bienes inembargables (cama, cocina, herramientas de trabajo, uniformes) no pueden trabarse; si ocurre, pide su desafectación.',
      'Documentos que debes reunir: mandamiento ejecutivo, acta de embargo, título de la deuda y comprobante de bienes embargados.',
    ],
    faqs: [
      { q: '¿Pueden embargar mi sueldo?', a: 'Solo la parte que exceda de 56 UTM líquidas mensuales. Sobre ese exceso, el embargo está limitado a un porcentaje.' },
      { q: '¿Qué sigue después del embargo?', a: 'Si no opones excepciones, el tribunal ordena el avalúo y el remate de los bienes para pagar la deuda, los intereses y las costas.' },
    ],
    titleSEO: '¿Qué Pasa si Me Embargan? | Proceso y Defensa en Chile',
    metaDescription: 'Te embargan bienes en Chile: cómo funciona el juicio ejecutivo, qué bienes son inembargables y cómo alzar el embargo con excepciones.',
    intent: 'Ya me embargaron y necesito saber qué hacer y cómo defender mis bienes.',
    caseType: 'deuda',
    role: 'demandado',
  },
  {
    slug: '/como-negociar-una-deuda',
    h1: 'Cómo negociar una deuda en Chile | Acuerdos y Repactación',
    diagnosText: 'Negociar es la vía más rápida y menos traumática para salir de una deuda. Puedes pedir un convenio de pago directo con el acreedor, la repactación en la institución financiera, o acogerte a la renegociación de la Ley 20.720 en la Superintendencia de Insolvencia y Repron. Una negociación bien planteada puede rebajar intereses, congelar la mora y evitar el embargo.',
    ctaText: 'Analizar mi deuda para negociar',
    bullets: [
      'Antes de negociar, reúne el detalle: deuda total, intereses y mora. Con esa cifra puedes proponer un pago a cuotas que sí puedas cumplir.',
      'La repactación en el mismo banco o financiera suele rebajar la cuota, pero alarga el plazo e incrementa los intereses totales.',
      'La renegociación de la Ley 20.720 suspende los embargos y juicios en tu contra mientras se tramita el acuerdo de pago.',
      'Documentos que debes reunir: estados de cuenta, cartolas de deuda, comprobantes de ingresos y tu presupuesto mensual real.',
    ],
    faqs: [
      { q: '¿Conviene repactar o renegociar?', a: 'Repactar mantiene la deuda en el banco; renegociar bajo la Ley 20.720 suspende embargos y fija un plan para todos los acreedores. Depende de tu caso.' },
      { q: '¿Pueden rebajarme los intereses si negocio?', a: 'Sí. Muchos acreedores están dispuestos a condonar parte de los intereses de mora si pagas el capital o firmas un convenio realista.' },
    ],
    titleSEO: 'Cómo Negociar una Deuda en Chile | Repactación y Ley 20.720',
    metaDescription: 'Negocia tu deuda en Chile: convenio de pago, repactación, renegociación Ley 20.720 y cómo evitar el embargo. Pasos y documentos.',
    intent: 'Quiero negociar mi deuda para evitar el juicio y el embargo.',
    caseType: 'deuda',
    role: 'consulta',
  },
  {
    slug: '/que-hacer-si-me-cobran-una-deuda-que-no-reconozco',
    h1: 'Qué hacer si me cobran una deuda que no reconozco',
    diagnosText: 'Si te están cobrando una deuda que no reconoces, no la pagues ni la ignores: actúa con método. Pide al cobrador el detalle por escrito (acreedor, título, monto y fecha), revisa si la deuda prescribió, verifica si fuiste incluido sin notificación válida y reclama formalmente a la empresa, a la CMF si es una entidad fiscalizada y, si corresponde, denuncia el fraude bancario.',
    ctaText: 'Analizar mi cobro no reconocido',
    bullets: [
      'Exige por escrito el comprobante de la deuda: sin título ejecutivo válido, no pueden embargarte legítimamente.',
      'Si la deuda no es tuya o ya prescribió, envía una carta de reclamo y exige la eliminación de tu nombre de Dicom/Equifax.',
      'Si una deuda ajena aparece por usurpación de identidad o clonación, denuncia ante la PDI y ante la entidad financiera para su investigación.',
      'Documentos que debes reunir: cartolas, comprobantes de pago, carta de reclamo y antecedentes de tu identidad (cédula, DICOM actualizado).',
    ],
    faqs: [
      { q: '¿Qué pasa si no pago una deuda que no es mía?', a: 'No pagues. Reclama por escrito y exige que el acreedor acredite el título. Si te incluyen en Dicom indebidamente, puedes reclamar la baja y demandar por daño reputacional.' },
      { q: '¿A quién denuncio un cobro fraudulento a mi nombre?', a: 'Presenta la denuncia por usurpación de identidad en la PDI y notifica a la entidad financiera y a la CMF si la empresa está fiscalizada.' },
    ],
    titleSEO: 'Qué Hacer si Me Cobran una Deuda que No Reconozco',
    metaDescription: 'Te cobran una deuda que no es tuya: cómo reclamar, exigir el título, salir de Dicom y denunciar el fraude o la usurpación de identidad.',
    intent: 'Me están cobrando una deuda que no reconozco y quiero saber cómo defenderme.',
    caseType: 'deuda',
    role: 'demandado',
  },

  // ═════════ FAMILIA (5) ═════════
  {
    slug: '/que-hacer-si-no-me-pagan-la-pension',
    h1: 'Qué hacer si no me pagan la pensión de alimentos',
    diagnosText: 'Cuando el alimentante deja de pagar la pensión, puedes pedir al tribunal medidas de apremio: arresto nocturno de hasta 15 días renovable, arraigo nacional, retención de devolución de impuestos, suspensión de licencia de conducir y embargo. Si la deuda alcanza 5 o más cuotas, el deudor queda en el Registro Nacional de Deudores de Pensiones de Alimentos.',
    ctaText: 'Analizar mi pensión impaga',
    bullets: [
      'El arresto nocturno es la medida más contundente: se cumple desde las 22:00 hasta las 06:00 horas por un máximo de 15 días, renovable.',
      'La retención de la devolución de impuestos y el embargo de bienes aseguran el pago de las cuotas atrasadas.',
      'Con 5 o más cuotas impagas, el deudor entra al Registro Nacional de Deudores de Alimentos y pierde el acceso al pasaporte y a la licencia de conducir.',
      'Documentos que debes reunir: sentencia de alimentos o acuerdo, comprobantes de pago anteriores y la liquidación de la deuda actualizada.',
    ],
    faqs: [
      { q: '¿Cuánto demora el apremio contra el deudor de alimentos?', a: 'El tribunal evalúa la solicitud en audiencia. Con una causal de mora acreditada, el arresto u otras medidas pueden decretarse dentro de las semanas siguientes.' },
      { q: '¿Puedo pedir el pago retroactivo de la pensión impaga?', a: 'Sí. La demanda o solicitud puede incluir la liquidación de las cuotas adeudadas desde la mora, previa actualización de la deuda ante el tribunal.' },
    ],
    titleSEO: 'Qué Hacer si No Me Pagan la Pensión | Apremio y Deuda',
    metaDescription: 'No te pagan la pensión de alimentos: medidas de apremio como arresto nocturno, embargo, retención de impuestos y Registro de Deudores.',
    intent: 'El otro progenitor no me paga la pensión y quiero saber cómo cobrarla.',
    caseType: 'familia',
    role: 'demandante',
  },
  {
    slug: '/como-aumentar-la-pension-alimenticia',
    h1: 'Cómo aumentar la pensión alimenticia en Chile',
    diagnosText: 'La pensión de alimentos puede aumentarse si cambian las circunstancias: mayores necesidades del alimentario (salud, educación, recreación) o mayor capacidad económica del alimentante. Se presenta una demanda de aumento de alimentos ante el mismo Juzgado de Familia, acreditando con pruebas las nuevas necesidades o ingresos.',
    ctaText: 'Analizar mi aumento de pensión',
    bullets: [
      'El aumento exige acreditar el cambio de circunstancias desde la fijación original: no basta la sola petición.',
      'Documentos de respaldo: comprobantes de colegiatura, gastos médicos, actividades extrarprogramáticas y liquidaciones de sueldo del alimentante.',
      'El tribunal puede fijar alimentos provisorios mayores desde la primera audiencia mientras se tramita el aumento definitivo.',
      'Documentos que debes reunir: sentencia o acuerdo de alimentos vigente, comprobantes de gastos y la liquidación de ingresos del alimentante.',
    ],
    faqs: [
      { q: '¿Cada cuánto puedo pedir el reajuste de la pensión?', a: 'No hay plazo mínimo, pero el tribunal evalúa si efectivamente cambiaron las circunstancias. Un aumento de gastos o de ingresos justifica la demanda.' },
      { q: '¿Qué pasa si el alimentante tiene más hijos?', a: 'Se pondera la capacidad económica total y la distribución entre todos los alimentarios. Más cargas puede reducir el porcentaje por cada hijo.' },
    ],
    titleSEO: 'Cómo Aumentar la Pensión Alimenticia en Chile | Reajuste',
    metaDescription: 'Demanda de aumento de pensión de alimentos en Chile: cómo acreditar nuevas necesidades, documentos y plazos ante el Juzgado de Familia.',
    intent: 'Necesito aumentar la pensión de alimentos porque las necesidades de mi hijo crecieron.',
    caseType: 'familia',
    role: 'demandante',
  },
  {
    slug: '/como-rebajar-la-pension-alimenticia',
    h1: 'Cómo rebajar la pensión alimenticia en Chile',
    diagnosText: 'La pensión puede rebajarse cuando cambian las condiciones: el alimentante pierde el trabajo, su ingreso baja o sus cargas aumentan (nuevos hijos, deudas de salud). Se presenta una demanda de rebaja de alimentos al Juzgado de Familia acreditando la nueva situación económica con finiquito, cartas de despido, liquidaciones o certificados de cargas.',
    ctaText: 'Analizar mi rebaja de pensión',
    bullets: [
      'La rebaja exige probar el cambio real de capacidad económica: no basta alegar la pérdida del ingreso si no se acredita.',
      'Documentos clave: finiquito, liquidación de cesantía, certificado de cargas familiares y comprobantes de gastos médicos o deudas.',
      'El tribunal puede fijar provisoriamente una pensión menor mientras se tramita la rebaja definitiva, previa acreditación de la nueva situación.',
      'Documentos que debes reunir: sentencia o acuerdo de alimentos, comprobantes de la caída de ingresos y estado de costos actuales.',
    ],
    faqs: [
      { q: '¿Pueden rebajarme la pensión si estoy cesante?', a: 'Sí, si acreditas la cesantía con finiquito o carta de despido. Mientras permanece el desempleo, el tribunal puede fijar una pensión proporcional a tu nueva capacidad.' },
      { q: '¿Qué pasa si me rebajaron y luego recupero el empleo?', a: 'El alimentario puede demandar nuevamente el aumento si tus ingresos se recuperan. Las pensiones se ajustan según las circunstancias vigentes.' },
    ],
    titleSEO: 'Cómo Rebajar la Pensión Alimenticia en Chile | Cálculo',
    metaDescription: 'Demanda de rebaja de pensión de alimentos en Chile: qué acreditar (cesantía, bajos ingresos), documentos y cómo el tribunal recalcula.',
    intent: 'Perdí ingresos y necesito rebajar la pensión de alimentos.',
    caseType: 'familia',
    role: 'demandado',
  },
  {
    slug: '/como-inscribir-a-un-hijo-en-chile',
    h1: 'Cómo inscribir a un hijo en Chile | Registro Civil',
    diagnosText: 'La inscripción del nacimiento es obligatoria en el Registro Civil dentro de los 60 días desde el nacimiento. Se realiza con el certificado de nacimiento del hospital o maternidad, la cédula de los padres y, según el caso, el certificado de matrimonio o el acta de reconocimiento. Este trámite es gratuito y entrega el certificado de nacimiento con el RUT del niño.',
    ctaText: 'Analizar mi inscripción de hijo',
    bullets: [
      'El plazo legal de inscripción es de 60 días desde el nacimiento; el Registro Civil puede aplicar multa por inscripción tardía.',
      'Si los padres no están casados, ambos deben concurrir a reconocer al hijo, o el padre puede reconocerlo mediante escritura pública o demanda de paternidad.',
      'La inscripción otorga el RUT y el RUN del niño, necesarios para salud, educación y beneficios estatales.',
      'Documentos que debes reunir: certificado de nacimiento de la maternidad, cédula de identidad de los padres y, si aplica, certificado de matrimonio.',
    ],
    faqs: [
      { q: '¿Dónde inscribo a mi hijo recién nacido?', a: 'En cualquier oficina del Registro Civil de Chile. Puedes pedir hora en línea y acudir con los documentos requeridos.' },
      { q: '¿Qué pasa si no inscribo a tiempo?', a: 'La inscripción tardía tiene multas según los tramos del Registro Civil y puede generar demoras en el RUT del niño y sus beneficios.' },
    ],
    titleSEO: 'Cómo Inscribir a un Hijo en Chile | Registro Civil',
    metaDescription: 'Inscripción de nacimiento en Chile: requisitos, plazo de 60 días, reconocimiento de paternidad y dónde hacer el trámite en el Registro Civil.',
    intent: 'Necesito inscribir a mi hijo en el Registro Civil y quiero conocer los requisitos.',
    caseType: 'familia',
    role: 'consulta',
  },
  {
    slug: '/como-reclamar-la-paternidad',
    h1: 'Cómo reclamar la paternidad en Chile | Procedimiento',
    diagnosText: 'Si el padre no reconoce voluntariamente al hijo, la madre, el hijo o la familia pueden demandar la determinación de la paternidad ante el Juzgado de Familia. El tribunal ordena la prueba de ADN si es necesaria y, de acreditarse el vínculo, el padre asume la obligación de alimentos y los derechos sucesorios.',
    ctaText: 'Analizar mi reclamo de paternidad',
    bullets: [
      'La demanda de paternidad puede presentarla la madre, con autorización del hijo según la edad, o el propio hijo.',
      'El tribunal puede decretar la prueba de ADN; la negativa injustificada del padre genera la presunción legal de paternidad.',
      'Al determinarse la paternidad, se fijan los alimentos retroactivos y el padre entra en la sucesión del hijo.',
      'Documentos que debes reunir: certificado de nacimiento, antecedentes del presunto padre y cualquier medio de prueba de la relación.',
    ],
    faqs: [
      { q: '¿Cuánto tarda la prueba de ADN en Chile?', a: 'El examen se realiza en laboratorios acreditados y el resultado suele estar listo en semanas. El tribunal lo ordena dentro del juicio de paternidad.' },
      { q: '¿Puedo reclamar la paternidad después de muchos años?', a: 'Sí. La acción de reclamación de paternidad no prescribe en los mismos términos que otras materias y puede ejercerse conforme a la regulación del Código Civil.' },
    ],
    titleSEO: 'Cómo Reclamar la Paternidad en Chile | Prueba de ADN',
    metaDescription: 'Demanda de determinación de paternidad en Chile: quién puede demandar, prueba de ADN, presunción por negativa y efectos en alimentos.',
    intent: 'El padre no reconoce a mi hijo y quiero demandar la paternidad.',
    caseType: 'familia',
    role: 'demandante',
  },

  // ═════════ HERENCIAS (1) ═════════
  {
    slug: '/como-impugnar-un-testamento',
    h1: 'Cómo impugnar un testamento en Chile',
    diagnosText: 'Un testamento puede impugnarse por vicios de forma (no cumplir las solemnidades legales) o de fondo (vulnerar la legítima de los herederos, testar sin capacidad o bajo presión, o por indignidad del heredero). La impugnación se tramita ante el Juzgado Civil y puede llevar a anular el testamento o a modificar la distribución forzosa.',
    ctaText: 'Analizar mi impugnación de testamento',
    bullets: [
      'Las asignaciones forzosas (legítima de hijos y cónyuge) no pueden eliminarse: si el testamento las vulnera, procede la acción de reforma o impugnación.',
      'Quien impugna debe acreditar el vicio: la falta de testigos, la incapacidad del testador o la coacción son ejemplos típicos.',
      'Dentro del juicio de partición y de impugnación se puede solicitar la prueba pericial grafotécnica o el examen psicológico si se discute la capacidad.',
      'Documentos que debes reunir: testamento impugnado, certificado de defunción, certificados de nacimiento de herederos y pruebas del vicio alegado.',
    ],
    faqs: [
      { q: '¿Cuánto cuesta impugnar un testamento?', a: 'Un juicio de impugnación es complejo: los honorarios de abogado suelen partir en $1.000.000 y las costas dependen de las pruebas y peritajes.' },
      { q: '¿Puedo impugnar el testamento por la legítima?', a: 'Sí. Si el testador dispuso más de lo que la ley permite libremente y vulneró la legítima de los herederos legitimarios, puedes impugnar o pedir la reforma del testamento.' },
    ],
    titleSEO: 'Cómo Impugnar un Testamento en Chile | Vicios y Legítima',
    metaDescription: 'Impugna un testamento en Chile por vicios de forma o de fondo: legítima vulnerada, incapacidad, coacción y cómo tramitar el juicio.',
    intent: 'Quiero impugnar un testamento porque vulnera mis derechos como heredero.',
    caseType: 'civil',
    role: 'demandante',
  },

  // ═════════ PENAL (4) ═════════
  {
    slug: '/que-hago-si-me-acusan-de-estafa',
    h1: 'Qué hago si me acusan de estafa en Chile',
    diagnosText: 'Si te acusan de estafa (Art. 468 Código Penal), actúa con calma y asesoría: no declares sin abogado, revisa la formalización y las medidas cautelares, y evalúa salidas alternativas o la defensa de fondo. La prueba del engaño y del perjuicio es compleja, por lo que una defensa técnica temprana puede desvirtuar la imputación.',
    ctaText: 'Analizar mi defensa por estafa',
    bullets: [
      'En el control de detención o formalización puedes solicitar la suspensión condicional del procedimiento o la salida alternativa correspondiente.',
      'La defensa se centra en desvirtuar el engaño, la intención defraudatoria o el vínculo causal entre ellos y el perjuicio alegado.',
      'Si eres imputado y no tienes abogado, la Defensoría Penal Pública asigna uno gratuito de inmediato.',
      'Documentos que debes reunir: citación, notificaciones, comunicaciones del Ministerio Público, contratos y correos que acrediten tu versión.',
    ],
    faqs: [
      { q: '¿Qué pasa si me detienen y me formalizan por estafa?', a: 'En la audiencia de control de detención (24 horas) y de formalización, el juez evalúa la prisión preventiva u otras cautelares. Un abogado puede solicitar medidas menos gravosas.' },
      { q: '¿La estafa puede resolverse por salidas alternativas?', a: 'Sí. Si reparas el perjuicio o no hay antecedentes, la suspensión condicional o el acuerdo reparatorio son opciones frecuentes en delitos patrimoniales.' },
    ],
    titleSEO: 'Qué Hago si Me Acusan de Estafa | Defensa Penal Chile',
    metaDescription: 'Te acusan de estafa en Chile: tus derechos desde la detención, medidas cautelares, salidas alternativas y cómo preparar la defensa.',
    intent: 'Estoy imputado por estafa y necesito saber cómo defenderme.',
    caseType: 'penal',
    role: 'demandado',
  },
  {
    slug: '/que-hago-si-me-agredieron',
    h1: 'Qué hacer si me agredieron en Chile | Denuncia y Lesiones',
    diagnosText: 'Si fuiste agredido físicamente, lo primero es resguardar tu salud y luego denunciar: puedes hacerlo en Carabineros, la PDI o el Ministerio Público. Las lesiones se clasifican en leves, menos graves y graves, con penas y querellas distintas. Guarda todos los antecedentes médicos: son la prueba esencial del delito.',
    ctaText: 'Analizar mi caso de agresión',
    bullets: [
      'La denuncia puede hacerse en cualquier cuartel de Carabineros o fiscalía; no es necesaria una querella para que investiguen las lesiones.',
      'El parte de lesiones del servicio de urgencia y los informes médicos son la prueba central para acreditar la gravedad y el nexo con la agresión.',
      'Puedes querellarte criminalmente para participar activamente en el proceso y pedir la reparación o indemnización civil.',
      'Documentos que debes reunir: parte de lesiones, informes médicos, fotografías de las lesiones, testigos y la identificación del agresor.',
    ],
    faqs: [
      { q: '¿Qué pasa si las lesiones son leves?', a: 'Las lesiones leves son falta o delito menor y pueden resolverse mediante salidas alternativas. La querella y la prueba médica determinan el rumbo.' },
      { q: '¿Necesito abogado para denunciar una agresión?', a: 'Para denunciar no. Pero para querellarte y reclamar indemnización necesitas patrocinio de abogado o el apoyo de la Defensoría de Víctimas.' },
    ],
    titleSEO: 'Qué Hacer si Me Agredieron | Denuncia de Lesiones en Chile',
    metaDescription: 'Fuiste agredido en Chile: cómo denunciar ante Carabineros o la fiscalía, clasificación de lesiones y la prueba médica necesaria.',
    intent: 'Me agredieron físicamente y quiero denunciar y reclamar.',
    caseType: 'penal',
    role: 'demandante',
  },
  {
    slug: '/como-denunciar-un-delito-en-chile',
    h1: 'Cómo denunciar un delito en Chile | Guía de Canales',
    diagnosText: 'Denunciar un delito es el primer paso para que el Estado investigue y sancione. Puedes hacerlo en Carabineros, la PDI, el Ministerio Público o, para ciertos delitos, en el Juzgado de Garantía. La denuncia puede ser verbal o escrita, y no requiere abogado. Si quieres participar activamente, presenta una querella con patrocinio de abogado.',
    ctaText: 'Analizar mi denuncia',
    bullets: [
      'Canales de denuncia: Carabineros, PDI, fiscalía y Juzgados de Garantía. Ante emergencias urgentes, llama al 133 (Carabineros) o 134 (PDI).',
      'La denuncia no requiere querella: basta el relato de los hechos y la identificación del imputado si la conoces.',
      'La querella exige patrocinio de abogado y te convierte en parte querellante, lo que permite pedir diligencias y la reparación del daño.',
      'Documentos que debes reunir: cédula de identidad, antecedentes del hecho (fotos, videos, testigos) y copia de la denuncia o constancia.',
    ],
    faqs: [
      { q: '¿Cuál es la diferencia entre denuncia y querella?', a: 'La denuncia es un aviso al Ministerio Público para que investigue; la querella te hace parte del proceso y requiere abogado.' },
      { q: '¿Puedo denunciar en línea?', a: 'Sí. En la página de la fiscalía y Carabineros puedes hacer denuncias en línea para varios delitos, y luego formalizarlas presencialmente si se requiere.' },
    ],
    titleSEO: 'Cómo Denunciar un Delito en Chile | Carabineros, PDI y Fiscalía',
    metaDescription: 'Guía para denunciar un delito en Chile: canales (Carabineros, PDI, fiscalía), diferencia con la querella y documentos necesarios.',
    intent: 'Necesito saber cómo y dónde denunciar un delito.',
    caseType: 'penal',
    role: 'demandante',
  },
  {
    slug: '/me-llego-una-denuncia-penal-que-hago',
    h1: 'Me llegó una denuncia penal, ¿qué hago?',
    diagnosText: 'Recibir una notificación de que eres imputado en una causa penal genera incertidumbre. Lo importante es no declarar sin abogado, revisar el contenido de la citación (formalización o audiencia) y conseguir representación: si no tienes recursos, la Defensoría Penal Pública te asigna un defensor. No faltes a la audiencia: la ausencia puede generar medidas cautelares.',
    ctaText: 'Analizar mi denuncia penal',
    bullets: [
      'Revisa la citación: identifica el tribunal, el ROL/RIT, la fecha de la audiencia y la descripción del hecho imputado.',
      'No declares ante Carabineros ni ante la fiscalía hasta que un abogado revise tu caso: tienes derecho a guardar silencio.',
      'Si no tienes abogado privado, la Defensoría Penal Pública asegura la defensa de todo imputado sin costo y desde la primera audiencia.',
      'Documentos que debes reunir: citación o notificación, tu cédula, y todos los correos, contratos o registros que sustenten tu versión de los hechos.',
    ],
    faqs: [
      { q: '¿Qué pasa si no voy a la audiencia?', a: 'La inasistencia puede generar la declaración de rebeldía, orden de detención y medidas cautelares. Es fundamental asistir con tu abogado defensor.' },
      { q: '¿Qué es la formalización de la investigación?', a: 'Es la audiencia donde el fiscal comunica formalmente los hechos y solicita medidas cautelares. Ahí se definen los plazos de investigación y se decide la prisión preventiva u otras medidas.' },
    ],
    titleSEO: 'Me Llegó una Denuncia Penal ¿Qué Hago? | Defensa',
    metaDescription: 'Te llegó una citación o denuncia penal en Chile: qué hacer antes de declarar, tus derechos, la Defensoría Penal gratuita y cómo prepararte.',
    intent: 'Me notificaron una denuncia penal en mi contra y no sé qué hacer.',
    caseType: 'penal',
    role: 'demandado',
  },

  // ═════════ CONSUMO (2) ═════════
  {
    slug: '/cobro-indebido-que-hacer',
    h1: 'Cobro indebido: qué hacer y cómo reclamarlo',
    diagnosText: 'Un cobro indebido es un cargo que no reconoces en una cuenta, tarjeta o servicio. Antes de pagar, reclama por escrito a la empresa: exige el detalle del cargo y su justificación. Si no responden, puedes acudir al SERNAC y, si es una entidad bancaria, a la CMF. Los cobros indebidos reiterados pueden generar la resolución del contrato e indemnización.',
    ctaText: 'Analizar mi cobro indebido',
    bullets: [
      'Reclama por escrito con copia y fecha: la empresa está obligada a responder; si no lo hace, el SERNAC puede mediar y sancionarla.',
      'En servicios bancarios, presenta el reclamo ante el OIRS de la entidad y luego ante la CMF si no hay solución en el plazo.',
      'Si el cobro indebido afecta tus cuentas o Dicom, solicita la rectificación del registro y la eliminación de la mora indebida.',
      'Documentos que debes reunir: estados de cuenta, comprobante del reclamo, cartas y el detalle del cargo cuestionado.',
    ],
    faqs: [
      { q: '¿Puedo desconocer un cargo y no pagarlo?', a: 'Sí. Contesta el cobro por escrito, exige el comprobante y, mientras se aclara, no pagues el monto cuestionado para no aceptarlo tácitamente.' },
      { q: '¿Hasta cuándo puedo reclamar un cobro indebido?', a: 'Depende del servicio. En general conviene reclamar cuanto antes; el SERNAC media y, para reclamar el monto, aplican los plazos de prescripción civil.' },
    ],
    titleSEO: 'Cobro Indebido: Qué Hacer | Reclamo SERNAC y CMF',
    metaDescription: 'Te hicieron un cobro indebido: cómo reclamar por escrito, acudir al SERNAC o la CMF y rectificar tu Dicom. Documentos y plazos.',
    intent: 'Me hicieron un cobro que no reconozco y quiero reclamarlo.',
    caseType: 'civil',
    role: 'demandante',
  },
  {
    slug: '/fraude-bancario-como-reclamar',
    h1: 'Fraude bancario en Chile: cómo reclamar y recuperar tu dinero',
    diagnosText: 'Ante un fraude bancario (clonación de tarjeta, transferencias no autorizadas, phishing), actúa de inmediato: bloquea la tarjeta o cuenta, reclama por escrito al banco dentro de los plazos de la Ley de Fraudes (Ley 20.009 y Ley 21.234) y denuncia en la PDI o fiscalía. Los usuarios están protegidos frente a operaciones no autorizadas, siempre que no medie negligencia.',
    ctaText: 'Analizar mi fraude bancario',
    bullets: [
      'La Ley de Fraudes obliga al banco a responder técnicamente y a devolver los montos de operaciones no autorizadas si no media negligencia del cliente.',
      'Reclama por escrito al OIRS del banco dentro del plazo legal y conserva el comprobante del reclamo.',
      'Denuncia los hechos ante la PDI para obtener el certificado y reforzar el reclamo ante el banco y la CMF.',
      'Documentos que debes reunir: estados de cuenta, comprobante de la operación no autorizada, reclamo al banco y denuncia ante la PDI.',
    ],
    faqs: [
      { q: '¿Me devuelven el dinero si clonan mi tarjeta?', a: 'Sí, si no hubo negligencia. La Ley de Fraudes obliga a la entidad a responder por las operaciones no autorizadas y a restituir los montos.' },
      { q: '¿Cuánto tarda el banco en responder el reclamo por fraude?', a: 'El banco debe responder dentro de los plazos de la Ley de Fraudes. Si no cumple, puedes reclamar ante la CMF y, en última instancia, demandar.' },
    ],
    titleSEO: 'Fraude Bancario en Chile | Cómo Reclamar tu Dinero',
    metaDescription: 'Clonaron tu tarjeta o hicieron transferencias sin tu autorización: pasos para bloquear, reclamar por la Ley de Fraudes y denunciar en la PDI.',
    intent: 'Sufrí un fraude bancario y quiero recuperar mi dinero.',
    caseType: 'civil',
    role: 'demandante',
  },

  // ═════════ CONTRATOS (1) ═════════
  {
    slug: '/como-anular-un-contrato',
    h1: 'Cómo anular un contrato en Chile | Nulidad y Vicios',
    diagnosText: 'Un contrato puede anularse cuando adolece de un vicio: objeto ilícito, causa ilícita, error, fuerza o dolo, o la incapacidad de una parte. La nulidad puede ser absoluta (anula el acto enteramente) o relativa (anulable), y se declara mediante la acción judicial de nulidad. Si firmaste bajo presión o te engañaron, esta es tu vía.',
    ctaText: 'Analizar mi nulidad contractual',
    bullets: [
      'La nulidad absoluta procede por objeto o causa ilícita y por vicios que afectan el interés público; puede invocarse por cualquier interesado.',
      'La nulidad relativa (anulabilidad) procede por error, fuerza, dolo o incapacidad y solo la puede invocar la parte perjudicada.',
      'El plazo para pedir la nulidad relativa es de 4 años desde la celebración o desde que cesó la fuerza o se descubrió el dolo.',
      'Documentos que debes reunir: contrato impugnado, pruebas del vicio (presión, engaño, error) y toda la correspondencia relacionada.',
    ],
    faqs: [
      { q: '¿Cuál es la diferencia entre nulidad y resolución?', a: 'La nulidad anula el contrato desde su origen por un vicio; la resolución lo termina por incumplimiento posterior de una parte.' },
      { q: '¿Puedo anular un contrato que firmé bajo presión?', a: 'Sí. La fuerza o intimidación es vicio de nulidad relativa. Debes acreditarla con pruebas y ejercer la acción dentro del plazo de 4 años.' },
    ],
    titleSEO: 'Cómo Anular un Contrato en Chile | Nulidad y Vicios',
    metaDescription: 'Anula un contrato en Chile por vicios: objeto o causa ilícita, error, fuerza, dolo o incapacidad. Requisitos y plazos de la nulidad.',
    intent: 'Quiero anular un contrato que firmé con un vicio.',
    caseType: 'civil',
    role: 'demandante',
  },
];