// js/store.js - Measure DI RevOps Global Store & Real-time Synchronization Engine

window.RevOpsStore = window.RevOpsStore || {};

Object.assign(window.RevOpsStore, {
  isFirebaseAvailable: function() {
    return typeof window.db !== 'undefined' && window.db !== null && typeof window.db.collection === 'function';
  },

  reseedAllData: function() {
    console.log("Force re-seeding complete RevOps dataset...");
    var collections = ['employees', 'kraTargets', 'aopTargets', 'orders', 'dwmActivities', 'attendance', 'leads', 'payments', 'reviews', 'expenses', 'projectsMaster', 'clientsMaster', 'sparePartsMaster', 'productsMaster', 'bankDetailsMaster', 'clientEquipmentMaster', 'auditLogs', 'expenseSplits', 'travelPolicyMaster', 'travelApprovals', 'budgets', 'serviceTickets', 'quotations', 'invoices'];
    collections.forEach(function(c) { localStorage.removeItem(c); });
    localStorage.removeItem('revops_seeded_v17');
    localStorage.removeItem('revops_seeded_v18');
    localStorage.removeItem('revops_seeded_v19');
    localStorage.removeItem('revops_seeded_v21');
    localStorage.removeItem('revops_seeded_v24');
    localStorage.removeItem('revops_seeded_v25');
    localStorage.removeItem('revops_seeded_v26');
    localStorage.removeItem('revops_seeded_v27');
    localStorage.removeItem('revops_seeded_v28');
    if (window.RevOpsStore.initSeedData) {
      window.RevOpsStore.initSeedData();
    }
    if (window.RevOpsStore.isFirebaseAvailable()) {
      window.RevOpsStore.syncAllToFirestore();
    }
    alert("Success! Re-seeded RevOps data across all collections.");
    window.location.reload();
  },

  syncAllToFirestore: function() {
    if (!window.db) return;
    console.log("Syncing data to Firebase Firestore...");
    var collections = ['employees', 'kraTargets', 'aopTargets', 'orders', 'dwmActivities', 'attendance', 'leads', 'payments', 'reviews', 'expenses', 'projectsMaster', 'clientsMaster', 'sparePartsMaster', 'productsMaster', 'bankDetailsMaster', 'clientEquipmentMaster', 'auditLogs', 'expenseSplits', 'travelPolicyMaster', 'travelApprovals', 'budgets', 'serviceTickets', 'quotations', 'invoices'];
    collections.forEach(function(colName) {
      var items = window.RevOpsStore.getCollection(colName) || [];
      items.forEach(function(item) {
        var docId = item.id || (colName + '_' + Math.random().toString(36).substr(2, 9));
        window.db.collection(colName).doc(docId).set(item, { merge: true }).catch(function(err) {
          console.warn("Firestore sync error for " + colName + ":", err);
        });
      });
    });
  },

  // Universal Audit Trail Logger (Strictly Director & Super Admin viewable)
  logAudit: function(module, docId, action, summary, oldValue, newValue) {
    try {
      var empId = (typeof localStorage !== 'undefined') ? (localStorage.getItem('employeeId') || 'E-001') : 'E-001';
      var empName = (typeof localStorage !== 'undefined') ? (localStorage.getItem('userName') || 'System User') : 'System User';
      var empRole = (typeof localStorage !== 'undefined') ? (localStorage.getItem('userRole') || 'super_admin') : 'super_admin';
      
      var auditEntry = {
        id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        timestamp: new Date().toISOString(),
        formattedDate: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        employeeId: empId,
        employeeName: empName,
        employeeRole: empRole,
        module: module || 'General',
        docId: docId || 'N/A',
        action: action || 'UPDATE', // CREATE, UPDATE, DELETE, APPROVE, REJECT, DISPATCH
        summary: summary || (action + ' on ' + module + ' (' + docId + ')'),
        oldValue: (oldValue !== undefined && oldValue !== null) ? (typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue)) : null,
        newValue: (newValue !== undefined && newValue !== null) ? (typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue)) : null
      };

      var logs = this.getCollection('auditLogs') || [];
      logs.unshift(auditEntry);
      // Keep latest 2000 log entries
      if (logs.length > 2000) logs = logs.slice(0, 2000);
      this.saveCollection('auditLogs', logs);

      if (this.isFirebaseAvailable()) {
        window.db.collection('auditLogs').doc(auditEntry.id).set(auditEntry).catch(function(err) {
          console.warn("Firestore audit log error:", err);
        });
      }
      return auditEntry;
    } catch(e) {
      console.warn("logAudit error:", e);
      return null;
    }
  },

  getCollection: function(colName) {
    try {
      var raw = localStorage.getItem(colName);
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  },

  saveCollection: function(colName, items) {
    try {
      localStorage.setItem(colName, JSON.stringify(items));
      return true;
    } catch(e) {
      console.error("localStorage.setItem failed for " + colName + ":", e);
      return false;
    }
  },

  setCollection: function(colName, items) {
    return this.saveCollection(colName, items);
  },

  showSyncWarningBanner: function(msg) {
    var message = msg || "Saved locally, but couldn't reach the server";
    var banner = document.getElementById('sync-warning-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'sync-warning-banner';
      banner.className = 'fixed top-16 right-4 z-50 p-4 rounded-xl bg-amber-500/90 border border-amber-400 text-slate-900 text-xs font-bold shadow-2xl flex items-center space-x-2 transition-all duration-300';
      banner.innerHTML = '<svg class="w-4 h-4 text-slate-900 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg><span id="sync-warning-banner-text">' + message + '</span>';
      document.body.appendChild(banner);
    } else {
      var textEl = document.getElementById('sync-warning-banner-text');
      if (textEl) textEl.innerText = message;
      banner.classList.remove('hidden');
    }
    setTimeout(function() {
      if (banner) banner.classList.add('hidden');
    }, 4000);
  },

  saveRecord: function(colName, record) {
    if (!record || typeof record !== 'object') return Promise.resolve({ record: null, synced: false });
    var sanitized = this.sanitizeRecord(record);
    if (!sanitized.id) {
      sanitized.id = colName.substring(0, 3) + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    }

    var items = this.getCollection(colName);
    var index = items.findIndex(function(it) { return it.id === sanitized.id || it.docId === sanitized.id; });
    if (index >= 0) {
      items[index] = Object.assign({}, items[index], sanitized);
    } else {
      items.push(sanitized);
    }
    this.saveCollection(colName, items);

    if (this.isFirebaseAvailable()) {
      try {
        var self = this;
        return window.db.collection(colName).doc(sanitized.id).set(sanitized, { merge: true })
          .then(function() {
            return { record: sanitized, synced: true };
          })
          .catch(function(err) {
            console.error("Firestore saveRecord error for " + colName + "/" + sanitized.id + ":", err);
            self.showSyncWarningBanner();
            return { record: sanitized, synced: false };
          });
      } catch (e) {
        console.error("Exception in saveRecord for " + colName + ":", e);
        this.showSyncWarningBanner();
        return Promise.resolve({ record: sanitized, synced: false });
      }
    }
    this.showSyncWarningBanner();
    return Promise.resolve({ record: sanitized, synced: false });
  },

  deleteRecord: function(colName, id) {
    var items = this.getCollection(colName);
    var filtered = items.filter(function(it) {
      return it.id !== id && it.docId !== id;
    });
    this.saveCollection(colName, filtered);

    if (this.isFirebaseAvailable()) {
      try {
        var self = this;
        return window.db.collection(colName).doc(id).delete()
          .then(function() {
            return { id: id, synced: true };
          })
          .catch(function(err) {
            console.error("Firestore deleteRecord error for " + colName + "/" + id + ":", err);
            self.showSyncWarningBanner();
            return { id: id, synced: false };
          });
      } catch (e) {
        console.error("Exception in deleteRecord for " + colName + ":", e);
        this.showSyncWarningBanner();
        return Promise.resolve({ id: id, synced: false });
      }
    }
    this.showSyncWarningBanner();
    return Promise.resolve({ id: id, synced: false });
  },

  addItem: function(colName, item) {
    if (!item.id) {
      item.id = colName.substring(0, 3) + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    }
    this.saveRecord(colName, item);
    return item;
  },

  updateItem: function(colName, id, updates) {
    var items = this.getCollection(colName);
    var target = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id || items[i].docId === id) {
        target = items[i];
        break;
      }
    }
    if (!target) target = { id: id };
    for (var key in updates) {
      target[key] = updates[key];
    }
    this.saveRecord(colName, target);
  },

  deleteItem: function(colName, id) {
    this.deleteRecord(colName, id);
  },

  subscribeRealtimeSync: function(colName, onDataUpdated) {
    if (!this.isFirebaseAvailable()) return null;
    try {
      var userRole = (typeof localStorage !== 'undefined') ? localStorage.getItem('userRole') : null;
      var empId = (typeof localStorage !== 'undefined') ? localStorage.getItem('employeeId') : null;

      var query = window.db.collection(colName);

      var staffScopedCols = ['attendance', 'dwmActivities', 'leads', 'orders', 'expenses', 'reviews', 'travelApprovals'];
      if (userRole === 'staff' && empId && staffScopedCols.indexOf(colName) !== -1) {
        query = query.where('employeeId', '==', empId);
      }

      return query.onSnapshot(function(snapshot) {
        var localItems = window.RevOpsStore.getCollection(colName) || [];

        snapshot.docChanges().forEach(function(change) {
          var data = change.doc.data();
          data.id = change.doc.id;
          var idx = localItems.findIndex(function(it) {
            return it.id === data.id || it.docId === data.id;
          });
          if (change.type === 'added' || change.type === 'modified') {
            if (idx >= 0) {
              localItems[idx] = Object.assign({}, localItems[idx], data);
            } else {
              localItems.push(data);
            }
          } else if (change.type === 'removed') {
            if (idx >= 0) {
              localItems.splice(idx, 1);
            }
          }
        });

        window.RevOpsStore.saveCollection(colName, localItems);
        if (typeof onDataUpdated === 'function') onDataUpdated(localItems);
      }, function(err) {
        console.warn("Firestore snapshot listener error for " + colName + ":", err.message || err);
      });
    } catch(e) {
      console.warn("Failed to subscribe to real-time Firestore updates for " + colName + ":", e);
      return null;
    }
  },

  initSync: function() {
    this.initRealtimeSyncAll();
  },

  initRealtimeSyncAll: function() {
    if (!this.isFirebaseAvailable()) return;
    var collections = ['employees', 'kraTargets', 'aopTargets', 'orders', 'dwmActivities', 'attendance', 'leads', 'payments', 'reviews', 'expenses', 'projectsMaster', 'clientsMaster', 'sparePartsMaster', 'expenseSplits', 'travelPolicyMaster', 'travelApprovals', 'budgets', 'serviceTickets', 'quotations', 'invoices'];
    var self = this;
    collections.forEach(function(colName) {
      try {
        self.subscribeRealtimeSync(colName);
      } catch (e) {
        console.warn("Error initializing sync for " + colName + ":", e);
      }
    });
    console.log("⚡ Real-time Firestore sync active for concurrent user sessions.");
  },

  // Converts an approved Proforma Invoice into a Commercial Tax Invoice with senior workflow and lineage
  convertProformaToTaxInvoice: function(proformaId, raisedByEmpId, raisedByName, userRole) {
    var invoices = this.getCollection('invoices') || [];
    var pi = invoices.find(function(it) { return it.id === proformaId; });
    if (!pi) {
      throw new Error("Proforma Invoice not found.");
    }

    var newTaxInvNumber = this.generateNextInvoiceNumber(false);
    var isSenior = (userRole === 'admin' || userRole === 'super_admin');
    var status = isSenior ? 'Approved' : 'Pending Senior Approval';
    var approvalInfo = isSenior ? {
      approvedBy: (raisedByName || 'Admin') + ' (' + (raisedByEmpId || 'E-001') + ')',
      approvedRole: userRole,
      approvedDate: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      seniorRemarks: 'Auto-approved upon conversion from Proforma ' + (pi.invoiceNumber || '')
    } : null;

    var newTaxInvoice = {
      id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      invoiceNumber: newTaxInvNumber,
      invoiceType: 'Tax Invoice',
      convertedFromProformaId: pi.id,
      convertedFromProformaNo: pi.invoiceNumber,
      customerName: pi.customerName,
      customerGstin: pi.customerGstin || '',
      customerEmail: pi.customerEmail || '',
      contactPerson: pi.contactPerson || '',
      vertical: pi.vertical || 'Sales',
      poRef: pi.poRef || ('Ref PI ' + pi.invoiceNumber),
      invoiceDate: getFormattedToday(),
      dueDate: pi.dueDate || getFormattedToday(),
      milestoneTag: pi.milestoneTag || 'Converted from Proforma',
      bankDetails: pi.bankDetails || 'HDFC Bank - Current A/c No: 50200049283719, IFSC: HDFC0000123',
      terms: pi.terms || 'Payment within 30 days of commercial tax invoice.',
      isInterstate: !!pi.isInterstate,
      items: JSON.parse(JSON.stringify(pi.items || [])),
      taxableValue: Number(pi.taxableValue) || 0,
      taxAmount: Number(pi.taxAmount) || 0,
      grandTotal: Number(pi.grandTotal) || 0,
      paidAmount: Number(pi.paidAmount) || 0,
      tdsDeducted: Number(pi.tdsDeducted) || 0,
      balanceDue: Number(pi.balanceDue) !== undefined ? Number(pi.balanceDue) : Number(pi.grandTotal),
      status: status,
      approvalInfo: approvalInfo,
      employeeId: raisedByEmpId || pi.employeeId,
      employeeName: raisedByName || pi.employeeName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Update Proforma Invoice state
    pi.taxInvoiceConvertedId = newTaxInvoice.id;
    pi.taxInvoiceConvertedNo = newTaxInvoice.invoiceNumber;
    pi.status = 'Approved';
    pi.updatedAt = new Date().toISOString();

    this.saveRecord('invoices', pi);
    this.saveRecord('invoices', newTaxInvoice);

    return newTaxInvoice;
  },

  // Calculate Daily Work Management productivity with Special Assignments (Full day training/meeting = 100%)
  calculateDailyProductivity: function(param1, param2) {
    var activities = [];
    var standardHours = 8.0;

    if (Array.isArray(param1)) {
      activities = param1;
      standardHours = Number(param2) || 8.0;
    } else if (typeof param1 === 'string' || typeof param1 === 'number') {
      var empId = String(param1);
      var dateStr = param2 || (typeof getFormattedToday === 'function' ? getFormattedToday() : 'Today');
      var allActs = this.getCollection('dwmActivities') || [];
      activities = allActs.filter(function(a) {
        return a.employeeId === empId && (!dateStr || dateStr === 'Today' || a.date === dateStr);
      });
      standardHours = 8.0;
    } else if (param1 && typeof param1 === 'object' && param1.activities) {
      activities = Array.isArray(param1.activities) ? param1.activities : [];
      standardHours = Number(param1.standardHours) || 8.0;
    }

    if (!activities || activities.length === 0) {
      return {
        score: 0,
        productivityScore: 0,
        totalActivities: 0,
        completedActivities: 0,
        totalHoursLogged: 0,
        productiveHours: 0,
        specialAssignmentHours: 0,
        hasSpecialAssignment: false,
        specialAssignmentType: null,
        standardHours: standardHours,
        summary: "No activities planned"
      };
    }

    var totalLogged = 0;
    var productiveHours = 0;
    var specialAssignmentHours = 0;
    var hasSpecialAssignment = false;
    var specialAssignmentType = null;
    var completedCount = 0;

    activities.forEach(function(act) {
      var duration = Number(act.hoursSpent) || Number(act.durationHours) || (Number(act.durationMinutes) ? Number(act.durationMinutes) / 60 : 0);
      if (!duration || duration <= 0) duration = 1.0;
      totalLogged += duration;

      var isSpecial = act.isSpecialAssignment || 
                      (act.specialAssignmentType && act.specialAssignmentType !== 'General KRA Task') ||
                      act.category === 'Special Assignment' || 
                      act.category === 'Full Day Training' || 
                      act.category === 'Full Day Meeting' || 
                      act.category === 'Client Emergency Call';

      var status = (act.accomplishmentStatus || act.status || '').toLowerCase();
      var isCompleted = status === 'done' || status === 'completed' || status === 'attended' || status === 'approved';
      var isPartial = status === 'partial' || status === 'in progress';

      if (isSpecial) {
        hasSpecialAssignment = true;
        specialAssignmentType = act.specialAssignmentType || act.category || 'Special Assignment';
        specialAssignmentHours += duration;
        // Special assignments count 100% towards organizational productivity
        productiveHours += duration;
      } else {
        if (isCompleted) {
          productiveHours += duration;
          completedCount++;
        } else if (isPartial) {
          productiveHours += (duration * 0.6);
        } else {
          productiveHours += (duration * 0.2);
        }
      }
    });

    var score = 0;
    if (hasSpecialAssignment) {
      score = 100;
    } else if (standardHours > 0) {
      score = Math.min(100, Math.round((productiveHours / standardHours) * 100));
    } else {
      score = Math.min(100, Math.round((completedCount / activities.length) * 100));
    }

    var summaryText = hasSpecialAssignment ?
      (specialAssignmentType + " (" + Math.round(specialAssignmentHours * 10)/10 + " hrs) - 100% Full Productivity Credited") :
      (completedCount + " of " + activities.length + " tasks completed (" + score + "%)");

    return {
      score: score,
      productivityScore: score,
      totalActivities: activities.length,
      completedActivities: completedCount,
      totalHoursLogged: Math.round(totalLogged * 10) / 10,
      productiveHours: Math.round(productiveHours * 10) / 10,
      specialAssignmentHours: Math.round(specialAssignmentHours * 10) / 10,
      hasSpecialAssignment: hasSpecialAssignment,
      specialAssignmentType: specialAssignmentType,
      standardHours: standardHours,
      summary: summaryText
    };
  },

  // Returns prescribed CSV format template and sample rows for bulk upload
  getPrescribedCsvTemplate: function(masterType) {
    var templates = {
      clients: {
        filename: "measure_di_clients_master_template.csv",
        headers: "clientCode,clientName,gstin,contactPerson,email,phone,address,city,state,vertical,creditPeriodDays",
        sampleRows: [
          "CL-001,JSW Steel Limited,29AAACJ1011A1Z2,Mr. Raghunath Verma,r.verma@jsw.in,9840112233,Toranagallu Slag Yard,Ballari,Karnataka,Sales,30",
          "CL-002,Tata Steel Limited,20AAACT2702H1ZQ,Mr. Amitav Sen,amitav.sen@tatasteel.com,9840223344,Jamshedpur Steel Works,Jamshedpur,Jharkhand,Projects,45",
          "CL-003,UltraTech Cement Ltd,27AAACU0147L1ZF,Mr. Suresh Pillai,suresh.p@ultratech.adityabirla.com,9840334455,Awarpur Cement Works,Chandrapur,Maharashtra,Service/Parts,30",
          "CL-004,Bharat Heavy Electricals (BHEL),33AAACB1234A1Z5,Mr. K. Natarajan,natarajan@bhel.in,9840445566,Boiler Plant HPBP,Trichy,Tamil Nadu,Projects,60",
          "CL-005,Saint-Gobain India,33AAACS1234C1Z8,Mr. Ramesh Krishnan,ramesh.k@saint-gobain.com,9840556677,World Glass Complex,Sriperumbudur,Tamil Nadu,Sales,30"
        ]
      },
      projects: {
        filename: "measure_di_projects_master_template.csv",
        headers: "projectCode,projectName,clientName,vertical,projectValue,startDate,targetCompletionDate,projectManagerName,status,budgetINR",
        sampleRows: [
          "PRJ-2026-01,JSW Slag Yard Dynamic Crane Scale Automation,JSW Steel Limited,Projects,4500000,01/04/2026,30/09/2026,Mr. Murugan V,In Execution,3800000",
          "PRJ-2026-02,Tata Steel Pellet Plant 200T In-Motion Rail Weigher,Tata Steel Limited,Projects,8500000,15/04/2026,15/11/2026,Mrs. Anitha,In Execution,7200000",
          "PRJ-2026-03,UltraTech Raw Mill Automated Laser Profiling,UltraTech Cement Ltd,Projects,3200000,01/05/2026,31/10/2026,Mr. Ravichandran,Planning,2600000",
          "PRJ-2026-04,BHEL Turbine Component CMM Metrology Lab,Bharat Heavy Electricals (BHEL),Projects,9800000,10/05/2026,31/12/2026,Mrs. Subhashini,Planning,8500000",
          "PRJ-2026-05,Saint-Gobain High-Speed Float Glass Optical Scanner,Saint-Gobain India,Projects,2700000,01/06/2026,30/11/2026,Mr. Murugan V,Planning,2200000"
        ]
      },
      employees: {
        filename: "measure_di_employees_master_template.csv",
        headers: "employeeId,fullName,designation,vertical,reportsTo,reportsToName,email,mobile,role,workArrangement,dateOfJoining,isActive",
        sampleRows: [
          "E-006,Senthil Nathan,Senior Field Commissioning Engineer,Projects & production,E-003,Mrs. Anitha,senthil@measuredi.com,9840667788,staff,Site / On-Field,01/06/2021,true",
          "E-007,Deepa Radhakrishnan,Inside Sales & Quotations Engineer,Marketing,E-002,Mr. Murugan V,deepa@measuredi.com,9840778899,staff,Head Office,15/07/2021,true",
          "E-008,Karthik Subramanian,Territory Service Executive,Service & Spares,E-002,Mr. Murugan V,karthik@measuredi.com,9840889900,staff,Hybrid,01/08/2022,true",
          "E-009,Manoj Kumar,Embedded Hardware & Firmware Engineer,Projects & production,E-003,Mrs. Anitha,manoj@measuredi.com,9840990011,staff,Head Office,10/01/2023,true",
          "E-010,Venkatesh Babu,Lead Metrology Specialist,Technical Support,E-003,Mrs. Anitha,venkatesh@measuredi.com,9840001122,manager,Head Office,01/03/2023,true"
        ]
      },
      spareParts: {
        filename: "measure_di_spare_parts_master_template.csv",
        headers: "partNumber,partName,category,compatibleModel,hsnCode,unitPrice,gstPercent,uom,stockQty,minReorderLevel,leadTimeDays",
        sampleRows: [
          "SP-LC-50T,High Precision 50-Ton Shear Beam Load Cell,Load Cells,Crane Scales CS-50T,90318000,45000,18,Nos,24,5,7",
          "SP-ENC-1000,Optical Rotary Encoder 1000 PPR Stainless Steel,Sensors & Encoders,In-Motion Rail Weighers,90319000,18500,18,Nos,40,10,5",
          "SP-DISP-7S,Industrial High-Brightness 6-Digit LED Display Indicator,Displays & Terminals,All Measure DI Weighers,85285900,28000,18,Nos,18,4,10",
          "SP-JB-04IP,IP68 Stainless Steel 4-Channel Analog Junction Box,Junction Boxes,Weighbridges & Hoppers,85369090,6500,18,Nos,55,15,3",
          "SP-LAS-SCAN,High-Speed Multi-Line Laser Surface Profiler Head,Optical Metrology,Laser Scanners LS-200,90314900,145000,18,Sets,8,2,21",
          "SP-CAL-20T,Certified Class M1 20-Ton Heavy Calibration Test Block,Calibration Standards,Crane & Weighbridge,90319000,85000,18,Nos,6,1,14"
        ]
      }
    };
    return templates[masterType] || templates.clients;
  },

  // Recalculates invoice paid amount, TDS, adjustments, write-offs, balance and payment status
  syncInvoicePaymentStatus: function(invoiceNumberOrId) {
    if (!invoiceNumberOrId) return;
    var invoices = this.getCollection('invoices') || [];
    var payments = this.getCollection('payments') || [];
    var arAdjustments = this.getCollection('arAdjustments') || [];

    var targetInv = invoices.find(function(inv) {
      return inv.id === invoiceNumberOrId || inv.invoiceNumber === invoiceNumberOrId;
    });

    if (!targetInv) return;

    var linkedPayments = payments.filter(function(p) {
      return (p.invoiceId === targetInv.id || p.invoiceNumber === targetInv.invoiceNumber) && (p.status === 'Cleared' || p.status === 'Approved');
    });

    var totalPaid = 0;
    var totalTds = 0;
    linkedPayments.forEach(function(p) {
      totalPaid += (Number(p.amount) || 0);
      totalTds += (Number(p.tdsAmount) || 0);
    });

    // Sum approved goodwill discounts and Director-approved bad debt write-offs
    var linkedAdjustments = arAdjustments.filter(function(adj) {
      return (adj.invoiceId === targetInv.id || adj.invoiceNumber === targetInv.invoiceNumber) && (adj.status === 'Approved' || adj.status === 'Approved by Director');
    });

    var totalAdjustments = 0;
    var totalWriteOffs = 0;
    linkedAdjustments.forEach(function(adj) {
      var amt = Number(adj.amount) || 0;
      if (adj.type && adj.type.indexOf('Write-Off') !== -1) {
        totalWriteOffs += amt;
      } else {
        totalAdjustments += amt;
      }
    });

    targetInv.paidAmount = totalPaid;
    targetInv.tdsDeducted = totalTds;
    targetInv.adjustmentAmount = totalAdjustments;
    targetInv.writeOffAmount = totalWriteOffs;

    var grandTotal = Number(targetInv.grandTotal) || 0;
    var totalSettled = totalPaid + totalTds + totalAdjustments + totalWriteOffs;
    var balanceDue = Math.max(0, grandTotal - totalSettled);
    targetInv.balanceDue = balanceDue;

    if (targetInv.status !== 'Draft' && targetInv.status !== 'Pending Senior Approval' && targetInv.status !== 'Rejected' && targetInv.status !== 'Cancelled') {
      if (balanceDue <= 0.01 && totalSettled > 0) {
        if (totalWriteOffs > 0 && (totalPaid + totalTds + totalAdjustments) < grandTotal) {
          targetInv.status = 'Written Off';
        } else if (totalAdjustments > 0 && (totalPaid + totalTds) < grandTotal) {
          targetInv.status = 'Settled with Adjustment';
        } else {
          targetInv.status = 'Fully Paid';
        }
      } else if (totalPaid > 0 || totalAdjustments > 0) {
        targetInv.status = 'Partially Paid';
      } else {
        // If not paid at all, check if overdue
        if (targetInv.dueDate) {
          var due = parseDateDDMMYYYY(targetInv.dueDate);
          var today = new Date();
          today.setHours(0,0,0,0);
          if (due < today) {
            targetInv.status = 'Overdue';
          } else {
            targetInv.status = targetInv.status === 'Overdue' ? 'Issued' : targetInv.status;
          }
        }
      }
    }

    this.saveRecord('invoices', targetInv);
    return targetInv;
  },

  generateNextAdjustmentNumber: function(isWriteOff) {
    var arAdjustments = this.getCollection('arAdjustments') || [];
    var prefix = isWriteOff ? 'WO-2026-' : 'ADJ-2026-';
    var maxNum = 0;
    arAdjustments.forEach(function(adj) {
      var numStr = adj.adjustmentNumber || adj.refNumber || '';
      if (numStr.indexOf(prefix) !== -1) {
        var numPart = parseInt(numStr.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    return prefix + String(maxNum + 1).padStart(3, '0');
  },

  createArAdjustmentRequest: function(adjData) {
    var arAdjustments = this.getCollection('arAdjustments') || [];
    var isWriteOff = adjData.type && adjData.type.indexOf('Write-Off') !== -1;
    var refNum = adjData.adjustmentNumber || this.generateNextAdjustmentNumber(isWriteOff);
    
    var newAdj = {
      id: adjData.id || ('adj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
      adjustmentNumber: refNum,
      refNumber: refNum,
      type: adjData.type || (isWriteOff ? 'Bad Debt Write-Off (Unrecoverable AR)' : 'Goodwill Discount / Commercial Adjustment'),
      invoiceId: adjData.invoiceId || '',
      invoiceNumber: adjData.invoiceNumber || '',
      customerName: adjData.customerName || '',
      invoiceGrandTotal: Number(adjData.invoiceGrandTotal) || 0,
      invoiceCurrentBalance: Number(adjData.invoiceCurrentBalance) || 0,
      amount: Number(adjData.amount) || 0,
      reasonCategory: adjData.reasonCategory || (isWriteOff ? 'Long Outstanding Unrecoverable' : 'Goodwill Customer Concession'),
      detailedJustification: adjData.detailedJustification || '',
      requestedBy: adjData.requestedBy || 'Staff',
      requestedDate: adjData.requestedDate || getFormattedToday(),
      status: adjData.status || 'Pending Director Approval',
      directorApproval: adjData.directorApproval || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    var saved = this.addItem('arAdjustments', newAdj);
    
    // If auto-approved by Director
    if (newAdj.status === 'Approved' || newAdj.status === 'Approved by Director') {
      if (newAdj.invoiceId || newAdj.invoiceNumber) {
        this.syncInvoicePaymentStatus(newAdj.invoiceId || newAdj.invoiceNumber);
      }
    }

    return saved;
  },

  approveArAdjustment: function(adjId, directorName, directorRole, directorRemarks, decision) {
    var arAdjustments = this.getCollection('arAdjustments') || [];
    var adj = arAdjustments.find(function(it) { return it.id === adjId; });
    if (!adj) return { success: false, error: 'Adjustment record not found.' };

    var isApproved = decision === 'Approved';
    var updatedStatus = isApproved ? 'Approved by Director' : 'Rejected by Director';

    var directorApproval = {
      approvedBy: directorName || 'Mr. Murugan V (Director)',
      directorRole: directorRole || 'super_admin',
      approvedDate: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      directorRemarks: directorRemarks || (isApproved ? 'Approved & Authorized by Director of Measure DI Technologies' : 'Rejected by Director'),
      authorizationCode: 'DIR-AUTH-' + Math.floor(100000 + Math.random() * 900000)
    };

    var updates = {
      status: updatedStatus,
      directorApproval: directorApproval,
      updatedAt: new Date().toISOString()
    };

    this.updateItem('arAdjustments', adjId, updates);

    // Synchronize invoice balance immediately
    if (adj.invoiceId || adj.invoiceNumber) {
      this.syncInvoicePaymentStatus(adj.invoiceId || adj.invoiceNumber);
    }

    return { success: true, adjustment: adj, status: updatedStatus };
  },

  getPendingDirectorApprovals: function() {
    var arAdjustments = this.getCollection('arAdjustments') || [];
    return arAdjustments.filter(function(adj) {
      return adj.status === 'Pending Director Approval';
    });
  },

  generateNextReceiptNumber: function() {
    var payments = this.getCollection('payments') || [];
    var maxNum = 0;
    payments.forEach(function(p) {
      if (p.receiptNumber && p.receiptNumber.indexOf('REC-2026-') !== -1) {
        var numPart = parseInt(p.receiptNumber.split('REC-2026-')[1], 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    return 'REC-2026-' + String(maxNum + 1).padStart(3, '0');
  },

  generateNextTicketNumber: function() {
    var tickets = this.getCollection('serviceTickets') || [];
    var prefix = 'TKT-2026-';
    var maxNum = 0;
    tickets.forEach(function(t) {
      var numStr = t.ticketNumber || t.id || '';
      if (numStr.indexOf(prefix) !== -1) {
        var numPart = parseInt(numStr.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    return prefix + String(maxNum + 1).padStart(3, '0');
  },

  generateNextInvoiceNumber: function(isProforma) {
    var invoices = this.getCollection('invoices') || [];
    var prefix = isProforma ? 'PI/2026-27/' : 'INV/2026-27/';
    var maxNum = 0;
    invoices.forEach(function(inv) {
      if (inv.invoiceNumber && inv.invoiceNumber.indexOf(prefix) !== -1) {
        var numPart = parseInt(inv.invoiceNumber.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    return prefix + String(maxNum + 1).padStart(3, '0');
  },

  convertProformaToTaxInvoice: function(proformaId, approvedByRole, approvedByName) {
    var invoices = this.getCollection('invoices') || [];
    var proforma = invoices.find(function(inv) { return inv.id === proformaId; });
    if (!proforma) {
      return { success: false, error: "Proforma Invoice not found." };
    }

    if (proforma.invoiceType !== 'Proforma Invoice') {
      return { success: false, error: "Selected document is already a Tax Invoice." };
    }

    var nextTaxInvNumber = this.generateNextInvoiceNumber(false);
    var nowStr = getFormattedToday();

    // Clone items
    var newTaxInvoice = JSON.parse(JSON.stringify(proforma));
    newTaxInvoice.id = 'inv_' + Date.now();
    newTaxInvoice.invoiceNumber = nextTaxInvNumber;
    newTaxInvoice.invoiceType = 'Tax Invoice';
    newTaxInvoice.proformaReference = proforma.invoiceNumber;
    newTaxInvoice.proformaId = proforma.id;
    newTaxInvoice.invoiceDate = nowStr;
    newTaxInvoice.status = 'Approved';
    newTaxInvoice.approvalInfo = {
      approvedBy: approvedByName || 'Senior Approver',
      approverRole: approvedByRole || 'admin',
      approvedAt: new Date().toISOString(),
      remarks: "Converted and approved from Proforma Invoice " + proforma.invoiceNumber
    };

    // Mark original Proforma as Converted
    proforma.status = 'Converted to Tax Invoice';
    proforma.convertedTaxInvoiceId = newTaxInvoice.id;
    proforma.convertedTaxInvoiceNumber = nextTaxInvNumber;
    proforma.convertedAt = new Date().toISOString();

    this.saveRecord('invoices', proforma);
    this.saveRecord('invoices', newTaxInvoice);

    console.log("✅ Converted Proforma", proforma.invoiceNumber, "-> Tax Invoice", nextTaxInvNumber);
    return { success: true, taxInvoice: newTaxInvoice, proforma: proforma };
  },

  // Performance Guarantee (PG), Bank Guarantee (BG) & Warranty Retention Management
  getPgBgReceivables: function() {
    var orders = this.getCollection('orders') || [];
    var invoices = this.getCollection('invoices') || [];
    var pgbgList = this.getCollection('pgbgReceivables') || [];

    // If pgbgReceivables collection is empty, automatically derive from orders and invoices with contract security terms
    if (pgbgList.length === 0) {
      var seedPgBg = [
        {
          id: 'pgbg_1',
          clientName: 'Tata Steel Limited - Kalinganagar Works',
          poNumber: 'TSL/2026/PO-8821',
          invoiceNumber: 'INV/2026-27/001',
          securityType: 'Performance Bank Guarantee (PBG)',
          guaranteeAmount: 480000,
          stipulatedPeriod: '12 Months Warranty from Commissioning',
          validFrom: '15/04/2025',
          releaseDueDate: '15/04/2026',
          status: 'Due Soon',
          isReleased: false,
          bankBranch: 'SBI Industrial Finance Guindy (BG #9021-PBG-2025)',
          remarks: '10% PBG against Blast Furnace Hot Metal scale contract.'
        },
        {
          id: 'pgbg_2',
          clientName: 'JSW Steel Limited - Vijayanagar Plant',
          poNumber: 'JSW/VIJ/CAPEX/4409',
          invoiceNumber: 'INV/2026-27/004',
          securityType: 'Contract Retention (10%)',
          guaranteeAmount: 325000,
          stipulatedPeriod: '18 Months Operational Performance Guarantee',
          validFrom: '10/05/2025',
          releaseDueDate: '10/11/2026',
          status: 'Active',
          isReleased: false,
          bankBranch: 'Contractual Retention withheld in client ledger',
          remarks: '10% Retention payable upon submission of Final Acceptance Certificate (FAC).'
        },
        {
          id: 'pgbg_3',
          clientName: 'Jindal Steel & Power Ltd (JSPL) - Angul',
          poNumber: 'JSPL/ANG/ORD/3012',
          invoiceNumber: 'INV/2025-26/089',
          securityType: 'Bank Guarantee (BG)',
          guaranteeAmount: 250000,
          stipulatedPeriod: '24 Months Warranty Period',
          validFrom: '20/01/2024',
          releaseDueDate: '20/01/2026',
          status: 'Overdue / Action Needed',
          isReleased: false,
          bankBranch: 'HDFC Bank Corporate Guindy (BG #HDFC-BG-8812)',
          remarks: 'Warranty expired on 20/01/2026. BG claim letter / surrender discharge note pending from client.'
        },
        {
          id: 'pgbg_4',
          clientName: 'Steel Authority of India Ltd (SAIL) - Bhilai Steel Plant',
          poNumber: 'SAIL/BSP/PO/99120',
          invoiceNumber: 'INV/2026-27/007',
          securityType: 'Performance Bank Guarantee (PBG)',
          guaranteeAmount: 620000,
          stipulatedPeriod: '12 Months Warranty + 3 Months Claim Period',
          validFrom: '01/06/2025',
          releaseDueDate: '01/09/2026',
          status: 'Active',
          isReleased: false,
          bankBranch: 'Canara Bank Commercial Chennai',
          remarks: 'PBG for Crane weighing systems installation and commissioning.'
        },
        {
          id: 'pgbg_5',
          clientName: 'Adani Ports & Special Economic Zone - Mundra',
          poNumber: 'APSEZ/MUN/2025/1102',
          invoiceNumber: 'INV/2025-26/044',
          securityType: 'Warranty Security Deposit',
          guaranteeAmount: 180000,
          stipulatedPeriod: '12 Months Warranty',
          validFrom: '10/02/2025',
          releaseDueDate: '10/02/2026',
          status: 'Overdue / Action Needed',
          isReleased: false,
          bankBranch: 'Client Security Deposit A/c',
          remarks: '12 months warranty completed. Refund release communication to be initiated with Adani Finance.'
        }
      ];

      this.saveCollection('pgbgReceivables', seedPgBg);
      pgbgList = seedPgBg;
    }

    // Recalculate dynamic days remaining and alert status
    var today = new Date();
    today.setHours(0,0,0,0);

    pgbgList.forEach(function(item) {
      if (item.isReleased) {
        item.status = 'Released / Collected';
        item.daysRemaining = 0;
        return;
      }

      var dueDate = parseDateDDMMYYYY(item.releaseDueDate);
      var diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      item.daysRemaining = diffDays;

      if (diffDays < 0) {
        item.status = 'Overdue / Action Needed';
      } else if (diffDays <= 30) {
        item.status = 'Due Soon (< 30 Days)';
      } else {
        item.status = 'Active';
      }
    });

    return pgbgList;
  },

  releasePgBgSecurity: function(recordId, releaseData) {
    var pgbgList = this.getPgBgReceivables();
    var rec = pgbgList.find(function(it) { return it.id === recordId; });
    if (!rec) return { success: false, error: "PG/BG record not found." };

    rec.isReleased = true;
    rec.status = 'Released / Collected';
    rec.releasedDate = releaseData && releaseData.date ? releaseData.date : getFormattedToday();
    rec.releasedAmount = releaseData && releaseData.amount ? Number(releaseData.amount) : rec.guaranteeAmount;
    rec.releaseRef = releaseData && releaseData.ref ? releaseData.ref : 'BG-REL-' + Math.floor(100000 + Math.random() * 900000);
    rec.releaseRemarks = releaseData && releaseData.remarks ? releaseData.remarks : 'Discharge note received and original BG returned by client.';
    rec.updatedAt = new Date().toISOString();

    this.saveCollection('pgbgReceivables', pgbgList);
    return { success: true, record: rec };
  },

  // 2-Step Verification for Payment Collection (Staff Record -> Finance/Accounts Approval)
  verifyPaymentByAccounts: function(paymentId, approverName, approverRole) {
    var payments = this.getCollection('payments') || [];
    var p = payments.find(function(it) { return it.id === paymentId; });
    if (!p) return { success: false, error: "Payment record not found." };

    p.status = 'Cleared';
    p.verifiedByAccounts = true;
    p.accountsVerifiedAt = new Date().toISOString();
    p.accountsApproverName = approverName || 'Finance & Accounts Team';
    p.accountsApproverRole = approverRole || 'admin';
    p.updatedAt = new Date().toISOString();

    this.updateItem('payments', paymentId, p);

    // Synchronize invoice balance immediately so revenue dashboards and statements update
    if (p.invoiceId || p.invoiceNumber) {
      this.syncInvoicePaymentStatus(p.invoiceId || p.invoiceNumber);
    }

    return { success: true, payment: p };
  },

  sanitizeRecord: function(item) {
    if (!item || typeof item !== 'object') return {};
    var sanitized = {};
    for (var key in item) {
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        var val = item[key];
        if (typeof val === 'string') {
          sanitized[key] = val.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        } else {
          sanitized[key] = val;
        }
      }
    }
    if (!sanitized.updatedAt) {
      sanitized.updatedAt = new Date().toISOString();
    }
    return sanitized;
  },

  bulkUploadItems: function(colName, recordArray, callback) {
    if (!Array.isArray(recordArray) || recordArray.length === 0) {
      if (typeof callback === 'function') callback(0, "No valid records provided.");
      return;
    }
    var self = this;
    var currentItems = this.getCollection(colName);
    var count = 0;

    recordArray.forEach(function(rawRecord) {
      var record = self.sanitizeRecord(rawRecord);
      if (!record.id) {
        record.id = colName.substring(0, 3) + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      }
      currentItems.push(record);
      count++;
    });

    this.saveCollection(colName, currentItems);

    if (this.isFirebaseAvailable()) {
      try {
        var batch = window.db.batch();
        recordArray.forEach(function(rawRecord) {
          var record = self.sanitizeRecord(rawRecord);
          var docRef = window.db.collection(colName).doc(record.id);
          batch.set(docRef, record, { merge: true });
        });
        batch.commit().then(function() {
          console.log("✅ Bulk batch import committed to Firestore for " + colName + " (" + count + " items)");
          if (typeof callback === 'function') callback(count, null);
        }).catch(function(err) {
          console.warn("Bulk import Firestore batch warning:", err);
          if (typeof callback === 'function') callback(count, err.message);
        });
      } catch(e) {
        if (typeof callback === 'function') callback(count, null);
      }
    } else {
      if (typeof callback === 'function') callback(count, null);
    }
  }
});

// Global Helpers
function getFormattedToday() {
  var d = new Date();
  var day = String(d.getDate()).padStart(2, '0');
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var year = d.getFullYear();
  return day + '/' + month + '/' + year;
}

function formatINR(val) {
  var num = Number(val) || 0;
  return 'Rs.' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function parseDateDDMMYYYY(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  var parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }
  return new Date(dateStr);
}

function getFinancialYear(dateStr, invoiceNumber) {
  if (dateStr && typeof dateStr === 'string' && dateStr.trim()) {
    var trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{4}$/.test(trimmed)) {
      return trimmed.substring(0, 5) + trimmed.substring(7);
    }
    var d = null;
    if (trimmed.indexOf('/') !== -1) {
      var parts = trimmed.split('/');
      if (parts.length >= 3) {
        var day = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10) - 1;
        var year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        d = new Date(year, month, day);
      }
    } else if (trimmed.indexOf('-') !== -1) {
      var parts = trimmed.split('T')[0].split('-');
      if (parts.length >= 3) {
        var year = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10) - 1;
        var day = parseInt(parts[2], 10);
        d = new Date(year, month, day);
      }
    }
    if (!d || isNaN(d.getTime())) d = new Date(trimmed);
    if (d && !isNaN(d.getTime())) {
      var year = d.getFullYear();
      var month = d.getMonth() + 1;
      if (month >= 4) {
        var nextYr = (year + 1) % 100;
        return year + '-' + (nextYr < 10 ? '0' + nextYr : nextYr);
      } else {
        var prevYr = year - 1;
        var currYr = year % 100;
        return prevYr + '-' + (currYr < 10 ? '0' + currYr : currYr);
      }
    }
  }

  if (invoiceNumber && typeof invoiceNumber === 'string') {
    if (invoiceNumber.indexOf('2026-27') !== -1) return '2026-27';
    if (invoiceNumber.indexOf('2025-26') !== -1) return '2025-26';
    if (invoiceNumber.indexOf('2024-25') !== -1) return '2024-25';
  }

  return '2026-27';
}

window.getFormattedToday = getFormattedToday;
window.formatINR = formatINR;
window.parseDateDDMMYYYY = parseDateDDMMYYYY;
window.getFinancialYear = getFinancialYear;
