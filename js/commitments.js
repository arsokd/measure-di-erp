// js/commitments.js - Commitment Register (A-1 from the 24-Nov K-30 review)
// Every commitment made in a review meeting, tracked centrally: who owes
// what, who asked for it, which vertical/meeting it came from, by when,
// and its current status - instead of scattered meeting notes nobody
// reviews. Overdue items show in red; the global "Commitments Due" popup
// (auth-guard.js) nags the owner daily until it's actually logged done.

document.addEventListener('DOMContentLoaded', function() {
  if (checkAuth(['admin', 'manager', 'staff'])) {
    initCommitmentsPage();
  }
});

function canDeleteCommitment() {
  var role = localStorage.getItem('userRole');
  return role === 'super_admin' || role === 'admin';
}

function initCommitmentsPage() {
  populateCommitmentDropdowns();
  renderCommitmentsTable();
}

function populateCommitmentDropdowns() {
  var employees = window.RevOpsStore.getCollection('employees') || [];
  var verticals = (window.RevOpsStore.getCollection('verticalClassificationMaster') || []).filter(function(it) { return it.isActive !== false; });

  var empOptionsHtml = employees.map(function(e) {
    return '<option value="' + escapeHtml(e.employeeId) + '">' + escapeHtml(e.fullName) + ' (' + escapeHtml(e.employeeId) + ')</option>';
  }).join('');

  var ownerSelect = document.getElementById('inp-commit-owner');
  var givenBySelect = document.getElementById('inp-commit-givenby');
  if (ownerSelect) ownerSelect.innerHTML = empOptionsHtml;
  if (givenBySelect) givenBySelect.innerHTML = empOptionsHtml;

  var ownerFilter = document.getElementById('commit-owner-filter');
  if (ownerFilter) {
    ownerFilter.innerHTML = '<option value="All">All Owners</option>' + empOptionsHtml;
  }

  var vertOptionsHtml = verticals.map(function(v) {
    return '<option value="' + escapeHtml(v.name) + '">' + escapeHtml(v.name) + '</option>';
  }).join('');
  var vertSelect = document.getElementById('inp-commit-vertical');
  if (vertSelect) vertSelect.innerHTML = vertOptionsHtml;
  var vertFilter = document.getElementById('commit-vertical-filter');
  if (vertFilter) vertFilter.innerHTML = '<option value="All">All Verticals</option>' + vertOptionsHtml;
}

function openCommitmentModal(docId) {
  populateCommitmentDropdowns();
  document.getElementById('commitment-form').reset();
  document.getElementById('commit-doc-id').value = '';

  if (docId) {
    var items = window.RevOpsStore.getCollection('commitments') || [];
    var rec = items.find(function(it) { return it.id === docId; });
    if (!rec) return;
    document.getElementById('commitment-modal-title').innerText = 'Edit Commitment';
    document.getElementById('commit-doc-id').value = rec.id;
    document.getElementById('inp-commit-text').value = rec.commitment || '';
    document.getElementById('inp-commit-owner').value = rec.employeeId || '';
    document.getElementById('inp-commit-givenby').value = rec.givenByEmployeeId || '';
    document.getElementById('inp-commit-vertical').value = rec.vertical || '';
    document.getElementById('inp-commit-meeting').value = rec.meetingName || '';
    document.getElementById('inp-commit-datepromised').value = rec.datePromised || '';
    document.getElementById('inp-commit-status').value = rec.status || 'Pending';
    document.getElementById('inp-commit-remarks').value = rec.remarks || '';
  } else {
    document.getElementById('commitment-modal-title').innerText = 'Add Commitment';
    var myEmpId = localStorage.getItem('employeeId') || '';
    document.getElementById('inp-commit-owner').value = myEmpId;
    document.getElementById('inp-commit-givenby').value = myEmpId;
    document.getElementById('inp-commit-datepromised').value = getLocalTodayISO();
    document.getElementById('inp-commit-status').value = 'Pending';
  }

  document.getElementById('commitment-modal').classList.remove('hidden');
}
window.openCommitmentModal = openCommitmentModal;

