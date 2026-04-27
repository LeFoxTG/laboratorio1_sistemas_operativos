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
 * Basado en el ejercicio de clase (ejercicio_clase_memoria.xlsx)
 * ═══════════════════════════════════════════════════════════════
 */


/* ═══════════════════════════════════════════════
   SECCIÓN 1: CONSTANTES DEL SISTEMA
   Valores fijos que representan el hardware simulado
═══════════════════════════════════════════════ */

/** Tamaño total de RAM: 16 MiB = 16,777,216 bytes */
const RAM = 16 * 1024 * 1024;

/**
 * Espacio reservado para el Sistema Operativo: 1 MiB
 * Composición (del ejercicio de clase):
 *   - Pila del SO:     64 KiB (65,536 bytes)
 *   - Montículo del SO: 128 KiB (131,072 bytes)
 *   - EXE Header:      767 bytes
 *   - Resto reservado: hasta completar 1 MiB
 */
const SO_SIZE = 1_048_576; // 1 MiB

/**
 * Mapa de colores por ID de proceso para el mapa visual de RAM.
 * Cada proceso tiene un color distintivo para identificación rápida.
 */
const PROC_COLORS = {
  SO: '#4a4a6a',  // Sistema Operativo — gris azulado oscuro
  P1: '#6c3fc8',  // Notepad          — morado
  P2: '#2060c8',  // Word              — azul
  P3: '#207060',  // Excel             — verde oscuro
  P4: '#c86030',  // AutoCAD           — naranja
  P5: '#806020',  // Calculadora       — marrón dorado
  P6: '#c03060',  // p1 Grande         — rojo rosado
  P7: '#208060',  // p2 Mediano        — verde teal
  P8: '#604080',  // p3 Grande         — violeta
};


/* ═══════════════════════════════════════════════
   SECCIÓN 2: DATOS DE LOS PROGRAMAS SIMULADOS
   Extraídos directamente del archivo Excel de clase.
   Cada programa tiene sus tamaños de segmentos reales.

   Fórmula del tamaño en RAM (memSize):
     header(767) + código + datos_init + bss + heap(128K) + pila(64K)
═══════════════════════════════════════════════ */
const PROGRAMS = [
  {
    id: 'P1', name: 'Notepad',
    diskSize:   33_808,     // tamaño en disco (bytes)
    code:       19_524,     // segmento .text  (código ejecutable)
    dataInit:   12_352,     // segmento .data  (datos inicializados)
    dataBss:     1_165,     // segmento .bss   (datos sin inicializar)
    memInitial: 33_041,     // memoria mínima al arrancar
    memSize:   224_649,     // TAMAÑO TOTAL en RAM como proceso
    segments: {
      header:  767,         // cabecera EXE
      code:    19_524,
      data:    12_352,
      bss:      1_165,
      heap:   131_072,      // montículo = 128 KiB
      stack:   65_536,      // pila      = 64 KiB
    }
  },
  {
    id: 'P2', name: 'Word',
    diskSize:   115_086,
    code:        77_539,
    dataInit:    32_680,
    dataBss:      4_100,
    memInitial: 114_319,
    memSize:    286_708,
    segments: { header: 767, code: 77_539, data: 32_680, bss: 4_100, heap: 131_072, stack: 65_536 }
  },
  {
    id: 'P3', name: 'Excel',
    diskSize:   132_111,
    code:        99_542,
    dataInit:    24_245,
    dataBss:      7_557,
    memInitial: 131_344,
    memSize:    309_150,
    segments: { header: 767, code: 99_542, data: 24_245, bss: 7_557, heap: 131_072, stack: 65_536 }
  },
  {
    id: 'P4', name: 'AutoCAD',
    diskSize:   240_360,
    code:       115_000,
    dataInit:   123_470,
    dataBss:      1_123,
    memInitial: 239_593,
    memSize:    436_201,
    segments: { header: 767, code: 115_000, data: 123_470, bss: 1_123, heap: 131_072, stack: 65_536 }
  },
  {
    id: 'P5', name: 'Calculadora',
    diskSize:    16_121,
    code:        12_342,
    dataInit:     1_256,
    dataBss:      1_756,
    memInitial:  15_354,
    memSize:    209_462,
    segments: { header: 767, code: 12_342, data: 1_256, bss: 1_756, heap: 131_072, stack: 65_536 }
  },
  {
    id: 'P6', name: 'p1 (Grande)',
    diskSize:  3_800_767,
    code:        525_000,
    dataInit:  3_224_000,
    dataBss:      51_000,
    memInitial: 3_800_000,
    memSize:   3_996_608,
    segments: { header: 767, code: 525_000, data: 3_224_000, bss: 51_000, heap: 131_072, stack: 65_536 }
  },
  {
    id: 'P7', name: 'p2 (Mediano)',
    diskSize:  1_589_767,
    code:        590_000,
    dataInit:    974_000,
    dataBss:      25_000,
    memInitial: 1_589_000,
    memSize:   1_785_608,
    segments: { header: 767, code: 590_000, data: 974_000, bss: 25_000, heap: 131_072, stack: 65_536 }
  },
  {
    id: 'P8', name: 'p3 (Grande)',
    diskSize:  2_500_767,
    code:        349_000,
    dataInit:  2_150_000,
    dataBss:       1_000,
    memInitial: 2_500_000,
    memSize:   2_696_608,
    segments: { header: 767, code: 349_000, data: 2_150_000, bss: 1_000, heap: 131_072, stack: 65_536 }
  },
];


