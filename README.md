# TTD Pilgrim Helper

A new, local WebExtension for Chrome and Zen. It reproduces the core workflow observed in TTD Pilgrims Manager: maintain multiple pilgrim lists, fill a TTD pilgrim form, and optionally advance through its Continue and Pay Now controls. This is independent code, not a copy of the installed extension.

## Use

1. Open a TTD booking page and reach the **pilgrim details** form.
2. Click the TTD Pilgrim Helper toolbar icon.
3. Create a list, add pilgrims, and save. Use **Check form** to see which visible fields the extension recognizes.
4. Use **Fill form** and review every field on the site. **Continue** and **Pay Now** click only the matching button on the current page. **Run All** attempts Fill → Continue → Pay Now after an explicit confirmation; it stops if a critical pilgrim field has no matching control.

The site still controls availability, validation, CAPTCHA, booking, and payment. The extension neither books tickets independently nor enters payment details. Run All handles same-page transitions; if TTD reloads the page between steps, use the separate controls.

## Install for development

**Chrome:** Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder. Reload any already-open TTD tab after installation.

**Zen:** Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select this folder's `manifest.json`. Reload the TTD tab. Zen is Firefox based, so a permanent install requires a Mozilla-signed add-on; this temporary build disappears when Zen restarts.

Chrome and Zen each have separate extension storage. Use **Export** in one browser and **Import** in the other to move lists. The export contains sensitive pilgrim details in readable JSON; keep it private and delete extra copies after importing.

## Data and access

- Lists live in the browser's extension-local storage. No account, network API, analytics, or remote service is used by this extension.
- The content script runs only on `ttdevasthanams.ap.gov.in` and `ttdsevaonline.com` and changes form fields only after a toolbar action.
- Saved details are not encrypted by the extension. Anyone with access to the browser profile or an exported JSON file may be able to read them.
- Form matching uses visible labels, placeholders, and field names. TTD can change its form. Always use **Check form**, then verify the filled details before proceeding.

## Current implementation limits

- The current booking page must be at the pilgrim form; a slot calendar has no fields to fill.
- Custom dropdowns are supported when they expose a standard `role=combobox` and visible options. Unusual controls may need a site-specific selector after testing on a live form.
- No existing data from TTD Pilgrims Manager is imported automatically. Its storage is separate and inaccessible to this extension. Enter details manually or use this extension's own export format.
- The extension is not affiliated with Tirumala Tirupati Devasthanams.

## Development check

Run `node tests/content.test.cjs` from this folder to exercise two-person matching, filling, and the Run All click sequence against a synthetic form. This does not replace a live form check in Chrome and Zen.
