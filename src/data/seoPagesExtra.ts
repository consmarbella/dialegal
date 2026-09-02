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

export const SEO_PAGES_EXTRA: SEOPage[] = [
  // ═════════= FASE 1: DEFENSA / CONTESTACIÓN / ABOGADO (10) ═════════
  {
    slug: '/como-defenderse-de-un-juicio-de-arriendo',
    h1: 'Cómo defenderse de un juicio de arriendo en Chile',
    diagnosText: 'Si te demandaron por deuda de arriendo, terminación de contrato o desalojo, tu defensa depende de actuar rápido: tienes 5 días hábiles para contestar en Juzgado de Policía Local. Puedes oponer excepciones como el pago de la renta, la falta de legitimidad del arrendador o los vicios del inmueble que justifican retener el pago.',
    ctaText: 'Analizar mi defensa de arriendo',
    bullets: [
      'El plazo para contestar en Policía Local es de 5 días hábiles desde la notificación (Ley 18.287 Art. 32). No responder significa que el juez puede dar por reconocidos los hechos.',
      'Excepciones útiles: pago de la deuda, compensación, falta de legitimación activa del demandante, o vicios del inmueble que justifican retener la renta.',
      'Si enfrentas un lanzamiento inminente, puedes pedir al tribunal un plazo para la entrega voluntaria del inmueble, especialmente con menores o adultos mayores en el hogar.',
    ],
    faqs: [
      { q: '¿Qué pasa si no contesto la demanda de arriendo?', a: 'El tribunal declara tu rebeldía, tiene por reconocidos los hechos de la demanda y puede ordenar el lanzamiento en pocas semanas.' },
      { q: '¿Puedo detener un desalojo si pago la deuda?', a: 'Sí. Acreditar el pago de las rentas u ofrecer su consignación ante el tribunal es la defensa más efectiva y puede suspender el lanzamiento.' },
    ],
    titleSEO: 'Cómo Defenderse de un Juicio de Arriendo | Defensa Legal Chile',
    metaDescription: 'Te demandaron por arriendo. Aprende cómo defenderte: plazos para contestar, excepciones legales y cómo evitar un desalojo forzoso en Chile.',
    intent: 'Me demandaron por arriendo y necesito saber cómo defenderme y qué excepciones puedo oponer.',
    caseType: 'arriendo',
    role: 'demandado',
  },
  {
    slug: '/como-contestar-demanda-de-arriendo',
    h1: 'Cómo contestar una demanda de arriendo en Chile',
    diagnosText: 'La contestación de la demanda de arriendo es tu primera y principal oportunidad de defensa. En Juzgado de Policía Local tienes 5 días hábiles; en Juzgado Civil, 15 días hábiles. El escrito debe controvertir los hechos uno a uno, oponer las excepciones y ofrecer la prueba que acredite tu posición.',
    ctaText: 'Analizar mi contestación de arriendo',
    bullets: [
      'En la contestación debes negar o reconocer cada hecho de la demanda, nunca guardar silencio: el silencio puede interpretarse como aceptación.',
      'Excepciones dilatorias: falta de jurisdicción o incompetencia del tribunal. Excepciones perentorias: pago, compensación, prescripción o vicios del inmueble.',
      'Adjunta comprobantes: transferencias, recibos de pago, informes de humedad o daños, y todo medio de prueba de tu defensa.',
    ],
    faqs: [
      { q: '¿Puedo contestar sin abogado en Policía Local?', a: 'Sí. Hasta 8 UTM puedes comparecer personalmente en Juzgados de Policía Local. Sobre ese monto o en Juzgado Civil necesitas patrocinio de abogado (Ley 18.120).' },
      { q: '¿Qué pasa si contesto fuera de plazo?', a: 'La contestación extemporánea no se admite. El tribunal continúa el juicio y puede aplicar la rebeldía en tu contra.' },
    ],
    titleSEO: 'Cómo Contestar una Demanda de Arriendo | Plazos y Excepciones',
    metaDescription: 'Guía para contestar una demanda de arriendo en Chile: plazos en Policía Local y Civil, excepciones legales y cómo redactar tu escrito de defensa.',
    intent: 'Necesito saber cómo contestar la demanda de arriendo que recibí y qué excepciones oponer.',
    caseType: 'arriendo',
    role: 'demandado',
  },
  {
    slug: '/como-contestar-demanda-por-deuda',
    h1: 'Cómo contestar una demanda por deuda en Chile',
    diagnosText: 'Si recibiste una demanda ejecutiva por un pagaré, cheque o factura impaga, tienes 8 días hábiles para oponer excepciones (Art. 464 CPC). En un juicio ordinario por deuda, el plazo es de 15 días hábiles. Contestar a tiempo es lo único que puede detener el embargo y el remate de tus bienes.',
    ctaText: 'Analizar mi defensa por deuda',
    bullets: [
      'Excepciones del juicio ejecutivo (Art. 464 CPC): pago, prescripción de la acción, nulidad del título, falsedad de la firma, exceso de avalúo y falta de requisitos del título.',
      'La prescripción de la acción ejecutiva es de 3 años y la ordinaria de 5 años desde que la obligación se hizo exigible.',
      'Si la deuda es legítima, negociar un acuerdo de pago antes de la audiencia puede ahorrarte costas y el remate de bienes.',
    ],
    faqs: [
      { q: '¿Me pueden embargar durante el juicio ejecutivo?', a: 'Sí. El embargo se decreta al inicio del juicio ejecutivo. Puedes solicitar su alzamiento si opones excepciones que lo justifiquen o si pagas la deuda.' },
      { q: '¿Qué pasa si no opongo excepciones?', a: 'El tribunal ordena seguir adelante con la ejecución y rematar los bienes embargados para pagar la deuda más intereses y costas.' },
    ],
    titleSEO: 'Cómo Contestar una Demanda por Deuda | Juicio Ejecutivo y Excepciones',
    metaDescription: 'Te demandaron por una deuda. Descubre cómo contestar, las excepciones del Art. 464 CPC, plazos y cómo detener un embargo en Chile.',
    intent: 'Me demandaron por deuda y quiero saber cómo contestar y qué excepciones legales puedo oponer.',
    caseType: 'deuda',
    role: 'demandado',
  },
  {
    slug: '/como-contestar-demanda-laboral',
    h1: 'Cómo contestar una demanda laboral en Chile',
    diagnosText: 'Como empleador demandado por despido injustificado, nulidad del despido o tutela laboral, debes presentar tu contestación por escrito a lo menos 5 días hábiles antes de la audiencia preparatoria (Art. 453 CT). La contestación debe negar los hechos uno a uno y ofrecer prueba.',
    ctaText: 'Analizar mi defensa laboral',
    bullets: [
      'La inasistencia o contestación deficiente puede generar la presunción de veracidad de los hechos del demandante (Art. 453 Nº 1 CT).',
      'La nulidad del despido (Ley Bustos) es el mayor riesgo: si no pagaste las cotizaciones, el juez ordena pagar remuneraciones desde el despido hasta la convalidación.',
      'Reúne YA: contrato, libro de asistencia, comprobantes de cotizaciones, finiquitos y la carta de despido con la causal invocada.',
    ],
    faqs: [
      { q: '¿Qué pasa si no contesto la demanda laboral?', a: 'Pueden tener por acreditados los hechos del demandante y condenarte al pago de indemnizaciones, recargos y costas sin escuchar tu versión.' },
      { q: '¿Puedo conciliar antes de la audiencia preparatoria?', a: 'Sí. La conciliación es incentivada por el tribunal y puede ahorrarte las costas y una condena completa.' },
    ],
    titleSEO: 'Cómo Contestar una Demanda Laboral | Empleadores - Plazos Clave',
    metaDescription: 'Un extrabajador te demandó. Aprende cómo contestar la demanda laboral, los plazos de la audiencia preparatoria y cómo preparar tu defensa.',
    intent: 'Soy empleador y me demandaron laboralmente. Necesito saber cómo contestar la demanda.',
    caseType: 'laboral',
    role: 'demandado',
  },
  {
    slug: '/como-defenderse-de-una-demanda-civil',
    h1: 'Cómo defenderse de una demanda civil en Chile',
    diagnosText: 'En un juicio ordinario civil tienes 15 días hábiles para contestar desde la notificación, plazo que se amplía con la tabla de emplazamiento si vives en otra comuna o región (Arts. 258 y 259 CPC). La defensa se estructura en excepciones dilatorias previas y perentorias dentro de la contestación.',
    ctaText: 'Analizar mi defensa civil',
    bullets: [
      'Excepciones dilatorias: incompetencia, falta de capacidad, litispendencia o cosa juzgada. Se oponen como incidente antes de contestar.',
      'Excepciones perentorias: pago, compensación, remisión, prescripción y nulidad del acto o contrato. Se alegan en la contestación.',
      'Revisa la causa en la Oficina Judicial Virtual (ojv.pjud.cl) con tu ClaveÚnica para ver todo el expediente y anticipar la prueba del demandante.',
    ],
    faqs: [
      { q: '¿Qué pasa si no contesto la demanda civil?', a: 'Se declara tu rebeldía: los hechos de la demanda pueden tenerse por confesados y el juicio continúa sin tu participación. El resultado casi siempre es una condena.' },
      { q: '¿Cuánto demora un juicio ordinario civil?', a: 'Entre 1 y 3 años dependiendo de la complejidad, la prueba ofrecida y la carga del tribunal.' },
    ],
    titleSEO: 'Cómo Defenderse de una Demanda Civil | Excepciones y Plazos',
    metaDescription: 'Te demandaron en lo civil. Conoce tus plazos para contestar, excepciones dilatorias y perentorias, y cómo preparar tu defensa ante el tribunal.',
    intent: 'Me demandaron en materia civil y necesito saber cómo defenderme y qué excepciones oponer.',
    caseType: 'civil',
    role: 'demandado',
  },
  {
    slug: '/defensa-ante-demanda',
    h1: 'Defensa ante demanda: qué hacer si te demandaron en Chile',
    diagnosText: 'Recibir una demanda genera angustia, pero actuar con método cambia el resultado. Identifica el tribunal, el ROL o RIT y la materia; revisa el expediente en la OJV; verifica el plazo para contestar según el procedimiento; y busca asesoría legal, gratuita en la CAJ si no puedes pagar.',
    ctaText: 'Analizar mi defensa ahora',
    bullets: [
      'Paso 1: identifica tribunal, ROL/RIT y fecha de notificación en el documento recibido.',
      'Paso 2: ingresa a ojv.pjud.cl con tu ClaveÚnica para revisar el expediente completo de la causa.',
      'Paso 3: verifica el plazo exacto para contestar y anótalo: civil 15 días, ejecutivo 8, laboral y familia 5 días antes de la audiencia, Policía Local 5 días.',
      'Paso 4: acude a un abogado o a la Corporación de Asistencia Judicial (CAJ) de tu comuna si no puedes costear uno.',
    ],
    faqs: [
      { q: '¿Cuánto tengo para contestar una demanda en Chile?', a: 'Depende del procedimiento: 15 días hábiles en civil ordinario, 8 en ejecutivo, 5 días hábiles antes de la audiencia preparatoria en laboral y familia, y 5 días en Policía Local.' },
      { q: '¿Qué pasa si no me defiendo?', a: 'La rebeldía permite que los hechos de la demanda se den por ciertos. El juicio avanza sin ti y el resultado suele ser una condena en tu contra.' },
    ],
    titleSEO: 'Defensa ante Demanda en Chile | Guía Paso a Paso',
    metaDescription: 'Te demandaron y no sabes qué hacer. Guía completa de defensa: identifica el tribunal, revisa tu causa en la OJV, plazos y cómo conseguir abogado.',
    intent: 'Necesito una guía general para defenderme de la demanda que recibí.',
    caseType: 'general',
    role: 'demandado',
  },
  {
    slug: '/abogado-para-arriendos',
    h1: 'Abogado para arriendos en Chile | Juicios y Desalojos',
    diagnosText: 'Si estás demandando por no pago de rentas, necesitas recuperar tu propiedad o te demandaron como arrendatario, un abogado especialista en arriendos (Ley 18.101) marca la diferencia. Te orienta en Juzgados de Policía Local y Civiles, redacta la demanda o contestación, y acelera el desalojo y cobro.',
    ctaText: 'Analizar mi caso de arriendo',
    bullets: [
      'Como arrendador: demanda de terminación de contrato, cobro de rentas, desalojo o lanzamiento con auxilio de la fuerza pública.',
      'Como arrendatario: defensa ante demandas de arriendo, excepciones por vicios del inmueble y negociación de plazos de entrega.',
      'Analiza tu caso gratis con IA y descubre qué tribunal te corresponde y qué documentos necesitas antes de contratar un abogado.',
    ],
    faqs: [
      { q: '¿Cuánto cuesta un abogado para juicio de arriendo?', a: 'Un honorario razonable por un desalojo simple parte entre $300.000 y $800.000, más gastos de notificación y receptor. Los montos varían según tribunal y comuna.' },
      { q: '¿Hasta cuándo tengo plazo para demandar?', a: 'Por deuda de arriendo, 5 años desde que el pago se hizo exigible. Para la terminación del contrato, mientras dure el incumplimiento.' },
    ],
    titleSEO: 'Abogado para Arriendos en Chile | Demandas, Desalojos y Defensa',
    metaDescription: 'Encuentra orientación legal para juicios de arriendo: demandar por no pago, recuperar tu propiedad o defenderte de un desalojo en Chile.',
    intent: 'Necesito un abogado especialista en arriendos para demandar o defenderme.',
    caseType: 'arriendo',
    role: 'consulta',
  },
  {
    slug: '/abogado-gratis-online',
    h1: 'Abogado gratis online en Chile | Consulta Legal Sin Costo',
    diagnosText: 'Antes de pagar una consulta, puedes obtener orientación legal gratuita online. Nuestro analizador con IA te indica en minutos qué leyes aplican, qué plazos tienes y qué riesgos corres. Además, el Estado chileno ofrece abogados gratuitos a través de la CAJ y la Defensoría Penal Pública para quienes cumplen los requisitos.',
    ctaText: 'Analizar mi caso gratis ahora',
    bullets: [
      'La consulta inicial con IA es 100% gratuita y confidencial: no necesitas registro ni dejar tus datos.',
      'La CAJ entrega orientación y patrocinio gratuito en materia civil, laboral y familia previa acreditación de bajos ingresos.',
      'La Defensoría Penal Pública asigna defensor gratuito a toda persona imputada que no pueda costear uno.',
    ],
    faqs: [
      { q: '¿La orientación con IA reemplaza a un abogado?', a: 'No. Es un primer diagnóstico informativo para saber qué hacer. Para presentar escritos en tribunales necesitas patrocinio de abogado habilitado.' },
      { q: '¿Cómo accedo a la CAJ gratis?', a: 'Acude a la Corporación de Asistencia Judicial de tu comuna con cédula de identidad y antecedentes del caso. Acreditan ingresos para asignarte un abogado gratuito.' },
    ],
    titleSEO: 'Abogado Gratis Online en Chile | Orientación Legal con IA',
    metaDescription: 'Obtén orientación legal gratuita online en Chile: analiza tu caso con IA, conoce tus plazos y accede a abogados gratis de la CAJ y Defensoría.',
    intent: 'Quiero una consulta legal gratuita online antes de pagar un abogado.',
    caseType: 'general',
    role: 'consulta',
  },
  {
    slug: '/abogado-urgente',
    h1: 'Abogado urgente en Chile | Asesoría Legal de Emergencia 24/7',
    diagnosText: 'Cuando hay una detención, un embargo inminente, una citación con apercibimiento de arresto o una orden de lanzamiento, cada hora cuenta. Si el caso es penal y no tienes abogado, la Defensoría Penal Pública interviene en el control de detención. Para asuntos civiles urgentes, la CAJ y las clínicas jurídicas atienden casos de urgencia.',
    ctaText: 'Analizar mi emergencia legal',
    bullets: [
      'Detención: el control de detención debe realizarse dentro de las 24 horas. Un defensor penal interviene si no tienes abogado privado.',
      'Embargo inminente: tienes 8 días hábiles para oponer excepciones y detener el remate. No esperes a que el receptor llegue.',
      'Lanzamiento: si hay orden de desalojo, pedir un plazo de entrega voluntaria al tribunal es tu mejor opción antes de que intervenga Carabineros.',
    ],
    faqs: [
      { q: '¿Qué hago si me detienen de inmediato?', a: 'Exige llamar a un abogado o a la Defensoría Penal Pública. No declares sin asesoría y recuerda tu derecho a guardar silencio.' },
      { q: '¿Dónde encuentro ayuda legal urgente de noche?', a: 'La Defensoría Penal Pública tiene turnos 24 horas para detenidos. En materia civil, las horas presenciales de la CAJ son limitadas, por eso actúa la orientación online.' },
    ],
    titleSEO: 'Abogado Urgente en Chile | Emergencias Legales 24/7',
    metaDescription: 'Emergencia legal en Chile: detención, embargo o lanzamiento. Conoce qué hacer de inmediato y cómo conseguir abogado urgente hoy.',
    intent: 'Tengo una emergencia legal urgente y necesito saber qué hacer de inmediato.',
    caseType: 'general',
    role: 'consulta',
  },
  {
    slug: '/como-acceder-a-un-abogado-gratis-en-chile',
    h1: 'Cómo acceder a un abogado gratis en Chile (Guía Completa)',
    diagnosText: 'El acceso a la justicia no debería depender de tu bolsillo. En Chile existen cuatro vías gratuitas: la Corporación de Asistencia Judicial (CAJ), la Defensoría Penal Pública, la Fundación Pro Bono y las clínicas jurídicas universitarias. Cada una atiende situaciones distintas y requisitos de ingreso que debes conocer.',
    ctaText: 'Revisar mis opciones de abogado gratis',
    bullets: [
      'CAJ: orientación y patrocinio gratuito en materia civil, laboral y familia. Requiere acreditar bajos ingresos y se solicita presencialmente en cada comuna.',
      'Defensoría Penal Pública: representa a toda persona imputada de un delito que no pueda costear un abogado. Interviene desde el control de detención.',
      'Fundación Pro Bono: abogadas y abogados voluntarios que atienden a personas vulnerables y organizaciones sin fines de lucro.',
      'Clínicas jurídicas: las universidades (U. de Chile, Católica, UDP, etc.) ofrecen atención gratuita supervisada por profesores abogados.',
    ],
    faqs: [
      { q: '¿Cuánto gana una persona para acceder a la CAJ gratis?', a: 'La CAJ evalúa la situación socioeconómica caso a caso, considerando ingresos, cargas familiares y patrimonio. Consulta en tu comuna los requisitos actualizados.' },
      { q: '¿La consulta por WhatsApp o teléfono de abogados es de fiar?', a: 'Desconfía de ofertas de abogados gratis por WhatsApp sin acreditar. Usa siempre los canales oficiales: CAJ, Defensoría, Pro Bono o clínicas universitarias.' },
    ],
    titleSEO: 'Cómo Acceder a un Abogado Gratis en Chile | CAJ, Pro Bono y Más',
    metaDescription: 'Guía completa para obtener abogado gratis en Chile: Corporación de Asistencia Judicial, Defensoría Penal, Fundación Pro Bono y clínicas jurídicas.',
    intent: 'No puedo pagar un abogado y quiero saber cómo obtener asesoría legal gratuita.',
    caseType: 'general',
    role: 'consulta',
  },

  // ═════════= FASE 2: HEAD TERMS DE VOLUMEN (14) ═════════
  {
    slug: '/como-calcular-finiquito',
    h1: 'Cómo calcular el finiquito en Chile | Calculadora y Pasos',
    diagnosText: 'El finiquito se compone de indemnización por años de servicio, indemnización sustitutiva del aviso previo, feriado proporcional y las cotizaciones pendientes. Para calcularlo necesitas tu remuneración imponible, los años trabajados, la causal de término y tus días de vacaciones pendientes.',
    ctaText: 'Calcular mi finiquito ahora',
    bullets: [
      'Indemnización por años de servicio: 1 mes de sueldo por año trabajado (tope de 11 años desde la reforma de 2016) más el recargo legal del 30% al 100% según la causal.',
      'Indemnización sustitutiva del aviso previo: 1 mes de remuneración si no se dio aviso con 30 días de anticipación.',
      'Feriado proporcional: se calcula sobre los días de vacaciones devengados y no utilizados al momento del despido.',
    ],
    faqs: [
      { q: '¿Qué pasa si me despiden por necesidades de la empresa?', a: 'Corresponde indemnización por años de servicio con un recargo del 30%. El tope de 11 años aplica a los contratos firmados desde el 1 de septiembre de 2016.' },
      { q: '¿Debo firmar el finiquito para cobrar?', a: 'El empleador debe pagar el finiquito a través de la Inspección del Trabajo o notario. Si firmas sin reservar derechos, pierdes la posibilidad de demandar.' },
    ],
    titleSEO: 'Cómo Calcular el Finiquito en Chile | Indemnizaciones y Cálculo',
    metaDescription: 'Aprende a calcular tu finiquito en Chile: indemnización por años de servicio, aviso previo, feriado proporcional y qué hacer si no te pagan.',
    intent: 'Me despidieron y quiero calcular cuánto me corresponde de finiquito.',
    caseType: 'laboral',
    role: 'demandante',
  },
  {
    slug: '/posesion-efectiva-chile',
    h1: 'Posesión efectiva en Chile | Requisitos y Trámite 2026',
    diagnosText: 'La posesión efectiva es el trámite que te permite heredar los bienes de una persona fallecida. Se solicita ante el Registro Civil si no hay testamento, o ante un Juzgado Civil si la herencia incluye bienes raíces o hay testamento. Sin este trámite no puedes disponer legalmente de los bienes del fallecido.',
    ctaText: 'Analizar mi trámite de herencia',
    bullets: [
      'Sin testamento y solo bienes muebles: se tramita en el Registro Civil con certificado de defunción, nacimiento de los herederos y declaración jurada.',
      'Con bienes raíces o testamento: se tramita ante el Juzgado Civil. Se requieren informes de dominio y avalúo, y la publicación en el diario.',
      'El impuesto a la herencia lo fiscaliza el SII. El plazo para declarar vence dentro de los 12 meses siguientes a la fecha de la posesión efectiva.',
    ],
    faqs: [
      { q: '¿Cuánto cuesta la posesión efectiva en el Registro Civil?', a: 'La tasa del Registro Civil es de aproximadamente $23.190 y el certificado de inscripción alrededor de $2.000. Los montos se actualizan cada año.' },
      { q: '¿Cuánto tarda la posesión efectiva judicial?', a: 'Entre 3 y 6 meses si no hay oposición, dependiendo de la carga del tribunal y la correcta tramitación de los informes.' },
    ],
    titleSEO: 'Posesión Efectiva en Chile | Requisitos, Plazos y Costos',
    metaDescription: 'Trámite de posesión efectiva en Chile: requisitos en Registro Civil y Juzgado Civil, plazos, costos y qué heredar sin testamento.',
    intent: 'Necesito tramitar la posesión efectiva de un familiar fallecido.',
    caseType: 'civil',
    role: 'consulta',
  },
  {
    slug: '/herencias-chile',
    h1: 'Herencias en Chile | Derechos, Impuestos y Trámites',
    diagnosText: 'Heredar implica conocer quiénes son los herederos legítimos, cómo se reparte la herencia y qué impuestos pagar. En Chile la herencia se ordena por testamento o, en su defecto, por las reglas de sucesión intestada del Código Civil, con preferencia para hijos, cónyuge y ascendientes.',
    ctaText: 'Analizar mi caso de herencia',
    bullets: [
      'Herederos legitimarios: hijos y descendientes, cónyuge sobreviviente y ascendientes. Las asignaciones forzosas no pueden eliminarse por testamento.',
      'El impuesto a la herencia se calcula sobre la masa hereditaria líquida, con tasas que comienzan en 1% y suben según el valor heredado.',
      'Si un heredero no quiere o no puede heredar, la renuncia o cesión de derechos requiere escritura pública e inscripción en el Conservador de Bienes Raíces.',
    ],
    faqs: [
      { q: '¿Qué pasa si no hay testamento?', a: 'La sucesión intestada del Código Civil ordena a los herederos: hijos primero (heredan por partes iguales), y en subsidio cónyuge, ascendientes u otros parientes.' },
      { q: '¿Cuánto se paga de impuesto por una herencia?', a: 'El SII aplica tasas desde 1% en el tramo menor. Un patrimonio heredado de $100 millones paga una tasa marginal cercana al 8% por el tramo que exceda el mínimo exento.' },
    ],
    titleSEO: 'Herencias en Chile | Quiénes Heredan, Impuestos y Trámites',
    metaDescription: 'Todo sobre herencias en Chile: herederos legítimos, sucesión intestada, impuesto a la herencia del SII y cómo tramitar la posesión efectiva.',
    intent: 'Quiero conocer mis derechos al heredar y qué impuestos debo pagar.',
    caseType: 'civil',
    role: 'consulta',
  },
  {
    slug: '/ley-de-quiebra-personal',
    h1: 'Ley de quiebra personal en Chile | Procedimiento 20.720',
    diagnosText: 'La Ley 20.720 permite a las personas sobreendeudadas renegociar sus deudas o declararse en quiebra (liquidación voluntaria) como última alternativa. El procedimiento de renegociación busca un acuerdo con los acreedores que suspende los juicios ejecutivos, el embargo y el remate de bienes.',
    ctaText: 'Analizar mi situación de deudas',
    bullets: [
      'Renegociación: comienza con una propuesta de acuerdo al Superintendencia de Insolvencia. Mientras se tramita, se suspenden las acciones de cobro y embargos.',
      'Liquidación (quiebra) voluntaria: disuelve las deudas impagas al término del proceso, salvo alimentos, cotizaciones previsionales y créditos con garantía real.',
      'El procedimiento excluye bienes inembargables y puedes conservar parte de tu remuneración para tu sustento familiar.',
    ],
    faqs: [
      { q: '¿Cuánto demora la renegociación?', a: 'Entre 3 y 6 meses desde la presentación, dependiendo del acuerdo alcanzado con los acreedores.' },
      { q: '¿Qué deudas no se eliminan con la quiebra?', a: 'Las pensiones alimenticias, las cotizaciones previsionales, las multas y las obligaciones por delitos dolosos no se extinguen con la liquidación.' },
    ],
    titleSEO: 'Ley de Quiebra Personal en Chile | Renegociación y Liquidación',
    metaDescription: 'La Ley 20.720 te permite renegociar tus deudas o liquidarte. Conoce el procedimiento, plazos y qué deudas se eliminan en Chile.',
    intent: 'Estoy sobreendeudado y quiero saber si la ley de quiebra personal me sirve.',
    caseType: 'deuda',
    role: 'consulta',
  },
  {
    slug: '/violencia-intrafamiliar-chile',
    h1: 'Violencia intrafamiliar en Chile | Denuncia y Medidas de Protección',
    diagnosText: 'La violencia intrafamiliar (VIF) es un delito y también una causa civil del Juzgado de Familia. Si eres víctima, puedes denunciar en Carabineros, la PDI, el Ministerio Público o directamente en el Juzgado de Familia para obtener medidas de protección urgente como la prohibición de acercamiento.',
    ctaText: 'Analizar mi caso de violencia',
    bullets: [
      'La denuncia puede hacerla la propia víctima o cualquier persona que tenga conocimiento de los hechos; no se exige querella.',
      'El tribunal de familia puede decretar de inmediato medidas cautelares: prohibición de acercamiento, salida del agresor del hogar y entrega de los hijos.',
      'Las penas por VIF van desde multas hasta presidio cuando hay lesiones graves o reiteración. La Ley 20.066 también protege a convivientes y ex parejas.',
    ],
    faqs: [
      { q: '¿Puedo denunciar violencia aunque el agresor no viva conmigo?', a: 'Sí. La Ley 20.066 protege también a quienes mantienen o mantuvieron una relación de convivencia o parentesco, incluso sin cohabitación actual.' },
      { q: '¿Qué medidas de protección puedo pedir?', a: 'Prohibición de acercamiento a la víctima y su familia, prohibición de porte de armas, salida del agresor del domicilio y entrega de los hijos en casos graves.' },
    ],
    titleSEO: 'Violencia Intrafamiliar en Chile | Denuncia y Protección',
    metaDescription: 'Sufres violencia intrafamiliar en Chile. Aprende cómo denunciar, qué medidas de protección pedir al Juzgado de Familia y tus derechos como víctima.',
    intent: 'Soy víctima de violencia intrafamiliar y necesito saber cómo denunciar y protegerme.',
    caseType: 'familia',
    role: 'demandante',
  },
  {
    slug: '/cuidado-personal-de-los-hijos',
    h1: 'Cuidado personal de los hijos en Chile | Cómo se Determina',
    diagnosText: 'El cuidado personal de los hijos se otorga priorizando el interés superior del niño. La ley chilena (Ley 20.680) permite el cuidado compartido si ambos padres lo acuerdan o si el tribunal lo estima conveniente, evaluando el vínculo del niño con cada progenitor y su estabilidad.',
    ctaText: 'Analizar mi caso de cuidado personal',
    bullets: [
      'A falta de acuerdo, el juez de familia evalúa: vínculo afectivo, condiciones materiales, arraigo escolar y social, y la opinión del niño si tiene suficiente juicio.',
      'La madre no tiene preferencia legal automática por sobre el padre: el criterio único es el interés superior del niño.',
      'El cuidado personal puede modificarse si cambian las circunstancias (Art. 225 del Código Civil), mediante una demanda de modificación de tuición.',
    ],
    faqs: [
      { q: '¿Qué pasa si cambio de ciudad con mis hijos?', a: 'Si tienes el cuidado personal, puedes solicitar autorización judicial para cambiar de residencia, debiendo comunicarlo al otro progenitor con la debida anticipación.' },
      { q: '¿Puedo perder el cuidado personal si me mudé a otra ciudad?', a: 'No automáticamente, pero el otro padre puede demandar la modificación si acredita que el cambio perjudica la relación y el interés superior del niño.' },
    ],
    titleSEO: 'Cuidado Personal de los Hijos en Chile | Ley y Criterios',
    metaDescription: 'Cómo se determina el cuidado personal de los hijos en Chile: interés superior, cuidado compartido, modificación de tuición y derechos de los padres.',
    intent: 'Quiero obtener o modificar el cuidado personal de mis hijos.',
    caseType: 'familia',
    role: 'demandante',
  },
  {
    slug: '/relacion-directa-y-regular',
    h1: 'Relación directa y regular en Chile | Derechos de los Padres',
    diagnosText: 'La relación directa y regular es el derecho del padre o madre que no tiene el cuidado personal de mantener una relación periódica con sus hijos. No es un privilegio del adulto: es un derecho del niño, y su incumplimiento puede generar medidas de apremio y la modificación del régimen.',
    ctaText: 'Analizar mi régimen de visitas',
    bullets: [
      'El régimen de relación directa y regular se establece por acuerdo entre los padres o por resolución del Juzgado de Familia (Art. 229 Código Civil).',
      'Incluye visitas regulares, pernoctaciones, fines de semana alternados, vacaciones y festividades relevantes.',
      'Si el otro progenitor impide las visitas, puedes solicitar medidas de apremio como el cumplimiento forzado o la compensación de tiempos perdidos.',
    ],
    faqs: [
      { q: '¿Hasta qué hora puedo tener a mis hijos según el régimen?', a: 'Depende de lo acordado o resuelto: lo usual son fines de semana desde el viernes o sábado hasta el domingo por la tarde. Cualquier régimen debe respetar los horarios escolares.' },
      { q: '¿Qué hago si el otro padre no me deja ver a mis hijos?', a: 'Solicita al tribunal el cumplimiento forzado del régimen. La obstrucción reiterada puede dar origen a la modificación del cuidado personal.' },
    ],
    titleSEO: 'Relación Directa y Regular en Chile | Régimen de Visitas',
    metaDescription: 'Derecho de relación directa y regular en Chile: régimen de visitas, plazos de entrega, feriados y qué hacer si el otro padre obstruye las visitas.',
    intent: 'Necesito establecer o defender mi régimen de visitas con mis hijos.',
    caseType: 'familia',
    role: 'demandante',
  },
  {
    slug: '/accidente-laboral-chile',
    h1: 'Accidente laboral en Chile | Qué Hacer y Cómo Reclamar',
    diagnosText: 'Un accidente del trabajo debe denunciarse de inmediato al empleador, quien debe informarlo al organismo administrador de la Ley 16.744 (Mutual, ISL o administración delegada). Si la entidad rechaza la cobertura, puedes reclamar ante la Comisión de Evaluación Médica o en el Juzgado de Letras del Trabajo.',
    ctaText: 'Analizar mi accidente laboral',
    bullets: [
      'El empleador debe denunciar el accidente dentro de las 24 horas ante la mutual o el ISL (Art. 76 Ley 16.744).',
      'Si el accidente deja secuelas, la Comisión de Evaluación Médica determina el grado de incapacidad que da derecho a pensiones o indemnizaciones.',
      'Puedes impugnar el diagnóstico o la incapacidad ante la Superintendencia de Seguridad Social (Suseso) y, en última instancia, en los tribunales.',
    ],
    faqs: [
      { q: '¿Cuánto tiempo tengo para denunciar un accidente laboral?', a: 'Como trabajador puedes reclamar directamente ante la mutual o ISL dentro de los 30 días siguientes al accidente, aunque el empleador no haya informado.' },
      { q: '¿Qué prestaciones cubre la ley 16.744?', a: 'Atención médica gratuita, subsidio por incapacidad temporal, e indemnizaciones o pensiones según el grado de incapacidad permanente declarado.' },
    ],
    titleSEO: 'Accidente Laboral en Chile | Denuncia y Reclamo Ley 16.744',
    metaDescription: 'Sufriste un accidente del trabajo. Aprende cómo denunciarlo, qué cobertura tiene la Ley 16.744 y cómo reclamar si la mutual rechaza el caso.',
    intent: 'Sufrí un accidente laboral y necesito saber cómo reclamar mis derechos.',
    caseType: 'laboral',
    role: 'demandante',
  },
  {
    slug: '/como-hacer-carta-de-renuncia',
    h1: 'Cómo hacer una carta de renuncia en Chile | Modelo y Requisitos',
    diagnosText: 'Renunciar no tiene un formato obligatorio, pero una carta de renuncia clara evita conflictos: debe indicar tu nombre, RUT, cargo, empresa, la voluntad inequívoca de renunciar y la fecha de término. El aviso previo de 30 días es un deber de colaboración con el empleador.',
    ctaText: 'Analizar mi renuncia',
    bullets: [
      'La carta de renuncia no necesita notario ni Inspección del Trabajo si el finiquito se ratifica ante la Inspección o notario al momento del pago.',
      'Si te presionan a renunciar o simulan una renuncia para evitar indemnizaciones, puedes impugnarla por despido indirecto (autodespido).',
      'Conserva copia de la carta con la fecha de recepción: el aviso de 30 días puede impactar en tu indemnización y en tus cotizaciones.',
    ],
    faqs: [
      { q: '¿Pierdo mi indemnización si renuncio?', a: 'Generalmente sí, porque la indemnización por años de servicio se paga en el despido. Excepciones: renuncia en el período de fuero laboral o acoso que justifique el autodespido.' },
      { q: '¿Necesito avisar con 30 días?', a: 'La ley establece que tú y el empleador deben darse el aviso previo de 30 días. Si no se avisa, el plazo se compensa en el finiquito.' },
    ],
    titleSEO: 'Cómo Hacer una Carta de Renuncia en Chile | Modelo Gratis',
    metaDescription: 'Modelo y requisitos de la carta de renuncia en Chile: qué debe incluir, plazo del aviso de 30 días y qué pasa con tu finiquito.',
    intent: 'Quiero renunciar a mi trabajo y necesito un modelo de carta de renuncia.',
    caseType: 'laboral',
    role: 'consulta',
  },
  {
    slug: '/testamento-en-chile',
    h1: 'Testamento en Chile | Tipos, Requisitos y Costos',
    diagnosText: 'El testamento en Chile puede ser solemne abierto, solemne cerrado o el testamento ológrafo. El más común es el abierto ante notario, que se inscribe en el Registro Nacional de Testamentos. Aunque testar no es obligatorio, evita conflictos entre herederos y asegura que tus bienes se repartan según tu voluntad dentro de los límites legales.',
    ctaText: 'Analizar mi testamento',
    bullets: [
      'Testamento abierto: se otorga ante notario con 2 a 3 testigos según el caso y se inscribe en el Registro de Testamentos del Registro Civil.',
      'Testamento cerrado: se entrega en sobre sellado al notario; su contenido se conoce al momento del fallecimiento.',
      'Las asignaciones forzosas (legítimas de hijos y cónyuge) no pueden vulnerarse: solo la cuarta de libre disposición se reparte según tu voluntad.',
    ],
    faqs: [
      { q: '¿Cuánto cuesta hacer un testamento en Chile?', a: 'El testamento ante notario suele costar entre $60.000 y $120.000, dependiendo de la notaría y la complejidad. El registro en el Registro Civil tiene una tasa adicional.' },
      { q: '¿Pueden los hijos impugnar mi testamento?', a: 'Pueden impugnarlo por vicio de forma o de fondo, por ejemplo si se vulnera la legítima que les corresponde o si acreditan que testaste sin capacidad o bajo presión.' },
    ],
    titleSEO: 'Testamento en Chile | Tipos, Requisitos y Costos 2026',
    metaDescription: 'Cómo hacer un testamento en Chile: tipos (abierto, cerrado, ológrafo), requisitos, costos de notaría y qué parte de la herencia puedes disponer libremente.',
    intent: 'Quiero dejar un testamento para ordenar mi herencia y evitar conflictos.',
    caseType: 'civil',
    role: 'consulta',
  },
  {
    slug: '/derechos-del-consumidor-chile',
    h1: 'Derechos del consumidor en Chile | Cómo Reclamar ante el SERNAC',
    diagnosText: 'La Ley 19.496 protege tus derechos como consumidor: garantía legal de 3 meses, derecho a retracto en compras online, información veraz y protección ante publicidad engañosa. Ante un problema con un producto o servicio, primero reclama por escrito a la empresa y luego al SERNAC o a los tribunales.',
    ctaText: 'Analizar mi reclamo de consumo',
    bullets: [
      'Garantía legal: dentro de 3 meses puedes pedir la reparación, el cambio o la devolución del dinero de un producto defectuoso.',
      'Retracto digital: tienes 10 días corridos para arrepentirte de compras por internet, con excepciones como productos personalizados o software descargado.',
      'El SERNAC media gratuitamente; si la empresa no responde, puedes demandar en el Juzgado de Policía Local, que conoce los reclamos de consumo.',
    ],
    faqs: [
      { q: '¿Cuándo exige el SERNAC que la empresa responda?', a: 'El proveedor debe responder el reclamo presentado a través del SERNAC dentro del plazo legal. Si no lo hace, enfrenta multas de hasta 300 UTM.' },
      { q: '¿Puedo demandar de forma gratuita?', a: 'Sí. Los reclamos de consumo hasta 10 UTM pueden presentarse en el Juzgado de Policía Local sin abogado, y la ley facilita la conciliación.' },
    ],
    titleSEO: 'Derechos del Consumidor en Chile | Reclamos SERNAC',
    metaDescription: 'Conoce tus derechos como consumidor en Chile: garantía legal, retracto online, publicidad engañosa y cómo reclamar ante el SERNAC.',
    intent: 'Un producto o servicio no cumplió y quiero reclamar mis derechos de consumidor.',
    caseType: 'civil',
    role: 'demandante',
  },
  {
    slug: '/cobranza-judicial-chile',
    h1: 'Cobranza judicial en Chile | Qué Hacer si te Cobran por la Vía Legal',
    diagnosText: 'La cobranza judicial puede ser extrajudicial (cartas, llamados, mensajes) o judicial (juicio ejecutivo con embargo). La cobranza extrajudicial es legal, pero tiene límites: no pueden acosarte, amenazarte ni publicar tu deuda. Si la cobranza es judicial, debes actuar dentro de plazos fatales para no perder bienes.',
    ctaText: 'Analizar mi cobranza',
    bullets: [
      'Una empresa de cobranza puede contactarte e informar tu deuda, pero no puede utilizar amenazas, coacción o difundir tu situación a terceros.',
      'En el juicio ejecutivo tienes 8 días hábiles para oponer excepciones. Sin excepciones, el tribunal sigue adelante con el embargo y remate.',
      'La prescripción de la acción ejecutiva opera a los 3 años y la ordinaria a los 5, desde que la obligación se hizo exigible.',
    ],
    faqs: [
      { q: '¿Las empresas de cobranza pueden embargarme?', a: 'No. Solo un tribunal puede ordenar el embargo mediante un juicio ejecutivo. Una empresa de cobranza extrajudicial no tiene facultades de embargo.' },
      { q: '¿Cómo sé si mi deuda prescribió?', a: 'Si no te han demandado ni reconocido la deuda en el plazo legal (3 años ejecutiva, 5 ordinaria), puedes oponer la excepción de prescripción para extinguirla.' },
    ],
    titleSEO: 'Cobranza Judicial en Chile | Derechos y Plazos de Defensa',
    metaDescription: 'Enfrentando una cobranza judicial o extrajudicial en Chile: conoce tus derechos, plazos para oponer excepciones y cuándo prescribe una deuda.',
    intent: 'Una empresa de cobranza me persigue y necesito conocer mis derechos y plazos.',
    caseType: 'deuda',
    role: 'demandado',
  },
  {
    slug: '/registro-nacional-deudores-pensiones',
    h1: 'Registro Nacional de Deudores de Pensiones de Alimentos en Chile',
    diagnosText: 'El Registro Nacional de Deudores de Pensiones de Alimentos (Ley 21.389) publica a quienes adeudan 5 o más cuotas continuas o discontinuas de pensión. Estar en el registro genera graves consecuencias: impedimento para obtener pasaporte, licencia de conducir y celebrar contratos con el Estado.',
    ctaText: 'Analizar mi registro de pensiones',
    bullets: [
      'Entras al registro cuando acumulas 5 o más cuotas impagas, continuas o discontinuas, declaradas por el tribunal.',
      'Consecuencias: no puedes obtener o renovar pasaporte ni licencia de conducir, y el Estado no puede contratar contigo.',
      'Para salir del registro debes pagar la deuda o ponerte al día mediante un plan de pago autorizado por el tribunal.',
    ],
    faqs: [
      { q: '¿Cuánto cuesta salir del registro?', a: 'Salir del registro requiere pagar todas las cuotas adeudadas o restar menos de 5. El pago se acredita ante el tribunal, que ordena la eliminación del registro.' },
      { q: '¿Me pueden sacar el pasaporte si estoy en el registro?', a: 'Si aún no lo has obtenido, el registro te impide obtenerlo. Si ya lo tienes, el tribunal puede ordenar su retención en el contexto de medidas de apremio.' },
    ],
    titleSEO: 'Registro Nacional de Deudores de Pensiones | Ley 21.389',
    metaDescription: 'Qué es el Registro Nacional de Deudores de Pensiones de Alimentos, cómo entrar y salir de él, y las consecuencias de estar inscrito en Chile.',
    intent: 'Quiero saber si estoy en el registro de deudores de pensiones y cómo salir.',
    caseType: 'familia',
    role: 'consulta',
  },
  {
    slug: '/abogado-accidentes',
    h1: 'Abogado de accidentes de tránsito en Chile | Indemnizaciones',
    diagnosText: 'Después de un accidente de tránsito, puedes reclamar indemnización por daño emergente, lucro cesante y daño moral, además de las coberturas del seguro obligatorio (SOAP). Un abogado especialista evalúa el porcentaje de responsabilidad, negocia con la aseguradora y presenta la demanda civil si el acuerdo no es justo.',
    ctaText: 'Analizar mi accidente de tránsito',
    bullets: [
      'El SOAP cubre gastos médicos y muerte del conductor, pero las indemnizaciones completas se obtienen vía demanda civil contra el responsable y su aseguradora.',
      'Debes probar la culpa del otro conductor: parte policial, informes de SIAT, testigos y peritajes.',
      'El plazo para demandar la indemnización es de 4 años desde el accidente (responsabilidad extracontractual).',
    ],
    faqs: [
      { q: '¿Cuánto puedo pedir por daño moral en un accidente?', a: 'No hay tabla fija. Las indemnizaciones por daño moral en accidentes de tránsito van desde $500.000 hasta decenas de millones según la gravedad de las lesiones.' },
      { q: '¿Qué pasa si el chofer no tiene seguro?', a: 'Aun sin seguro, puedes demandar la indemnización directamente contra el responsable.' },
    ],
    titleSEO: 'Abogado de Accidentes de Tránsito en Chile | Indemnizaciones',
    metaDescription: 'Sufriste un accidente de tránsito. Conoce tus indemnizaciones por daño moral y material, el plazo para demandar y cómo reclamar a la aseguradora.',
    intent: 'Quiero reclamar una indemnización después de un accidente de tránsito.',
    caseType: 'civil',
    role: 'demandante',
  },

  // ═════════= FASE 3: HERRAMIENTAS + ÁREAS ABOGADO + VISITAS/DIVORCIO/PRO BONO (11) ═════════
  {
    slug: '/calculadora-finiquito-chile',
    h1: 'Calculadora de finiquito en Chile | Calcula tu Indemnización',
    diagnosText: 'Calcula tu finiquito de forma simple: ingresa tu remuneración imponible, los años de servicio, el mes de término y la causal de despido. El resultado estima la indemnización por años de servicio, el aviso previo y el feriado proporcional, según las reglas del Código del Trabajo.',
    ctaText: 'Calcular mi finiquito gratis',
    bullets: [
      'El cálculo distingue las causales: necesidades de la empresa (recargo 30%), despido injustificado (condena a 50% o 100% según el caso) y renuncia voluntaria.',
      'Considera el tope de 11 años de indemnización para contratos firmados después del 1 de septiembre de 2016.',
      'El diagnóstico con IA también te indica si la causal de tu despido fue realmente invocada para ver si corresponde impugnarla.',
    ],
    faqs: [
      { q: '¿El cálculo reemplaza mi liquidación?', a: 'Es una estimación orientativa. El finiquito definitivo lo calcula el empleador y debe ratificarse ante la Inspección del Trabajo o notario.' },
      { q: '¿Qué pasa si la indemnización del finiquito es menor a la que corresponde?', a: 'Puedes firmar con reserva de derechos y demandar la diferencia, o reclamar ante la Inspección del Trabajo dentro del plazo legal de 60 días hábiles.' },
    ],
    titleSEO: 'Calculadora de Finiquito Chile | Indemnización Laboral Gratis',
    metaDescription: 'Calcula tu finiquito en Chile gratis: indemnización por años de servicio, aviso previo y feriado proporcional según la causal de tu despido.',
    intent: 'Quiero calcular cuánto me corresponde de finiquito y si la causal es correcta.',
    caseType: 'laboral',
    role: 'demandante',
  },
  {
    slug: '/calculadora-pension-alimentos',
    h1: 'Calculadora de pensión de alimentos en Chile | Monto Referencial',
    diagnosText: 'La pensión de alimentos se determina según las necesidades del hijo y la capacidad económica del alimentante. No existe una tabla única, pero un referente común es el 40% de un ingreso mínimo por hijo. Esta calculadora te entrega un rango orientativo para preparar tu demanda o tu defensa.',
    ctaText: 'Calcular mi pensión referencial',
    bullets: [
      'El tribunal evalúa ingresos del alimentante, cargas de otros hijos, gastos del alimentario (educación, salud, alimentación) y el mínimo de subsistencia.',
      'Los alimentos provisorios se fijan de inmediato en la audiencia preparatoria y son obligatorios desde la notificación.',
      'El no pago puede gatillar apremio con arresto nocturno de hasta 15 días (renovable), arraigo y retención de devolución de impuestos.',
    ],
    faqs: [
      { q: '¿Cuál es el monto mínimo de pensión en Chile?', a: 'El referente habitual es el 40% de un ingreso mínimo mensual por cada alimentario, pero el juez puede fijarlo mayor o menor según las necesidades y la capacidad del alimentante.' },
      { q: '¿Pueden aumentar la pensión si mi sueldo sube?', a: 'Sí. El alimentario puede demandar el reajuste de la pensión si acredita mayores necesidades o el aumento de la capacidad económica del alimentante.' },
    ],
    titleSEO: 'Calculadora de Pensión de Alimentos Chile | Monto Referencial',
    metaDescription: 'Calcula un monto referencial de pensión de alimentos en Chile según los ingresos del alimentante y las necesidades del hijo. Orientación gratuita.',
    intent: 'Quiero un monto referencial de pensión de alimentos antes de demandar o defenderme.',
    caseType: 'familia',
    role: 'demandante',
  },
  {
    slug: '/calculadora-sueldo-liquido',
    h1: 'Calculadora de sueldo líquido en Chile | AFP, Salud e Impuestos',
    diagnosText: 'Calcula tu sueldo líquido descontando cotizaciones previsionales (10% AFP + comisión), salud (7% Fonasa o Isapre), seguro de cesantía (si corresponde) e impuesto a la renta. Este cálculo te sirve para saber cuánto recibes en tu liquidación.',
    ctaText: 'Calcular mi sueldo líquido',
    bullets: [
      'Descuentos obligatorios: 10% cotización AFP + comisión, 7% salud, 0,6% seguro de cesantía (trabajadores dependientes) y el impuesto único de segunda categoría cuando procede.',
      'El sueldo imponible topado desde 2025 subió a 106,3 UF, lo que eleva la pensión futura y las indemnizaciones para sueldos altos.',
      'El feriado progresivo, el bono de escolaridad y otros beneficios se suman al bruto solo si corresponden.',
    ],
    faqs: [
      { q: '¿Qué es la remuneración imponible?', a: 'Es el monto base sobre el cual se calculan las cotizaciones. Incluye sueldo base, gratificaciones y comisiones, con el tope legal de 106,3 UF desde 2025.' },
      { q: '¿Me descuentan impuesto por mi sueldo?', a: 'El impuesto único de segunda categoría se aplica desde una renta mensual aproximada de $1,1 millones, con una tasa progresiva según el tramo.' },
    ],
    titleSEO: 'Calculadora de Sueldo Líquido Chile | Cotizaciones e Impuestos',
    metaDescription: 'Calcula tu sueldo líquido en Chile descontando AFP, salud, seguro de cesantía e impuesto a la renta. Simple y sin registro.',
    intent: 'Quiero saber cuánto recibo líquido al mes y cuánto se descuenta por cotizaciones.',
    caseType: 'laboral',
    role: 'consulta',
  },
  {
    slug: '/abogado-laboral',
    h1: 'Abogado laboral en Chile | Despidos, Finiquitos y Demandas',
    diagnosText: 'Un abogado laboralista defiende tus derechos como trabajador o empleador: despidos injustificados, cálculo de finiquitos, nulidad del despido por cotizaciones impagas, autodespido, acoso laboral y negociación con la Inspección del Trabajo.',
    ctaText: 'Analizar mi caso laboral',
    bullets: [
      'Como trabajador: demandar por despido injustificado, cobrar cotizaciones impagas, calcular finiquitos y autodespido por incumplimiento grave.',
      'Como empleador: contestar demandas laborales, validar finiquitos y prevenir riesgos de nulidad del despido.',
      'Analiza tu caso gratis con IA para saber qué acción te conviene antes de contratar un abogado laboralista.',
    ],
    faqs: [
      { q: '¿Qué puede ganar un trabajador en un juicio laboral?', a: 'Indemnización por años de servicio con recargo, aviso previo, feriado proporcional y las cotizaciones impagas. En casos de tutela, también daño moral.' },
      { q: '¿Cuánto demora un juicio laboral?', a: 'Los juicios laborales son orales y rápidos: entre 6 y 12 meses desde la audiencia preparatoria hasta la sentencia de primera instancia.' },
    ],
    titleSEO: 'Abogado Laboral en Chile | Despidos y Finiquitos',
    metaDescription: 'Encuentra orientación legal laboral en Chile: despido injustificado, finiquito, cotizaciones impagas y autodespido. Analiza tu caso con IA gratis.',
    intent: 'Necesito un abogado laboralista para un caso de despido o finiquito.',
    caseType: 'laboral',
    role: 'demandante',
  },
  {
    slug: '/abogado-de-familia',
    h1: 'Abogado de familia en Chile | Divorcios, Alimentos y Tuición',
    diagnosText: 'Los problemas de familia requieren abogados con experiencia en los Tribunales de Familia: divorcio y compensación económica, pensión de alimentos, cuidado personal de hijos, relación directa y regular, y violencia intrafamiliar.',
    ctaText: 'Analizar mi caso de familia',
    bullets: [
      'Divorcio: por mutuo acuerdo o unilateral tras el cese de convivencia, con compensación económica si existe desequilibrio patrimonial.',
      'Alimentos: demandas de pensión para hijos, reajustes y medidas de apremio contra el alimentante moroso.',
      'Cuidado personal: determinación, modificación y regímenes de relación directa y regular con los hijos.',
    ],
    faqs: [
      { q: '¿Necesito abogado para un divorcio de mutuo acuerdo?', a: 'Sí. El divorcio de mutuo acuerdo requiere patrocinio de un abogado, aunque el procedimiento sea más simple y rápido que el contencioso.' },
      { q: '¿Cuánto cuesta un abogado de familia en Chile?', a: 'Una demanda de alimentos simple puede costar entre $250.000 y $600.000. Un divorcio de mutuo acuerdo con escritura y sentencia, entre $300.000 y $800.000.' },
    ],
    titleSEO: 'Abogado de Familia en Chile | Divorcios y Alimentos',
    metaDescription: 'Abogados de familia en Chile: divorcios, pensión de alimentos, cuidado personal de hijos y violencia intrafamiliar. Orientación gratuita con IA.',
    intent: 'Necesito un abogado de familia para divorcio, alimentos o tuición.',
    caseType: 'familia',
    role: 'demandante',
  },
  {
    slug: '/abogado-civil',
    h1: 'Abogado civil en Chile | Contratos, Deudas y Daños',
    diagnosText: 'El derecho civil resuelve disputas patrimoniales: incumplimiento de contratos, cobro de deudas, indemnización por daños, responsabilidad extracontractual y disputas entre vecinos o sociedades. Un abogado civil puede representarte en juicios ordinarios, ejecutivos y medidas prejudiciales.',
    ctaText: 'Analizar mi caso civil',
    bullets: [
      'Contratos: cumplimiento forzado, resolución por incumplimiento e indemnización de perjuicios.',
      'Deudas: juicio ejecutivo con embargo y remate, o juicio ordinario cuando no hay título ejecutivo.',
      'Daños: indemnización por daño emergente, lucro cesante y daño moral en responsabilidad contractual y extracontractual.',
    ],
    faqs: [
      { q: '¿Cuánto tarda un juicio civil en Chile?', a: 'Un juicio ordinario demora entre 1 y 3 años. Un juicio ejecutivo puede ser considerablemente más rápido si no hay oposición.' },
      { q: '¿Puedo demandar sin contrato escrito?', a: 'Sí. Los contratos verbales son válidos, aunque probar sus términos es más difícil. Reúne correos, WhatsApp, transferencias y testigos.' },
    ],
    titleSEO: 'Abogado Civil en Chile | Contratos, Deudas y Daños',
    metaDescription: 'Abogado civil en Chile: incumplimiento de contratos, cobro de deudas, daños y perjuicios. Analiza tu caso civil gratis con IA.',
    intent: 'Necesito un abogado civil para un contrato, deuda o daño.',
    caseType: 'civil',
    role: 'demandante',
  },
  {
    slug: '/abogado-de-deudas',
    h1: 'Abogado de deudas en Chile | Defensa ante Embargos y Cobranzas',
    diagnosText: 'Un abogado especialista en deudas te defiende ante juicios ejecutivos, embargos, cobranzas agresivas y sobreendeudamiento. Puedes renegociar con los acreedores, oponer excepciones para detener el remate o acogerte a la Ley 20.720 de insolvencia.',
    ctaText: 'Analizar mis deudas',
    bullets: [
      'Defensa ejecutiva: excepciones del Art. 464 CPC (pago, prescripción, nulidad del título) dentro de los 8 días hábiles.',
      'Alzamiento de embargo: si la deuda se paga o el título es defectuoso, puedes solicitar el alzamiento y levantar la traba de bienes.',
      'Renegociación Ley 20.720: suspende embargos y permite repactar la deuda a plazos razonables.',
    ],
    faqs: [
      { q: '¿Me conviene pagar o defenderme de una deuda prescrita?', a: 'Si la acción ya prescribió (3 años ejecutiva, 5 ordinaria), oponer la prescripción evita pagar. Nunca reconozcas por escrito una deuda prescrita antes de asesorarte.' },
      { q: '¿Pueden embargar mi vivienda principal?', a: 'Sí, pueden embargar la vivienda, salvo que exista la protección especial de la Ley 20.720 durante la renegociación, que suspende el remate.' },
    ],
    titleSEO: 'Abogado de Deudas en Chile | Defensa ante Embargos',
    metaDescription: 'Abogado de deudas en Chile: detén embargos y remates, opón excepciones, renegocia bajo la Ley 20.720 y recupera tu tranquilidad financiera.',
    intent: 'Estoy sobreendeudado y necesito defenderme de cobranzas y embargos.',
    caseType: 'deuda',
    role: 'demandado',
  },
  {
    slug: '/abogado-penal',
    h1: 'Abogado penal en Chile | Defensa y Querellas Urgentes',
    diagnosText: 'Un abogado penalista te representa en causas penales: defensa frente a una imputación, querellas por estafa, lesiones, amenazas o delitos económicos, y trámites urgentes como el control de detención que ocurre dentro de las 24 horas. Su intervención temprana es decisiva.',
    ctaText: 'Analizar mi caso penal',
    bullets: [
      'Defensa penal: desde el control de detención, negociación con el Ministerio Público, salidas alternativas y juicio oral.',
      'Querella y denuncia: presentación de querellas criminales y participación como víctima querellante en el proceso.',
      'Urgencia: medidas cautelares, recursos contra la prisión preventiva y vías de impugnación.',
    ],
    faqs: [
      { q: '¿Qué hace un abogado en el control de detención?', a: 'Verifica la legalidad de la detención, se opone a la prisión preventiva y solicita salidas alternativas como la suspensión condicional del procedimiento.' },
      { q: '¿Necesito abogado para querellarme por estafa?', a: 'Para presentar una querella necesitas patrocinio de abogado. El Ministerio Público, en cambio, puede investigar el delito con una simple denuncia.' },
    ],
    titleSEO: 'Abogado Penal en Chile | Defensa y Querellas',
    metaDescription: 'Abogado penal urgente en Chile: defensa en control de detención, querellas, estafas y delitos. Orientación gratuita con IA antes de contratar.',
    intent: 'Necesito un abogado penalista para defenderme o querellarme.',
    caseType: 'penal',
    role: 'demandado',
  },
  {
    slug: '/como-demandar-por-regimen-de-visitas',
    h1: 'Cómo demandar por régimen de visitas (relación directa y regular)',
    diagnosText: 'Si el otro progenitor te impide ver a tus hijos o no hay un régimen establecido, puedes demandar el establecimiento o modificación de la relación directa y regular ante el Juzgado de Familia. El tribunal fijará un régimen que garantice el vínculo del niño con ambos padres.',
    ctaText: 'Analizar mi caso de visitas',
    bullets: [
      'Puedes pedir un régimen que incluya fines de semana alternados, una tarde entre semana, vacaciones divididas y festividades.',
      'Si ya existe sentencia, puedes demandar su modificación cuando cambian las circunstancias (horarios, distancia, conducta).',
      'El incumplimiento del régimen por el titular del cuidado puede generar medidas de apremio y, en casos graves, la modificación del cuidado personal.',
    ],
    faqs: [
      { q: '¿Cuánto demora una demanda por régimen de visitas?', a: 'En el Juzgado de Familia, entre 2 y 4 meses si no hay oposición, ya que el régimen provisorio se puede fijar en una audiencia preparatoria.' },
      { q: '¿Puedo exigir visitas aunque viva lejos?', a: 'Sí. El tribunal puede fijar comunicaciones periódicas, fines de semana ampliados o vacaciones concentradas para compensar la distancia.' },
    ],
    titleSEO: 'Cómo Demandar por Régimen de Visitas en Chile | Juzgado de Familia',
    metaDescription: 'Demanda de relación directa y regular en Chile: cómo pedir el régimen de visitas, modificación del acuerdo y qué hacer si el otro padre obstruye.',
    intent: 'Quiero demandar el establecimiento o modificación de mi régimen de visitas.',
    caseType: 'familia',
    role: 'demandante',
  },
  {
    slug: '/como-divorciarse-en-chile',
    h1: 'Cómo divorciarse en Chile | Requisitos, Plazos y Pasos',
    diagnosText: 'El divorcio en Chile puede ser por mutuo acuerdo o unilateral. El unilateral requiere un año de cese de convivencia (6 meses si ambos lo piden de común acuerdo). Se tramita ante el Juzgado de Familia, y si existe desequilibrio patrimonial puedes solicitar compensación económica.',
    ctaText: 'Analizar mi divorcio',
    bullets: [
      'Divorcio unilateral: un año de cese de convivencia acreditado ante el tribunal. El cese debe probarse con declaraciones de testigos.',
      'Divorcio de mutuo acuerdo: con un acuerdo completo (alimentos, cuidado de hijos, compensación), se resuelve en una sola audiencia.',
      'La compensación económica (Art. 61 Ley 19.947) compensa el sacrificio de quien se dedicó al hogar y los hijos durante el matrimonio.',
    ],
    faqs: [
      { q: '¿Cuánto cuesta un divorcio en Chile?', a: 'De mutuo acuerdo con abogado particular: $300.000 a $800.000 más tasas judiciales. La mediación y los acuerdos reducen el plazo y el costo.' },
      { q: '¿Cuánto tarda un divorcio unilateral?', a: 'Si se acredita el año de cese de convivencia, entre 4 y 8 meses. El divorcio de mutuo acuerdo puede resolverse en 2 a 4 meses.' },
    ],
    titleSEO: 'Cómo Divorciarse en Chile | Requisitos y Pasos 2026',
    metaDescription: 'Guía completa del divorcio en Chile: unilateral, mutuo acuerdo, compensación económica, plazos y costos. Resuelve tu divorcio informado.',
    intent: 'Quiero divorciarme y necesito saber los requisitos y plazos.',
    caseType: 'familia',
    role: 'demandante',
  },
  {
    slug: '/fundacion-pro-bono-y-abogados-gratuitos-chile',
    h1: 'Fundación Pro Bono y abogados gratuitos en Chile',
    diagnosText: 'La Fundación Pro Bono reúne a abogadas y abogados voluntarios que prestan asesoría legal gratuita a personas vulnerables y organizaciones sin fines de lucro. Además, la CAJ y la Defensoría Penal son las vías estatales de acceso gratuito a la justicia.',
    ctaText: 'Analizar mi caso para ayuda gratuita',
    bullets: [
      'Pro Bono atiende casos de derechos humanos, familia, vivienda, consumidor y organizaciones comunitarias, previa selección según criterios de vulnerabilidad.',
      'La CAJ patrocina causas civiles, laborales y de familia para personas de escasos recursos en todas las comunas del país.',
      'La Defensoría Penal Pública garantiza defensa gratuita a todo imputado que carezca de abogado, sin requisito socioeconómico.',
    ],
    faqs: [
      { q: '¿Cómo postulo a la Fundación Pro Bono?', a: 'Debes completar el formulario de postulación en el sitio de Pro Bono indicando tu situación. La fundación evalúa el caso y el criterio social para asignar un abogado voluntario.' },
      { q: '¿Qué diferencia hay entre Pro Bono y la CAJ?', a: 'La CAJ es estatal y financia defensores públicos; Pro Bono es una fundación de privados que participan voluntariamente. Ambos son gratuitos.' },
    ],
    titleSEO: 'Fundación Pro Bono y Abogados Gratuitos en Chile',
    metaDescription: 'Acceso gratuito a la justicia en Chile: Fundación Pro Bono, Corporación de Asistencia Judicial y Defensoría Penal Pública. Cómo postular y requisitos.',
    intent: 'Quiero acceder a abogados gratuitos de Pro Bono, la CAJ o la Defensoría.',
    caseType: 'general',
    role: 'consulta',
  },

  // ═════════= FASE 4: LONG-TAILS VALIDADAS GRUPO DEFENSA (10) ═════════
  {
    slug: '/que-es-el-autodespido',
    h1: 'Qué es el autodespido en Chile | Causales y Requisitos',
    diagnosText: 'El autodespido o despido indirecto (Art. 171 Código del Trabajo) permite al trabajador poner fin a la relación laboral imputando al empleador un incumplimiento grave: no pago de remuneraciones o cotizaciones, traslado sin consentimiento o vulneración de derechos. Si se acredita, tienes derecho a las indemnizaciones del despido injustificado.',
    ctaText: 'Analizar mi autodespido',
    bullets: [
      'Causales de autodespido: no pago de remuneraciones o cotizaciones previsionales, traslado de faena sin consentimiento, y actos del empleador que vulneren gravemente tus derechos.',
      'Debes invocar la causal por escrito y dentro del plazo: el autodespido se ejerce al momento de poner término, identificando el incumplimiento.',
      'Si el tribunal acoge, corresponde indemnización por años de servicio, aviso previo, feriado proporcional y las cotizaciones adeudadas.',
    ],
    faqs: [
      { q: '¿Puedo autodespedirme por el no pago de cotizaciones?', a: 'Sí. El no pago o el no enteramiento de cotizaciones previsionales es una de las causales clásicas de autodespido reconocidas por los tribunales.' },
      { q: '¿Qué pasa si pierdo el juicio de autodespido?', a: 'Se entiende que renunciaste voluntariamente y pierdes las indemnizaciones. Por eso la causal invocada debe estar sólidamente acreditada.' },
    ],
    titleSEO: 'Qué es el Autodespido en Chile | Art. 171 Código del Trabajo',
    metaDescription: 'Autodespido o despido indirecto en Chile: causales del Art. 171 CT, requisitos, cómo invocarlo y qué indemnizaciones puedes ganar.',
    intent: 'Mi empleador incumple gravemente y quiero saber si puedo autodespedirme.',
    caseType: 'laboral',
    role: 'demandante',
  },
  {
    slug: '/acoso-laboral-ley-karin',
    h1: 'Acoso laboral y Ley Karin en Chile | Cómo Denunciar',
    diagnosText: 'La Ley Karin (Nº 21.643) refuerza la prevención y sanción del acoso laboral, sexual y la violencia en el trabajo. El empleador debe implementar protocolos de prevención, recibir denuncias y adoptar medidas de resguardo. Si eres víctima, denuncia al canal interno o a la Inspección del Trabajo y a los tribunales.',
    ctaText: 'Analizar mi caso de acoso',
    bullets: [
      'La Ley Karin obliga a la empresa a incorporar la prevención del acoso en el reglamento interno y a investigar las denuncias de oficio.',
      'Puedes denunciar ante la Inspección del Trabajo, que fiscaliza y sanciona al empleador que no adopte medidas.',
      'Además de las multas administrativas, puedes demandar la tutela laboral por vulneración de derechos fundamentales y reclamar indemnización.',
    ],
    faqs: [
      { q: '¿Cuál es el plazo para denunciar el acoso laboral?', a: 'La acción de tutela se interpone dentro de los 60 días siguientes a la afectación. La denuncia ante la Inspección no está sujeta al mismo plazo.' },
      { q: '¿Puedo demandar indemnización por acoso laboral?', a: 'Sí. Vía tutela laboral puedes obtener la nulidad del despido (si te despidieron) y una indemnización por daño moral acreditado.' },
    ],
    titleSEO: 'Acoso Laboral y Ley Karin en Chile | Denuncia y Tutela',
    metaDescription: 'Ley Karin y acoso laboral en Chile: cómo denunciar ante la Inspección, plazos de la tutela laboral e indemnizaciones por vulneración de derechos.',
    intent: 'Sufro acoso laboral en mi trabajo y quiero saber cómo denunciar.',
    caseType: 'laboral',
    role: 'demandante',
  },
  {
    slug: '/si-me-detienen-cuales-son-mis-derechos',
    h1: 'Si me detienen, ¿cuáles son mis derechos en Chile?',
    diagnosText: 'Si eres detenido en Chile, tienes derechos básicos: que se te informe la causa de la detención, guardar silencio, no declarar sin abogado, llamar a un familiar o abogado, y comparecer ante el juez de garantía dentro de las 24 horas para el control de detención.',
    ctaText: 'Analizar mi caso de detención',
    bullets: [
      'Derecho a ser informado de tus derechos y de la causa de la detención, en un lenguaje comprensible y con traductor si es necesario.',
      'Derecho a guardar silencio: nada de lo que digas sin asesoría puede usarse en tu perjuicio de forma segura.',
      'El control de detención se realiza dentro de las 24 horas: el juez evalúa la legalidad de la detención y decide la prisión preventiva o medidas menos gravosas.',
    ],
    faqs: [
      { q: '¿Puedo llamar a mi familia si me detienen?', a: 'Sí. Tienes derecho a comunicar tu detención a un familiar o a tu abogado. Es un derecho del detenido bajo la Constitución y el Código Procesal Penal.' },
      { q: '¿Cuánto tiempo pueden tenerme detenido?', a: 'La detención por flagrancia no puede exceder de 24 horas sin control judicial. El juez entonces debe formalizar la investigación o decretar la libertad.' },
    ],
    titleSEO: 'Si Me Detienen ¿Cuáles Son Mis Derechos? | Chile',
    metaDescription: 'Tus derechos al ser detenido en Chile: informarte la causa, guardar silencio, llamar a un abogado y control de detención en 24 horas.',
    intent: 'Me detuvieron o un familiar está detenido y necesito saber cuáles son sus derechos.',
    caseType: 'penal',
    role: 'demandado',
  },
  {
    slug: '/como-salir-de-dicom',
    h1: 'Cómo salir de Dicom en Chile | Borrar tu Deuda de Equifax',
    diagnosText: 'Salir de Dicom (Equifax) depende de la causa de tu deuda: por pago, por prescripción o por haber sido incluido sin notificación válida. La deuda prescrita puede eliminarse aun sin pagar, y si la inclusión fue irregular puedes reclamar ante la CMF o demandar.',
    ctaText: 'Analizar mi salida de Dicom',
    bullets: [
      'Pago y solicitud de baja: el acreedor debe ordenar la eliminación de tu nombre del registro en un plazo breve tras el pago o la novación.',
      'Prescripción: si la acción ejecutiva prescribió (3 años) u ordinaria (5), puedes exigir tu eliminación de los registros de morosidad.',
      'Inclusión irregular: si te incluyeron sin deuda, sin notificación o por montos erróneos, reclama ante Equifax, la CMF o demanda por daño reputacional.',
    ],
    faqs: [
      { q: '¿Cuánto dura una deuda en Dicom?', a: 'Si la deuda está vigente y no se paga, puede permanecer en los registros de morosidad de forma indefinida mientras exista el impago.' },
      { q: '¿Cuánto tarda en salir de Dicom después de pagar?', a: 'Tras el pago, el acreedor debe comunicar la baja y Equifax debe eliminarte de los registros en un plazo cercano a 15 días hábiles.' },
    ],
    titleSEO: 'Cómo Salir de Dicom en Chile | Equifax y Registros de Morosidad',
    metaDescription: 'Sal de Dicom/Equifax en Chile: por pago, prescripción de la deuda o inclusión irregular. Pasos, plazos y dónde reclamar tu eliminación.',
    intent: 'Estoy en Dicom y quiero saber cómo salir del registro de morosidad.',
    caseType: 'deuda',
    role: 'consulta',
  },
  {
    slug: '/que-bienes-no-me-pueden-embargar',
    h1: 'Qué bienes no te pueden embargar en Chile | Inembargables',
    diagnosText: 'No todo lo que tienes puede embargarse. La ley declara inembargables la cama y ropa de cama del deudor, la cocina, la máquina de coser, los libros y herramientas de trabajo esenciales, los uniformes y las pensiones alimenticias. Además, los sueldos bajo 56 UTM líquidas son inembargables.',
    ctaText: 'Analizar mi embargo',
    bullets: [
      'Inembargables absolutos: cama, ropa de cama, cocina, vajilla y utensilios básicos, libros y herramientas de trabajo esenciales, uniformes y máquina de coser.',
      'Sueldos e ingresos: solo es embargable la parte que exceda de 56 UTM líquidas mensuales. Sobre ese exceso, hasta un 50% en algunos casos.',
      'Pensiones y prestaciones: las pensiones de vejez, invalidez y sobrevivencia son inembargables, salvo por deudas alimenticias.',
    ],
    faqs: [
      { q: '¿Me pueden embargar la casa donde vivo?', a: 'Sí, salvo la protección especial de la Ley 20.720 durante la renegociación. Pero la vivienda principal no está protegida automáticamente fuera de ese proceso.' },
      { q: '¿Pueden embargar mi vehículo?', a: 'Sí, si es tu propiedad y no califica como herramienta de trabajo esencial. Podrías alegar el carácter de herramienta laboral ante el tribunal.' },
    ],
    titleSEO: 'Qué Bienes No Te Pueden Embargar en Chile | Inembargables',
    metaDescription: 'Bienes inembargables en Chile: cama, cocina, herramientas de trabajo, uniformes y sueldos bajo 56 UTM. Conoce tus protecciones ante un embargo.',
    intent: 'Me van a embargar y quiero saber qué bienes están protegidos por la ley.',
    caseType: 'deuda',
    role: 'demandado',
  },
  {
    slug: '/prescripcion-de-deudas-chile',
    h1: 'Prescripción de deudas en Chile | Mitos y Realidad',
    diagnosText: 'Las deudas no duran para siempre: la acción ejecutiva prescribe a los 3 años y la ordinaria a los 5 años desde que la obligación se hizo exigible. La prescripción debe oponerse como excepción en el juicio; si la deuda ya prescribió y te demandan, puedes librarte sin pagar.',
    ctaText: 'Analizar la prescripción de mi deuda',
    bullets: [
      'La prescripción ejecutiva es de 3 años y la ordinaria de 5 desde que la obligación se hizo exigible (Art. 2515 y siguientes del Código Civil).',
      'La prescripción se interrumpe con la demanda, la notificación o el reconocimiento expreso de la deuda. También se suspende en ciertos casos.',
      'Los registros de morosidad (Dicom) pueden mantener la deuda una vez prescrita: debes reclamar la eliminación a la empresa deudora o a la CMF.',
    ],
    faqs: [
      { q: '¿Una deuda prescrita desaparece de Dicom?', a: 'No automáticamente. Debes solicitar la baja del registro a la empresa acreedora o reclamar a Equifax y a la CMF, acreditando la prescripción.' },
      { q: '¿Pagar una parte de la deuda reinicia la prescripción?', a: 'El pago parcial o el reconocimiento de la deuda pueden interrumpir la prescripción y reiniciar el plazo. Por eso no conviene reconocer por escrito una deuda antigua sin asesoría.' },
    ],
    titleSEO: 'Prescripción de Deudas en Chile | Plazos y Cómo Aplicarla',
    metaDescription: 'Prescripción de deudas en Chile: plazos de 3 y 5 años, cómo oponerla en juicio y qué hacer si tu deuda prescribió (Dicom).',
    intent: 'Quiero saber si mi deuda ya prescribió y cómo aplicarlo.',
    caseType: 'deuda',
    role: 'demandado',
  },
  {
    slug: '/que-hacer-si-llega-un-receptor-judicial',
    h1: 'Qué hacer si llega un receptor judicial a tu casa en Chile',
    diagnosText: 'La visita del receptor judicial puede significar una notificación o un embargo. No lo ignores ni lo enfrentes: pide identificar el mandamiento de ejecución, registra los bienes embargados y revisa el expediente en la OJV. El embargo se puede alzar pagando, oponiendo excepciones o acreditando que los bienes son inembargables.',
    ctaText: 'Analizar mi caso de embargo',
    bullets: [
      'El receptor debe exhibir el mandamiento de ejecución y embargo: si no lo tiene, no está facultado para embargar.',
      'Ante un embargo, registra fecha, bienes embargados y el receptor. Tienes 8 días hábiles para oponer excepciones o solicitar el alzamiento.',
      'Los bienes inembargables (cama, cocina, herramientas de trabajo, uniformes) deben excluirse. Si se embargaron, pide su desafectación.',
    ],
    faqs: [
      { q: '¿Puedo negarme a que el receptor entre a mi casa?', a: 'El receptor puede solicitar el auxilio de la fuerza pública si se le impide el acceso. Lo correcto es colaborar, registrar los bienes y actuar jurídicamente después.' },
      { q: '¿Qué pasa si embargaron mis herramientas de trabajo?', a: 'Puedes solicitar al tribunal la desafectación de bienes inembargables, acreditando que son tu herramienta esencial de trabajo.' },
    ],
    titleSEO: 'Qué Hacer si Llega un Receptor Judicial | Embargo en Chile',
    metaDescription: 'Un receptor judicial llegó a tu casa. Qué hacer ante una notificación o embargo, tus plazos para oponer excepciones y los bienes inembargables.',
    intent: 'Llegó un receptor judicial a mi casa por una deuda y no sé qué hacer.',
    caseType: 'deuda',
    role: 'demandado',
  },
  {
    slug: '/que-pasa-si-no-pago-un-credito',
    h1: '¿Qué pasa si no pago un crédito en Chile? | Consecuencias',
    diagnosText: 'No pagar un crédito tiene consecuencias graduales: cargos por mora, ingreso a Dicom, cobranza extrajudicial, y finalmente el juicio ejecutivo con embargo y remate de bienes. La gravedad depende del tipo de deuda, su antigüedad y si tienes garantía asociada (como un crédito hipotecario).',
    ctaText: 'Analizar mi deuda de crédito',
    bullets: [
      'Mora inicial: intereses moratorios, cargos y el reporte a Dicom/Equifax una vez superados los plazos de la entidad.',
      'Crédito hipotecario: el incumplimiento puede llevar al remate de la vivienda como garantía. La Ley 20.720 puede suspender el remate durante la renegociación.',
      'Consumo y tarjetas: cobranza extrajudicial intensiva y, si no hay acuerdo, demanda ejecutiva con embargo de sueldos y bienes embargables.',
    ],
    faqs: [
      { q: '¿Cuánto tiempo puedo estar sin pagar antes de que me demanden?', a: 'Depende del acreedor: entre 3 y 6 meses de mora suelen gatillar la cobranza judicial. No existe un plazo único.' },
      { q: '¿Me pueden quitar la casa por un crédito de consumo?', a: 'Un crédito de consumo no usa tu casa como garantía, pero si el juicio ejecutivo embarga la vivienda, sí puede rematarse si no es protegida.' },
    ],
    titleSEO: '¿Qué Pasa si No Pago un Crédito en Chile? | Consecuencias',
    metaDescription: 'No pagar un crédito en Chile: mora, Dicom, cobranza extrajudicial, juicio ejecutivo y embargo. Conoce tus opciones antes de que avance.',
    intent: 'No puedo pagar mi crédito y quiero saber qué consecuencias tiene.',
    caseType: 'deuda',
    role: 'consulta',
  },
  {
    slug: '/como-terminar-contrato-de-arriendo',
    h1: 'Cómo terminar un contrato de arriendo por incumplimiento',
    diagnosText: 'Para terminar un contrato de arriendo por incumplimiento debes invocar la causal legal o contractual (no pago de rentas, subarriendo no autorizado, daños al inmueble) y presentar la demanda de terminación de contrato ante el tribunal competente. El tribunal debe declarar el término y ordenar la restitución del inmueble.',
    ctaText: 'Analizar la terminación de mi contrato',
    bullets: [
      'Causales: no pago de rentas, subarriendo no autorizado, uso distinto al pactado, daño grave al inmueble o la entrega de una caución insuficiente.',
      'El plazo de arriendo vencido también permite la terminación sin causales de incumplimiento, mediante la acción de restitución o desalojo.',
      'En la misma demanda puedes pedir el cobro de las rentas adeudadas, los gastos de servicios y la indemnización por daños.',
    ],
    faqs: [
      { q: '¿Puedo terminar el contrato de arriendo por no pago de un solo mes?', a: 'Sí. Un mes de renta impaga es causal de terminación. Los tribunales valoran mejor los casos con 2 o más meses de morosidad acumulada.' },
      { q: '¿Puedo cambiar la chapa si el arrendatario no se va?', a: 'No. Cambiar la chapa o sacar las cosas del arrendatario constituye autotutela y puede ser un delito. Debes obtener una orden judicial de lanzamiento.' },
    ],
    titleSEO: 'Cómo Terminar un Contrato de Arriendo por Incumplimiento',
    metaDescription: 'Termina un contrato de arriendo por incumplimiento: causales legales, demanda de terminación, cobro de rentas adeudadas y orden de desalojo.',
    intent: 'Quiero terminar el contrato de arriendo porque el arrendatario incumplió.',
    caseType: 'arriendo',
    role: 'demandante',
  },
  {
    slug: '/juicio-de-arriendo',
    h1: 'Juicio de arriendo en Chile | Guía Completa por Materia',
    diagnosText: 'El juicio de arriendo agrupa las disputas entre arrendador y arrendatario: terminación de contrato por no pago, restitución o desalojo, cobro de rentas, indemnización de daños y defensa del arrendatario. Se tramita ante Juzgados de Policía Local (hasta 8 UTM) o Juzgados Civiles.',
    ctaText: 'Analizar mi juicio de arriendo',
    bullets: [
      'Terminación de contrato: por incumplimiento grave o por vencimiento del plazo, con restitución del inmueble.',
      'Desalojo y lanzamiento: la orden de lanzamiento se ejecuta con auxilio de la fuerza pública si es necesario.',
      'Defensa del arrendatario: excepciones por pago, vicios del inmueble y plazos de entrega voluntaria.',
      'Cobro de rentas: puedes acumular el cobro de las rentas atrasadas, servicios y daños con la terminación del contrato.',
    ],
    faqs: [
      { q: '¿Cuánto demora un juicio de arriendo?', a: 'Un desalojo sin oposición puede tardar 2 a 4 meses. Con contestación, puede extenderse a 8-14 meses según el tribunal.' },
      { q: '¿Qué tribunal ve mi juicio de arriendo?', a: 'Los Juzgados de Policía Local conocen causas de hasta 8 UTM. Sobre ese monto, corresponde el Juzgado Civil.' },
    ],
    titleSEO: 'Juicio de Arriendo en Chile | Guía Completa 2026',
    metaDescription: 'Todo sobre el juicio de arriendo en Chile: terminación de contrato, desalojo, cobro de rentas y defensa del arrendatario. Plazos y tribunales.',
    intent: 'Necesito una guía completa sobre los juicios de arriendo en Chile.',
    caseType: 'arriendo',
    role: 'consulta',
  },

  // ══════════ MULTAS DE TRÁNSITO / TAG / CONDUCTOR ══════════
  {
    slug: '/prescripcion-de-multas-de-transito',
    h1: 'Prescripción de multas de tránsito y TAG en Chile',
    diagnosText: `¿Tienes multas de tránsito o TAG que crees que ya no deberías pagar? En Chile, las multas prescriben. Esto significa que si la municipalidad o la concesionaria no cobran judicialmente dentro de ciertos plazos, la obligación de pagar se extingue por completo. Este artículo te explica todo lo que necesitas saber: plazos exactos, diferencia entre multas del conductor y multas de patente, cómo solicitar la prescripción paso a paso, formato de escrito incluido, y los errores más comunes que cometen los conductores al intentar prescribir sus multas.

## Tipos de multas y plazos de prescripción

En Chile existen dos tipos de multas de tránsito, y cada una tiene un plazo de prescripción diferente. Es fundamental que entiendas la diferencia porque de eso depende cuánto tiempo debes esperar antes de solicitar la prescripción.

### Multas asociadas al conductor (prescriben a 1 año)

Estas son las multas que se aplican directamente a la persona que cometió la infracción, sin importar qué vehículo conducía. Están reguladas por el artículo 54 de la Ley 15.231 sobre Organización y Atribuciones de los Juzgados de Policía Local. Los plazos son:

- Infracciones leves: 1 año desde que la multa quedó firme (sin recurso o tras resolución definitiva).
- Infracciones graves: 1 año desde que la multa quedó firme.
- Infracciones gravísimas: 1 año desde que la multa quedó firme.

Ejemplos de multas del conductor: conducir sin licencia, conducir en estado de ebriedad, exceso de velocidad, no respetar señales de tránsito, no ceder el paso a peatones, usar el celular manejando.

Si la municipalidad o Carabineros no inician cobro judicial dentro de 1 año, la multa prescribe y queda sin efecto. No necesitas hacer nada para que prescriba automáticamente, pero si quieres que se elimine del Registro Civil, debes solicitar la prescripción ante el Juzgado de Policía Local.

### Multas asociadas a la patente o TAG (prescriben a 3 años)

Estas son las multas que se aplican al vehículo, no al conductor. Incluyen las multas por circular sin TAG, por circular con TAG inhabilitado, por uso de vías exclusivas, y por infracciones de autopistas concesionadas. Están reguladas por el artículo 24 de la Ley 18.287 sobre Procedimiento ante los Juzgados de Policía Local. El plazo es:

- 3 años desde que la multa fue anotada en el Registro de Multas por Infracciones de Tránsito No Pagadas que lleva el Registro Civil.

Este plazo de 3 años comienza a correr desde la anotación en el Registro Civil, no desde la fecha de la infracción. Es decir, si te multaron en enero de 2023 pero la multa se anotó en el Registro Civil en marzo de 2023, el plazo de 3 años vence en marzo de 2026.

### Condonación del 80% de multas TAG

Además de la prescripción, existe la posibilidad de condonar el 80% del monto de multas TAG. La ley vigente permite condonar el 80% de multas TAG con un tope de 100 UTM. Esto significa que si debes 100 UTM, podrías pagar solo 20 UTM. Para saber si tu multa califica para la condonación, debes consultar directamente en el Juzgado de Policía Local o en la municipalidad que emitió la multa.

La condonación es diferente a la prescripción. La prescripción extingue la deuda completa (no pagas nada). La condonación reduce el monto (pagas el 20%). Si tu multa aún no ha prescrito pero quieres pagar menos, la condonación puede ser una buena opción.

## Cómo solicitar la prescripción de una multa de tránsito: paso a paso

El proceso de prescripción no es automático. Si bien la deuda se extingue por el paso del tiempo, si quieres que se elimine del Registro Civil y de tu hoja de vida del conductor, debes solicitarla formalmente. Aquí te explicamos cada paso:

### Paso 1: Verifica si tu multa ya prescribió

Antes de hacer cualquier trámite, verifica que la multa haya cumplido el plazo de prescripción. Para ello:

1. Ve al Registro Civil y solicita tu certificado de multas de tránsito. Este certificado muestra todas las multas registradas a tu nombre, incluyendo la fecha de anotación.
2. Revisa la fecha de anotación de cada multa. Si han pasado más de 1 año (para multas del conductor) o más de 3 años (para multas de patente/TAG), la multa puede prescribir.
3. Verifica que no exista cobro judicial pendiente. Si la municipalidad o la concesionaria iniciaron un juicio de cobro antes de que se cumpliera el plazo, la prescripción no aplica porque se interrumpió.

### Paso 2: Consigue el certificado de multas del Registro Civil

El certificado de multas del Registro Civil es el documento clave que acredita la existencia y el estado de tus multas. Lo puedes obtener:

- Presencialmente: en cualquier sucursal del Registro Civil con tu cédula de identidad. El trámite es gratuito y te lo entregan al instante.
- En línea: a través del sitio web del Registro Civil (registrocivil.cl) con tu clave Única.

El certificado muestra: número de infracción, fecha de la infracción, fecha de anotación en el Registro, monto de la multa, estado (pagada, impaga, prescrita).

### Paso 3: Redacta el escrito de solicitud de prescripción

El escrito es un documento formal que presentas ante el Juzgado de Policía Local. Debe contener los siguientes datos:

1. Datos del solicitante: nombre completo, RUT, domicilio.
2. Datos de la multa: número de infracción, fecha, monto, organismo emisor.
3. Fundamento legal: indica la ley que aplica (Ley 15.231 Art. 54 para multas del conductor, o Ley 18.287 Art. 24 para multas de patente/TAG).
4. Solicitud: pide que se declare la prescripción de la multa y que se ordene su eliminación del Registro Civil.
5. Documentos adjuntos: certificado de multas del Registro Civil, copia de cédula de identidad.

### Paso 4: Presenta el escrito en el Juzgado de Policía Local

El escrito se presenta en el Juzgado de Policía Local que dictó la multa. Si no sabes cuál es, revisa tu certificado de multas — ahí aparece el número del Juzgado.

Puedes presentar el escrito personalmente en la secretaría del Juzgado. No necesitas abogado para trámites ante el Juzgado de Policía Local si el monto no supera las 8 UTM. La prescripción de multas de tránsito generalmente no requiere abogado.

### Paso 5: Espera la resolución

El juez revisará tu solicitud y dictará una resolución declarando la prescripción. Esto puede tomar entre 1 y 4 semanas dependiendo de la carga del Juzgado. Si el juez aprueba la prescripción, emitirá una resolución judicial que ordena al Registro Civil eliminar la anotación de la multa.

### Paso 6: Presenta la resolución en el Registro Civil

Con la resolución judicial en mano, ve al Registro Civil y presenta una copia autorizada de la resolución. El Registro Civil tiene un plazo de 7 días hábiles para eliminar la anotación de tu hoja de vida del conductor. En temporada de permiso de circulación (febrero-marzo), este proceso puede demorar más.

## Formato de escrito de solicitud de prescripción

A continuación te dejamos un formato que puedes adaptar a tu caso. Recuerda que este es un modelo referencial y no constituye asesoría legal formal.

EN LO PRINCIPAL: Solicito prescripción de multa de tránsito. EN EL OTRO SI: Acompaño documentos.

SEÑOR JUEZ DE POLICÍA LOCAL DE [NOMBRE DE LA COMUNA]:

[NOMBRE COMPLETO], chileno(a), de [EDAD] años de edad, cédula de identidad N° [RUT], con domicilio en [DIRECCIÓN], COMUNA DE [COMUNA], con domicilio en [DIRECCIÓN], ya individualizado en autos, con respeto digo:

I. HECHOS

1. Que con fecha [FECHA DE LA INFRACCIÓN], se me aplicó una multa de tránsito por infracción N° [NÚMERO], por el organismo emisor [CARABINEROS / MUNICIPALIDAD / etc.].

2. Que dicha multa fue anotada en el Registro de Multas por Infracciones de Tránsito No Pagadas del Registro Civil con fecha [FECHA DE ANOTACIÓN].

3. Que han transcurrido más de [1 AÑO / 3 AÑOS] desde la anotación de la multa, sin que se haya iniciado cobro judicial alguno.

II. FUNDAMENTO LEGAL

4. Que el artículo 54 de la Ley 15.231 establece que las infracciones o contravenciones prescriben a los 1 año desde que quedaron firmes. / Que el artículo 24 de la Ley 18.287 establece que las multas asociadas a la patente prescriben a los 3 años desde su anotación en el Registro de Multas.

5. Que al no haberse iniciado cobro judicial dentro del plazo legal, la acción se ha extinguido por prescripción.

III. PETITORIO

POR TANTO, a Ud. solicito se sirva declarar la prescripción de la multa indicada y ordenar su eliminación del Registro de Multas por Infracciones de Tránsito No Pagadas del Registro Civil.

Santiago, [FECHA].

Firma: _______________

## Errores comunes al solicitar la prescripción

1. Presentar el escrito en el Juzgado equivocado: debes ir al Juzgado de Policía Local que dictó la multa, no al de tu domicilio.
2. No adjuntar el certificado de multas: sin este documento, el Juzgado no puede verificar la fecha de anotación.
3. Confundir plazos: 1 año para multas del conductor, 3 años para multas de patente/TAG. Si presentas la solicitud antes de tiempo, la rechazarán.
4. No verificar si hay cobro judicial: si la empresa inició un juicio antes de que prescribiera, la prescripción no aplica.
5. Olvidar presentar la resolución en el Registro Civil: el Juzgado ordena la eliminación, pero el trámite final lo haces tú en el Registro Civil.`,
    ctaText: 'Analizar la prescripción de mi multa',
    bullets: [
      'Multas del conductor (sin licencia, velocidad, ebriedad): prescriben a 1 año desde que quedaron firmes (Ley 15.231 Art. 54). Si no se cobran judicialmente en ese plazo, la acción se extingue.',
      'Multas de patente (TAG, Autopista Central, vías exclusivas): prescriben a 3 años desde la anotación en el Registro Civil (Ley 18.287 Art. 24). El plazo comienza desde la anotación, no desde la fecha de la infracción.',
      'Condonación del 80%: si tu multa TAG aún no prescribió, puedes beneficiarte con la condonación del 80% con tope de 100 UTM. Pagas solo el 20%.',
      'Paso 1: obtén tu certificado de multas en el Registro Civil (gratuito, al instante). Verifica la fecha de anotación de cada multa.',
      'Paso 2: redacta el escrito de solicitud de prescripción con tus datos, datos de la multa y fundamento legal (Ley 15.231 Art. 54 o Ley 18.287 Art. 24).',
      'Paso 3: presenta el escrito en el Juzgado de Policía Local que dictó la multa. No necesitas abogado si el monto es menor a 8 UTM.',
      'Paso 4: espera la resolución del juez (1-4 semanas). Si aprueba la prescripción, ordena la eliminación del Registro Civil.',
      'Paso 5: presenta la resolución en el Registro Civil. Tienen 7 días hábiles para eliminar la anotación.',
      'Error común: presentar el escrito en el Juzgado equivocado. Ve al que dictó la multa, no al de tu domicilio.',
      'Error común: no verificar si hay cobro judicial. Si la empresa inició juicio antes de que prescribiera, la prescripción no aplica.',
    ],
    faqs: [
      { q: '¿Cuánto tiempo prescribe una multa de TAG en Chile?', a: 'Las multas TAG prescriben a los 3 años desde su anotación en el Registro de Multas por Infracciones de Tránsito (Ley 18.287 Art. 24). Si la empresa no cobra judicialmente en ese plazo, la multa se extingue completamente. El plazo comienza desde la anotación en el Registro Civil, no desde la fecha de la infracción.' },
      { q: '¿Cuánto tiempo prescribe una multa de tránsito común?', a: 'Las multas asociadas al conductor (conducir sin licencia, exceso de velocidad, estado de ebriedad, uso de celular) prescriben a 1 año desde que quedaron firmes, según el artículo 54 de la Ley 15.231. Si en ese plazo no se inicia cobro judicial, la multa se extingue.' },
      { q: '¿Puedo solicitar la prescripción sin abogado?', a: 'Sí. En Juzgados de Policía Local puedes comparecer personalmente si el monto no supera las 8 UTM. La solicitud de prescripción es un trámite que puedes hacer tú mismo siguiendo el formato que te proporcionamos.' },
      { q: '¿Qué documentos necesito para solicitar la prescripción?', a: 'Necesitas: (1) certificado de multas del Registro Civil, (2) cédula de identidad vigente, (3) escrito de solicitud de prescripción con tus datos y los de la multa, y (4) copia de la notificación de la multa si la tienes.' },
      { q: '¿Qué pasa si tengo multas TAG y no las pago?', a: 'Las multas TAG pueden impedir la renovación del permiso de circulación, la transferencia del vehículo y generar cobranza judicial con embargo. Por eso es mejor solicitar la prescripción antes de que avance a cobro judicial.' },
      { q: '¿La prescripción de multas de TAG es diferente a la de deudas bancarias?', a: 'Sí, son temas legales distintos. Las multas TAG prescriben por la Ley 18.287 a los 3 años. Las deudas bancarias prescriben por el Código Civil a los 3 o 5 años. No confundas ambos plazos ni ambos procedimientos.' },
      { q: '¿Dónde presento el escrito de prescripción?', a: 'En el Juzgado de Policía Local que dictó la multa. No en el de tu domicilio. El número del Juzgado aparece en tu certificado de multas del Registro Civil.' },
      { q: '¿Cuánto tarda el proceso de prescripción?', a: 'Desde que presentas el escrito hasta que el juez dicta resolución, puede tomar entre 1 y 4 semanas. Luego, el Registro Civil tiene 7 días hábiles para eliminar la anotación. En temporada de permiso de circulación (febrero-marzo) puede demorar más.' },
      { q: '¿Puedo prescribir varias multas a la vez?', a: 'Sí. Puedes solicitar la prescripción de todas las multas que cumplan el plazo en un solo escrito, indicando los datos de cada una. Es más eficiente presentar una solicitud conjunta.' },
      { q: '¿Qué pasa si mi solicitud de prescripción es rechazada?', a: 'Si el juez rechaza la prescripción (por ejemplo, porque hay cobro judicial pendiente o el plazo no se cumple), puedes apelar dentro de 8 días hábiles ante el mismo Juzgado. La causa se eleva al Juzgado Civil de letras.' },
      { q: '¿Cómo sé si hay cobro judicial contra mí?', a: 'Puedes consultar en el Poder Judicial (oficinajudicialvirtual.pjud.cl) con tu RUT, o solicitar un certificado de deudas judiciales en el Registro Civil. Si hay un juicio de cobro, la prescripción no aplica mientras esté activo.' },
      { q: '¿La prescripción afecta mi hoja de vida del conductor?', a: 'Sí, positivamente. Una vez que el Registro Civil elimina la anotación, la multa desaparece de tu hoja de vida. Esto mejora tu historial como conductor y facilita la renovación de licencia y transferencia de vehículos.' },
      { q: '¿Puedo solicitar la prescripción de multas TAG que ya pagué?', a: 'No. La prescripción solo aplica a multas no pagadas y no cobradas judicialmente. Si ya pagaste la multa, no necesitas prescripción porque ya no adeudas nada.' },
      { q: '¿Qué diferencia hay entre prescripción y condonación de multas TAG?', a: 'La prescripción extingue la deuda completa (no pagas nada) pero requiere esperar 3 años. La condonación del 80% te permite pagar solo el 20% del monto pero no elimina la deuda, solo la reduce.' },
      { q: '¿Puedo conducir mientras espero la resolución de prescripción?', a: 'Sí. La solicitud de prescripción no afecta tu licencia de conducir ni tu ability para manejar. La multa sigue vigente hasta que el juez dicta resolución, pero no te impide conducir.' },
    ],
    titleSEO: 'Prescripción Multa TAG Chile 2026 | Cómo Eliminar Multas sin Pagar',
    metaDescription: 'Prescripción de multas de tránsito y TAG en Chile: plazos 1 y 3 años, paso a paso, formato de escrito, condonación 80%. Guía completa 2026.',
    intent: 'Quiero saber si mi multa de tránsito o TAG ya prescribió y cómo solicitar la prescripción.',
    caseType: 'deuda',
    role: 'consulta',
  },
  {
    slug: '/defensa-infracciones-transito',
    h1: 'Defensa ante infracciones de tránsito y multas municipales en Chile',
    diagnosText: 'Si recibiste una multa de tránsito que consideras injusta, tienes derecho a impugnarla. La defensa se presenta ante el Juzgado de Policía Local dentro de los 15 días hábiles siguientes a la notificación. Puedes alegar vicios en la notificación, error en la identificación del infractor, falta de señales o que la multa fue pagada. También puedes impugnar multas municipales por vías reservadas y TAG ante el mismo tribunal.',
    ctaText: 'Analizar mi defensa de tránsito',
    bullets: [
      'Plazo para impugnar: 15 días hábiles desde la notificación de la multa. Si no impugas a tiempo, la multa queda firme y no hay recurso.',
      'Causales de defensa: vicios de forma (notificación defectuosa, falta de fundamento legal), error en la identificación del conductor, señalización insuficiente, o pago de la multa.',
      'Multas municipales: las multas por vías exclusivas y TAG también se impugnan ante el Juzgado de Policía Local con los mismos plazos y causales.',
      'Forma de presentar: el escrito se presenta en el Juzgado de Policía Local que dictó la multa, indicando el número de la infracción, los hechos y los fundamentos legales.',
    ],
    faqs: [
      { q: '¿Cuánto tiempo tengo para impugnar una multa de tránsito?', a: 'Tienes 15 días hábiles desde la notificación de la multa para impugnarla ante el Juzgado de Policía Local. Pasado ese plazo, la multa queda firme.' },
      { q: '¿Qué documentos necesito para defenderme?', a: 'La notificación de la multa, datos del vehículo, cédula de identidad, y cualquier prueba que respalde tu defensa (fotos, GPS, testigos, comprobante de pago).' },
      { q: '¿Puedo impugnar una multa TAG?', a: 'Sí. Las multas por TAG o vías exclusivas se impugnan ante el Juzgado de Policía Local con los mismos plazos (15 días hábiles) y causales que las multas de tránsito.' },
      { q: '¿Qué pasa si pierdo la impugnación?', a: 'Si el juez confirma la multa, debes pagar el monto total dentro del plazo que fije la resolución. Si no pagas, puede iniciarse cobranza judicial.' },
    ],
    titleSEO: 'Defensa ante Infracciones de Tránsito en Chile | Impugnar Multas',
    metaDescription: 'Defensa ante infracciones de tránsito en Chile: plazos para impugnar, causales, documentos y cómo presentar tu recurso ante el Juzgado de Policía Local.',
    intent: 'Recibí una multa de tránsito injusta y quiero impugnarla ante el tribunal.',
    caseType: 'deuda',
    role: 'demandado',
  },
  {
    slug: '/limpieza-hoja-de-vida-conductor',
    h1: 'Limpieza de hoja de vida del conductor en Chile',
    diagnosText: 'La hoja de vida del conductor registra todas tus infracciones de tránsito, multas impagas y antecedentes como conductor. Si tienes multas prescritas, pagadas o registradas por error, puedes solicitar su limpieza ante el Registro Civil o directamente ante el organismo emisor de la multa. Una hoja limpia es requisito para renovar tu licencia de conducir y evitar problemas al transferir un vehículo.',
    ctaText: 'Analizar mi hoja de vida',
    bullets: [
      'Qué contiene: infracciones de tránsito, multas impagas, accidentes y antecedentes como conductor. Se consulta gratuitamente en el Registro Civil.',
      'Cuándo limpiar: si tienes multas prescritas (1 o 3 años), multas pagadas que no se actualizaron, o registros por error administrativo.',
      'Cómo solicitar: acude al Registro Civil con tu cédula de identidad y certificado de multas. Si hay errores, reclama directamente al organismo emisor (Carabineros, municipalidad o Autopista).',
      'Requisito para licencia: la renovación de la licencia de conducir verifica tu hoja de vida. Multas impagas pueden impedir la renovación o generar restricciones.',
    ],
    faqs: [
      { q: '¿Cómo consulto mi hoja de vida del conductor?', a: 'En el Registro Civil con tu cédula de identidad. También puedes solicitar un certificado de multas que muestra infracciones y multas registradas a tu nombre.' },
      { q: '¿Puedo limpiar la hoja de vida si la multa ya prescribió?', a: 'Sí. Si la multa prescribió (1 año para conductor, 3 para patente/TAG), solicita la eliminación al organismo emisor y al Registro Civil acreditando la prescripción.' },
      { q: '¿La hoja de vida afecta la transferencia de un vehículo?', a: 'Sí. Si el vehículo tiene multas impagas, la transferencia puede verse afectada. Verifica antes de vender y liquida las multas o solicita su prescripción.' },
      { q: '¿Qué hago si hay un error en mi hoja de vida?', a: 'Reclama por escrito al organismo que registró la multa (Carabineros, municipalidad) adjuntando comprobantes. Si no resuelven, puedes reclamar ante el Registro Civil.' },
    ],
    titleSEO: 'Limpieza de Hoja de Vida del Conductor en Chile | Cómo Limpiarla',
    metaDescription: 'Limpieza de hoja de vida del conductor en Chile: cómo consultarla, cuándo limpiar multas prescritas o pagadas, y requisito para licencia de conducir.',
    intent: 'Quiero limpiar mi hoja de vida del conductor porque tengo multas prescritas o pagadas.',
    caseType: 'deuda',
    role: 'consulta',
  },
  {
    slug: '/recurso-apelacion-juzgado-policia-local',
    h1: 'Recurso de apelación contra sentencia del Juzgado de Policía Local',
    diagnosText: 'Si perdiste un juicio en el Juzgado de Policía Local (multa de tránsito, infracción, disputa de arriendo o consumo), tienes derecho a apelar. El recurso de apelación se presenta dentro de los 8 días hábiles siguientes a la notificación de la sentencia ante el mismo Juzgado de Policía Local. La causa se eleva al Juzgado Civil de letras para una segunda revisión.',
    ctaText: 'Analizar mi recurso de apelación',
    bullets: [
      'Plazo fatal: 8 días hábiles desde la notificación de la sentencia para presentar el recurso de apelación. No hay prórroga ni ampliación.',
      'Fundamentos: el recurso se basa en errores de hecho (el juez valoró mal la prueba) o errores de derecho (el juez aplicó mal la ley). Debes señalar qué errores cometió el tribunal.',
      'Procedimiento: el escrito se presenta en el mismo Juzgado de Policía Local que dictó la sentencia. La causa se eleva al Juzgado Civil de letras del territorio.',
      'Efectos: la apelación puede suspender la ejecución de la sentencia si es de pena pecuniaria (multa). En otros casos, la sentencia se ejecuta mientras se resuelve la apelación.',
    ],
    faqs: [
      { q: '¿Cuánto tiempo tengo para apelar una sentencia del JPL?', a: '8 días hábiles desde la notificación de la sentencia. Es un plazo fatal: si no apelas a tiempo, pierdes el derecho a la segunda instancia.' },
      { q: '¿Necesito abogado para apelar?', a: 'En Juzgados de Policía Local puedes apelar personalmente hasta 8 UTM. Para montos superiores o en Juzgado Civil, necesitas patrocinio de abogado.' },
      { q: '¿Qué documentos necesito para la apelación?', a: 'Copia de la sentencia apelada, tu cédula de identidad y el escrito de apelación indicando los fundamentos de hecho y de derecho del recurso.' },
      { q: '¿Cuánto demora en resolverse una apelación?', a: 'Entre 3 y 12 meses dependiendo de la carga del Juzgado Civil. La causa se acoustic en tabla y se notifica a las partes.' },
    ],
    titleSEO: 'Recurso de Apelación Juzgado de Policía Local en Chile | Plazos',
    metaDescription: 'Recurso de apelación contra sentencia del Juzgado de Policía Local: plazo de 8 días hábiles, fundamentos, procedimiento y cómo presentar tu recurso.',
    intent: 'Perdí en el Juzgado de Policía Local y quiero apelar la sentencia.',
    caseType: 'deuda',
    role: 'demandado',
  },

  // ══════════ PRESCRIPCIÓN MULTA TAG (keyword exacta) ══════════
  {
    slug: '/prescripcion-multas-tag',
    h1: 'Prescripción de multas TAG en Chile',
    diagnosText: `¿Tienes una multa TAG y quieres saber si ya la puedes eliminar? Si la municipalidad te multó por circular sin TAG y han pasado más de 3 años desde que apareció en el Registro Civil, tu multa prescribió. Esto significa que no la tienes que pagar. Te explicamos cómo verificarlo y cómo eliminarla en un solo día.

## ¿Mi multa TAG ya prescribió? Cómo saberlo ahora

Para saber si tu multa TAG prescribió, necesitas una cosa: tu certificado de multas del Registro Civil.

1. Ve al Registro Civil con tu cédula de identidad (o entra a registrocivil.cl con tu clave Única).
2. Pide el certificado de multas de tránsito.
3. Busca las multas TAG. Fíjate en la fecha de anotación.
4. Si han pasado más de 3 años desde esa fecha, tu multa prescribió.

Ejemplo: si tu multa se anotó el 15 de marzo de 2023, el 16 de marzo de 2026 ya prescribió. No importa cuándo te multaron, importa cuándo se anotó en el Registro Civil.

## La multa TAG tiene dos partes: no las confundas

Cuando circulas sin TAG, te pueden cobrar dos cosas distintas:

1. La concesionaria (Autopista Central, Costanera Norte) te cobra el peaje + recargo. Eso es una deuda civil. Prescribe a los 5 años, pero te pueden demandar antes.
2. La municipalidad te multa por circular sin TAG. Eso es una multa de tránsito. Prescribe a los 3 años. Nadie te demanda, simplemente se extingue.

La prescripción que te conviene es la de la multa de tránsito (3 años). Es más fácil, no necesitas abogado, y se hace en el Juzgado de Policía Local.

## Cómo eliminar tu multa TAG que ya prescribió (paso a paso)

### Paso 1: saca tu certificado de multas

Ve al Registro Civil. Es gratis y te lo dan al instante. Si la multa TAG tiene más de 3 años anotada, pasa al paso 2.

### Paso 2: verifica que no te hayan demandado

Entra a oficinajudicialvirtual.pjud.cl, pon tu RUT y revisa si hay algún juicio de cobro. Si no hay nada, tu multa puede prescribir. Si hay un juicio, la prescripción no aplica.

### Paso 3: escribe tu solicitud

No necesitas abogado. Escribe un papel que diga:

"Señor Juez de Policía Local de [nombre de la comuna]: Yo, [tu nombre], RUT [tu RUT], solicito se declare la prescripción de la multa N° [número], por haber transcurrido más de 3 años desde su anotación en el Registro Civil (Ley 18.287 Art. 24). Pido se ordene su eliminación del Registro de Multas."

Adjunta: certificado de multas + copia de cédula de identidad.

### Paso 4: lleva el escrito al Juzgado

Ve al Juzgado de Policía Local que aparece en tu certificado de multas. No vayas al de tu domicilio, ve al que te multó. Presenta el escrito y te dan una constancia.

### Paso 5: espera la resolución (1 a 4 semanas)

El juez revisa tu caso y dicta una resolución. Si aprueba la prescripción, te avisan para que pases a buscar la resolución.

### Paso 6: lleva la resolución al Registro Civil

Con la resolución en mano, ve al Registro Civil y entrega una copia. Ellos borran la multa de tu hoja de vida en 7 días hábiles.

## ¿Y si mi multa TAG no ha prescribido? Condonación del 80%

Si tu multa TAG tiene menos de 3 años, aún no prescribió. Pero existe la condonación del 80%. Esto significa que puedes pagar solo el 20% del total. Tope: 100 UTM.

Ejemplo: si debes 50 UTM, pagas 10 UTM. Si debes 200 UTM, pagas 40 UTM (porque el tope es 100 UTM, y el 20% de 100 UTM es 20 UTM... espera, 200 UTM es más de 100 UTM, entonces pagas 20 UTM).

Consulta en el Juzgado de Policía Local si tu multa califica para la condonación.

## ¿Necesitas ayuda? WhatsApp gratis

Si no sabes si tu multa prescribió, si no entiendes el certificado de multas, o si necesitas que te ayuden con el escrito, escríbenos por WhatsApp. Te orientamos sin costo.

WhatsApp: +56 9 6765 8939`,
    ctaText: 'Consultar si mi multa TAG ya prescribió',
    bullets: [
      '¿Tu multa TAG tiene más de 3 años anotada en el Registro Civil? Ya prescribió. No la tienes que pagar.',
      'Paso 1: saca tu certificado de multas en el Registro Civil (gratis, al instante).',
      'Paso 2: verifica que no haya juicio de cobro en oficinajudicialvirtual.pjud.cl.',
      'Paso 3: escribe una solicitud simple pidiendo la prescripción (Ley 18.287 Art. 24).',
      'Paso 4: lleva el escrito al Juzgado de Policía Local que te multó (no al de tu domicilio).',
      'Paso 5: espera 1-4 semanas la resolución del juez.',
      'Paso 6: lleva la resolución al Registro Civil para que borren la multa (7 días hábiles).',
      'No necesitas abogado. El trámite es gratis y lo puedes hacer tú mismo.',
      'Si tu multa tiene menos de 3 años, puedes pagar solo el 20% con la condonación del 80%.',
      'No confundas: la deuda con la concesionaria (5 años) es distinta a la multa de tránsito (3 años).',
    ],
    faqs: [
      { q: '¿Cuánto tiempo prescribe una multa TAG?', a: 'La multa de tránsito TAG prescribe a los 3 años desde que se anotó en el Registro Civil (Ley 18.287 Art. 24). No desde la fecha de la infracción, sino desde la anotación.' },
      { q: '¿Cómo sé si mi multa TAG ya prescribió?', a: 'Ve al Registro Civil y pide tu certificado de multas. Si la fecha de anotación tiene más de 3 años, la multa prescribió y puedes eliminarla.' },
      { q: '¿Puedo eliminar la multa TAG sin abogado?', a: 'Sí. Ve al Juzgado de Policía Local con una solicitud simple y tu certificado de multas. No necesitas abogado si el monto es menor a 8 UTM.' },
      { q: '¿Dónde presento la solicitud de prescripción?', a: 'En el Juzgado de Policía Local que dictó la multa. Aparece en tu certificado de multas del Registro Civil. No vayas al de tu domicilio.' },
      { q: '¿Cuánto tarda en borrar la multa?', a: 'El juez tarda 1-4 semanas en dictar resolución. Luego el Registro Civil tarda 7 días hábiles en borrar la anotación. En temporada de permiso de circulación puede tardar más.' },
      { q: '¿Qué pasa si no pago la multa TAG?', a: 'Si no pagas y no solicitas prescripción, la multa puede impedir la renovación del permiso de circulación y la transferencia del vehículo. Por eso es mejor solicitar la prescripción.' },
      { q: '¿La prescripción borra la multa de mi hoja de vida?', a: 'Sí. Una vez que el Registro Civil recibe la resolución del juez, borra la multa de tu hoja de vida del conductor.' },
      { q: '¿Puedo prescribir varias multas TAG juntas?', a: 'Sí. En un solo escrito puedes pedir la prescripción de todas las multas TAG que tengan más de 3 años.' },
      { q: '¿Qué diferencia hay entre prescripción y condonación?', a: 'La prescripción borra la multa completa (no pagas nada). La condonación del 80% te deja pagar solo el 20%. La prescripción requiere 3 años, la condonación no.' },
      { q: '¿Me pueden demandar por la multa TAG?', a: 'La municipalidad no te demanda por la multa de tránsito. Pero la concesionaria sí puede demandarte por la deuda civil del peaje (5 años de prescripción).' },
      { q: '¿Puedo manejar mientras espero la prescripción?', a: 'Sí. La solicitud de prescripción no afecta tu licencia ni tu ability para manejar.' },
      { q: '¿Necesito pagar algo para prescribir la multa?', a: 'No. El trámite de prescripción es completamente gratis. Solo necesitas tu tiempo para ir al Registro Civil y al Juzgado.' },
    ],
    titleSEO: 'Prescripción Multa TAG Chile 2026 | Plazo 3 Años y Cómo Solicitarla',
    metaDescription: 'Prescripción de multas TAG en Chile: plazo de 3 años, paso a paso, diferencia con condonación 80%, formato de escrito. Guía completa 2026.',
    intent: 'Quiero saber si mi multa TAG ya prescribió y cómo eliminarla del Registro Civil.',
    caseType: 'deuda',
    role: 'consulta',
  },
];