(() => {
  "use strict";

  const api = globalThis.chrome || globalThis.browser;
  const STORAGE_KEY = "ttdPilgrimHelperV1";
  const FIELDS = [
    ["name", "Full name", "text", true],
    ["age", "Age", "number"],
    ["gender", "Gender", "select"],
    ["idType", "ID type", "select"],
    ["idNumber", "ID number", "text", true],
    ["email", "Email", "email", true],
    ["mobile", "Mobile", "tel"],
    ["city", "City", "text"],
    ["state", "State", "text"],
    ["country", "Country", "text"],
    ["pincode", "PIN code", "text"],
    ["gotram", "Gotram", "text", true]
  ];
  const EMPTY_PERSON = Object.fromEntries(FIELDS.map(([key]) => [key, ""]));
  const el = (id) => document.getElementById(id);
  let data = { version: 1, selectedId: "default", lists: [{ id: "default", name: "My pilgrims", people: [] }] };
  let saveTimer;

  function storageGet() {
    return new Promise((resolve, reject) => api.storage.local.get(STORAGE_KEY, (result) => {
      const error = api.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve(result[STORAGE_KEY]);
    }));
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => api.storage.local.set({ [STORAGE_KEY]: value }, () => {
      const error = api.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve();
    }));
  }

  function status(message, error = false) {
    el("status").textContent = message;
    el("status").classList.toggle("error", error);
  }

  function selected() {
    return data.lists.find((list) => list.id === data.selectedId) || data.lists[0];
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function cleanText(value, limit = 120) {
    return String(value ?? "").trim().slice(0, limit);
  }

  function normalizePerson(person) {
    const result = { ...EMPTY_PERSON };
    for (const [key] of FIELDS) result[key] = cleanText(person?.[key]);
    return result;
  }

  function validateData(candidate) {
    if (!candidate || candidate.version !== 1 || !Array.isArray(candidate.lists)) {
      throw new Error("This is not a TTD Pilgrim Helper export.");
    }
    if (!candidate.lists.length || candidate.lists.length > 100) {
      throw new Error("The file must contain 1 to 100 lists.");
    }
    const lists = candidate.lists.map((list) => {
      if (!list || !Array.isArray(list.people) || list.people.length > 100) {
        throw new Error("Each list may contain up to 100 pilgrims.");
      }
      return {
        id: cleanText(list.id, 80) || makeId(),
        name: cleanText(list.name, 80) || "Untitled list",
        people: list.people.map(normalizePerson)
      };
    });
    const ids = new Set(lists.map((list) => list.id));
    if (ids.size !== lists.length) throw new Error("The file contains duplicate list IDs.");
    return { version: 1, selectedId: ids.has(candidate.selectedId) ? candidate.selectedId : lists[0].id, lists };
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => storageSet(data).then(() => status("Saved locally.")).catch((error) => status(error.message, true)), 350);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    await storageSet(data);
    status("Saved locally.");
  }

  function render() {
    const picker = el("listSelect");
    picker.replaceChildren();
    for (const list of data.lists) {
      const option = document.createElement("option");
      option.value = list.id;
      option.textContent = list.name;
      picker.append(option);
    }
    picker.value = selected().id;
    const people = el("people");
    people.replaceChildren();
    selected().people.forEach((person, index) => people.append(renderPerson(person, index)));
    if (!selected().people.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Add a pilgrim to start this list.";
      people.append(empty);
    }
  }

  function rowButton(label, title, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", handler);
    return button;
  }

  function renderPerson(person, index) {
    const card = document.createElement("article");
    card.className = "person";
    const head = document.createElement("div");
    head.className = "person-head";
    const title = document.createElement("strong");
    title.textContent = person.name || `Pilgrim ${index + 1}`;
    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(
      rowButton("↑", "Move up", () => movePerson(index, -1)),
      rowButton("↓", "Move down", () => movePerson(index, 1)),
      rowButton("⧉", "Duplicate pilgrim", () => { selected().people.splice(index + 1, 0, { ...person }); render(); scheduleSave(); }),
      rowButton("×", "Remove pilgrim", () => { selected().people.splice(index, 1); render(); scheduleSave(); })
    );
    head.append(title, actions);
    const fields = document.createElement("div");
    fields.className = "fields";
    for (const [key, label, type, wide] of FIELDS) {
      const wrapper = document.createElement("label");
      wrapper.className = `field${wide ? " wide" : ""}`;
      wrapper.textContent = label;
      const input = type === "select" ? document.createElement("select") : document.createElement("input");
      if (type === "select") {
        const values = key === "gender" ? ["", "Male", "Female", "Other"] : ["", "Aadhaar Card", "Passport", "Driving Licence", "Voter ID", "Other"];
        for (const value of values) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value || "Select";
          input.append(option);
        }
      } else {
        input.type = type;
        if (key === "age") { input.min = "0"; input.max = "120"; }
        if (key === "mobile" || key === "pincode") input.inputMode = "numeric";
      }
      input.value = person[key];
      input.addEventListener("input", () => {
        person[key] = input.value;
        if (key === "name") title.textContent = input.value || `Pilgrim ${index + 1}`;
        scheduleSave();
      });
      input.addEventListener("change", () => { person[key] = input.value; scheduleSave(); });
      wrapper.append(input);
      fields.append(wrapper);
    }
    card.append(head, fields);
    return card;
  }

  function movePerson(index, direction) {
    const people = selected().people;
    const next = index + direction;
    if (next < 0 || next >= people.length) return;
    [people[index], people[next]] = [people[next], people[index]];
    render();
    scheduleSave();
  }

  function activeTab() {
    return new Promise((resolve, reject) => api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = api.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve(tabs[0]);
    }));
  }

  function messageTab(tabId, message) {
    return new Promise((resolve, reject) => api.tabs.sendMessage(tabId, message, (response) => {
      const error = api.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve(response);
    }));
  }

  async function action(type) {
    try {
      await saveNow();
      const tab = await activeTab();
      const url = new URL(tab?.url || "");
      if (!/^https:$/.test(url.protocol) || !/(^|\.)(ttdevasthanams\.ap\.gov\.in|ttdsevaonline\.com)$/.test(url.hostname)) {
        throw new Error("Open a TTD booking form in this tab first.");
      }
      const people = selected().people.map(normalizePerson).filter((person) => person.name);
      if (type !== "CHECK" && type !== "CONTINUE" && type !== "PAY_NOW" && !people.length) {
        throw new Error("Add at least one named pilgrim.");
      }
      if (type === "RUN_ALL" && people.some((person) => !person.age || !person.gender || !person.idNumber)) {
        throw new Error("Run All needs name, age, gender, and ID number for every pilgrim.");
      }
      if (type === "RUN_ALL" && !confirm("Run All will fill the form and click Continue and Pay Now on the TTD site. Review your list and selected booking first. Continue?")) return;
      const response = await messageTab(tab.id, { type, people });
      if (!response?.ok) throw new Error(response?.error || "The form could not be handled. Reload the TTD tab and try again.");
      status(response.message);
    } catch (error) {
      status(error.message, true);
    }
  }

  function bind() {
    el("listSelect").addEventListener("change", (event) => { data.selectedId = event.target.value; render(); scheduleSave(); });
    el("newList").addEventListener("click", () => {
      const name = prompt("Name for the new list:", "New list");
      if (name === null) return;
      if (!cleanText(name)) { status("Enter a list name.", true); return; }
      const list = { id: makeId(), name: cleanText(name, 80), people: [] };
      data.lists.push(list); data.selectedId = list.id; render(); scheduleSave();
    });
    el("renameList").addEventListener("click", () => {
      const name = prompt("Rename this list:", selected().name);
      if (name === null) return;
      if (!cleanText(name)) { status("Enter a list name.", true); return; }
      selected().name = cleanText(name, 80); render(); scheduleSave();
    });
    el("deleteList").addEventListener("click", () => {
      if (data.lists.length === 1) { status("Keep at least one list. Remove its pilgrims instead.", true); return; }
      if (!confirm(`Delete the list “${selected().name}” and its pilgrims?`)) return;
      data.lists = data.lists.filter((list) => list.id !== data.selectedId);
      data.selectedId = data.lists[0].id; render(); scheduleSave();
    });
    el("addPerson").addEventListener("click", () => { selected().people.push({ ...EMPTY_PERSON }); render(); scheduleSave(); });
    el("save").addEventListener("click", () => saveNow().catch((error) => status(error.message, true)));
    for (const [id, type] of [["checkForm", "CHECK"], ["fillForm", "FILL"], ["continueForm", "CONTINUE"], ["payNow", "PAY_NOW"], ["runAll", "RUN_ALL"]]) {
      el(id).addEventListener("click", () => action(type));
    }
    el("export").addEventListener("click", async () => {
      try {
        await saveNow();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = "ttd-pilgrim-lists.json"; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        status("Exported. The JSON file contains pilgrim ID details; keep it private.");
      } catch (error) { status(error.message, true); }
    });
    el("import").addEventListener("click", () => el("importFile").click());
    el("importFile").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        if (file.size > 1024 * 1024) throw new Error("Import must be under 1 MB.");
        const imported = validateData(JSON.parse(await file.text()));
        if (!confirm("Replace all current lists with this import?")) return;
        data = imported; await saveNow(); render(); status("Imported lists.");
      } catch (error) { status(error.message, true); }
      finally { event.target.value = ""; }
    });
  }

  bind();
  storageGet().then((saved) => { if (saved) data = validateData(saved); render(); }).catch((error) => status(error.message, true));
})();
