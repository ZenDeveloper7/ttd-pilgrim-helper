(() => {
  "use strict";

  const api = globalThis.chrome || globalThis.browser;
  const FIELD_ALIASES = {
    name: ["name", "full name", "pilgrim name", "devotee name", "passenger name"],
    age: ["age", "pilgrim age", "devotee age", "passenger age"],
    gender: ["gender", "sex", "pilgrim gender", "devotee gender"],
    idType: ["photo id proof", "photo id type", "id proof", "id type", "identity proof", "proof type"],
    idNumber: ["aadhaar", "aadhaar no", "aadhaar number", "aadhaar card number", "aadhar", "aadhar no", "aadhar number", "aadhar card number", "photo id number", "photo id card number", "id proof number", "identity number"],
    email: ["email", "email address", "e mail", "pilgrim email"],
    mobile: ["mobile", "mobile no", "mobile number", "phone", "phone number", "contact number"],
    city: ["city", "town"],
    state: ["state", "state name"],
    country: ["country", "country name"],
    pincode: ["pin", "pin code", "pincode", "postal code", "zip code", "zip"],
    gotram: ["gotram", "gothram", "gotra"]
  };
  const FIELD_ORDER = Object.keys(FIELD_ALIASES);
  const CONTACT_FIELDS = new Set(["email", "mobile", "city", "state", "country", "pincode", "gotram"]);
  const FIELD_SELECTOR = "input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea, [role=combobox]";
  let autoRunActive = false;

  function normalize(value) {
    return String(value || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\d+\b/g, " ")
      .replace(/\*/g, " ")
      .replace(/[^a-zA-Z]+/g, " ")
      .trim().toLowerCase().replace(/\s+/g, " ")
      .replace(/^(please )?(enter|select|choose) (your |the )?/, "")
      .replace(/ (required|optional)$/, "");
  }

  function isVisible(element) {
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function descriptions(element) {
    const values = [element.getAttribute("aria-label"), element.getAttribute("placeholder"), element.getAttribute("name"), element.id];
    if (element.labels) values.push(...Array.from(element.labels, (label) => label.textContent));
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) values.push(document.getElementById(id)?.textContent);
    }
    const parent = element.closest(".mat-form-field, .mat-mdc-form-field, .MuiFormControl-root, .ant-form-item, .form-group, .form-field");
    if (parent) {
      const label = parent.querySelector("label, mat-label, .mat-mdc-form-field-label, .ant-form-item-label");
      if (label) values.push(label.textContent);
    }
    return values.filter(Boolean).map(normalize).filter(Boolean);
  }

  function fieldType(element) {
    const labels = descriptions(element);
    for (const key of FIELD_ORDER) {
      if (labels.some((label) => FIELD_ALIASES[key].includes(label))) return key;
    }
    return null;
  }

  function detectedFields() {
    const result = Object.fromEntries(FIELD_ORDER.map((key) => [key, []]));
    for (const field of document.querySelectorAll(FIELD_SELECTOR)) {
      if (!isVisible(field) || field.disabled || field.readOnly) continue;
      const key = fieldType(field);
      if (key) result[key].push(field);
    }
    return result;
  }

  function nativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) descriptor.set.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function setField(element, value) {
    if (!value) return false;
    if (element instanceof HTMLSelectElement) {
      const desired = normalize(value);
      const option = Array.from(element.options).find((item) => normalize(item.textContent) === desired || normalize(item.value) === desired);
      if (!option) return false;
      element.value = option.value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (element.getAttribute("role") === "combobox" && !(element instanceof HTMLInputElement)) {
      element.click();
      await new Promise((resolve) => setTimeout(resolve, 120));
      const desired = normalize(value);
      const option = Array.from(document.querySelectorAll("[role=option], mat-option, .mat-mdc-option"))
        .find((item) => isVisible(item) && normalize(item.textContent) === desired);
      if (!option) return false;
      option.click();
      return true;
    }
    if (element instanceof HTMLInputElement && element.type === "radio") {
      const desired = normalize(value);
      if (normalize(element.value) !== desired) return false;
      element.click();
      return true;
    }
    nativeValue(element, value);
    return true;
  }

  async function fill(people) {
    if (!Array.isArray(people) || !people.length) throw new Error("Choose a list with at least one pilgrim.");
    const initial = detectedFields();
    if (!initial.name.length && !initial.age.length && !initial.idNumber.length) {
      throw new Error("No pilgrim form fields found on this page. Open the pilgrim details step, then use Check form.");
    }
    let filled = 0;
    const missing = new Set();
    const missingCritical = new Set();
    for (let index = 0; index < people.length; index++) {
      const person = people[index];
      for (const key of FIELD_ORDER) {
        const value = String(person[key] || "").trim();
        if (!value) continue;
        const targets = detectedFields()[key];
        const target = targets[index] || (index === 0 && CONTACT_FIELDS.has(key) ? targets[0] : null);
        if (!target) {
          missing.add(key);
          if (["name", "age", "gender", "idNumber"].includes(key)) missingCritical.add(`${key} for pilgrim ${index + 1}`);
          continue;
        }
        if (await setField(target, value)) filled++;
        else {
          missing.add(key);
          if (["name", "age", "gender", "idNumber"].includes(key)) missingCritical.add(`${key} for pilgrim ${index + 1}`);
        }
      }
    }
    if (!filled) throw new Error("The visible form did not accept any fields. Use Check form to inspect matches.");
    return { filled, missing: [...missing], missingCritical: [...missingCritical] };
  }

  function findAction(label) {
    const expected = normalize(label);
    return Array.from(document.querySelectorAll("button, input[type=button], input[type=submit], [role=button]"))
      .find((element) => isVisible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true" &&
        normalize(element.textContent || element.value || element.getAttribute("aria-label")) === expected);
  }

  function clickAction(label) {
    const button = findAction(label);
    if (!button) throw new Error(`The site's ${label} button is not available on this step.`);
    button.click();
  }

  function waitForAction(label, timeoutMs = 8000) {
    return new Promise((resolve) => {
      const current = findAction(label);
      if (current) { resolve(current); return; }
      const observer = new MutationObserver(() => {
        const action = findAction(label);
        if (action) { observer.disconnect(); clearTimeout(timer); resolve(action); }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "aria-disabled"] });
      const timer = setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
    });
  }

  function waitFor(check, timeoutMs = 8000) {
    return new Promise((resolve) => {
      const first = check();
      if (first) { resolve(first); return; }
      const observer = new MutationObserver(() => {
        const value = check();
        if (value) { observer.disconnect(); clearTimeout(timer); resolve(value); }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      const timer = setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
    });
  }

  function blocked(element) {
    return !element || !isVisible(element) || element.disabled || element.getAttribute("aria-disabled") === "true" ||
      /(^|\s)(disabled|unavailable|booked|full|quota-full)(\s|$)/i.test(String(element.className || "")) ||
      /quota (is )?full|not available|sold out/i.test(String(element.getAttribute("title") || ""));
  }

  function labeledControl(aliases) {
    const desired = aliases.map(normalize);
    return Array.from(document.querySelectorAll(FIELD_SELECTOR))
      .find((field) => isVisible(field) && descriptions(field).some((label) => desired.includes(label)));
  }

  function selectedValue(control) {
    if (control instanceof HTMLSelectElement) return control.selectedOptions?.[0]?.textContent || control.value;
    return control.value || control.getAttribute("aria-valuetext") || control.textContent || "";
  }

  async function visibleOptions(control) {
    if (control instanceof HTMLSelectElement) {
      return Array.from(control.options).filter((option) => !option.disabled)
        .map((option) => option.textContent.trim()).filter(Boolean);
    }
    control.click();
    await waitFor(() => Array.from(document.querySelectorAll("[role=option], mat-option, .mat-mdc-option")).some(isVisible), 1500);
    return Array.from(document.querySelectorAll("[role=option], mat-option, .mat-mdc-option"))
      .filter((option) => !blocked(option)).map((option) => option.textContent.trim()).filter(Boolean);
  }

  async function selectChoice(control, choice) {
    if (normalize(selectedValue(control)) === normalize(choice)) return true;
    if (control instanceof HTMLSelectElement) return setField(control, choice);
    control.click();
    const option = await waitFor(() => Array.from(document.querySelectorAll("[role=option], mat-option, .mat-mdc-option"))
      .find((item) => !blocked(item) && normalize(item.textContent) === normalize(choice)), 1500);
    if (!option) return false;
    option.click();
    return true;
  }

  function visitDateControl(isoDate) {
    const dateInput = Array.from(document.querySelectorAll('input[type="date"]')).find(isVisible);
    if (dateInput) return dateInput;
    const [year, month, day] = isoDate.split("-").map(Number);
    const monthName = new Date(Date.UTC(year, month - 1, day)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    const monthShort = monthName.slice(0, 3);
    const fullLabels = new Set([
      isoDate, `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
      `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`,
      `${monthName} ${day}, ${year}`, `${day} ${monthName} ${year}`,
      `${monthShort} ${day}, ${year}`, `${day} ${monthShort} ${year}`
    ].map((value) => value.toLowerCase()));
    const attributed = Array.from(document.querySelectorAll("[data-date], [aria-label], [title], time[datetime]"))
      .find((element) => !blocked(element) && ["data-date", "aria-label", "title", "datetime"]
        .some((name) => fullLabels.has(String(element.getAttribute(name) || "").toLowerCase())));
    if (attributed) return attributed;
    const heading = Array.from(document.querySelectorAll("h2, h3, h4, div, span"))
      .find((element) => isVisible(element) && element.children.length === 0 &&
        normalize(element.textContent) === normalize(`${monthName} ${year}`));
    if (!heading) return null;
    for (let panel = heading.parentElement, depth = 0; panel && depth < 5; panel = panel.parentElement, depth++) {
      const leaves = Array.from(panel.querySelectorAll("button, [role=gridcell], [role=button], div, span"))
        .filter((element) => element.children.length === 0 && /^\d{1,2}$/.test(element.textContent.trim()));
      if (leaves.length < 28 || leaves.length > 42) continue;
      const matches = leaves.filter((element) => !blocked(element) && Number(element.textContent.trim()) === day);
      return matches.length === 1 ? matches[0] : null;
    }
    return null;
  }

  function loginOrCaptchaVisible() {
    const text = document.body?.innerText || "";
    if (/registered mobile number/i.test(text) && /get otp/i.test(text)) return "TTD requires login and OTP. Sign in manually, then resume from the helper.";
    if (/captcha/i.test(text) && Array.from(document.querySelectorAll("input")).some((field) =>
      descriptions(field).some((label) => label.includes("captcha")))) return "TTD requires a CAPTCHA. Complete it manually.";
    return "";
  }

  function sendProgress(status, message, extra = {}) {
    return new Promise((resolve) => api.runtime.sendMessage({ type: "AUTO_PROGRESS", status, message, ...extra }, () => resolve()));
  }

  async function fillAndAdvance(people, plan) {
    if (!plan.dateConfirmed) return { status: "stopped", message: "The visit date was not confirmed on this run; automatic filling stopped." };
    const ticketCount = labeledControl(["no of tickets", "number of tickets", "tickets", "no of pilgrims"]);
    if (ticketCount) await setField(ticketCount, String(people.length));
    const result = await fill(people);
    if (result.missingCritical.length) {
      return { status: "stopped", message: `Stopped: missing ${result.missingCritical.join(", ")}.` };
    }
    await sendProgress("running", `Filled ${result.filled} pilgrim fields; advancing to payment.`);
    const next = await waitForAction("Continue", 4000);
    if (next) next.click();
    const pay = await waitForAction("Pay Now", 10000);
    if (!pay) return { status: "stopped", message: "Pilgrim details were filled, but TTD did not show Pay Now. Review the form manually." };
    await sendProgress("payment_requested", "Clicked Pay Now. Complete any payment manually on TTD.");
    pay.click();
    return { status: "payment_requested", message: "Clicked Pay Now. Complete any payment manually on TTD." };
  }

  async function runScheduled(plan, people) {
    if (autoRunActive) return { status: "running", message: "A booking run is already active in this tab." };
    autoRunActive = true;
    try {
      const blocker = loginOrCaptchaVisible();
      if (blocker) return { status: "stopped", message: blocker };
      const visiblePilgrimFields = detectedFields();
      if (visiblePilgrimFields.name.length && plan.dateConfirmed) return fillAndAdvance(people, plan);

      const templeControl = labeledControl(["temple", "select temple"]);
      if (templeControl) {
        if (!await selectChoice(templeControl, plan.temple)) {
          return { status: "stopped", message: `Could not select ${plan.temple} on the TTD page.` };
        }
      } else {
        const urlTemple = new URL(location.href).searchParams.get("templeName");
        if (normalize(urlTemple) !== normalize(plan.temple)) {
          return { status: "stopped", message: "Could not verify the fixed Srivari Temple on this page." };
        }
      }

      const sevaControl = await waitFor(() => labeledControl(["seva", "select seva", "service name", "select service"]), 6000);
      if (!sevaControl) return { status: "stopped", message: "Could not find TTD's seva selector." };
      const candidates = plan.sevaMode === "exact" ? [plan.seva] : (await visibleOptions(sevaControl))
        .filter((name) => !/^(select|choose|all)( |$)/i.test(name));
      if (!candidates.length) return { status: "stopped", message: "No selectable Srivari seva was shown." };

      for (const seva of candidates) {
        if (!await selectChoice(sevaControl, seva)) continue;
        const day = await waitFor(() => visitDateControl(plan.bookingDate), 4000);
        if (blocked(day)) continue;
        if (day instanceof HTMLInputElement && day.type === "date") nativeValue(day, plan.bookingDate);
        else day.click();
        const next = await waitForAction("Continue", 3000);
        if (!next) continue;
        await sendProgress("running", `Selected ${seva} for ${plan.bookingDate}; continuing.`, { selectedSeva: seva, dateConfirmed: true });
        next.click();
        const details = await waitFor(() => detectedFields().name.length > 0, 10000);
        if (details) return fillAndAdvance(people, { ...plan, selectedSeva: seva, dateConfirmed: true });
        return { status: "running", message: "Selected the seva and date; waiting for the pilgrim form." };
      }
      return { status: "stopped", message: `No available seva was found for ${plan.bookingDate}.` };
    } catch (error) {
      return { status: "stopped", message: error.message };
    } finally {
      autoRunActive = false;
    }
  }

  async function handle(message) {
    if (message?.type === "CHECK") {
      const fields = detectedFields();
      const found = FIELD_ORDER.filter((key) => fields[key].length).map((key) => `${key}: ${fields[key].length}`);
      return { ok: true, message: found.length ? `Visible fields: ${found.join(", ")}.` : "No supported fields found. Open the pilgrim details form." };
    }
    if (message?.type === "CONTINUE") {
      clickAction("Continue");
      return { ok: true, message: "Clicked the site's Continue button." };
    }
    if (message?.type === "PAY_NOW") {
      clickAction("Pay Now");
      return { ok: true, message: "Clicked the site's Pay Now button. Complete any payment on the TTD site." };
    }
    if (message?.type === "FILL" || message?.type === "RUN_ALL") {
      const result = await fill(message.people);
      const summary = `Filled ${result.filled} field${result.filled === 1 ? "" : "s"}.${result.missing.length ? ` No matching control for: ${result.missing.join(", ")}.` : ""}`;
      if (message.type === "FILL") return { ok: true, message: summary };
      if (result.missingCritical.length) return { ok: true, message: `${summary} Run All stopped because ${result.missingCritical.join(", ")} was not filled.` };
      const next = await waitForAction("Continue", 2000);
      if (!next) return { ok: true, message: `${summary} Continue is not available, so Run All stopped.` };
      next.click();
      const pay = await waitForAction("Pay Now");
      if (!pay) return { ok: true, message: `${summary} Continued, but Pay Now did not appear within 8 seconds.` };
      pay.click();
      return { ok: true, message: `${summary} Clicked Continue and Pay Now. Complete any payment on the TTD site.` };
    }
    return { ok: false, error: "Unknown action." };
  }

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (!message || !["CHECK", "FILL", "CONTINUE", "PAY_NOW", "RUN_ALL", "AUTO_BOOK"].includes(message.type)) return false;
    const task = message.type === "AUTO_BOOK" ? runScheduled(message.plan, message.people) : handle(message);
    task.then(respond).catch((error) => respond({ ok: false, error: error.message }));
    return true;
  });

  api.runtime.sendMessage({ type: "PAGE_READY" }, () => void api.runtime.lastError);
})();
