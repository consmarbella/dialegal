import { CaseSample, GlossaryTerm, ProceduralPreset } from '../types';

export const CASE_SAMPLES: CaseSample[] = [
  {
    id: 'cobranza-ejecutiva',
    title: 'Cobranza Ejecutiva de Pagaré (Notificación de Embargo)',
    area: 'civil',
    badge: 'Cobranza Judicial / Civil',
    description: 'Notificación personal de demanda ejecutiva por pagaré vencido con orden de mandamiento de ejecución y embargo.',
    userStory: 'Hoy en la mañana vino un receptor judicial a mi domicilio y me entregó unos papeles de una demanda del Banco X. Me dicen que estoy demandado por un pagaré de $3.800.000 que dejé de pagar hace 10 meses. El papel dice "despáchese mandamiento de ejecución y embargo" y que tengo 8 días para algo. Tengo mucho miedo de que me quiten mis cosas de la casa o me quiten el auto.',
    documentText: `TRIBUNAL: 14° Juzgado Civil de Santiago
ROL: C-12458-2025
CARATULADO: BANCO X / GONZALEZ
MATERIA: Juicio Ejecutivo - Cobro de Pagaré

SANTIAGO, 12 de Julio de 2025.
Por presentada demanda ejecutiva en lo principal, téngase por opuesta en el otrosí.
Despáchese mandamiento de ejecución y embargo en contra del demandado don JUAN GONZALEZ por la suma de $3.800.000.- más intereses y costas.
Requiérase de pago al ejecutado. De no pagar en el acto del requerimiento, trábese embargo sobre bienes suficientes de su propiedad.
Cítese a las partes a responder dentro del plazo de 8 días hábiles.`,
    notificationDate: new Date().toISOString().split('T')[0]
  },
  {
    id: 'despido-injustificado',
    title: 'Despido Injustificado por Necesidades de la Empresa',
    area: 'laboral',
    badge: 'Laboral / Código del Trabajo',
    description: 'Carta de despido alegando necesidades de la empresa sin fundamentación clara y no pago de años de servicio.',
    userStory: 'Trabajé durante 4 años y 8 meses como ejecutivo de ventas en una empresa. Ayer me entregaron una carta de despido indicando "necesidades de la empresa" (Art. 161 inc. 1° del Código del Trabajo). Sin embargo, sé que la empresa contrató a dos personas nuevas en mi mismo cargo la semana pasada. Además, en el finiquito no me están reconociendo las horas extraordinarias pendientes ni la indemnización completa por años de servicio. Quiero demandar por despido injustificado y tutela por vulneración de derechos.',
    documentText: `CARTA DE DESPIDO Y COMUNICACIÓN DE TÉRMINO DE CONTRATO
De: Empresa Servicios e Inversiones SpA
Para: Juan Pérez Soto
RUT: 16.789.012-K

Por medio de la presente, comunicamos a usted que con esta fecha se pone término a su contrato de trabajo invocando la causal del artículo 161 inciso 1° del Código del Trabajo, esto es, Necesidades de la Empresa.
Se pone a su disposición en la notaría el finiquito correspondiente. Se le otorga un plazo de reserva de derechos.`,
    notificationDate: new Date().toISOString().split('T')[0]
  },
  {
    id: 'demanda-alimentos',
    title: 'Demanda de Alimentos y Alimentos Provisorios',
    area: 'familia',
    badge: 'Familia / Ley 19.968',
    description: 'Notificación de demanda de pensión alimenticia en Juzgado de Familia con fijación de alimentos provisorios.',
    userStory: 'Fui notificado de una demanda de alimentos presentada por mi expareja en el Juzgado de Familia de San Bernardo. La resolución fijó unos "alimentos provisorios" de $350.000 mensuales que debo pagar a contar de este mes, pero mis ingresos actuales cayeron a $600.000 y tengo que pagar arriendo. Me citaron a una "audiencia preparatoria" para el próximo mes. ¿Qué pasa si no pago esa cantidad provisoria y cómo puedo pedir que la bajen?',
    documentText: `JUZGADO DE FAMILIA DE SAN BERNARDO
RIT: C-4589-2025
CARATULADO: SILVA / MENDOZA
MATERIA: Alimentos Mayores y Menores

SAN BERNARDO, 25 de Junio de 2025.
A lo principal: Por interpuesta demanda de alimentos. Acompaña documentos.
Al primer otrosí: Se fijan alimentos provisorios a favor de los menores en la suma equivalente al 50% de un ingreso mínimo mensual ($350.000.-), los que deberán depositarse en la cuenta de ahorro a la vista del BancoEstado dentro de los primeros 5 días de cada mes.
Al segundo otrosí: Se cita a las partes a Audiencia Preparatoria para el día 18 de Agosto de 2025 a las 09:30 horas.
Notifíquese al demandado bajo apercibimiento legal de decretar medidas de apremio (arresto nocturno o arraigo nacional) en caso de incumplimiento.`,
    notificationDate: new Date().toISOString().split('T')[0]
  },
  {
    id: 'causa-penal-fiscalia',
    title: 'Citación a Fiscalía / Querella Penal',
    area: 'penal',
    badge: 'Penal / C.P.P.',
    description: 'Citación a prestar declaración ante el Ministerio Público o Juzgado de Garantía por investigación penal.',
    userStory: 'Recibí una notificación de Carabineros con un papel de la Fiscalía Local de Las Condes para presentarme a declarar como imputado por una denuncia de supuestas amenazas de las que me acusa un exfundador de mi PYME. El papel dice RUC y que debo ir acompañado de un defensor. No entiendo si ya estoy condenado o si puedo ir solo a explicar la verdad.',
    documentText: `MINISTERIO PÚBLICO - FISCALÍA LOCAL DE LAS CONDES
RUC: 2500123456-7
CARATULADO: INVESTIGACIÓN MP / ROJAS
CITACIÓN A DECLARACIÓN DE IMPUTADO

SANTIAGO, 01 de Julio de 2025.
Se cita a don PEDRO ROJAS VARELA para que comparezca a la Fiscalía Local ubicada en Av. Vitacura 2900, el día 20 de Agosto de 2025 a las 10:00 horas, a fin de prestar declaración en calidad de IMPUTADO.
Se le recuerda su derecho constitucional a guardar silencio y a comparecer asistido por un Abogado Defensor de su confianza o, en su defecto, un Defensor Penal Público.`,
    notificationDate: new Date().toISOString().split('T')[0]
  }
];

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'traslado',
    term: 'Traslado',
    area: 'Procesal General / Civil',
    definition: 'Orden del juez que le entrega una copia de la solicitud presentada por una parte a la contraparte, otorgándole un plazo legal para responder.',
    practicalImpact: 'Significa que tienes un tiempo contado (normalmente 3, 5 u 8 días) para defenderte o dar tu versión formal por escrito.',
    codeReference: 'Art. 31 del Código de Procedimiento Civil (CPC)',
    exampleInPjud: '"De la solicitud de la demandante, traslado por 3 días."'
  },
  {
    id: 'mandamiento-embargo',
    term: 'Mandamiento de Ejecución y Embargo',
    area: 'Civil / Cobranzas',
    definition: 'Orden judicial ejecutiva dictada en un juicio de cobro de deudas (pagaré, cheque, factura) que faculta al receptor judicial para requerir de pago al deudor y, si no paga en el acto, embargar sus bienes.',
    practicalImpact: '¡Riesgo urgente! El receptor judicial puede acudir a tu domicilio a listar bienes. Tienes solo 8 días hábiles para oponer defensas legales (excepciones).',
    codeReference: 'Art. 441 y 443 del CPC',
    exampleInPjud: '"Despáchese mandamiento de ejecución y embargo en contra del ejecutado por $5.000.000."'
  },
  {
    id: 'autos-para-fallo',
    term: 'Autos para Fallo / Concluidos para Fallo',
    area: 'Procesal General',
    definition: 'Estado procesal en el que ha finalizado toda la etapa de discusión y presentación de pruebas, quedando el expediente cerrado y listo para que el juez dicte la sentencia definitiva.',
    practicalImpact: 'Ya no se pueden presentar más escritos ni pruebas. Solo queda esperar que el juez publique la sentencia.',
    codeReference: 'Art. 432 del CPC',
    exampleInPjud: '"Citadas las partes para oír sentencia" o "Citadas a oír fallo."'
  },
  {
    id: 'rebeldia',
    term: 'Rebeldía',
    area: 'Procesal General',
    definition: 'Declaración judicial que sanciona la inactividad de una de las partes por no realizar un trámite o no contestar dentro del plazo fatal fijado por la ley.',
    practicalImpact: 'Pierdes definitivamente la oportunidad de defenderte en esa etapa y el juicio continúa sin tu intervención.',
    codeReference: 'Art. 64 y 78 del CPC',
    exampleInPjud: '"Se declara la rebeldía del demandado por no contestar la demanda en tiempo forma."'
  },
  {
    id: 'alimentos-provisorios',
    term: 'Alimentos Provisorios',
    area: 'Familia',
    definition: 'Monto fijado provisoriamente por el tribunal de familia al inicio de la causa para cubrir las necesidades urgentes de los hijos mientras se tramita el juicio definitivo.',
    practicalImpact: 'Es de cobro obligatorio e inmediato desde que te notifican. Si no pagas, el juez puede ordenar arresto nocturno o retención de devolución de impuestos.',
    codeReference: 'Art. 54 de la Ley 19.968',
    exampleInPjud: '"Se fijan alimentos provisorios en la suma de $250.000 mensuales."'
  },
  {
    id: 'reserva-de-derechos',
    term: 'Reserva de Derechos (Finiquito Laboral)',
    area: 'Laboral',
    definition: 'Declaración escrita de puño y letra que el trabajador estampa en el finiquito antes de firmarlo, indicando que se reserva el derecho a demandar materias específicas (ej: despido injustificado, horas extras, años de servicio).',
    practicalImpact: 'Es clave: si no haces la reserva de derechos al firmar el finiquito, pierdes la posibilidad de demandar después ante los Tribunales del Trabajo.',
    codeReference: 'Art. 177 del Código del Trabajo',
    exampleInPjud: '"Me reservo el derecho a demandar por despido injustificado y diferencias en indemnización."'
  },
  {
    id: 'notificacion-estado-diario',
    term: 'Notificación por el Estado Diario',
    area: 'Procesal General',
    definition: 'Ficción legal en que las resoluciones judiciales se entienden notificadas por el solo hecho de incluirse en un listado digital diario publicado a las 08:00 AM en el sitio web del PJUD.',
    practicalImpact: 'No van a ir a buscarte a tu casa. Los plazos para apelar o hacer trámites diarios corren automáticamente desde esa publicación.',
    codeReference: 'Art. 50 del CPC',
    exampleInPjud: '"Notifíquese por el Estado Diario."'
  },
  {
    id: 'patrocinio-y-poder',
    term: 'Patrocinio y Poder',
    area: 'Procesal General',
    definition: 'Acto jurídico formal mediante el cual una persona designa a un abogado habilitado para dirigir su causa y le otorga mandato judicial para representarlo.',
    practicalImpact: 'Sin patrocinio de abogado habilitado, los escritos que presentes en la OJV serán tenidos por no presentados.',
    codeReference: 'Ley 18.120 sobre comparecencia en juicio',
    exampleInPjud: '"Téngase presente el patrocinio y poder otorgado al abogado don..."'
  },
  {
    id: 'apercibimiento',
    term: 'Apercibimiento',
    area: 'Procesal / Penal / Familia',
    definition: 'Advertencia o conminación legal sobre la sanción o perjuicio directo que sufrirá una persona si no cumple una orden impartida por el tribunal.',
    practicalImpact: 'Indica la consecuencia grave e inminente de no cumplir (ej: arresto, multa, desalojo con auxilio de la fuerza pública).',
    codeReference: 'Art. 238 del CPC / Ley 14.908 de Alimentos',
    exampleInPjud: '"Bajo apercibimiento del artículo 238 del Código de Procedimiento Civil."'
  }
];

