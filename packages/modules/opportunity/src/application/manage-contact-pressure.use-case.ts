import type { Clock } from '@mia-crm/kernel';
import { SystemClock } from '@mia-crm/kernel';
import type { ContactPressureRepository } from '../domain/contact-pressure-repository';

export class ManageContactPressureUseCase {
  constructor(
    private readonly contactPressureRepo: ContactPressureRepository,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async canContact(partyId: string, channel: string): Promise<boolean> {
    const now = this.clock.now();
    const isCooldown = await this.contactPressureRepo.isUnderCooldown(partyId, channel, now);
    return !isCooldown;
  }

  async recordContact(partyId: string, channel: string, cooldownHours = 24): Promise<void> {
    const now = this.clock.now();
    const cooldownUntil = new Date(now.getTime() + cooldownHours * 60 * 60 * 1000);
    await this.contactPressureRepo.recordContact(partyId, channel, now, cooldownUntil);
  }
}
