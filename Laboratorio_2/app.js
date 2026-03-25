class Proceso {
  constructor(id, nombre, tiempo) {
    this.id = id;
    this.nombre = nombre;
    this.tiempoTotal = tiempo;
    this.tiempoEjecutado = 0;
    this.tiempoEspera = 0;
    this.primeraVezEnCPU = true;
    this.tiempoRespuesta = 0;
  }
}

let contador = 1;

let nuevos = [
  new Proceso(contador++, "Navegador", 5),
  new Proceso(contador++, "Musica", 3),
  new Proceso(contador++, "Antivirus", 7)
];

let bloqueados = [];
let listos = [];
let cpu = null;
let terminados = [];
let gantt = [];
let reloj = null;

// COLORES
function color(id){
  const colores = ["#2196F3","#4CAF50","#FF9800","#9C27B0","#E91E63"];
  return colores[id % colores.length];
}

function bloquear(){
  if(cpu){
    bloqueados.push(cpu);
    cpu = null;
    render();
  }
}

function desbloquear(){
  if(bloqueados.length > 0){
    let p = bloqueados.shift();
    listos.push(p);
    render();
  }
}

// AGREGAR PROCESO
function agregarProceso(){
  let nombre = document.getElementById("nombre").value;
  let tiempo = parseInt(document.getElementById("tiempo").value);

  if(!tiempo || tiempo <= 0) return alert("Tiempo inválido");

  if(nombre.trim() === "") nombre = "Proceso " + contador;

  nuevos.push(new Proceso(contador++, nombre, tiempo));

  document.getElementById("nombre").value = "";
  document.getElementById("tiempo").value = "";

  render();
}

// TICK
function tic(){
  let alg = document.getElementById("algoritmo").value;

  // 1. LLEGADAS: Todos los procesos nuevos entran a la cola de listos al mismo tiempo
  while(nuevos.length > 0){
    listos.push(nuevos.shift());
  }

  // 2. PLANIFICADOR (Selección de CPU)
  if(alg === "FCFS"){
    if(!cpu && listos.length > 0){
      cpu = listos.shift();
    }
  }

  if(alg === "SJF"){
    if(!cpu && listos.length > 0){
      listos.sort((a,b) => a.tiempoTotal - b.tiempoTotal);
      cpu = listos.shift();
    }
  }

  if(alg === "SRTF"){
    // Ordenamos por tiempo restante
    listos.sort((a,b) => (a.tiempoTotal - a.tiempoEjecutado) - (b.tiempoTotal - b.tiempoEjecutado));

    if(!cpu && listos.length > 0){
      cpu = listos.shift();
    }
    else if(cpu && listos.length > 0){
      let r1 = cpu.tiempoTotal - cpu.tiempoEjecutado; // Restante del actual
      let r2 = listos[0].tiempoTotal - listos[0].tiempoEjecutado; // Restante del primero en cola

      if(r2 < r1){
        // ¡Expropiación! El de la CPU vuelve a listos y el nuevo entra
        listos.push(cpu);
        cpu = listos.shift();
      }
    }
  }

  // 3. ACTUALIZAR TIEMPOS DE ESPERA
  // Solo le sumamos espera a los que se quedaron en la cola de listos
  listos.forEach(p => p.tiempoEspera++);

  // 4. EJECUCIÓN EN CPU
  if(cpu){
    // Registrar el tiempo de respuesta real (antes de sumar ejecución)
    if(cpu.primeraVezEnCPU){
      cpu.tiempoRespuesta = cpu.tiempoEspera;
      cpu.primeraVezEnCPU = false;
    }

    cpu.tiempoEjecutado++;
    gantt.push(cpu);

    // ¿Terminó?
    if(cpu.tiempoEjecutado >= cpu.tiempoTotal){
      terminados.push(cpu);
      cpu = null;
    }
  } else {
    gantt.push(null); // Idle
  }

  render();
}