/* ═══════════════════════════════════════════════
   SECCIÓN 3: ESTADO GLOBAL DE LA SIMULACIÓN
   Objeto central que guarda toda la información
   de la simulación en cada momento.
═══════════════════════════════════════════════ */

/**
 * Estado global del simulador.
 *
 * partitions: Array de objetos de partición con la forma:
 *   {
 *     id:        identificador único,
 *     pid:       'SO' | 'P1'…'P8' | null,
 *     type:      'so' | 'process' | 'free',
 *     base:      dirección de inicio (bytes),
 *     size:      tamaño de la partición (bytes),
 *     allocSize: bytes realmente usados por el proceso (≤ size)
 *   }
 */
const state = {
  method:      'fixed',    // método de gestión activo
  algorithm:   'first',    // algoritmo de asignación (first|best|worst)
  partSize:    1_048_576,  // tamaño de partición fija (solo modo fixed)
  partitions:  [],         // lista de particiones en RAM
  selectedProg: null,      // ID del programa seleccionado en la UI
  simStep:     0,          // paso actual en la simulación automática T1–T6
};


/* ═══════════════════════════════════════════════
   SECCIÓN 4: LÍNEA DE TIEMPO DE SIMULACIÓN
   Replica los instantes T1–T6 del ejercicio Excel
   para cada método de gestión.
   Cada entrada es el conjunto de procesos que
   deben estar en RAM en ese momento.
═══════════════════════════════════════════════ */
const SIM_TIMELINE = {
  fixed: [
    ['P4'],               // T1: solo AutoCAD
    ['P3', 'P4'],         // T2: Excel + AutoCAD
    ['P5', 'P4'],         // T3: Calculadora + AutoCAD
    ['P2', 'P5'],         // T4: Word + Calculadora
    ['P1', 'P3'],         // T5: Notepad + Excel
    ['P2'],               // T6: solo Word
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

/**
 * Punto de entrada de la aplicación.
 * Se invoca desde window.onload en el HTML.
 */
function init() {
  renderProgramsList();
  onMethodChange(); // aplica el método por defecto y renderiza
}

/**
 * Manejador del selector de método de gestión.
 * Actualiza el estado, muestra/oculta controles relevantes
 * y reinicia la memoria con la nueva configuración.
 */
function onMethodChange() {
  const m = document.getElementById('methodSelect').value;
  state.method = m;
  state.algorithm = document.getElementById('algorithmSelect').value;

  // Determinar visibilidad de controles según el método
  const isDynamic  = (m === 'dynamic' || m === 'dynamic_compact');
  const isVariable = (m === 'variable');
  const isFixed    = (m === 'fixed');

  // El selector de algoritmo aplica a variables y dinámicas
  document.getElementById('algorithmRow').style.display =
    (isDynamic || isVariable) ? 'block' : 'none';

  // El selector de tamaño de partición fija solo aplica en modo fijo
  document.getElementById('fixedPartRow').style.display =
    isFixed ? 'block' : 'none';

  // El botón de compactar solo existe en modo dinámico con compactación
  document.getElementById('compactBtnWrap').style.display =
    (m === 'dynamic_compact') ? 'block' : 'none';

  // Actualizar el título del mapa de memoria
  const titles = {
    fixed:           'Mapa de Memoria — Particiones Estáticas Fijas',
    variable:        'Mapa de Memoria — Particiones Estáticas Variables',
    dynamic:         'Mapa de Memoria — Particiones Dinámicas (Sin Compactación)',
    dynamic_compact: 'Mapa de Memoria — Particiones Dinámicas (Con Compactación)',
  };
  document.getElementById('mapTitle').textContent = titles[m];

  // Reiniciar la simulación con el nuevo método
  state.simStep = 0;
  resetMemory(true);
}

/**
 * Manejador del selector de algoritmo.
 * Solo actualiza el estado; la próxima asignación usará el nuevo algoritmo.
 */
function onAlgorithmChange() {
  state.algorithm = document.getElementById('algorithmSelect').value;
  addLog(`Algoritmo cambiado a: ${algName()}`, 'info');
}

/**
 * Reinicia la memoria al estado inicial del método activo.
 * @param {boolean} silent - Si es true, no agrega entrada al log.
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
   Configura la estructura inicial de RAM según
   el método de gestión seleccionado.
═══════════════════════════════════════════════ */

/**
 * Crea la distribución inicial de particiones en RAM
 * según el método de gestión activo.
 */
function initPartitions() {
  const m = state.method;
  state.partitions = [];

  if (m === 'fixed') {
    initFixedPartitions();
  } else if (m === 'variable') {
    initVariablePartitions();
  } else {
    // Dinámicas (con o sin compactación): inicio idéntico
    initDynamicPartitions();
  }
}

/**
 * Particiones ESTÁTICAS DE TAMAÑO FIJO.
 * Divide toda la RAM en N bloques iguales del tamaño seleccionado.
 * El primer bloque siempre es del Sistema Operativo.
 * Los bloques donde el proceso no llena la partición
 * generan FRAGMENTACIÓN INTERNA.
 */
function initFixedPartitions() {
  const sz = parseInt(document.getElementById('partSizeSelect')?.value || '1048576');
  state.partSize = sz;

  let addr = 0;
  let id   = 0;

  while (addr < RAM) {
    const partSz = Math.min(sz, RAM - addr); // última partición puede ser menor
    state.partitions.push({
      id:        id++,
      pid:       addr === 0 ? 'SO' : null,
      type:      addr === 0 ? 'so' : 'free',
      base:      addr,
      size:      partSz,
      allocSize: addr === 0 ? partSz : 0,
    });
    addr += partSz;
  }
}

/**
 * Particiones ESTÁTICAS DE TAMAÑO VARIABLE.
 * Distribución tomada directamente del ejercicio Excel:
 *   - 1 partición de 1 MiB para el SO
 *   - 2 particiones de 512 KiB
 *   - 2 particiones de 1 MiB
 *   - 2 particiones de 2 MiB
 *   - 2 particiones de 4 MiB
 * Total: 16 MiB exactos.
 *
 * El tamaño de cada partición es FIJO una vez definido,
 * pero los procesos se asignan según el algoritmo elegido
 * (Primer Ajuste, Mejor Ajuste, Peor Ajuste).
 */
function initVariablePartitions() {
  const layout = [
    { size: 1_048_576, type: 'so',   pid: 'SO' },  // 1 MiB — Sistema Operativo
    { size:   524_288, type: 'free', pid: null  },  // 512 KiB
    { size:   524_288, type: 'free', pid: null  },  // 512 KiB
    { size: 1_048_576, type: 'free', pid: null  },  // 1 MiB
    { size: 1_048_576, type: 'free', pid: null  },  // 1 MiB
    { size: 2_097_152, type: 'free', pid: null  },  // 2 MiB
    { size: 2_097_152, type: 'free', pid: null  },  // 2 MiB
    { size: 4_194_304, type: 'free', pid: null  },  // 4 MiB
    { size: 4_194_304, type: 'free', pid: null  },  // 4 MiB
  ];

  let addr = 0;
  layout.forEach((p, i) => {
    state.partitions.push({
      id:        i,
      pid:       p.pid,
      type:      p.type,
      base:      addr,
      size:      p.size,
      allocSize: p.type === 'so' ? p.size : 0,
    });
    addr += p.size;
  });
}

/**
 * Particiones DINÁMICAS (sin o con compactación).
 * Al inicio solo existe el bloque del SO y un gran bloque libre.
 * Los bloques se crean y destruyen dinámicamente según los
 * procesos que se cargan y liberan.
 */
function initDynamicPartitions() {
  state.partitions = [
    {
      id: 0, pid: 'SO', type: 'so',
      base: 0, size: SO_SIZE, allocSize: SO_SIZE,
    },
    {
      id: 1, pid: null, type: 'free',
      base: SO_SIZE, size: RAM - SO_SIZE, allocSize: 0,
    },
  ];
}


/* ═══════════════════════════════════════════════
   SECCIÓN 7: ALGORITMOS DE ASIGNACIÓN
   Implementación de los tres algoritmos clásicos:
   Primer Ajuste, Mejor Ajuste y Peor Ajuste.
═══════════════════════════════════════════════ */

/**
 * Selecciona una partición libre usando el algoritmo de asignación activo.
 *
 * @param {Array}  freeList - Lista de particiones libres candidatas
 * @param {number} reqSize  - Tamaño requerido en bytes
 * @returns {Object|null} La partición elegida o null si no hay candidatos
 */
function selectPartition(freeList, reqSize) {
  // Filtrar solo las que tienen espacio suficiente
  const candidates = freeList.filter(p => p.size >= reqSize);

  if (candidates.length === 0) return null;

  const alg = state.algorithm;

  if (alg === 'first') {
    /**
     * PRIMER AJUSTE (First Fit):
     * Elige la PRIMERA partición libre suficientemente grande
     * recorriendo desde la dirección más baja.
     * Ventaja: rápido. Desventaja: puede fragmentar el inicio de la RAM.
     */
    return candidates.sort((a, b) => a.base - b.base)[0];
  }

  if (alg === 'best') {
    /**
     * MEJOR AJUSTE (Best Fit):
     * Elige la partición libre cuyo tamaño es el MÁS CERCANO
     * (por arriba) al tamaño requerido.
     * Ventaja: minimiza el desperdicio por partición.
     * Desventaja: deja muchos fragmentos pequeños inutilizables.
     */
    return candidates.sort((a, b) => (a.size - reqSize) - (b.size - reqSize))[0];
  }

  if (alg === 'worst') {
    /**
     * PEOR AJUSTE (Worst Fit):
     * Elige la partición libre MÁS GRANDE disponible.
     * Ventaja: el sobrante libre es más grande y potencialmente útil.
     * Desventaja: fragmenta los bloques grandes.
     */
    return candidates.sort((a, b) => (b.size - reqSize) - (a.size - reqSize))[0];
  }

  return null;
}


/* ═══════════════════════════════════════════════
   SECCIÓN 8: CARGA Y LIBERACIÓN DE PROCESOS
═══════════════════════════════════════════════ */

/**
 * Busca un programa en la lista por su ID.
 * @param {string} pid - Identificador del proceso (P1…P8)
 * @returns {Object|undefined}
 */
function findProgram(pid) {
  return PROGRAMS.find(p => p.id === pid);
}

/**
 * Intenta cargar un proceso en RAM según el método activo.
 * Aplica el algoritmo de asignación correspondiente.
 *
 * @param {string} pid - ID del proceso a cargar
 * @returns {boolean} true si la carga fue exitosa
 */
function allocateProcess(pid) {
  const prog = findProgram(pid);
  if (!prog) return false;

  // Verificar que el proceso no esté ya en memoria
  const already = state.partitions.find(p => p.pid === pid);
  if (already) {
    addLog(`${pid} (${prog.name}) ya está en memoria.`, 'warn');
    return false;
  }

  const m = state.method;

  /* ── Modo: Estáticas Fijas ── */
  if (m === 'fixed') {
    // En fijo no se usa algoritmo; se busca la primera libre que quepa
    const freeList = state.partitions.filter(p => p.type === 'free');

    if (freeList.length === 0) {
      addLog(`No hay particiones libres para ${pid} (${prog.name}).`, 'err');
      return false;
    }

    // La partición fija debe ser ≥ tamaño del proceso
    const fit = freeList.sort((a, b) => a.base - b.base).find(p => p.size >= prog.memSize);

    if (!fit) {
      addLog(
        `${pid} (${formatBytes(prog.memSize)}) no cabe en ninguna partición ` +
        `(tamaño fijo: ${formatBytes(state.partSize)}).`, 'err'
      );
      return false;
    }

    // Asignar la partición al proceso
    fit.type      = 'process';
    fit.pid       = pid;
    fit.allocSize = prog.memSize;

    const intFrag = fit.size - prog.memSize;
    addLog(
      `[FIJO] ${pid} (${prog.name}) → @${hex(fit.base)} | ` +
      `frag. interna: ${formatBytes(intFrag)}`, 'ok'
    );
    return true;
  }

  /* ── Modo: Estáticas Variables ── */
  if (m === 'variable') {
    const freeList = state.partitions.filter(p => p.type === 'free');
    const chosen   = selectPartition(freeList, prog.memSize);

    if (!chosen) {
      addLog(
        `[VAR] Sin partición disponible para ${pid} (${formatBytes(prog.memSize)}) ` +
        `con algoritmo "${algName()}".`, 'err'
      );
      return false;
    }

    chosen.type      = 'process';
    chosen.pid       = pid;
    chosen.allocSize = prog.memSize;

    const intFrag = chosen.size - prog.memSize;
    addLog(
      `[VAR / ${algName()}] ${pid} (${prog.name}) → @${hex(chosen.base)} ` +
      `(partición: ${formatBytes(chosen.size)}) | frag. interna: ${formatBytes(intFrag)}`, 'ok'
    );
    return true;
  }

  /* ── Modo: Dinámicas (sin o con compactación) ── */
  if (m === 'dynamic' || m === 'dynamic_compact') {
    const freeList = state.partitions.filter(p => p.type === 'free');
    const chosen   = selectPartition(freeList, prog.memSize);

    if (!chosen) {
      addLog(
        `[DIN] Sin bloque contiguo para ${pid} (${formatBytes(prog.memSize)}). ` +
        `Prueba compactar memoria.`, 'err'
      );
      return false;
    }

    const origBase = chosen.base;
    const remaining = chosen.size - prog.memSize;

    // El bloque elegido se convierte exactamente al tamaño del proceso
    chosen.type      = 'process';
    chosen.pid       = pid;
    chosen.size      = prog.memSize;
    chosen.allocSize = prog.memSize;

    // Si sobra espacio, se inserta un nuevo bloque libre justo después
    if (remaining > 0) {
      const newFree = {
        id:        Date.now() + Math.random(),
        pid:       null,
        type:      'free',
        base:      origBase + prog.memSize,
        size:      remaining,
        allocSize: 0,
      };
      const idx = state.partitions.indexOf(chosen);
      state.partitions.splice(idx + 1, 0, newFree);
    }

    addLog(
      `[DIN / ${algName()}] ${pid} (${prog.name}) → @${hex(origBase)} | ` +
      `tamaño exacto ${formatBytes(prog.memSize)}`, 'ok'
    );
    return true;
  }

  return false;
}

/**
 * Libera la partición ocupada por un proceso y la marca como libre.
 * En modo dinámico también fusiona bloques libres adyacentes (coalescing).
 *
 * @param {string} pid - ID del proceso a liberar
 * @returns {boolean} true si la liberación fue exitosa
 */
function deallocateProcess(pid) {
  const part = state.partitions.find(p => p.pid === pid && p.type === 'process');

  if (!part) {
    addLog(`${pid} no está cargado en memoria.`, 'warn');
    return false;
  }

  const prog = findProgram(pid);
  const m    = state.method;

  if (m === 'fixed' || m === 'variable') {
    // En estáticas: simplemente marcar la partición como libre
    // El tamaño de la partición no cambia
    part.type      = 'free';
    part.pid       = null;
    part.allocSize = 0;

    addLog(
      `${pid} (${prog?.name}) liberado. Partición @${hex(part.base)} marcada libre.`, 'ok'
    );
  } else {
    // En dinámicas: liberar y fusionar bloques adyacentes
    part.type      = 'free';
    part.pid       = null;
    part.allocSize = 0;

    coalesceMemory(); // unir bloques libres contiguos

    addLog(
      `${pid} (${prog?.name}) liberado. Bloques libres adyacentes fusionados.`, 'ok'
    );
  }

  return true;
}

/**
 * FUSIÓN DE BLOQUES LIBRES (Coalescing).
 * Recorre la lista de particiones ordenada por dirección base
 * y une bloques libres contiguos en uno solo.
 * Esto reduce la fragmentación externa en particiones dinámicas.
 */
function coalesceMemory() {
  // Ordenar particiones por dirección de inicio
  state.partitions.sort((a, b) => a.base - b.base);

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < state.partitions.length - 1; i++) {
      const a = state.partitions[i];
      const b = state.partitions[i + 1];

      // Si dos bloques consecutivos están libres → fusionarlos
      if (a.type === 'free' && b.type === 'free') {
        a.size += b.size;          // el bloque A absorbe al B
        state.partitions.splice(i + 1, 1); // eliminar bloque B
        changed = true;
        break; // reiniciar el recorrido después de una fusión
      }
    }
  }
}

