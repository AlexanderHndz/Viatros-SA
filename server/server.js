require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { poolPromise, sql } = require("./db");

const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/deptos", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT * FROM viatrosApp.dbo.Departamentos");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Clavo en la base de datos: " + err.message);
  }
});

app.get("/api/destinos/:idDepto", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("idDepto", sql.Int, req.params.idDepto)
      .query("SELECT * FROM viatrosApp.dbo.Destinos WHERE id_depto = @idDepto");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("No pudimos traer los destinos.");
  }
});

app.get("/api/buscar-destinos", async (req, res) => {
  try {
    const termino = req.query.q || "";
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("termino", sql.VarChar, `%${termino}%`).query(`
                SELECT * FROM viatrosApp.dbo.Destinos 
                WHERE nombre_lugar LIKE @termino OR descripcion LIKE @termino
            `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la brújula de búsqueda.");
  }
});

app.get("/api/destino-individual/:idDestino", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.idDestino)
      .query("SELECT * FROM viatrosApp.dbo.Destinos WHERE id_destino = @id");
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).send("Error al buscar el lugar.");
  }
});

app.post("/api/registro", async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    const pool = await poolPromise;

    const existe = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM viatrosApp.dbo.Usuarios WHERE email = @email");

    if (existe.recordset.length > 0)
      return res
        .status(400)
        .json({ exito: false, mensaje: "El correo ya está registrado." });

    const codigoOTP = Math.floor(100000 + Math.random() * 900000).toString();

    await pool
      .request()
      .input("nombre", sql.VarChar, nombre)
      .input("email", sql.VarChar, email)
      .input("pass", sql.VarChar, password)
      .input("codigo", sql.VarChar, codigoOTP)
      .query(
        "INSERT INTO viatrosApp.dbo.Usuarios (nombre, email, password, codigo_verificacion, correo_verificado) VALUES (@nombre, @email, @pass, @codigo, 0)",
      );

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    let mailOptions = {
      from: `"Viatros, S. A." <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Código de Verificación - Viatros, S.A.",
      html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #003366;">¡Bienvenido a Viatros, ${nombre}!</h2>
                    <p>Para activar tu cuenta y empezar a viajar, ingresa el siguiente código de 6 dígitos en la página:</p>
                    <h1 style="font-size: 40px; color: #ff8c00; letter-spacing: 5px; background: #f4f4f4; padding: 10px; border-radius: 10px; display: inline-block;">${codigoOTP}</h1>
                    <p style="color: #777; font-size: 12px; margin-top: 20px;">Si no solicitaste este registro, ignora este correo.</p>
                </div>
            `,
    };
    await transporter.sendMail(mailOptions);
    res.json({ exito: true, mensaje: "Registro exitoso. Revisa tu correo." });
  } catch (err) {
    res
      .status(500)
      .json({ exito: false, mensaje: "Error en el servidor al registrar." });
  }
});

app.post("/api/verificar-codigo", async (req, res) => {
  try {
    const { email, codigo } = req.body;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .input("codigo", sql.VarChar, codigo)
      .query(
        "SELECT * FROM viatrosApp.dbo.Usuarios WHERE email = @email AND codigo_verificacion = @codigo",
      );

    if (result.recordset.length > 0) {
      await pool
        .request()
        .input("email", sql.VarChar, email)
        .query(
          "UPDATE viatrosApp.dbo.Usuarios SET correo_verificado = 1, codigo_verificacion = NULL WHERE email = @email",
        );
      res.json({ exito: true, mensaje: "Cuenta activada correctamente." });
    } else {
      res.json({
        exito: false,
        mensaje: "Código incorrecto o cuenta ya verificada.",
      });
    }
  } catch (err) {
    res.status(500).json({ exito: false, mensaje: "Error al verificar." });
  }
});

