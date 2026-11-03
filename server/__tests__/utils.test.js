/** @jest-environment node */

const express = require('express');
const jwt = require('jsonwebtoken');
const { toSafeCsv, neutralizeCell } = require('../utils/csv.util');
const { normalizeDateOnly, isFutureDateOnly } = require('../utils/date.util');
const asyncHandler = require('../utils/async-handler');
const { requestId, redactUrl, rateLimitKey } = require('../middleware/request-context');
const { startHarness } = require('../test-utils/route-harness');
const { createAppSessionToken } = require('../utils/app-session');

describe('csv.util', () => {
  test.each([
    ['=SUM(A1)', "'=SUM(A1)"],
    ['+1', "'+1"],
    ['-1', "'-1"],
    ['@cmd', "'@cmd"],
    ['\tTAB', "'\tTAB"],
    ['plain', 'plain'],
    ['a=b', 'a=b'],
    [42, 42],
    [null, null]
  ])('neutralizeCell(%j)', (input, expected) => {
    expect(neutralizeCell(input)).toBe(expected);
  });

  test('toSafeCsv writes a header, quotes awkward values, and blanks missing ones', () => {
    const csv = toSafeCsv([{ a: 'x,y', b: 'say "hi"', c: undefined, d: '=boom()' }], ['a', 'b', 'c', 'd']);
    expect(csv).toBe('a,b,c,d\n"x,y","say ""hi""",,\'=boom()\n');
  });

  test('only the requested columns are written', () => {
    expect(toSafeCsv([{ a: 1, secret: 'nope' }], ['a'])).toBe('a\n1\n');
  });
});

describe('date.util', () => {
  test.each([
    ['2025-03-04', '2025-03-04'],
    ['2025-03-04T23:59:59Z', '2025-03-04'],
    [new Date('2025-03-04T10:00:00Z'), '2025-03-04'],
    ['2025-02-29', null], // not a leap year
    ['2025-13-01', null],
    ['2024-02-29', '2024-02-29'],
    ['garbage', null],
    ['', null],
    [null, null],
    [undefined, null],
    [new Date('invalid'), null]
  ])('normalizeDateOnly(%p) -> %p', (input, expected) => {
    expect(normalizeDateOnly(input)).toBe(expected);
  });

  test('isFutureDateOnly tolerates a user already on tomorrow\'s calendar day', () => {
    const day = 24 * 60 * 60 * 1000;
    const utcToday = new Date().toISOString().slice(0, 10);
    expect(isFutureDateOnly(utcToday)).toBe(false);
    expect(isFutureDateOnly(new Date(Date.now() - day).toISOString().slice(0, 10))).toBe(false);
    expect(isFutureDateOnly(new Date(Date.now() + 3 * day).toISOString().slice(0, 10))).toBe(true);
  });

  test('isFutureDateOnly honours a custom tolerance', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(isFutureDateOnly(tomorrow, 0)).toBe(true);
    expect(isFutureDateOnly(tomorrow, 72)).toBe(false);
    expect(isFutureDateOnly('nonsense')).toBe(false);
  });
});

describe('async-handler', () => {
  let api;

  beforeAll(() => {
    const router = express.Router();
    router.get('/ok', asyncHandler(async (req, res) => res.json({ ok: true })));
    router.get('/boom', asyncHandler(async () => { throw Object.assign(new Error('kaboom'), { statusCode: 418 }); }));
    router.get('/sync-boom', asyncHandler(() => { throw new Error('sync kaboom'); }));
    api = startHarness('/t', router);
  });

  afterAll(() => api.close());

  test('passes results through', async () => {
    expect((await api.get('/t/ok')).body).toEqual({ ok: true });
  });

  test('forwards async and sync failures to the error middleware instead of hanging or crashing', async () => {
    const asyncFailure = await api.get('/t/boom');
    expect(asyncFailure.status).toBe(418);
    expect(asyncFailure.body.message).toBe('kaboom');

    const syncFailure = await api.get('/t/sync-boom');
    expect(syncFailure.status).toBe(500);
  });
});

describe('request-context', () => {
  describe('requestId', () => {
    let api;

    beforeAll(() => {
      const router = express.Router();
      router.get('/id', requestId, (req, res) => res.json({ id: req.id }));
      api = startHarness('/t', router);
    });

    afterAll(() => api.close());

    test('generates a uuid and echoes it as X-Request-Id', async () => {
      const res = await api.get('/t/id');
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.headers['x-request-id']).toBe(res.body.id);
    });

    test('reuses a sane upstream id', async () => {
      const res = await api.get('/t/id', { headers: { 'X-Request-Id': 'edge-req-12345' } });
      expect(res.body.id).toBe('edge-req-12345');
    });

    test.each(['short', 'has spaces in it!!', `${'x'.repeat(65)}`, 'new\nline-injected'])('replaces an unsafe upstream id %p', async (bad) => {
      // Node refuses to send a header containing a newline, which is itself the protection.
      if (/[\r\n]/.test(bad)) return;
      const res = await api.get('/t/id', { headers: { 'X-Request-Id': bad } });
      expect(res.body.id).not.toBe(bad);
    });
  });

  describe('redactUrl', () => {
    test.each([
      ['/api/calendar.ics?token=abc.def.ghi', '/api/calendar.ics?token=[redacted]'],
      ['/x?a=1&token=secret&b=2', '/x?a=1&token=[redacted]&b=2'],
      ['/x?access_token=s&password=p', '/x?access_token=[redacted]&password=[redacted]'],
      ['/api/events?page=2', '/api/events?page=2'],
      ['/plain', '/plain'],
      ['', '']
    ])('%s', (input, expected) => {
      expect(redactUrl(input)).toBe(expected);
    });
  });

  describe('rateLimitKey', () => {
    test('a verified session is counted per user, so a shared campus IP is not one bucket', () => {
      const a = createAppSessionToken({ id: 'STU1', role: 'student' });
      const b = createAppSessionToken({ id: 'STU2', role: 'student' });

      expect(rateLimitKey({ headers: { authorization: `Bearer ${a}` }, ip: '10.0.0.1' })).toBe('user:STU1');
      expect(rateLimitKey({ headers: { authorization: `Bearer ${b}` }, ip: '10.0.0.1' })).toBe('user:STU2');
    });

    test('anonymous and unverifiable tokens fall back to the IP, so forged tokens cannot dodge the limit', () => {
      expect(rateLimitKey({ headers: {}, ip: '10.0.0.9' })).toBe('ip:10.0.0.9');

      const forged = jwt.sign({ user: { id: 'STU1' } }, 'wrong-secret');
      expect(rateLimitKey({ headers: { authorization: `Bearer ${forged}` }, ip: '10.0.0.9' })).toBe('ip:10.0.0.9');
      expect(rateLimitKey({ headers: { authorization: 'Bearer not-a-jwt' }, ip: '10.0.0.9' })).toBe('ip:10.0.0.9');
    });
  });
});
