var activeMasterTab = 'products';
    var parsedCsvData = [];

    document.addEventListener('DOMContentLoaded', function() {
      if (checkAuth(['admin', 'manager', 'staff'])) {
        initMasterHub();
      }
    });

    function initMasterHub() {
      updateTabBadges();
      switchMasterTab('products');
    }

    function updateTabBadges() {
      var prods = window.RevOpsStore.getCollection('productsMaster') || [];
      var equip = window.RevOpsStore.getCollection('clientEquipmentMaster') || [];
      var banks = window.RevOpsStore.getCollection('bankDetailsMaster') || [];
      var clients = window.RevOpsStore.getCollection('clientsMaster') || [];
      var projects = window.RevOpsStore.getCollection('projectsMaster') || [];

      document.getElementById('count-products').innerText = prods.length;
      document.getElementById('count-equipment').innerText = equip.length;
      document.getElementById('count-banks').innerText = banks.length;
      document.getElementById('count-clients').innerText = clients.length;
      document.getElementById('count-projects').innerText = projects.length;
    }

    function switchMasterTab(tabKey) {
      activeMasterTab = tabKey;
      
      document.querySelectorAll('.master-tab-btn').forEach(function(btn) {
        btn.classList.remove('active', 'bg-slate-900/90', 'border-indigo-500/60', 'shadow-lg', 'shadow-indigo-950/40');
        btn.classList.add('bg-slate-900/40', 'border-slate-800');
      });

      var activeBtn = document.getElementById('tab-btn-' + tabKey);
      if (activeBtn) {
        activeBtn.classList.remove('bg-slate-900/40', 'border-slate-800');
        activeBtn.classList.add('active', 'bg-slate-900/90', 'border-indigo-500/60', 'shadow-lg', 'shadow-indigo-950/40');
      }

      var vertFilter = document.getElementById('master-vertical-filter');
      if (tabKey === 'products') {
        vertFilter.classList.remove('hidden');
      } else {
        vertFilter.classList.add('hidden');
      }

      renderMasterTable();
    }

    function renderMasterTable() {
      var header = document.getElementById('master-table-header');
      var body = document.getElementById('master-table-body');
      var emptyState = document.getElementById('master-empty-state');
      var countLabel = document.getElementById('filtered-count-label');
      var searchQuery = (document.getElementById('master-search-input').value || '').toLowerCase();
      var vertFilter = document.getElementById('master-vertical-filter').value;

      header.innerHTML = '';
      body.innerHTML = '';

      var records = [];
      if (activeMasterTab === 'products') records = window.RevOpsStore.getCollection('productsMaster') || [];
      else if (activeMasterTab === 'equipment') records = window.RevOpsStore.getCollection('clientEquipmentMaster') || [];
      else if (activeMasterTab === 'banks') records = window.RevOpsStore.getCollection('bankDetailsMaster') || [];
      else if (activeMasterTab === 'clients') records = window.RevOpsStore.getCollection('clientsMaster') || [];
      else if (activeMasterTab === 'projects') records = window.RevOpsStore.getCollection('projectsMaster') || [];

      var filtered = records.filter(function(r) {
        if (activeMasterTab === 'products' && vertFilter !== 'all' && r.vertical !== vertFilter) {
          return false;
        }
        var fullStr = JSON.stringify(r).toLowerCase();
        return fullStr.includes(searchQuery);
      });

      countLabel.innerText = "Showing " + filtered.length + " records";

      if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
        return;
      }
      emptyState.classList.add('hidden');

      if (activeMasterTab === 'products') {
        header.innerHTML = `
          <tr>
            <th class="py-3 px-4">Vertical</th>
            <th class="py-3 px-4">Product Name</th>
            <th class="py-3 px-4">Unique Technical Specification</th>
            <th class="py-3 px-4 text-center">HSN Code</th>
            <th class="py-3 px-4 text-right">Standard Price (₹)</th>
            <th class="py-3 px-4 text-center">Actions</th>
          </tr>
        `;
        filtered.forEach(function(p) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-950 text-indigo-300 border border-indigo-800/60">${escapeHtml(p.vertical || 'Projects')}</span></td>
            <td class="py-3 px-4 font-bold text-white">${escapeHtml(p.productName || p.name)}</td>
            <td class="py-3 px-4 text-slate-300">${escapeHtml(p.technicalSpec || p.spec || '')}</td>
            <td class="py-3 px-4 text-center font-mono text-amber-400">${escapeHtml(p.hsnCode || p.hsn || '90318000')}</td>
            <td class="py-3 px-4 text-right font-black text-emerald-400">₹${Number(p.unitPrice || p.price || 0).toLocaleString('en-IN')}</td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${p.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
            </td>
          `;
          body.appendChild(tr);
        });
      } else if (activeMasterTab === 'equipment') {
        header.innerHTML = `
          <tr>
            <th class="py-3 px-4">Client / Organization</th>
            <th class="py-3 px-4">Equipment Model</th>
            <th class="py-3 px-4 font-mono">Serial Number</th>
            <th class="py-3 px-4">Site Location</th>
            <th class="py-3 px-4 text-center">Warranty / AMC Expiry</th>
            <th class="py-3 px-4 text-center">Actions</th>
          </tr>
        `;
        filtered.forEach(function(eq) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-white">${escapeHtml(eq.customerName)}</td>
            <td class="py-3 px-4 text-slate-200">${escapeHtml(eq.modelName || eq.equipmentModel)}</td>
            <td class="py-3 px-4 font-mono text-indigo-300">${escapeHtml(eq.serialNumber)}</td>
            <td class="py-3 px-4 text-slate-400">${escapeHtml(eq.location || eq.siteLocation || 'Plant')}</td>
            <td class="py-3 px-4 text-center text-amber-400 font-semibold">${escapeHtml(eq.warrantyExpiry || eq.amcExpiry || 'Active')}</td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${eq.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
            </td>
          `;
          body.appendChild(tr);
        });
      } else if (activeMasterTab === 'banks') {
        header.innerHTML = `
          <tr>
            <th class="py-3 px-4">Bank Name & Branch</th>
            <th class="py-3 px-4 font-mono">Account Number</th>
            <th class="py-3 px-4 font-mono text-center">IFSC Code</th>
            <th class="py-3 px-4 text-center">Account Type</th>
            <th class="py-3 px-4">Beneficiary Name</th>
            <th class="py-3 px-4 text-center">Actions</th>
          </tr>
        `;
        filtered.forEach(function(b) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-white">${escapeHtml(b.bankName)} <span class="text-slate-400 text-[10px] block">${escapeHtml(b.branch || 'Main Branch')}</span></td>
            <td class="py-3 px-4 font-mono text-indigo-300 font-bold">${escapeHtml(b.accountNumber)}</td>
            <td class="py-3 px-4 text-center font-mono text-amber-400">${escapeHtml(b.ifscCode)}</td>
            <td class="py-3 px-4 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">${escapeHtml(b.accountType || 'Current')}</span></td>
            <td class="py-3 px-4 text-slate-300">${escapeHtml(b.beneficiaryName || 'MEASURE DI TECHNOLOGIES')}</td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${b.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
            </td>
          `;
          body.appendChild(tr);
        });
      } else if (activeMasterTab === 'clients') {
        header.innerHTML = `
          <tr>
            <th class="py-3 px-4">Client Name</th>
            <th class="py-3 px-4 font-mono">GSTIN</th>
            <th class="py-3 px-4">Primary Contact</th>
            <th class="py-3 px-4">City / State</th>
            <th class="py-3 px-4 text-center">Actions</th>
          </tr>
        `;
        filtered.forEach(function(c) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-white">${escapeHtml(c.clientName || c.name)}</td>
            <td class="py-3 px-4 font-mono text-indigo-300">${escapeHtml(c.gstin || 'N/A')}</td>
            <td class="py-3 px-4 text-slate-300">${escapeHtml(c.contactPerson || '')} <span class="text-slate-500 text-[10px] block">${escapeHtml(c.email || c.phone || '')}</span></td>
            <td class="py-3 px-4 text-slate-400">${escapeHtml(c.city || 'India')}</td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${c.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
            </td>
          `;
          body.appendChild(tr);
        });
      } else if (activeMasterTab === 'projects') {
        header.innerHTML = `
          <tr>
            <th class="py-3 px-4 font-mono">Project Code</th>
            <th class="py-3 px-4">Project Name & Client</th>
            <th class="py-3 px-4">Vertical</th>
            <th class="py-3 px-4 text-right">Budget (₹)</th>
            <th class="py-3 px-4 text-center">Actions</th>
          </tr>
        `;
        filtered.forEach(function(pr) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-mono text-indigo-300 font-bold">${escapeHtml(pr.projectCode || pr.id)}</td>
            <td class="py-3 px-4 font-bold text-white">${escapeHtml(pr.projectName)} <span class="text-slate-400 text-[10px] block">${escapeHtml(pr.clientName || '')}</span></td>
            <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-950 text-indigo-300 border border-indigo-800/60">${escapeHtml(pr.vertical || 'Projects')}</span></td>
            <td class="py-3 px-4 text-right font-black text-emerald-400">₹${Number(pr.budget || 0).toLocaleString('en-IN')}</td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${pr.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
            </td>
          `;
          body.appendChild(tr);
        });
      }
    }

    function filterMasterTable() {
      renderMasterTable();
    }

    function openAddSingleModal(recordData) {
      var modal = document.getElementById('single-record-modal');
      var container = document.getElementById('dynamic-form-fields');
      document.getElementById('rec-doc-id').value = recordData ? recordData.id : '';

      var titles = {
        'products': 'Product & Technical Spec',
        'equipment': 'Client Installed Equipment',
        'banks': 'Company Bank Account',
        'clients': 'Client Organization',
        'projects': 'Turnkey Automation Project'
      };

      document.getElementById('single-modal-title').innerHTML = `<i class="fa-solid fa-database text-indigo-400"></i> <span>${recordData ? 'Edit' : 'Add'} ${titles[activeMasterTab]}</span>`;
      container.innerHTML = '';

      if (activeMasterTab === 'products') {
        var d = recordData || {};
        container.innerHTML = `
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Vertical Classification *</label>
            <select id="inp-rec-vertical" required class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-semibold text-white">
              <option value="Projects" ${d.vertical === 'Projects' ? 'selected' : ''}>Projects</option>
              <option value="Onboard" ${d.vertical === 'Onboard' ? 'selected' : ''}>Onboard</option>
              <option value="Crane" ${d.vertical === 'Crane' ? 'selected' : ''}>Crane</option>
              <option value="Service and Parts" ${d.vertical === 'Service and Parts' ? 'selected' : ''}>Service and Parts</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Product Name *</label>
            <input type="text" id="inp-rec-name" required value="${escapeHtml(d.productName || d.name || '')}" placeholder="e.g. Dynamic In-Motion Train Weigher (IMW-500)" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Unique Technical Specification *</label>
            <textarea id="inp-rec-spec" required rows="2" placeholder="e.g. 200T Capacity, High-Speed Pitless, Metrology Grade Accuracy 0.2%" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white">${escapeHtml(d.technicalSpec || d.spec || '')}</textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">HSN Code *</label>
              <input type="text" id="inp-rec-hsn" required value="${escapeHtml(d.hsnCode || d.hsn || '90318000')}" placeholder="90318000" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Base Price (₹)</label>
              <input type="number" id="inp-rec-price" value="${d.unitPrice || d.price || 0}" placeholder="4500000" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-bold text-white" />
            </div>
          </div>
        `;
      } else if (activeMasterTab === 'equipment') {
        var d = recordData || {};
        container.innerHTML = `
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Customer / Organization Name *</label>
            <input type="text" id="inp-rec-customer" required value="${escapeHtml(d.customerName || '')}" placeholder="JSW Steel Limited" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Equipment Model *</label>
              <input type="text" id="inp-rec-model" required value="${escapeHtml(d.modelName || d.equipmentModel || '')}" placeholder="IMW-500 Train Weigher" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Serial Number *</label>
              <input type="text" id="inp-rec-serial" required value="${escapeHtml(d.serialNumber || '')}" placeholder="SN-2025-IMW-099" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono text-white" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Site / Plant Location</label>
              <input type="text" id="inp-rec-loc" value="${escapeHtml(d.location || d.siteLocation || '')}" placeholder="Toranagallu, Vijayanagar" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Warranty / AMC Expiry</label>
              <input type="date" id="inp-rec-expiry" value="${d.warrantyExpiry || d.amcExpiry || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
          </div>
        `;
      } else if (activeMasterTab === 'banks') {
        var d = recordData || {};
        container.innerHTML = `
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Bank Name *</label>
            <input type="text" id="inp-rec-bank" required value="${escapeHtml(d.bankName || '')}" placeholder="HDFC Bank Ltd" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Account Number *</label>
              <input type="text" id="inp-rec-acnum" required value="${escapeHtml(d.accountNumber || '')}" placeholder="50200088992211" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">IFSC Code *</label>
              <input type="text" id="inp-rec-ifsc" required value="${escapeHtml(d.ifscCode || '')}" placeholder="HDFC0001234" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono uppercase text-white" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Branch Name</label>
              <input type="text" id="inp-rec-branch" value="${escapeHtml(d.branch || '')}" placeholder="Anna Nagar, Chennai" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Beneficiary Name</label>
              <input type="text" id="inp-rec-bene" value="${escapeHtml(d.beneficiaryName || 'MEASURE DI TECHNOLOGIES')}" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
          </div>
        `;
      } else if (activeMasterTab === 'clients') {
        var d = recordData || {};
        container.innerHTML = `
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Client / Company Name *</label>
            <input type="text" id="inp-rec-clname" required value="${escapeHtml(d.clientName || d.name || '')}" placeholder="Tata Steel Limited" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">GSTIN</label>
              <input type="text" id="inp-rec-clgst" value="${escapeHtml(d.gstin || '')}" placeholder="33AAAAA0000A1Z5" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono uppercase text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">City / Location</label>
              <input type="text" id="inp-rec-clcity" value="${escapeHtml(d.city || '')}" placeholder="Jamshedpur" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Contact Person</label>
              <input type="text" id="inp-rec-clcontact" value="${escapeHtml(d.contactPerson || '')}" placeholder="Mr. Rajesh" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Email</label>
              <input type="email" id="inp-rec-clemail" value="${escapeHtml(d.email || '')}" placeholder="procurement@tatasteel.com" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
          </div>
        `;
      } else if (activeMasterTab === 'projects') {
        var d = recordData || {};
        container.innerHTML = `
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Project Name *</label>
            <input type="text" id="inp-rec-prjname" required value="${escapeHtml(d.projectName || '')}" placeholder="JSW Slag Yard RFID Dynamic Weigher" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Project Code *</label>
              <input type="text" id="inp-rec-prjcode" required value="${escapeHtml(d.projectCode || '')}" placeholder="PRJ-JSW-09" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Client Name</label>
              <input type="text" id="inp-rec-prjclient" value="${escapeHtml(d.clientName || '')}" placeholder="JSW Steel Ltd" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Vertical</label>
              <select id="inp-rec-prjvertical" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white">
                <option value="Projects">Projects</option>
                <option value="Onboard">Onboard</option>
                <option value="Crane">Crane</option>
                <option value="Service and Parts">Service and Parts</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Total Budget (₹)</label>
              <input type="number" id="inp-rec-prjbudget" value="${d.budget || 0}" placeholder="2800000" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-bold text-white" />
            </div>
          </div>
        `;
      }

      modal.classList.remove('hidden');
    }

    function closeSingleModal() {
      document.getElementById('single-record-modal').classList.add('hidden');
    }

    function editMasterRecord(id) {
      var records = [];
      if (activeMasterTab === 'products') records = window.RevOpsStore.getCollection('productsMaster') || [];
      else if (activeMasterTab === 'equipment') records = window.RevOpsStore.getCollection('clientEquipmentMaster') || [];
      else if (activeMasterTab === 'banks') records = window.RevOpsStore.getCollection('bankDetailsMaster') || [];
      else if (activeMasterTab === 'clients') records = window.RevOpsStore.getCollection('clientsMaster') || [];
      else if (activeMasterTab === 'projects') records = window.RevOpsStore.getCollection('projectsMaster') || [];

      var r = records.find(function(item) { return item.id === id; });
      if (r) openAddSingleModal(r);
    }

    function handleSaveSingleRecord(e) {
      e.preventDefault();
      var docId = document.getElementById('rec-doc-id').value;

      var colName = 'productsMaster';
      var recordObj = {};

      if (activeMasterTab === 'products') {
        colName = 'productsMaster';
        recordObj = {
          id: docId || ('prod_' + Date.now()),
          vertical: document.getElementById('inp-rec-vertical').value,
          productName: document.getElementById('inp-rec-name').value.trim(),
          name: document.getElementById('inp-rec-name').value.trim(),
          technicalSpec: document.getElementById('inp-rec-spec').value.trim(),
          spec: document.getElementById('inp-rec-spec').value.trim(),
          hsnCode: document.getElementById('inp-rec-hsn').value.trim(),
          hsn: document.getElementById('inp-rec-hsn').value.trim(),
          unitPrice: Number(document.getElementById('inp-rec-price').value) || 0,
          price: Number(document.getElementById('inp-rec-price').value) || 0
        };
      } else if (activeMasterTab === 'equipment') {
        colName = 'clientEquipmentMaster';
        recordObj = {
          id: docId || ('equip_' + Date.now()),
          customerName: document.getElementById('inp-rec-customer').value.trim(),
          modelName: document.getElementById('inp-rec-model').value.trim(),
          equipmentModel: document.getElementById('inp-rec-model').value.trim(),
          serialNumber: document.getElementById('inp-rec-serial').value.trim(),
          location: document.getElementById('inp-rec-loc').value.trim(),
          siteLocation: document.getElementById('inp-rec-loc').value.trim(),
          warrantyExpiry: document.getElementById('inp-rec-expiry').value
        };
      } else if (activeMasterTab === 'banks') {
        colName = 'bankDetailsMaster';
        recordObj = {
          id: docId || ('bank_' + Date.now()),
          bankName: document.getElementById('inp-rec-bank').value.trim(),
          accountNumber: document.getElementById('inp-rec-acnum').value.trim(),
          ifscCode: document.getElementById('inp-rec-ifsc').value.trim().toUpperCase(),
          branch: document.getElementById('inp-rec-branch').value.trim(),
          beneficiaryName: document.getElementById('inp-rec-bene').value.trim(),
          accountType: 'Current Account'
        };
      } else if (activeMasterTab === 'clients') {
        colName = 'clientsMaster';
        recordObj = {
          id: docId || ('client_' + Date.now()),
          clientName: document.getElementById('inp-rec-clname').value.trim(),
          name: document.getElementById('inp-rec-clname').value.trim(),
          gstin: document.getElementById('inp-rec-clgst').value.trim().toUpperCase(),
          city: document.getElementById('inp-rec-clcity').value.trim(),
          contactPerson: document.getElementById('inp-rec-clcontact').value.trim(),
          email: document.getElementById('inp-rec-clemail').value.trim()
        };
      } else if (activeMasterTab === 'projects') {
        colName = 'projectsMaster';
        recordObj = {
          id: docId || ('prj_' + Date.now()),
          projectName: document.getElementById('inp-rec-prjname').value.trim(),
          projectCode: document.getElementById('inp-rec-prjcode').value.trim(),
          clientName: document.getElementById('inp-rec-prjclient').value.trim(),
          vertical: document.getElementById('inp-rec-prjvertical').value,
          budget: Number(document.getElementById('inp-rec-prjbudget').value) || 0
        };
      }

      window.RevOpsStore.saveRecord(colName, recordObj);

      if (window.RevOpsStore.logAudit) {
        window.RevOpsStore.logAudit(
          'MasterData',
          recordObj.id,
          docId ? 'UPDATE' : 'CREATE',
          (docId ? 'Updated ' : 'Created ') + colName + ' entry',
          null,
          recordObj
        );
      }

      closeSingleModal();
      updateTabBadges();
      renderMasterTable();
    }

    function openBulkUploadModal() {
      var modal = document.getElementById('bulk-upload-modal');
      var label = document.getElementById('bulk-modal-target-label');
      label.innerText = 'Importing dataset into ' + activeMasterTab.toUpperCase() + ' Master';
      document.getElementById('bulk-csv-input').value = '';
      document.getElementById('bulk-preview-container').classList.add('hidden');
      parsedCsvData = [];

      var input = document.getElementById('bulk-csv-input');
      input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function(evt) {
          parseCSV(evt.target.result);
        };
        reader.readAsText(file);
      };

      modal.classList.remove('hidden');
    }

    function closeBulkUploadModal() {
      document.getElementById('bulk-upload-modal').classList.add('hidden');
    }

    function parseCSV(text) {
      var lines = text.split(/\r\n|\n/).filter(function(l) { return l.trim().length > 0; });
      if (lines.length <= 1) {
        alert("CSV file does not contain enough data rows.");
        return;
      }

      var headers = lines[0].split(',').map(function(h) { return h.trim().replace(/^"|"$/g, ''); });
      parsedCsvData = [];

      for (var i = 1; i < lines.length; i++) {
        var values = lines[i].split(',').map(function(v) { return v.trim().replace(/^"|"$/g, ''); });
        var rowObj = {};
        headers.forEach(function(h, idx) {
          rowObj[h] = values[idx] !== undefined ? values[idx] : '';
        });
        parsedCsvData.push(rowObj);
      }

      document.getElementById('bulk-preview-container').classList.remove('hidden');
      document.getElementById('bulk-preview-count').innerText = parsedCsvData.length;
      document.getElementById('bulk-preview-text').innerText = JSON.stringify(parsedCsvData.slice(0, 5), null, 2) + (parsedCsvData.length > 5 ? '\n...and ' + (parsedCsvData.length - 5) + ' more records' : '');
    }

    function executeBulkUpload() {
      if (parsedCsvData.length === 0) {
        alert("Please select and parse a valid CSV file first.");
        return;
      }

      var colName = 'productsMaster';
      if (activeMasterTab === 'products') colName = 'productsMaster';
      else if (activeMasterTab === 'equipment') colName = 'clientEquipmentMaster';
      else if (activeMasterTab === 'banks') colName = 'bankDetailsMaster';
      else if (activeMasterTab === 'clients') colName = 'clientsMaster';
      else if (activeMasterTab === 'projects') colName = 'projectsMaster';

      var existing = window.RevOpsStore.getCollection(colName) || [];

      parsedCsvData.forEach(function(row) {
        var newDoc = Object.assign({}, row, {
          id: row.id || (activeMasterTab + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4))
        });
        existing.push(newDoc);
      });

      window.RevOpsStore.saveCollection(colName, existing);

      if (window.RevOpsStore.logAudit) {
        window.RevOpsStore.logAudit(
          'MasterData',
          'BULK_CSV',
          'IMPORT',
          'Bulk uploaded ' + parsedCsvData.length + ' records into ' + colName,
          null,
          { count: parsedCsvData.length }
        );
      }

      alert("Successfully imported " + parsedCsvData.length + " records into " + colName + "!");
      closeBulkUploadModal();
      updateTabBadges();
      renderMasterTable();
    }

    function downloadActiveTemplate() {
      var csvContent = "";
      var filename = activeMasterTab + "_template.csv";

      if (activeMasterTab === 'products') {
        csvContent = "vertical,productName,technicalSpec,hsnCode,unitPrice\n" +
                     "Projects,Dynamic In-Motion Train Weigher (IMW-500),200T High Speed Pitless 0.2% Accuracy,90318000,4500000\n" +
                     "Onboard,Onboard Tipper Weighing Scale (OTW-30T),Wireless Axle Load Weigher,84238900,480000\n" +
                     "Crane,Wireless Crane Scale 50T (CS-50W),IP67 Cast Alloy Handheld RF Terminal,84238900,240000\n" +
                     "Service and Parts,50-Ton Shear Beam Load Cell (SP-LC-50T),Stainless Steel IP68 3mV/V Class C3,90318000,45000\n";
      } else if (activeMasterTab === 'equipment') {
        csvContent = "customerName,modelName,serialNumber,location,warrantyExpiry\n" +
                     "JSW Steel Limited,IMW-500 Train Weigher,SN-2025-IMW-099,Vijayanagar Plant,2027-03-31\n" +
                     "Tata Steel Limited,ASW-2000 Slag Yard Weigher,SN-2024-ASW-042,Kalinganagar Plant,2026-12-31\n";
      } else if (activeMasterTab === 'banks') {
        csvContent = "bankName,accountNumber,ifscCode,branch,beneficiaryName,accountType\n" +
                     "HDFC Bank Ltd,50200088992211,HDFC0001234,Anna Nagar Chennai,MEASURE DI TECHNOLOGIES,Current Account\n";
      } else if (activeMasterTab === 'clients') {
        csvContent = "clientName,gstin,city,contactPerson,email,phone\n" +
                     "JSW Steel Limited,29AAACJ1011A1Z2,Ballari,Mr. Rajesh,rajesh@jsw.in,9840112233\n";
      } else if (activeMasterTab === 'projects') {
        csvContent = "projectCode,projectName,clientName,vertical,budget\n" +
                     "PRJ-JSW-09,JSW Slag Yard RFID Dynamic Weigher,JSW Steel Limited,Projects,2800000\n";
      }

      var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement("a");
      var url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function exportCurrentMasterCSV() {
      var records = [];
      if (activeMasterTab === 'products') records = window.RevOpsStore.getCollection('productsMaster') || [];
      else if (activeMasterTab === 'equipment') records = window.RevOpsStore.getCollection('clientEquipmentMaster') || [];
      else if (activeMasterTab === 'banks') records = window.RevOpsStore.getCollection('bankDetailsMaster') || [];
      else if (activeMasterTab === 'clients') records = window.RevOpsStore.getCollection('clientsMaster') || [];
      else if (activeMasterTab === 'projects') records = window.RevOpsStore.getCollection('projectsMaster') || [];

      if (records.length === 0) {
        alert("No records to export.");
        return;
      }

      var headers = Object.keys(records[0]);
      var csvRows = [headers.join(',')];

      records.forEach(function(r) {
        var vals = headers.map(function(h) {
          var val = r[h] !== undefined && r[h] !== null ? String(r[h]) : '';
          return '"' + val.replace(/"/g, '""') + '"';
        });
        csvRows.push(vals.join(','));
      });

      var blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement("a");
      var url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", activeMasterTab + "_export_" + Date.now() + ".csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
