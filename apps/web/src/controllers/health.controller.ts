export interface HealthResponse {
  status: 'ok'
  service: 'artist-outreach-web'
  version: string
  time: string
}

export async function healthController(): Promise<HealthResponse> {
  return {
    status: 'ok',
    service: 'artist-outreach-web',
    version: process.env.APP_VERSION ?? '0.0.0',
    time: new Date().toISOString(),
  }
}
