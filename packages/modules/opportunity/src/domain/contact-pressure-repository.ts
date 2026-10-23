export interface ContactPressureRepository {
  recordContact(
    partyId: string,
    channel: string,
    contactedAt: Date,
    cooldownUntil: Date,
  ): Promise<void>;
  isUnderCooldown(partyId: string, channel: string, now: Date): Promise<boolean>;
}