function closeCommitmentModal() {
  document.getElementById('commitment-modal').classList.add('hidden');
}
window.closeCommitmentModal = closeCommitmentModal;

function editCommitment(docId) {
  openCommitmentModal(docId);
}
window.editCommitment = editCommitment;

function handleSaveCommitment(e) {
  e.preventDefault();
  var docId = document.getElementById('commit-doc-id').value;
  var items = window.RevOpsStore.getCollection('commitments') || [];
  var existing = docId ? items.find(function(it) { return it.id === docId; }) : null;

  var newStatus = document.getElementById('inp-commit-status').value;
  var dateDone = existing ? (existing.dateDone || '') : '';
  if (newStatus === 'Completed' && !dateDone) {
    dateDone = getLocalTodayISO();
  } else if (newStatus !== 'Completed') {
    dateDone = '';
  }

  var employees = window.RevOpsStore.getCollection('employees') || [];
  var ownerId = document.getElementById('inp-commit-owner').value;
  var givenById = document.getElementById('inp-commit-givenby').value;
  var ownerEmp = employees.find(function(e) { return e.employeeId === ownerId; });
  var givenByEmp = employees.find(function(e) { return e.employeeId === givenById; });

  var record = {
    id: docId || ('commit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
    commitment: document.getElementById('inp-commit-text').value.trim(),
    employeeId: ownerId,
    employeeName: ownerEmp ? ownerEmp.fullName : ownerId,
    givenByEmployeeId: givenById,
    givenByName: givenByEmp ? givenByEmp.fullName : givenById,
    vertical: document.getElementById('inp-commit-vertical').value,
    meetingName: document.getElementById('inp-commit-meeting').value.trim(),
    datePromised: document.getElementById('inp-commit-datepromised').value,
    status: newStatus,
    dateDone: dateDone,
    remarks: document.getElementById('inp-commit-remarks').value.trim(),
    updatedAt: new Date().toISOString()
  };

  window.RevOpsStore.saveRecord('commitments', record);

  if (window.RevOpsStore.logAudit) {
    window.RevOpsStore.logAudit('Commitments', record.id, docId ? 'UPDATE' : 'CREATE', (docId ? 'Updated' : 'Created') + ' commitment: "' + record.commitment + '"', existing || null, record);
  }

  closeCommitmentModal();
  renderCommitmentsTable();
  if (typeof checkCommitmentsDuePopup === 'function') checkCommitmentsDuePopup();
}
window.handleSaveCommitment = handleSaveCommitment;

function deleteCommitment(docId) {
  if (!canDeleteCommitment()) {
    alert('Only Super Admin or Admin can delete a commitment.');
    return;
  }
  if (!confirm('Delete this commitment permanently? This cannot be undone.')) return;

  var items = window.RevOpsStore.getCollection('commitments') || [];
  var rec = items.find(function(it) { return it.id === docId; });
  var filtered = items.filter(function(it) { return it.id !== docId; });
  window.RevOpsStore.saveCollection('commitments', filtered);
  if (window.RevOpsStore.isFirebaseAvailable && window.RevOpsStore.isFirebaseAvailable() && window.db) {
    window.db.collection('commitments').doc(docId).delete().catch(function(err) {
      console.warn('Could not delete commitment from Firestore:', err);
      window.RevOpsStore.showSyncWarningBanner && window.RevOpsStore.showSyncWarningBanner("Deleted locally, but this commitment may still exist on the server - please check shortly.");
    });
  }
  if (window.RevOpsStore.logAudit && rec) {
    window.RevOpsStore.logAudit('Commitments', rec.id, 'DELETE', 'Deleted commitment: "' + rec.commitment + '"', rec, null);
  }
  renderCommitmentsTable();
}
window.deleteCommitment = deleteCommitment;

function renderCommitmentsTable() {
  var all = window.RevOpsStore.getCollection('commitments') || [];
  var todayISO = getLocalTodayISO();

  var searchQuery = (document.getElementById('inp-commit-search').value || '').toLowerCase().trim();
  var verticalFilter = document.getElementById('commit-vertical-filter').value;
  var ownerFilter = document.getElementById('commit-owner-filter').value;
  var statusFilter = document.getElementById('commit-status-filter').value;
  var overdueOnly = document.getElementById('commit-overdue-only').checked;

  var filtered = all.filter(function(c) {
    if (verticalFilter !== 'All' && c.vertical !== verticalFilter) return false;
    if (ownerFilter !== 'All' && c.employeeId !== ownerFilter) return false;
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (overdueOnly && !window.RevOpsStore.isCommitmentOverdue(c, todayISO)) return false;
    if (searchQuery) {
      var text = ((c.commitment || '') + ' ' + (c.employeeName || '') + ' ' + (c.givenByName || '') + ' ' + (c.meetingName || '')).toLowerCase();
      if (text.indexOf(searchQuery) === -1) return false;
    }
    return true;
  });

  // Overdue first, then by date promised ascending, so the most urgent
  // items are always what a reviewer sees first.
  filtered.sort(function(a, b) {
    var aOver = window.RevOpsStore.isCommitmentOverdue(a, todayISO) ? 0 : 1;
    var bOver = window.RevOpsStore.isCommitmentOverdue(b, todayISO) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return String(a.datePromised || '').localeCompare(String(b.datePromised || ''));
  });

  document.getElementById('stat-total').innerText = all.length;
  document.getElementById('stat-overdue').innerText = all.filter(function(c) { return window.RevOpsStore.isCommitmentOverdue(c, todayISO); }).length;
  document.getElementById('stat-pending').innerText = all.filter(function(c) { return c.status === 'Pending'; }).length;
  document.getElementById('stat-inprogress').innerText = all.filter(function(c) { return c.status === 'In Progress'; }).length;
  document.getElementById('stat-completed').innerText = all.filter(function(c) { return c.status === 'Completed'; }).length;

  var tbody = document.getElementById('commitments-tbody');
  var emptyState = document.getElementById('commitments-empty-state');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  var statusBadgeClass = {
    'Pending': 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    'In Progress': 'bg-sky-950/80 text-sky-300 border-sky-700/60',
    'Completed': 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
  };

  filtered.forEach(function(c) {
    var isOverdue = window.RevOpsStore.isCommitmentOverdue(c, todayISO);
    var tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition-colors' + (isOverdue ? ' bg-rose-950/20' : '');
    tr.innerHTML = `
      <td class="py-3 px-4 max-w-xs">
        <div class="font-semibold text-white">${escapeHtml(c.commitment || '')}</div>
        ${c.remarks ? `<div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(c.remarks)}</div>` : ''}
      </td>
      <td class="py-3 px-4 text-slate-200">${escapeHtml(c.employeeName || c.employeeId || '')}</td>
      <td class="py-3 px-4 text-slate-400">${escapeHtml(c.givenByName || c.givenByEmployeeId || '')}</td>
      <td class="py-3 px-4">
        <div class="text-slate-200 font-semibold">${escapeHtml(c.vertical || '')}</div>
        ${c.meetingName ? `<div class="text-[10px] text-slate-500">${escapeHtml(c.meetingName)}</div>` : ''}
      </td>
      <td class="py-3 px-4 ${isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}">${escapeHtml(_isoDateToDisplay(c.datePromised))}${isOverdue ? ' <span class="uppercase text-[9px]">(Overdue)</span>' : ''}</td>
      <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusBadgeClass[c.status] || 'bg-slate-800 text-slate-300 border-slate-700'}">${escapeHtml(c.status || '')}</span></td>
      <td class="py-3 px-4 text-slate-400">${c.dateDone ? escapeHtml(_isoDateToDisplay(c.dateDone)) : '-'}</td>
      <td class="py-3 px-4 no-print">
        <div class="flex items-center gap-1.5">
          <button onclick="editCommitment('${escapeHtml(c.id)}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button onclick="deleteCommitment('${escapeHtml(c.id)}')" class="p-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 hover:text-white rounded-lg transition-colors cursor-pointer" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
window.renderCommitmentsTable = renderCommitmentsTable;
