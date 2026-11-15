// The Drone_Father - enquiry form.
//
// ---------------------------------------------------------------------------
// SETTINGS (the only part that normally needs editing)
// ---------------------------------------------------------------------------
// FORM_ENDPOINT: where enquiries are sent. Use FormSubmit's hidden alias, e.g.
//   'https://formsubmit.co/abc123randomstring'
// NOT the plain email address, so the address is not readable in the page source.
// While this is empty the page shows "Enquiries open here soon" instead of the
// form. See PROJECT_HANDOFF.md section 9c.
var FORM_ENDPOINT = 'https://formsubmit.co/514f34e27dc4bc099ff7113a176a7da1';

// The automatic email reply sent to the person enquiring (FormSubmit's
// "_autoresponse" field). FormSubmit adds a copy of what they submitted.
var AUTO_REPLY =
  'Thanks for your enquiry to The Drone_Father. This is an automatic note to confirm it arrived. ' +
  'I will reply personally with a plan and a price. To help me quote quickly, reply to this email ' +
  'with anything you have not already told me: the occasion and what the video is for; the exact ' +
  'location and date; how long the finished video should be; where it will be shown (YouTube, ' +
  'Instagram, a website, a screen at the event); and when you need it by. - The Drone_Father';

// Budget slider: the top of the scale is roughly this many Australian dollars.
// The scale has 40 steps and is rounded to tidy numbers in each currency.
var BUDGET_TOP_AUD = 10000;

// Exchange rates: how much of each currency one Australian dollar buys.
// The page fetches today's rates from RATES_URL when it loads. These built-in
// figures (from 15 Nov 2026) are only used if that fetch fails.
var RATES_URL = 'https://open.er-api.com/v6/latest/AUD';
var RATES_DATE = '15 Nov 2026 (built-in, may be out of date)';
var RATES = {
  AUD: 1, USD: 0.678, EUR: 0.614, GBP: 0.513, NZD: 1.227, CAD: 0.968, CHF: 0.569,
  JPY: 108.4, CNY: 4.53, HKD: 5.32, SGD: 0.874, INR: 64.0, AED: 2.49, SAR: 2.54,
  ZAR: 11.47, SEK: 6.82, NOK: 6.48, DKK: 4.59, TRY: 34.2, BRL: 3.83, MXN: 12.6,
  KRW: 907, THB: 23.0, IDR: 12362, MYR: 2.77, PHP: 43.3
};
// ---------------------------------------------------------------------------

