/**
 * simulador_memoria.js
 * ═══════════════════════════════════════════════════════════════
 * Simulador de Gestión de Memoria en un sistema multiprogramado.
 * Capacidad: 16 MiB de RAM (2^24 bytes → 0x000000 – 0xFFFFFF)
 *
 * Métodos implementados:
 *   1. Particiones estáticas de tamaño FIJO
 *   2. Particiones estáticas de tamaño VARIABLE
 *      - Algoritmos: Primer Ajuste | Mejor Ajuste | Peor Ajuste
 *   3. Particiones DINÁMICAS sin compactación
 *      - Algoritmos: Primer Ajuste | Mejor Ajuste | Peor Ajuste
 *   4. Particiones DINÁMICAS con compactación
 *      - Algoritmos: Primer Ajuste | Mejor Ajuste | Peor Ajuste
 *
 * Secciones:
 *   1.  Constantes del sistema
 *   2.  Datos de programas predefinidos (del ejercicio Excel)
 *   3.  Estado global de la simulación
 *   4.  Línea de tiempo de simulación automática (T1–T6)
 *   5.  Inicialización
 *   6.  Inicialización de particiones según el método
 *   7.  Algoritmos de asignación (First/Best/Worst Fit)
 *   8.  Carga y liberación de procesos
 *   9.  Procesos personalizados  ← nuevo
 *   10. Acciones de la interfaz de usuario
 *   11. Renderizado de la interfaz
 *   12. Funciones auxiliares (helpers)
 *   13. Atajos de teclado
 *   14. Arranque
 * ═══════════════════════════════════════════════════════════════
 */


/* ═══════════════════════════════════════════════
   SECCIÓN 1: CONSTANTES DEL SISTEMA
═══════════════════════════════════════════════ */

/** Tamaño total de RAM: 16 MiB = 16,777,216 bytes */
const RAM = 16 * 1024 * 1024;

/**
 * Espacio reservado para el Sistema Operativo: 1 MiB
 *   - Pila del SO:      64 KiB (65,536 bytes)
 *   - Montículo del SO: 128 KiB (131,072 bytes)
 *   - EXE Header:       767 bytes
 *   - Resto reservado hasta completar 1 MiB
 */
const SO_SIZE = 1_048_576;

/** Tamaño fijo del montículo de cada proceso: 128 KiB */
const HEAP_SIZE  = 131_072;
/** Tamaño fijo de la pila de cada proceso: 64 KiB */
const STACK_SIZE =  65_536;
/** Tamaño fijo de la cabecera EXE de cada proceso: 767 bytes */
const HEADER_SIZE =    767;

/**
 * Colores asignados a cada proceso para el mapa visual de RAM.
 * Los procesos personalizados reciben colores de la paleta CUSTOM_COLORS.
 */
const PROC_COLORS = {
  SO: '#4a4a6a',
  P1: '#6c3fc8',
  P2: '#2060c8',
  P3: '#207060',
  P4: '#c86030',
  P5: '#806020',
  P6: '#c03060',
  P7: '#208060',
  P8: '#604080',
};

/**
 * Paleta de colores para procesos personalizados del usuario.
 * Se asignan de forma rotatoria (cíclica) según el índice del proceso.
 */
const CUSTOM_COLORS = [
  '#b07020', // ámbar oscuro
  '#208080', // teal oscuro
  '#803080', // magenta oscuro
  '#406030', // verde oliva
  '#704040', // marrón rojizo
  '#304070', // azul marino
  '#707020', // amarillo oscuro
  '#507050', // verde grisáceo
];


/* ═══════════════════════════════════════════════
   SECCIÓN 2: DATOS DE LOS PROGRAMAS PREDEFINIDOS
   Extraídos del ejercicio de clase (Excel).

   Fórmula del tamaño en RAM:
     memSize = HEADER(767) + code + data + bss + HEAP(128K) + STACK(64K)
═══════════════════════════════════════════════ */
const PROGRAMS = [
  {
    id: 'P1', name: 'Notepad',
    diskSize:   33_808,
    code:       19_524,   // .text: código ejecutable
    dataInit:   12_352,   // .data: datos inicializados
    dataBss:     1_165,   // .bss:  datos sin inicializar
    memInitial: 33_041,
    memSize:   224_649,
    segments: { header: HEADER_SIZE, code: 19_524, data: 12_352, bss:  1_165, heap: HEAP_SIZE, stack: STACK_SIZE },
    custom: false,
  },
  {
    id: 'P2', name: 'Word',
    diskSize:   115_086,
    code:        77_539,
    dataInit:    32_680,
    dataBss:      4_100,
    memInitial: 114_319,
    memSize:    286_708,
    segments: { header: HEADER_SIZE, code: 77_539, data: 32_680, bss:  4_100, heap: HEAP_SIZE, stack: STACK_SIZE },
    custom: false,
  },
  {
    id: 'P3', name: 'Excel',
    diskSize:   132_111,
    code:        99_542,
    dataInit:    24_245,
    dataBss:      7_557,
    memInitial: 131_344,
    memSize:    309_150,
    segments: { header: HEADER_SIZE, code: 99_542, data: 24_245, bss:  7_557, heap: HEAP_SIZE, stack: STACK_SIZE },
    custom: false,
  },
  {
    id: 'P4', name: 'AutoCAD',
    diskSize:   240_360,
    code:       115_000,
    dataInit:   123_470,
    dataBss:      1_123,
    memInitial: 239_593,
    memSize:    436_201,
    segments: { header: HEADER_SIZE, code: 115_000, data: 123_470, bss:  1_123, heap: HEAP_SIZE, stack: STACK_SIZE },
    custom: false,
  },
  {
    id: 'P5', name: 'Calculadora',
    diskSize:    16_121,
    code:        12_342,
    dataInit:     1_256,
    dataBss:      1_756,
    memInitial:  15_354,
    memSize:    209_462,
    segments: { header: HEADER_SIZE, code: 12_342, data:  1_256, bss:  1_756, heap: HEAP_SIZE, stack: STACK_SIZE },
    custom: false,
  },
  {
    id: 'P6', name: 'p1 (Grande)',
    diskSize:  3_800_767,
    code:        525_000,
    dataInit:  3_224_000,
    dataBss:      51_000,
    memInitial: 3_800_000,
    memSize:   3_996_608,
    segments: { header: HEADER_SIZE, code: 525_000, data: 3_224_000, bss: 51_000, heap: HEAP_SIZE, stack: STACK_SIZE },
    custom: false,
  },
  {
    id: 'P7', name: 'p2 (Mediano)',
    diskSize:  1_589_767,
    code:        590_000,
    dataInit:    974_000,
    dataBss:      25_000,
    memInitial: 1_589_000,
    memSize:   1_785_608,
    segments: { header: HEADER_SIZE, code: 590_000, data: 974_000, bss: 25_000, heap: HEAP_SIZE, stack: STACK_SIZE },
    custom: false,
  },
  {
    id: 'P8', name: 'p3 (Grande)',
    diskSize:  2_500_767,
    code:        349_000,
    dataInit:  2_150_000,
    dataBss:       1_000,
    memInitial: 2_500_000,
    memSize:   2_696_608,
    segments: { header: HEADER_SIZE, code: 349_000, data: 2_150_000, bss: 1_000, heap: HEAP_SIZE, stack: STACK_SIZE },
    custom: false,
  },
];


