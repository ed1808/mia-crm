import { AggregateRoot, Result, DomainError } from '@mia-crm/kernel';
import type {
  PartyType,
  DocumentType,
  DocumentNumber,
  ContactChannel,
  ConsentPurpose,
  ConsentStatus,
} from './value-objects';
import { PartyUpsertedDomainEvent } from './events';

export interface PartyIdentifierProps {
  idType: DocumentType;
  idNumber: DocumentNumber;
  isPrimary: boolean;
}

export interface PartyContactPointProps {
  channel: ContactChannel;
  value: string;
  isPrimary: boolean;
  isValid: boolean;
}

export interface PartyConsentProps {
  channel: string;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  capturedAt: Date;
}

export interface PartyProps {
  id: string;
  tenantId: string;
  partyType: PartyType;
  firstName?: string;
  lastName?: string;
  legalName?: string;
  tradeName?: string;
  identifiers: PartyIdentifierProps[];
  contactPoints: PartyContactPointProps[];
  consents: PartyConsentProps[];
  createdAt: Date;
  updatedAt: Date;
}

export class Party extends AggregateRoot<string> {
  private _partyType: PartyType;
  private _firstName?: string;
  private _lastName?: string;
  private _legalName?: string;
  private _tradeName?: string;
  private _identifiers: PartyIdentifierProps[];
  private _contactPoints: PartyContactPointProps[];
  private _consents: PartyConsentProps[];
  private _updatedAt: Date;

  private constructor(
    id: string,
    readonly tenantId: string,
    props: Omit<PartyProps, 'id' | 'tenantId'>,
  ) {
    super(id);
    this._partyType = props.partyType;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._legalName = props.legalName;
    this._tradeName = props.tradeName;
    this._identifiers = [...props.identifiers];
    this._contactPoints = [...props.contactPoints];
    this._consents = [...props.consents];
    this._updatedAt = props.updatedAt;
  }

  static create(props: {
    id?: string;
    tenantId: string;
    partyType: PartyType;
    firstName?: string;
    lastName?: string;
    legalName?: string;
    tradeName?: string;
    identifier: { idType: DocumentType; idNumber: DocumentNumber };
    contactPoints?: PartyContactPointProps[];
  }): Party {
    const id = props.id ?? crypto.randomUUID();
    const now = new Date();

    const party = new Party(id, props.tenantId, {
      partyType: props.partyType,
      firstName: props.firstName,
      lastName: props.lastName,
      legalName: props.legalName,
      tradeName: props.tradeName,
      identifiers: [
        {
          idType: props.identifier.idType,
          idNumber: props.identifier.idNumber,
          isPrimary: true,
        },
      ],
      contactPoints: props.contactPoints ? [...props.contactPoints] : [],
      consents: [],
      createdAt: now,
      updatedAt: now,
    });

    const primaryEmail = party.primaryEmail;
    const primaryPhone = party.primaryPhone;

    party.addDomainEvent(
      new PartyUpsertedDomainEvent(
        id,
        {
          partyId: id,
          tenantId: props.tenantId,
          partyType: props.partyType,
          documentType: props.identifier.idType,
          documentNumber: props.identifier.idNumber.value,
          fullName: party.fullName,
          email: primaryEmail,
          phone: primaryPhone,
        },
        now,
      ),
    );

    return party;
  }

  static reconstitute(props: PartyProps): Party {
    return new Party(props.id, props.tenantId, props);
  }

  get partyType(): PartyType {
    return this._partyType;
  }

  get firstName(): string | undefined {
    return this._firstName;
  }

  get lastName(): string | undefined {
    return this._lastName;
  }

  get legalName(): string | undefined {
    return this._legalName;
  }

  get tradeName(): string | undefined {
    return this._tradeName;
  }

  get fullName(): string {
    if (this._partyType === 'company') {
      return this._tradeName || this._legalName || 'Empresa';
    }
    return [this._firstName, this._lastName].filter(Boolean).join(' ') || 'Persona';
  }

  get identifiers(): readonly PartyIdentifierProps[] {
    return this._identifiers;
  }

  get primaryIdentifier(): PartyIdentifierProps | undefined {
    return this._identifiers.find((i) => i.isPrimary) ?? this._identifiers[0];
  }

  get contactPoints(): readonly PartyContactPointProps[] {
    return this._contactPoints;
  }

  get primaryEmail(): string | null {
    const cp =
      this._contactPoints.find((c) => c.channel === 'email' && c.isPrimary) ??
      this._contactPoints.find((c) => c.channel === 'email');
    return cp?.value ?? null;
  }

  get primaryPhone(): string | null {
    const cp =
      this._contactPoints.find(
        (c) => (c.channel === 'mobile' || c.channel === 'phone') && c.isPrimary,
      ) ?? this._contactPoints.find((c) => c.channel === 'mobile' || c.channel === 'phone');
    return cp?.value ?? null;
  }

  get consents(): readonly PartyConsentProps[] {
    return this._consents;
  }

  updateDetails(props: {
    firstName?: string;
    lastName?: string;
    legalName?: string;
    tradeName?: string;
  }): void {
    if (props.firstName !== undefined) this._firstName = props.firstName;
    if (props.lastName !== undefined) this._lastName = props.lastName;
    if (props.legalName !== undefined) this._legalName = props.legalName;
    if (props.tradeName !== undefined) this._tradeName = props.tradeName;
    this._updatedAt = new Date();
  }

  addOrUpdateContactPoint(channel: ContactChannel, value: string, isPrimary = true): void {
    const existingIndex = this._contactPoints.findIndex(
      (c) => c.channel === channel && c.value === value,
    );
    if (isPrimary) {
      // Remover flag primary de otros del mismo canal
      for (const cp of this._contactPoints) {
        if (cp.channel === channel) cp.isPrimary = false;
      }
    }

    if (existingIndex >= 0 && this._contactPoints[existingIndex]) {
      this._contactPoints[existingIndex].isPrimary = isPrimary;
      this._contactPoints[existingIndex].isValid = true;
    } else {
      this._contactPoints.push({
        channel,
        value,
        isPrimary,
        isValid: true,
      });
    }
    this._updatedAt = new Date();
  }

  grantConsent(channel: string, purpose: ConsentPurpose): void {
    const existing = this._consents.find((c) => c.channel === channel && c.purpose === purpose);
    if (existing) {
      existing.status = 'granted';
      existing.capturedAt = new Date();
    } else {
      this._consents.push({
        channel,
        purpose,
        status: 'granted',
        capturedAt: new Date(),
      });
    }
  }

  revokeConsent(channel: string, purpose: ConsentPurpose): void {
    const existing = this._consents.find((c) => c.channel === channel && c.purpose === purpose);
    if (existing) {
      existing.status = 'revoked';
      existing.capturedAt = new Date();
    } else {
      this._consents.push({
        channel,
        purpose,
        status: 'revoked',
        capturedAt: new Date(),
      });
    }
  }
}
