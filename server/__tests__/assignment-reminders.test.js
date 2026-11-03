/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const firebase = require('../database/firebase');
const reminders = require('../services/assignment-reminders.service');

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2025-06-10T12:00:00.000Z');
const at = (hours) => new Date(NOW + hours * HOUR).toISOString();

describe('assignment reminders', () => {
  beforeEach(() => {
    firebase.__reset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    firebase.__seed('users', 'S1', { role: 'student', department: 'CSE', year: 3 });
    firebase.__seed('users', 'S2', { role: 'student', department: 'CSE', year: 3 });
    firebase.__seed('users', 'S3', { role: 'student', department: 'CSE', year: '3' }); // legacy string year
    firebase.__seed('users', 'S4', { role: 'student', department: 'CSE', year: 2 });
    firebase.__seed('users', 'T1', { role: 'teacher', department: 'CSE', year: 3 });
  });

  afterEach(() => jest.restoreAllMocks());

  describe('selectDueSoon', () => {
    const base = { is_active: true };

    test('picks only active, unreminded assignments due inside the window', () => {
      const picked = reminders.selectDueSoon([
        { ...base, id: 'soon', deadline: at(10) },
        { ...base, id: 'later', deadline: at(30) },
        { ...base, id: 'past', deadline: at(-1) },
        { ...base, id: 'reminded', deadline: at(5), reminder_sent_at: at(-2) },
        { id: 'closed', deadline: at(5), is_active: false },
        { ...base, id: 'nodate' }
      ], { now: NOW, windowHours: 24 });

      expect(picked.map((item) => item.id)).toEqual(['soon']);
    });

    test('the window is configurable', () => {
      const rows = [{ ...base, id: 'later', deadline: at(30) }];
      expect(reminders.selectDueSoon(rows, { now: NOW, windowHours: 48 })).toHaveLength(1);
    });
  });

  describe('runDueSoonReminders', () => {
    test('reminds students who have not submitted, once, and marks the assignment', async () => {
      firebase.__seed('assignments', 'A1', { title: 'Lab 1', department: 'CSE', year: 3, deadline: at(10), is_active: true });
      firebase.__seed('assignment_submissions', 'sub1', { assignment_id: 'A1', student_id: 'S1', status: 'submitted' });

      const first = await reminders.runDueSoonReminders({ now: NOW });

      expect(first).toEqual({ assignments: 1, notified: 2, skipped: 1 });
      const recipients = firebase.__all('notifications').map((item) => item.user_id).sort();
      expect(recipients).toEqual(['S2', 'S3']); // S1 submitted, S4 is another year, T1 is a teacher
      expect(firebase.__all('notifications')[0].message).toMatch(/Lab 1.*10 hours/);
      expect(firebase.__read('assignments', 'A1').reminder_sent_at).toBeTruthy();

      const second = await reminders.runDueSoonReminders({ now: NOW });
      expect(second.assignments).toBe(0);
      expect(firebase.__all('notifications')).toHaveLength(2); // no duplicates
    });

    test('does nothing when nothing is due', async () => {
      firebase.__seed('assignments', 'A2', { title: 'Far', department: 'CSE', year: 3, deadline: at(100), is_active: true });
      await expect(reminders.runDueSoonReminders({ now: NOW })).resolves.toEqual({ assignments: 0, notified: 0, skipped: 0 });
    });
  });

  describe('startReminderScheduler', () => {
    afterEach(() => {
      delete process.env.ASSIGNMENT_REMINDER_INTERVAL_MINUTES;
      jest.useRealTimers();
    });

    test('a zero interval disables the timer', () => {
      process.env.ASSIGNMENT_REMINDER_INTERVAL_MINUTES = '0';
      const spy = jest.spyOn(global, 'setInterval');
      const stop = reminders.startReminderScheduler();
      expect(spy).not.toHaveBeenCalled();
      expect(typeof stop).toBe('function');
      spy.mockRestore();
    });

    test('runs on the configured interval and stops when asked', async () => {
      jest.useFakeTimers();
      process.env.ASSIGNMENT_REMINDER_INTERVAL_MINUTES = '5';
      firebase.__seed('assignments', 'A3', { title: 'Timer', department: 'CSE', year: 3, deadline: new Date(Date.now() + 2 * HOUR).toISOString(), is_active: true });

      const stop = reminders.startReminderScheduler();
      await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(firebase.__read('assignments', 'A3').reminder_sent_at).toBeTruthy();

      stop();
      firebase.__seed('assignments', 'A4', { title: 'After stop', department: 'CSE', year: 3, deadline: new Date(Date.now() + 2 * HOUR).toISOString(), is_active: true });
      await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
      expect(firebase.__read('assignments', 'A4').reminder_sent_at).toBeUndefined();
    });
  });
});
