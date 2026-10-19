export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;

  ORGANIZATION_NAME: string;
  SIGNING_SECRET: string;

  RESEND_API_KEY?: string;
  AGENT_API_KEY?: string;
}