/* ═══════════════════════════════════════════════
   SECCIÓN 3: ESTADO GLOBAL DE LA SIMULACIÓN
═══════════════════════════════════════════════ */

/**
 * Estado global del simulador.
 *
 * partitions: Array de particiones con la estructura:
 *   {
 *     id:        identificador único,
 *     pid:       'SO' | 'P1'…'P8' | 'CX' | null,
 *     type:      'so' | 'process' | 'free',
 *     base:      dirección de inicio (bytes, decimal),
 *     size:      tamaño de la partición (bytes),
 *     allocSize: bytes realmente usados por el proceso (≤ size)
 *   }
 *
 * customPrograms: Array de procesos personalizados creados por el usuario.
 *   Comparten la misma estructura que PROGRAMS y se listan junto a ellos,
 *   pero nunca forman parte de la línea de tiempo automática T1–T6.
 *
 * customCounter: Contador para generar IDs únicos (C1, C2, C3…).
 * customColorIdx: Índice rotatorio en CUSTOM_COLORS para asignar colores.
 */
const state = {
  method:          'fixed',
  algorithm:       'first',
  partSize:        1_048_576,
  partitions:      [],
  selectedProg:    null,
  simStep:         0,
  customPrograms:  [],    // procesos personalizados del usuario
  customCounter:   0,     // contador de IDs únicos para procesos personalizados
  customColorIdx:  0,     // índice rotatorio de colores para personalizados
};


/* ═══════════════════════════════════════════════
   SECCIÓN 4: LÍNEA DE TIEMPO DE SIMULACIÓN
   Replica los instantes T1–T6 del ejercicio Excel.
   Solo incluye procesos predefinidos (P1–P8).
   Los procesos personalizados (C1, C2…) son siempre
   de control manual y no entran en esta secuencia.
═══════════════════════════════════════════════ */
const SIM_TIMELINE = {
  fixed: [
    ['P4'],
    ['P3', 'P4'],
    ['P5', 'P4'],
    ['P2', 'P5'],
    ['P1', 'P3'],
    ['P2'],
  ],
  variable: [
    ['P4'],
    ['P3', 'P4'],
    ['P5', 'P4'],
    ['P2', 'P4'],
    ['P1', 'P3'],
    ['P3', 'P5', 'P7'],
  ],
  dynamic: [
    ['P4', 'P5'],
    ['P3', 'P4', 'P5'],
    ['P5'],
    ['P2', 'P4', 'P5', 'P6', 'P7', 'P8'],
    ['P1', 'P2', 'P4', 'P5', 'P6', 'P7', 'P8'],
    ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
  ],
  dynamic_compact: [
    ['P4', 'P5'],
    ['P3', 'P4', 'P5'],
    ['P5'],
    ['P2', 'P4', 'P5', 'P6', 'P7', 'P8'],
    ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
    ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
  ],
};


/* ═══════════════════════════════════════════════
   SECCIÓN 5: INICIALIZACIÓN
═══════════════════════════════════════════════ */

/** Punto de entrada: inicializa la UI y renderiza el estado inicial. */
function init() {
  renderProgramsList();
  onMethodChange();
}

/** Manejador del selector de método de gestión. */
function onMethodChange() {
  const m = document.getElementById('methodSelect').value;
  state.method    = m;
  state.algorithm = document.getElementById('algorithmSelect').value;

  const isDynamic  = (m === 'dynamic' || m === 'dynamic_compact');
  const isVariable = (m === 'variable');
  const isFixed    = (m === 'fixed');

  document.getElementById('algorithmRow').style.display =
    (isDynamic || isVariable) ? 'block' : 'none';
  document.getElementById('fixedPartRow').style.display =
    isFixed ? 'block' : 'none';
  document.getElementById('compactBtnWrap').style.display =
    (m === 'dynamic_compact') ? 'block' : 'none';

  const titles = {
    fixed:           'Mapa de Memoria — Particiones Estáticas Fijas',
    variable:        'Mapa de Memoria — Particiones Estáticas Variables',
    dynamic:         'Mapa de Memoria — Particiones Dinámicas (Sin Compactación)',
    dynamic_compact: 'Mapa de Memoria — Particiones Dinámicas (Con Compactación)',
  };
  document.getElementById('mapTitle').textContent = titles[m];

  state.simStep = 0;
  resetMemory(true);
}

/** Manejador del selector de algoritmo: actualiza el estado. */
function onAlgorithmChange() {
  state.algorithm = document.getElementById('algorithmSelect').value;
  addLog(`Algoritmo cambiado a: ${algName()}`, 'info');
}

/**
 * Reinicia la memoria al estado inicial del método activo.
 * Los procesos personalizados se conservan en la lista pero se descargan de RAM.
 * @param {boolean} silent - Si true, no agrega entrada al log.
 */
function resetMemory(silent = false) {
  state.partitions = [];
  state.simStep    = 0;
  initPartitions();
  if (!silent) addLog('Memoria reseteada al estado inicial.', 'info');
  render();
}


/* ═══════════════════════════════════════════════
   SECCIÓN 6: INICIALIZACIÓN DE PARTICIONES
═══════════════════════════════════════════════ */

