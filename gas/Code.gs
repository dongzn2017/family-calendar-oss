/**
 * FamilyCalendar - Optional Google Apps Script Selected Email Bridge (Template)
 *
 * Customize MAIL_RULES below with your own school, teacher, doctor, or booking senders.
 * Set Script Properties in https://script.google.com:
 *   - FAMILYCAL_ENDPOINT : https://your-worker.workers.dev/api/ingest/gmail
 *   - FAMILYCAL_SECRET   : matching Worker Secret GMAIL_INGEST_SECRET
 */

var LOOKBACK_DAYS = 7;
var MANUAL_GMAIL_LABEL = "FamilyCal";

var MAIL_RULES = [
  {
    name: "school_official",
    label: "School announcements",
    query: "from:school@example.edu",
  },
  {
    name: "music_direct_or_forwarded",
    label: "Music lessons (supports forwarded emails)",
    query: "(from:music-teacher@example.com OR \"music-teacher@example.com\")",
  },
  {
    name: "medical_booking",
    label: "Doctor appointments",
    query: "from:no-reply@doctolib.fr",
  },
  {
    name: "city_hall_notice_only",
    label: "City Hall alerts (reminder only)",
    query: "from:noreply@city-hall.example.gov",
  },
  {
    name: "manual_label",
    label: "Manual FamilyCal label",
    query: "label:" + MANUAL_GMAIL_LABEL,
  },
];

var NOISE_REGEX = /(verification code|one-time|security code|code de v[ée]rification|验证码|donnez votre avis|mot de passe oubli)/i;

function dryRunTest() {
  var collected = collectSelectedMessages();
  Logger.log("Matched messages: " + collected.length);
  for (var i = 0; i < collected.length; i++) {
    var m = collected[i];
    Logger.log("[" + m.matched_rule + "] " + m.received_at + " | " + m.sender + " | " + m.subject);
  }
}

function syncSelectedEmails() {
  var props = PropertiesService.getScriptProperties();
  var endpoint = props.getProperty("FAMILYCAL_ENDPOINT");
  var secret = props.getProperty("FAMILYCAL_SECRET");

  if (!endpoint || !secret) {
    throw new Error("Please configure FAMILYCAL_ENDPOINT and FAMILYCAL_SECRET in Script Properties.");
  }

  var messages = collectSelectedMessages();
  if (messages.length === 0) return;

  var response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "application/json",
    headers: { "X-FamilyCal-Secret": secret },
    payload: JSON.stringify({ messages: messages }),
    muteHttpExceptions: true,
  });

  Logger.log("HTTP " + response.getResponseCode() + " -> " + response.getContentText());
}

function collectSelectedMessages() {
  var seen = {};
  var result = [];

  for (var r = 0; r < MAIL_RULES.length; r++) {
    var rule = MAIL_RULES[r];
    var fullQuery = rule.query + " newer_than:" + LOOKBACK_DAYS + "d -in:trash -in:spam";
    var threads = GmailApp.search(fullQuery, 0, 20);

    for (var t = 0; t < threads.length; t++) {
      var msgs = threads[t].getMessages();
      for (var m = 0; m < msgs.length; m++) {
        var msg = msgs[m];
        var id = msg.getId();
        if (seen[id]) continue;

        var subject = msg.getSubject() || "";
        var sender = msg.getFrom() || "";
        var plain = (msg.getPlainBody() || "").replace(/\r\n/g, "\n").trim();

        if (NOISE_REGEX.test(subject)) continue;

        seen[id] = true;
        result.push({
          gmail_message_id: id,
          gmail_thread_id: threads[t].getId(),
          sender: sender,
          subject: subject,
          snippet: plain.slice(0, 220),
          body_clean: plain.slice(0, 3500),
          gmail_url: "https://mail.google.com/mail/u/0/#all/" + threads[t].getId(),
          received_at: msg.getDate().toISOString(),
          matched_rule: rule.name,
        });
      }
    }
  }
  return result;
}
