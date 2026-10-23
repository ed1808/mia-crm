// packages/modules/ai/src/infrastructure/tools/approval-tools.ts
import { Result } from '@mia-crm/kernel';
import { AutonomyLevel } from '../../domain/autonomy';
import type { IAiTool, ToolExecutionContext, ToolParameterDefinition } from '../../domain/ai-tool';

export class DraftMessageTool implements IAiTool {
  readonly name = 'draft_message';
  readonly description =
    'Genera un borrador de mensaje personalizado (WhatsApp, SMS, Correo) con enlace wa.me seguro listo para revisión y aprobación humana (Nivel 2: Requiere Aprobación).';
  readonly autonomyLevel = AutonomyLevel.LEVEL_2_REQUIRES_APPROVAL;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'phone',
      type: 'string',
      description: 'Número de teléfono del destinatario en Colombia (10 dígitos)',
      required: true,
    },
    {
      name: 'recipientName',
      type: 'string',
      description: 'Nombre del cliente',
      required: true,
    },
    {
      name: 'messageBody',
      type: 'string',
      description: 'Cuerpo del mensaje redactado profesionalmente',
      required: true,
    },
    {
      name: 'channel',
      type: 'string',
      description: 'Canal de comunicación: whatsapp, email, sms',
      required: false,
    },
  ];

  async execute(
    _ctx: ToolExecutionContext,
    params: { phone: string; recipientName: string; messageBody: string; channel?: string },
  ): Promise<Result<any, any>> {
    if (!params.phone || !params.messageBody) {
      return Result.fail('El teléfono y el cuerpo del mensaje son requeridos');
    }

    // Normalizar teléfono colombiano
    const cleanDigits = params.phone.replace(/\D/g, '');
    const nationalNumber = cleanDigits.length === 10 ? cleanDigits : cleanDigits.slice(-10);
    const colombiaPhone = `57${nationalNumber}`;
    const encodedText = encodeURIComponent(params.messageBody);
    const waMeUrl = `https://wa.me/${colombiaPhone}?text=${encodedText}`;

    return Result.ok({
      requiresApproval: true,
      proposalType: 'message_dispatch',
      channel: params.channel || 'whatsapp',
      recipientName: params.recipientName,
      phone: colombiaPhone,
      messageBody: params.messageBody,
      waMeUrl,
      actionPrompt:
        'Revise el mensaje propuesto y haga clic en "Aprobar y Enviar" o abra el enlace de WhatsApp.',
    });
  }
}

export class RequestAppointmentTool implements IAiTool {
  readonly name = 'request_appointment';
  readonly description =
    'Prepara una solicitud de agendamiento de cita en taller para confirmación del asesor (Nivel 2: Requiere Aprobación).';
  readonly autonomyLevel = AutonomyLevel.LEVEL_2_REQUIRES_APPROVAL;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'plate',
      type: 'string',
      description: 'Placa del vehículo en Colombia',
      required: true,
    },
    {
      name: 'preferredDate',
      type: 'string',
      description: 'Fecha sugerida para la cita (ISO string)',
      required: true,
    },
    {
      name: 'serviceType',
      type: 'string',
      description: 'Tipo de servicio: maintenance, repair, warranty, rtm',
      required: true,
    },
    {
      name: 'notes',
      type: 'string',
      description: 'Observaciones para el jefe de taller',
      required: false,
    },
  ];

  async execute(
    _ctx: ToolExecutionContext,
    params: { plate: string; preferredDate: string; serviceType: string; notes?: string },
  ): Promise<Result<any, any>> {
    if (!params.plate || !params.preferredDate) {
      return Result.fail('La placa y la fecha preferida son obligatorias');
    }

    return Result.ok({
      requiresApproval: true,
      proposalType: 'appointment_booking',
      plate: params.plate.toUpperCase(),
      preferredDate: params.preferredDate,
      serviceType: params.serviceType,
      notes: params.notes || 'Agendamiento generado por asistencia IA',
      actionPrompt: '¿Desea confirmar el envío de la solicitud de cita al DMS/ERP?',
    });
  }
}

export class CreateOpportunityTool implements IAiTool {
  readonly name = 'create_opportunity';
  readonly description =
    'Propone una nueva oportunidad comercial o de posventa para validación humana (Nivel 2: Requiere Aprobación).';
  readonly autonomyLevel = AutonomyLevel.LEVEL_2_REQUIRES_APPROVAL;
  readonly parameters: ToolParameterDefinition[] = [
    {
      name: 'title',
      type: 'string',
      description: 'Título de la oportunidad',
      required: true,
    },
    {
      name: 'pipelineCode',
      type: 'string',
      description:
        'Código de pipeline: nuevos_livianos, comerciales_pesados, usados_retoma, flotas',
      required: true,
    },
    {
      name: 'estimatedValueCop',
      type: 'number',
      description: 'Valor estimado en pesos colombianos (COP)',
      required: false,
    },
  ];

  async execute(
    _ctx: ToolExecutionContext,
    params: { title: string; pipelineCode: string; estimatedValueCop?: number },
  ): Promise<Result<any, any>> {
    if (!params.title || !params.pipelineCode) {
      return Result.fail('El título y pipelineCode son obligatorios');
    }

    return Result.ok({
      requiresApproval: true,
      proposalType: 'opportunity_creation',
      title: params.title,
      pipelineCode: params.pipelineCode,
      estimatedValueCop: params.estimatedValueCop || 0,
      actionPrompt: 'Confirme la creación de la oportunidad en el embudo comercial.',
    });
  }
}
