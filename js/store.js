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

  // Every collection the "Clear Demo Data" go-live reset wipes - deliberately
  // scoped to transactional/demo records only. Employees (the login table),
  // Company Master, and every reusable classification list (Lead Source,
  // Currency, Complaint Category, SLA tiers, AMC tiers, etc.) are left out on
  // purpose - they're either real configuration already in place, or carry
  // their own safety net to never go empty.
  DEMO_DATA_COLLECTIONS: [
    'leads', 'quotations', 'orders', 'invoices',
    'serviceTickets', 'serviceLeads',
    'amcContracts', 'amcQuotations', 'amcOrders', 'amcInvoices',
    'clientsMaster', 'sparePartsMaster', 'bankDetailsMaster', 'clientEquipmentMaster',
    'attendance', 'dwmActivities', 'reviews',
    'kraTargets', 'aopTargets', 'payments', 'expenses', 'expenseSplits', 'projectsMaster'
  ],

  // Clears every demo/transactional collection (see DEMO_DATA_COLLECTIONS
  // above) from both local storage and Firestore (deleting the real
  // documents there too, not just the local cache of them - syncCollection
  // only ever adds/overwrites, it never deletes, so an explicit Firestore
  // delete pass is required or the "cleared" data would reappear the next
  // time this device's realtime listeners catch up). Intended for a single,
  // deliberate, Super Admin-triggered go-live reset, not routine use.
  // onProgress(colName, index, total) is called before each collection is
  // processed, for a progress UI. Returns a promise resolving to
  // { cleared: string[], firestoreDeleted: number, errors: string[] }.
  clearDummyDataForGoLive: function(onProgress) {
    var self = this;
    var collections = this.DEMO_DATA_COLLECTIONS;
    var results = { cleared: [], firestoreDeleted: 0, errors: [] };

    var chain = Promise.resolve();
    collections.forEach(function(colName, idx) {
      chain = chain.then(function() {
        if (typeof onProgress === 'function') onProgress(colName, idx + 1, collections.length);

        // Clear locally first - this collection's data is gone from this
        // device immediately regardless of what happens with Firestore.
        self.saveCollection(colName, []);
        results.cleared.push(colName);

        if (!self.isFirebaseAvailable()) return;

        // Firestore delete, chunked into batches of 450 (under the 500
        // operation batch limit) in case a collection ever has more
        // documents than that.
        return window.db.collection(colName).get().then(function(snapshot) {
          var docs = snapshot.docs;
          var batchChain = Promise.resolve();
          for (var b = 0; b < docs.length; b += 450) {
            (function(chunk) {
              batchChain = batchChain.then(function() {
                var batch = window.db.batch();
                chunk.forEach(function(doc) { batch.delete(doc.ref); });
                return batch.commit().then(function() {
                  results.firestoreDeleted += chunk.length;
                });
              });
            })(docs.slice(b, b + 450));
          }
          return batchChain;
        }).catch(function(err) {
          results.errors.push(colName + ': ' + (err && err.message || err));
        });
      });
    });

    return chain.then(function() {
      // Retire the demo-data auto-reseed logic for good on this device -
      // see seed-data.js / seedMasterListsIfEmpty, which now check
      // isFirebaseAvailable() before injecting any of these collections'
      // demo defaults, so a connected deployment never refills them once
      // cleared, on any device, from now on.
      localStorage.setItem('revops_demo_data_retired', 'true');

      if (self.logAudit) {
        self.logAudit(
          'System',
          'go-live-data-reset',
          'DELETE',
          'Cleared all demo/dummy data across ' + collections.length + ' collections ahead of go-live bulk upload (' + results.firestoreDeleted + ' Firestore document(s) deleted).',
          null,
          results
        );
      }

      return results;
    });
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

  // Best-effort mirror of every save/delete into the connected Google Sheet
  // (via the /api/sheet-sync Netlify Function proxy). Fire-and-forget: this
  // must never block, delay, or fail a real Firestore/localStorage save, so
  // all errors are swallowed and only logged.
  syncToGoogleSheet: function(colName, action, record) {
    try {
      if (!record || typeof fetch !== 'function') return;
      var MAX_FIELD_LEN = 1500;
      var slim = {};
      for (var key in record) {
        if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
        var val = record[key];
        if (typeof val === 'string' && val.length > MAX_FIELD_LEN) continue;
        slim[key] = val;
      }
      fetch('/api/sheet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: colName, action: action, record: slim })
      }).catch(function(err) {
        console.warn('Google Sheet sync failed (non-blocking):', err);
      });
    } catch (e) {
      console.warn('Google Sheet sync skipped due to error:', e);
    }
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
    this.syncToGoogleSheet(colName, index >= 0 ? 'update' : 'create', sanitized);

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
    this.syncToGoogleSheet(colName, 'delete', { id: id });

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

  // Shared live-GPS capture used by both the Attendance page's own GPS
  // retry control and the DWM "Start/Finish My Day" punch buttons. The
  // inline rose error banner (#gps-error-alert/#gps-error-message) only
  // exists on attendance.html, so it's simply skipped when absent — the
  // caller still gets the error reason via the callback either way.
  captureLiveGpsLocation: function(callback) {
    var errAlert = document.getElementById('gps-error-alert');
    var errMsg = document.getElementById('gps-error-message');
    if (errAlert) errAlert.classList.add('hidden');

    if (!navigator.geolocation) {
      if (errAlert && errMsg) {
        errAlert.classList.remove('hidden');
        errMsg.innerText = "Geolocation / GPS is not supported by your device or browser. Attendance cannot be marked without location verification.";
      }
      callback(null, "Geolocation unsupported");
      return;
    }

    var options = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition(
      function(position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        var acc = Math.round(position.coords.accuracy || 0);
        var isoTime = new Date().toISOString();

        var locationObj = {
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          timestamp: isoTime,
          formattedLocation: "Lat: " + lat.toFixed(5) + ", Lng: " + lng.toFixed(5) + " (±" + acc + "m)",
          googleMapsUrl: "https://www.google.com/maps?q=" + lat + "," + lng
        };

        if (errAlert) errAlert.classList.add('hidden');
        callback(locationObj, null);
      },
      function(error) {
        var txt = "";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            txt = "Location access permission was denied by user/browser. Attendance CANNOT be marked when GPS is denied. Please allow location access in browser/device settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            txt = "GPS / Location Services are turned off or inactive on your device. Attendance CANNOT be marked. Please turn ON GPS on your mobile/computer and try again.";
            break;
          case error.TIMEOUT:
            txt = "GPS request timed out. Please ensure high accuracy location services are turned ON and retry.";
            break;
          default:
            txt = "Could not detect live GPS location (" + (error.message || 'GPS inactive') + "). Attendance cannot be marked without location verification.";
            break;
        }
        if (errAlert && errMsg) {
          errAlert.classList.remove('hidden');
          errMsg.innerText = txt;
        }
        callback(null, txt);
      },
      options
    );
  },

  // Records today's Punch In. Called from the DWM page once the employee
  // confirms their morning plan is complete — the confirmation click IS
  // the punch-in moment, since DWM has no other single "planning done"
  // event to hang the timestamp on. Still re-checks the plan-exists rule
  // server-side (not just via a disabled button) so a stale UI can't
  // create a bad record.
  recordPunchIn: function(empId, empName, locationObj) {
    var today = getFormattedToday();
    var attendance = this.getCollection('attendance') || [];
    var existing = attendance.find(function(a) { return a.employeeId === empId && a.date === today; });
    if (existing) {
      return { success: false, reason: 'already-punched-in', record: existing };
    }

    var dwmActivities = this.getCollection('dwmActivities') || [];
    var todayDwm = dwmActivities.filter(function(a) { return a.employeeId === empId && a.date === today; });
    var tickedDwm = todayDwm.filter(function(a) { return a.isTicked !== false; });
    if (tickedDwm.length === 0) {
      return { success: false, reason: 'no-plan' };
    }

    // Locks in the ticked plan at the moment of Punch In: these rows can
    // never be deleted or unticked afterwards (mid-day additions still
    // can be, while still Pending - see deleteDwmActivity in dwm.js).
    var self = this;
    tickedDwm.forEach(function(a) {
      if (!a.lockedPlan) self.updateItem('dwmActivities', a.id, { lockedPlan: true });
    });

    var nowIso = new Date().toISOString();
    var newAtt = {
      employeeId: empId,
      employeeName: empName,
      date: today,
      punchInTime: nowIso,
      punchInLocation: locationObj,
      punchOutTime: null,
      punchOutLocation: null,
      workedHours: null,
      dwmPlanCount: tickedDwm.length,
      dwmAccomplishedCount: 0,
      status: 'Punched In'
    };
    this.addItem('attendance', newAtt);
    return { success: true, record: newAtt };
  },

  // Records today's Punch Out. Called from the DWM page once the employee
  // confirms every planned activity's accomplishment has been updated —
  // mirrors recordPunchIn's "the confirmation IS the timestamp" approach.
  recordPunchOut: function(empId, locationObj) {
    var today = getFormattedToday();
    var attendance = this.getCollection('attendance') || [];
    var todayAtt = attendance.find(function(a) { return a.employeeId === empId && a.date === today; });
    if (!todayAtt || todayAtt.status !== 'Punched In') {
      return { success: false, reason: 'not-punched-in' };
    }

    var dwmActivities = this.getCollection('dwmActivities') || [];
    var todayDwm = dwmActivities.filter(function(a) { return a.employeeId === empId && a.date === today; });
    var tickedDwm = todayDwm.filter(function(a) { return a.isTicked !== false; });
    var pendingCount = tickedDwm.filter(function(a) { return !a.accomplishmentStatus || a.accomplishmentStatus === 'Pending'; }).length;
    if (pendingCount > 0) {
      return { success: false, reason: 'pending-dwm', pendingCount: pendingCount, total: tickedDwm.length };
    }

    var accomplishedCount = tickedDwm.filter(function(a) { return a.accomplishmentStatus && a.accomplishmentStatus !== 'Pending'; }).length;
    var punchInTime = new Date(todayAtt.punchInTime);
    var punchOutTime = new Date();
    var diffMs = punchOutTime - punchInTime;
    var computedHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    if (computedHours <= 0) computedHours = 8.0;

    // Today's Daily Productivity Score, computed the instant the day is
    // confirmed complete - the same calculateDailyProductivity() the DWM
    // page itself shows, so what the employee saw live and what gets
    // ratified are always the identical number. It starts life Pending -
    // see ratifyDailyScore/rejectDailyScore/modifyDailyScore below - and
    // only counts toward anything (weekly/monthly reviews) once a
    // reporting manager has actually ratified or modified it.
    var autoScoreStats = this.calculateDailyProductivity(tickedDwm, 8.0);

    this.updateItem('attendance', todayAtt.id, {
      punchOutTime: punchOutTime.toISOString(),
      punchOutLocation: locationObj,
      workedHours: computedHours,
      dwmAccomplishedCount: accomplishedCount,
      status: 'Completed',
      autoScore: autoScoreStats.score,
      scoreRatificationStatus: 'Pending',
      finalScore: null,
      scoreRatifiedBy: null,
      scoreRatifiedByName: null,
      scoreRatifiedAt: null,
      scoreRatificationRemarks: null
    });

    return { success: true, workedHours: computedHours, punchOutTime: punchOutTime, autoScore: autoScoreStats.score };
  },

  // Reporting-manager action: accepts the system-computed Daily
  // Productivity Score exactly as-is. finalScore (what weekly/monthly
  // reviews actually average) becomes the autoScore.
  ratifyDailyScore: function(attId, reviewerEmpId, reviewerName, remarks) {
    var attendance = this.getCollection('attendance') || [];
    var att = attendance.find(function(a) { return a.id === attId; });
    if (!att || att.scoreRatificationStatus !== 'Pending') {
      return { success: false, reason: 'not-pending' };
    }

    this.updateItem('attendance', attId, {
      scoreRatificationStatus: 'Ratified',
      finalScore: att.autoScore,
      scoreRatifiedBy: reviewerEmpId,
      scoreRatifiedByName: reviewerName,
      scoreRatifiedAt: new Date().toISOString(),
      scoreRatificationRemarks: (remarks || '').trim()
    });

    if (this.logAudit) {
      this.logAudit('Attendance', att.employeeId + '::' + att.date, 'UPDATE', (reviewerName || reviewerEmpId) + ' ratified ' + (att.employeeName || att.employeeId) + "'s Daily Productivity Score (" + att.autoScore + "%) for " + att.date, att, { finalScore: att.autoScore });
    }
    return { success: true };
  },

  // Reporting-manager action: overrides the system-computed score with
  // their own number, with a mandatory justification (e.g. the DWM data
  // doesn't reflect a field situation they know about). finalScore
  // becomes the manager's number, not the autoScore.
  modifyDailyScore: function(attId, reviewerEmpId, reviewerName, newScore, justification) {
    justification = (justification || '').trim();
    if (!justification) return { success: false, reason: 'no-justification' };
    var scoreNum = Number(newScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) return { success: false, reason: 'invalid-score' };

    var attendance = this.getCollection('attendance') || [];
    var att = attendance.find(function(a) { return a.id === attId; });
    if (!att || att.scoreRatificationStatus !== 'Pending') {
      return { success: false, reason: 'not-pending' };
    }

    this.updateItem('attendance', attId, {
      scoreRatificationStatus: 'Modified',
      finalScore: Math.round(scoreNum),
      scoreRatifiedBy: reviewerEmpId,
      scoreRatifiedByName: reviewerName,
      scoreRatifiedAt: new Date().toISOString(),
      scoreRatificationRemarks: justification
    });

    if (this.logAudit) {
      this.logAudit('Attendance', att.employeeId + '::' + att.date, 'UPDATE', (reviewerName || reviewerEmpId) + ' modified ' + (att.employeeName || att.employeeId) + "'s Daily Productivity Score for " + att.date + ' from ' + att.autoScore + '% to ' + Math.round(scoreNum) + '%: ' + justification, att, { finalScore: Math.round(scoreNum) });
    }
    return { success: true };
  },

  // Reporting-manager action: disputes the day's score entirely, with a
  // mandatory justification. No finalScore is set - a Rejected day is
  // excluded from weekly/monthly review averages (computeRatifiedScoreAverage
  // below) rather than counted as 0%, until someone resolves it (the
  // employee/manager can discuss and the manager can later re-ratify via
  // the Employee Directory if needed - rejection here is a flag, not a
  // dead end).
  rejectDailyScore: function(attId, reviewerEmpId, reviewerName, justification) {
    justification = (justification || '').trim();
    if (!justification) return { success: false, reason: 'no-justification' };

    var attendance = this.getCollection('attendance') || [];
    var att = attendance.find(function(a) { return a.id === attId; });
    if (!att || att.scoreRatificationStatus !== 'Pending') {
      return { success: false, reason: 'not-pending' };
    }

    this.updateItem('attendance', attId, {
      scoreRatificationStatus: 'Rejected',
      scoreRatifiedBy: reviewerEmpId,
      scoreRatifiedByName: reviewerName,
      scoreRatifiedAt: new Date().toISOString(),
      scoreRatificationRemarks: justification
    });

    if (this.logAudit) {
      this.logAudit('Attendance', att.employeeId + '::' + att.date, 'UPDATE', (reviewerName || reviewerEmpId) + ' rejected ' + (att.employeeName || att.employeeId) + "'s Daily Productivity Score for " + att.date + ': ' + justification, att, null);
    }
    return { success: true };
  },

  // Averages finalScore across an employee's attendance records in
  // [startDate, endDate] (DD/MM/YYYY, inclusive, string-compared the same
  // way as every other date range in this app) - only Ratified or
  // Modified days count; still-Pending or Rejected days are excluded
  // rather than silently scored 0%, so a manager who hasn't caught up on
  // ratifications yet doesn't drag down the team's weekly/monthly review
  // numbers. Used by reviews.html to drive the review's score snapshot.
  computeRatifiedScoreAverage: function(empId, startDate, endDate, attendance) {
    var self = this;
    var startC = this._appDateToComparable(startDate);
    var endC = this._appDateToComparable(endDate);
    var scored = (attendance || []).filter(function(a) {
      if (a.employeeId !== empId) return false;
      if (typeof a.finalScore !== 'number') return false;
      var dC = self._appDateToComparable(a.date);
      if (!dC) return false;
      if (startC && dC < startC) return false;
      if (endC && dC > endC) return false;
      return true;
    });
    if (scored.length === 0) return { avgScore: 0, daysScored: 0 };
    var sum = 0;
    scored.forEach(function(a) { sum += a.finalScore; });
    return { avgScore: Math.round(sum / scored.length), daysScored: scored.length };
  },

  // DD/MM/YYYY -> a lexicographically-comparable YYYYMMDD string.
  _appDateToComparable: function(dateStr) {
    var p = (dateStr || '').split('/');
    if (p.length < 3) return null;
    return p[2] + p[1].padStart(2, '0') + p[0].padStart(2, '0');
  },

  // True only if dateStr is strictly before todayStr (both DD/MM/YYYY) -
  // attendance corrections are for a genuinely missed PAST day; today
  // always goes through the normal DWM-driven Punch In/Out flow instead.
  _isPastAppDate: function(dateStr, todayStr) {
    var d = this._appDateToComparable(dateStr);
    var t = this._appDateToComparable(todayStr);
    if (!d || !t) return false;
    return d < t;
  },

  // Combines a DD/MM/YYYY date with an "HH:MM" clock time (local time,
  // same as every other time input in this app) into an ISO datetime
  // string, so a requested correction time is stored the same shape as a
  // real captured punchInTime/punchOutTime.
  _combineDateAndTimeToIso: function(dateStr, hhmm) {
    var dp = (dateStr || '').split('/');
    var tp = (hhmm || '').split(':');
    if (dp.length < 3 || tp.length < 2) return null;
    var d = new Date(parseInt(dp[2], 10), parseInt(dp[1], 10) - 1, parseInt(dp[0], 10), parseInt(tp[0], 10), parseInt(tp[1], 10), 0, 0);
    return isNaN(d.getTime()) ? null : d.toISOString();
  },

  // Employee-initiated request to fill in a missed Punch In and/or Punch
  // Out for a genuinely past day - creates a Pending-review attendance
  // record (if none exists for that day) or layers the request onto an
  // existing incomplete one (e.g. punched in but never managed to punch
  // out). The requested times never take effect on their own - they only
  // become the real punchInTime/punchOutTime once a reporting manager
  // calls approveAttendanceCorrection below. Rejected by design for
  // today (today always goes through the normal DWM punch flow) and for
  // a day that's already fully Completed (nothing missing to correct).
  requestAttendanceCorrection: function(empId, empName, date, requestedPunchIn, requestedPunchOut, reason) {
    reason = (reason || '').trim();
    if (!reason) return { success: false, reason: 'no-reason' };
    if (!requestedPunchIn && !requestedPunchOut) return { success: false, reason: 'no-times' };

    var today = getFormattedToday();
    if (!this._isPastAppDate(date, today)) {
      return { success: false, reason: 'not-past-date' };
    }

    var attendance = this.getCollection('attendance') || [];
    var existing = attendance.find(function(a) { return a.employeeId === empId && a.date === date; });
    if (existing && existing.status === 'Completed') {
      return { success: false, reason: 'already-complete' };
    }
    if (existing && existing.correctionStatus === 'Pending') {
      return { success: false, reason: 'already-pending' };
    }

    var updates = {
      employeeId: empId,
      employeeName: empName,
      date: date,
      status: existing ? existing.status : 'Pending Correction',
      correctionStatus: 'Pending',
      requestedPunchInTime: requestedPunchIn ? this._combineDateAndTimeToIso(date, requestedPunchIn) : ((existing && existing.punchInTime) || null),
      requestedPunchOutTime: requestedPunchOut ? this._combineDateAndTimeToIso(date, requestedPunchOut) : ((existing && existing.punchOutTime) || null),
      correctionReason: reason,
      correctionRequestedAt: new Date().toISOString(),
      correctionReviewedBy: null,
      correctionReviewedByName: null,
      correctionReviewedAt: null,
      correctionReviewRemarks: null
    };

    if (existing) {
      this.updateItem('attendance', existing.id, updates);
    } else {
      updates.punchInTime = null;
      updates.punchOutTime = null;
      updates.workedHours = null;
      updates.dwmPlanCount = 0;
      updates.dwmAccomplishedCount = 0;
      this.addItem('attendance', updates);
    }

    if (this.logAudit) {
      this.logAudit('Attendance', empId + '::' + date, 'CREATE', (empName || empId) + ' requested an attendance correction for ' + date + ': ' + reason, null, updates);
    }

    return { success: true };
  },

  // Reporting-manager action: approves a Pending correction request,
  // applying the requested time(s) as the real punchInTime/punchOutTime
  // and recomputing workedHours once both sides are present. This is the
  // ONLY path a correction request can actually change real attendance
  // data - a still-Pending request never does.
  approveAttendanceCorrection: function(attId, reviewerEmpId, reviewerName, remarks) {
    var attendance = this.getCollection('attendance') || [];
    var att = attendance.find(function(a) { return a.id === attId; });
    if (!att || att.correctionStatus !== 'Pending') {
      return { success: false, reason: 'not-pending' };
    }

    var punchInTime = att.requestedPunchInTime || att.punchInTime;
    var punchOutTime = att.requestedPunchOutTime || att.punchOutTime;

    var updates = {
      punchInTime: punchInTime,
      punchOutTime: punchOutTime,
      correctionStatus: 'Approved',
      correctionReviewedBy: reviewerEmpId,
      correctionReviewedByName: reviewerName,
      correctionReviewedAt: new Date().toISOString(),
      correctionReviewRemarks: (remarks || '').trim()
    };

    if (punchInTime && punchOutTime) {
      var diffMs = new Date(punchOutTime) - new Date(punchInTime);
      var hours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
      updates.workedHours = hours > 0 ? hours : 8.0;
      updates.status = 'Completed';
    } else if (punchInTime) {
      updates.status = 'Punched In';
    }

    this.updateItem('attendance', attId, updates);
    if (this.logAudit) {
      this.logAudit('Attendance', att.employeeId + '::' + att.date, 'UPDATE', (reviewerName || reviewerEmpId) + ' approved ' + (att.employeeName || att.employeeId) + "'s attendance correction for " + att.date, att, updates);
    }
    return { success: true };
  },

  // Reporting-manager action: rejects a Pending correction request. The
  // real attendance record is left exactly as it was (still missing
  // whatever it was missing) - a remark explaining why is mandatory so
  // the employee knows what to fix and resubmit.
  rejectAttendanceCorrection: function(attId, reviewerEmpId, reviewerName, remarks) {
    remarks = (remarks || '').trim();
    if (!remarks) return { success: false, reason: 'no-remarks' };

    var attendance = this.getCollection('attendance') || [];
    var att = attendance.find(function(a) { return a.id === attId; });
    if (!att || att.correctionStatus !== 'Pending') {
      return { success: false, reason: 'not-pending' };
    }

    this.updateItem('attendance', attId, {
      correctionStatus: 'Rejected',
      correctionReviewedBy: reviewerEmpId,
      correctionReviewedByName: reviewerName,
      correctionReviewedAt: new Date().toISOString(),
      correctionReviewRemarks: remarks
    });

    if (this.logAudit) {
      this.logAudit('Attendance', att.employeeId + '::' + att.date, 'UPDATE', (reviewerName || reviewerEmpId) + ' rejected ' + (att.employeeName || att.employeeId) + "'s attendance correction for " + att.date + ': ' + remarks, att, null);
    }
    return { success: true };
  },

  // Special Assignment = work entirely outside the employee's KRA/KPI
  // purview for a specific, named time block (a training, a non-client
  // meeting, travel, etc.), as opposed to Regular DWM which is their
  // prescribed day-to-day KRA work. Chosen per standard HR/field-service
  // time-tracking practice: training, internal meetings, travel and
  // reactive/unplanned work (a client emergency call-out) are each
  // tracked as distinct "exception time" categories, separate from
  // routine KPI-linked work - plus an open "Other" for anything that
  // doesn't fit, so nothing is ever unloggable.
  SPECIAL_ASSIGNMENT_CATEGORIES: [
    'Training / Workshop',
    'Internal Meeting / Review',
    'Exhibition / Trade Show / Event',
    'Business Travel (Domestic)',
    'Business Travel (Overseas)',
    'Client Emergency / Unplanned Support Call',
    'Management-Directed Assignment',
    'Other'
  ],

  // Auto-populates today's "Regular DWM" rows for an employee from their
  // active KRAs' Daily Control text - the whole point being the employee
  // never has to manually create/describe this part of their day; it's
  // already defined once on the KRA (by their manager/admin) and just
  // shows up every working day. Idempotent: only creates a row for a KRA
  // that doesn't already have one today, so calling this repeatedly (every
  // DWM page load) never duplicates rows or disturbs ones already in
  // progress.
  // A KRA's Daily Control text sometimes bundles several distinct daily
  // actions into one cell (e.g. a 7-point list: customer visits, lead
  // follow-up, digital marketing, review meetings, ...). Importing that as
  // one DWM line would give it a single Done/Partial/Not Done status
  // covering all 7 things at once, hiding from the manager exactly which
  // of them actually happened. This splits on a leading numbered
  // ("1.", "2)") or lettered/bulleted list marker at the start of a line;
  // text with no such markers returns as a single one-item list, same as
  // before. Pure text parsing, used both by CSV import and by manual
  // entry on the KRA Targets page, so the splitting behaves identically
  // either way.
  splitDailyControlIntoPoints: function(text) {
    if (!text || typeof text !== 'string') return [];
    var lines = text.split(/\r?\n/);
    var listMarker = /^\s*(?:[0-9]+[.)]|[-*•])\s+/;
    var hasMarkers = lines.some(function(l) { return listMarker.test(l); });

    if (!hasMarkers) {
      var single = text.replace(/\s+/g, ' ').trim();
      return single ? [single] : [];
    }

    var points = [];
    var current = '';
    lines.forEach(function(line) {
      if (listMarker.test(line)) {
        if (current.trim()) points.push(current.replace(/\s+/g, ' ').trim());
        current = line.replace(listMarker, '');
      } else {
        current += ' ' + line;
      }
    });
    if (current.trim()) points.push(current.replace(/\s+/g, ' ').trim());
    return points.filter(function(p) { return p.length > 0; });
  },

  ensureTodayRegularDwmActivities: function(empId, empName) {
    var today = getFormattedToday();
    var currentFy = (typeof getCurrentFinancialYear === 'function') ? getCurrentFinancialYear() : null;
    var self = this;
    var kras = (this.getCollection('kraTargets') || []).filter(function(k) {
      if (k.employeeId !== empId) return false;
      if (currentFy && k.financialYear && k.financialYear !== currentFy) return false;
      var points = (k.dailyControlPoints && k.dailyControlPoints.length > 0) ? k.dailyControlPoints : self.splitDailyControlIntoPoints(k.dailyControl);
      return points.length > 0;
    });
    if (kras.length === 0) return;

    var todayActs = (this.getCollection('dwmActivities') || []).filter(function(a) {
      return a.employeeId === empId && a.date === today;
    });
    var existingKeys = {};
    todayActs.forEach(function(a) {
      if (a.isAutoGenerated && a.linkedKraId) existingKeys[a.linkedKraId + '::' + (a.dwmPointIndex || 0)] = true;
    });

    kras.forEach(function(k) {
      var points = (k.dailyControlPoints && k.dailyControlPoints.length > 0) ? k.dailyControlPoints : self.splitDailyControlIntoPoints(k.dailyControl);
      var kpi = k.kpi || k.targetMetric || '';
      points.forEach(function(point, idx) {
        if (existingKeys[k.id + '::' + idx]) return;
        self.addItem('dwmActivities', {
          employeeId: empId,
          employeeName: empName,
          date: today,
          activityDescription: point,
          category: 'Standard KRA Activity',
          isSpecialAssignment: false,
          isAutoGenerated: true,
          // Ticked (included in today's plan) by default - the whole point
          // of auto-fill is nothing to type - but the employee can untick
          // a point that genuinely doesn't apply today, before Punch In.
          isTicked: true,
          lockedPlan: false,
          userEditedTime: false,
          hoursSpent: 0,
          startTime: '',
          endTime: '',
          linkedKraId: k.id,
          linkedKra: k.kraName,
          linkedKpi: kpi,
          linkedAopLine: k.aopLine || '',
          dwmPointIndex: idx,
          planStatus: 'Planned',
          accomplishmentStatus: 'Pending',
          accomplishmentPercent: null,
          accomplishmentRemarks: '',
          planChangedByManager: false,
          plannedAt: new Date().toISOString(),
          accomplishedAt: null
        });
      });
    });

    this.recomputeRegularDwmHoursForDay(empId, today);
  },

  // Converts an "HH:MM" clock string to minutes-since-midnight, and back.
  // Used only to lay out the Regular DWM shift-time pre-fill below.
  _hhmmToMinutes: function(hhmm) {
    var parts = (hhmm || this.DWM_STANDARD_SHIFT_START).split(':');
    return (Number(parts[0]) * 60) + Number(parts[1] || 0);
  },
  _minutesToHHMM: function(mins) {
    mins = ((Math.round(mins) % 1440) + 1440) % 1440;
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  },

  // Default clock time the shift-time pre-fill starts laying out Regular
  // DWM activities from. Purely a starting point for the auto-fill below -
  // every row stays freely editable until Punch In.
  DWM_STANDARD_SHIFT_START: '09:00',

  // Regular DWM rows (KRA auto-fill + extra KRA activities) are laid out as
  // one continuous chain through the standard shift, starting at
  // DWM_STANDARD_SHIFT_START: each row's Start Time is always wherever the
  // previous row's End Time landed - never independently chosen - so
  // editing one row's End Time (which is all the employee can edit; Start
  // is computed) automatically pushes every row after it later or earlier
  // in lockstep. A row with no manual edit yet gets an equal share of
  // whatever's left of the 8-hour day after Special Assignments (fixed,
  // independent time blocks - never part of this chain) and every
  // manually-set row's own duration are subtracted; a manually-edited row
  // keeps its own duration (not evenly split) but still slots into the
  // chain at the right position. Called whenever a Special Assignment or
  // an extra KRA activity is added/edited/deleted/ticked/unticked/retimed,
  // so the chain always reflects the day's current shape.
  // An unticked row (excluded from today's plan) is reset to 0 hours / no
  // time, since it isn't part of the day being scheduled.
  recomputeRegularDwmHoursForDay: function(empId, date, standardHours) {
    standardHours = standardHours || 8.0;
    var allActs = this.getCollection('dwmActivities') || [];
    var todayActs = allActs.filter(function(a) { return a.employeeId === empId && a.date === date; });

    var specialHours = 0;
    var regularActs = [];
    var untickedActs = [];
    todayActs.forEach(function(a) {
      if (a.isTicked === false) {
        untickedActs.push(a);
        return;
      }
      if (a.isSpecialAssignment) {
        specialHours += Number(a.hoursSpent) || 0;
      } else {
        regularActs.push(a);
      }
    });

    var self = this;
    untickedActs.forEach(function(a) {
      if (a.isSpecialAssignment) return;
      var updates = {};
      if (a.hoursSpent) updates.hoursSpent = 0;
      if (a.startTime) updates.startTime = '';
      if (a.endTime) updates.endTime = '';
      if (Object.keys(updates).length > 0) self.updateItem('dwmActivities', a.id, updates);
    });

    if (regularActs.length === 0) return;

    var manualActs = regularActs.filter(function(a) { return a.userEditedTime; });
    var autoCount = regularActs.length - manualActs.length;

    var manualHours = 0;
    manualActs.forEach(function(a) { manualHours += Number(a.hoursSpent) || 0; });

    var remaining = Math.max(0, standardHours - specialHours - manualHours);
    var perItem = autoCount > 0 ? Math.round((remaining / autoCount) * 100) / 100 : 0;

    var cursorMinutes = this._hhmmToMinutes(this.DWM_STANDARD_SHIFT_START);
    regularActs.forEach(function(a) {
      var itemHours = a.userEditedTime ? (Number(a.hoursSpent) || 0) : perItem;
      var durMinutes = Math.round(itemHours * 60);
      var startTime = self._minutesToHHMM(cursorMinutes);
      var endTime = self._minutesToHHMM(cursorMinutes + durMinutes);
      cursorMinutes += durMinutes;

      var updates = {};
      if (a.hoursSpent !== itemHours) updates.hoursSpent = itemHours;
      if (a.startTime !== startTime) updates.startTime = startTime;
      if (a.endTime !== endTime) updates.endTime = endTime;
      if (Object.keys(updates).length > 0) self.updateItem('dwmActivities', a.id, updates);
    });
  },

  // Clears today's ENTIRE plan before Punch In: unticks every Regular DWM
  // point (they stay visible, just excluded - they're auto-filled from
  // KRAs so there's nothing to "delete") and deletes every extra KRA
  // activity / Special Assignment the employee added for today, since
  // those exist only because they were explicitly added. A full reset
  // back to a blank slate, used by the "Reset Plan" button - only ever
  // callable before Punch In (the DWM page itself enforces that; this
  // function has no opinion on punch state, same as every other mutator
  // here).
  resetTodayDwmPlan: function(empId, date) {
    var self = this;
    var todayActs = (this.getCollection('dwmActivities') || []).filter(function(a) {
      return a.employeeId === empId && a.date === date;
    });
    todayActs.forEach(function(a) {
      if (a.isAutoGenerated) {
        if (a.isTicked !== false) self.updateItem('dwmActivities', a.id, { isTicked: false, hoursSpent: 0, startTime: '', endTime: '', userEditedTime: false });
      } else {
        self.deleteItem('dwmActivities', a.id);
      }
    });
  },

  // Number of working days (everything except Sunday) from the 1st of the
  // given month up to and including uptoDay. Shared by every attendance/
  // DWM compliance % calculation so "a working day" means the same thing
  // everywhere in the app.
  computeWorkingDaysElapsedInMonth: function(year, month, uptoDay) {
    var count = 0;
    for (var d = 1; d <= uptoDay; d++) {
      var dt = new Date(year, month - 1, d);
      if (dt.getDay() !== 0) count++;
    }
    return count || 1;
  },

  // Attendance compliance % for a set of employees, for the month
  // containing refDate (defaults to today). Averages each employee's own
  // Completed-attendance-day count against the elapsed working days this
  // month, then expresses that as a %. An employee (or a whole group)
  // with zero logged attendance this month correctly scores 0% - this
  // must NEVER fall back to "assume full compliance" just because other
  // employees elsewhere in the shared attendance collection have records;
  // that false-confidence shortcut was already identified and removed
  // from the equivalent DWM compliance calculation, but survived here
  // unnoticed until now.
  computeAttendanceCompliance: function(empIds, attendance, refDate) {
    refDate = refDate || new Date();
    var curM = refDate.getMonth() + 1;
    var curY = refDate.getFullYear();
    var mStr = (curM < 10 ? '0' + curM : curM) + '/' + curY;
    var workingDaysElapsed = this.computeWorkingDaysElapsedInMonth(curY, curM, refDate.getDate());

    var idSet = {};
    (empIds || []).forEach(function(id) { idSet[id] = true; });

    var completedByEmp = {};
    (attendance || []).forEach(function(att) {
      if (!att || !idSet[att.employeeId] || att.status !== 'Completed') return;
      if (!att.date || (att.date.indexOf(mStr) === -1 && att.date.indexOf('/' + curM + '/' + curY) === -1)) return;
      completedByEmp[att.employeeId] = (completedByEmp[att.employeeId] || 0) + 1;
    });

    var empCount = (empIds || []).length || 1;
    var totalCompletedDays = 0;
    Object.keys(completedByEmp).forEach(function(k) { totalCompletedDays += completedByEmp[k]; });
    var avgCompletedDays = Math.round(totalCompletedDays / empCount);
    var pct = Math.min(100, Math.round((avgCompletedDays / workingDaysElapsed) * 100));

    return { pct: pct, avgCompletedDays: avgCompletedDays, workingDaysElapsed: workingDaysElapsed };
  },

  // DWM compliance % for a set of employees, for the month containing
  // refDate - the % of elapsed calendar days this month on which at least
  // one of their DWM activities was actually updated off Pending. Same
  // "zero logged means zero %, never a false fallback" rule as above.
  computeDwmCompliance: function(empIds, dwmActivities, refDate) {
    refDate = refDate || new Date();
    var curM = refDate.getMonth() + 1;
    var curY = refDate.getFullYear();
    var mStr = (curM < 10 ? '0' + curM : curM) + '/' + curY;
    var elapsedDaysThisMonth = refDate.getDate();

    var idSet = {};
    (empIds || []).forEach(function(id) { idSet[id] = true; });

    var dwmDatesMap = {};
    (dwmActivities || []).forEach(function(a) {
      if (!a || !idSet[a.employeeId] || a.isTicked === false) return;
      if (!a.date || (a.date.indexOf(mStr) === -1 && a.date.indexOf('/' + curM + '/' + curY) === -1)) return;
      if (a.accomplishmentStatus && a.accomplishmentStatus !== 'Pending') {
        dwmDatesMap[a.date] = true;
      }
    });

    var dwmDaysCount = Object.keys(dwmDatesMap).length;
    var pct = Math.min(100, Math.round((dwmDaysCount / elapsedDaysThisMonth) * 100));

    return { pct: pct, dwmDaysCount: dwmDaysCount, elapsedDaysThisMonth: elapsedDaysThisMonth };
  },

  // Computes a Special Assignment's duration in decimal hours from
  // "HH:MM" 24-hour start/end time strings (what a native <input
  // type="time"> gives back). Returns null if the range is invalid (end
  // not after start) so the caller can reject it instead of silently
  // saving a zero/negative-duration entry.
  computeTimeRangeHours: function(startTime, endTime) {
    if (!startTime || !endTime) return null;
    var startParts = startTime.split(':');
    var endParts = endTime.split(':');
    if (startParts.length < 2 || endParts.length < 2) return null;
    var startMinutes = (Number(startParts[0]) * 60) + Number(startParts[1]);
    var endMinutes = (Number(endParts[0]) * 60) + Number(endParts[1]);
    if (isNaN(startMinutes) || isNaN(endMinutes) || endMinutes <= startMinutes) return null;
    return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
  },

  // Generates a blank KRA-KPI-DWM CSV template pre-filled with ONE
  // specific employee's own ID/name/vertical on every row, so whoever
  // fills it in (their manager, HR) never has to type their name - the
  // single biggest source of a failed match on re-upload. Same column
  // shape importKraKpiDwmFromCsv() expects, so the filled-in file can be
  // uploaded straight back through either the dossier's upload button or
  // the KRA Targets page's bulk importer with no reformatting.
  generateEmployeeKraTemplate: function(empId) {
    var employees = this.getCollection('employees') || [];
    var emp = employees.find(function(e) { return e.employeeId === empId; });
    var empName = emp ? emp.fullName : empId;
    var vertical = emp ? (emp.vertical || '') : '';

    function csvField(v) {
      var s = String(v === undefined || v === null ? '' : v);
      return (s.indexOf(',') !== -1 || s.indexOf('"') !== -1) ? ('"' + s.replace(/"/g, '""') + '"') : s;
    }

    var headers = ['Employee ID *', 'Employee Name', 'Vertical / Business Line *', 'Sub-Vertical / Revenue Pattern', 'KRA (Key Result Area) *', 'KPI (how measured) *', 'Unit *', 'Data Source *', 'Weight %', 'Type', 'Lead / Lag', "Rolls Up To (Manager's KRA/KPI)", 'Annual / AOP Target *', 'Half-Yearly Target', 'Quarterly Target', 'Monthly Target', 'Weekly Target', 'Daily / DWM Control (what to check daily)', 'Remarks'].join(',');

    var blankRow = [empId, empName, vertical, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''].map(csvField).join(',');

    var rows = [headers];
    for (var i = 0; i < 5; i++) rows.push(blankRow);
    rows.push('# HOW TO FILL: one row per KRA for ' + empName + ' - Employee ID/Name/Vertical are already filled in, leave them as-is. Fill in KRA, KPI, Annual Target and Daily/DWM Control for each KRA; leave extra rows blank if not needed, or copy a row for more. Daily/DWM Control is what ' + empName + ' should do every day for that KRA - write "1. ... 2. ..." if there is more than one daily action, and each number becomes its own trackable line in DWM.');

    return {
      filename: 'kra_dwm_template_' + empId.replace(/[^a-zA-Z0-9-]/g, '_') + '.csv',
      content: rows.join('\n') + '\n'
    };
  },

  // Strips honorifics/punctuation and collapses whitespace so "Mr.
  // Ravichandran" and "Ravichandran Ramanathan" compare on the same
  // footing.
  _normalizeNameForMatch: function(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/\b(mr|mrs|ms|miss|dr)\.?\b/g, '')
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  // Standard edit-distance (insert/delete/substitute) between two
  // strings - used to catch single-letter spelling variants between two
  // independently-maintained name lists (e.g. "Balaram" vs "Balram",
  // "Mathiarasu" vs "Mathiyarasu") that a plain prefix check misses.
  _levenshteinDistance: function(a, b) {
    var m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    var prev = [];
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      var curr = [i];
      for (var j2 = 1; j2 <= n; j2++) {
        var cost = a[i - 1] === b[j2 - 1] ? 0 : 1;
        curr[j2] = Math.min(prev[j2] + 1, curr[j2 - 1] + 1, prev[j2 - 1] + cost);
      }
      prev = curr;
    }
    return prev[n];
  },

  // Matches a free-text name (e.g. from an external HR spreadsheet) against
  // the live employees collection. Exact token match handles "Murugan
  // Kumar" vs "Mr. Murugan V"; a same-prefix check (>=4 chars) catches
  // nickname/short-form cases like "Dipanwita Dutta" vs "Ms. Dipa"; an
  // edit-distance check catches single-letter spelling variants like
  // "Balaram" vs "Balram". Deliberately conservative: a tie between two
  // different employees is reported as ambiguous rather than guessed, and
  // a name with no plausible match is reported as unmatched - this
  // function never silently assigns one person's data to another.
  matchEmployeeByName: function(csvName, employees) {
    var norm = this._normalizeNameForMatch(csvName);
    var csvTokens = norm.split(' ').filter(function(t) { return t.length >= 3; });
    if (csvTokens.length === 0) return { match: null, reason: 'empty-name' };

    var self = this;
    function tokensOverlap(a, b) {
      if (a === b) return true;
      var minLen = Math.min(a.length, b.length);
      if (minLen >= 4 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return true;
      if (minLen >= 6) {
        var maxAllowedDist = minLen >= 9 ? 2 : 1;
        if (self._levenshteinDistance(a, b) <= maxAllowedDist) return true;
      }
      return false;
    }
    var scored = (employees || []).map(function(e) {
      var empTokens = self._normalizeNameForMatch(e.fullName || '').split(' ').filter(function(t) { return t.length >= 3; });
      var overlap = csvTokens.filter(function(ct) {
        return empTokens.some(function(et) { return tokensOverlap(ct, et); });
      }).length;
      return { emp: e, overlap: overlap };
    }).filter(function(s) { return s.overlap > 0; });

    scored.sort(function(a, b) { return b.overlap - a.overlap; });

    if (scored.length === 0) return { match: null, reason: 'no-match' };
    if (scored.length > 1 && scored[0].overlap === scored[1].overlap) {
      return { match: null, reason: 'ambiguous', candidates: scored.filter(function(s) { return s.overlap === scored[0].overlap; }).map(function(s) { return s.emp.fullName + ' (' + s.emp.employeeId + ')'; }) };
    }
    return { match: scored[0].emp, reason: 'matched' };
  },

  // Bulk-imports an "Employee Role & Target Input Form" style KRA-KPI-DWM
  // CSV (Employee Name, KRA, KPI, Unit, Data Source, Weight %, Type,
  // Lead/Lag, Rolls Up To, Annual/Half-Yearly/Quarterly/Monthly/Weekly
  // Target, Daily/DWM Control, Remarks). Matches rows to existing
  // employees by name (never by whatever ID scheme the source sheet
  // uses, which may not match this app's employeeId at all), splits a
  // multi-point Daily Control cell into individually-trackable DWM
  // points, and upserts by (employeeId, kraName, financialYear) so
  // re-uploading an updated version of the same sheet updates existing
  // KRAs instead of duplicating them. Returns a full report rather than
  // silently applying anything uncertain - the caller decides what to do
  // with unmatched/ambiguous rows.
  importKraKpiDwmFromCsv: function(csvText) {
    var self = this;
    var rows = this.parseCSVRows(csvText);
    var result = { imported: 0, updated: 0, matched: [], unmatched: [], ambiguous: [], skippedRows: 0 };
    if (rows.length < 2) return result;

    var headers = rows[0].map(function(h) { return h.trim(); });
    function colIdx(fragment) {
      var frag = fragment.toLowerCase();
      for (var i = 0; i < headers.length; i++) {
        if (headers[i].toLowerCase().indexOf(frag) !== -1) return i;
      }
      return -1;
    }

    var idx = {
      employeeName: colIdx('Employee Name'),
      vertical: colIdx('Vertical / Business Line'),
      subVertical: colIdx('Sub-Vertical'),
      kraName: colIdx('KRA'),
      kpi: colIdx('KPI'),
      unit: colIdx('Unit'),
      dataSource: colIdx('Data Source'),
      weight: colIdx('Weight'),
      type: colIdx('Type'),
      leadLag: colIdx('Lead / Lag'),
      rollsUpTo: colIdx('Rolls Up To'),
      annualTarget: colIdx('Annual'),
      halfYearlyTarget: colIdx('Half-Yearly'),
      quarterlyTarget: colIdx('Quarterly'),
      monthlyTarget: colIdx('Monthly'),
      weeklyTarget: colIdx('Weekly'),
      dailyControl: colIdx('Daily'),
      remarks: colIdx('Remarks')
    };

    var employees = this.getCollection('employees') || [];
    var currentFy = (typeof getCurrentFinancialYear === 'function') ? getCurrentFinancialYear() : '2026-27';
    var existingKras = this.getCollection('kraTargets') || [];

    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var kraName = idx.kraName >= 0 ? (row[idx.kraName] || '').trim() : '';
      var csvEmpName = idx.employeeName >= 0 ? (row[idx.employeeName] || '').trim() : '';
      if (!kraName || !csvEmpName) { result.skippedRows++; continue; }

      var matchResult = this.matchEmployeeByName(csvEmpName, employees);
      if (!matchResult.match) {
        if (matchResult.reason === 'ambiguous') {
          result.ambiguous.push({ csvName: csvEmpName, kraName: kraName, candidates: matchResult.candidates });
        } else {
          result.unmatched.push({ csvName: csvEmpName, kraName: kraName });
        }
        continue;
      }

      var emp = matchResult.match;
      var dailyControlRaw = idx.dailyControl >= 0 ? (row[idx.dailyControl] || '').trim() : '';
      var points = self.splitDailyControlIntoPoints(dailyControlRaw);
      var kpiVal = idx.kpi >= 0 ? (row[idx.kpi] || '').trim() : '';
      var annualTargetVal = idx.annualTarget >= 0 ? (Number(row[idx.annualTarget]) || 0) : 0;
      var verticalVal = idx.vertical >= 0 ? (row[idx.vertical] || '').trim() : '';

      var record = {
        employeeId: emp.employeeId,
        employeeName: emp.fullName,
        financialYear: currentFy,
        kraName: kraName,
        kpi: kpiVal,
        targetMetric: kpiVal,
        unit: idx.unit >= 0 ? (row[idx.unit] || '').trim() : '',
        dataSource: idx.dataSource >= 0 ? (row[idx.dataSource] || '').trim() : '',
        weight: idx.weight >= 0 ? (Number(row[idx.weight]) || 0) : 0,
        type: idx.type >= 0 ? (row[idx.type] || '').trim() : '',
        leadLag: idx.leadLag >= 0 ? (row[idx.leadLag] || '').trim() : '',
        rollsUpTo: idx.rollsUpTo >= 0 ? (row[idx.rollsUpTo] || '').trim() : '',
        annualTarget: annualTargetVal,
        targetValue: annualTargetVal,
        halfYearlyTarget: idx.halfYearlyTarget >= 0 ? (Number(row[idx.halfYearlyTarget]) || 0) : 0,
        quarterlyTarget: idx.quarterlyTarget >= 0 ? (Number(row[idx.quarterlyTarget]) || 0) : 0,
        monthlyTarget: idx.monthlyTarget >= 0 ? (Number(row[idx.monthlyTarget]) || 0) : 0,
        weeklyTarget: idx.weeklyTarget >= 0 ? (Number(row[idx.weeklyTarget]) || 0) : 0,
        aopLine: verticalVal,
        vertical: verticalVal,
        subVertical: idx.subVertical >= 0 ? (row[idx.subVertical] || '').trim() : '',
        dailyControl: dailyControlRaw,
        dailyControlPoints: points,
        remarks: idx.remarks >= 0 ? (row[idx.remarks] || '').trim() : ''
      };

      var existing = existingKras.find(function(k) {
        return k.employeeId === emp.employeeId && k.kraName === kraName && (k.financialYear || currentFy) === currentFy;
      });

      if (existing) {
        self.updateItem('kraTargets', existing.id, record);
        result.updated++;
      } else {
        var saved = self.addItem('kraTargets', record);
        existingKras.push(saved);
        result.imported++;
      }
      result.matched.push({ csvName: csvEmpName, matchedTo: emp.fullName, employeeId: emp.employeeId, kraName: kraName, pointCount: points.length });
    }

    return result;
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

    var newTaxInvNumber = this.generateNextInvoiceNumber(false, pi.companyId);
    // Same as raising a fresh invoice — no auto-approve shortcut for any
    // role. The Primary Approver must sign off before this can be sent.
    var status = 'Pending Senior Approval';
    var approvalInfo = null;

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

    // An unticked activity (shown in Section A but excluded from today's
    // confirmed plan) was never part of the day's committed work - it
    // never appears in Section B and nobody ever updates its status, so
    // counting it here would permanently drag down scores/compliance with
    // activities that were deliberately left out. Only records predating
    // this field (isTicked undefined) are kept, for backward compatibility.
    activities = (activities || []).filter(function(a) { return a && a.isTicked !== false; });

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

      // Credit percentages must match the DWM accomplishment dropdown's
      // own labels exactly (Done 100% / Not Done 0%). An activity still
      // sitting at "Pending" (never updated) earns no credit either - same
      // as Not Done - since nothing was actually confirmed yet. This
      // applies equally to Special Assignments now: a still-Pending
      // "Training 2-5pm" entry used to count as fully productive the
      // instant it was logged, before anyone confirmed it actually
      // happened - the same false-confidence problem the day-level 100%
      // shortcut had, just one level down.
      // Partial no longer assumes a fixed 70% - the employee types the
      // actual % done, which is what gets credited here. A Partial record
      // saved before this field existed (accomplishmentPercent missing)
      // falls back to the old fixed 70% so historical scores don't shift.
      if (isSpecial) {
        hasSpecialAssignment = true;
        specialAssignmentType = act.specialAssignmentType || act.category || 'Special Assignment';
        specialAssignmentHours += duration;
      }
      if (isCompleted) {
        productiveHours += duration;
        completedCount++;
      } else if (isPartial) {
        var pct = act.accomplishmentPercent;
        var fraction = (typeof pct === 'number' && !isNaN(pct) && pct >= 0 && pct <= 100) ? (pct / 100) : 0.7;
        productiveHours += (duration * fraction);
      }
    });

    // A Special Assignment's own hours are credited the same tiered way
    // as regular KRA work once confirmed (Done/Partial/Not Done), but it
    // no longer makes the ENTIRE day auto-score 100% regardless of what
    // else happened. That shortcut made sense back when a special
    // assignment was always assumed to consume the whole 8-hour day; now
    // that they carry their own explicit time range and can coexist with
    // Regular DWM on the same day, crediting the whole day from one short
    // Special Assignment would hide genuinely poor KRA performance from
    // the reporting manager - exactly the "clear idea of output" this
    // model exists to protect.
    var score = 0;
    if (standardHours > 0) {
      score = Math.min(100, Math.round((productiveHours / standardHours) * 100));
    } else if (activities.length > 0) {
      score = Math.min(100, Math.round((completedCount / activities.length) * 100));
    }

    var summaryText = hasSpecialAssignment ?
      (completedCount + " of " + activities.length + " tasks completed, incl. " + specialAssignmentType + " (" + Math.round(specialAssignmentHours * 10)/10 + " hrs) (" + score + "%)") :
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
  // Returns prescribed CSV format template, sample rows, and - for every
  // field validated against a live Master Data list or a fixed in-app
  // set of values - the "# ALLOWED VALUES" legend lines to prepend, so
  // every bulk-upload surface (the Data Center "Download Template"
  // button, which covers far more collections than Master Data's own
  // per-tab upload does) gives the same guidance. Built once per call
  // (not cached) so the legend always reflects whatever's configured in
  // Master Data right now.
  getPrescribedCsvTemplate: function(masterType) {
    var self = this;
    var templates = {
      clients: {
        filename: "measure_di_clients_master_template.csv",
        headers: "clientCode,clientName,gstin,contactPerson,email,phone,address,city,state,vertical,creditPeriodDays",
        legendFields: [{ column: 'vertical', collectionName: 'verticalClassificationMaster' }],
        sampleRows: [
          "CL-001,JSW Steel Limited,29AAACJ1011A1Z2,Mr. Raghunath Verma,r.verma@jsw.in,9840112233,Toranagallu Slag Yard,Ballari,Karnataka,Projects,30",
          "CL-002,Tata Steel Limited,20AAACT2702H1ZQ,Mr. Amitav Sen,amitav.sen@tatasteel.com,9840223344,Jamshedpur Steel Works,Jamshedpur,Jharkhand,Projects,45",
          "CL-003,UltraTech Cement Ltd,27AAACU0147L1ZF,Mr. Suresh Pillai,suresh.p@ultratech.adityabirla.com,9840334455,Awarpur Cement Works,Chandrapur,Maharashtra,Service and Parts,30",
          "CL-004,Bharat Heavy Electricals (BHEL),33AAACB1234A1Z5,Mr. K. Natarajan,natarajan@bhel.in,9840445566,Boiler Plant HPBP,Trichy,Tamil Nadu,Projects,60",
          "CL-005,Saint-Gobain India,33AAACS1234C1Z8,Mr. Ramesh Krishnan,ramesh.k@saint-gobain.com,9840556677,World Glass Complex,Sriperumbudur,Tamil Nadu,Onboard,30"
        ]
      },
      projects: {
        filename: "measure_di_projects_master_template.csv",
        headers: "projectCode,projectName,clientName,vertical,projectValue,startDate,targetCompletionDate,projectManagerName,status,budgetINR",
        legendFields: [
          { column: 'vertical', collectionName: 'verticalClassificationMaster' },
          // Not yet enforced by a dropdown anywhere in the app today, but
          // listed here since these are the values every other project
          // record actually uses - typing a 6th, different word would
          // still "work" (nothing rejects it) but would make this
          // project an outlier no report/filter can group correctly.
          { column: 'status', values: ['Planning', 'In Execution', 'Completed', 'On Hold', 'Cancelled'], strict: false }
        ],
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
        legendFields: [
          { column: 'vertical', collectionName: 'verticalClassificationMaster' },
          // Exact match required, case-sensitive - this is the same value
          // every permission check (firestore.rules, every checkAuth(['admin',...])
          // call) tests against, so a typo here doesn't just look wrong,
          // it silently grants the wrong access.
          { column: 'role', values: ['super_admin', 'admin', 'manager', 'staff'] },
          { column: 'workArrangement', values: ['Head Office', 'Site / On-Field', 'Hybrid'], strict: false }
        ],
        sampleRows: [
          "E-006,Senthil Nathan,Senior Field Commissioning Engineer,Projects,E-003,Mrs. Anitha,senthil@measuredi.com,9840667788,staff,Site / On-Field,01/06/2021,true",
          "E-007,Deepa Radhakrishnan,Inside Sales & Quotations Engineer,Onboard,E-002,Mr. Murugan V,deepa@measuredi.com,9840778899,staff,Head Office,15/07/2021,true",
          "E-008,Karthik Subramanian,Territory Service Executive,Service and Parts,E-002,Mr. Murugan V,karthik@measuredi.com,9840889900,staff,Hybrid,01/08/2022,true",
          "E-009,Manoj Kumar,Embedded Hardware & Firmware Engineer,Projects,E-003,Mrs. Anitha,manoj@measuredi.com,9840990011,staff,Head Office,10/01/2023,true",
          "E-010,Venkatesh Babu,Lead Metrology Specialist,Crane,E-003,Mrs. Anitha,venkatesh@measuredi.com,9840001122,manager,Head Office,01/03/2023,true"
        ]
      },
      spareParts: {
        filename: "measure_di_spare_parts_master_template.csv",
        headers: "partNumber,partName,vertical,category,compatibleModel,hsnCode,unitPrice,gstPercent,uom,stockQty,minReorderLevel,leadTimeDays",
        legendFields: [
          { column: 'vertical', collectionName: 'verticalClassificationMaster' },
          { column: 'gstPercent', values: ['18', '12', '5', '0'] }
        ],
        sampleRows: [
          "SP-LC-50T,High Precision 50-Ton Shear Beam Load Cell,Service and Parts,Load Cells,Crane Scales CS-50T,90318000,45000,18,Nos,24,5,7",
          "SP-ENC-1000,Optical Rotary Encoder 1000 PPR Stainless Steel,Service and Parts,Sensors & Encoders,In-Motion Rail Weighers,90319000,18500,18,Nos,40,10,5",
          "SP-DISP-7S,Industrial High-Brightness 6-Digit LED Display Indicator,Service and Parts,Displays & Terminals,All Measure DI Weighers,85285900,28000,18,Nos,18,4,10",
          "SP-JB-04IP,IP68 Stainless Steel 4-Channel Analog Junction Box,Service and Parts,Junction Boxes,Weighbridges & Hoppers,85369090,6500,18,Nos,55,15,3",
          "SP-LAS-SCAN,High-Speed Multi-Line Laser Surface Profiler Head,Service and Parts,Optical Metrology,Laser Scanners LS-200,90314900,145000,18,Sets,8,2,21",
          "SP-CAL-20T,Certified Class M1 20-Ton Heavy Calibration Test Block,Service and Parts,Calibration Standards,Crane & Weighbridge,90319000,85000,18,Nos,6,1,14"
        ]
      },
      leads: {
        filename: "measure_di_leads_crm_template.csv",
        // Matches the real field names leads.js itself writes on every
        // lead record (see handleSaveLead's newLead object), so an
        // imported row behaves identically to one entered by hand -
        // including showing up correctly on the funnel, dashboard, and
        // per-rep filters. "stage" uses the current pipeline wording
        // (Contacted/Qualified/.../Won, or Trashed/Lost/Postponed) - the
        // older 8-stage wording this template used before the pipeline
        // rewrite is no longer recognized anywhere in the app.
        headers: "leadNumber,customerName,leadSource,industry,projectSector,vertical,productName,hsnCode,currency,estimatedValue,expectedValue,targetDate,stage,contactPerson,contactPhone,contactEmail,notes,employeeId,employeeName,createdDate,createdAt",
        legendFields: [
          { column: 'leadSource', collectionName: 'leadSourceMaster' },
          { column: 'industry', collectionName: 'verticalClassificationMaster' },
          { column: 'projectSector', collectionName: 'projectSectorMaster' },
          { column: 'vertical', collectionName: 'verticalClassificationMaster' },
          { column: 'currency', collectionName: 'currencyMaster', valueField: 'code' },
          { column: 'stage', values: self.LEAD_PIPELINE_STAGES.concat(self.LEAD_EXIT_STAGES) }
        ],
        sampleRows: [
          "LD-2026-1001,JSW Steel Limited,Existing Client,Projects,Steel,Projects,Dynamic In-Motion Train Weigher (IMW-500),90318000,INR,4500000,4500000,2026-06-30,Quoted,Mr. Raghunath Verma,9840112233,r.verma@jsw.in,Follow-up after site visit,E-002,Mr. Murugan V,15/04/2026,2026-04-15T10:30:00.000Z",
          "LD-2026-1002,Ambuja Cements,Tender / E-Procurement Portal,Projects,Cement,Projects,Wireless Crane Scale 50T (CS-50W),84238900,INR,2400000,2400000,2026-07-15,Qualified,Ms. Priya Nair,9840556677,priya.nair@ambuja.com,,E-004,Mrs. Subhashini,02/05/2026,2026-05-02T09:00:00.000Z"
        ]
      },
      orders: {
        filename: "measure_di_orders_template.csv",
        headers: "orderId,customerName,companyId,vertical,quotationId,leadId,poNumber,poDate,orderValue,gstPercent,advancePercent",
        legendFields: [
          { column: 'vertical', collectionName: 'verticalClassificationMaster' },
          { column: 'gstPercent', values: ['18', '12', '5', '0'] },
          { column: 'companyId', collectionName: 'companyMaster', valueField: 'id' }
        ],
        sampleRows: [
          "ORD-2026-99,JSW Steel Limited,company_measuredi,Projects,,,PO-JSW-99812,02/08/2026,1500000,18,30"
        ]
      },
      invoices: {
        filename: "measure_di_invoices_template.csv",
        headers: "invoiceNumber,invoiceType,customerName,customerGstin,vertical,taxableValue,taxAmount,grandTotal,status,dueDate",
        legendFields: [
          { column: 'invoiceType', values: ['Tax Invoice', 'Proforma Invoice'] },
          { column: 'vertical', collectionName: 'verticalClassificationMaster' },
          { column: 'status', values: ['Pending Senior Approval', 'Approved', 'Issued', 'Cancelled'] }
        ],
        sampleRows: [
          "INV/2026-27/088,Tax Invoice,Tata Steel Limited,20AAACT2702H1ZQ,Projects,500000,90000,590000,Approved,30/09/2026"
        ]
      },
      quotations: {
        filename: "measure_di_quotations_template.csv",
        // Header-level fields only - a quotation's line items are a
        // nested list (description/qty/rate/tax per row) that can't be
        // flattened into one CSV row sensibly, so a bulk-imported
        // quotation is created with its commercial header set and its
        // line items are then added by opening it in the app, the same
        // as any quotation that needs a correction.
        headers: "quoteNumber,leadId,companyId,customerName,contactPerson,email,mobile,address,vertical,employeeId,validityDays,deliveryLeadTime,advancePercent,overallDiscountPercent,termsAndConditions",
        legendFields: [
          { column: 'vertical', collectionName: 'verticalClassificationMaster' },
          { column: 'companyId', collectionName: 'companyMaster', valueField: 'id' }
        ],
        sampleRows: [
          "QT-2026-004,,company_measuredi,Sundaram Fasteners Ltd,Mr. S. K. Raman,sk.raman@sfl.co.in,9884512345,\"Plot 14, Ambattur Industrial Estate, Chennai\",Projects,E-002,30,3-4 Weeks from advance PO,50,10,\"1. 50% advance along with Purchase Order. 2. Balance 50% before dispatch.\""
        ]
      },
      dwmActivities: {
        filename: "measure_di_dwm_activity_log_template.csv",
        headers: "employeeId,date,activityDescription,category,hoursSpent,linkedKra,linkedAopLine",
        legendFields: [
          { column: 'category', values: ['Standard KRA Activity', 'Full Day Training', 'Full Day Meeting', 'Client Emergency Call', 'Special Assignment'] }
        ],
        sampleRows: [
          "E-005,04/10/2026,Site inspection at JSW Steel Slag Yard for load cell calibration,Standard KRA Activity,2.0,Territory Revenue Generation,Sales"
        ]
      },
      payments: {
        filename: "measure_di_payments_collections_template.csv",
        headers: "invoiceNumber,customerName,amount,tdsAmount,paymentReason,paymentMode,utrNumber,bankAccount,paymentDate,paymentMilestone,remarks",
        legendFields: [
          { column: 'paymentReason', values: ['Advance', 'Part payment', 'Final payment', 'Final payment after write-off', 'Final payment after goodwill adjustment'] },
          { column: 'paymentMode', values: ['NEFT/RTGS', 'Cheque', 'UPI', 'Wire Transfer', 'Letter of Credit', 'Cash'] }
        ],
        sampleRows: [
          "INV/2026-27/014,Sundaram Fasteners Ltd,500000,5000,Advance,NEFT/RTGS,UTR192837465,HDFC Bank - 50200049283719 (Guindy Branch),04/10/2026,1st Milestone Advance Payment against Purchase Order,TDS challan reference attached"
        ]
      },
      attendance: {
        filename: "measure_di_attendance_backfill_template.csv",
        // Live attendance is only ever created by the Punch In/Out GPS
        // buttons (attendance.html), never by hand - this template is
        // for backfilling historical records only (e.g. from a previous
        // manual register), so GPS location fields are intentionally
        // left out.
        headers: "employeeId,date,punchInTime,punchOutTime,workedHours,status",
        legendFields: [
          { column: 'status', values: ['Punched In', 'Completed'] }
        ],
        sampleRows: [
          "E-004,04/10/2026,2026-10-04T03:45:12.000Z,2026-10-04T13:00:00.000Z,7.5,Completed"
        ]
      },
      kraTargets: {
        filename: "measure_di_kra_targets_template.csv",
        headers: "employeeId,kraName,dailyControl,targetMetric,targetValue,aopLine",
        legendFields: [
          { column: 'aopLine', values: ['Sales', 'Service/Parts', 'Projects'] }
        ],
        sampleRows: [
          "E-004,Territory Revenue Generation,Conduct minimum 3 customer plant visits daily and log quote follow-ups,Revenue (INR),10000000,Sales"
        ]
      }
    };

    var tmpl = templates[masterType] || templates.clients;
    var headerCols = tmpl.headers.split(',');
    tmpl.legendGrid = self.buildDropdownLegendGrid(headerCols, tmpl.legendFields || []);
    return tmpl;
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
      var amt = Number(adj.adjustmentAmount) || 0;
      if (adj.adjustmentType && adj.adjustmentType.indexOf('Write-Off') !== -1) {
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
    var isWriteOff = adjData.adjustmentType && adjData.adjustmentType.indexOf('Write-Off') !== -1;
    var refNum = adjData.adjustmentNumber || this.generateNextAdjustmentNumber(isWriteOff);

    var newAdj = {
      id: adjData.id || ('adj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
      adjustmentNumber: refNum,
      refNumber: refNum,
      adjustmentType: adjData.adjustmentType || (isWriteOff ? 'Bad Debt Write-Off (Unrecoverable AR)' : 'Goodwill Discount / Commercial Adjustment'),
      invoiceId: adjData.invoiceId || '',
      invoiceNumber: adjData.invoiceNumber || '',
      customerName: adjData.customerName || '',
      invoiceGrandTotal: Number(adjData.invoiceGrandTotal) || 0,
      currentBalanceDue: Number(adjData.currentBalanceDue) || 0,
      adjustmentAmount: Number(adjData.adjustmentAmount) || 0,
      reasonCategory: adjData.reasonCategory || (isWriteOff ? 'Long Outstanding Unrecoverable' : 'Goodwill Customer Concession'),
      detailedJustification: adjData.commercialJustification || adjData.detailedJustification || '',
      requestedBy: adjData.requestedBy || 'Staff',
      requestedByEmpId: adjData.requestedByEmpId || '',
      requestedDate: adjData.requestDate || adjData.requestedDate || getFormattedToday(),
      // Every write-off / goodwill request requires all three named
      // authorities to sign off before it counts — no shortcut for any role.
      status: 'Pending Director Approval',
      primaryApproverSignoff: null,
      financeHeadSignoff: null,
      directorSignoff: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    var saved = this.addItem('arAdjustments', newAdj);
    return saved;
  },

  // One of the three required signatures on a write-off/goodwill request.
  // `signoffKey` is one of: 'primaryApproverSignoff', 'financeHeadSignoff', 'directorSignoff'.
  // The adjustment only takes effect (reduces the invoice balance) once all
  // three are present and none rejected.
  signArAdjustment: function(adjId, signoffKey, decision, signerName, signerEmpId, remarks) {
    var validKeys = ['primaryApproverSignoff', 'financeHeadSignoff', 'directorSignoff'];
    if (validKeys.indexOf(signoffKey) === -1) return { success: false, error: 'Invalid signoff type.' };

    var arAdjustments = this.getCollection('arAdjustments') || [];
    var adj = arAdjustments.find(function(it) { return it.id === adjId; });
    if (!adj) return { success: false, error: 'Adjustment record not found.' };

    var isApproved = decision === 'Approved';
    var signoff = {
      decision: isApproved ? 'Approved' : 'Rejected',
      signedBy: signerName || 'Approver',
      signedByEmpId: signerEmpId || '',
      signedAt: getFormattedToday() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      remarks: remarks || ''
    };

    var updates = {};
    updates[signoffKey] = signoff;

    var afterPrimary = signoffKey === 'primaryApproverSignoff' ? signoff : adj.primaryApproverSignoff;
    var afterFinance = signoffKey === 'financeHeadSignoff' ? signoff : adj.financeHeadSignoff;
    var afterDirector = signoffKey === 'directorSignoff' ? signoff : adj.directorSignoff;

    if (!isApproved) {
      updates.status = 'Rejected';
    } else if (afterPrimary && afterPrimary.decision === 'Approved' &&
               afterFinance && afterFinance.decision === 'Approved' &&
               afterDirector && afterDirector.decision === 'Approved') {
      updates.status = 'Approved';
    } else {
      updates.status = 'Pending Director Approval';
    }

    updates.updatedAt = new Date().toISOString();
    this.updateItem('arAdjustments', adjId, updates);

    if (updates.status === 'Approved' && (adj.invoiceId || adj.invoiceNumber)) {
      this.syncInvoicePaymentStatus(adj.invoiceId || adj.invoiceNumber);
    }

    return { success: true, adjustment: Object.assign({}, adj, updates), status: updates.status };
  },

  getPendingDirectorApprovals: function() {
    var arAdjustments = this.getCollection('arAdjustments') || [];
    return arAdjustments.filter(function(adj) {
      return adj.status === 'Pending Director Approval';
    });
  },

  // ============ SHARED TWO-STAGE APPROVAL (Quotations / Orders / Invoices) ============
  // Stage 1 (Primary Approver, e.g. Sales & Marketing Head): blocking — the
  // team cannot send the quote / confirm the order / raise the invoice until
  // this happens. Stage 2 (Director ratification): tracked for the record,
  // never blocks the team.
  approvePrimaryStage: function(record, approverName, approverEmpId, remarks) {
    record.primaryApprovedBy = approverName;
    record.primaryApprovedByEmpId = approverEmpId || '';
    record.primaryApprovedAt = getFormattedToday() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    record.primaryApprovalRemarks = remarks || '';
    record.directorRatificationStatus = 'Pending';
    return record;
  },

  ratifyByDirector: function(record, directorName, directorEmpId, remarks) {
    record.directorRatificationStatus = 'Ratified';
    record.directorRatifiedBy = directorName;
    record.directorRatifiedByEmpId = directorEmpId || '';
    record.directorRatifiedAt = getFormattedToday() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    record.directorRatificationRemarks = remarks || '';
    return record;
  },

  // ============ ORDER REVENUE / CONTRIBUTION HELPERS ============
  // Single source of truth for "is this order a confirmed booking" and
  // "who gets what share of its revenue" — used by the dashboard, AOP
  // targets, individual scorecards and team rollups so they all agree
  // with the Orders page's own numbers. Understands both the current
  // schema (orders.html: status 'Booked', splits[]/percent, poDate) and
  // the older seed/demo schema (status 'Won', contributors[]/contributionPct,
  // orderDate) so real bookings and legacy demo data both count correctly.
  isOrderWon: function(order) {
    return !!order && (order.status === 'Booked' || order.status === 'Won');
  },

  getOrderContributions: function(order) {
    if (!order) return [];
    var val = Number(order.orderValue || order.value || order.invoiceValue) || 0;
    var raw = (Array.isArray(order.splits) && order.splits.length > 0) ? order.splits
      : (Array.isArray(order.contributors) && order.contributors.length > 0) ? order.contributors
      : [{ employeeId: order.employeeId, percent: 100 }];

    return raw.map(function(c) {
      var pct = Number(c.percent !== undefined ? c.percent : c.contributionPct) || 0;
      return { employeeId: c.employeeId, percent: pct, amount: (val * pct) / 100 };
    });
  },

  // ============ LEAD PIPELINE STAGE MODEL ============
  // Single source of truth for the Lead sales pipeline, so the Leads
  // page, the Dashboard funnel, and every document that auto-advances a
  // Lead (Quotation send, Order booking, Invoice raise) all agree on the
  // same stage names - previously each of those read/wrote a different,
  // mutually-incompatible set of strings (an 8-stage list on the Lead
  // form itself, a different hardcoded 5-stage list on the Dashboard
  // funnel, and a third ad-hoc value written on Quotation send), so the
  // funnel never actually reflected what a real Lead's status was.
  //
  // LEAD_PIPELINE_STAGES is the forward-moving sequence; its array index
  // is used as the stage's "rank" by advanceLeadStage() below. The three
  // LEAD_EXIT_STAGES are outcomes, not pipeline positions - a lead only
  // ever reaches one of them by a person's deliberate choice, never by
  // automatic forward-sync, and once there it's never silently moved
  // again by an automatic sync.
  LEAD_PIPELINE_STAGES: ['Contacted', 'Qualified', 'Quoted', 'Negotiation', 'Order Received', 'Won'],
  LEAD_EXIT_STAGES: ['Trashed', 'Lost', 'Postponed'],
  LEAD_LOST_REASONS: ['Price too high', 'Competitor chosen', 'Budget cut / Project cancelled', 'Not interested / No response', 'Timing not right', 'Other'],

  // Moves a Lead forward to targetStage, automatically, from a real
  // business event (a Quotation actually sent, an Order actually booked,
  // an Invoice actually raised) - never backward, and never overriding a
  // lead a person has already closed out (Trashed/Lost/Postponed), since
  // an automatic sync has no way to know whether that closure is still
  // right. extraFields are merged onto the lead alongside the stage
  // change (e.g. the quote's value, the PO number) in the same write.
  advanceLeadStage: function(leadId, targetStage, extraFields, detailMessage) {
    if (!leadId) return null;
    var leads = this.getCollection('leads') || [];
    var lead = leads.find(function(l) { return l.id === leadId; });
    if (!lead) return null;

    var currentStage = lead.status || lead.stage;
    if (this.LEAD_EXIT_STAGES.indexOf(currentStage) !== -1) return lead;

    var currentRank = this.LEAD_PIPELINE_STAGES.indexOf(currentStage);
    var targetRank = this.LEAD_PIPELINE_STAGES.indexOf(targetStage);
    if (targetRank === -1 || currentRank >= targetRank) return lead;

    var oldLeadState = JSON.parse(JSON.stringify(lead));
    lead.status = targetStage;
    lead.stage = targetStage;
    if (extraFields) {
      Object.keys(extraFields).forEach(function(k) { lead[k] = extraFields[k]; });
    }
    lead.updatedAt = new Date().toISOString();
    this.saveRecord('leads', lead);

    if (this.logAudit) {
      this.logAudit('Leads', lead.id, 'UPDATE', detailMessage || ('Lead stage automatically advanced to "' + targetStage + '"'), oldLeadState, lead);
    }
    return lead;
  },

  // ============ SHARED CSV TOKENIZER ============
  // RFC 4180-aware - a quoted field can safely contain commas, escaped
  // double-quotes (""), and an embedded line break. Single source of
  // truth for every CSV upload surface in the app (Master Data's own
  // per-tab bulk upload and the global Data Center import), so a bug
  // fixed here never has to be separately re-fixed in a second,
  // independently-written parser - which is exactly how the Data
  // Center's naive line.split(',') parser went unnoticed after Master
  // Data's own parser was already upgraded.
  parseCSVRows: function(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var len = text.length;

    while (i < len) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false;
          i++;
          continue;
        }
        field += ch;
        i++;
        continue;
      }

      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') {
        if (text[i + 1] === '\n') { i++; continue; } // let the \n below end the row
        row.push(field); field = ''; rows.push(row); row = []; i++; continue;
      }
      if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; continue; }

      field += ch;
      i++;
    }

    // Flush the final field/row - the file may or may not end with a newline.
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

    // Drop fully blank rows (e.g. a trailing newline producing one empty
    // row) and any instructional "# ..." line a downloaded template
    // prepends (an allowed-values legend) - so forgetting to delete it
    // before uploading can't corrupt real data with a bogus row.
    return rows.filter(function(r) {
      if (r.length === 1 && r[0].trim() === '') return false;
      if ((r[0] || '').trim().indexOf('#') === 0) return false;
      return true;
    });
  },

  // Resolves one legend field's current list of allowed values - either
  // a fixed in-app set ({ values: [...] }) or a live Master Data list
  // ({ collectionName, valueField }), read fresh every call so renaming
  // or adding an entry later is reflected the next time a template is
  // downloaded. Never a frozen snapshot.
  resolveLegendFieldValues: function(fl) {
    if (fl.values) return fl.values;
    if (fl.collectionName) {
      var valueField = fl.valueField || 'name';
      var items = (this.getCollection(fl.collectionName) || []).filter(function(it) { return it.isActive !== false; });
      return items.map(function(it) { return it[valueField]; }).filter(Boolean);
    }
    return [];
  },

  // Builds the allowed-values legend as a grid of CSV rows (each an
  // array matching headers.length, ready to be .join(',')'d) placed
  // directly under the real header row it documents - so in a
  // spreadsheet, each field's list of choices lines up visually under
  // that field's own column instead of being one dense line at the top
  // of the file. "strict" fields (the default: fl.strict !== false) are
  // ones the rest of the app actually matches against exactly - get one
  // on the wrong value and the record silently never shows up anywhere
  // that filters by it. "Flexible" fields (fl.strict: false) are a
  // recommended/usual set shown for consistency, not enforced anywhere.
  // Every row starts with "#" so parseCSVRows drops the whole legend
  // automatically on upload, whether or not it was deleted first.
  buildDropdownLegendGrid: function(headers, fieldLegends) {
    var self = this;
    var colIndex = {};
    headers.forEach(function(h, i) { colIndex[h] = i; });

    var columnValues = {};
    var strictCols = [];
    var flexibleCols = [];
    var maxLen = 0;

    (fieldLegends || []).forEach(function(fl) {
      if (colIndex[fl.column] === undefined) return;
      var names = self.resolveLegendFieldValues(fl);
      if (names.length === 0) return;
      columnValues[fl.column] = names;
      maxLen = Math.max(maxLen, names.length);
      if (fl.strict === false) flexibleCols.push(fl.column);
      else strictCols.push(fl.column);
    });

    var columns = Object.keys(columnValues);
    if (columns.length === 0) return [];

    function blankRow() { return headers.map(function() { return ''; }); }

    var rows = [];
    rows.push(blankRow());

    var banner = blankRow();
    banner[0] = '# ===== ALLOWED VALUES ===== pick from the lists below in each column. Every line starting with # is ignored on upload so leave them where they are.';
    rows.push(banner);

    for (var i = 0; i < maxLen; i++) {
      var row = blankRow();
      row[0] = '#';
      columns.forEach(function(col) {
        var vals = columnValues[col];
        if (vals[i] !== undefined) row[colIndex[col]] = vals[i];
      });
      rows.push(row);
    }

    strictCols.forEach(function(col) {
      var row = blankRow();
      row[0] = '# ' + col + ' — one of the values above and nothing else. Capital letters, extra spaces, or a trailing "s" do not matter - it will still match.';
      rows.push(row);
    });

    if (flexibleCols.length > 0) {
      var flexRow = blankRow();
      flexRow[0] = '# ' + flexibleCols.join(' + ') + ' — these are the usual answers. Something else is allowed if none of them fits.';
      rows.push(flexRow);
    }

    var closing = blankRow();
    closing[0] = '# =====';
    rows.push(closing);

    return rows;
  },

  // Fuzzy-matches a typed value against an allowed-values list, tolerant
  // of exactly what the legend promises: capitalization, leading/
  // trailing whitespace, and a stray trailing "s". Returns the allowed
  // list's own correctly-cased value on a match (so "projects "," PROJECT",
  // and "Project" all resolve to the real "Projects"); returns the typed
  // value unchanged if nothing in the list is a close enough match,
  // rather than guessing - an unmatched value should still fail visibly
  // downstream, not get silently forced onto the wrong option.
  normalizeDropdownValue: function(rawValue, allowedValues) {
    if (rawValue === undefined || rawValue === null || rawValue === '') return rawValue;
    if (!allowedValues || allowedValues.length === 0) return rawValue;
    function simplify(s) {
      s = String(s).toLowerCase().trim();
      if (s.length > 1 && s.charAt(s.length - 1) === 's') s = s.slice(0, -1);
      return s;
    }
    var target = simplify(rawValue);
    for (var i = 0; i < allowedValues.length; i++) {
      if (simplify(allowedValues[i]) === target) return allowedValues[i];
    }
    return rawValue;
  },

  // Applies normalizeDropdownValue to every strict field (fl.strict !==
  // false) present on a bulk-uploaded record, mutating it in place.
  // Flexible fields are left exactly as typed - they're a suggestion,
  // not something to coerce.
  normalizeRecordAgainstLegend: function(record, fieldLegends) {
    var self = this;
    (fieldLegends || []).forEach(function(fl) {
      if (fl.strict === false) return;
      if (record[fl.column] === undefined || record[fl.column] === '') return;
      var allowed = self.resolveLegendFieldValues(fl);
      record[fl.column] = self.normalizeDropdownValue(record[fl.column], allowed);
    });
    return record;
  },

  // Maps a raw Firestore collection name (as passed to bulkUploadItems,
  // e.g. 'clientsMaster', 'leads') to its prescribed template key in
  // getPrescribedCsvTemplate - one shared lookup so the Data Center's
  // download (auth-guard.js) and its upload (bulkUploadItems below) can
  // never disagree about which template a collection's rows came from.
  CSV_TEMPLATE_KEY_BY_COLLECTION: {
    clientsMaster: 'clients',
    projectsMaster: 'projects',
    employees: 'employees',
    sparePartsMaster: 'spareParts',
    leads: 'leads',
    orders: 'orders',
    invoices: 'invoices',
    quotations: 'quotations',
    dwmActivities: 'dwmActivities',
    payments: 'payments',
    attendance: 'attendance',
    kraTargets: 'kraTargets'
  },

  getOrderDate: function(order) {
    if (!order) return '';
    return order.poDate || order.orderDate || order.createdDate || '';
  },

  // ============ CONFIGURATION MASTER LISTS (Lead Source, Industry Vertical,
  // Project Sector, Vertical Classification, Currency) ============
  // Idempotent: only fills a collection the very first time it's empty, so
  // it never overwrites edits made later via the Master Data page. These
  // starting values are the org's real current categories (previously
  // hardcoded directly into leads.html) — not demo/dummy data.
  seedMasterListsIfEmpty: function() {
    var self = this;
    function seedIfEmpty(colName, names) {
      var existing = self.getCollection(colName);
      if (existing && existing.length > 0) return;
      var records = names.map(function(name, i) {
        return { id: colName + '_' + (i + 1), name: name, isActive: true };
      });
      self.saveCollection(colName, records);
    }

    seedIfEmpty('leadSourceMaster', [
      'India Mart', 'Tender / E-Procurement Portal', 'SEO', 'Existing Client', 'Customer Reference',
      'Ariba', 'OEM', 'Mail Marketing / Digital Marketing', 'Direct Customer Approach', 'Exhibition / Trade Fair'
    ]);

    // No longer read by the Lead form or Products Master (both now read
    // verticalClassificationMaster directly, for one single uniform
    // vertical list instead of two that could drift apart in wording).
    // Left seeded, with matching wording, only so its still-visible
    // Master Data tab doesn't show stale "Project"/"Spare/Service" names
    // for old data if anyone opens it.
    seedIfEmpty('industryVerticalMaster', ['Projects', 'Onboard', 'Crane', 'Service and Parts']);

    seedIfEmpty('projectSectorMaster', [
      'Steel', 'Cement', 'Power Plant', 'Infrastructure (Roads & Highways)', 'Mining', 'Other Industries'
    ]);

    seedIfEmpty('verticalClassificationMaster', ['Projects', 'Onboard', 'Crane', 'Service and Parts']);

    var currencyExisting = this.getCollection('currencyMaster');
    if (!currencyExisting || currencyExisting.length === 0) {
      this.saveCollection('currencyMaster', [
        { id: 'currencyMaster_1', code: 'INR', name: 'Indian Rupee', symbol: '₹', isActive: true },
        { id: 'currencyMaster_2', code: 'USD', name: 'US Dollar', symbol: '$', isActive: true },
        { id: 'currencyMaster_3', code: 'EUR', name: 'Euro', symbol: '€', isActive: true }
      ]);
    }

    // ---- Service, Spares & AMC master lists (Spare Parts Hub / Service
    // Tickets / AMC Monitoring / AMC Quotes) — previously hardcoded
    // <option> lists duplicated (and inconsistently worded) across
    // several pages; now one editable source each. ----
    // Matches the categories already used by the seeded Spare Parts
    // catalog (sparePartsMaster) exactly, so existing parts still show
    // their correct category once this dropdown becomes master-driven.
    seedIfEmpty('sparePartCategoryMaster', [
      'Load Cells & Transducers', 'Sensors & Encoders', 'Displays & Terminals',
      'Junction Boxes & Wiring', 'Optical Metrology', 'Calibration Standards',
      'Load Cells', 'Digital Indicators', 'Junction Boxes', 'Wireless & Telemetry', 'Cables & Hardware'
    ]);

    seedIfEmpty('complaintCategoryMaster', [
      'Load Cell Drift', 'Display Communication Failure', 'Scale Calibration Error',
      'Hydraulic Sensor Leakage', 'Software Sync Disruption', 'Power Supply Surge', 'General Maintenance'
    ]);

    // Includes both AMC Monitoring's short tokens ("Comprehensive" etc.)
    // and AMC Quotes' own wording ("Comprehensive AMC" etc.) alongside
    // the fuller descriptive versions, so existing contracts AND quotes
    // both keep their tier correctly selected once this single shared
    // list drives both dropdowns.
    seedIfEmpty('amcContractTierMaster', [
      'Comprehensive', 'Non-Comprehensive', 'High-Temp Crane Scale', 'Weighbridge Bi-Annual',
      'Comprehensive AMC', 'Non-Comprehensive AMC', 'Calibration & Testing SLA', 'Breakdown Repair SLA',
      'Comprehensive (Spares + Labor + Calibration)', 'Non-Comprehensive (Preventive + Labor Only)',
      'Calibration & Stamping SLA (Annual Legal Metrology Compliance)', 'Breakdown Repair Callout SLA (Guaranteed Response)'
    ]);

    // Both AMC Monitoring's wording ("Quarterly (4 Visits/Year)") and AMC
    // Quotes' wording ("4 Visits (Quarterly PM)") are included so both
    // pages' existing records keep their frequency correctly selected.
    seedIfEmpty('pmVisitFrequencyMaster', [
      'Monthly (12 Visits/Year)', 'Bi-Monthly (6 Visits/Year)', 'Quarterly (4 Visits/Year)', 'Bi-Annual (2 Visits/Year)',
      '12 Visits (Monthly PM)', '6 Visits (Bi-Monthly PM)', '4 Visits (Quarterly PM)', '2 Visits (Semi-Annual PM)'
    ]);

    seedIfEmpty('amcInvoicingMilestoneMaster', [
      '100% Full Year Advance', '50% Semi-Annual Advance', '25% Quarterly Advance', '100% 1st Quarter Advance'
    ]);

    // Includes AMC Quotes' short tokens ("1 Year") alongside the fuller
    // descriptive versions for the same backward-compatibility reason.
    seedIfEmpty('amcContractDurationMaster', [
      '1 Year', '2 Years', '3 Years',
      '1 Year (Annual)', '2 Years (Multi-Year Contract)', '3 Years (Long-Term Corporate SLA)'
    ]);

    // SLA Response Policy — richer than a plain name list: each severity
    // tier carries its own target response window. This single master now
    // drives the Service Ticket Severity dropdown (and its due-date
    // math), AMC Monitoring's "SLA Breakdown Response", and AMC Quotes'
    // "Target Breakdown Response SLA" — previously three separately
    // hardcoded, inconsistently-worded lists (one of them even in days
    // instead of hours, contradicting the published SOP at the time).
    //
    // Switched back to days (business request) - the hour values below
    // were themselves each already effectively same-day/next-day/etc.
    // commitments, so slaDays is a faithful day-equivalent of what each
    // tier already meant, not an arbitrary relabel: Critical (4h) and
    // High (8h) were both same-business-day, so both become 0 days;
    // Medium (24h, "Next Business Day") becomes 1; Low (48h, "Standard")
    // becomes 2.
    var slaDefaults = [
      { id: 'sla_1', name: 'Critical', slaDays: 0, slaWindow: 'Same Day (Emergency)', description: 'Plant-stopping breakdown / safety-critical — emergency callout.', isActive: true },
      { id: 'sla_2', name: 'High', slaDays: 0, slaWindow: 'Same Day', description: 'Major fault, production impacted — same-day response.', isActive: true },
      { id: 'sla_3', name: 'Medium', slaDays: 1, slaWindow: 'Next Business Day', description: 'Degraded but operational — next business day.', isActive: true },
      { id: 'sla_4', name: 'Low', slaDays: 2, slaWindow: '2 Days Standard', description: 'Non-urgent / routine maintenance request.', isActive: true }
    ];
    // The exact hour-based values these ids were seeded with before this
    // switch - used below to recognize an untouched default record so it
    // can be safely migrated in place, without overwriting a tier an
    // admin has since customized via Master Data (whose intended day
    // value we'd otherwise have no way to know).
    var slaOldDefaultsById = {
      sla_1: { slaHours: 4, slaWindow: '4 Hours Emergency' },
      sla_2: { slaHours: 8, slaWindow: '8 Hours Same Day' },
      sla_3: { slaHours: 24, slaWindow: '24 Hours Next Business Day' },
      sla_4: { slaHours: 48, slaWindow: '48 Hours Standard' }
    };

    var slaExisting = this.getCollection('slaResponseTierMaster');
    if (!slaExisting || slaExisting.length === 0) {
      this.saveCollection('slaResponseTierMaster', slaDefaults);
    } else {
      var slaMigrated = false;
      slaExisting = slaExisting.map(function(tier) {
        var old = tier && slaOldDefaultsById[tier.id];
        var stillDefault = old && tier.slaHours === old.slaHours && tier.slaWindow === old.slaWindow;
        if (!stillDefault) return tier;
        var replacement = slaDefaults.filter(function(d) { return d.id === tier.id; })[0];
        slaMigrated = true;
        var migrated = Object.assign({}, tier, {
          slaDays: replacement.slaDays,
          slaWindow: replacement.slaWindow
        });
        // Object.assign would keep a stale slaHours key (Firestore's SDK
        // rejects a literal `undefined` value, so overwriting it with one
        // isn't safe) - delete it outright instead now that slaDays is
        // the canonical field.
        delete migrated.slaHours;
        return migrated;
      });
      if (slaMigrated) this.saveCollection('slaResponseTierMaster', slaExisting);
    }

    // Client Installed Equipment — the real, editable registry (Master
    // Data > Installed Equipment) that Service Tickets' Customer -> Model
    // -> Serial cascade and Warranty Management both read from. This
    // replaces what used to be two separate hardcoded demo lists baked
    // into those two pages' JS (so equipment added here now actually
    // shows up when raising a ticket, instead of only existing in a
    // registry no form could see).
    // Only in a pure offline/no-Firebase demo install does an empty
    // registry mean "nothing has been entered yet" - once Firebase is
    // connected (as in the real deployed app), an empty registry means
    // it was deliberately cleared (see clearDummyDataForGoLive below),
    // and should stay empty, not spring back to the demo roster.
    var equipExisting = this.getCollection('clientEquipmentMaster');
    if ((!equipExisting || equipExisting.length === 0) && !this.isFirebaseAvailable()) {
      var equipRoster = [
        { id: 'equip_1', customerName: 'Tata Steel Long Products', modelName: 'MDI-WS-9000 Weighbridge System', equipmentModel: 'MDI-WS-9000 Weighbridge System', serialNumber: 'EQ-9042', location: 'Jamshedpur Works', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'procurement@tatasteel.com', isActive: true },
        { id: 'equip_2', customerName: 'Tata Steel Long Products', modelName: 'MDI-WS-9000 Weighbridge System', equipmentModel: 'MDI-WS-9000 Weighbridge System', serialNumber: 'EQ-9080', location: 'Jamshedpur Works', vertical: 'Service/Parts', warrantyStatus: 'Under Warranty', contactEmail: 'maintenance@tatasteel.com', isActive: true },
        { id: 'equip_3', customerName: 'Tata Steel Long Products', modelName: 'MDI-AX-8000 Dynamic Axle Weigher', equipmentModel: 'MDI-AX-8000 Dynamic Axle Weigher', serialNumber: 'EQ-8055', location: 'Jamshedpur Works', vertical: 'Projects', warrantyStatus: 'AMC Contract', contactEmail: 'logistics@tatasteel.com', isActive: true },
        { id: 'equip_4', customerName: 'JSW Steel Ltd - Vijayanagar Works', modelName: 'MDI-CS-5000 Heavy Crane Scale', equipmentModel: 'MDI-CS-5000 Heavy Crane Scale', serialNumber: 'EQ-5011', location: 'Vijayanagar Plant, Toranagallu', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'stores@jsw.in', isActive: true },
        { id: 'equip_5', customerName: 'JSW Steel Ltd - Vijayanagar Works', modelName: 'MDI-CS-5000 Heavy Crane Scale', equipmentModel: 'MDI-CS-5000 Heavy Crane Scale', serialNumber: 'EQ-5022', location: 'Vijayanagar Plant, Toranagallu', vertical: 'Service/Parts', warrantyStatus: 'Out of Warranty', contactEmail: 'hotstrip@jsw.in', isActive: true },
        { id: 'equip_6', customerName: 'JSW Steel Ltd - Vijayanagar Works', modelName: 'Pitless Digital Truck Scale 100T', equipmentModel: 'Pitless Digital Truck Scale 100T', serialNumber: 'EQ-9088', location: 'Vijayanagar Plant, Toranagallu', vertical: 'Service/Parts', warrantyStatus: 'Under Warranty', contactEmail: 'gate@jsw.in', isActive: true },
        { id: 'equip_7', customerName: 'JSW Cement Toranagallu', modelName: 'MDI-BS-7000 Belt Conveyor Weigher', equipmentModel: 'MDI-BS-7000 Belt Conveyor Weigher', serialNumber: 'EQ-7019', location: 'Toranagallu Plant', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'plant@jswcement.in', isActive: true },
        { id: 'equip_8', customerName: 'JSW Cement Toranagallu', modelName: 'MDI-BS-7000 Belt Conveyor Weigher', equipmentModel: 'MDI-BS-7000 Belt Conveyor Weigher', serialNumber: 'EQ-7025', location: 'Toranagallu Plant', vertical: 'Service/Parts', warrantyStatus: 'Under Warranty', contactEmail: 'dispatch@jswcement.in', isActive: true },
        { id: 'equip_9', customerName: 'Vedanta Ltd Jharsuguda Smelter', modelName: 'Heavy Duty High Temp Crane Scale', equipmentModel: 'Heavy Duty High Temp Crane Scale', serialNumber: 'EQ-5015', location: 'Jharsuguda Smelter', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'smelter.service@vedanta.co.in', isActive: true },
        { id: 'equip_10', customerName: 'Vedanta Ltd Jharsuguda Smelter', modelName: 'MDI-WS-9000 Weighbridge System', equipmentModel: 'MDI-WS-9000 Weighbridge System', serialNumber: 'EQ-9055', location: 'Jharsuguda Smelter', vertical: 'Projects', warrantyStatus: 'Under Warranty', contactEmail: 'weigh@vedanta.co.in', isActive: true },
        { id: 'equip_11', customerName: 'Hindalco Lapanga Smelter', modelName: 'MDI-CS-5000 Heavy Crane Scale', equipmentModel: 'MDI-CS-5000 Heavy Crane Scale', serialNumber: 'EQ-5030', location: 'Lapanga Smelter', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'potline@adityabirla.com', isActive: true },
        { id: 'equip_12', customerName: 'Thermax Limited Chinchwad', modelName: 'MDI-TS-2000 Platform Scale System', equipmentModel: 'MDI-TS-2000 Platform Scale System', serialNumber: 'EQ-2001', location: 'Chinchwad Works', vertical: 'Sales', warrantyStatus: 'Under Warranty', contactEmail: 'qa@thermaxglobal.com', isActive: true },
        { id: 'equip_13', customerName: 'Ashok Leyland Mining Fleet', modelName: 'MDI-OB-3000 Onboard Loader Scale', equipmentModel: 'MDI-OB-3000 Onboard Loader Scale', serialNumber: 'EQ-3088', location: 'Mining Fleet Depot', vertical: 'Service/Parts', warrantyStatus: 'Under Warranty', contactEmail: 'mining@ashokleyland.com', isActive: true },
        { id: 'equip_14', customerName: 'Ashok Leyland Mining Fleet', modelName: 'MDI-OB-3000 Onboard Loader Scale', equipmentModel: 'MDI-OB-3000 Onboard Loader Scale', serialNumber: 'EQ-3090', location: 'Mining Fleet Depot', vertical: 'Service/Parts', warrantyStatus: 'Under Warranty', contactEmail: 'fleet@ashokleyland.com', isActive: true },
        { id: 'equip_15', customerName: 'Ultratech Cement Maihar Works', modelName: 'MDI-BS-7000 Belt Conveyor Weigher', equipmentModel: 'MDI-BS-7000 Belt Conveyor Weigher', serialNumber: 'EQ-7033', location: 'Maihar Works', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'maihar@ultratechcement.com', isActive: true },
        { id: 'equip_16', customerName: 'Ultratech Cement Maihar Works', modelName: 'Pitless Digital Truck Scale 100T', equipmentModel: 'Pitless Digital Truck Scale 100T', serialNumber: 'EQ-9092', location: 'Maihar Works', vertical: 'Service/Parts', warrantyStatus: 'Under Warranty', contactEmail: 'logistics@ultratechcement.com', isActive: true },
        { id: 'equip_17', customerName: 'KIOCL Kudremukh Iron Ore', modelName: 'MDI-HS-4000 Hydraulic Excavator Scale', equipmentModel: 'MDI-HS-4000 Hydraulic Excavator Scale', serialNumber: 'EQ-4012', location: 'Kudremukh Works', vertical: 'Service/Parts', warrantyStatus: 'Out of Warranty', contactEmail: 'works@kioclltd.com', isActive: true },
        { id: 'equip_18', customerName: 'Kesoram Cement Basantnagar', modelName: 'MDI-BS-7000 Belt Conveyor Weigher', equipmentModel: 'MDI-BS-7000 Belt Conveyor Weigher', serialNumber: 'EQ-7040', location: 'Basantnagar Plant', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'cement@kesoram.com', isActive: true },
        { id: 'equip_19', customerName: 'SAIL Durgapur Steel Plant', modelName: 'Heavy Duty High Temp Crane Scale', equipmentModel: 'Heavy Duty High Temp Crane Scale', serialNumber: 'EQ-5045', location: 'Durgapur Steel Plant', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'dsp.maintenance@sail.in', isActive: true },
        { id: 'equip_20', customerName: 'Bharat Earth Movers Ltd (BEML)', modelName: 'MDI-OB-3000 Onboard Loader Scale', equipmentModel: 'MDI-OB-3000 Onboard Loader Scale', serialNumber: 'EQ-3095', location: 'BEML Works', vertical: 'Projects', warrantyStatus: 'Under Warranty', contactEmail: 'mining@beml.co.in', isActive: true },
        { id: 'equip_21', customerName: 'SECL Korba Coalfields', modelName: 'MDI-AX-8000 Dynamic Axle Weigher', equipmentModel: 'MDI-AX-8000 Dynamic Axle Weigher', serialNumber: 'EQ-8060', location: 'Korba Coalfields', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'korba@secl.gov.in', isActive: true },
        { id: 'equip_22', customerName: 'Jindal Steel & Power Angul', modelName: 'MDI-WS-9000 Weighbridge System', equipmentModel: 'MDI-WS-9000 Weighbridge System', serialNumber: 'EQ-9065', location: 'Angul Plant', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'angul.service@jindalsteel.com', isActive: true },
        { id: 'equip_23', customerName: 'Singareni Collieries Co Ltd (SCCL)', modelName: 'MDI-WS-9000 Weighbridge System', equipmentModel: 'MDI-WS-9000 Weighbridge System', serialNumber: 'EQ-9072', location: 'Kothagudem Mines', vertical: 'Service/Parts', warrantyStatus: 'AMC Contract', contactEmail: 'kothagudem@scclmines.com', isActive: true }
      ];

      // Fill in the warranty-tracking fields (Warranty Management reads
      // these — commissioningDate/expiryDate/warrantyTier/claims/
      // statusOverride) that don't matter for the Service Tickets
      // cascade above but do for that page, so both real consumers of
      // this one master work correctly instead of one silently showing
      // blank/NaN warranty countdowns.
      equipRoster.forEach(function(item, i) {
        var monthsAgo = 3 + (i % 10); // stagger commissioning dates for variety
        var commDate = new Date();
        commDate.setMonth(commDate.getMonth() - monthsAgo);
        item.commissioningDate = commDate.toISOString().slice(0, 10);

        var expDate = new Date(commDate);
        if (item.warrantyStatus === 'Out of Warranty') {
          expDate.setMonth(expDate.getMonth() + 6); // already lapsed
        } else {
          expDate.setMonth(expDate.getMonth() + 24); // still current (Under Warranty / AMC Contract)
        }
        item.expiryDate = expDate.toISOString().slice(0, 10);

        item.warrantyTier = 'Standard 12-Month OEM';
        item.claims = [];
        item.statusOverride = item.warrantyStatus === 'AMC Contract' ? 'Converted to AMC' : null;
        item.orderRef = '';
      });

      this.saveCollection('clientEquipmentMaster', equipRoster);
    }
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

  // Multi-company support (Measure DI + Aditya, same business, same
  // owner/director): every document carries a companyId chosen once at
  // Lead/Service Lead creation. Falls back to Measure DI (the pre-existing
  // default) whenever companyId is missing, so records created before this
  // feature existed keep behaving exactly as they always did.
  getCompanyById: function(companyId) {
    var companies = this.getCollection('companyMaster') || [];
    var found = companyId && companies.find(function(c) { return c.id === companyId; });
    return found || companies.find(function(c) { return c.id === 'company_measuredi'; }) || null;
  },

  getDefaultCompanyId: function() {
    return 'company_measuredi';
  },

  // Invoice/Proforma numbering is kept as one continuous GST-compliant
  // sequence per legal entity, not shared across companies - each company's
  // own tax filings need their own unbroken number range. Measure DI keeps
  // its original unprefixed format (INV/2026-27/xxx) for continuity with
  // numbers already issued; any other company gets its numberCode folded
  // into the prefix, which is all that's needed since the max-scan below
  // already only counts invoices whose number starts with that exact prefix.
  generateNextInvoiceNumber: function(isProforma, companyId) {
    var invoices = this.getCollection('invoices') || [];
    var company = this.getCompanyById(companyId);
    var code = company && company.numberCode && company.numberCode !== 'MDI' ? company.numberCode : null;
    var prefix = code
      ? (isProforma ? 'PI/' + code + '/2026-27/' : 'INV/' + code + '/2026-27/')
      : (isProforma ? 'PI/2026-27/' : 'INV/2026-27/');
    var maxNum = 0;
    invoices.forEach(function(inv) {
      if (inv.invoiceNumber && inv.invoiceNumber.indexOf(prefix) === 0) {
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

    var nextTaxInvNumber = this.generateNextInvoiceNumber(false, proforma.companyId);
    var nowStr = getFormattedToday();

    // Clone items
    var newTaxInvoice = JSON.parse(JSON.stringify(proforma));
    newTaxInvoice.id = 'inv_' + Date.now();
    newTaxInvoice.invoiceNumber = nextTaxInvNumber;
    newTaxInvoice.invoiceType = 'Tax Invoice';
    newTaxInvoice.proformaReference = proforma.invoiceNumber;
    newTaxInvoice.proformaId = proforma.id;
    newTaxInvoice.invoiceDate = nowStr;
    // Same as raising a fresh invoice — this still requires the Primary
    // Approver's sign-off before it can be dispatched. No auto-approve
    // shortcut for any role.
    newTaxInvoice.status = 'Pending Senior Approval';
    newTaxInvoice.approvalInfo = null;
    newTaxInvoice.directorRatificationStatus = undefined;
    newTaxInvoice.emailDispatchHistory = [];

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

  // A CSV file has no concept of "number" - every cell arrives as plain
  // text. Left as a string, a value like "4500000" is invisible in a
  // preview but silently breaks arithmetic wherever the rest of the app
  // expects a real number (dashboard/report totals do `total += x`, which
  // string-concatenates instead of adding once x is a string). Only
  // applied to a fixed, explicit list of known money/quantity field
  // names per collection - deliberately NOT a blanket "anything that
  // looks numeric" rule, since that would also mangle phone numbers,
  // PO/invoice numbers, pincodes, and GSTIN-adjacent fields that happen
  // to be all-digit text but must never lose a leading zero or become a
  // Number. Used only by the CSV bulk-import path, not the normal
  // form-save path (which already sends correctly-typed numbers itself).
  CSV_NUMERIC_FIELDS: {
    leads: ['estimatedValue', 'expectedValue'],
    orders: ['amount'],
    invoices: ['taxableValue', 'taxAmount', 'grandTotal'],
    projectsMaster: ['projectValue', 'budgetINR'],
    sparePartsMaster: ['unitPrice', 'gstPercent', 'stockQty', 'minReorderLevel', 'leadTimeDays'],
    clientsMaster: ['creditPeriodDays']
  },
  coerceCsvNumericFields: function(colName, record) {
    var fields = this.CSV_NUMERIC_FIELDS[colName];
    if (!fields) return record;
    fields.forEach(function(f) {
      if (typeof record[f] === 'string' && record[f].trim() !== '' && !isNaN(Number(record[f]))) {
        record[f] = Number(record[f]);
      }
    });
    return record;
  },

  bulkUploadItems: function(colName, recordArray, callback) {
    if (!Array.isArray(recordArray) || recordArray.length === 0) {
      if (typeof callback === 'function') callback(0, "No valid records provided.");
      return;
    }
    var self = this;
    var currentItems = this.getCollection(colName);
    var count = 0;

    // Resolve each row to its final record (with a real assigned id)
    // exactly ONCE, and reuse that same resolved array for both the local
    // cache and the Firestore batch below - sanitizeRecord() previously
    // got called a second time from the original raw row for Firestore,
    // which (for any row with no id column) assigned a brand new random
    // id there, different from the one already saved locally, leaving
    // local storage and Firestore with two different ids for what should
    // be the same record.
    var templateKey = this.CSV_TEMPLATE_KEY_BY_COLLECTION[colName];
    var legendFields = templateKey ? (this.getPrescribedCsvTemplate(templateKey).legendFields || []) : [];

    var resolvedRecords = recordArray.map(function(rawRecord) {
      var record = self.coerceCsvNumericFields(colName, self.sanitizeRecord(rawRecord));
      if (legendFields.length > 0) self.normalizeRecordAgainstLegend(record, legendFields);
      if (!record.id) {
        record.id = colName.substring(0, 3) + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      }
      return record;
    });

    resolvedRecords.forEach(function(record) {
      currentItems.push(record);
      count++;
    });

    this.saveCollection(colName, currentItems);

    if (this.isFirebaseAvailable()) {
      try {
        var batch = window.db.batch();
        resolvedRecords.forEach(function(record) {
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
