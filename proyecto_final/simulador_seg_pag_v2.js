/**
 * simulador_seg_pag_v2.js
 * ═══════════════════════════════════════════════════════════════
 * Simulador de Segmentación Paginada
 *
 * ARQUITECTURA DE MEMORIA:
 *   · RAM física  : 2^32 bits = 512 MiB (0x00000000 – 0x1FFFFFFF)
 *   · Espacio lóg.: 2^32 bytes = 4 GiB por proceso (32 bits)
 *
 * DIVISIÓN DEL ESPACIO DE DIRECCIONES LÓGICAS (32 bits):
 *   Con página de 4 KiB (offset 12 bits, ejemplo):
 *     Bits 31-22 → número de segmento  (s = 10 bits → 1024 segmentos)
 *     Bits 21-12 → número de página    (p = 10 bits → 1024 páginas/seg.)
 *     Bits 11-0  → desplazamiento      (d = 12 bits → 4096 bytes/página)
 *
 *   La distribución exacta varía con el tamaño de página elegido,
 *   pero siempre s + p + d = 32 bits.
 *
 * PROCESO DE TRADUCCIÓN (dirección lógica → física):
 *   1. Extraer (s, p, d) de la dirección lógica de 32 bits.
 *   2. Buscar la entrada s en la Tabla de Segmentos del proceso.
 *      → Obtiene la base de la Tabla de Páginas del segmento s.
 *   3. Buscar la entrada p en esa Tabla de Páginas.
 *      → Obtiene el número de marco físico f.
 *   4. Dirección física = f × PageSize + d.
 */

/* ═══════════════════════════════════════════════
   SECCIÓN 1: CONSTANTES DEL SISTEMA
═══════════════════════════════════════════════ */

/** RAM física: 512 MiB (2^32 bits = 2^29 bytes) */
const RAM        = 512 * 1024 * 1024;          // 536_870_912 bytes

/** SO reservado: 4 MiB en la base física */
const SO_SIZE    = 4 * 1024 * 1024;            // 4_194_304 bytes

/** Montículo fijo por segmento de heap: 128 KiB */
const HEAP_SIZE  = 131_072;

/** Pila fija por segmento de stack: 64 KiB */
const STACK_SIZE = 65_536;

/** Cabecera EXE fija: 767 bytes */
const HEADER_SIZE = 767;

/**
 * Colores base de los segmentos lógicos.
 * Se usan en barras proporcionales y en el mapa de memoria.
 */
const SEG_COLORS = {
  header: '#6e7681',
  code:   '#388bfd',
  data:   '#58a6ff',
  bss:    '#39d3f2',
  heap:   '#3fb950',
  stack:  '#d29922',
};

/**
 * Paleta para instancias en RAM.
 * Colores saturados sobre fondo oscuro.
 */
const INSTANCE_PALETTE = [
  '#388bfd', // azul
  '#3fb950', // verde
  '#d29922', // ámbar
  '#f85149', // rojo
  '#bc8cff', // violeta
  '#39d3f2', // cyan
  '#ec6547', // coral
  '#7ee787', // lima
  '#f0883e', // naranja
  '#56d364', // esmeralda
  '#a5d6ff', // celeste
  '#ffa657', // durazno
];


