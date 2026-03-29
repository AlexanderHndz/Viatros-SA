const infoDeptos = {
  "GT-QC": {
    dbId: 1,
    nombre: "Quiché",
    clima: "🌲 Frío y Montañoso",
    desc: "Cultura viva, montañas y la rica historia del imperio Quiché.",
  },
  "GT-ES": {
    dbId: 2,
    nombre: "Escuintla",
    clima: "🔥 Muy Cálido",
    desc: "Playas de arena volcánica y el calor de la costa sur.",
  },
  "GT-CM": {
    dbId: 3,
    nombre: "Chimaltenango",
    clima: "⛅ Templado",
    desc: "Ruinas históricas y volcanes imponentes.",
  },
  "GT-SM": {
    dbId: 4,
    nombre: "San Marcos",
    clima: "❄️ Frío Intenso",
    desc: "Hogar de los volcanes más altos de Centroamérica.",
  },
  "GT-PE": {
    dbId: 5,
    nombre: "Petén",
    clima: "☀️ Cálido y Húmedo",
    desc: "La cuna del mundo Maya y la selva más grande de la región.",
  },
  "GT-SU": {
    dbId: 6,
    nombre: "Suchitepéquez",
    clima: "🌴 Cálido y Tropical",
    desc: "Tierra del venado, fincas y exuberante naturaleza.",
  },
  "GT-AV": {
    dbId: 7,
    nombre: "Alta Verapaz",
    clima: "🌧️ Templado y Lluvioso",
    desc: "Naturaleza viva, cuevas impresionantes y pozas de agua cristalina.",
  },
  "GT-SO": {
    dbId: 8,
    nombre: "Sololá",
    clima: "⛅ Frío y Templado",
    desc: "El lago más hermoso del mundo rodeado de volcanes.",
  },
  "GT-SA": {
    dbId: 9,
    nombre: "Sacatepéquez",
    clima: "⛅ Templado Ideal",
    desc: "Calles empedradas, ruinas y la magia de Antigua Guatemala.",
  },
  "GT-IZ": {
    dbId: 10,
    nombre: "Izabal",
    clima: "☀️ Muy Cálido y Húmedo",
    desc: "El caribe guatemalteco, castillos piratas y selva.",
  },
  "GT-QZ": {
    dbId: 11,
    nombre: "Quetzaltenango",
    clima: "❄️ Frío",
    desc: "Cuna de la cultura, aguas termales y neblina.",
  },
  "GT-HU": {
    dbId: 12,
    nombre: "Huehuetenango",
    clima: "🌲 Muy Frío",
    desc: "Los majestuosos Cuchumatanes y cenotes de cristal.",
  },
  "GT-ZA": {
    dbId: 13,
    nombre: "Zacapa",
    clima: "🔥 Muy Cálido y Seco",
    desc: "Tierra de oriente, sol intenso y balnearios.",
  },
  "GT-JU": {
    dbId: 14,
    nombre: "Jutiapa",
    clima: "☀️ Cálido",
    desc: "Volcanes, lagunas y la frontera de oriente.",
  },
  "GT-BV": {
    dbId: 15,
    nombre: "Baja Verapaz",
    clima: "🌧️ Templado",
    desc: "El hogar del Quetzal y cascadas impresionantes.",
  },
  "GT-CQ": {
    dbId: 16,
    nombre: "Chiquimula",
    clima: "🔥 Cálido",
    desc: "La capital de la fe y el misticismo en oriente.",
  },
  "GT-PR": {
    dbId: 17,
    nombre: "El Progreso",
    clima: "☀️ Muy Cálido y Seco",
    desc: "El corredor seco y parques acuáticos impresionantes.",
  },
  "GT-GU": {
    dbId: 18,
    nombre: "Guatemala",
    clima: "⛅ Templado",
    desc: "La ciudad moderna, museos y el centro del país.",
  },
  "GT-JA": {
    dbId: 19,
    nombre: "Jalapa",
    clima: "⛅ Templado a Cálido",
    desc: "La morena climatológica de oriente, cascadas extremas.",
  },
  "GT-RE": {
    dbId: 20,
    nombre: "Retalhuleu",
    clima: "🌴 Cálido y Húmedo",
    desc: "La capital del mundo, playas y los mejores parques temáticos.",
  },
  "GT-SR": {
    dbId: 21,
    nombre: "Santa Rosa",
    clima: "☀️ Cálido",
    desc: "Playas de arena negra, reservas de tortugas y canales.",
  },
  "GT-TO": {
    dbId: 22,
    nombre: "Totonicapán",
    clima: "❄️ Frío",
    desc: "Tradición, telares, aguas termales y riscos majestuosos.",
  },
};

