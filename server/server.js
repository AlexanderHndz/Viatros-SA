require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { poolPromise, sql } = require('./db');
const { unsubscribe } = require('diagnostics_channel');

const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { buffer } = require('stream/consumers');

const app = express();
const PORT = 3000;

// Mira aquí le decimos al servidor que acepte datos y que use la carpeta 'public' para el diseño.
app.use(cors());
app.use(express.json()); 
app.use(express.static(path.join(__dirname, '../public')));

// --- RUTAS DEL CATÁLOGO ---

// Esta ruta nos trae los 22 departamentos para armar los cuadritos del inicio.
app.get('/api/deptos', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM viatrosApp.dbo.Departamentos');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send("Clavo en la base de datos: " + err.message);
    }
});

// Cuando haces clic en un departamento, esta ruta busca qué lugares tiene guardados.
app.get('/api/destinos/:idDepto', async (req, res) => {
    try {
        const { idDepto } = req.params;
        const pool = await poolPromise; 
        const result = await pool.request()
            .input('idDepto', sql.Int, idDepto)
            .query('SELECT * FROM viatrosApp.dbo.Destinos WHERE id_depto = @idDepto');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send("No pudimos traer los destinos.");
    }
});

// --- SEGURIDAD Y USUARIOS ---

// Aquí guardamos a los clientes nuevos en la base de datos.
app.post('/api/registro', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('email', sql.VarChar, email)
            .input('password', sql.VarChar, hashedPassword)
            .query('INSERT INTO viatrosApp.dbo.Usuarios (nombre, email, password) VALUES (@nombre, @email, @password)');
        res.status(201).json({ exito: true });
    } catch (err) {
        res.status(500).json({ exito: false, mensaje: 'Ese correo ya existe.' });
    }
});

// Revisamos si el correo y la clave coinciden con lo que hay en SQL.
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const pool = await poolPromise;

        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT id_usuario, nombre, email, password FROM viatrosApp.dbo.Usuarios WHERE email = @email');

        if (result.recordset.length > 0) { 
            const usuario = result.recordset[0];
            const coincide = await bcrypt.compare(password, usuario.password);
            if (coincide) {
                delete usuario.password;
                res.json({ exito: true, usuario: usuario });
            } else {
                res.status(401).json({ exito: false, mensaje: 'Datos incorrectos.' })
            }

        } else {
                res.status(401).json({ exito: false, mensaje: 'Datos incorrectos.'} )
            }

    } catch (err) {
        res.status(500).json({ exito: false });
    }
});

// --- RESERVAS ---

// Solo nos trae la info de un lugar para llenar la página de reserva.
app.get('/api/destino-individual/:idDestino', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.idDestino)
            .query('SELECT * FROM viatrosApp.dbo.Destinos WHERE id_destino = @id');
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).send("Error al buscar el lugar.");
    }
});

