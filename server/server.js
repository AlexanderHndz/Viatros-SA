const express = require('express');
const path = require('path');
const cors = require('cors');
const { poolPromise, sql } = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json()); 
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/deptos', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM viatrosApp.dbo.Departamentos');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send("Error en la base de datos: " + err.message);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor encendido en http://localhost:${PORT}`);
});