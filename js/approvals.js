      document.addEventListener('DOMContentLoaded', function() {
        if (checkAuth(['super_admin', 'admin', 'manager', 'staff'])) {
          initApprovalsPage();
        }
      });

      // Each section: what to fetch, how to filter to "needs my action", and
      // where "Review & Approve" sends the viewer (the actual approve/
      // reject/ratify controls live on that record's home page).
      function getApprovalSections() {
        var quotes = window.RevOpsStore.getCollection('quotations') || [];
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var payments = window.RevOpsStore.getCollection('payments') || [];
        var arAdjustments = window.RevOpsStore.getCollection('arAdjustments') || [];

        var sections = [];

        if (hasApprovalAuthority('isPrimaryApprover')) {
          sections.push({
            key: 'quote-primary',
            title: 'Quotations — Primary Approval',
            icon: '📑',
            items: quotes.filter(function(q) { return q.status === 'Pending Approval'; }),
            rowFn: function(q) {
              return {
                ref: q.quoteNumber || q.id,
                customer: q.customerName,
                amount: q.grandTotal,
                by: q.employeeName,
                date: q.createdDate,
                link: 'quotations.html'
              };
            }
          });
        }

        if (hasApprovalAuthority('isDirector')) {
          sections.push({
            key: 'quote-ratify',
            title: 'Quotations — Director Ratification',
            icon: '👑',
            items: quotes.filter(function(q) { return q.status === 'Approved' && q.directorRatificationStatus === 'Pending'; }),
            rowFn: function(q) {
              return {
                ref: q.quoteNumber || q.id,
                customer: q.customerName,
                amount: q.grandTotal,
                by: q.primaryApprovedBy,
                date: q.primaryApprovedAt,
                link: 'quotations.html'
              };
            }
          });
        }

        if (hasApprovalAuthority('isPrimaryApprover')) {
          sections.push({
            key: 'order-primary',
            title: 'Orders — Primary Approval',
            icon: '📦',
            items: orders.filter(function(o) { return o.status === 'Pending Primary Approval'; }),
            rowFn: function(o) {
              return {
                ref: o.poNumber || o.id,
                customer: o.customerName,
                amount: o.orderValue || o.value,
                by: o.employeeName,
                date: o.createdDate,
                link: 'orders.html'
              };
            }
          });
        }

        if (hasApprovalAuthority('isDirector')) {
          sections.push({
            key: 'order-ratify',
            title: 'Orders — Director Ratification',
            icon: '👑',
            items: orders.filter(function(o) { return o.status === 'Booked' && o.directorRatificationStatus === 'Pending'; }),
            rowFn: function(o) {
              return {
                ref: o.poNumber || o.id,
                customer: o.customerName,
                amount: o.orderValue || o.value,
                by: o.primaryApprovedBy,
                date: o.primaryApprovedAt,
                link: 'orders.html'
              };
            }
          });
        }

        if (hasApprovalAuthority('isPrimaryApprover')) {
          sections.push({
            key: 'invoice-primary',
            title: 'Invoices — Primary Approval',
            icon: '🧾',
            items: invoices.filter(function(i) { return i.status === 'Pending Senior Approval'; }),
            rowFn: function(i) {
              return {
                ref: i.invoiceNumber || i.id,
                customer: i.customerName,
                amount: i.grandTotal,
                by: i.employeeName,
                date: i.invoiceDate,
                link: 'invoices.html'
              };
            }
          });
        }

        if (hasApprovalAuthority('isDirector')) {
          sections.push({
            key: 'invoice-ratify',
            title: 'Invoices — Director Ratification',
            icon: '👑',
            items: invoices.filter(function(i) { return (i.status === 'Approved' || i.status === 'Issued') && i.directorRatificationStatus === 'Pending'; }),
            rowFn: function(i) {
              return {
                ref: i.invoiceNumber || i.id,
                customer: i.customerName,
                amount: i.grandTotal,
                by: i.approvalInfo ? i.approvalInfo.approvedBy : '',
                date: i.invoiceDate,
                link: 'invoices.html'
              };
            }
          });
        }

        if (hasApprovalAuthority('isFinanceHead')) {
          sections.push({
            key: 'payment-verify',
            title: 'Payments — Finance Verification',
            icon: '💳',
            items: payments.filter(function(p) { return p.status === 'Pending Finance Verification'; }),
            rowFn: function(p) {
              return {
                ref: p.receiptNumber || p.id,
                customer: p.customerName,
                amount: p.amount,
                by: p.employeeName,
                date: p.paymentDate,
                link: 'payments.html'
              };
            }
          });
        }

        if (hasApprovalAuthority('isPrimaryApprover') || hasApprovalAuthority('isFinanceHead') || hasApprovalAuthority('isDirector')) {
          sections.push({
            key: 'writeoff-signoff',
            title: 'Payment Write-Offs / Goodwill — Your Sign-Off',
            icon: '⚖️',
            items: arAdjustments.filter(function(adj) {
              if (adj.status !== 'Pending Director Approval') return false;
              return (hasApprovalAuthority('isPrimaryApprover') && !adj.primaryApproverSignoff) ||
                     (hasApprovalAuthority('isFinanceHead') && !adj.financeHeadSignoff) ||
                     (hasApprovalAuthority('isDirector') && !adj.directorSignoff);
            }),
            rowFn: function(adj) {
              return {
                ref: adj.adjustmentNumber || adj.refNumber || adj.id,
                customer: adj.customerName,
                amount: adj.adjustmentAmount,
                by: adj.requestedBy,
                date: adj.requestedDate,
                link: 'payments.html?action=adjustments'
              };
            }
          });
        }

        return sections;
      }

      function initApprovalsPage() {
        renderApprovalsPage();
      }

      function renderApprovalsPage() {
        var sections = getApprovalSections();
        var container = document.getElementById('approvals-sections');
        var noAuthorityNotice = document.getElementById('no-authority-notice');
        var totalBadge = document.getElementById('approvals-total-badge');

        var isAnyApprover = hasApprovalAuthority('isPrimaryApprover') || hasApprovalAuthority('isFinanceHead') || hasApprovalAuthority('isDirector');
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
