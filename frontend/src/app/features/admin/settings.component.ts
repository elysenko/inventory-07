import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { SettingsEntry } from '../../core/models';

interface ServiceGroup {
  service: string;
  label: string;
  blurb: string;
  entries: SettingsEntry[];
  configured: boolean;
}

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saved = signal<string | null>(null);

  /** One row per credential key the backend exposes, values already masked. */
  readonly settings = signal<SettingsEntry[]>([
    { service: 'postgresql', key: 'DATABASE_URL', label: 'Connection string', value: 'postgresql://stockroom:••••••••@db:5432/stockroom', configured: true, secret: true },
    { service: 'postgresql', key: 'PGSSLMODE', label: 'SSL mode', value: 'prefer', configured: true, secret: false },
    { service: 'minio', key: 'MINIO_ENDPOINT', label: 'Endpoint', value: 'http://minio:9000', configured: true, secret: false },
    { service: 'minio', key: 'MINIO_ACCESS_KEY', label: 'Access key', value: '', configured: false, secret: true },
    { service: 'minio', key: 'MINIO_SECRET_KEY', label: 'Secret key', value: '', configured: false, secret: true },
    { service: 'minio', key: 'MINIO_BUCKET', label: 'Bucket name', value: 'stockroom-docs', configured: true, secret: false },
  ]);

  readonly serviceMeta = signal<{ service: string; label: string; blurb: string }[]>([
    { service: 'postgresql', label: 'PostgreSQL', blurb: 'Primary datastore for items, locations, stock levels and the movement audit trail.' },
    { service: 'minio', label: 'MinIO', blurb: 'Object storage, provisioned for future document and photo attachments.' },
  ]);

  readonly form = this.fb.nonNullable.group<Record<string, unknown>>({});

  readonly groups = computed<ServiceGroup[]>(() =>
    this.serviceMeta().map((meta) => {
      const entries = this.settings().filter((s) => s.service === meta.service);
      return {
        ...meta,
        entries,
        configured: entries.every((e) => e.configured),
      };
    }),
  );

  readonly unconfigured = computed(() =>
    this.groups().filter((g) => !g.configured),
  );

  readonly unconfiguredNames = computed(() =>
    this.unconfigured().map((g) => g.label).join(', '),
  );

  constructor() {
    for (const entry of this.settings()) {
      this.form.addControl(entry.key, this.fb.nonNullable.control(entry.value));
    }
  }

  save(service: string): void {
    const values = this.form.getRawValue() as Record<string, string>;
    this.settings.update((list) =>
      list.map((entry) =>
        entry.service === service
          ? {
              ...entry,
              value: values[entry.key] ?? entry.value,
              configured: !!(values[entry.key] ?? entry.value),
            }
          : entry,
      ),
    );
    const label =
      this.serviceMeta().find((m) => m.service === service)?.label ?? service;
    this.saved.set(`${label} credentials saved.`);
  }
}
