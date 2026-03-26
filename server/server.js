require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { poolPromise, sql } = require('./db');

// Herramientas para el Boleto Mágico
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json()); 
app.use(express.static(path.join(__dirname, '../public')));

// --- RUTAS DEL CATÁLOGO ---
app.get('/api/deptos', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM viatrosApp.dbo.Departamentos');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send("Clavo en la base de datos: " + err.message);
    }
});

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

// --- NUEVA RUTA: BUSCADOR INTELIGENTE ---
app.get('/api/buscar-destinos', async (req, res) => {
    try {
        const termino = req.query.q || '';
        const pool = await poolPromise;
        
        // Buscamos si la palabra aparece en el nombre del lugar O en la descripción
        const result = await pool.request()
            .input('termino', sql.VarChar, `%${termino}%`)
            .query(`
                SELECT * FROM viatrosApp.dbo.Destinos 
                WHERE nombre_lugar LIKE @termino 
                   OR descripcion LIKE @termino
            `);
            
        res.json(result.recordset);
    } catch (err) {
        console.log(err);
        res.status(500).send("Error en la brújula de búsqueda.");
    }
});

// --- SEGURIDAD Y USUARIOS ---
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
                res.status(401).json({ exito: false, mensaje: 'Datos incorrectos.' });
            }
        } else {
            res.status(401).json({ exito: false, mensaje: 'Datos incorrectos.' });
        }
    } catch (err) {
        res.status(500).json({ exito: false });
    }
});

