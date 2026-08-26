      function renderTransactionsView(payments, invoices, selectedFy, userRole, myEmpId, selectedEmp, searchQuery) {
        var filtered = payments.filter(function(p) {
          if (selectedFy !== 'All') {
            var payFy = typeof getFinancialYear === 'function' ? getFinancialYear(p.paymentDate, p.invoiceNumber) : '2026-27';
            if (payFy !== selectedFy) return false;
          }
          if (userRole === 'staff' && p.employeeId !== myEmpId) return false;
          if (selectedEmp !== 'All' && p.employeeId !== selectedEmp) return false;

          var textMatch = (p.customerName || '').toLowerCase().includes(searchQuery) ||
                          (p.invoiceNumber || '').toLowerCase().includes(searchQuery) ||
                          (p.receiptNumber || '').toLowerCase().includes(searchQuery) ||
                          (p.paymentReason || '').toLowerCase().includes(searchQuery) ||
                          (p.utrNumber || '').toLowerCase().includes(searchQuery);
          return textMatch;
        });

        document.getElementById('count-view-trans').innerText = filtered.length;
        var tbody = document.getElementById('payments-tbody');
        tbody.innerHTML = "";

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">No payment transaction records found.</td></tr>`;
          return;
        }

        filtered.forEach(function(p) {
          var isCleared = (p.status === "Cleared" || p.status === "Approved");
          var statusPill = isCleared ? "bg-emerald-100 text-emerald-800 font-bold border border-emerald-300" : "bg-amber-100 text-amber-800 font-bold border border-amber-300 animate-pulse";
          var receiptNum = p.receiptNumber || ('REC-2026-' + p.id.slice(-3));

          // Reason Pill Color
          var reasonColor = "bg-indigo-50 text-indigo-700 border-indigo-200";
          if (p.paymentReason === 'Advance') {
            reasonColor = "bg-purple-50 text-purple-700 border-purple-200 font-black";
          } else if (p.paymentReason && p.paymentReason.indexOf('write-off') !== -1) {
            reasonColor = "bg-rose-50 text-rose-800 border-rose-200 font-bold";
          } else if (p.paymentReason && p.paymentReason.indexOf('goodwill') !== -1) {
            reasonColor = "bg-amber-50 text-amber-800 border-amber-200 font-bold";
          } else if (p.paymentReason === 'Final payment') {
            reasonColor = "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold";
          }

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900 font-mono text-[11px]">${escapeHtml(receiptNum)}</div>
              <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(p.paymentDate)}</div>
              ${p.paymentReason ? `
                <span class="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] uppercase border ${reasonColor}">
                  ${escapeHtml(p.paymentReason)}
                </span>
              ` : ''}
            </td>
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900">${escapeHtml(p.customerName)}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(p.paymentMilestone || 'General Collection')}</div>
            </td>
            <td class="py-3 px-4 font-mono font-semibold text-slate-700">
              ${escapeHtml(p.invoiceNumber || '--')}
            </td>
            <td class="py-3 px-4 text-right font-black text-emerald-700">
              ${formatINR(p.amount)}
            </td>
            <td class="py-3 px-4 text-right font-mono text-slate-500 font-semibold">
              ${p.tdsAmount > 0 ? formatINR(p.tdsAmount) : '--'}
            </td>
            <td class="py-3 px-4 text-slate-700">
              <span class="font-semibold">${escapeHtml(p.paymentMode)}</span>
              ${p.utrNumber ? `<span class="block text-[10px] text-slate-400 font-mono">Ref: ${escapeHtml(p.utrNumber)}</span>` : ''}
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] uppercase ${statusPill}">
                ${isCleared ? '✓ Cleared' : '⏳ Pending Finance Verification'}
              </span>
              ${!isCleared && hasApprovalAuthority('isFinanceHead') ? `
                <button onclick="verifyPaymentDirectly('${escapeHtml(p.id)}')" class="mt-1 block mx-auto px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold shadow-xs cursor-pointer" title="Accounts Department Verification">
                  ✓ Verify in Bank
                </button>
              ` : ''}
            </td>
            <td class="py-3 px-4 text-center">
              <button onclick="openSendReceiptModal('${escapeHtml(p.id)}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[10px] cursor-pointer" title="Email Settlement Receipt to Client">
                ✉️ Email Client
              </button>
            </td>
            <td class="py-3 px-4 text-center space-x-1.5 whitespace-nowrap">
              <button onclick="viewPrintableReceipt('${escapeHtml(p.id)}')" class="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold cursor-pointer" title="View Official Receipt Voucher">🧾 View</button>
              <button onclick="editPayment('${escapeHtml(p.id)}')" class="text-indigo-600 hover:text-indigo-800 font-bold hover:underline">Edit</button>
              <button onclick="deletePayment('${escapeHtml(p.id)}')" class="text-rose-600 hover:text-rose-800 font-bold hover:underline">Delete</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function verifyPaymentDirectly(payId) {
        var userRole = localStorage.getItem('userRole');
        var myName = localStorage.getItem('userName') || 'Finance & Accounts Team';

        if (!hasApprovalAuthority('isFinanceHead')) {
          alert("Only the designated Finance Head can verify payments before they count as revenue. Ask your admin to assign this on the Employees page if this is incorrect.");
          return;
        }

        if (confirm("Confirm bank clearance and finance verification for this payment collection?\n\nThis will instantly clear the receipt and credit real-time revenue dashboards.")) {
          var res = window.RevOpsStore.verifyPaymentByAccounts(payId, myName, userRole);
          if (res.success) {
            alert("✅ Payment collection verified & cleared by Finance! Revenue accounts updated.");
            renderActivePaymentView();
          } else {
            alert("Error: " + (res.error || "Could not verify payment"));
          }
        }
      }

      function renderClientArView(invoices, payments, selectedFy, searchQuery) {
        var clientsMap = {};
        var today = new Date();
        today.setHours(0,0,0,0);

        invoices.forEach(function(inv) {
          var client = inv.customerName || 'Unknown Client';
          if (!clientsMap[client]) {
            clientsMap[client] = {
              customerName: client,
              customerGstin: inv.customerGstin,
              customerEmail: inv.customerEmail,
              totalInvoiced: 0,
              totalPaid: 0,
              totalTds: 0,
              totalAdj: 0,
              balanceDue: 0,
              bucket0_30: 0,
              bucket31_60: 0,
              bucket61_90: 0,
              bucket90Plus: 0,
              lastDueDate: inv.dueDate
            };
          }

          var grand = Number(inv.grandTotal) || 0;
          var paid = Number(inv.paidAmount) || 0;
          var tds = Number(inv.tdsDeducted) || 0;
          var adj = (Number(inv.adjustmentAmount) || 0) + (Number(inv.writeOffAmount) || 0);
          var bal = Number(inv.balanceDue) !== undefined ? Number(inv.balanceDue) : Math.max(0, grand - (paid + tds + adj));

          clientsMap[client].totalInvoiced += grand;
          clientsMap[client].totalPaid += paid;
          clientsMap[client].totalTds += tds;
          clientsMap[client].totalAdj += adj;
          clientsMap[client].balanceDue += bal;

          if (bal > 0) {
            var due = inv.dueDate ? parseDateDDMMYYYY(inv.dueDate) : today;
            var diffDays = Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));

            if (diffDays <= 30) clientsMap[client].bucket0_30 += bal;
            else if (diffDays <= 60) clientsMap[client].bucket31_60 += bal;
            else if (diffDays <= 90) clientsMap[client].bucket61_90 += bal;
            else clientsMap[client].bucket90Plus += bal;
          }
        });

        var clientList = Object.values(clientsMap).filter(function(c) {
          return c.customerName.toLowerCase().includes(searchQuery);
        });

        var tbody = document.getElementById('client-ar-tbody');
        tbody.innerHTML = "";

        if (clientList.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">No client accounts found.</td></tr>`;
          return;
        }

        clientList.forEach(function(c) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900">${escapeHtml(c.customerName)}</div>
              <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(c.customerGstin || 'Unregistered')}</div>
            </td>
            <td class="py-3 px-4 text-right font-black text-slate-900">${formatINR(c.totalInvoiced)}</td>
            <td class="py-3 px-4 text-right font-bold text-emerald-600">${formatINR(c.totalPaid + c.totalTds)}</td>
            <td class="py-3 px-4 text-right font-black ${c.balanceDue > 0 ? 'text-amber-700' : 'text-slate-400'}">${formatINR(c.balanceDue)}</td>
            <td class="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">${c.bucket0_30 > 0 ? formatINR(c.bucket0_30) : '--'}</td>
            <td class="py-3 px-4 text-right font-mono text-amber-600 font-semibold">${c.bucket31_60 > 0 ? formatINR(c.bucket31_60) : '--'}</td>
            <td class="py-3 px-4 text-right font-mono text-orange-600 font-semibold">${c.bucket61_90 > 0 ? formatINR(c.bucket61_90) : '--'}</td>
            <td class="py-3 px-4 text-right font-mono text-rose-600 font-black">${c.bucket90Plus > 0 ? formatINR(c.bucket90Plus) : '--'}</td>
            <td class="py-3 px-4 text-center space-x-1.5 whitespace-nowrap">
              ${c.balanceDue > 0 ? `<button onclick="sendClientPaymentReminder('${escapeHtml(c.customerName)}', '${escapeHtml(c.customerEmail || '')}', ${c.balanceDue})" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold cursor-pointer">🔔 Send Reminder</button>` : `<span class="text-[10px] text-emerald-700 font-bold">✓ Settled</span>`}
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function renderProjectArView(invoices, payments, selectedFy, searchQuery) {
        var rowsHtml = '';
        invoices.forEach(function(inv) {
          if (!inv.customerName.toLowerCase().includes(searchQuery) && !(inv.invoiceNumber || '').toLowerCase().includes(searchQuery)) return;

          var grand = Number(inv.grandTotal) || 0;
          var paid = (Number(inv.paidAmount) || 0) + (Number(inv.tdsDeducted) || 0);
          var adj = (Number(inv.adjustmentAmount) || 0) + (Number(inv.writeOffAmount) || 0);
          var bal = Number(inv.balanceDue) !== undefined ? Number(inv.balanceDue) : Math.max(0, grand - (paid + adj));
          var pct = grand > 0 ? Math.min(100, Math.round((paid + adj) / grand * 100)) : 0;

          rowsHtml += `
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="py-3 px-4">
                <div class="font-bold text-slate-900">${escapeHtml(inv.poRef || inv.invoiceNumber)}</div>
                <div class="text-[10px] text-slate-400">${escapeHtml(inv.vertical || 'Commercial')} • ${escapeHtml(inv.milestoneTag || 'Milestone')}</div>
              </td>
              <td class="py-3 px-4 font-bold text-slate-900">${escapeHtml(inv.customerName)}</td>
              <td class="py-3 px-4 text-right font-black text-slate-900">${formatINR(grand)}</td>
              <td class="py-3 px-4 text-right font-bold text-indigo-700">${formatINR(grand)}</td>
              <td class="py-3 px-4 text-right font-bold text-emerald-600">${formatINR(paid)}</td>
              <td class="py-3 px-4 text-right font-black ${bal > 0 ? 'text-amber-700' : 'text-slate-400'}">${formatINR(bal)}</td>
              <td class="py-3 px-4 text-center">
                <div class="w-full bg-slate-200 rounded-full h-2">
                  <div class="bg-emerald-500 h-2 rounded-full" style="width: ${pct}%"></div>
                </div>
                <span class="text-[10px] font-bold text-slate-600 font-mono mt-0.5 block">${pct}% Realized</span>
              </td>
              <td class="py-3 px-4 text-center font-mono text-slate-600 font-bold text-xs">${escapeHtml(inv.invoiceNumber)}</td>
            </tr>
          `;
        });

        var tbody = document.getElementById('project-ar-tbody');
        tbody.innerHTML = rowsHtml || `<tr><td colspan="8" class="py-8 text-center text-slate-400">No project receivables found.</td></tr>`;
      }

      function renderSalesRepArView(invoices, payments, selectedFy, searchQuery) {
        var employees = window.RevOpsStore.getCollection('employees') || [];
        var repsMap = {};

        employees.forEach(function(e) {
          repsMap[e.employeeId] = {
            employeeId: e.employeeId,
            fullName: e.fullName,
            designation: e.designation,
            invoiceCount: 0,
            totalBilled: 0,
            totalCollected: 0,
            pendingBalance: 0
          };
        });

        invoices.forEach(function(inv) {
          var empId = inv.employeeId || 'E-002';
          if (!repsMap[empId]) {
            repsMap[empId] = {
              employeeId: empId,
              fullName: inv.employeeName || 'Sales Representative',
              designation: 'Sales Engineer',
              invoiceCount: 0,
              totalBilled: 0,
              totalCollected: 0,
              pendingBalance: 0
            };
          }

          var grand = Number(inv.grandTotal) || 0;
          var paid = (Number(inv.paidAmount) || 0) + (Number(inv.tdsDeducted) || 0);
          var adj = (Number(inv.adjustmentAmount) || 0) + (Number(inv.writeOffAmount) || 0);
          var bal = Number(inv.balanceDue) !== undefined ? Number(inv.balanceDue) : Math.max(0, grand - (paid + adj));

          repsMap[empId].invoiceCount++;
          repsMap[empId].totalBilled += grand;
          repsMap[empId].totalCollected += paid;
          repsMap[empId].pendingBalance += bal;
        });

        var repList = Object.values(repsMap).filter(function(r) {
          return r.fullName.toLowerCase().includes(searchQuery) && r.totalBilled > 0;
        });

        var tbody = document.getElementById('salesrep-ar-tbody');
        tbody.innerHTML = "";

        if (repList.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No sales person performance records.</td></tr>`;
          return;
        }

        repList.forEach(function(r) {
          var recoveryRate = r.totalBilled > 0 ? Math.round(r.totalCollected / r.totalBilled * 100) : 0;
          var badgePill = recoveryRate >= 80 ? "bg-emerald-100 text-emerald-800" : (recoveryRate >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800");

          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="font-bold text-slate-900">${escapeHtml(r.fullName)}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(r.designation || 'Sales')} (${escapeHtml(r.employeeId)})</div>
            </td>
            <td class="py-3 px-4 text-center font-bold font-mono text-slate-700">${r.invoiceCount}</td>
            <td class="py-3 px-4 text-right font-black text-slate-900">${formatINR(r.totalBilled)}</td>
            <td class="py-3 px-4 text-right font-bold text-emerald-600">${formatINR(r.totalCollected)}</td>
            <td class="py-3 px-4 text-right font-black text-amber-700">${formatINR(r.pendingBalance)}</td>
            <td class="py-3 px-4 text-center">
              <div class="w-full bg-slate-200 rounded-full h-2">
                <div class="bg-indigo-600 h-2 rounded-full" style="width: ${recoveryRate}%"></div>
              </div>
              <span class="text-[10px] font-bold text-slate-700 font-mono mt-0.5 block">${recoveryRate}% Collected</span>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgePill}">${recoveryRate >= 80 ? 'Target Achieved' : 'In Progress'}</span>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      function openPaymentModal(prefillInvoiceId) {
        var userRole = localStorage.getItem('userRole');
        document.getElementById('payment-doc-id').value = "";
        document.getElementById('payment-modal-title').innerText = "Record Payment Collection";

        populatePaymentClientDropdown();
        populateInvoiceDropdown();

        document.getElementById('inp-pay-client-select').value = "";
        document.getElementById('inp-pay-customer').value = "";
        document.getElementById('inp-pay-invoice').value = "";
        document.getElementById('inp-pay-amount').value = 500000;
        document.getElementById('inp-pay-tds').value = 0;
        document.getElementById('inp-pay-reason').value = "Advance";
        document.getElementById('inp-pay-mode').value = "NEFT/RTGS";
        document.getElementById('inp-pay-utr').value = "";
        document.getElementById('inp-pay-date').value = getFormattedToday();
        document.getElementById('inp-pay-status-display').innerText = "⏳ Pending Finance Verification";
        document.getElementById('inp-pay-milestone').value = "1st Milestone Advance Payment against Purchase Order";
        document.getElementById('inp-pay-remarks').value = "";

        if (prefillInvoiceId) {
          var select = document.getElementById('inp-pay-invoice-select');
          if (select) {
            select.value = prefillInvoiceId;
            onInvoiceSelected(prefillInvoiceId);
          }
        }

        document.getElementById('payment-modal').classList.remove('hidden');
      }

      function closePaymentModal() {
        document.getElementById('payment-modal').classList.add('hidden');
      }

      function handleSavePayment(e) {
        e.preventDefault();
        var docId = document.getElementById('payment-doc-id').value;
        var myEmpId = localStorage.getItem('employeeId');
        var myName = localStorage.getItem('userName');
        var userRole = localStorage.getItem('userRole');

        var invoiceId = document.getElementById('inp-pay-invoice-select').value;
        var invoiceNumber = document.getElementById('inp-pay-invoice').value.trim();
        var amount = Number(document.getElementById('inp-pay-amount').value) || 0;
        var tdsAmount = Number(document.getElementById('inp-pay-tds').value) || 0;
        var paymentReason = document.getElementById('inp-pay-reason').value;

        // Whoever records the payment (Advance, Part, or Final) cannot mark
        // it Cleared themselves — it always starts Pending Finance
        // Verification, and only counts as revenue once the Finance Head
        // verifies it via verifyPaymentDirectly(). An edit to an
        // already-verified payment keeps that verified state as-is.
        var existingPayment = docId ? (window.RevOpsStore.getCollection('payments') || []).find(function(p) { return p.id === docId; }) : null;
        var alreadyVerified = existingPayment && existingPayment.verifiedByAccounts === true;
        var statusVal = alreadyVerified ? existingPayment.status : 'Pending Finance Verification';

        var receiptNumber = docId ? '' : window.RevOpsStore.generateNextReceiptNumber();

        var payData = {
          invoiceId: invoiceId,
          invoiceNumber: invoiceNumber,
          customerName: document.getElementById('inp-pay-customer').value.trim(),
          amount: amount,
          tdsAmount: tdsAmount,
          paymentReason: paymentReason,
          paymentMode: document.getElementById('inp-pay-mode').value,
          utrNumber: document.getElementById('inp-pay-utr').value.trim(),
          bankAccount: document.getElementById('inp-pay-bank').value,
          paymentDate: document.getElementById('inp-pay-date').value.trim(),
          paymentMilestone: document.getElementById('inp-pay-milestone').value.trim(),
          status: statusVal,
          verifiedByAccounts: alreadyVerified,
          accountsVerifiedAt: alreadyVerified ? existingPayment.accountsVerifiedAt : null,
          accountsApproverName: alreadyVerified ? existingPayment.accountsApproverName : null,
          remarks: document.getElementById('inp-pay-remarks').value.trim(),
          employeeId: myEmpId,
          employeeName: myName,
          updatedAt: new Date().toISOString()
        };

        var savedDocId = docId;
        if (docId) {
          window.RevOpsStore.updateItem('payments', docId, payData);
        } else {
          payData.receiptNumber = receiptNumber;
          payData.createdAt = new Date().toISOString();
          payData.receiptDispatchHistory = [];
          var added = window.RevOpsStore.addItem('payments', payData);
          savedDocId = added.id;
        }

        // Real-time synchronization of linked Invoice balance & status
        if (invoiceId || invoiceNumber) {
          window.RevOpsStore.syncInvoicePaymentStatus(invoiceId || invoiceNumber);
        }

        closePaymentModal();
        populatePaymentClientDropdown();
        populateInvoiceDropdown();
        renderActivePaymentView();

        // Prompt to email receipt
        var confirmationMsg = alreadyVerified ?
          ("✅ Payment collection updated. Receipt Ref: " + (payData.receiptNumber || existingPayment.receiptNumber || 'REC') + ".\n\nWould you like to send the official Payment Settlement Receipt to the client now?") :
          ("✅ Payment collection recorded (Pending Finance Verification — it will not count as revenue until the Finance Head verifies it). Receipt Ref: " + (payData.receiptNumber || 'REC') + ".\n\nWould you like to compose the acknowledgement email for the client now?");

        if (confirm(confirmationMsg)) {
          openSendReceiptModal(savedDocId);
        }
      }

      function editPayment(docId) {
        var payments = window.RevOpsStore.getCollection('payments') || [];
        var p = payments.find(function(item) { return item.id === docId; });
        if (!p) return;

        document.getElementById('payment-doc-id').value = p.id;
        document.getElementById('payment-modal-title').innerText = "Edit Payment Collection";

        populatePaymentClientDropdown();
        populateInvoiceDropdown();
        if (p.invoiceId) {
          document.getElementById('inp-pay-invoice-select').value = p.invoiceId;
        }

        document.getElementById('inp-pay-customer').value = p.customerName;
        document.getElementById('inp-pay-invoice').value = p.invoiceNumber || '';
        document.getElementById('inp-pay-amount').value = p.amount;
        document.getElementById('inp-pay-tds').value = p.tdsAmount || 0;
        document.getElementById('inp-pay-reason').value = p.paymentReason || 'Part payment';
        document.getElementById('inp-pay-mode').value = p.paymentMode;
        document.getElementById('inp-pay-utr').value = p.utrNumber || '';
        document.getElementById('inp-pay-bank').value = p.bankAccount || document.getElementById('inp-pay-bank').options[0].value;
        document.getElementById('inp-pay-date').value = p.paymentDate;
        document.getElementById('inp-pay-milestone').value = p.paymentMilestone || '';
        document.getElementById('inp-pay-status-display').innerText = p.verifiedByAccounts === true ? ("✅ Verified & Cleared by " + (p.accountsApproverName || 'Finance Head')) : "⏳ Pending Finance Verification";
        document.getElementById('inp-pay-remarks').value = p.remarks || '';

        calculateRemainingBalancePreview();
        document.getElementById('payment-modal').classList.remove('hidden');
      }

      function deletePayment(docId) {
        if (confirm("Are you sure you want to delete this payment collection?")) {
          var payments = window.RevOpsStore.getCollection('payments') || [];
          var p = payments.find(function(item) { return item.id === docId; });
          window.RevOpsStore.deleteItem('payments', docId);

          if (p && (p.invoiceId || p.invoiceNumber)) {
            window.RevOpsStore.syncInvoicePaymentStatus(p.invoiceId || p.invoiceNumber);
          }
          populatePaymentClientDropdown();
          populateInvoiceDropdown();
          renderActivePaymentView();
        }
      }

      // View Printable Settlement Receipt Voucher
      function viewPrintableReceipt(payId) {
        var payments = window.RevOpsStore.getCollection('payments') || [];
        var p = payments.find(function(item) { return item.id === payId; });
        if (!p) return;

        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var linkedInv = invoices.find(function(inv) { return inv.id === p.invoiceId || inv.invoiceNumber === p.invoiceNumber; });

        var receiptNum = p.receiptNumber || ('REC-2026-' + p.id.slice(-3));
        document.getElementById('receipt-modal-title').innerText = `Payment Receipt Voucher - ${receiptNum}`;

        var wrapper = document.getElementById('printable-receipt-wrapper');
        var netAmt = Number(p.amount) || 0;
        var tdsAmt = Number(p.tdsAmount) || 0;
        var totalSettlement = netAmt + tdsAmt;

        wrapper.innerHTML = `
          <!-- Header -->
          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-2xl font-black text-indigo-950 tracking-tight">MEASURE DI TECHNOLOGIES</span>
                <span class="px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-black uppercase">PAYMENT RECEIPT</span>
              </div>
              <p class="text-xs text-slate-600 mt-1">
                Plot No. 42, SIDCO Industrial Estate, Guindy, Chennai - 600032, Tamil Nadu<br>
                <strong>GSTIN:</strong> 33AAACM4209L1ZT | <strong>CIN:</strong> U72900TN2020PTC135890
              </p>
            </div>
            <div class="text-right">
              <h2 class="text-lg font-black text-emerald-800 uppercase tracking-wide">SETTLEMENT RECEIPT</h2>
              <div class="text-xs font-mono font-bold text-slate-900 mt-1">${escapeHtml(receiptNum)}</div>
              <div class="text-xs text-slate-500 font-mono mt-0.5">Date: ${escapeHtml(p.paymentDate)}</div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">Cleared & Credited</span>
            </div>
          </div>

          <!-- Received From Client -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
            <div class="flex justify-between">
              <div>
                <span class="text-[10px] font-bold uppercase text-slate-400">Received With Thanks From:</span>
                <div class="font-bold text-slate-900 text-sm">${escapeHtml(p.customerName)}</div>
              </div>
              <div class="text-right">
                <span class="text-[10px] font-bold uppercase text-slate-400">Commercial Invoice Ref:</span>
                <div class="font-bold font-mono text-indigo-700">${escapeHtml(p.invoiceNumber || 'Direct Payment')}</div>
              </div>
            </div>
          </div>

          <!-- Settlement Breakdown Matrix -->
          <div class="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-100 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-700">
                  <th class="py-2.5 px-3">Description / Purpose</th>
                  <th class="py-2.5 px-3">Payment Mode & Ref</th>
                  <th class="py-2.5 px-3 text-right">Net Credited (Rs.)</th>
                  <th class="py-2.5 px-3 text-right">TDS (Rs.)</th>
                  <th class="py-2.5 px-3 text-right">Total Settled (Rs.)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr>
                  <td class="py-3 px-3 font-semibold text-slate-900">
                    ${escapeHtml(p.paymentMilestone || 'Commercial Invoice Settlement')}
                  </td>
                  <td class="py-3 px-3 font-mono text-slate-700">
                    ${escapeHtml(p.paymentMode)}<br>
                    <span class="text-[10px] text-slate-400">Ref: ${escapeHtml(p.utrNumber || '--')}</span>
                  </td>
                  <td class="py-3 px-3 text-right font-mono font-bold text-emerald-700">${formatINR(netAmt)}</td>
                  <td class="py-3 px-3 text-right font-mono text-slate-600">${tdsAmt > 0 ? formatINR(tdsAmt) : '--'}</td>
                  <td class="py-3 px-3 text-right font-mono font-black text-slate-900 text-sm">${formatINR(totalSettlement)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Account & Balance Context -->
          <div class="grid grid-cols-2 gap-4 text-xs">
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Company Bank Narration:</span>
              <p class="font-mono text-[11px] text-slate-700">${escapeHtml(p.bankAccount || 'HDFC Bank - 50200049283719')}</p>
              ${p.remarks ? `<p class="text-[11px] text-slate-500 mt-1 italic">${escapeHtml(p.remarks)}</p>` : ''}
            </div>

            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-right">
              ${linkedInv ? `
                <div class="flex justify-between text-slate-600">
                  <span>Total Invoice Value:</span>
                  <span class="font-mono font-bold">${formatINR(linkedInv.grandTotal)}</span>
                </div>
                <div class="flex justify-between text-emerald-700">
                  <span>Cumulative Paid:</span>
                  <span class="font-mono font-bold">${formatINR((linkedInv.paidAmount || 0) + (linkedInv.tdsDeducted || 0))}</span>
                </div>
                <div class="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-1">
                  <span>Remaining Invoice Balance:</span>
                  <span class="font-mono ${linkedInv.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}">${formatINR(linkedInv.balanceDue)}</span>
                </div>
              ` : `
                <div class="text-slate-500 italic">No linked invoice ledger. Standalone payment receipt.</div>
              `}
            </div>
          </div>

          <!-- Signature Seal -->
          <div class="flex justify-between items-end border-t border-slate-200 pt-6 text-xs">
            <div class="text-[11px] text-slate-400">
              Authenticated electronic receipt issued by Measure DI RevOps Engine.
            </div>
            <div class="text-center">
              <div class="w-32 h-10 border-b border-slate-400 mx-auto flex items-center justify-center text-[9px] text-slate-400 italic">
                [Authorized Accounts Seal]
              </div>
              <span class="font-bold text-slate-900 block mt-1">MEASURE DI TECHNOLOGIES</span>
              <span class="text-[10px] text-slate-500">Finance & Accounts Department</span>
            </div>
          </div>
        `;

        document.getElementById('receipt-view-modal').classList.remove('hidden');
      }

      function closeReceiptViewModal() {
        document.getElementById('receipt-view-modal').classList.add('hidden');
      }

      function printReceiptDoc() {
        window.print();
      }

      // Email Dispatch of Payment Receipt
      function openSendReceiptModal(payId) {
        var payments = window.RevOpsStore.getCollection('payments') || [];
        var p = payments.find(function(item) { return item.id === payId; });
        if (!p) return;

        var invoices = window.RevOpsStore.getCollection('invoices') || [];
        var linkedInv = invoices.find(function(inv) { return inv.id === p.invoiceId || inv.invoiceNumber === p.invoiceNumber; });

        document.getElementById('send-rec-pay-id').value = p.id;
        var clientEmail = (linkedInv && linkedInv.customerEmail) ? linkedInv.customerEmail : 'accounts@client.com';
        document.getElementById('inp-rec-to').value = clientEmail;

        var receiptNum = p.receiptNumber || ('REC-2026-' + p.id.slice(-3));
        document.getElementById('send-rec-attachment-name').innerText = `${receiptNum}.pdf`;

        var subject = `[Measure DI Technologies] Payment Settlement Receipt Ref: ${receiptNum} for Invoice ${p.invoiceNumber || ''}`;
        document.getElementById('inp-rec-subject').value = subject;

        var netAmt = Number(p.amount) || 0;
        var tdsAmt = Number(p.tdsAmount) || 0;
        var totalSettled = netAmt + tdsAmt;

        // Build complete payment history & write-off breakdown for this invoice
        var allPayments = window.RevOpsStore.getCollection('payments') || [];
        var linkedPayments = allPayments.filter(function(pay) {
          return linkedInv && (pay.invoiceId === linkedInv.id || pay.invoiceNumber === linkedInv.invoiceNumber);
        }).sort(function(a, b) {
          return new Date(a.paymentDate) - new Date(b.paymentDate);
        });

        var allAdjustments = window.RevOpsStore.getCollection('arAdjustments') || [];
        var linkedAdjustments = allAdjustments.filter(function(adj) {
          return linkedInv && (adj.invoiceId === linkedInv.id || adj.invoiceNumber === linkedInv.invoiceNumber) && (adj.status === 'Approved' || adj.status === 'Approved by Director');
        });

        var historyLines = [];
        var cumulativePaid = 0;
        linkedPayments.forEach(function(pay, idx) {
          var pNet = Number(pay.amount) || 0;
          var pTds = Number(pay.tdsAmount) || 0;
          var pTot = pNet + pTds;
          cumulativePaid += pTot;
          var isThis = (pay.id === p.id);
          historyLines.push(`  ${idx + 1}. [${pay.paymentDate}] Receipt #${pay.receiptNumber || 'REC'} - ${formatINR(pNet)}${pTds > 0 ? ' + TDS ' + formatINR(pTds) : ''} via ${pay.paymentMode} (Ref: ${pay.utrNumber || 'N/A'})${isThis ? '  <-- [THIS TRANSACTION]' : ''}`);
        });

        var writeOffNotes = [];
        if (linkedAdjustments.length > 0) {
          linkedAdjustments.forEach(function(adj) {
            writeOffNotes.push(`• Concession / Write-Off: ${adj.adjustmentNumber || adj.refNumber} | Amount: ${formatINR(adj.amount)} | Type: ${adj.type} | Authorized by Director (${adj.directorApproval ? adj.directorApproval.approvedBy : 'Board of Directors'})`);
          });
        }

        var balanceStatement = "";
        if (linkedInv) {
          if (linkedInv.balanceDue <= 0.01) {
            if (linkedInv.writeOffAmount > 0) {
              balanceStatement = `\n>>> INVOICE ACCOUNT STATUS: FULLY SETTLED & CLOSED (Post Director-Approved Write-Off of ${formatINR(linkedInv.writeOffAmount)})`;
            } else if (linkedInv.adjustmentAmount > 0) {
              balanceStatement = `\n>>> INVOICE ACCOUNT STATUS: FULLY SETTLED & CLOSED (Post Commercial Adjustment of ${formatINR(linkedInv.adjustmentAmount)})`;
            } else {
              balanceStatement = `\n>>> INVOICE ACCOUNT STATUS: 100% FULLY PAID & RECONCILED (Balance: Rs.0.00)`;
            }
          } else {
            balanceStatement = `\n>>> REMAINING PENDING BALANCE: ${formatINR(linkedInv.balanceDue)} (Due for remittance)`;
          }
        }

        var body = `Dear ${p.customerName} Accounts & Procurement Team,

Greetings from Measure DI Technologies Private Limited.

We gratefully acknowledge receipt of your remittance of ${formatINR(netAmt)}${tdsAmt > 0 ? ' (plus TDS deduction of ' + formatINR(tdsAmt) + ')' : ''} towards Invoice Ref: ${p.invoiceNumber || '--'}.

=======================================================
CURRENT REMITTANCE ACKNOWLEDGEMENT DETAILS
=======================================================
- Official Receipt Number: ${receiptNum}
- Receipt Date: ${p.paymentDate}
- Customer Name: ${p.customerName}
- Purpose / Milestone: ${p.paymentMilestone || p.paymentReason || 'Commercial Invoice Settlement'}
- Payment Reason Category: ${p.paymentReason || 'Milestone Collection'}
- Net Amount Credited: ${formatINR(netAmt)}
- TDS Deducted: ${tdsAmt > 0 ? formatINR(tdsAmt) : 'Rs.0 (Nil)'}
- Total Settlement Value: ${formatINR(totalSettled)}
- Remittance Mode: ${p.paymentMode}
- Bank Reference / UTR Number: ${p.utrNumber || 'N/A'}
- Beneficiary Bank Account: ${p.bankAccount || 'HDFC Bank - 50200049283719'}

=======================================================
INVOICE CUMULATIVE PAYMENT & LEDGER STATEMENT
=======================================================
- Commercial Invoice Number: ${p.invoiceNumber || '--'}
- Total Invoice Grand Total: ${linkedInv ? formatINR(linkedInv.grandTotal) : 'N/A'}
- Total Payments Credited to Date: ${formatINR(cumulativePaid)}
${historyLines.length > 0 ? '\nPayment History Breakdown:\n' + historyLines.join('\n') : ''}
${writeOffNotes.length > 0 ? '\nAuthorized Adjustments / Write-Offs:\n' + writeOffNotes.join('\n') : ''}
${balanceStatement}

Our official stamped & digitally authorized Payment Settlement Receipt voucher (${receiptNum}.pdf) is attached herewith for your records and accounts reconciliation.

Thank you for your valued partnership with Measure DI Technologies.

Warm regards,
Finance & Accounts Operations
Measure DI Technologies Private Limited
Plot No. 42, SIDCO Industrial Estate, Guindy, Chennai - 600032
Mobile: +91 98406 29928 | Email: measuredichennai@gmail.com`;

        document.getElementById('inp-rec-body').value = body;

        var histBox = document.getElementById('rec-dispatch-history-box');
        var histList = document.getElementById('rec-dispatch-history-list');
        if (p.receiptDispatchHistory && p.receiptDispatchHistory.length > 0) {
          histBox.classList.remove('hidden');
          histList.innerHTML = p.receiptDispatchHistory.map(function(h) {
            return `<div>• ${h.timestamp} - Sent to <strong>${escapeHtml(h.to)}</strong> (${h.status})</div>`;
          }).join('');
        } else {
          histBox.classList.add('hidden');
        }

        document.getElementById('send-receipt-modal').classList.remove('hidden');
      }

      function closeSendReceiptModal() {
        document.getElementById('send-receipt-modal').classList.add('hidden');
      }

      async function executeSendReceiptEmail() {
        var payId = document.getElementById('send-rec-pay-id').value;
        var toEmail = document.getElementById('inp-rec-to').value.trim();
        var ccEmail = document.getElementById('inp-rec-cc').value.trim();
        var subject = document.getElementById('inp-rec-subject').value.trim();
        var body = document.getElementById('inp-rec-body')?.value?.trim() || '';
        var myName = localStorage.getItem('userName') || 'Accounts Team';

        if (!toEmail) {
          alert("Please enter the recipient client email address.");
          return;
        }

        var payments = window.RevOpsStore.getCollection('payments') || [];
        var p = payments.find(function(it) { return it.id === payId; });
        if (!p) return;

        var btn = event?.target?.closest('button');
        var originalBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span>⏳ Dispatching Receipt via Brevo...</span>';
        }

        try {
          if (!window.BrevoMailer || typeof window.BrevoMailer.sendEmail !== 'function') {
            throw new Error('Email service failed to load. Please refresh the page and try again.');
          }
          var res = await window.BrevoMailer.sendEmail({
            to: toEmail,
            toName: p.customerName,
            cc: ccEmail,
            subject: subject,
            textContent: body
          });

          var history = p.receiptDispatchHistory || [];
          history.push({
            timestamp: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            to: toEmail,
            cc: ccEmail,
            subject: subject,
            senderName: myName,
            status: 'Delivered (Brevo)',
            messageId: res ? res.messageId : ''
          });

          window.RevOpsStore.updateItem('payments', p.id, { receiptDispatchHistory: history });
          closeSendReceiptModal();
          renderActivePaymentView();
          alert("✅ SUCCESS!\n\nPayment Settlement Receipt dispatched directly to " + toEmail + " via Brevo!\n\n• Sender: Measure DI Systems (measuredichennai@gmail.com)\n• Audit trail logged successfully.");
        } catch (err) {
          console.error('Receipt send error:', err);
          var fallback = confirm("Notice during receipt dispatch:\n" + (err.message || err) + "\n\nWould you like to launch your local email client instead?");
          if (fallback) {
            openReceiptInMailClient();
          }
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
          }
        }
      }

      function openReceiptInMailClient() {
        var toEmail = document.getElementById('inp-rec-to').value.trim();
        var ccEmail = document.getElementById('inp-rec-cc').value.trim();
        var subject = encodeURIComponent(document.getElementById('inp-rec-subject').value.trim());
        var body = encodeURIComponent(document.getElementById('inp-rec-body').value.trim());
        window.location.href = `mailto:${toEmail}?cc=${ccEmail}&subject=${subject}&body=${body}`;
      }

      async function sendClientPaymentReminder(clientName, clientEmail, balanceDue) {
        var toEmail = clientEmail || 'accounts@client.com';
        var subject = `[Payment Reminder] Measure DI Technologies - Outstanding Balance Ref: ${clientName}`;
        var body = `Dear ${clientName} Accounts Team,\n\nThis is a friendly reminder that an outstanding commercial balance of ${formatINR(balanceDue)} is currently pending settlement with Measure DI Technologies Pvt Ltd.\n\nKindly review your pending invoices and arrange remittance at your earliest convenience.\n\nRemittance Bank:\nHDFC Bank - A/c No: 50200049283719 (IFSC: HDFC0000123, Guindy Chennai)\n\nThank you,\nFinance & Accounts Team\nMeasure DI Technologies Pvt Ltd`;
        
        var confirmSend = confirm(`Send automatic payment reminder to ${clientName} (${toEmail}) for outstanding balance of ${formatINR(balanceDue)}?`);
        if (!confirmSend) return;

        try {
          if (window.BrevoMailer && typeof window.BrevoMailer.sendEmail === 'function') {
            await window.BrevoMailer.sendEmail({
              to: toEmail,
              toName: clientName,
              cc: 'measuredichennai@gmail.com',
              subject: subject,
              textContent: body
            });
            alert(`✅ Payment reminder dispatched successfully to ${toEmail} via Brevo!`);
          } else {
            window.location.href = `mailto:${toEmail}?cc=measuredichennai@gmail.com&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          }
        } catch (err) {
          console.error('Reminder dispatch error:', err);
          window.location.href = `mailto:${toEmail}?cc=measuredichennai@gmail.com&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
      }

