function verificarSesion() {
  const usuarioGuardado = localStorage.getItem("usuarioViatros");
  if (!usuarioGuardado) return;

  const usuario = JSON.parse(usuarioGuardado);
  const linkLogin = document.getElementById("btn-login-nav");

  if (linkLogin) {
    linkLogin.outerHTML = `
            <div style="display: inline-flex; align-items: center; gap: 15px; flex-wrap: wrap; justify-content: center;">
                <a href="perfil.html" style="color: var(--accent); font-weight: bold; background: rgba(255,255,255,0.1); padding: 5px 15px; border-radius: 20px; text-decoration: none; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" title="Ir a mi perfil">
                    👤 Hola, ${usuario.nombre.split(" ")[0]}
                </a>
                <a href="#" onclick="cerrarSesion()" style="font-size: 0.9rem; color: #ff9999; text-decoration: none; font-weight: bold;">Salir ❌</a>
            </div>
        `;
  }
}

function cerrarSesion() {
  localStorage.removeItem("usuarioViatros");
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", verificarSesion);

function notificarUsuario(titulo, mensaje, icono) {
  if (
    typeof mostrarToast === "function" &&
    document.getElementById("toast-notificacion")
  ) {
    mostrarToast(titulo, mensaje, icono);
  } else {
    alert(`${icono} ${titulo}: \n${mensaje}`);
  }
}

let correoPendiente = "";

window.registrarUsuario = async function (event) {
  event.preventDefault();

  const btnSubmit = event.target.querySelector('button[type="submit"]');
  const textoOriginal = btnSubmit.innerText;
  btnSubmit.disabled = true;
  btnSubmit.innerText = "⏳ Procesando...";

  const nombre = document.getElementById("nombre")
    ? document.getElementById("nombre").value
    : "";
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const peticion = await fetch("/api/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, password }),
    });
    const respuesta = await peticion.json();

    if (respuesta.exito) {
      notificarUsuario(
        "¡Casi listo!",
        "Te enviamos un código de 6 dígitos a tu correo.",
        "✅",
      );
      correoPendiente = email;

      document.getElementById("bloque-registro").style.display = "none";
      document.getElementById("bloque-verificacion").style.display = "block";
    } else {
      notificarUsuario("Error en Registro", respuesta.mensaje, "❌");
    }
  } catch (err) {
    notificarUsuario(
      "Error de Conexión",
      "No pudimos conectar con el servidor.",
      "🔌",
    );
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = textoOriginal;
    }
  }
};

window.iniciarSesion = async function (event) {
  event.preventDefault();

  const btnSubmit = event.target.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.innerText = "⏳ Autenticando...";

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const controlador = new AbortController();
  const idTiempo = setTimeout(() => controlador.abort(), 8000);

  try {
    const respuesta = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: controlador.signal,
    });

    clearTimeout(idTiempo);
    const data = await respuesta.json();

    if (data.exito) {
      localStorage.setItem("usuarioViatros", JSON.stringify(data.usuario));
      notificarUsuario(
        "¡Bienvenido!",
        "Iniciando sesión correctamente...",
        "✅",
      );
      setTimeout(() => {
        window.location.href = "catalogo.html";
      }, 1000);
    } else if (data.requiereVerificacion) {
      notificarUsuario("Cuenta Inactiva", data.mensaje, "⚠️");
      correoPendiente = email;
      document.getElementById("bloque-login").style.display = "none";
      document.getElementById("bloque-verificacion-login").style.display =
        "block";

      btnSubmit.disabled = false;
      btnSubmit.innerText = "Ingresar a mi cuenta";
    } else {
      notificarUsuario("Acceso Denegado", data.mensaje, "❌");
      btnSubmit.disabled = false;
      btnSubmit.innerText = "Ingresar a mi cuenta";
    }
  } catch (error) {
    clearTimeout(idTiempo);
    if (error.name === "AbortError") {
      notificarUsuario(
        "Servidor Ocupado",
        "La base de datos está despertando. Por favor, intenta de nuevo.",
        "🐢",
      );
    } else {
      notificarUsuario(
        "Error del Sistema",
        "Hubo un problema al conectar con el servidor.",
        "🔌",
      );
    }
    btnSubmit.disabled = false;
    btnSubmit.innerText = "Ingresar a mi cuenta";
  }
};

