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

      // Master data entry is restricted to Super Admin / Admin roles only
      // — everyone signed in can still view these lists, but only those
      // two roles can add/edit/delete/bulk-upload. Enforced for real
      // server-side in firestore.rules; this just keeps the UI honest
      // about what will actually be allowed.
      if (!canEditMasterData()) {
        var addBtn = document.getElementById('btn-add-record');
        var bulkBtn = document.getElementById('btn-bulk-upload');
        var notice = document.getElementById('master-readonly-notice');
        if (addBtn) addBtn.classList.add('hidden');
        if (bulkBtn) bulkBtn.classList.add('hidden');
        if (notice) notice.classList.remove('hidden');
      } else {
        // Go-Live "Clear Demo Data" is Super Admin / Admin only, same gate
        // as every other master-data write action.
        var dangerZone = document.getElementById('go-live-danger-zone');
        if (dangerZone) dangerZone.classList.remove('hidden');
      }
    }

    function canEditMasterData() {
      var role = localStorage.getItem('userRole');
      return role === 'super_admin' || role === 'admin';
    }

    function updateTabBadges() {
      var prods = window.RevOpsStore.getCollection('productsMaster') || [];
      var equip = window.RevOpsStore.getCollection('clientEquipmentMaster') || [];
      var banks = window.RevOpsStore.getCollection('bankDetailsMaster') || [];
      var clients = window.RevOpsStore.getCollection('clientsMaster') || [];
      var projects = window.RevOpsStore.getCollection('projectsMaster') || [];
      var leadSources = window.RevOpsStore.getCollection('leadSourceMaster') || [];
      var industryVerticals = window.RevOpsStore.getCollection('industryVerticalMaster') || [];
      var projectSectors = window.RevOpsStore.getCollection('projectSectorMaster') || [];
      var verticalClass = window.RevOpsStore.getCollection('verticalClassificationMaster') || [];
      var currencies = window.RevOpsStore.getCollection('currencyMaster') || [];
      var sparePartCats = window.RevOpsStore.getCollection('sparePartCategoryMaster') || [];
      var complaintCats = window.RevOpsStore.getCollection('complaintCategoryMaster') || [];
      var slaPolicies = window.RevOpsStore.getCollection('slaResponseTierMaster') || [];
      var amcTiers = window.RevOpsStore.getCollection('amcContractTierMaster') || [];
      var pmFreqs = window.RevOpsStore.getCollection('pmVisitFrequencyMaster') || [];
      var amcMilestones = window.RevOpsStore.getCollection('amcInvoicingMilestoneMaster') || [];
      var contractDurations = window.RevOpsStore.getCollection('amcContractDurationMaster') || [];
      var companies = window.RevOpsStore.getCollection('companyMaster') || [];

      document.getElementById('count-products').innerText = prods.length;
      document.getElementById('count-equipment').innerText = equip.length;
      document.getElementById('count-banks').innerText = banks.length;
      document.getElementById('count-clients').innerText = clients.length;
      document.getElementById('count-projects').innerText = projects.length;
      document.getElementById('count-leadsources').innerText = leadSources.length;
      document.getElementById('count-industryverticals').innerText = industryVerticals.length;
      document.getElementById('count-projectsectors').innerText = projectSectors.length;
      document.getElementById('count-verticalclass').innerText = verticalClass.length;
      document.getElementById('count-currencies').innerText = currencies.length;
      document.getElementById('count-sparepartcategories').innerText = sparePartCats.length;
      document.getElementById('count-complaintcategories').innerText = complaintCats.length;
      document.getElementById('count-slapolicy').innerText = slaPolicies.length;
      document.getElementById('count-amctiers').innerText = amcTiers.length;
      document.getElementById('count-pmfrequency').innerText = pmFreqs.length;
      document.getElementById('count-amcmilestones').innerText = amcMilestones.length;
      document.getElementById('count-contractdurations').innerText = contractDurations.length;
      var companiesCountEl = document.getElementById('count-companies');
      if (companiesCountEl) companiesCountEl.innerText = companies.length;
    }

    // Simple name-only master lists (Lead Source, Industry Vertical, Project
    // Sector, Vertical Classification) all share the same collection shape
    // ({ id, name, isActive }), so their table/form config is centralized here.
    var SIMPLE_MASTER_TABS = {
      leadsources: { collection: 'leadSourceMaster', label: 'Lead Source', idPrefix: 'lsrc' },
      industryverticals: { collection: 'industryVerticalMaster', label: 'Industry Vertical', idPrefix: 'ivert' },
      projectsectors: { collection: 'projectSectorMaster', label: 'Project Sector / Origin', idPrefix: 'psect' },
      verticalclass: { collection: 'verticalClassificationMaster', label: 'Vertical Classification', idPrefix: 'vclass' },
      sparepartcategories: { collection: 'sparePartCategoryMaster', label: 'Spare Part Category', idPrefix: 'spcat' },
      complaintcategories: { collection: 'complaintCategoryMaster', label: 'Complaint / Fault Category', idPrefix: 'ccat' },
      amctiers: { collection: 'amcContractTierMaster', label: 'AMC Contract Tier', idPrefix: 'amctier' },
      pmfrequency: { collection: 'pmVisitFrequencyMaster', label: 'PM Visit Frequency', idPrefix: 'pmfreq' },
      amcmilestones: { collection: 'amcInvoicingMilestoneMaster', label: 'AMC Invoicing Milestone', idPrefix: 'amcmile' },
      contractdurations: { collection: 'amcContractDurationMaster', label: 'Contract Duration', idPrefix: 'cdur' }
    };

    function masterCollectionNameForTab(tabKey) {
      if (tabKey === 'products') return 'productsMaster';
      if (tabKey === 'equipment') return 'clientEquipmentMaster';
      if (tabKey === 'banks') return 'bankDetailsMaster';
      if (tabKey === 'clients') return 'clientsMaster';
      if (tabKey === 'projects') return 'projectsMaster';
      if (tabKey === 'currencies') return 'currencyMaster';
      if (tabKey === 'slapolicy') return 'slaResponseTierMaster';
      if (tabKey === 'companies') return 'companyMaster';
      if (SIMPLE_MASTER_TABS[tabKey]) return SIMPLE_MASTER_TABS[tabKey].collection;
      return null;
    }

    function getMasterRecordsForTab(tabKey) {
      var colName = masterCollectionNameForTab(tabKey);
      return colName ? (window.RevOpsStore.getCollection(colName) || []) : [];
    }

    // Builds <option> tags from a master list collection, for use inside
    // other forms (e.g. Industry Vertical / Project Sector / Vertical
    // Classification dropdowns on the Products form).
    function optionsHtmlForMaster(collectionName, selectedValue) {
      var items = (window.RevOpsStore.getCollection(collectionName) || []).filter(function(it) { return it.isActive !== false; });
      return items.map(function(it) {
        return `<option value="${escapeHtml(it.name)}" ${it.name === selectedValue ? 'selected' : ''}>${escapeHtml(it.name)}</option>`;
      }).join('');
    }

    function deleteMasterRecord(id) {
      if (!canEditMasterData()) {
        alert("Only Super Admin or Admin can delete master records.");
        return;
      }
      var colName = masterCollectionNameForTab(activeMasterTab);
      if (!colName) return;
      if (!confirm("Delete this master record? This cannot be undone, and any place that already references it (existing leads, quotes, orders, invoices) will keep the value it already has.")) return;
      window.RevOpsStore.deleteItem(colName, id);
      updateTabBadges();
      renderMasterTable();
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
      records = getMasterRecordsForTab(activeMasterTab);

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
              <button onclick="deleteMasterRecord('${p.id}')" class="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-lg ml-1"><i class="fa-solid fa-trash-can"></i></button>
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
            <td class="py-3 px-4 text-center text-amber-400 font-semibold">${escapeHtml(eq.warrantyExpiry || eq.amcExpiry || eq.expiryDate || 'Active')}</td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${eq.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteMasterRecord('${eq.id}')" class="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-lg ml-1"><i class="fa-solid fa-trash-can"></i></button>
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
              <button onclick="deleteMasterRecord('${b.id}')" class="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-lg ml-1"><i class="fa-solid fa-trash-can"></i></button>
            </td>
          `;
          body.appendChild(tr);
        });
      } else if (activeMasterTab === 'companies') {
        header.innerHTML = `
          <tr>
            <th class="py-3 px-4">Company</th>
            <th class="py-3 px-4">Legal / Trade Name</th>
            <th class="py-3 px-4 font-mono text-center">GSTIN</th>
            <th class="py-3 px-4">Registered Address</th>
            <th class="py-3 px-4 text-center">Actions</th>
          </tr>
        `;
        filtered.forEach(function(c) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-white">${escapeHtml(c.name)} <span class="text-slate-400 text-[10px] block">${escapeHtml(c.constitution || '')}</span></td>
            <td class="py-3 px-4 text-slate-300">${escapeHtml(c.tradeName || c.legalName || '')}</td>
            <td class="py-3 px-4 text-center font-mono text-amber-400">${escapeHtml(c.gstin || '')}</td>
            <td class="py-3 px-4 text-slate-400 text-[11px]">${escapeHtml(c.address || '')}</td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${c.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteMasterRecord('${c.id}')" class="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-lg ml-1"><i class="fa-solid fa-trash-can"></i></button>
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
            <td class="py-3 px-4 text-slate-300">${escapeHtml(c.contactPerson || '')} <span class="text-slate-500 text-[10px] block">${escapeHtml([c.phone, c.email].filter(Boolean).join(' • '))}</span></td>
            <td class="py-3 px-4 text-slate-400">${escapeHtml(c.city || 'India')}</td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${c.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteMasterRecord('${c.id}')" class="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-lg ml-1"><i class="fa-solid fa-trash-can"></i></button>
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
              <button onclick="deleteMasterRecord('${pr.id}')" class="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-lg ml-1"><i class="fa-solid fa-trash-can"></i></button>
            </td>
          `;
          body.appendChild(tr);
        });
      } else if (activeMasterTab === 'currencies') {
        header.innerHTML = `
          <tr>
            <th class="py-3 px-4 font-mono">Code</th>
            <th class="py-3 px-4">Currency Name</th>
            <th class="py-3 px-4 text-center">Symbol</th>
            <th class="py-3 px-4 text-center">Actions</th>
          </tr>
        `;
        filtered.forEach(function(cu) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-mono font-bold text-indigo-300">${escapeHtml(cu.code || '')}</td>
            <td class="py-3 px-4 font-bold text-white">${escapeHtml(cu.name || '')}</td>
            <td class="py-3 px-4 text-center text-emerald-400 font-black">${escapeHtml(cu.symbol || '')}</td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${cu.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteMasterRecord('${cu.id}')" class="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-lg ml-1"><i class="fa-solid fa-trash-can"></i></button>
            </td>
          `;
          body.appendChild(tr);
        });
      } else if (activeMasterTab === 'slapolicy') {
        header.innerHTML = `
          <tr>
            <th class="py-3 px-4">Severity Level</th>
            <th class="py-3 px-4 text-center">Target Response Window</th>
            <th class="py-3 px-4">Description</th>
            <th class="py-3 px-4 text-center">Status</th>
            <th class="py-3 px-4 text-center">Actions</th>
          </tr>
        `;
        filtered.forEach(function(s) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-white">${escapeHtml(s.name || '')}</td>
            <td class="py-3 px-4 text-center font-black text-rose-400">${escapeHtml(s.slaWindow || (s.slaDays !== undefined && s.slaDays !== null ? (s.slaDays === 0 ? 'Same Day' : s.slaDays + (s.slaDays === 1 ? ' Day' : ' Days')) : ''))}</td>
            <td class="py-3 px-4 text-slate-400 text-[11px]">${escapeHtml(s.description || '')}</td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.isActive === false ? 'bg-slate-800 text-slate-400' : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'}">${s.isActive === false ? 'Inactive' : 'Active'}</span>
            </td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${s.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteMasterRecord('${s.id}')" class="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-lg ml-1"><i class="fa-solid fa-trash-can"></i></button>
            </td>
          `;
          body.appendChild(tr);
        });
      } else if (SIMPLE_MASTER_TABS[activeMasterTab]) {
        var simpleLabel = SIMPLE_MASTER_TABS[activeMasterTab].label;
        header.innerHTML = `
          <tr>
            <th class="py-3 px-4">${escapeHtml(simpleLabel)}</th>
            <th class="py-3 px-4 text-center">Status</th>
            <th class="py-3 px-4 text-center">Actions</th>
          </tr>
        `;
        filtered.forEach(function(item) {
          var tr = document.createElement('tr');
          tr.className = "hover:bg-slate-800/40 transition-colors";
          tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-white">${escapeHtml(item.name || '')}</td>
            <td class="py-3 px-4 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.isActive === false ? 'bg-slate-800 text-slate-400' : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'}">${item.isActive === false ? 'Inactive' : 'Active'}</span>
            </td>
            <td class="py-3 px-4 text-center">
              <button onclick="editMasterRecord('${item.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteMasterRecord('${item.id}')" class="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 rounded-lg ml-1"><i class="fa-solid fa-trash-can"></i></button>
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
      if (!canEditMasterData()) {
        alert("Only Super Admin or Admin can add or edit master records.");
        return;
      }
      var modal = document.getElementById('single-record-modal');
      var container = document.getElementById('dynamic-form-fields');
      document.getElementById('rec-doc-id').value = recordData ? recordData.id : '';

      var titles = {
        'products': 'Product & Technical Spec',
        'equipment': 'Client Installed Equipment',
        'banks': 'Company Bank Account',
        'clients': 'Client Organization',
        'projects': 'Turnkey Automation Project',
        'currencies': 'Currency',
        'slapolicy': 'SLA Response Policy',
        'companies': 'Company (Legal Entity)'
      };
      Object.keys(SIMPLE_MASTER_TABS).forEach(function(k) { titles[k] = SIMPLE_MASTER_TABS[k].label; });

      document.getElementById('single-modal-title').innerHTML = `<i class="fa-solid fa-database text-indigo-400"></i> <span>${recordData ? 'Edit' : 'Add'} ${titles[activeMasterTab]}</span>`;
      container.innerHTML = '';

      if (activeMasterTab === 'products') {
        var d = recordData || {};
        container.innerHTML = `
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Industry Vertical</label>
              <select id="inp-rec-industryvertical" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-semibold text-white">
                <option value="">-- Any --</option>
                ${optionsHtmlForMaster('verticalClassificationMaster', d.industryVertical)}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Project Sector / Origin</label>
              <select id="inp-rec-projectsector" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-semibold text-white">
                <option value="">-- Any --</option>
                ${optionsHtmlForMaster('projectSectorMaster', d.projectSector)}
              </select>
            </div>
          </div>
          <p class="text-[10px] text-slate-400">Industry Vertical + Project Sector determine which products appear on the Add Lead form. Leave either as "Any" to make this product available regardless of that field.</p>
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Vertical Classification *</label>
            <select id="inp-rec-vertical" required class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-semibold text-white">
              ${optionsHtmlForMaster('verticalClassificationMaster', d.vertical)}
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
              <input type="date" id="inp-rec-expiry" value="${d.warrantyExpiry || d.amcExpiry || d.expiryDate || ''}" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
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
      } else if (activeMasterTab === 'companies') {
        var d = recordData || {};
        container.innerHTML = `
          <p class="text-[10px] text-slate-400 -mt-1 mb-1">Selected once on a Lead / Service Lead and carried through every downstream document - name, GSTIN, address and logo shown here appear on every Quotation, Order, Invoice, Service Ticket and AMC document raised under this company.</p>
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Display Name *</label>
            <input type="text" id="inp-rec-coname" required value="${escapeHtml(d.name || '')}" placeholder="e.g. Measure DI" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Trade Name (shown on documents) *</label>
              <input type="text" id="inp-rec-cotrade" required value="${escapeHtml(d.tradeName || '')}" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">GSTIN *</label>
              <input type="text" id="inp-rec-cogstin" required value="${escapeHtml(d.gstin || '')}" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono uppercase text-white" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Legal Name (as per GST registration) *</label>
            <input type="text" id="inp-rec-colegal" required value="${escapeHtml(d.legalName || '')}" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Registered Address *</label>
            <textarea id="inp-rec-coaddr" required rows="2" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white">${escapeHtml(d.address || '')}</textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Constitution</label>
              <input type="text" id="inp-rec-coconst" value="${escapeHtml(d.constitution || '')}" placeholder="Private Limited Company / Proprietorship" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Proprietor Name (if applicable)</label>
              <input type="text" id="inp-rec-coprop" value="${escapeHtml(d.proprietorName || '')}" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Document Number Code *</label>
              <input type="text" id="inp-rec-conumcode" required maxlength="6" value="${escapeHtml(d.numberCode || '')}" placeholder="e.g. MDI, ADI" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono uppercase text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Logo Path</label>
              <input type="text" id="inp-rec-cologo" value="${escapeHtml(d.logoPath || '')}" placeholder="/img/logo-xxx.jpg" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono text-white" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">CIN (if applicable)</label>
              <input type="text" id="inp-rec-cocin" value="${escapeHtml(d.cin || '')}" placeholder="Corporate Identity Number, if incorporated" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono uppercase text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Print Signatory Title</label>
              <input type="text" id="inp-rec-cosigtitle" value="${escapeHtml(d.signatoryTitle || '')}" placeholder="Managing Director & CEO / Proprietor" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Print Signatory Name</label>
            <input type="text" id="inp-rec-cosigname" value="${escapeHtml(d.signatoryName || '')}" placeholder="Name shown under the signature on Quotations/Invoices" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
          </div>
          <p class="text-[10px] text-slate-500">Document Number Code prefixes this company's own Lead/Quotation/Order/Invoice number series, so the two companies never share or collide on numbering. Logo Path is the image file already placed in the app (ask your developer to add a new one for any company beyond these two).</p>
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
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Contact Phone / Mobile</label>
              <input type="text" id="inp-rec-clphone" value="${escapeHtml(d.phone || '')}" placeholder="9840112233" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Email</label>
            <input type="email" id="inp-rec-clemail" value="${escapeHtml(d.email || '')}" placeholder="procurement@tatasteel.com" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
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
                ${optionsHtmlForMaster('verticalClassificationMaster', d.vertical)}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Total Budget (₹)</label>
              <input type="number" id="inp-rec-prjbudget" value="${d.budget || 0}" placeholder="2800000" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-bold text-white" />
            </div>
          </div>
        `;
      } else if (activeMasterTab === 'currencies') {
        var d = recordData || {};
        container.innerHTML = `
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Code *</label>
              <input type="text" id="inp-rec-curcode" required maxlength="3" value="${escapeHtml(d.code || '')}" placeholder="INR" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-mono uppercase text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Name *</label>
              <input type="text" id="inp-rec-curname" required value="${escapeHtml(d.name || '')}" placeholder="Indian Rupee" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Symbol *</label>
              <input type="text" id="inp-rec-cursymbol" required value="${escapeHtml(d.symbol || '')}" placeholder="₹" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs font-bold text-white" />
            </div>
          </div>
        `;
      } else if (activeMasterTab === 'slapolicy') {
        var d = recordData || {};
        container.innerHTML = `
          <div class="p-2.5 bg-rose-950/30 border border-rose-800/50 rounded-xl text-[11px] text-rose-200">
            Shared by the Service Ticket severity dropdown (and its due-date calculation), AMC Monitoring's "SLA Breakdown Response", and AMC Quotes' "Target Breakdown Response SLA" — editing this changes it everywhere at once.
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Severity Level Name *</label>
              <input type="text" id="inp-rec-slaname" required value="${escapeHtml(d.name || '')}" placeholder="Critical" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Target Response (Days) *</label>
              <input type="number" id="inp-rec-sladays" required min="0" step="1" value="${d.slaDays !== undefined && d.slaDays !== null ? d.slaDays : ''}" placeholder="0 = same day" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Description / When to Use</label>
            <input type="text" id="inp-rec-sladesc" value="${escapeHtml(d.description || '')}" placeholder="Plant-stopping breakdown / safety-critical — emergency callout." class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
          </div>
          <div>
            <label class="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" id="inp-rec-slaactive" ${d.isActive === false ? '' : 'checked'} class="w-4 h-4" />
              <span class="text-xs font-semibold text-slate-300">Active (uncheck to hide from dropdowns without deleting it)</span>
            </label>
          </div>
        `;
      } else if (SIMPLE_MASTER_TABS[activeMasterTab]) {
        var d = recordData || {};
        var simpleLabel = SIMPLE_MASTER_TABS[activeMasterTab].label;
        container.innerHTML = `
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">${escapeHtml(simpleLabel)} Name *</label>
            <input type="text" id="inp-rec-simplename" required value="${escapeHtml(d.name || '')}" placeholder="e.g. ${escapeHtml(simpleLabel)}" class="w-full px-3 py-2 bg-slate-950 border border-slate-750 rounded-xl text-xs text-white" />
          </div>
          <div>
            <label class="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" id="inp-rec-simpleactive" ${d.isActive === false ? '' : 'checked'} class="w-4 h-4" />
              <span class="text-xs font-semibold text-slate-300">Active (uncheck to hide from dropdowns without deleting it)</span>
            </label>
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
      records = getMasterRecordsForTab(activeMasterTab);

      var r = records.find(function(item) { return item.id === id; });
      if (r) openAddSingleModal(r);
    }

    function handleSaveSingleRecord(e) {
      e.preventDefault();
      if (!canEditMasterData()) {
        alert("Only Super Admin or Admin can save master records.");
        return;
      }
      var docId = document.getElementById('rec-doc-id').value;

      var colName = 'productsMaster';
      var recordObj = {};

      if (activeMasterTab === 'products') {
        colName = 'productsMaster';
        recordObj = {
          id: docId || ('prod_' + Date.now()),
          vertical: document.getElementById('inp-rec-vertical').value,
          industryVertical: document.getElementById('inp-rec-industryvertical').value || '',
          projectSector: document.getElementById('inp-rec-projectsector').value || '',
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
          warrantyExpiry: document.getElementById('inp-rec-expiry').value,
          // Warranty Management reads expiryDate specifically for its
          // countdown/status badge — keep it in sync with this same field.
          expiryDate: document.getElementById('inp-rec-expiry').value
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
      } else if (activeMasterTab === 'companies') {
        colName = 'companyMaster';
        recordObj = {
          id: docId || ('company_' + Date.now()),
          name: document.getElementById('inp-rec-coname').value.trim(),
          tradeName: document.getElementById('inp-rec-cotrade').value.trim(),
          legalName: document.getElementById('inp-rec-colegal').value.trim(),
          gstin: document.getElementById('inp-rec-cogstin').value.trim().toUpperCase(),
          address: document.getElementById('inp-rec-coaddr').value.trim(),
          constitution: document.getElementById('inp-rec-coconst').value.trim(),
          proprietorName: document.getElementById('inp-rec-coprop').value.trim(),
          numberCode: document.getElementById('inp-rec-conumcode').value.trim().toUpperCase(),
          logoPath: document.getElementById('inp-rec-cologo').value.trim(),
          cin: document.getElementById('inp-rec-cocin').value.trim().toUpperCase(),
          signatoryTitle: document.getElementById('inp-rec-cosigtitle').value.trim(),
          signatoryName: document.getElementById('inp-rec-cosigname').value.trim()
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
          phone: document.getElementById('inp-rec-clphone').value.trim(),
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
      } else if (activeMasterTab === 'currencies') {
        colName = 'currencyMaster';
        recordObj = {
          id: docId || ('currencyMaster_' + Date.now()),
          code: document.getElementById('inp-rec-curcode').value.trim().toUpperCase(),
          name: document.getElementById('inp-rec-curname').value.trim(),
          symbol: document.getElementById('inp-rec-cursymbol').value.trim(),
          isActive: true
        };
      } else if (activeMasterTab === 'slapolicy') {
        colName = 'slaResponseTierMaster';
        var slaDaysVal = Number(document.getElementById('inp-rec-sladays').value) || 0;
        recordObj = {
          id: docId || ('sla_' + Date.now()),
          name: document.getElementById('inp-rec-slaname').value.trim(),
          slaDays: slaDaysVal,
          slaWindow: slaDaysVal === 0 ? 'Same Day' : (slaDaysVal + (slaDaysVal === 1 ? ' Day' : ' Days')),
          description: document.getElementById('inp-rec-sladesc').value.trim(),
          isActive: document.getElementById('inp-rec-slaactive').checked
        };
      } else if (SIMPLE_MASTER_TABS[activeMasterTab]) {
        colName = SIMPLE_MASTER_TABS[activeMasterTab].collection;
        recordObj = {
          id: docId || (SIMPLE_MASTER_TABS[activeMasterTab].idPrefix + '_' + Date.now()),
          name: document.getElementById('inp-rec-simplename').value.trim(),
          isActive: document.getElementById('inp-rec-simpleactive').checked
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
      if (!canEditMasterData()) {
        alert("Only Super Admin or Admin can bulk-upload master records.");
        return;
      }
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

    // RFC 4180-aware CSV tokenizer: splitting each line on a plain comma
    // (the old approach) silently shifts every column out of place the
    // moment a field contains a comma of its own - e.g. an address like
    // "Anna Nagar, Chennai" or a spec like "200T, High-Speed". This walks
    // the raw text character-by-character so a quoted field can safely
    // contain commas, escaped quotes (""), and even embedded line breaks
    // (Excel/Sheets produce exactly this for a multi-line cell), while an
    // unquoted field is taken literally exactly as before. Returns an
    // array of rows, each row an array of field strings.
    // Thin wrapper kept so every existing call site (and this page's own
    // regression tests) can keep calling the page-global parseCSVRows()
    // - the actual RFC 4180 tokenizer lives once in RevOpsStore, shared
    // with the Data Center's own bulk-upload parser in auth-guard.js.
    function parseCSVRows(text) {
      return window.RevOpsStore.parseCSVRows(text);
    }

    function parseCSV(text) {
      var rows = parseCSVRows(text);
      if (rows.length <= 1) {
        alert("CSV file does not contain enough data rows.");
        return;
      }

      var headers = rows[0].map(function(h) { return h.trim(); });
      parsedCsvData = [];

      for (var i = 1; i < rows.length; i++) {
        var values = rows[i];
        var rowObj = {};
        headers.forEach(function(h, idx) {
          rowObj[h] = values[idx] !== undefined ? values[idx].trim() : '';
        });
        parsedCsvData.push(rowObj);
      }

      document.getElementById('bulk-preview-container').classList.remove('hidden');
      document.getElementById('bulk-preview-count').innerText = parsedCsvData.length;
      document.getElementById('bulk-preview-text').innerText = JSON.stringify(parsedCsvData.slice(0, 5), null, 2) + (parsedCsvData.length > 5 ? '\n...and ' + (parsedCsvData.length - 5) + ' more records' : '');
    }

    function executeBulkUpload() {
      if (!canEditMasterData()) {
        alert("Only Super Admin or Admin can bulk-upload master records.");
        return;
      }
      if (parsedCsvData.length === 0) {
        alert("Please select and parse a valid CSV file first.");
        return;
      }

      if (SIMPLE_MASTER_TABS[activeMasterTab] || activeMasterTab === 'currencies' || activeMasterTab === 'slapolicy' || activeMasterTab === 'companies') {
        alert("Bulk CSV upload isn't available for this category yet — these are small lists, please add records one at a time using \"+ Add Master Record\".");
        return;
      }

      var colName = masterCollectionNameForTab(activeMasterTab);
      if (!colName) {
        alert("Bulk CSV upload isn't available for this category.");
        return;
      }

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

    // Builds the "# ALLOWED VALUES FOR ..." legend lines a fresh template
    // Thin wrapper - the actual legend builder lives once in RevOpsStore,
    // shared with the Data Center's own template downloads.
    function buildDropdownLegendLines(fieldLegends) {
      return window.RevOpsStore.buildDropdownLegendLines(fieldLegends);
    }

    function downloadActiveTemplate() {
      if (SIMPLE_MASTER_TABS[activeMasterTab] || activeMasterTab === 'slapolicy' || activeMasterTab === 'companies') {
        alert("These are small lists maintained directly in the app — there's no CSV template for this category. Use \"+ Add Master Record\" instead.");
        return;
      }

      var csvContent = "";
      var filename = activeMasterTab + "_template.csv";
      var legendLines = [];

      if (activeMasterTab === 'products') {
        legendLines = buildDropdownLegendLines([{ column: 'vertical', collectionName: 'verticalClassificationMaster' }]);
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
        legendLines = buildDropdownLegendLines([{ column: 'vertical', collectionName: 'verticalClassificationMaster' }]);
        csvContent = "projectCode,projectName,clientName,vertical,budget\n" +
                     "PRJ-JSW-09,JSW Slag Yard RFID Dynamic Weigher,JSW Steel Limited,Projects,2800000\n";
      }

      if (legendLines.length > 0) {
        csvContent = legendLines.join('\n') + '\n' + csvContent;
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
      records = getMasterRecordsForTab(activeMasterTab);

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

    // ---- Go-Live: Clear Demo Data ----
    // Deliberately gated by canEditMasterData() again here (not just the
    // button's own hidden state at page load) - a role switch mid-session
    // shouldn't leave this reachable from a stale DOM state.
    function openClearDemoDataModal() {
      if (!canEditMasterData()) {
        alert("Only Super Admin or Admin can clear demo data.");
        return;
      }
      document.getElementById('inp-clear-demo-confirm').value = '';
      document.getElementById('clear-demo-data-confirm-view').classList.remove('hidden');
      document.getElementById('clear-demo-data-progress-view').classList.add('hidden');
      document.getElementById('clear-demo-data-done-view').classList.add('hidden');
      document.getElementById('clear-demo-data-modal').classList.remove('hidden');
    }

    function closeClearDemoDataModal() {
      document.getElementById('clear-demo-data-modal').classList.add('hidden');
    }

    function executeClearDemoData() {
      if (!canEditMasterData()) {
        alert("Only Super Admin or Admin can clear demo data.");
        return;
      }
      var typed = document.getElementById('inp-clear-demo-confirm').value.trim();
      if (typed !== 'DELETE DEMO DATA') {
        alert('Please type "DELETE DEMO DATA" exactly (case-sensitive) to confirm.');
        return;
      }

      document.getElementById('clear-demo-data-confirm-view').classList.add('hidden');
      document.getElementById('clear-demo-data-progress-view').classList.remove('hidden');

      var total = (window.RevOpsStore.DEMO_DATA_COLLECTIONS || []).length;
      window.RevOpsStore.clearDummyDataForGoLive(function(colName, index, totalCount) {
        document.getElementById('clear-demo-progress-text').innerText = 'Clearing ' + colName + '… (' + index + ' / ' + totalCount + ')';
        document.getElementById('clear-demo-progress-bar').style.width = Math.round((index / totalCount) * 100) + '%';
      }).then(function(results) {
        document.getElementById('clear-demo-data-progress-view').classList.add('hidden');
        document.getElementById('clear-demo-data-done-view').classList.remove('hidden');
        document.getElementById('clear-demo-done-summary').innerText =
          'Cleared ' + results.cleared.length + ' collection(s) locally' +
          (window.RevOpsStore.isFirebaseAvailable() ? ' and deleted ' + results.firestoreDeleted + ' document(s) from Firestore.' : ' (Firestore not connected in this session - local only).') +
          ' The app is ready for your real bulk data upload.';
        if (results.errors && results.errors.length > 0) {
          var errBox = document.getElementById('clear-demo-done-errors');
          errBox.classList.remove('hidden');
          errBox.innerText = 'Some Firestore deletions failed and may need a retry:\n' + results.errors.join('\n');
        }
        updateTabBadges();
        renderMasterTable();
      }).catch(function(err) {
        document.getElementById('clear-demo-data-progress-view').classList.add('hidden');
        document.getElementById('clear-demo-data-done-view').classList.remove('hidden');
        document.getElementById('clear-demo-done-summary').innerText = 'Something went wrong partway through - check the browser console for details. Safe to re-run; already-cleared collections will simply clear again (no harm done).';
        console.error('clearDummyDataForGoLive failed:', err);
      });
    }
