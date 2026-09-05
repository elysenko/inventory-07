import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isUnconfigured, resolveConfig } from '../lib/config';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  SERVICES,
  SETTINGS,
  ServiceDefinition,
  isKnownSettingKey,
} from './settings.catalog';

export interface SettingsEntryView {
  service: string;
  key: string;
  label: string;
  value: string;
  configured: boolean;
  secret: boolean;
  /** Blank optional keys do not make their service count as unconfigured. */
  optional: boolean;
  /** Where the effective value came from: the pod env, the DB override, or nowhere. */
  source: 'env' | 'db' | null;
}

export interface SettingsResponse {
  services: ServiceDefinition[];
  entries: SettingsEntryView[];
  unconfigured: string[];
}

/** Reveals that a secret is set and roughly which one, without leaking it. */
function mask(value: string): string {
  const tail = value.slice(-4);
  return value.length <= 4 ? '••••••••' : `••••••••${tail}`;
}

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<SettingsResponse> {
    const overrides = await this.prisma.systemSetting.findMany();
    const overrideMap = new Map(overrides.map((row) => [row.key, row.value]));

    const entries: SettingsEntryView[] = SETTINGS.map((definition) => {
      const envValue = process.env[definition.key];
      const dbValue = overrideMap.get(definition.key);
      const fromEnv = !isUnconfigured(envValue);
      const fromDb = !fromEnv && !isUnconfigured(dbValue);
      const effective = fromEnv ? (envValue as string) : fromDb ? (dbValue as string) : '';

      return {
        service: definition.service,
        key: definition.key,
        label: definition.label,
        // Secrets never leave the process in the clear, even for an admin.
        value: effective && definition.secret ? mask(effective) : effective,
        configured: !!effective,
        secret: definition.secret,
        optional: !!definition.optional,
        source: fromEnv ? 'env' : fromDb ? 'db' : null,
      };
    });

    const unconfigured = SERVICES.filter((service) =>
      entries.some(
        (entry) =>
          entry.service === service.service &&
          !entry.configured &&
          !entry.optional,
      ),
    ).map((service) => service.label);

    return { services: SERVICES, entries, unconfigured };
  }

  /**
   * Writes overrides into `SystemSetting`. Unknown keys are refused so this
   * endpoint cannot be used to stuff arbitrary rows into the table, and a blank
   * value clears the override rather than storing an empty string.
   */
  async update(dto: UpdateSettingsDto): Promise<SettingsResponse> {
    const unknown = dto.settings
      .map((setting) => setting.key)
      .filter((key) => !isKnownSettingKey(key));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown setting key(s): ${unknown.join(', ')}`,
      );
    }

    for (const { key, value } of dto.settings) {
      const trimmed = value.trim();
      if (!trimmed) {
        await this.prisma.systemSetting.deleteMany({ where: { key } });
        continue;
      }
      // A masked value round-tripped from the form is not a real edit — ignore it.
      if (trimmed.startsWith('••••')) {
        continue;
      }
      await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value: trimmed },
        create: { key, value: trimmed },
      });
    }

    return this.list();
  }

  /** Convenience for feature code that needs one resolved credential. */
  resolve(key: string): Promise<string | null> {
    return resolveConfig(this.prisma, key);
  }
}
