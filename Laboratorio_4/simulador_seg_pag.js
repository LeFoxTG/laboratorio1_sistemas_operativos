/**
 * simulador_seg_pag.js
 * ═══════════════════════════════════════════════════════════════
 * Simulador de Gestión de Memoria — Segmentación y Paginación
 * Capacidad: 16 MiB de RAM (2^24 bytes → 0x000000 – 0xFFFFFF)
 
/* ═══════════════════════════════════════════════
   SECCIÓN 1: CONSTANTES DEL SISTEMA
═══════════════════════════════════════════════ */
 
/** RAM total: 16 MiB */
const RAM        = 16 * 1024 * 1024;
/** 1 MiB reservado para el Sistema Operativo */
const SO_SIZE    = 1_048_576;
/** Montículo fijo por proceso: 128 KiB */
const HEAP_SIZE  = 131_072;
/** Pila fija por proceso: 64 KiB */
const STACK_SIZE =  65_536;
/** Cabecera EXE fija: 767 bytes */
const HEADER_SIZE =    767;
 
/**
 * Colores base de los segmentos lógicos (usados en barras y mapas).
 * Los colores de instancias en RAM son independientes y se asignan
 * de la paleta INSTANCE_PALETTE.
 */
const SEG_COLORS = {
  header: '#94a3b8',
  code:   '#6366f1',
  data:   '#3b82f6',
  bss:    '#06b6d4',
  heap:   '#10b981',
  stack:  '#f59e0b',
};
 
/**
 * Paleta de colores para instancias cargadas en RAM.
 * Se asignan cíclicamente conforme se crean instancias.
 * Colores pastel / medios que contrastan bien sobre fondo claro.
 */
const INSTANCE_PALETTE = [
  '#6366f1', // índigo
  '#10b981', // esmeralda
  '#f59e0b', // ámbar
  '#ef4444', // rojo
  '#8b5cf6', // violeta
  '#06b6d4', // cian
  '#ec4899', // rosa
  '#84cc16', // lima
  '#f97316', // naranja
  '#14b8a6', // teal
  '#a855f7', // morado
  '#64748b', // slate
];
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 2: PROGRAMAS PREDEFINIDOS
   Mismos programas del simulador anterior para
   mantener coherencia con el ejercicio de clase.
 
   Tamaño en RAM:
     HEADER(767) + code + data + bss + HEAP(128K) + STACK(64K)
