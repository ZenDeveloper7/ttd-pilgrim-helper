const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let stage = 'slot';
let dateSelected = false;
let paid = false;
let listener;
const progress = [];

class Control {
  constructor(label, type = 'text') {
    this.labels = [{ textContent: label }]; this.type = type; this.value = '';
    this.disabled = false; this.readOnly = false; this.id = '';
  }
  getAttribute(name) { return name === 'name' ? '' : null; }
  getClientRects() { return [1]; }
  closest() { return null; }
  dispatchEvent() { if (this.type === 'date') dateSelected = true; return true; }
  click() { this.clicked = true; }
}
class Select extends Control {
  constructor(label, options) { super(label); this.options = options.map(value => ({ value, textContent: value, disabled: false })); }
  get selectedOptions() { return this.options.filter(option => option.value === this.value); }
}
class Textarea extends Control {}
const temple = new Select('Temple', ['Select', 'Srivari Temple - Tirumala']);
const seva = new Select('Seva', ['Select', 'Seva A', 'Seva B']);
const date = new Control('Visit date', 'date');
const fields = [new Control('Name'), new Control('Age'), new Select('Gender', ['Male', 'Female']), new Control('Aadhaar Number')];
const continueSlot = { textContent: 'Continue', disabled: false, getAttribute: () => null, getClientRects: () => [1], click() { if (dateSelected) stage = 'details'; } };
const continueDetails = { textContent: 'Continue', disabled: false, getAttribute: () => null, getClientRects: () => [1], click() { stage = 'payment'; } };
const payNow = { textContent: 'Pay Now', disabled: false, getAttribute: () => null, getClientRects: () => [1], click() { paid = true; } };
const document = {
  body: { innerText: '' }, documentElement: {},
  querySelectorAll(selector) {
    if (selector === 'input[type="date"]') return stage === 'slot' ? [date] : [];
    if (selector.startsWith('input:not')) return stage === 'slot' ? [temple, seva, date] : stage === 'details' ? fields : [];
    if (selector.startsWith('button')) return stage === 'slot' ? [continueSlot] : stage === 'details' ? [continueDetails] : [payNow];
    return [];
  }
};
const context = {
  chrome: { runtime: {
    lastError: null,
    onMessage: { addListener(fn) { listener = fn; } },
    sendMessage(message, callback) { progress.push(message); callback?.(); }
  } },
  document, location: { href: 'https://ttdevasthanams.ap.gov.in/arjitha-seva/slot-booking' },
  HTMLInputElement: Control, HTMLSelectElement: Select, HTMLTextAreaElement: Textarea,
  getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  Event: class {}, MutationObserver: class { observe() {} disconnect() {} }, setTimeout, clearTimeout
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8'), context);
const send = message => new Promise(resolve => listener(message, {}, resolve));

(async () => {
  const result = await send({ type: 'AUTO_BOOK', plan: {
    temple: 'Srivari Temple - Tirumala', sevaMode: 'any', bookingDate: '2026-10-10', dateConfirmed: false
  }, people: [{ name: 'Test Pilgrim', age: '30', gender: 'Female', idNumber: '0000' }] });
  assert.equal(result.status, 'payment_requested');
  assert.equal(temple.value, 'Srivari Temple - Tirumala');
  assert.equal(seva.value, 'Seva A');
  assert.equal(date.value, '2026-10-10');
  assert.equal(fields[0].value, 'Test Pilgrim');
  assert.equal(paid, true);
  assert.equal(progress.some(item => item.type === 'AUTO_PROGRESS' && item.dateConfirmed === true), true);
  console.log('Any-seva selection, visit date, pilgrim fill, and payment handoff passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
