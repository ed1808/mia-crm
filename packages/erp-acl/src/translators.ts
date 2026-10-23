import type {
  CanonicalPartyUpserted,
  CanonicalVehicleUpserted,
  CanonicalWorkOrderEvent,
  ErpWebhookEvent,
} from './contracts';

export class ErpTranslators {
  /**
   * Traduce filas de dbo.terceros aplicando lista blanca de minimización (D-48).
   * Excluye expresamente campos tributarios, estado civil, sexo y estrato.
   */
  static translateTerceros(
    event: ErpWebhookEvent<Record<string, unknown>>,
  ): CanonicalPartyUpserted | null {
    const after = event.payload.after;
    if (!after || !after['nit']) return null;

    const nit = String(after['nit']).trim();
    const nombres = String(after['nombres'] ?? '').trim();
    const email = after['mail'] ? String(after['mail']).trim() : null;
    const phone = after['celular']
      ? String(after['celular']).trim()
      : after['telefono_1']
        ? String(after['telefono_1']).trim()
        : null;
    const tipoDoc = after['tipo_identificacion']
      ? String(after['tipo_identificacion']).trim()
      : 'CC';

    // Heurística de empresa: NIT o tipo de documento = 'NIT' o más de 9 dígitos sin CC
    const isCompany =
      tipoDoc.toUpperCase() === 'NIT' ||
      (after['razon_comercial'] !== null && String(after['razon_comercial']).trim().length > 0);

    return {
      sourceSystem: 'ERP_SQL_SERVER',
      externalId: nit,
      documentType: tipoDoc,
      documentNumber: nit,
      fullName: nombres,
      email,
      phone,
      city: after['ciudad'] ? String(after['ciudad']).trim() : null,
      address: after['direccion'] ? String(after['direccion']).trim() : null,
      isCompany,
      capturedAt: event.captured_at,
    };
  }

  /**
   * Traduce filas de dbo.referencias_imp hacia la ficha del vehículo en el CRM.
   */
  static translateReferenciasImp(
    event: ErpWebhookEvent<Record<string, unknown>>,
  ): CanonicalVehicleUpserted | null {
    const after = event.payload.after;
    if (!after || !after['codigo']) return null;

    const codigo = String(after['codigo']).trim();
    const placa = after['placa'] ? String(after['placa']).trim().toUpperCase() : null;
    const vin = after['chasis']
      ? String(after['chasis']).trim().toUpperCase()
      : after['serie']
        ? String(after['serie']).trim().toUpperCase()
        : null;

    return {
      sourceSystem: 'ERP_SQL_SERVER',
      externalId: codigo,
      plate: placa,
      vin,
      engineNumber: after['motor'] ? String(after['motor']).trim() : null,
      make: 'AUTODETECT',
      model: after['modelo_taller'] ? String(after['modelo_taller']).trim() : 'DEFAULT',
      modelYear: after['modelo_ano'] ? Number(after['modelo_ano']) : null,
      color: after['color'] ? String(after['color']).trim() : null,
      mileage: after['kilometraje'] ? Number(after['kilometraje']) : null,
      operatingHours: after['horas_uso'] ? Number(after['horas_uso']) : null,
      warrantyEndDate: after['fecha_fin_garantia'] ? String(after['fecha_fin_garantia']) : null,
      technicalInspectionDate: after['fecha_tecnico_mecanica']
        ? String(after['fecha_tecnico_mecanica'])
        : null, // RTM (D-47)
      ownerNit: after['nit_comprador'] ? String(after['nit_comprador']).trim() : null,
      capturedAt: event.captured_at,
    };
  }

  /**
   * Traduce filas de dbo.tall_encabeza_orden clasificando el tipo de visita canónico (D-46).
   */
  static translateWorkOrder(
    event: ErpWebhookEvent<Record<string, unknown>>,
  ): CanonicalWorkOrderEvent | null {
    const after = event.payload.after;
    if (!after || after['numero'] === undefined || after['bodega'] === undefined) return null;

    const bodega = Number(after['bodega']);
    const numero = Number(after['numero']);
    const externalId = `${bodega}_${numero}`;

    // Clasificación canónica del ingreso (Decisión D-46)
    const rawTipo = String(after['tipo'] ?? '').toLowerCase();
    const rawTipoOrden = String(after['tipo_orden'] ?? '').toLowerCase();
    const tieneSiniestro = !!after['siniestro'] || !!after['aseguradora'];

    let orderType: CanonicalWorkOrderEvent['orderType'] = 'repair';
    if (rawTipo.includes('mto') || rawTipo.includes('mantenimiento') || rawTipoOrden === 'm') {
      orderType = 'maintenance';
    } else if (rawTipo.includes('gtia') || rawTipo.includes('garantia') || rawTipoOrden === 'g') {
      orderType = 'warranty';
    } else if (tieneSiniestro || rawTipo.includes('col') || rawTipo.includes('latoneria')) {
      orderType = 'collision';
    } else if (rawTipo.includes('camp') || after['cita'] === 'C') {
      orderType = 'recall_campaign';
    } else if (rawTipo.includes('alist') || rawTipo.includes('int') || rawTipoOrden === 'i') {
      orderType = 'internal';
    }

    return {
      sourceSystem: 'ERP_SQL_SERVER',
      externalId,
      bodega,
      orderNumber: numero,
      vehicleCode: String(after['serie'] ?? '').trim(),
      clientNit: String(after['nit'] ?? '').trim(),
      mileage: after['kilometraje'] ? Number(after['kilometraje']) : null,
      operatingHours: after['horas_uso'] ? Number(after['horas_uso']) : null,
      status: String(after['estado'] ?? '').trim(),
      orderType,
      insuranceCompanyNit: after['aseguradora'] ? String(after['aseguradora']).trim() : null,
      isBilled: Boolean(after['facturada']),
      isVoided: Boolean(after['anulada']),
      promisedDeliveryAt: after['promesa_entrega'] ? String(after['promesa_entrega']) : null,
      enteredAt: after['entrada']
        ? String(after['entrada'])
        : String(after['fecha'] ?? event.captured_at),
      capturedAt: event.captured_at,
    };
  }
}
