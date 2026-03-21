async function cargarDepartamentos() {
    console.log("🕵️ Pasito 1: Iniciando carga...");
    const contenedor = document.getElementById('contenedor-deptos');

    try {
        const respuesta = await fetch('/api/deptos');
        console.log(" Pasito 2: El servidor respondió con status:", respuesta.status);

        if (!respuesta.ok) {
            throw new Error(`Error en el servidor: ${respuesta.status}`);
        }

        const datos = await respuesta.json();
        console.log("🕵️ Pasito 3: Datos recibidos de SQL:", datos);

        if (!datos || datos.length === 0) {
            contenedor.innerHTML = '<h3>No hay datos en la tabla Departamentos</h3>';
            return;
        }

        contenedor.innerHTML = '';

        datos.forEach(depto => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h3>${depto.nombre}</h3>
                <button onclick="verDestinos(${depto.id_depto})">Ver 3 lugares</button>
            `;
            contenedor.appendChild(card);
        });

        console.log("Pasito 4: ¡Todo dibujado con éxito!");

    } catch (error) {
        console.error("Pasito X: EXPLOTÓ AQUÍ:", error);
        contenedor.innerHTML = `<p style="color:red">Error: ${error.message}. Revisa la consola (F12).</p>`;
    }
}

cargarDepartamentos();

function verDestinos(id) {
    alert("Cargando destinos para el ID: " + id);
}