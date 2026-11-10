// Traza la cadena de redirecciones de prod para /datos (con y sin query).
const saltos = async (url: string, max = 8) => {
  let actual = url;
  for (let i = 0; i < max; i++) {
    const res = await fetch(actual, { redirect: "manual" });
    const loc = res.headers.get("location");
    console.log(`${res.status} ${actual} ${loc ? "-> " + loc : ""}`);
    if (res.status >= 300 && res.status < 400 && loc) {
      actual = new URL(loc, actual).toString();
      continue;
    }
    const body = await res.text();
    console.log(`   body len=${body.length} ${body.slice(0, 80).replace(/\s+/g, " ")}`);
    return;
  }
  console.log("LOOP >8");
};
await saltos("https://legalhelp.cl/datos");
console.log("---");
await saltos("https://legalhelp.cl/datos?cb=20261110a");
