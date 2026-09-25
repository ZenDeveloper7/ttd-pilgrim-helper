const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TTDPlan = require('../plan.js');

const now = Date.parse('2026-09-25T04:00:00Z');
const stored = { ttdPilgrimHelperV1: { lists: [{ id: 'default', people: [{ name: 'Test Pilgrim', age: '30', gender: 'Female', idNumber: '0000' }] }] } };
const alarms = new Map();
const tabs = [];
const listeners = {};
const api = {
  runtime: { lastError: null, onMessage: { addListener(fn) { listeners.message = fn; } },
    onStartup: { addListener(fn) { listeners.startup = fn; } }, onInstalled: { addListener(fn) { listeners.installed = fn; } } },
  storage: { local: {
    get(key, callback) { callback({ [key]: stored[key] }); },
    set(value, callback) { Object.assign(stored, value); callback(); }
  } },
  alarms: {
    clear(name) { alarms.delete(name); return Promise.resolve(true); },
    create(name, options) { alarms.set(name, options.when); return Promise.resolve(); },
    onAlarm: { addListener(fn) { listeners.alarm = fn; } }
  },
  tabs: {
    create(options, callback) { const tab = { id: 1, url: options.url }; tabs.push(tab); callback(tab); },
    get(id, callback) { callback(tabs.find(tab => tab.id === id)); },
    sendMessage(_id, _message, callback) { callback({ status: 'stopped', message: 'Synthetic form complete.' }); },
    onUpdated: { addListener(fn) { listeners.tabUpdated = fn; } }
  }
};
const context = { chrome: api, TTDPlan: { ...TTDPlan, preparePlan(input) { return TTDPlan.preparePlan(input, clock); } }, Date: class extends Date { static now() { return clock; } } };
let clock = now;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8'), context);
const message = (payload) => new Promise(resolve => listeners.message(payload, {}, resolve));

(async () => {
  const saved = await message({ type: 'PLAN_SAVE', plan: {
    sevaMode: 'any', bookingDate: '2026-10-10', releaseIst: '2026-09-25T10:00',
    bookingUrl: TTDPlan.DEFAULT_BOOKING_URL, listId: 'default'
  } });
  assert.equal(saved.ok, true);
  assert.equal(alarms.get('ttd-booking-open'), Date.parse('2026-09-25T04:30:00Z'));
  assert.equal(tabs.length, 0);
  clock = saved.plan.openAt;
  listeners.alarm({ name: 'ttd-booking-open' });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(tabs.length, 1);
  assert.equal(tabs[0].url, TTDPlan.DEFAULT_BOOKING_URL);
  assert.equal(stored.ttdBookingPlanV1.status, 'stopped');
  const cancelled = await message({ type: 'PLAN_CANCEL' });
  assert.equal(cancelled.ok, true);
  assert.equal(alarms.size, 0);
  console.log('Alarm arming, opening, handoff, and cancellation passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