/**
 * COMPACTACIÓN DE MEMORIA.
 * Solo disponible en modo dinámico con compactación.
 * Mueve todos los procesos hacia el inicio de RAM (después del SO),
 * consolidando todo el espacio libre en un único bloque al final.
 *
 * Efecto: elimina la fragmentación externa por completo.
 * Costo real (simulado): relocalización de todos los procesos activos.
 */
function doCompact() {
  if (state.method !== 'dynamic_compact') return;

  // Ordenar particiones por dirección base
  state.partitions.sort((a, b) => a.base - b.base);

  // Calcular total de espacio libre antes de compactar
  const freeTotal = state.partitions
    .filter(p => p.type === 'free')
    .reduce((sum, p) => sum + p.size, 0);

  // Obtener el bloque del SO y los procesos activos
  const soPart = state.partitions.find(p => p.type === 'so');
  const procs  = state.partitions.filter(p => p.type === 'process');

  // Rearmar la lista: SO primero, luego todos los procesos compactados
  let writePtr = SO_SIZE; // escribir desde el fin del SO
  const newParts = [soPart];

  for (const pr of procs) {
    pr.base = writePtr; // reubicar el proceso
    writePtr += pr.size;
    newParts.push(pr);
  }

  // Agregar el único bloque libre al final (si existe)
  if (freeTotal > 0) {
    newParts.push({
      id:        Date.now(),
      pid:       null,
      type:      'free',
      base:      writePtr,
      size:      freeTotal,
      allocSize: 0,
    });
  }

  state.partitions = newParts;
  addLog(
    `[COMPACTACIÓN] Procesos reubicados. Bloque libre contiguo resultante: ${formatBytes(freeTotal)}`,
    'info'
  );
  render();
}