/** Crea la distribución inicial de particiones según el método activo. */
function initPartitions() {
  const m = state.method;
  state.partitions = [];

  if      (m === 'fixed')    initFixedPartitions();
  else if (m === 'variable') initVariablePartitions();
  else                       initDynamicPartitions();
}

/**
 * Estáticas de Tamaño Fijo:
 * Divide toda la RAM en N bloques iguales del tamaño elegido.
 * El primer bloque es del SO; el resto inicia como libre.
 * El espacio sobrante dentro de una partición es fragmentación interna.
 */
function initFixedPartitions() {
  const sz = parseInt(document.getElementById('partSizeSelect')?.value || '1048576');
  state.partSize = sz;
  let addr = 0, id = 0;
  while (addr < RAM) {
    const partSz = Math.min(sz, RAM - addr);
    state.partitions.push({
      id, pid: addr === 0 ? 'SO' : null,
      type: addr === 0 ? 'so' : 'free',
      base: addr, size: partSz,
      allocSize: addr === 0 ? partSz : 0,
    });
    addr += partSz;
    id++;
  }
}

/**
 * Estáticas de Tamaño Variable:
 * Distribución del ejercicio Excel: 1MiB SO + 512K + 512K + 1M + 1M + 2M + 2M + 4M + 4M.
 * Los tamaños son fijos una vez definidos, pero el algoritmo elige en qué partición carga
 * cada proceso (Primer Ajuste, Mejor Ajuste o Peor Ajuste).
 */
function initVariablePartitions() {
  const layout = [
    { size: 1_048_576, type: 'so',   pid: 'SO' },
    { size:   524_288, type: 'free', pid: null  },
    { size:   524_288, type: 'free', pid: null  },
    { size: 1_048_576, type: 'free', pid: null  },
    { size: 1_048_576, type: 'free', pid: null  },
    { size: 2_097_152, type: 'free', pid: null  },
    { size: 2_097_152, type: 'free', pid: null  },
    { size: 4_194_304, type: 'free', pid: null  },
    { size: 4_194_304, type: 'free', pid: null  },
  ];
  let addr = 0;
  layout.forEach((p, i) => {
    state.partitions.push({
      id: i, pid: p.pid, type: p.type,
      base: addr, size: p.size,
      allocSize: p.type === 'so' ? p.size : 0,
    });
    addr += p.size;
  });
}

/**
 * Dinámicas (sin o con compactación):
 * Al inicio solo existe el bloque del SO y un único bloque libre.
 * Los bloques se crean/destruyen dinámicamente al cargar y liberar procesos.
 */
function initDynamicPartitions() {
  state.partitions = [
    { id: 0, pid: 'SO', type: 'so',  base: 0,       size: SO_SIZE,       allocSize: SO_SIZE },
    { id: 1, pid: null, type: 'free', base: SO_SIZE, size: RAM - SO_SIZE, allocSize: 0       },
  ];
}


/* ═══════════════════════════════════════════════
   SECCIÓN 7: ALGORITMOS DE ASIGNACIÓN
═══════════════════════════════════════════════ */

/**
 * Selecciona una partición libre según el algoritmo activo.
 *
 * @param {Array}  freeList - Particiones libres candidatas
 * @param {number} reqSize  - Bytes requeridos por el proceso
 * @returns {Object|null}   La partición elegida o null si no hay candidatos
 */
function selectPartition(freeList, reqSize) {
  const candidates = freeList.filter(p => p.size >= reqSize);
  if (candidates.length === 0) return null;

  const alg = state.algorithm;

  if (alg === 'first') {
    /**
     * PRIMER AJUSTE (First Fit):
     * Primera partición libre suficientemente grande, ordenada por dirección base.
     * Ventaja: rápido. Desventaja: tiende a fragmentar el inicio de la RAM.
     */
    return candidates.sort((a, b) => a.base - b.base)[0];
  }

  if (alg === 'best') {
    /**
     * MEJOR AJUSTE (Best Fit):
     * Partición cuyo tamaño sobrante (size − reqSize) es el menor posible.
     * Ventaja: desperdicia menos por partición.
     * Desventaja: genera muchos fragmentos pequeños difíciles de reutilizar.
     */
    return candidates.sort((a, b) => (a.size - reqSize) - (b.size - reqSize))[0];
  }

  if (alg === 'worst') {
    /**
     * PEOR AJUSTE (Worst Fit):
     * La partición más grande disponible.
     * Ventaja: el sobrante es grande y útil para procesos futuros.
     * Desventaja: destruye bloques grandes rápidamente.
     */
    return candidates.sort((a, b) => (b.size - reqSize) - (a.size - reqSize))[0];
  }

  return null;
}


/* ═══════════════════════════════════════════════
   SECCIÓN 8: CARGA Y LIBERACIÓN DE PROCESOS
═══════════════════════════════════════════════ */

/**
 * Busca un programa en la lista combinada (predefinidos + personalizados).
 * @param {string} pid
 * @returns {Object|undefined}
 */
function findProgram(pid) {
  return [...PROGRAMS, ...state.customPrograms].find(p => p.id === pid);
}

/**
 * Carga un proceso en RAM según el método y algoritmo activos.
 * @param {string} pid - ID del proceso a cargar
 * @returns {boolean} true si la carga fue exitosa
 */
