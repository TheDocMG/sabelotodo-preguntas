# Catálogo de preguntas de Sabelotodo TV

Este repositorio **contiene solo las preguntas**. Cada vez que guardás un cambio acá, GitHub:

1. Revisa todas las preguntas: que tengan 4 opciones, una respuesta válida, que no haya ids repetidos, etc.
2. Si está todo bien, publica el catálogo nuevo en GitHub Pages, que es gratis y sale por CDN.
3. Las TVs lo descargan solas la próxima vez que abren el juego. **No hace falta tocar ni volver a publicar la app.**

Si algo está mal, la publicación se cancela y las TVs siguen usando la versión anterior. Nunca se rompe el juego.

---

## Agregar preguntas (lo de todos los días)

1. Abrí la carpeta `preguntas/` y entrá al archivo de la categoría:

   | Archivo | Categoría |
   |---|---|
   | `cultura_general.json` | Cultura General |
   | `cine_series.json` | Cine y Series |
   | `futbol.json` | Fútbol |
   | `simpsons.json` | Los Simpsons |
   | `friends.json` | Friends |

2. Tocá el lápiz ✏️ ("Edit this file").
3. Andá al final del archivo. Después de la última `}` agregá una **coma** y pegá tus preguntas nuevas, antes del `]` final.
4. Tocá **"Commit changes"**.
5. Entrá a la pestaña **Actions**. En uno o dos minutos vas a ver ✅ (publicado) o ❌ (hay un error). Si sale ❌, entrá a ver el detalle: te dice el archivo, el número de pregunta y qué le falta.

Las TVs toman el cambio en unos 10 minutos. Desde la app también se puede forzar en **Ajustes → Editor y Carga de Preguntas → botón ⟳**.

### Plantilla mínima

Solo estos campos son obligatorios. La categoría sale del nombre del archivo y el `id` se genera solo.

```json
  {
    "enunciado": "¿Cuántos jugadores tiene un equipo de fútbol en cancha?",
    "opciones": ["9", "10", "11", "12"],
    "respuestaCorrecta": 2,
    "dificultad": "facil",
    "explicacion": "Cada equipo juega con 10 jugadores de campo más el arquero."
  }
```

> ⚠️ `respuestaCorrecta` **empieza a contar desde 0**: 0 = primera opción, 1 = segunda, 2 = tercera, 3 = cuarta.

### Campos opcionales

| Campo | Por defecto | Para qué sirve |
|---|---|---|
| `id` | se genera solo | Identificador único. Si lo ponés, que no se repita (ej. `futbol_084`). |
| `modosPermitidos` | `["supervivencia", "supremo", "familia"]` | En qué modos puede salir. Lobo Solitario usa todas. |
| `aptaFamilia` | `true` | Poné `false` si es muy difícil o no apta para chicos: no sale en el modo Familia. |
| `activa` | `true` | Poné `false` para **ocultar** una pregunta sin borrarla. |
| `grupoVariantes` | — | Si dos preguntas se parecen mucho, dales el mismo texto acá y nunca van a salir en la misma partida. |
| `revision`, `fechaActualizacion` | `1`, fecha de hoy | Control editorial. |

`dificultad` puede ser `facil`, `medio` o `dificil`. Sin tildes.

### Errores típicos

- **Falta una coma** entre `}` y `{`, o **sobra una coma** antes del `]` final.
- Usar comillas tipográficas (“ ”) en lugar de comillas rectas (`"`). Pasa mucho si copiás desde Word.
- Si el texto tiene comillas adentro, escribilas así: `\"`.
- Escribir `"true"` con comillas. Tiene que ir `true`, sin comillas.

---

## Configuración inicial (una sola vez)

1. En GitHub creá un repositorio **público** (ej. `sabelotodo-preguntas`). GitHub Pages es gratis solo en repos públicos.
2. Subí todo el contenido de esta carpeta, incluida la carpeta oculta `.github/`.
3. En el repo andá a **Settings → Pages → Build and deployment → Source** y elegí **GitHub Actions**.
4. En **Actions** vas a ver correr "Publicar preguntas". Cuando termine, el catálogo queda en:
   `https://TU-USUARIO.github.io/sabelotodo-preguntas/`
   Esa página muestra la versión publicada y cuántas preguntas hay por categoría.
5. Esa dirección se configura una sola vez en la app: `DEFAULT_CATALOG_URL` en `src/services/questionsCatalog.ts`, o la variable `VITE_PREGUNTAS_URL`.

## Cómo funciona por dentro

- `scripts/construir.mjs` junta los archivos de `preguntas/`, los valida y genera:
  - `version.json`: pesa unos cientos de bytes. Es lo **único** que la TV consulta cada vez que abre el juego.
  - `preguntas-<version>.json`: el catálogo completo, unos 100 KB comprimido. La TV lo baja **solo cuando cambia la versión** y lo guarda en su memoria interna (IndexedDB).
- La versión es una huella del contenido. Si no cambió ninguna pregunta, la versión no cambia y nadie vuelve a descargar nada.
- Si no hay internet, la TV juega con la última versión que guardó. Si nunca descargó nada, usa las preguntas que vienen incluidas en la app.
