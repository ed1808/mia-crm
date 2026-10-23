// packages/modules/ai/src/domain/collaboration.ts
import { Entity, Result } from '@mia-crm/kernel';

export interface AdvisorTaskProps {
  id: string;
  tenantId: string;
  userId: string | null;
  title: string;
  description?: string | null;
  entityType?: 'vehicle' | 'party' | 'deal' | 'opportunity' | 'lead' | null;
  entityId?: string | null;
  dueDate?: Date | null;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export class AdvisorTask extends Entity<string> {
  private _props: AdvisorTaskProps;

  constructor(props: AdvisorTaskProps) {
    super(props.id);
    this._props = { ...props };
  }

  public static create(
    props: Omit<AdvisorTaskProps, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
      id?: string;
      status?: 'pending' | 'completed' | 'cancelled';
    },
  ): AdvisorTask {
    const now = new Date();
    return new AdvisorTask({
      ...props,
      id: props.id || crypto.randomUUID(),
      status: props.status || 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }

  public complete(): void {
    this._props.status = 'completed';
    this._props.updatedAt = new Date();
  }

  public toJSON(): AdvisorTaskProps {
    return { ...this._props };
  }
}

export interface InternalNoteProps {
  id: string;
  tenantId: string;
  authorId: string | null;
  entityType: 'vehicle' | 'party' | 'deal' | 'opportunity' | 'lead';
  entityId: string;
  content: string;
  createdAt: Date;
}

export class InternalNote extends Entity<string> {
  private _props: InternalNoteProps;

  constructor(props: InternalNoteProps) {
    super(props.id);
    this._props = { ...props };
  }

  public static create(
    props: Omit<InternalNoteProps, 'id' | 'createdAt'> & { id?: string; createdAt?: Date },
  ): InternalNote {
    return new InternalNote({
      ...props,
      id: props.id || crypto.randomUUID(),
      createdAt: props.createdAt || new Date(),
    });
  }

  public toJSON(): InternalNoteProps {
    return { ...this._props };
  }
}
