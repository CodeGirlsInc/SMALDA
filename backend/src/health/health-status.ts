/**
 * Health evaluation (#1486).
 *
 * `GET /health` always returned 200 and never checked Postgres or the verifier
 * service. This helper turns the individual component probes into a status and
 * a matching HTTP status code.
 */
export interface ComponentHealth {
  postgres: boolean;
  verifier: boolean;
}

export type HealthState = "ok" | "degraded";

export interface HealthEvaluation {
  state: HealthState;
  statusCode: number;
  components: ComponentHealth;
}

export function evaluateHealth(components: ComponentHealth): HealthEvaluation {
  const healthy = components.postgres && components.verifier;
  return {
    state: healthy ? "ok" : "degraded",
    statusCode: healthy ? 200 : 503,
    components,
  };
}
