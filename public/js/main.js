// --- DICCIONARIO DEL MAPA A LA BASE DE DATOS ---
// Conecta los IDs de tu archivo SVG con el ID correcto de tu tabla de SQL
const infoDeptos = {
    "GT-QC": { dbId: 1, nombre: "Quiché", clima: "🌲 Frío y Montañoso", desc: "Cultura viva, montañas y la rica historia del imperio Quiché." },
    "GT-ES": { dbId: 2, nombre: "Escuintla", clima: "🔥 Muy Cálido", desc: "Playas de arena volcánica y el calor de la costa sur." },
    "GT-CM": { dbId: 3, nombre: "Chimaltenango", clima: "⛅ Templado", desc: "Ruinas históricas y volcanes imponentes." },
    "GT-SM": { dbId: 4, nombre: "San Marcos", clima: "❄️ Frío Intenso", desc: "Hogar de los volcanes más altos de Centroamérica." },
    "GT-PE": { dbId: 5, nombre: "Petén", clima: "☀️ Cálido y Húmedo", desc: "La cuna del mundo Maya y la selva más grande de la región." },
    "GT-SU": { dbId: 6, nombre: "Suchitepéquez", clima: "🌴 Cálido y Tropical", desc: "Tierra del venado, fincas y exuberante naturaleza." },
    "GT-AV": { dbId: 7, nombre: "Alta Verapaz", clima: "🌧️ Templado y Lluvioso", desc: "Naturaleza viva, cuevas impresionantes y pozas de agua cristalina." },
    "GT-SO": { dbId: 8, nombre: "Sololá", clima: "⛅ Frío y Templado", desc: "El lago más hermoso del mundo rodeado de volcanes." },
    "GT-SA": { dbId: 9, nombre: "Sacatepéquez", clima: "⛅ Templado Ideal", desc: "Calles empedradas, ruinas y la magia de Antigua Guatemala." },
    "GT-IZ": { dbId: 10, nombre: "Izabal", clima: "☀️ Muy Cálido y Húmedo", desc: "El caribe guatemalteco, castillos piratas y selva." },
    "GT-QZ": { dbId: 11, nombre: "Quetzaltenango", clima: "❄️ Frío", desc: "Cuna de la cultura, aguas termales y neblina." },
    "GT-HU": { dbId: 12, nombre: "Huehuetenango", clima: "🌲 Muy Frío", desc: "Los majestuosos Cuchumatanes y cenotes de cristal." },
    "GT-ZA": { dbId: 13, nombre: "Zacapa", clima: "🔥 Muy Cálido y Seco", desc: "Tierra de oriente, sol intenso y balnearios." },
    "GT-JU": { dbId: 14, nombre: "Jutiapa", clima: "☀️ Cálido", desc: "Volcanes, lagunas y la frontera de oriente." },
    "GT-BV": { dbId: 15, nombre: "Baja Verapaz", clima: "🌧️ Templado", desc: "El hogar del Quetzal y cascadas impresionantes." },
    "GT-CQ": { dbId: 16, nombre: "Chiquimula", clima: "🔥 Cálido", desc: "La capital de la fe y el misticismo en oriente." },
    "GT-PR": { dbId: 17, nombre: "El Progreso", clima: "☀️ Muy Cálido y Seco", desc: "El corredor seco y parques acuáticos impresionantes." },
    "GT-GU": { dbId: 18, nombre: "Guatemala", clima: "⛅ Templado", desc: "La ciudad moderna, museos y el centro del país." },
    "GT-JA": { dbId: 19, nombre: "Jalapa", clima: "⛅ Templado a Cálido", desc: "La morena climatológica de oriente, cascadas extremas." },
    "GT-RE": { dbId: 20, nombre: "Retalhuleu", clima: "🌴 Cálido y Húmedo", desc: "La capital del mundo, playas y los mejores parques temáticos." },
    "GT-SR": { dbId: 21, nombre: "Santa Rosa", clima: "☀️ Cálido", desc: "Playas de arena negra, reservas de tortugas y canales." },
    "GT-TO": { dbId: 22, nombre: "Totonicapán", clima: "❄️ Frío", desc: "Tradición, telares, aguas termales y riscos majestuosos." }
};