/* ═══════════════════════════════════════════════
   SECCIÓN 9: ACCIONES DE LA INTERFAZ DE USUARIO
═══════════════════════════════════════════════ */

/**
 * Carga en RAM el proceso actualmente seleccionado en la lista.
 */
function loadSelectedProcess() {
  if (!state.selectedProg) {
    addLog('Selecciona un programa de la lista antes de cargarlo.', 'warn');
    return;
  }
  // Leer el algoritmo actual del selector antes de asignar
  state.algorithm = document.getElementById('algorithmSelect').value;

  if (allocateProcess(state.selectedProg)) {
    render();
  }
}

/**
 * Libera de RAM el proceso actualmente seleccionado en la lista.
 */
function unloadSelectedProcess() {
  if (!state.selectedProg) {
    addLog('Selecciona un proceso para terminarlo.', 'warn');
    return;
  }
  if (deallocateProcess(state.selectedProg)) {
    render();
  }
}

/**
 * Ejecuta la simulación automática paso a paso (T1 → T6).
 * En cada llamada avanza un instante de tiempo:
 *   1. Libera los procesos que ya no deben estar en RAM.
 *   2. Carga los procesos que deben estar en RAM en este instante.
 * Al llegar a T6, el siguiente llamado reinicia desde T1.
 */