function inicializarMapa() {
  const mapaPaths = document.querySelectorAll("#contenedor-mapa path");
  const ventanaInfo = document.getElementById("ventana-info");

  if (mapaPaths.length === 0) return;

  mapaPaths.forEach((path) => {
    path.addEventListener("mouseenter", (e) => {
      const idSVG = e.target.id;
      const info = infoDeptos[idSVG];

      if (info) {
        document.getElementById("nombre-depto").innerText = info.nombre;
        document.getElementById("clima-depto").innerText = info.clima;
        document.getElementById("desc-depto").innerText = info.desc;
        ventanaInfo.classList.remove("oculto");
      }
    });

    path.addEventListener("mousemove", (e) => {
      const anchoVentana = ventanaInfo.offsetWidth;
      const altoVentana = ventanaInfo.offsetHeight;

      let x = e.clientX + 15;
      let y = e.clientY + 15;

      if (x + anchoVentana > window.innerWidth)
        x = e.clientX - anchoVentana - 15;
      if (y + altoVentana > window.innerHeight)
        y = e.clientY - altoVentana - 15;

      ventanaInfo.style.left = x + "px";
      ventanaInfo.style.top = y + "px";
    });

    path.addEventListener("mouseleave", () => {
      ventanaInfo.classList.add("oculto");
    });

    path.addEventListener("click", (e) => {
      const idSVG = e.target.id;
      const info = infoDeptos[idSVG];
      if (info) {
        ventanaInfo.classList.add("oculto");
        verDestinos(info.dbId, info.nombre);
      }
    });
  });
}