function allocateProcess(pid) {
  const prog = findProgram(pid);
  if (!prog) return false;

  if (state.partitions.find(p => p.pid === pid)) {
    addLog(`${pid} (${prog.name}) ya está en memoria.`, 'warn');
    return false;
  }

  const m = state.method;

  /* ── Estáticas Fijas ── */
  if (m === 'fixed') {
    const freeList = state.partitions.filter(p => p.type === 'free');
    if (freeList.length === 0) {
      addLog(`Sin particiones libres para ${pid}.`, 'err');
      return false;
    }
    const fit = freeList.sort((a, b) => a.base - b.base).find(p => p.size >= prog.memSize);
    if (!fit) {
      addLog(
        `${pid} (${formatBytes(prog.memSize)}) no cabe en ninguna partición ` +
        `(tamaño fijo: ${formatBytes(state.partSize)}).`, 'err'
      );
      return false;
    }
    fit.type      = 'process';
    fit.pid       = pid;
    fit.allocSize = prog.memSize;
    addLog(
      `[FIJO] ${pid} (${prog.name}) → @${hex(fit.base)} | ` +
      `frag. interna: ${formatBytes(fit.size - prog.memSize)}`, 'ok'
    );
    return true;
  }

  /* ── Estáticas Variables ── */
  if (m === 'variable') {
    const chosen = selectPartition(state.partitions.filter(p => p.type === 'free'), prog.memSize);
    if (!chosen) {
      addLog(`[VAR] Sin partición para ${pid} (${formatBytes(prog.memSize)}) con "${algName()}".`, 'err');
      return false;
    }
    chosen.type      = 'process';
    chosen.pid       = pid;
    chosen.allocSize = prog.memSize;
    addLog(
      `[VAR / ${algName()}] ${pid} (${prog.name}) → @${hex(chosen.base)} ` +
      `(partición: ${formatBytes(chosen.size)}) | frag. interna: ${formatBytes(chosen.size - prog.memSize)}`, 'ok'
    );
    return true;
  }

  /* ── Dinámicas ── */
  const chosen = selectPartition(state.partitions.filter(p => p.type === 'free'), prog.memSize);
  if (!chosen) {
    addLog(`[DIN] Sin bloque contiguo para ${pid} (${formatBytes(prog.memSize)}). Intenta compactar.`, 'err');
    return false;
  }

  const origBase  = chosen.base;
  const remaining = chosen.size - prog.memSize;

  chosen.type      = 'process';
  chosen.pid       = pid;
  chosen.size      = prog.memSize;
  chosen.allocSize = prog.memSize;

  // Si sobra espacio, insertar un nuevo bloque libre inmediatamente después
  if (remaining > 0) {
    const idx = state.partitions.indexOf(chosen);
    state.partitions.splice(idx + 1, 0, {
      id: Date.now() + Math.random(),
      pid: null, type: 'free',
      base: origBase + prog.memSize,
      size: remaining, allocSize: 0,
    });
  }

  addLog(
    `[DIN / ${algName()}] ${pid} (${prog.name}) → @${hex(origBase)} | ` +
    `tamaño exacto ${formatBytes(prog.memSize)}`, 'ok'
  );
  return true;
}

/**
 * Libera la partición de un proceso y la devuelve al pool libre.
 * En dinámicas fusiona bloques libres adyacentes (coalescing).
 * @param {string} pid
 * @returns {boolean}
 */
function deallocateProcess(pid) {
  const part = state.partitions.find(p => p.pid === pid && p.type === 'process');
  if (!part) {
    addLog(`${pid} no está cargado en memoria.`, 'warn');
    return false;
  }

  const prog = findProgram(pid);
  part.type      = 'free';
  part.pid       = null;
  part.allocSize = 0;

  const m = state.method;
  if (m === 'dynamic' || m === 'dynamic_compact') {
    coalesceMemory();
    addLog(`${pid} (${prog?.name}) liberado. Bloques libres adyacentes fusionados.`, 'ok');
  } else {
    addLog(`${pid} (${prog?.name}) liberado. Partición @${hex(part.base)} marcada libre.`, 'ok');
  }

  return true;
}

/**
 * Fusión de bloques libres contiguos (Coalescing).
 * Une bloques libres vecinos en uno solo para reducir la fragmentación externa.
 */
function coalesceMemory() {
  state.partitions.sort((a, b) => a.base - b.base);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < state.partitions.length - 1; i++) {
      const a = state.partitions[i];
      const b = state.partitions[i + 1];
      if (a.type === 'free' && b.type === 'free') {
        a.size += b.size;
        state.partitions.splice(i + 1, 1);
        changed = true;
        break;
      }
    }
  }
}

/**
 * Compactación de memoria (solo en modo dinámico con compactación).
 * Mueve todos los procesos al inicio de RAM (tras el SO) y consolida
 * todo el espacio libre en un único bloque al final.
 */
function doCompact() {
  if (state.method !== 'dynamic_compact') return;
  state.partitions.sort((a, b) => a.base - b.base);

  const freeTotal = state.partitions
    .filter(p => p.type === 'free')
    .reduce((s, p) => s + p.size, 0);

  const soPart = state.partitions.find(p => p.type === 'so');
  const procs  = state.partitions.filter(p => p.type === 'process');

  let writePtr = SO_SIZE;
  const newParts = [soPart];

  for (const pr of procs) {
    pr.base = writePtr;
    writePtr += pr.size;
    newParts.push(pr);
  }

  if (freeTotal > 0) {
    newParts.push({
      id: Date.now(), pid: null, type: 'free',
      base: writePtr, size: freeTotal, allocSize: 0,
    });
  }

  state.partitions = newParts;
  addLog(`[COMPACTACIÓN] Procesos reubicados. Bloque libre: ${formatBytes(freeTotal)}`, 'info');
  render();
}


/* ═══════════════════════════════════════════════
   SECCIÓN 9: PROCESOS PERSONALIZADOS

   El usuario puede definir procesos con sus propios
   segmentos (.text, .data, .bss).
   Los segmentos HEADER (767B), .heap (128KiB) y
   .stack (64KiB) son iguales para todos los procesos,
   exactamente como en el ejercicio de clase.

   Flujo:
     1. El usuario rellena el formulario y presiona "Crear Proceso".
     2. validateCustomForm() comprueba los valores.
     3. createCustomProcess() construye el objeto y lo agrega a
        state.customPrograms.
     4. El proceso aparece en la lista del panel izquierdo con un
        borde ámbar y badge "CUSTOM".
     5. Se carga y descarga de forma manual, igual que los predefinidos.
     6. removeCustomProcess() lo elimina si no está en RAM.

   Nota: Los procesos personalizados NO entran en la simulación
   automática T1–T6. Esa secuencia reproduce el ejercicio Excel
   exacto y mezclar procesos externos alteraría su propósito.
═══════════════════════════════════════════════ */

/**
 * Actualiza la vista previa del tamaño en RAM mientras el usuario
 * escribe en los campos del formulario.
 * Calcula: HEADER + code + data + bss + HEAP + STACK
 * y marca el campo en rojo si supera la RAM disponible libre.
 */
