# Booking sheet + calendar setup (about 10 minutes, once)

Every request from the site is saved as a row in a Google Sheet. You change a row's **Status** and the rest happens by itself.

| Status you pick | What happens |
|---|---|
| **New** | Set automatically when a request arrives. You still get the usual email too. |
| **Contacted** | A note to yourself. Nothing is sent. |
| **Confirmed** | Lesson is added to your Google Calendar and the student gets a confirmation email. Weekly plans become a repeating weekly event. |
| **Declined** | The student gets a polite "can't fit this in" email. |
| **Cancelled** | The calendar event is removed and the student is told. |
| **Replaced** | Set automatically when a student edits a request after sending it. |

If a student chose **flexible time**, type the time you agreed on in the **Final time** column (like `6:00 PM`) before you pick Confirmed.

## Steps (use a computer, signed in to the Google account whose calendar you want to use)

1. Go to https://sheets.new to make a blank Google Sheet. Name it "Boston Drumming bookings".
2. Click **Extensions > Apps Script**. Delete the sample code, paste in everything from `Code.gs` (this folder), and click **Save**.
3. Click the gear (**Project Settings**) and set the **Time zone** to *America/Chicago*.
4. In the editor, pick the function **setup** in the dropdown at the top and click **Run**. Google asks you to authorize the script (it is your own script): choose your account, then **Advanced > Go to project (unsafe) > Allow**. The sheet now has a "Requests" tab with headers and a Status dropdown.
5. Click **Deploy > New deployment**, the gear next to "Select type" > **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
6. Send that URL to Claude (or paste it into `sheetEndpoint` in `index.html`'s `CONFIG`). Do not share it publicly: anyone with it can add rows.

Test it: make a booking on the site. A row should appear within a few seconds. Set its Status to Confirmed and check your calendar and the student's inbox (use your own email for the test).

## On an iPad or phone

The Google Sheets app can't open Apps Script, so use Safari instead:

1. Open the Sheet in Safari (docs.google.com/spreadsheets, signed in), tap **aA** in the address bar, and choose **Request Desktop Website**.
2. Tap **Extensions > Apps Script**.
3. In another tab, open https://github.com/Hihiimheres/Chicago-drumline-prep/blob/main/google-sheet/Code.gs and tap the **Copy raw file** button (the two-squares icon above the code).
4. Back in Apps Script: tap in the code box, select all, paste, and tap **Save** (the disk icon).
5. Then continue from step 3 above (time zone, run `setup`, deploy as a web app, copy the web address).

You only need `setup` once. If the Sheet already has the Requests tab with headers, `setup` just re-applies the formatting and adds the Status trigger.

## Changing things later

- Wording of the emails, the reminder time, your reply-to address: the `SETTINGS` block at the top of `Code.gs`.
- After editing `Code.gs`: **Deploy > Manage deployments > pencil > Version: New version > Deploy**. The web address stays the same.
- Emails come from your Google account (free accounts can send about 100 a day, far more than you need).
- Don't rename or delete the header cells in row 1. If you do, run `setup` again.
