export interface ErpWebhookEvent<T = Record<string, unknown>> {
  event_id: string;
  source_table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  captured_at: string;
  payload: {
    after?: T;
    before?: T;
  };
}

export interface CanonicalPartyUpserted {
  sourceSystem: 'ERP_SQL_SERVER';
  externalId: string;
  documentType: string;
  documentNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  isCompany: boolean;
  capturedAt: string;
}

export interface CanonicalVehicleUpserted {
  sourceSystem: 'ERP_SQL_SERVER';
  externalId: string; // codigo en referencias_imp
  plate: string | null;
  vin: string | null; // chasis
  engineNumber: string | null;
  make: string;
  model: string;
  modelYear: number | null;
  color: string | null;
  mileage: number | null;
  operatingHours: number | null;
  warrantyEndDate: string | null;
  technicalInspectionDate: string | null; // RTM (D-47)
  ownerNit: string | null;
  capturedAt: string;
}

export interface CanonicalWorkOrderEvent {
  sourceSystem: 'ERP_SQL_SERVER';
  externalId: string; // bodega_numero
  bodega: number;
  orderNumber: number;
  vehicleCode: string; // serie
  clientNit: string;
  mileage: number | null;
  operatingHours: number | null;
  status: string;
  orderType:
    | 'maintenance'
    | 'repair'
    | 'warranty'
    | 'collision'
    | 'recall_campaign'
    | 'internal'
    | 'quick_service'; // D-46
  insuranceCompanyNit: string | null;
  isBilled: boolean;
  isVoided: boolean;
  promisedDeliveryAt: string | null;
  enteredAt: string;
  capturedAt: string;
}
