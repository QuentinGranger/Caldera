import test from 'node:test';
import assert from 'node:assert/strict';
import { mondialRelaySecurity } from '@/lib/shipping/providers/mondialRelay/security';
import { MondialRelayProvider } from '@/lib/shipping/providers/mondialRelay/provider';

test('la signature Mondial Relay est un MD5 majuscule des valeurs ordonnées et de la clé', () => {
  assert.equal(
    mondialRelaySecurity(['BDTEST13', 'FR', '59000'], 'PrivateKey'),
    '16EDF2B2B6EBEE626EF02B4A0DA28D7A',
  );
});

test('la recherche parse un Point Relais sans exposer la clé privée', async () => {
  const before = { ...process.env };
  Object.assign(process.env, {
    MONDIAL_RELAY_ENABLED: 'true',
    MONDIAL_RELAY_BRAND_CODE: 'BDTEST13',
    MONDIAL_RELAY_PRIVATE_KEY: 'PrivateKey',
    MONDIAL_RELAY_API_URL: 'https://api.mondialrelay.com/web_services.asmx',
    MONDIAL_RELAY_COLLECTION_MODE: 'TEST-COL',
    MONDIAL_RELAY_DELIVERY_MODE: 'TEST-LIV',
    MONDIAL_RELAY_SENDER_NAME: 'Caldera',
    MONDIAL_RELAY_SENDER_ADDRESS1: '1 rue Test',
    MONDIAL_RELAY_SENDER_POSTAL_CODE: '59000',
    MONDIAL_RELAY_SENDER_CITY: 'Lille',
    MONDIAL_RELAY_SENDER_COUNTRY: 'FR',
    MONDIAL_RELAY_SENDER_PHONE: '0600000000',
    MONDIAL_RELAY_SENDER_EMAIL: 'test@example.test',
  });
  let requestBody = '';
  const originalFetch = global.fetch;
  global.fetch = async (_input, init) => {
    requestBody = String(init?.body ?? '');
    return new Response(
      `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><WSI4_PointRelais_RechercheResponse xmlns="http://www.mondialrelay.fr/webservice/"><WSI4_PointRelais_RechercheResult><STAT>0</STAT><PointsRelais><PointRelais_Details><Num>012345</Num><LgAdr1>LIBRAIRIE TEST</LgAdr1><LgAdr3>2 RUE DES CARTES</LgAdr3><CP>59000</CP><Ville>LILLE</Ville><Pays>FR</Pays><Latitude>50,6292</Latitude><Longitude>3,0573</Longitude><Distance>420</Distance><TypeActivite>Commerce</TypeActivite></PointRelais_Details></PointsRelais></WSI4_PointRelais_RechercheResult></WSI4_PointRelais_RechercheResponse></soap:Body></soap:Envelope>`,
      { status: 200, headers: { 'content-type': 'text/xml' } },
    );
  };
  try {
    const result = await new MondialRelayProvider().searchPickupPoints({
      countryCode: 'FR',
      postalCode: '59000',
    });
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, '012345');
    assert.equal(result[0]?.distanceM, 420);
    assert.equal(result[0]?.latitude, 50.6292);
    assert.doesNotMatch(requestBody, /PrivateKey/);
    assert.match(requestBody, /<Security>[A-F0-9]{32}<\/Security>/);
  } finally {
    global.fetch = originalFetch;
    process.env = before;
  }
});

test('une panne fournisseur remonte une erreur contrôlée après les lectures limitées', async () => {
  const originalFetch = global.fetch;
  const enabled = process.env.MONDIAL_RELAY_ENABLED;
  process.env.MONDIAL_RELAY_ENABLED = 'false';
  try {
    await assert.rejects(
      () =>
        new MondialRelayProvider().searchPickupPoints({
          countryCode: 'FR',
          postalCode: '59000',
        }),
      /temporairement indisponible/,
    );
  } finally {
    global.fetch = originalFetch;
    if (enabled === undefined) delete process.env.MONDIAL_RELAY_ENABLED;
    else process.env.MONDIAL_RELAY_ENABLED = enabled;
  }
});
