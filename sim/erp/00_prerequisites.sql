-- Script para preparar la base de datos simulada y tipos de usuario
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'test_monda')
BEGIN
    CREATE DATABASE [test_monda];
END
GO

USE [test_monda];
GO

-- Habilitar Change Tracking a nivel de base de datos (Decisión D-41)
IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_databases WHERE database_id = DB_ID('test_monda'))
BEGIN
    ALTER DATABASE [test_monda]
    SET CHANGE_TRACKING = ON
    (CHANGE_RETENTION = 7 DAYS, AUTO_CLEANUP = ON);
END
GO

-- Crear tipos definidos por usuario requeridos por db.sql
IF NOT EXISTS (SELECT * FROM sys.types WHERE name = 'Tipo_NIT')
BEGIN
    CREATE TYPE [dbo].[Tipo_NIT] FROM [varchar](20) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.types WHERE name = 'Tipo_COSTO')
BEGIN
    CREATE TYPE [dbo].[Tipo_COSTO] FROM [money] NULL;
END
GO

-- Tablas maestras referenciadas mínimas para que las Foreign Keys no fallen
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'centros')
BEGIN
    CREATE TABLE [dbo].[centros] (
        [centro] [int] NOT NULL PRIMARY KEY,
        [descripcion] [varchar](50) NOT NULL
    );
    INSERT INTO [dbo].[centros] ([centro], [descripcion]) VALUES (1, 'Centro Principal');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SedesDeBodegas')
BEGIN
    CREATE TABLE [dbo].[SedesDeBodegas] (
        [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [nombre] [varchar](80) NOT NULL
    );
    INSERT INTO [dbo].[SedesDeBodegas] ([nombre]) VALUES ('Sede Norte');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'referencias')
BEGIN
    CREATE TABLE [dbo].[referencias] (
        [codigo] [varchar](20) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](100) NOT NULL,
        [tipo] [varchar](10) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tall_tempario')
BEGIN
    CREATE TABLE [dbo].[tall_tempario] (
        [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [codigo] [varchar](20) NOT NULL,
        [descripcion] [varchar](100) NOT NULL,
        [horas] [real] NOT NULL DEFAULT 1.0
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tipo_transacciones')
BEGIN
    CREATE TABLE [dbo].[tipo_transacciones] (
        [tipo] [varchar](4) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](50) NOT NULL
    );
    INSERT INTO [dbo].[tipo_transacciones] ([tipo], [descripcion]) VALUES ('FAC', 'Factura Taller'), ('VEH', 'Factura Vehículo');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tipo_transacciones_mod')
BEGIN
    CREATE TABLE [dbo].[tipo_transacciones_mod] (
        [tipo] [varchar](4) NOT NULL,
        [modelo] [varchar](5) NOT NULL,
        [descripcion] [varchar](50) NULL,
        CONSTRAINT [PK_tipo_transacciones_mod] PRIMARY KEY ([tipo], [modelo])
    );
    INSERT INTO [dbo].[tipo_transacciones_mod] ([tipo], [modelo], [descripcion]) VALUES ('FAC', 'MOD1', 'Factura Modelo 1');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vh_tipos_veh')
BEGIN
    CREATE TABLE [dbo].[vh_tipos_veh] (
        [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](50) NOT NULL
    );
    INSERT INTO [dbo].[vh_tipos_veh] ([descripcion]) VALUES ('Particular'), ('Comercial / Pesado');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vh_usados_tipos_garantia')
BEGIN
    CREATE TABLE [dbo].[vh_usados_tipos_garantia] (
        [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](50) NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'w_tall_citas_bahias')
BEGIN
    CREATE TABLE [dbo].[w_tall_citas_bahias] (
        [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](50) NOT NULL
    );
    INSERT INTO [dbo].[w_tall_citas_bahias] ([descripcion]) VALUES ('Bahía 1 Servicio Rápido'), ('Bahía 2 Pesados');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'w_tall_citas_Causas_Cancelacion')
BEGIN
    CREATE TABLE [dbo].[w_tall_citas_Causas_Cancelacion] (
        [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](100) NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'terceros_actividades_cree')
