import 'server-only';
import { createHash } from 'node:crypto';
import type {
  CreatedShipment,
  CreateShipmentInput,
  PickupPoint,
  PickupPointSearch,
  ProviderTrackingEvent,
  ShipmentTracking,
  ShippingProvider,
} from '../../types';
import { getMondialRelayConfig } from './config';
import { MondialRelayError } from './errors';
import { mondialRelaySecurity } from './security';
import { soapCall } from './soap';

const text = (value: unknown) =>
  value === null || value === undefined ? '' : String(value).trim();
const optionalNumber = (value: unknown) => {
  const normalized = text(value).replace(',', '.');
  const number = Number(normalized);
  return normalized && Number.isFinite(number) ? number : null;
};
const list = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

function status(result: Record<string, unknown>) {
  const code = text(result.STAT);
  if (code && code !== '0')
    throw new MondialRelayError(
      'Mondial Relay a refusé la demande. Vérifiez les données et la configuration.',
      `STAT_${code}`,
    );
}

function hours(row: Record<string, unknown>) {
  const days = [
    ['lundi', 'Horaires_Lundi'],
    ['mardi', 'Horaires_Mardi'],
    ['mercredi', 'Horaires_Mercredi'],
    ['jeudi', 'Horaires_Jeudi'],
    ['vendredi', 'Horaires_Vendredi'],
    ['samedi', 'Horaires_Samedi'],
    ['dimanche', 'Horaires_Dimanche'],
  ] as const;
  const result: Record<string, string[]> = {};
  for (const [day, key] of days) {
    const source = row[key];
    if (!source || typeof source !== 'object') continue;
    const slots = list((source as Record<string, unknown>).string)
      .map(text)
      .filter(Boolean);
    if (slots.length) result[day] = slots;
  }
  return Object.keys(result).length ? result : null;
}

function pickupPoint(row: Record<string, unknown>): PickupPoint {
  const activity =
    `${text(row.TypeActivite)} ${text(row.Information)}`.toLowerCase();
  return {
    provider: 'MONDIAL_RELAY',
    id: text(row.Num),
    type:
      activity.includes('locker') || activity.includes('consigne')
        ? 'LOCKER'
        : activity
          ? 'RELAY_POINT'
          : 'UNKNOWN',
    name: text(row.LgAdr1) || text(row.LgAdr2),
    address1: text(row.LgAdr3) || text(row.LgAdr2),
    address2: text(row.LgAdr4) || null,
    postalCode: text(row.CP),
    city: text(row.Ville),
    countryCode: text(row.Pays).toUpperCase(),
    latitude: optionalNumber(row.Latitude),
    longitude: optionalNumber(row.Longitude),
    distanceM: optionalNumber(row.Distance),
    openingHours: hours(row),
  };
}

function frenchTrackingDate(dateValue: string, timeValue: string) {
  const match = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const time = timeValue.match(/^(\d{2}):(\d{2})/) ?? ['', '12', '00'];
  const result = new Date(
    `${match[3]}-${match[2]}-${match[1]}T${time[1]}:${time[2]}:00+02:00`,
  );
  return Number.isNaN(result.getTime()) ? null : result;
}

export class MondialRelayProvider implements ShippingProvider {
  async searchPickupPoints(input: PickupPointSearch) {
    const config = getMondialRelayConfig();
    const values = [
      config.brandCode,
      input.countryCode,
      input.pointId ?? '',
      input.city ?? '',
      input.postalCode,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      Math.min(Math.max(input.limit ?? 10, 1), 30),
    ] as const;
    const result = await soapCall(
      config.apiUrl,
      'WSI4_PointRelais_Recherche',
      {
        Enseigne: values[0],
        Pays: values[1],
        NumPointRelais: values[2],
        Ville: values[3],
        CP: values[4],
        Latitude: values[5],
        Longitude: values[6],
        Taille: values[7],
        Poids: values[8],
        Action: values[9],
        DelaiEnvoi: values[10],
        RayonRecherche: values[11],
        TypeActivite: values[12],
        NACE: values[13],
        NombreResultats: values[14],
        Security: mondialRelaySecurity(values, config.privateKey),
      },
      { retryRead: true },
    );
    status(result);
    const points = result.PointsRelais as Record<string, unknown> | undefined;
    return list(points?.PointRelais_Details)
      .filter((row): row is Record<string, unknown> =>
        Boolean(row && typeof row === 'object'),
      )
      .map(pickupPoint)
      .filter(
        (point) => point.id && point.name && point.postalCode && point.city,
      );
  }