(function () {
  var form = document.getElementById('enquiryForm');
  var closed = document.getElementById('formClosed');
  var receipt = document.getElementById('receipt');
  var errorBox = document.getElementById('formError');
  if (!form) return;

  var STORE = 'df-enquiry';
  var params = location.search;
  var demo = /[?&]demo=1/.test(params);    // try the form without sending anything
  var sent = /[?&]sent=1/.test(params);    // FormSubmit sends the visitor back here after a real send
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  var labels = {
    occasion: 'Occasion', length: 'Video length', location: 'Location', date: 'Date',
    format: 'Shown on', deadline: 'Needed by', budget: 'Budget', details: 'Notes'
  };

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  function showReceipt(data) {
    var first = (data.name || '').split(' ')[0];
    document.getElementById('receiptTitle').textContent = first ? 'Got it, ' + first : 'Got it';
    document.getElementById('receiptLead').textContent =
      'Your enquiry has arrived' + (data.email ? ' and a confirmation is on its way to ' + data.email : '') +
      '. You will get a personal reply with a plan and a price.' + (data.occasion ? ' Here is what you sent:' : '');

    var list = document.getElementById('receiptList');
    list.textContent = '';
    Object.keys(labels).forEach(function (key) {
      if (!data[key]) return;
      var dt = document.createElement('dt'); dt.textContent = labels[key];
      var dd = document.createElement('dd'); dd.textContent = data[key];
      list.appendChild(dt); list.appendChild(dd);
    });
    list.hidden = !list.children.length;

    // Prompt for the key details that were left blank or vague.
    var asks = [];
    if (data.occasion) {
      if (!data.date) asks.push('The date, or a rough window if it is flexible.');
      if (!data.deadline) asks.push('When you need the finished video by.');
      if (data.length === 'Not sure yet') asks.push('A rough length: a short clip for socials, or a longer piece?');
      if (data.format === 'Not sure') asks.push('Where it will be shown: YouTube, Instagram, a website, a screen at the event?');
      if (!data.details) asks.push('A link to a video you like the look of.');
      if (!data.budget) asks.push('A rough budget, so the plan fits it.');
    }
    asks = asks.slice(0, 3);
    var ul = document.getElementById('receiptAsks');
    ul.textContent = '';
    asks.forEach(function (a) { var li = document.createElement('li'); li.textContent = a; ul.appendChild(li); });
    document.getElementById('receiptMore').hidden = asks.length === 0;

    form.hidden = true;
    closed.hidden = true;
    receipt.hidden = false;
    receipt.focus();
  }

  function readStored() {
    try { return JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (e) { return null; }
  }

  function hidden(name, value) {
    var input = form.querySelector('input[type="hidden"][name="' + name + '"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    input.value = value;
  }

  // ---- Dates, currency and budget ------------------------------------------
  function $(id) { return document.getElementById(id); }

  // "2027-03-14" from the calendar becomes "14/03/2027".
  function ddmmyyyy(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  // Round to a tidy step: 1, 2, 2.5 or 5 times a power of ten.
  function tidy(n) {
    var pow = Math.pow(10, Math.floor(Math.log(n) / Math.LN10));
    var f = n / pow;
    var pick = f < 1.5 ? 1 : f < 2.25 ? 2 : f < 3.75 ? 2.5 : f < 7.5 ? 5 : 10;
    return pick * pow;
  }
  function stepFor(cur) { return tidy(BUDGET_TOP_AUD / 40 * (RATES[cur] || 1)); }

  function money(amount, cur) {
    try {
      return new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur, currencyDisplay: 'code', maximumFractionDigits: 0 }).format(amount);
    } catch (e) { return cur + ' ' + Math.round(amount); }
  }

  function budgetText() {
    if (!$('budgetOn').checked) return { shown: '', aud: '' };
    var cur = $('currencySelect').value;
    var step = stepFor(cur);
    var lo = +$('budgetLo').value, hi = +$('budgetHi').value;
    var open = hi >= 40;
    var shown = lo === hi
      ? (open ? money(lo * step, cur) + ' or more' : 'About ' + money(lo * step, cur))
      : money(lo * step, cur) + ' to ' + money(hi * step, cur) + (open ? ' or more' : '');
    var aud = '';
    if (cur === 'AUD') {
      aud = shown;
    } else {
      var rate = RATES[cur];
      var a = function (v) { return money(Math.round(v * step / rate / 10) * 10, 'AUD'); };
      aud = (lo === hi ? (open ? a(lo) + ' or more' : 'About ' + a(lo)) : a(lo) + ' to ' + a(hi) + (open ? ' or more' : '')) +
        ' (approx; 1 AUD = ' + rate + ' ' + cur + ', rates from ' + RATES_DATE + ')';
    }
    return { shown: shown, aud: aud };
  }

  function paintBudget() {
    var lo = +$('budgetLo').value, hi = +$('budgetHi').value;
    $('budgetFill').style.left = (lo / 40 * 100) + '%';
    $('budgetFill').style.right = (100 - hi / 40 * 100) + '%';
    $('budgetValue').textContent = budgetText().shown;
  }

  function setupExtras() {
    var today = new Date();
    var iso = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
    $('dateInput').min = iso;
    $('deadlineInput').min = iso;

    $('budgetOn').addEventListener('change', function () {
      $('budgetBody').hidden = !this.checked;
      paintBudget();
    });
    // The two handles may meet but never cross.
    $('budgetLo').addEventListener('input', function () {
      if (+this.value > +$('budgetHi').value) $('budgetHi').value = this.value;
      paintBudget();
    });
    $('budgetHi').addEventListener('input', function () {
      if (+this.value < +$('budgetLo').value) $('budgetLo').value = this.value;
      paintBudget();
    });
    $('currencySelect').addEventListener('change', paintBudget);
    paintBudget();

    // Today's exchange rates (falls back silently to the built-in table).
    if (window.fetch) {
      fetch(RATES_URL).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || d.result !== 'success' || !d.rates) return;
        Object.keys(RATES).forEach(function (k) { if (d.rates[k] > 0) RATES[k] = +d.rates[k].toFixed(k === 'AUD' ? 0 : 4); });
        RATES_DATE = (d.time_last_update_utc || '').replace(/^\w+, /, '').replace(/ \d\d:\d\d:\d\d.*$/, '') || RATES_DATE;
        paintBudget();
      }).catch(function () {});
    }
  }

  // Write the calendar dates and the budget into the hidden boxes that get sent.
  function syncDerived() {
    var date = ddmmyyyy($('dateInput').value);
    if ($('dateFlexible').checked) date = date ? date + ' (flexible)' : 'Flexible';
    form.elements.date.value = date;

    var deadline = ddmmyyyy($('deadlineInput').value);
    if ($('deadlineNoRush').checked) deadline = deadline ? deadline + ' (no rush)' : 'No rush';
    form.elements.deadline.value = deadline;

    var b = budgetText();
    form.elements.budget.value = b.shown;
    form.elements.budget_in_AUD.value = b.aud;
  }

  function start(endpoint) {
    // Back from a real send: show the receipt.
    if (sent) {
      showReceipt(readStored() || {});
      try { sessionStorage.removeItem(STORE); } catch (e) {}
      return;
    }
    if (!endpoint && !demo) { closed.hidden = false; return; }
    form.hidden = false;
    setupExtras();

    form.addEventListener('submit', function (e) {
      errorBox.hidden = true;

      if (!form.checkValidity()) {
        e.preventDefault();
        form.classList.add('was-validated');
        var firstBad = form.querySelector(':invalid');
        if (firstBad) firstBad.focus();
        showError('Please fill in the boxes marked with a star, and check the email address.');
        return;
      }

      syncDerived();
      var data = {};
      new FormData(form).forEach(function (value, key) {
        if (key.charAt(0) !== '_') data[key] = String(value).trim();
      });
      if (form.elements._honey.value) { e.preventDefault(); return; }   // a bot filled the hidden box

      if (demo) {
        e.preventDefault();
        showReceipt(data);
        return;
      }

      // Real send: a normal form post to the form service, which emails the enquiry,
      // sends the automatic reply, then returns the visitor to this page with ?sent=1.
      try { sessionStorage.setItem(STORE, JSON.stringify(data)); } catch (err) {}
      hidden('_subject', 'New enquiry: ' + data.occasion + ' (' + data.name + ')');
      hidden('_autoresponse', AUTO_REPLY);
      hidden('_template', 'table');
      hidden('_next', location.origin + location.pathname + '?sent=1');
      form.action = endpoint;
      form.method = 'POST';
      var button = form.querySelector('.form__submit');
      button.textContent = 'Sending...';
      // no preventDefault: the browser now submits the form
    });
  }

  // On the owner's own computer only, an untracked file js/enquiry.local.js may set
  // window.DF_FORM_ENDPOINT so the form can be tried before the live site is connected.
  if (!FORM_ENDPOINT && isLocal && !demo && !sent) {
    var s = document.createElement('script');
    s.src = 'js/enquiry.local.js';
    s.onload = function () { start(window.DF_FORM_ENDPOINT || ''); };
    s.onerror = function () { start(''); };
    document.head.appendChild(s);
  } else {
    start(FORM_ENDPOINT);
  }
})();
