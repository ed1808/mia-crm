// packages/modules/ai/src/domain/tool-registry.ts
import { AutonomyLevel } from './autonomy';
import type { IAiTool, ToolMetadata } from './ai-tool';
import type { IAiToolRegistry } from './ports';
import { ROLE_PROMPTS } from './prompt-catalog';

export class AiToolRegistry implements IAiToolRegistry {
  private _tools: Map<string, IAiTool> = new Map();

  public register(tool: IAiTool): void {
    this._tools.set(tool.name, tool);
  }

  public get(name: string): IAiTool | undefined {
    return this._tools.get(name);
  }

  public listForRole(role: string): ToolMetadata[] {
    const roleDef = ROLE_PROMPTS[role];
    if (!roleDef) {
      return this.listAll();
    }
    const allowedSet = new Set(roleDef.allowedTools);
    return Array.from(this._tools.values())
      .filter((t) => allowedSet.has(t.name))
      .map((t) => ({
        name: t.name,
        description: t.description,
        autonomyLevel: t.autonomyLevel,
        parameters: t.parameters,
      }));
  }

  public listAll(): ToolMetadata[] {
    return Array.from(this._tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      autonomyLevel: t.autonomyLevel,
      parameters: t.parameters,
    }));
  }
}
