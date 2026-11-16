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
 *     (like 6:00 PM or 6pm) before you set Confirmed.
 *  4. The day before each confirmed lesson the student gets a reminder email (weekly plans: every week).
 */

const SETTINGS = {
  spreadsheetId: '',                        // blank when the script is pasted into the Sheet itself; the Sheet's ID when it's a standalone project
  sheetName: 'Requests',
  businessName: 'Boston Drumming Co.',
  replyTo: 'Boston.drumming@icloud.com',   // students' replies go here
  calendarName: '',                         // blank = your main Google Calendar
  reminderMinutes: 60,                      // pop-up reminder before each lesson
  colourInPerson: 'GREEN',                  // calendar colours: GREEN, BLUE, RED, ORANGE, YELLOW, MAUVE, CYAN, GRAY,
  colourDigital: 'BLUE',                    //   PALE_GREEN, PALE_BLUE, PALE_RED
  siteUrl: 'https://hihiimheres.github.io/Chicago-drumline-prep/',
  reminderHour: 17,                         // reminder emails go out around this hour (24h clock) the day before
};

/* Student emails. To change the wording without touching code, edit the "Emails" tab in the Sheet
   (columns: Email | Subject | Body); a row there replaces the matching default below.
   Placeholders: {first} {lesson} {when} {time} {where} {price} {booking} {instrument} {lessonRef} {site} */
