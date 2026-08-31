(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const t = key => TeaI18n.t(key);
  const backdrop = $('feedbackBackdrop'), dialog = $('feedbackDialog');
  const input = $('feedbackMessage'), send = $('feedbackSend'), status = $('feedbackStatus');
  const page = document.querySelector('.page'), applause = $('applause');
  // Development pages must never write fixture messages into the production inbox.
  const endpoint = location.origin === 'https://winterrainlee.github.io'
    ? 'https://tea-timer-reactions.winterrain-lee.workers.dev/messages' : '/api/messages';
  let busy = false, composing = false, opener = null, retry = null;
  let statusKey = '', statusError = false;
  function render() {
    const size = Array.from(input.value).length;
    $('feedbackCount').textContent = `${size.toLocaleString(TeaI18n.getLocale())} / 1,000`;
    input.setAttribute('aria-invalid', String(size > 1000));
    input.readOnly = busy;
    send.disabled = busy || composing || !input.value.trim() || size > 1000;
    send.textContent = t(busy ? 'feedback.sending' : 'feedback.send');
    $('feedbackForm').setAttribute('aria-busy', String(busy));
    status.textContent = statusKey ? t(statusKey) : '';
    status.dataset.error = String(statusError);
  }
  function setStatus(key, error = false) { statusKey = key; statusError = error; render(); }
  function open() {
    if (!backdrop.hidden) return;
    opener = document.activeElement;
    backdrop.hidden = false; backdrop.inert = false;
    dialog.setAttribute('aria-modal', 'true');
    document.body.classList.add('has-feedback');
    page.inert = true; applause.inert = true;
    $('feedbackClose').focus({preventScroll:true});
    page.setAttribute('aria-hidden', 'true'); applause.setAttribute('aria-hidden', 'true');
    dialog.scrollTop = 0;
    render();
  }
  function close() {
    page.inert = false; applause.inert = false;
    page.removeAttribute('aria-hidden'); applause.removeAttribute('aria-hidden');
    dialog.removeAttribute('aria-modal');
    document.body.classList.remove('has-feedback');
    backdrop.hidden = true; backdrop.inert = true;
    if (opener?.isConnected) opener.focus({preventScroll:true});
  }
  function uuid() {
    // getRandomValues also works on the LAN HTTP preview, unlike randomUUID.
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = Array.from(b, v => v.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  function responseError(code, httpStatus) {
    if (code === 'rate_limited' || httpStatus === 429) return 'feedback.rateLimited';
    if (httpStatus === 413 || code === 'message_too_long' || code === 'payload_too_large') return 'feedback.tooLong';
    if (httpStatus === 409) return 'feedback.conflict';
    if ([404, 503].includes(httpStatus)) return 'feedback.unavailable';
    return 'feedback.failed';
  }
  $('feedbackForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || composing || event.isComposing) return;
    const message = input.value;
    if (!message.trim()) { setStatus('feedback.empty', true); input.focus(); return; }
    if (Array.from(message).length > 1000) { setStatus('feedback.tooLong', true); input.focus(); return; }
    if (!navigator.onLine) { setStatus('feedback.offline', true); return; }
    try {
      // Keep the payload stable after an uncertain result, even if the UI locale changes.
      if (!retry || retry.message !== message) retry = {app:'tea-timer', requestId:uuid(), message, locale:TeaI18n.getLocale()};
    } catch { setStatus('feedback.failed', true); return; }
    busy = true; setStatus('feedback.sending');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method:'POST', headers:{'Content-Type':'application/json'},
        credentials:'omit', cache:'no-store', signal:controller.signal, body:JSON.stringify(retry),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true || !Number.isSafeInteger(result.id) || result.id < 1 || typeof result.created_at !== 'string' || !/Z$|[+-]\d{2}:\d{2}$/.test(result.created_at) || !Number.isFinite(Date.parse(result.created_at))) {
        setStatus(responseError(result?.error, response.status), true);
        return;
      }
      input.value = ''; retry = null;
      setStatus('feedback.sent');
    } catch (error) {
      setStatus(error.name === 'AbortError' ? 'feedback.timeout' : 'feedback.failed', true);
    } finally { clearTimeout(timer); busy = false; render(); }
  });
  input.addEventListener('input', () => { if (!busy && !composing) setStatus(''); else render(); });
  input.addEventListener('compositionstart', () => { composing = true; render(); });
  input.addEventListener('compositionend', () => { composing = false; render(); });
  $('feedbackOpen').addEventListener('click', open);
  $('feedbackClose').addEventListener('click', close);
  backdrop.addEventListener('click', event => { if (event.target === backdrop && !composing) close(); });
  document.addEventListener('focusin', event => {
    if (!backdrop.hidden && !dialog.contains(event.target)) $('feedbackClose').focus();
  });
  document.addEventListener('keydown', event => {
    if (backdrop.hidden || composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const items = [...dialog.querySelectorAll('button, textarea')].filter(el => !el.disabled);
      const index = items.indexOf(document.activeElement);
      event.preventDefault();
      const next = index < 0 ? (event.shiftKey ? items.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + items.length) % items.length;
      items[next].focus();
    }
  });
  window.addEventListener('beforeunload', event => {
    if (!input.value && !busy) return;
    event.preventDefault(); event.returnValue = '';
  });
  TeaI18n.onChange(render);
  render();
})();