app.post("/api/solicitar-recuperacion", async (req, res) => {
  try {
    const { email } = req.body;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM viatrosApp.dbo.Usuarios WHERE email = @email");

    if (result.recordset.length === 0)
      return res.json({
        exito: false,
        mensaje: "No existe ninguna cuenta registrada con este correo.",
      });

    const codigoOTP = Math.floor(100000 + Math.random() * 900000).toString();
    await pool
      .request()
      .input("email", sql.VarChar, email)
      .input("codigo", sql.VarChar, codigoOTP)
      .query(
        "UPDATE viatrosApp.dbo.Usuarios SET codigo_verificacion = @codigo WHERE email = @email",
      );

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    let mailOptions = {
      from: `"Viatros, S. A." <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔑 Recuperación de Contraseña - Viatros, S.A.",
      html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #003366;">Recuperación de Contraseña</h2>
                    <p>Hemos recibido una solicitud para restablecer tu contraseña. Ingresa este código en la página:</p>
                    <h1 style="font-size: 40px; color: #dc3545; letter-spacing: 5px; background: #f4f4f4; padding: 10px; border-radius: 10px; display: inline-block;">${codigoOTP}</h1>
                </div>
            `,
    };
    await transporter.sendMail(mailOptions);
    res.json({
      exito: true,
      mensaje: "Código enviado. Revisa tu correo electrónico.",
    });
  } catch (err) {
    res
      .status(500)
      .json({ exito: false, mensaje: "Error al solicitar recuperación." });
  }
});

app.post("/api/cambiar-password", async (req, res) => {
  try {
    const { email, codigo, nuevaPassword } = req.body;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .input("codigo", sql.VarChar, codigo)
      .query(
        "SELECT * FROM viatrosApp.dbo.Usuarios WHERE email = @email AND codigo_verificacion = @codigo",
      );

    if (result.recordset.length > 0) {
      const saltRounds = 10;
      const passwordEncriptada = await bcrypt.hash(nuevaPassword, saltRounds);
      await pool
        .request()
        .input("email", sql.VarChar, email)
        .input("pass", sql.VarChar, passwordEncriptada)
        .query(
          "UPDATE viatrosApp.dbo.Usuarios SET password = @pass, codigo_verificacion = NULL WHERE email = @email",
        );
      res.json({
        exito: true,
        mensaje: "¡Contraseña actualizada exitosamente!",
      });
    } else {
      res.json({
        exito: false,
        mensaje: "El código de seguridad es incorrecto o ya expiró.",
      });
    }
  } catch (err) {
    res
      .status(500)
      .json({ exito: false, mensaje: "Error al cambiar la contraseña." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .input("pass", sql.VarChar, password)
      .query(
        "SELECT * FROM viatrosApp.dbo.Usuarios WHERE email = @email AND password = @pass",
      );

    if (result.recordset.length > 0) {
      const usuario = result.recordset[0];
      if (!usuario.correo_verificado) {
        return res.json({
          exito: false,
          requiereVerificacion: true,
          mensaje:
            "⚠️ Tu cuenta aún no está activada. Ingresa el código de 6 dígitos que te enviamos al correo.",
        });
      }
      res.json({
        exito: true,
        usuario: {
          id_usuario: usuario.id_usuario,
          nombre: usuario.nombre,
          email: usuario.email,
        },
      });
    } else {
      res.json({ exito: false, mensaje: "Correo o contraseña incorrectos." });
    }
  } catch (err) {
    res.status(500).json({ exito: false, mensaje: "Error en el servidor." });
  }
});

app.get("/api/resenas/:idDestino", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.idDestino).query(`
                SELECT r.calificacion, r.comentario, r.fecha, u.nombre 
                FROM viatrosApp.dbo.Resenas r
                INNER JOIN viatrosApp.dbo.Usuarios u ON r.id_usuario = u.id_usuario
                WHERE r.id_destino = @id ORDER BY r.fecha DESC
            `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error al cargar reseñas.");
  }
});

app.post("/api/resenas", async (req, res) => {
  try {
    const { id_usuario, id_destino, calificacion, comentario } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("id_u", sql.Int, id_usuario)
      .input("id_d", sql.Int, id_destino)
      .input("cal", sql.Int, calificacion)
      .input("com", sql.VarChar, comentario)
      .query(
        "INSERT INTO viatrosApp.dbo.Resenas (id_usuario, id_destino, calificacion, comentario) VALUES (@id_u, @id_d, @cal, @com)",
      );
    res.json({ exito: true });
  } catch (err) {
    res.status(500).json({ exito: false });
  }
});