function runAutoSimulation() {
  state.algorithm = document.getElementById('algorithmSelect').value;
  const tl   = SIM_TIMELINE[state.method];
  if (!tl) return;

  const step   = state.simStep % tl.length;
  const wanted = tl[step]; // procesos deseados en este instante

  // Descargar procesos que ya no pertenecen a este instante
  const loaded = state.partitions
    .filter(p => p.type === 'process')
    .map(p => p.pid);

  for (const pid of loaded) {
    if (!wanted.includes(pid)) deallocateProcess(pid);
  }

  // Cargar los procesos que faltan en este instante
  for (const pid of wanted) {
    const alreadyIn = state.partitions.some(p => p.pid === pid && p.type === 'process');
    if (!alreadyIn) allocateProcess(pid);
  }

  addLog(`━━ T${step + 1} completado | En RAM: [${wanted.join(', ')}] ━━`, 'info');
  state.simStep++;

  if (state.simStep >= tl.length) {
    addLog('Simulación T1–T6 completada. El próximo clic reinicia desde T1.', 'info');
    state.simStep = 0;
  }

  render();
}


/* ═══════════════════════════════════════════════
   SECCIÓN 10: RENDERIZADO DE LA INTERFAZ
   Funciones que actualizan el DOM para reflejar
   el estado actual de la simulación.
═══════════════════════════════════════════════ */

