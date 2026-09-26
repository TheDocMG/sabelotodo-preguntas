// Construye el catálogo publicado de Sabelotodo TV.
//
// Lee todos los archivos de preguntas/<categoria>.json, valida cada pregunta,
// completa los campos opcionales y genera en _site/:
//   - version.json              → archivo minúsculo que la TV consulta al abrir la app
//   - preguntas-<version>.json  → catálogo completo (nombre inmutable por versión)
//   - index.html                → página de estado para ver qué está publicado
//
// Si hay algún error, termina con código 1 y NO se publica nada (la TV sigue
// usando la versión anterior).
//
// Uso local (opcional, requiere Node 18+):  node scripts/construir.mjs

import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA_PREGUNTAS = join(RAIZ, 'preguntas');
const SALIDA = join(RAIZ, '_site');

const CATEGORIAS = ['cultura_general', 'cine_series', 'futbol', 'simpsons', 'friends'];
const DIFICULTADES = ['facil', 'medio', 'dificil'];
const MODOS = ['supervivencia', 'supremo', 'familia', 'lobo_solitario'];
const MODOS_POR_DEFECTO = ['supervivencia', 'supremo', 'familia'];
const MAX_ENUNCIADO = 250;
const HOY = new Date().toISOString().slice(0, 10);

const errores = [];
const avisos = [];

const hash = (texto, largo) => createHash('sha256').update(texto).digest('hex').slice(0, largo);
const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const esTextoNoVacio = (v) => typeof v === 'string' && v.trim().length > 0;

function validarPregunta(q, categoria, donde) {
  const err = (msg) => errores.push(`${donde}: ${msg}`);
  const aviso = (msg) => avisos.push(`${donde}: ${msg}`);

  if (typeof q !== 'object' || q === null || Array.isArray(q)) {
    err('no es un objeto { ... }');
    return null;
  }

  if (!esTextoNoVacio(q.enunciado)) err('falta "enunciado"');
  else if (q.enunciado.length > MAX_ENUNCIADO) aviso(`el enunciado tiene ${q.enunciado.length} caracteres (recomendado ≤ ${MAX_ENUNCIADO} para que entre bien en la TV)`);

  if (!Array.isArray(q.opciones) || q.opciones.length !== 4 || !q.opciones.every(esTextoNoVacio)) {
    err('"opciones" debe tener exactamente 4 textos');
  } else if (new Set(q.opciones.map((o) => normalizar(o))).size !== 4) {
    err('hay opciones repetidas');
  }

  if (!Number.isInteger(q.respuestaCorrecta) || q.respuestaCorrecta < 0 || q.respuestaCorrecta > 3) {
    err('"respuestaCorrecta" debe ser 0, 1, 2 o 3 (0 = primera opción)');
  }

  if (!DIFICULTADES.includes(q.dificultad)) {
    err(`"dificultad" debe ser una de: ${DIFICULTADES.join(', ')}`);
  }

  if (q.categoria !== undefined && q.categoria !== categoria) {
    err(`dice "categoria": "${q.categoria}" pero está en el archivo ${categoria}.json`);
  }

  const modos = q.modosPermitidos ?? MODOS_POR_DEFECTO;
  if (!Array.isArray(modos) || modos.length === 0 || !modos.every((m) => MODOS.includes(m))) {
    err(`"modosPermitidos" solo puede contener: ${MODOS.join(', ')}`);
  }

  if (q.id !== undefined && !esTextoNoVacio(q.id)) err('"id" no puede estar vacío');
  if (q.grupoVariantes !== undefined && typeof q.grupoVariantes !== 'string') err('"grupoVariantes" debe ser texto');
  for (const campo of ['activa', 'aptaFamilia']) {
    if (q[campo] !== undefined && typeof q[campo] !== 'boolean') err(`"${campo}" debe ser true o false (sin comillas)`);
  }

  if (!esTextoNoVacio(q.explicacion)) aviso('no tiene "explicacion" (se mostrará un texto genérico)');

  const pregunta = {
    id: esTextoNoVacio(q.id) ? q.id.trim() : `${categoria}_${hash(String(q.enunciado), 8)}`,
    enunciado: String(q.enunciado ?? '').trim(),
    opciones: Array.isArray(q.opciones) ? q.opciones.map((o) => String(o).trim()) : [],
    respuestaCorrecta: q.respuestaCorrecta,
    explicacion: esTextoNoVacio(q.explicacion) ? q.explicacion.trim() : 'Dato curioso de la trivia.',
    categoria,
    dificultad: q.dificultad,
    modosPermitidos: modos,
    activa: q.activa !== false,
    aptaFamilia: q.aptaFamilia !== false,
    revision: Number.isInteger(q.revision) ? q.revision : 1,
    fechaActualizacion: esTextoNoVacio(q.fechaActualizacion) ? q.fechaActualizacion : HOY,
  };
  if (esTextoNoVacio(q.grupoVariantes)) pregunta.grupoVariantes = q.grupoVariantes.trim();
  return pregunta;
}