async function verDestinos(idDepto, nombreDepto) {
  const seccionMapa = document.getElementById("seccion-mapa");
  const contenedorDestinos = document.getElementById("contenedor-deptos");
  const contenedorBuscador = document.getElementById("contenedor-buscador");

  seccionMapa.classList.add("oculto");
  if (contenedorBuscador) contenedorBuscador.classList.add("oculto");
  contenedorDestinos.classList.remove("oculto");

  if (window.location.hash !== "#resultados") {
    history.pushState({ vista: "resultados" }, "", "#resultados");
  }

  document.querySelector(".titulo-seccion").innerText =
    `Maravillas de ${nombreDepto}`;
  document.getElementById("texto-instruccion").innerText =
    "Seleccione su próxima aventura";
  contenedorDestinos.innerHTML =
    '<div style="grid-column: 1 / -1; text-align: center;"><h3>Buscando las mejores rutas... 🧭</h3></div>';

  try {
    const respuesta = await fetch(`/api/destinos/${idDepto}`);
    const destinos = await respuesta.json();

    contenedorDestinos.innerHTML = "";

    if (destinos.length === 0) {
      contenedorDestinos.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: white; border-radius: 15px;">
                    <h3 style="color: var(--accent);">Próximamente nuevas aventuras aquí 🚧</h3>
                    <p style="color: #666;">Aún estamos explorando ${nombreDepto} para traerte las mejores rutas.</p>
                </div>`;
    } else {
      destinos.forEach((lugar) => {
        const precioBase = lugar.presupuesto_estimado.split("-")[0].trim();
        let tituloMostrar = lugar.nombre_lugar;
        let descripcionMostrar = lugar.descripcion;

        if (tituloMostrar.includes("Sorpresa")) {
          tituloMostrar = "🎁 Destino Sorpresa Exclusivo";
          descripcionMostrar =
            "¡Déjate llevar por la aventura! Un destino mágico seleccionado por nuestro equipo.";
        }

        let fechaMostrar = "Fechas por anunciar";
        if (lugar.fecha_viaje) {
          const fechaCruda = new Date(lugar.fecha_viaje);
          fechaCruda.setMinutes(
            fechaCruda.getMinutes() + fechaCruda.getTimezoneOffset(),
          );
          fechaMostrar = fechaCruda.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }

        const card = document.createElement("div");
        card.className = "tarjeta-destino";
        card.innerHTML = `
                    <div class="foto-destino" onclick="abrirGaleria('${tituloMostrar.replace(/'/g, "\\'")}')" style="cursor: pointer; position: relative; background-image: url('https://images.unsplash.com/photo-1528543606781-2f6e6857f318?auto=format&fit=crop&w=600&q=80');" title="Ver galería de fotos">
                        <div style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.7); color:white; padding:5px 10px; border-radius:20px; font-size:0.8rem; border: 1px solid rgba(255,255,255,0.3);">
                            📸 Ver 3 fotos
                        </div>
                    </div>
                    <div class="contenido-destino">
                        <h2 style="color: var(--primary); margin-top:0;">${tituloMostrar}</h2>
                        <p style="color: #555; font-size: 0.95rem;">${descripcionMostrar}</p>
                        
                        <div class="precio-estandar">
                            <span style="font-size: 0.9rem; color: #666; display: block;">Precio Base Estándar</span>
                            ${precioBase}
                        </div>

                        <p style="color: var(--accent); font-weight: bold; margin-bottom: 5px; text-transform: capitalize;">
                            📅 Salida: ${fechaMostrar}
                        </p>
                        <p style="margin-top: 0;"><strong>👥 Cupos disponibles:</strong> ${lugar.cupos_disponibles} / ${lugar.cupos_totales}</p>
                        
                        <button class="btn-primary" style="background: transparent; color: var(--accent); border: 2px solid var(--accent); margin-bottom: 10px;" onclick="abrirResenas(${lugar.id_destino}, '${tituloMostrar}')">
                            ⭐ Ver Reseñas
                        </button>
                        
                        <button class="btn-primary btn-accent btn-reserva-abajo" onclick="irAReserva(${lugar.id_destino})">
                            Configurar Reserva
                        </button>
                    </div>
                `;
        contenedorDestinos.appendChild(card);
      });
    }

    const btnVolver = document.createElement("button");
    btnVolver.className = "btn-primary";
    btnVolver.style.gridColumn = "1 / -1";
    btnVolver.style.maxWidth = "300px";
    btnVolver.style.margin = "20px auto";
    btnVolver.innerText = "⬅ Regresar al Mapa";
    btnVolver.onclick = () => {
      history.back();
    };
    contenedorDestinos.appendChild(btnVolver);
  } catch (error) {
    contenedorDestinos.innerHTML =
      '<div style="grid-column: 1 / -1; text-align: center; color: red;">Error de conexión. Inténtalo de nuevo.</div>';
  }
}

async function buscarDestinos() {
  const input = document.getElementById("input-busqueda").value.trim();
  if (!input) return;

  const seccionMapa = document.getElementById("seccion-mapa");
  const contenedorDestinos = document.getElementById("contenedor-deptos");
  const contenedorBuscador = document.getElementById("contenedor-buscador");

  seccionMapa.classList.add("oculto");
  contenedorBuscador.classList.add("oculto");
  contenedorDestinos.classList.remove("oculto");

  if (window.location.hash !== "#resultados") {
    history.pushState({ vista: "resultados" }, "", "#resultados");
  }

  document.querySelector(".titulo-seccion").innerText =
    `Resultados para: "${input}"`;
  document.getElementById("texto-instruccion").innerText =
    "Seleccione su próxima aventura";
  contenedorDestinos.innerHTML =
    '<div style="grid-column: 1 / -1; text-align: center;"><h3>Buscando con nuestra brújula mágica... 🧭</h3></div>';

  try {
    const respuesta = await fetch(
      `/api/buscar-destinos?q=${encodeURIComponent(input)}`,
    );
    const destinos = await respuesta.json();

    contenedorDestinos.innerHTML = "";

    if (destinos.length === 0) {
      contenedorDestinos.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: white; border-radius: 15px;">
                    <h3 style="color: var(--accent);">No encontramos destinos con esa palabra 😢</h3>
                    <p style="color: #666;">Intenta buscar otra cosa como "Volcán", "Ruinas", "Cueva" o "Playa".</p>
                </div>`;
    } else {
      destinos.forEach((lugar) => {
        const precioBase = lugar.presupuesto_estimado.split("-")[0].trim();
        let tituloMostrar = lugar.nombre_lugar;
        let descripcionMostrar = lugar.descripcion;

        if (tituloMostrar.includes("Sorpresa")) {
          tituloMostrar = "🎁 Destino Sorpresa Exclusivo";
          descripcionMostrar =
            "¡Dejate llevar por la aventura! Un destino mágico seleccionado por nuestro equipo.";
        }

        let fechaMostrar = "Fechas por anunciar";
        if (lugar.fecha_viaje) {
          const fechaCruda = new Date(lugar.fecha_viaje);
          fechaCruda.setMinutes(
            fechaCruda.getMinutes() + fechaCruda.getTimezoneOffset(),
          );
          fechaMostrar = fechaCruda.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }

        const card = document.createElement("div");
        card.className = "tarjeta-destino";
        card.innerHTML = `
                    <div class="foto-destino" onclick="abrirGaleria('${tituloMostrar.replace(/'/g, "\\'")}')" style="cursor: pointer; position: relative; background-image: url('https://images.unsplash.com/photo-1528543606781-2f6e6857f318?auto=format&fit=crop&w=600&q=80');" title="Ver galería de fotos">
                        <div style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.7); color:white; padding:5px 10px; border-radius:20px; font-size:0.8rem; border: 1px solid rgba(255,255,255,0.3);">
                            📸 Ver 3 fotos
                        </div>
                    </div>
                    <div class="contenido-destino">
                        <h2 style="color: var(--primary); margin-top:0;">${tituloMostrar}</h2>
                        <p style="color: #555; font-size: 0.95rem;">${descripcionMostrar}</p>
                        
                        <div class="precio-estandar">
                            <span style="font-size: 0.9rem; color: #666; display: block;">Precio Base Estándar</span>
                            ${precioBase}
                        </div>

                        <p style="color: var(--accent); font-weight: bold; margin-bottom: 5px; text-transform: capitalize;">
                            📅 Salida: ${fechaMostrar}
                        </p>
                        <p style="margin-top: 0;"><strong>👥 Cupos disponibles:</strong> ${lugar.cupos_disponibles} / ${lugar.cupos_totales}</p>
                        
                        <button class="btn-primary" style="background: transparent; color: var(--accent); border: 2px solid var(--accent); margin-bottom: 10px;" onclick="abrirResenas(${lugar.id_destino}, '${tituloMostrar}')">
                            ⭐ Ver Reseñas
                        </button>
                        
                        <button class="btn-primary btn-accent btn-reserva-abajo" onclick="irAReserva(${lugar.id_destino})">
                            Configurar Reserva
                        </button>
                    </div>
                `;
        contenedorDestinos.appendChild(card);
      });
    }

    const btnVolver = document.createElement("button");
    btnVolver.className = "btn-primary";
    btnVolver.style.gridColumn = "1 / -1";
    btnVolver.style.maxWidth = "300px";
    btnVolver.style.margin = "20px auto";
    btnVolver.innerText = "⬅ Limpiar Búsqueda y Volver";
    btnVolver.onclick = () => {
      history.back();
    };
    contenedorDestinos.appendChild(btnVolver);
  } catch (error) {
    console.error("Error en la búsqueda:", error);
  }
}

