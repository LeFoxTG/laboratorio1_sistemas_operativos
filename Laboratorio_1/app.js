class BCP {
  constructor(id, nombre, tiempoTotal) {
    this.id = id;
    this.nombre = nombre;
    this.estado = "Listo";
    this.tiempoTotal = tiempoTotal;
    this.tiempoEjecutado = 0;
  }
}

// Procesos iniciales
const procesosPorDefecto = [
  new BCP("P1", "Navegador Web", 5),
  new BCP("P2", "Reproductor de Música", 3),
  new BCP("P3", "Antivirus", 7),
  new BCP("P4", "Editor de Texto", 4),
  new BCP("P5", "Actualizador del Sistema", 6)
];

let colaListos = [...procesosPorDefecto];
let procesoEnCPU = null;
let colaBloqueados = [];
let colaTerminados = [];


// =============================
// ACTUALIZAR INTERFAZ
// =============================

function actualizarPantalla() {

  const cajaListos = document.getElementById("caja-listos");
  const cajaCPU = document.getElementById("caja-cpu");
  const cajaBloqueados = document.getElementById("caja-bloqueados");
  const cajaTerminados = document.getElementById("caja-terminados");

  cajaListos.innerHTML = "";
  cajaCPU.innerHTML = "";
  cajaBloqueados.innerHTML = "";
  cajaTerminados.innerHTML = "";

  // LISTOS
  colaListos.forEach(p => {
    cajaListos.innerHTML += `
      <div class="tarjeta-proceso" style="border-left-color:#2196F3;">
        <strong>${p.id} - ${p.nombre}</strong>
        <span>${p.tiempoEjecutado}/${p.tiempoTotal} tics</span>
      </div>
    `;
  });

  // CPU
  if (procesoEnCPU) {
    cajaCPU.innerHTML = `
      <div class="tarjeta-proceso" style="border-left-color:#4CAF50;">
        <strong>${procesoEnCPU.id} - ${procesoEnCPU.nombre}</strong>
        <span>${procesoEnCPU.tiempoEjecutado}/${procesoEnCPU.tiempoTotal} tics</span>
      </div>
    `;
  }

  // BLOQUEADOS
  colaBloqueados.forEach(p => {
    cajaBloqueados.innerHTML += `
      <div class="tarjeta-proceso" style="border-left-color:#FF9800;">
        <strong>${p.id} - ${p.nombre}</strong>
      </div>
    `;
  });

  // TERMINADOS
  colaTerminados.forEach(p => {
    cajaTerminados.innerHTML += `
      <div class="tarjeta-proceso" style="border-left-color:#9E9E9E;">
        <strong>${p.id} - ${p.nombre}</strong>
      </div>
    `;
  });

}



// =============================
// RELOJ DEL SISTEMA
// =============================

function ticSistema() {

  // Si CPU está vacía tomar proceso de listos
  if (!procesoEnCPU && colaListos.length > 0) {
    procesoEnCPU = colaListos.shift();
    procesoEnCPU.estado = "Ejecutando";
  }

  if (procesoEnCPU) {

    procesoEnCPU.tiempoEjecutado++;

    // Si terminó
    if (procesoEnCPU.tiempoEjecutado >= procesoEnCPU.tiempoTotal) {

      procesoEnCPU.estado = "Terminado";
      colaTerminados.push(procesoEnCPU);
      procesoEnCPU = null;

    }
  }

  actualizarPantalla();
}



// =============================
// BLOQUEAR PROCESO
// =============================

function bloquearProceso() {

  if (procesoEnCPU) {

    procesoEnCPU.estado = "Bloqueado";
    colaBloqueados.push(procesoEnCPU);
    procesoEnCPU = null;

    actualizarPantalla();
  }
}



// =============================
// DESBLOQUEAR
// =============================

function desbloquearProceso() {

  if (colaBloqueados.length > 0) {

    let p = colaBloqueados.shift();
    p.estado = "Listo";
    colaListos.push(p);

    actualizarPantalla();
  }
}

// =============================
// AGREGAR PROCESO PERSONALIZADO
// =============================

// Llevamos la cuenta del ID para los nuevos procesos (empezamos en 6 porque ya tienes 5)
let contadorProcesos = 6; 

function agregarProceso() {
  // 1. Capturar los valores de los inputs
  const inputNombre = document.getElementById("input-nombre");
  const inputTiempo = document.getElementById("input-tiempo");
  
  const nombre = inputNombre.value;
  const tiempo = parseInt(inputTiempo.value); // Convertir a número

  // 2. Validar que el usuario haya ingresado un tiempo válido
  if (isNaN(tiempo) || tiempo <= 0) {
    alert("Por favor, ingresa un número de tics válido (mayor a 0).");
    return; // Detiene la ejecución si hay error
  }

  // 3. Crear el nombre final (si lo deja vacío, le asignamos uno genérico)
  const nombreFinal = nombre.trim() !== "" ? nombre : `Proceso ${contadorProcesos}`;

  // 4. Crear el nuevo BCP
  const nuevoProceso = new BCP(
    `P${contadorProcesos}`, 
    nombreFinal, 
    tiempo
  );

  // 5. Añadirlo a la cola de listos
  colaListos.push(nuevoProceso);

  // 6. Aumentar el contador para el siguiente proceso
  contadorProcesos++;

  // 7. Limpiar los campos del formulario
  inputNombre.value = "";
  inputTiempo.value = "";

  // 8. Actualizar la pantalla para que aparezca la nueva tarjeta
  actualizarPantalla();
}

// =============================
// INICIAR SIMULACION AUTOMATICA
// =============================

let reloj = null;

function iniciarSimulacion() {

  if (!reloj) {
    reloj = setInterval(ticSistema, 1000);
  }

}

function detenerSimulacion() {

  clearInterval(reloj);
  reloj = null;

}

actualizarPantalla();