const EMAILS = {
  confirm: {
    subject: 'Lesson confirmed: {when}',
    body: "Hi {first},\n\nYou're booked!\n\n{lesson}\n{when}\n{where}\n{price}\n\nNeed to change or cancel? Just reply to this email. Cancel 24+ hours ahead for a full refund.\n\nBoston Drumming Co.\nBooking {booking}",
  },
  decline: {
    subject: 'About your lesson request',
    body: "Hi {first},\n\nThanks for reaching out! Unfortunately I can't make {when} work. You're welcome to pick another time: {site}\n\nBoston Drumming Co.",
  },
  reminder: {
    subject: 'Reminder: lesson tomorrow at {time}',
    body: "Hi {first},\n\nSee you tomorrow!\n\n{lesson}\n{when}\n{where}\n\nNeed to change something? Just reply to this email.\n\nBoston Drumming Co.",
  },
  cancel: {
    subject: 'Lesson cancelled: {when}',
    body: "Hi {first},\n\nYour {lessonRef} has been cancelled. Want to reschedule? Book anytime: {site}\n\nBoston Drumming Co.",
  },
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

function ss_() {
  return SETTINGS.spreadsheetId ? SpreadsheetApp.openById(SETTINGS.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
}

/* ---------------- One-time setup (run from the editor) ---------------- */
function setup() {
  const ss = ss_();
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
  ensureReminderTrigger_();
  console.log('All set. Now deploy as a web app (Deploy > New deployment > Web app).');
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

    const sheet = ss_().getSheetByName(SETTINGS.sheetName);
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
  if (!single) {
    // Pasting or filling many rows at once must not email a batch of students by accident
    for (let r = Math.max(2, e.range.getRow()); r <= e.range.getLastRow(); r++) {
      sheet.getRange(r, head['Last action'] + 1).setValue(stamp_() + ' · Nothing sent: change one row at a time to update the calendar and email the student');
    }
    return;
  }
  if (e.range.getRow() < 2) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // one change at a time, so a double tap can't book twice
  try {
    act_(sheet, head, e.range.getRow(), String(sheet.getRange(e.range.getRow(), col).getValue()), String(e.oldValue || ''));
  } finally {
    lock.releaseLock();
  }
  try { ensureReminderTrigger_(); } catch (_) { /* tried again next edit */ }
}

function stamp_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, h:mm a'); }

function act_(sheet, head, r, status, oldStatus) {
  const get = (c) => String(sheet.getRange(r, head[c] + 1).getValue());
  const note = (t) => sheet.getRange(r, head['Last action'] + 1).setValue(stamp_() + ' · ' + t);
  if (status === oldStatus) return;
  const info = {
    name: get('Name'), instrument: get('Instrument'), format: get('Format'), lesson: get('Lesson'), price: get('Price'),
    address: get('Address'), phone: get('Phone'), email: get('Email'), notes: get('Notes'), payment: get('Payment'),
    plan: get('Plan'), id: get('Booking ID'), travel: get('Travel'), guardian: get('Guardian'), date: get('Date'),
  };
  try {
    if (status === 'Confirmed') {
      if (get('Event ID')) {
        if (eventExists_(get('Event ID'))) return note('Already on your calendar');
        sheet.getRange(r, head['Event ID'] + 1).setValue(''); // it was deleted from the calendar: book it again
      }
      const when = whenFor_(get('Date'), get('Final time') || get('Time'));
      if (!when) {
        sheet.getRange(r, head['Status'] + 1).setValue('Contacted');
        note('Type the agreed time in "Final time" (like 6:00 PM or 6pm), then set Confirmed again');
        ss_().toast('Add a "Final time" first, then confirm again.', 'Need a time', 8);
        return;
      }
      const minutes = lessonMinutes_(info.lesson);
      const ev = createEvent_(info, when, minutes);
      sheet.getRange(r, head['Event ID'] + 1).setValue(ev);
      if (info.email) {
        sendTemplate_('confirm', info.email, vars_(info, when));
        note('Confirmed: on your calendar, email sent');
      } else {
        note('Confirmed: on your calendar. No email on file, so contact them by phone: ' + info.phone);
      }
    } else if (status === 'Declined') {
      removeEvent_(sheet, head, r);
      if (info.email) { sendTemplate_('decline', info.email, vars_(info, whenFor_(info.date, get('Final time') || get('Time')))); note('Declined: email sent'); }
      else note('Declined: no email on file');
    } else if (status === 'Cancelled') {
      const wasBooked = removeEvent_(sheet, head, r) || oldStatus === 'Confirmed';
      if (!wasBooked) note('Cancelled. No email sent because it was never confirmed (use Declined to tell the student)');
      else if (info.email) { sendTemplate_('cancel', info.email, vars_(info, whenFor_(info.date, get('Final time') || get('Time')))); note('Cancelled: removed from calendar, email sent'); }
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
  // Name first so it shows even in the small calendar views, e.g. "Alex Rivera · Snare 60m"
  const title = i.name + ' · ' + i.instrument + ' ' + minutes + 'm' + (i.plan ? ' · weekly' : '');
  const desc = [
    'Drum lesson · booking ' + i.id, i.format + ' · ' + i.lesson + ' · ' + i.price + (i.payment ? ' · ' + i.payment : ''),
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
  // Colour by type: in person vs video call
  try {
    const colour = /digital/i.test(i.format) ? SETTINGS.colourDigital : SETTINGS.colourInPerson;
    if (CalendarApp.EventColor[colour]) ev.setColor(CalendarApp.EventColor[colour]);
  } catch (_) { /* colour is a nice-to-have */ }
  return id;
}

// Removes the row's calendar event if it has one; returns true when there was one
function removeEvent_(sheet, head, r) {
  const cell = sheet.getRange(r, head['Event ID'] + 1);
  const id = String(cell.getValue());
  if (!id) return false;
  try {
    const cal = calendar_();
    if (id.indexOf('series:') === 0) cal.getEventSeriesById(id.slice(7)).deleteEventSeries();
    else cal.getEventById(id.slice(6)).deleteEvent();
  } catch (_) { /* already gone */ }
  cell.setValue('');
  return true;
}

// Is the saved calendar event still there? (false if it was deleted from the calendar)
function eventExists_(id) {
  try {
    const cal = calendar_();
    const ev = id.indexOf('series:') === 0 ? cal.getEventSeriesById(id.slice(7)) : cal.getEventById(id.slice(6));
    if (!ev) return false;
    ev.getTitle(); // throws if the event can't be read
    return true;
  } catch (_) {
    return false;
  }
}

/* ---------------- Emails ---------------- */
// Values for the email placeholders. `start` is the lesson Date, or null when no time is set yet.
function vars_(i, start) {
  const tz = Session.getScriptTimeZone();
  const minutes = lessonMinutes_(i.lesson);
  const digital = /digital/i.test(i.format);
  let when;
  if (start) {
    const time = Utilities.formatDate(start, tz, 'h:mm a');
    when = i.plan
      ? Utilities.formatDate(start, tz, 'EEEE') + 's at ' + time + ' (starting ' + Utilities.formatDate(start, tz, 'MMMM d') + ')'
      : Utilities.formatDate(start, tz, 'EEEE, MMMM d') + ' at ' + time;
  } else {
    const day = whenFor_(i.date, '12:00');
    when = day ? Utilities.formatDate(day, tz, 'EEEE, MMMM d') : i.date;
  }
  const fee = (/\$(\d+)/.exec(String(i.travel).split('·').pop()) || [])[1];
  const how = /lesson/i.test(i.payment) ? 'pay at the lesson' : i.plan ? 'billed monthly' : 'online payment';
  return {
    first: first_(i.name),
    instrument: i.instrument,
    lesson: i.instrument + ' · ' + minutes + ' min · ' + (digital ? 'video call' : 'in person'),
    when: when,
    time: start ? Utilities.formatDate(start, tz, 'h:mm a') : '',
    where: digital ? "I'll send the call link before we start." : i.address,
    price: i.price + (fee ? ' + $' + fee + ' travel' : '') + ' · ' + how,
    booking: i.id,
    lessonRef: i.plan ? 'weekly ' + i.instrument + ' lessons (' + when + ')' : i.instrument + ' lesson on ' + when,
    site: SETTINGS.siteUrl,
  };
}

// The "Emails" tab's row for this email if there is one, else the default above
function template_(key) {
  const t = EMAILS[key];
  try {
    const tab = ss_().getSheetByName('Emails');
    if (tab) {
      const rows = tab.getDataRange().getValues();
      for (let n = 0; n < rows.length; n++) {
        if (String(rows[n][0]).trim().toLowerCase() === key && String(rows[n][2]).trim()) {
          return { subject: String(rows[n][1]).trim() || t.subject, body: String(rows[n][2]) };
        }
      }
    }
  } catch (_) { /* fall back to the default */ }
  return t;
}

function fill_(text, vars) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function sendTemplate_(key, to, vars) {
  const t = template_(key);
  send_(to, fill_(t.subject, vars), fill_(t.body, vars));
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

// "2026-11-21" + a time ("6:00 PM", "6pm", "6:30 pm", "18:30") -> Date in the script's time zone, or null
function whenFor_(dateText, timeText) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText).trim());
  if (!d) return null;
  const t = String(timeText).trim().toLowerCase().replace(/\./g, '');
  let h, m;
  let x = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)$/.exec(t);
  if (x) {
    h = Number(x[1]); m = Number(x[2] || 0);
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (x[3][0] === 'p' ? 12 : 0);
  } else {
    x = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (!x) return null;
    h = Number(x[1]); m = Number(x[2]);
  }
  if (h > 23 || m > 59) return null;
  return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, m);
}

/* ---------------- Reminder emails (runs once a day) ---------------- */
function ensureReminderTrigger_() {
  if (ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === 'sendReminders')) return;
  ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(SETTINGS.reminderHour).create();
}

