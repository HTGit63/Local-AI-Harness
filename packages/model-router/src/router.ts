import { ModelRouteRequest, ModelRouteSelection, ModelRouterConfig } from './types';

export class ModelRouter {
  constructor(private readonly config: ModelRouterConfig) {}

  selectRoute(request: ModelRouteRequest): ModelRouteSelection {
    const model = this.modelForRole(request.role);
    const protocol = request.protocol ?? (request.role === 'agent' ? this.config.agentProtocol : undefined);
    const keepAlive = request.keepAlive ?? (request.role === 'agent' ? this.config.agentKeepAlive : undefined);
    const purpose = request.purpose?.trim();

    return {
      role: request.role,
      model,
      protocol,
      keepAlive,
      reason: purpose
        ? `${request.role} route for ${purpose}: ${model}.`
        : `${request.role} route selected: ${model}.`,
    };
  }

  private modelForRole(role: ModelRouteRequest['role']): string {
    switch (role) {
      case 'fast':
        return this.config.fastModel;
      case 'agent':
        return this.config.agentModel;
      case 'coding':
        return this.config.codingModel;
      case 'review':
        return this.config.reviewModel;
      case 'summary':
        return this.config.summaryModel;
      default: {
        const exhaustive: never = role;
        return exhaustive;
      }
    }
  }
}
