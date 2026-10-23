import { Entity } from '@mia-crm/kernel';

export interface PipelineStageProps {
  id: string;
  pipelineId: string;
  tenantId: string;
  code: string;
  name: string;
  orderIndex: number;
  probabilityPct: number;
  isWon: boolean;
  isLost: boolean;
  createdAt: Date;
}

export class PipelineStage extends Entity<string> {
  constructor(public readonly props: PipelineStageProps) {
    super(props.id);
  }

  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get orderIndex(): number {
    return this.props.orderIndex;
  }
  get probabilityPct(): number {
    return this.props.probabilityPct;
  }
  get isWon(): boolean {
    return this.props.isWon;
  }
  get isLost(): boolean {
    return this.props.isLost;
  }
}

export interface PipelineProps {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
  createdAt: Date;
}

export class Pipeline extends Entity<string> {
  constructor(public readonly props: PipelineProps) {
    super(props.id);
  }

  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get isDefault(): boolean {
    return this.props.isDefault;
  }
  get stages(): readonly PipelineStage[] {
    return [...this.props.stages].sort((a, b) => a.orderIndex - b.orderIndex);
  }

  findStage(stageId: string): PipelineStage | undefined {
    return this.props.stages.find((s) => s.id === stageId);
  }

  getInitialStage(): PipelineStage | undefined {
    return this.stages.find((s) => !s.isWon && !s.isLost);
  }
}

/**
 * Plantillas predeterminadas de los 4 pipelines del sector automotriz colombiano
 */
export const DEFAULT_AUTOMOTIVE_PIPELINES = [
  {
    code: 'new_passenger',
    name: 'Nuevos Livianos & SUVs',
    isDefault: true,
    stages: [
      { code: 'prospect', name: 'Prospección & Contacto', orderIndex: 1, probabilityPct: 15, isWon: false, isLost: false },
      { code: 'test_drive', name: 'Demostración / Test Drive', orderIndex: 2, probabilityPct: 35, isWon: false, isLost: false },
      { code: 'quote_sent', name: 'Cotización Enviada', orderIndex: 3, probabilityPct: 50, isWon: false, isLost: false },
      { code: 'financing', name: 'Solicitud Crédito / Banco', orderIndex: 4, probabilityPct: 70, isWon: false, isLost: false },
      { code: 'negotiation', name: 'Cierre & Separación', orderIndex: 5, probabilityPct: 85, isWon: false, isLost: false },
      { code: 'won', name: 'Venta Ganada (Pedido ERP)', orderIndex: 6, probabilityPct: 100, isWon: true, isLost: false },
      { code: 'lost', name: 'Perdida / Desistida', orderIndex: 7, probabilityPct: 0, isWon: false, isLost: true },
    ],
  },
  {
    code: 'commercial_heavy',
    name: 'Comerciales & Pesados (Camiones/Buses)',
    isDefault: false,
    stages: [
      { code: 'inquiry', name: 'Contacto & Requerimiento', orderIndex: 1, probabilityPct: 10, isWon: false, isLost: false },
      { code: 'engineering', name: 'Levantamiento de Carrocería / Carga', orderIndex: 2, probabilityPct: 30, isWon: false, isLost: false },
      { code: 'tech_quote', name: 'Propuesta Técnica y Financiera', orderIndex: 3, probabilityPct: 55, isWon: false, isLost: false },
      { code: 'leasing_approval', name: 'Aprobación Renting / Leasing B2B', orderIndex: 4, probabilityPct: 75, isWon: false, isLost: false },
      { code: 'final_contract', name: 'Firma de Contrato', orderIndex: 5, probabilityPct: 90, isWon: false, isLost: false },
      { code: 'won', name: 'Adjudicada (Pedido ERP)', orderIndex: 6, probabilityPct: 100, isWon: true, isLost: false },
      { code: 'lost', name: 'Licitación / Negocio Perdido', orderIndex: 7, probabilityPct: 0, isWon: false, isLost: true },
    ],
  },
  {
    code: 'used_tradein',
    name: 'Usados & Retoma (Trade-In)',
    isDefault: false,
    stages: [
      { code: 'appraisal_requested', name: 'Solicitud Peritaje Retoma', orderIndex: 1, probabilityPct: 20, isWon: false, isLost: false },
      { code: 'appraisal_done', name: 'Avalúo Realizado & Oferta', orderIndex: 2, probabilityPct: 45, isWon: false, isLost: false },
      { code: 'commercial_combo', name: 'Propuesta Retoma + Nuevo', orderIndex: 3, probabilityPct: 65, isWon: false, isLost: false },
      { code: 'paperwork', name: 'Traspaso & Documentación', orderIndex: 4, probabilityPct: 85, isWon: false, isLost: false },
      { code: 'won', name: 'Retoma y Venta Concretada', orderIndex: 5, probabilityPct: 100, isWon: true, isLost: false },
      { code: 'lost', name: 'Retoma Descartada', orderIndex: 6, probabilityPct: 0, isWon: false, isLost: true },
    ],
  },
  {
    code: 'fleet_b2b',
    name: 'Flotas & Corporativo',
    isDefault: false,
    stages: [
      { code: 'discovery', name: 'Diagnóstico Parque Automotor', orderIndex: 1, probabilityPct: 15, isWon: false, isLost: false },
      { code: 'multi_quote', name: 'Cotización Paquete Flota', orderIndex: 2, probabilityPct: 40, isWon: false, isLost: false },
      { code: 'board_review', name: 'Revisión Comité Compras', orderIndex: 3, probabilityPct: 65, isWon: false, isLost: false },
      { code: 'contract_award', name: 'Adjudicación / Orden Compra', orderIndex: 4, probabilityPct: 90, isWon: false, isLost: false },
      { code: 'won', name: 'Flota Cerrada (Pedidos ERP)', orderIndex: 5, probabilityPct: 100, isWon: true, isLost: false },
      { code: 'lost', name: 'Concurso Desierto / Competencia', orderIndex: 6, probabilityPct: 0, isWon: false, isLost: true },
    ],
  },
];