export const PROCEDURAL_PRESETS: ProceduralPreset[] = [
  {
    id: 'civil-contestacion-ordinario',
    name: 'Civil - Contestación Demanda Ordinaria (18 días hábiles)',
    area: 'civil',
    days: 18,
    type: 'habiles_cpc',
    article: 'Art. 258 del CPC',
    code: 'Código de Procedimiento Civil',
    description: 'Plazo fatal para contestar una demanda civil ordinaria cuando fue notificado en la comuna asiento del tribunal.',
    consequenceIfMissed: 'Se declara la rebeldía del demandado y se tienen por negados fictamente los hechos, perdiendo la oportunidad de presentar sus excepciones y defensas.'
  },
  {
    id: 'civil-ejecutivo-excepciones',
    name: 'Civil Ejecutivo - Oposición de Excepciones (8 días hábiles)',
    area: 'civil',
    days: 8,
    type: 'habiles_cpc',
    article: 'Art. 462 del CPC',
    code: 'Código de Procedimiento Civil',
    description: 'Plazo fatal e improrrogable para oponer excepciones legales (prescripción, pago, falsedad del título) tras la notificación de la demanda ejecutiva.',
    consequenceIfMissed: 'El mandamiento de ejecución hace las veces de sentencia definitiva y el receptor judicial procederá al embargo y remate directo de tus bienes.'
  },
  {
    id: 'civil-apelacion-sentencia',
    name: 'Civil - Recurso de Apelación Sentencia Definitiva (10 días hábiles)',
    area: 'civil',
    days: 10,
    type: 'habiles_cpc',
    article: 'Art. 189 del CPC',
    code: 'Código de Procedimiento Civil',
    description: 'Plazo para interponer recurso de apelación ante la Corte de Apelaciones respectiva en contra de una sentencia definitiva.',
    consequenceIfMissed: 'La sentencia queda firme y ejecutoriada, no pudiendo ser modificada por ningún tribunal superior.'
  },
  {
    id: 'laboral-reclamacion-despido',
    name: 'Laboral - Demanda por Despido Injustificado (60 días hábiles)',
    area: 'laboral',
    days: 60,
    type: 'habiles_laboral',
    article: 'Art. 168 y 486 del Código del Trabajo',
    daysTypeLabel: 'Días hábiles (Lunes a Viernes)',
    code: 'Código del Trabajo',
    description: 'Plazo de caducidad de la acción para presentar demanda de despido injustificado o tutela laboral en los Juzgados del Trabajo.',
    consequenceIfMissed: 'Caduca definitivamente el derecho a demandar ante los tribunales del trabajo. El plazo se suspende si interpusiste reclamo en la Inspección del Trabajo (máx 90 días).'
  },
  {
    id: 'laboral-contestacion-demanda',
    name: 'Laboral - Contestación de Demanda (5 días hábiles antes de Audiencia)',
    area: 'laboral',
    days: 5,
    type: 'habiles_laboral',
    article: 'Art. 453 N° 1 del Código del Trabajo',
    code: 'Código del Trabajo',
    description: 'Debe contestarse por escrito con a lo menos 5 días hábiles de anticipación a la fecha fijada para la audiencia preparatoria.',
    consequenceIfMissed: 'Se tiene por no contestada la demanda y el juez presumirá verdaderos los hechos alegados por el trabajador.'
  },
  {
    id: 'familia-contestacion',
    name: 'Familia - Contestación y Reconvención (5 días hábiles antes de Audiencia)',
    area: 'familia',
    days: 5,
    type: 'habiles_laboral',
    article: 'Art. 58 de la Ley 19.968',
    code: 'Ley 19.968 de Tribunales de Familia',
    description: 'Plazo para contestar la demanda de alimentos, relación directa y regular o cuidado personal por escrito antes de la audiencia preparatoria.',
    consequenceIfMissed: 'El tribunal podrá realizar la audiencia preparatoria en tu rebeldía y resolver con los antecedentes aportados por la parte demandante.'
  },
  {
    id: 'policia-local-descargos',
    name: 'Policía Local - Descargos o Apelación (5 días hábiles)',
    area: 'policia_local',
    days: 5,
    type: 'habiles_cpc',
    article: 'Art. 32 de la Ley 18.287',
    code: 'Ley 18.287 sobre procedimiento en Juzgados de Policía Local',
    description: 'Plazo para interponer recurso de apelación contra sentencias dictadas por los Juzgados de Policía Local.',
    consequenceIfMissed: 'La multa o resolución dictada por el Juez de Policía Local queda ejecutoriada, aplicándose órdenes de arresto o suspensión de licencia.'
  }
];

// Official Chilean Holidays list helper (for accurate date calculations)
export const CHILEAN_HOLIDAYS_2025_2026 = [
  '2025-01-01', '2025-04-18', '2025-04-19', '2025-05-01', '2025-05-21',
  '2025-06-20', '2025-06-29', '2025-07-16', '2025-08-15', '2025-09-18',
  '2025-09-19', '2025-10-12', '2025-10-31', '2025-11-01', '2025-12-08', '2025-12-25',
  '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21',
  '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18', '2026-09-19',
  '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25'
];
