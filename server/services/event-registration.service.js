/**
 * Event registration with real capacity enforcement.
 *
 * The previous check-then-create flow let two students take the last seat at
 * the same time (and let one student register twice). Registration now runs in
 * a Firestore transaction that, atomically:
 *   1. rejects a second registration by the same user,
 *   2. enforces `max_participants`, and
 *   3. keeps `events.registration_count` exact.
 *
 * Registration documents use the deterministic id `${eventId}_${userId}` so the
 * database itself refuses duplicates; legacy rows with random ids are found by
 * query inside the same transaction.
 */

const { db } = require('../database/firebase');
const { isValidDocId } = require('./firebase-data.service');

const EVENTS = 'events';
const REGISTRATIONS = 'event_registrations';

function registrationId(eventId, userId) {
  return `${eventId}_${userId}`;
}

function assertIds(eventId, userId) {
  if (!isValidDocId(eventId) || !isValidDocId(userId)) {
    const error = new Error('Invalid event or user id');
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Registration rows for (event, user), including legacy random-id rows.
 */
async function findUserRegistrations(tx, eventId, userId) {
  const deterministicRef = db.collection(REGISTRATIONS).doc(registrationId(eventId, userId));
  const legacyQuery = db.collection(REGISTRATIONS)
    .where('event_id', '==', eventId)
    .where('user_id', '==', userId);

  const [deterministic, legacy] = await Promise.all([tx.get(deterministicRef), tx.get(legacyQuery)]);

  const refs = [];
  if (deterministic.exists) refs.push(deterministicRef);
  legacy.docs.forEach((doc) => {
    if (doc.id !== deterministicRef.id) refs.push(doc.ref);
  });
  return { refs, deterministicRef };
}

/**
 * Trustworthy seat count for an event inside a transaction. The stored counter
 * is used when present; legacy events without one are counted from the rows.
 */
async function currentCount(tx, eventId, event) {
  if (Number.isFinite(Number(event.registration_count))) {
    return Number(event.registration_count);
  }
  const rows = await tx.get(db.collection(REGISTRATIONS).where('event_id', '==', eventId));
  return rows.size;
}

/**
 * @returns {Promise<{status: 'registered'|'already'|'full'|'closed'|'not_found', count?: number}>}
 */
async function registerForEvent(eventId, userId, now = Date.now()) {
  assertIds(eventId, userId);
  const eventRef = db.collection(EVENTS).doc(String(eventId));

  return db.runTransaction(async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists || eventSnap.data().is_active === false) {
      return { status: 'not_found' };
    }
    const event = eventSnap.data();

    const { refs, deterministicRef } = await findUserRegistrations(tx, String(eventId), String(userId));
    const count = await currentCount(tx, String(eventId), event);

    if (refs.length > 0) {
      return { status: 'already', count };
    }

    const deadline = Date.parse(event.registration_deadline || '');
    if (Number.isFinite(deadline) && deadline < now) {
      return { status: 'closed', count };
    }

    const capacity = Number(event.max_participants);
    if (event.max_participants !== null && event.max_participants !== undefined
      && Number.isFinite(capacity) && count >= capacity) {
      return { status: 'full', count };
    }

    tx.set(deterministicRef, {
      id: deterministicRef.id,
      event_id: String(eventId),
      user_id: String(userId),
      registered_at: new Date(now).toISOString(),
      created_at: new Date(now).toISOString()
    });
    tx.update(eventRef, { registration_count: count + 1 });

    return { status: 'registered', count: count + 1 };
  });
}

/**
 * @returns {Promise<{status: 'cancelled'|'not_registered'|'not_found', count?: number}>}
 */
async function cancelRegistration(eventId, userId) {
  assertIds(eventId, userId);
  const eventRef = db.collection(EVENTS).doc(String(eventId));

  return db.runTransaction(async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists) {
      return { status: 'not_found' };
    }
    const event = eventSnap.data();

    const { refs } = await findUserRegistrations(tx, String(eventId), String(userId));
    const count = await currentCount(tx, String(eventId), event);

    if (refs.length === 0) {
      return { status: 'not_registered', count };
    }

    refs.forEach((ref) => tx.delete(ref));
    const next = Math.max(0, count - refs.length);
    tx.update(eventRef, { registration_count: next });

    return { status: 'cancelled', count: next };
  });
}

module.exports = {
  registrationId,
  registerForEvent,
  cancelRegistration
};
