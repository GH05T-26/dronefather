// The Drone_Father - enquiry form.
//
// ---------------------------------------------------------------------------
// SETTINGS (the only part that normally needs editing)
// ---------------------------------------------------------------------------
// FORM_ENDPOINT: where enquiries are sent. While this is empty the page shows
// "Enquiries open here soon" instead of the form, so the live site never has a
// form that goes nowhere. See PROJECT_HANDOFF.md section 9c for how to get one.
var FORM_ENDPOINT = '';

// The automatic email reply sent to the person enquiring (used by form services
// that support an auto-reply field, e.g. FormSubmit's "_autoresponse").
var AUTO_REPLY =
  'Thanks for your enquiry to The Drone_Father. This is an automatic note to confirm it arrived.\n\n' +
  'I will reply personally with a plan and a price. To help me quote quickly, reply to this email ' +
  'with anything you have not already told me:\n' +
  '- the occasion and what the video is for\n' +
  '- the exact location and date\n' +
  '- how long the finished video should be\n' +
  '- where it will be shown (YouTube, Instagram, a website, a screen at the event)\n' +
  '- when you need it by\n\n' +
  'The Drone_Father';
// ---------------------------------------------------------------------------

(function () {
  var form = document.getElementById('enquiryForm');
  var closed = document.getElementById('formClosed');
  var receipt = document.getElementById('receipt');
  var errorBox = document.getElementById('formError');
  if (!form) return;

  // Add ?demo=1 to the address to try the form without sending anything.
  var demo = /[?&]demo=1/.test(location.search);

  if (!FORM_ENDPOINT && !demo) {
    closed.hidden = false;
    return;
  }
  form.hidden = false;

  var labels = {
    occasion: 'Occasion', length: 'Video length', location: 'Location', date: 'Date',
    format: 'Shown on', deadline: 'Needed by', budget: 'Budget', details: 'Notes'
  };

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  function showReceipt(data) {
    document.getElementById('receiptTitle').textContent = 'Got it, ' + data.name.split(' ')[0];
    document.getElementById('receiptLead').textContent =
      'Your enquiry has arrived and a confirmation is on its way to ' + data.email +
      '. You will get a personal reply with a plan and a price. Here is what you sent:';

    var list = document.getElementById('receiptList');
    list.textContent = '';
    Object.keys(labels).forEach(function (key) {
      if (!data[key]) return;
      var dt = document.createElement('dt'); dt.textContent = labels[key];
      var dd = document.createElement('dd'); dd.textContent = data[key];
      list.appendChild(dt); list.appendChild(dd);
    });

    // Prompt for the key details that were left blank or vague.
    var asks = [];
    if (!data.date) asks.push('The date, or a rough window if it is flexible.');
    if (!data.deadline) asks.push('When you need the finished video by.');
    if (data.length === 'Not sure yet') asks.push('A rough length: a short clip for socials, or a longer piece?');
    if (data.format === 'Not sure') asks.push('Where it will be shown: YouTube, Instagram, a website, a screen at the event?');
    if (!data.details) asks.push('A link to a video you like the look of.');
    if (!data.budget) asks.push('A rough budget, so the plan fits it.');
    asks = asks.slice(0, 3);
    var more = document.getElementById('receiptMore');
    var ul = document.getElementById('receiptAsks');
    ul.textContent = '';
    asks.forEach(function (a) { var li = document.createElement('li'); li.textContent = a; ul.appendChild(li); });
    more.hidden = asks.length === 0;

    form.hidden = true;
    receipt.hidden = false;
    receipt.focus();
    receipt.scrollIntoView({ block: 'start' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.hidden = true;

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      var firstBad = form.querySelector(':invalid');
      if (firstBad) firstBad.focus();
      showError('Please fill in the boxes marked with a star, and check the email address.');
      return;
    }

    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = String(value).trim(); });
    if (data._honey) return;            // a bot filled the hidden box: drop silently
    delete data._honey;

    var button = form.querySelector('.form__submit');
    button.disabled = true;
    button.textContent = 'Sending...';
    function reset() { button.disabled = false; button.textContent = 'Send enquiry'; }

    if (demo) {
      setTimeout(function () { reset(); showReceipt(data); }, 600);
      return;
    }

    var payload = Object.assign({}, data, {
      _subject: 'New enquiry: ' + data.occasion + ' (' + data.name + ')',
      _replyto: data.email,
      _autoresponse: AUTO_REPLY,
      _template: 'table'
    });

    fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('Form service replied ' + res.status);
      reset();
      showReceipt(data);
    }).catch(function () {
      reset();
      showError('Sorry, that did not send. Please try again, or message us on Instagram instead.');
    });
  });
})();
