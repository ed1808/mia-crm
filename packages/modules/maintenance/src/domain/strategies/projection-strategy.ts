import type { ProjectionContext } from '../value-objects';
import type { NextVisitProjection } from '../next-visit-projection';

export interface ProjectionStrategy {
  canProject(ctx: ProjectionContext): boolean;
  project(ctx: ProjectionContext): NextVisitProjection;
}