function irAReserva(idDestino) {
  const usuarioGuardado = localStorage.getItem("usuarioViatros");
  if (!usuarioGuardado) {
    mostrarToast(
      "Acceso Necesario",
      "Para configurar tu reserva, primero debes ingresar a tu cuenta.",
      "🔒",
    );
    setTimeout(() => {
      window.location.href = "login.html";
    }, 3000);
    return;
  }
  window.location.href = `reserva.html?id=${idDestino}`;
}

const fotosDemo = [
  "https://images.unsplash.com/photo-1528543606781-2f6e6857f318?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1583198421868-68747441ea63?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518105779142-d971f22c8e15?auto=format&fit=crop&w=1200&q=80",
];

let indiceFotoActual = 0;

window.abrirGaleria = function (nombreDestino) {
  indiceFotoActual = 0;
  document.getElementById("titulo-galeria").innerText = nombreDestino;
  document.getElementById("modal-galeria").classList.remove("oculto");
  actualizarFoto();
};

window.cerrarGaleria = function () {
  document.getElementById("modal-galeria").classList.add("oculto");
};

window.cambiarFoto = function (direccion) {
  indiceFotoActual += direccion;
  if (indiceFotoActual < 0) indiceFotoActual = fotosDemo.length - 1;
  if (indiceFotoActual >= fotosDemo.length) indiceFotoActual = 0;
  actualizarFoto();
};

window.actualizarFoto = function () {
  const imgElement = document.getElementById("imagen-galeria");
  imgElement.style.opacity = 0;
  setTimeout(() => {
    imgElement.src = fotosDemo[indiceFotoActual];
    imgElement.style.opacity = 1;
    document.getElementById("contador-galeria").innerText =
      `${indiceFotoActual + 1} / ${fotosDemo.length}`;
  }, 150);
};

let destinoResenaActual = 0;

async function abrirResenas(idDestino, nombreLugar) {
  destinoResenaActual = idDestino;
  document.getElementById("titulo-resenas").innerText = nombreLugar;
  document.getElementById("modal-resenas").classList.remove("oculto");
  cargarComentarios();
}

