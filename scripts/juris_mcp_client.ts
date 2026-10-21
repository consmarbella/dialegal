// Cliente MCP stdio de prueba para Open Legal Chile (opcion 3, uso dev).
// Arranca `python -m openlegal mcp`, inicializa la sesion MCP y lista herramientas;
// luego ejecuta pjud_search_jurisprudencia y dt_search_doctrina con una consulta laboral.
// Uso: npx tsx scripts/juris_mcp_client.ts  ["consulta"] [perfil]
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

const consulta = process.argv[2] || "despido necesidades de la empresa carta sin hechos concretos";
const perfil = process.argv[3];

const mcpBin = perfil ? ["-m", "openlegal", "mcp", "--profile", perfil] : ["-m", "openlegal", "mcp"];

const proc: ChildProcessWithoutNullStreams = spawn("python", mcpBin, {
  stdio: ["pipe", "pipe", "pipe"],
});
proc.stderr.setEncoding("utf8");
proc.stderr.on("data", (d) => process.stderr.write(`[mcp:stderr] ${d}`));

let buffer = "";
const pendientes: Array<{ id: number; resolve: (v: any) => void; reject: (e: Error) => void; fijarTiempo: NodeJS.Timeout }> = [];
let procSalida = Buffer.alloc(0);

proc.stdout.setEncoding("utf8");
proc.stdout.on("data", (chunk: string) => {
  buffer += chunk;
  let idx: number;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const linea = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!linea) continue;
    let msg: any;
    try { msg = JSON.parse(linea); } catch { continue; }
    const pend = pendientes.find((p) => pidDe(msg) === p.id);
    if (!pend) continue;
    clearTimeout(pend.fijarTiempo);
    pendientes.splice(pendientes.indexOf(pend), 1);
    pend.resolve(msg);
  }
});

let siguienteId = 1;
const pidDe = (msg: any) => msg?.id;

async function llamar(method: string, params: any, timeoutMs = 120000): Promise<any> {
  const id = siguienteId++;
  const req = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
  return new Promise((resolve, reject) => {
    const fijarTiempo = setTimeout(() => reject(new Error(`timeout ${method}`)), timeoutMs);
    pendientes.push({ id, resolve, reject, fijarTiempo });
    proc.stdin.write(req);
  });
}

function extraerTexto(res: any): string {
  const cont = res?.result?.content;
  if (Array.isArray(cont)) return cont.map((c: any) => (typeof c?.text === "string" ? c.text : "")).join("\n");
  return JSON.stringify(res?.result ?? res).slice(0, 2000);
}

async function main() {
  const init = await llamar("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "legalhelp-juris-test", version: "1.0" },
  }, 30000);
  console.log("[init] server:", init?.result?.serverInfo?.name, init?.result?.serverInfo?.version);
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const tools = await llamar("tools/list", {}, 60000);
  const nombres: string[] = (tools?.result?.tools || []).map((t: any) => t.name);
  console.log(`[tools] ${nombres.length} herramientas: ${nombres.slice(0, 12).join(", ")}...`);

  for (const tool of ["pjud_search_jurisprudencia", "dt_search_doctrina"]) {
    const args = { query: consulta } as Record<string, unknown>;
    const res = await llamar("tools/call", { name: tool, arguments: args }, 120000);
    const texto = extraerTexto(res);
    console.log(`\n===== ${tool} =====\n${texto.slice(0, 2200)}`);
  }
}

main()
  .catch((e) => { console.error("[ERROR]", e.message); process.exitCode = 1; })
  .finally(() => { try { proc.kill(); } catch { /* noop */ } });
