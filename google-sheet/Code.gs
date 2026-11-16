/**
 * Boston Drumming Co. — booking list, calendar and student emails
 * ----------------------------------------------------------------
 * Lives in a Google Sheet (Extensions > Apps Script). See SETUP.md in this folder.
 *
 *  1. The website sends every booking request here; it becomes a row (Status: New).
 *  2. Change the Status dropdown on a row:
 *       Confirmed -> lesson goes on your Google Calendar + the student gets a confirmation email
 *       Declined  -> the student gets a polite "can't fit this in" email
 *       Cancelled -> calendar event removed + student gets a cancellation email
 *       Contacted -> just a note to yourself (no email)
 *  3. If the student picked "flexible time", type the time you agree on in "Final time"
 *     (like 6:00 PM) before you set Confirmed.
 */

const SETTINGS = {
  sheetName: 'Requests',
  businessName: 'Boston Drumming Co.',
  replyTo: 'Boston.drumming@icloud.com',   // students' replies go here
  calendarName: '',                         // blank = your main Google Calendar
  reminderMinutes: 60,                      // pop-up reminder before each lesson
  digitalNote: 'This is a digital lesson (Zoom / FaceTime). I will send the link or call details before we start.',
  policyLine: 'Need to change something? Just reply to this email. Cancel at least 24 hours before your lesson for a full refund.',
  declineLine: 'Thank you for reaching out. Unfortunately I am not able to fit this request in. You are welcome to book another date and time on the site.',
};

const COLUMNS = [
  'Received', 'Booking ID', 'Status', 'Name', 'Email', 'Phone', 'Format', 'Lesson', 'Price', 'Plan',
  'Date', 'Time', 'Final time', 'Instrument', 'Address', 'Travel', 'Payment', 'Under 18', 'Guardian',
  'Notes', 'Replaces', 'Event ID', 'Last action',
];
const STATUSES = ['New', 'Contacted', 'Confirmed', 'Declined', 'Cancelled', 'Replaced'];
const STATUS_COLOURS = {
  New: '#fde68a', Contacted: '#bfdbfe', Confirmed: '#bbf7d0', Declined: '#fecaca', Cancelled: '#e5e7eb', Replaced: '#e5e7eb',
};

/* ---------------- One-time setup (run from the editor) ---------------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS.sheetName) || ss.insertSheet(SETTINGS.sheetName);
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold').setBackground('#111827').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  // Plain text everywhere, so nothing a student types can turn into a formula
  sheet.getRange(1, 1, sheet.getMaxRows(), COLUMNS.length).setNumberFormat('@');
  const status = COLUMNS.indexOf('Status') + 1;
  const statusCol = sheet.getRange(2, status, sheet.getMaxRows() - 1, 1);
  statusCol.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build());
  sheet.setConditionalFormatRules(Object.keys(STATUS_COLOURS).map((s) =>
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(STATUS_COLOURS[s]).setRanges([statusCol]).build()));
  sheet.setColumnWidths(1, COLUMNS.length, 120);
  sheet.setColumnWidth(COLUMNS.indexOf('Notes') + 1, 260);
  sheet.setColumnWidth(COLUMNS.indexOf('Last action') + 1, 260);
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'onStatusEdit').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(ss).onEdit().create();
  SpreadsheetApp.getUi().alert('All set. Now deploy as a web app (see SETUP.md, step 4).');
}

/* ---------------- Receives a request from the website ---------------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const d = JSON.parse(e.postData.contents);
    if (d._gotcha) return reply_('ignored');
    const id = clean_(d.booking_id, 30);
    if (!/^BD-\d{4}-[A-Z0-9]{3,6}$/.test(id)) return reply_('bad id');
    if (!clean_(d.name, 100) || !(clean_(d.email, 120) || clean_(d.phone, 40))) return reply_('missing details');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS.sheetName);
    const head = headers_(sheet);
    const last = sheet.getLastRow();
    if (last > 1) {
      const ids = sheet.getRange(2, head['Booking ID'] + 1, last - 1, 1).getValues().flat();
      if (ids.indexOf(id) !== -1) return reply_('duplicate');
    }

    const row = {
      'Received': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
      'Booking ID': id,
      'Status': 'New',
      'Name': clean_(d.name, 100),
      'Email': clean_(d.email, 120),
      'Phone': clean_(d.phone, 40),
      'Format': clean_(d.format, 60),
      'Lesson': clean_(d.length, 60),
      'Price': clean_(d.price, 30),
      'Plan': clean_(d.plan, 200),
      'Date': clean_(d.date, 10),
      'Time': clean_(d.time, 20),
      'Instrument': clean_(d.instrument, 30),
      'Address': clean_(d.address, 200),
      'Travel': [clean_(d.travel_miles, 40), clean_(d.travel_fee, 80)].filter(String).join(' · '),
      'Payment': clean_(d.payment, 40),
      'Under 18': clean_(d.under_18, 10),
      'Guardian': [clean_(d.guardian_name, 100), clean_(d.guardian_phone, 40)].filter(String).join(' · '),
      'Notes': clean_(d.notes, 2000),
      'Replaces': clean_(d.replaces_booking, 40).replace(/^#/, ''),
    };
    const values = COLUMNS.map((c) => (row[c] === undefined ? '' : row[c]));
    sheet.getRange(last + 1, 1, 1, COLUMNS.length).setNumberFormat('@').setValues([values]);

    // A correction replaces an earlier request: close that one out so it can't get confirmed too
    if (row['Replaces']) {
      const rows = sheet.getLastRow();
      const ids = sheet.getRange(2, head['Booking ID'] + 1, rows - 1, 1).getValues().flat();
      const i = ids.indexOf(row['Replaces']);
      if (i !== -1) {
        const r = i + 2;
        removeEvent_(sheet, head, r);
        sheet.getRange(r, head['Status'] + 1).setValue('Replaced');
        sheet.getRange(r, head['Last action'] + 1).setValue('Replaced by ' + id);
      }
    }
    return reply_('ok');
  } catch (err) {
    return reply_('error: ' + err);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ---------------- Reacts when you change Status (installable trigger) ---------------- */
function onStatusEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SETTINGS.sheetName) return;
  const head = headers_(sheet);
  const col = head['Status'] + 1;
  if (e.range.getColumn() > col || e.range.getLastColumn() < col) return;
  const single = e.range.getNumRows() === 1 && e.range.getNumColumns() === 1;
  for (let r = e.range.getRow(); r <= e.range.getLastRow(); r++) {
    if (r < 2) continue;
    const status = String(sheet.getRange(r, col).getValue());
    act_(sheet, head, r, status, single ? String(e.oldValue || '') : '');
  }
}

function act_(sheet, head, r, status, oldStatus) {
  const get = (c) => String(sheet.getRange(r, head[c] + 1).getValue());
  const note = (t) => sheet.getRange(r, head['Last action'] + 1).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, h:mm a') + ' · ' + t);
  if (status === oldStatus) return;
  try {
    if (status === 'Confirmed') {
      if (get('Event ID')) return note('Already on your calendar');
      const when = whenFor_(get('Date'), get('Final time') || get('Time'));
      if (!when) {
        sheet.getRange(r, head['Status'] + 1).setValue('Contacted');
        note('Type the agreed time in "Final time" (like 6:00 PM), then set Confirmed again');
        SpreadsheetApp.getActive().toast('Add a "Final time" first, then confirm again.', 'Need a time', 8);
        return;
      }
      const minutes = lessonMinutes_(get('Lesson'));
      const info = {
        name: get('Name'), instrument: get('Instrument'), format: get('Format'), lesson: get('Lesson'), price: get('Price'),
        address: get('Address'), phone: get('Phone'), email: get('Email'), notes: get('Notes'), payment: get('Payment'),
        plan: get('Plan'), id: get('Booking ID'), travel: get('Travel'), guardian: get('Guardian'),
      };
      const ev = createEvent_(info, when, minutes);
      sheet.getRange(r, head['Event ID'] + 1).setValue(ev);
      if (info.email) {
        send_(info.email, 'Your drum lesson is confirmed', confirmBody_(info, when, minutes));
        note('Confirmed: on your calendar, email sent');
      } else {
        note('Confirmed: on your calendar. No email on file, so contact them by phone: ' + info.phone);
      }
    } else if (status === 'Declined') {
      removeEvent_(sheet, head, r);
      const email = get('Email');
      if (email) { send_(email, 'About your drum lesson request', 'Hi ' + first_(get('Name')) + ',\n\n' + SETTINGS.declineLine + '\n\n' + SETTINGS.businessName); note('Declined: email sent'); }
      else note('Declined: no email on file');
    } else if (status === 'Cancelled') {
      removeEvent_(sheet, head, r);
      const email = get('Email');
      if (email) { send_(email, 'Your drum lesson was cancelled', 'Hi ' + first_(get('Name')) + ',\n\nYour lesson on ' + get('Date') + ' has been cancelled. If you would like to book another time, you can do that on the site.\n\n' + SETTINGS.businessName); note('Cancelled: removed from calendar, email sent'); }
      else note('Cancelled: removed from calendar, no email on file');
    }
  } catch (err) {
    note('Something went wrong: ' + err);
  }
}