BEGIN
    CREATE TABLE [dbo].[terceros_actividades_cree] (
        [actividad] [varchar](4) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](100) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tarjetas')
BEGIN
    CREATE TABLE [dbo].[tarjetas] (
        [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](50) NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Terceros_actividad_economica')
BEGIN
    CREATE TABLE [dbo].[Terceros_actividad_economica] (
        [codigo] [varchar](4) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](100) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'terceros_ica')
BEGIN
    CREATE TABLE [dbo].[terceros_ica] (
        [codigo_ica] [int] NOT NULL PRIMARY KEY,
        [porcentaje] [real] NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'condiciones_pago')
BEGIN
    CREATE TABLE [dbo].[condiciones_pago] (
        [condicion] [varchar](4) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](50) NOT NULL
    );
    INSERT INTO [dbo].[condiciones_pago] ([condicion], [descripcion]) VALUES ('CONT', 'Contado'), ('CR30', 'Crédito 30 días');
END
GO

-- Conceptos de terceros 1..10
DECLARE @i INT = 1;
WHILE @i <= 10
BEGIN
    DECLARE @sql NVARCHAR(MAX) = '
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = ''terceros_' + CAST(@i AS NVARCHAR) + ''')
    BEGIN
        CREATE TABLE [dbo].[terceros_' + CAST(@i AS NVARCHAR) + '] (
            [concepto_' + CAST(@i AS NVARCHAR) + '] [varchar](5) NOT NULL PRIMARY KEY,
            [descripcion] [varchar](50) NULL
        );
    END';
    EXEC sp_executesql @sql;
    SET @i = @i + 1;
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vh_flotas')
BEGIN
    CREATE TABLE [dbo].[vh_flotas] (
        [flota] [varchar](5) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](60) NOT NULL
    );
    INSERT INTO [dbo].[vh_flotas] ([flota], [descripcion]) VALUES ('FLT01', 'Flota Logística Colombia');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vh_formas')
BEGIN
    CREATE TABLE [dbo].[vh_formas] (
        [forma] [tinyint] NOT NULL PRIMARY KEY,
        [descripcion] [varchar](40) NOT NULL
    );
    INSERT INTO [dbo].[vh_formas] ([forma], [descripcion]) VALUES (1, 'Efectivo/Transferencia'), (2, 'Crédito');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vh_eventos')
BEGIN
    CREATE TABLE [dbo].[vh_eventos] (
        [evento] [varchar](4) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](50) NOT NULL
    );
    INSERT INTO [dbo].[vh_eventos] ([evento], [descripcion]) VALUES ('INGR', 'Ingreso a Taller'), ('ENTR', 'Entrega a Cliente'), ('VTAC', 'Venta Confirmada');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vh_clase')
BEGIN
    CREATE TABLE [dbo].[vh_clase] (
        [clase] [varchar](3) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](40) NOT NULL
    );
    INSERT INTO [dbo].[vh_clase] ([clase], [descripcion]) VALUES ('AUT', 'Automóvil'), ('CAM', 'Camión'), ('VOL', 'Volqueta');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vh_grupo_modelo')
BEGIN
    CREATE TABLE [dbo].[vh_grupo_modelo] (
        [grupo] [varchar](5) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](40) NOT NULL
    );
    INSERT INTO [dbo].[vh_grupo_modelo] ([grupo], [descripcion]) VALUES ('*', 'General');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vh_marcas')
BEGIN
    CREATE TABLE [dbo].[vh_marcas] (
        [marca] [varchar](5) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](40) NOT NULL
    );
    INSERT INTO [dbo].[vh_marcas] ([marca], [descripcion]) VALUES ('REN', 'Renault'), ('CHEV', 'Chevrolet'), ('HINO', 'Hino');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vh_tipo_modelo')
BEGIN
    CREATE TABLE [dbo].[vh_tipo_modelo] (
        [tipo] [varchar](5) NOT NULL PRIMARY KEY,
        [descripcion] [varchar](40) NOT NULL
    );
    INSERT INTO [dbo].[vh_tipo_modelo] ([tipo], [descripcion]) VALUES ('LIV', 'Liviano'), ('PES', 'Pesado');
END
GO
