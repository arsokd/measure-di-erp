      document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['super_admin', 'admin', 'manager', 'staff'])) {
          initApprovalsPage();
        }
      });

      // Moved to window.RevOpsStore.getApprovalSections() (js/store.js) so
      // the "pending approvals" popup (auth-guard.js) and the email
      // notifications (store.js notifyApproversIfNeeded) can share the
      // exact same routing logic instead of drifting out of sync with a
      // second copy of it. Kept as a thin local wrapper so every call
      // site below didn't need touching.
      function getApprovalSections() {
        return window.RevOpsStore.getApprovalSections();
      }

      function initApprovalsPage() {
        renderApprovalsPage();
      }

      function renderApprovalsPage() {
        var sections = getApprovalSections();
        var container = document.getElementById('approvals-sections');
        var noAuthorityNotice = document.getElementById('no-authority-notice');
        var totalBadge = document.getElementById('approvals-total-badge');

        // This gate decides whether the Approvals hub shows anything at
        // all - it must cover every flag any section below is gated by
        // (isFinalApprover included), or a holder of ONLY that flag (e.g.
        // Murugan, who signs off Orders/Quotes/Invoices/Travel at the
        // final stage but isn't a Primary Approver, Finance Head, or the
        // Director) sees "no authority" and every one of their pending
        // approvals silently vanishes from view. It also covers anyone
        // who is simply someone's Reporting Manager on the Employees
        // master - the Travel Expense Claims section routes to that
        // relationship directly rather than a flag, so a line manager
        // holding none of these flags would otherwise never see it.
        var employeesForGate = window.RevOpsStore.getCollection('employees') || [];
        var myEmpIdForGate = localStorage.getItem('employeeId');
        var isAnyApprover = hasApprovalAuthority('isPrimaryApprover') || hasApprovalAuthority('isFinalApprover') || hasApprovalAuthority('isFinanceHead') || hasApprovalAuthority('isDirector') ||
          employeesForGate.some(function(e) { return e.reportsTo === myEmpIdForGate; });
        if (!isAnyApprover) {
          noAuthorityNotice.classList.remove('hidden');
          container.innerHTML = '';
          totalBadge.innerText = '0 items awaiting your action';
          return;
        }
        noAuthorityNotice.classList.add('hidden');

        var totalItems = sections.reduce(function(sum, s) { return sum + s.items.length; }, 0);
        totalBadge.innerText = totalItems + (totalItems === 1 ? ' item awaiting your action' : ' items awaiting your action');
        totalBadge.className = totalItems > 0
          ? 'px-4 py-2.5 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-300 font-black text-sm'
          : 'px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-black text-sm';

        container.innerHTML = sections.map(function(section) {
          if (section.items.length === 0) {
            return `
              <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 opacity-60">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-bold text-slate-300 flex items-center gap-2">${section.icon} ${escapeHtml(section.title)}</span>
                  <span class="text-[10px] font-bold text-emerald-400 uppercase">✓ Nothing pending</span>
                </div>
              </div>
            `;
          }

          var rowsHtml = section.items.map(function(item) {
            var row = section.rowFn(item);
            return `
              <a href="${row.link}" class="flex items-center justify-between gap-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-xl p-3 transition-colors">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-indigo-300 text-xs">${escapeHtml(row.ref || '')}</span>
                    <span class="text-slate-300 text-xs font-semibold truncate">${escapeHtml(row.customer || '')}</span>
                  </div>
                  <div class="text-[10px] text-slate-500 mt-0.5">Raised by ${escapeHtml(row.by || 'Unknown')} ${row.date ? '&bull; ' + escapeHtml(row.date) : ''}</div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  <span class="font-black text-emerald-400 text-xs">${formatINR(row.amount || 0)}</span>
                  <span class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold whitespace-nowrap">Review &amp; Approve →</span>
                </div>
              </a>
            `;
          }).join('');

          return `
            <div class="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              <div class="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <span class="text-sm font-bold text-white flex items-center gap-2">${section.icon} ${escapeHtml(section.title)}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-800">${section.items.length} pending</span>
              </div>
              <div class="p-3 space-y-2">
                ${rowsHtml}
              </div>
            </div>
          `;
        }).join('');
      }