═══════════════════════════════════════════════ */
const PROGRAMS = [
  {
    id: 'P1', name: 'Notepad', custom: false,
    diskSize:   33_808,
    memSize:   224_649,
    segments: { header: HEADER_SIZE, code: 19_524, data: 12_352, bss:  1_165, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P2', name: 'Word', custom: false,
    diskSize:  115_086,
    memSize:   286_708,
    segments: { header: HEADER_SIZE, code: 77_539, data: 32_680, bss:  4_100, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P3', name: 'Excel', custom: false,
    diskSize:  132_111,
    memSize:   309_150,
    segments: { header: HEADER_SIZE, code: 99_542, data: 24_245, bss:  7_557, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P4', name: 'AutoCAD', custom: false,
    diskSize:  240_360,
    memSize:   436_201,
    segments: { header: HEADER_SIZE, code: 115_000, data: 123_470, bss: 1_123, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P5', name: 'Calculadora', custom: false,
    diskSize:   16_121,
    memSize:   209_462,
    segments: { header: HEADER_SIZE, code: 12_342, data:  1_256, bss:  1_756, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P6', name: 'p1 Grande', custom: false,
    diskSize: 3_800_767,
    memSize:  3_996_608,
    segments: { header: HEADER_SIZE, code: 525_000, data: 3_224_000, bss: 51_000, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P7', name: 'p2 Mediano', custom: false,
    diskSize: 1_589_767,
    memSize:  1_785_608,
    segments: { header: HEADER_SIZE, code: 590_000, data: 974_000, bss: 25_000, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P8', name: 'p3 Grande', custom: false,
    diskSize: 2_500_767,
    memSize:  2_696_608,
    segments: { header: HEADER_SIZE, code: 349_000, data: 2_150_000, bss: 1_000, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
];
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 3: PALETA DE COLORES DE INSTANCIAS
═══════════════════════════════════════════════ */
 
/** Índice rotatorio de la paleta de colores para nuevas instancias. */
let paletteIdx = 0;
 
/** Asigna el siguiente color disponible de la paleta. */
function nextColor() {
  return INSTANCE_PALETTE[paletteIdx++ % INSTANCE_PALETTE.length];
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 4: ESTADO GLOBAL
═══════════════════════════════════════════════ */
 
/**
 * Estado global del simulador.
 *
 * method:     'segmentation' | 'paging'
 * algorithm:  'first' | 'best' | 'worst'  (solo Segmentación)
 * pageSize:   tamaño de página en bytes    (solo Paginación)
 *
 * freeBlocks: Lista de bloques libres en RAM (Segmentación).
 *   Cada bloque: { base: number, size: number }
 *
 * frames: Array de marcos de página (Paginación).
 *   Cada marco: { frameNo: number, base: number, free: boolean, instanceId: string|null, pageNo: number|null }
 *
 * instances: Procesos cargados actualmente en RAM.
 *   Cada instancia (Segmentación):
 *     { id, progId, name, color, segments: [{ segName, base, size }] }
 *   Cada instancia (Paginación):
 *     { id, progId, name, color, pageTable: [{ pageNo, frameNo, base }], internalFrag }
 *
 * customPrograms: Procesos personalizados creados por el usuario.
 * customCounter:  Contador para IDs únicos de programas custom (C1, C2…).
 * instanceCounter: Contador para IDs únicos de instancias (I1, I2…).
 * selectedProg:   ID del programa seleccionado en la lista.
 * selectedInst:   ID de la instancia seleccionada en la lista de RAM.
 */
const state = {
  method:          'segmentation',
  algorithm:       'first',
  pageSize:        4_096,
  freeBlocks:      [],
  frames:          [],
  instances:       [],
  customPrograms:  [],
  customCounter:   0,
  instanceCounter: 0,
  selectedProg:    null,
  selectedInst:    null,
};
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 5: INICIALIZACIÓN
═══════════════════════════════════════════════ */
 
/** Punto de entrada de la aplicación. */
function init() {
  resetMemory(true);
  render();
}
 
/**
 * Reinicia toda la memoria al estado inicial vacío.
 * Conserva los programas personalizados creados por el usuario.
 * @param {boolean} silent - Si true, no agrega entrada al log.
 */
function resetMemory(silent = false) {
  state.instances       = [];
  state.instanceCounter = 0;
  paletteIdx            = 0;
  state.selectedInst    = null;
 
  if (state.method === 'segmentation') {
    initSegmentationMemory();
  } else {
    initPaginationMemory();
  }
 
  if (!silent) {
    addLog('Memoria reseteada al estado inicial.', 'info');
  }
  render();
}
 
/**
 * Inicializa la memoria para Segmentación.
 * Parte de un único bloque libre que cubre toda la RAM
 * disponible (excluyendo el bloque del SO).
 */
function initSegmentationMemory() {
  state.freeBlocks = [
    { base: SO_SIZE, size: RAM - SO_SIZE },
  ];
}
 
/**
 * Inicializa la memoria para Paginación.
 * Divide toda la RAM disponible en marcos de tamaño fijo.
 * Los marcos del SO se marcan como ocupados.
 */
function initPaginationMemory() {
  const ps = state.pageSize;
  state.frames = [];
  const totalFrames = Math.floor(RAM / ps);
  const soFrames    = Math.ceil(SO_SIZE / ps); // marcos ocupados por el SO
 
  for (let i = 0; i < totalFrames; i++) {
    state.frames.push({
      frameNo:    i,
      base:       i * ps,
      free:       i >= soFrames,  // los primeros marcos son del SO
      instanceId: i < soFrames ? 'SO' : null,
      pageNo:     null,
    });
  }
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 6: CAMBIO DE MÉTODO Y CONFIGURACIÓN
═══════════════════════════════════════════════ */
 
/**
 * Cambia el método de gestión (Segmentación / Paginación).
 * Reinicia toda la memoria y actualiza la UI.
 * @param {string} method - 'segmentation' | 'paging'
 */
function setMethod(method) {
  state.method = method;
 
  // Actualizar tabs visuales
  document.querySelectorAll('.seg-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.method === method);
  });
 
  // Mostrar/ocultar controles específicos de cada método
  document.getElementById('algSection').style.display =
    method === 'segmentation' ? 'block' : 'none';
  document.getElementById('pageSizeSection').style.display =
    method === 'paging' ? 'block' : 'none';
 
  // Actualizar título del mapa y tabla
  document.getElementById('mapTitle').textContent =
    method === 'segmentation'
      ? 'Mapa de Memoria — Segmentación'
      : 'Mapa de Memoria — Paginación';
 
  document.getElementById('tableTitle').textContent =
    method === 'segmentation' ? 'Tabla de Segmentos' : 'Tabla de Páginas';
 
  resetMemory(false);
}
 
/** Manejador del selector de algoritmo de asignación. */
function onAlgorithmChange() {
  state.algorithm = document.getElementById('algorithmSelect').value;
  addLog(`Algoritmo cambiado a: ${algName()}`, 'info');
}
 
/** Manejador del selector de tamaño de página. */
function onPageSizeChange() {
  state.pageSize = parseInt(document.getElementById('pageSizeSelect').value);
  addLog(`Tamaño de página cambiado a ${formatBytes(state.pageSize)}.`, 'info');
  resetMemory(false);
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 7: ALGORITMOS DE ASIGNACIÓN
   Usados en Segmentación para elegir el bloque
   libre donde cargar cada segmento.
═══════════════════════════════════════════════ */
 
/**
 * Selecciona un bloque libre de la lista según el algoritmo activo.
 * @param {number} reqSize - Bytes requeridos
 * @returns {Object|null}  Bloque libre elegido o null si no hay espacio
 */
function selectBlock(reqSize) {
  const candidates = state.freeBlocks.filter(b => b.size >= reqSize);
  if (candidates.length === 0) return null;
 
  const alg = state.algorithm;
 
  if (alg === 'first') {
    /**
     * PRIMER AJUSTE: el primer bloque libre con espacio suficiente,
     * ordenado por dirección de memoria (de menor a mayor).
     */
    return candidates.sort((a, b) => a.base - b.base)[0];
  }
 
  if (alg === 'best') {
    /**
     * MEJOR AJUSTE: el bloque cuyo tamaño sobrante es el mínimo posible.
     * Reduce el desperdicio por asignación pero genera fragmentos pequeños.
     */
    return candidates.sort((a, b) => (a.size - reqSize) - (b.size - reqSize))[0];
  }
 
  if (alg === 'worst') {
    /**
     * PEOR AJUSTE: el bloque más grande disponible.
     * El sobrante resultante es más grande y potencialmente reutilizable.
     */
    return candidates.sort((a, b) => (b.size - reqSize) - (a.size - reqSize))[0];
  }
 
  return null;
}
 
/**
 * Recorta el bloque elegido: si sobra espacio después de asignar
 * el segmento, el sobrante se convierte en un nuevo bloque libre.
 * @param {Object} block   - Bloque libre seleccionado
 * @param {number} useSize - Bytes que usará el segmento
 */
function splitBlock(block, useSize) {
  const remaining = block.size - useSize;
  const origBase  = block.base;
 
  // Eliminar el bloque original de la lista
  const idx = state.freeBlocks.indexOf(block);
  state.freeBlocks.splice(idx, 1);
 
  // Si sobra espacio, insertar el fragmento libre restante
  if (remaining > 0) {
    state.freeBlocks.push({ base: origBase + useSize, size: remaining });
  }
}
 
/**
 * Fusiona bloques libres contiguos (Coalescing).
 * Se llama después de liberar una instancia en Segmentación.
 */
function coalesce() {
  state.freeBlocks.sort((a, b) => a.base - b.base);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < state.freeBlocks.length - 1; i++) {
      const a = state.freeBlocks[i];
      const b = state.freeBlocks[i + 1];
      if (a.base + a.size === b.base) {
        a.size += b.size;
        state.freeBlocks.splice(i + 1, 1);
        changed = true;
        break;
      }
    }
  }
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 8: SEGMENTACIÓN — CARGA Y LIBERACIÓN
 
   Cada segmento del proceso (header, código, datos,
   bss, heap, pila) se asigna independientemente a
   un bloque libre de RAM según el algoritmo elegido.
   Cada segmento ocupa exactamente su tamaño → sin
   fragmentación interna. Puede haber fragmentación
   externa entre bloques libres no contiguos.
═══════════════════════════════════════════════ */
 
/**
 * Carga un proceso en RAM usando Segmentación.
 * Intenta asignar cada segmento a un bloque libre.
 * Si algún segmento no cabe, aborta y deshace la asignación.
 *
 * @param {Object} prog - Programa a cargar
 * @returns {boolean} true si la carga fue exitosa
 */
function segLoad(prog) {
  const color = nextColor();
  const instId = `I${++state.instanceCounter}`;
 
  // Lista de segmentos en orden de carga
  const segOrder = ['header', 'code', 'data', 'bss', 'heap', 'stack'];
  const segNames = {
    header: 'Header', code: '.text', data: '.data',
    bss: '.bss', heap: '.heap', stack: '.stack',
  };
 
  const assignedSegs = []; // para deshacer si falla
 
  for (const segKey of segOrder) {
    const size  = prog.segments[segKey];
    const block = selectBlock(size);
 
    if (!block) {
      // No hay espacio para este segmento → deshacer todo y abortar
      segUnloadPartial(assignedSegs);
      addLog(
        `[SEG] Sin espacio para segmento "${segNames[segKey]}" de ${prog.name} ` +
        `(${formatBytes(size)}). Carga abortada.`, 'err'
      );
      state.instanceCounter--; // revertir el contador
      paletteIdx--;            // revertir el color
      return false;
    }
 
    const base = block.base;
    splitBlock(block, size);
    assignedSegs.push({ segName: segNames[segKey], base, size, color: SEG_COLORS[segKey] });
  }
 
  // Todos los segmentos asignados → registrar instancia
  state.instances.push({
    id:       instId,
    progId:   prog.id,
    name:     prog.name,
    color,
    segments: assignedSegs,
    method:   'segmentation',
  });
 
  addLog(
    `[SEG / ${algName()}] ${instId} "${prog.name}" cargado. ` +
    `${assignedSegs.length} segmentos asignados.`, 'ok'
  );
  return true;
}
 
/**
 * Deshace asignaciones de segmentos parciales (en caso de aborto).
 * Devuelve los bloques al pool de libres y los fusiona.
 * @param {Array} segs - Segmentos ya asignados a deshacer
 */
function segUnloadPartial(segs) {
  for (const s of segs) {
    state.freeBlocks.push({ base: s.base, size: s.size });
  }
  coalesce();
}
 
/**
 * Libera una instancia cargada con Segmentación.
 * Devuelve todos sus segmentos al pool de bloques libres.
 * @param {string} instId - ID de la instancia a liberar
 */
function segUnload(instId) {
  const inst = state.instances.find(i => i.id === instId);
  if (!inst) return;
 
  // Devolver cada segmento como bloque libre
  for (const seg of inst.segments) {
    state.freeBlocks.push({ base: seg.base, size: seg.size });
  }
 
  coalesce(); // fusionar bloques libres adyacentes
  state.instances = state.instances.filter(i => i.id !== instId);
  addLog(`[SEG] Instancia ${instId} "${inst.name}" liberada de RAM.`, 'ok');
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 9: PAGINACIÓN — CARGA Y LIBERACIÓN
 
   La RAM se divide en marcos de tamaño fijo.
   El proceso se divide en páginas del mismo tamaño.
   Las páginas se asignan a marcos libres sin necesidad
   de que sean contiguos → sin fragmentación externa.
   La última página puede no llenarse completamente
   → fragmentación interna en el último marco.
═══════════════════════════════════════════════ */
 
/**
 * Carga un proceso en RAM usando Paginación.
 * Calcula cuántas páginas necesita el proceso y asigna
 * una página a cada marco libre disponible.
 *
 * @param {Object} prog - Programa a cargar
 * @returns {boolean}
 */
function pageLoad(prog) {
  const ps      = state.pageSize;
  const pages   = Math.ceil(prog.memSize / ps); // páginas necesarias
  const freeFrames = state.frames.filter(f => f.free);
 
  if (freeFrames.length < pages) {
    addLog(
      `[PAG] Sin marcos suficientes para "${prog.name}". ` +
      `Necesita ${pages} marcos, disponibles: ${freeFrames.length}.`, 'err'
    );
    return false;
  }
 
  const color  = nextColor();
  const instId = `I${++state.instanceCounter}`;
 
  // Fragmentación interna: espacio sobrante en la última página
  const internalFrag = (pages * ps) - prog.memSize;
 
  // Tabla de páginas: mapeo página → marco
  const pageTable = [];
 
  for (let p = 0; p < pages; p++) {
    const frame = freeFrames[p]; // asignar en orden de marco disponible
    frame.free       = false;
    frame.instanceId = instId;
    frame.pageNo     = p;
 
    pageTable.push({
      pageNo:  p,
      frameNo: frame.frameNo,
      base:    frame.base,       // dirección física del marco
    });
  }
 
  state.instances.push({
    id:           instId,
    progId:       prog.id,
    name:         prog.name,
    color,
    pageTable,
    pageSize:     ps,
    pages,
    internalFrag,
    method:       'paging',
  });
 
  addLog(
    `[PAG] ${instId} "${prog.name}" cargado. ` +
    `${pages} páginas × ${formatBytes(ps)} = ${formatBytes(pages * ps)}. ` +
    `Frag. interna: ${formatBytes(internalFrag)}.`, 'ok'
  );
  return true;
}
 
/**
 * Libera una instancia cargada con Paginación.
 * Marca como libres todos los marcos que usaba.
 * @param {string} instId
 */
function pageUnload(instId) {
  const inst = state.instances.find(i => i.id === instId);
  if (!inst) return;
 
  // Liberar todos los marcos de esta instancia
  for (const frame of state.frames) {
    if (frame.instanceId === instId) {
      frame.free       = true;
      frame.instanceId = null;
      frame.pageNo     = null;
    }
  }
 
  state.instances = state.instances.filter(i => i.id !== instId);
  addLog(`[PAG] Instancia ${instId} "${inst.name}" liberada de RAM.`, 'ok');
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 10: PROCESOS PERSONALIZADOS
   El usuario puede definir sus propios procesos
   con tamaños de segmento arbitrarios.
   Se comportan igual que los predefinidos.
═══════════════════════════════════════════════ */
 
/**
 * Calcula el tamaño total en RAM de los campos del formulario.
 * Actualiza la vista previa en tiempo real.
 */
function updatePreview() {
  const code = parseInt(document.getElementById('cCode').value) || 0;
  const data = parseInt(document.getElementById('cData').value) || 0;
  const bss  = parseInt(document.getElementById('cBss').value)  || 0;
  const total = HEADER_SIZE + code + data + bss + HEAP_SIZE + STACK_SIZE;
 
  const line = document.getElementById('previewLine');
  const val  = document.getElementById('previewVal');
 
  if (code + data + bss === 0) {
    val.textContent = '—';
    line.classList.remove('oversize');
    return;
  }
 
  val.textContent = formatBytes(total);
  line.classList.toggle('oversize', total > RAM - SO_SIZE);
}
 
/**
 * Valida el formulario de proceso personalizado.
 * @returns {boolean}
 */
function validateForm() {
  const errDiv = document.getElementById('formErr');
  const name   = document.getElementById('cName').value.trim();
  const code   = parseInt(document.getElementById('cCode').value) || 0;
  const data   = parseInt(document.getElementById('cData').value) || 0;
  const bss    = parseInt(document.getElementById('cBss').value)  || 0;
 
  const show = msg => { errDiv.textContent = msg; errDiv.style.display = 'block'; };
  const hide = ()  => { errDiv.style.display = 'none'; };
 
  if (!name)   { show('El nombre es obligatorio.'); return false; }
  if (code <= 0) { show('.text debe ser mayor a 0.'); return false; }
  if (data < 0 || bss < 0) { show('.data y .bss no pueden ser negativos.'); return false; }
 
  const total = HEADER_SIZE + code + data + bss + HEAP_SIZE + STACK_SIZE;
  if (total > RAM - SO_SIZE) {
    show(`El proceso (${formatBytes(total)}) excede la RAM disponible.`);
    return false;
  }
 
  const dup = state.customPrograms.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (dup) { show(`Ya existe un proceso personalizado llamado "${name}".`); return false; }
 
  hide();
  return true;
}
 
/**
 * Crea un proceso personalizado y lo agrega a la lista de programas.
 */
function createCustomProgram() {
  if (!validateForm()) return;
 
  const name = document.getElementById('cName').value.trim();
  const code = parseInt(document.getElementById('cCode').value) || 0;
  const data = parseInt(document.getElementById('cData').value) || 0;
  const bss  = parseInt(document.getElementById('cBss').value)  || 0;
  const memSize = HEADER_SIZE + code + data + bss + HEAP_SIZE + STACK_SIZE;
 
  state.customCounter++;
  const id = `C${state.customCounter}`;
 
  state.customPrograms.push({
    id, name, custom: true,
    diskSize: memSize,
    memSize,
    segments: {
      header: HEADER_SIZE, code, data, bss,
      heap: HEAP_SIZE, stack: STACK_SIZE,
    },
  });
 
  addLog(`[CUSTOM] "${name}" (${id}) creado. RAM: ${formatBytes(memSize)}.`, 'info');
  clearForm();
  render();
}
 
/**
 * Elimina un proceso personalizado.
 * Si tiene instancias en RAM, las descarga primero.
 * @param {string} progId
 */
function removeCustomProgram(progId) {
  // Descargar todas las instancias de este programa
  const insts = state.instances.filter(i => i.progId === progId);
  for (const inst of insts) unloadInstance(inst.id);
 
  state.customPrograms = state.customPrograms.filter(p => p.id !== progId);
  if (state.selectedProg === progId) state.selectedProg = null;
 
  addLog(`[CUSTOM] Proceso ${progId} eliminado.`, 'warn');
  render();
}
 
/** Limpia el formulario de proceso personalizado. */
function clearForm() {
  document.getElementById('cName').value = '';
  document.getElementById('cCode').value = '';
  document.getElementById('cData').value = '';
  document.getElementById('cBss').value  = '';
  document.getElementById('previewVal').textContent = '—';
  document.getElementById('previewLine').classList.remove('oversize');
  document.getElementById('formErr').style.display = 'none';
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 11: ACCIONES DE LA INTERFAZ
═══════════════════════════════════════════════ */
 
/** Carga en RAM el programa actualmente seleccionado. */
function loadSelectedProgram() {
  if (!state.selectedProg) {
    addLog('Selecciona un programa antes de cargarlo.', 'warn');
    return;
  }
 
  const allProgs = [...PROGRAMS, ...state.customPrograms];
  const prog = allProgs.find(p => p.id === state.selectedProg);
  if (!prog) return;
 
  let ok;
  if (state.method === 'segmentation') {
    ok = segLoad(prog);
  } else {
    ok = pageLoad(prog);
  }
 
  if (ok) render();
}
 
/**
 * Libera la instancia actualmente seleccionada en la lista de RAM.
 */
function unloadSelectedInstance() {
  if (!state.selectedInst) {
    addLog('Selecciona una instancia en RAM para terminarla.', 'warn');
    return;
  }
  unloadInstance(state.selectedInst);
  state.selectedInst = null;
  render();
}
 
/**
 * Libera una instancia por su ID, independientemente del método activo.
 * @param {string} instId
 */
function unloadInstance(instId) {
  if (state.method === 'segmentation') {
    segUnload(instId);
  } else {
    pageUnload(instId);
  }
}
 
/** Limpia el log de eventos. */
function clearLog() {
  document.getElementById('logList').innerHTML = '';
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 12: RENDERIZADO GENERAL
═══════════════════════════════════════════════ */
 
/** Renderiza todos los componentes de la UI. */
function render() {
  renderProgramsList();
  renderInstancesList();
  renderMemoryMap();
  renderAddressTable();
  renderInstanceDetail();
  renderStats();
  renderChipRam();
}
 
/**
 * Renderiza la lista de programas disponibles en el sidebar.
 * Muestra predefinidos primero, luego los personalizados.
 */
function renderProgramsList() {
  const container = document.getElementById('programsList');
  container.innerHTML = '';
 
  const allProgs = [...PROGRAMS, ...state.customPrograms];
 
  for (const prog of allProgs) {
    const selected = state.selectedProg === prog.id;
    // Contar instancias activas de este programa
    const activeCount = state.instances.filter(i => i.progId === prog.id).length;
 
    const card = document.createElement('div');
    card.className = 'prog-card' +
      (prog.custom   ? ' custom-prog' : '') +
      (selected      ? ' selected'    : '');
    card.onclick = () => {
      state.selectedProg = prog.id;
      renderProgramsList();
    };
 
    // Barra de segmentos proporcional
    const segs  = prog.segments;
    const total = Object.values(segs).reduce((s, v) => s + v, 0);
    const barParts = Object.entries(segs).map(([k, v]) =>
      `<div class="mini-seg-part" style="flex:${v/total*100};background:${SEG_COLORS[k]}" title="${k}: ${formatBytes(v)}"></div>`
    ).join('');
 
    // Badge de instancias activas
    const badge = activeCount > 0
      ? `<span class="prog-badge" style="background:${activeCount > 0 ? '#eff6ff' : ''};color:#3b82f6;border:1px solid #bfdbfe">${activeCount}×</span>`
      : '';
 
    // Botón de eliminar (solo custom)
    const btnRemove = prog.custom
      ? `<button class="btn-remove" onclick="event.stopPropagation();removeCustomProgram('${prog.id}')" title="Eliminar">×</button>`
      : '';
 
    card.innerHTML = `
      <div class="prog-name">${prog.id}: ${prog.name} ${badge}</div>
      <div class="prog-meta">${formatBytes(prog.memSize)} en RAM · disco: ${formatBytes(prog.diskSize)}</div>
      <div class="mini-seg-bar">${barParts}</div>
      ${btnRemove}
    `;
 
    container.appendChild(card);
  }
}
 
/**
 * Renderiza la lista de instancias actualmente en RAM.
 */
function renderInstancesList() {
  const container = document.getElementById('instancesList');
  const countEl   = document.getElementById('instanceCount');
 
  countEl.textContent = state.instances.length;
  container.innerHTML = '';
 
  if (state.instances.length === 0) {
    container.innerHTML = '<div class="text-muted text-sm" style="padding:4px 0">Sin instancias en RAM.</div>';
    return;
  }
 
  for (const inst of state.instances) {
    const selected = state.selectedInst === inst.id;
    const card = document.createElement('div');
    card.className = 'inst-card' + (selected ? ' selected' : '');
    card.onclick = () => {
      state.selectedInst = inst.id;
      renderInstancesList();
      renderInstanceDetail();
      renderAddressTable();
    };
 
    const size = inst.method === 'segmentation'
      ? inst.segments.reduce((s, seg) => s + seg.size, 0)
      : inst.pages * inst.pageSize;
 
    card.innerHTML = `
      <div class="inst-name">
        <span style="display:inline-block;width:9px;height:9px;border-radius:2px;
                     background:${inst.color};margin-right:6px;vertical-align:middle;"></span>
        ${inst.id} — ${inst.name}
      </div>
      <div class="inst-meta">${formatBytes(size)} · ${inst.method === 'segmentation' ? inst.segments.length + ' seg.' : inst.pages + ' pág.'}</div>
    `;
 
    container.appendChild(card);
  }
}
 
/** Actualiza el chip de RAM libre en el encabezado. */
function renderChipRam() {
  const usedBytes = calcUsedRam();
  const freeBytes = RAM - usedBytes;
  const pct = (usedBytes / RAM * 100).toFixed(1);
 
  document.getElementById('chipRamFree').textContent = `Libre: ${formatBytes(freeBytes)}`;
  document.getElementById('barUsed').style.width = pct + '%';
}
 
/** Calcula los bytes actualmente ocupados en RAM (SO + instancias). */
function calcUsedRam() {
  if (state.method === 'segmentation') {
    const instUsed = state.instances.reduce(
      (s, inst) => s + inst.segments.reduce((ss, seg) => ss + seg.size, 0), 0
    );
    return SO_SIZE + instUsed;
  } else {
    const usedFrames = state.frames.filter(f => !f.free).length;
    return usedFrames * state.pageSize;
  }
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 13: RENDERIZADO DEL MAPA DE MEMORIA
═══════════════════════════════════════════════ */
 
/**
 * Renderiza el mapa visual de memoria.
 * - Segmentación: bloques de tamaño variable por segmento.
 * - Paginación:   marcos de tamaño fijo, uno por fila.
 */
function renderMemoryMap() {
  const MAP_H = 520; // altura aumentada para mayor legibilidad
 
  const addrCol  = document.getElementById('addrCol');
  const memCol   = document.getElementById('memCol');
  const legendCol = document.getElementById('legendCol');
 
  addrCol.style.height  = MAP_H + 'px';
  memCol.style.height   = MAP_H + 'px';
  addrCol.innerHTML  = '';
  memCol.innerHTML   = '';
  legendCol.innerHTML = '';
 
  if (state.method === 'segmentation') {
    renderSegMap(MAP_H, addrCol, memCol, legendCol);
  } else {
    renderPageMap(MAP_H, addrCol, memCol, legendCol);
  }
}
 
/**
 * Mapa de Segmentación:
 * Construye una representación proporcional de los bloques de RAM.
 * El SO ocupa el primer bloque; luego vienen segmentos de instancias
 * y bloques libres, de menor a mayor dirección (de abajo a arriba).
 */
function renderSegMap(mapH, addrCol, memCol, legendCol) {
  // Construir lista ordenada de todos los bloques (SO + instancias + libres)
  const blocks = [];
 
  // Bloque del SO
  blocks.push({ base: 0, size: SO_SIZE, color: '#e2e4ea', label: 'SO', type: 'so' });
 
  // Segmentos de instancias activas
  // Cada segmento usa el color de su TIPO (SEG_COLORS) para identificar
  // qué parte del proceso es (.text, .heap, etc.), y se borda con el
  // color de instancia para saber a quién pertenece.
  for (const inst of state.instances) {
    for (const seg of inst.segments) {
      const segColorKey = segKeyOf(seg.segName); // clave en SEG_COLORS
      blocks.push({
        base:      seg.base,
        size:      seg.size,
        color:     SEG_COLORS[segColorKey] || inst.color, // color por tipo de segmento
        instColor: inst.color,                            // color de instancia (para borde)
        label:     `${inst.id}·${seg.segName}`,
        addr:      seg.base,
        type:      'inst',
        instId:    inst.id,
        segName:   seg.segName,
      });
    }
  }
 
  // Bloques libres
  for (const fb of state.freeBlocks) {
    blocks.push({ base: fb.base, size: fb.size, color: '#f0f1f5', label: '', type: 'free' });
  }
 
  blocks.sort((a, b) => a.base - b.base);
 
  // Etiquetas de dirección clave
  const keyAddrs = [0, SO_SIZE, RAM / 4, RAM / 2, (3 * RAM) / 4, RAM - 1];
  for (const addr of keyAddrs) {
    const lbl = document.createElement('div');
    lbl.className = 'addr-label';
    lbl.style.bottom = (addr / RAM * mapH) + 'px';
    lbl.textContent  = hexShort(addr);
    addrCol.appendChild(lbl);
  }
 
  // Bloques del mapa (de mayor a menor dirección = top a bottom en CSS)
  const sortedDesc = [...blocks].sort((a, b) => b.base - a.base);
  for (const b of sortedDesc) {
    const h = Math.max((b.size / RAM) * mapH, 5);
    const blk = document.createElement('div');
    blk.className = 'mem-block';
    blk.style.height     = h + 'px';
    blk.style.background = b.color;
    blk.style.color      = b.type === 'free' || b.type === 'so' ? '#9aa' : '#fff';
 
    // Borde izquierdo grueso con el color de instancia para identificar
    // a qué proceso pertenece cada segmento (independiente del tipo)
    if (b.type === 'inst') {
      blk.style.borderLeft = `4px solid ${b.instColor}`;
    }
 
    // Tooltip con información completa al hacer hover
    const addrEnd = b.base + b.size - 1;
    blk.title = b.type === 'inst'
      ? `${b.label} | Base: ${hex(b.base)} | Límite: ${hex(addrEnd)} | ${formatBytes(b.size)}`
      : b.type === 'free'
      ? `LIBRE | ${hex(b.base)}–${hex(addrEnd)} | ${formatBytes(b.size)}`
      : `S.O. | ${hex(b.base)}–${hex(addrEnd)} | ${formatBytes(b.size)}`;
 
    // Etiqueta dentro del bloque — visible si hay suficiente altura
    if (h >= 14) {
      const lbl = document.createElement('div');
      lbl.className = 'mem-block-lbl';
      if (b.type === 'free') {
        lbl.textContent = h > 22 ? `LIBRE\n${formatBytes(b.size)}` : 'LIBRE';
        lbl.style.color = '#88aaaa';
      } else if (b.type === 'so') {
        lbl.textContent = 'S.O.';
        lbl.style.color = '#888';
      } else {
        // Segmento de proceso: mostrar ID instancia + nombre segmento
        lbl.textContent = h >= 26
          ? `${b.instId} ${b.segName}\n${hex(b.base)}`
          : `${b.instId} ${b.segName}`;
      }
      blk.appendChild(lbl);
    }
 
    memCol.appendChild(blk);
  }
 
  // ── Leyenda: una entrada por instancia con sus segmentos coloreados ──────
  // Muestra el color de instancia (borde) + los colores de cada tipo de segmento.
  const seen = new Set();
  for (const inst of state.instances) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
 
    // Mini barra de segmentos con los colores por tipo
    const segDots = inst.segments.map(seg => {
      const k = segKeyOf(seg.segName);
      return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;
                background:${SEG_COLORS[k]||inst.color};margin-right:2px;vertical-align:middle"
                title="${seg.segName}: ${formatBytes(seg.size)}"></span>`;
    }).join('');
 
    const totalSize = inst.segments.reduce((s, seg) => s + seg.size, 0);
 
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.style.cssText = 'align-items:flex-start; flex-direction:column; padding:4px 0;';
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
        <div class="legend-dot" style="background:${inst.color};border-radius:3px;width:12px;height:12px;flex-shrink:0"></div>
        <strong style="font-size:11px">${inst.id} — ${inst.name}</strong>
      </div>
      <div style="margin-left:17px;font-size:10px;color:var(--text3)">${formatBytes(totalSize)} · ${inst.segments.length} segmentos</div>
      <div style="margin-left:17px;margin-top:3px">${segDots}</div>
    `;
    legendCol.appendChild(item);
  }
 
  if (state.instances.length === 0) {
    legendCol.innerHTML = '<div class="text-muted text-sm">Sin instancias en RAM.</div>';
  }
}
 
/**
 * Mapa de Paginación:
 * Agrupa marcos consecutivos con el mismo estado (instancia o libre)
 * en bandas de color para mayor legibilidad, independientemente del
 * número total de marcos. Cada banda muestra instancia, rango de marcos
 * y dirección física.
 *
 * Estrategia de visualización:
 *   1. Construir una lista de "bandas": grupos consecutivos del mismo estado.
 *   2. Cada banda tiene altura proporcional a la cantidad de marcos que agrupa.
 *   3. Mostrar etiquetas cuando la banda tenga suficiente altura.
 */
function renderPageMap(mapH, addrCol, memCol, legendCol) {
  const ps          = state.pageSize;
  const totalFrames = state.frames.length;
 
  // ── Etiquetas de dirección ──────────────────────────────────────────
  const keyAddrs = [0, SO_SIZE, RAM / 4, RAM / 2, (3 * RAM) / 4, RAM - 1];
  for (const addr of keyAddrs) {
    const lbl = document.createElement('div');
    lbl.className = 'addr-label';
    lbl.style.bottom = (addr / RAM * mapH) + 'px';
    lbl.textContent  = hexShort(addr);
    addrCol.appendChild(lbl);
  }
 
  // ── Construir bandas de marcos consecutivos del mismo estado ────────
  // Una banda = secuencia de marcos contiguos con el mismo instanceId.
  const bands = [];
  let cur = null;
 
  for (const frame of state.frames) {
    const key = frame.instanceId || 'free'; // clave: ID instancia o 'free'
    if (!cur || cur.key !== key) {
      cur = { key, frames: [frame], firstFrame: frame.frameNo };
      bands.push(cur);
    } else {
      cur.frames.push(frame);
    }
  }
 
  // ── Renderizar bandas de mayor a menor dirección ────────────────────
  for (const band of [...bands].reverse()) {
    const bandFrames  = band.frames.length;
    const bandBytes   = bandFrames * ps;
    const h           = Math.max((bandBytes / RAM) * mapH, 5);
 
    const isSO   = band.key === 'SO';
    const isFree = band.key === 'free';
    const inst   = (!isSO && !isFree)
      ? state.instances.find(i => i.id === band.key)
      : null;
 
    const color = isSO   ? '#d1d5db'
                : isFree ? '#f0f1f5'
                : inst   ? inst.color
                :          '#ccc';
 
    const blk = document.createElement('div');
    blk.className = 'mem-block';
    blk.style.height     = h + 'px';
    blk.style.background = color;
    blk.style.color      = inst ? '#fff' : '#9aa';
 
    // Tooltip con información completa de la banda
    const baseAddr = band.frames[0].base;
    const endAddr  = band.frames[band.frames.length - 1].base + ps - 1;
    blk.title = isSO
      ? `S.O. | Marcos 0–${band.frames.length - 1} | ${hex(baseAddr)}–${hex(endAddr)}`
      : isFree
      ? `LIBRE | ${bandFrames} marco(s) | ${hex(baseAddr)}–${hex(endAddr)} | ${formatBytes(bandBytes)}`
      : `${inst?.id} ${inst?.name} | ${bandFrames} marco(s) | Págs ${band.frames[0].pageNo}–${band.frames[band.frames.length-1].pageNo} | ${hex(baseAddr)}–${hex(endAddr)}`;
 
    // Etiqueta interna cuando hay espacio suficiente
    if (h >= 14) {
      const lbl = document.createElement('div');
      lbl.className = 'mem-block-lbl';
      if (isSO) {
        lbl.textContent = 'S.O.';
        lbl.style.color = '#888';
      } else if (isFree) {
        lbl.innerHTML = h >= 26
          ? `LIBRE<br><span style="font-size:8px;opacity:0.7">${formatBytes(bandBytes)}</span>`
          : 'LIBRE';
        lbl.style.color = '#88aaa';
      } else {
        // Proceso: mostrar ID, nombre, rango de páginas y dirección
        const pageRange = bandFrames === 1
          ? `P${band.frames[0].pageNo}`
          : `P${band.frames[0].pageNo}–P${band.frames[band.frames.length-1].pageNo}`;
        lbl.innerHTML = h >= 30
          ? `<strong>${inst?.id}</strong> ${inst?.name}<br>
             <span style="font-size:8px;opacity:0.85">${pageRange}</span><br>
             <span style="font-size:8px;opacity:0.7">${hex(baseAddr)}</span>`
          : h >= 20
          ? `${inst?.id} ${pageRange}`
          : inst?.id || '';
      }
      blk.appendChild(lbl);
    }
 
    memCol.appendChild(blk);
  }
 
  // ── Leyenda de instancias ────────────────────────────────────────────
  const seen = new Set();
  for (const inst of state.instances) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
 
    // Contar marcos de esta instancia
    const instFrames = state.frames.filter(f => f.instanceId === inst.id).length;
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-dot" style="background:${inst.color}"></div>
      <div>
        <strong>${inst.id}</strong> ${inst.name}<br>
        <span class="text-muted">${inst.pages} págs · ${instFrames} marcos · ${formatBytes(inst.internalFrag)} frag.</span>
      </div>
    `;
    legendCol.appendChild(item);
  }
 
  if (state.instances.length === 0) {
    legendCol.innerHTML = '<div class="text-muted text-sm">Sin instancias en RAM.</div>';
  }
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 14: RENDERIZADO DE LA TABLA DE TRADUCCIÓN
   - Segmentación: base + límite de cada segmento
   - Paginación:   página lógica → marco físico
═══════════════════════════════════════════════ */
 
/**
 * Renderiza la tabla de traducción de direcciones.
 * Si hay una instancia seleccionada, muestra solo la de esa instancia.
 * Si no, muestra todas las instancias agrupadas.
 */
function renderAddressTable() {
  const head = document.getElementById('addrTableHead');
  const body = document.getElementById('addrTableBody');
  const sub  = document.getElementById('tableSubtitle');
 
  head.innerHTML = '';
  body.innerHTML = '';
 
  if (state.method === 'segmentation') {
    renderSegTable(head, body, sub);
  } else {
    renderPageTable(head, body, sub);
  }
}
 
/**
 * Tabla de Segmentos:
 * Columnas: Instancia | Segmento | Base (hex) | Límite (hex) | Tamaño
 */
function renderSegTable(head, body, sub) {
  head.innerHTML = `<tr>
    <th>Instancia</th>
    <th>Segmento</th>
    <th>Base</th>
    <th>Límite</th>
    <th>Tamaño</th>
  </tr>`;
 
  const target = state.selectedInst
    ? state.instances.filter(i => i.id === state.selectedInst)
    : state.instances;
 
  sub.textContent = state.selectedInst
    ? `Instancia ${state.selectedInst}`
    : `${state.instances.length} instancia(s)`;
 
  if (target.length === 0) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">
      Sin instancias en RAM.</td></tr>`;
    return;
  }
 
  for (const inst of target) {
    inst.segments.forEach((seg, i) => {
      const tr = document.createElement('tr');
      if (inst.id === state.selectedInst) tr.className = 'row-selected';
      tr.innerHTML = `
        <td>
          ${i === 0
            ? `<span class="tbl-color-dot" style="background:${inst.color}"></span>${inst.id} ${inst.name}`
            : ''}
        </td>
        <td>${seg.segName}</td>
        <td class="mono-cell">${hex(seg.base)}</td>
        <td class="mono-cell">${hex(seg.base + seg.size - 1)}</td>
        <td>${formatBytes(seg.size)}</td>
      `;
      body.appendChild(tr);
    });
 
    // Fila separadora entre instancias
    if (target.length > 1) {
      const sep = document.createElement('tr');
      sep.innerHTML = `<td colspan="5" style="height:4px;background:var(--surface2)"></td>`;
      body.appendChild(sep);
    }
  }
}
 
/**
 * Tabla de Páginas:
 * Columnas: Instancia | Pág. Lógica | Marco Físico | Dir. Física | Dir. Virtual ejemplo
 */
function renderPageTable(head, body, sub) {
  const ps = state.pageSize;
 
  head.innerHTML = `<tr>
    <th>Instancia</th>
    <th>Pág. Lógica</th>
    <th>Marco Físico</th>
    <th>Dir. Física (base)</th>
    <th>Tamaño marco</th>
  </tr>`;
 
  const target = state.selectedInst
    ? state.instances.filter(i => i.id === state.selectedInst)
    : state.instances;
 
  sub.textContent = state.selectedInst
    ? `Instancia ${state.selectedInst} — ${formatBytes(ps)}/pág.`
    : `${state.instances.length} instancia(s) — ${formatBytes(ps)}/pág.`;
 
  if (target.length === 0) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">
      Sin instancias en RAM.</td></tr>`;
    return;
  }
 
  for (const inst of target) {
    inst.pageTable.forEach((entry, i) => {
      const tr = document.createElement('tr');
      if (inst.id === state.selectedInst) tr.className = 'row-selected';
      tr.innerHTML = `
        <td>
          ${i === 0
            ? `<span class="tbl-color-dot" style="background:${inst.color}"></span>${inst.id} ${inst.name}`
            : ''}
        </td>
        <td class="mono-cell">${entry.pageNo}</td>
        <td class="mono-cell">${entry.frameNo}</td>
        <td class="mono-cell">${hex(entry.base)}</td>
        <td>${formatBytes(ps)}</td>
      `;
      body.appendChild(tr);
    });
 
    if (target.length > 1) {
      const sep = document.createElement('tr');
      sep.innerHTML = `<td colspan="5" style="height:4px;background:var(--surface2)"></td>`;
      body.appendChild(sep);
    }
  }
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 15: DETALLES E ESTADÍSTICAS
═══════════════════════════════════════════════ */
 
/**
 * Renderiza el panel de detalles de la instancia seleccionada.
 * Muestra nombre, tamaño, distribución de segmentos, y
 * para paginación: nº de páginas y fragmentación interna.
 */
function renderInstanceDetail() {
  const panel = document.getElementById('instanceDetail');
 
  if (!state.selectedInst) {
    panel.innerHTML = '<p class="placeholder-text">Selecciona una instancia para ver sus detalles.</p>';
    return;
  }
 
  const inst = state.instances.find(i => i.id === state.selectedInst);
  if (!inst) {
    panel.innerHTML = '<p class="placeholder-text">Instancia no encontrada.</p>';
    return;
  }
 
  const prog = [...PROGRAMS, ...state.customPrograms].find(p => p.id === inst.progId);
 
  if (inst.method === 'segmentation') {
    const totalSize = inst.segments.reduce((s, seg) => s + seg.size, 0);
    const segRows = inst.segments.map(seg => `
      <tr>
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:2px;
          background:${SEG_COLORS[segKeyOf(seg.segName)]};margin-right:4px"></span>${seg.segName}</td>
        <td class="mono-cell">${hex(seg.base)}</td>
        <td>${formatBytes(seg.size)}</td>
      </tr>
    `).join('');
 
    panel.innerHTML = `
      <div class="detail-row">
        <span class="detail-key">Instancia</span>
        <span class="detail-value" style="color:${inst.color}">${inst.id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Programa</span>
        <span class="detail-value">${inst.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Tamaño en RAM</span>
        <span class="detail-value">${formatBytes(totalSize)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Fragmentación interna</span>
        <span class="detail-value" style="color:var(--green)">0 B (ninguna)</span>
      </div>
      <table class="seg-mini-table">
        <tr><td>Segmento</td><td>Base</td><td>Tamaño</td></tr>
        ${segRows}
      </table>
    `;
  } else {
    // Paginación
    panel.innerHTML = `
      <div class="detail-row">
        <span class="detail-key">Instancia</span>
        <span class="detail-value" style="color:${inst.color}">${inst.id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Programa</span>
        <span class="detail-value">${inst.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Tamaño proceso</span>
        <span class="detail-value">${prog ? formatBytes(prog.memSize) : '—'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Tamaño de página</span>
        <span class="detail-value">${formatBytes(inst.pageSize)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Páginas asignadas</span>
        <span class="detail-value">${inst.pages}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">RAM ocupada</span>
        <span class="detail-value">${formatBytes(inst.pages * inst.pageSize)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Frag. interna (última pág.)</span>
        <span class="detail-value" style="color:${inst.internalFrag > 0 ? 'var(--amber)' : 'var(--green)'}">
          ${formatBytes(inst.internalFrag)}
        </span>
      </div>
    `;
  }
}
 
/**
 * Mapea el nombre visual de segmento a la clave de SEG_COLORS.
 * Ej: '.text' → 'code', 'Header' → 'header', etc.
 */
function segKeyOf(segName) {
  const map = { 'Header': 'header', '.text': 'code', '.data': 'data', '.bss': 'bss', '.heap': 'heap', '.stack': 'stack' };
  return map[segName] || 'code';
}
 
/**
 * Renderiza el panel de estadísticas globales de la memoria.
 */
function renderStats() {
  const panel = document.getElementById('statsPanel');
 
  const usedBytes  = calcUsedRam();
  const freeBytes  = RAM - usedBytes;
  const usedPct    = (usedBytes / RAM * 100).toFixed(1);
  const instCount  = state.instances.length;
 
  let intFrag = 0;
  let extFrag = 0;
 
  if (state.method === 'segmentation') {
    // Fragmentación externa: suma de bloques libres dispersos
    extFrag = state.freeBlocks.reduce((s, b) => s + b.size, 0);
    // Fragmentación interna: 0 en segmentación pura
  } else {
    // Fragmentación interna: suma de sobrantes de última página por instancia
    intFrag = state.instances.reduce((s, i) => s + i.internalFrag, 0);
    // Fragmentación externa: 0 en paginación pura
    const freeFrames = state.frames.filter(f => f.free).length;
    extFrag = freeFrames * state.pageSize; // espacio libre (no fragmentación real)
  }
 
  const largestFree = state.method === 'segmentation'
    ? (state.freeBlocks.length > 0 ? Math.max(...state.freeBlocks.map(b => b.size)) : 0)
    : (state.frames.filter(f => f.free).length * state.pageSize);
 
  panel.innerHTML = `
    <div class="stat-item">
      <span class="stat-key">RAM Usada</span>
      <span class="stat-value accent">${formatBytes(usedBytes)} (${usedPct}%)</span>
    </div>
    <div class="stat-bar">
      <div class="stat-bar-fill" style="width:${usedPct}%;background:var(--accent)"></div>
    </div>
    <div class="stat-item">
      <span class="stat-key">RAM Libre</span>
      <span class="stat-value green">${formatBytes(freeBytes)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Instancias en RAM</span>
      <span class="stat-value">${instCount}</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Frag. Interna</span>
      <span class="stat-value ${intFrag > 0 ? 'amber' : 'green'}">${formatBytes(intFrag)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">${state.method === 'segmentation' ? 'Bloques Libres' : 'Marcos Libres'}</span>
      <span class="stat-value">${state.method === 'segmentation'
        ? state.freeBlocks.length
        : state.frames.filter(f => f.free).length}
      </span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Mayor bloque/espacio libre</span>
      <span class="stat-value">${formatBytes(largestFree)}</span>
    </div>
    ${state.method === 'paging' ? `
    <div class="stat-item">
      <span class="stat-key">Marcos totales</span>
      <span class="stat-value">${state.frames.length}</span>
    </div>` : ''}
  `;
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 16: LOG DE EVENTOS
═══════════════════════════════════════════════ */
 
/**
 * Agrega una entrada al log de eventos (más recientes primero).
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
 
  if (list.children.length > 80) list.removeChild(list.lastChild);
}
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 17: HELPERS
═══════════════════════════════════════════════ */
 
/**
 * Convierte bytes a hexadecimal con prefijo 0x y 6 dígitos (24 bits).
 * @param {number} n
 * @returns {string} Ej: 0x100000
 */
function hex(n) {
  return '0x' + n.toString(16).toUpperCase().padStart(6, '0');
}
 
/**
 * Versión corta de hex para etiquetas del mapa (sin padding completo).
 * @param {number} n
 */
function hexShort(n) {
  return '0x' + n.toString(16).toUpperCase().padStart(5, '0');
}
 
/**
 * Formatea bytes a la unidad más legible (B / KiB / MiB).
 * @param {number} b
 * @returns {string}
 */
function formatBytes(b) {
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(2) + ' MiB';
  if (b >= 1_024)     return (b / 1_024).toFixed(1)     + ' KiB';
  return b + ' B';
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
 
 
/* ═══════════════════════════════════════════════
   SECCIÓN 18: ARRANQUE
═══════════════════════════════════════════════ */
window.onload = () => {
  init();
  addLog('Sistema iniciado. RAM: 16 MiB (0x000000 – 0xFFFFFF)', 'info');
  addLog(`S.O. ocupa ${formatBytes(SO_SIZE)} (0x000000 – ${hex(SO_SIZE - 1)})`, 'info');
  addLog('Selecciona un programa y presiona "Cargar en RAM".', 'info');
};