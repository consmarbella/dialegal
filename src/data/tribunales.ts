export interface JuzgadoPL {
  nombre: string;
  canalIngreso: 'ONLINE' | 'PRESENCIAL' | 'HÍBRIDO';
  detalleCanal: string;
  correo: string;
  fuente: string;
  certeza: 'Alto' | 'Medio' | 'Bajo';
}

export interface ComunaJPL {
  slug: string;
  comuna: string;
  region: string;
  juzgados: JuzgadoPL[];
}

export const COMUNAS_RM: ComunaJPL[] = [
  {
    slug: "lo-barnechea",
    comuna: "Lo Barnechea",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "ONLINE",
        detalleCanal: "Mediante la plataforma de Clave Única. Debe crear un certificado digital con Clave Única.",
        correo: "https://www.claveunica.gob.cl/",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "ONLINE",
        detalleCanal: "Mediante la plataforma de Clave Única. Debe crear un certificado digital con Clave Única.",
        correo: "https://www.claveunica.gob.cl/",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "santiago",
    comuna: "Santiago",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "3° Juzgado de Policía Local",
        canalIngreso: "ONLINE",
        detalleCanal: "Mediante plataforma de correo electrónico. Debe enviar escrito firmado digitalmente.",
        correo: "3jpl@santiago.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "4° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "5° Juzgado de Policía Local",
        canalIngreso: "ONLINE",
        detalleCanal: "Mediante plataforma de correo electrónico. Debe enviar escrito firmado digitalmente.",
        correo: "5jpl@santiago.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "independencia",
    comuna: "Independencia",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "ONLINE",
        detalleCanal: "Mediante plataforma de correo electrónico. Requiere firma electrónica avanzada.",
        correo: "1jpl@munindependencia.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "ONLINE",
        detalleCanal: "Mediante plataforma de correo electrónico. Requiere firma electrónica avanzada.",
        correo: "2jpl@munindependencia.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "la-reina",
    comuna: "La Reina",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "HÍBRIDO",
        detalleCanal: "Acepta notificaciones por correo electrónico, pero los escritos de prescripción deben ser presentados presencialmente en el buzón de partes.",
        correo: "1jpl@munilareina.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Medio"
      }
    ]
  },
  {
    slug: "renca",
    comuna: "Renca",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "HÍBRIDO",
        detalleCanal: "Acepta notificaciones por correo electrónico, pero los escritos de prescripción deben ser presentados presencialmente en el buzón de partes.",
        correo: "1jpl@munirenca.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Medio"
      }
    ]
  },
  {
    slug: "lo-espejo",
    comuna: "Lo Espejo",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "HÍBRIDO",
        detalleCanal: "Acepta notificaciones por correo electrónico, pero los escritos de prescripción deben ser presentados presencialmente en el buzón de partes.",
        correo: "1jpl@muniloespejo.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Medio"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "HÍBRIDO",
        detalleCanal: "Acepta notificaciones por correo electrónico, pero los escritos de prescripción deben ser presentados presencialmente en el buzón de partes.",
        correo: "2jpl@muniloespejo.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Medio"
      }
    ]
  },
  {
    slug: "cerro-navia",
    comuna: "Cerro Navia",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "HÍBRIDO",
        detalleCanal: "Acepta notificaciones por correo electrónico, pero los escritos de prescripción deben ser presentados presencialmente en el buzón de partes.",
        correo: "1jpl@municerro-navia.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Medio"
      }
    ]
  },
  {
    slug: "conchali",
    comuna: "Conchalí",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "huechuraba",
    comuna: "Huechuraba",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "recoleta",
    comuna: "Recoleta",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "quilicura",
    comuna: "Quilicura",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "pudahuel",
    comuna: "Pudahuel",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "el-bosque",
    comuna: "El Bosque",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "macul",
    comuna: "Macul",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "estacion-central",
    comuna: "Estación Central",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "cerrillos",
    comuna: "Cerrillos",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "la-florida",
    comuna: "La Florida",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "3° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "las-condes",
    comuna: "Las Condes",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "3° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "vitacura",
    comuna: "Vitacura",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "puente-alto",
    comuna: "Puente Alto",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "penalolen",
    comuna: "Peñalolén",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "nunoa",
    comuna: "Ñuñoa",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "maipu",
    comuna: "Maipú",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "3° Juzgado de Policía Local",
        canalIngreso: "PRESENCIAL",
        detalleCanal: "Mediante buzón físico de partes. No acepta escritos por correo electrónico.",
        correo: "No acepta correo electrónico",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  },
  {
    slug: "vina-del-mar",
    comuna: "Viña del Mar",
    region: "Metropolitana",
    juzgados: [
      {
        nombre: "1° Juzgado de Policía Local",
        canalIngreso: "ONLINE",
        detalleCanal: "Mediante plataforma de correo electrónico. Requiere firma electrónica avanzada.",
        correo: "1jpl@municipalidadvina.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "2° Juzgado de Policía Local",
        canalIngreso: "ONLINE",
        detalleCanal: "Mediante plataforma de correo electrónico. Requiere firma electrónica avanzada.",
        correo: "2jpl@municipalidadvina.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      },
      {
        nombre: "3° Juzgado de Policía Local",
        canalIngreso: "ONLINE",
        detalleCanal: "Mediante plataforma de correo electrónico. Requiere firma electrónica avanzada.",
        correo: "3jpl@municipalidadvina.cl",
        fuente: "https://www.bcn.cl/leychile/navegar?idNorma=1170498",
        certeza: "Alto"
      }
    ]
  }
];
