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
            
            const doc = new PDFDocument({ margin: 50 });
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
                        subject: '🎫 ¡Tu reserva está confirmada! - Viatros, S.A.',
                        text: `Hola ${cliente.nombre},\n\nGracias por reservar con nosotros. Adjunto encontrarás tu pase de abordar para tu viaje a ${destino.nombre_lugar}.\n\n¡Que disfrutes tu aventura!\n\nAtte. El equipo de Viatros.`,
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

        } catch (err) {
            await transaction.rollback(); 
            throw err;
        }
    } catch (err) {
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

app.listen(PORT, () => {
    console.log(`Viatros, S. A. funcionando en http://localhost:${PORT}`);
});