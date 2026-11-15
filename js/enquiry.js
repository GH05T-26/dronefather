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
var FORM_ENDPOINT = '';

// The automatic email reply sent to the person enquiring (FormSubmit's
// "_autoresponse" field). FormSubmit adds a copy of what they submitted.
var AUTO_REPLY =
  'Thanks for your enquiry to The Drone_Father. This is an automatic note to confirm it arrived. ' +
  'I will reply personally with a plan and a price. To help me quote quickly, reply to this email ' +
  'with anything you have not already told me: the occasion and what the video is for; the exact ' +
  'location and date; how long the finished video should be; where it will be shown (YouTube, ' +
  'Instagram, a website, a screen at the event); and when you need it by. - The Drone_Father';
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

  function start(endpoint) {
    // Back from a real send: show the receipt.
    if (sent) {
      showReceipt(readStored() || {});
      try { sessionStorage.removeItem(STORE); } catch (e) {}
      return;
    }
    if (!endpoint && !demo) { closed.hidden = false; return; }
    form.hidden = false;

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
