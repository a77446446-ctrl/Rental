const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadCalendar() {
  const source = fs.readFileSync(path.join(__dirname, '../public/js/calendar.js'), 'utf8');
  const context = {
    console,
    Date,
    window: {},
    EcoApi: {
      toDateString(date) {
        return [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, '0'),
          String(date.getDate()).padStart(2, '0'),
        ].join('-');
      },
    },
  };
  vm.runInNewContext(source, context, { filename: 'calendar.js' });
  return context.window.EcoCalendar;
}

function createCalendar(availabilityMap) {
  const EcoCalendar = loadCalendar();
  const calendar = Object.create(EcoCalendar.prototype);
  calendar.availabilityMap = availabilityMap;
  calendar.checkIn = null;
  calendar.checkOut = null;
  calendar.render = function () {};
  calendar.notifySelectionChange = function () {};
  return calendar;
}

test('a busy next day can be selected as checkout for one free night', () => {
  const calendar = createCalendar({
    '2030-07-23': { available: true, price: 8000 },
    '2030-07-24': { available: false, price: 8000 },
  });

  calendar.handleDayClick('2030-07-23');
  calendar.handleDayClick('2030-07-24');

  assert.equal(calendar.checkIn, '2030-07-23');
  assert.equal(calendar.checkOut, '2030-07-24');
});

test('a busy date cannot start a stay or jump over a busy night', () => {
  const calendar = createCalendar({
    '2030-07-23': { available: true, price: 8000 },
    '2030-07-24': { available: false, price: 8000 },
    '2030-07-25': { available: false, price: 8000 },
  });

  calendar.handleDayClick('2030-07-24');
  assert.equal(calendar.checkIn, null);

  calendar.handleDayClick('2030-07-23');
  calendar.handleDayClick('2030-07-25');

  assert.equal(calendar.checkIn, '2030-07-23');
  assert.equal(calendar.checkOut, null);
});
