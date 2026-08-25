var currentPaymentView = 'transactions';

      document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['admin', 'manager', 'staff'])) {
          initPaymentsPage();
        }
      });

      function initPaymentsPage() {
        var userRole = localStorage.getItem('userRole');
        var employees = window.RevOpsStore.getCollection('employees') || [];

        if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') {
          var wrapper = document.getElementById('payment-filter-wrapper');
          var select = document.getElementById('payment-emp-filter');
          wrapper.classList.remove('hidden');

          select.innerHTML = `<option value="All">All Sales Representatives</option>`;
          employees.forEach(function(e) {
            var opt = document.createElement('option');
            opt.value = e.employeeId;
            opt.innerText = e.fullName + " (" + e.employeeId + ")";
            select.appendChild(opt);
          });
        }

        populatePaymentClientDropdown();
        populateInvoiceDropdown();
        renderActivePaymentView();

        // Check if redirected with ?action=adjustment or ?invoiceId=...
        var urlParams = new URLSearchParams(window.location.search);
        var targetAction = urlParams.get('action');
        var targetInvId = urlParams.get('invoiceId');
        if (targetAction === 'adjustment') {
          openAdjustmentModal(targetInvId);
        } else if (targetInvId) {
          openPaymentModal(targetInvId);
        }
      }

      function switchPaymentView(viewName) {
        currentPaymentView = viewName;
        document.querySelectorAll('#payment-view-tabs .view-tab-btn').forEach(function(btn) {
          if (btn.getAttribute('data-view') === viewName) {
            btn.className = 'view-tab-btn px-4 py-2 font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer';
          } else {
            btn.className = 'view-tab-btn px-4 py-2 font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer';
          }
        });

        document.getElementById('view-section-transactions').classList.toggle('hidden', viewName !== 'transactions');
        document.getElementById('view-section-client_ar').classList.toggle('hidden', viewName !== 'client_ar');
        document.getElementById('view-section-project_ar').classList.toggle('hidden', viewName !== 'project_ar');
        document.getElementById('view-section-salesrep_ar').classList.toggle('hidden', viewName !== 'salesrep_ar');
        if (document.getElementById('view-section-pg_bg')) {
          document.getElementById('view-section-pg_bg').classList.toggle('hidden', viewName !== 'pg_bg');
        }
        document.getElementById('view-section-adjustments').classList.toggle('hidden', viewName !== 'adjustments');

        renderActivePaymentView();
      }

      // Populate Client Filter in Payment Modal (ONLY clients with balanceDue > 0)
      function populatePaymentClientDropdown() {
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var clientSelect = document.getElementById('inp-pay-client-select');
        if (!clientSelect) return;

        var clientsWithPending = {};
        invoices.forEach(function(inv) {
          var bal = Number(inv.balanceDue) !== undefined ? Number(inv.balanceDue) : (Number(inv.grandTotal) || 0);
          if (bal > 0 && inv.status !== 'Cancelled' && inv.status !== 'Draft') {
            var cName = (inv.customerName || '').trim();
            if (cName) {
              clientsWithPending[cName] = (clientsWithPending[cName] || 0) + bal;
            }
          }
        });

        clientSelect.innerHTML = `<option value="">-- All Clients with Pending Invoices (${Object.keys(clientsWithPending).length}) --</option>`;
        Object.keys(clientsWithPending).sort().forEach(function(cName) {
          var opt = document.createElement('option');
          opt.value = cName;
          opt.innerText = `${cName} (Pending AR: ${formatINR(clientsWithPending[cName])})`;
          clientSelect.appendChild(opt);
        });

        var hint = document.getElementById('client-link-count-hint');
        if (hint) hint.innerText = `${Object.keys(clientsWithPending).length} Clients have Unsettled Invoices`;
      }

      function onPaymentClientFilterChanged(selectedClient) {
        populateInvoiceDropdown(selectedClient);
        // Clear snapshot if current selection doesn't match
        var invSelect = document.getElementById('inp-pay-invoice-select');
        if (invSelect.value) {
          onInvoiceSelected(invSelect.value);
        } else {
          document.getElementById('inv-financial-snapshot').classList.add('hidden');
          document.getElementById('inp-pay-customer').value = selectedClient || '';
          document.getElementById('inp-pay-invoice').value = '';
        }
      }

      // Populate Invoice Dropdown (ONLY invoices with balanceDue > 0)
      function populateInvoiceDropdown(filterClientName) {
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var select = document.getElementById('inp-pay-invoice-select');
        if (!select) return;

        select.innerHTML = `<option value="">-- Select Pending Invoice to Settle --</option>`;
        var activeCount = 0;

        invoices.forEach(function(inv) {
          var bal = Number(inv.balanceDue) !== undefined ? Number(inv.balanceDue) : (Number(inv.grandTotal) || 0);
          if (bal > 0 && inv.status !== 'Cancelled' && inv.status !== 'Draft') {
            if (filterClientName && inv.customerName !== filterClientName) return;

            var opt = document.createElement('option');
            opt.value = inv.id;
            opt.innerText = `${inv.invoiceNumber} - ${inv.customerName} (Bal: ${formatINR(bal)}) [Due: ${inv.dueDate || inv.invoiceDate || 'Net 30'}]`;
            opt.setAttribute('data-customer', inv.customerName || '');
            opt.setAttribute('data-gstin', inv.customerGstin || '');
            opt.setAttribute('data-invoicenum', inv.invoiceNumber || '');
            opt.setAttribute('data-grandtotal', inv.grandTotal || 0);
            opt.setAttribute('data-paid', (Number(inv.paidAmount) || 0) + (Number(inv.tdsDeducted) || 0));
            opt.setAttribute('data-adj', (Number(inv.adjustmentAmount) || 0) + (Number(inv.writeOffAmount) || 0));
            opt.setAttribute('data-balance', bal);
            opt.setAttribute('data-email', inv.customerEmail || '');
            opt.setAttribute('data-milestone', inv.milestoneTag || '');
            select.appendChild(opt);
            activeCount++;
          }
        });

        var hint = document.getElementById('inv-link-count-hint');
        if (hint) hint.innerText = `${activeCount} Pending Invoices with Unsettled Balance`;
      }

      function onInvoiceSelected(invId) {
        var snapBox = document.getElementById('inv-financial-snapshot');
        if (!invId) {
          snapBox.classList.add('hidden');
          return;
        }

        var select = document.getElementById('inp-pay-invoice-select');
        var opt = select.options[select.selectedIndex];
        if (!opt) return;

        var customer = opt.getAttribute('data-customer');
        var invoiceNum = opt.getAttribute('data-invoicenum');
        var grandTotal = Number(opt.getAttribute('data-grandtotal')) || 0;
        var paid = Number(opt.getAttribute('data-paid')) || 0;
        var adj = Number(opt.getAttribute('data-adj')) || 0;
        var balance = Number(opt.getAttribute('data-balance')) || 0;
        var milestone = opt.getAttribute('data-milestone');

        document.getElementById('inp-pay-customer').value = customer;
        document.getElementById('inp-pay-invoice').value = invoiceNum;
        document.getElementById('inp-pay-amount').value = balance > 0 ? balance : 100000;
        document.getElementById('inp-pay-milestone').value = milestone || 'Commercial Settlement';

        document.getElementById('snap-inv-total').innerText = formatINR(grandTotal);
        document.getElementById('snap-inv-paid').innerText = formatINR(paid);
        document.getElementById('snap-inv-adj').innerText = formatINR(adj);
        document.getElementById('snap-inv-bal').innerText = formatINR(balance);
        snapBox.classList.remove('hidden');

        // Check for linked Order / Quote 1st Advance terms
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var quotes = window.RevOpsStore.getCollection('quotations') || [];
        var invList = window.RevOpsStore.getCollection('invoices') || [];
        var currentInv = invList.find(function(i) { return i.id === invId; });
        
        var linkedOrder = null;
        if (currentInv) {
          linkedOrder = orders.find(function(o) {
            return (o.poNumber && o.poNumber === currentInv.poNumber) ||
                   (o.customerName && currentInv.customerName && o.customerName.trim().toLowerCase() === currentInv.customerName.trim().toLowerCase());
          });
        }

        var advBox = document.getElementById('snap-po-advance-box');
        if (linkedOrder && (linkedOrder.expectedAdvanceAmount || linkedOrder.advancePercent)) {
          var advAmt = Number(linkedOrder.expectedAdvanceAmount) || Math.round((Number(linkedOrder.orderValue) || 0) * 0.5);
          var advPct = linkedOrder.advancePercent || 50;
          document.getElementById('snap-po-adv-val').innerText = formatINR(advAmt);
          document.getElementById('snap-po-adv-tag').innerText = `(${advPct}% of PO #${linkedOrder.poNumber || 'PO'})`;
          
          var diffVal = paid - advAmt;
          var diffEl = document.getElementById('snap-po-adv-diff');
          if (paid === 0) {
            diffEl.innerHTML = `<span class="text-amber-800 font-bold">1st Advance Pending (Agreed: ${formatINR(advAmt)})</span>`;
          } else if (paid >= advAmt) {
            diffEl.innerHTML = `<span class="text-emerald-700 font-bold">✓ 1st Advance Received in Full (${formatINR(paid)})</span>`;
          } else {
            diffEl.innerHTML = `<span class="text-rose-700 font-bold">Partial Advance (${formatINR(paid)} / ${formatINR(advAmt)})</span>`;
          }
          advBox.classList.remove('hidden');
        } else {
          advBox.classList.add('hidden');
        }

        // Sync client filter dropdown if not already set
        var clientSelect = document.getElementById('inp-pay-client-select');
        if (clientSelect && !clientSelect.value && customer) {
          clientSelect.value = customer;
        }

        calculateRemainingBalancePreview();
      }

      function onPaymentReasonChanged(selectedReason) {
        var milestoneInp = document.getElementById('inp-pay-milestone');
        var select = document.getElementById('inp-pay-invoice-select');
        var amountInp = document.getElementById('inp-pay-amount');

        if (selectedReason === 'Advance') {
          milestoneInp.value = '1st Milestone Advance Payment against Purchase Order';
          // If linked PO has expected advance, auto-suggest it
          var advValElem = document.getElementById('snap-po-adv-val');
          if (advValElem && advValElem.innerText && advValElem.innerText.indexOf('Rs.') !== -1) {
            var rawAdv = parseInt(advValElem.innerText.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(rawAdv) && rawAdv > 0) {
              amountInp.value = rawAdv;
            }
          }
        } else if (selectedReason === 'Final payment') {
          milestoneInp.value = 'Final Invoice Settlement / Balance Closure';
          if (select && select.value) {
            var opt = select.options[select.selectedIndex];
            if (opt) amountInp.value = Number(opt.getAttribute('data-balance')) || 0;
          }
        } else if (selectedReason === 'Final payment after write-off') {
          milestoneInp.value = 'Final Settlement (Post Director-Approved Write-Off)';
        } else if (selectedReason === 'Final payment after goodwill adjustment') {
          milestoneInp.value = 'Final Settlement (Post Commercial Goodwill Concession)';
        } else {
          milestoneInp.value = 'Part Milestone Payment';
        }

        calculateRemainingBalancePreview();
      }

      function calculateRemainingBalancePreview() {
        var select = document.getElementById('inp-pay-invoice-select');
        var curBalance = 0;
        if (select && select.value) {
          var opt = select.options[select.selectedIndex];
          if (opt) curBalance = Number(opt.getAttribute('data-balance')) || 0;
        }

        var amt = Number(document.getElementById('inp-pay-amount').value) || 0;
        var tds = Number(document.getElementById('inp-pay-tds').value) || 0;
        var totalSettled = amt + tds;
        var newBal = Math.max(0, curBalance - totalSettled);

        document.getElementById('prev-total-settlement').innerText = formatINR(totalSettled);
        document.getElementById('prev-new-balance').innerText = formatINR(newBal);

        // Advance variance checking
        var reasonSelect = document.getElementById('inp-pay-reason');
        var isAdvance = reasonSelect && reasonSelect.value === 'Advance';
        var advBox = document.getElementById('snap-po-advance-box');
        var diffEl = document.getElementById('snap-po-adv-diff');

        if (isAdvance && advBox && !advBox.classList.contains('hidden') && diffEl) {
          var advValElem = document.getElementById('snap-po-adv-val');
          var rawAgreedAdv = parseInt((advValElem.innerText || '').replace(/[^0-9]/g, ''), 10) || 0;
          if (rawAgreedAdv > 0) {
            if (totalSettled === rawAgreedAdv) {
              diffEl.innerHTML = `<span class="text-emerald-700 font-bold">✓ Entered advance exactly matches agreed PO terms (${formatINR(totalSettled)})</span>`;
            } else if (totalSettled < rawAgreedAdv) {
              var shortfall = rawAgreedAdv - totalSettled;
              diffEl.innerHTML = `<span class="text-amber-800 font-bold">⚠️ Advance shortfall of ${formatINR(shortfall)} (Entered: ${formatINR(totalSettled)} vs Agreed: ${formatINR(rawAgreedAdv)})</span>`;
            } else {
              var surplus = totalSettled - rawAgreedAdv;
              diffEl.innerHTML = `<span class="text-indigo-700 font-bold">ℹ️ Advance surplus of ${formatINR(surplus)} over agreed initial advance (${formatINR(rawAgreedAdv)})</span>`;
            }
          }
        }
      }

      function renderActivePaymentView() {
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');
        var searchQuery = (document.getElementById('payment-search-input').value || '').toLowerCase();
        var selectedFy = document.getElementById('payment-fy-filter').value;
        
        var selectedEmp = "All";
        var empElem = document.getElementById('payment-emp-filter');
        if (empElem && empElem.value) selectedEmp = empElem.value;

        var payments = window.RevOpsStore.getCollection('payments') || [];
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var arAdjustments = window.RevOpsStore.getCollection('arAdjustments') || [];

        // Global KPI Stats Calculation
        var totalBilled = 0, totalCleared = 0, totalOutstanding = 0, totalOverdue = 0, totalAdjustments = 0, overdueInvoicesCount = 0;
        var today = new Date();
        today.setHours(0,0,0,0);

        invoices.forEach(function(inv) {
          var grand = Number(inv.grandTotal) || 0;
          var bal = Number(inv.balanceDue) !== undefined ? Number(inv.balanceDue) : grand;

          totalBilled += grand;
          totalOutstanding += bal;

          if (inv.dueDate && bal > 1) {
            var due = parseDateDDMMYYYY(inv.dueDate);
            if (due < today) {
              totalOverdue += bal;
              overdueInvoicesCount++;
            }
          }
        });

        payments.forEach(function(p) {
          if (p.status === 'Cleared' || p.status === 'Approved') {
            totalCleared += (Number(p.amount) || 0) + (Number(p.tdsAmount) || 0);
          }
        });

        arAdjustments.forEach(function(adj) {
          if (adj.status === 'Approved') {
            totalAdjustments += (Number(adj.adjustmentAmount) || 0);
          }
        });

        document.getElementById('stat-billed-revenue').innerText = formatINR(totalBilled);
        document.getElementById('stat-collected-total').innerText = formatINR(totalCleared);
        document.getElementById('stat-outstanding-total').innerText = formatINR(totalOutstanding);
        document.getElementById('stat-overdue-total').innerText = formatINR(totalOverdue);
        document.getElementById('stat-overdue-detail').innerText = `${overdueInvoicesCount} Overdue Invoices Requiring Follow-up`;
        document.getElementById('stat-adjustments-total').innerText = formatINR(totalAdjustments);

        // AR Adjustment Authorization Alert Banner — shown to whichever of the
        // three named approvers still owes a sign-off on at least one request.
        var pendingApprovals = typeof window.RevOpsStore.getPendingDirectorApprovals === 'function' ? window.RevOpsStore.getPendingDirectorApprovals() : [];
        var myOutstandingSignoffs = pendingApprovals.filter(function(adj) {
          return (localStorage.getItem('isPrimaryApprover') === 'true' && !adj.primaryApproverSignoff) ||
                 (localStorage.getItem('isFinanceHead') === 'true' && !adj.financeHeadSignoff) ||
                 (localStorage.getItem('isDirector') === 'true' && !adj.directorSignoff);
        });
        var alertBanner = document.getElementById('director-approval-alert');
        var countBadge = document.getElementById('pending-director-count');
        if (alertBanner && countBadge) {
          if (myOutstandingSignoffs.length > 0) {
            alertBanner.classList.remove('hidden');
            countBadge.innerText = myOutstandingSignoffs.length;
          } else {
            alertBanner.classList.add('hidden');
          }
        }

        // PG / BG / Retention Expiry & Action Needed Alert Banner check
        var pgbgReceivables = typeof window.RevOpsStore.getPgBgReceivables === 'function' ? window.RevOpsStore.getPgBgReceivables() : [];
        var dueSoonOrExpiredPgBg = pgbgReceivables.filter(function(item) {
          return !item.isReleased && (item.status.indexOf('Due Soon') !== -1 || item.status.indexOf('Overdue') !== -1);
        });

        var pgbgAlertBanner = document.getElementById('pgbg-due-alert');
        var pgbgCountBadge = document.getElementById('pgbg-alert-count');
        var pgbgTabCount = document.getElementById('count-view-pgbg');
        if (pgbgTabCount) pgbgTabCount.innerText = pgbgReceivables.length;

        if (pgbgAlertBanner && pgbgCountBadge) {
          if (dueSoonOrExpiredPgBg.length > 0) {
            pgbgAlertBanner.classList.remove('hidden');
            pgbgCountBadge.innerText = dueSoonOrExpiredPgBg.length;
          } else {
            pgbgAlertBanner.classList.add('hidden');
          }
        }

        // Render current view
        if (currentPaymentView === 'transactions') {
          renderTransactionsView(payments, invoices, selectedFy, userRole, myEmpId, selectedEmp, searchQuery);
        } else if (currentPaymentView === 'client_ar') {
          renderClientArView(invoices, payments, selectedFy, searchQuery);
        } else if (currentPaymentView === 'project_ar') {
          renderProjectArView(invoices, payments, selectedFy, searchQuery);
        } else if (currentPaymentView === 'salesrep_ar') {
          renderSalesRepArView(invoices, payments, selectedFy, searchQuery);
        } else if (currentPaymentView === 'pg_bg') {
          renderPgBgView(pgbgReceivables, searchQuery);
        } else if (currentPaymentView === 'adjustments') {
          renderAdjustmentsView(arAdjustments, invoices, selectedFy, userRole, myEmpId, searchQuery);
        }
      }

      // VIEW: Performance Guarantee (PG), Bank Guarantee (BG) & Warranty Retention Receivables
      function renderPgBgView(pgbgList, searchQuery) {
        var filtered = pgbgList.filter(function(item) {
          var textMatch = (item.clientName || '').toLowerCase().includes(searchQuery) ||
                          (item.poNumber || '').toLowerCase().includes(searchQuery) ||
                          (item.invoiceNumber || '').toLowerCase().includes(searchQuery) ||
                          (item.securityType || '').toLowerCase().includes(searchQuery) ||
                          (item.bankBranch || '').toLowerCase().includes(searchQuery);
          return textMatch;
        });

        var tabBadge = document.getElementById('count-view-pgbg');
        if (tabBadge) tabBadge.innerText = pgbgList.length;

        var tbody = document.getElementById('pgbg-ar-tbody');
        if (!tbody) return;
        tbody.innerHTML = "";

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">No Bank Guarantee (BG), Performance Guarantee (PG), or Retention records found.</td></tr>`;
          return;
        }

        filtered.forEach(function(item) {
          var alertClass = "bg-emerald-50 text-emerald-800 border border-emerald-200";
          if (item.status.indexOf('Overdue') !== -1) {
            alertClass = "bg-rose-100 text-rose-900 font-extrabold border border-rose-300 animate-pulse";
          } else if (item.status.indexOf('Due Soon') !== -1) {
            alertClass = "bg-amber-100 text-amber-900 font-bold border border-amber-300";
          } else if (item.status.indexOf('Released') !== -1) {
            alertClass = "bg-slate-100 text-slate-700 font-semibold";
          }

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900">${escapeHtml(item.clientName)}</div>
              <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(item.bankBranch || 'Bank Guarantee Reference')}</div>
            </td>
            <td class="py-3 px-4 font-mono font-bold text-indigo-700">
              ${escapeHtml(item.poNumber)}
            </td>
            <td class="py-3 px-4 font-mono text-slate-700">
              ${escapeHtml(item.invoiceNumber || '--')}
            </td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                ${escapeHtml(item.securityType)}
              </span>
            </td>
            <td class="py-3 px-4 text-right font-black text-amber-900 text-sm">
              ${formatINR(item.guaranteeAmount)}
            </td>
            <td class="py-3 px-4 text-slate-700 max-w-xs text-[11px]">
              <div class="font-semibold">${escapeHtml(item.stipulatedPeriod)}</div>
              <div class="text-[10px] text-slate-400">Valid From: ${escapeHtml(item.validFrom || '--')}</div>
            </td>
            <td class="py-3 px-4 font-mono font-bold text-slate-900">
              <div>${escapeHtml(item.releaseDueDate)}</div>
              <span class="text-[10px] ${item.daysRemaining < 0 ? 'text-rose-700 font-black' : (item.daysRemaining <= 30 ? 'text-amber-700 font-bold' : 'text-slate-400')}">
                ${item.isReleased ? 'Released' : (item.daysRemaining < 0 ? Math.abs(item.daysRemaining) + ' days overdue' : item.daysRemaining + ' days left')}
              </span>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] uppercase ${alertClass}">
                ${escapeHtml(item.status)}
              </span>
            </td>
            <td class="py-3 px-4 text-center whitespace-nowrap">
              ${item.isReleased ? `
                <span class="text-[10px] text-emerald-700 font-black">✓ Released</span>
              ` : `
                <button onclick="releasePgBgSecurityPrompt('${escapeHtml(item.id)}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer">
                  🔓 Release / Collect
                </button>
              `}
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function releasePgBgSecurityPrompt(recId) {
        var pgbgList = window.RevOpsStore.getPgBgReceivables();
        var rec = pgbgList.find(function(it) { return it.id === recId; });
        if (!rec) return;

        var confirmMsg = "Confirm Release / Refund of " + rec.securityType + " for " + rec.clientName + "?\n\nGuarantee Amount: " + formatINR(rec.guaranteeAmount) + "\nPO Ref: " + rec.poNumber + "\n\nHas client issued the official BG Surrender / Release Discharge note?";
        if (confirm(confirmMsg)) {
          var res = window.RevOpsStore.releasePgBgSecurity(recId, {
            date: getFormattedToday(),
            amount: rec.guaranteeAmount,
            remarks: "Released and collected after warranty / performance completion."
          });
          if (res.success) {
            alert("✅ " + rec.securityType + " released and marked collected successfully!");
            renderActivePaymentView();
          }
        }
      }

      // Downloadable PG/BG Receivables Due List in CSV format
      function downloadPgBgReceivablesCsv() {
        var pgbgList = window.RevOpsStore.getPgBgReceivables() || [];
        if (pgbgList.length === 0) {
          alert("No Performance Guarantee / Bank Guarantee records to export.");
          return;
        }

        var headers = ["Client Organization", "PO Number", "Invoice Ref", "Security Type", "Guarantee Amount (INR)", "Stipulated Period / Warranty", "Valid From", "Release Due Date", "Days Remaining / Overdue", "Alert Status", "Bank & Branch Narration", "Remarks"];
        var rows = pgbgList.map(function(item) {
          return [
            `"${(item.clientName || '').replace(/"/g, '""')}"`,
            `"${(item.poNumber || '').replace(/"/g, '""')}"`,
            `"${(item.invoiceNumber || '').replace(/"/g, '""')}"`,
            `"${(item.securityType || '').replace(/"/g, '""')}"`,
            Number(item.guaranteeAmount) || 0,
            `"${(item.stipulatedPeriod || '').replace(/"/g, '""')}"`,
            `"${(item.validFrom || '').replace(/"/g, '""')}"`,
            `"${(item.releaseDueDate || '').replace(/"/g, '""')}"`,
            item.daysRemaining,
            `"${(item.status || '').replace(/"/g, '""')}"`,
            `"${(item.bankBranch || '').replace(/"/g, '""')}"`,
            `"${(item.remarks || '').replace(/"/g, '""')}"`
          ].join(',');
        });

        var csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Measure_DI_PG_BG_Receivables_Report_${getFormattedToday().replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      function renderAdjustmentsView(arAdjustments, invoices, selectedFy, userRole, myEmpId, searchQuery) {
        var filtered = arAdjustments.filter(function(adj) {
          if (selectedFy !== 'All') {
            var adjFy = typeof getFinancialYear === 'function' ? getFinancialYear(adj.requestedDate, adj.invoiceNumber) : '2026-27';
            if (adjFy !== selectedFy) return false;
          }

          var textMatch = (adj.adjustmentNumber || adj.refNumber || '').toLowerCase().includes(searchQuery) ||
                          (adj.customerName || '').toLowerCase().includes(searchQuery) ||
                          (adj.invoiceNumber || '').toLowerCase().includes(searchQuery) ||
                          (adj.adjustmentType || '').toLowerCase().includes(searchQuery) ||
                          (adj.reasonCategory || '').toLowerCase().includes(searchQuery);
          return textMatch;
        });

        var countElem = document.getElementById('count-view-adj');
        if (countElem) countElem.innerText = filtered.length;

        var tbody = document.getElementById('adjustments-tbody');
        tbody.innerHTML = "";

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">No AR adjustment or write-off records found.</td></tr>`;
          return;
        }

        filtered.forEach(function(adj) {
          var typePill = adj.adjustmentType === 'Bad Debt Write-Off (Unrecoverable AR)' ? 'bg-rose-100 text-rose-800 font-black border border-rose-200' : 'bg-amber-100 text-amber-800 font-bold border border-amber-200';
          
          var statusPill = 'bg-slate-100 text-slate-700';
          if (adj.status === 'Approved') statusPill = 'bg-purple-100 text-purple-900 font-black border border-purple-300';
          else if (adj.status === 'Pending Director Approval') statusPill = 'bg-amber-100 text-amber-900 font-bold animate-pulse border border-amber-300';
          else if (adj.status === 'Rejected') statusPill = 'bg-rose-100 text-rose-800 font-bold';

          // Three-way sign-off status: show each of the three named
          // authorities' signature, and a Sign button for whichever of them
          // the current viewer is and hasn't signed yet.
          var directorInfo = '';
          [
            { key: 'primaryApproverSignoff', flag: 'isPrimaryApprover', label: 'Primary Approver', icon: '✅' },
            { key: 'financeHeadSignoff', flag: 'isFinanceHead', label: 'Finance Head', icon: '💰' },
            { key: 'directorSignoff', flag: 'isDirector', label: '👑 Director' }
          ].forEach(function(role) {
            var so = adj[role.key];
            if (so) {
              var icon = so.decision === 'Approved' ? '✅' : '❌';
              directorInfo += `<div class="text-[10px] font-semibold ${so.decision === 'Approved' ? 'text-emerald-700' : 'text-rose-700'}">${icon} ${escapeHtml(role.label)}: ${escapeHtml(so.signedBy || '')}</div>`;
            } else if (adj.status === 'Pending Director Approval' && localStorage.getItem(role.flag) === 'true') {
              directorInfo += `<button onclick="openDirectorApprovalModal('${escapeHtml(adj.id)}', '${role.key}')" class="mt-0.5 px-2 py-0.5 bg-purple-700 hover:bg-purple-800 text-white rounded text-[9px] font-black cursor-pointer">Sign as ${escapeHtml(role.label)}</button>`;
            } else if (adj.status === 'Pending Director Approval') {
              directorInfo += `<div class="text-[9px] text-amber-600 font-semibold">Awaiting ${escapeHtml(role.label)}</div>`;
            }
          });
          if (!directorInfo) directorInfo = `<span class="text-slate-400 text-[11px]">--</span>`;

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900 font-mono text-[11px]">${escapeHtml(adj.adjustmentNumber || adj.refNumber || 'ADJ-REQ')}</div>
              <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(adj.requestedDate)}</div>
            </td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded text-[10px] uppercase ${typePill}">
                ${adj.adjustmentType === 'Bad Debt Write-Off (Unrecoverable AR)' ? '🚨 Bad Debt Write-Off' : '🏷️ Goodwill Discount'}
              </span>
            </td>
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900">${escapeHtml(adj.customerName)}</div>
              <div class="font-mono text-[10px] text-indigo-700 font-semibold">${escapeHtml(adj.invoiceNumber)}</div>
            </td>
            <td class="py-3 px-4 text-right font-black text-slate-800">
              ${formatINR(adj.invoiceGrandTotal || 0)}
            </td>
            <td class="py-3 px-4 text-right font-black text-purple-800 text-sm">
              ${formatINR(adj.adjustmentAmount || 0)}
            </td>
            <td class="py-3 px-4 max-w-xs">
              <div class="font-bold text-slate-800 text-[11px]">${escapeHtml(adj.reasonCategory)}</div>
              <div class="text-[10px] text-slate-500 truncate mt-0.5" title="${escapeHtml(adj.detailedJustification)}">${escapeHtml(adj.detailedJustification)}</div>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] ${statusPill}">
                ${escapeHtml(adj.status)}
              </span>
            </td>
            <td class="py-3 px-4">
              ${directorInfo}
            </td>
            <td class="py-3 px-4 text-center space-x-1.5 whitespace-nowrap">
              <button onclick="viewPrintableAdjVoucher('${escapeHtml(adj.id)}')" class="p-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded text-[11px] font-bold cursor-pointer" title="View Authorization Certificate">⚖️ Voucher</button>
              ${adj.status !== 'Approved' ? `<button onclick="deleteArAdjustment('${escapeHtml(adj.id)}')" class="text-rose-600 hover:text-rose-800 font-bold hover:underline">Delete</button>` : ''}
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Modal 4: Request Goodwill Adjustment / Bad Debt Write-Off
      function openAdjustmentModal(prefillInvoiceId) {
        document.getElementById('adj-doc-id').value = "";
        document.getElementById('adj-modal-title').innerText = "Request Payment Adjustment / Write-Off";

        populateAdjClientDropdown();
        populateAdjInvoiceDropdown();
        onAdjustmentTypeChange('Goodwill Discount / Commercial Adjustment');

        document.getElementById('inp-adj-amount').value = "";
        document.getElementById('inp-adj-justification').value = "";

        if (prefillInvoiceId) {
          var select = document.getElementById('inp-adj-invoice-select');
          if (select) {
            select.value = prefillInvoiceId;
            onAdjInvoiceSelected(prefillInvoiceId);
          }
        }

        document.getElementById('adjustment-modal').classList.remove('hidden');
      }

      function closeAdjustmentModal() {
        document.getElementById('adjustment-modal').classList.add('hidden');
      }

      function onAdjustmentTypeChange(adjType) {
        var catSelect = document.getElementById('inp-adj-category');
        catSelect.innerHTML = "";

        var categories = [];
        if (adjType === 'Bad Debt Write-Off (Unrecoverable AR)') {
          categories = [
            "Long Outstanding Unrecoverable (>180 Days)",
            "Client Insolvency / NCLT CIRP Proceedings",
            "Disputed Balance / Uncollectible Commercial Debt",
            "Customer Operations Liquidated / Defunct",
            "Director Bad-Debt Sanction & Provisioning"
          ];
        } else {
          categories = [
            "Goodwill Customer Concession & Strategic Relationship",
            "Commercial Scope / Quantity Reconciliation",
            "Volume Rebate / Contractual Discount",
            "Liquidated Damages (LD) Commercial Settlement",
            "Post-Delivery Performance Goodwill Allowance",
            "Management / Senior Director Negotiated Discount"
          ];
        }

        categories.forEach(function(cat) {
          var opt = document.createElement('option');
          opt.value = cat;
          opt.innerText = cat;
          catSelect.appendChild(opt);
        });

        calculateAdjBalancePreview();
      }

      function populateAdjClientDropdown() {
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var clientSelect = document.getElementById('inp-adj-client-select');
        if (!clientSelect) return;

        var clientsWithPending = {};
        invoices.forEach(function(inv) {
          var bal = Number(inv.balanceDue) !== undefined ? Number(inv.balanceDue) : (Number(inv.grandTotal) || 0);
          if (bal > 0 && inv.status !== 'Cancelled' && inv.status !== 'Draft') {
            var cName = (inv.customerName || '').trim();
            if (cName) {
              clientsWithPending[cName] = (clientsWithPending[cName] || 0) + bal;
            }
          }
        });

        clientSelect.innerHTML = `<option value="">-- All Clients with Pending AR (${Object.keys(clientsWithPending).length}) --</option>`;
        Object.keys(clientsWithPending).sort().forEach(function(cName) {
          var opt = document.createElement('option');
          opt.value = cName;
          opt.innerText = `${cName} (Pending AR: ${formatINR(clientsWithPending[cName])})`;
          clientSelect.appendChild(opt);
        });
      }

      function onAdjClientFilterChanged(selectedClient) {
        populateAdjInvoiceDropdown(selectedClient);
        var invSelect = document.getElementById('inp-adj-invoice-select');
        if (invSelect.value) {
          onAdjInvoiceSelected(invSelect.value);
        } else {
          document.getElementById('adj-inv-snapshot').classList.add('hidden');
        }
      }

      function populateAdjInvoiceDropdown(filterClientName) {
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var select = document.getElementById('inp-adj-invoice-select');
        if (!select) return;

        select.innerHTML = `<option value="">-- Select Pending Invoice --</option>`;
        invoices.forEach(function(inv) {
          var bal = Number(inv.balanceDue) !== undefined ? Number(inv.balanceDue) : (Number(inv.grandTotal) || 0);
          if (bal > 0 && inv.status !== 'Cancelled' && inv.status !== 'Draft') {
            if (filterClientName && inv.customerName !== filterClientName) return;

            var opt = document.createElement('option');
            opt.value = inv.id;
            opt.innerText = `${inv.invoiceNumber} - ${inv.customerName} (Bal: ${formatINR(bal)})`;
            opt.setAttribute('data-customer', inv.customerName || '');
            opt.setAttribute('data-invoicenum', inv.invoiceNumber || '');
            opt.setAttribute('data-grandtotal', inv.grandTotal || 0);
            opt.setAttribute('data-paid', (Number(inv.paidAmount) || 0) + (Number(inv.tdsDeducted) || 0));
            opt.setAttribute('data-balance', bal);
            select.appendChild(opt);
          }
        });
      }

      function onAdjInvoiceSelected(invId) {
        var snapBox = document.getElementById('adj-inv-snapshot');
        if (!invId) {
          snapBox.classList.add('hidden');
          return;
        }

        var select = document.getElementById('inp-adj-invoice-select');
        var opt = select.options[select.selectedIndex];
        if (!opt) return;

        var customer = opt.getAttribute('data-customer');
        var grandTotal = Number(opt.getAttribute('data-grandtotal')) || 0;
        var paid = Number(opt.getAttribute('data-paid')) || 0;
        var balance = Number(opt.getAttribute('data-balance')) || 0;

        document.getElementById('adj-snap-total').innerText = formatINR(grandTotal);
        document.getElementById('adj-snap-paid').innerText = formatINR(paid);
        document.getElementById('adj-snap-bal').innerText = formatINR(balance);
        snapBox.classList.remove('hidden');

        var clientSelect = document.getElementById('inp-adj-client-select');
        if (clientSelect && !clientSelect.value && customer) {
          clientSelect.value = customer;
        }

        document.getElementById('inp-adj-amount').value = balance;
        calculateAdjBalancePreview();
      }

      function calculateAdjBalancePreview() {
        var select = document.getElementById('inp-adj-invoice-select');
        var curBalance = 0;
        if (select && select.value) {
          var opt = select.options[select.selectedIndex];
          if (opt) curBalance = Number(opt.getAttribute('data-balance')) || 0;
        }

        var adjAmt = Number(document.getElementById('inp-adj-amount').value) || 0;
        var newBal = Math.max(0, curBalance - adjAmt);

        document.getElementById('adj-prev-balance').innerText = formatINR(newBal);

        var statusHint = document.getElementById('adj-prev-status-text');
        if (statusHint) {
          statusHint.innerText = "Requires sign-off from the Primary Approver, Finance Head, and Director before this reduces the invoice balance.";
          statusHint.className = "text-amber-700 font-bold";
        }
      }

      function handleSaveAdjustment(e) {
        e.preventDefault();
        var invId = document.getElementById('inp-adj-invoice-select').value;
        if (!invId) {
          alert("Please select a valid pending invoice.");
          return;
        }

        var invSelect = document.getElementById('inp-adj-invoice-select');
        var opt = invSelect.options[invSelect.selectedIndex];
        var curBalance = Number(opt.getAttribute('data-balance')) || 0;
        var adjAmount = Number(document.getElementById('inp-adj-amount').value) || 0;

        if (adjAmount <= 0) {
          alert("Please specify an adjustment amount greater than zero.");
          return;
        }

        if (adjAmount > curBalance + 1) {
          alert(`Adjustment amount (${formatINR(adjAmount)}) cannot exceed the current invoice balance (${formatINR(curBalance)}).`);
          return;
        }

        var selectedTypeElem = document.querySelector('input[name="adj_type_radio"]:checked');
        var adjType = selectedTypeElem ? selectedTypeElem.value : "Goodwill Discount / Commercial Adjustment";

        var myEmpId = localStorage.getItem('employeeId');
        var myName = localStorage.getItem('userName');

        var adjData = {
          invoiceId: invId,
          invoiceNumber: opt.getAttribute('data-invoicenum'),
          customerName: opt.getAttribute('data-customer'),
          invoiceGrandTotal: Number(opt.getAttribute('data-grandtotal')) || 0,
          currentBalanceDue: curBalance,
          adjustmentType: adjType,
          adjustmentAmount: adjAmount,
          reasonCategory: document.getElementById('inp-adj-category').value,
          commercialJustification: document.getElementById('inp-adj-justification').value.trim(),
          requestedBy: myName,
          requestedByEmpId: myEmpId,
          requestDate: getFormattedToday()
        };

        // Every write-off / goodwill request requires all three named
        // authorities (Primary Approver, Finance Head, Director) to sign
        // off — there is no shortcut to instantly self-sanction it, for
        // any role.
        var res = window.RevOpsStore.createArAdjustmentRequest(adjData);
        if (!res) {
          alert("Failed to submit adjustment request.");
          return;
        }

        alert(`✅ Adjustment request ${res.adjustmentNumber || res.refNumber} submitted. It requires sign-off from the Primary Approver, Finance Head, and Director before the invoice balance is reduced.`);

        closeAdjustmentModal();
        populatePaymentClientDropdown();
        populateInvoiceDropdown();
        switchPaymentView('adjustments');
      }

      function deleteArAdjustment(adjId) {
        if (confirm("Are you sure you want to delete this adjustment request?")) {
          var adjustments = window.RevOpsStore.getCollection('arAdjustments') || [];
          var adj = adjustments.find(function(a) { return a.id === adjId; });
          window.RevOpsStore.deleteItem('arAdjustments', adjId);

          if (adj && adj.invoiceId) {
            window.RevOpsStore.syncInvoicePaymentStatus(adj.invoiceId);
          }
          renderActivePaymentView();
        }
      }

      // Modal 5: Three-way sign-off (Primary Approver / Finance Head / Director)
      // Each named authority signs independently; the adjustment only takes
      // effect once all three have signed 'Approved'.
      var SIGNOFF_LABELS = {
        primaryApproverSignoff: { flag: 'isPrimaryApprover', title: 'Primary Approver Sign-Off', roleLabel: 'Primary Approver' },
        financeHeadSignoff: { flag: 'isFinanceHead', title: 'Finance Head Sign-Off', roleLabel: 'Finance Head' },
        directorSignoff: { flag: 'isDirector', title: 'Director Sign-Off', roleLabel: 'Director' }
      };

      function openDirectorApprovalModal(adjId, signoffKey) {
        var adjustments = window.RevOpsStore.getCollection('arAdjustments') || [];
        var adj = adjustments.find(function(a) { return a.id === adjId; });
        if (!adj) return;

        var meta = SIGNOFF_LABELS[signoffKey];
        if (!meta || localStorage.getItem(meta.flag) !== 'true') {
          alert("You are not the designated approver for this sign-off.");
          return;
        }

        document.getElementById('dir-adj-id').value = adj.id;
        document.getElementById('dir-signoff-key').value = signoffKey;
        document.getElementById('dir-modal-title').innerText = meta.title;
        document.getElementById('dir-modal-ref').innerText = `Ref: ${adj.adjustmentNumber || adj.refNumber} - ${adj.customerName}`;
        document.getElementById('dir-customer-name').innerText = adj.customerName;
        document.getElementById('dir-invoice-num').innerText = adj.invoiceNumber;
        document.getElementById('dir-adj-type').innerText = adj.adjustmentType;
        document.getElementById('dir-adj-amount').innerText = formatINR(adj.adjustmentAmount);
        document.getElementById('dir-adj-category').innerText = adj.reasonCategory;
        document.getElementById('dir-adj-requested-by').innerText = `${adj.requestedBy || 'Staff'} on ${adj.requestedDate}`;
        document.getElementById('dir-adj-justification').innerText = adj.detailedJustification;
        document.getElementById('dir-adj-remarks').value = "Approved and sanctioned under Corporate Authority & Bad Debt Provisioning policy.";

        var progressParts = [];
        Object.keys(SIGNOFF_LABELS).forEach(function(key) {
          var so = adj[key];
          var label = SIGNOFF_LABELS[key].roleLabel;
          progressParts.push(so ? (label + ': ' + so.decision) : (label + ': pending'));
        });
        document.getElementById('dir-signoff-progress').innerText = progressParts.join(' • ');

        document.getElementById('director-approval-modal').classList.remove('hidden');
      }

      function closeDirectorApprovalModal() {
        document.getElementById('director-approval-modal').classList.add('hidden');
      }

      function executeDirectorDecision(decision) {
        var adjId = document.getElementById('dir-adj-id').value;
        var signoffKey = document.getElementById('dir-signoff-key').value;
        var remarks = document.getElementById('dir-adj-remarks').value.trim();
        var myName = localStorage.getItem('userName') || SIGNOFF_LABELS[signoffKey].roleLabel;
        var myEmpId = localStorage.getItem('employeeId') || '';

        var res = window.RevOpsStore.signArAdjustment(adjId, signoffKey, decision, myName, myEmpId, remarks);
        if (res && res.success) {
          closeDirectorApprovalModal();
          populatePaymentClientDropdown();
          populateInvoiceDropdown();
          renderActivePaymentView();
          if (res.status === 'Approved') {
            alert(`✅ All three sign-offs complete — adjustment approved and invoice balance updated.`);
          } else if (res.status === 'Rejected') {
            alert(`❌ Adjustment rejected by ${SIGNOFF_LABELS[signoffKey].roleLabel}.`);
          } else {
            alert(`Signed as ${decision} by ${SIGNOFF_LABELS[signoffKey].roleLabel}. Still awaiting the remaining sign-off(s) before this takes effect.`);
          }
        } else {
          alert("Failed to record decision: " + (res && res.error || "Unknown error"));
        }
      }

      // Modal 6: Printable Director Authorization & Bad Debt / Goodwill Voucher
      function viewPrintableAdjVoucher(adjId) {
        var adjustments = window.RevOpsStore.getCollection('arAdjustments') || [];
        var adj = adjustments.find(function(a) { return a.id === adjId; });
        if (!adj) return;

        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var linkedInv = invoices.find(function(i) { return i.id === adj.invoiceId || i.invoiceNumber === adj.invoiceNumber; });

        var adjRef = adj.adjustmentNumber || adj.refNumber || 'ADJ-REQ';
        document.getElementById('adj-voucher-title').innerText = `Authorization Certificate - ${adjRef}`;
        var wrapper = document.getElementById('printable-adj-wrapper');

        var isApproved = adj.status === 'Approved';
        var latestSignoffDate = [adj.primaryApproverSignoff, adj.financeHeadSignoff, adj.directorSignoff]
          .filter(Boolean).map(function(so) { return so.signedAt; }).pop();

        wrapper.innerHTML = `
          <!-- Header -->
          <div class="flex justify-between items-start border-b-2 border-purple-950 pb-4">
            <div>
              <div class="flex items-center space-x-2">

                <span class="text-2xl font-black text-purple-950 tracking-tight">MEASURE DI TECHNOLOGIES</span>
                <span class="px-2 py-0.5 rounded bg-purple-900 text-white text-[10px] font-black uppercase">Three-Way Authorization</span>
              </div>
              <p class="text-xs text-slate-600 mt-1">
                Plot No. 42, SIDCO Industrial Estate, Guindy, Chennai - 600032, Tamil Nadu<br>
                <strong>GSTIN:</strong> 33AAACM4209L1ZT | <strong>CIN:</strong> U72900TN2020PTC135890
              </p>
            </div>
            <div class="text-right">
              <h2 class="text-base font-black text-purple-950 uppercase tracking-wide">AR ADJUSTMENT MEMO</h2>
              <div class="text-xs font-mono font-bold text-slate-900 mt-1">${escapeHtml(adjRef)}</div>
              <div class="text-xs text-slate-500 font-mono mt-0.5">Date: ${escapeHtml(latestSignoffDate || adj.requestedDate)}</div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isApproved ? 'bg-purple-100 text-purple-900' : 'bg-amber-100 text-amber-900'} uppercase">
                ${escapeHtml(adj.status)}
              </span>
            </div>
          </div>

          <!-- Customer & Invoice Target -->
          <div class="bg-purple-50/60 p-4 rounded-xl border border-purple-200 text-xs space-y-2">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="text-[10px] font-bold uppercase text-purple-900 block">Customer / Organization:</span>
                <div class="font-bold text-slate-900 text-sm">${escapeHtml(adj.customerName)}</div>
              </div>
              <div class="text-right">
                <span class="text-[10px] font-bold uppercase text-purple-900 block">Commercial Invoice Reference:</span>
                <div class="font-bold font-mono text-indigo-700 text-sm">${escapeHtml(adj.invoiceNumber)}</div>
              </div>
            </div>
          </div>

          <!-- Adjustment Breakdown Table -->
          <div class="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-100 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-700">
                  <th class="py-2.5 px-3">Adjustment Nature</th>
                  <th class="py-2.5 px-3">Reason Category</th>
                  <th class="py-2.5 px-3 text-right">Invoice Value (Rs.)</th>
                  <th class="py-2.5 px-3 text-right text-purple-900 font-black">Authorized Reduction (Rs.)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr>
                  <td class="py-3 px-3 font-bold text-slate-900">
                    ${escapeHtml(adj.adjustmentType)}
                  </td>
                  <td class="py-3 px-3 text-slate-700">
                    ${escapeHtml(adj.reasonCategory)}
                  </td>
                  <td class="py-3 px-3 text-right font-mono font-bold text-slate-800">
                    ${formatINR(adj.invoiceGrandTotal || (linkedInv ? linkedInv.grandTotal : 0))}
                  </td>
                  <td class="py-3 px-3 text-right font-mono font-black text-purple-900 text-sm">
                    ${formatINR(adj.adjustmentAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Justification & Corporate Minutes -->
          <div class="space-y-3 text-xs">
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span class="text-[10px] font-bold uppercase text-slate-500 block mb-1">Commercial Justification & Case Rationale:</span>
              <p class="text-slate-800 whitespace-pre-wrap">${escapeHtml(adj.detailedJustification)}</p>
            </div>
          </div>

          <!-- Ledger Balance Impact -->
          ${linkedInv ? `
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between text-xs font-mono">
              <span>Invoice Total: <strong>${formatINR(linkedInv.grandTotal)}</strong></span>
              <span>Paid (Cash+TDS): <strong>${formatINR((linkedInv.paidAmount || 0) + (linkedInv.tdsDeducted || 0))}</strong></span>
              <span>Total Adjustments: <strong>${formatINR((linkedInv.adjustmentAmount || 0) + (linkedInv.writeOffAmount || 0))}</strong></span>
              <span class="font-black text-slate-900">Net Remaining AR: <strong class="${linkedInv.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}">${formatINR(linkedInv.balanceDue)}</strong></span>
            </div>
          ` : ''}

          <!-- Three-Way Sign-Off -->
          <div class="border-t border-slate-200 pt-6 text-xs">
            <div class="text-[11px] text-slate-400 mb-4">
              Document Ref: ${escapeHtml(adjRef)}<br>
              Requires sign-off from the Primary Approver, Finance Head, and Director — takes effect only once all three have signed.
            </div>
            <div class="grid grid-cols-3 gap-4 text-center">
              ${[
                { so: adj.primaryApproverSignoff, label: 'Primary Approver' },
                { so: adj.financeHeadSignoff, label: 'Finance Head' },
                { so: adj.directorSignoff, label: 'Director' }
              ].map(function(role) {
                return `
                  <div>
                    <div class="w-full h-12 border-b-2 ${role.so ? 'border-purple-900' : 'border-slate-200'} flex items-center justify-center text-[10px] text-purple-900 font-bold italic">
                      ${role.so ? escapeHtml(role.so.signedBy) : '— Not yet signed —'}
                    </div>
                    <span class="font-black text-slate-900 block mt-1 uppercase">${escapeHtml(role.label)}</span>
                    ${role.so ? `<span class="text-[9px] ${role.so.decision === 'Approved' ? 'text-emerald-700' : 'text-rose-700'} font-bold block">${escapeHtml(role.so.decision)} • ${escapeHtml(role.so.signedAt)}</span>` : `<span class="text-[9px] text-amber-600 font-bold block">PENDING</span>`}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;

        document.getElementById('adj-voucher-modal').classList.remove('hidden');
      }

      function closeAdjVoucherModal() {
        document.getElementById('adj-voucher-modal').classList.add('hidden');
      }

      function printAdjVoucherDoc() {
        window.print();
      }

