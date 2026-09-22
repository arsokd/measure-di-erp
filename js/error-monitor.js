/**
 * Global error monitor - loaded first, before every other script, on every
 * page. Two jobs:
 *   1. Turn silent JS failures (a button that "does nothing") into a
 *      visible, dismissible on-screen notice, instead of nothing at all.
 *   2. Best-effort log the error to Firestore (errorLogs) so problems can
 *      be found without waiting for a user to describe them.
 * Deliberately dependency-free (no Tailwind, no other app script) and
 * wrapped in try/catch throughout, so this file itself can never be the
 * thing that breaks the page.
 */
(function () {
  var seenErrors = {};
  var loggedCount = 0;
  var MAX_LOGGED_PER_SESSION = 20;

  function getContext() {
    try {
      return {
        page: window.location.pathname,
        employeeId: localStorage.getItem('employeeId') || 'unknown',
        userEmail: localStorage.getItem('userEmail') || 'unknown',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return { page: window.location.pathname, timestamp: new Date().toISOString() };
    }
  }

  function logToFirestore(errorInfo) {
    try {
      if (loggedCount >= MAX_LOGGED_PER_SESSION) return;
      loggedCount++;
      if (window.db && typeof window.db.collection === 'function') {
        window.db.collection('errorLogs').add(errorInfo).catch(function () {});
      }
    } catch (e) {}
  }

  function showBanner(message) {
    try {
      var existing = document.getElementById('__err_monitor_banner');
      if (existing) {
        var msgEl = existing.querySelector('[data-err-count]');
        if (msgEl) {
          var n = Number(msgEl.getAttribute('data-err-count')) + 1;
          msgEl.setAttribute('data-err-count', n);
          msgEl.textContent = n + ' issues detected on this page. Try again, or tap Report below.';
        }
        return;
      }

      var banner = document.createElement('div');
      banner.id = '__err_monitor_banner';
      banner.style.cssText = 'position:fixed;bottom:16px;right:16px;max-width:340px;background:#1f2937;color:#fff;padding:14px 16px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.35);z-index:2147483647;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;';

      var title = document.createElement('div');
      title.style.cssText = 'font-weight:700;margin-bottom:4px;';
      title.textContent = '⚠ Something didn\'t work as expected';

      var msg = document.createElement('div');
      msg.setAttribute('data-err-count', '1');
      msg.style.cssText = 'color:#d1d5db;margin-bottom:10px;';
      msg.textContent = 'The action may not have completed. Try again, and if it keeps happening, tap Report below.';

      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:8px;';

      var reportBtn = document.createElement('button');
      reportBtn.type = 'button';
      reportBtn.textContent = 'Report this';
      reportBtn.style.cssText = 'background:#4f46e5;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;';
      reportBtn.onclick = function () {
        if (typeof window.openReportProblemModal === 'function') {
          window.openReportProblemModal(message);
        } else {
          alert('Please tell your admin what you were doing when this happened.');
        }
      };

      var dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.textContent = 'Dismiss';
      dismissBtn.style.cssText = 'background:transparent;color:#9ca3af;border:1px solid #4b5563;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;';
      dismissBtn.onclick = function () { banner.remove(); };

      btnRow.appendChild(reportBtn);
      btnRow.appendChild(dismissBtn);
      banner.appendChild(title);
      banner.appendChild(msg);
      banner.appendChild(btnRow);

      if (document.body) {
        document.body.appendChild(banner);
      } else {
        document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(banner); });
      }
    } catch (e) {}
  }

  function handleError(message, source, lineno, colno, errorObj) {
    try {
      var signature = String(message) + '|' + (source || '') + '|' + (lineno || 0);
      if (seenErrors[signature]) return;
      seenErrors[signature] = true;

      var info = getContext();
      info.message = String(message).slice(0, 500);
      info.source = source || '';
      info.lineno = lineno || 0;
      info.colno = colno || 0;
      info.stack = (errorObj && errorObj.stack) ? String(errorObj.stack).slice(0, 2000) : '';

      logToFirestore(info);

      var isBenign = /ResizeObserver loop|^Script error\.?$/.test(String(message));
      if (!isBenign) {
        showBanner(message);
      }
    } catch (e) {}
  }

  window.onerror = function (message, source, lineno, colno, errorObj) {
    handleError(message, source, lineno, colno, errorObj);
    return false;
  };

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var message = (reason && reason.message) ? reason.message : String(reason);
    handleError('Unhandled promise rejection: ' + message, window.location.href, 0, 0, reason);
  });
})();