async function cargarComentarios() {
  const contenedor = document.getElementById("lista-comentarios");
  contenedor.innerHTML = "<p>Cargando opiniones...</p>";

  try {
    const res = await fetch(`/api/resenas/${destinoResenaActual}`);
    const resenas = await res.json();

    contenedor.innerHTML = "";
    if (resenas.length === 0) {
      contenedor.innerHTML =
        '<p style="color: #666; font-style: italic;">Aún no hay reseñas. ¡Sé el primero en opinar!</p>';
      return;
    }

    resenas.forEach((r) => {
      const estrellas = "⭐".repeat(r.calificacion);
      const fecha = new Date(r.fecha).toLocaleDateString("es-GT");
      contenedor.innerHTML += `
                <div style="background: rgba(255,255,255,0.6); padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                    <strong style="color: var(--primary);">${r.nombre}</strong> <span style="font-size: 0.8rem; color: #888;">${fecha}</span>
                    <br>
                    <span>${estrellas}</span>
                    <p style="margin: 5px 0 0 0; color: #333; font-size: 0.95rem;">"${r.comentario}"</p>
                </div>
            `;
    });
  } catch (e) {
    contenedor.innerHTML =
      '<p style="color: red;">Error al cargar reseñas.</p>';
  }
}

function mostrarToast(titulo, mensaje, icono = "⚠️") {
  const toast = document.getElementById("toast-notificacion");
  if (!toast) return;

  document.getElementById("toast-titulo").innerText = titulo;
  document.getElementById("toast-mensaje").innerText = mensaje;
  document.getElementById("toast-icono").innerText = icono;

  toast.style.transform = "translateX(0)";
  setTimeout(() => {
    toast.style.transform = "translateX(150vw)";
  }, 4000);
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    const modalGaleria = document.getElementById("modal-galeria");
    const modalResenas = document.getElementById("modal-resenas");

    if (modalGaleria && !modalGaleria.classList.contains("oculto")) {
      if (typeof cerrarGaleria === "function") cerrarGaleria();
      else modalGaleria.classList.add("oculto");
    }
    if (modalResenas && !modalResenas.classList.contains("oculto")) {
      modalResenas.classList.add("oculto");
    }
  }
});

window.addEventListener("popstate", function (event) {
  if (!window.location.hash || window.location.hash !== "#resultados") {
    const seccionMapa = document.getElementById("seccion-mapa");
    const contenedorDestinos = document.getElementById("contenedor-deptos");
    const contenedorBuscador = document.getElementById("contenedor-buscador");

    if (
      contenedorDestinos &&
      !contenedorDestinos.classList.contains("oculto")
    ) {
      contenedorDestinos.classList.add("oculto");
      if (seccionMapa) seccionMapa.classList.remove("oculto");
      if (contenedorBuscador) contenedorBuscador.classList.remove("oculto");

      const titulo = document.querySelector(".titulo-seccion");
      if (titulo) titulo.innerText = `Nuestras Rutas Oficiales`;

      const instruccion = document.getElementById("texto-instruccion");
      if (instruccion)
        instruccion.innerText =
          "Navegue por el mapa o busque su destino ideal.";

      const inputBusqueda = document.getElementById("input-busqueda");
      if (inputBusqueda) inputBusqueda.value = "";
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const seccionMapa = document.getElementById("seccion-mapa");
  if (seccionMapa && typeof inicializarMapa === "function") {
    inicializarMapa();
  }

  const inputBusqueda = document.getElementById("input-busqueda");
  if (inputBusqueda) {
    inputBusqueda.addEventListener("keypress", function (e) {
      if (e.key === "Enter") buscarDestinos();
    });
  }

  const btnEnviarResena = document.getElementById("btn-enviar-resena");
  if (btnEnviarResena) {
    btnEnviarResena.addEventListener("click", async () => {
      const usuarioLogueado = JSON.parse(
        localStorage.getItem("usuarioViatros"),
      );
      if (!usuarioLogueado) {
        mostrarToast(
          "Acceso Necesario",
          "Debes iniciar sesión para dejar una reseña.",
          "🔒",
        );
        return;
      }

      const calificacion = document.getElementById("estrellas-resena").value;
      const comentario = document.getElementById("texto-resena").value.trim();

      if (!comentario) {
        mostrarToast("Atención", "Por favor escribe un comentario.", "✍️");
        return;
      }

      try {
        const peticion = await fetch("/api/resenas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_usuario: usuarioLogueado.id_usuario,
            id_destino: destinoResenaActual,
            calificacion: parseInt(calificacion),
            comentario: comentario,
          }),
        });

        if (peticion.ok) {
          document.getElementById("texto-resena").value = "";
          cargarComentarios();
          mostrarToast(
            "¡Gracias!",
            "Tu reseña ha sido publicada con éxito.",
            "⭐",
          );
        }
      } catch (e) {
        mostrarToast("Error", "Hubo un error al enviar tu reseña.", "🔌");
      }
    });
  }
});