app.post("/api/reservar", async (req, res) => {
  try {
    const {
      id_usuario,
      id_destino,
      fecha_viaje,
      cupos,
      tipo_paquete,
      precio_total,
      dpi,
      telefono,
      metodo_pago,
      cuotas,
    } = req.body;
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await transaction
        .request()
        .input("cupos", sql.Int, cupos)
        .input("id", sql.Int, id_destino)
        .query(
          "UPDATE viatrosApp.dbo.Destinos SET cupos_disponibles = cupos_disponibles - @cupos WHERE id_destino = @id",
        );

      await transaction
        .request()
        .input("id_u", sql.Int, id_usuario)
        .input("id_d", sql.Int, id_destino)
        .input("fecha", sql.Date, fecha_viaje)
        .input("cupos", sql.Int, cupos)
        .input("tipo", sql.VarChar, tipo_paquete)
        .input("precio", sql.Decimal, precio_total)
        .input("dpi", sql.VarChar, dpi)
        .input("tel", sql.VarChar, telefono)
        .input("metodo", sql.VarChar, metodo_pago)
        .query(
          "INSERT INTO viatrosApp.dbo.Reservas (id_usuario, id_destino, fecha_viaje, cupos_reservados, tipo_paquete, precio_total, dpi_cliente, telefono_cliente, metodo_pago) VALUES (@id_u, @id_d, @fecha, @cupos, @tipo, @precio, @dpi, @tel, @metodo)",
        );

      const datosCliente = await transaction
        .request()
        .input("id_u", sql.Int, id_usuario)
        .query(
          "SELECT nombre, email FROM viatrosApp.dbo.Usuarios WHERE id_usuario = @id_u",
        );
      const datosDestino = await transaction
        .request()
        .input("id_d", sql.Int, id_destino)
        .query(
          "SELECT nombre_lugar FROM viatrosApp.dbo.Destinos WHERE id_destino = @id_d",
        );

      const cliente = datosCliente.recordset[0];
      const destino = datosDestino.recordset[0];

      await transaction.commit();

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      let buffers = [];
      doc.on("data", buffers.push.bind(buffers));

      doc.on("end", async () => {
        try {
          let pdfData = Buffer.concat(buffers);
          let transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          const esEfectivo = metodo_pago === "efectivo";
          const asuntoCorreo = esEfectivo
            ? "⏳ Tu Pre-Reserva está lista - Viatros, S.A."
            : "🎫 Tu Pase de Abordar Oficial - Viatros, S.A.";

          const fechaObj = new Date(fecha_viaje);
          fechaObj.setMinutes(
            fechaObj.getMinutes() + fechaObj.getTimezoneOffset(),
          );
          const fechaViajeTxt = fechaObj.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          const tituloPrincipal = esEfectivo
            ? "¡Pre-Reserva Lista!"
            : "¡Aventura Confirmada!";
          const colorPrincipal = esEfectivo ? "#dc3545" : "#001f3f";
          const estadoPagoHtml = esEfectivo
            ? `<span style="color: #dc3545; font-weight: bold; font-size: 18px;">Q${precio_total}.00</span> <span style="font-size: 13px; color: #dc3545;">(PENDIENTE DE PAGO)</span>`
            : `<span style="color: #ff8c00; font-weight: bold; font-size: 18px;">Q${precio_total}.00</span> <span style="font-size: 13px; color: #888;">(PAGADO)</span>`;

          const instruccionesHtml = esEfectivo
            ? ` <li style="margin-bottom: 8px; color: #dc3545;"><strong>1. Tienes 48 horas para realizar el pago en nuestras oficinas (Miraflores u Oakland Mall).</strong></li>
                            <li style="margin-bottom: 8px;">2. Presenta tu DPI en caja.</li>
                            <li>3. Una vez pagado, te enviaremos tu Pase de Abordar oficial con código QR.</li>`
            : ` <li style="margin-bottom: 8px;">1. Preséntate <strong>15 minutos antes</strong> de la hora de salida.</li>
                            <li style="margin-bottom: 8px;">2. Es obligatorio presentar tu <strong>DPI original</strong> y físico.</li>
                            <li>3. Muestra el <strong>Pase de Abordar (PDF adjunto)</strong> desde tu celular al coordinador.</li>`;

          const htmlCorreoConfirmacion = `
                    <!DOCTYPE html>
                    <html lang="es">
                    <head><meta charset="UTF-8"></head>
                    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7f6; color: #333333;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7f6; padding: 20px 0;">
                            <tr><td align="center">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                                    <tr>
                                        <td style="background-color: ${colorPrincipal}; padding: 30px; text-align: center;">
                                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">Viatros, S. A.</h1>
                                            <p style="color: #ffffff; opacity: 0.8; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Notificación de Reserva</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 40px 30px;">
                                            <h2 style="margin-top: 0; color: ${colorPrincipal}; font-size: 22px;">${tituloPrincipal}, ${cliente.nombre.split(" ")[0]} 🎒</h2>
                                            <p style="font-size: 16px; line-height: 1.6; color: #555555;">
                                                Gracias por confiar en <strong>Viatros, S.A.</strong> Adjunto a este correo encontrarás el documento oficial con los detalles de tu solicitud.
                                            </p>
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0; background-color: #f8f9fa; border-left: 4px solid ${esEfectivo ? "#dc3545" : "#ff8c00"}; border-radius: 4px;">
                                                <tr>
                                                    <td style="padding: 20px;">
                                                        <h3 style="margin: 0 0 15px 0; color: #001f3f; font-size: 18px; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">Detalles de tu Viaje</h3>
                                                        <p style="margin: 0 0 10px 0; font-size: 15px;"><strong>📍 Destino:</strong> ${destino.nombre_lugar}</p>
                                                        <p style="margin: 0 0 10px 0; font-size: 15px; text-transform: capitalize;"><strong>📅 Salida:</strong> ${fechaViajeTxt}</p>
                                                        <p style="margin: 0 0 10px 0; font-size: 15px;"><strong>👥 Pasajeros:</strong> ${cupos} | <strong>📦 Paquete:</strong> ${tipo_paquete}</p>
                                                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #cccccc;">
                                                            <p style="margin: 0; font-size: 16px;"><strong>Monto:</strong> ${estadoPagoHtml}</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>
                                            <h3 style="color: #001f3f; font-size: 18px; margin-bottom: 10px;">⚠️ Instrucciones Importantes</h3>
                                            <ul style="font-size: 15px; line-height: 1.6; color: #555555; padding-left: 20px; margin-bottom: 0;">
                                                ${instruccionesHtml}
                                            </ul>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="background-color: #e9ecef; padding: 30px; text-align: center; border-top: 1px solid #dddddd;">
                                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #555555; font-weight: bold;">Viatros, S. A.</p>
                                            <p style="margin: 0; font-size: 12px; color: #999999;">📍 Oficinas: Miraflores (Of. 409) | Oakland Mall (Of. 309)<br>📞 +(502) 2222-3333 | ✉️ viatrossa@gmail.com</p>
                                        </td>
                                    </tr>
                                </table>
                            </td></tr>
                        </table>
                    </body>
                    </html>
                    `;

          let mailOptions = {
            from: `"Viatros, S. A." <${process.env.EMAIL_USER}>`,
            to: cliente.email,
            subject: asuntoCorreo,
            html: htmlCorreoConfirmacion,
            attachments: [
              {
                filename: esEfectivo
                  ? `Pre_Reserva_${id_destino}.pdf`
                  : `Boleto_Viatros_${id_destino}.pdf`,
                content: pdfData,
              },
            ],
          };

          await transporter.sendMail(mailOptions);
          res.json({ exito: true });
        } catch (errorCorreo) {
          res.json({
            exito: true,
            advertencia: "Reserva guardada, correo falló.",
          });
        }
      });

      const esEfectivo = metodo_pago === "efectivo";

      doc
        .fillColor("#003366")
        .fontSize(28)
        .font("Helvetica-Bold")
        .text("VIATROS, S. A.", 50, 50);

      if (esEfectivo) {
        doc
          .fontSize(12)
          .fillColor("#dc3545")
          .text("PRE-RESERVA (PENDIENTE DE PAGO)", 50, 80);
        doc
          .fontSize(10)
          .fillColor("#333333")
          .font("Helvetica")
          .text("Pre-Reserva No.:", 350, 50, { align: "right" })
          .font("Helvetica-Bold")
          .text(`PEND-${Math.floor(Math.random() * 10000)}`, 400, 65, {
            align: "right",
          });
      } else {
        doc
          .fontSize(10)
          .fillColor("#ff8c00")
          .text("El viaje de tu vida - PAGADO", 50, 80);
        doc
          .fontSize(10)
          .fillColor("#333333")
          .font("Helvetica")
          .text("Pase de abordar No.:", 350, 50, { align: "right" })
          .font("Helvetica-Bold")
          .text(`VTR-${Math.floor(Math.random() * 10000)}`, 400, 65, {
            align: "right",
          });
      }

      doc
        .font("Helvetica")
        .text("Fecha:", 350, 85, { align: "right" })
        .text(new Date().toLocaleDateString("es-GT"), 400, 100, {
          align: "right",
        });
      doc.moveDown(3);

      const startY = 150;
      doc
        .fontSize(12)
        .fillColor("#003366")
        .font("Helvetica-Bold")
        .text("Datos del Pasajero", 50, startY);
      doc
        .fontSize(10)
        .fillColor("#333333")
        .font("Helvetica")
        .text(`Nombre: ${cliente.nombre}`, 50, startY + 20)
        .text(`DPI: ${dpi}`, 50, startY + 35)
        .text(`Teléfono: ${telefono}`, 50, startY + 50);

      doc
        .fontSize(12)
        .fillColor("#003366")
        .font("Helvetica-Bold")
        .text("Detalles del Viaje", 300, startY);
      doc
        .fontSize(10)
        .fillColor("#333333")
        .font("Helvetica")
        .text(`Destino: ${destino.nombre_lugar}`, 300, startY + 20)
        .text(`Fecha: ${fecha_viaje}`, 300, startY + 35)
        .text(`Paquete: ${tipo_paquete}`, 300, startY + 50);

      const tableY = 250;
      doc.rect(50, tableY, 495, 25).fill(esEfectivo ? "#777777" : "#003366");
      doc
        .fillColor("#ffffff")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("DESCRIPCIÓN", 60, tableY + 8)
        .text("ESTADO", 350, tableY + 8)
        .text("TOTAL", 450, tableY + 8);
      doc
        .fillColor("#333333")
        .font("Helvetica")
        .text(`Aventura en ${destino.nombre_lugar}`, 60, tableY + 40)
        .text(esEfectivo ? "PENDIENTE" : "PAGADO", 350, tableY + 40)
        .text(`Q ${precio_total}.00`, 450, tableY + 40);

      if (metodo_pago === "tarjeta") {
        if (cuotas > 1) {
          let valorCuota = (precio_total / cuotas).toFixed(2);
          doc
            .fontSize(9)
            .fillColor("#0055aa")
            .font("Helvetica-Bold")
            .text(
              `* Procesado en ${cuotas} Visacuotas de Q${valorCuota} mensuales.`,
              60,
              tableY + 55,
            );
        } else {
          doc
            .fontSize(9)
            .fillColor("#666666")
            .font("Helvetica")
            .text(
              `* Método: Tarjeta de Crédito/Débito (Pago de contado).`,
              60,
              tableY + 55,
            );
        }
      } else if (metodo_pago === "transferencia") {
        doc
          .fontSize(9)
          .fillColor("#28a745")
          .font("Helvetica-Bold")
          .text(
            `* Método: Transferencia Bancaria (Comprobante Recibido).`,
            60,
            tableY + 55,
          );
      }

      doc
        .moveTo(300, tableY + 80)
        .lineTo(545, tableY + 80)
        .lineWidth(1)
        .stroke("#eeeeee");
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#333333")
        .text(
          esEfectivo ? "Total a Pagar:" : "Total Pagado:",
          320,
          tableY + 100,
        );
      doc
        .fontSize(14)
        .fillColor(esEfectivo ? "#dc3545" : "#ff8c00")
        .text(`Q ${precio_total}.00`, 450, tableY + 98);

      if (esEfectivo) {
        doc
          .fontSize(14)
          .fillColor("#dc3545")
          .font("Helvetica-Bold")
          .text("IMPORTANTE - INSTRUCCIONES DE PAGO", 50, tableY + 150);
        doc
          .fontSize(11)
          .fillColor("#333333")
          .font("Helvetica")
          .text(
            "1. Preséntate en nuestras oficinas dentro de las próximas 48 horas:",
            50,
            tableY + 175,
          )
          .text(
            "   • Miraflores: Zona 11, 4to Nivel, Of. 409.",
            50,
            tableY + 195,
          )
          .text(
            "   • Oakland Mall: Zona 10, 3er Nivel, Of. 309.",
            50,
            tableY + 210,
          )
          .text(
            "2. Indica tu número de DPI en caja para aplicar el pago.",
            50,
            tableY + 235,
          )
          .text(
            "3. Una vez pagado, se te enviará tu pase de abordar oficial con el QR.",
            50,
            tableY + 250,
          );
      } else {
        const datosQR = `VIATROS-RESERVA | Cliente: ${dpi} | Destino: ${id_destino} | Pagado: SI`;
        const qrImage = await QRCode.toDataURL(datosQR);
        doc.image(qrImage, 50, tableY + 130, { fit: [100, 100] });
        doc
          .fontSize(12)
          .fillColor("#003366")
          .font("Helvetica-Bold")
          .text("Instrucciones de Abordaje", 160, tableY + 140);
        doc
          .fontSize(9)
          .fillColor("#555555")
          .font("Helvetica")
          .text(
            "1. Presenta este código QR desde tu celular al subir al transporte.",
            160,
            tableY + 160,
          )
          .text("2. Lleva tu DPI original en mano.", 160, tableY + 175)
          .text(
            "3. Preséntate 15 minutos antes de la hora de salida.",
            160,
            tableY + 190,
          );
      }

      doc
        .fontSize(8)
        .fillColor("#aaaaaa")
        .text(
          "Este documento es generado electrónicamente por Viatros, S.A.",
          50,
          700,
          { align: "center" },
        );
      doc.end();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ exito: false });
  }
});

