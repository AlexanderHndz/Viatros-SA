// César, esta función corre solita cada vez que cargás una página.
// Revisa si ya te logueaste para cambiar el botón de "Iniciar Sesión" por tu nombre.
function verificarSesion() {
    const usuarioGuardado = localStorage.getItem('usuarioViatros');
    if (!usuarioGuardado) return; 

    const usuario = JSON.parse(usuarioGuardado);
    const linkLogin = document.querySelector('a[href="login.html"]');
    
    // Si encuentra el botón de login, lo quita y pone tu nombre con link al perfil.
    if (linkLogin) {
        const contenedorMenu = linkLogin.parentElement;
        
        contenedorMenu.innerHTML = `
            <a href="index.html">Inicio</a>
            <a href="catalogo.html">Catálogo</a>
            
            <a href="perfil.html" style="margin-left: 20px; color: var(--accent); font-weight: bold; background: rgba(255,255,255,0.1); padding: 5px 15px; border-radius: 20px; text-decoration: none;">
                👤 Hola, ${usuario.nombre}
            </a>
            
            <a href="#" onclick="cerrarSesion()" style="font-size: 0.9rem; color: #ff9999; margin-left: 15px; text-decoration: none;">Salir ❌</a>
        `;
    }
}

// Aquí simplemente borramos la sesión de la memoria del navegador y te mandamos al inicio.
function cerrarSesion() {
    localStorage.removeItem('usuarioViatros'); 
    window.location.href = 'index.html'; 
}

// Esta función agarra lo que escribiste en el registro y se lo manda al servidor.
async function registrarUsuario(event) {
    event.preventDefault(); // César, esto evita que la página se refresque antes de tiempo.
    
    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const respuesta = await fetch('/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password })
        });

        const data = await respuesta.json();
        
        if (data.exito) {
            alert("¡Cuenta creada con éxito! Ya podés entrar.");
            window.location.href = 'login.html';
        } else {
            alert(data.mensaje);
        }
    } catch (error) {
        alert("Fijate que no me pude conectar con el servidor.");
    }
}

// Revisa tus datos y si todo está bien, te guarda en la memoria.
async function iniciarSesion(event) {
    event.preventDefault(); 
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const respuesta = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await respuesta.json();
        
        if (data.exito) {
            // César aca guardamos los datos para que el sitio te encuentre.
            localStorage.setItem('usuarioViatros', JSON.stringify(data.usuario));
            window.location.href = 'catalogo.html'; 
        } else {
            alert(data.mensaje); 
        }
    } catch (error) {
        alert("Hubo un clavo al conectar con el servidor.");
    }
}

// Ni bien termina de cargar el HTML, mandamos a llamar a verificarSesion.
document.addEventListener('DOMContentLoaded', verificarSesion);