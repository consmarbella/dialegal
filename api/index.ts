// Vercel serverless entry point
// Este archivo se compila como ESM (package.json tiene "type": "module"),
// por lo que usamos createRequire para cargar el bundle CJS autocontenido
// generado por `npm run build` (dist/server.cjs).
// La función expresa:
// - Rutas SEO SSR (/sitemap.xml, /robots.txt, /[landing-seo])
// - Endpoints /api/*
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const serverModule = require('../dist/server.cjs');

const app = serverModule.handler ?? serverModule.default ?? serverModule;

export default app;
export { app as handler };