/* ---------------- Calendar ---------------- */
function calendar_() {
  if (SETTINGS.calendarName) {
    const found = CalendarApp.getCalendarsByName(SETTINGS.calendarName)[0];
    if (found) return found;
  }
  return CalendarApp.getDefaultCalendar();
}

function createEvent_(i, when, minutes) {
  const start = when, end = new Date(start.getTime() + minutes * 60000);
  const title = 'Drum lesson: ' + i.name + ' (' + i.instrument + ', ' + minutes + ' min)' + (i.plan ? ' · weekly' : '');
  const desc = [
    'Booking ' + i.id, i.format + ' · ' + i.lesson + ' · ' + i.price + (i.payment ? ' · ' + i.payment : ''),
    i.travel && 'Travel: ' + i.travel, i.phone && 'Phone: ' + i.phone, i.email && 'Email: ' + i.email,
    i.guardian && 'Parent/guardian: ' + i.guardian, i.plan && i.plan, i.notes && 'Note: ' + i.notes,
  ].filter(Boolean).join('\n');
  const opts = { location: i.address || 'Digital (Zoom / FaceTime)', description: desc };
  const cal = calendar_();
  let ev, id;
  if (i.plan) {
    const series = cal.createEventSeries(title, start, end, CalendarApp.newRecurrence().addWeeklyRule(), opts);
    id = 'series:' + series.getId();
    ev = series;
  } else {
    ev = cal.createEvent(title, start, end, opts);
    id = 'event:' + ev.getId();
  }
  ev.addPopupReminder(SETTINGS.reminderMinutes);
  return id;
}

function removeEvent_(sheet, head, r) {
  const cell = sheet.getRange(r, head['Event ID'] + 1);
  const id = String(cell.getValue());
  if (!id) return;
  try {
    const cal = calendar_();
    if (id.indexOf('series:') === 0) cal.getEventSeriesById(id.slice(7)).deleteEventSeries();
    else cal.getEventById(id.slice(6)).deleteEvent();
  } catch (_) { /* already gone */ }
  cell.setValue('');
}

/* ---------------- Emails ---------------- */
function confirmBody_(i, start, minutes) {
  const tz = Session.getScriptTimeZone();
  const day = Utilities.formatDate(start, tz, 'EEEE, MMMM d');
  const time = Utilities.formatDate(start, tz, 'h:mm a');
  return [
    'Hi ' + first_(i.name) + ',', '',
    'Your lesson is confirmed!', '',
    'What: ' + i.instrument + ', ' + minutes + ' min (' + i.format + ')',
    'When: ' + day + ' at ' + time + (i.plan ? ' (repeats every week at this time)' : ''),
    'Where: ' + (i.address || SETTINGS.digitalNote),
    'Price: ' + i.price + (i.payment ? ' · ' + i.payment : ''),
    'Booking: ' + i.id, '',
    SETTINGS.policyLine, '',
    SETTINGS.businessName,
  ].join('\n');
}

function send_(to, subject, body) {
  MailApp.sendEmail({ to: to, subject: subject, body: body, name: SETTINGS.businessName, replyTo: SETTINGS.replyTo });
}

/* ---------------- Helpers ---------------- */
function reply_(msg) { return ContentService.createTextOutput(msg); }

function clean_(v, max) { return v == null ? '' : String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }

function first_(name) { return String(name).split(' ')[0] || 'there'; }

function headers_(sheet) {
  const row = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  row.forEach((h, i) => { map[String(h)] = i; });
  COLUMNS.forEach((c) => { if (!(c in map)) throw new Error('Missing column "' + c + '". Run setup() again.'); });
  return map;
}

// "60 min", "Weekly 30 min plan", "90 min (Audition Block)" -> minutes
function lessonMinutes_(lesson) {
  const m = /(\d+)\s*min/i.exec(lesson);
  return m ? Number(m[1]) : 60;
}

// "2026-11-21" + "6:00 PM" (or "18:00") -> Date in the script's time zone, or null
function whenFor_(dateText, timeText) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText).trim());
  const t = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/.exec(String(timeText).trim());
  if (!d || !t) return null;
  let h = Number(t[1]);
  const m = Number(t[2]);
  if (t[3]) { const pm = t[3].toLowerCase() === 'pm'; if (h < 1 || h > 12) return null; h = (h % 12) + (pm ? 12 : 0); }
  if (h > 23 || m > 59) return null;
  return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, m);
}