  async getPickupPoint(pointId: string, countryCode: string) {
    const points = await this.searchPickupPoints({
      pointId,
      postalCode: '',
      countryCode,
      limit: 1,
    });
    const point = points.find((entry) => entry.id === pointId);
    if (!point)
      throw new MondialRelayError(
        'Ce Point Relais® n’est plus disponible.',
        'PICKUP_POINT_NOT_FOUND',
      );
    return point;
  }

  async createShipment(input: CreateShipmentInput): Promise<CreatedShipment> {
    const config = getMondialRelayConfig();
    const recipient = input.recipient;
    const values = [
      config.brandCode,
      config.collectionMode,
      config.deliveryMode,
      input.orderNumber,
      input.customerReference,
      'FR',
      config.sender.name,
      '',
      config.sender.address1,
      config.sender.address2,
      config.sender.city,
      config.sender.postalCode,
      config.sender.countryCode,
      config.sender.phone,
      '',
      config.sender.email,
      'FR',
      recipient.name,
      recipient.company ?? '',
      recipient.address1,
      recipient.address2 ?? '',
      recipient.city,
      recipient.postalCode,
      recipient.countryCode,
      recipient.phone ?? '',
      '',
      recipient.email,
      String(input.weightGrams),
      '',
      '',
      '1',
      '',
      '',
      '',
      '',
      '',
      '',
      input.pickupPoint.countryCode,
      input.pickupPoint.id,
      '',
      '',
      '',
      '',
      '',
      '',
    ];
    const keys = [
      'Enseigne',
      'ModeCol',
      'ModeLiv',
      'NDossier',
      'NClient',
      'Expe_Langage',
      'Expe_Ad1',
      'Expe_Ad2',
      'Expe_Ad3',
      'Expe_Ad4',
      'Expe_Ville',
      'Expe_CP',
      'Expe_Pays',
      'Expe_Tel1',
      'Expe_Tel2',
      'Expe_Mail',
      'Dest_Langage',
      'Dest_Ad1',
      'Dest_Ad2',
      'Dest_Ad3',
      'Dest_Ad4',
      'Dest_Ville',
      'Dest_CP',
      'Dest_Pays',
      'Dest_Tel1',
      'Dest_Tel2',
      'Dest_Mail',
      'Poids',
      'Longueur',
      'Taille',
      'NbColis',
      'CRT_Valeur',
      'CRT_Devise',
      'Exp_Valeur',
      'Exp_Devise',
      'COL_Rel_Pays',
      'COL_Rel',
      'LIV_Rel_Pays',
      'LIV_Rel',
      'TAvisage',
      'TReprise',
      'Montage',
      'TRDV',
      'Assurance',
      'Instructions',
    ];
    const fields = Object.fromEntries(
      keys.map((key, index) => [key, values[index]]),
    );
    const result = await soapCall(config.apiUrl, 'WSI2_CreationEtiquette', {
      ...fields,
      Security: mondialRelaySecurity(values, config.privateKey),
      Texte: '',
    });
    status(result);
    const providerShipmentId = text(result.ExpeditionNum);
    const labelUrl = text(result.URL_Etiquette);
    if (!/^\d+$/.test(providerShipmentId) || !/^https:\/\//i.test(labelUrl))
      throw new MondialRelayError(
        'Mondial Relay n’a pas retourné une expédition complète.',
        'INVALID_RESPONSE',
      );
    return {
      providerShipmentId,
      trackingNumber: providerShipmentId,
      labelUrl,
      trackingUrl: 'https://www.mondialrelay.fr/suivi-de-colis/',
    };
  }

  async getTracking(providerShipmentId: string): Promise<ShipmentTracking> {
    const config = getMondialRelayConfig();
    const values = [config.brandCode, providerShipmentId, 'FR'] as const;
    const result = await soapCall(
      config.apiUrl,
      'WSI2_TracingColisDetaille',
      {
        Enseigne: values[0],
        Expedition: values[1],
        Langue: values[2],
        Security: mondialRelaySecurity(values, config.privateKey),
      },
      { retryRead: true },
    );
    status(result);
    const tracing = result.Tracing as Record<string, unknown> | undefined;
    const events: ProviderTrackingEvent[] = list(
      tracing?.ret_WSI2_sub_TracingColisDetaille,
    )
      .filter((row): row is Record<string, unknown> =>
        Boolean(row && typeof row === 'object'),
      )
      .map((row) => {
        const label = text(row.Libelle);
        const occurredAt = frenchTrackingDate(text(row.Date), text(row.Heure));
        const location = text(row.Emplacement) || null;
        return {
          label,
          location,
          occurredAt,
          providerKey: createHash('sha256')
            .update(
              `${label}|${text(row.Date)}|${text(row.Heure)}|${location ?? ''}`,
            )
            .digest('hex'),
        };
      })
      .filter((event) => event.label);
    return {
      summary: text(result.Libelle01) || text(result.Libelle02),
      events,
    };
  }
}
