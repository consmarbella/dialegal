const REQUIRED_VARS = ['GEMINI_API_KEY'] as const;
const WARN_VARS = ['MP_ACCESS_TOKEN'] as const;

export function validateEnv(): void {
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      console.warn(`[env] Variable ${varName} no configurada. Algunas funcionalidades pueden no estar disponibles.`);
    }
  }
  for (const varName of WARN_VARS) {
    if (!process.env[varName]) {
      console.warn(`[env] Variable ${varName} no configurada. Los pagos funcionarán en modo simulación.`);
    }
  }
}
