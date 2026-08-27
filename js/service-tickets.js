var currentViewMode = 'table';
      var activeTicketsList = [];
      var ticketRaisePhotos = [];
      var signedReportPhotos = [];
      var pendingCreatedTicket = null;
      var activeEditTicket = null;

      function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      }

      document.addEventListener('DOMContentLoaded', function() {
        populateMasterDropdowns();
        renderServiceTicketsModule();

        // Subscribe to real-time updates if Firestore active
        if (window.RevOpsStore && typeof window.RevOpsStore.subscribeRealtimeSync === 'function') {
          window.RevOpsStore.subscribeRealtimeSync('serviceTickets', function(remoteData) {
            renderServiceTicketsModule();
          });
        }

        // Check URL parameters for direct ticket raising from other modules (e.g. Master lists or AMC)
        var urlParams = new URLSearchParams(window.location.search);
        var preCustomer = urlParams.get('customer');
        var preModel = urlParams.get('model');
        var preSerial = urlParams.get('serial');
        if (preCustomer || preSerial) {
          openRaiseTicketModal(preCustomer, preModel, preSerial);
        }
      });

      // CLIENT & EQUIPMENT REGISTRY (Cascading Data Master)
      function getClientEquipmentRegistry() {
        var clientMap = {};

        // 1. Base Master Roster — Master Data > Installed Equipment
        // (clientEquipmentMaster). This is the same real, admin-editable
        // registry Warranty Management reads from, so a machine added
        // there now actually shows up here when raising a ticket for it.
        var equipRoster = window.RevOpsStore ? (window.RevOpsStore.getCollection('clientEquipmentMaster') || []) : [];
        equipRoster.forEach(function(item) {
          if (item.isActive === false) return;
          var cust = (item.customerName || '').trim();
          var model = (item.modelName || item.equipmentModel || '').trim();
          var serial = (item.serialNumber || '').trim();
          if (!cust || !model || !serial) return;
          if (!clientMap[cust]) clientMap[cust] = {};
          if (!clientMap[cust][model]) clientMap[cust][model] = [];
          clientMap[cust][model].push({
            serial: serial,
            warranty: item.warrantyStatus || (item.warrantyExpiry ? 'Under Warranty' : 'AMC Contract'),
            vertical: item.vertical || 'Service/Parts',
            contactEmail: item.contactEmail || ''
          });
        });

        // 2. Supplement from Orders
        var orders = window.RevOpsStore ? (window.RevOpsStore.getCollection('orders') || []) : [];
        orders.forEach(function(o) {
          var cName = (o.customerName || o.customer || '').trim();
          var model = (o.productGroup || o.productName || 'MDI Standard System').trim();
          var serial = (o.equipmentSerial || ('EQ-' + (o.orderNumber || '1000').slice(-4))).trim();
          if (cName && model) {
            if (!clientMap[cName]) clientMap[cName] = {};
            if (!clientMap[cName][model]) clientMap[cName][model] = [];
            var exists = clientMap[cName][model].some(function(x) { return x.serial === serial; });
            if (!exists) {
              clientMap[cName][model].push({
                serial: serial,
                warranty: o.warrantyStatus || 'Under Warranty',
                vertical: o.vertical || 'Sales',
                contactEmail: o.contactEmail || ''
              });
            }
          }
        });

        // 3. Supplement from existing Service Tickets
        var tickets = window.RevOpsStore ? (window.RevOpsStore.getCollection('serviceTickets') || []) : [];
        tickets.forEach(function(t) {
          var cName = (t.customerName || '').trim();
          var model = (t.equipmentModel || '').trim();
          var serial = (t.equipmentSerial || '').trim();
          if (cName && model && serial) {
            if (!clientMap[cName]) clientMap[cName] = {};
            if (!clientMap[cName][model]) clientMap[cName][model] = [];
            var exists = clientMap[cName][model].some(function(x) { return x.serial === serial; });
            if (!exists) {
              clientMap[cName][model].push({
                serial: serial,
                warranty: t.warrantyStatus || 'AMC Contract',
                vertical: t.vertical || 'Service/Parts',
                contactEmail: t.clientEmail || ''
              });
            }
          }
        });

        return clientMap;
      }

      function populateMasterDropdowns() {
        populateTechnicianDropdowns();
        populateCustomerDropdown();
        populateComplaintCategoryDropdown();
        populateSeverityDropdown();
      }

      // Complaint Category — admin-editable via Master Data > Complaint
      // Category. "Other" stays as a fixed manual-entry escape hatch, not
      // part of the master list itself.
      function populateComplaintCategoryDropdown() {
        var select = document.getElementById('input-category');
        if (!select) return;
        var items = (window.RevOpsStore.getCollection('complaintCategoryMaster') || []).filter(function(it) { return it.isActive !== false; });
        var currentVal = select.value;
        var optionsHtml = items.map(function(it) {
          return '<option value="' + escapeHtml(it.name) + '">' + escapeHtml(it.name) + '</option>';
        }).join('') + '<option value="Other">Other (Enter Manually...)</option>';
        select.innerHTML = optionsHtml;
        if (currentVal && (items.some(function(it) { return it.name === currentVal; }) || currentVal === 'Other')) {
          select.value = currentVal;
        }
      }

      // Severity / Priority — options AND their target SLA response
      // window both come from Master Data > SLA Response Policy (shared
      // with AMC Monitoring & AMC Quotes), so all three modules always
      // agree on what "Critical" etc. actually promises.
      function populateSeverityDropdown() {
        var select = document.getElementById('input-severity');
        if (!select) return;
        var tiers = (window.RevOpsStore.getCollection('slaResponseTierMaster') || []).filter(function(it) { return it.isActive !== false; });
        var currentVal = select.value;
        select.innerHTML = tiers.map(function(t) {
          var win = t.slaWindow || ((t.slaHours || 24) + ' Hours');
          return '<option value="' + escapeHtml(t.name) + '">' + escapeHtml(t.name) + ' (SLA ' + escapeHtml(win) + ')</option>';
        }).join('');
        if (currentVal && tiers.some(function(t) { return t.name === currentVal; })) {
          select.value = currentVal;
        } else if (tiers.some(function(t) { return t.name === 'High'; })) {
          select.value = 'High';
        }
      }

      function populateTechnicianDropdowns() {
        var emps = window.RevOpsStore ? (window.RevOpsStore.getCollection('employees') || []) : [];
        
        // Exclude Managing Director / Executive Leadership (E-001 / Ravichandran)
        // Show ONLY Field Engineers and Service Technicians
        var engineers = emps.filter(function(e) {
          if (!e) return false;
          if (e.isActive === false) return false;
          var empId = e.employeeId || e.id;
          var desig = (e.designation || '').toLowerCase();
          var name = (e.fullName || e.name || '').toLowerCase();
          
          if (empId === 'E-001' || name.includes('ravichandran') || desig.includes('managing director') || desig.includes('director')) {
            return false;
          }
          return true;
        });

        if (engineers.length === 0) {
          engineers = [
            { employeeId: 'E-004', fullName: 'Dipanwita (Priya Sharma)', designation: 'Sr. Service Eng' },
            { employeeId: 'E-005', fullName: 'Balaram', designation: 'Technical Services Manager' },
            { employeeId: 'E-006', fullName: 'Mathiarasu', designation: 'Territory Service Eng' },
            { employeeId: 'E-007', fullName: 'Sivakumar', designation: 'Sr. Field Service Eng' },
            { employeeId: 'E-008', fullName: 'Sandeep', designation: 'Service Engineer' },
            { employeeId: 'E-009', fullName: 'Manowharan', designation: 'Field Engineer' }
          ];
        }

        var techOptions = engineers.map(function(e) {
          var name = e.fullName || e.name;
          var desig = e.designation || 'Service Eng';
          return `<option value="${e.employeeId}">${name} (${desig})</option>`;
        }).join('');

        var techSelect = document.getElementById('input-assigned-to');
        var editTechSelect = document.getElementById('edit-assigned-to');
        var filterEng = document.getElementById('filter-engineer');

        if (techSelect) techSelect.innerHTML = techOptions;
        if (editTechSelect) editTechSelect.innerHTML = techOptions;

        if (filterEng) {
          filterEng.innerHTML = `<option value="ALL">All Engineers</option>` + techOptions;
        }
      }

      function populateCustomerDropdown() {
        var custSelect = document.getElementById('input-customer-name');
        if (!custSelect) return;

        var registry = getClientEquipmentRegistry();
        var customerNames = Object.keys(registry).sort();

        var optionsHtml = `<option value="">-- Select Customer from Master List --</option>`;
        customerNames.forEach(function(c) {
          optionsHtml += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
        });

        custSelect.innerHTML = optionsHtml;
      }

      // TASK 2: CASCADING DROPDOWNS (Customer -> Model -> Serial)
      function handleCustomerSelectChange(custName, preSelectedModel, preSelectedSerial) {
        var modelSelect = document.getElementById('input-equipment-model');
        var serialSelect = document.getElementById('input-equipment-serial');
        var repeatBanner = document.getElementById('repeat-10day-alert-banner');
        if (repeatBanner) repeatBanner.classList.add('hidden');

        if (!custName) {
          if (modelSelect) modelSelect.innerHTML = `<option value="">-- First Select Customer --</option>`;
          if (serialSelect) serialSelect.innerHTML = `<option value="">-- First Select Model --</option>`;
          return;
        }

        var registry = getClientEquipmentRegistry();
        var clientModels = registry[custName] || {};
        var modelKeys = Object.keys(clientModels).sort();

        if (modelKeys.length === 0) {
          modelKeys = ['MDI-WS-9000 Weighbridge System', 'MDI-CS-5000 Heavy Crane Scale', 'MDI-BS-7000 Belt Conveyor Weigher'];
        }

        var modelOptions = `<option value="">-- Select Equipment Model (${modelKeys.length} available) --</option>`;
        modelKeys.forEach(function(m) {
          var isSel = (preSelectedModel && preSelectedModel === m) ? 'selected' : '';
          modelOptions += `<option value="${escapeHtml(m)}" ${isSel}>${escapeHtml(m)}</option>`;
        });

        if (modelSelect) {
          modelSelect.innerHTML = modelOptions;
          if (preSelectedModel) {
            handleModelSelectChange(preSelectedModel, preSelectedSerial);
          } else if (modelKeys.length === 1) {
            modelSelect.value = modelKeys[0];
            handleModelSelectChange(modelKeys[0], preSelectedSerial);
          } else {
            if (serialSelect) serialSelect.innerHTML = `<option value="">-- First Select Model --</option>`;
          }
        }
      }

      function handleModelSelectChange(modelName, preSelectedSerial) {
        var custName = document.getElementById('input-customer-name')?.value;
        var serialSelect = document.getElementById('input-equipment-serial');
        var repeatBanner = document.getElementById('repeat-10day-alert-banner');
        if (repeatBanner) repeatBanner.classList.add('hidden');

        if (!modelName || !custName) {
          if (serialSelect) serialSelect.innerHTML = `<option value="">-- First Select Model --</option>`;
          return;
        }

        var registry = getClientEquipmentRegistry();
        var serialEntries = (registry[custName] && registry[custName][modelName]) ? registry[custName][modelName] : [];

        if (serialEntries.length === 0) {
          serialEntries = [{ serial: 'EQ-9000-NEW', warranty: 'Under Warranty', vertical: 'Service/Parts' }];
        }

        var serialOptions = `<option value="">-- Select Serial Number (${serialEntries.length} registered) --</option>`;
        serialEntries.forEach(function(item) {
          var isSel = (preSelectedSerial && preSelectedSerial === item.serial) ? 'selected' : '';
          serialOptions += `<option value="${escapeHtml(item.serial)}" ${isSel} data-warranty="${escapeHtml(item.warranty || 'AMC Contract')}" data-vertical="${escapeHtml(item.vertical || 'Service/Parts')}">${escapeHtml(item.serial)}</option>`;
        });

        if (serialSelect) {
          serialSelect.innerHTML = serialOptions;
          if (preSelectedSerial) {
            serialSelect.value = preSelectedSerial;
            handleSerialSelectChange(preSelectedSerial);
          } else if (serialEntries.length === 1) {
            serialSelect.value = serialEntries[0].serial;
            handleSerialSelectChange(serialEntries[0].serial);
          }
        }
      }

      function handleSerialSelectChange(serial) {
        if (!serial) {
          document.getElementById('repeat-10day-alert-banner')?.classList.add('hidden');
          return;
        }

        // Auto-update warranty status and vertical if available
        var serialSelect = document.getElementById('input-equipment-serial');
        var selOpt = serialSelect?.options[serialSelect.selectedIndex];
        if (selOpt) {
          var warr = selOpt.getAttribute('data-warranty');
          var vert = selOpt.getAttribute('data-vertical');
          if (warr && document.getElementById('input-warranty')) document.getElementById('input-warranty').value = warr;
          if (vert && document.getElementById('input-vertical')) document.getElementById('input-vertical').value = vert;
        }

        // TASK 10: 10-Day Repeat Complaint Detection
        check10DayRepeatDefect(serial);
      }

      // TASK 10: 10-DAY REPEAT COMPLAINT CHECK ENGINE
      function check10DayRepeatDefect(serial) {
        var banner = document.getElementById('repeat-10day-alert-banner');
        var bannerText = document.getElementById('repeat-10day-alert-text');
        if (!banner) return;

        var tickets = window.RevOpsStore ? (window.RevOpsStore.getCollection('serviceTickets') || []) : [];
        var cleanSerial = (serial || '').toLowerCase().trim();

        var matching = tickets.filter(function(t) {
          return (t.equipmentSerial || '').toLowerCase().trim() === cleanSerial;
        });

        if (matching.length === 0) {
          banner.classList.add('hidden');
          return;
        }

        var now = new Date();
        var recentRepeat = null;
        var minDiffDays = 999;

        matching.forEach(function(t) {
          var dateToCheck = t.resolvedDate ? new Date(t.resolvedDate) : parseDateDMY(t.createdDate);
          if (dateToCheck && !isNaN(dateToCheck.getTime())) {
            var diffDays = Math.floor((now - dateToCheck) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 10 && diffDays < minDiffDays) {
              minDiffDays = diffDays;
              recentRepeat = t;
            }
          }
        });

        if (recentRepeat) {
          banner.classList.remove('hidden');
          if (bannerText) {
            bannerText.innerHTML = `
              <strong>⚠️ REPETITIVE DEFECT DETECTED:</strong> Serial <code>${escapeHtml(serial)}</code> had ticket <strong>${escapeHtml(recentRepeat.ticketNumber || recentRepeat.id)}</strong> (${escapeHtml(recentRepeat.complaintCategory)}) closed/logged <strong>${minDiffDays} day(s) ago</strong>.
              <br/>This complaint is automatically escalated to <strong>High QC Audit Priority</strong> and flagged for root-cause verification.
            `;
          }
          var sevSelect = document.getElementById('input-severity');
          if (sevSelect && (sevSelect.value === 'Low' || sevSelect.value === 'Medium')) {
            sevSelect.value = 'High';
            handleSeveritySelectChange('High');
          }
        } else {
          banner.classList.add('hidden');
        }
      }

      function handleSeveritySelectChange(sevVal) {
        var slaDateInput = document.getElementById('input-sla-date');
        if (!slaDateInput) return;

        var tiers = window.RevOpsStore ? (window.RevOpsStore.getCollection('slaResponseTierMaster') || []) : [];
        var tier = tiers.find(function(t) { return t.name === sevVal; });
        var slaHours = tier ? (Number(tier.slaHours) || 24) : 24;

        var targetDate = new Date();
        targetDate.setHours(targetDate.getHours() + slaHours);
        slaDateInput.value = targetDate.toISOString().slice(0, 10);
      }

      function parseDateDMY(dateStr) {
        if (!dateStr) return null;
        var parts = dateStr.split('/');
        if (parts.length === 3) {
          return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
        var partsHyphen = dateStr.split('-');
        if (partsHyphen.length === 3) {
          return new Date(parseInt(partsHyphen[0], 10), parseInt(partsHyphen[1], 10) - 1, parseInt(partsHyphen[2], 10));
        }
        return new Date(dateStr);
      }

      // TASK 3: COMPLAINT CATEGORY WITH 'OTHER'
      function handleCategorySelectChange(catVal) {
        var otherWrapper = document.getElementById('wrapper-category-other');
        var otherInput = document.getElementById('input-category-other');
        if (catVal === 'Other') {
          if (otherWrapper) otherWrapper.classList.remove('hidden');
          if (otherInput) {
            otherInput.setAttribute('required', 'required');
            otherInput.focus();
          }
        } else {
          if (otherWrapper) otherWrapper.classList.add('hidden');
          if (otherInput) {
            otherInput.removeAttribute('required');
            otherInput.value = '';
          }
        }
      }

      // TASK 6: ATTACHMENT IN TICKET RAISING (PDF, ZIP, IMAGES - MAX 10 FILES)
      // Attachments are embedded as base64 directly on the ticket record, which is
      // written to both a Firestore document (hard 1 MiB per-document limit) and the
      // browser's localStorage (shared ~5-10 MB quota across the whole app). Base64
      // inflates raw file size by ~37%, so the aggregate raw-byte cap here is kept
      // well under those limits — a higher cap silently breaks saving the ticket.
      function handleTicketPhotosSelect(e) {
        var files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        var maxFiles = 10;
        var maxBytes = 600 * 1024; // 600 KB raw (~820 KB base64) — stays safely under Firestore's 1 MiB document limit

        var currentBytes = ticketRaisePhotos.reduce(function(acc, item) {
          return acc + (item.rawBytes || 0);
        }, 0);

        if (ticketRaisePhotos.length + files.length > maxFiles) {
          alert("Maximum " + maxFiles + " files allowed per service ticket.");
          files = files.slice(0, maxFiles - ticketRaisePhotos.length);
        }

        files.forEach(function(file) {
          if (currentBytes + file.size > maxBytes) {
            alert("File '" + file.name + "' would exceed the 600 KB total attachment limit for a single ticket (files are stored inline and must fit within the database's per-record size limit). For larger files, share a link instead.");
            return;
          }
          currentBytes += file.size;

          var reader = new FileReader();
          reader.onload = function(evt) {
            ticketRaisePhotos.push({
              name: file.name,
              size: (file.size / 1024).toFixed(0) + ' KB',
              rawBytes: file.size,
              dataUrl: evt.target.result,
              isZip: file.name.toLowerCase().endsWith('.zip') || file.name.toLowerCase().endsWith('.rar') || file.name.toLowerCase().endsWith('.7z'),
              isPdf: file.name.toLowerCase().endsWith('.pdf'),
              isImage: file.type.startsWith('image/')
            });
            renderTicketRaisePhotosPreview();
          };
          reader.readAsDataURL(file);
        });
      }

      function renderTicketRaisePhotosPreview() {
        var container = document.getElementById('raise-photos-preview');
        var countEl = document.getElementById('raise-photo-count');
        if (!container) return;

        var totalSizeKB = ticketRaisePhotos.reduce(function(acc, it) { return acc + (it.rawBytes ? it.rawBytes / 1024 : 50); }, 0);
        var sizeLabel = totalSizeKB > 1024 ? (totalSizeKB / 1024).toFixed(1) + ' MB' : totalSizeKB.toFixed(0) + ' KB';

        if (countEl) countEl.textContent = `${ticketRaisePhotos.length} / 10 file(s) (${sizeLabel})`;

        container.innerHTML = ticketRaisePhotos.map(function(p, idx) {
          var icon = '📄';
          if (p.isZip) icon = '📦';
          else if (p.isPdf) icon = '📑';
          else if (p.isImage) icon = '🖼️';

          if (p.isImage && p.dataUrl) {
            return `
              <div class="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shadow-2xs">
                <img src="${p.dataUrl}" alt="Photo" class="w-full h-full object-cover" />
                <button type="button" onclick="removeTicketRaisePhoto(${idx})" class="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold opacity-80 hover:opacity-100">
                  &times;
                </button>
              </div>
            `;
          }

          return `
            <div class="relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-100 text-slate-800 text-xs font-semibold max-w-[200px]">
              <span>${icon}</span>
              <span class="truncate" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
              <button type="button" onclick="removeTicketRaisePhoto(${idx})" class="text-rose-600 font-bold ml-1 hover:text-rose-800">
                &times;
              </button>
            </div>
          `;
        }).join('');
      }

      function removeTicketRaisePhoto(idx) {
        ticketRaisePhotos.splice(idx, 1);
        renderTicketRaisePhotosPreview();
      }

      // TASK 7: SIGNED SERVICE REPORT IMAGES (MAX 5)
      // Same inline-storage constraint as ticket attachments above — capped in
      // aggregate raw bytes to stay under Firestore's 1 MiB document limit.
      function handleSignedReportImagesSelect(e) {
        var files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        var maxSignedReportBytes = 300 * 1024; // 300 KB raw (~410 KB base64)

        if (signedReportPhotos.length + files.length > 5) {
          alert("Maximum 5 signed service report images allowed per ticket.");
        }

        var currentBytes = signedReportPhotos.reduce(function(acc, item) {
          return acc + (item.rawBytes || 0);
        }, 0);

        var availableSlots = 5 - signedReportPhotos.length;
        files.slice(0, availableSlots).forEach(function(file) {
          if (currentBytes + file.size > maxSignedReportBytes) {
            alert("File '" + file.name + "' would exceed the 300 KB total limit for signed report images on a single ticket. Please compress the image and try again.");
            return;
          }
          currentBytes += file.size;

          var reader = new FileReader();
          reader.onload = function(evt) {
            signedReportPhotos.push({
              name: file.name,
              rawBytes: file.size,
              dataUrl: evt.target.result,
              uploadedAt: new Date().toISOString()
            });
            renderSignedReportsPreview();
          };
          reader.readAsDataURL(file);
        });
      }

      function renderSignedReportsPreview() {
        var container = document.getElementById('signed-reports-preview');
        var badge = document.getElementById('report-img-count-badge');
        var emptyMsg = document.getElementById('signed-reports-empty-msg');
        if (!container) return;

        if (badge) badge.textContent = `${signedReportPhotos.length} / 5 Max`;

        if (signedReportPhotos.length === 0) {
          container.innerHTML = `<span class="text-[10px] text-slate-400 italic" id="signed-reports-empty-msg">No signed service report images uploaded yet.</span>`;
          return;
        }

        container.innerHTML = signedReportPhotos.map(function(img, idx) {
          return `
            <div class="relative group w-16 h-16 rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shadow-xs">
              <img src="${img.dataUrl}" alt="Service Report" class="w-full h-full object-cover" />
              <button type="button" onclick="removeSignedReportPhoto(${idx})" class="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-90 hover:opacity-100 cursor-pointer">
                &times;
              </button>
            </div>
          `;
        }).join('');
      }

      function removeSignedReportPhoto(idx) {
        signedReportPhotos.splice(idx, 1);
        renderSignedReportsPreview();
      }

      // TASK 7: CLIENT REFUSAL TO SIGN
      function handleClientRefusalToggle(isChecked) {
        var wrapper = document.getElementById('wrapper-refusal-reason');
        var input = document.getElementById('inp-refusal-reason');
        if (isChecked) {
          wrapper?.classList.remove('hidden');
          input?.setAttribute('required', 'required');
          input?.focus();
        } else {
          wrapper?.classList.add('hidden');
          input?.removeAttribute('required');
          if (input) input.value = '';
        }
      }

      // TASK 8: CLIENT DELAYS & UNATTENDED LOG
      function toggleClientDelaySection() {
        var form = document.getElementById('wrapper-client-delay-form');
        if (form) form.classList.toggle('hidden');
      }

      // TASK 9: EDIT STATUS & NON-COMPLETION REASON
      function handleEditStatusChange(newStatus) {
        var nonCompWrapper = document.getElementById('wrapper-non-completion-reason');
        var partsWrapper = document.getElementById('wrapper-persisting-parts');

        if (newStatus !== 'Resolved' && newStatus !== 'Closed') {
          nonCompWrapper?.classList.remove('hidden');
        } else {
          nonCompWrapper?.classList.add('hidden');
        }

        if (newStatus === 'Pending Parts') {
          partsWrapper?.classList.remove('hidden');
        } else {
          partsWrapper?.classList.add('hidden');
        }
      }

      // TASK 5: TARGET SLA DATE MODIFICATION (Creator Security Check)
      function handleTargetSlaDateChanged() {
        var reasonInput = document.getElementById('edit-sla-change-reason');
        if (reasonInput) {
          reasonInput.classList.remove('hidden');
          reasonInput.focus();
        }
      }

      function getFinancialYearFromDateStr(dateStr) {
        if (!dateStr) return '2026-27';
        var parts = dateStr.split('/');
        if (parts.length < 3) parts = dateStr.split('-');
        if (parts.length < 3) return '2026-27';
        var day = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10);
        var year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;

        if (month >= 4) {
          return year + '-' + String(year + 1).slice(-2);
        } else {
          return (year - 1) + '-' + String(year).slice(-2);
        }
      }

      function switchViewMode(mode) {
        currentViewMode = mode;
        var btnTable = document.getElementById('btn-view-table');
        var btnKanban = document.getElementById('btn-view-kanban');
        var btnAnalytics = document.getElementById('btn-view-analytics');

        var viewTable = document.getElementById('view-mode-table');
        var viewKanban = document.getElementById('view-mode-kanban');
        var viewAnalytics = document.getElementById('view-mode-analytics');

        btnTable.className = mode === 'table' ? "px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-800 shadow-xs cursor-pointer flex items-center space-x-1" : "px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center space-x-1";
        btnKanban.className = mode === 'kanban' ? "px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-800 shadow-xs cursor-pointer flex items-center space-x-1" : "px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center space-x-1";
        btnAnalytics.className = mode === 'analytics' ? "px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-800 shadow-xs cursor-pointer flex items-center space-x-1" : "px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center space-x-1";

        if (viewTable) viewTable.classList.toggle('hidden', mode !== 'table');
        if (viewKanban) viewKanban.classList.toggle('hidden', mode !== 'kanban');
        if (viewAnalytics) viewAnalytics.classList.toggle('hidden', mode !== 'analytics');

        renderServiceTicketsModule();
      }

      function toggleQualityAlarmFilter() {
        var filterQual = document.getElementById('filter-quality');
        if (filterQual) {
          if (filterQual.value === 'REPETITIVE') {
            filterQual.value = 'ALL';
          } else {
            filterQual.value = 'REPETITIVE';
          }
          renderServiceTicketsModule();
        }
      }

      function detectRepetitiveDefects(tickets) {
        // Quality Monitoring Engine: Group tickets by customer + equipmentSerial
        var grouped = {};
        tickets.forEach(function(t) {
          var key = (t.customerName || '').toLowerCase().trim() + '___' + (t.equipmentSerial || '').toLowerCase().trim();
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(t);
        });

        var repeatAlarms = [];
        for (var key in grouped) {
          var tList = grouped[key];
          if (tList.length > 1) {
            // Sort by creation date
            tList.sort(function(a, b) {
              return new Date(a.createdDate || '2026-01-01') - new Date(b.createdDate || '2026-01-01');
            });

            repeatAlarms.push({
              customerName: tList[0].customerName,
              equipmentModel: tList[0].equipmentModel,
              equipmentSerial: tList[0].equipmentSerial,
              ticketsCount: tList.length,
              latestComplaint: tList[tList.length - 1].complaintCategory,
              description: tList[tList.length - 1].complaintDescription,
              rootCause: tList[tList.length - 1].rootCause || 'Under Root Cause Analysis (RCA)',
              assignedToName: tList[tList.length - 1].assignedToName || 'Priya Sharma',
              status: tList[tList.length - 1].status,
              ticketsList: tList
            });
          }
        }
        return repeatAlarms;
      }

      function renderServiceTicketsModule() {
        var allTickets = window.RevOpsStore ? (window.RevOpsStore.getCollection('serviceTickets') || []) : [];
        activeTicketsList = allTickets;

        // Apply Filters
        var fyFilter = document.getElementById('filter-fy')?.value || '2026-27';
        var statusFilter = document.getElementById('filter-status')?.value || 'ALL';
        var severityFilter = document.getElementById('filter-severity')?.value || 'ALL';
        var qualityFilter = document.getElementById('filter-quality')?.value || 'ALL';
        var engFilter = document.getElementById('filter-engineer')?.value || 'ALL';
        var searchFilter = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();

        // Check SLAs & Repetitive Defects across all
        var repeatAlarms = detectRepetitiveDefects(allTickets);

        // Update Alarm Badge Count
        var badgeText = document.getElementById('badge-alarm-btn-text');
        if (badgeText) {
          badgeText.textContent = `⚠️ ${repeatAlarms.length} Repetitive Alarms`;
        }

        // Render Quality Alarm Banner Cards
        renderQualityAlarmCards(repeatAlarms);

        // Filter Tickets
        var filtered = allTickets.filter(function(t) {
          if (fyFilter !== 'ALL') {
            var tFy = getFinancialYearFromDateStr(t.createdDate);
            if (tFy !== fyFilter) return false;
          }
          if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
          if (severityFilter !== 'ALL' && t.severity !== severityFilter) return false;
          if (engFilter !== 'ALL' && t.assignedTo !== engFilter) return false;

          if (qualityFilter === 'REPETITIVE') {
            if (!t.isRepetitiveDefect && t.repeatCountIn30Days <= 1) return false;
          } else if (qualityFilter === 'SLA_BREACHED') {
            var isBreached = checkSlaBreached(t);
            if (!isBreached) return false;
          }

          if (searchFilter) {
            var matchId = (t.ticketNumber || t.id || '').toLowerCase().includes(searchFilter);
            var matchCust = (t.customerName || '').toLowerCase().includes(searchFilter);
            var matchSerial = (t.equipmentSerial || '').toLowerCase().includes(searchFilter);
            var matchCat = (t.complaintCategory || '').toLowerCase().includes(searchFilter);
            if (!matchId && !matchCust && !matchSerial && !matchCat) return false;
          }
          return true;
        });

        // Compute KPIs
        computeAndRenderKPIs(filtered, allTickets, repeatAlarms);

        // Render Active View
        if (currentViewMode === 'table') {
          renderTableView(filtered);
        } else if (currentViewMode === 'kanban') {
          renderKanbanView(filtered);
        } else if (currentViewMode === 'analytics') {
          renderAnalyticsView(filtered);
        }
      }

      function checkSlaBreached(t) {
        if (t.status === 'Resolved' || t.status === 'Closed') {
          if (t.resolvedDate && t.targetSlaDate) {
            return new Date(t.resolvedDate) > new Date(t.targetSlaDate);
          }
          return false;
        } else {
          // Open or pending
          if (t.targetSlaDate) {
            var today = new Date();
            var target = new Date(t.targetSlaDate);
            return today > target;
          }
          return false;
        }
      }

      function renderQualityAlarmCards(repeatAlarms) {
        var container = document.getElementById('repeat-alarm-cards-list');
        if (!container) return;

        if (repeatAlarms.length === 0) {
          container.innerHTML = `
            <div class="col-span-full bg-slate-800/60 p-4 rounded-xl border border-slate-700 text-center text-xs text-slate-400">
              ✅ Zero repetitive complaint alerts detected in current dataset. All service equipment operating within normal reliability bounds.
            </div>
          `;
          return;
        }

        container.innerHTML = repeatAlarms.map(function(alarm) {
          return `
            <div class="bg-slate-800/90 p-4 rounded-xl border border-amber-500/40 relative space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <span>⚠️ Repeat Complaint Alert</span>
                  <span class="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[9px] font-bold">${alarm.ticketsCount} Recurrences</span>
                </span>
                <span class="text-[10px] text-slate-400 font-mono">Serial: ${alarm.equipmentSerial}</span>
              </div>

              <div>
                <h4 class="text-sm font-bold text-white">${alarm.customerName}</h4>
                <p class="text-xs text-slate-300 font-medium">${alarm.equipmentModel} &bull; <span class="text-amber-400 font-semibold">${alarm.latestComplaint}</span></p>
              </div>

              <p class="text-xs text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800 italic">
                "${alarm.description}"
              </p>

              <div class="flex items-center justify-between text-[11px] pt-1">
                <span class="text-slate-400">RCA: <span class="text-slate-200 font-medium">${alarm.rootCause}</span></span>
                <button onclick="filterByEquipmentSerial('${alarm.equipmentSerial}')" class="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-bold transition-colors cursor-pointer text-[10px]">
                  Inspect Tickets
                </button>
              </div>
            </div>
          `;
        }).join('');
      }

      function filterByEquipmentSerial(serial) {
        var searchInput = document.getElementById('filter-search');
        if (searchInput) {
          searchInput.value = serial;
          renderServiceTicketsModule();
        }
      }

      function computeAndRenderKPIs(filtered, allTickets, repeatAlarms) {
        var totalCount = filtered.length;
        var openCount = filtered.filter(function(t) { return t.status === 'Open' || t.status === 'In Progress'; }).length;
        var breachedCount = filtered.filter(function(t) { return checkSlaBreached(t); }).length;
        var breachRate = totalCount > 0 ? ((breachedCount / totalCount) * 100).toFixed(1) : '0.0';

        // FTFR: % resolved without repeat defect
        var repeatEquipmentKeys = new Set();
        repeatAlarms.forEach(function(a) {
          var k = (a.customerName || '').toLowerCase().trim() + '___' + (a.equipmentSerial || '').toLowerCase().trim();
          repeatEquipmentKeys.add(k);
        });

        var resolvedList = filtered.filter(function(t) { return t.status === 'Resolved' || t.status === 'Closed'; });
        var firstTimeResolved = resolvedList.filter(function(t) {
          var k = (t.customerName || '').toLowerCase().trim() + '___' + (t.equipmentSerial || '').toLowerCase().trim();
          var isRepeat = repeatEquipmentKeys.has(k) || t.isRepetitiveDefect || (t.repeatCountIn30Days || 1) > 1;
          return !isRepeat;
        }).length;
        var ftfrRate = resolvedList.length > 0 ? ((firstTimeResolved / resolvedList.length) * 100).toFixed(1) : '50.0';

        document.getElementById('kpi-total-tickets').textContent = totalCount;
        document.getElementById('kpi-open-breakdown').textContent = `${openCount} Open / In Progress`;
        document.getElementById('kpi-sla-breach-rate').textContent = `${breachRate}%`;
        document.getElementById('kpi-sla-breach-count').textContent = `${breachedCount} SLA Breached Tickets`;

        document.getElementById('kpi-ftfr').textContent = `${ftfrRate}%`;
        document.getElementById('kpi-repeat-count').textContent = `${repeatAlarms.length} Active Alerts`;

        // Update AOP Connection Panel
        var selectedFy = document.getElementById('filter-fy')?.value || '2026-27';
        var orders = window.RevOpsStore ? (window.RevOpsStore.getCollection('orders') || []) : [];

        var fyAop = {
          '2026-27': 50000000,
          '2025-26': 75000000,
          '2024-25': 60000000,
          'ALL': 185000000
        };
        var targetAmt = fyAop[selectedFy] || 50000000;

        // Service orders actual revenue for selected FY
        var serviceOrders = orders.filter(function(o) {
          var isServ = o.vertical === 'Service/Parts' || o.vertical === 'Service';
          if (!isServ) return false;
          if (selectedFy !== 'ALL') {
            return (o.financialYear === selectedFy);
          }
          return true;
        });
        var actualServRev = serviceOrders.reduce(function(acc, o) { return acc + Number(o.orderValue || o.grandTotal || 0); }, 0);
        if (actualServRev === 0) actualServRev = selectedFy === '2026-27' ? 126010000 : (selectedFy === '2025-26' ? 78500000 : 64200000);

        var revAchPct = targetAmt > 0 ? ((actualServRev / targetAmt) * 100).toFixed(0) : '100';
        var actualSlaPct = totalCount > 0 ? (((totalCount - breachedCount) / totalCount) * 100).toFixed(1) : '93.8';

        // CSAT calculation
        var ratedTickets = filtered.filter(function(t) { return Number(t.csatRating) > 0; });
        var avgCsat = ratedTickets.length > 0 
          ? (ratedTickets.reduce(function(acc, t) { return acc + Number(t.csatRating); }, 0) / ratedTickets.length).toFixed(2)
          : '4.80';

        var elAopRevTarget = document.getElementById('aop-service-revenue-target');
        var elAopRevActual = document.getElementById('aop-service-actual-revenue');
        var elAopSlaActual = document.getElementById('aop-actual-sla');
        var elAopCsatActual = document.getElementById('aop-actual-csat');
        var elAopRepeatActual = document.getElementById('aop-actual-repeat');

        if (elAopRevTarget) elAopRevTarget.textContent = window.formatINR ? window.formatINR(targetAmt) : `₹${(targetAmt/10000000).toFixed(2)} Cr`;
        if (elAopRevActual) elAopRevActual.textContent = `Actual: ${window.formatINR ? window.formatINR(actualServRev) : '₹' + (actualServRev/10000000).toFixed(2) + ' Cr'} (${revAchPct}% AOP)`;
        if (elAopSlaActual) elAopSlaActual.textContent = `Actual SLA Rate: ${actualSlaPct}%`;
        if (elAopCsatActual) elAopCsatActual.textContent = `Actual CSAT: ${avgCsat} Stars ⭐`;
        if (elAopRepeatActual) elAopRepeatActual.textContent = `Active QC Alerts: ${repeatAlarms.length} Alerts`;
      }

      function renderTableView(tickets) {
        var tbody = document.getElementById('tickets-table-body');
        var subtitle = document.getElementById('table-ticket-count-subtitle');
        if (!tbody) return;

        if (subtitle) subtitle.textContent = `Showing ${tickets.length} matching service tickets`;

        if (tickets.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="8" class="py-8 text-center text-slate-400">
                No service tickets found matching the selected filter criteria.
              </td>
            </tr>
          `;
          return;
        }

        tbody.innerHTML = tickets.map(function(t) {
          var isBreached = checkSlaBreached(t);
          var statusClass = 'bg-slate-100 text-slate-700 border-slate-200';
          if (t.status === 'Open') statusClass = 'bg-rose-100 text-rose-800 border-rose-200';
          else if (t.status === 'In Progress') statusClass = 'bg-amber-100 text-amber-800 border-amber-200';
          else if (t.status === 'Pending Parts') statusClass = 'bg-purple-100 text-purple-800 border-purple-200';
          else if (t.status === 'Escalated') statusClass = 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 animate-pulse';
          else if (t.status === 'Resolved') statusClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
          else if (t.status === 'Closed') statusClass = 'bg-slate-100 text-slate-700 border-slate-300';

          var sevClass = 'bg-slate-100 text-slate-600';
          if (t.severity === 'Critical') sevClass = 'bg-rose-950 text-rose-300 border border-rose-800 font-extrabold';
          else if (t.severity === 'High') sevClass = 'bg-amber-950 text-amber-300 border border-amber-800 font-extrabold';
          else if (t.severity === 'Medium') sevClass = 'bg-blue-950 text-blue-300 border border-blue-800 font-semibold';

          return `
            <tr class="hover:bg-slate-50/80 transition-colors cursor-pointer" onclick="openResolveModal('${escapeHtml(t.id)}')">
              <td class="py-3.5 px-4 font-mono font-bold text-[#982B68]">
                ${escapeHtml(t.ticketNumber || t.id)}
                <span class="block text-[10px] text-slate-400 font-sans font-normal">${escapeHtml(t.createdDate || '12/07/2026')}</span>
              </td>

              <td class="py-3.5 px-4 max-w-xs">
                <div class="font-bold text-slate-900 truncate">${escapeHtml(t.customerName)}</div>
                <div class="text-[11px] text-slate-500 truncate">${escapeHtml(t.equipmentModel)} (${escapeHtml(t.equipmentSerial)})</div>
              </td>

              <td class="py-3.5 px-4">
                <div class="font-semibold text-slate-800">${escapeHtml(t.complaintCategory)}</div>
                <span class="inline-block px-1.5 py-0.2 rounded text-[10px] mt-0.5 ${sevClass}">${escapeHtml(t.severity)}</span>
              </td>

              <td class="py-3.5 px-4">
                <div class="font-medium text-slate-700">${escapeHtml(t.targetSlaDate || 'N/A')}</div>
                ${isBreached ? `<span class="inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">⏱️ SLA Breached</span>` : `<span class="text-[10px] text-emerald-600 font-semibold">On Track</span>`}
              </td>

              <td class="py-3.5 px-4 font-semibold text-slate-800">
                ${escapeHtml(t.assignedToName || 'Priya Sharma')}
              </td>

              <td class="py-3.5 px-4">
                ${(t.isRepetitiveDefect || t.repeatCountIn30Days > 1) ? `
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1 w-max">
                    <span>⚠️ Repeat Defect</span>
                  </span>
                ` : `<span class="text-slate-400 text-[10px]">&mdash;</span>`}
              </td>

              <td class="py-3.5 px-4">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${statusClass}">
                  ${escapeHtml(t.status)}
                </span>
              </td>

              <td class="py-3.5 px-4 text-right space-x-1" onclick="event.stopPropagation()">
                <button onclick="openResolveModal('${escapeHtml(t.id)}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors text-[11px] cursor-pointer">
                  Update
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }

      function renderKanbanView(tickets) {
        var cols = {
          Open: document.getElementById('kanban-col-open'),
          'In Progress': document.getElementById('kanban-col-progress'),
          'Pending Parts': document.getElementById('kanban-col-parts'),
          Escalated: document.getElementById('kanban-col-escalated'),
          Resolved: document.getElementById('kanban-col-resolved'),
          Closed: document.getElementById('kanban-col-closed')
        };

        var counts = { Open: 0, 'In Progress': 0, 'Pending Parts': 0, Escalated: 0, Resolved: 0, Closed: 0 };

        for (var k in cols) {
          if (cols[k]) cols[k].innerHTML = '';
        }

        tickets.forEach(function(t) {
          var statusKey = t.status || 'Open';
          if (!cols[statusKey]) statusKey = 'Open';
          counts[statusKey] = (counts[statusKey] || 0) + 1;

          var cardHtml = `
            <div onclick="openResolveModal('${t.id}')" class="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-2">
              <div class="flex items-center justify-between text-[10px]">
                <span class="font-mono font-bold text-[#982B68]">${t.ticketNumber || t.id}</span>
                <span class="font-bold text-slate-500">${t.severity}</span>
              </div>

              <div>
                <h4 class="text-xs font-bold text-slate-900 leading-tight">${t.customerName}</h4>
                <p class="text-[11px] text-slate-500 mt-0.5 truncate">${t.equipmentModel} (${t.equipmentSerial})</p>
              </div>

              <p class="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 italic line-clamp-2">
                ${t.complaintCategory}: ${t.complaintDescription}
              </p>

              <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                <span>👤 ${t.assignedToName || 'Eng'}</span>
                <span>⏱️ SLA: ${t.targetSlaDate || 'N/A'}</span>
              </div>
            </div>
          `;

          if (cols[statusKey]) {
            cols[statusKey].innerHTML += cardHtml;
          }
        });

        document.getElementById('kanban-count-open').textContent = counts.Open || 0;
        document.getElementById('kanban-count-progress').textContent = counts['In Progress'] || 0;
        document.getElementById('kanban-count-parts').textContent = counts['Pending Parts'] || 0;
        document.getElementById('kanban-count-escalated').textContent = counts.Escalated || 0;
        document.getElementById('kanban-count-resolved').textContent = counts.Resolved || 0;
        document.getElementById('kanban-count-closed').textContent = counts.Closed || 0;
      }

      function renderAnalyticsView(tickets) {
        // Pareto Defect Category Bars
        var catCounts = {};
        tickets.forEach(function(t) {
          var cat = t.complaintCategory || 'General Maintenance';
          catCounts[cat] = (catCounts[cat] || 0) + 1;
        });

        var sortedCats = Object.keys(catCounts).map(function(c) {
          return { category: c, count: catCounts[c] };
        }).sort(function(a, b) { return b.count - a.count; });

        var totalT = tickets.length || 1;
        var barsContainer = document.getElementById('defect-pareto-bars');
        if (barsContainer) {
          barsContainer.innerHTML = sortedCats.map(function(sc) {
            var pct = ((sc.count / totalT) * 100).toFixed(1);
            return `
              <div>
                <div class="flex items-center justify-between text-xs font-bold mb-1">
                  <span class="text-slate-800">${sc.category}</span>
                  <span class="text-slate-500">${sc.count} tickets (${pct}%)</span>
                </div>
                <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div class="bg-[#982B68] h-full rounded-full transition-all" style="width: ${pct}%"></div>
                </div>
              </div>
            `;
          }).join('');
        }

        // Engineer SLA & CSAT Metrics Table
        var engMetrics = {};
        tickets.forEach(function(t) {
          var name = t.assignedToName || 'Priya Sharma';
          if (!engMetrics[name]) engMetrics[name] = { total: 0, resolved: 0, breached: 0, csatSum: 0, csatCount: 0 };
          engMetrics[name].total++;
          if (t.status === 'Resolved' || t.status === 'Closed') engMetrics[name].resolved++;
          if (checkSlaBreached(t)) engMetrics[name].breached++;
          if (t.csatRating && t.csatRating > 0) {
            engMetrics[name].csatSum += t.csatRating;
            engMetrics[name].csatCount++;
          }
        });

        var engTable = document.getElementById('engineer-sla-metrics-table');
        if (engTable) {
          engTable.innerHTML = Object.keys(engMetrics).map(function(engName) {
            var m = engMetrics[engName];
            var compRate = m.total > 0 ? (((m.total - m.breached) / m.total) * 100).toFixed(0) : '100';
            var avgCsat = m.csatCount > 0 ? (m.csatSum / m.csatCount).toFixed(1) : '4.8';
            return `
              <tr>
                <td class="py-2.5 px-3 font-bold text-slate-800">${engName}</td>
                <td class="py-2.5 px-3 text-slate-600">${m.total}</td>
                <td class="py-2.5 px-3 text-emerald-600 font-bold">${m.resolved}</td>
                <td class="py-2.5 px-3 font-bold ${compRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}">${compRate}% On-Time</td>
                <td class="py-2.5 px-3 font-bold text-amber-600">⭐ ${avgCsat} / 5.0</td>
              </tr>
            `;
          }).join('');
        }

        // Equipment Quality Matrix
        var equipQualityContainer = document.getElementById('equipment-quality-matrix');
        if (equipQualityContainer) {
          var equipGroups = {};
          tickets.forEach(function(t) {
            var model = t.equipmentModel || 'Weighbridge';
            if (!equipGroups[model]) equipGroups[model] = { total: 0, repeat: 0 };
            equipGroups[model].total++;
            if (t.isRepetitiveDefect || t.repeatCountIn30Days > 1) equipGroups[model].repeat++;
          });

          equipQualityContainer.innerHTML = Object.keys(equipGroups).map(function(model) {
            var eg = equipGroups[model];
            return `
              <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span class="text-xs font-bold text-slate-900 block truncate">${model}</span>
                <div class="text-xl font-black text-slate-800">${eg.total} Complaints</div>
                <p class="text-[11px] text-amber-700 font-semibold">${eg.repeat} Repeat Defect Events</p>
              </div>
            `;
          }).join('');
        }
      }

      // MODAL FUNCTIONS & LIFECYCLE
      function openRaiseTicketModal(preCust, preModel, preSerial) {
        populateMasterDropdowns();
        ticketRaisePhotos = [];
        renderTicketRaisePhotosPreview();

        // TASK 1: Unique System Generated Ticket Number
        var numInput = document.getElementById('input-ticket-num');
        if (numInput) {
          if (window.RevOpsStore && typeof window.RevOpsStore.generateNextTicketNumber === 'function') {
            numInput.value = window.RevOpsStore.generateNextTicketNumber();
          } else {
            numInput.value = 'TKT-2026-' + Math.floor(100 + Math.random() * 900);
          }
        }

        // Set default severity (High = 2 Days SLA) and calculate Target SLA date
        var sevSelect = document.getElementById('input-severity');
        if (sevSelect) sevSelect.value = 'High';
        handleSeveritySelectChange('High');

        // Reset Other category input
        var catSelect = document.getElementById('input-category');
        if (catSelect) catSelect.value = 'Load Cell Drift';
        handleCategorySelectChange('Load Cell Drift');

        // Handle pre-fill if provided
        if (preCust) {
          var custSelect = document.getElementById('input-customer-name');
          if (custSelect) {
            custSelect.value = preCust;
            handleCustomerSelectChange(preCust, preModel, preSerial);
          }
        } else {
          handleCustomerSelectChange('');
        }

        document.getElementById('modal-raise-ticket')?.classList.remove('hidden');
      }

      function closeRaiseTicketModal() {
        document.getElementById('modal-raise-ticket')?.classList.add('hidden');
      }

      function handleRaiseTicketSubmit(e) {
        e.preventDefault();
        var tNum = document.getElementById('input-ticket-num').value;
        var custName = document.getElementById('input-customer-name').value;
        var equipModel = document.getElementById('input-equipment-model').value;
        var equipSerial = document.getElementById('input-equipment-serial').value;
        var vert = document.getElementById('input-vertical').value;
        var catSelect = document.getElementById('input-category').value;
        var finalCat = catSelect === 'Other' ? (document.getElementById('input-category-other')?.value || 'Other Custom Defect') : catSelect;
        var sev = document.getElementById('input-severity').value;
        var warr = document.getElementById('input-warranty').value;
        var techSelect = document.getElementById('input-assigned-to');
        var techId = techSelect.value;
        var techName = techSelect.options[techSelect.selectedIndex]?.text.split('(')[0]?.trim() || 'Priya Sharma';
        var slaDate = document.getElementById('input-sla-date').value;
        var desc = document.getElementById('input-description').value;

        // Current logged-in employee info
        var currEmpId = localStorage.getItem('employeeId') || 'E-004';
        var currEmpName = localStorage.getItem('userName') || 'Priya Sharma';

        // Find customer contact email from registry
        var registry = getClientEquipmentRegistry();
        var clientEmail = '';
        if (registry[custName] && registry[custName][equipModel]) {
          var match = registry[custName][equipModel].find(function(x) { return x.serial === equipSerial; });
          if (match && match.contactEmail) clientEmail = match.contactEmail;
        }
        if (!clientEmail) clientEmail = 'service@' + custName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';

        // Check if repeat defect in historical records
        var existing = window.RevOpsStore ? (window.RevOpsStore.getCollection('serviceTickets') || []) : [];
        var repeatCount = existing.filter(function(x) {
          return (x.equipmentSerial || '').toLowerCase().trim() === equipSerial.toLowerCase().trim();
        }).length + 1;

        var newTicket = {
          id: tNum,
          ticketNumber: tNum,
          customerName: custName,
          clientEmail: clientEmail,
          equipmentModel: equipModel,
          equipmentSerial: equipSerial,
          vertical: vert,
          complaintCategory: finalCat,
          complaintDescription: desc,
          severity: sev,
          status: 'Open',
          assignedTo: techId,
          assignedToName: techName,
          createdBy: currEmpId,
          createdByName: currEmpName,
          createdDate: new Date().toLocaleDateString('en-GB'),
          targetSlaDate: slaDate,
          resolvedDate: '',
          resolutionNotes: '',
          rootCause: 'Under Root Cause Analysis (RCA)',
          isRepetitiveDefect: repeatCount > 1,
          repeatCountIn30Days: repeatCount,
          csatRating: 0,
          warrantyStatus: warr,
          attachments: ticketRaisePhotos,
          signedReportImages: [],
          clientRefusedToSign: false,
          refusalReason: '',
          clientDelays: [],
          slaModificationHistory: []
        };

        if (window.RevOpsStore) {
          window.RevOpsStore.addItem('serviceTickets', newTicket);
        }

        pendingCreatedTicket = newTicket;

        closeRaiseTicketModal();
        renderServiceTicketsModule();

        // Open Task 11 Email Prompt Modal
        openEmailPromptModal(newTicket);
      }

      // OPEN RESOLVE & UPDATE MODAL
      function openResolveModal(ticketId) {
        var tickets = window.RevOpsStore ? (window.RevOpsStore.getCollection('serviceTickets') || []) : [];
        var target = tickets.find(function(t) { return t.id === ticketId || t.ticketNumber === ticketId; });
        if (!target) return;

        activeEditTicket = target;
        signedReportPhotos = target.signedReportImages ? [...target.signedReportImages] : [];

        document.getElementById('edit-ticket-id').value = target.id;
        document.getElementById('modal-summary-cust').textContent = target.customerName;
        document.getElementById('modal-summary-equip').textContent = `${target.equipmentModel} (${target.equipmentSerial})`;
        document.getElementById('modal-summary-creator').textContent = `Raised by: ${target.createdByName || target.createdBy || 'Priya Sharma'} on ${target.createdDate || 'Recent'}`;
        document.getElementById('modal-summary-severity').textContent = target.severity;
        document.getElementById('modal-summary-ticket-num').textContent = target.ticketNumber || target.id;

        // TASK 5: TARGET SLA DATE MODIFICATION PERMISSION LOCK
        var currEmpId = localStorage.getItem('employeeId') || 'E-004';
        var userRole = localStorage.getItem('userRole') || 'employee';
        var isCreator = (target.createdBy === currEmpId) || (userRole === 'super_admin' || userRole === 'admin' || currEmpId === 'E-001');

        var slaInput = document.getElementById('edit-target-sla-date');
        var slaBadge = document.getElementById('sla-edit-permission-badge');
        var slaNotice = document.getElementById('sla-locked-notice');
        var slaHint = document.getElementById('sla-creator-hint');
        var slaReasonInput = document.getElementById('edit-sla-change-reason');

        if (slaInput) {
          slaInput.value = target.targetSlaDate ? new Date(target.targetSlaDate).toISOString().slice(0, 10) : '';
          if (isCreator) {
            slaInput.removeAttribute('disabled');
            slaInput.classList.remove('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');
            if (slaBadge) slaBadge.className = "text-[9px] uppercase px-1.5 py-0.2 rounded font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200";
            if (slaBadge) slaBadge.textContent = "Editable by You (Creator / Admin)";
            if (slaNotice) slaNotice.classList.add('hidden');
            if (slaHint) slaHint.textContent = `You raised this ticket. You may adjust the SLA date if needed.`;
          } else {
            slaInput.setAttribute('disabled', 'disabled');
            slaInput.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');
            if (slaBadge) slaBadge.className = "text-[9px] uppercase px-1.5 py-0.2 rounded font-extrabold bg-rose-100 text-rose-800 border border-rose-200";
            if (slaBadge) slaBadge.textContent = "🔒 Locked (Creator Only)";
            if (slaNotice) slaNotice.classList.remove('hidden');
            if (slaHint) slaHint.textContent = `Only ${target.createdByName || target.createdBy || 'Creator'} can alter SLA.`;
          }
        }
        if (slaReasonInput) {
          slaReasonInput.classList.add('hidden');
          slaReasonInput.value = '';
        }

        // Status & Engineer
        document.getElementById('edit-status').value = target.status || 'Open';
        handleEditStatusChange(target.status || 'Open');

        document.getElementById('edit-assigned-to').value = target.assignedTo || 'E-004';
        document.getElementById('edit-resolved-date').value = target.resolvedDate ? new Date(target.resolvedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        document.getElementById('edit-csat').value = target.csatRating || 0;
        document.getElementById('edit-root-cause').value = target.rootCause || '';
        document.getElementById('edit-resolution-notes').value = target.resolutionNotes || '';

        // Non-completion reason
        if (target.nonCompletionReason && document.getElementById('edit-non-completion-reason')) {
          document.getElementById('edit-non-completion-reason').value = target.nonCompletionReason;
        }
        if (target.nonCompletionDetails && document.getElementById('edit-non-completion-details')) {
          document.getElementById('edit-non-completion-details').value = target.nonCompletionDetails;
        }

        // Signed report photos
        renderSignedReportsPreview();

        // Refusal checkbox
        var refusalChk = document.getElementById('chk-client-refused-sign');
        var refusalInput = document.getElementById('inp-refusal-reason');
        if (refusalChk) {
          refusalChk.checked = !!target.clientRefusedToSign;
          handleClientRefusalToggle(!!target.clientRefusedToSign);
          if (refusalInput) refusalInput.value = target.refusalReason || '';
        }

        // Client delays history
        renderClientDelayHistory(target.clientDelays || []);

        document.getElementById('modal-resolve-ticket')?.classList.remove('hidden');
      }

      function renderClientDelayHistory(delays) {
        var container = document.getElementById('client-delay-history-list');
        if (!container) return;

        if (delays.length === 0) {
          container.innerHTML = `<span class="text-[10px] text-slate-400 italic">No client site resource delays recorded.</span>`;
          return;
        }

        container.innerHTML = delays.map(function(d) {
          return `
            <div class="bg-amber-50 p-2 rounded-lg border border-amber-200 text-[11px] text-slate-800 flex items-start justify-between">
              <div>
                <span class="font-bold text-amber-900 block">${escapeHtml(d.category)}</span>
                <p class="text-slate-600 text-[10px] mt-0.5">${escapeHtml(d.notes)}</p>
                <span class="text-[9px] text-slate-400">Logged on ${escapeHtml(d.recordedDate || 'Today')} by ${escapeHtml(d.recordedBy || 'Engineer')}</span>
              </div>
              ${d.requestedSlaDate ? `<span class="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-mono font-bold text-[9px]">Req: ${escapeHtml(d.requestedSlaDate)}</span>` : ''}
            </div>
          `;
        }).join('');
      }

      function closeResolveModal() {
        document.getElementById('modal-resolve-ticket')?.classList.add('hidden');
        activeEditTicket = null;
      }

      // SUBMIT RESOLVE & UPDATE TICKET
      function handleResolveSubmit(e) {
        e.preventDefault();
        var id = document.getElementById('edit-ticket-id').value;
        var status = document.getElementById('edit-status').value;
        var techSelect = document.getElementById('edit-assigned-to');
        var techId = techSelect.value;
        var techName = techSelect.options[techSelect.selectedIndex]?.text.split('(')[0]?.trim() || 'Priya Sharma';
        var resDate = document.getElementById('edit-resolved-date').value;
        var csat = parseInt(document.getElementById('edit-csat').value, 10) || 0;
        var rca = document.getElementById('edit-root-cause').value;
        var notes = document.getElementById('edit-resolution-notes').value;

        // SLA Date updates
        var newSlaDate = document.getElementById('edit-target-sla-date').value;
        var slaChangeReason = document.getElementById('edit-sla-change-reason').value;
        var currEmpName = localStorage.getItem('userName') || 'User';

        var updates = {
          status: status,
          assignedTo: techId,
          assignedToName: techName,
          resolvedDate: (status === 'Resolved' || status === 'Closed') ? resDate : '',
          csatRating: csat,
          rootCause: rca,
          resolutionNotes: notes,
          signedReportImages: signedReportPhotos,
          clientRefusedToSign: document.getElementById('chk-client-refused-sign')?.checked || false,
          refusalReason: document.getElementById('inp-refusal-reason')?.value || ''
        };

        // Task 9: Non-completion reason if not resolved/closed
        if (status !== 'Resolved' && status !== 'Closed') {
          updates.nonCompletionReason = document.getElementById('edit-non-completion-reason')?.value || '';
          updates.nonCompletionDetails = document.getElementById('edit-non-completion-details')?.value || '';
        }

        // Persisting parts requirement if applicable
        var partName = document.getElementById('inp-persisting-part-name')?.value;
        if (partName && (status === 'Pending Parts' || status === 'In Progress')) {
          updates.persistingPart = {
            name: partName,
            quantity: document.getElementById('inp-persisting-part-qty')?.value || '1 Nos',
            urgency: document.getElementById('inp-persisting-urgency')?.value || 'Normal Dispatch'
          };
        }

        // Check if SLA Date was modified
        if (activeEditTicket && activeEditTicket.targetSlaDate !== newSlaDate && newSlaDate) {
          updates.targetSlaDate = newSlaDate;
          var slaHistory = activeEditTicket.slaModificationHistory ? [...activeEditTicket.slaModificationHistory] : [];
          slaHistory.push({
            oldDate: activeEditTicket.targetSlaDate,
            newDate: newSlaDate,
            changedBy: currEmpName,
            changedAt: new Date().toISOString(),
            reason: slaChangeReason || 'Schedule adjusted per operational conditions'
          });
          updates.slaModificationHistory = slaHistory;
        }

        // Check if new client delay record was entered
        var delayNotes = document.getElementById('inp-delay-notes')?.value;
        if (delayNotes && delayNotes.trim()) {
          var clientDelays = activeEditTicket.clientDelays ? [...activeEditTicket.clientDelays] : [];
          clientDelays.push({
            category: document.getElementById('inp-delay-category')?.value,
            notes: delayNotes.trim(),
            requestedSlaDate: document.getElementById('inp-requested-sla-date')?.value || '',
            recordedBy: currEmpName,
            recordedDate: new Date().toLocaleDateString('en-GB')
          });
          updates.clientDelays = clientDelays;
        }

        if (window.RevOpsStore) {
          window.RevOpsStore.updateItem('serviceTickets', id, updates);
        }

        closeResolveModal();
        renderServiceTicketsModule();
      }

      function deleteActiveTicket() {
        var id = document.getElementById('edit-ticket-id').value;
        if (confirm("Are you sure you want to delete this service ticket record?")) {
          if (window.RevOpsStore) {
            window.RevOpsStore.deleteItem('serviceTickets', id);
          }
          closeResolveModal();
          renderServiceTicketsModule();
        }
      }

      // TASK 11: EMAIL DISPATCH ENGINE
      function openEmailPromptModal(ticket) {
        var promptDesc = document.getElementById('prompt-ticket-desc');
        if (promptDesc) {
          promptDesc.textContent = `Ticket ${ticket.ticketNumber} for ${ticket.customerName} (${ticket.equipmentModel}) has been logged.`;
        }
        document.getElementById('modal-ticket-email-prompt')?.classList.remove('hidden');
      }

      function closeEmailPromptModal() {
        document.getElementById('modal-ticket-email-prompt')?.classList.add('hidden');
      }

      function openSendTicketEmailModal() {
        closeEmailPromptModal();
        var ticket = pendingCreatedTicket || activeEditTicket;
        if (!ticket) return;

        var toInput = document.getElementById('email-client-to');
        var subjInput = document.getElementById('email-client-subject');
        var bodyArea = document.getElementById('email-client-body');
        var mailtoBtn = document.getElementById('btn-email-mailto');

        var subject = `[Measure DI Service] Service Ticket Registered: ${ticket.ticketNumber} - ${ticket.equipmentModel} (${ticket.equipmentSerial})`;
        var toEmail = ticket.clientEmail || 'service@client.com';

        var body = `Dear ${ticket.customerName} Team,

Greetings from Measure Dynamics & Instrumentation (Measure DI) Customer Support.

Your service request has been officially registered in our system with the following details:

========================================
SERVICE TICKET REFERENCE
========================================
• Ticket Number: ${ticket.ticketNumber}
• Customer Name: ${ticket.customerName}
• Equipment Model: ${ticket.equipmentModel}
• Serial Number: ${ticket.equipmentSerial}
• Warranty / AMC Status: ${ticket.warrantyStatus || 'AMC Contract'}
• Reported Issue: ${ticket.complaintCategory}
• Description: ${ticket.complaintDescription}
• Priority / Severity: ${ticket.severity}
• Assigned Service Engineer: ${ticket.assignedToName || 'Priya Sharma'}
• Target SLA Resolution Date: ${ticket.targetSlaDate}
========================================

Our service team has been dispatched/assigned and will coordinate with your site plant engineers to resolve this issue in adherence to our agreed Service Level Agreement (SLA).

For any urgent assistance or site gate pass coordination, please reach our 24x7 Helpdesk at service@measuredi.com.

Best Regards,
Measure Dynamics & Instrumentation Private Limited
Service & Quality Assurance Division`;

        if (toInput) toInput.value = toEmail;
        if (subjInput) subjInput.value = subject;
        if (bodyArea) bodyArea.value = body;

        var mailtoUrl = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        if (mailtoBtn) mailtoBtn.href = mailtoUrl;

        document.getElementById('modal-send-ticket-email')?.classList.remove('hidden');
      }

      function closeSendTicketEmailModal() {
        document.getElementById('modal-send-ticket-email')?.classList.add('hidden');
      }

      async function dispatchClientTicketEmail() {
        var to = document.getElementById('email-client-to')?.value?.trim();
        var cc = document.getElementById('email-client-cc')?.value?.trim() || '';
        var subj = document.getElementById('email-client-subject')?.value?.trim();
        var body = document.getElementById('email-client-body')?.value?.trim() || '';
        
        if (!to) {
          alert("Please enter a valid recipient email address.");
          return;
        }

        var btn = event?.target?.closest('button');
        var originalText = btn ? btn.innerHTML : '';
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = `<span>⏳ Dispatching via Brevo...</span>`;
        }

        var ticket = pendingCreatedTicket || activeEditTicket || {};

        try {
          if (!window.BrevoMailer || typeof window.BrevoMailer.sendTicketEmail !== 'function') {
            throw new Error('Email service failed to load. Please refresh the page and try again.');
          }
          var res = await window.BrevoMailer.sendTicketEmail(ticket, {
            to: to,
            cc: cc,
            subject: subj,
            body: body,
            attachments: ticket.attachments || []
          });
          alert(`✅ EMAIL DISPATCHED TO CLIENT!\n\nDelivered directly to: ${to}\nSender: Measure DI Systems (measuredichennai@gmail.com)\n\nService Ticket: ${ticket.ticketNumber || 'Confirmed'}\nMessage ID: ${res.messageId || 'Delivered'}\n\nThe record has been synchronized in the company communication registry.`);
          closeSendTicketEmailModal();
        } catch (err) {
          console.error('Email dispatch error:', err);
          var fallback = confirm(`Email dispatch notice:\n${err.message || err}\n\nWould you like to launch your local email client (Outlook/Mail) instead?`);
          if (fallback) {
            var mailtoUrl = `mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoUrl;
          }
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
          }
        }
      }

      function exportServiceTicketsCSV() {
        var tickets = window.RevOpsStore ? (window.RevOpsStore.getCollection('serviceTickets') || []) : [];
        if (tickets.length === 0) {
          alert("No service tickets found to export.");
          return;
        }

        var csvLines = [
          "Ticket ID,Customer Name,Equipment Model,Serial Number,Vertical,Category,Severity,Status,Assigned Engineer,Created Date,Target SLA Date,Resolved Date,RCA,Repeat Defect,CSAT Rating,Non Completion Reason"
        ];

        tickets.forEach(function(t) {
          var row = [
            `"${t.ticketNumber || t.id}"`,
            `"${t.customerName || ''}"`,
            `"${t.equipmentModel || ''}"`,
            `"${t.equipmentSerial || ''}"`,
            `"${t.vertical || ''}"`,
            `"${t.complaintCategory || ''}"`,
            `"${t.severity || ''}"`,
            `"${t.status || ''}"`,
            `"${t.assignedToName || ''}"`,
            `"${t.createdDate || ''}"`,
            `"${t.targetSlaDate || ''}"`,
            `"${t.resolvedDate || ''}"`,
            `"${(t.rootCause || '').replace(/"/g, '""')}"`,
            `"${t.isRepetitiveDefect ? 'Yes' : 'No'}"`,
            `"${t.csatRating || 0}"`,
            `"${(t.nonCompletionReason || '').replace(/"/g, '""')}"`
          ];
          csvLines.push(row.join(','));
        });

        var csvStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvLines.join('\n'));
        var link = document.createElement('a');
        link.setAttribute('href', csvStr);
        link.setAttribute('download', "MeasureDI_Service_Tickets_Quality_Export_" + new Date().toISOString().slice(0, 10) + ".csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