// --- RESEÑAS (Efecto TripAdvisor) ---
app.get('/api/resenas/:idDestino', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.idDestino)
            .query(`
                SELECT r.calificacion, r.comentario, r.fecha, u.nombre 
                FROM viatrosApp.dbo.Resenas r
                INNER JOIN viatrosApp.dbo.Usuarios u ON r.id_usuario = u.id_usuario
                WHERE r.id_destino = @id
                ORDER BY r.fecha DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send("Error al cargar reseñas.");
    }
});

app.post('/api/resenas', async (req, res) => {
    try {
        const { id_usuario, id_destino, calificacion, comentario } = req.body;
        const pool = await poolPromise;
        await pool.request()
            .input('id_u', sql.Int, id_usuario)
            .input('id_d', sql.Int, id_destino)
            .input('cal', sql.Int, calificacion)
            .input('com', sql.VarChar, comentario)
            .query('INSERT INTO viatrosApp.dbo.Resenas (id_usuario, id_destino, calificacion, comentario) VALUES (@id_u, @id_d, @cal, @com)');
        res.json({ exito: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ exito: false });
    }
});

// --- RESERVAS ---
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
            
            // --- FABRICAR EL PDF PROFESIONAL EN MEMORIA ---
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            let buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            
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
                        subject: '🎫 Tu Pase de Abordar Oficial - Viatros, S.A.',
                        text: `Hola ${cliente.nombre},\n\nTu viaje a ${destino.nombre_lugar} está confirmado. Adjunto encontrarás tu boleto con código QR.\n\nAtte. El equipo de Viatros.`,
                        attachments: [
                            {
                                filename: `Boleto_Viatros_${id_destino}.pdf`,
                                content: pdfData
                            }
                        ]
                    };

                    await transporter.sendMail(mailOptions);
                    res.json({ exito: true });

                } catch (errorCorreo) {
                    res.json({ exito: true, advertencia: "Reserva guardada, pero el correo falló." });
                }
            });

            // --- DISEÑO DEL PDF ---
            const datosQR = `VIATROS-RESERVA | Cliente: ${dpi} | Destino: ${id_destino} | Fecha: ${fecha_viaje}`;
            const qrImage = await QRCode.toDataURL(datosQR); 

            doc.fillColor('#003366').fontSize(28).font('Helvetica-Bold').text('VIATROS, S. A.', 50, 50);
            doc.fontSize(10).fillColor('#ff8c00').text('El viaje de tu vida', 50, 80);

            doc.fontSize(10).fillColor('#333333').font('Helvetica')
               .text('Pase de abordar No.:', 350, 50, { align: 'right' })
               .font('Helvetica-Bold').text(`VTR-${Math.floor(Math.random() * 10000)}`, 400, 65, { align: 'right' }) 
               .font('Helvetica').text('Fecha de emisión:', 350, 85, { align: 'right' })
               .text(new Date().toLocaleDateString('es-GT'), 400, 100, { align: 'right' });

            doc.moveDown(3);

            const startY = 150;
            
            // Columna Izquierda: Cliente
            doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold').text('Datos del Pasajero', 50, startY);
            doc.fontSize(10).fillColor('#333333').font('Helvetica')
               .text(`Nombre: ${cliente.nombre}`, 50, startY + 20)
               .text(`DPI: ${dpi}`, 50, startY + 35)
               .text(`Teléfono: ${telefono}`, 50, startY + 50);

            // Columna Derecha: Viaje
            doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold').text('Detalles del Viaje', 300, startY);
            doc.fontSize(10).fillColor('#333333').font('Helvetica')
               .text(`Destino: ${destino.nombre_lugar}`, 300, startY + 20)
               .text(`Fecha: ${fecha_viaje}`, 300, startY + 35)
               .text(`Paquete: ${tipo_paquete}`, 300, startY + 50);

            // Tabla de Detalles (Barra Azul)
            const tableY = 250;
            doc.rect(50, tableY, 495, 25).fill('#003366'); 
            
            doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
               .text('DESCRIPCIÓN', 60, tableY + 8)
               .text('CUPOS', 350, tableY + 8)
               .text('TOTAL', 450, tableY + 8);

            doc.fillColor('#333333').font('Helvetica')
               .text(`Aventura en ${destino.nombre_lugar} (${tipo_paquete})`, 60, tableY + 40)
               .text(`${cupos}`, 350, tableY + 40)
               .text(`Q ${precio_total}.00`, 450, tableY + 40);

            doc.moveTo(300, tableY + 70).lineTo(545, tableY + 70).lineWidth(1).stroke('#eeeeee');

            doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333').text('Total Pagado:', 320, tableY + 90);
            doc.fontSize(14).fillColor('#ff8c00').text(`Q ${precio_total}.00`, 450, tableY + 88);

            doc.image(qrImage, 50, tableY + 120, { fit: [100, 100] }); 
            
            doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold').text('Instrucciones de Abordaje', 160, tableY + 130);
            doc.fontSize(9).fillColor('#555555').font('Helvetica')
               .text('1. Presenta este código QR desde tu celular al momento de subir al transporte.', 160, tableY + 150)
               .text('2. Lleva tu DPI original en mano.', 160, tableY + 165)
               .text('3. Preséntate 15 minutos antes de la hora de salida.', 160, tableY + 180);

            doc.fontSize(8).fillColor('#aaaaaa').text('Este documento es un comprobante oficial generado electrónicamente por Viatros, S.A.', 50, 700, { align: 'center' });

            doc.end(); 

        } catch (err) {
            await transaction.rollback(); 
            throw err;
        }
    } catch (err) {
        res.status(500).json({ exito: false });
    }
});

// --- RUTA DE MIS RESERVAS ---
app.get('/api/mis-reservas/:idUsuario', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.idUsuario)
            .query(`
                SELECT r.id_reserva, r.fecha_viaje, r.cupos_reservados, r.tipo_paquete, r.precio_total, d.nombre_lugar 
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

// --- NUEVA RUTA: DESCARGAR BOLETO AL VUELO ---
app.get('/api/descargar-boleto/:idReserva', async (req, res) => {
    try {
        const pool = await poolPromise;
        
        const result = await pool.request()
            .input('id', sql.Int, req.params.idReserva)
            .query(`
                SELECT r.*, u.nombre, u.email, d.nombre_lugar 
                FROM viatrosApp.dbo.Reservas r
                INNER JOIN viatrosApp.dbo.Usuarios u ON r.id_usuario = u.id_usuario
                INNER JOIN viatrosApp.dbo.Destinos d ON r.id_destino = d.id_destino
                WHERE r.id_reserva = @id
            `);

        if (result.recordset.length === 0) return res.status(404).send("Reserva no encontrada");
        const reserva = result.recordset[0];

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Pase_Abordar_Viatros_${reserva.id_reserva}.pdf"`);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        doc.pipe(res); 

        const fechaFormateada = new Date(reserva.fecha_viaje).toLocaleDateString('es-GT');
        const datosQR = `VIATROS-RESERVA | Cliente: ${reserva.dpi_cliente} | Viaje: ${reserva.id_reserva} | Fecha: ${fechaFormateada}`;
        const qrImage = await QRCode.toDataURL(datosQR); 

        doc.fillColor('#003366').fontSize(28).font('Helvetica-Bold').text('VIATROS, S. A.', 50, 50);
        doc.fontSize(10).fillColor('#ff8c00').text('El viaje de tu vida', 50, 80);

        doc.fontSize(10).fillColor('#333333').font('Helvetica')
           .text('Pase de abordar No.:', 350, 50, { align: 'right' })
           .font('Helvetica-Bold').text(`VTR-00${reserva.id_reserva}`, 400, 65, { align: 'right' })
           .font('Helvetica').text('Fecha de viaje:', 350, 85, { align: 'right' })
           .text(fechaFormateada, 400, 100, { align: 'right' });
        doc.moveDown(3);

        const startY = 150;
        doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold').text('Datos del Pasajero', 50, startY);
        doc.fontSize(10).fillColor('#333333').font('Helvetica')
           .text(`Nombre: ${reserva.nombre}`, 50, startY + 20)
           .text(`DPI: ${reserva.dpi_cliente}`, 50, startY + 35)
           .text(`Teléfono: ${reserva.telefono_cliente}`, 50, startY + 50);

        doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold').text('Detalles del Viaje', 300, startY);
        doc.fontSize(10).fillColor('#333333').font('Helvetica')
           .text(`Destino: ${reserva.nombre_lugar}`, 300, startY + 20)
           .text(`Paquete: ${reserva.tipo_paquete}`, 300, startY + 35)
           .text(`Cupos: ${reserva.cupos_reservados} personas`, 300, startY + 50);

        const tableY = 250;
        doc.rect(50, tableY, 495, 25).fill('#003366'); 
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
           .text('DESCRIPCIÓN', 60, tableY + 8).text('ESTADO', 350, tableY + 8).text('TOTAL', 450, tableY + 8);

        doc.fillColor('#333333').font('Helvetica')
           .text(`Aventura en ${reserva.nombre_lugar}`, 60, tableY + 40)
           .text(`PAGADO`, 350, tableY + 40)
           .text(`Q ${reserva.precio_total}.00`, 450, tableY + 40);

        doc.moveTo(300, tableY + 70).lineTo(545, tableY + 70).lineWidth(1).stroke('#eeeeee');
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333').text('Total Pagado:', 320, tableY + 90);
        doc.fontSize(14).fillColor('#ff8c00').text(`Q ${reserva.precio_total}.00`, 450, tableY + 88);

        doc.image(qrImage, 50, tableY + 120, { fit: [100, 100] }); 
        
        doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold').text('Instrucciones de Abordaje', 160, tableY + 130);
        doc.fontSize(9).fillColor('#555555').font('Helvetica')
           .text('1. Presenta este código QR desde tu celular al momento de subir al transporte.', 160, tableY + 150)
           .text('2. Lleva tu DPI original en mano.', 160, tableY + 165)
           .text('3. Preséntate 15 minutos antes de la hora de salida.', 160, tableY + 180);

        doc.fontSize(8).fillColor('#aaaaaa').text('Documento oficial generado electrónicamente por Viatros, S.A.', 50, 700, { align: 'center' });

        doc.end();

    } catch (err) {
        console.log(err);
        res.status(500).send("Error al generar el boleto.");
    }
});

app.listen(PORT, () => {
    console.log(`Viatros, S. A. funcionando en http://localhost:${PORT}`);
});