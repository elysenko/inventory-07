/**
 * The credential surface the admin settings screen renders, one entry per key.
 *
 * Only the backing services this deployment actually provisions are listed
 * (PostgreSQL and MinIO). `secret: true` keys are masked before they leave the
 * process — the screen shows that a value exists, never what it is.
 */
export interface SettingDefinition {
  service: string;
  key: string;
  label: string;
  secret: boolean;
  /**
   * Tuning knobs that have a working default. They still render on the screen,
   * but leaving one blank must not report its whole service as unconfigured —
   * a missing optional key degrades nothing.
   */
  optional?: boolean;
}

export interface ServiceDefinition {
  service: string;
  label: string;
  blurb: string;
}

export const SERVICES: ServiceDefinition[] = [
  {
    service: 'postgresql',
    label: 'PostgreSQL',
    blurb:
      'Primary datastore for items, locations, stock levels and the movement audit trail.',
  },
  {
    service: 'minio',
    label: 'MinIO',
    blurb:
      'Object storage, provisioned for future document and photo attachments.',
  },
];

export const SETTINGS: SettingDefinition[] = [
  { service: 'postgresql', key: 'DATABASE_URL', label: 'Connection string', secret: true },
  { service: 'postgresql', key: 'PGSSLMODE', label: 'SSL mode', secret: false, optional: true },
  { service: 'minio', key: 'MINIO_ENDPOINT', label: 'Endpoint', secret: false },
  { service: 'minio', key: 'MINIO_ACCESS_KEY', label: 'Access key', secret: true },
  { service: 'minio', key: 'MINIO_SECRET_KEY', label: 'Secret key', secret: true },
  { service: 'minio', key: 'MINIO_BUCKET', label: 'Bucket name', secret: false },
];

const KNOWN_KEYS = new Set(SETTINGS.map((setting) => setting.key));

export function isKnownSettingKey(key: string): boolean {
  return KNOWN_KEYS.has(key);
}
