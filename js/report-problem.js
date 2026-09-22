/**
 * App-wide "Report a Problem" widget - a small floating button plus a
 * modal, injected into every page's <body> on DOMContentLoaded (no
 * per-page markup needed). Lets any of the 200 users flag something
 * that isn't working, without having to track someone down verbally
 * first. Submissions go to the supportTickets Firestore collection
 * (see support-tickets.html for the admin view).
 *
 * window.openReportProblemModal(prefill) is also called by
 * js/error-monitor.js's banner "Report this" button, passing the
 * captured error message as prefill context.
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

  function buildModal() {
    var overlay = el('div', {
      id: 'report-problem-overlay',
      class: 'hidden fixed inset-0 z-[2147483000] bg-slate-900/60 flex items-center justify-center p-4'
    });

    var box = el('div', { class: 'bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden' });

    var header = el('div', { class: 'px-5 py-4 bg-slate-900 text-white flex items-center justify-between' });
    header.appendChild(el('h3', { class: 'text-sm font-bold', text: 'Report a Problem' }));
    var closeBtn = el('button', { type: 'button', class: 'text-slate-400 hover:text-white text-lg font-bold', text: '×' });
    closeBtn.onclick = function () { closeReportProblemModal(); };
    header.appendChild(closeBtn);
    box.appendChild(header);

    var body = el('div', { class: 'p-5 space-y-3 text-sm' });
    body.appendChild(el('p', { class: 'text-xs text-slate-500', text: 'Tell us what you were trying to do and what happened instead. Your page, name, and time are attached automatically.' }));

    var textarea = el('textarea', {
      id: 'report-problem-text',
      rows: '4',
      placeholder: 'e.g. I tried to submit my travel claim and nothing happened when I clicked Submit.',
      class: 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm'
    });
    body.appendChild(textarea);

    var status = el('div', { id: 'report-problem-status', class: 'hidden text-xs font-bold' });
    body.appendChild(status);

    var footer = el('div', { class: 'flex items-center justify-end space-x-2 pt-1' });
    var cancelBtn = el('button', { type: 'button', class: 'px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl', text: 'Cancel' });
    cancelBtn.onclick = function () { closeReportProblemModal(); };
    var submitBtn = el('button', { type: 'button', id: 'report-problem-submit-btn', class: 'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer', text: 'Submit Report' });
    submitBtn.onclick = function () { submitProblemReport(); };
    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);
    body.appendChild(footer);

    box.appendChild(body);
    overlay.appendChild(box);
    return overlay;
  }

  function buildFloatingButton() {
    var btn = el('button', {
      type: 'button',
      id: 'report-problem-fab',
      title: 'Report a Problem',
      class: 'fixed bottom-4 left-4 z-[2147483000] bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-full shadow-lg border border-slate-600 flex items-center space-x-1.5 cursor-pointer'
    });
    btn.innerHTML = '<span>⚠️</span><span>Report Issue</span>';
    btn.onclick = function () { window.openReportProblemModal(); };
    return btn;
  }

  window.openReportProblemModal = function (prefill) {
    var overlay = document.getElementById('report-problem-overlay');
    if (!overlay) return;
    var textarea = document.getElementById('report-problem-text');
    var status = document.getElementById('report-problem-status');
    if (status) { status.className = 'hidden text-xs font-bold'; status.textContent = ''; }
    if (textarea) {
      textarea.value = prefill ? ('The app showed this error: "' + String(prefill).slice(0, 200) + '"\n\nI was trying to: ') : '';
    }
    overlay.classList.remove('hidden');
  };

  window.closeReportProblemModal = function () {
    var overlay = document.getElementById('report-problem-overlay');
    if (overlay) overlay.classList.add('hidden');
  };

  window.submitProblemReport = function () {
    var textarea = document.getElementById('report-problem-text');
    var status = document.getElementById('report-problem-status');
    var submitBtn = document.getElementById('report-problem-submit-btn');
    var description = textarea ? textarea.value.trim() : '';

    if (!description) {
      if (status) { status.className = 'text-xs font-bold text-rose-600'; status.textContent = 'Please describe what happened.'; }
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

    var ticket = {
      description: description,
      page: window.location.pathname,
      employeeId: (function () { try { return localStorage.getItem('employeeId') || 'unknown'; } catch (e) { return 'unknown'; } })(),
      userEmail: (function () { try { return localStorage.getItem('userEmail') || 'unknown'; } catch (e) { return 'unknown'; } })(),
      userName: (function () { try { return localStorage.getItem('userName') || 'unknown'; } catch (e) { return 'unknown'; } })(),
      status: 'open',
      submittedAt: new Date().toISOString()
    };

    try {
      window.RevOpsStore.addItem('supportTickets', ticket);
    } catch (e) {}

    if (status) { status.className = 'text-xs font-bold text-emerald-600'; status.textContent = 'Thanks - reported. Someone will follow up.'; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Report'; }

    setTimeout(function () { window.closeReportProblemModal(); }, 1400);
  };

  function init() {
    if (document.getElementById('report-problem-overlay')) return;
    document.body.appendChild(buildModal());
    document.body.appendChild(buildFloatingButton());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