function updateSizePreview() {
  const code = parseInt(document.getElementById('cCode').value) || 0;
  const data = parseInt(document.getElementById('cData').value) || 0;
  const bss  = parseInt(document.getElementById('cBss').value)  || 0;

  const total = HEADER_SIZE + code + data + bss + HEAP_SIZE + STACK_SIZE;

  const preview    = document.getElementById('sizePreview');
  const previewVal = document.getElementById('previewVal');

  if (code + data + bss === 0) {
    previewVal.textContent = '—';
    preview.classList.remove('oversize');
    return;
  }

  previewVal.textContent = formatBytes(total);

  // Advertir si supera la RAM total (excluyendo el SO)
  preview.classList.toggle('oversize', total > RAM - SO_SIZE);
}

/**
 * Valida los campos del formulario antes de crear el proceso.
 * Muestra un mensaje de error descriptivo si algo falla.
 * @returns {boolean} true si el formulario es válido
 */
function validateCustomForm() {
  const errorDiv = document.getElementById('formError');
  const name  = document.getElementById('cName').value.trim();
  const code  = parseInt(document.getElementById('cCode').value) || 0;
  const data  = parseInt(document.getElementById('cData').value) || 0;
  const bss   = parseInt(document.getElementById('cBss').value)  || 0;

  const hide = () => { errorDiv.style.display = 'none'; };
  const show = (msg) => {
    errorDiv.textContent   = msg;
    errorDiv.style.display = 'block';
  };

  // El nombre es obligatorio
  if (!name) {
    show('El nombre del proceso es obligatorio.');
    return false;
  }

  // El segmento .text debe tener al menos 1 byte
  if (code <= 0) {
    show('El segmento .text (código) debe ser mayor a 0.');
    return false;
  }

  // Los segmentos no pueden ser negativos
  if (data < 0 || bss < 0) {
    show('.data y .bss no pueden ser negativos.');
    return false;
  }

  // Calcular tamaño total del proceso
  const total = HEADER_SIZE + code + data + bss + HEAP_SIZE + STACK_SIZE;

  // Debe caber en la RAM (descontando el espacio del SO)
  if (total > RAM - SO_SIZE) {
    show(`El proceso (${formatBytes(total)}) supera la RAM disponible (${formatBytes(RAM - SO_SIZE)}).`);
    return false;
  }

  // Verificar que no exista ya un proceso personalizado con el mismo nombre
  const duplicate = state.customPrograms.find(
    p => p.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    show(`Ya existe un proceso personalizado con el nombre "${name}".`);
    return false;
  }

  hide();
  return true;
}

/**
 * Crea un nuevo proceso personalizado a partir del formulario
 * y lo agrega a state.customPrograms.
 * El proceso queda disponible para carga manual inmediata.
 */
function createCustomProcess() {
  if (!validateCustomForm()) return;

  const name = document.getElementById('cName').value.trim();
  const code = parseInt(document.getElementById('cCode').value) || 0;
  const data = parseInt(document.getElementById('cData').value) || 0;
  const bss  = parseInt(document.getElementById('cBss').value)  || 0;

  // Calcular el tamaño total del proceso en RAM
  const memSize = HEADER_SIZE + code + data + bss + HEAP_SIZE + STACK_SIZE;

  // Generar ID único: C1, C2, C3…
  state.customCounter++;
  const id = `C${state.customCounter}`;

  // Asignar color de la paleta rotatoria
  const color = CUSTOM_COLORS[state.customColorIdx % CUSTOM_COLORS.length];
  state.customColorIdx++;

  // Registrar el color en el mapa global de colores
  PROC_COLORS[id] = color;

  // Construir el objeto del proceso con la misma estructura que PROGRAMS
  const customProc = {
    id,
    name,
    diskSize:   memSize, // en la simulación el disco = RAM (simplificación)
    code,
    dataInit:   data,
    dataBss:    bss,
    memInitial: code + data + bss + HEADER_SIZE,
    memSize,
    segments: {
      header: HEADER_SIZE,
      code,
      data,
      bss,
      heap:  HEAP_SIZE,
      stack: STACK_SIZE,
    },
    custom: true, // marca para distinguirlo en la UI
  };

  state.customPrograms.push(customProc);

  addLog(
    `[CUSTOM] ${id} "${name}" creado. ` +
    `Tamaño en RAM: ${formatBytes(memSize)} ` +
    `.text:${formatBytes(code)} .data:${formatBytes(data)} .bss:${formatBytes(bss)}`,
    'info'
  );

  clearCustomForm();
  render();
}

/**
 * Elimina un proceso personalizado de state.customPrograms.
 * Si el proceso está cargado en RAM, lo descarga primero.
 * @param {string} pid - ID del proceso personalizado (C1, C2…)
 */
function removeCustomProcess(pid) {
  // Descargar de RAM si está cargado
  const inMem = state.partitions.some(p => p.pid === pid && p.type === 'process');
  if (inMem) deallocateProcess(pid);

  // Eliminar de la lista de procesos personalizados
  const idx = state.customPrograms.findIndex(p => p.id === pid);
  if (idx !== -1) {
    const name = state.customPrograms[idx].name;
    state.customPrograms.splice(idx, 1);
    delete PROC_COLORS[pid];
    addLog(`[CUSTOM] Proceso ${pid} "${name}" eliminado.`, 'warn');
  }

  // Si el proceso eliminado era el seleccionado, limpiar la selección
  if (state.selectedProg === pid) state.selectedProg = null;

  render();
}

/**
 * Limpia todos los campos del formulario de proceso personalizado
 * y oculta cualquier mensaje de error visible.
 */
function clearCustomForm() {
  document.getElementById('cName').value = '';
  document.getElementById('cCode').value = '';
  document.getElementById('cData').value = '';
  document.getElementById('cBss').value  = '';
  document.getElementById('previewVal').textContent = '—';
  document.getElementById('sizePreview').classList.remove('oversize');
  document.getElementById('formError').style.display = 'none';
}


/* ═══════════════════════════════════════════════
   SECCIÓN 10: ACCIONES DE LA INTERFAZ DE USUARIO
═══════════════════════════════════════════════ */