// REINICIAR SIMULACIÓN
function reiniciar(){
  detener(); // Pausa el reloj si estaba corriendo
  contador = 1;

  // Restauramos los 3 procesos iniciales
  nuevos = [
    new Proceso(contador++, "Navegador", 5),
    new Proceso(contador++, "Musica", 3),
    new Proceso(contador++, "Antivirus", 7)
  ];

  bloqueados = [];
  listos = [];
  cpu = null;
  terminados = [];
  gantt = [];

  // Limpiamos visualmente el Gantt y dibujamos el estado inicial
  document.getElementById("gantt").innerHTML = "";
  render();
}

// RENDER
function render(){

  document.getElementById("bloqueados").innerHTML =
    bloqueados.map(p=>`
    <div class="tarjeta-proceso" style="border-left-color:#FF9800;">
      ${p.id} - ${p.nombre}
<span style="font-size:12px; color:#666;">
  ${p.tiempoEjecutado}/${p.tiempoTotal} tics
</span>}
    </div>`).join("");

  document.getElementById("nuevos").innerHTML =
    nuevos.map(p=>`
      <div class="tarjeta-proceso" style="border-left-color:#673AB7;">
        ${p.id} - ${p.nombre}
<span style="font-size:12px; color:#666;">
  0/${p.tiempoTotal} tics
</span>
      </div>`).join("");

  document.getElementById("listos").innerHTML =
    listos.map(p=>`
      <div class="tarjeta-proceso" style="border-left-color:#2196F3;">
       ${p.id} - ${p.nombre}
<span style="font-size:12px; color:#666;">
  ${p.tiempoEjecutado}/${p.tiempoTotal} tics
</span>
      </div>`).join("");

  document.getElementById("cpu").innerHTML =
    cpu ? `
      <div class="tarjeta-proceso" style="border-left-color:#4CAF50;">
        ${cpu.id} - ${cpu.nombre}
<span style="font-size:12px; color:#666;">
  ${cpu.tiempoEjecutado}/${cpu.tiempoTotal} tics
</span>
      </div>` : "";

  document.getElementById("terminados").innerHTML =
    terminados.map(p=>`
      <div class="tarjeta-proceso" style="border-left-color:#9E9E9E;">
        ${p.id} - ${p.nombre}
      </div>`).join("");

  // GANTT
  document.getElementById("gantt").innerHTML =
    gantt.map(p=>{
      if(!p) return `<div class="bloque" style="background:#999;">Idle</div>`;
      return `<div class="bloque" style="background:${color(p.id)};">
        ${p.id}
      </div>`;
    }).join("");

  // TIEMPOS (Métricas del sistema)
    let tablaHTML = `
      <table style="width:100%; text-align:center; border-collapse: collapse; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-top: 10px;">
        <tr style="background:#333; color:white;">
          <th style="padding:8px;">ID - Proceso</th>
          <th style="padding:8px;">T. Ejecución</th>
          <th style="padding:8px;">T. Espera (Perdido)</th>
          <th style="padding:8px;">T. Respuesta</th>
          <th style="padding:8px;">T. Retorno</th>
          <th style="padding:8px;">Penalidad</th>
        </tr>
    `;

    terminados.forEach(p => {
      // Cálculos de las métricas
      let tRetorno = p.tiempoEspera + p.tiempoTotal;
      let penalidad = (tRetorno / p.tiempoTotal).toFixed(2); // Redondeado a 2 decimales

      tablaHTML += `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding:8px;"><strong>${p.id}</strong> - ${p.nombre}</td>
          <td style="padding:8px;">${p.tiempoTotal}</td>
          <td style="padding:8px;">${p.tiempoEspera}</td>
          <td style="padding:8px;">${p.tiempoRespuesta}</td>
          <td style="padding:8px;">${tRetorno}</td>
          <td style="padding:8px;">${penalidad}</td>
        </tr>
      `;
    });

    tablaHTML += `</table>`;
    document.getElementById("tiempos").innerHTML = tablaHTML;
}

// CONTROL
function iniciar(){
  if(!reloj){
    reloj = setInterval(tic,1000);
  }
}

function detener(){
  clearInterval(reloj);
  reloj = null;
}

render();
