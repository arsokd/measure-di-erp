/**
 * Communication Timeline - a reusable modal that shows a Gmail thread
 * (both what the app sent and what the client replied with) for a
 * Quotation, Invoice, or similar record. Injected once per page on
 * DOMContentLoaded, opened from anywhere via:
 *
 *   window.openCommunicationTimeline({ threadId, mailboxOwner, title })
 *
 * threadId/mailboxOwner come from the record itself (set by
 * js/email-service.js's Gmail send path - see js/quotations.js /
 * js/invoices.js). Reads through netlify/functions/get-gmail-thread.js,
 * which impersonates mailboxOwner via domain-wide delegation to fetch
 * the real thread, so a client's reply shows up here as soon as it
 * lands in that employee's inbox - not just what the app itself sent.
 */
(function () {
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  var currentThreadId = null;
  var currentMailboxOwner = null;

  function buildModal() {
    var overlay = el('div', {
      id: 'comm-timeline-overlay',
      class: 'hidden fixed inset-0 z-[2147482900] bg-slate-900/60 flex items-center justify-center p-4'
    });

    var box = el('div', { class: 'bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col' });

    var header = el('div', { class: 'px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0' });
    var headerTitle = el('div', {});
    headerTitle.appendChild(el('h3', { id: 'comm-timeline-title', class: 'text-sm font-bold', text: 'Email Conversation' }));
    headerTitle.appendChild(el('p', { id: 'comm-timeline-subtitle', class: 'text-[11px] text-slate-400', text: '' }));
    header.appendChild(headerTitle);

    var headerActions = el('div', { class: 'flex items-center space-x-2' });
    var refreshBtn = el('button', { type: 'button', id: 'comm-timeline-refresh', class: 'text-slate-300 hover:text-white text-xs font-bold px-2 py-1 rounded-lg border border-slate-600 cursor-pointer', text: '↻ Refresh' });
    refreshBtn.onclick = function () { loadThread(); };
    var closeBtn = el('button', { type: 'button', class: 'text-slate-400 hover:text-white text-lg font-bold', text: '×' });
    closeBtn.onclick = function () { window.closeCommunicationTimeline(); };
    headerActions.appendChild(refreshBtn);
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);
    box.appendChild(header);

    var body = el('div', { id: 'comm-timeline-body', class: 'p-5 space-y-3 overflow-y-auto text-sm bg-slate-50 flex-1' });
    box.appendChild(body);

    overlay.appendChild(box);
    return overlay;
  }

  function renderLoading() {
    var body = document.getElementById('comm-timeline-body');
    if (body) body.innerHTML = '<div class="text-center text-slate-400 text-xs py-10">Loading conversation from Gmail...</div>';
  }

  function renderError(message) {
    var body = document.getElementById('comm-timeline-body');
    if (body) {
      body.innerHTML = '';
      body.appendChild(el('div', { class: 'bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-xs font-medium', text: message }));
    }
  }

  function renderEmpty() {
    var body = document.getElementById('comm-timeline-body');
    if (body) {
      body.innerHTML = '';
      body.appendChild(el('div', { class: 'text-center text-slate-400 text-xs py-10', text: 'No email has been sent for this yet, or it was sent before the Gmail integration was set up.' }));
    }
  }

  function stripHtml(html) {
    var div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent || div.innerText || '';
  }

  function formatDate(dateHeader, internalDate) {
    try {
      if (internalDate) return new Date(Number(internalDate)).toLocaleString();
      if (dateHeader) return new Date(dateHeader).toLocaleString();
    } catch (e) {}
    return dateHeader || '';
  }

  function renderMessages(messages) {
    var body = document.getElementById('comm-timeline-body');
    if (!body) return;
    body.innerHTML = '';

    if (!messages || messages.length === 0) {
      renderEmpty();
      return;
    }

    messages.forEach(function (msg) {
      var isFromUs = (msg.from || '').indexOf('@measuredi.com') !== -1;
      var card = el('div', { class: 'bg-white border rounded-xl p-3.5 ' + (isFromUs ? 'border-indigo-200' : 'border-emerald-200') });

      var top = el('div', { class: 'flex items-center justify-between mb-1.5' });
      var fromLabel = el('span', { class: 'text-xs font-bold ' + (isFromUs ? 'text-indigo-700' : 'text-emerald-700'), text: (msg.from || 'Unknown sender') });
      var dateLabel = el('span', { class: 'text-[10px] text-slate-400', text: formatDate(msg.date, msg.internalDate) });
      top.appendChild(fromLabel);
      top.appendChild(dateLabel);
      card.appendChild(top);

      var bodyText = msg.html ? stripHtml(msg.html) : (msg.text || msg.snippet || '');
      var bodyEl = el('div', { class: 'text-xs text-slate-700 whitespace-pre-wrap leading-relaxed' });
      bodyEl.textContent = bodyText.trim().slice(0, 2000);
      card.appendChild(bodyEl);

      body.appendChild(card);
    });

    body.scrollTop = body.scrollHeight;
  }

  async function loadThread() {
    if (!currentThreadId || !currentMailboxOwner) {
      renderEmpty();
      return;
    }
    renderLoading();

    try {
      var currentUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      if (!currentUser) {
        renderError('You must be signed in to view this conversation.');
        return;
      }
      var idToken = await currentUser.getIdToken();

      var res = await fetch('/.netlify/functions/get-gmail-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ threadId: currentThreadId, mailboxOwner: currentMailboxOwner })
      });
      var data = await res.json();

      if (res.ok && data.success) {
        renderMessages(data.messages);
      } else {
        renderError(data.error || 'Could not load this conversation from Gmail.');
      }
    } catch (err) {
      renderError('Could not load this conversation: ' + (err.message || err));
    }
  }

  window.openCommunicationTimeline = function (opts) {
    opts = opts || {};
    currentThreadId = opts.threadId || null;
    currentMailboxOwner = opts.mailboxOwner || null;

    var overlay = document.getElementById('comm-timeline-overlay');
    if (!overlay) return;

    var titleEl = document.getElementById('comm-timeline-title');
    var subtitleEl = document.getElementById('comm-timeline-subtitle');
    if (titleEl) titleEl.textContent = opts.title || 'Email Conversation';
    if (subtitleEl) subtitleEl.textContent = currentMailboxOwner ? ('Mailbox: ' + currentMailboxOwner) : '';

    overlay.classList.remove('hidden');
    loadThread();
  };

  window.closeCommunicationTimeline = function () {
    var overlay = document.getElementById('comm-timeline-overlay');
    if (overlay) overlay.classList.add('hidden');
  };

  function init() {
    if (document.getElementById('comm-timeline-overlay')) return;
    document.body.appendChild(buildModal());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
