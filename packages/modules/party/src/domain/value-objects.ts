import { Result, DomainError } from '@mia-crm/kernel';

export type PartyType = 'person' | 'company';
export type DocumentType = 'NIT' | 'CC' | 'CE' | 'PASAPORTE' | 'TI' | 'OTHER';
export type ContactChannel = 'phone' | 'mobile' | 'email' | 'address';
export type ConsentPurpose = 'service_aftersales' | 'commercial' | 'marketing';
export type ConsentStatus = 'granted' | 'revoked';

export class DocumentNumber {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<DocumentNumber, DomainError> {
    if (!raw || typeof raw !== 'string') {
      return Result.fail(
        new DomainError('DOCUMENT_NUMBER_REQUIRED', 'El número de documento es obligatorio.'),
      );
    }

    // Normalizar: eliminar puntos, guiones y espacios
    const cleaned = raw
      .replace(/[.\-\s]/g, '')
      .trim()
      .toUpperCase();
    if (cleaned.length < 3 || cleaned.length > 30) {
      return Result.fail(
        new DomainError('DOCUMENT_NUMBER_INVALID', `Longitud de documento inválida: ${raw}`),
      );
    }

    return Result.ok(new DocumentNumber(cleaned));
  }
}

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Email, DomainError> {
    if (!raw || typeof raw !== 'string') {
      return Result.fail(
        new DomainError('EMAIL_REQUIRED', 'El correo electrónico es obligatorio.'),
      );
    }

    const trimmed = raw.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return Result.fail(
        new DomainError('EMAIL_INVALID_FORMAT', `Formato de correo inválido: ${raw}`),
      );
    }

    return Result.ok(new Email(trimmed));
  }
}

export class PhoneNumber {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<PhoneNumber, DomainError> {
    if (!raw || typeof raw !== 'string') {
      return Result.fail(new DomainError('PHONE_REQUIRED', 'El teléfono es obligatorio.'));
    }

    // Normalizar a solo dígitos
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return Result.fail(
        new DomainError('PHONE_INVALID_LENGTH', `Longitud de número telefónico inválida: ${raw}`),
      );
    }

    return Result.ok(new PhoneNumber(digitsOnly));
  }
}
