export interface MetricsLabels {
  site: string;
  method: string;
  status_code: string;
  source: string;
  route: string;
}

export interface EmporixApiMetricsLabels extends MetricsLabels {
  token_type: string;
}
