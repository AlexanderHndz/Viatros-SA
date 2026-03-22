CREATE DATABASE viatrosApp;
GO

USE [viatrosApp];
GO

CREATE TABLE Departamentos (
    id_depto INT PRIMARY KEY IDENTITY(1,1),
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE Destinos (
    id_destino INT PRIMARY KEY IDENTITY(1,1),
    id_depto INT FOREIGN KEY REFERENCES Departamentos(id_depto),
    nombre_lugar VARCHAR(150) NOT NULL,
    descripcion TEXT,
    transporte_eco VARCHAR(255),
    transporte_premium VARCHAR(255),
    hotel_eco VARCHAR(255),
    hotel_confort VARCHAR(255),
    presupuesto_estimado VARCHAR(100),
    cupos_totales INT,
    cupos_disponibles INT
);

CREATE TABLE Usuarios (
    id_usuario INT PRIMARY KEY IDENTITY(1,1),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE Reservas (
    id_reserva INT PRIMARY KEY IDENTITY(1,1),
    id_usuario INT FOREIGN KEY REFERENCES Usuarios(id_usuario),
    id_destino INT FOREIGN KEY REFERENCES Destinos(id_destino),
    fecha_reserva DATETIME DEFAULT GETDATE(),
    fecha_viaje DATE NOT NULL,
    cupos_reservados INT NOT NULL,
    tipo_paquete VARCHAR(50) NOT NULL,
    precio_total DECIMAL(10,2) NOT NULL,
    dpi_cliente VARCHAR(20) NOT NULL,
    telefono_cliente VARCHAR(15) NOT NULL
);