/** Carga en RAM el proceso seleccionado en la lista. */
function loadSelectedProcess() {
  if (!state.selectedProg) {
    addLog('Selecciona un programa de la lista antes de cargarlo.', 'warn');
    return;
  }
  state.algorithm = document.getElementById('algorithmSelect').value;
  if (allocateProcess(state.selectedProg)) render();
}

/** Libera de RAM el proceso seleccionado. */
function unloadSelectedProcess() {
  if (!state.selectedProg) {
    addLog('Selecciona un proceso para terminarlo.', 'warn');
    return;
  }
  if (deallocateProcess(state.selectedProg)) render();
}

/**
 * Simulación automática paso a paso (T1 → T6).
 * - Descarga los procesos que no pertenecen al instante actual.
 * - Carga los procesos que deben estar en RAM en este instante.
 * - Los procesos personalizados en RAM NO son afectados por este avance.
 */
function runAutoSimulation() {
  state.algorithm = document.getElementById('algorithmSelect').value;
  const tl = SIM_TIMELINE[state.method];
  if (!tl) return;

  const step   = state.simStep % tl.length;
  const wanted = tl[step];

  // Descargar procesos predefinidos que ya no pertenecen a este instante
  // (los personalizados nunca se tocan aquí)
  const loaded = state.partitions
    .filter(p => p.type === 'process')
    .map(p => p.pid)
    .filter(pid => !pid.startsWith('C')); // ignorar personalizados

  for (const pid of loaded) {
    if (!wanted.includes(pid)) deallocateProcess(pid);
  }

  // Cargar los procesos predefinidos de este instante
  for (const pid of wanted) {
    const alreadyIn = state.partitions.some(p => p.pid === pid && p.type === 'process');
    if (!alreadyIn) allocateProcess(pid);
  }

  addLog(`━━ T${step + 1} | En RAM: [${wanted.join(', ')}] ━━`, 'info');
  state.simStep++;

  if (state.simStep >= tl.length) {
    addLog('Simulación T1–T6 completada. El próximo clic reinicia desde T1.', 'info');
    state.simStep = 0;
  }

  render();
}


/* ═══════════════════════════════════════════════
   SECCIÓN 11: RENDERIZADO DE LA INTERFAZ
═══════════════════════════════════════════════ */

/** Renderiza todos los componentes de la UI. */
function render() {
  renderMemoryMap();
  renderPartitionTable();
  renderStats();
  renderFragSection();
  renderFreeFragList();
  renderProgramsList();
  renderProcessDetail();
}

/**
 * Renderiza la lista de programas en el panel izquierdo.
 * Muestra primero los predefinidos (del Excel) y luego los personalizados,
 * con un separador visual entre ambos grupos.
 */
function renderProgramsList() {
  const container = document.getElementById('programsList');
  container.innerHTML = '';

  // ── Grupo 1: Programas predefinidos del ejercicio ──
  for (const prog of PROGRAMS) {
    container.appendChild(buildProgCard(prog));
  }

  // ── Separador y grupo 2: Programas personalizados ──
  if (state.customPrograms.length > 0) {
    const sep = document.createElement('div');
    sep.className = 'prog-group-label';
    sep.textContent = 'Personalizados';
    container.appendChild(sep);

    for (const prog of state.customPrograms) {
      container.appendChild(buildProgCard(prog));
    }
  }
}

/**
 * Construye la tarjeta DOM de un programa para la lista del panel izquierdo.
 * @param {Object} prog - Objeto de programa (predefinido o personalizado)
 * @returns {HTMLElement}
 */
function buildProgCard(prog) {
  const inMem    = state.partitions.some(p => p.pid === prog.id && p.type === 'process');
  const selected = state.selectedProg === prog.id;

  const div = document.createElement('div');
  div.className =
    'prog-item' +
    (prog.custom ? ' custom-prog' : '') +
    (selected    ? ' selected'    : '') +
    (inMem       ? ' in-memory'   : '');

  div.onclick = () => {
    state.selectedProg = prog.id;
    renderProgramsList();
    renderProcessDetail();
  };

  // Barra proporcional de segmentos
  const segs  = prog.segments;
  const total = segs.header + segs.code + segs.data + segs.bss + segs.heap + segs.stack;

  div.innerHTML = `
    <div class="prog-name">${prog.id}: ${prog.name}</div>
    <div class="prog-size">${formatKiB(prog.memSize)} KiB en RAM</div>
    <div class="seg-bar">
      <div class="seg-part" style="flex:${segs.header/total*100}; background:#555"    title="HEADER"></div>
      <div class="seg-part" style="flex:${segs.code/total*100};   background:#6c3fc8" title=".text"></div>
      <div class="seg-part" style="flex:${segs.data/total*100};   background:#2060c8" title=".data"></div>
      <div class="seg-part" style="flex:${segs.bss/total*100};    background:#207060" title=".bss"></div>
      <div class="seg-part" style="flex:${segs.heap/total*100};   background:#c86030" title=".heap"></div>
      <div class="seg-part" style="flex:${segs.stack/total*100};  background:#806020" title=".stack"></div>
    </div>
    <span class="prog-badge ${inMem ? 'badge-mem' : prog.custom ? 'badge-custom' : 'badge-disk'}">
      ${inMem ? 'EN RAM' : prog.custom ? 'CUSTOM' : 'EN DISCO'}
    </span>
  `;

  // Botón de eliminar: solo para procesos personalizados no cargados en RAM
  if (prog.custom) {
    const btnRemove = document.createElement('button');
    btnRemove.className = 'btn-remove-custom';
    btnRemove.textContent = '×';
    btnRemove.title = inMem
      ? 'Termina el proceso primero para poder eliminarlo'
      : `Eliminar ${prog.id}`;
    btnRemove.disabled = inMem;
    btnRemove.onclick = (e) => {
      e.stopPropagation(); // no activar la selección del proceso
      removeCustomProcess(prog.id);
    };
    div.appendChild(btnRemove);
  }

  return div;
}

/**
 * Renderiza el panel de detalles del proceso seleccionado.
 * Muestra información de segmentos, tamaños y dirección en RAM.
 */
