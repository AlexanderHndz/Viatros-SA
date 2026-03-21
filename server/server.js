const express = require('express');
const path = require('path');
const cors = require('cors');
const { poolPromise, sql } = require('./db');

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
        const pool = await poolPromise;
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('email', sql.VarChar, email)
            .input('password', sql.VarChar, password)
            .query('INSERT INTO viatrosApp.dbo.Usuarios (nombre, email, password) VALUES (@nombre, @email, @password)');
        res.status(201).json({ exito: true });
    } catch (err) {
        res.status(500).json({ exito: false, mensaje: 'Ese correo ya existe, César.' });
    }
});

// Revisamos si el correo y la clave coinciden con lo que hay en SQL.
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .input('password', sql.VarChar, password)
            .query('SELECT id_usuario, nombre, email FROM viatrosApp.dbo.Usuarios WHERE email = @email AND password = @password');

        if (result.recordset.length > 0) {
            res.json({ exito: true, usuario: result.recordset[0] });
        } else {
            res.status(401).json({ exito: false, mensaje: 'Datos incorrectos.' });
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

            await transaction.commit(); 
            res.json({ exito: true });
        } catch (err) {
            await transaction.rollback(); 
            throw err;
        }
    } catch (err) {
        res.status(500).json({ exito: false });
    }
});

// Por último, esta jala el historial para que el cliente mire sus viajes en su perfil.
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