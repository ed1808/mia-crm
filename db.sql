USE [test_monda]
GO
/****** Object:  Table [dbo].[bodegas]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[bodegas](
	[bodega] [smallint] NOT NULL,
	[descripcion] [varchar](40) NOT NULL,
	[centro] [int] NOT NULL,
	[direccion] [varchar](80) NULL,
	[telefono] [varchar](40) NULL,
	[texto] [varchar](250) NULL,
	[codigo_cliente] [varchar](20) NULL,
	[es_punto_venta] [bit] NULL,
	[impresora] [varchar](80) NULL,
	[id] [int] IDENTITY(1,1) NOT NULL,
	[pais] [varchar](5) NULL,
	[alista] [bit] NULL,
	[ca] [smallint] NULL,
	[es_bod_taller] [bit] NULL,
	[id_clasificacion] [int] NULL,
	[Acepta_Ext] [bit] NULL,
	[Utilidad] [int] NULL,
	[idSMD] [varchar](20) NULL,
	[es_bodega_obsoleta] [bit] NOT NULL,
	[es_almacen] [bit] NOT NULL,
	[demostracion] [bit] NULL,
	[codigoPostal] [nvarchar](9) NULL,
	[es_bod_vehiculos] [bit] NULL,
	[cuentaGarantiaRenault] [nvarchar](9) NULL,
	[EsServicioRapido] [bit] NULL,
	[CodigoBIR_Renault] [nvarchar](9) NULL,
	[inactiva] [char](1) NULL,
	[principal] [varchar](1) NULL,
	[departamento] [varchar](5) NULL,
	[ciudad] [varchar](5) NULL,
	[autoretenedorica] [bit] NULL,
	[renault] [tinyint] NULL,
	[idSede] [int] NULL,
	[envia_distrinet] [char](1) NULL,
	[cod_concesionario] [int] NULL,
	[es_concesion] [char](1) NULL,
	[cod_sala] [int] NULL,
	[unidad_negocio] [varchar](30) NULL,
 CONSTRAINT [PK___1__10] PRIMARY KEY CLUSTERED 
(
	[bodega] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [IX_bodegas_id] UNIQUE NONCLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[bodegas_clasificacion]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[bodegas_clasificacion](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[descripcion] [varchar](100) NOT NULL,
 CONSTRAINT [PK_bodegas_clasificacion] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[bodegas_consecutivo]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[bodegas_consecutivo](
	[bodega] [smallint] NOT NULL,
	[inferior] [int] NOT NULL,
	[superior] [int] NOT NULL,
	[consecutivo] [int] NOT NULL,
 CONSTRAINT [PK_bodegas_consecutivo] PRIMARY KEY CLUSTERED 
(
	[bodega] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[bodegas_ubicacion]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[bodegas_ubicacion](
	[ubicacion] [varchar](5) NOT NULL,
	[descripcion] [varchar](50) NULL,
	[bodega] [smallint] NOT NULL,
	[Es_taller] [varchar](1) NULL,
	[inactiva] [bit] NULL,
 CONSTRAINT [PK_ubicacion] PRIMARY KEY NONCLUSTERED 
(
	[bodega] ASC,
	[ubicacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[crmv_plan_mantenimiento]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[crmv_plan_mantenimiento](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[id_plan_mantenimiento_enca] [int] NOT NULL,
	[tipo] [char](1) NOT NULL,
	[codigo_operacion] [varchar](20) NULL,
	[codigo_item] [varchar](20) NULL,
	[cantidad] [real] NOT NULL,
	[cobrar] [varchar](1) NULL,
	[id_tall_tempario] [int] NULL,
 CONSTRAINT [PK_crmv_plan_mantenimiento] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[crmv_plan_mantenimiento_enca]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[crmv_plan_mantenimiento_enca](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[id_vh_modelo_ano] [int] NULL,
	[kilometraje] [int] NOT NULL,
	[horas_duracion] [real] NULL,
	[notas] [varchar](250) NULL,
	[clase] [varchar](10) NULL,
	[Estado] [char](1) NULL,
	[es_generico] [char](1) NOT NULL,
	[tipoBahia] [int] NULL,
 CONSTRAINT [PK_crmv_plan_mantenimiento_enca] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[documentos]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[documentos](
	[sw] [tinyint] NOT NULL,
	[tipo] [varchar](4) NOT NULL,
	[numero] [int] NOT NULL,
	[nit] [dbo].[Tipo_NIT] NOT NULL,
	[fecha] [datetime] NOT NULL,
	[condicion] [varchar](4) NULL,
	[vencimiento] [datetime] NULL,
	[valor_total] [money] NULL,
	[iva] [money] NULL,
	[retencion] [money] NULL,
	[retencion_causada] [money] NULL,
	[retencion_iva] [money] NULL,
	[retencion_ica] [money] NULL,
	[descuento_pie] [money] NULL,
	[fletes] [money] NULL,
	[iva_fletes] [money] NULL,
	[costo] [money] NULL,
	[vendedor] [dbo].[Tipo_NIT] NULL,
	[valor_aplicado] [money] NULL,
	[anulado] [bit] NOT NULL,
	[modelo] [varchar](5) NULL,
	[documento] [varchar](30) NULL,
	[notas] [varchar](600) NULL,
	[usuario] [varchar](10) NOT NULL,
	[pc] [varchar](20) NOT NULL,
	[fecha_hora] [datetime] NOT NULL,
	[retencion2] [money] NULL,
	[retencion3] [money] NULL,
	[bodega] [smallint] NOT NULL,
	[impoconsumo] [money] NULL,
	[descuento2] [money] NULL,
	[duracion] [smallint] NULL,
	[concepto] [smallint] NULL,
	[vencimiento_presup] [datetime] NULL,
	[exportado] [char](1) NULL,
	[impuesto_deporte] [money] NULL,
	[prefijo] [varchar](5) NULL,
	[moneda] [varchar](2) NULL,
	[tasa] [real] NULL,
	[centro_doc] [int] NULL,
	[valor_mercancia] [money] NULL,
	[numero_cuotas] [smallint] NULL,
	[codigo_direccion] [smallint] NULL,
	[descuento_1] [real] NULL,
	[descuento_2] [real] NULL,
	[descuento_3] [real] NULL,
	[abono] [money] NULL,
	[clase_tra] [char](1) NULL,
	[fecha_emision] [datetime] NULL,
	[fecha_consignacion] [smalldatetime] NULL,
	[id] [int] IDENTITY(1,1) NOT NULL,
	[bodega_ot] [smallint] NULL,
	[numero_ot] [int] NULL,
	[id_vh_tabla_amortizacion] [int] NULL,
	[porc_RteFuente] [decimal](10, 2) NULL,
	[porc_RteIva] [decimal](10, 2) NULL,
	[porc_RteIvaSimpl] [decimal](10, 2) NULL,
	[porc_RteIca] [decimal](10, 2) NULL,
	[porc_RteA] [decimal](10, 2) NULL,
	[porc_RteB] [decimal](10, 2) NULL,
	[ajuste] [money] NULL,
	[concepto_Retencion] [smallint] NULL,
	[porc_RteCree] [decimal](10, 2) NULL,
	[retencion_cree] [money] NULL,
	[codigo_retencion_cree] [varchar](4) NULL,
	[cree_causado] [money] NULL,
	[nota1] [varchar](255) NULL,
	[nota2] [varchar](255) NULL,
	[porcentaje_ica_new] [decimal](8, 4) NULL,
	[chasis] [varchar](50) NULL,
	[act_mdx] [tinyint] NULL,
	[provision] [money] NULL,
	[orden_compra] [varchar](250) NULL,
	[Iva_Costo] [char](1) NULL,
	[ObligacionFinanciera] [varchar](20) NULL,
	[Base_dcto_RC] [money] NULL,
	[id_ica_new] [int] NULL,
	[numincapacidad] [varchar](20) NULL,
	[idincapacidad] [int] NULL,
	[porce_impoconsumo] [numeric](5, 2) NULL,
	[es_electronico] [char](1) NULL,
	[enviado_electronico] [char](1) NULL,
	[error_electronico] [varchar](500) NULL,
	[programa] [varchar](4) NULL,
	[email_electronico] [varchar](80) NULL,
	[crm_contacto] [int] NULL,
	[concepto_electronico] [varchar](10) NULL,
	[Ref_electronico] [varchar](100) NULL,
	[act_mdx2] [tinyint] NULL,
	[Base_Usado] [decimal](18, 5) NULL,
	[Fac_Usado] [tinyint] NULL,
	[dato1] [varchar](10) NULL,
	[kilometraje] [int] NULL,
	[tipo_mto] [varchar](4) NULL,
	[numero_mto] [int] NULL,
	[con_referencia_fe] [bit] NULL,
	[codigo_lote] [int] NULL,
	[costo_avicola] [bit] NULL,
 CONSTRAINT [PK_documentos_1__10] PRIMARY KEY CLUSTERED 
(
	[tipo] ASC,
	[numero] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 70, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [IX_documentos_id] UNIQUE NONCLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 70, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[referencias_imp]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[referencias_imp](
	[codigo] [varchar](20) NOT NULL,
	[pos_arancel] [varchar](20) NULL,
	[costo_unitario_FOB] [money] NULL,
	[gravamen] [real] NULL,
	[explicacion] [varchar](800) NULL,
	[serie] [varchar](50) NULL,
	[chasis] [varchar](50) NULL,
	[motor] [varchar](50) NULL,
	[modelo_ano] [smallint] NULL,
	[tipo_motor] [varchar](50) NULL,
	[manifiesto] [varchar](50) NULL,
	[nit_prenda] [dbo].[Tipo_NIT] NULL,
	[nit_adicional_1] [dbo].[Tipo_NIT] NULL,
	[nit_adicional_2] [dbo].[Tipo_NIT] NULL,
	[nit_adicional_3] [dbo].[Tipo_NIT] NULL,
	[horas_uso] [int] NULL,
	[kilometraje] [int] NULL,
	[placa] [varchar](10) NULL,
	[fecha_fin_garantia] [datetime] NULL,
	[nit_comprador] [dbo].[Tipo_NIT] NULL,
	[comprado] [tinyint] NULL,
	[id_modano] [varchar](25) NULL,
	[color] [varchar](3) NULL,
	[fecha_manifiesto] [smalldatetime] NULL,
	[garantia] [varchar](20) NULL,
	[tipo_venta] [tinyint] NULL,
	[plan_venta] [tinyint] NULL,
	[usado_comprado] [tinyint] NULL,
	[usado_retomado] [tinyint] NULL,
	[usado_consignado] [tinyint] NULL,
	[recibido_canje] [tinyint] NULL,
	[entregado_canje] [tinyint] NULL,
	[vendido] [tinyint] NULL,
	[asignacion] [int] NULL,
	[entregado_cliente] [bit] NULL,
	[entregado_matricula] [bit] NULL,
	[reservado] [dbo].[Tipo_NIT] NULL,
	[fecha_reserva] [smalldatetime] NULL,
	[fin_reserva] [smalldatetime] NULL,
	[costo_alistamiento] [money] NULL,
	[costo_compra] [money] NULL,
	[fecha_venta] [smalldatetime] NULL,
	[codigo_concesionario] [varchar](10) NULL,
	[modelo_taller] [varchar](10) NULL,
	[carpeta] [varchar](30) NULL,
	[ciudad_placa] [varchar](30) NULL,
	[OtroServicio] [varchar](15) NULL,
	[fecha_cambio_km] [datetime] NULL,
	[fecha_cambio_horas_uso] [datetime] NULL,
	[fecha_entrega] [datetime] NULL,
	[Color_Interno] [nvarchar](3) NULL,
	[Codigo_Radio] [nvarchar](20) NULL,
	[Tiempo_Garantia] [smallint] NULL,
	[Km_Garantia] [int] NULL,
	[NumSOAT] [varchar](30) NULL,
	[Razon_Cambio_Prop] [int] NULL,
	[Levante] [varchar](16) NULL,
	[Año_Fab] [int] NULL,
	[Oferta] [money] NULL,
	[fecha_expedicion_manifiesto] [smalldatetime] NULL,
	[semana_entrega] [smallint] NULL,
	[apoyo] [bit] NULL,
	[notas] [varchar](80) NULL,
	[fecha_entrega_fabrica] [smalldatetime] NULL,
	[pedido_fabrica] [varchar](20) NULL,
	[cabina] [varchar](20) NULL,
	[consecutivo_compra] [int] NULL,
	[nit_aseguradora] [dbo].[Tipo_NIT] NULL,
	[fec_vencimiento_seg] [datetime] NULL,
	[fecha_obligatorio] [smalldatetime] NULL,
	[fecha_gases] [smalldatetime] NULL,
	[fecha_tecnico_mecanica] [smalldatetime] NULL,
	[nit_usuario] [dbo].[Tipo_NIT] NULL,
	[fin_asignacion] [datetime] NULL,
	[sinLimiteDekmEnGtia] [nvarchar](1) NULL,
	[puertas] [tinyint] NULL,
	[ciudad_manifiesto] [varchar](20) NULL,
	[Revista] [money] NULL,
	[tipoPintura] [nvarchar](1) NULL,
	[act_mdx] [tinyint] NULL,
	[requiere_registro] [char](1) NULL,
	[registro_importacion] [varchar](20) NULL,
	[vencimiento_registro] [datetime] NULL,
	[cantidad_registro] [decimal](18, 2) NULL,
	[costo_registro] [money] NULL,
	[id_estado] [int] NULL,
	[moneda] [varchar](3) NULL,
	[fecha_aprobado] [datetime] NULL,
	[pos_arancel_internacional] [varchar](20) NULL,
	[tipo_caja] [char](1) NULL,
	[linea_chevystar] [varchar](20) NULL,
	[homologacion] [varchar](16) NULL,
	[blindado] [varchar](1) NULL,
	[Convertido_gas] [varchar](1) NULL,
	[Refrendo] [varchar](30) NULL,
	[fecha_matricula] [datetime] NULL,
	[es_flota] [varchar](2) NULL,
	[Nit_prenda_compra] [dbo].[Tipo_NIT] NULL,
	[Fecha_Fabricacion] [datetime] NULL,
	[documento_relacionado] [varchar](16) NULL,
	[motivo_pedido] [varchar](3) NULL,
	[bitvta] [char](1) NULL,
	[numero_inserto] [varchar](20) NULL,
	[scope] [bit] NULL,
	[flotilla_sofasa] [bit] NULL,
	[fabricacion_sofasa] [varchar](30) NULL,
	[estado_sofasa] [varchar](1) NULL,
	[concesionario_comprador] [int] NULL,
	[proveedor_2] [dbo].[Tipo_NIT] NULL,
	[id_vh_usado_tipo_garantia] [int] NULL,
 CONSTRAINT [PK_referencias_imp] PRIMARY KEY NONCLUSTERED 
(
	[codigo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tall_citas]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tall_citas](
	[id_cita] [int] IDENTITY(1,1) NOT NULL,
	[bodega] [smallint] NOT NULL,
	[fecha_hora_creacion] [datetime] NOT NULL,
	[estado_cita] [char](1) NOT NULL,
	[descripcion_estado]  AS (case when [estado_cita]='P' then 'Programada' when [estado_cita]='C' then 'Cancelada' when [estado_cita]='R' then 'Reprogramada' when [estado_cita]='A' then 'Atendida' else 'Otro' end),
	[fecha_hora_ini] [datetime] NOT NULL,
	[fecha_hora_fin] [datetime] NOT NULL,
	[hora] [tinyint] NOT NULL,
	[minutos] [tinyint] NOT NULL,
	[duracion_minutos] [int] NULL,
	[codigo_veh] [varchar](20) NULL,
	[placa] [varchar](20) NOT NULL,
	[nit] [dbo].[Tipo_NIT] NULL,
	[nombre_cliente] [varchar](80) NULL,
	[nit_nuevo] [dbo].[Tipo_NIT] NULL,
	[nombre_encargado] [varchar](80) NULL,
	[telefonos] [varchar](80) NULL,
	[notas] [varchar](2000) NULL,
	[modelo_veh] [varchar](20) NULL,
	[ano_veh] [int] NULL,
	[fecha_hora_asistio] [datetime] NULL,
	[numero_orden_taller] [int] NULL,
	[usuario] [varchar](10) NULL,
	[pc] [varchar](20) NULL,
	[modulo] [varchar](4) NULL,
	[mail] [varchar](100) NULL,
	[asesor] [varchar](20) NULL,
	[pago] [varchar](30) NULL,
	[movilidad] [bit] NULL,
	[notas_movilidad] [varchar](128) NULL,
	[recogida] [bit] NULL,
	[notas_recogida] [varchar](128) NULL,
	[id_tall_camp] [int] NULL,
	[id_asesor] [int] NULL,
	[ubicacion] [varchar](5) NULL,
	[fecha_hora_llamada] [datetime] NULL,
	[asiste] [bit] NULL,
	[notas_llamada] [varchar](256) NULL,
	[medio] [smallint] NULL,
	[w_act] [varchar](1) NULL,
	[email_contacto] [varchar](50) NULL,
	[alistamiento] [varchar](1) NULL,
	[rotado] [varchar](1) NULL,
	[certificado] [varchar](2000) NULL,
	[idOrdenTaller] [int] NULL,
	[motivo_cita] [varchar](5) NULL,
	[estado_confirmacion] [varchar](5) NULL,
	[razon] [nvarchar](4) NULL,
	[bahia] [int] NULL,
	[id_tecnico_Tecnico] [int] NULL,
	[fecha_hora_ini_Original] [datetime] NULL,
	[fecha_hora_fin_Original] [datetime] NULL,
	[duracion_minutos_Original] [int] NULL,
	[hora_Original] [tinyint] NULL,
	[minutos_Original] [tinyint] NULL,
	[fecha_hora_ini_Original_Agendado] [datetime] NULL,
	[fecha_hora_fin_Original_Agendado] [datetime] NULL,
	[duracion_minutos_Original_Agendado] [int] NULL,
	[hora_Original_Agendado] [tinyint] NULL,
	[minutos_Original_Agendado] [tinyint] NULL,
	[puntoPartido_Agendado] [varchar](5000) NULL,
	[MinPartido_Agendado] [varchar](5000) NULL,
	[FueraTiempo] [varchar](15) NULL,
	[EstadoReal] [varchar](15) NULL,
	[ListaChequeo] [varchar](400) NULL,
	[numeroEspacios] [int] NOT NULL,
	[Facturado] [varchar](4) NOT NULL,
	[numeroComfrimaciones] [int] NOT NULL,
	[motivo_Cancelacion] [int] NULL,
	[tipo_llamada] [char](1) NULL,
	[origen_cita] [int] NULL,
	[retorno] [int] NULL,
	[nota_retorno] [varchar](250) NULL,
	[Tipo_Cita] [varchar](20) NULL,
	[notas2] [varchar](500) NULL,
	[act_mdx] [int] NULL,
	[jefe_unidad] [varchar](5) NULL,
 CONSTRAINT [PK_tall_citas] PRIMARY KEY CLUSTERED 
(
	[id_cita] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tall_encabeza_orden]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tall_encabeza_orden](
	[numero] [int] NOT NULL,
	[nit] [dbo].[Tipo_NIT] NULL,
	[serie] [varchar](20) NULL,
	[fecha] [datetime] NULL,
	[entrada] [datetime] NULL,
	[vendedor] [dbo].[Tipo_NIT] NULL,
	[promesa_entrega] [datetime] NULL,
	[estado] [char](10) NULL,
	[aseguradora] [dbo].[Tipo_NIT] NULL,
	[poliza] [varchar](50) NULL,
	[siniestro] [varchar](50) NULL,
	[deducible] [decimal](16, 13) NULL,
	[minimo] [money] NULL,
	[entrega] [datetime] NULL,
	[notas] [varchar](8000) NULL,
	[tipo] [varchar](50) NULL,
	[kilometraje] [int] NULL,
	[horas_uso] [int] NULL,
	[bodega] [smallint] NOT NULL,
	[entrego] [varchar](50) NULL,
	[facturada] [bit] NOT NULL,
	[rombo] [varchar](20) NULL,
	[facturo_deducible] [bit] NOT NULL,
	[ocupada_por] [varchar](20) NULL,
	[horas] [smallint] NULL,
	[anulada] [bit] NOT NULL,
	[pc] [varchar](20) NULL,
	[usuario] [varchar](10) NULL,
	[ultima_modificacion] [datetime] NULL,
	[condicion_pago] [varchar](4) NULL,
	[rombo_usado] [varchar](20) NULL,
	[ubicacion] [varchar](5) NULL,
	[tipo_deducible] [varchar](4) NULL,
	[numero_deducible] [int] NULL,
	[tipo_orden] [char](1) NULL,
	[bloqueada] [char](1) NULL,
	[spid] [smallint] NULL,
	[login_time] [datetime] NULL,
	[numero_orden_anulada] [int] NULL,
	[razon] [smallint] NULL,
	[razon2] [smallint] NULL,
	[fecha_hora_entrega_real] [datetime] NULL,
	[usuario_entrega_real] [varchar](10) NULL,
	[pc_entrega_real] [varchar](20) NULL,
	[numero_entrega] [int] NULL,
	[cotizacion] [int] NULL,
	[id] [int] IDENTITY(1,1) NOT NULL,
	[km_anterior] [int] NULL,
	[horas_uso_anterior] [int] NULL,
	[notas2] [varchar](8000) NULL,
	[usuario_autoriza] [varchar](10) NULL,
	[fecha_hora_autoriza] [datetime] NULL,
	[asesor_aseguradora] [dbo].[Tipo_NIT] NULL,
	[Recepcion_Interactiva] [smallint] NULL,
	[procesadaPlano] [char](1) NULL,
	[es_ppc] [char](1) NULL,
	[porce_apoyo_1] [real] NULL,
	[porce_apoyo_2] [real] NULL,
	[porce_apoyo_3] [real] NULL,
	[fecha_cierre_final] [datetime] NULL,
	[cita] [char](1) NULL,
	[comentario] [varchar](80) NULL,
	[Ref_electronico] [varchar](100) NULL,
	[Area_seg] [varchar](10) NULL,
	[Nombre_seg] [varchar](80) NULL,
	[Codigo_Seg] [varchar](10) NULL,
	[Espera_Veh] [varchar](4) NULL,
	[nivel] [tinyint] NULL,
	[fec_reprogra_vh] [datetime] NULL,
	[fecha_imp_prefactura] [datetime] NULL,
	[usu_imp_prefactura] [varchar](20) NULL,
	[act_mdx] [int] NULL,
	[inmovilizado] [char](1) NULL,
	[OrderReference] [varchar](30) NULL,
	[BillingReference] [varchar](30) NULL,
	[cerrada_completa] [bit] NULL,
	[dev_4117] [bit] NULL,
	[vh_en_taller] [char](1) NULL,
 CONSTRAINT [PK_tall_encabeza_orden] PRIMARY KEY CLUSTERED 
(
	[numero] ASC,
	[bodega] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 75, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [IX_tall_encabeza_orden_id] UNIQUE NONCLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 75, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[terceros]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[terceros](
	[nit] [dbo].[Tipo_NIT] NOT NULL,
	[digito] [tinyint] NULL,
	[nombres] [varchar](120) NULL,
	[direccion] [varchar](120) NULL,
	[ciudad] [varchar](25) NULL,
	[telefono_1] [varchar](25) NULL,
	[telefono_2] [varchar](25) NULL,
	[fax] [varchar](15) NULL,
	[apartado_aereo] [varchar](10) NULL,
	[tipo_identificacion] [char](3) NULL,
	[pais] [varchar](20) NULL,
	[gran_contribuyente] [bit] NOT NULL,
	[autoretenedor] [bit] NOT NULL,
	[bloqueo] [tinyint] NULL,
	[notas] [varchar](250) NULL,
	[lista] [tinyint] NULL,
	[concepto_1] [varchar](5) NULL,
	[concepto_2] [varchar](5) NULL,
	[concepto_3] [varchar](5) NULL,
	[concepto_4] [varchar](5) NULL,
	[concepto_5] [varchar](5) NULL,
	[concepto_6] [varchar](5) NULL,
	[concepto_7] [varchar](5) NULL,
	[concepto_8] [varchar](5) NULL,
	[concepto_9] [varchar](5) NULL,
	[concepto_10] [varchar](5) NULL,
	[mail] [varchar](100) NULL,
	[pos_num] [tinyint] NOT NULL,
	[regimen] [char](1) NULL,
	[cupo_credito] [money] NULL,
	[nit_real] [dbo].[Tipo_NIT] NOT NULL,
	[condicion] [varchar](4) NULL,
	[vendedor] [dbo].[Tipo_NIT] NULL,
	[fletes] [real] NULL,
	[es_excento_iva] [varchar](1) NULL,
	[contacto_1] [varchar](50) NULL,
	[contacto_2] [varchar](50) NULL,
	[formato_factura] [varchar](10) NULL,
	[fecha_creacion] [datetime] NULL,
	[formato_copias] [tinyint] NULL,
	[tipo_factura] [varchar](4) NULL,
	[dias_gracia] [smallint] NULL,
	[solo_contado] [varchar](1) NULL,
	[descuento_fijo] [real] NULL,
	[excluir_tabla_desc] [char](1) NULL,
	[centro_fijo] [int] NULL,
	[exportado] [char](1) NULL,
	[factor_o_lista] [char](1) NULL,
	[codigo_ica] [int] NULL,
	[descuento_fijo2] [real] NULL,
	[y_dpto] [varchar](5) NULL,
	[y_ciudad] [varchar](5) NULL,
	[celular] [varchar](15) NULL,
	[clasificado] [char](10) NULL,
	[descuento_fijo_prov] [real] NULL,
	[solo_contado_compra] [varchar](1) NULL,
	[fecha_modificacion] [datetime] NULL,
	[concepto_11] [varchar](5) NULL,
	[concepto_12] [varchar](5) NULL,
	[concepto_13] [varchar](5) NULL,
	[concepto_14] [varchar](5) NULL,
	[concepto_15] [varchar](5) NULL,
	[concepto_16] [varchar](5) NULL,
	[concepto_17] [varchar](5) NULL,
	[concepto_18] [varchar](5) NULL,
	[concepto_19] [varchar](5) NULL,
	[concepto_20] [varchar](5) NULL,
	[fecha_cambio_razon] [smalldatetime] NULL,
	[razon_comercial] [varchar](60) NULL,
	[fecha_cumple_ter] [datetime] NULL,
	[id] [int] IDENTITY(1,1) NOT NULL,
	[condicion1] [varchar](4) NULL,
	[ean] [varchar](20) NULL,
	[autoretenedorica] [bit] NULL,
	[estampilla] [real] NULL,
	[timbre] [real] NULL,
	[impdeporte] [real] NULL,
	[impica] [real] NULL,
	[impconsumo] [real] NULL,
	[codigo_alterno] [varchar](20) NULL,
	[tipo_devolucion] [varchar](4) NULL,
	[Usuario] [varchar](20) NULL,
	[y_pais] [varchar](5) NULL,
	[ext_1] [varchar](5) NULL,
	[Motivo_Estado] [nvarchar](200) NULL,
	[banco_personas] [bit] NULL,
	[cupo_credito_vh] [money] NULL,
	[otro_descuento] [real] NULL,
	[tipo_direccion] [smallint] NULL,
	[departamento] [varchar](7) NULL,
	[ciudad2] [varchar](7) NULL,
	[actividad_cree] [varchar](4) NULL,
	[estado_civil] [nvarchar](1) NULL,
	[estrato] [char](1) NULL,
	[paginaweb] [varchar](80) NULL,
	[area_labora] [varchar](50) NULL,
	[cargo] [varchar](50) NULL,
	[ext2] [varchar](20) NULL,
	[celular2] [varchar](20) NULL,
	[email2] [varchar](50) NULL,
	[no_regulados] [char](1) NULL,
	[descuento_financiero] [real] NULL,
	[sincronizado] [char](1) NOT NULL,
	[id_definicion_tributaria_tipo] [int] NULL,
	[es_excento_cree_ventas] [char](1) NULL,
	[codigoPostal] [nvarchar](9) NULL,
	[mail_adicional] [varchar](250) NULL,
	[sexo] [char](1) NULL,
	[act_mdx] [tinyint] NULL,
	[Runt] [varchar](40) NULL,
	[Fecha_Runt] [smalldatetime] NULL,
	[tieneRUT] [nvarchar](1) NULL,
	[codigoActividadEconomica] [varchar](4) NULL,
	[ftoCopia_factura] [varchar](10) NULL,
	[formatoRemision] [varchar](20) NULL,
	[copiaRemision] [char](1) NULL,
	[es_extranet] [char](1) NULL,
	[GLN_Cabasnet] [varchar](30) NULL,
	[email3] [varchar](50) NULL,
	[email4] [varchar](50) NULL,
	[es_electronico] [char](1) NULL,
	[CodigoPostalDir] [varchar](10) NULL,
	[Proceso] [datetime] NULL,
	[fecha_inicio_FE] [datetime] NULL,
	[descuento_des_iva] [money] NULL,
	[soporte_DIAN] [char](1) NULL,
	[dias_recibo_caja] [smallint] NULL,
	[tributo] [char](4) NULL,
	[es_proveedor] [bit] NULL,
	[y_barrios] [int] NULL,
	[id_Tarjeta] [int] NULL,
	[numero_Tarjeta] [varchar](20) NULL,
	[licencia] [varchar](20) NULL,
 CONSTRAINT [PK_terceros_1__10] PRIMARY KEY CLUSTERED 
(
	[nit] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 75, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [IX_terceros_id] UNIQUE NONCLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 75, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[vh_documentos_ped]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[vh_documentos_ped](
	[sw] [tinyint] NOT NULL,
	[bodega] [smallint] NOT NULL,
	[numero] [int] NOT NULL,
	[nit] [dbo].[Tipo_NIT] NULL,
	[nit2] [dbo].[Tipo_NIT] NULL,
	[nit3] [dbo].[Tipo_NIT] NULL,
	[pasa_2] [bit] NULL,
	[pasa_3] [bit] NULL,
	[vendedor] [decimal](18, 0) NULL,
	[modelo] [varchar](20) NULL,
	[ano] [int] NULL,
	[plan_venta] [tinyint] NULL,
	[codigo] [varchar](20) NULL,
	[fecha] [datetime] NULL,
	[condicion] [varchar](4) NULL,
	[dias_validez] [smallint] NULL,
	[valor_unitario] [money] NULL,
	[porcentaje_iva] [real] NULL,
	[porcentaje_descuento] [real] NULL,
	[valor_descuento] [money] NULL,
	[cantidad] [tinyint] NULL,
	[cantidad_despachada] [tinyint] NULL,
	[valor_total] [money] NULL,
	[anulado] [bit] NOT NULL,
	[usuario] [varchar](10) NULL,
	[pc] [varchar](20) NULL,
	[duracion] [smallint] NULL,
	[moneda] [varchar](2) NULL,
	[fecha_hora_entrega] [datetime] NULL,
	[aseguradora] [dbo].[Tipo_NIT] NULL,
	[notas1] [varchar](1000) NULL,
	[notas2] [varchar](600) NULL,
	[es_canje] [varchar](1) NULL,
	[es_megaplan] [varchar](1) NULL,
	[es_reposicion] [varchar](1) NULL,
	[tipo_pedido] [varchar](1) NULL,
	[itemsOk] [bit] NOT NULL,
	[pagoOk] [bit] NOT NULL,
	[flota] [varchar](5) NULL,
	[facturar] [bit] NULL,
	[factura] [int] NULL,
	[pasa_1] [bit] NULL,
	[transito] [dbo].[Tipo_NIT] NULL,
	[nit_prenda] [dbo].[Tipo_NIT] NULL,
	[esLeasing] [bit] NULL,
	[motivo_anulacion] [varchar](5) NULL,
	[placa_terminada_en2] [char](1) NULL,
	[spid] [smallint] NULL,
	[login_time] [datetime] NULL,
	[asignado_por] [varchar](15) NULL,
	[fecha_ult_cambio] [datetime] NULL,
	[usr_ult_cambio] [varchar](15) NULL,
	[pc_ult_cambio] [varchar](15) NULL,
	[direccion] [smallint] NULL,
	[venta_gerencia] [bit] NULL,
	[Color_Deseado] [varchar](3) NULL,
	[placa_terminada_en] [char](1) NULL,
	[dirnit2] [tinyint] NULL,
	[dirnit3] [tinyint] NULL,
	[tipo_factura] [varchar](4) NULL,
	[clasificacion] [varchar](20) NULL,
	[numero_cotizacion] [int] NULL,
	[Comision_Ext] [bit] NULL,
	[vr_comision_ext] [money] NULL,
	[Atendida] [bit] NULL,
	[usuario_ocupa] [varchar](10) NULL,
	[NumeroHN] [int] NULL,
	[fecha_anulacion] [datetime] NULL,
	[pedido_especial] [bit] NULL,
	[fecha_cotizacion] [datetime] NULL,
	[porcentaje_impoconsumo] [real] NULL,
	[valorPoliza] [decimal](18, 2) NULL,
	[nit_usuario] [dbo].[Tipo_NIT] NULL,
	[ocupada_por] [varchar](15) NULL,
	[Color_Deseado2] [varchar](3) NULL,
	[idnegocio] [int] IDENTITY(1,1) NOT NULL,
	[acc_obs] [int] NULL,
	[nro_extranet] [int] NULL,
	[vin_extranet] [varchar](50) NULL,
	[enviada_extranet] [char](1) NULL,
	[idcompra] [int] NULL,
	[Ref_electronico] [varchar](100) NULL,
	[venta_digital] [char](1) NULL,
	[donacion] [decimal](12, 2) NULL,
	[act_mdx] [int] NULL,
	[Fecha_Asignado] [datetime] NULL,
	[Fecha_ruta] [datetime] NULL,
	[nit4] [dbo].[Tipo_NIT] NULL,
	[pasa_4] [bit] NULL,
	[participacionnit4] [money] NULL,
	[dirnit4] [tinyint] NULL,
	[fecha_hora_pedido_auto] [datetime] NULL,
	[nit_empresa] [dbo].[Tipo_NIT] NULL,
	[ciudad_matricula] [varchar](5) NULL,
	[dpto_matricula] [varchar](5) NULL,
 CONSTRAINT [PK_vh_documentos_ped] PRIMARY KEY CLUSTERED 
(
	[sw] ASC,
	[bodega] ASC,
	[numero] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 90, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[vh_documentos_ped_detalle]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[vh_documentos_ped_detalle](
	[sw] [tinyint] NOT NULL,
	[bodega] [smallint] NOT NULL,
	[numero] [int] NOT NULL,
	[seq] [int] NOT NULL,
	[codigo] [varchar](10) NOT NULL,
	[tipo_doc] [varchar](4) NULL,
	[numero_doc] [int] NULL,
	[valor] [money] NULL,
	[origen] [tinyint] NOT NULL,
	[signo] [smallint] NOT NULL,
	[adicional] [varchar](80) NULL,
	[Id] [int] IDENTITY(1,1) NOT NULL,
 CONSTRAINT [PK_vh_documentos_ped_detalle] PRIMARY KEY CLUSTERED 
(
	[sw] ASC,
	[bodega] ASC,
	[numero] ASC,
	[seq] ASC,
	[codigo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 90, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[vh_documentos_ped_notas]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[vh_documentos_ped_notas](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[sw] [tinyint] NOT NULL,
	[numero] [int] NOT NULL,
	[nota] [varchar](250) NULL,
	[fecha] [datetime] NULL,
	[id_Tipo] [int] NULL,
	[id_En_Manos_De] [int] NULL,
	[usuario] [varchar](20) NULL,
	[valor] [money] NULL,
 CONSTRAINT [PK_vh_documentos_ped_notas] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[vh_documentos_ped_pago]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[vh_documentos_ped_pago](
	[sw] [tinyint] NOT NULL,
	[numero] [int] NOT NULL,
	[forma] [tinyint] NOT NULL,
	[seq] [int] NOT NULL,
	[bodega] [int] NOT NULL,
	[responsable] [dbo].[Tipo_NIT] NOT NULL,
	[tipo_doc] [varchar](4) NULL,
	[numero_doc] [int] NULL,
	[banco] [tinyint] NULL,
	[codigo] [varchar](20) NULL,
	[valor] [money] NOT NULL,
	[vencimiento] [smalldatetime] NULL,
	[adicional] [varchar](80) NULL,
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Valor_Aplicado_HN] [money] NULL,
	[pago_vehiculo] [bit] NULL,
	[tipo_vta] [varchar](4) NULL,
	[numero_vta] [int] NULL,
 CONSTRAINT [PK_vh_documentos_ped_pago] PRIMARY KEY NONCLUSTERED 
(
	[sw] ASC,
	[numero] ASC,
	[forma] ASC,
	[seq] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 90, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[vh_eventos_vehiculos]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[vh_eventos_vehiculos](
	[id_evento] [int] IDENTITY(1,1) NOT NULL,
	[evento] [varchar](4) NOT NULL,
	[fecha_registro] [smalldatetime] NULL,
	[fecha_hora_evento] [smalldatetime] NOT NULL,
	[notas_1] [varchar](255) NULL,
	[notas_2] [varchar](255) NULL,
	[codigo] [varchar](20) NOT NULL,
	[ubicacion] [varchar](5) NULL,
	[usuario] [varchar](10) NOT NULL,
	[nit] [dbo].[Tipo_NIT] NULL,
	[Ingreso] [int] NOT NULL,
	[destino] [varchar](30) NULL,
	[consecutivo_compra] [int] NULL,
	[Fecha_Real_Evento] [datetime] NULL,
 CONSTRAINT [PK_eventos_vh] PRIMARY KEY NONCLUSTERED 
(
	[id_evento] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 75, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[vh_modelo]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[vh_modelo](
	[modelo] [varchar](20) NOT NULL,
	[descripcion] [varchar](50) NOT NULL,
	[marca] [varchar](5) NOT NULL,
	[grupo] [varchar](5) NOT NULL,
	[tipo] [varchar](5) NOT NULL,
	[clase] [varchar](3) NOT NULL,
	[contable] [tinyint] NOT NULL,
	[capacidad] [real] NOT NULL,
	[und_capacidad] [varchar](1) NULL,
	[cilindraje] [real] NULL,
	[servicio] [varchar](1) NULL,
	[combustible] [varchar](50) NULL,
	[origen] [varchar](2) NULL,
	[descontinuado] [varchar](1) NOT NULL,
	[modelo_taller] [varchar](10) NULL,
	[foto_modelo] [image] NULL,
	[adicional] [varchar](80) NULL,
	[homologacion] [varchar](16) NULL,
	[Tipo_Auto] [varchar](1) NULL,
	[familia] [varchar](5) NULL,
	[Modelo_Sofasa] [bit] NULL,
	[familiaVComercial] [varchar](5) NULL,
	[GrupoICE] [nvarchar](10) NULL,
	[BluePrint] [varchar](6) NULL,
	[tipo_transmision] [tinyint] NULL,
	[Capacidad_Kilogramos] [real] NOT NULL,
	[Capacidad_Toneladas] [real] NOT NULL,
	[nombre_ano] [varchar](max) NULL,
	[nombre_ano_id] [varchar](max) NULL,
	[vatios] [decimal](9, 2) NULL,
 CONSTRAINT [PK_Modelo] PRIMARY KEY CLUSTERED 
(
	[modelo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 90, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[vh_modelo_ano]    Script Date: 5/5/2026 10:47:36 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[vh_modelo_ano](
	[id_modano] [varchar](25) NOT NULL,
	[modelo] [varchar](20) NULL,
	[ano] [int] NOT NULL,
	[precio_lista] [money] NOT NULL,
	[precio_anterior] [money] NULL,
	[ultimo_cambio_precio] [smalldatetime] NULL,
	[maximo_vl_dcto] [money] NULL,
	[maximo_porc_dcto] [real] NULL,
	[codigo_iva] [smallint] NOT NULL,
	[codigo_iva_compra] [smallint] NOT NULL,
	[valor_seguro] [money] NULL,
	[costo_unitario] [dbo].[Tipo_COSTO] NULL,
	[costo_anterior] [dbo].[Tipo_COSTO] NULL,
	[alto] [real] NULL,
	[ancho] [real] NULL,
	[peso] [real] NULL,
	[margen] [money] NULL,
	[porc_margen] [real] NULL,
	[porc_concesionario] [real] NULL,
	[comision] [money] NULL,
	[porc_comision] [real] NULL,
	[largo] [real] NULL,
	[tex1] [varchar](200) NULL,
	[tex2] [varchar](200) NULL,
	[tex3] [varchar](200) NULL,
	[precio_final] [money] NOT NULL,
	[nuevo] [bit] NOT NULL,
	[id] [int] IDENTITY(1,1) NOT NULL,
	[descontinuado] [varchar](1) NULL,
	[km_dia] [decimal](12, 8) NULL,
	[soat] [money] NULL,
	[precio_final_impoconsumo] [money] NULL,
	[matricula] [money] NULL,
 CONSTRAINT [PK_modelo_ano] PRIMARY KEY NONCLUSTERED 
(
	[id_modano] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 85, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [IX_vh_modelo_ano_id] UNIQUE NONCLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[bodegas] ADD  CONSTRAINT [DF_bodegas_centro]  DEFAULT ((0)) FOR [centro]
GO
ALTER TABLE [dbo].[bodegas] ADD  DEFAULT ((0)) FOR [es_bodega_obsoleta]
GO
ALTER TABLE [dbo].[bodegas] ADD  DEFAULT ((0)) FOR [es_almacen]
GO
ALTER TABLE [dbo].[bodegas_ubicacion] ADD  DEFAULT ((0)) FOR [inactiva]
GO
ALTER TABLE [dbo].[crmv_plan_mantenimiento_enca] ADD  CONSTRAINT [DF_crmv_plan_mantenimiento_enca_es_generico]  DEFAULT ('N') FOR [es_generico]
GO
ALTER TABLE [dbo].[documentos] ADD  DEFAULT ((0)) FOR [con_referencia_fe]
GO
ALTER TABLE [dbo].[referencias_imp] ADD  CONSTRAINT [DF_referencias_imp_tipoPintura]  DEFAULT (N'V') FOR [tipoPintura]
GO
ALTER TABLE [dbo].[tall_citas] ADD  DEFAULT ((0)) FOR [numeroEspacios]
GO
ALTER TABLE [dbo].[tall_citas] ADD  DEFAULT ('NA') FOR [Facturado]
GO
ALTER TABLE [dbo].[tall_citas] ADD  DEFAULT ((0)) FOR [numeroComfrimaciones]
GO
ALTER TABLE [dbo].[tall_encabeza_orden] ADD  CONSTRAINT [DF_tall_encabeza_orden_anulada]  DEFAULT ((0)) FOR [anulada]
GO
ALTER TABLE [dbo].[terceros] ADD  CONSTRAINT [DF__terceros__gran_c__37A5467C]  DEFAULT ((0)) FOR [gran_contribuyente]
GO
ALTER TABLE [dbo].[terceros] ADD  CONSTRAINT [DF__terceros__autore__38996AB5]  DEFAULT ((0)) FOR [autoretenedor]
GO
ALTER TABLE [dbo].[terceros] ADD  CONSTRAINT [DF_terceros_pos_num]  DEFAULT ((0)) FOR [pos_num]
GO
ALTER TABLE [dbo].[terceros] ADD  CONSTRAINT [DF__terceros__banco___7FDD14B4]  DEFAULT ((0)) FOR [banco_personas]
GO
ALTER TABLE [dbo].[terceros] ADD  CONSTRAINT [DF_terceros_sincronizado]  DEFAULT ('N') FOR [sincronizado]
GO
ALTER TABLE [dbo].[vh_documentos_ped] ADD  CONSTRAINT [DF_vh_documentos_ped_plan_venta]  DEFAULT ((1)) FOR [plan_venta]
GO
ALTER TABLE [dbo].[vh_documentos_ped] ADD  CONSTRAINT [DF_vh_documentos_ped_itemsok]  DEFAULT ((0)) FOR [itemsOk]
GO
ALTER TABLE [dbo].[vh_documentos_ped] ADD  CONSTRAINT [DF_vh_documentos_ped_pagook]  DEFAULT ((0)) FOR [pagoOk]
GO
ALTER TABLE [dbo].[vh_documentos_ped] ADD  CONSTRAINT [DF_vh_documentos_ped_facturar]  DEFAULT ((0)) FOR [facturar]
GO
ALTER TABLE [dbo].[vh_documentos_ped] ADD  CONSTRAINT [DF__vh_docume__tipo___6BB9E75F]  DEFAULT ((1)) FOR [tipo_factura]
GO
ALTER TABLE [dbo].[vh_documentos_ped] ADD  CONSTRAINT [DF_vh_documentos_ped_act_mdx]  DEFAULT ((0)) FOR [act_mdx]
GO
ALTER TABLE [dbo].[vh_documentos_ped] ADD  DEFAULT (getdate()) FOR [fecha_hora_pedido_auto]
GO
ALTER TABLE [dbo].[vh_documentos_ped_detalle] ADD  CONSTRAINT [DF_vh_documentos_ped_detalle_signo]  DEFAULT ((1)) FOR [signo]
GO
ALTER TABLE [dbo].[vh_eventos_vehiculos] ADD  CONSTRAINT [DF__vh_evento__ingre__6912B6A8]  DEFAULT ((1)) FOR [Ingreso]
GO
ALTER TABLE [dbo].[vh_modelo] ADD  CONSTRAINT [DF_Modelo_grupo]  DEFAULT ('*') FOR [grupo]
GO
ALTER TABLE [dbo].[vh_modelo] ADD  CONSTRAINT [DF_Modelo_capacidad]  DEFAULT ((1)) FOR [capacidad]
GO
ALTER TABLE [dbo].[vh_modelo] ADD  CONSTRAINT [DF_Modelo_und_capacidad]  DEFAULT ('P') FOR [und_capacidad]
GO
ALTER TABLE [dbo].[vh_modelo] ADD  CONSTRAINT [DF_Modelo_cilindraje]  DEFAULT ((0)) FOR [cilindraje]
GO
ALTER TABLE [dbo].[vh_modelo] ADD  CONSTRAINT [DF_Modelo_combustible]  DEFAULT ('G') FOR [combustible]
GO
ALTER TABLE [dbo].[vh_modelo] ADD  CONSTRAINT [DF_Modelo_descontinuado]  DEFAULT ('N') FOR [descontinuado]
GO
ALTER TABLE [dbo].[vh_modelo] ADD  DEFAULT ((0)) FOR [Modelo_Sofasa]
GO
ALTER TABLE [dbo].[vh_modelo] ADD  DEFAULT ((0)) FOR [Capacidad_Kilogramos]
GO
ALTER TABLE [dbo].[vh_modelo] ADD  DEFAULT ((0)) FOR [Capacidad_Toneladas]
GO
ALTER TABLE [dbo].[vh_modelo_ano] ADD  CONSTRAINT [DF_modelo_ano_maximo_vl_dcto]  DEFAULT ((0)) FOR [maximo_vl_dcto]
GO
ALTER TABLE [dbo].[vh_modelo_ano] ADD  CONSTRAINT [DF_modelo_ano_maximo_porc_dcto_precio]  DEFAULT ((0)) FOR [maximo_porc_dcto]
GO
ALTER TABLE [dbo].[vh_modelo_ano] ADD  CONSTRAINT [DF_modelo_ano_porc_concesionario]  DEFAULT ((0)) FOR [porc_concesionario]
GO
ALTER TABLE [dbo].[vh_modelo_ano] ADD  CONSTRAINT [DF_modelo_ano_comision]  DEFAULT ((0)) FOR [comision]
GO
ALTER TABLE [dbo].[vh_modelo_ano] ADD  CONSTRAINT [DF_modelo_ano_porc_comision_precio]  DEFAULT ((0)) FOR [porc_comision]
GO
ALTER TABLE [dbo].[vh_modelo_ano] ADD  CONSTRAINT [DF__vh_modelo__preci__1C3D2329]  DEFAULT ((0)) FOR [precio_final]
GO
ALTER TABLE [dbo].[vh_modelo_ano] ADD  CONSTRAINT [DF_vh_modelo_ano_nuevo]  DEFAULT ((0)) FOR [nuevo]
GO
ALTER TABLE [dbo].[bodegas]  WITH CHECK ADD  CONSTRAINT [bodegas_centros] FOREIGN KEY([centro])
REFERENCES [dbo].[centros] ([centro])
GO
ALTER TABLE [dbo].[bodegas] CHECK CONSTRAINT [bodegas_centros]
GO
ALTER TABLE [dbo].[bodegas]  WITH CHECK ADD  CONSTRAINT [FK_bodegas_SedesDeBodegas] FOREIGN KEY([idSede])
REFERENCES [dbo].[SedesDeBodegas] ([id])
GO
ALTER TABLE [dbo].[bodegas] CHECK CONSTRAINT [FK_bodegas_SedesDeBodegas]
GO
ALTER TABLE [dbo].[bodegas_ubicacion]  WITH CHECK ADD  CONSTRAINT [FK_ubicacion_bod] FOREIGN KEY([bodega])
REFERENCES [dbo].[bodegas] ([bodega])
GO
ALTER TABLE [dbo].[bodegas_ubicacion] CHECK CONSTRAINT [FK_ubicacion_bod]
GO
ALTER TABLE [dbo].[crmv_plan_mantenimiento]  WITH CHECK ADD  CONSTRAINT [FK_crmv_plan_mantenimiento_crmv_plan_mantenimiento_enca] FOREIGN KEY([id_plan_mantenimiento_enca])
REFERENCES [dbo].[crmv_plan_mantenimiento_enca] ([id])
GO
ALTER TABLE [dbo].[crmv_plan_mantenimiento] CHECK CONSTRAINT [FK_crmv_plan_mantenimiento_crmv_plan_mantenimiento_enca]
GO
ALTER TABLE [dbo].[crmv_plan_mantenimiento]  WITH CHECK ADD  CONSTRAINT [FK_crmv_plan_mantenimiento_referencias] FOREIGN KEY([codigo_item])
REFERENCES [dbo].[referencias] ([codigo])
GO
ALTER TABLE [dbo].[crmv_plan_mantenimiento] CHECK CONSTRAINT [FK_crmv_plan_mantenimiento_referencias]
GO
ALTER TABLE [dbo].[crmv_plan_mantenimiento]  WITH CHECK ADD  CONSTRAINT [FK_crmv_plan_mantenimiento_tall_tempario] FOREIGN KEY([id_tall_tempario])
REFERENCES [dbo].[tall_tempario] ([id])
GO
ALTER TABLE [dbo].[crmv_plan_mantenimiento] CHECK CONSTRAINT [FK_crmv_plan_mantenimiento_tall_tempario]
GO
ALTER TABLE [dbo].[documentos]  WITH NOCHECK ADD  CONSTRAINT [documentos_terceros] FOREIGN KEY([nit])
REFERENCES [dbo].[terceros] ([nit])
GO
ALTER TABLE [dbo].[documentos] CHECK CONSTRAINT [documentos_terceros]
GO
ALTER TABLE [dbo].[documentos]  WITH CHECK ADD  CONSTRAINT [documentos_tipo_tran_mod] FOREIGN KEY([tipo], [modelo])
REFERENCES [dbo].[tipo_transacciones_mod] ([tipo], [modelo])
GO
ALTER TABLE [dbo].[documentos] CHECK CONSTRAINT [documentos_tipo_tran_mod]
GO
ALTER TABLE [dbo].[documentos]  WITH CHECK ADD  CONSTRAINT [documentos_tipo_trans] FOREIGN KEY([tipo])
REFERENCES [dbo].[tipo_transacciones] ([tipo])
GO
ALTER TABLE [dbo].[documentos] CHECK CONSTRAINT [documentos_tipo_trans]
GO
ALTER TABLE [dbo].[referencias_imp]  WITH NOCHECK ADD  CONSTRAINT [FK_referencias_imp_modelo_ano] FOREIGN KEY([id_modano])
REFERENCES [dbo].[vh_modelo_ano] ([id_modano])
GO
ALTER TABLE [dbo].[referencias_imp] CHECK CONSTRAINT [FK_referencias_imp_modelo_ano]
GO
ALTER TABLE [dbo].[referencias_imp]  WITH CHECK ADD  CONSTRAINT [FK_referencias_IMP_referencias] FOREIGN KEY([codigo])
REFERENCES [dbo].[referencias] ([codigo])
GO
ALTER TABLE [dbo].[referencias_imp] CHECK CONSTRAINT [FK_referencias_IMP_referencias]
GO
ALTER TABLE [dbo].[referencias_imp]  WITH CHECK ADD  CONSTRAINT [FK_referencias_imp_vh_tipos_veh] FOREIGN KEY([tipo_venta])
REFERENCES [dbo].[vh_tipos_veh] ([id])
GO
ALTER TABLE [dbo].[referencias_imp] CHECK CONSTRAINT [FK_referencias_imp_vh_tipos_veh]
GO
ALTER TABLE [dbo].[referencias_imp]  WITH CHECK ADD  CONSTRAINT [FK_referencias_imp_vh_usados_tipos_garantia] FOREIGN KEY([id_vh_usado_tipo_garantia])
REFERENCES [dbo].[vh_usados_tipos_garantia] ([id])
GO
ALTER TABLE [dbo].[referencias_imp] CHECK CONSTRAINT [FK_referencias_imp_vh_usados_tipos_garantia]
GO
ALTER TABLE [dbo].[tall_citas]  WITH NOCHECK ADD  CONSTRAINT [FK_tall_citas_referencias] FOREIGN KEY([codigo_veh])
REFERENCES [dbo].[referencias] ([codigo])
GO
ALTER TABLE [dbo].[tall_citas] CHECK CONSTRAINT [FK_tall_citas_referencias]
GO
ALTER TABLE [dbo].[tall_citas]  WITH NOCHECK ADD  CONSTRAINT [FK_tall_citas_terceros] FOREIGN KEY([nit])
REFERENCES [dbo].[terceros] ([nit])
GO
ALTER TABLE [dbo].[tall_citas] CHECK CONSTRAINT [FK_tall_citas_terceros]
GO
ALTER TABLE [dbo].[tall_citas]  WITH CHECK ADD  CONSTRAINT [FK_tall_citas_w_tall_citas_bahias] FOREIGN KEY([bahia])
REFERENCES [dbo].[w_tall_citas_bahias] ([id])
GO
ALTER TABLE [dbo].[tall_citas] CHECK CONSTRAINT [FK_tall_citas_w_tall_citas_bahias]
GO
ALTER TABLE [dbo].[tall_citas]  WITH CHECK ADD  CONSTRAINT [FK_tall_citas_w_tall_citas_Causas_Cancelacion] FOREIGN KEY([motivo_Cancelacion])
REFERENCES [dbo].[w_tall_citas_Causas_Cancelacion] ([id])
GO
ALTER TABLE [dbo].[tall_citas] CHECK CONSTRAINT [FK_tall_citas_w_tall_citas_Causas_Cancelacion]
GO
ALTER TABLE [dbo].[tall_encabeza_orden]  WITH NOCHECK ADD  CONSTRAINT [FK_tall_encabeza_orden_referencias] FOREIGN KEY([serie])
REFERENCES [dbo].[referencias] ([codigo])
GO
ALTER TABLE [dbo].[tall_encabeza_orden] CHECK CONSTRAINT [FK_tall_encabeza_orden_referencias]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [FK_terceros_actividades_cree] FOREIGN KEY([actividad_cree])
REFERENCES [dbo].[terceros_actividades_cree] ([actividad])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [FK_terceros_actividades_cree]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [FK_terceros_tarjetas] FOREIGN KEY([id_Tarjeta])
REFERENCES [dbo].[tarjetas] ([id])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [FK_terceros_tarjetas]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [FK_Terceros_Terceros_actividad_economica] FOREIGN KEY([codigoActividadEconomica])
REFERENCES [dbo].[Terceros_actividad_economica] ([codigo])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [FK_Terceros_Terceros_actividad_economica]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [FK_terceros_terceros_ica] FOREIGN KEY([codigo_ica])
REFERENCES [dbo].[terceros_ica] ([codigo_ica])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [FK_terceros_terceros_ica]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_condiciones] FOREIGN KEY([condicion])
REFERENCES [dbo].[condiciones_pago] ([condicion])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_condiciones]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_terceros_1] FOREIGN KEY([concepto_1])
REFERENCES [dbo].[terceros_1] ([concepto_1])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_terceros_1]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_terceros_10] FOREIGN KEY([concepto_10])
REFERENCES [dbo].[terceros_10] ([concepto_10])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_terceros_10]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_terceros_2] FOREIGN KEY([concepto_2])
REFERENCES [dbo].[terceros_2] ([concepto_2])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_terceros_2]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_terceros_3] FOREIGN KEY([concepto_3])
REFERENCES [dbo].[terceros_3] ([concepto_3])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_terceros_3]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_terceros_4] FOREIGN KEY([concepto_4])
REFERENCES [dbo].[terceros_4] ([concepto_4])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_terceros_4]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_terceros_5] FOREIGN KEY([concepto_5])
REFERENCES [dbo].[terceros_5] ([concepto_5])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_terceros_5]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_terceros_6] FOREIGN KEY([concepto_6])
REFERENCES [dbo].[terceros_6] ([concepto_6])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_terceros_6]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_terceros_7] FOREIGN KEY([concepto_7])
REFERENCES [dbo].[terceros_7] ([concepto_7])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_terceros_7]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_terceros_8] FOREIGN KEY([concepto_8])
REFERENCES [dbo].[terceros_8] ([concepto_8])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_terceros_8]
GO
ALTER TABLE [dbo].[terceros]  WITH NOCHECK ADD  CONSTRAINT [terceros_terceros_9] FOREIGN KEY([concepto_9])
REFERENCES [dbo].[terceros_9] ([concepto_9])
GO
ALTER TABLE [dbo].[terceros] CHECK CONSTRAINT [terceros_terceros_9]
GO
ALTER TABLE [dbo].[vh_documentos_ped]  WITH NOCHECK ADD  CONSTRAINT [FK_vh_documentos_ped_modelo_ano] FOREIGN KEY([modelo], [ano])
REFERENCES [dbo].[vh_modelo_ano] ([modelo], [ano])
GO
ALTER TABLE [dbo].[vh_documentos_ped] CHECK CONSTRAINT [FK_vh_documentos_ped_modelo_ano]
GO
ALTER TABLE [dbo].[vh_documentos_ped]  WITH NOCHECK ADD  CONSTRAINT [FK_vh_documentos_ped_referencias] FOREIGN KEY([codigo])
REFERENCES [dbo].[referencias] ([codigo])
GO
ALTER TABLE [dbo].[vh_documentos_ped] CHECK CONSTRAINT [FK_vh_documentos_ped_referencias]
GO
ALTER TABLE [dbo].[vh_documentos_ped]  WITH NOCHECK ADD  CONSTRAINT [FK_vh_documentos_ped_terceros] FOREIGN KEY([nit])
REFERENCES [dbo].[terceros] ([nit])
GO
ALTER TABLE [dbo].[vh_documentos_ped] CHECK CONSTRAINT [FK_vh_documentos_ped_terceros]
GO
ALTER TABLE [dbo].[vh_documentos_ped]  WITH NOCHECK ADD  CONSTRAINT [FK_vh_documentos_ped_vh_flotas] FOREIGN KEY([flota])
REFERENCES [dbo].[vh_flotas] ([flota])
GO
ALTER TABLE [dbo].[vh_documentos_ped] CHECK CONSTRAINT [FK_vh_documentos_ped_vh_flotas]
GO
ALTER TABLE [dbo].[vh_documentos_ped_pago]  WITH CHECK ADD  CONSTRAINT [FK_vh_documentos_ped_pago_formas] FOREIGN KEY([forma])
REFERENCES [dbo].[vh_formas] ([forma])
GO
ALTER TABLE [dbo].[vh_documentos_ped_pago] CHECK CONSTRAINT [FK_vh_documentos_ped_pago_formas]
GO
ALTER TABLE [dbo].[vh_documentos_ped_pago]  WITH NOCHECK ADD  CONSTRAINT [FK_vh_documentos_ped_pago_terceros] FOREIGN KEY([responsable])
REFERENCES [dbo].[terceros] ([nit])
GO
ALTER TABLE [dbo].[vh_documentos_ped_pago] CHECK CONSTRAINT [FK_vh_documentos_ped_pago_terceros]
GO
ALTER TABLE [dbo].[vh_eventos_vehiculos]  WITH NOCHECK ADD  CONSTRAINT [FK_eventosvh_codigo] FOREIGN KEY([codigo])
REFERENCES [dbo].[referencias] ([codigo])
GO
ALTER TABLE [dbo].[vh_eventos_vehiculos] CHECK CONSTRAINT [FK_eventosvh_codigo]
GO
ALTER TABLE [dbo].[vh_eventos_vehiculos]  WITH NOCHECK ADD  CONSTRAINT [FK_eventosvh_evento] FOREIGN KEY([evento])
REFERENCES [dbo].[vh_eventos] ([evento])
GO
ALTER TABLE [dbo].[vh_eventos_vehiculos] CHECK CONSTRAINT [FK_eventosvh_evento]
GO
ALTER TABLE [dbo].[vh_modelo]  WITH NOCHECK ADD  CONSTRAINT [FK_modelo_clase] FOREIGN KEY([clase])
REFERENCES [dbo].[vh_clase] ([clase])
GO
ALTER TABLE [dbo].[vh_modelo] CHECK CONSTRAINT [FK_modelo_clase]
GO
ALTER TABLE [dbo].[vh_modelo]  WITH NOCHECK ADD  CONSTRAINT [FK_modelo_grupo] FOREIGN KEY([grupo])
REFERENCES [dbo].[vh_grupo_modelo] ([grupo])
GO
ALTER TABLE [dbo].[vh_modelo] CHECK CONSTRAINT [FK_modelo_grupo]
GO
ALTER TABLE [dbo].[vh_modelo]  WITH NOCHECK ADD  CONSTRAINT [FK_modelo_marcas] FOREIGN KEY([marca])
REFERENCES [dbo].[vh_marcas] ([marca])
GO
ALTER TABLE [dbo].[vh_modelo] CHECK CONSTRAINT [FK_modelo_marcas]
GO
ALTER TABLE [dbo].[vh_modelo]  WITH NOCHECK ADD  CONSTRAINT [FK_modelo_tipo] FOREIGN KEY([tipo])
REFERENCES [dbo].[vh_tipo_modelo] ([tipo])
GO
ALTER TABLE [dbo].[vh_modelo] CHECK CONSTRAINT [FK_modelo_tipo]
GO
ALTER TABLE [dbo].[vh_modelo_ano]  WITH NOCHECK ADD  CONSTRAINT [FK_modano_modelo] FOREIGN KEY([modelo])
REFERENCES [dbo].[vh_modelo] ([modelo])
GO
ALTER TABLE [dbo].[vh_modelo_ano] CHECK CONSTRAINT [FK_modano_modelo]
GO
ALTER TABLE [dbo].[tall_citas]  WITH NOCHECK ADD  CONSTRAINT [ESTADO CITA DEBE SER P, C, R u O] CHECK  (([estado_cita]='O' OR ([estado_cita]='R' OR ([estado_cita]='C' OR [estado_cita]='P' OR [estado_cita]='A'))))
GO
ALTER TABLE [dbo].[tall_citas] CHECK CONSTRAINT [ESTADO CITA DEBE SER P, C, R u O]
GO