app.get("/api/mis-reservas/:idUsuario", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.idUsuario).query(`
                SELECT r.id_reserva, r.fecha_viaje, r.cupos_reservados, r.tipo_paquete, r.precio_total, r.metodo_pago, d.nombre_lugar 
                FROM viatrosApp.dbo.Reservas r
                INNER JOIN viatrosApp.dbo.Destinos d ON r.id_destino = d.id_destino
                WHERE r.id_usuario = @id
                ORDER BY r.fecha_reserva DESC
            `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error al cargar el perfil.");
  }
});

app.get("/api/descargar-boleto/:idReserva", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.idReserva).query(`
                SELECT r.*, u.nombre, u.email, d.nombre_lugar 
                FROM viatrosApp.dbo.Reservas r
                INNER JOIN viatrosApp.dbo.Usuarios u ON r.id_usuario = u.id_usuario
                INNER JOIN viatrosApp.dbo.Destinos d ON r.id_destino = d.id_destino
                WHERE r.id_reserva = @id
            `);

    if (result.recordset.length === 0)
      return res.status(404).send("Reserva no encontrada");
    const reserva = result.recordset[0];

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Pase_Abordar_Viatros_${reserva.id_reserva}.pdf"`,
    );

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    const fechaFormateada = new Date(reserva.fecha_viaje).toLocaleDateString(
      "es-GT",
    );
    const datosQR = `VIATROS-RESERVA | Cliente: ${reserva.dpi_cliente} | Viaje: ${reserva.id_reserva} | Fecha: ${fechaFormateada}`;
    const qrImage = await QRCode.toDataURL(datosQR);

    doc
      .fillColor("#003366")
      .fontSize(28)
      .font("Helvetica-Bold")
      .text("VIATROS, S. A.", 50, 50);
    doc.fontSize(10).fillColor("#ff8c00").text("El viaje de tu vida", 50, 80);
    doc
      .fontSize(10)
      .fillColor("#333333")
      .font("Helvetica")
      .text("Pase de abordar No.:", 350, 50, { align: "right" })
      .font("Helvetica-Bold")
      .text(`VTR-00${reserva.id_reserva}`, 400, 65, { align: "right" })
      .font("Helvetica")
      .text("Fecha de viaje:", 350, 85, { align: "right" })
      .text(fechaFormateada, 400, 100, { align: "right" });
    doc.moveDown(3);

    const startY = 150;
    doc
      .fontSize(12)
      .fillColor("#003366")
      .font("Helvetica-Bold")
      .text("Datos del Pasajero", 50, startY);
    doc
      .fontSize(10)
      .fillColor("#333333")
      .font("Helvetica")
      .text(`Nombre: ${reserva.nombre}`, 50, startY + 20)
      .text(`DPI: ${reserva.dpi_cliente}`, 50, startY + 35)
      .text(`Teléfono: ${reserva.telefono_cliente}`, 50, startY + 50);

    doc
      .fontSize(12)
      .fillColor("#003366")
      .font("Helvetica-Bold")
      .text("Detalles del Viaje", 300, startY);
    doc
      .fontSize(10)
      .fillColor("#333333")
      .font("Helvetica")
      .text(`Destino: ${reserva.nombre_lugar}`, 300, startY + 20)
      .text(`Paquete: ${reserva.tipo_paquete}`, 300, startY + 35)
      .text(`Cupos: ${reserva.cupos_reservados} personas`, 300, startY + 50);

    const tableY = 250;
    doc.rect(50, tableY, 495, 25).fill("#003366");
    doc
      .fillColor("#ffffff")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("DESCRIPCIÓN", 60, tableY + 8)
      .text("ESTADO", 350, tableY + 8)
      .text("TOTAL", 450, tableY + 8);
    doc
      .fillColor("#333333")
      .font("Helvetica")
      .text(`Aventura en ${reserva.nombre_lugar}`, 60, tableY + 40)
      .text(`PAGADO`, 350, tableY + 40)
      .text(`Q ${reserva.precio_total}.00`, 450, tableY + 40);

    doc
      .moveTo(300, tableY + 70)
      .lineTo(545, tableY + 70)
      .lineWidth(1)
      .stroke("#eeeeee");
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("Total Pagado:", 320, tableY + 90);
    doc
      .fontSize(14)
      .fillColor("#ff8c00")
      .text(`Q ${reserva.precio_total}.00`, 450, tableY + 88);

    doc.image(qrImage, 50, tableY + 120, { fit: [100, 100] });
    doc
      .fontSize(12)
      .fillColor("#003366")
      .font("Helvetica-Bold")
      .text("Instrucciones de Abordaje", 160, tableY + 130);
    doc
      .fontSize(9)
      .fillColor("#555555")
      .font("Helvetica")
      .text(
        "1. Presenta este código QR desde tu celular al momento de subir al transporte.",
        160,
        tableY + 150,
      )
      .text("2. Lleva tu DPI original en mano.", 160, tableY + 165)
      .text(
        "3. Preséntate 15 minutos antes de la hora de salida.",
        160,
        tableY + 180,
      );
    doc
      .fontSize(8)
      .fillColor("#aaaaaa")
      .text(
        "Documento oficial generado electrónicamente por Viatros, S.A.",
        50,
        700,
        { align: "center" },
      );

    doc.end();
  } catch (err) {
    console.log(err);
    res.status(500).send("Error al generar el boleto.");
  }
});

