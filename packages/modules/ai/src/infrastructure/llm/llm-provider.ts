// packages/modules/ai/src/infrastructure/llm/llm-provider.ts
import { Result } from '@mia-crm/kernel';
import type {
  ILlmProvider,
  LlmCompletionResponse,
  LlmMessage,
  LlmToolCall,
} from '../../domain/ports';
import type { ToolMetadata } from '../../domain/ai-tool';

export class MockLlmProvider implements ILlmProvider {
  readonly providerName = 'mock_deterministic';

  async complete(
    messages: LlmMessage[],
    tools?: ToolMetadata[],
  ): Promise<Result<LlmCompletionResponse, Error>> {
    const lastMsg = messages[messages.length - 1];
    const userPrompt = lastMsg ? lastMsg.content.toLowerCase() : '';

    // Si el último mensaje es el resultado de una tool, redactar respuesta en español colombiano
    if (lastMsg?.role === 'tool') {
      try {
        const parsed = JSON.parse(lastMsg.content);
        const toolName = lastMsg.name || '';

        if (toolName === 'query_metric') {
          const valObj = parsed.currentValue;
          const valStr = valObj?.formatted
            ? valObj.formatted
            : typeof valObj?.value === 'number'
              ? valObj.unit === 'percentage'
                ? `${valObj.value.toFixed(1)}%`
                : `$ ${valObj.value.toLocaleString('es-CO')}`
              : typeof parsed.globalValue === 'number'
                ? parsed.unit === 'percentage'
                  ? `${parsed.globalValue.toFixed(1)}%`
                  : `$ ${parsed.globalValue.toLocaleString('es-CO')}`
                : String(parsed.globalValue ?? '0');
          let resp = `📊 **Indicador Oficial Gobernado:**\n\n`;
          resp += `Para el KPI **${parsed.kpiName || parsed.kpiCode}**, el valor consolidado actual es de **${valStr}**.\n\n`;
          resp += `• **Fórmula Matemática:** \`${parsed.formula || 'Gobernada en capa semántica'}\`\n`;
          const breakdowns = parsed.breakdowns || parsed.breakdown;
          if (breakdowns && Array.isArray(breakdowns) && breakdowns.length > 0) {
            resp += `\n**Desglose por ${breakdowns[0].dimension || 'dimensión'}:**\n`;
            for (const item of breakdowns.slice(0, 5)) {
              const itemVal =
                item.formatted ||
                (typeof item.value === 'number'
                  ? item.percentage !== undefined
                    ? `${item.value.toFixed(1)}%`
                    : item.value
                  : item.value);
              const label = item.label || item.dimensionValue || item.key || 'General';
              resp += `• **${label}:** ${itemVal}${item.count !== undefined ? ` (${item.count} unidades)` : ''}\n`;
            }
          }
          if (parsed.explanation) {
            resp += `\n*${parsed.explanation}*\n`;
          }
          resp += `\n🔒 *Cálculo verificado bajo la Capa Semántica de MIA CRM y RLS (Decisión D-16: Cero Alucinaciones).*`;
          return Result.ok({ content: resp });
        }

        if (toolName === 'explain_metric') {
          let resp = `📐 **Fórmula y Significado de Negocio (D-16):**\n\n`;
          resp += `• **Indicador:** ${parsed.name || parsed.kpiCode}\n`;
          resp += `• **Fórmula Oficial:** \`${parsed.formula}\`\n`;
          resp += `• **Definición de Negocio:** ${parsed.businessInterpretation || parsed.businessDefinition || 'Métrica oficial gobernada.'}\n`;
          resp += `• **Unidad de Medida:** ${parsed.unit || 'Valor'}\n\n`;
          resp += `Esta regla matemática previene inconsistencias entre sedes y garantiza que ningún reporte gerencial invente cifras.`;
          return Result.ok({ content: resp });
        }

        if (toolName === 'list_my_leads') {
          const leads = Array.isArray(parsed) ? parsed : [];
          const criticalLeads = leads.filter((l: any) => l.slaCritical || l.slaBreached);
          let resp = `🚨 **Diagnóstico de Leads y Cumplimiento de SLA:**\n\n`;
          resp += `Tienes **${leads.length} leads activos** en tu bandeja. `;
          if (criticalLeads.length > 0) {
            resp += `Hay **${criticalLeads.length} lead(s) en estado crítico o vencido** que requieren atención urgente:\n\n`;
            for (const l of criticalLeads.slice(0, 4)) {
              const slaText = l.slaBreached
                ? `❌ SLA Vencido hace ${Math.abs(l.minutesRemainingSla || 0)} min`
                : `⚠️ ¡Crítico! Vence en ${l.minutesRemainingSla} min`;
              resp += `• **${l.fullName}** (${l.interestedVehicleModel || 'Interés general'}) — *${slaText}* | Canal: ${l.channel}\n`;
            }
            resp += `\nTe recomiendo iniciar contacto prioritario por WhatsApp para no perder la oportunidad de venta.`;
          } else {
            resp += `Todos tus leads se encuentran dentro del rango de tiempo de respuesta acordado.`;
          }
          return Result.ok({ content: resp });
        }

        if (toolName === 'get_vehicle_360') {
          const v = parsed.vehicle || {};
          const owner = parsed.primaryOwner || {};
          const proj = parsed.maintenanceProjection;
          let resp = `🚗 **Ficha Vehicle 360 — Placa ${v.current_plate || 'Sin Placa'}:**\n\n`;
          resp += `• **Vehículo:** ${v.make || ''} ${v.model || ''} (${v.model_year || 'N/A'})\n`;
          resp += `• **Kilometraje Odómetro:** ${v.current_mileage ? Number(v.current_mileage).toLocaleString('es-CO') + ' km' : 'No registrado'}\n`;
          resp += `• **Propietario:** ${owner.name || 'No asignado'} ${owner.phone ? `(${owner.phone})` : ''}\n`;
          if (proj) {
            const dateStr = new Date(proj.projected_date).toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            resp += `• **Próximo Servicio Proyectado:** ${dateStr} (~${proj.projected_mileage ? Number(proj.projected_mileage).toLocaleString('es-CO') + ' km' : ''}) [Confianza: ${proj.confidence_level || 'alta'}]\n`;
          }
          if (parsed.activeOpportunities && parsed.activeOpportunities.length > 0) {
            resp += `• **Oportunidad Detectada:** ${parsed.activeOpportunities[0].title} (Score: ${parsed.activeOpportunities[0].score})\n`;
          }
          resp += `\n¿Deseas que redacte una propuesta de contacto para este cliente o que agende una cita en taller?`;
          return Result.ok({ content: resp });
        }

        if (toolName === 'get_maintenance_status') {
          const days = parsed.daysRemaining;
          const statusText =
            days !== null && days !== undefined
              ? days < 0
                ? `vencido hace ${Math.abs(days)} días`
                : `programado en ${days} días`
              : 'programado próximamente';
          let resp = `🔧 **Estado de Mantenimiento Preventivo (D-35):**\n\n`;
          resp += `El vehículo **${parsed.make} ${parsed.model}** (Placa: **${parsed.plate}**) tiene su mantenimiento ${statusText}.\n\n`;
          resp += `• **Kilometraje Actual:** ${parsed.current_mileage ? Number(parsed.current_mileage).toLocaleString('es-CO') + ' km' : 'N/A'}\n`;
          if (parsed.projected_mileage) {
            resp += `• **Odómetro Proyectado al Servicio:** ${Number(parsed.projected_mileage).toLocaleString('es-CO')} km\n`;
          }
          resp += `• **Método de Estimación:** ${parsed.confidenceText || 'Proyección cohorte / propio'}\n\n`;
          resp += `¿Deseas que prepare una cita en taller o notifique al cliente?`;
          return Result.ok({ content: resp });
        }

        if (toolName === 'draft_message') {
          return Result.ok({
            content: `💬 **Propuesta de Contacto Preparada (Autonomía Nivel 2):**\n\nHe redactado el mensaje para **${parsed.recipientName || 'el cliente'}** (${parsed.phone || ''}). Al tratarse de una comunicación externa directa, he generado el enlace oficial de WhatsApp y la propuesta para tu confirmación previa.`,
          });
        }

        if (toolName === 'create_task_for_me') {
          return Result.ok({
            content: `✅ **Tarea Personal Programada (Autonomía Nivel 1):**\n\nHe registrado exitosamente la tarea '**${parsed.title || 'Seguimiento'}**' en tu bandeja de actividades. Al ser una acción reversible, puedes modificarla o completarla cuando lo consideres.`,
          });
        }
      } catch (_e) {
        // Fallback si no es JSON
      }

      const toolData = lastMsg.content;
      return Result.ok({
        content: `Basado en la consulta verificada bajo la capa semántica de MIA CRM:\n\n${toolData}\n\n¿Deseas que prepare una tarea o borrador de seguimiento?`,
      });
    }

    // 1. Detección de intenciones sobre KPIs / Métricas gerenciales (D-16)
    if (
      userPrompt.includes('retenci') ||
      userPrompt.includes('retención') ||
      userPrompt.includes('kpi') ||
      userPrompt.includes('indicador') ||
      userPrompt.includes('métrica') ||
      userPrompt.includes('ventas cayeron') ||
      userPrompt.includes('desempeño')
    ) {
      if (
        userPrompt.includes('explic') ||
        userPrompt.includes('fórmula') ||
        userPrompt.includes('formula')
      ) {
        return Result.ok({
          content:
            'Consultando la explicación y fórmula matemática del KPI en la capa semántica...',
          toolCalls: [
            {
              id: 'call_' + crypto.randomUUID().slice(0, 8),
              name: 'explain_metric',
              arguments: { kpiCode: 'vehicle_retention_rate' },
            },
          ],
        });
      }

      return Result.ok({
        content: 'Consultando la métrica oficial gobernada en la capa semántica (Decisión D-16)...',
        toolCalls: [
          {
            id: 'call_' + crypto.randomUUID().slice(0, 8),
            name: 'query_metric',
            arguments: { kpiCode: 'vehicle_retention_rate', dimension: 'make' },
          },
        ],
      });
    }

    // 2. Detección de intención "¿Qué hago hoy?" / Leads en SLA (Asesor Comercial)
    if (
      userPrompt.includes('que hago hoy') ||
      userPrompt.includes('qué hago hoy') ||
      userPrompt.includes('leads') ||
      userPrompt.includes('sla')
    ) {
      return Result.ok({
        content: 'Revisando leads prioritarios con SLA próximo a vencer y oportunidades activas...',
        toolCalls: [
          {
            id: 'call_' + crypto.randomUUID().slice(0, 8),
            name: 'list_my_leads',
            arguments: { status: 'new' },
          },
        ],
      });
    }

    // 3. Detección de consulta por placa / vehículo 360 / taller
    const plateMatch = userPrompt.match(/[a-z]{3}\d{3}|[a-z]{3}\d{2}[a-z]/i);
    if (
      plateMatch ||
      userPrompt.includes('vehiculo') ||
      userPrompt.includes('placa') ||
      userPrompt.includes('taller')
    ) {
      const plate = plateMatch ? plateMatch[0].toUpperCase() : 'ABC123';
      if (userPrompt.includes('mantenimiento') || userPrompt.includes('servicio')) {
        return Result.ok({
          content: `Consultando estado de mantenimiento y proyección para el vehículo ${plate}...`,
          toolCalls: [
            {
              id: 'call_' + crypto.randomUUID().slice(0, 8),
              name: 'get_maintenance_status',
              arguments: { plate },
            },
          ],
        });
      }

      return Result.ok({
        content: `Obteniendo la ficha Vehicle 360 del vehículo ${plate}...`,
        toolCalls: [
          {
            id: 'call_' + crypto.randomUUID().slice(0, 8),
            name: 'get_vehicle_360',
            arguments: { plate },
          },
        ],
      });
    }

    // 4. Redacción de mensaje de WhatsApp (Nivel 2)
    if (
      userPrompt.includes('redactar') ||
      userPrompt.includes('whatsapp') ||
      userPrompt.includes('mensaje')
    ) {
      return Result.ok({
        content:
          'Generando propuesta de mensaje de WhatsApp con enlace wa.me para tu revisión y aprobación...',
        toolCalls: [
          {
            id: 'call_' + crypto.randomUUID().slice(0, 8),
            name: 'draft_message',
            arguments: {
              phone: '3001234567',
              recipientName: 'Carlos Gómez',
              messageBody:
                'Hola Carlos, te saludamos del taller de concesionario. Notamos que tu vehículo tiene el mantenimiento preventivo programado para esta semana. ¿Te gustaría que agendemos tu cita para mañana?',
              channel: 'whatsapp',
            },
          },
        ],
      });
    }

    // 5. Tarea personal (Nivel 1)
    if (userPrompt.includes('tarea') || userPrompt.includes('recordatorio')) {
      return Result.ok({
        content: 'Registrando tarea personal en tu bandeja de seguimiento...',
        toolCalls: [
          {
            id: 'call_' + crypto.randomUUID().slice(0, 8),
            name: 'create_task_for_me',
            arguments: {
              title: 'Seguimiento a cotización de cliente',
              description: 'Llamar al cliente para validar interés en financiamiento',
              dueDate: new Date(Date.now() + 86400000).toISOString(),
            },
          },
        ],
      });
    }

    // Respuesta general de asistencia
    return Result.ok({
      content:
        '¡Hola! Soy MIA, tu copiloto de inteligencia artificial automotriz. Puedo ayudarte a consultar el estado 360 de un vehículo por placa, gestionar tus leads con SLA crítico, consultar indicadores gobernados o redactar mensajes para clientes. ¿En qué te puedo apoyar hoy?',
    });
  }
}

export class GeminiLlmProvider implements ILlmProvider {
  readonly providerName = 'gemini_flash';

  constructor(private readonly apiKey?: string) {}

  async complete(
    messages: LlmMessage[],
    tools?: ToolMetadata[],
  ): Promise<Result<LlmCompletionResponse, Error>> {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      // Fallback transparente al proveedor mock si no hay llave configurada
      const fallback = new MockLlmProvider();
      return fallback.complete(messages, tools);
    }

    try {
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const systemMsg = messages.find((m) => m.role === 'system');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        // Fallback en caso de error de red o cuota
        const fallback = new MockLlmProvider();
        return fallback.complete(messages, tools);
      }

      const json = (await response.json()) as any;
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return Result.ok({ content: text });
    } catch (_err) {
      const fallback = new MockLlmProvider();
      return fallback.complete(messages, tools);
    }
  }
}
