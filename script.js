// Plantilla (BCP) para los procesos
class BCP {
    constructor(id, nombre, tiempoTotal) {
        this.id = id;
        this.nombre = nombre;
        this.estado = "Nuevo"; // Todos los procesos nacen en estado "Nuevo"
        this.tiempoTotal = tiempoTotal; // Ciclos que necesita para terminar
        this.tiempoEjecutado = 0;       // Ciclos que lleva en la CPU
    }
}

// Crear los 5 procesos por defecto usando nuestra plantilla
const procesosPorDefecto = [
    new BCP("P1", "Navegador Web", 5),
    new BCP("P2", "Reproductor de Música", 3),
    new BCP("P3", "Antivirus", 7),
    new BCP("P4", "Editor de Texto", 4),
    new BCP("P5", "Actualizador del Sistema", 6)
];

let procesoEnCPU = null; // En la CPU solo cabe un proceso a la vez
let colaBloqueados = [];
let colaTerminados = [];

// Función para dibujar los procesos en la pantalla
function actualizarPantalla() {
    // Capturar las cajas del HTML
    const cajaListos = document.getElementById("caja-listos");
    
    // Vaciar la caja antes de volver a dibujar para que no se dupliquen
    cajaListos.innerHTML = ""; 

    // Recorrer la lista de "Listos" y crear una tarjeta HTML por cada proceso
    colaListos.forEach(proceso => {
        cajaListos.innerHTML += `
            <div class="tarjeta-proceso" style="border-left-color: #2196F3;">
                <strong>${proceso.id} - ${proceso.nombre}</strong>
                <span>Tiempo: ${proceso.tiempoEjecutado} / ${proceso.tiempoTotal} tics</span>
            </div>
        `;
    });

}

// 4. Ejecutar la función al iniciar para ver los procesos
actualizarPantalla();