app.delete("/api/cancelar-reserva/:idReserva", async (req, res) => {
  try {
    const idReserva = req.params.idReserva;
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const resInfo = await transaction
        .request()
        .input("idR", sql.Int, idReserva).query(`
                    SELECT r.cupos_reservados, r.id_destino, r.metodo_pago, u.nombre, u.email, d.nombre_lugar
                    FROM viatrosApp.dbo.Reservas r
                    INNER JOIN viatrosApp.dbo.Usuarios u ON r.id_usuario = u.id_usuario
                    INNER JOIN viatrosApp.dbo.Destinos d ON r.id_destino = d.id_destino
                    WHERE r.id_reserva = @idR
                `);

      if (resInfo.recordset.length === 0)
        throw new Error("Reserva no encontrada");
      const reserva = resInfo.recordset[0];
      const metodo = reserva.metodo_pago || "tarjeta";

      await transaction
        .request()
        .input("cupos", sql.Int, reserva.cupos_reservados)
        .input("idD", sql.Int, reserva.id_destino)
        .query(
          "UPDATE viatrosApp.dbo.Destinos SET cupos_disponibles = cupos_disponibles + @cupos WHERE id_destino = @idD",
        );

      await transaction
        .request()
        .input("idR", sql.Int, idReserva)
        .query("DELETE FROM viatrosApp.dbo.Reservas WHERE id_reserva = @idR");

      await transaction.commit();

      let tituloReembolso = "";
      let textoReembolso = "";
      let instruccionesExtra = "";

      if (metodo === "tarjeta") {
        tituloReembolso = "Reembolso Automático Procesado 💳";
        textoReembolso =
          "El reintegro de tu pago ha sido enviado automáticamente a tu procesador de pagos. Los fondos se devolverán a la tarjeta de crédito o débito utilizada originalmente en la compra.";
        instruccionesExtra =
          "<p style='margin: 0; font-size: 15px; color: #444;'><strong>⏳ Tiempo estimado:</strong> De 3 a 5 días hábiles, dependiendo de las políticas de tu banco.</p>";
      } else {
        tituloReembolso = "Coordinación de Reintegro Manual 🏦";
        textoReembolso = `Como tu método de pago fue por <strong>${metodo.toUpperCase()}</strong>, necesitamos coordinar la devolución de tus fondos de forma personalizada y segura.`;
        instruccionesExtra = `
                    <p style='margin: 0 0 10px 0; font-size: 15px; color: #444;'>Por favor, realiza <strong>una</strong> de las siguientes acciones teniendo a la mano tu DPI y el número de reserva <strong>#${idReserva}</strong>:</p>
                    <ul style='margin: 0; padding-left: 20px; font-size: 15px; color: #444; line-height: 1.6;'>
                        <li>Envíanos un mensaje directo a nuestra <a href="https://www.facebook.com/" target="_blank" style="color: #1877F2; text-decoration: underline; font-weight: bold;">Página Oficial de Facebook</a>.</li>
                        <li>Visita cualquiera de nuestras agencias físicas en Miraflores u Oakland Mall.</li>
                    </ul>
                `;
      }

      const htmlCorreoCancelacion = `
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"></head>
            <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7f6; color: #333333;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7f6; padding: 20px 0;">
                    <tr><td align="center">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                            <tr>
                                <td style="background-color: #dc3545; padding: 30px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">Viatros, S. A.</h1>
                                    <p style="color: #ffffff; opacity: 0.9; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Cancelación de Reserva</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 40px 30px;">
                                    <h2 style="margin-top: 0; color: #dc3545; font-size: 22px;">Viaje Cancelado, ${reserva.nombre.split(" ")[0]}</h2>
                                    <p style="font-size: 16px; line-height: 1.6; color: #555555;">
                                        Te confirmamos que hemos procesado tu solicitud. Tu viaje a <strong>${reserva.nombre_lugar}</strong> ha sido cancelado exitosamente y tus cupos han sido liberados en nuestro sistema.
                                    </p>
                                    
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0; background-color: #f8f9fa; border-left: 4px solid #6c757d; border-radius: 4px;">
                                        <tr>
                                            <td style="padding: 20px;">
                                                <h3 style="margin: 0 0 10px 0; color: #001f3f; font-size: 18px;">${tituloReembolso}</h3>
                                                <p style="margin: 0 0 15px 0; font-size: 15px; color: #555555; line-height: 1.5;">${textoReembolso}</p>
                                                <div style="padding-top: 15px; border-top: 1px dashed #cccccc;">
                                                    ${instruccionesExtra}
                                                </div>
                                            </td>
                                        </tr>
                                    </table>

                                    <p style="font-size: 15px; line-height: 1.6; color: #555555; margin-bottom: 0;">
                                        Lamentamos mucho que no puedas acompañarnos en esta ocasión. Esperamos tener el honor de viajar contigo en tu próxima aventura.
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td style="background-color: #e9ecef; padding: 30px; text-align: center; border-top: 1px solid #dddddd;">
                                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #555555; font-weight: bold;">Viatros, S. A.</p>
                                    <p style="margin: 0; font-size: 12px; color: #999999;">📍 Miraflores (Of. 409) | Oakland Mall (Of. 309)<br>📞 +(502) 2222-3333 | ✉️ viatrossa@gmail.com</p>
                                </td>
                            </tr>
                        </table>
                    </td></tr>
                </table>
            </body>
            </html>
            `;

      let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      let mailOptions = {
        from: `"Viatros, S. A." <${process.env.EMAIL_USER}>`,
        to: reserva.email,
        subject: "❌ Cancelación de Reserva y Reembolso - Viatros, S.A.",
        html: htmlCorreoCancelacion,
      };

      await transporter.sendMail(mailOptions);
      res.json({ exito: true, metodo_pago: metodo });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ exito: false, mensaje: "Error al cancelar." });
  }
});

app.listen(PORT, () => {
  console.log(`Viatros, S. A. funcionando en http://localhost:${PORT}`);
});
