/**
 * Audit trail for privileged actions.
 *
 * Grades, attendance, accounts and moderation decisions are high-stakes: when a
 * student disputes a mark or an account is deactivated, "who did this, and
 * when?" needs an answer. Entries are written to the `activity_log`
 * collection that the admin Activity Log screen already reads.
 */

const { createRecord } = require('./firebase-data.service');

const COLLECTION = 'activity_log';

function clientIp(req) {
  return (req && (req.ip || req.connection?.remoteAddress)) || null;
}

/**
 * Record an audit entry. Never throws: failing to write the log must not fail
 * (or roll back the appearance of) the action being audited.
 *
 * @param {object} req  Express request (actor + ip are taken from it)
 * @param {{action:string, entityType:string, entityId?:string, summary?:string, metadata?:object}} entry
 * @returns {Promise<boolean>} whether the entry was stored
 */
async function recordAudit(req, entry) {
  try {
    const actor = req?.user || {};
    await createRecord(COLLECTION, {
      user_id: actor.id || null,
      actor_name: actor.name || null,
      actor_role: actor.role || null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId === undefined || entry.entityId === null ? null : String(entry.entityId),
      summary: entry.summary || null,
      metadata: entry.metadata || {},
      ip: clientIp(req)
    });
    return true;
  } catch (error) {
    console.error(`Audit log write failed (${entry && entry.action}):`, error.message);
    return false;
  }
}

module.exports = { recordAudit, COLLECTION };
