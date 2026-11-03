/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const firebase = require('../database/firebase');
const data = require('../services/firebase-data.service');

describe('firebase-data.service', () => {
  beforeEach(() => {
    firebase.__reset();
  });

  describe('isValidDocId', () => {
    test.each([
      ['STU20250001', true],
      ['a_b-c', true],
      [12345, true],
      ['', false],
      [null, false],
      [undefined, false],
      ['a/b', false],
      ['.', false],
      ['..', false],
      ['__reserved__', false]
    ])('%p -> %p', (id, expected) => {
      expect(data.isValidDocId(id)).toBe(expected);
    });
  });

  describe('planPushdown', () => {
    test('pushes equality, in and array-contains filters', () => {
      const plan = data.planPushdown([
        { field: 'student_id', value: 'S1' },
        { field: 'status', op: 'in', value: ['present', 'late'] },
        { field: 'tags', op: 'array-contains', value: 'x' }
      ]);
      expect(plan).toHaveLength(3);
    });

    test('keeps ranges, contains and != in memory', () => {
      const plan = data.planPushdown([
        { field: 'created_at', op: '>=', value: '2025-01-01' },
        { field: 'name', op: 'contains', value: 'a' },
        { field: 'status', op: '!=', value: 'x' }
      ]);
      expect(plan).toHaveLength(0);
    });

    test('does not push undefined values or in-lists above the Firestore limit', () => {
      const tooMany = Array.from({ length: 31 }, (_, index) => `id${index}`);
      expect(data.planPushdown([
        { field: 'department', value: undefined },
        { field: 'subject', op: 'in', value: tooMany }
      ])).toHaveLength(0);
    });

    test('drops invalid ids from an id-in filter', () => {
      const [filter] = data.planPushdown([{ field: 'id', op: 'in', value: ['ok', 'a/b', ''] }]);
      expect(filter.value).toEqual(['ok']);
    });
  });

  describe('listRecords', () => {
    beforeEach(() => {
      firebase.__seed('attendance', 'a1', { student_id: 'S1', subject: 'Math', status: 'present' });
      firebase.__seed('attendance', 'a2', { student_id: 'S1', subject: 'Phys', status: 'absent' });
      firebase.__seed('attendance', 'a3', { student_id: 'S2', subject: 'Math', status: 'present' });
      firebase.__seed('attendance', 'a4', { student_id: 'S3', subject: 'Math', status: 'late' });
    });

    test('reads only the matching documents instead of the whole collection', async () => {
      const rows = await data.listRecords('attendance', { filters: [{ field: 'student_id', value: 'S1' }] });

      expect(rows.map((row) => row.id).sort()).toEqual(['a1', 'a2']);
      expect(firebase.__stats.documentsRead).toBe(2); // would be 4 with a full scan
    });

    test('combines pushed-down and in-memory filters', async () => {
      const rows = await data.listRecords('attendance', {
        filters: [
          { field: 'subject', value: 'Math' },
          { field: 'status', op: '!=', value: 'late' }
        ]
      });
      expect(rows.map((row) => row.id).sort()).toEqual(['a1', 'a3']);
    });

    test('id-in lookups use document ids, including documents without an id field', async () => {
      firebase.__seed('users', 'U1', { name: 'One' });
      firebase.__seed('users', 'U2', { name: 'Two' });
      firebase.__seed('users', 'U3', { name: 'Three' });

      const rows = await data.listRecords('users', { filters: [{ field: 'id', op: 'in', value: ['U1', 'U3', 'nope'] }] });
      expect(rows.map((row) => row.name).sort()).toEqual(['One', 'Three']);
    });

    test('an id filter that can never be a document id returns nothing without reading', async () => {
      const rows = await data.listRecords('attendance', { filters: [{ field: 'id', value: 'a/b' }] });
      expect(rows).toEqual([]);
      expect(firebase.__stats.queries).toBe(0);
    });

    test('orders and limits in memory', async () => {
      firebase.__seed('marks', 'm1', { score: 5 });
      firebase.__seed('marks', 'm2', { score: 9 });
      firebase.__seed('marks', 'm3', { score: 7 });

      const rows = await data.listRecords('marks', { orderBy: [{ field: 'score', direction: 'desc' }], limit: 2 });
      expect(rows.map((row) => row.score)).toEqual([9, 7]);
    });

    test('falls back to a scan when the pushed-down query fails (e.g. missing index)', async () => {
      const original = firebase.db.collection;
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      let first = true;
      firebase.db.collection = (name) => {
        const collection = original(name);
        if (!first) return collection;
        first = false;
        return { ...collection, where: () => ({ get: async () => { throw new Error('FAILED_PRECONDITION: index required'); } }) };
      };

      try {
        const rows = await data.listRecords('attendance', { filters: [{ field: 'student_id', value: 'S2' }] });
        expect(rows.map((row) => row.id)).toEqual(['a3']);
      } finally {
        firebase.db.collection = original;
        warn.mockRestore();
      }
    });
  });

  describe('countRecords', () => {
    test('uses the server-side aggregation when every filter can be pushed down', async () => {
      firebase.__seed('users', 'a', { role: 'student' });
      firebase.__seed('users', 'b', { role: 'student' });
      firebase.__seed('users', 'c', { role: 'admin' });

      expect(await data.countRecords('users', { filters: [{ field: 'role', value: 'student' }] })).toBe(2);
      expect(firebase.__stats.documentsRead).toBe(0); // counted without downloading documents
    });

    test('counts in memory when a filter cannot be pushed down', async () => {
      firebase.__seed('users', 'a', { name: 'Alpha' });
      firebase.__seed('users', 'b', { name: 'Beta' });

      expect(await data.countRecords('users', { filters: [{ field: 'name', op: 'contains', value: 'alp' }] })).toBe(1);
    });
  });

  describe('getRecord', () => {
    test('returns null for ids Firestore cannot address instead of throwing', async () => {
      await expect(data.getRecord('users', 'a/b')).resolves.toBeNull();
      await expect(data.getRecord('users', '')).resolves.toBeNull();
      await expect(data.getRecord('users', undefined)).resolves.toBeNull();
    });

    test('returns the record with its id', async () => {
      firebase.__seed('users', 'U1', { name: 'One' });
      await expect(data.getRecord('users', 'U1')).resolves.toMatchObject({ id: 'U1', name: 'One' });
    });
  });

  describe('writes', () => {
    test('createRecord with exclusive refuses to overwrite', async () => {
      await data.createRecord('users', { name: 'First' }, { id: 'U1', exclusive: true });

      await expect(data.createRecord('users', { name: 'Second' }, { id: 'U1', exclusive: true }))
        .rejects.toMatchObject({ code: 6 });
      expect(firebase.__read('users', 'U1').name).toBe('First');
    });

    test('createRecord rejects an id that cannot be a document id', async () => {
      await expect(data.createRecord('users', {}, { id: 'a/b' })).rejects.toMatchObject({ statusCode: 400 });
    });

    test('updateRecord never wipes a field the caller did not provide', async () => {
      await data.createRecord('users', { name: 'Asha', phone_number: '12345' }, { id: 'U1' });

      await data.updateRecord('users', 'U1', { name: 'Asha K', phone_number: undefined });

      expect(firebase.__read('users', 'U1')).toMatchObject({ name: 'Asha K', phone_number: '12345' });
    });

    test('updateRecord can still clear a field explicitly with null', async () => {
      await data.createRecord('users', { name: 'Asha', phone_number: '12345' }, { id: 'U1' });
      await data.updateRecord('users', 'U1', { phone_number: null });
      expect(firebase.__read('users', 'U1').phone_number).toBeNull();
    });

    test('deleteRecord removes the record and ignores invalid ids', async () => {
      await data.createRecord('users', { name: 'X' }, { id: 'U1' });
      await data.deleteRecord('users', 'U1');
      await data.deleteRecord('users', 'a/b');
      expect(firebase.__read('users', 'U1')).toBeUndefined();
    });
  });
});
