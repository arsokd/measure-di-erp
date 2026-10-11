// Telegram bot webhook: a button/menu-driven Q&A interface over the ERP's
// Firestore data for a small allowlist of Telegram users (the admin + a
// few managers). Deliberately zero-LLM for v1 - every reply comes from a
// fixed menu of pre-built queries, selected by tapping an inline button
// (never free-typed text), so there's no ambiguity to resolve and no
// Anthropic API cost. See reset-password.js for the same firebase-admin
// init pattern this reuses.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initFirebaseAdmin() {
  if (getApps().length > 0) return getApps()[0];
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!saEnv) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing.');
  let serviceAccount;
  try {
    serviceAccount = typeof saEnv === 'string' ? JSON.parse(saEnv) : saEnv;
  } catch (err) {
    throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON string: ' + err.message);
  }
  return initializeApp({ credential: cert(serviceAccount) });
}

function getAllowedUserIds() {
  var raw = process.env.TELEGRAM_ALLOWED_USER_IDS || '';
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

async function callTelegramApi(method, payload) {
  var token = process.env.TELEGRAM_BOT_TOKEN;
  var res = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  var data = await res.json().catch(function () { return {}; });
  if (!data.ok) console.warn('Telegram API ' + method + ' failed:', data.description || data);
  return data;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatINR(n) {
  var v = Number(n) || 0;
  return '₹' + v.toLocaleString('en-IN');
}

// This app's own date convention throughout (store.js getFormattedToday,
// attendance.date, dwmActivities.date, etc.) is DD/MM/YYYY strings, not
// native Date/Timestamp fields - these helpers parse/format the same way.
function todayDDMMYYYY() {
  var d = new Date();
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + '/' + d.getFullYear();
}

function parseDDMMYYYY(s) {
  if (!s || typeof s !== 'string') return null;
  var parts = s.split('/');
  if (parts.length !== 3) return null;
  var d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  return isNaN(d.getTime()) ? null : d;
}

function isThisMonth(dateStr) {
  var d = parseDDMMYYYY(dateStr);
  if (!d) return false;
  var now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

async function getCol(db, name) {
  var snap = await db.collection(name).get();
  return snap.docs.map(function (d) { return d.data(); });
}

// ---- Menu structure -------------------------------------------------
var MENUS = {
  main: {
    text: '📊 <b>K-30 ERP Assistant</b>\nPick a category:',
    buttons: [
      [{ text: '📈 Sales & Pipeline', callback_data: 'menu:sales' }],
      [{ text: '✅ Attendance & DWM', callback_data: 'menu:attendance' }],
      [{ text: '💰 Finance', callback_data: 'menu:finance' }],
      [{ text: '🔧 Service & AMC', callback_data: 'menu:service' }],
      [{ text: '📋 Approvals', callback_data: 'menu:approvals' }]
    ]
  },
  sales: {
    text: '📈 <b>Sales & Pipeline</b>',
    buttons: [
      [{ text: 'Leads by Stage', callback_data: 'q:sales:bystage' }],
      [{ text: 'Won This Month', callback_data: 'q:sales:won' }],
      [{ text: 'Lost This Month', callback_data: 'q:sales:lost' }],
      [{ text: 'Pending Follow-ups', callback_data: 'q:sales:followups' }],
      [{ text: '⬅ Back', callback_data: 'menu:main' }]
    ]
  },
  attendance: {
    text: '✅ <b>Attendance & DWM</b>',
    buttons: [
      [{ text: "Today's Attendance", callback_data: 'q:att:today' }],
      [{ text: "Who Hasn't Punched In", callback_data: 'q:att:notpunched' }],
      [{ text: "Today's DWM Accomplishment", callback_data: 'q:att:dwmtoday' }],
      [{ text: '⬅ Back', callback_data: 'menu:main' }]
    ]
  },
  finance: {
    text: '💰 <b>Finance</b>',
    buttons: [
      [{ text: 'Outstanding Receivables', callback_data: 'q:fin:outstanding' }],
      [{ text: 'Overdue Invoices', callback_data: 'q:fin:overdue' }],
      [{ text: 'Pending Expenses', callback_data: 'q:fin:expenses' }],
      [{ text: '⬅ Back', callback_data: 'menu:main' }]
    ]
  },
  service: {
    text: '🔧 <b>Service & AMC</b>',
    buttons: [
      [{ text: 'Open Tickets', callback_data: 'q:svc:open' }],
      [{ text: 'Overdue SLA Tickets', callback_data: 'q:svc:overdue' }],
      [{ text: 'AMC Renewals Due Soon', callback_data: 'q:svc:amc' }],
      [{ text: '⬅ Back', callback_data: 'menu:main' }]
    ]
  },
  approvals: {
    text: '📋 <b>Approvals</b>',
    buttons: [
      [{ text: 'Pending Approvals (all types)', callback_data: 'q:appr:pending' }],
      [{ text: '⬅ Back', callback_data: 'menu:main' }]
    ]
  }
};

// ---- Query handlers ---------------------------------------------------
// Each returns an HTML-formatted string (Telegram parse_mode: 'HTML').
var QUERIES = {
  'sales:bystage': async function (db) {
    var leads = await getCol(db, 'leads');
    var active = leads.filter(function (l) { return ['Lost', 'Trashed', 'Postponed'].indexOf(l.status) === -1; });
    var byStage = {};
    active.forEach(function (l) {
      var s = l.stage || l.status || 'Unknown';
      byStage[s] = (byStage[s] || 0) + 1;
    });
    var totalValue = active.reduce(function (sum, l) { return sum + (Number(l.dealValue) || 0); }, 0);
    var lines = Object.keys(byStage).map(function (s) { return '• ' + escapeHtml(s) + ': <b>' + byStage[s] + '</b>'; });
    return '<b>Active Leads by Stage</b> (' + active.length + ' total)\n' + lines.join('\n') + '\n\nTotal pipeline value: <b>' + formatINR(totalValue) + '</b>';
  },
  'sales:won': async function (db) {
    var leads = await getCol(db, 'leads');
    var won = leads.filter(function (l) { return l.status === 'Won' && isThisMonth(l.wonDate || l.updatedAt); });
    var value = won.reduce(function (sum, l) { return sum + (Number(l.dealValue) || 0); }, 0);
    return '<b>Won This Month:</b> ' + won.length + ' lead(s)\nValue: <b>' + formatINR(value) + '</b>';
  },
  'sales:lost': async function (db) {
    var leads = await getCol(db, 'leads');
    var lost = leads.filter(function (l) { return l.status === 'Lost' && isThisMonth(l.lostDate || l.updatedAt); });
    var lines = lost.slice(0, 10).map(function (l) { return '• ' + escapeHtml(l.customerName) + (l.lostReason ? ' (' + escapeHtml(l.lostReason) + ')' : ''); });
    return '<b>Lost This Month:</b> ' + lost.length + ' lead(s)' + (lines.length ? '\n' + lines.join('\n') : '');
  },
  'sales:followups': async function (db) {
    var leads = await getCol(db, 'leads');
    var active = leads.filter(function (l) { return ['Won', 'Lost', 'Trashed'].indexOf(l.status) === -1; });
    var stale = active.filter(function (l) {
      var last = parseDDMMYYYY(l.lastActivityDate) || parseDDMMYYYY(l.createdDate);
      if (!last) return true;
      var days = (Date.now() - last.getTime()) / 86400000;
      return days >= 7;
    });
    var lines = stale.slice(0, 15).map(function (l) { return '• ' + escapeHtml(l.customerName) + ' (' + escapeHtml(l.stage || l.status) + ')'; });
    return '<b>Pending Follow-ups</b> (no activity 7+ days): ' + stale.length + '\n' + lines.join('\n');
  },
  'att:today': async function (db) {
    var today = todayDDMMYYYY();
    var attendance = await getCol(db, 'attendance');
    var employees = await getCol(db, 'employees');
    var todayAtt = attendance.filter(function (a) { return a.date === today; });
    var activeEmployees = employees.filter(function (e) { return e.isActive !== false; });
    return "<b>Today's Attendance:</b> " + todayAtt.length + ' / ' + activeEmployees.length;
  },
  'att:notpunched': async function (db) {
    var today = todayDDMMYYYY();
    var attendance = await getCol(db, 'attendance');
    var employees = await getCol(db, 'employees');
    var punchedIds = attendance.filter(function (a) { return a.date === today; }).map(function (a) { return a.employeeId; });
    var activeEmployees = employees.filter(function (e) { return e.isActive !== false; });
    var notPunched = activeEmployees.filter(function (e) { return punchedIds.indexOf(e.employeeId) === -1; });
    var lines = notPunched.slice(0, 25).map(function (e) { return '• ' + escapeHtml(e.name) + ' (' + escapeHtml(e.employeeId) + ')'; });
    return "<b>Not Punched In Today:</b> " + notPunched.length + (lines.length ? '\n' + lines.join('\n') : '');
  },
  'att:dwmtoday': async function (db) {
    var today = todayDDMMYYYY();
    var dwm = await getCol(db, 'dwmActivities');
    var todayDwm = dwm.filter(function (a) { return a.date === today; });
    var ticked = todayDwm.filter(function (a) { return a.isTicked !== false; });
    var done = ticked.filter(function (a) { return a.accomplishmentStatus === 'Done'; });
    var pct = ticked.length > 0 ? Math.round(done.length / ticked.length * 100) : 0;
    return "<b>Today's DWM Accomplishment:</b> " + pct + '% (' + done.length + ' / ' + ticked.length + ' planned activities marked Done)';
  },
  'fin:outstanding': async function (db) {
    var invoices = await getCol(db, 'invoices');
    var outstanding = invoices.reduce(function (sum, inv) {
      var grand = Number(inv.grandTotal) || 0;
      var paid = (Number(inv.paidAmount) || 0) + (Number(inv.tdsDeducted) || 0);
      return sum + Math.max(0, grand - paid);
    }, 0);
    return '<b>Outstanding Receivables:</b> ' + formatINR(outstanding);
  },
  'fin:overdue': async function (db) {
    var invoices = await getCol(db, 'invoices');
    var today = new Date();
    var overdue = invoices.filter(function (inv) {
      var grand = Number(inv.grandTotal) || 0;
      var paid = (Number(inv.paidAmount) || 0) + (Number(inv.tdsDeducted) || 0);
      if (grand - paid <= 0) return false;
      var due = parseDDMMYYYY(inv.dueDate);
      return due && due < today;
    });
    var value = overdue.reduce(function (sum, inv) { return sum + ((Number(inv.grandTotal) || 0) - (Number(inv.paidAmount) || 0) - (Number(inv.tdsDeducted) || 0)); }, 0);
    var lines = overdue.slice(0, 15).map(function (inv) { return '• ' + escapeHtml(inv.invoiceNumber || inv.id) + ' - ' + escapeHtml(inv.customerName) + ' (due ' + escapeHtml(inv.dueDate) + ')'; });
    return '<b>Overdue Invoices:</b> ' + overdue.length + ' (' + formatINR(value) + ')' + (lines.length ? '\n' + lines.join('\n') : '');
  },
  'fin:expenses': async function (db) {
    var expenses = await getCol(db, 'expenses');
    var pending = expenses.filter(function (e) { return (e.status || '').indexOf('Pending') === 0; });
    var value = pending.reduce(function (sum, e) { return sum + (Number(e.amount) || 0); }, 0);
    return '<b>Pending Expenses:</b> ' + pending.length + ' (' + formatINR(value) + ')';
  },
  'svc:open': async function (db) {
    var tickets = await getCol(db, 'serviceTickets');
    var open = tickets.filter(function (t) { return ['Open', 'In Progress', 'Pending Parts'].indexOf(t.status) !== -1; });
    var byEng = {};
    open.forEach(function (t) { var e = t.assignedToName || t.assignedTo || 'Unassigned'; byEng[e] = (byEng[e] || 0) + 1; });
    var lines = Object.keys(byEng).map(function (e) { return '• ' + escapeHtml(e) + ': ' + byEng[e]; });
    return '<b>Open Service Tickets:</b> ' + open.length + '\n' + lines.join('\n');
  },
  'svc:overdue': async function (db) {
    var tickets = await getCol(db, 'serviceTickets');
    var today = new Date();
    var overdue = tickets.filter(function (t) {
      if (['Open', 'In Progress', 'Pending Parts'].indexOf(t.status) === -1) return false;
      var sla = parseDDMMYYYY(t.targetSlaDate);
      return sla && sla < today;
    });
    var lines = overdue.slice(0, 15).map(function (t) { return '• ' + escapeHtml(t.ticketNumber || t.id) + ' - ' + escapeHtml(t.customerName) + ' (SLA ' + escapeHtml(t.targetSlaDate) + ')'; });
    return '<b>Overdue-SLA Tickets:</b> ' + overdue.length + (lines.length ? '\n' + lines.join('\n') : '');
  },
  'svc:amc': async function (db) {
    var contracts = await getCol(db, 'amcContracts');
    var today = new Date();
    var in60Days = new Date(today.getTime() + 60 * 86400000);
    var due = contracts.filter(function (c) {
      var end = c.endDate ? new Date(c.endDate) : null;
      return end && end >= today && end <= in60Days;
    });
    var lines = due.slice(0, 15).map(function (c) { return '• ' + escapeHtml(c.customerName) + ' (ends ' + escapeHtml(c.endDate) + ')'; });
    return '<b>AMC Renewals Due (next 60 days):</b> ' + due.length + (lines.length ? '\n' + lines.join('\n') : '');
  },
  // Org-wide pending counts, not routed to a specific approver - a
  // deliberate simplification for v1 (no Telegram-user-to-employee
  // identity mapping yet; that's needed before per-person routing or
  // Approve/Reject buttons can be added safely).
  'appr:pending': async function (db) {
    var quotations = await getCol(db, 'quotations');
    var orders = await getCol(db, 'orders');
    var expenses = await getCol(db, 'expenses');
    var travelApprovals = await getCol(db, 'travelApprovals');
    var pendingQuotes = quotations.filter(function (q) { return q.status === 'Pending Approval'; }).length;
    var pendingOrders = orders.filter(function (o) { return o.status === 'Pending Approval'; }).length;
    var pendingExpenses = expenses.filter(function (e) { return (e.status || '').indexOf('Pending') === 0; }).length;
    var pendingTravel = travelApprovals.filter(function (t) { return (t.status || '').indexOf('Pending') === 0; }).length;
    return '<b>Pending Approvals (org-wide):</b>\n' +
      '• Quotations: ' + pendingQuotes + '\n' +
      '• Orders: ' + pendingOrders + '\n' +
      '• Expenses: ' + pendingExpenses + '\n' +
      '• Travel Pre-Approvals: ' + pendingTravel;
  }
};

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  var update;
  try {
    update = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  var fromId = (update.message && update.message.from && String(update.message.from.id)) ||
    (update.callback_query && update.callback_query.from && String(update.callback_query.from.id));
  var chatId = (update.message && update.message.chat && update.message.chat.id) ||
    (update.callback_query && update.callback_query.message && update.callback_query.message.chat.id);

  if (!fromId || !chatId) {
    return { statusCode: 200, body: 'ok' }; // nothing actionable
  }

  var allowed = getAllowedUserIds();
  if (allowed.indexOf(fromId) === -1) {
    if (update.message) {
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: 'You are not authorized to use this bot. Your Telegram user ID is ' + fromId + ' - share this with your admin to be added.'
      });
    }
    return { statusCode: 200, body: 'ok' };
  }

  try {
    initFirebaseAdmin();
    var db = getFirestore();

    if (update.message) {
      var text = (update.message.text || '').trim();
      if (text === '/start' || text === '/menu') {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: MENUS.main.text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: MENUS.main.buttons }
        });
      }
      return { statusCode: 200, body: 'ok' };
    }

    if (update.callback_query) {
      var cq = update.callback_query;
      var data = cq.data || '';
      await callTelegramApi('answerCallbackQuery', { callback_query_id: cq.id });

      if (data.indexOf('menu:') === 0) {
        var menuKey = data.slice(5);
        var menu = MENUS[menuKey] || MENUS.main;
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: cq.message.message_id,
          text: menu.text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: menu.buttons }
        });
      } else if (data.indexOf('q:') === 0) {
        var queryKey = data.slice(2);
        var fn = QUERIES[queryKey];
        var resultText = fn ? await fn(db) : 'Unknown query.';
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: resultText,
          parse_mode: 'HTML'
        });
      }
      return { statusCode: 200, body: 'ok' };
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('telegram-webhook error:', err);
    if (chatId) {
      await callTelegramApi('sendMessage', { chat_id: chatId, text: 'Something went wrong fetching that. Please try again shortly.' }).catch(function () {});
    }
    return { statusCode: 200, body: 'ok' }; // always 200 so Telegram doesn't retry-storm
  }
}