window.verificarCodigoOTP = async function (event) {
  event.preventDefault();

  const btnSubmit = event.target.querySelector('button[type="submit"]');
  const textoOriginal = btnSubmit.innerText;
  btnSubmit.disabled = true;
  btnSubmit.innerText = "⏳ Validando...";

  const codigo = document.getElementById("codigo-otp").value;

  try {
    const peticion = await fetch("/api/verificar-codigo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: correoPendiente, codigo: codigo }),
    });
    const respuesta = await peticion.json();

    if (respuesta.exito) {
      notificarUsuario(
        "¡Verificado!",
        "Cuenta activada con éxito. Iniciando sesión...",
        "🎉",
      );
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
    } else {
      notificarUsuario("Código Inválido", respuesta.mensaje, "❌");
      btnSubmit.disabled = false;
      btnSubmit.innerText = textoOriginal;
    }
  } catch (err) {
    notificarUsuario(
      "Error de Conexión",
      "No pudimos validar tu código.",
      "🔌",
    );
    btnSubmit.disabled = false;
    btnSubmit.innerText = textoOriginal;
  }
};

let correoParaRecuperar = "";

window.mostrarRecuperacion = function (event) {
  event.preventDefault();
  const bloqueLogin = document.getElementById("bloque-login");
  const bloquePedirCorreo = document.getElementById("bloque-pedir-correo");

  if (bloqueLogin && bloquePedirCorreo) {
    bloqueLogin.style.display = "none";
    bloquePedirCorreo.style.display = "block";
  }
};

window.enviarCodigoRecuperacion = async function (event) {
  event.preventDefault();

  const btnSubmit = event.target.querySelector('button[type="submit"]');
  const textoOriginal = btnSubmit.innerText;
  btnSubmit.disabled = true;
  btnSubmit.innerText = "⏳ Enviando...";

  const emailInput = document.getElementById("email-recuperacion").value;

  try {
    const peticion = await fetch("/api/solicitar-recuperacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput }),
    });
    const respuesta = await peticion.json();

    if (respuesta.exito) {
      notificarUsuario("Código Enviado", respuesta.mensaje, "✉️");
      correoParaRecuperar = emailInput;

      setTimeout(() => {
        document.getElementById("bloque-pedir-correo").style.display = "none";
        document.getElementById("bloque-nueva-clave").style.display = "block";
      }, 1500);
    } else {
      notificarUsuario("Error", respuesta.mensaje, "❌");
      btnSubmit.disabled = false;
      btnSubmit.innerText = textoOriginal;
    }
  } catch (err) {
    notificarUsuario("Error", "Fallo al conectar con el servidor.", "🔌");
    btnSubmit.disabled = false;
    btnSubmit.innerText = textoOriginal;
  }
};

window.cambiarPasswordFinal = async function (event) {
  event.preventDefault();

  const btnSubmit = event.target.querySelector('button[type="submit"]');
  const textoOriginal = btnSubmit.innerText;
  btnSubmit.disabled = true;
  btnSubmit.innerText = "⏳ Actualizando...";

  const codigo = document.getElementById("codigo-recuperacion").value.trim();
  const nuevaPassword = document.getElementById("nueva-password").value.trim();

  if (!correoParaRecuperar || correoParaRecuperar === "") {
    notificarUsuario(
      "Amnesia Temporal",
      "Se perdió la conexión. Vuelve a pedir el código.",
      "⚠️",
    );
    setTimeout(() => {
      window.location.reload();
    }, 2500);
    return;
  }

  try {
    const peticion = await fetch("/api/cambiar-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: correoParaRecuperar,
        codigo: codigo,
        nuevaPassword: nuevaPassword,
      }),
    });
    const respuesta = await peticion.json();

    if (respuesta.exito) {
      notificarUsuario("¡Éxito!", respuesta.mensaje, "🎉");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      notificarUsuario("Código Incorrecto", respuesta.mensaje, "❌");
      btnSubmit.disabled = false;
      btnSubmit.innerText = textoOriginal;
    }
  } catch (err) {
    notificarUsuario("Error", "Fallo al cambiar la contraseña.", "🔌");
    btnSubmit.disabled = false;
    btnSubmit.innerText = textoOriginal;
  }
};
