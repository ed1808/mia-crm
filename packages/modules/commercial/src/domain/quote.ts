import { AggregateRoot, DomainError, Result, type Clock } from '@mia-crm/kernel';

export interface QuoteItem {
  id: string;
  concept: string; // Ej: "Vehículo Nuevo Toyota Hilux 4x4 Diésel", "Película de Seguridad", "Matrícula + SOAT"
  unitPrice: number;
  quantity: number;
  taxPct: number; // e.g. 19 para IVA 19% en Colombia, 0 para trámites exentos
}

export interface QuoteVersionProps {
  id: string;
  quoteId: string;
  tenantId: string;
  versionNumber: number;
  basePrice: number;
  discountAmount: number;
  taxesAmount: number;
  tradeInAllowance: number; // Bono o avalúo de retoma del vehículo usado
  netAmount: number;
  paymentTerms?: string; // Contado, Crédito bancario, Renting, etc.
  validUntil: Date;
  items: QuoteItem[];
  notes?: string;
  createdAt: Date;
}

export class QuoteVersion {
  constructor(public readonly props: QuoteVersionProps) {}

  get versionNumber(): number {
    return this.props.versionNumber;
  }
  get basePrice(): number {
    return this.props.basePrice;
  }
  get discountAmount(): number {
    return this.props.discountAmount;
  }
  get taxesAmount(): number {
    return this.props.taxesAmount;
  }
  get tradeInAllowance(): number {
    return this.props.tradeInAllowance;
  }
  get netAmount(): number {
    return this.props.netAmount;
  }
  get validUntil(): Date {
    return this.props.validUntil;
  }
  get items(): readonly QuoteItem[] {
    return this.props.items;
  }
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'reconciled';

export interface QuoteProps {
  id: string;
  tenantId: string;
  dealId: string;
  quoteNumber: string;
  currentVersion: number;
  status: QuoteStatus;
  versions: QuoteVersion[];
  createdAt: Date;
  updatedAt: Date;
}

export class Quote extends AggregateRoot<string> {
  private props: QuoteProps;

  private constructor(props: QuoteProps) {
    super(props.id);
    this.props = props;
  }

  static create(
    params: {
      id?: string;
      tenantId: string;
      dealId: string;
      quoteNumber: string;
      items: QuoteItem[];
      discountAmount?: number;
      tradeInAllowance?: number;
      paymentTerms?: string;
      validDays?: number;
      notes?: string;
    },
    clock: Clock
  ): Result<Quote, DomainError> {
    if (!params.items || params.items.length === 0) {
      return Result.fail(new DomainError('INVALID_QUOTE', 'La cotización debe incluir al menos un ítem'));
    }

    const now = clock.now();
    const id = params.id ?? crypto.randomUUID();
    const validDays = params.validDays ?? 15; // 15 días de vigencia en concesionarios colombianos
    const validUntil = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);

    const calculation = Quote.calculateTotals(
      params.items,
      params.discountAmount ?? 0,
      params.tradeInAllowance ?? 0
    );

    const initialVersion = new QuoteVersion({
      id: crypto.randomUUID(),
      quoteId: id,
      tenantId: params.tenantId,
      versionNumber: 1,
      basePrice: calculation.basePrice,
      discountAmount: calculation.discountAmount,
      taxesAmount: calculation.taxesAmount,
      tradeInAllowance: calculation.tradeInAllowance,
      netAmount: calculation.netAmount,
      paymentTerms: params.paymentTerms,
      validUntil,
      items: params.items,
      notes: params.notes,
      createdAt: now,
    });

    const quote = new Quote({
      id,
      tenantId: params.tenantId,
      dealId: params.dealId,
      quoteNumber: params.quoteNumber,
      currentVersion: 1,
      status: 'draft',
      versions: [initialVersion],
      createdAt: now,
      updatedAt: now,
    });

    quote.addDomainEvent({
      eventId: crypto.randomUUID(),
      eventType: 'QuoteIssued',
      occurredAt: clock.isoNow(),
      tenantId: params.tenantId,
      payload: {
        quoteId: id,
        dealId: params.dealId,
        tenantId: params.tenantId,
        quoteNumber: params.quoteNumber,
        versionNumber: 1,
        netAmount: calculation.netAmount,
        validUntil: validUntil.toISOString(),
      },
    });

