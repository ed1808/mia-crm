USE [test_monda];
GO

-- 1. Habilitar Change Tracking en tablas transaccionales del ERP
DECLARE @tables TABLE (name VARCHAR(100));
INSERT INTO @tables (name) VALUES
('terceros'),
('referencias_imp'),
('tall_encabeza_orden'),
('tall_citas'),
('documentos'),
('vh_documentos_ped'),
('vh_eventos_vehiculos'),
('crmv_plan_mantenimiento_enca'),
('vh_modelo'),
('vh_modelo_ano'),
('bodegas');

DECLARE @tbl VARCHAR(100);
DECLARE cur CURSOR FOR SELECT name FROM @tables;
OPEN cur;
FETCH NEXT FROM cur INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @sql NVARCHAR(MAX) = '
    IF NOT EXISTS (SELECT 1 FROM sys.change_tracking_tables WHERE object_id = OBJECT_ID(''' + @tbl + '''))
    BEGIN
        ALTER TABLE [dbo].[' + @tbl + '] ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
    END';
    EXEC sp_executesql @sql;
    FETCH NEXT FROM cur INTO @tbl;
END
CLOSE cur;
DEALLOCATE cur;
GO

-- 2. Stored Procedure para crear citas desde el CRM (Decisión D-19 / D-41)
CREATE OR ALTER PROCEDURE [dbo].[sp_crm_crear_cita]
    @bodega SMALLINT,
    @fecha_hora_ini DATETIME,
    @fecha_hora_fin DATETIME,
    @placa VARCHAR(20),
    @nit [dbo].[Tipo_NIT],
    @nombre_cliente VARCHAR(80),
    @telefonos VARCHAR(80),
    @notas VARCHAR(2000),
    @asesor VARCHAR(20) = 'CRM_AI',
    @id_cita INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @hora TINYINT = DATEPART(HOUR, @fecha_hora_ini);
    DECLARE @minutos TINYINT = DATEPART(MINUTE, @fecha_hora_ini);
    DECLARE @duracion INT = DATEDIFF(MINUTE, @fecha_hora_ini, @fecha_hora_fin);

    INSERT INTO [dbo].[tall_citas] (
        [bodega],
        [fecha_hora_creacion],
        [estado_cita],
        [fecha_hora_ini],
        [fecha_hora_fin],
        [hora],
        [minutos],
        [duracion_minutos],
        [placa],
        [nit],
        [nombre_cliente],
        [telefonos],
        [notas],
        [asesor],
        [origen_cita],
        [numeroEspacios],
        [Facturado],
        [numeroComfrimaciones]
    ) VALUES (
        @bodega,
        GETDATE(),
        'P', -- Programada
        @fecha_hora_ini,
        @fecha_hora_fin,
        @hora,
        @minutos,
        @duracion,
        @placa,
        @nit,
        @nombre_cliente,
        @telefonos,
        @notas,
        @asesor,
        99, -- Código de origen CRM
        1,
        'NA',
        0
    );

    SET @id_cita = SCOPE_IDENTITY();
END
GO
