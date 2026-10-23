// packages/modules/ai/src/domain/autonomy.ts
// Decisión D-15: Niveles de Autonomía de la Inteligencia Artificial en MIA CRM

export enum AutonomyLevel {
  /**
   * Nivel 0: Solo lectura (Read-Only)
   * Consultas sin efectos secundarios, métricas gobernadas y resúmenes 360.
   * Ejecución inmediata sin confirmación humana. Minimización de datos y RLS mandatorio.
   */
  LEVEL_0_READ_ONLY = 0,

  /**
   * Nivel 1: Escritura propia reversible (Reversible User Write)
   * Creación de tareas personales, notas internas y recordatorios del asesor.
   * Ejecución automática bajo la identidad del usuario activo.
   */
  LEVEL_1_REVERSIBLE_WRITE = 1,

  /**
   * Nivel 2: Requiere aprobación humana (Approval Required)
   * Borradores de mensajes (wa.me), solicitudes de citas taller, creación o movimiento de oportunidades.
   * La IA prepara la propuesta estructurada; el asesor revisa, ajusta o aprueba.
   */
  LEVEL_2_REQUIRES_APPROVAL = 2,

  /**
   * Nivel 3: Prohibido en el MVP (Prohibited)
   * Borrado de datos, transacciones financieras, transferencias de propiedad sin validación humana, cambio de permisos.
   * Bloqueado por diseño con rechazo explícito y alerta de seguridad.
   */
  LEVEL_3_PROHIBITED = 3,
}

export type ToolExecutionStatus =
  | 'executed'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'failed'
  | 'prohibited';

export interface AutonomyPolicy {
  canAutoExecute(level: AutonomyLevel): boolean;
  requiresHumanReview(level: AutonomyLevel): boolean;
  isProhibited(level: AutonomyLevel): boolean;
}

export const DefaultAutonomyPolicy: AutonomyPolicy = {
  canAutoExecute(level: AutonomyLevel): boolean {
    return (
      level === AutonomyLevel.LEVEL_0_READ_ONLY || level === AutonomyLevel.LEVEL_1_REVERSIBLE_WRITE
    );
  },
  requiresHumanReview(level: AutonomyLevel): boolean {
    return level === AutonomyLevel.LEVEL_2_REQUIRES_APPROVAL;
  },
  isProhibited(level: AutonomyLevel): boolean {
    return level === AutonomyLevel.LEVEL_3_PROHIBITED;
  },
};