function inicializarMapa() {
    const mapaPaths = document.querySelectorAll('#contenedor-mapa path');
    const ventanaInfo = document.getElementById('ventana-info');

    if(mapaPaths.length === 0) return; 

    mapaPaths.forEach(path => {
 
        path.addEventListener('mouseenter', (e) => {
            const idSVG = e.target.id;
            const info = infoDeptos[idSVG];
            
            if(info) {
                document.getElementById('nombre-depto').innerText = info.nombre;
                document.getElementById('clima-depto').innerText = info.clima;
                document.getElementById('desc-depto').innerText = info.desc;
                ventanaInfo.classList.remove('oculto');
            }
        });

        // Al mover el mouse: La ventanita te sigue
        path.addEventListener('mousemove', (e) => {
            const anchoVentana = ventanaInfo.offsetWidth;
            const altoVentana = ventanaInfo.offsetHeight;
            
            // Usamos clientX y clientY (Miden exacto en la pantalla donde estás viendo)
            let x = e.clientX + 15;
            let y = e.clientY + 15;

            // 🛑 SISTEMA ANTI-CHOQUES MEJORADO
            
            // Si choca a la derecha, la pasamos a la izquierda del mouse
            if (x + anchoVentana > window.innerWidth) {
                x = e.clientX - anchoVentana - 15;
            }

            // Si choca abajo, la pasamos para arriba del mouse
            if (y + altoVentana > window.innerHeight) {
                y = e.clientY - altoVentana - 15;
            }

            // Aplicamos las coordenadas
            ventanaInfo.style.left = x + 'px';
            ventanaInfo.style.top = y + 'px';
        });

        // Al quitar el mouse: Ocultar ventana
        path.addEventListener('mouseleave', () => {
            ventanaInfo.classList.add('oculto');
        });

        // ¡AL HACER CLIC! -> Buscar los destinos
        path.addEventListener('click', (e) => {
            const idSVG = e.target.id;
            const info = infoDeptos[idSVG];
            if(info) {
                ventanaInfo.classList.add('oculto'); // Escondemos la ventanita
                verDestinos(info.dbId, info.nombre); // Llamamos a la base de datos
            }
        });
    });
}

// --- BUSCAR DESTINOS EN SQL Y MOSTRAR TARJETAS ---
async function verDestinos(idDepto, nombreDepto) {
    const seccionMapa = document.getElementById('seccion-mapa');
    const contenedorDestinos = document.getElementById('contenedor-deptos');
    
    // Ocultamos el mapa y mostramos el contenedor de tarjetas
    seccionMapa.classList.add('oculto');
    contenedorDestinos.classList.remove('oculto');

    // Cambiamos los títulos
    document.querySelector('.titulo-seccion').innerText = `Maravillas de ${nombreDepto}`;
    document.getElementById('texto-instruccion').innerText = "Seleccione su próxima aventura";

    contenedorDestinos.innerHTML = '<div style="grid-column: 1 / -1; text-align: center;"><h3>Buscando las mejores rutas...</h3></div>';

    try {
        const respuesta = await fetch(`/api/destinos/${idDepto}`);
        const destinos = await respuesta.json();

        contenedorDestinos.innerHTML = ''; 

        destinos.forEach(lugar => {
            const precioBase = lugar.presupuesto_estimado.split('-')[0].trim();
            let tituloMostrar = lugar.nombre_lugar;
            let descripcionMostrar = lugar.descripcion;

            if (tituloMostrar.includes('Sorpresa')) {
                tituloMostrar = '🎁 Destino Sorpresa Exclusivo';
                descripcionMostrar = '¡Dejate llevar por la aventura! Un destino mágico seleccionado por nuestro equipo.';
            }

            const card = document.createElement('div');
            card.className = 'tarjeta-destino';
            card.innerHTML = `
                <div class="foto-destino"></div>
                <div class="contenido-destino">
                    <h2 style="color: var(--primary); margin-top:0;">${tituloMostrar}</h2>
                    <p style="color: #555; font-size: 0.95rem;">${descripcionMostrar}</p>
                    
                    <div class="precio-estandar">
                        <span style="font-size: 0.9rem; color: #666; display: block;">Precio Base Estándar</span>
                        ${precioBase}
                    </div>

                    <p><strong>👥 Cupos disponibles:</strong> ${lugar.cupos_disponibles} / ${lugar.cupos_totales}</p>
                    
                    <button class="btn-primary btn-accent btn-reserva-abajo" onclick="irAReserva(${lugar.id_destino})">
                        Configurar Reserva
                    </button>
                </div>
            `;
            contenedorDestinos.appendChild(card);
        });

        // Botón para volver al mapa
        const btnVolver = document.createElement('button');
        btnVolver.className = 'btn-primary';
        btnVolver.style.gridColumn = '1 / -1';
        btnVolver.style.maxWidth = '300px';
        btnVolver.style.margin = '20px auto';
        btnVolver.innerText = "⬅ Regresar al Mapa";
        btnVolver.onclick = () => {
            // Cuando le dan a regresar, ocultamos tarjetas y sacamos el mapa
            contenedorDestinos.classList.add('oculto');
            seccionMapa.classList.remove('oculto');
            document.querySelector('.titulo-seccion').innerText = `Nuestras Rutas Oficiales`;
            document.getElementById('texto-instruccion').innerText = "Navegue por el mapa y seleccione un departamento.";
        };
        contenedorDestinos.appendChild(btnVolver);

    } catch (error) {
        console.error("Clavo al cargar destinos:", error);
    }
}

// --- VALIDACIÓN DE INICIO DE SESIÓN ---
function irAReserva(idDestino) {
    const usuarioGuardado = localStorage.getItem('usuarioViatros');

    if (!usuarioGuardado) {
        alert("Holaaa, ¡Tienes que registrarte para poder reservar!");
        window.location.href = "login.html";
    } else {
        window.location.href = `reserva.html?destino=${idDestino}`;
    }
}

// Encender los motores al cargar la página
document.addEventListener('DOMContentLoaded', inicializarMapa);