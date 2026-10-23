import { DomainError, Result } from '@mia-crm/kernel';

export type RuleId =
  | 'R-MNT-01'
  | 'R-MNT-02'
  | 'R-MNT-03'
  | 'R-WAR-01'
  | 'R-RET-01'
  | 'R-FLT-01'
  | 'R-RTM-01';

export type OpportunityStatus =
  | 'detected'
  | 'in_progress'
  | 'appointment_requested'
  | 'converted'
  | 'rejected'
  | 'expired';

export class Score {
  private constructor(readonly value: number) {}

  static create(raw: number): Result<Score, DomainError> {
    if (raw === undefined || raw === null || Number.isNaN(raw) || raw < 0 || raw > 100) {
      return Result.fail(
        new DomainError('INVALID_SCORE', `El score debe ser un número entre 0 y 100: ${raw}`),
      );
    }
    return Result.ok(new Score(Number(raw.toFixed(2))));
  }
}