// Resta los cupos y guarda la reserva al mismo tiempo.
// Si algo falla, el rollback deshace todo para no dejar datos a medias.
app.post('/api/reservar', async (req, res) => {
    try {
        const { id_usuario, id_destino, fecha_viaje, cupos, tipo_paquete, precio_total, dpi, telefono } = req.body;
        const pool = await poolPromise;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request()
                .input('cupos', sql.Int, cupos)
                .input('id', sql.Int, id_destino)
                .query('UPDATE viatrosApp.dbo.Destinos SET cupos_disponibles = cupos_disponibles - @cupos WHERE id_destino = @id');

            await transaction.request()
                .input('id_u', sql.Int, id_usuario)
                .input('id_d', sql.Int, id_destino)
                .input('fecha', sql.Date, fecha_viaje)
                .input('cupos', sql.Int, cupos)
                .input('tipo', sql.VarChar, tipo_paquete)
                .input('precio', sql.Decimal, precio_total)
                .input('dpi', sql.VarChar, dpi)
                .input('tel', sql.VarChar, telefono)
                .query('INSERT INTO viatrosApp.dbo.Reservas (id_usuario, id_destino, fecha_viaje, cupos_reservados, tipo_paquete, precio_total, dpi_cliente, telefono_cliente) VALUES (@id_u, @id_d, @fecha, @cupos, @tipo, @precio, @dpi, @tel)');

            const datosCliente = await transaction.request()
                .input('id_u', sql.Int, id_usuario)
                .query('SELECT nombre, email FROM viatrosApp.dbo.Usuarios WHERE id_usuario = @id_u');
            
            const datosDestino = await transaction.request()
                .input('id_d', sql.Int, id_destino)
                .query('SELECT nombre_lugar FROM viatrosApp.dbo.Destinos WHERE id_destino = @id_d');

            const cliente = datosCliente.recordset[0];
            const destino = datosDestino.recordset[0];

            await transaction.commit();
            
            const doc = new PDFDocument({ margin: 50 });
            let buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            
            // --- NUEVO BLOQUE CON DETECTOR DE ERRORES ---
            doc.on('end', async () => {
                try {
                    let pdfData = Buffer.concat(buffers);

                    let transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        }
                    });

                    let mailOptions = {
                        from: `"Viatros, S. A." <${process.env.EMAIL_USER}>`,
                        to: cliente.email,
                        subject: '🎫 ¡Tu reserva está confirmada! - Viatros, S.A.',
                        text: `Hola ${cliente.nombre},\n\nGracias por reservar con nosotros. Adjunto encontrarás tu pase de abordar para tu viaje a ${destino.nombre_lugar}.\n\n¡Que disfrutes tu aventura!\n\nAtte. El equipo de Viatros.`,
                        attachments: [
                            {
                                filename: `Boleto_Viatros_${id_destino}.pdf`,
                                content: pdfData
                            }
                        ]
                    };

                    console.log("⏳ Intentando enviar correo a:", cliente.email);
                    let info = await transporter.sendMail(mailOptions);
                    console.log("✅ ¡Correo enviado con éxito!", info.response);
                    
                    // ¡AQUÍ ESTÁ LA MAGIA! Respondemos a la página HASTA que se envía el correo
                    res.json({ exito: true });

                } catch (errorCorreo) {
                    // SI FALLA, AHORA SÍ NOS VA A GRITAR EL ERROR EN LA CONSOLA
                    console.log("🔥 ERROR GIGANTE DE CORREO:", errorCorreo);
                    res.json({ exito: true, advertencia: "Reserva guardada, pero el correo falló." });
                }
            });

            doc.fontSize(25).fillColor('#EAB308').text('VIATROS, S. A.', { align: 'center' }); 
            doc.moveDown();
            doc.fontSize(16).fillColor('#000000').text('Pase de Abordar Oficial', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Pasajero: ${cliente.nombre}`);
            doc.text(`DPI: ${dpi}`);
            doc.text(`Teléfono: ${telefono}`);
            doc.moveDown();
            doc.text(`Destino: ${destino.nombre_lugar}`);
            doc.text(`Fecha del viaje: ${fecha_viaje}`);
            doc.text(`Cupos reservados: ${cupos}`);
            doc.text(`Paquete: ${tipo_paquete}`);
            doc.moveDown();
            doc.fontSize(14).text(`Total Pagado: Q${precio_total}`, { underline: true });
            doc.moveDown(2);
            doc.fontSize(10).fillColor('gray').text('Este boleto es generado automáticamente. Por favor, preséntalo el día de tu viaje.', { align: 'center' });
            
            doc.end(); 
            // ❌ IMPORTANTE: Asegurate de BORRAR el "res.json({ exito: true });" 
            // que estaba aquí abajo, porque ya lo movimos arriba.

        } catch (err) {
            await transaction.rollback(); 
            throw err;
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ exito: false });
    }
});


app.get('/api/mis-reservas/:idUsuario', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.idUsuario)
            .query(`
                SELECT r.fecha_viaje, r.cupos_reservados, r.tipo_paquete, r.precio_total, d.nombre_lugar 
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

// Con esto encendemos el motor en el puerto 3000.
app.listen(PORT, () => {
    console.log(`Viatros, S. A. funcionando en http://localhost:${PORT}`);
});