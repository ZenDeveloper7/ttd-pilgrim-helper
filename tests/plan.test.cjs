const assert = require('node:assert/strict');
const plan = require('../plan.js');

assert.equal(plan.TEMPLE, 'Srivari Temple - Tirumala');
assert.equal(plan.parseIstDateTime('2026-09-25T10:00'), Date.parse('2026-09-25T04:30:00Z'));
assert.throws(() => plan.parseIstDateTime('2026-02-30T10:00'), /invalid/);
assert.throws(() => plan.parseIstDateTime('2026-09-25T25:00'), /invalid/);

const input = {
  sevaMode: 'any', bookingDate: '2026-10-10', releaseIst: '2026-09-25T10:00',
  bookingUrl: plan.DEFAULT_BOOKING_URL, listId: 'default'
};
const beforeRelease = Date.parse('2026-09-25T04:00:00Z');
assert.throws(() => plan.preparePlan(input, Date.parse('2026-09-25T05:00:00Z')), /future/);
const prepared = plan.preparePlan(input, beforeRelease);
assert.equal(prepared.openAt, Date.parse('2026-09-25T04:30:00Z'));
assert.equal(prepared.sevaMode, 'any');
assert.equal(prepared.status, 'armed');
assert.throws(() => plan.preparePlan({ ...input, bookingDate: '2026-02-30' }, 0), /visit date/);
assert.throws(() => plan.preparePlan({ ...input,
  bookingUrl: 'https://ttdevasthanams.ap.gov.in/arjitha-seva/slot-booking?templeName=Sapthagiri%20Gau%20Pradakshina%20Shala'
}, beforeRelease), /fixed/);
assert.throws(() => plan.preparePlan({ ...input,
  bookingUrl: 'https://ttdevasthanams.ap.gov.in/arjitha-seva/slot-booking?sevaName=Sri%20Srinivasa%20Divyaanugraha%20Homam'
}, beforeRelease), /Remove sevaName/);
assert.throws(() => plan.preparePlan({ ...input,
  bookingUrl: 'https://evil.example/arjitha-seva/slot-booking'
}, beforeRelease), /official/);
console.log('IST timing, fixed temple, any-seva URL, and sample-as-past validation passed');
