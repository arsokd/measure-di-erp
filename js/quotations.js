var currentEditingQuoteId = null;
      var activeQuoteItems = [];
      var activeQuoteAttachments = [];

      function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      }

      function handleQuoteFilesSelected(e) {
        var files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        var currentCount = activeQuoteAttachments.length;
        if (currentCount + files.length > 10) {
          alert("Attachment limit exceeded: Maximum 10 files allowed. You can only add " + (10 - currentCount) + " more file(s).");
          return;
        }

        var totalCurrentBytes = activeQuoteAttachments.reduce(function(acc, f) { return acc + (f.size || 0); }, 0);
        var maxBytes = 100 * 1024 * 1024; // 100 MB maximum

        var readCount = 0;
        files.forEach(function(file) {
          if (totalCurrentBytes + file.size > maxBytes) {
            alert("File '" + file.name + "' exceeds total 100 MB attachment capacity. Skipping this file.");
            return;
          }
          if (activeQuoteAttachments.length >= 10) return;

          totalCurrentBytes += file.size;

          var reader = new FileReader();
          reader.onload = function(evt) {
            activeQuoteAttachments.push({
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream',
              lastModified: file.lastModified,
              dataUrl: evt.target.result
            });
            readCount++;
            if (readCount === files.length || activeQuoteAttachments.length >= 10) {
              renderQuoteAttachedFilesList();
            }
          };
          reader.readAsDataURL(file);
        });

        e.target.value = '';
      }

      function removeQuoteAttachment(idx) {
        activeQuoteAttachments.splice(idx, 1);
        renderQuoteAttachedFilesList();
      }

      function renderQuoteAttachedFilesList() {
        var container = document.getElementById('quote-attached-files-list');
        var countBadge = document.getElementById('quote-files-count-badge');
        if (!container) return;

        container.innerHTML = '';
        var totalBytes = activeQuoteAttachments.reduce(function(acc, f) { return acc + (f.size || 0); }, 0);

        if (countBadge) {
          countBadge.innerText = activeQuoteAttachments.length + " / 10 files (" + formatFileSize(totalBytes) + " / 100 MB)";
          if (activeQuoteAttachments.length > 0) {
            countBadge.className = "text-[11px] font-bold text-indigo-700";
          } else {
            countBadge.className = "text-[11px] font-bold text-slate-500";
          }
        }

        activeQuoteAttachments.forEach(function(file, idx) {
          var item = document.createElement('div');
          item.className = "bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between";
          
          var ext = (file.name.split('.').pop() || '').toLowerCase();
          var iconColor = "bg-indigo-100 text-indigo-700";
          var iconText = "FILE";
          if (ext === 'pdf') { iconColor = "bg-rose-100 text-rose-700"; iconText = "PDF"; }
          else if (ext === 'zip' || ext === 'rar' || ext === '7z') { iconColor = "bg-amber-100 text-amber-800"; iconText = "ZIP"; }
          else if (['png', 'jpg', 'jpeg', 'dwg', 'dxf'].includes(ext)) { iconColor = "bg-emerald-100 text-emerald-700"; iconText = "CAD"; }
          else if (['doc', 'docx'].includes(ext)) { iconColor = "bg-blue-100 text-blue-700"; iconText = "DOC"; }
          else if (['xls', 'xlsx'].includes(ext)) { iconColor = "bg-teal-100 text-teal-700"; iconText = "XLS"; }

          item.innerHTML = `
            <div class="flex items-center space-x-2.5 min-w-0 pr-2">
              <div class="w-7 h-7 rounded-lg ${iconColor} flex items-center justify-center font-black text-[10px] shrink-0">
                ${iconText}
              </div>
              <div class="min-w-0">
                <p class="text-xs font-bold text-slate-800 truncate" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</p>
                <p class="text-[10px] text-slate-400 font-medium">${formatFileSize(file.size)}</p>
              </div>
            </div>
            <div class="flex items-center space-x-1 shrink-0">
              <button type="button" onclick="downloadAttachmentDirect(${idx})" class="p-1 text-slate-400 hover:text-indigo-600 rounded text-xs font-bold" title="Preview / Download">
                ⬇️
              </button>
              <button type="button" onclick="removeQuoteAttachment(${idx})" class="p-1 text-slate-400 hover:text-rose-600 rounded text-base font-bold leading-none cursor-pointer" title="Remove File">
                &times;
              </button>
            </div>
          `;
          container.appendChild(item);
        });
      }

      function downloadAttachmentDirect(idx) {
        var file = activeQuoteAttachments[idx];
        if (!file || !file.dataUrl) return;
        var a = document.createElement('a');
        a.href = file.dataUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      function downloadFileFromData(dataUrl, fileName) {
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      function onDiscPercentChanged() {
        var grossSubtotal = 0;
        activeQuoteItems.forEach(function(it) { grossSubtotal += (it.qty || 1) * (it.unitPrice || 0); });

        var percent = parseFloat(document.getElementById('inp-overall-disc-percent').value) || 0;
        var amt = grossSubtotal * (percent / 100);
        document.getElementById('inp-overall-disc-amount').value = Math.round(amt);

        calculateQuoteTotals();
      }

      function onDiscAmtChanged() {
        var grossSubtotal = 0;
        activeQuoteItems.forEach(function(it) { grossSubtotal += (it.qty || 1) * (it.unitPrice || 0); });

        var amt = parseFloat(document.getElementById('inp-overall-disc-amount').value) || 0;
        var percent = grossSubtotal > 0 ? (amt / grossSubtotal) * 100 : 0;
        document.getElementById('inp-overall-disc-percent').value = parseFloat(percent.toFixed(2));

        calculateQuoteTotals();
      }

      document.addEventListener('DOMContentLoaded', function() {
        if (typeof checkAuth === 'function') {
          checkAuth(['super_admin', 'admin', 'manager', 'staff']);
        }

        setupQuotePageFilters();
        renderQuotations();

        // Check URL params for leadId or action=new
        var params = new URLSearchParams(window.location.search);
        var urlLeadId = params.get('leadId');
        var action = params.get('action');

        if (urlLeadId || action === 'new') {
          // Check sessionStorage for prefilled lead or fetch from collection
          var prefillLead = null;
          var storedPrefill = sessionStorage.getItem('prefill_quote_lead');
          if (storedPrefill) {
            try {
              prefillLead = JSON.parse(storedPrefill);
            } catch(e) {}
            sessionStorage.removeItem('prefill_quote_lead');
          }

          var targetLeadId = urlLeadId || (prefillLead ? prefillLead.id : '');
          if (targetLeadId && !prefillLead) {
            var leads = window.RevOpsStore.getCollection('leads') || [];
            prefillLead = leads.find(function(l) { return l.id === targetLeadId || l.leadNumber === targetLeadId; });
          }

          openQuoteModal(null, prefillLead);
        }
      });

      function setupQuotePageFilters() {
        var userRole = localStorage.getItem('userRole');
        var employees = window.RevOpsStore.getCollection('employees') || [];

        if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') {
          var wrapper = document.getElementById('quote-owner-filter-wrapper');
          var select = document.getElementById('quote-owner-filter');
          if (wrapper && select) {
            wrapper.classList.remove('hidden');
            select.innerHTML = '<option value="All">All Sales Reps</option>';
            employees.forEach(function(e) {
              var opt = document.createElement('option');
              opt.value = e.employeeId;
              opt.innerText = e.fullName + " (" + e.employeeId + ")";
              select.appendChild(opt);
            });
          }
        }
      }

      function getQuotationsList() {
        return window.RevOpsStore.getCollection('quotations') || [];
      }

      // Clicking a scorecard tile filters the registry to exactly that
      // category — click again to clear it back to "Total".
      var activeStatCardFilter = null; // null | 'pending' | 'approved' | 'converted'

      function filterQuotesByStatCard(type) {
        activeStatCardFilter = (activeStatCardFilter === type) ? null : type;
        var statusSelect = document.getElementById('quote-status-filter');
        if (statusSelect) statusSelect.value = 'All';
        renderQuotations();
        var tbody = document.getElementById('quotations-tbody');
        if (tbody) tbody.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      function updateStatCardHighlight() {
        [
          { id: 'statcard-total', type: null },
          { id: 'statcard-pending', type: 'pending' },
          { id: 'statcard-approved', type: 'approved' },
          { id: 'statcard-converted', type: 'converted' }
        ].forEach(function(c) {
          var el = document.getElementById(c.id);
          if (!el) return;
          el.classList.toggle('ring-2', activeStatCardFilter === c.type && c.type !== null);
          el.classList.toggle('ring-indigo-400', activeStatCardFilter === c.type && c.type !== null);
        });
      }

      // A quote's linked Order has itself been invoiced — once that's true,
      // the quote is done and doesn't need to stay in the everyday list.
      function computeInvoicedQuoteIds(quotes) {
        var orders = window.RevOpsStore.getCollection('orders') || [];
        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var invoicedOrderIds = new Set(invoices.map(function(inv) { return inv.orderId; }).filter(Boolean));
        var invoicedIds = new Set();
        quotes.forEach(function(q) {
          if (q.convertedOrderId && invoicedOrderIds.has(q.convertedOrderId)) {
            invoicedIds.add(q.id);
          }
        });
        return invoicedIds;
      }

      function renderQuotations() {
        var quotes = getQuotationsList();
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId');

        var fyFilter = document.getElementById('quote-fy-filter')?.value || '2026-27';
        var statusFilter = document.getElementById('quote-status-filter')?.value || 'All';
        var ownerFilter = document.getElementById('quote-owner-filter')?.value || 'All';
        var searchQuery = (document.getElementById('quote-search-input')?.value || '').toLowerCase();
        var showInvoiced = document.getElementById('chk-show-invoiced-quotes')?.checked || false;

        var invoicedQuoteIds = computeInvoicedQuoteIds(quotes);

        // RBAC Scoping & Filtering — everything except the scorecard-tile
        // filter, since the scorecards themselves must always report the
        // true totals for this scope, not a number that shrinks to match
        // whichever tile happens to be selected.
        var baseFiltered = quotes.filter(function(q) {
          if (userRole === 'staff' && q.employeeId !== myEmpId) return false;
          if (fyFilter !== 'All' && q.financialYear && q.financialYear !== fyFilter) return false;
          if (statusFilter !== 'All' && q.status !== statusFilter) return false;
          if (ownerFilter !== 'All' && q.employeeId !== ownerFilter) return false;

          if (searchQuery) {
            var text = (q.quoteNumber + ' ' + q.customerName + ' ' + (q.contactPerson || '') + ' ' + (q.employeeName || '')).toLowerCase();
            if (!text.includes(searchQuery)) return false;
          } else if (!showInvoiced && invoicedQuoteIds.has(q.id)) {
            // Already-invoiced quotes are hidden from the default view to
            // avoid a bulk pile-up — still reachable via search or the
            // "Show already-invoiced" toggle.
            return false;
          }
          return true;
        });

        // Table rows additionally apply whichever scorecard tile is active.
        var filtered = baseFiltered.filter(function(q) {
          if (activeStatCardFilter === 'pending' && q.status !== 'Pending Approval') return false;
          if (activeStatCardFilter === 'approved' && q.status !== 'Approved' && q.status !== 'Sent to Customer') return false;
          if (activeStatCardFilter === 'converted' && q.status !== 'Converted to Order') return false;
          return true;
        });

        var invoicedHiddenCount = quotes.filter(function(q) { return invoicedQuoteIds.has(q.id); }).length;
        var invoicedHint = document.getElementById('invoiced-quotes-hint');
        if (invoicedHint) {
          invoicedHint.innerText = invoicedHiddenCount > 0 && !showInvoiced && !searchQuery
            ? (invoicedHiddenCount + ' already-invoiced quotation(s) hidden — search or check "Show already-invoiced" to see them.')
            : '';
        }

        // Compute KPIs from baseFiltered (never shrunk by the scorecard filter itself)
        var totalCount = baseFiltered.length;
        var totalVal = 0;
        var pendingCount = 0;
        var approvedCount = 0;
        var convertedCount = 0;

        baseFiltered.forEach(function(q) {
          totalVal += (q.grandTotal || 0);
          if (q.status === 'Pending Approval') pendingCount++;
          if (q.status === 'Approved' || q.status === 'Sent to Customer') approvedCount++;
          if (q.status === 'Converted to Order') convertedCount++;
        });

        document.getElementById('stat-total-count').innerText = totalCount;
        document.getElementById('stat-total-val').innerText = 'Total Value: ₹' + totalVal.toLocaleString('en-IN');
        document.getElementById('stat-pending-count').innerText = pendingCount;
        document.getElementById('stat-approved-count').innerText = approvedCount;
        document.getElementById('stat-converted-count').innerText = convertedCount;
        
        var conversionRate = totalCount > 0 ? Math.round((convertedCount / totalCount) * 100) : 0;
        document.getElementById('stat-conversion-rate').innerText = conversionRate + '% Quote-to-Order Conversion';
        updateStatCardHighlight();

        // Render Urgent Pending Approvals Banner for Manager / Super Admin
        renderPendingApprovalsBanner(quotes, userRole);

        // Render Table Rows
        var tbody = document.getElementById('quotations-tbody');
        var emptyState = document.getElementById('quotes-empty-state');

        if (!tbody) return;
        tbody.innerHTML = '';

        if (filtered.length === 0) {
          emptyState.classList.remove('hidden');
          return;
        } else {
          emptyState.classList.add('hidden');
        }

        // Pending Approval quotations always sort to the top, regardless of
        // date, so approvers see what needs action first without hunting.
        filtered.sort(function(a, b) {
          var aPending = a.status === 'Pending Approval' ? 0 : 1;
          var bPending = b.status === 'Pending Approval' ? 0 : 1;
          if (aPending !== bPending) return aPending - bPending;
          return new Date(b.createdDate || '2026-01-01') - new Date(a.createdDate || '2026-01-01');
        });

        filtered.forEach(function(q) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";

          var statusBadge = getQuoteStatusBadgeHtml(q);

          // CRM Funnel Stage synced from lead
          var leads = window.RevOpsStore.getCollection('leads') || [];
          var linkedLead = leads.find(function(l) { return l.id === q.leadId || l.leadNumber === q.leadId || (q.customerName && l.customerName === q.customerName); });
          var funnelStage = linkedLead ? (linkedLead.stage || linkedLead.status || 'Commercial Offer Submitted') : (q.funnelStage || 'Commercial Offer Submitted');
          var funnelBadgeClass = "bg-slate-100 text-slate-700 border-slate-200";
          if (funnelStage.indexOf("Order Confirmed") !== -1 || funnelStage === "Won") funnelBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-300";
          else if (funnelStage.indexOf("Lead Qualified") !== -1 || funnelStage.indexOf("Pre-Qualification") !== -1) funnelBadgeClass = "bg-purple-50 text-purple-700 border-purple-300";
          else if (funnelStage.indexOf("Commercial Offer") !== -1) funnelBadgeClass = "bg-blue-50 text-blue-700 border-blue-300";
          else if (funnelStage.indexOf("Technical") !== -1 || funnelStage.indexOf("Site Visit") !== -1) funnelBadgeClass = "bg-amber-50 text-amber-700 border-amber-300";
          else if (funnelStage.indexOf("Lost") !== -1) funnelBadgeClass = "bg-rose-50 text-rose-700 border-rose-300";

          var canApprove = (hasApprovalAuthority('isPrimaryApprover')) && q.status === 'Pending Approval';
          var canRatify = (localStorage.getItem('isDirector') === 'true') && q.status === 'Approved' && q.directorRatificationStatus === 'Pending';
          var canConvert = (q.status === 'Approved' || q.status === 'Sent to Customer') && !q.convertedOrderId;
          var canSend = (q.status === 'Approved' || q.status === 'Sent to Customer' || q.status === 'Converted to Order');
          var fileCount = (q.attachments && Array.isArray(q.attachments)) ? q.attachments.length : 0;
          var totalFileSize = (q.attachments && Array.isArray(q.attachments)) ? q.attachments.reduce(function(acc, f) { return acc + (f.size || 0); }, 0) : 0;

          tr.innerHTML = `
            <td class="px-4 py-3 font-bold text-indigo-900">
              <span class="block">${escapeHtml(q.quoteNumber || q.id)}</span>
              <span class="text-[10px] text-slate-400">Ver ${q.revision || 1}</span>
              ${fileCount > 0 ? `
                <span class="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title="${fileCount} technical file(s) attached (${formatFileSize(totalFileSize)})">
                  📎 ${fileCount} file${fileCount > 1 ? 's' : ''}
                </span>
              ` : ''}
            </td>
            <td class="px-4 py-3">
              <div class="font-bold text-slate-900">${escapeHtml(q.customerName)}</div>
              <div class="text-[10px] text-slate-500">${escapeHtml(q.vertical || '')} • ${escapeHtml(q.contactPerson || '')}</div>
              ${q.deliveryLeadTime ? `<div class="text-[9px] text-indigo-600 font-semibold">⏱ Lead: ${escapeHtml(q.deliveryLeadTime)}</div>` : ''}
            </td>
            <td class="px-4 py-3 text-center">
              <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${funnelBadgeClass}" title="Live Sync with CRM Funnel Status">
                ${escapeHtml(funnelStage)}
              </span>
            </td>
            <td class="px-4 py-3 text-[11px] text-slate-600">
              <div>${escapeHtml(q.createdDate || '')}</div>
              <div class="text-[10px] text-slate-400">Exp: ${escapeHtml(q.expiryDate || '30 days')}</div>
            </td>
            <td class="px-4 py-3 text-slate-700">
              ${escapeHtml(q.employeeName || q.employeeId)}
            </td>
            <td class="px-4 py-3 text-right font-semibold text-slate-700">
              ₹${(q.grossSubtotal || 0).toLocaleString('en-IN')}
            </td>
            <td class="px-4 py-3 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${q.overallDiscountPercent > 15 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-700'}">
                ${q.overallDiscountPercent || 0}%
              </span>
            </td>
            <td class="px-4 py-3 text-right font-black text-indigo-700 text-sm">
              ₹${(q.grandTotal || 0).toLocaleString('en-IN')}
            </td>
            <td class="px-4 py-3 text-center">
              ${statusBadge}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end space-x-1.5">
                <button onclick="viewPrintQuote('${q.id}')" class="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="View / Print PDF">
                  👁️
                </button>
                ${canSend ? `
                  <button onclick="openSendQuoteModal('${q.id}')" class="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-[10px] font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer" title="Send Quotation to Client via Email">
                    <span>✉️ Send Client</span>
                  </button>
                ` : ''}
                ${canApprove ? `
                  <button onclick="approveQuoteDirect('${q.id}')" class="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors font-bold" title="Approve (Primary Approver)">
                    ✅
                  </button>
                  <button onclick="rejectQuoteDirect('${q.id}')" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-bold" title="Reject">
                    ❌
                  </button>
                ` : ''}
                ${canRatify ? `
                  <button onclick="ratifyQuoteDirect('${q.id}')" class="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md text-[10px] font-bold shadow-xs transition-colors" title="Director Ratification">
                    👑 Ratify
                  </button>
                ` : ''}
                ${canConvert ? `
                  <a href="orders.html?bookFromQuote=${encodeURIComponent(q.id)}" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold shadow-xs transition-colors flex items-center space-x-1" title="Book Commercial Order / PO against this quotation">
                    <span>🚀 Book Order</span>
                  </a>
                ` : ''}
                <button onclick="createQuoteRevision('${q.id}')" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Create Revision">
                  🔄
                </button>
                <button onclick="editQuote('${q.id}')" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Quote">
                  ✏️
                </button>
                <button onclick="deleteQuote('${q.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Quote">
                  🗑️
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function getQuoteStatusBadgeHtml(q) {
        if (q.status === 'Pending Approval') {
          return `<span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            ⚠️ Pending Approval
          </span>`;
        } else if (q.status === 'Approved') {
          return `<div class="inline-flex flex-col items-center">
            <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
              ✅ Approved
            </span>
            ${q.directorRatificationStatus === 'Ratified' ?
              `<span class="text-[9px] text-purple-700 mt-0.5 font-bold">👑 Ratified by ${escapeHtml(q.directorRatifiedBy || 'Director')}</span>` :
              `<span class="text-[9px] text-amber-600 mt-0.5 font-semibold">Pending Director Ratification</span>`}
          </div>`;
        } else if (q.status === 'Sent to Customer') {
          return `<div class="inline-flex flex-col items-center">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-100 text-sky-800 border border-sky-300">
              📤 Sent to Client
            </span>
            ${q.lastSentDate ? `<span class="text-[9px] text-slate-400 mt-0.5 font-medium">${escapeHtml(q.lastSentDate)}</span>` : ''}
          </div>`;
        } else if (q.status === 'Converted to Order') {
          return `<span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300">
            📦 Converted to SO
          </span>`;
        } else if (q.status === 'Rejected') {
          return `<span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
            ❌ Discount Rejected
          </span>`;
        } else {
          return `<span class="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-300">
            📝 Draft
          </span>`;
        }
      }

      function renderPendingApprovalsBanner(quotes, userRole) {
        var banner = document.getElementById('pending-approvals-banner');
        var listContainer = document.getElementById('pending-approvals-list');
        var badge = document.getElementById('pending-count-badge');
        if (!banner || !listContainer) return;

        var isApprover = hasApprovalAuthority('isPrimaryApprover');
        if (!isApprover) {
          banner.classList.add('hidden');
          return;
        }

        var pendingQuotes = quotes.filter(function(q) { return q.status === 'Pending Approval'; });
        if (pendingQuotes.length === 0) {
          banner.classList.add('hidden');
          return;
        }

        banner.classList.remove('hidden');
        badge.innerText = pendingQuotes.length;
        listContainer.innerHTML = '';

        pendingQuotes.forEach(function(q) {
          var item = document.createElement('div');
          item.className = "bg-white p-3.5 rounded-xl border border-amber-300/80 shadow-xs flex items-center justify-between";
          
          var reqApproverText = 'Your Signoff';

          item.innerHTML = `
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-black text-slate-900 text-xs">${escapeHtml(q.quoteNumber)}</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                  ${q.overallDiscountPercent}% Disc
                </span>
                <span class="text-[10px] font-bold text-rose-600">${reqApproverText}</span>
              </div>
              <p class="text-xs font-bold text-slate-800 mt-0.5">${escapeHtml(q.customerName)}</p>
              <p class="text-[10px] text-slate-500">Net Amount: <strong class="text-indigo-700">₹${(q.grandTotal || 0).toLocaleString('en-IN')}</strong> • Owner: ${escapeHtml(q.employeeName)}</p>
            </div>
            <div class="flex items-center space-x-2">
              <button onclick="approveQuoteDirect('${q.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer">
                Approve
              </button>
              <button onclick="rejectQuoteDirect('${q.id}')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer">
                Reject
              </button>
            </div>
          `;
          listContainer.appendChild(item);
        });
      }

      // MODAL CONTROLS & FORM LOGIC
      function openQuoteModal(quoteId, prefillLead) {
        currentEditingQuoteId = quoteId || null;
        var modal = document.getElementById('quoteModal');
        modal.classList.remove('hidden');

        // Populate Lead dropdown
        var leads = window.RevOpsStore.getCollection('leads') || [];
        var leadSelect = document.getElementById('inp-quote-lead');
        leadSelect.innerHTML = '<option value="">-- Standalone Customer (Manual Entry) --</option>';
        leads.forEach(function(l) {
          var opt = document.createElement('option');
          opt.value = l.id;
          opt.innerText = (l.leadNumber || l.id) + " - " + l.customerName + " (" + (l.vertical || 'Projects') + ")";
          leadSelect.appendChild(opt);
        });

        var autofillNotice = document.getElementById('lead-autofill-notice');
        if (autofillNotice) autofillNotice.classList.add('hidden');

        // Populate Sales Owner dropdown
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var ownerSelect = document.getElementById('inp-quote-owner');
        ownerSelect.innerHTML = '';
        employees.forEach(function(e) {
          var opt = document.createElement('option');
          opt.value = e.employeeId;
          opt.innerText = e.fullName + " (" + e.employeeId + ")";
          ownerSelect.appendChild(opt);
        });

        // Set default owner to logged in user
        var myEmpId = localStorage.getItem('employeeId') || 'E-002';
        ownerSelect.value = myEmpId;

        if (quoteId) {
          // Edit existing quote
          var quotes = getQuotationsList();
          var q = quotes.find(function(it) { return it.id === quoteId; });
          if (q) {
            document.getElementById('quoteModalTitle').innerText = "✏️ Edit Quotation - " + q.quoteNumber;
            if (document.getElementById('inp-quote-lead-search')) document.getElementById('inp-quote-lead-search').value = "";
            document.getElementById('inp-quote-id').value = q.id;
            document.getElementById('inp-quote-revision').value = q.revision || 1;
            document.getElementById('inp-parent-quote-id').value = q.parentQuoteId || '';
            document.getElementById('inp-quote-lead').value = q.leadId || '';
            document.getElementById('inp-quote-customer').value = q.customerName || '';
            document.getElementById('inp-quote-contact').value = q.contactPerson || '';
            document.getElementById('inp-quote-email').value = q.email || '';
            document.getElementById('inp-quote-mobile').value = q.mobile || '';
            document.getElementById('inp-quote-cc').value = q.ccEmails || '';
            document.getElementById('inp-quote-vertical').value = q.vertical || 'Projects';
            document.getElementById('inp-quote-owner').value = q.employeeId || myEmpId;
            document.getElementById('inp-quote-address').value = q.address || '';
            document.getElementById('inp-quote-date').value = formatDateForInput(q.createdDate);
            document.getElementById('inp-quote-validity').value = q.validityDays || 30;
            document.getElementById('inp-quote-leadtime').value = q.deliveryLeadTime || '3-4 Weeks from advance PO';
            document.getElementById('inp-quote-advance-pct').value = q.advancePercent !== undefined ? q.advancePercent : 50;
            document.getElementById('inp-overall-disc-percent').value = q.overallDiscountPercent || 0;
            document.getElementById('inp-overall-disc-amount').value = Math.round(q.overallDiscountAmount || 0);
            document.getElementById('inp-quote-terms').value = q.termsAndConditions || '';
            document.getElementById('inp-quote-remarks').value = q.discountRemarks || '';

            activeQuoteItems = q.items ? JSON.parse(JSON.stringify(q.items)) : [];
            activeQuoteAttachments = q.attachments ? JSON.parse(JSON.stringify(q.attachments)) : [];
            setLeadLinkedFieldsLocked(!!q.leadId);
          }
        } else {
          // New quote
          document.getElementById('quoteModalTitle').innerText = "📑 Create New Quotation";
          document.getElementById('inp-quote-id').value = "";
          document.getElementById('inp-quote-revision').value = "1";
          document.getElementById('inp-parent-quote-id').value = "";
          document.getElementById('inp-quote-customer').value = "";
          document.getElementById('inp-quote-contact').value = "";
          document.getElementById('inp-quote-email').value = "";
          document.getElementById('inp-quote-mobile').value = "";
          document.getElementById('inp-quote-cc').value = "";
          document.getElementById('inp-quote-address').value = "";
          document.getElementById('inp-quote-vertical').value = "Projects";
          document.getElementById('inp-quote-date').value = new Date().toISOString().slice(0, 10);
          document.getElementById('inp-quote-validity').value = "30";
          document.getElementById('inp-quote-leadtime').value = "3-4 Weeks from advance PO";
          document.getElementById('inp-quote-advance-pct').value = "50";
          document.getElementById('inp-overall-disc-percent').value = "0";
          document.getElementById('inp-overall-disc-amount').value = "0";
          document.getElementById('inp-quote-remarks').value = "";
          if (document.getElementById('inp-quote-lead-search')) document.getElementById('inp-quote-lead-search').value = "";
          setLeadLinkedFieldsLocked(false);

          activeQuoteItems = [
            { itemId: "ITEM-1", description: "Measure DI High-Precision Dynamic Weigher", hsnCode: "90318000", qty: 1, unitPrice: 1000000, lineDiscountPercent: 0, taxPercent: 18 }
          ];
          activeQuoteAttachments = [];

          if (prefillLead) {
            onLeadSelected(prefillLead);
          }
        }

        renderQuoteLineItems();
        renderQuoteAttachedFilesList();
        calculateQuoteTotals();
      }

      function closeQuoteModal() {
        document.getElementById('quoteModal').classList.add('hidden');
      }

      function syncLineItemsFromDOM() {
        var rows = document.querySelectorAll('#quote-items-tbody tr');
        if (!rows || rows.length === 0) return;
        var updated = [];
        rows.forEach(function(tr, idx) {
          var descEl = tr.querySelector('.quote-item-desc');
          var hsnEl = tr.querySelector('.quote-item-hsn');
          var qtyEl = tr.querySelector('.quote-item-qty');
          var priceEl = tr.querySelector('.quote-item-price');
          var discEl = tr.querySelector('.quote-item-disc');

          var orig = activeQuoteItems[idx] || {};
          updated.push({
            itemId: orig.itemId || ('ITEM-' + (idx + 1)),
            description: descEl ? descEl.value : (orig.description || ''),
            hsnCode: hsnEl ? hsnEl.value : (orig.hsnCode || '842389'),
            qty: qtyEl ? (parseFloat(qtyEl.value) || 1) : (orig.qty || 1),
            unitPrice: priceEl ? (parseFloat(priceEl.value) || 0) : (orig.unitPrice || 0),
            lineDiscountPercent: discEl ? (parseFloat(discEl.value) || 0) : (orig.lineDiscountPercent || 0),
            taxPercent: orig.taxPercent || 18
          });
        });
        activeQuoteItems = updated;
      }

      // Locks/unlocks Customer & Contact Person to read-only once a Lead is
      // linked, so they can only ever match what's on the Lead record — not
      // be retyped or drift out of sync. Free again for standalone entry.
      function setLeadLinkedFieldsLocked(locked) {
        var custInput = document.getElementById('inp-quote-customer');
        var contactInput = document.getElementById('inp-quote-contact');
        var hint = document.getElementById('quote-customer-locked-hint');
        [custInput, contactInput].forEach(function(el) {
          if (!el) return;
          if (locked) {
            el.setAttribute('readonly', 'readonly');
            el.classList.add('bg-slate-100', 'cursor-not-allowed');
          } else {
            el.removeAttribute('readonly');
            el.classList.remove('bg-slate-100', 'cursor-not-allowed');
          }
        });
        if (hint) hint.classList.toggle('hidden', !locked);
      }

      // Filters the Lead dropdown's visible options as the user types in
      // the search box above it, without touching the actual <select>
      // options list itself (so the currently selected value is preserved).
      function filterLeadDropdown() {
        var query = (document.getElementById('inp-quote-lead-search').value || '').toLowerCase();
        var select = document.getElementById('inp-quote-lead');
        if (!select) return;
        Array.from(select.options).forEach(function(opt) {
          if (!opt.value) { opt.hidden = false; return; } // always keep "Standalone" visible
          opt.hidden = query.length > 0 && opt.innerText.toLowerCase().indexOf(query) === -1;
        });
      }

      // A lead that already has an active (non-Rejected) quotation cannot
      // get a second, separate one — prevents accidental duplicates. Editing
      // the existing quote, creating a revision of it, or deleting it first
      // are the supported ways to change course.
      function leadAlreadyHasActiveQuote(leadId, excludingQuoteId) {
        if (!leadId) return null;
        var quotes = getQuotationsList();
        return quotes.find(function(q) {
          return q.leadId === leadId && q.status !== 'Rejected' && q.id !== excludingQuoteId;
        }) || null;
      }

      function onLeadSelected(passedLead) {
        var leadId = document.getElementById('inp-quote-lead').value;
        var notice = document.getElementById('lead-autofill-notice');

        var leads = window.RevOpsStore.getCollection('leads') || [];
        var lead = passedLead || leads.find(function(l) { return l.id === leadId || l.leadNumber === leadId; });
        
        if (!lead && !leadId) {
          if (notice) notice.classList.add('hidden');
          setLeadLinkedFieldsLocked(false);
          return;
        }

        if (!lead) return;

        // Block linking a Lead that already has an active quotation, when
        // raising a brand-new quotation (not while editing an existing one).
        if (!currentEditingQuoteId) {
          var dupe = leadAlreadyHasActiveQuote(lead.id, null);
          if (dupe) {
            alert("Lead " + (lead.leadNumber || lead.id) + " already has an active quotation (" + dupe.quoteNumber + ", status: " + dupe.status + ").\n\nTo avoid duplicates, please edit that quotation, create a revision of it, or delete it first if you really need to start over.");
            document.getElementById('inp-quote-lead').value = '';
            setLeadLinkedFieldsLocked(false);
            return;
          }
        }

        // Ensure dropdown reflects the leadId
        var leadSelect = document.getElementById('inp-quote-lead');
        if (leadSelect) {
          var leadValueToMatch = lead.id || lead.leadNumber;
          var optionExists = Array.from(leadSelect.options).some(function(o) { return o.value === leadValueToMatch; });
          if (!optionExists && lead.id) {
            var opt = document.createElement('option');
            opt.value = lead.id;
            opt.innerText = (lead.leadNumber || lead.id) + " - " + (lead.customerName || lead.companyName || 'Lead') + " (" + (lead.vertical || 'Projects') + ")";
            leadSelect.appendChild(opt);
          }
          if (lead.id) leadSelect.value = lead.id;
        }

        // 1. Customer Name
        var custInput = document.getElementById('inp-quote-customer');
        if (custInput) {
          custInput.value = lead.customerName || lead.companyName || lead.organization || lead.clientName || '';
        }

        // 2. Primary Contact Person Details
        var contactName = '';
        var contactEmail = '';
        var contactMobile = '';
        var secondaryEmails = [];

        if (lead.contacts && Array.isArray(lead.contacts) && lead.contacts.length > 0) {
          var primary = lead.contacts[0];
          contactName = primary.name || primary.contactPerson || primary.contactName || '';
          contactEmail = primary.email || primary.emailAddress || '';
          contactMobile = primary.phone || primary.mobile || primary.contactPhone || '';

          if (lead.contacts.length > 1) {
            lead.contacts.slice(1).forEach(function(c) {
              var em = c.email || c.emailAddress;
              if (em && secondaryEmails.indexOf(em) === -1) secondaryEmails.push(em);
            });
          }
        } else {
          contactName = lead.contactPerson || lead.contactName || lead.name || '';
          contactEmail = lead.contactEmail || lead.email || '';
          contactMobile = lead.contactPhone || lead.phone || lead.mobile || '';
        }

        if (lead.ccEmails) {
          if (typeof lead.ccEmails === 'string') {
            lead.ccEmails.split(',').forEach(function(em) {
              var clean = em.trim();
              if (clean && secondaryEmails.indexOf(clean) === -1) secondaryEmails.push(clean);
            });
          } else if (Array.isArray(lead.ccEmails)) {
            lead.ccEmails.forEach(function(em) {
              if (em && secondaryEmails.indexOf(em) === -1) secondaryEmails.push(em);
            });
          }
        }

        var contactEl = document.getElementById('inp-quote-contact');
        if (contactEl) contactEl.value = contactName;
        var emailEl = document.getElementById('inp-quote-email');
        if (emailEl) emailEl.value = contactEmail;
        var mobileEl = document.getElementById('inp-quote-mobile');
        if (mobileEl) mobileEl.value = contactMobile;
        var ccEl = document.getElementById('inp-quote-cc');
        if (ccEl) ccEl.value = secondaryEmails.join(', ');

        // 3. Vertical Classification
        var targetVertical = lead.vertical || 'Projects';
        var vertSelect = document.getElementById('inp-quote-vertical');
        if (vertSelect) {
          vertSelect.value = targetVertical;
        }

        // 4. Sales Representative / Owner
        var targetOwner = lead.employeeId;
        if (targetOwner) {
          var ownerSelect = document.getElementById('inp-quote-owner');
          if (ownerSelect) {
            ownerSelect.value = targetOwner;
          }
        }

        // 5. Billing & Delivery Address
        var addr = lead.address || lead.location || lead.siteLocation || lead.city || lead.plantLocation || '';
        var addrEl = document.getElementById('inp-quote-address');
        if (addrEl && addr) {
          addrEl.value = addr;
        }

        // 6. Product Specs & Line Items Auto-Fill (Multi-product aware)
        if (lead.products && Array.isArray(lead.products) && lead.products.length > 0) {
          activeQuoteItems = lead.products.map(function(p, pIdx) {
            var prodName = p.name || p.productName || 'Industrial System';
            var prodSpec = p.spec || p.technicalSpec || '';
            var fullDesc = prodSpec ? (prodName + ' - ' + prodSpec) : prodName;
            return {
              itemId: "ITEM-" + (pIdx + 1),
              description: fullDesc,
              hsnCode: p.hsn || p.hsnCode || '90318000',
              qty: Number(p.quantity) || 1,
              unitPrice: Number(p.unitPrice) || Number(p.price) || 0,
              lineDiscountPercent: 0,
              taxPercent: 18
            };
          });
          renderQuoteLineItems();
          calculateQuoteTotals();
        } else if (lead.productName || lead.productId || lead.product) {
          var prodsMaster = window.RevOpsStore.getCollection('productsMaster') || [];
          var prodKey = lead.productName || lead.product || '';
          var matchedProd = prodsMaster.find(function(p) {
            return p.id === lead.productId || p.productName === prodKey || p.name === prodKey;
          });

          var prodTitle = prodKey || (matchedProd ? matchedProd.productName : 'Commercial System');
          var prodSpec = lead.productSpec || (matchedProd ? (matchedProd.technicalSpec || matchedProd.spec) : '');
          var fullDesc = prodSpec ? (prodTitle + ' - ' + prodSpec) : prodTitle;
          var hsn = lead.hsnCode || (matchedProd ? (matchedProd.hsnCode || matchedProd.hsn) : '90318000');
          var qty = Number(lead.quantity) || 1;
          var rate = Number(lead.unitPrice) || Number(lead.estimatedValue) || Number(lead.dealValue) || (matchedProd ? (Number(matchedProd.unitPrice) || Number(matchedProd.price)) : 1000000);

          activeQuoteItems = [
            {
              itemId: "ITEM-1",
              description: fullDesc,
              hsnCode: hsn,
              qty: qty,
              unitPrice: rate,
              lineDiscountPercent: 0,
              taxPercent: 18
            }
          ];

          renderQuoteLineItems();
          calculateQuoteTotals();
        } else if (lead.estimatedValue || lead.dealValue) {
          // If no specific product name, create line item from deal value
          activeQuoteItems = [
            {
              itemId: "ITEM-1",
              description: "Commercial Supply & Engineering Package",
              hsnCode: "90318000",
              qty: 1,
              unitPrice: Number(lead.estimatedValue) || Number(lead.dealValue) || 1000000,
              lineDiscountPercent: 0,
              taxPercent: 18
            }
          ];
          renderQuoteLineItems();
          calculateQuoteTotals();
        }

        // 7. Show auto-fill success confirmation
        if (notice) {
          var repName = lead.employeeName || (lead.employeeId ? lead.employeeId : '');
          notice.innerHTML = `
            <span class="text-base">✓</span>
            <div>
              <strong>Auto-filled from CRM Lead:</strong> ${escapeHtml(lead.customerName || lead.companyName || 'Lead')} 
              ${contactName ? '• Contact: ' + escapeHtml(contactName) : ''} 
              ${contactMobile ? '• Ph: ' + escapeHtml(contactMobile) : ''} 
              ${lead.vertical ? '• Vertical: ' + escapeHtml(lead.vertical) : ''} 
              ${repName ? '• Rep: ' + escapeHtml(repName) : ''}
            </div>
          `;
          notice.classList.remove('hidden');
        }

        setLeadLinkedFieldsLocked(true);
      }

      function renderQuoteLineItems() {
        var tbody = document.getElementById('quote-items-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        activeQuoteItems.forEach(function(item, idx) {
          var tr = document.createElement('tr');
          tr.setAttribute('data-row-idx', idx);
          
          var lineSub = (item.qty || 1) * (item.unitPrice || 0) * (1 - (item.lineDiscountPercent || 0)/100);

          tr.innerHTML = `
            <td class="p-2">
              <input type="text" value="${escapeHtml(item.description || '')}" oninput="updateLineItem(${idx}, 'description', this.value, this)" placeholder="Item Description" class="quote-item-desc w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="p-2">
              <input type="text" value="${escapeHtml(item.hsnCode || '842389')}" oninput="updateLineItem(${idx}, 'hsnCode', this.value, this)" placeholder="HSN" class="quote-item-hsn w-full px-1.5 py-1 border border-slate-300 rounded text-xs text-center font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="p-2">
              <input type="number" value="${item.qty || 1}" min="1" oninput="updateLineItem(${idx}, 'qty', this.value, this)" class="quote-item-qty w-full px-1 py-1 border border-slate-300 rounded text-xs text-center font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="p-2">
              <input type="number" value="${item.unitPrice || 0}" min="0" step="1000" oninput="updateLineItem(${idx}, 'unitPrice', this.value, this)" class="quote-item-price w-full px-2 py-1 border border-slate-300 rounded text-xs text-right font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="p-2">
              <input type="number" value="${item.lineDiscountPercent || 0}" min="0" max="80" step="1" oninput="updateLineItem(${idx}, 'lineDiscountPercent', this.value, this)" class="quote-item-disc w-full px-1 py-1 border border-slate-300 rounded text-xs text-center text-amber-800 font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="p-2 text-right font-bold text-slate-800 quote-item-subtotal">
              ₹${Math.round(lineSub).toLocaleString('en-IN')}
            </td>
            <td class="p-2 text-center">
              <button type="button" onclick="removeQuoteLineItem(${idx})" class="text-rose-500 hover:text-rose-700 font-black text-sm p-1 cursor-pointer" title="Remove item">&times;</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function addQuoteLineItem() {
        syncLineItemsFromDOM();
        activeQuoteItems.push({
          itemId: "ITEM-" + (activeQuoteItems.length + 1),
          description: "New Equipment / Service Item",
          hsnCode: "842389",
          qty: 1,
          unitPrice: 100000,
          lineDiscountPercent: 0,
          taxPercent: 18
        });
        renderQuoteLineItems();
        calculateQuoteTotals();
      }

      function removeQuoteLineItem(idx) {
        syncLineItemsFromDOM();
        if (activeQuoteItems.length <= 1) {
          alert("Quotation must include at least one item line.");
          return;
        }
        activeQuoteItems.splice(idx, 1);
        renderQuoteLineItems();
        calculateQuoteTotals();
      }


      function updateLineItem(idx, key, value, inputEl) {
        if (!activeQuoteItems[idx]) return;

        if (key === 'qty' || key === 'unitPrice' || key === 'lineDiscountPercent') {
          activeQuoteItems[idx][key] = parseFloat(value) || 0;
        } else {
          activeQuoteItems[idx][key] = value;
        }

        // Live update the line item's subtotal directly in the DOM row without destroying focus
        var tr = inputEl ? inputEl.closest('tr') : document.querySelector(`#quote-items-tbody tr[data-row-idx="${idx}"]`);
        if (tr) {
          var item = activeQuoteItems[idx];
          var lineSub = (item.qty || 1) * (item.unitPrice || 0) * (1 - (item.lineDiscountPercent || 0)/100);
          var subEl = tr.querySelector('.quote-item-subtotal');
          if (subEl) {
            subEl.innerText = '₹' + Math.round(lineSub).toLocaleString('en-IN');
          }
        }

        // Recalculate totals without resetting or re-rendering input elements
        calculateQuoteTotals();
      }

      function calculateQuoteTotals() {
        var grossSubtotal = 0;
        activeQuoteItems.forEach(function(it) {
          grossSubtotal += (it.qty || 1) * (it.unitPrice || 0);
        });

        var overallDiscPercent = parseFloat(document.getElementById('inp-overall-disc-percent').value) || 0;
        
        // Compute effective discount
        var overallDiscAmt = grossSubtotal * (overallDiscPercent / 100);
        var netSubtotal = Math.max(0, grossSubtotal - overallDiscAmt);
        var taxAmount = netSubtotal * 0.18; // 18% GST standard
        var grandTotal = netSubtotal + taxAmount;

        var grossEl = document.getElementById('disp-gross-subtotal');
        if (grossEl) grossEl.innerText = '₹' + Math.round(grossSubtotal).toLocaleString('en-IN');
        
        var overallDiscEl = document.getElementById('disp-overall-disc-amt');
        if (overallDiscEl) overallDiscEl.innerText = '(₹' + Math.round(overallDiscAmt).toLocaleString('en-IN') + ')';
        
        var netEl = document.getElementById('disp-net-subtotal');
        if (netEl) netEl.innerText = '₹' + Math.round(netSubtotal).toLocaleString('en-IN');
        
        var taxEl = document.getElementById('disp-tax-amount');
        if (taxEl) taxEl.innerText = '₹' + Math.round(taxAmount).toLocaleString('en-IN');
        
        var grandEl = document.getElementById('disp-grand-total');
        if (grandEl) grandEl.innerText = '₹' + Math.round(grandTotal).toLocaleString('en-IN');

        // Approval Threshold Engine Banner
        var badge = document.getElementById('approval-rule-badge');
        if (badge) {
          if (overallDiscPercent <= 15) {
            badge.className = "mt-3 p-2.5 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center space-x-2";
            badge.innerHTML = '<span>✅</span><span>Standard Discount (<=15%). Auto-approved upon submission.</span>';
          } else if (overallDiscPercent <= 25) {
            badge.className = "mt-3 p-2.5 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 flex items-center space-x-2";
            badge.innerHTML = '<span>⚠️</span><span>Exceeds Standard Threshold (15%). Requires <strong>Manager Approval</strong> before client issuance.</span>';
          } else {
            badge.className = "mt-3 p-2.5 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-900 border border-rose-300 flex items-center space-x-2";
            badge.innerHTML = '<span>🚨</span><span>High Discount Alert (>25%). Escalated to <strong>Managing Director (Mr. Ravichandran)</strong> for signoff.</span>';
          }
        }
      }

      function handleQuoteSubmit(e) {
        e.preventDefault();
        syncLineItemsFromDOM();
        var userRole = localStorage.getItem('userRole');
        var myEmpId = localStorage.getItem('employeeId') || 'E-001';
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var myEmpObj = employees.find(function(emp) { return emp.employeeId === myEmpId; }) || { fullName: 'User' };

        var quoteId = document.getElementById('inp-quote-id').value;
        var revision = parseInt(document.getElementById('inp-quote-revision').value) || 1;
        var parentQuoteId = document.getElementById('inp-parent-quote-id').value || null;

        var leadId = document.getElementById('inp-quote-lead').value;
        var customerName = document.getElementById('inp-quote-customer').value.trim();
        var contactPerson = document.getElementById('inp-quote-contact').value.trim();
        var email = document.getElementById('inp-quote-email').value.trim();
        var mobile = document.getElementById('inp-quote-mobile').value.trim();
        var ccEmails = document.getElementById('inp-quote-cc').value.trim();
        var vertical = document.getElementById('inp-quote-vertical').value;
        var ownerEmpId = document.getElementById('inp-quote-owner').value;

        var ownerEmpObj = employees.find(function(emp) { return emp.employeeId === ownerEmpId; });
        var ownerName = ownerEmpObj ? ownerEmpObj.fullName : ownerEmpId;

        var address = document.getElementById('inp-quote-address').value.trim();
        var dateVal = document.getElementById('inp-quote-date').value;
        var validityDays = parseInt(document.getElementById('inp-quote-validity').value) || 30;
        var leadTime = document.getElementById('inp-quote-leadtime').value.trim() || '3-4 Weeks from advance PO';
        var advancePercent = Math.max(0, Math.min(100, parseFloat(document.getElementById('inp-quote-advance-pct').value) || 0));
        var overallDiscPercent = parseFloat(document.getElementById('inp-overall-disc-percent').value) || 0;
        var terms = document.getElementById('inp-quote-terms').value;
        var remarks = document.getElementById('inp-quote-remarks').value;

        // Calculate Totals
        var grossSubtotal = 0;
        activeQuoteItems.forEach(function(it) { grossSubtotal += (it.qty || 1) * (it.unitPrice || 0); });
        var overallDiscAmt = grossSubtotal * (overallDiscPercent / 100);
        var netSubtotal = Math.max(0, grossSubtotal - overallDiscAmt);
        var taxAmount = netSubtotal * 0.18;
        var grandTotal = netSubtotal + taxAmount;

        // Every quotation requires the Primary Approver's sign-off before it
        // can be sent to the client — regardless of discount level or who
        // raised it. There is no auto-approve shortcut for any role,
        // including super_admin, so this can't be bypassed by role alone.
        var status = "Pending Approval";
        var requiredApproverRole = "none";

        var quotes = getQuotationsList();

        if (!quoteId) {
          // Generate new Quote Number
          var nextNum = quotes.length + 1;
          var qNumStr = 'QT-2026-' + String(nextNum).padStart(3, '0');
          quoteId = qNumStr + '-R' + revision;

          var newRecord = {
            id: quoteId,
            quoteNumber: qNumStr,
            revision: revision,
            parentQuoteId: parentQuoteId,
            leadId: leadId,
            customerName: customerName,
            contactPerson: contactPerson,
            email: email,
            mobile: mobile,
            ccEmails: ccEmails,
            address: address,
            vertical: vertical,
            employeeId: ownerEmpId,
            employeeName: ownerName,
            createdDate: formatDateFromInput(dateVal),
            validityDays: validityDays,
            deliveryLeadTime: leadTime,
            advancePercent: advancePercent,
            expiryDate: calculateExpiryDate(dateVal, validityDays),
            financialYear: '2026-27',
            items: activeQuoteItems,
            attachments: activeQuoteAttachments,
            grossSubtotal: grossSubtotal,
            overallDiscountPercent: overallDiscPercent,
            overallDiscountAmount: overallDiscAmt,
            discountRemarks: remarks,
            netSubtotal: netSubtotal,
            taxAmount: taxAmount,
            grandTotal: grandTotal,
            approvalThreshold: overallDiscPercent > 25 ? 25 : 15,
            requiredApproverRole: requiredApproverRole,
            status: status,
            approvalHistory: [
              {
                approverId: myEmpId,
                approverName: myEmpObj.fullName,
                approverRole: userRole,
                action: status === 'Approved' ? 'Created & Approved' : 'Submitted for Approval',
                timestamp: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                remarks: remarks || (status === 'Approved' ? 'Auto-approved discount within policy threshold.' : 'Special discount submitted for approval.')
              }
            ],
            termsAndConditions: terms,
            convertedOrderId: null
          };

          quotes.push(newRecord);
        } else {
          // Update existing
          var idx = quotes.findIndex(function(it) { return it.id === quoteId; });
          if (idx >= 0) {
            quotes[idx].customerName = customerName;
            quotes[idx].contactPerson = contactPerson;
            quotes[idx].email = email;
            quotes[idx].mobile = mobile;
            quotes[idx].ccEmails = ccEmails;
            quotes[idx].vertical = vertical;
            quotes[idx].employeeId = ownerEmpId;
            quotes[idx].employeeName = ownerName;
            quotes[idx].address = address;
            quotes[idx].createdDate = formatDateFromInput(dateVal);
            quotes[idx].validityDays = validityDays;
            quotes[idx].deliveryLeadTime = leadTime;
            quotes[idx].advancePercent = advancePercent;
            quotes[idx].expiryDate = calculateExpiryDate(dateVal, validityDays);
            quotes[idx].items = activeQuoteItems;
            quotes[idx].attachments = activeQuoteAttachments;
            quotes[idx].grossSubtotal = grossSubtotal;
            quotes[idx].overallDiscountPercent = overallDiscPercent;
            quotes[idx].overallDiscountAmount = overallDiscAmt;
            quotes[idx].discountRemarks = remarks;
            quotes[idx].netSubtotal = netSubtotal;
            quotes[idx].taxAmount = taxAmount;
            quotes[idx].grandTotal = grandTotal;
            quotes[idx].termsAndConditions = terms;
            
            if (quotes[idx].status !== 'Approved' && quotes[idx].status !== 'Sent to Customer' && quotes[idx].status !== 'Converted to Order') {
              quotes[idx].status = 'Pending Approval';
            }
          }
        }

        window.RevOpsStore.saveCollection('quotations', quotes);
        if (window.RevOpsStore.isFirebaseAvailable()) {
          window.RevOpsStore.syncAllToFirestore();
        }

        closeQuoteModal();
        renderQuotations();

        alert("Quotation " + quoteId + " saved and submitted for approval. It cannot be sent to the client until the Primary Approver signs off.");
      }

      function approveQuoteDirect(quoteId) {
        var myEmpId = localStorage.getItem('employeeId') || '';
        var myName = localStorage.getItem('userName') || 'Primary Approver';
        if (!hasApprovalAuthority('isPrimaryApprover')) {
          alert("Only the designated Primary Approver can approve quotations. Ask your admin to assign this on the Employees page if this is incorrect.");
          return;
        }

        var remarks = prompt("Enter approval remarks / signoff notes:", "Approved for dispatch to client.");
        if (remarks === null) return;

        var quotes = getQuotationsList();
        var q = quotes.find(function(it) { return it.id === quoteId; });
        if (q) {
          q.status = 'Approved';
          q.requiredApproverRole = 'none';
          window.RevOpsStore.approvePrimaryStage(q, myName, myEmpId, remarks);
          q.approvalHistory.push({
            approverId: myEmpId,
            approverName: myName,
            approverRole: 'Primary Approver',
            action: 'Approved',
            timestamp: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            remarks: remarks
          });

          window.RevOpsStore.saveCollection('quotations', quotes);
          if (window.RevOpsStore.isFirebaseAvailable()) {
            window.RevOpsStore.syncAllToFirestore();
          }
          renderQuotations();

          if (confirm("Quote " + q.quoteNumber + " approved! (Director ratification is still pending, but does not block sending.)\n\nWould you like to send this quotation directly to client (" + q.customerName + ") now?")) {
            openSendQuoteModal(q.id);
          }
        }
      }

      function rejectQuoteDirect(quoteId) {
        var myEmpId = localStorage.getItem('employeeId') || '';
        var myName = localStorage.getItem('userName') || 'Primary Approver';
        if (!hasApprovalAuthority('isPrimaryApprover')) {
          alert("Only the designated Primary Approver can reject quotations.");
          return;
        }

        var reason = prompt("Enter reason for rejecting this quotation:", "Discount exceeds allowable margin limit. Please revise.");
        if (reason === null) return;

        var quotes = getQuotationsList();
        var q = quotes.find(function(it) { return it.id === quoteId; });
        if (q) {
          q.status = 'Rejected';
          q.approvalHistory.push({
            approverId: myEmpId,
            approverName: myName,
            approverRole: 'Primary Approver',
            action: 'Rejected',
            timestamp: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            remarks: reason
          });

          window.RevOpsStore.saveCollection('quotations', quotes);
          if (window.RevOpsStore.isFirebaseAvailable()) {
            window.RevOpsStore.syncAllToFirestore();
          }
          renderQuotations();
          alert("Quote " + q.quoteNumber + " rejected.");
        }
      }

      function ratifyQuoteDirect(quoteId) {
        var myEmpId = localStorage.getItem('employeeId') || '';
        var myName = localStorage.getItem('userName') || 'Director';
        if (localStorage.getItem('isDirector') !== 'true') {
          alert("Only the designated Director can ratify quotation approvals.");
          return;
        }

        var quotes = getQuotationsList();
        var q = quotes.find(function(it) { return it.id === quoteId; });
        if (!q) return;

        if (q.status !== 'Approved' || q.directorRatificationStatus !== 'Pending') {
          alert("This quotation isn't awaiting director ratification.");
          return;
        }

        var remarks = prompt("Enter ratification remarks (optional):", "Ratified.");
        if (remarks === null) return;

        window.RevOpsStore.ratifyByDirector(q, myName, myEmpId, remarks);
        q.approvalHistory.push({
          approverId: myEmpId,
          approverName: myName,
          approverRole: 'Director',
          action: 'Ratified',
          timestamp: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          remarks: remarks
        });

        window.RevOpsStore.saveCollection('quotations', quotes);
        if (window.RevOpsStore.isFirebaseAvailable()) {
          window.RevOpsStore.syncAllToFirestore();
        }
        renderQuotations();
        alert("Quote " + q.quoteNumber + " ratified by Director.");
      }

      function createQuoteRevision(quoteId) {
        var quotes = getQuotationsList();
        var q = quotes.find(function(it) { return it.id === quoteId; });
        if (!q) return;

        var newRev = (q.revision || 1) + 1;
        var newQuoteId = q.quoteNumber + '-R' + newRev;

        var cloned = JSON.parse(JSON.stringify(q));
        cloned.id = newQuoteId;
        cloned.revision = newRev;
        cloned.parentQuoteId = q.id;
        cloned.createdDate = getFormattedToday();
        cloned.status = 'Draft';
        cloned.convertedOrderId = null;
        cloned.approvalHistory.push({
          approverId: localStorage.getItem('employeeId'),
          approverName: localStorage.getItem('userName'),
          approverRole: localStorage.getItem('userRole'),
          action: 'Created Revision R' + newRev,
          timestamp: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          remarks: 'New revision created from ' + q.id
        });

        quotes.push(cloned);
        window.RevOpsStore.saveCollection('quotations', quotes);
        if (window.RevOpsStore.isFirebaseAvailable()) {
          window.RevOpsStore.syncAllToFirestore();
        }

        renderQuotations();
        openQuoteModal(newQuoteId);
      }

      // NOTE: Quotations used to have their own "Convert to Order" shortcut
      // here that created a minimally-shaped order record directly —
      // bypassing Primary Approver / Director sign-off entirely and using
      // a different field schema (contributors/orderDate/status "Won")
      // than the real Orders module (splits/poDate/status "Booked"). That
      // let two order records exist for one quote and skipped approval.
      // It's been replaced by the "🚀 Book Order" link above, which sends
      // the user to the proper Book Commercial Order / PO flow on
      // orders.html with this quotation pre-selected (see bookFromQuote
      // handling in js/orders.js).

      function editQuote(quoteId) {
        openQuoteModal(quoteId);
      }

      function deleteQuote(quoteId) {
        if (!confirm("Are you sure you want to delete this quotation record?")) return;
        var quotes = getQuotationsList();
        quotes = quotes.filter(function(it) { return it.id !== quoteId; });
        window.RevOpsStore.saveCollection('quotations', quotes);
        if (window.RevOpsStore.isFirebaseAvailable()) {
          window.RevOpsStore.syncAllToFirestore();
        }
        renderQuotations();
      }

      // PRINTABLE PDF VIEW
      function viewPrintQuote(quoteId) {
        var quotes = getQuotationsList();
        var q = quotes.find(function(it) { return it.id === quoteId; });
        if (!q) return;

        currentPrintQuoteId = quoteId;

        document.getElementById('pdf-quote-number').innerText = q.quoteNumber + ' (Ver ' + (q.revision || 1) + ')';
        document.getElementById('pdf-quote-date').innerText = 'Date: ' + (q.createdDate || '');
        document.getElementById('pdf-quote-expiry').innerText = 'Valid Until: ' + (q.expiryDate || '');
        
        document.getElementById('pdf-customer-name').innerText = q.customerName || '';
        document.getElementById('pdf-contact-person').innerText = 'Attn: ' + (q.contactPerson || 'Purchase Manager');
        document.getElementById('pdf-customer-address').innerText = q.address || '';
        document.getElementById('pdf-customer-contact').innerText = 'Ph: ' + (q.mobile || '') + ' | ' + (q.email || '');

        document.getElementById('pdf-owner-name').innerText = q.employeeName || q.employeeId;
        document.getElementById('pdf-vertical-name').innerText = (q.vertical || 'Sales') + ' Division';

        var statusBadge = document.getElementById('pdf-status-badge');
        statusBadge.innerHTML = getQuoteStatusBadgeHtml(q);

        // Render PDF Table
        var tbody = document.getElementById('pdf-items-tbody');
        tbody.innerHTML = '';
        (q.items || []).forEach(function(it, idx) {
          var tr = document.createElement('tr');
          var lineSub = (it.qty || 1) * (it.unitPrice || 0) * (1 - (it.lineDiscountPercent || 0)/100);
          tr.innerHTML = `
            <td class="p-2 border-r border-slate-300">${idx + 1}</td>
            <td class="p-2 border-r border-slate-300 font-bold">${escapeHtml(it.description)}</td>
            <td class="p-2 border-r border-slate-300 text-center">${escapeHtml(it.hsnCode || '842389')}</td>
            <td class="p-2 border-r border-slate-300 text-center font-bold">${it.qty || 1}</td>
            <td class="p-2 border-r border-slate-300 text-right">₹${(it.unitPrice || 0).toLocaleString('en-IN')}</td>
            <td class="p-2 border-r border-slate-300 text-center font-bold text-amber-800">${it.lineDiscountPercent || 0}%</td>
            <td class="p-2 text-right font-bold">₹${Math.round(lineSub).toLocaleString('en-IN')}</td>
          `;
          tbody.appendChild(tr);
        });

        document.getElementById('pdf-gross-subtotal').innerText = '₹' + Math.round(q.grossSubtotal || 0).toLocaleString('en-IN');
        document.getElementById('pdf-discount-val').innerText = '-₹' + Math.round(q.overallDiscountAmount || 0).toLocaleString('en-IN') + ' (' + (q.overallDiscountPercent || 0) + '%)';
        document.getElementById('pdf-net-subtotal').innerText = '₹' + Math.round(q.netSubtotal || 0).toLocaleString('en-IN');
        document.getElementById('pdf-tax-amount').innerText = '₹' + Math.round(q.taxAmount || 0).toLocaleString('en-IN');
        document.getElementById('pdf-grand-total').innerText = '₹' + Math.round(q.grandTotal || 0).toLocaleString('en-IN');

        document.getElementById('pdf-terms-text').innerText = q.termsAndConditions || 'Standard commercial terms apply.';
        document.getElementById('pdf-delivery-leadtime').innerText = q.deliveryLeadTime || '3-4 Weeks from advance PO';

        // Render Attached Technical Documents Box
        var attachBox = document.getElementById('pdf-attachments-box');
        var attachList = document.getElementById('pdf-attachments-list');
        if (q.attachments && Array.isArray(q.attachments) && q.attachments.length > 0) {
          attachBox.classList.remove('hidden');
          attachList.innerHTML = '';
          q.attachments.forEach(function(file, idx) {
            var div = document.createElement('div');
            div.className = "bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between";
            div.innerHTML = `
              <div class="flex items-center space-x-2 min-w-0 pr-2">
                <span class="text-xs font-bold text-slate-700">📄</span>
                <div class="min-w-0">
                  <p class="text-[11px] font-bold text-slate-800 truncate" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</p>
                  <p class="text-[9px] text-slate-400 font-medium">${formatFileSize(file.size)}</p>
                </div>
              </div>
              <button type="button" onclick="downloadFileFromData('${file.dataUrl}', '${escapeHtml(file.name)}')" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded border border-indigo-200 cursor-pointer shrink-0">
                ⬇️ Download
              </button>
            `;
            attachList.appendChild(div);
          });
        } else {
          attachBox.classList.add('hidden');
        }

        document.getElementById('printQuoteModal').classList.remove('hidden');
      }

      function closePrintQuoteModal() {
        document.getElementById('printQuoteModal').classList.add('hidden');
      }

      function printCurrentQuoteDocument() {
        window.print();
      }

      // EMAIL DISPATCH FUNCTIONS
      var currentPrintQuoteId = null;

      function openSendQuoteModal(quoteId) {
        var quotes = getQuotationsList();
        var q = quotes.find(function(it) { return it.id === quoteId; });
        if (!q) return;

        currentPrintQuoteId = quoteId;
        document.getElementById('inp-send-quote-id').value = q.id;

        // Banner text
        var bannerText = document.getElementById('send-quote-banner-text');
        var bannerBox = document.getElementById('send-quote-status-banner');
        if (q.status === 'Approved') {
          bannerBox.className = "p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-800 font-semibold";
          bannerText.innerText = "Final Approval Received from Management. Ready for direct client dispatch.";
        } else if (q.status === 'Sent to Customer') {
          bannerBox.className = "p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center space-x-2.5 text-xs text-sky-800 font-semibold";
          bannerText.innerText = "This quotation was previously sent on " + (q.lastSentDate || 'earlier date') + ". You can resend or update terms below.";
        } else {
          bannerBox.className = "p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center space-x-2.5 text-xs text-indigo-800 font-semibold";
          bannerText.innerText = "Commercial offer ready for dispatch to " + q.customerName + ".";
        }

        // To Email
        var toInput = document.getElementById('inp-send-to');
        toInput.value = q.email || '';

        // CC Email
        var ccInput = document.getElementById('inp-send-cc');
        var salesRepEmail = (q.employeeName || 'sales').toLowerCase().replace(/\s+/g, '') + '@measuredi.com';
        var defaultInternalCC = salesRepEmail + ', measuredichennai@gmail.com';

        // Use CC marked in quotation if specified, otherwise default to sales rep and management
        if (q.ccEmails && q.ccEmails.trim()) {
          ccInput.value = q.ccEmails.trim();
        } else {
          ccInput.value = defaultInternalCC;
        }

        // Subject
        var subjectInput = document.getElementById('inp-send-subject');
        subjectInput.value = '[Measure DI Technologies] Official Commercial Quotation Ref: ' + q.quoteNumber + ' (Ver ' + (q.revision || 1) + ') for ' + q.customerName;

        // Attachment label
        document.getElementById('send-attachment-filename').innerText = 'Quotation_' + q.quoteNumber + '_Ver' + (q.revision || 1) + '.pdf';

        // Render Attached Files Dispatch Checklist
        var attachChecklist = document.getElementById('send-attachments-checklist');
        var filesSummary = document.getElementById('send-files-summary');
        attachChecklist.innerHTML = `
          <div class="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <div class="w-6 h-6 rounded bg-rose-100 text-rose-700 flex items-center justify-center font-black text-[10px]">PDF</div>
              <div>
                <p class="text-xs font-bold text-slate-800">Quotation_${escapeHtml(q.quoteNumber)}_Ver${q.revision || 1}.pdf</p>
                <p class="text-[9px] text-slate-400">Official Commercial Offer with HSN codes & authorized signatory</p>
              </div>
            </div>
            <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold border border-emerald-200">Enclosed</span>
          </div>
        `;

        if (q.attachments && Array.isArray(q.attachments) && q.attachments.length > 0) {
          filesSummary.innerText = "Official PDF + " + q.attachments.length + " Technical File(s)";
          q.attachments.forEach(function(att) {
            var row = document.createElement('div');
            row.className = "bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between";
            row.innerHTML = `
              <div class="flex items-center space-x-2 min-w-0 pr-2">
                <div class="w-6 h-6 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-[9px]">DOC</div>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-slate-800 truncate" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</p>
                  <p class="text-[9px] text-slate-400 font-medium">${formatFileSize(att.size)}</p>
                </div>
              </div>
              <span class="px-2 py-0.5 bg-sky-100 text-sky-800 rounded text-[9px] font-bold border border-sky-200">Attached</span>
            `;
            attachChecklist.appendChild(row);
          });
        } else {
          filesSummary.innerText = "Official PDF Commercial Document";
        }

        // Resolve Main Contact Person Greeting (use specific human contact person name, not organization name)
        var mainContactGreeting = "";
        if (q.contactPerson && q.contactPerson.trim()) {
          var cp = q.contactPerson.trim();
          var org = (q.customerName || '').trim();
          if (cp.toLowerCase() !== org.toLowerCase()) {
            mainContactGreeting = cp;
          }
        }

        // If not resolved from quote, look up linked lead primary contact person
        if (!mainContactGreeting && q.leadId) {
          var leads = window.RevOpsStore.getCollection('leads') || [];
          var matchedLead = leads.find(function(l) { return l.id === q.leadId; });
          if (matchedLead) {
            if (matchedLead.contacts && Array.isArray(matchedLead.contacts) && matchedLead.contacts.length > 0 && matchedLead.contacts[0].name) {
              mainContactGreeting = matchedLead.contacts[0].name.trim();
            } else if (matchedLead.contactPerson && matchedLead.contactPerson.trim().toLowerCase() !== (matchedLead.customerName || '').trim().toLowerCase()) {
              mainContactGreeting = matchedLead.contactPerson.trim();
            }
          }
        }

        if (!mainContactGreeting) {
          mainContactGreeting = (q.contactPerson && q.contactPerson.trim()) ? q.contactPerson.trim() : "Purchase Authority";
        }

        // Email Body
        var bodyInput = document.getElementById('inp-send-body');
        var bodyText = "Dear " + mainContactGreeting + ",\n\n" +
          "Greetings from Measure DI Technologies!\n\n" +
          "We are pleased to submit our official commercial quotation Ref: " + q.quoteNumber + " (Version " + (q.revision || 1) + ") for " + q.customerName + ".\n\n" +
          "COMMERCIAL OFFER SUMMARY:\n" +
          "--------------------------------------------------\n" +
          "Quotation Ref     : " + q.quoteNumber + " (Ver " + (q.revision || 1) + ")\n" +
          "Customer Name     : " + q.customerName + "\n" +
          "Net Taxable Value : ₹" + Math.round(q.netSubtotal || 0).toLocaleString('en-IN') + "\n" +
          "GST Tax (18%)     : ₹" + Math.round(q.taxAmount || 0).toLocaleString('en-IN') + "\n" +
          "Grand Total Amount: ₹" + Math.round(q.grandTotal || 0).toLocaleString('en-IN') + "\n" +
          "Validity          : Valid until " + (q.expiryDate || '30 days') + "\n" +
          "Payment Terms     : " + (q.termsAndConditions || 'As agreed') + "\n\n" +
          "Attached to this email is the official commercial quotation PDF containing complete line-item specifications, HSN tax breakdowns, and authorized seal.\n\n" +
          "Please review and feel free to contact us for any technical or commercial clarifications.\n\n" +
          "Best Regards,\n" +
          (q.employeeName || 'Sales Department') + "\n" +
          "Measure DI Technologies\n" +
          "Plot 42, Industrial Estate, Guindy, Chennai - 600032\n" +
          "Email: sales@measuredi.com | Phone: +91 98406 29928";

        bodyInput.value = bodyText;

        // Render Dispatch History if available
        var historyBox = document.getElementById('send-quote-history-box');
        var historyList = document.getElementById('send-quote-history-list');
        if (q.emailDispatchHistory && q.emailDispatchHistory.length > 0) {
          historyBox.classList.remove('hidden');
          historyList.innerHTML = '';
          q.emailDispatchHistory.forEach(function(rec) {
            var div = document.createElement('div');
            div.className = "flex items-center justify-between py-1 border-b border-sky-200/60 last:border-0";
            div.innerHTML = '<span>To: <strong>' + escapeHtml(rec.to) + '</strong> (' + escapeHtml(rec.timestamp) + ') by ' + escapeHtml(rec.senderName || 'Sales') + '</span> <span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[9px]">' + escapeHtml(rec.status || 'Delivered') + '</span>';
            historyList.appendChild(div);
          });
        } else {
          historyBox.classList.add('hidden');
        }

        document.getElementById('sendQuoteModal').classList.remove('hidden');
      }

      function closeSendQuoteModal() {
        document.getElementById('sendQuoteModal').classList.add('hidden');
      }

      function openSendQuoteModalFromPrint() {
        closePrintQuoteModal();
        if (currentPrintQuoteId) {
          openSendQuoteModal(currentPrintQuoteId);
        }
      }

      async function handleSendQuoteSubmit(event) {
        event.preventDefault();

        var quoteId = document.getElementById('inp-send-quote-id').value;
        var toEmail = document.getElementById('inp-send-to').value.trim();
        var ccEmail = document.getElementById('inp-send-cc').value.trim();
        var subject = document.getElementById('inp-send-subject').value.trim();
        var body = document.getElementById('inp-send-body').value.trim();

        if (!toEmail) {
          alert("Please enter the client recipient email address.");
          return;
        }

        var quotes = getQuotationsList();
        var q = quotes.find(function(it) { return it.id === quoteId; });
        if (!q) return;

        var submitBtn = event?.target?.querySelector('button[type="submit"]') || document.getElementById('btn-send-quote-submit');
        var originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>⏳ Sending via Brevo Gateway...</span>';
        }

        var myEmpName = localStorage.getItem('userName') || (q.employeeName || 'Sales Executive');
        var timestampStr = getFormattedToday() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        try {
          if (!window.BrevoMailer || typeof window.BrevoMailer.sendQuotationEmail !== 'function') {
            throw new Error('Email service failed to load. Please refresh the page and try again.');
          }
          var res = await window.BrevoMailer.sendQuotationEmail(q, {
            to: toEmail,
            cc: ccEmail,
            subject: subject,
            body: body
          });

          var dispatchRecord = {
            timestamp: timestampStr,
            to: toEmail,
            cc: ccEmail,
            subject: subject,
            senderName: myEmpName,
            status: 'Delivered (Brevo)',
            messageId: res ? res.messageId : ''
          };

          if (!q.emailDispatchHistory) q.emailDispatchHistory = [];
          q.emailDispatchHistory.unshift(dispatchRecord);

          // Update quote status
          q.status = 'Sent to Customer';
          q.lastSentDate = timestampStr;
          q.email = toEmail; // ensure email is saved on quote

          // Update linked lead if available
          if (q.leadId) {
            var leads = window.RevOpsStore.getCollection('leads') || [];
            var lead = leads.find(function(l) { return l.id === q.leadId; });
            if (lead) {
              lead.stage = 'Proposal Sent';
              lead.dealValue = q.grandTotal;
              window.RevOpsStore.saveCollection('leads', leads);
            }
          }

          window.RevOpsStore.saveCollection('quotations', quotes);
          if (window.RevOpsStore.isFirebaseAvailable()) {
            window.RevOpsStore.syncAllToFirestore();
          }

          closeSendQuoteModal();
          renderQuotations();

          // Show Toast / Confirmation
          alert("✅ SUCCESS!\n\nQuotation " + q.quoteNumber + " (Ver " + (q.revision || 1) + ") has been sent directly to client (" + toEmail + ") via Brevo!\n\n• Delivery Status: Dispatched & Delivered\n• Sender: Measure DI Systems (measuredichennai@gmail.com)\n• Status updated to 'Sent to Customer'\n• Linked CRM lead updated to 'Proposal Sent'");
        } catch (err) {
          console.error('Send quote error:', err);
          var fallback = confirm("Notice during email dispatch:\n" + (err.message || err) + "\n\nWould you like to launch your local email client (Outlook/Mail) instead?");
          if (fallback) {
            triggerMailtoFallback();
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
          }
        }
      }

      function triggerMailtoFallback() {
        var toEmail = document.getElementById('inp-send-to').value.trim();
        var ccEmail = document.getElementById('inp-send-cc').value.trim();
        var subject = document.getElementById('inp-send-subject').value.trim();
        var body = document.getElementById('inp-send-body').value.trim();

        var mailtoUrl = "mailto:" + encodeURIComponent(toEmail) +
          "?cc=" + encodeURIComponent(ccEmail) +
          "&subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(body);

        window.location.href = mailtoUrl;
      }

      // HELPER UTILS
      function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      function formatDateForInput(dateStr) {
        if (!dateStr) return new Date().toISOString().slice(0, 10);
        if (dateStr.includes('/')) {
          var parts = dateStr.split('/');
          if (parts.length === 3) {
            return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
          }
        }
        return dateStr;
      }

      function formatDateFromInput(yyyyMmDd) {
        if (!yyyyMmDd) return getFormattedToday();
        var parts = yyyyMmDd.split('-');
        if (parts.length === 3) {
          return parts[2] + '/' + parts[1] + '/' + parts[0];
        }
        return yyyyMmDd;
      }

      function calculateExpiryDate(dateVal, days) {
        var dt = dateVal ? new Date(dateVal) : new Date();
        dt.setDate(dt.getDate() + (days || 30));
        var dd = String(dt.getDate()).padStart(2, '0');
        var mm = String(dt.getMonth() + 1).padStart(2, '0');
        var yyyy = dt.getFullYear();
        return dd + '/' + mm + '/' + yyyy;
      }