function renderProcessDetail() {
  const detail = document.getElementById('processDetail');

  if (!state.selectedProg) {
    detail.innerHTML = '<div style="color:var(--text3);font-size:11px;margin-top:8px;">Selecciona un programa.</div>';
    return;
  }

  const prog = findProgram(state.selectedProg);
  if (!prog) return;

  const part = state.partitions.find(p => p.pid === prog.id && p.type === 'process');
  const segs = prog.segments;
  const color = PROC_COLORS[prog.id] || '#aaa';

  detail.innerHTML = `
    <div class="info-box">
      <div>
        <span class="label">ID: </span>
        <span class="value" style="color:${color}">${prog.id} — ${prog.name}</span>
        ${prog.custom ? '<span style="font-size:9px;color:var(--custom);margin-left:6px;">CUSTOM</span>' : ''}
      </div>
      <div><span class="label">En disco: </span>${formatBytes(prog.diskSize)}</div>
      <div><span class="label">En RAM: </span>${formatBytes(prog.memSize)} (${formatKiB(prog.memSize)} KiB)</div>
      ${part
        ? `<div><span class="label">Base: </span><span class="value">${hex(part.base)}</span></div>
           <div><span class="label">Límite: </span><span class="value">${hex(part.base + part.size - 1)}</span></div>`
        : '<div style="color:var(--amber);font-size:11px;margin-top:4px;">No cargado en RAM</div>'
      }
    </div>
    <div class="compact-title" style="margin-top:8px;">Distribución de Segmentos</div>
    <table style="margin-top:6px">
      <thead><tr><th>Segmento</th><th>Bytes</th><th>%</th></tr></thead>
      <tbody>
        ${segRow('HEADER',         segs.header, prog.memSize, '#555')}
        ${segRow('.text (código)', segs.code,   prog.memSize, '#6c3fc8')}
        ${segRow('.data (init.)',  segs.data,   prog.memSize, '#2060c8')}
        ${segRow('.bss (uninit.)', segs.bss,    prog.memSize, '#207060')}
        ${segRow('.heap (mont.)',  segs.heap,   prog.memSize, '#c86030')}
        ${segRow('.stack (pila)',  segs.stack,  prog.memSize, '#806020')}
      </tbody>
    </table>
  `;
}

/**
 * Genera una fila HTML para la tabla de segmentos.
 * @param {string} name  - Nombre del segmento
 * @param {number} size  - Bytes del segmento
 * @param {number} total - Bytes totales del proceso
 * @param {string} color - Color del segmento
 */
function segRow(name, size, total, color) {
  const pct = ((size / total) * 100).toFixed(1);
  return `<tr>
    <td>
      <span style="display:inline-block;width:8px;height:8px;border-radius:2px;
                   background:${color};margin-right:5px;"></span>${name}
    </td>
    <td>${formatBytes(size)}</td>
    <td>${pct}%</td>
  </tr>`;
}

/** Renderiza el mapa visual de memoria (columna de bloques proporcionales). */
function renderMemoryMap() {
  const container = document.getElementById('memMapContainer');
  container.innerHTML = '';

  const mapHeight = 520;

  // Etiquetas de dirección hex (izquierda del mapa)
  const addrLabels = document.createElement('div');
  addrLabels.className = 'addr-labels';
  addrLabels.style.cssText = `height:${mapHeight}px; position:relative;`;

  const keyAddrs = [0, SO_SIZE, RAM / 4, RAM / 2, (3 * RAM) / 4, RAM - 1];
  for (const addr of keyAddrs.sort((a, b) => a - b)) {
    const label = document.createElement('div');
    label.className = 'addr-label';
    label.style.cssText = `position:absolute; bottom:${(addr / RAM) * mapHeight}px; left:0;`;
    label.textContent = hex(addr);
    addrLabels.appendChild(label);
  }

  // Mapa visual (bloques proporcionales, de mayor a menor dirección = top a bottom)
  const map = document.createElement('div');
  map.className  = 'mem-map';
  map.style.height = mapHeight + 'px';

  const sortedDesc = [...state.partitions].sort((a, b) => b.base - a.base);
  for (const part of sortedDesc) {
    const h = Math.max((part.size / RAM) * mapHeight, 8);
    const block = document.createElement('div');
    block.className  = 'mem-block';
    block.style.height     = h + 'px';
    block.style.background = blockColor(part);
    block.style.color      = blockTextColor(part);
    const label = document.createElement('div');
    label.className   = 'mem-block-text';
    label.textContent = blockLabel(part, h);
    block.appendChild(label);
    map.appendChild(block);
  }

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'ptable';

  container.appendChild(addrLabels);
  container.appendChild(map);
  container.appendChild(tableWrapper);
}

/** Color de fondo de un bloque en el mapa de memoria. */
function blockColor(part) {
  if (part.type === 'so')   return '#2a2a42';
  if (part.type === 'free') return '#1a2a1a';
  return PROC_COLORS[part.pid] || '#404040';
}

/** Color del texto dentro de un bloque del mapa. */
function blockTextColor(part) {
  if (part.type === 'free') return '#3a6a3a';
  if (part.type === 'so')   return '#6060a0';
  return '#e0e0ff';
}

/** Etiqueta de texto de un bloque (solo si es suficientemente alto). */
function blockLabel(part, h) {
  if (h < 12)              return '';
  if (part.type === 'free') return h > 18 ? 'FREE' : '';
  if (part.type === 'so')   return 'S.O.';
  return part.pid;
}