/**
 * Renderiza todos los componentes de la UI.
 * Se llama después de cualquier cambio de estado.
 */
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
 * Renderiza la lista de programas disponibles en el panel izquierdo.
 * Muestra el nombre, tamaño, barra de segmentos y estado (RAM/DISCO).
 */
function renderProgramsList() {
  const container = document.getElementById('programsList');
  container.innerHTML = '';

  for (const prog of PROGRAMS) {
    // Verificar si el programa está actualmente cargado en RAM
    const inMem   = state.partitions.some(p => p.pid === prog.id && p.type === 'process');
    const selected = state.selectedProg === prog.id;

    const div = document.createElement('div');
    div.className =
      'prog-item' +
      (selected ? ' selected'  : '') +
      (inMem    ? ' in-memory' : '');

    // Al hacer clic, seleccionar el programa y actualizar detalles
    div.onclick = () => {
      state.selectedProg = prog.id;
      renderProgramsList();
      renderProcessDetail();
    };

    // Calcular porcentajes de cada segmento para la barra visual
    const segs  = prog.segments;
    const total = segs.header + segs.code + segs.data + segs.bss + segs.heap + segs.stack;
    const pcts  = {
      header: (segs.header / total) * 100,
      code:   (segs.code   / total) * 100,
      data:   (segs.data   / total) * 100,
      bss:    (segs.bss    / total) * 100,
      heap:   (segs.heap   / total) * 100,
      stack:  (segs.stack  / total) * 100,
    };

    div.innerHTML = `
      <div class="prog-name">${prog.id}: ${prog.name}</div>
      <div class="prog-size">${formatKiB(prog.memSize)} KiB en RAM</div>
      <div class="seg-bar">
        <div class="seg-part" style="flex:${pcts.header}; background:#555"       title="HEADER"></div>
        <div class="seg-part" style="flex:${pcts.code};   background:#6c3fc8"    title=".text"></div>
        <div class="seg-part" style="flex:${pcts.data};   background:#2060c8"    title=".data"></div>
        <div class="seg-part" style="flex:${pcts.bss};    background:#207060"    title=".bss"></div>
        <div class="seg-part" style="flex:${pcts.heap};   background:#c86030"    title=".heap"></div>
        <div class="seg-part" style="flex:${pcts.stack};  background:#806020"    title=".stack"></div>
      </div>
      <span class="prog-badge ${inMem ? 'badge-mem' : 'badge-disk'}">
        ${inMem ? 'EN RAM' : 'EN DISCO'}
      </span>
    `;

    container.appendChild(div);
  }
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

  // Buscar la partición donde está cargado (si aplica)
  const part = state.partitions.find(p => p.pid === prog.id && p.type === 'process');
  const segs = prog.segments;

  detail.innerHTML = `
    <div class="info-box">
      <div><span class="label">ID: </span>
        <span class="value" style="color:${PROC_COLORS[prog.id] || '#aaa'}">${prog.id} — ${prog.name}</span>
      </div>
      <div><span class="label">En disco: </span>${formatBytes(prog.diskSize)}</div>
      <div><span class="label">En RAM: </span>${formatBytes(prog.memSize)} (${formatKiB(prog.memSize)} KiB)</div>
      ${part
        ? `<div><span class="label">Base: </span>
             <span class="value">${hex(part.base)}</span></div>
           <div><span class="label">Límite: </span>
             <span class="value">${hex(part.base + part.size - 1)}</span></div>`
        : '<div style="color:var(--amber);font-size:11px;margin-top:4px;">No cargado en RAM</div>'
      }
    </div>
    <div class="compact-title" style="margin-top:8px;">Distribución de Segmentos</div>
    <table style="margin-top:6px">
      <thead><tr><th>Segmento</th><th>Bytes</th><th>%</th></tr></thead>
      <tbody>
        ${segRow('HEADER (EXE)',    segs.header, prog.memSize, '#555')}
        ${segRow('.text (código)',  segs.code,   prog.memSize, '#6c3fc8')}
        ${segRow('.data (init.)',   segs.data,   prog.memSize, '#2060c8')}
        ${segRow('.bss (uninit.)',  segs.bss,    prog.memSize, '#207060')}
        ${segRow('.heap (mont.)',   segs.heap,   prog.memSize, '#c86030')}
        ${segRow('.stack (pila)',   segs.stack,  prog.memSize, '#806020')}
      </tbody>
    </table>
  `;
}

