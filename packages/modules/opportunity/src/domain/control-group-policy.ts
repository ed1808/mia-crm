/**
 * Política de Grupo de Control Determinista del 15% (Decisión D-39)
 *
 * Los vehículos en el grupo de control generan oportunidades de manera transparente
 * para permitir la medición contrafactual (uplift real) frente a la tasa natural de retorno,
 * pero NO son contactados por los asesores.
 */
export class ControlGroupPolicy {
  private static readonly DEFAULT_SALT = 'mia_automotive_control_group_salt_v1';
  private static readonly DEFAULT_PERCENTAGE = 15;

  constructor(
    private readonly salt: string = ControlGroupPolicy.DEFAULT_SALT,
    private readonly percentage: number = ControlGroupPolicy.DEFAULT_PERCENTAGE,
  ) {}

  evaluate(vehicleId: string): boolean {
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(`${vehicleId}:${this.salt}`);
    const hashHex = hasher.digest('hex');

    const hashInt = Number.parseInt(hashHex.substring(0, 8), 16);
    const bucket = hashInt % 100;

    return bucket < this.percentage;
  }

  static isControlGroup(vehicleId: string, salt = ControlGroupPolicy.DEFAULT_SALT): boolean {
    return new ControlGroupPolicy(salt).evaluate(vehicleId);
  }
}
