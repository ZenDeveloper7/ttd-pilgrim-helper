# TTD Pilgrim Helper

An independent Chrome and Zen extension inspired by the core pilgrim-list workflow of TTD Pilgrims Manager. It stores multiple pilgrim lists locally, fills visible TTD pilgrim forms, and can schedule one booking attempt for **Srivari Temple - Tirumala**.

## Scheduled booking

1. Build a pilgrim list. Each pilgrim needs a name, age, gender, and ID number.
2. In **Scheduled booking**, choose **Any available seva** (or enter a specific seva), the visit date, and the ticket release date and time in **IST**. The URL must be the official TTD Arjitha Seva slot-booking URL for Srivari Temple; the supplied Homam link targets a different temple and is rejected.
3. Click **Arm booking**. The currently selected list is attached to the plan. Only one plan can be armed at a time. **Cancel plan** clears its alarm.
4. Keep the browser running and sign in to TTD ahead of the release. At the alarm, the extension opens a new TTD tab, attempts the fixed temple, then tries visible sevas until one allows the requested date. It fills pilgrim details and clicks the site's Continue and Pay Now controls when available. You complete payment yourself on TTD.

The dates `25 September 2026, 10:00 IST` and `10 October 2026` were examples. A past release time cannot be armed. Enter an actual future release time when known.

Browser alarms can run late if the browser is closed, sleeping, or busy. The extension records when it actually opened the page and marks substantially late alarms as missed. TTD controls availability and can require login, OTP, CAPTCHA, consent, or other validation. The extension stops when it cannot verify the next step; it never enters payment credentials or confirms payment. The current TTD calendar and authenticated booking flow have not been tested live, so selectors may need adjustment.

## Manual actions

On a TTD pilgrim-details page, use **Check form** to inspect recognized visible fields and **Fill form** to enter the selected list. **Continue** and **Pay Now** click the matching button on the current page. **Run All** attempts Fill → Continue → Pay Now after confirmation. Review all details on TTD before proceeding.

## Build and install for development

Run `node scripts/build.cjs` from the repository folder. It creates `build/chrome` and `build/zen` with separate browser manifests.

- **Chrome:** Open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `build/chrome`.
- **Zen:** Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `build/zen/manifest.json`. The temporary add-on disappears when Zen restarts. A permanent Zen installation requires a signed Firefox add-on.

Reload already-open TTD tabs after installation. Chrome and Zen have separate extension storage. Use **Export** and **Import** to move lists; the exported JSON contains readable ID details, so keep it private.

## Data and development

The extension uses only browser-local storage and TTD pages; it has no remote server, analytics, or extension account. Stored pilgrim details are not separately encrypted. It is not affiliated with Tirumala Tirupati Devasthanams.

Run `node tests/plan.test.cjs`, `node tests/content.test.cjs`, `node tests/background.test.cjs`, and `node tests/scheduled-content.test.cjs` for synthetic checks. These do not prove that today's authenticated TTD site matches the selectors or that a browser alarm will fire at the exact second.