/** Renderiza la tabla detallada de todas las particiones. */
function renderPartitionTable() {
  const tbody = document.getElementById('partTableBody');
  tbody.innerHTML = '';

  [...state.partitions].sort((a, b) => a.base - b.base).forEach((part, i) => {
    const intFrag = (part.type === 'process' && part.size > part.allocSize)
      ? part.size - part.allocSize : 0;

    const isCustom = part.pid && part.pid.startsWith('C');
    const tr = document.createElement('tr');
    if (part.type === 'process') tr.className = 'highlight-row';

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="pid-cell ${part.type === 'so' ? 'pid-SO' : ''}"
          style="color:${part.type === 'process' ? (PROC_COLORS[part.pid] || '#aaa') : 'inherit'}">
        ${part.pid || '—'}
        ${isCustom ? '<span style="font-size:8px;color:var(--custom);margin-left:3px;">★</span>' : ''}
      </td>
      <td>
        <span class="status-dot ${
          part.type === 'free' ? 'dot-free' :
          part.type === 'so'   ? 'dot-so'   : 'dot-used'
        }"></span>
        ${part.type === 'free' ? 'Libre' : part.type === 'so' ? 'S.O.' : 'Ocupado'}
      </td>
      <td><code>${hex(part.base)}</code></td>
      <td>${part.base.toLocaleString()}</td>
      <td>${part.size.toLocaleString()}</td>
      <td>${formatKiB(part.size)}</td>
      <td>${intFrag > 0
        ? `<span style="color:var(--amber)">${formatBytes(intFrag)}</span>`
        : (part.type === 'process' ? '<span style="color:var(--green)">0</span>' : '—')}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/** Actualiza los chips de estadísticas (usado / libre). */
function renderStats() {
  const used = state.partitions
    .filter(p => p.type === 'process' || p.type === 'so')
    .reduce((s, p) => s + p.size, 0);
  document.getElementById('statUsed').textContent = `Usado: ${formatKiB(used)} KiB`;
  document.getElementById('statFree').textContent = `Libre: ${formatKiB(RAM - used)} KiB`;
}

/** Renderiza el análisis de fragmentación interna y externa. */
function renderFragSection() {
  document.getElementById('fragSection').style.display = 'block';

  let intFrag = 0;
  for (const p of state.partitions) {
    if (p.type === 'process') intFrag += (p.size - (p.allocSize || p.size));
  }

  const freeBlocks  = state.partitions.filter(p => p.type === 'free');
  const freeTotal   = freeBlocks.reduce((s, p) => s + p.size, 0);
  const largestFree = freeBlocks.reduce((m, p) => Math.max(m, p.size), 0);

  document.getElementById('fragStats').innerHTML = `
    <div class="info-box">
      <div class="label">Frag. Interna Total</div>
      <div class="value">${formatBytes(intFrag)}</div>
      <div class="int-frag-bar">
        <div class="int-frag-fill" style="width:${Math.min(100, (intFrag / RAM) * 100)}%"></div>
      </div>
    </div>
    <div class="info-box">
      <div class="label">Bloques Libres</div>
      <div class="value">${freeBlocks.length}</div>
      <div class="label" style="margin-top:4px;">Mayor bloque libre</div>
      <div class="value">${formatBytes(largestFree)}</div>
    </div>
    <div class="info-box">
      <div class="label">Memoria Libre Total</div>
      <div class="value" style="color:var(--green)">${formatKiB(freeTotal)} KiB</div>
    </div>
    <div class="info-box">
      <div class="label">Procesos en RAM</div>
      <div class="value">${state.partitions.filter(p => p.type === 'process').length}</div>
    </div>
  `;
}

/** Renderiza la lista de bloques libres en el panel derecho. */
function renderFreeFragList() {
  const div = document.getElementById('freeFragList');
  const free = state.partitions.filter(p => p.type === 'free').sort((a, b) => a.base - b.base);

  if (free.length === 0) {
    div.innerHTML = '<span style="color:var(--text3)">Sin bloques libres.</span>';
    return;
  }

  div.innerHTML = free.map((b, i) => `
    <div class="info-box" style="margin-bottom:5px;">
      <div><span class="label">Bloque ${i + 1}: </span>${hex(b.base)} – ${hex(b.base + b.size - 1)}</div>
      <div style="color:var(--green)">${formatBytes(b.size)} (${formatKiB(b.size)} KiB)</div>
    </div>
  `).join('');
}


/* ═══════════════════════════════════════════════
   SECCIÓN 12: FUNCIONES AUXILIARES
═══════════════════════════════════════════════ */

/**
 * Convierte un número a hexadecimal con prefijo 0x y 6 dígitos (24 bits).
 * @param {number} n
 * @returns {string} Ej: 0x100000
 */
function hex(n) {
  return '0x' + n.toString(16).toUpperCase().padStart(6, '0');
}

/**
 * Formatea bytes a la unidad más legible.
 * @param {number} b
 * @returns {string} Ej: "1.50 MiB", "224.5 KiB", "767 B"
 */
function formatBytes(b) {
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(2) + ' MiB';
  if (b >= 1_024)     return (b / 1_024).toFixed(1)     + ' KiB';
  return b + ' B';
}

/**
 * Convierte bytes a KiB con dos decimales.
 * @param {number} b
 * @returns {string}
 */
function formatKiB(b) {
  return (b / 1_024).toFixed(2);
}

/**
 * Nombre legible del algoritmo de asignación activo.
 * @returns {string}
 */
function algName() {
  const a = state.algorithm;
  return a === 'first' ? 'Primer Ajuste'
       : a === 'best'  ? 'Mejor Ajuste'
       :                 'Peor Ajuste';
}

/**
 * Agrega una entrada al log de eventos.
 * Las entradas más recientes aparecen primero.
 * @param {string} msg  - Mensaje
 * @param {string} type - 'ok' | 'err' | 'warn' | 'info'
 */
function addLog(msg, type) {
  const list = document.getElementById('logList');
  const li   = document.createElement('li');
  li.className = 'log-item';

  const t   = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const cls = type === 'ok' ? 'log-ok' : type === 'err' ? 'log-err' : type === 'warn' ? 'log-warn' : 'log-info';

  li.innerHTML = `<span class="log-time">[${t}]</span><span class="${cls}">${msg}</span>`;
  list.insertBefore(li, list.firstChild);

  // Limitar el log a 80 entradas
  if (list.children.length > 80) list.removeChild(list.lastChild);
}


/* ═══════════════════════════════════════════════
   SECCIÓN 13: ATAJOS DE TECLADO
═══════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  // Ctrl+Enter → cargar proceso seleccionado
  if (e.key === 'Enter' && e.ctrlKey) loadSelectedProcess();
  // Delete → liberar proceso seleccionado
  if (e.key === 'Delete') unloadSelectedProcess();
});


/* ═══════════════════════════════════════════════
   SECCIÓN 14: ARRANQUE
═══════════════════════════════════════════════ */
window.onload = () => {
  init();
  addLog('Sistema iniciado. RAM total: 16 MiB (0x000000 – 0xFFFFFF)', 'info');
  addLog('S.O. reserva 1 MiB (pila 64K + montículo 128K + EXE header 767B)', 'info');
  addLog('Usa el formulario del panel derecho para crear procesos personalizados.', 'info');
  render();
};