/* ═══════════════════════════════════════════════
   SECCIÓN 2: PROGRAMAS PREDEFINIDOS
   Mismos programas base + ajuste a 512 MiB
═══════════════════════════════════════════════ */
const PROGRAMS = [
  {
    id: 'P1', name: 'Notepad', custom: false,
    diskSize:    33_808,
    memSize:    224_649,
    segments: { header: HEADER_SIZE, code: 19_524, data: 12_352, bss:  1_165, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P2', name: 'Word', custom: false,
    diskSize:   115_086,
    memSize:    286_708,
    segments: { header: HEADER_SIZE, code: 77_539, data: 32_680, bss:  4_100, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P3', name: 'Excel', custom: false,
    diskSize:   132_111,
    memSize:    309_150,
    segments: { header: HEADER_SIZE, code: 99_542, data: 24_245, bss:  7_557, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P4', name: 'AutoCAD', custom: false,
    diskSize:   240_360,
    memSize:    436_201,
    segments: { header: HEADER_SIZE, code: 115_000, data: 123_470, bss:  1_123, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P5', name: 'Calculadora', custom: false,
    diskSize:    16_121,
    memSize:    209_462,
    segments: { header: HEADER_SIZE, code: 12_342, data:  1_256, bss:  1_756, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P6', name: 'p1 Grande', custom: false,
    diskSize:  3_800_767,
    memSize:   3_996_608,
    segments: { header: HEADER_SIZE, code: 525_000, data: 3_224_000, bss: 51_000, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P7', name: 'p2 Mediano', custom: false,
    diskSize:  1_589_767,
    memSize:   1_785_608,
    segments: { header: HEADER_SIZE, code: 590_000, data: 974_000, bss: 25_000, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P8', name: 'p3 Grande', custom: false,
    diskSize:  2_500_767,
    memSize:   2_696_608,
    segments: { header: HEADER_SIZE, code: 349_000, data: 2_150_000, bss:  1_000, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P9', name: 'Motor 3D', custom: false,
    diskSize:  20_000_000,
    memSize:   40_000_000,
    segments: { header: HEADER_SIZE, code: 10_000_000, data: 28_000_000, bss: 2_000_000, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
  {
    id: 'P10', name: 'Base de Datos', custom: false,
    diskSize:  50_000_000,
    memSize:  100_000_000,
    segments: { header: HEADER_SIZE, code: 15_000_000, data: 80_000_000, bss: 5_000_000, heap: HEAP_SIZE, stack: STACK_SIZE },
  },
];


/* ═══════════════════════════════════════════════
   SECCIÓN 3: PALETA Y UTILIDADES DE COLOR
═══════════════════════════════════════════════ */

let paletteIdx = 0;

function nextColor() {
  return INSTANCE_PALETTE[paletteIdx++ % INSTANCE_PALETTE.length];
}


/* ═══════════════════════════════════════════════
   SECCIÓN 4: ESTADO GLOBAL
═══════════════════════════════════════════════ */

/**
 * Estado global del simulador.
 *
 * pageSize:        tamaño de página en bytes (elige el usuario)
 * segBits:         bits dedicados al número de segmento
 * pageBits:        bits dedicados al número de página dentro del segmento
 * offsetBits:      bits del desplazamiento = log2(pageSize)
 *
 * frames: Array de marcos físicos.
 *   { frameNo, base, free, instanceId, segKey, pageNo }
 *
 * instances: Procesos cargados en RAM.
 *   Cada instancia:
 *   {
 *     id, progId, name, color,
 *     pageSize,
 *     segTable: [
 *       {
 *         segKey,   // 'header' | 'code' | 'data' | 'bss' | 'heap' | 'stack'
 *         segName,  // nombre visible: 'Header', '.text', etc.
 *         segNo,    // número lógico de segmento (0-based)
 *         size,     // tamaño del segmento en bytes
 *         pages,    // cantidad de páginas del segmento
 *         internalFrag, // fragmentación interna de la última página
 *         pageTable: [{ pageNo, frameNo, frameBase }]
 *       }
 *     ],
 *     totalPages,
 *     totalInternalFrag,
 *   }
 *
 * tableTab: 'seg' | 'pag' | 'addr'  (tab activa en la tabla)
 */
const state = {
  pageSize:        4_096,
  segBits:         10,
  pageBits:        10,
  offsetBits:      12,
  frames:          [],
  instances:       [],
  customPrograms:  [],
  customCounter:   0,
  instanceCounter: 0,
  selectedProg:    null,
  selectedInst:    null,
  tableTab:        'seg',
};


/* ═══════════════════════════════════════════════
   SECCIÓN 5: CÁLCULO DE BITS DE DIRECCIÓN
═══════════════════════════════════════════════ */

/**
 * Recalcula la distribución de bits según el tamaño de página.
 * Siempre:  segBits + pagBits + offsetBits = 32
 * offsetBits = log2(pageSize)
 * Los bits restantes se dividen en mitades iguales entre segmento y página.
 * Si el número restante es impar, la página toma 1 bit extra.
 */
function recalcBits() {
  const off = Math.log2(state.pageSize);  // siempre entero
  const rem = 32 - off;
  state.offsetBits = off;
  state.segBits    = Math.floor(rem / 2);
  state.pageBits   = rem - state.segBits; // puede tomar 1 bit extra
}


/* ═══════════════════════════════════════════════
   SECCIÓN 6: INICIALIZACIÓN
═══════════════════════════════════════════════ */

function init() {
  recalcBits();
  resetMemory(true);
  render();
}

/**
 * Reinicia la memoria al estado inicial.
 * Conserva programas personalizados y la selección de tamaño de página.
 */
function resetMemory(silent = false) {
  state.instances       = [];
  state.instanceCounter = 0;
  paletteIdx            = 0;
  state.selectedInst    = null;

  initFrames();

  if (!silent) {
    addLog('Memoria reseteada al estado inicial.', 'info');
  }
  render();
}

/**
 * Divide la RAM física en marcos de tamaño fijo.
 * Los primeros marcos quedan reservados para el SO.
 */
function initFrames() {
  const ps          = state.pageSize;
  const totalFrames = Math.floor(RAM / ps);
  const soFrames    = Math.ceil(SO_SIZE / ps);

  state.frames = [];
  for (let i = 0; i < totalFrames; i++) {
    state.frames.push({
      frameNo:    i,
      base:       i * ps,
      free:       i >= soFrames,
      instanceId: i < soFrames ? 'SO' : null,
      segKey:     null,
      pageNo:     null,
    });
  }
}


/* ═══════════════════════════════════════════════
   SECCIÓN 7: CAMBIO DE TAMAÑO DE PÁGINA
═══════════════════════════════════════════════ */

function onPageSizeChange() {
  state.pageSize = parseInt(document.getElementById('pageSizeSelect').value);
  recalcBits();
  addLog(
    `Tamaño de página: ${formatBytes(state.pageSize)} ` +
    `→ s=${state.segBits}b p=${state.pageBits}b d=${state.offsetBits}b`, 'info'
  );
  resetMemory(false);
  renderAddrBreakdown();
}


/* ═══════════════════════════════════════════════
   SECCIÓN 8: CARGA DE PROCESOS (SEGMENTACIÓN PAGINADA)

   Algoritmo:
     1. Para cada segmento del proceso:
        a. Calcular cuántas páginas necesita: ceil(segSize / pageSize).
        b. Verificar que haya marcos libres suficientes en total
           (no necesitan ser contiguos).
        c. Asignar los marcos y construir la tabla de páginas del segmento.
     2. Construir la tabla de segmentos del proceso.
     3. Registrar la instancia.

   NO existen algoritmos de ajuste (First/Best/Worst Fit) porque
   los marcos físicos son intercambiables: cualquier marco libre sirve
   para cualquier página, sin importar contigüidad.
═══════════════════════════════════════════════ */

/**
 * Carga un proceso en RAM usando Segmentación Paginada.
 * @param {Object} prog
 * @returns {boolean}
 */
function segPageLoad(prog) {
  const ps = state.pageSize;

  // Calcular páginas necesarias por segmento
  const segOrder  = ['header', 'code', 'data', 'bss', 'heap', 'stack'];
  const segNames  = {
    header: 'Header', code: '.text', data: '.data',
    bss: '.bss', heap: '.heap', stack: '.stack',
  };

  const segRequirements = segOrder.map((key, idx) => {
    const size = prog.segments[key];
    const pages = Math.ceil(size / ps);
    return { key, name: segNames[key], segNo: idx, size, pages };
  });

  const totalPagesNeeded = segRequirements.reduce((s, r) => s + r.pages, 0);
  const freeFrames = state.frames.filter(f => f.free);

  if (freeFrames.length < totalPagesNeeded) {
    addLog(
      `[SEG-PAG] Sin marcos suficientes para "${prog.name}". ` +
      `Necesita ${totalPagesNeeded} marcos, disponibles: ${freeFrames.length}.`, 'err'
    );
    return false;
  }

  const color  = nextColor();
  const instId = `I${++state.instanceCounter}`;

  // Puntero al siguiente marco libre disponible
  let freeFrameIdx = 0;
  const segTable   = [];
  let totalInternalFrag = 0;

  for (const req of segRequirements) {
    const pageTable      = [];
    const internalFrag   = (req.pages * ps) - req.size;
    totalInternalFrag   += internalFrag;

    for (let p = 0; p < req.pages; p++) {
      // Avanzar al siguiente marco realmente libre
      while (!freeFrames[freeFrameIdx].free) freeFrameIdx++;

      const frame          = freeFrames[freeFrameIdx];
      frame.free           = false;
      frame.instanceId     = instId;
      frame.segKey         = req.key;
      frame.pageNo         = p;

      pageTable.push({
        pageNo:    p,
        frameNo:   frame.frameNo,
        frameBase: frame.base,
      });

      freeFrameIdx++;
    }

    segTable.push({
      segKey:       req.key,
      segName:      req.name,
      segNo:        req.segNo,
      size:         req.size,
      pages:        req.pages,
      internalFrag,
      pageTable,
    });
  }

  const totalPages = segRequirements.reduce((s, r) => s + r.pages, 0);

  state.instances.push({
    id:               instId,
    progId:           prog.id,
    name:             prog.name,
    color,
    pageSize:         ps,
    segTable,
    totalPages,
    totalInternalFrag,
  });

  addLog(
    `[SEG-PAG] ${instId} "${prog.name}" cargado. ` +
    `${segTable.length} segmentos · ${totalPages} marcos usados · ` +
    `Frag. interna: ${formatBytes(totalInternalFrag)}.`, 'ok'
  );
  return true;
}

/**
 * Libera una instancia de segmentación paginada.
 * Devuelve todos sus marcos al pool libre.
 * @param {string} instId
 */
function segPageUnload(instId) {
  const inst = state.instances.find(i => i.id === instId);
  if (!inst) return;

  for (const frame of state.frames) {
    if (frame.instanceId === instId) {
      frame.free       = true;
      frame.instanceId = null;
      frame.segKey     = null;
      frame.pageNo     = null;
    }
  }

  state.instances = state.instances.filter(i => i.id !== instId);
  addLog(`[SEG-PAG] Instancia ${instId} "${inst.name}" liberada de RAM.`, 'ok');
}


/* ═══════════════════════════════════════════════
   SECCIÓN 9: TRADUCCIÓN DE DIRECCIÓN LÓGICA
   Dada una dirección virtual de 32 bits, obtiene
   la dirección física correspondiente en la instancia.
═══════════════════════════════════════════════ */

/**
 * Traduce una dirección lógica a física para una instancia.
 * @param {Object} inst - instancia
 * @param {number} logAddr - dirección lógica (0 – 0xFFFFFFFF)
 * @returns {{ segNo, pageNo, offset, frameNo, physAddr, segName } | null}
 */
function translateAddress(inst, logAddr) {
  const { segBits, pageBits, offsetBits } = state;
  const ps = inst.pageSize;

  // Extraer campos de la dirección lógica
  const offset  = logAddr & ((1 << offsetBits) - 1);
  const pageNo  = (logAddr >> offsetBits) & ((1 << pageBits) - 1);
  const segNo   = (logAddr >> (offsetBits + pageBits)) & ((1 << segBits) - 1);

  // Buscar segmento
  const seg = inst.segTable.find(s => s.segNo === segNo);
  if (!seg) return null;

  // Buscar entrada en la tabla de páginas del segmento
  const pageEntry = seg.pageTable.find(e => e.pageNo === pageNo);
  if (!pageEntry) return null;

  const physAddr = pageEntry.frameBase + offset;

  return {
    segNo,
    pageNo,
    offset,
    frameNo:  pageEntry.frameNo,
    physAddr,
    segName:  seg.segName,
  };
}


/* ═══════════════════════════════════════════════
   SECCIÓN 10: PROCESOS PERSONALIZADOS
═══════════════════════════════════════════════ */

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

function validateForm() {
  const errDiv = document.getElementById('formErr');
  const name   = document.getElementById('cName').value.trim();
  const code   = parseInt(document.getElementById('cCode').value) || 0;
  const data   = parseInt(document.getElementById('cData').value) || 0;
  const bss    = parseInt(document.getElementById('cBss').value)  || 0;

  const show = msg => { errDiv.textContent = msg; errDiv.style.display = 'block'; };
  const hide = ()  => { errDiv.style.display = 'none'; };

  if (!name)    { show('El nombre es obligatorio.'); return false; }
  if (code <= 0){ show('.text debe ser mayor a 0.'); return false; }
  if (data < 0 || bss < 0) { show('.data y .bss no pueden ser negativos.'); return false; }

  const total = HEADER_SIZE + code + data + bss + HEAP_SIZE + STACK_SIZE;
  if (total > RAM - SO_SIZE) {
    show(`El proceso (${formatBytes(total)}) excede la RAM disponible.`);
    return false;
  }

  const dup = state.customPrograms.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (dup) { show(`Ya existe un proceso llamado "${name}".`); return false; }

  hide();
  return true;
}

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
    segments: { header: HEADER_SIZE, code, data, bss, heap: HEAP_SIZE, stack: STACK_SIZE },
  });

  addLog(`[CUSTOM] "${name}" (${id}) creado. RAM: ${formatBytes(memSize)}.`, 'info');
  clearForm();
  render();
}

function removeCustomProgram(progId) {
  const insts = state.instances.filter(i => i.progId === progId);
  for (const inst of insts) segPageUnload(inst.id);

  state.customPrograms = state.customPrograms.filter(p => p.id !== progId);
  if (state.selectedProg === progId) state.selectedProg = null;

  addLog(`[CUSTOM] Proceso ${progId} eliminado.`, 'warn');
  render();
}

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
   SECCIÓN 11: ACCIONES DE INTERFAZ
═══════════════════════════════════════════════ */

function loadSelectedProgram() {
  if (!state.selectedProg) {
    addLog('Selecciona un programa antes de cargarlo.', 'warn');
    return;
  }

  const allProgs = [...PROGRAMS, ...state.customPrograms];
  const prog = allProgs.find(p => p.id === state.selectedProg);
  if (!prog) return;

  if (segPageLoad(prog)) render();
}

function unloadSelectedInstance() {
  if (!state.selectedInst) {
    addLog('Selecciona una instancia en RAM para terminarla.', 'warn');
    return;
  }
  segPageUnload(state.selectedInst);
  state.selectedInst = null;
  render();
}

function clearLog() {
  document.getElementById('logList').innerHTML = '';
}

function setTableTab(tab) {
  state.tableTab = tab;
  document.querySelectorAll('.tbl-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderAddressTable();
}


/* ═══════════════════════════════════════════════
   SECCIÓN 12: RENDERIZADO GENERAL
═══════════════════════════════════════════════ */

function render() {
  renderProgramsList();
  renderInstancesList();
  renderMemoryMap();
  renderAddressTable();
  renderInstanceDetail();
  renderStats();
  renderChipRam();
  renderAddrBreakdown();
}

/** Actualiza el chip de RAM libre en el header. */
function renderChipRam() {
  const usedFrames = state.frames.filter(f => !f.free).length;
  const usedBytes  = usedFrames * state.pageSize;
  const freeBytes  = RAM - usedBytes;
  const pct        = (usedBytes / RAM * 100).toFixed(1);

  document.getElementById('chipRamFree').textContent = `Libre: ${formatBytes(freeBytes)}`;
  document.getElementById('barUsed').style.width = pct + '%';
}

/** Calcula bytes de RAM en uso (SO + instancias). */
function calcUsedRam() {
  return state.frames.filter(f => !f.free).length * state.pageSize;
}

/**
 * Renderiza el desglose visual de bits de dirección en el sidebar.
 */
function renderAddrBreakdown() {
  const el = document.getElementById('addrBreakdown');
  if (!el) return;

  const { segBits, pageBits, offsetBits } = state;
  const total = 32;

  const segPct  = (segBits    / total * 100).toFixed(1);
  const pagPct  = (pageBits   / total * 100).toFixed(1);
  const offPct  = (offsetBits / total * 100).toFixed(1);

  el.innerHTML = `
    <div class="addr-bits-row">
      <div class="addr-bits-seg"  style="width:${segPct}%"  title="${segBits} bits de segmento">s=${segBits}b</div>
      <div class="addr-bits-page" style="width:${pagPct}%"  title="${pagBits} bits de página">p=${pageBits}b</div>
      <div class="addr-bits-off"  style="width:${offPct}%"  title="${offsetBits} bits de offset">d=${offsetBits}b</div>
    </div>
    <div class="addr-bits-legend">
      <span><span class="dot" style="background:#bc8cff"></span>s: ${segBits}b → ${Math.pow(2,segBits).toLocaleString()} segs</span>
      <span><span class="dot" style="background:#388bfd"></span>p: ${pagBits}b → ${Math.pow(2,pagBits).toLocaleString()} págs/seg</span>
      <span><span class="dot" style="background:#3fb950"></span>d: ${offsetBits}b → ${formatBytes(state.pageSize)}/pág</span>
    </div>
  `;
}


/* ═══════════════════════════════════════════════
   SECCIÓN 13: LISTA DE PROGRAMAS E INSTANCIAS
═══════════════════════════════════════════════ */

function renderProgramsList() {
  const container = document.getElementById('programsList');
  container.innerHTML = '';

  const allProgs = [...PROGRAMS, ...state.customPrograms];

  for (const prog of allProgs) {
    const selected    = state.selectedProg === prog.id;
    const activeCount = state.instances.filter(i => i.progId === prog.id).length;

    const card = document.createElement('div');
    card.className = 'prog-card' +
      (prog.custom  ? ' custom-prog' : '') +
      (selected     ? ' selected'    : '');
    card.onclick = () => {
      state.selectedProg = prog.id;
      renderProgramsList();
    };

    const segs  = prog.segments;
    const total = Object.values(segs).reduce((s, v) => s + v, 0);
    const barParts = Object.entries(segs).map(([k, v]) =>
      `<div class="mini-seg-part" style="flex:${v/total*100};background:${SEG_COLORS[k]}"
            title="${k}: ${formatBytes(v)}"></div>`
    ).join('');

    const badge    = activeCount > 0
      ? `<span class="prog-badge">${activeCount}×</span>`
      : '';
    const btnRemove = prog.custom
      ? `<button class="btn-remove" onclick="event.stopPropagation();removeCustomProgram('${prog.id}')"
                 title="Eliminar">×</button>`
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

    const usedBytes = inst.totalPages * inst.pageSize;

    card.innerHTML = `
      <div class="inst-name">
        <span style="display:inline-block;width:9px;height:9px;border-radius:2px;
                     background:${inst.color};margin-right:6px;vertical-align:middle;"></span>
        ${inst.id} — ${inst.name}
      </div>
      <div class="inst-meta">
        ${formatBytes(usedBytes)} · ${inst.segTable.length} segs · ${inst.totalPages} marcos
      </div>
    `;

    container.appendChild(card);
  }
}


/* ═══════════════════════════════════════════════
   SECCIÓN 14: MAPA DE MEMORIA FÍSICA
═══════════════════════════════════════════════ */

function renderMemoryMap() {
  const MAP_H = 520;

  const addrCol   = document.getElementById('addrCol');
  const memCol    = document.getElementById('memCol');
  const legendCol = document.getElementById('legendCol');

  addrCol.style.height = MAP_H + 'px';
  memCol.style.height  = MAP_H + 'px';
  addrCol.innerHTML    = '';
  memCol.innerHTML     = '';
  legendCol.innerHTML  = '';

  const ps = state.pageSize;

  // ── Construir bandas de marcos contiguos del mismo propietario ──────
  // Agrupar marcos consecutivos del mismo instanceId+segKey en bandas.
  const bands = [];
  let currentBand = null;

  for (const frame of state.frames) {
    const key = frame.instanceId ? `${frame.instanceId}:${frame.segKey || ''}` : 'free';

    if (currentBand && currentBand.key === key) {
      currentBand.frames.push(frame);
    } else {
      currentBand = { key, instanceId: frame.instanceId, segKey: frame.segKey, frames: [frame] };
      bands.push(currentBand);
    }
  }

  // ── Etiquetas de dirección física ──────────────────────────────────
  // Mostrar ~10 etiquetas distribuidas
  const step = Math.floor(RAM / (MAP_H / 52));
  const keyAddrs = [];
  for (let a = 0; a <= RAM; a += step) keyAddrs.push(Math.min(a, RAM - 1));
  keyAddrs.push(SO_SIZE);
  const uniqueAddrs = [...new Set(keyAddrs)].sort((a, b) => a - b);

  for (const addr of uniqueAddrs) {
    const lbl = document.createElement('div');
    lbl.className = 'addr-label';
    lbl.style.bottom = (addr / RAM * MAP_H) + 'px';
    lbl.textContent  = hexPhys(addr);
    addrCol.appendChild(lbl);
  }

  // ── Bloques del mapa (de mayor a menor dirección = top a bottom) ───
  const bandsDesc = [...bands].reverse();

  for (const band of bandsDesc) {
    const bandFrames = band.frames.length;
    const bandBytes  = bandFrames * ps;
    const h          = Math.max((bandBytes / RAM) * MAP_H, 3);

    const isSO   = band.instanceId === 'SO';
    const isFree = !band.instanceId;
    const inst   = (!isSO && !isFree)
      ? state.instances.find(i => i.id === band.instanceId)
      : null;

    let color;
    if (isSO)   color = '#21262d';
    else if (isFree) color = '#1c2330';
    else {
      // Usar color del tipo de segmento, con tinte del color de instancia
      color = SEG_COLORS[band.segKey] || inst?.color || '#ccc';
    }

    const blk = document.createElement('div');
    blk.className = 'mem-block';
    blk.style.height     = h + 'px';
    blk.style.background = color;
    blk.style.color      = isFree || isSO ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.9)';

    // Borde izquierdo con color de instancia
    if (inst) {
      blk.style.borderLeft = `3px solid ${inst.color}`;
    }

    // Tooltip
    const baseAddr = band.frames[0].base;
    const endAddr  = band.frames[band.frames.length - 1].base + ps - 1;
    blk.title = isSO
      ? `S.O. | ${hexPhys(baseAddr)}–${hexPhys(endAddr)} | ${formatBytes(bandBytes)}`
      : isFree
      ? `LIBRE | ${bandFrames} marco(s) | ${hexPhys(baseAddr)}–${hexPhys(endAddr)} | ${formatBytes(bandBytes)}`
      : `${inst?.id} ${inst?.name} | SEG:${band.segKey} | ${bandFrames} marco(s) | ${hexPhys(baseAddr)}–${hexPhys(endAddr)}`;

    // Etiqueta interna
    if (h >= 14) {
      const lbl = document.createElement('div');
      lbl.className = 'mem-block-lbl';
      if (isSO) {
        lbl.textContent = 'S.O.';
        lbl.style.color = 'rgba(255,255,255,0.35)';
      } else if (isFree) {
        lbl.innerHTML = h >= 24
          ? `LIBRE<br><span style="font-size:8px;opacity:0.5">${formatBytes(bandBytes)}</span>`
          : 'LIBRE';
        lbl.style.color = 'rgba(255,255,255,0.3)';
      } else {
        const segLabel = band.segKey ? segDispName(band.segKey) : '';
        lbl.innerHTML = h >= 30
          ? `<strong>${inst?.id}</strong><br>
             <span style="font-size:8px">${segLabel}</span><br>
             <span style="font-size:7.5px;opacity:0.7">${hexPhys(baseAddr)}</span>`
          : h >= 18
          ? `${inst?.id} ${segLabel}`
          : inst?.id || '';
      }
      blk.appendChild(lbl);
    }

    memCol.appendChild(blk);
  }

  // ── Leyenda de instancias ───────────────────────────────────────────
  const seen = new Set();
  for (const inst of state.instances) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);

    const usedFrames = state.frames.filter(f => f.instanceId === inst.id).length;

    // Mini chips de segmentos con sus colores
    const segChips = inst.segTable.map(s =>
      `<span class="legend-seg-chip" style="background:${SEG_COLORS[s.segKey]}"
             title="${s.segName}: ${s.pages} págs">${s.segName}</span>`
    ).join('');

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-dot" style="background:${inst.color}"></div>
      <div>
        <strong>${inst.id}</strong> ${inst.name}<br>
        <span class="text-muted">${inst.totalPages} marcos · ${formatBytes(inst.totalInternalFrag)} frag.</span>
        <div class="legend-segs">${segChips}</div>
      </div>
    `;
    legendCol.appendChild(item);
  }

  if (state.instances.length === 0) {
    legendCol.innerHTML = '<div class="text-muted text-sm">Sin instancias en RAM.</div>';
  }
}


/* ═══════════════════════════════════════════════
   SECCIÓN 15: TABLA DE TRADUCCIÓN (3 vistas)

   Tab "seg":  Tabla de segmentos (segNo, nombre, base lógica, páginas, frag)
   Tab "pag":  Tabla de páginas   (instancia | segmento | página lógica → marco físico)
   Tab "addr": Ejemplo de traducción de una dirección lógica de prueba
═══════════════════════════════════════════════ */

function renderAddressTable() {
  const head = document.getElementById('addrTableHead');
  const body = document.getElementById('addrTableBody');
  const sub  = document.getElementById('tableSubtitle');

  head.innerHTML = '';
  body.innerHTML = '';

  const tab = state.tableTab;

  if (tab === 'seg')  renderSegTableView(head, body, sub);
  else if (tab === 'pag')  renderPageTableView(head, body, sub);
  else if (tab === 'addr') renderAddrTranslationView(head, body, sub);
}

/**
 * Vista: Tabla de Segmentos
 * Una fila por segmento de cada instancia.
 * Muestra: instancia | nº seg | nombre | tamaño | páginas | frag. interna
 */
function renderSegTableView(head, body, sub) {
  head.innerHTML = `<tr>
    <th>Instancia</th>
    <th>Seg #</th>
    <th>Nombre</th>
    <th>Tamaño</th>
    <th>Páginas</th>
    <th>Frag. Interna</th>
  </tr>`;

  const target = state.selectedInst
    ? state.instances.filter(i => i.id === state.selectedInst)
    : state.instances;

  sub.textContent = state.selectedInst
    ? `Instancia ${state.selectedInst}`
    : `${state.instances.length} instancia(s)`;

  if (target.length === 0) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">
      Sin instancias en RAM.</td></tr>`;
    return;
  }

  for (const inst of target) {
    inst.segTable.forEach((seg, i) => {
      const tr = document.createElement('tr');
      if (inst.id === state.selectedInst) tr.className = 'row-selected';

      const dotHtml = i === 0
        ? `<span class="tbl-color-dot" style="background:${inst.color}"></span>${inst.id} ${inst.name}`
        : '';

      tr.innerHTML = `
        <td>${dotHtml}</td>
        <td class="seg-cell">${seg.segNo}</td>
        <td style="font-family:var(--font-mono);font-size:10.5px;color:var(--orange)">${seg.segName}</td>
        <td>${formatBytes(seg.size)}</td>
        <td class="mono-cell">${seg.pages}</td>
        <td style="color:${seg.internalFrag > 0 ? 'var(--amber)' : 'var(--green)'};
                   font-family:var(--font-mono);font-size:10.5px">
          ${formatBytes(seg.internalFrag)}
        </td>
      `;
      body.appendChild(tr);
    });

    if (target.length > 1) {
      const sep = document.createElement('tr');
      sep.innerHTML = `<td colspan="6" style="height:3px;background:var(--surface2)"></td>`;
      body.appendChild(sep);
    }
  }
}

/**
 * Vista: Tabla de Páginas
 * Una fila por página de cada segmento.
 * Muestra: instancia | segmento | pág. lógica | marco físico | dir. física base
 */
function renderPageTableView(head, body, sub) {
  head.innerHTML = `<tr>
    <th>Instancia</th>
    <th>Segmento</th>
    <th>Pág. Lógica</th>
    <th>Marco Físico</th>
    <th>Dir. Física (base)</th>
  </tr>`;

  const target = state.selectedInst
    ? state.instances.filter(i => i.id === state.selectedInst)
    : state.instances;

  sub.textContent = state.selectedInst
    ? `Instancia ${state.selectedInst} — ${formatBytes(state.pageSize)}/pág.`
    : `${state.instances.length} instancia(s) — ${formatBytes(state.pageSize)}/pág.`;

  if (target.length === 0) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">
      Sin instancias en RAM.</td></tr>`;
    return;
  }

  for (const inst of target) {
    let firstInInst = true;

    for (const seg of inst.segTable) {
      // Fila de cabecera del segmento
      const segHead = document.createElement('tr');
      segHead.className = 'seg-header-row';
      segHead.children; // placeholder

      const segTr = document.createElement('tr');
      segTr.className = 'seg-header-row';
      segTr.style.borderLeftColor = SEG_COLORS[seg.segKey] || inst.color;

      const instLabel = firstInInst
        ? `<span class="tbl-color-dot" style="background:${inst.color}"></span>${inst.id} ${inst.name}`
        : '';
      firstInInst = false;

      segTr.innerHTML = `
        <td colspan="2" style="border-left:3px solid ${SEG_COLORS[seg.segKey]};padding-left:14px">
          ${instLabel ? `<span style="font-size:10px;color:var(--text2);margin-right:8px">${instLabel}</span>` : ''}
          <span style="color:var(--orange);font-size:10.5px">Seg ${seg.segNo}: ${seg.segName}</span>
          <span class="text-muted" style="font-size:9.5px;margin-left:6px">(${seg.pages} págs)</span>
        </td>
        <td colspan="3" style="border-left:3px solid ${SEG_COLORS[seg.segKey]};
            color:var(--text2);font-size:9.5px">
          Tamaño: ${formatBytes(seg.size)} · Frag: ${formatBytes(seg.internalFrag)}
        </td>
      `;
      body.appendChild(segTr);

      // Filas de páginas del segmento
      for (const entry of seg.pageTable) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td></td>
          <td style="border-left:3px solid ${SEG_COLORS[seg.segKey]};
              font-size:9px;color:var(--text3);padding-left:14px">
            ↳ pág ${entry.pageNo}
          </td>
          <td class="mono-cell">${entry.pageNo}</td>
          <td class="mono-cell">${entry.frameNo}</td>
          <td class="mono-cell">${hexPhys(entry.frameBase)}</td>
        `;
        body.appendChild(tr);
      }
    }

    if (target.length > 1) {
      const sep = document.createElement('tr');
      sep.innerHTML = `<td colspan="5" style="height:4px;background:var(--surface2)"></td>`;
      body.appendChild(sep);
    }
  }
}

/**
 * Vista: Ejemplo de traducción de dirección
 * Muestra la traducción de varias direcciones lógicas de ejemplo
 * para la instancia seleccionada.
 */
function renderAddrTranslationView(head, body, sub) {
  head.innerHTML = `<tr>
    <th>Dir. Lógica (32b)</th>
    <th>Seg #</th>
    <th>Pág #</th>
    <th>Offset</th>
    <th>Marco Físico</th>
    <th>Dir. Física</th>
  </tr>`;

  if (!state.selectedInst) {
    sub.textContent = 'Selecciona instancia';
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">
      Selecciona una instancia para ver la traducción de direcciones.</td></tr>`;
    return;
  }

  const inst = state.instances.find(i => i.id === state.selectedInst);
  if (!inst) return;

  sub.textContent = `Instancia ${inst.id}`;

  // Generar direcciones de ejemplo: inicio de cada segmento + medio + fin
  const exampleLogAddrs = [];
  const { segBits, pageBits, offsetBits } = state;

  for (const seg of inst.segTable) {
    // Construir dirección lógica para la primera página del segmento
    const logBase = (seg.segNo << (pageBits + offsetBits));
    exampleLogAddrs.push({ addr: logBase, label: `Inicio ${seg.segName}` });

    // Dirección en la mitad del segmento
    const midByte  = Math.floor(seg.size / 2);
    const midPage  = Math.floor(midByte / inst.pageSize);
    const midOff   = midByte % inst.pageSize;
    const midAddr  = logBase + (midPage << offsetBits) + midOff;
    exampleLogAddrs.push({ addr: midAddr, label: `Medio ${seg.segName}` });
  }

  for (const { addr, label } of exampleLogAddrs) {
    const result = translateAddress(inst, addr);
    if (!result) continue;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="mono-cell" style="font-size:10px">${hexLog(addr)}</span>
        <span style="font-size:9px;color:var(--text2);display:block">${label}</span>
      </td>
      <td class="seg-cell">${result.segNo}</td>
      <td class="mono-cell">${result.pageNo}</td>
      <td class="mono-cell">+${result.offset}</td>
      <td class="mono-cell">${result.frameNo}</td>
      <td class="mono-cell">${hexPhys(result.physAddr)}</td>
    `;
    body.appendChild(tr);
  }
}


/* ═══════════════════════════════════════════════
   SECCIÓN 16: DETALLES DE INSTANCIA
═══════════════════════════════════════════════ */

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
  const usedRAM = inst.totalPages * inst.pageSize;

  // Barra proporcional de segmentos
  const totalSize = inst.segTable.reduce((s, seg) => s + seg.size, 0);
  const barParts = inst.segTable.map(seg =>
    `<div class="seg-detail-part"
          style="flex:${seg.size/totalSize*100};background:${SEG_COLORS[seg.segKey]}"
          title="${seg.segName}: ${formatBytes(seg.size)}"></div>`
  ).join('');

  // Tabla mini de segmentos
  const segRows = inst.segTable.map(seg => `
    <tr>
      <td><span style="display:inline-block;width:7px;height:7px;border-radius:2px;
        background:${SEG_COLORS[seg.segKey]};margin-right:4px;vertical-align:middle"></span>${seg.segName}</td>
      <td>${formatBytes(seg.size)}</td>
      <td class="mono-cell">${seg.pages}</td>
      <td style="color:${seg.internalFrag>0?'var(--amber)':'var(--green)'};
                 font-family:var(--font-mono);font-size:10px">
        ${formatBytes(seg.internalFrag)}
      </td>
    </tr>
  `).join('');

  // Bits de dirección lógica
  const { segBits, pageBits, offsetBits } = state;

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
      <span class="detail-key">RAM ocupada</span>
      <span class="detail-value">${formatBytes(usedRAM)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Tamaño de página</span>
      <span class="detail-value">${formatBytes(inst.pageSize)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Dir. lógica (s/p/d)</span>
      <span class="detail-value" style="color:var(--text2);font-size:10px">
        ${segBits}b / ${pageBits}b / ${offsetBits}b
      </span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Segmentos</span>
      <span class="detail-value">${inst.segTable.length}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Marcos totales</span>
      <span class="detail-value">${inst.totalPages}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Frag. interna total</span>
      <span class="detail-value" style="color:${inst.totalInternalFrag>0?'var(--amber)':'var(--green)'}">
        ${formatBytes(inst.totalInternalFrag)}
      </span>
    </div>
    <div class="seg-detail-bar">${barParts}</div>
    <table class="seg-mini-table">
      <tr>
        <th>Segmento</th><th>Tamaño</th><th>Págs</th><th>Frag.</th>
      </tr>
      ${segRows}
    </table>
  `;
}


/* ═══════════════════════════════════════════════
   SECCIÓN 17: ESTADÍSTICAS
═══════════════════════════════════════════════ */

function renderStats() {
  const panel = document.getElementById('statsPanel');

  const usedBytes = calcUsedRam();
  const freeBytes = RAM - usedBytes;
  const usedPct   = (usedBytes / RAM * 100).toFixed(1);

  const totalInternalFrag = state.instances.reduce(
    (s, inst) => s + inst.totalInternalFrag, 0
  );

  const freeFrames = state.frames.filter(f => f.free).length;
  const totalFrames = state.frames.length;
  const soFrames   = Math.ceil(SO_SIZE / state.pageSize);

  const totalPages = state.instances.reduce((s, inst) => s + inst.totalPages, 0);
  const maxSegPerProc = state.instances.reduce(
    (mx, inst) => Math.max(mx, inst.segTable.length), 0
  );

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
      <span class="stat-value">${state.instances.length}</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Frag. Interna total</span>
      <span class="stat-value ${totalInternalFrag > 0 ? 'amber' : 'green'}">${formatBytes(totalInternalFrag)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Frag. Externa</span>
      <span class="stat-value green">0 B (ninguna)</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Marcos libres / total</span>
      <span class="stat-value">${freeFrames.toLocaleString()} / ${totalFrames.toLocaleString()}</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Marcos usados por procs.</span>
      <span class="stat-value">${totalPages.toLocaleString()}</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Tam. de página activo</span>
      <span class="stat-value">${formatBytes(state.pageSize)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Bits addr. (s/p/d)</span>
      <span class="stat-value" style="font-size:11px;color:var(--text2);font-family:var(--font-mono)">
        ${state.segBits}/${state.pageBits}/${state.offsetBits}
      </span>
    </div>
  `;
}


/* ═══════════════════════════════════════════════
   SECCIÓN 18: LOG DE EVENTOS
═══════════════════════════════════════════════ */

function addLog(msg, type) {
  const list = document.getElementById('logList');
  const li   = document.createElement('li');
  li.className = 'log-item';

  const t   = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const cls = type === 'ok'   ? 'log-ok'
            : type === 'err'  ? 'log-err'
            : type === 'warn' ? 'log-warn'
            :                   'log-info';

  li.innerHTML = `<span class="log-time">[${t}]</span><span class="${cls}">${msg}</span>`;
  list.insertBefore(li, list.firstChild);

  if (list.children.length > 100) list.removeChild(list.lastChild);
}


/* ═══════════════════════════════════════════════
   SECCIÓN 19: HELPERS DE FORMATO
═══════════════════════════════════════════════ */

/**
 * Dirección física en hexadecimal (8 dígitos, 32 bits).
 * RAM física es de 29 bits, pero formateamos con 8 por claridad.
 */
function hexPhys(n) {
  return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Dirección lógica en hexadecimal (8 dígitos, 32 bits completos).
 */
function hexLog(n) {
  return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Formatea bytes a la unidad más legible (B / KiB / MiB / GiB).
 */
function formatBytes(b) {
  if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(2) + ' GiB';
  if (b >= 1_048_576)     return (b / 1_048_576).toFixed(2)     + ' MiB';
  if (b >= 1_024)         return (b / 1_024).toFixed(1)         + ' KiB';
  return b + ' B';
}

/**
 * Nombre de visualización corto del tipo de segmento.
 */
function segDispName(segKey) {
  const map = {
    header: 'Header', code: '.text', data: '.data',
    bss: '.bss', heap: '.heap', stack: '.stack',
  };
  return map[segKey] || segKey;
}


/* ═══════════════════════════════════════════════
   SECCIÓN 20: ARRANQUE
═══════════════════════════════════════════════ */
window.onload = () => {
  init();
  addLog('Sistema iniciado. RAM física: 512 MiB (0x00000000 – 0x1FFFFFFF)', 'info');
  addLog(`S.O. ocupa ${formatBytes(SO_SIZE)} (${hexPhys(0)} – ${hexPhys(SO_SIZE - 1)})`, 'info');
  addLog(`Espacio lógico por proceso: 4 GiB (0x00000000 – 0xFFFFFFFF)`, 'info');
  addLog(
    `División de dirección (4 KiB/pág): s=${state.segBits}b · p=${state.pageBits}b · d=${state.offsetBits}b`,
    'info'
  );
  addLog('Selecciona un programa y presiona "Cargar en RAM".', 'info');
};
