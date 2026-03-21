// César, esta función se encarga de ir a traer los 22 departamentos a la base de datos
// y dibuja esos cuadritos que mirás al entrar al catálogo.
async function cargarDepartamentos() {
    const contenedor = document.getElementById('contenedor-deptos');
    if (!contenedor) return; 

    try {
        const respuesta = await fetch('/api/deptos');
        const departamentos = await respuesta.json();
        
        contenedor.innerHTML = ''; 

        departamentos.forEach(depto => {
            const div = document.createElement('div');
            div.className = 'cuadrado-depto';
            // Al darle clic, llamamos a la función para ver los lugares de ese depto
            div.onclick = () => verDestinos(depto.id_depto, depto.nombre);
            div.innerHTML = `
                <h3>${depto.nombre}</h3>
                <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">Ver destinos ➡</p>
            `;
            contenedor.appendChild(div);
        });

    } catch (error) {
        contenedor.innerHTML = `<p style="color:red">Fijate César que hubo un clavo al conectar con Viatros, S. A.</p>`;
    }
}

// Cuando haces clic en un departamento, borramos los cuadritos
// y ponemos las tarjetas de los 3 lugares más el sorpresa.
async function verDestinos(idDepto, nombreDepto) {
    const contenedor = document.getElementById('contenedor-deptos');
    
    // Aquí cambiamos los textos de la página para que sepa dónde está parado el cliente
    document.querySelector('.titulo-seccion').innerText = `Maravillas de ${nombreDepto}`;
    document.querySelector('.titulo-seccion').nextElementSibling.innerText = "Seleccione su próxima aventura";

    contenedor.innerHTML = '<div style="grid-column: 1 / -1; text-align: center;"><h3>Buscando las mejores rutas...</h3></div>';

    try {
        const respuesta = await fetch(`/api/destinos/${idDepto}`);
        const destinos = await respuesta.json();

        contenedor.innerHTML = ''; 

        destinos.forEach(lugar => {
            // Aquí separamos el precio más barato para mostrarlo como Base
            const precioBase = lugar.presupuesto_estimado.split('-')[0].trim();

            // Si el lugar dice Sorpresa, escondemos el nombre real para que sea un misterio
            let tituloMostrar = lugar.nombre_lugar;
            let descripcionMostrar = lugar.descripcion;

            if (tituloMostrar.includes('Sorpresa')) {
                tituloMostrar = '🎁 Destino Sorpresa Exclusivo';
                descripcionMostrar = '¡Dejate llevar por la aventura! Un destino mágico seleccionado por nuestro equipo. Atrevete a descubrir lo desconocido.';
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
            contenedor.appendChild(card);
        });

        // Este es el botón para regresar a ver todos los departamentos de nuevo
        const btnVolver = document.createElement('button');
        btnVolver.className = 'btn-primary';
        btnVolver.style.gridColumn = '1 / -1';
        btnVolver.style.maxWidth = '300px';
        btnVolver.style.margin = '20px auto';
        btnVolver.innerText = "⬅ Regresar a los Departamentos";
        btnVolver.onclick = () => location.reload();
        contenedor.appendChild(btnVolver);

    } catch (error) {
        console.error("Clavo al cargar destinos:", error);
    }
}

// Si no estás logueado, no te deja pasar a reservar.
function irAReserva(idDestino) {
    const usuarioGuardado = localStorage.getItem('usuarioViatros');

    if (!usuarioGuardado) {
        alert("🔒 Por seguridad, tenés que iniciar sesión para reservar.");
        window.location.href = "login.html";
    } else {
        // Si todo está bien, te mandamos a la página de reserva con el ID del lugar
        window.location.href = `reserva.html?destino=${idDestino}`;
    }
}

// En cuanto carga la página, arrancamos con los departamentos.
document.addEventListener('DOMContentLoaded', cargarDepartamentos);