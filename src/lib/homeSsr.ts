import { SEO_PAGES } from "../data/seoPages.js";
import { SEO_PAGES_EXTRA } from "../data/seoPagesExtra.js";
import { SEO_PAGES_BATCH2 } from "../data/seoPagesBatch2.js";

export const ALL_SEO_PAGES = [...SEO_PAGES, ...SEO_PAGES_EXTRA, ...SEO_PAGES_BATCH2];

export const CASE_TYPE_LABELS: Record<string, string> = {
  arriendo: "Arriendo y desalojo",
  laboral: "Laboral y despidos",
  deuda: "Deudas, cobranza y embargos",
  familia: "Familia, alimentos y divorcio",
  civil: "Civil, contratos y herencias",
  penal: "Penal, denuncias y detención",
  general: "General y abogados",
};

export function groupByCaseType() {
  const groups: Record<string, typeof ALL_SEO_PAGES> = {};
  for (const p of ALL_SEO_PAGES) {
    (groups[p.caseType] ||= []).push(p);
  }
  return groups;
}

export function renderHomeContent(baseUrl: string) {
  const groups = groupByCaseType();
  const sections = Object.entries(CASE_TYPE_LABELS)
    .map(([type, label]) => {
      const pages = (groups[type] || []).sort((a, b) => a.slug.localeCompare(b.slug));
      if (!pages.length) return '';
      const items = pages.map(p => `<li><a href="${baseUrl}${p.slug}">${p.h1}</a></li>`).join('');
      return `<h3 style="font-size:1.1rem;font-weight:700;margin-top:24px;color:#0b1f3a;">${label}</h3><ul style="columns:2;gap:24px;list-style:none;padding:0;">${items}</ul>`;
    })
    .join('');
  return `<main style="max-width:820px;margin:0 auto;padding:40px 20px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;line-height:1.6;">
    <h1 style="font-size:2.2rem;font-weight:800;">Diagnóstico legal con IA en Chile</h1>
    <p style="font-size:1.05rem;color:#334155;">Analiza tu demanda o citación, calcula tus plazos fatales y recibe orientación legal para arriendo, laboral, deudas, familia, civil y penal. Sin costo inicial y sin reemplazar el patrocinio de un abogado.</p>
    <h2 style="font-size:1.3rem;margin-top:32px;">Guías y consultas legales frecuentes</h2>
    ${sections}
    <p style="margin-top:32px;font-size:0.85rem;color:#64748b;">Herramienta de orientación legal adaptada a la legislación chilena (CPC, Código del Trabajo, Ley 19.968). No constituye asesoría legal formal.</p>
  </main>`;
}