    return Result.ok(quote);
  }

  static reconstitute(props: QuoteProps): Quote {
    return new Quote(props);
  }

  static calculateTotals(
    items: QuoteItem[],
    discountAmount: number,
    tradeInAllowance: number
  ): {
    basePrice: number;
    discountAmount: number;
    taxesAmount: number;
    tradeInAllowance: number;
    netAmount: number;
  } {
    let basePrice = 0;
    let taxesAmount = 0;

    for (const item of items) {
      const lineSubtotal = item.unitPrice * item.quantity;
      basePrice += lineSubtotal;
      taxesAmount += lineSubtotal * (item.taxPct / 100);
    }

    const discount = Math.min(basePrice, Math.max(0, discountAmount));
    const tradeIn = Math.max(0, tradeInAllowance);
    const subtotalWithDiscountAndTax = basePrice - discount + taxesAmount;
    const netAmount = Math.max(0, subtotalWithDiscountAndTax - tradeIn);

    return {
      basePrice,
      discountAmount: discount,
      taxesAmount,
      tradeInAllowance: tradeIn,
      netAmount,
    };
  }

  // Getters
  get tenantId(): string {
    return this.props.tenantId;
  }
  get dealId(): string {
    return this.props.dealId;
  }
  get quoteNumber(): string {
    return this.props.quoteNumber;
  }
  get currentVersion(): number {
    return this.props.currentVersion;
  }
  get status(): QuoteStatus {
    return this.props.status;
  }
  get versions(): readonly QuoteVersion[] {
    return this.props.versions;
  }
  get latestVersion(): QuoteVersion | undefined {
    return this.props.versions.find((v) => v.versionNumber === this.props.currentVersion);
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  addVersion(
    params: {
      items: QuoteItem[];
      discountAmount?: number;
      tradeInAllowance?: number;
      paymentTerms?: string;
      validDays?: number;
      notes?: string;
    },
    clock: Clock
  ): Result<QuoteVersion, DomainError> {
    if (this.props.status === 'accepted' || this.props.status === 'reconciled') {
      return Result.fail(
        new DomainError('INVALID_STATE', `No se pueden agregar versiones a una cotización en estado ${this.props.status}`)
      );
    }

    const nextVerNumber = this.props.currentVersion + 1;
    const now = clock.now();
    const validDays = params.validDays ?? 15;
    const validUntil = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);

    const calculation = Quote.calculateTotals(
      params.items,
      params.discountAmount ?? 0,
      params.tradeInAllowance ?? 0
    );

    const newVersion = new QuoteVersion({
      id: crypto.randomUUID(),
      quoteId: this.id,
      tenantId: this.props.tenantId,
      versionNumber: nextVerNumber,
      basePrice: calculation.basePrice,
      discountAmount: calculation.discountAmount,
      taxesAmount: calculation.taxesAmount,
      tradeInAllowance: calculation.tradeInAllowance,
      netAmount: calculation.netAmount,
      paymentTerms: params.paymentTerms,
      validUntil,
      items: params.items,
      notes: params.notes,
      createdAt: now,
    });

    this.props.versions.push(newVersion);
    this.props.currentVersion = nextVerNumber;
    this.props.updatedAt = now;

    this.addDomainEvent({
      eventId: crypto.randomUUID(),
      eventType: 'QuoteIssued',
      occurredAt: clock.isoNow(),
      tenantId: this.props.tenantId,
      payload: {
        quoteId: this.id,
        dealId: this.props.dealId,
        tenantId: this.props.tenantId,
        quoteNumber: this.props.quoteNumber,
        versionNumber: nextVerNumber,
        netAmount: calculation.netAmount,
        validUntil: validUntil.toISOString(),
      },
    });

    return Result.ok(newVersion);
  }

  markAsSent(clock: Clock): void {
    if (this.props.status === 'draft') {
      this.props.status = 'sent';
      this.props.updatedAt = clock.now();
    }
  }

  markAsAccepted(clock: Clock): void {
    this.props.status = 'accepted';
    this.props.updatedAt = clock.now();
  }

  markAsReconciled(clock: Clock): void {
    this.props.status = 'reconciled';
    this.props.updatedAt = clock.now();
  }
}
