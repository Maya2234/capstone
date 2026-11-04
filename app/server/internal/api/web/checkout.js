/*
 * CardStack Checkout Button (I1, REQ-01).
 *
 *   <script src="https://<cardstack-host>/static/checkout.js"></script>
 *   <div id="cardstack-button"></div>
 *   CardStack.mount('#cardstack-button', {
 *     buttonId: 'btn_...',
 *     createSession: () => fetch('/your-server/cardstack-session', {method: 'POST'}).then(r => r.json()),
 *     onResult: (result) => { ... }   // { status: 'approved' | 'declined', orderId, transactionId, ... }
 *   });
 *
 * createSession must call POST /server/v1/merchant/checkout-sessions from the
 * merchant's server (it needs the secret API key) and return its JSON.
 */
(function () {
  var script = document.currentScript;
  var API = script ? new URL(script.src).origin : '';

  function css() {
    if (document.getElementById('cardstack-css')) return;
    var s = document.createElement('style');
    s.id = 'cardstack-css';
    s.textContent =
      '.cardstack-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:48px;' +
      'padding:0 20px;border:0;border-radius:10px;background:#111827;color:#fff;font:600 16px/1 system-ui,-apple-system,Segoe UI,sans-serif;' +
      'cursor:pointer;transition:transform .08s ease,background .15s ease}' +
      '.cardstack-btn:hover{background:#1f2937}.cardstack-btn:active{transform:scale(.98)}' +
      '.cardstack-btn:disabled{opacity:.6;cursor:progress}' +
      '.cardstack-btn svg{flex:none}' +
      '.cardstack-btn.light{background:#fff;color:#111827;box-shadow:inset 0 0 0 1.5px #111827}';
    document.head.appendChild(s);
  }

  var logo =
    '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="8" width="16" height="11" rx="2.5" fill="#34D399"/>' +
    '<rect x="4" y="5.5" width="16" height="11" rx="2.5" fill="#38BDF8"/><rect x="6" y="3" width="16" height="11" rx="2.5" fill="#A78BFA"/></svg>';

  function mount(target, opts) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el || !opts || !opts.buttonId || !opts.createSession) {
      throw new Error('CardStack.mount needs a target, buttonId and createSession');
    }
    css();
    fetch(API + '/server/v1/button/' + encodeURIComponent(opts.buttonId), { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (cfg) { render(el, cfg, opts); })
      .catch(function () {
        // ButtonNotAllowed or network error: show no button (REQ-01).
        el.innerHTML = '';
        if (opts.onUnavailable) opts.onUnavailable();
      });
  }

  function render(el, cfg, opts) {
    var dc = cfg.displayConfig || {};
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cardstack-btn' + (dc.theme === 'light' ? ' light' : '');
    btn.innerHTML = logo + '<span>' + (dc.label || 'Pay with CardStack') + '</span>';
    btn.addEventListener('click', function () { start(btn, opts); });
    el.innerHTML = '';
    el.appendChild(btn);
  }

  function start(btn, opts) {
    // Open the popup synchronously so browsers do not block it.
    var w = 440, h = 680;
    var left = window.screenX + (window.outerWidth - w) / 2, top = window.screenY + (window.outerHeight - h) / 2;
    var popup = window.open('', 'cardstack_checkout', 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top);
    if (popup) popup.document.write('<p style="font:16px system-ui;padding:24px">Opening CardStack…</p>');
    btn.disabled = true;

    Promise.resolve(opts.createSession())
      .then(function (session) {
        if (!session || !session.checkoutUrl) throw new Error('createSession returned no checkoutUrl');
        if (popup && !popup.closed) {
          popup.location = session.checkoutUrl;
          watch(popup, btn, opts);
        } else {
          window.location.href = session.checkoutUrl; // popup blocked: full-page checkout
        }
      })
      .catch(function (err) {
        if (popup) popup.close();
        btn.disabled = false;
        if (opts.onError) opts.onError(err);
      });
  }

  function watch(popup, btn, opts) {
    function onMessage(e) {
      if (e.origin !== API || !e.data || e.data.type !== 'cardstack:result') return;
      cleanup();
      if (opts.onResult) opts.onResult(e.data.result);
    }
    var timer = setInterval(function () {
      if (popup.closed) { cleanup(); if (opts.onClose) opts.onClose(); }
    }, 500);
    function cleanup() {
      window.removeEventListener('message', onMessage);
      clearInterval(timer);
      btn.disabled = false;
    }
    window.addEventListener('message', onMessage);
  }

  window.CardStack = { mount: mount, apiOrigin: API };
})();
