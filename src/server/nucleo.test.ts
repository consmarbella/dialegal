import { describe, it, expect } from "vitest";
import { ritEsExigible } from "./caso.schema.js";
import { decidirVia, materiaTieneCatalogo } from "./viasProcesales.js";
import type { Caso } from "./caso.schema.js";
import { verificarContraTexto, rutValidoMod11 } from "./extraerCaso.js";

function casoBase(overrides: Partial<Caso> = {}): Caso {
  return {
    materia: "civil",
    tipoEscrito: "demanda",
    postura: "demandante",
    partes: [],
    documentos: [],
    hechos: [],
    pretensiones: [],
    estadoProcesal: { causaIniciada: "no", rit: null, tribunal: null, fechaNotificacion: null },
    faltantes: [],
    ...overrides,
  };
}

describe("ritEsExigible", () => {
  it("demanda: RIT no exigible", () => {
    expect(ritEsExigible("demanda")).toBe(false);
  });
  it("contestacion/otrosi/minuta: RIT exigible", () => {
    expect(ritEsExigible("contestacion")).toBe(true);
    expect(ritEsExigible("otrosi")).toBe(true);
    expect(ritEsExigible("minuta")).toBe(true);
  });
  it("null: no exigible", () => {
    expect(ritEsExigible(null)).toBe(false);
  });
});

describe("rutValidoMod11", () => {
  it("RUT válido con puntos y guion", () => {
    expect(rutValidoMod11("11.111.111-1")).toBe(true);
    expect(rutValidoMod11("76.086.428-5")).toBe(true);
  });
  it("RUT inválido", () => {
    expect(rutValidoMod11("11.111.111-2")).toBe(false);
    expect(rutValidoMod11("abc")).toBe(false);
  });
});

describe("decidirVia", () => {
  it("factura con recibo, sin reclamo, no prescrita -> ejecutivo_factura", () => {
    const caso = casoBase({
      documentos: [{
        tipo: "factura",
        numero: "123",
        fechaEmision: "2026-01-01",
        fechaVencimiento: "2026-03-01",
        montoClp: 15500000,
        reciboConformidad: "si",
        reclamada: "no",
        citaTextual: "factura 123 por $15.500.000",
      }],
    });
    const d = decidirVia(caso, new Date("2026-06-01"));
    expect(d.estado).toBe("decidida");
    if (d.estado === "decidida") expect(d.via).toBe("ejecutivo_factura");
  });

  it("factura sin saber reclamo -> requiere_datos con alternativa ordinario", () => {
    const caso = casoBase({
      documentos: [{
        tipo: "factura",
        numero: "123",
        fechaEmision: "2026-01-01",
        fechaVencimiento: "2026-03-01",
        montoClp: 15500000,
        reciboConformidad: "si",
        reclamada: "desconocido",
        citaTextual: "factura 123",
      }],
    });
    const d = decidirVia(caso, new Date("2026-06-01"));
    expect(d.estado).toBe("requiere_datos");
    if (d.estado === "requiere_datos") {
      expect(d.via).toBe("ejecutivo_factura");
      expect(d.alternativa).toBe("ordinario_civil_cumplimiento");
      expect(d.preguntas.some((p) => /reclam/i.test(p))).toBe(true);
    }
  });

  it("factura vencida hace más de 1 año -> ordinario_civil_cumplimiento", () => {
    const caso = casoBase({
      documentos: [{
        tipo: "factura",
        numero: "123",
        fechaEmision: "2024-01-01",
        fechaVencimiento: "2024-03-01",
        montoClp: 15500000,
        reciboConformidad: "si",
        reclamada: "no",
        citaTextual: "factura 123",
      }],
    });
    const d = decidirVia(caso, new Date("2026-06-01"));
    expect(d.estado).toBe("decidida");
    if (d.estado === "decidida") expect(d.via).toBe("ordinario_civil_cumplimiento");
  });
});

describe("verificarContraTexto", () => {
  it("elimina monto inventado y deja advertencia", () => {
    const caso = casoBase({
      pretensiones: [{ tipo: "pago_de_suma", montoClp: 9999999, descripcion: "pago" }],
    });
    const texto = "El cliente debe pagar la factura por servicios informáticos.";
    const adv = verificarContraTexto(caso, texto);
    expect(caso.pretensiones[0].montoClp).toBeNull();
    expect(adv.length).toBeGreaterThan(0);
  });

describe("materiaTieneCatalogo", () => {
  it("laboral: false", () => {
    expect(materiaTieneCatalogo("laboral")).toBe(false);
  });
  it("civil: true", () => {
    expect(materiaTieneCatalogo("civil")).toBe(true);
  });
  it("transito: false", () => {
    expect(materiaTieneCatalogo("transito")).toBe(false);
  });
});

  it("conserva monto que aparece en el texto", () => {
    const caso = casoBase({
      documentos: [{
        tipo: "factura", numero: "1", fechaEmision: null, fechaVencimiento: null,
        montoClp: 15500000, reciboConformidad: "desconocido", reclamada: "desconocido",
        citaTextual: "factura por 15500000 pesos",
      }],
    });
    const texto = "Se emitió factura por 15.500.000 pesos correspondiente a servicios.";
    const adv = verificarContraTexto(caso, texto);
    expect(caso.documentos[0].montoClp).toBe(15500000);
    // citaTextual "factura por 15500000 pesos" no es subcadena exacta normalizada de ese texto -> puede eliminarse; monto se conserva
    expect(adv.filter(a => a.includes("monto de documento")).length).toBe(0);
  });
});