// Emails every student with a confirmed lesson tomorrow (weekly plans: tomorrow's weekly lesson)
function sendReminders() {
  const sheet = ss_().getSheetByName(SETTINGS.sheetName);
  const head = headers_(sheet);
  const last = sheet.getLastRow();
  if (last < 2) return;
  const tz = Session.getScriptTimeZone();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const day = Utilities.formatDate(tomorrow, tz, 'yyyy-MM-dd');
  const props = PropertiesService.getScriptProperties();
  const rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  rows.forEach((row, n) => {
    const get = (c) => String(row[head[c]]);
    if (get('Status') !== 'Confirmed' || !get('Email')) return;
    const info = {
      name: get('Name'), instrument: get('Instrument'), format: get('Format'), lesson: get('Lesson'), price: get('Price'),
      address: get('Address'), payment: get('Payment'), plan: get('Plan'), id: get('Booking ID'), travel: get('Travel'), date: get('Date'),
    };
    const first = whenFor_(info.date, get('Final time') || get('Time'));
    if (!first) return;
    let start;
    if (info.plan) {
      // weekly: same weekday and time as the first lesson, from the first lesson on
      if (info.date > day || Utilities.formatDate(first, tz, 'u') !== Utilities.formatDate(tomorrow, tz, 'u')) return;
      start = whenFor_(day, Utilities.formatDate(first, tz, 'HH:mm'));
    } else {
      if (info.date !== day) return;
      start = first;
    }
    const key = 'reminded:' + info.id + ':' + day;
    if (props.getProperty(key)) return; // already sent today
    sendTemplate_('reminder', get('Email'), vars_(Object.assign({}, info, { plan: '' }), start));
    props.setProperty(key, '1');
    sheet.getRange(n + 2, head['Last action'] + 1).setValue(stamp_() + ' · Reminder email sent for ' + day);
  });
}