// ---------- Lectura ----------
const archivos = readdirSync(CARPETA_PREGUNTAS).filter((f) => f.endsWith('.json')).sort();
const preguntas = [];

for (const archivo of archivos) {
  const categoria = basename(archivo, '.json');
  if (!CATEGORIAS.includes(categoria)) {
    errores.push(`${archivo}: el nombre del archivo debe ser una categoría válida (${CATEGORIAS.join(', ')})`);
    continue;
  }

  let lista;
  try {
    lista = JSON.parse(readFileSync(join(CARPETA_PREGUNTAS, archivo), 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    errores.push(`${archivo}: JSON inválido → ${e.message} (revisá comas, comillas y corchetes cerca de esa posición)`);
    continue;
  }
  if (!Array.isArray(lista)) {
    errores.push(`${archivo}: debe empezar con [ y terminar con ] (una lista de preguntas)`);
    continue;
  }

  lista.forEach((q, i) => {
    const etiqueta = `${archivo}, pregunta #${i + 1}${q && q.id ? ` (${q.id})` : ''}`;
    const p = validarPregunta(q, categoria, etiqueta);
    if (p) preguntas.push({ p, etiqueta });
  });
}

// ---------- Validaciones globales ----------
const porId = new Map();
const porEnunciado = new Map();
for (const { p, etiqueta } of preguntas) {
  if (porId.has(p.id)) errores.push(`${etiqueta}: el id "${p.id}" está repetido (también en ${porId.get(p.id)})`);
  else porId.set(p.id, etiqueta);

  const clave = normalizar(p.enunciado);
  if (clave && porEnunciado.has(clave)) avisos.push(`${etiqueta}: parece repetida con ${porEnunciado.get(clave)}`);
  else porEnunciado.set(clave, etiqueta);
}

if (preguntas.length === 0) errores.push('No se encontró ninguna pregunta.');

// ---------- Resultado ----------
if (avisos.length) {
  console.log(`\n⚠️  ${avisos.length} aviso(s) (no impiden publicar):`);
  avisos.forEach((a) => console.log(`   - ${a}`));
}

if (errores.length) {
  console.error(`\n❌ ${errores.length} error(es). No se publicó nada; la TV sigue con la versión anterior:`);
  errores.forEach((e) => console.error(`   - ${e}`));
  process.exit(1);
}

const lista = preguntas.map(({ p }) => p);
const contenido = JSON.stringify(lista);
const version = hash(contenido, 12);
const archivoCatalogo = `preguntas-${version}.json`;

const contar = (clave) => lista.reduce((acc, q) => ({ ...acc, [q[clave]]: (acc[q[clave]] || 0) + 1 }), {});
const resumen = {
  version,
  archivo: archivoCatalogo,
  total: lista.length,
  generado: new Date().toISOString(),
  porCategoria: contar('categoria'),
  porDificultad: contar('dificultad'),
};

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });
writeFileSync(join(SALIDA, archivoCatalogo), JSON.stringify({ version, total: lista.length, preguntas: lista }));
writeFileSync(join(SALIDA, 'version.json'), JSON.stringify(resumen, null, 2));

const filas = (obj) => Object.entries(obj).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
writeFileSync(
  join(SALIDA, 'index.html'),
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catálogo Sabelotodo TV</title>
<style>body{font:16px system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;background:#0a0e1a;color:#dfe2f3}
h1{color:#00e5ff}table{border-collapse:collapse;margin:8px 0 24px}td{padding:4px 16px 4px 0}code{color:#5be9ad}</style>
<h1>Catálogo Sabelotodo TV</h1>
<p>Versión publicada: <code>${version}</code><br>Total: <b>${lista.length}</b> preguntas<br>Generado: ${resumen.generado}</p>
<h3>Por categoría</h3><table>${filas(resumen.porCategoria)}</table>
<h3>Por dificultad</h3><table>${filas(resumen.porDificultad)}</table>
<p><a style="color:#00e5ff" href="version.json">version.json</a></p></html>`
);

console.log(`\n✅ Catálogo listo: versión ${version} con ${lista.length} preguntas`);
console.log('   Por categoría:', resumen.porCategoria);
console.log('   Por dificultad:', resumen.porDificultad);