/**
 * Genera una fila HTML para la tabla de segmentos del proceso.
 * @param {string} name   - Nombre del segmento
 * @param {number} size   - Tamaño en bytes
 * @param {number} total  - Tamaño total del proceso en bytes
 * @param {string} color  - Color hexadecimal del segmento
 * @returns {string} HTML de la fila <tr>
 */
function segRow(name, size, total, color) {
  const pct = ((size / total) * 100).toFixed(1);
  return `<tr>
    <td>
      <span style="display:inline-block;width:8px;height:8px;border-radius:2px;
                   background:${color};margin-right:5px;"></span>
      ${name}
    </td>
    <td>${formatBytes(size)}</td>
    <td>${pct}%</td>
  </tr>`;
}

/**
 * Renderiza el mapa visual de memoria (columna central).
 * Construye la representación proporcional de las 16 MiB de RAM.
 */
function renderMemoryMap() {
  const container = document.getElementById('memMapContainer');
  container.innerHTML = '';

  const mapHeight = 520; // altura total del mapa en px

  /* ── Columna de etiquetas de dirección (izquierda) ── */
  const addrLabels = document.createElement('div');
  addrLabels.className = 'addr-labels';
  addrLabels.style.cssText = `height:${mapHeight}px; position:relative;`;

  // Direcciones clave que se muestran como referencia
  const keyAddrs = [0, SO_SIZE, RAM / 4, RAM / 2, (3 * RAM) / 4, RAM - 1];
  for (const addr of keyAddrs.sort((a, b) => a - b)) {
    const ratio = addr / RAM;
    const label = document.createElement('div');
    label.className = 'addr-label';
    label.style.cssText = `position:absolute; bottom:${ratio * mapHeight}px; left:0;`;
    label.textContent = hex(addr);
    addrLabels.appendChild(label);
  }

  /* ── Columna del mapa visual (centro) ── */
  const map = document.createElement('div');
  map.className = 'mem-map';
  map.style.height = mapHeight + 'px';

  // Ordenar particiones de mayor a menor dirección (el mapa crece de abajo hacia arriba)
  const sortedDesc = [...state.partitions].sort((a, b) => b.base - a.base);

  for (const part of sortedDesc) {
    const ratio   = part.size / RAM;
    const h       = Math.max(ratio * mapHeight, 8); // mínimo 8px para visibilidad

    const block = document.createElement('div');
    block.className  = 'mem-block';
    block.style.height     = h + 'px';
    block.style.background = blockColor(part);
    block.style.color      = blockTextColor(part);

    const label = document.createElement('div');
    label.className = 'mem-block-text';
    label.textContent = blockLabel(part, h);
    block.appendChild(label);
    map.appendChild(block);
  }

  /* ── Tabla de particiones (derecha) ── */
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'ptable';

  container.appendChild(addrLabels);
  container.appendChild(map);
  container.appendChild(tableWrapper);
}

/** Devuelve el color de fondo para un bloque del mapa de memoria. */
function blockColor(part) {
  if (part.type === 'so')    return '#2a2a42'; // SO — azul oscuro
  if (part.type === 'free')  return '#1a2a1a'; // libre — verde muy oscuro
  return PROC_COLORS[part.pid] || '#404040';   // proceso — color asignado
}

/** Devuelve el color del texto dentro del bloque de memoria. */
function blockTextColor(part) {
  if (part.type === 'free') return '#3a6a3a';
  if (part.type === 'so')   return '#6060a0';
  return '#e0e0ff';
}

/**
 * Devuelve la etiqueta de texto para un bloque del mapa.
 * Solo muestra texto si el bloque es suficientemente alto.
 */
function blockLabel(part, height) {
  if (height < 12) return '';
  if (part.type === 'free') return height > 18 ? 'FREE' : '';
  if (part.type === 'so')   return 'S.O.';
  return part.pid;
}

/**
 * Renderiza la tabla detallada de todas las particiones.
 * Muestra base, límite, tamaño y fragmentación interna.
 */
