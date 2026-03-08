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

// Imprimir el resultado para verificar que funciona
console.log("Sistema Operativo Iniciado.");
console.log("Estos son tus 5 procesos iniciales:", procesosPorDefecto);