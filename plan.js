(() => {
  "use strict";

  const TEMPLE = "Srivari Temple - Tirumala";
  const BOOKING_ORIGIN = "https://ttdevasthanams.ap.gov.in";
  const DEFAULT_BOOKING_URL = `${BOOKING_ORIGIN}/arjitha-seva/slot-booking?flowIdentifier=arjitha-seva&templeName=Srivari%20Temple%20-%20Tirumala`;
  const IST_OFFSET_MINUTES = 330;

  function parseIstDateTime(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || ""));
    if (!match) throw new Error("Enter the ticket release date and time in IST.");
    const [, year, month, day, hour, minute, second = "00"] = match;
    const wallClock = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
    const roundTrip = new Date(wallClock).toISOString().slice(0, 19);
    if (roundTrip !== `${year}-${month}-${day}T${hour}:${minute}:${second}`) {
      throw new Error("The ticket release date or time is invalid.");
    }
    return wallClock - IST_OFFSET_MINUTES * 60_000;
  }

  function validBookingDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function comparable(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function validateBookingUrl(value, sevaMode, seva) {
    let url;
    try { url = new URL(String(value || "")); }
    catch { throw new Error("Enter the official TTD booking URL."); }
    if (url.origin !== BOOKING_ORIGIN || url.pathname !== "/arjitha-seva/slot-booking" || url.username || url.password) {
      throw new Error("The booking URL must be the official TTD Arjitha Seva slot-booking page.");
    }
    const temple = url.searchParams.get("templeName");
    if (temple && comparable(temple) !== comparable(TEMPLE)) {
      throw new Error(`The URL targets “${temple}”, but this plan is fixed to ${TEMPLE}.`);
    }
    const urlSeva = url.searchParams.get("sevaName");
    if (sevaMode === "any" && urlSeva) {
      throw new Error("Remove sevaName from the URL when choosing any available seva.");
    }
    if (sevaMode === "exact" && urlSeva && comparable(urlSeva) !== comparable(seva)) {
      throw new Error("The URL's sevaName differs from the selected seva.");
    }
    url.hash = "";
    return url.toString();
  }

  function preparePlan(input, now = Date.now()) {
    const sevaMode = input?.sevaMode === "exact" ? "exact" : "any";
    const seva = String(input?.seva || "").trim();
    if (sevaMode === "exact" && (!seva || seva.length > 120)) throw new Error("Enter a seva name (up to 120 characters).");
    const bookingDate = String(input?.bookingDate || "");
    if (!validBookingDate(bookingDate)) throw new Error("Enter a valid seva visit date.");
    const releaseIst = String(input?.releaseIst || "");
    const openAt = parseIstDateTime(releaseIst);
    if (openAt <= now + 30_000) throw new Error("The release time must be more than 30 seconds in the future.");
    if (openAt > now + 366 * 24 * 60 * 60_000) throw new Error("Schedule a release within the next year.");
    const listId = String(input?.listId || "");
    if (!listId) throw new Error("Choose a pilgrim list.");
    const bookingUrl = validateBookingUrl(input?.bookingUrl || DEFAULT_BOOKING_URL, sevaMode, seva);
    return {
      version: 1,
      temple: TEMPLE,
      sevaMode,
      seva: sevaMode === "exact" ? seva : "",
      bookingDate,
      releaseIst,
      openAt,
      bookingUrl,
      listId,
      status: "armed",
      updatedAt: now
    };
  }

  const exported = { TEMPLE, BOOKING_ORIGIN, DEFAULT_BOOKING_URL, parseIstDateTime, validateBookingUrl, preparePlan };
  globalThis.TTDPlan = exported;
  if (typeof module !== "undefined") module.exports = exported;
})();
