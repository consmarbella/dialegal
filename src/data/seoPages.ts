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

export const SEO_PAGES: SEOPage[] = [
  // ── ARRIENDO: DEMANDAR ──
  {
    slug: '/como-demandar-por-arriendo',
    h1: 'Cómo demandar por arriendo en Chile',
    diagnosText: 'Si tu arrendatario dejó de pagar, rompió el contrato o se niega a entregar la propiedad, puedes iniciar un juicio de arriendo ante el Juzgado de Policía Local o Juzgado Civil. El proceso parte con una demanda que debe incluir el contrato, las liquidaciones impagas y tu cédula de identidad.',
    ctaText: 'Analizar mi caso de arriendo',
    bullets: [
      'El plazo para demandar por deuda de arriendo es de 5 años desde que se hizo exigible el pago.',
      'Los Juzgados de Policía Local ven causas de arriendo de hasta 8 UTM (unos $520.000 aprox.). Sobre ese monto, vas al Juzgado Civil.',
      'Además del desalojo, puedes pedir el pago de las rentas atrasadas, las cuentas de servicios y la indemnización por los daños a la propiedad.',
    ],
    faqs: [
      { q: '¿Cuánto demora un juicio de arriendo en Chile?', a: 'Depende del tribunal y de si el arrendatario se defiende. Un desalojo sin oposición puede tomar 2 a 4 meses. Si hay contestación, puede extenderse a 8-12 meses.' },
      { q: '¿Necesito abogado para demandar por arriendo?', a: 'En causas de Policía Local puedes comparecer personalmente hasta 8 UTM. Sobre ese monto o en Juzgado Civil, necesitas patrocinio de abogado habilitado (Ley 18.120).' },
      { q: '¿Qué documentos necesito para la demanda de arriendo?', a: 'Contrato de arriendo, comprobantes de no pago, certificado de dominio vigente, cédula de identidad y comprobante de domicilio.' },
    ],
    titleSEO: 'Cómo Demandar por Arriendo en Chile | Guía Legal Completa',
    metaDescription: 'Aprende cómo poner una demanda por arriendo en Chile. Guía paso a paso sobre juicios de arriendo en Policía Local y Juzgado Civil. Plazos, documentos y costos.',
    intent: 'Quiero demandar a mi arrendatario por no pago de arriendo o incumplimiento de contrato.',
    caseType: 'arriendo',
    role: 'demandante',
  },
  {
    slug: '/como-demandar-por-no-pago-de-arriendo',
    h1: 'Cómo demandar por no pago de arriendo',
    diagnosText: 'Cuando el arrendatario acumula meses sin pagar, puedes iniciar una demanda de terminación de contrato por incumplimiento grave. La ley te permite pedir el desalojo forzoso, el pago de lo adeudado con reajustes e intereses, y que se condene en costas al demandado.',
    ctaText: 'Analizar mi caso de deuda de arriendo',
    bullets: [
      'La Ley 18.101 regula el arriendo de predios urbanos y establece que el no pago de la renta es causal de término inmediato.',
      'Puedes acumular en la misma demanda: término de contrato, desalojo y cobro de rentas impagas más multas del contrato.',
      'Si el arrendatario abandonó la propiedad, igual puedes demandar para que el tribunal declare el término y puedas cambiar la chapa sin riesgo de autotutela.',
    ],
    faqs: [
      { q: '¿Cuántos meses de no pago necesito para demandar?', a: 'Legalmente con un solo mes de atraso puedes demandar. Los jueces valoran mejor los casos con 2 o más meses de morosidad acumulada.' },
      { q: '¿Puedo cortar los servicios básicos si no me pagan?', a: 'No. Eso constituye autotutela ilegítima. Debes recurrir al tribunal. La única forma legal de recuperar el inmueble es mediante orden judicial de lanzamiento.' },
    ],
    titleSEO: 'Demanda por No Pago de Arriendo en Chile | Recupera tu Propiedad',
    metaDescription: 'Tu arrendatario no paga el arriendo. Te explicamos cómo demandar por no pago, pedir el desalojo y cobrar las rentas atrasadas en Chile.',
    intent: 'Mi arrendatario no paga el arriendo y quiero demandarlo para recuperar la propiedad y cobrar lo adeudado.',
    caseType: 'arriendo',
    role: 'demandante',
  },
  {
    slug: '/como-recuperar-casa-arrendada',
    h1: 'Cómo recuperar una casa arrendada en Chile',
    diagnosText: 'Si el arrendatario no paga, se niega a entregar el inmueble al término del contrato o lo está dañando, necesitas una orden judicial de lanzamiento. El tribunal debe declarar primero el término del contrato y luego ordenar el desalojo con auxilio de la fuerza pública si es necesario.',
    ctaText: 'Analizar mi caso de desalojo',
    bullets: [
      'La acción de desalojo o "lanzamiento" es la única vía legal para recuperar la posesión material del inmueble.',
      'El procedimiento más rápido es el del contrato de arriendo con plazo vencido. Si no hay contrato escrito, el proceso es más lento.',
      'No puedes cambiar la chapa ni sacar las cosas del arrendatario por tu cuenta. Eso es delito de usurpación o autotutela.',
    ],
    faqs: [
      { q: '¿Cuánto demora un desalojo en Chile?', a: 'Con contrato vencido y sin oposición, entre 2 y 5 meses. Con oposición del arrendatario, puede tomar 8 a 14 meses dependiendo del tribunal.' },
      { q: '¿Quién paga los costos del desalojo?', a: 'Si ganas el juicio, el tribunal condena en costas al arrendatario. Mientras tanto, los gastos iniciales (abogado, notificaciones, receptor) corren por tu cuenta.' },
    ],
    titleSEO: 'Cómo Recuperar una Casa Arrendada | Desalojo en Chile',
    metaDescription: 'Recupera tu casa arrendada por la vía legal. Te explicamos el procedimiento de desalojo, plazos, costos y cómo iniciar el juicio hoy.',
    intent: 'Necesito recuperar mi propiedad arrendada porque el arrendatario no paga, no se va o dañó el inmueble.',
    caseType: 'arriendo',
    role: 'demandante',
  },

  // ── ARRIENDO: ME DEMANDARON ──
  {
    slug: '/me-demandaron-por-arriendo',
    h1: 'Me demandaron por arriendo: qué hacer',
    diagnosText: 'Recibiste una notificación del tribunal por una demanda de arriendo. Tienes un plazo acotado para contestar y defenderte. No ignores la notificación: si no respondes a tiempo, el juez puede ordenar el desalojo y condenarte al pago de todo lo adeudado más intereses y costas, sin escuchar tu versión.',
    ctaText: 'Analizar mi demanda de arriendo',
    bullets: [
      'El plazo para contestar una demanda de arriendo en Policía Local es de 5 días hábiles desde la notificación.',
      'Puedes oponer excepciones como: pago total o parcial de la deuda, falta de legitimidad del demandante, o vicios del inmueble que justifiquen la retención de la renta.',
      'Si no tienes abogado, puedes acudir a la Corporación de Asistencia Judicial (CAJ) de tu comuna para que te asignen un abogado gratuito.',
    ],
    faqs: [
      { q: '¿Qué pasa si no contesto la demanda de arriendo?', a: 'El tribunal puede declarar tu rebeldía, tener por reconocidos los hechos de la demanda y ordenar el lanzamiento con fuerza pública en pocas semanas.' },
      { q: '¿Puedo llegar a un acuerdo sin ir a juicio?', a: 'Sí. Puedes negociar directamente con el arrendador o su abogado un plan de pago, una fecha de entrega voluntaria o un avenimiento que ponga fin al juicio.' },
    ],
    titleSEO: 'Me Demandaron por Arriendo ¿Qué Hago? | Defensa Legal',
    metaDescription: 'Te llegó una demanda por arriendo en Chile. Te explicamos qué hacer, cómo contestar, tus plazos y cómo evitar un desalojo forzoso.',
    intent: 'Me llegó una demanda de arriendo y necesito saber cómo defenderme y cuánto tiempo tengo.',
    caseType: 'arriendo',
    role: 'demandado',
  },
  {
    slug: '/me-quieren-desalojar',
    h1: 'Me quieren desalojar de mi casa: qué hacer',
    diagnosText: 'Si recibiste una notificación de desalojo o un receptor judicial te informó que hay una orden de lanzamiento en tu contra, el tiempo es crítico. Dependiendo de la etapa en que esté el juicio, puedes oponerte al desalojo, pedir más plazo para entregar el inmueble o negociar una salida voluntaria que evite el uso de fuerza pública.',
    ctaText: 'Analizar mi orden de desalojo',
    bullets: [
      'Si el juicio ya está terminado y hay sentencia firme de desalojo, las opciones de defensa se reducen drásticamente. Pide asesoría inmediata.',
      'En algunos casos puedes solicitar al tribunal un plazo de gracia para hacer entrega voluntaria, especialmente si hay menores de edad o adultos mayores viviendo en el inmueble.',
      'La orden de lanzamiento se ejecuta con Carabineros. No te resistas: es delito. Busca asesoría antes de que llegue ese momento.',
    ],
    faqs: [
      { q: '¿Me pueden desalojar con niños pequeños en la casa?', a: 'Sí, pero el tribunal suele dar plazos adicionales. Debes informarlo formalmente al juez mediante un escrito con patrocinio de abogado.' },
      { q: '¿Cuánto tiempo tengo desde que me notifican el desalojo?', a: 'Depende de la orden judicial. Generalmente son 5 a 10 días hábiles, pero puede ser inmediato si el tribunal así lo ordenó.' },
    ],
    titleSEO: 'Me Quieren Desalojar en Chile | Defensa Urgente contra Lanzamiento',
    metaDescription: 'Te quieren desalojar. Conoce tus opciones legales, plazos, cómo pedir más tiempo y qué hacer si llega Carabineros con la orden de lanzamiento.',
    intent: 'Me quieren desalojar de donde vivo y necesito ayuda urgente para evitarlo o ganar tiempo.',
    caseType: 'arriendo',
    role: 'demandado',
  },

  // ── LABORAL: DEMANDAR ──
  {
    slug: '/como-demandar-por-despido-injustificado',
    h1: 'Cómo demandar por despido injustificado en Chile',
    diagnosText: 'Si te despidieron invocando "necesidades de la empresa" pero contrataron a alguien en tu lugar, o te echaron sin causa justificada, puedes demandar por despido injustificado. Tienes 60 días hábiles desde el despido para presentar tu demanda en el Juzgado del Trabajo. Si no reclamas en ese plazo, pierdes el derecho a demandar.',
    ctaText: 'Analizar mi caso de despido',
    bullets: [
      'El plazo de 60 días hábiles se SUSPENDE si presentas un reclamo ante la Inspección del Trabajo. La suspensión dura hasta 90 días corridos mientras la inspección media.',
      'Si ganas, puedes obtener: indemnización sustitutiva del aviso previo (1 mes), indemnización por años de servicio (1 mes por año trabajado) y recargo legal del 30% al 100% según la causal.',
      'Además del despido injustificado, puedes demandar por tutela laboral si te despidieron por discriminación, sindicalización, embarazo o ejercicio de derechos fundamentales.',
    ],
    faqs: [
      { q: '¿Cuánto puedo ganar si demando por despido injustificado?', a: 'Depende de tus años de servicio y sueldo. La indemnización base es 1 mes de sueldo por año trabajado, más recargo. También se suman feriado proporcional y cotizaciones impagas.' },
      { q: '¿Puedo demandar si firmé el finiquito?', a: 'Sí, si escribiste "Reservo mis derechos" antes de firmar o si el finiquito no fue ratificado ante notario o Inspección del Trabajo. Sin reserva, pierdes el derecho a demandar.' },
    ],
    titleSEO: 'Cómo Demandar por Despido Injustificado en Chile | Guía 2026',
    metaDescription: 'Te despidieron injustificadamente. Aprende cómo demandar a tu empleador, cuánto puedes ganar, plazos, documentos necesarios y cómo calcular tu indemnización.',
    intent: 'Me despidieron injustificadamente y quiero demandar a mi empleador por indemnización.',
    caseType: 'laboral',
    role: 'demandante',
  },
  {
    slug: '/como-demandar-por-cotizaciones-impagas',
    h1: 'Cómo demandar por cotizaciones impagas',
    diagnosText: 'Si tu empleador no pagó tus cotizaciones previsionales (AFP), de salud (Fonasa o Isapre) o de cesantía (AFC), puedes demandarlo. Las cotizaciones impagas son un incumplimiento grave que, además, constituye apropiación indebida. Puedes reclamar en la Inspección del Trabajo o demandar directamente en el Juzgado del Trabajo.',
    ctaText: 'Analizar mi caso de cotizaciones',
    bullets: [
      'Revisa tus cotizaciones en www.previred.com o en la app de tu AFP. Si aparecen como "no pagadas" o en "cobranza", tu empleador te debe esos montos.',
      'El empleador que descuenta las cotizaciones y no las paga comete el delito de apropiación indebida del artículo 19 del DL 3.500.',
      'Puedes reclamar ante la Inspección del Trabajo (gratuito, pero más lento) o presentar una demanda directamente (más rápido, pero necesitas abogado).',
    ],
    faqs: [
      { q: '¿Cuánto tiempo tengo para demandar por cotizaciones impagas?', a: 'Las cotizaciones de seguridad social son imprescriptibles, es decir, puedes demandarlas en cualquier momento. No caducan.' },
      { q: '¿Puedo autodespedirme por no pago de cotizaciones?', a: 'Sí. El artículo 171 del Código del Trabajo permite el autodespido o despido indirecto si el empleador incumple gravemente, y el no pago de cotizaciones es considerado un incumplimiento grave.' },
    ],
    titleSEO: 'Cómo Demandar por Cotizaciones Impagas en Chile | Defensa Laboral',
    metaDescription: 'Tu empleador no pagó tus cotizaciones de AFP, salud o cesantía. Aprende cómo demandar, qué puedes ganar y cómo revisar si tienes cotizaciones impagas.',
    intent: 'Mi empleador no pagó mis cotizaciones y quiero demandarlo para que las pague.',
    caseType: 'laboral',
    role: 'demandante',
  },

  // ── LABORAL: ME DEMANDARON ──
  {
    slug: '/me-demandaron-por-despido',
    h1: 'Me demandaron por despido: qué hacer',
    diagnosText: 'Recibiste una notificación del Juzgado del Trabajo porque un extrabajador te demandó por despido injustificado, nulidad del despido o tutela laboral. Tienes 5 días hábiles antes de la audiencia preparatoria para presentar tu contestación por escrito. Si no contestas, el juez puede tener por ciertos todos los hechos que alega el demandante y condenarte sin escuchar tu defensa.',
    ctaText: 'Analizar mi demanda laboral',
    bullets: [
      'En la contestación debes negar los hechos uno a uno. No basta con decir "rechazo la demanda". Cada punto debe ser controvertido.',
      'La nulidad del despido (Ley Bustos) es especialmente peligrosa: si no pagaste las cotizaciones, el juez puede ordenar que pagues los sueldos desde el despido hasta que regularices.',
      'Reúne YA: contrato de trabajo, libro de asistencia, comprobantes de pago de cotizaciones, cartas de despido y finiquitos.',
    ],
    faqs: [
      { q: '¿Cuánto me puede costar perder un juicio laboral?', a: 'Depende de lo demandado. Un despido injustificado típico cuesta entre 2 y 12 meses de sueldo. Si hay nulidad del despido por cotizaciones impagas, la condena puede ser mucho mayor porque se acumulan meses de remuneraciones.' },
      { q: '¿Puedo conciliar antes del juicio?', a: 'Sí. En la audiencia preparatoria el juez llama a conciliación. Un buen acuerdo ahora puede ahorrarte las costas del juicio y la condena completa.' },
    ],
    titleSEO: 'Me Demandaron por Despido ¿Qué Hago? | Defensa para Empleadores',
    metaDescription: 'Un extrabajador te demandó por despido injustificado. Te explicamos cómo contestar la demanda, plazos, riesgos y cómo preparar tu defensa laboral.',
    intent: 'Un extrabajador me demandó por despido injustificado y necesito defenderme.',
    caseType: 'laboral',
    role: 'demandado',
  },

  // ── DEUDA / CIVIL: DEMANDAR ──
  {
    slug: '/como-demandar-por-incumplimiento-de-contrato',
    h1: 'Cómo demandar por incumplimiento de contrato',
    diagnosText: 'Si la otra parte no cumplió lo pactado en un contrato (compraventa, prestación de servicios, obra, sociedad), puedes demandar para exigir el cumplimiento forzado o pedir la resolución del contrato más indemnización de perjuicios. La vía es un juicio ordinario civil ante el Juzgado Civil correspondiente al domicilio del demandado.',
    ctaText: 'Analizar mi caso de contrato',
    bullets: [
      'El artículo 1489 del Código Civil te da dos opciones: (1) exigir el cumplimiento forzado del contrato, o (2) pedir la resolución del contrato. En ambos casos puedes pedir indemnización de perjuicios.',
      'El plazo para demandar por incumplimiento de contrato es de 5 años desde que se hizo exigible la obligación (prescripción ordinaria).',
      'Documenta TODO: el contrato firmado, correos, WhatsApp, boletas y cualquier prueba que demuestre el incumplimiento.',
    ],
    faqs: [
      { q: '¿Puedo demandar sin contrato escrito?', a: 'Sí, pero es más difícil probar el acuerdo y sus condiciones. Los contratos pueden ser verbales, pero necesitas testigos, correos u otra evidencia del pacto original.' },
      { q: '¿Cuánto demora un juicio ordinario civil en Chile?', a: 'Entre 1 y 3 años aproximadamente, dependiendo de la complejidad, las pruebas, los recursos y la carga del tribunal.' },
    ],
    titleSEO: 'Cómo Demandar por Incumplimiento de Contrato en Chile',
    metaDescription: 'La otra parte no cumplió el contrato. Aprende cómo demandar por incumplimiento, pedir indemnización y las opciones legales según el Código Civil chileno.',
    intent: 'Firmamos un contrato y la otra parte no cumplió. Quiero demandar para que cumpla o me indemnice.',
    caseType: 'civil',
    role: 'demandante',
  },
  {
    slug: '/como-demandar-por-deuda',
    h1: 'Cómo poner una demanda por deuda en Chile',
    diagnosText: 'Si alguien te debe dinero y no paga, puedes iniciar un juicio ejecutivo o un juicio ordinario según el título que tengas. Si posees un pagaré, cheque protestado, factura o contrato con deuda líquida, puedes ir por la vía ejecutiva, que es mucho más rápida y empieza con un embargo de bienes del deudor. Si no tienes un título ejecutivo, debes ir por la vía ordinaria.',
    ctaText: 'Analizar mi caso de deuda',
    bullets: [
      'La vía ejecutiva es la más rápida: presentas el título (pagaré, cheque, factura), el tribunal despacha mandamiento de ejecución y embargo, y el receptor va a embargar bienes del deudor.',
      'El deudor tiene solo 8 días hábiles para oponerse desde que lo notifican del embargo.',
      'Los títulos ejecutivos más comunes son: pagaré notarial, cheque protestado, factura aceptada, sentencia firme y confesión de deuda.',
    ],
    faqs: [
      { q: '¿Cuánto cuesta demandar por deuda?', a: 'Depende del monto. Los gastos iniciales incluyen abogado, notificaciones y receptor judicial. En juicios de bajo monto puedes acudir a la CAJ gratuitamente.' },
      { q: '¿Qué pasa si el deudor no tiene bienes?', a: 'Tener una sentencia a tu favor no garantiza el pago. Si el deudor no tiene bienes embargables ni ingresos conocidos, el cobro se vuelve muy difícil. Revisa la solvencia antes de iniciar el juicio.' },
    ],
    titleSEO: 'Cómo Poner una Demanda por Deuda en Chile | Guía Legal',
    metaDescription: 'Te deben plata y no te pagan. Aprende cómo poner una demanda por deuda, la diferencia entre juicio ejecutivo y ordinario, plazos y requisitos.',
    intent: 'Me deben dinero y quiero demandar para recuperarlo.',
    caseType: 'deuda',
    role: 'demandante',
  },
  {
    slug: '/como-demandar-por-danos-y-perjuicios',
    h1: 'Cómo demandar por daños y perjuicios',
    diagnosText: 'Si sufriste un daño material o moral por culpa o dolo de otra persona, puedes demandar la indemnización de perjuicios. Esto cubre daño emergente (lo que perdiste), lucro cesante (lo que dejaste de ganar) y daño moral (el sufrimiento causado). Se tramita como juicio ordinario civil, salvo que derives de un accidente de tránsito u otra ley especial.',
    ctaText: 'Analizar mi caso de daños',
    bullets: [
      'Debes probar tres cosas: (1) que existió un daño concreto, (2) que la otra parte actuó con culpa o dolo, y (3) el vínculo causal entre su acción y tu daño.',
      'El daño moral es cada vez más reconocido por los tribunales chilenos, pero debes acreditarlo con testigos, informes psicológicos o evidencia del impacto en tu vida.',
      'El plazo para demandar por responsabilidad extracontractual (ej: accidente) es de 4 años. Para responsabilidad contractual (ej: incumplimiento de contrato) es de 5 años.',
    ],
    faqs: [
      { q: '¿Cuánto dinero puedo pedir por daño moral?', a: 'No hay una tabla fija. Depende del juez y de la gravedad del daño. En la práctica, las indemnizaciones por daño moral van desde $1.000.000 hasta $50.000.000 o más en casos gravísimos.' },
      { q: '¿Necesito abogado para demandar por daños y perjuicios?', a: 'Sí. Es un juicio complejo que requiere patrocinio de abogado. Además, la redacción de la demanda y la prueba de los daños son técnicas y requieren experiencia.' },
    ],
    titleSEO: 'Cómo Demandar por Daños y Perjuicios en Chile | Indemnización',
    metaDescription: 'Sufriste un daño material o moral. Aprende cómo demandar por daños y perjuicios, qué puedes pedir y cómo probar el daño ante tribunales chilenos.',
    intent: 'Alguien me causó un daño y quiero demandar por indemnización de perjuicios.',
    caseType: 'civil',
    role: 'demandante',
  },

  // ── DEUDA / CIVIL: ME DEMANDARON ──
  {
    slug: '/me-demandaron-por-deuda',
    h1: 'Me demandaron por deuda: qué hacer',
    diagnosText: 'Recibiste una notificación judicial de demanda por deuda. Lo peor que puedes hacer es ignorarla. Si es un juicio ejecutivo, el tribunal ya ordenó el embargo de tus bienes y el receptor judicial puede llegar a tu casa o trabajo a embargar. Tienes 8 días hábiles para oponer excepciones legales y detener el remate. No esperes.',
    ctaText: 'Analizar mi demanda por deuda',
    bullets: [
      'Revisa el documento que te notificaron: identifica el ROL/RIT, el tribunal, el demandante y el monto demandado. Con esos datos puedes revisar la causa en la OJV (ojv.pjud.cl).',
      'Las excepciones más comunes en juicio ejecutivo son: pago de la deuda, prescripción (si pasaron más de 5 años), nulidad del título, exceso de avalúo del embargo.',
      'Si la deuda es legítima, puedes negociar con el demandante o su abogado para llegar a un acuerdo de pago antes de la fecha de la audiencia.',
    ],
    faqs: [
      { q: '¿Me pueden embargar el sueldo?', a: 'Sí, pero solo la parte que excede cierto límite. Los sueldos inferiores a 56 UTM líquidas son inembargables. Sobre ese monto, se puede embargar hasta un 50% de lo que exceda.' },
      { q: '¿Qué bienes no me pueden embargar?', a: 'La cama y ropa de cama, la cocina, la máquina de coser, libros, herramientas de trabajo esenciales, uniformes y pensiones alimenticias. Todo lo demás es embargable.' },
    ],
    titleSEO: 'Me Demandaron por Deuda ¿Qué Hago? | Defensa contra Embargo',
    metaDescription: 'Te llegó una demanda por deuda o un mandamiento de ejecución y embargo. Plazos, cómo defenderte y qué bienes no te pueden embargar en Chile.',
    intent: 'Me notificaron una demanda por deuda y no sé qué hacer para evitar el embargo.',
    caseType: 'deuda',
    role: 'demandado',
  },
  {
    slug: '/que-hago-si-me-demandaron',
    h1: 'Me demandaron: qué hacer paso a paso',
    diagnosText: 'Lo primero es no entrar en pánico y actuar rápido. Abre la notificación, identifica el tipo de demanda (civil, laboral, ejecutiva, familia) y busca el ROL o RIT. Ese número te permite revisar todo el expediente en la Oficina Judicial Virtual (ojv.pjud.cl) con tu ClaveÚnica. El plazo para responder corre desde que te notificaron y perderlo significa que el juicio sigue sin ti.',
    ctaText: 'Analizar mi demanda ahora',
    bullets: [
      'Paso 1: Identifica el tribunal, ROL y materia en el documento que recibiste.',
      'Paso 2: Ingresa a ojv.pjud.cl con tu ClaveÚnica y busca la causa para ver el expediente completo.',
      'Paso 3: Contacta un abogado o acude a la Corporación de Asistencia Judicial (CAJ) de tu comuna si no puedes pagar uno.',
      'Paso 4: No contestes por tu cuenta sin asesoría. Un escrito mal hecho puede perjudicar tu defensa irreversiblemente.',
    ],
    faqs: [
      { q: '¿Qué pasa si no contesto una demanda?', a: 'El tribunal declara tu rebeldía, lo que significa que los hechos de la demanda se dan por ciertos y el juicio sigue sin tu participación. El resultado casi siempre es una condena en tu contra.' },
      { q: '¿Cuánto tiempo tengo para contestar una demanda?', a: 'Depende del tipo: 18 días hábiles en juicio ordinario civil, 8 días hábiles en juicio ejecutivo, 5 días hábiles antes de la audiencia en laboral y familia.' },
    ],
    titleSEO: 'Me Demandaron ¿Qué Hago? | Guía para Contestar una Demanda en Chile',
    metaDescription: 'Te notificaron una demanda en Chile. Guía paso a paso: qué hacer primero, plazos, cómo revisar tu causa en OJV y cómo conseguir abogado urgente.',
    intent: 'Me notificaron de una demanda y no sé por dónde empezar. Necesito saber qué hacer.',
    caseType: 'general',
    role: 'demandado',
  },

  // ── FAMILIA: ALIMENTOS ──
  {
    slug: '/como-demandar-por-pension-alimenticia',
    h1: 'Cómo demandar por pensión alimenticia en Chile',
    diagnosText: 'Si el padre o madre de tus hijos no aporta para su manutención, puedes presentar una demanda de alimentos ante el Juzgado de Familia. No necesitas abogado para iniciar la causa. El tribunal puede fijar alimentos provisorios desde el primer momento mientras se tramita el juicio, y si el demandado no paga, el juez puede ordenar arresto nocturno, arraigo nacional o retención de la devolución de impuestos.',
    ctaText: 'Analizar mi caso de alimentos',
    bullets: [
      'Puedes presentar la demanda tú mismo sin abogado en los Juzgados de Familia. Hay formularios simplificados disponibles en la OJV y en el mesón del tribunal.',
      'El monto de la pensión se calcula según las necesidades del hijo y la capacidad económica del alimentante. No hay un monto fijo; el tribunal evalúa caso a caso.',
      'Además de la pensión mensual, puedes pedir que el demandado pague directamente gastos de salud, educación y otros gastos extraordinarios.',
    ],
    faqs: [
      { q: '¿Cuánto debería pedir de pensión alimenticia?', a: 'El mínimo legal suele ser el 40% de un ingreso mínimo por hijo. Pero depende de los ingresos del demandado y de las necesidades acreditadas del niño. Un abogado o la CAJ pueden orientarte sobre el monto razonable en tu caso.' },
      { q: '¿Qué hago si el demandado no paga la pensión?', a: 'Puedes pedir al tribunal medidas de apremio: arresto nocturno (hasta 15 días), arraigo nacional, retención de devolución de impuestos, suspensión de licencia de conducir o embargo de bienes.' },
    ],
    titleSEO: 'Cómo Demandar por Pensión Alimenticia en Chile | Alimentos',
    metaDescription: 'El padre o madre de tus hijos no paga alimentos. Aprende cómo demandar, cuánto pedir, cómo calcular el monto y qué hacer si no te pagan la pensión.',
    intent: 'Necesito demandar por pensión de alimentos para mis hijos porque el otro progenitor no aporta.',
    caseType: 'familia',
    role: 'demandante',
  },
  {
    slug: '/me-demandaron-por-pension-alimenticia',
    h1: 'Me demandaron por pensión alimenticia: qué hacer',
    diagnosText: 'Recibiste una notificación del Juzgado de Familia con una demanda de alimentos. El tribunal ya puede haber fijado alimentos provisorios que debes empezar a pagar de inmediato. Si tus ingresos reales son menores a los que alega la demandante, debes presentar tus liquidaciones de sueldo y acreditar tus gastos. No pagar los alimentos provisorios puede llevarte a arresto nocturno.',
    ctaText: 'Analizar mi caso de alimentos',
    bullets: [
      'El pago de alimentos provisorios es obligatorio desde que te notifican. Si no pagas, el tribunal puede ordenar tu arresto nocturno (hasta 15 días), arraigo nacional o retención de la devolución de impuestos.',
      'Tus otros hijos y tu cónyuge actual también son carga familiar que se descuenta de tu capacidad económica. Debes acreditarlo con los certificados de nacimiento y cargas familiares.',
      'Puedes solicitar una rebaja del monto provisorio si acreditas que tus ingresos reales son menores a los considerados por la demandante.',
    ],
    faqs: [
      { q: '¿Me pueden meter preso por no pagar pensión de alimentos?', a: 'Sí. El arresto nocturno es la medida de apremio más común. Se cumple desde las 22:00 hasta las 06:00 horas en un recinto penitenciario, por un máximo de 15 días, renovable.' },
      { q: '¿Puedo pedir que me rebajen la pensión si perdí el trabajo?', a: 'Sí. Debes presentar una demanda de rebaja de alimentos al mismo tribunal, acreditando tu nueva situación económica con finiquito, carta de despido o certificado de cesantía.' },
    ],
    titleSEO: 'Me Demandaron por Pensión Alimenticia | Defensa en Familia',
    metaDescription: 'Te notificaron una demanda de alimentos. Conoce tus derechos, cómo pedir una rebaja, qué pasa si no pagas y cómo preparar tu defensa en el Juzgado de Familia.',
    intent: 'Me demandaron por pensión de alimentos y necesito saber cómo defenderme o pedir una rebaja.',
    caseType: 'familia',
    role: 'demandado',
  },

  // ── PENAL: ESTAFA ──
  {
    slug: '/como-demandar-por-estafa',
    h1: 'Cómo demandar por estafa en Chile',
    diagnosText: 'Si fuiste víctima de una estafa (te engañaron para que entregaras dinero o bienes), debes presentar una querella o denuncia ante el Ministerio Público, Carabineros o la PDI. La estafa es un delito penal tipificado en el artículo 468 del Código Penal. Paralelamente puedes presentar una demanda civil para recuperar tu dinero, pero el proceso penal es el que persigue al responsable con penas de cárcel.',
    ctaText: 'Analizar mi caso de estafa',
    bullets: [
      'La estafa requiere que el autor haya usado engaño (mentira, nombre falso, falsa calidad) para obtener una entrega voluntaria de dinero o bienes de tu parte.',
      'La denuncia puedes presentarla en cualquier fiscalía, cuartel de Carabineros o cuartel de la PDI. No necesitas abogado para denunciar.',
      'Guarda toda la evidencia: transferencias bancarias, conversaciones de WhatsApp, correos, comprobantes, perfiles falsos y cualquier comunicación con el estafador.',
    ],
    faqs: [
      { q: '¿Puedo recuperar mi dinero si denuncio una estafa?', a: 'El Ministerio Público investiga el delito penal, pero la devolución del dinero es materia civil. Necesitas presentar una demanda civil paralela o una acción civil dentro del proceso penal.' },
      { q: '¿Cuánto demora una investigación por estafa?', a: 'Una investigación simple puede durar 6 meses a 1 año. Si el estafador está identificado, es más rápido. Si es un perfil falso o estafador desconocido, puede tardar más.' },
    ],
    titleSEO: 'Cómo Demandar por Estafa en Chile | Querella y Denuncia Penal',
    metaDescription: 'Fuiste víctima de una estafa. Aprende cómo denunciar ante el Ministerio Público, presentar una querella y recuperar tu dinero en Chile.',
    intent: 'Me estafaron y quiero denunciar o demandar para que atrapen al responsable y recuperar mi dinero.',
    caseType: 'penal',
    role: 'demandante',
  },

  // ── GENERAL: ME NOTIFICARON ──
  {
    slug: '/me-llego-una-notificacion-de-demanda',
    h1: 'Me llegó una notificación de demanda: qué hacer',
    diagnosText: 'Un receptor judicial, Carabineros o una carta certificada te entregó un sobre con una demanda en tu contra. No lo botes, no lo ignores. Ábrelo ahora mismo y busca: (1) qué tribunal aparece, (2) cuál es el ROL o RIT, (3) cuál es el plazo para responder. Cada día cuenta. Si no actúas, el juicio avanza sin ti y el resultado te será desfavorable.',
    ctaText: 'Revisar mi notificación ahora',
    bullets: [
      'Busca el número de ROL o RIT en el documento. Es el identificador de tu causa. Con ese número puedes seguir el caso en ojv.pjud.cl.',
      'Identifica el plazo para contestar: varía entre 5 y 18 días hábiles dependiendo del tipo de juicio y del tribunal.',
      'No escribas tú mismo la contestación si no eres abogado. Un error puede significar que pierdas el juicio definitivamente.',
    ],
    faqs: [
      { q: '¿Cómo sé si la notificación es real o es falsa?', a: 'Ingresa a ojv.pjud.cl con tu RUT y ClaveÚnica. Busca causas en que aparezcas como demandado. Si la causa existe, es real. Si no aparece, podría ser falsa o aún no estar ingresada.' },
      { q: '¿Qué pasa si no estaba en casa y le notificaron a otra persona?', a: 'La notificación al adulto que se encuentra en el domicilio es válida en muchos casos. No puedes alegar que no te enteraste si alguien de tu casa recibió la notificación.' },
    ],
    titleSEO: 'Me Llegó una Notificación de Demanda | Guía de Primeros Pasos',
    metaDescription: 'Recibiste una notificación judicial. Guía urgente: cómo identificar el tribunal, ver tu causa en la OJV, plazos y qué hacer para no perder el juicio.',
    intent: 'Me entregaron una notificación de demanda y necesito entender qué dice y qué debo hacer.',
    caseType: 'general',
    role: 'demandado',
  },

  // ── GENERAL: REVISAR CAUSA ──
  {
    slug: '/como-saber-si-tengo-una-demanda',
    h1: 'Cómo saber si tengo una demanda en mi contra',
    diagnosText: 'Puedes revisar si tienes causas judiciales ingresando a la Oficina Judicial Virtual (ojv.pjud.cl) con tu RUT y ClaveÚnica. Ahí aparecen todas las causas civiles, laborales, de familia y de cobranza donde figuras como demandado. También puedes consultar en el sitio del Poder Judicial (pjud.cl) en "Consulta de Causas". Si no tienes ClaveÚnica, puedes obtenerla en www.claveunica.gob.cl.',
    ctaText: 'Revisar si tengo causas',
    bullets: [
      'La OJV muestra causas civiles, laborales y de familia. Las causas penales (fiscalía) se consultan en www.fiscaliadechile.cl.',
      'Si no tienes ClaveÚnica, puedes consultar presencialmente en el mesón del tribunal con tu cédula de identidad.',
      'No todas las demandas aparecen inmediatamente. Si te notificaron hace menos de 48 horas, puede que la causa aún no esté disponible en línea.',
    ],
    faqs: [
      { q: '¿Puedo tener una demanda sin que me hayan notificado?', a: 'Sí. Si no te encontraron en tu domicilio, el tribunal puede ordenar notificación por avisos en el diario o por el estado diario, y el juicio avanza igual.' },
      { q: '¿Revisar la OJV deja algún registro?', a: 'No. La consulta de causas en la OJV es privada y no queda registro visible para la otra parte de que revisaste el expediente.' },
    ],
    titleSEO: 'Cómo Saber si Tengo una Demanda en Chile | Revisa tus Causas',
    metaDescription: 'Aprende cómo revisar si tienes demandas o causas judiciales en Chile usando la OJV, ClaveÚnica y el sitio del Poder Judicial. Paso a paso.',
    intent: 'Quiero revisar si tengo causas judiciales o demandas en mi contra en Chile.',
    caseType: 'general',
    role: 'consulta',
  },

  // ── GENERAL: PLAZOS ──
  {
    slug: '/plazo-para-responder-una-demanda',
    h1: 'Plazo para responder una demanda en Chile',
    diagnosText: 'El plazo para contestar una demanda en Chile depende del tipo de procedimiento. En juicio ordinario civil, tienes 18 días hábiles si la notificación fue en la misma comuna del tribunal, o 18 días más tabla de emplazamiento si fue en otra comuna. En juicio ejecutivo (cobranza), tienes 8 días hábiles. En laboral, debes contestar al menos 5 días hábiles antes de la audiencia preparatoria.',
    ctaText: 'Calcular mi plazo ahora',
    bullets: [
      'Juicio Ordinario Civil: 18 días hábiles (CPC Art. 258).',
      'Juicio Ejecutivo (cobranza): 8 días hábiles (CPC Art. 462).',
      'Laboral: 5 días hábiles antes de la audiencia preparatoria (CT Art. 453).',
      'Familia: 5 días hábiles antes de la audiencia preparatoria (Ley 19.968 Art. 58).',
      'Policía Local: 5 días hábiles desde la notificación (Ley 18.287 Art. 32).',
    ],
    faqs: [
      { q: '¿Los días hábiles incluyen los sábados?', a: 'En el CPC (civil), los sábados son hábiles. En materia laboral y de familia, los sábados son inhábiles. Siempre se excluyen domingos y feriados.' },
      { q: '¿Desde cuándo empieza a correr el plazo?', a: 'Desde el día siguiente a la notificación. Si te notificaron un día viernes, el plazo empieza el sábado (en CPC) o el lunes (en laboral).' },
    ],
    titleSEO: 'Plazo para Responder una Demanda en Chile | Días Hábiles',
    metaDescription: 'Conoce los plazos exactos para contestar demandas en Chile: civil, ejecutiva, laboral, familia. Calcula tu fecha límite ahora y evita la rebeldía.',
    intent: 'Necesito saber cuánto tiempo tengo para contestar la demanda que recibí.',
    caseType: 'general',
    role: 'consulta',
  },

  // ── URGENTE: NECESITO ABOGADO ──
  {
    slug: '/necesito-abogado-urgente',
    h1: 'Necesito un abogado urgente en Chile',
    diagnosText: 'Si te notificaron una demanda, tienes una audiencia próxima o te llegó una orden de embargo, necesitas abogado ahora. No todos los casos requieren abogado particular: si no puedes pagar uno, la Corporación de Asistencia Judicial (CAJ) de tu comuna ofrece abogados gratuitos. También puedes consultar en las clínicas jurídicas de universidades o en la Defensoría Penal Pública si el caso es penal.',
    ctaText: 'Analizar mi caso urgente',
    bullets: [
      'Corporación de Asistencia Judicial (CAJ): abogados gratuitos en todas las comunas. Requisito: acreditar bajos ingresos. Busca la CAJ de tu comuna en Google.',
      'Clínicas jurídicas universitarias: la U. de Chile, Católica, Diego Portales, etc., atienden gratis con supervisión de profesores.',
      'Defensoría Penal Pública: si te imputan un delito y no tienes abogado, el Estado te asigna un defensor penal gratuito.',
    ],
    faqs: [
      { q: '¿Cuánto cobra un abogado por una demanda?', a: 'Varía mucho. Una consulta inicial puede costar $30.000-$80.000. Un juicio completo, entre $500.000 y varios millones dependiendo de la complejidad y la etapa.' },
      { q: '¿Puedo defenderme solo sin abogado?', a: 'En algunos procedimientos sí (Policía Local, causas de bajo monto), pero es muy desaconsejable. Un error procesal puede hacerte perder el juicio definitivamente.' },
    ],
    titleSEO: 'Necesito un Abogado Urgente en Chile | Ayuda Legal Inmediata',
    metaDescription: 'Necesitas abogado urgente. Opciones gratuitas (CAJ, clínicas, Defensoría) y orientación inmediata para tu caso legal en Chile.',
    intent: 'Necesito encontrar un abogado urgentemente para mi caso legal.',
    caseType: 'general',
    role: 'consulta',
  },

  // ── URGENTE: ORIENTACIÓN ──
  {
    slug: '/necesito-orientacion-legal',
    h1: 'Necesito orientación legal urgente',
    diagnosText: 'Tienes un problema legal y no sabes por dónde empezar. No estás solo. Sube tu documento, resolución del tribunal o simplemente escribe tu situación y en 2 minutos recibirás un diagnóstico legal claro: qué leyes aplican, qué plazos tienes, qué riesgos corres y qué pasos debes seguir hoy mismo. No necesitas saber de leyes, solo necesitas actuar.',
    ctaText: 'Analizar mi caso ahora',
    bullets: [
      'Recibirás un análisis en español simple, sin jerga legal, explicado para una persona sin estudios de derecho.',
      'Identificarás los plazos exactos que tienes para actuar y las consecuencias si no lo haces a tiempo.',
      'Sabrás qué documentos necesitas reunir, a qué tribunal debes acudir y qué opciones gratuitas tienes si no puedes pagar un abogado.',
    ],
    faqs: [
      { q: '¿Esto reemplaza a un abogado?', a: 'No. Es una orientación legal inicial para que sepas qué hacer y no pierdas tiempo. Para presentar escritos en tribunales, necesitas patrocinio de abogado habilitado.' },
      { q: '¿Es gratis?', a: 'La orientación inicial y la vista previa del diagnóstico son gratis. El informe completo tiene un costo único de $9.990 CLP.' },
    ],
    titleSEO: 'Orientación Legal Urgente en Chile | Diagnóstico con IA',
    metaDescription: 'Necesitas orientación legal urgente. Sube tu documento o escribe tu caso y recibe un diagnóstico legal claro con plazos, riesgos y pasos a seguir hoy.',
    intent: 'Tengo un problema legal y necesito que alguien me oriente sobre qué hacer.',
    caseType: 'general',
    role: 'consulta',
  },
];