function renderPartitionTable() {
  const tbody  = document.getElementById('partTableBody');
  tbody.innerHTML = '';

  const sorted = [...state.partitions].sort((a, b) => a.base - b.base);

  sorted.forEach((part, i) => {
    // Fragmentación interna = tamaño partición − tamaño real del proceso
    const intFrag = (part.type === 'process' && part.size > part.allocSize)
      ? part.size - part.allocSize
      : 0;

    const tr = document.createElement('tr');
    if (part.type === 'process') tr.className = 'highlight-row';

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="pid-cell ${part.type === 'so' ? 'pid-SO' : ''}"
          style="color:${part.type === 'process' ? (PROC_COLORS[part.pid] || '#aaa') : 'inherit'}">
        ${part.pid || '—'}
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
      <td>
        ${intFrag > 0
          ? `<span style="color:var(--amber)">${formatBytes(intFrag)}</span>`
          : (part.type === 'process'
              ? '<span style="color:var(--green)">0</span>'
              : '—')}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Actualiza los chips de estadísticas (bytes usados / bytes libres).
 */
function renderStats() {
  const usedBytes = state.partitions
    .filter(p => p.type === 'process' || p.type === 'so')
    .reduce((s, p) => s + p.size, 0);

  document.getElementById('statUsed').textContent = `Usado: ${formatKiB(usedBytes)} KiB`;
  document.getElementById('statFree').textContent = `Libre: ${formatKiB(RAM - usedBytes)} KiB`;
}

/**
 * Renderiza el panel de análisis de fragmentación interna y externa.
 */
function renderFragSection() {
  document.getElementById('fragSection').style.display = 'block';

  // Fragmentación interna: suma de (tamaño_partición - tamaño_proceso) por cada proceso cargado
  let intFrag = 0;
  for (const p of state.partitions) {
    if (p.type === 'process') {
      intFrag += (p.size - (p.allocSize || p.size));
    }
  }

  // Fragmentación externa: bloques libres dispersos
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
      <div class="value">
        ${state.partitions.filter(p => p.type === 'process').length}
      </div>
    </div>
  `;
}

/**
 * Renderiza la lista de bloques libres en el panel derecho.
 * Muestra dirección de inicio, fin y tamaño de cada fragmento libre.
 */
function renderFreeFragList() {
  const div        = document.getElementById('freeFragList');
  const freeBlocks = state.partitions
    .filter(p => p.type === 'free')
    .sort((a, b) => a.base - b.base);

  if (freeBlocks.length === 0) {
    div.innerHTML = '<span style="color:var(--text3)">Sin bloques libres.</span>';
    return;
  }

  div.innerHTML = freeBlocks.map((b, i) => `
    <div class="info-box" style="margin-bottom:5px;">
      <div>
        <span class="label">Bloque ${i + 1}: </span>
        ${hex(b.base)} – ${hex(b.base + b.size - 1)}
      </div>
      <div style="color:var(--green)">${formatBytes(b.size)} (${formatKiB(b.size)} KiB)</div>
    </div>
  `).join('');
}


/* ═══════════════════════════════════════════════
   SECCIÓN 11: FUNCIONES AUXILIARES (HELPERS)
═══════════════════════════════════════════════ */

/**
 * Convierte un número a representación hexadecimal con prefijo 0x
 * y cero-relleno hasta 6 dígitos (24 bits).
 * @param {number} n - Número entero
 * @returns {string} Ej: 0x100000
 */
function hex(n) {
  return '0x' + n.toString(16).toUpperCase().padStart(6, '0');
}

/**
 * Formatea bytes a la unidad más legible (B / KiB / MiB).
 * @param {number} b - Cantidad en bytes
 * @returns {string} Ej: "1.50 MiB", "224.5 KiB", "767 B"
 */
function formatBytes(b) {
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(2) + ' MiB';
  if (b >= 1_024)     return (b / 1_024).toFixed(1)     + ' KiB';
  return b + ' B';
}

/**
 * Convierte bytes a KiB con dos decimales.
 * @param {number} b - Cantidad en bytes
 * @returns {string} Ej: "219.38"
 */
function formatKiB(b) {
  return (b / 1_024).toFixed(2);
}

/**
 * Devuelve el nombre legible del algoritmo de asignación activo.
 * @returns {string}
 */
function algName() {
  const a = state.algorithm;
  return a === 'first' ? 'Primer Ajuste'
       : a === 'best'  ? 'Mejor Ajuste'
       :                 'Peor Ajuste';
}

/**
 * Agrega una entrada al log de eventos (panel derecho).
 * Las entradas más nuevas aparecen arriba.
 *
 * @param {string} msg  - Mensaje a mostrar
 * @param {string} type - Tipo: 'ok' | 'err' | 'warn' | 'info'
 */
function addLog(msg, type) {
  const list = document.getElementById('logList');
  const li   = document.createElement('li');
  li.className = 'log-item';

  // Marca de tiempo actual
  const t = new Date().toLocaleTimeString('es', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  // Clase CSS según el tipo de mensaje
  const cls = type === 'ok'   ? 'log-ok'   :
              type === 'err'  ? 'log-err'  :
              type === 'warn' ? 'log-warn' : 'log-info';

  li.innerHTML = `<span class="log-time">[${t}]</span><span class="${cls}">${msg}</span>`;

  // Insertar al inicio (los más nuevos primero)
  list.insertBefore(li, list.firstChild);

  // Limitar el log a 60 entradas para evitar acumulación excesiva
  if (list.children.length > 60) list.removeChild(list.lastChild);
}


/* ═══════════════════════════════════════════════
   SECCIÓN 12: ATAJOS DE TECLADO
═══════════════════════════════════════════════ */

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) loadSelectedProcess();  // Ctrl+Enter → cargar
  if (e.key === 'Delete')             unloadSelectedProcess(); // Delete    → liberar
});


/* ═══════════════════════════════════════════════
   SECCIÓN 13: ARRANQUE
   Se ejecuta cuando el DOM está completamente cargado
═══════════════════════════════════════════════ */
window.onload = () => {
  init();
  addLog('Sistema iniciado. RAM total: 16 MiB (0x000000 – 0xFFFFFF)', 'info');
  addLog('S.O. reserva 1 MiB (pila 64K + montículo 128K + EXE header 767B + reserva)', 'info');
  addLog('Selecciona un método de gestión y un proceso para comenzar.', 'info');
  render();
};
