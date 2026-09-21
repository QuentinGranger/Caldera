import 'server-only';
import { XMLParser } from 'fast-xml-parser';
import { MondialRelayError } from './errors';

const namespace = 'http://www.mondialrelay.fr/webservice/';
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

const escapeXml = (value: string | number) =>
  String(value).replace(
    /[<>&'\"]/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[char]!,
  );

export async function soapCall(
  apiUrl: string,
  operation: string,
  fields: Record<string, string | number>,
  options: { retryRead?: boolean } = {},
): Promise<Record<string, unknown>> {
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${operation} xmlns="${namespace}">${Object.entries(
    fields,
  )
    .map(([key, field]) => `<${key}>${escapeXml(field)}</${key}>`)
    .join('')}</${operation}></soap:Body></soap:Envelope>`;
  const attempts = options.retryRead ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `"${namespace}${operation}"`,
        },
        body,
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok)
        throw new MondialRelayError(
          'Le service Mondial Relay ne répond pas correctement.',
          `HTTP_${response.status}`,
          response.status >= 500,
        );
      const xml = await response.text();
      const parsed = parser.parse(xml) as Record<string, unknown>;
      const envelope = parsed.Envelope as Record<string, unknown> | undefined;
      const soapBody = envelope?.Body as Record<string, unknown> | undefined;
      const fault = soapBody?.Fault as Record<string, unknown> | undefined;
      if (fault)
        throw new MondialRelayError(
          'Mondial Relay a refusé la requête.',
          String(fault.faultcode ?? 'SOAP_FAULT'),
        );
      const responseNode = soapBody?.[`${operation}Response`] as
        Record<string, unknown> | undefined;
      const result = responseNode?.[`${operation}Result`];
      if (!result || typeof result !== 'object')
        throw new MondialRelayError(
          'La réponse Mondial Relay est incomplète.',
          'INVALID_RESPONSE',
        );
      return result as Record<string, unknown>;
    } catch (error) {
      const normalized =
        error instanceof MondialRelayError
          ? error
          : new MondialRelayError(
              error instanceof Error && error.name === 'AbortError'
                ? 'Le service Mondial Relay met trop de temps à répondre.'
                : 'Le service Mondial Relay est momentanément inaccessible.',
              error instanceof Error && error.name === 'AbortError'
                ? 'TIMEOUT'
                : 'NETWORK_ERROR',
              true,
            );
      if (attempt + 1 >= attempts || !normalized.retryable) throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new MondialRelayError('Service indisponible.', 'UNAVAILABLE');
}
