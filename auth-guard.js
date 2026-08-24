// auth-guard.js - Measure DI RevOps Auth Guard & Global UI Header Renderer

// Global Currency Formatter Helper
function formatINR(val) {
  var num = Number(val) || 0;
  if (Math.abs(num) >= 10000000) {
    return '₹' + (num / 10000000).toFixed(2) + ' Cr';
  } else if (Math.abs(num) >= 100000) {
    return '₹' + (num / 100000).toFixed(2) + ' L';
  }
  return '₹' + num.toLocaleString('en-IN');
}

// Global Financial Year Helper
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
      var month = d.getMonth() + 1; // 1 to 12
      if (month >= 4) {
        var nextY = (year + 1) % 100;
        return year + '-' + (nextY < 10 ? '0' + nextY : nextY);
      } else {
        var prevY = year - 1;
        var curY = year % 100;
        return prevY + '-' + (curY < 10 ? '0' + curY : curY);
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

function getCurrentFinancialYear() {
  var d = new Date();
  var year = d.getFullYear();
  var month = d.getMonth() + 1; // 1 to 12
  if (month >= 4) {
    var nextY = (year + 1) % 100;
    return year + '-' + (nextY < 10 ? '0' + nextY : nextY);
  } else {
    var prevY = year - 1;
    var curY = year % 100;
    return prevY + '-' + (curY < 10 ? '0' + curY : curY);
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

function checkAuth(allowedRoles) {
  try {
    // Ensure seed data is initialized if store exists
    if (typeof window.RevOpsStore !== 'undefined' && window.RevOpsStore.initSeedData) {
      window.RevOpsStore.initSeedData();
    }
  } catch(errSeed) {
    console.warn("Seed init warning in checkAuth:", errSeed);
  }

  var userRole = localStorage.getItem('userRole');
  var userEmail = localStorage.getItem('userEmail');
  var userName = localStorage.getItem('userName') || 'User';
  var employeeId = localStorage.getItem('employeeId');

  // Clean string 'null' or 'undefined'
  if (userRole === 'null' || userRole === 'undefined') userRole = null;
  if (employeeId === 'null' || employeeId === 'undefined') employeeId = null;
  if (userEmail === 'null' || userEmail === 'undefined') userEmail = null;

  if (!userRole || !employeeId || !userEmail) {
    if (window.location.pathname.indexOf('login.html') === -1) {
      window.location.href = 'login.html';
    }
    return false;
  }

  var employees = [];
  try {
    employees = (window.RevOpsStore && typeof window.RevOpsStore.getCollection === 'function') 
      ? (window.RevOpsStore.getCollection('employees') || []) 
      : [];
  } catch(eEmps) {
    console.warn("Could not fetch employees collection:", eEmps);
  }

  var currentEmp = employees.find(function(e) {
    return e && (e.employeeId === employeeId || e.email === userEmail);
  });

  if (currentEmp) {
    var empUpdated = false;
    if (currentEmp.employeeId === 'E-001' && currentEmp.role !== 'super_admin') {
      currentEmp.role = 'super_admin';
      empUpdated = true;
    } else if (currentEmp.employeeId === 'E-002' && currentEmp.role !== 'super_admin') {
      currentEmp.role = 'super_admin';
      empUpdated = true;
    }

    // Keep active session role, name, email and ID synchronized
    if (currentEmp.role && localStorage.getItem('userRole') !== currentEmp.role) {
      localStorage.setItem('userRole', currentEmp.role);
      userRole = currentEmp.role;
    }
    if (currentEmp.fullName && localStorage.getItem('userName') !== currentEmp.fullName) {
      localStorage.setItem('userName', currentEmp.fullName);
    }
    if (currentEmp.email && localStorage.getItem('userEmail') !== currentEmp.email) {
      localStorage.setItem('userEmail', currentEmp.email);
    }

    if (empUpdated && window.RevOpsStore && window.RevOpsStore.saveCollection) {
      try {
        window.RevOpsStore.saveCollection('employees', employees);
      } catch(eSave) {}
    }
  }

  if (currentEmp && currentEmp.isActive === false) {
    if (typeof auth !== 'undefined' && auth && auth.signOut) {
      auth.signOut();
    }
    localStorage.clear();
    alert("Your account has been disabled. Contact your manager or admin.");
    window.location.href = 'login.html';
    return false;
  }

  // Check role authorization (super_admin has universal access)
  if (userRole === 'super_admin') {
    // Exempted from restrictions
  } else if (allowedRoles && allowedRoles.length > 0) {
    var hasAccess = allowedRoles.includes(userRole) || 
      (allowedRoles.includes('admin') && (userRole === 'super_admin' || userRole === 'admin'));
    if (!hasAccess) {
      alert("Unauthorized access. Redirecting to your default workspace.");
      if (userRole === 'staff') {
        window.location.href = 'my-scorecard.html';
      } else {
        window.location.href = 'dashboard.html';
      }
      return false;
    }
  }

  // Check if user has direct reports
  var hasDirectReports = employees.some(function(e) {
    return e && e.reportsTo === employeeId;
  });

  // Render standard Navbar
  renderRevOpsNavbar(userName, userRole, hasDirectReports);
  return true;
}



function renderRevOpsNavbar(userName, userRole, hasDirectReports) {
  var navContainer = document.getElementById('navbar-container');
  if (!navContainer) {
    if (document.body) {
      navContainer = document.createElement('div');
      navContainer.id = 'navbar-container';
      if (document.body.firstChild) {
        document.body.insertBefore(navContainer, document.body.firstChild);
      } else {
        document.body.appendChild(navContainer);
      }
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        renderRevOpsNavbar(userName, userRole, hasDirectReports);
      });
      return;
    }
  }

  var userEmail = localStorage.getItem('userEmail') || '';
  var employeeId = localStorage.getItem('employeeId') || 'E-001';
  var showTeamAndReviews = (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager' || hasDirectReports);
  var isAdmin = (userRole === 'super_admin' || userRole === 'admin');

  var currentPath = window.location.pathname.split('/').pop() || 'index.html';

  // Categories definitions (Strict SOP Pipeline Order: Leads -> Quotes -> Orders -> Invoices -> Payments)
  var salesItems = [
    { title: "Equipment Sales Leads", path: "leads.html", desc: "Capital equipment pipeline (Projects, Onboard, Crane)", icon: "📈", show: true },
    { title: "Equipment Quotations", path: "quotations.html", desc: "Itemized capital equipment quotes & discount approvals", icon: "📑", show: true },
    { title: "Equipment Orders", path: "orders.html", desc: "Capital equipment customer purchase orders & contracts", icon: "📦", show: true },
    { title: "Equipment Invoices", path: "invoices.html", desc: "Equipment commercial invoices, senior approval & dispatch", icon: "🧾", show: true },
    { title: "Payments & Collections", path: "payments.html", desc: "AR collections, BG/PG tracking & milestone invoicing", icon: "💳", show: true },
    { title: "Master Data & Bulk Upload", path: "master-data.html", desc: "Product Specs, Clients, Equipment & Bank Master Hub", icon: "🗄️", show: true },
    { title: "Audit & Activity Trail", path: "audit-logs.html", desc: "Universal ledger of all entries, edits, timestamps & actor diffs", icon: "🛡️", show: isAdmin }
  ];

  var financeItems = [
    { title: "Expenses & Profit Center", path: "expenses.html", desc: "Multi-project split & financial ledger", icon: "💰", show: true },
    { title: "Payroll & CTC", path: "payroll.html", desc: "Monthly salary & disbursement logs", icon: "💵", show: isAdmin }
  ];

  var hrItems = [
    { title: "Employee Directory", path: "employees.html", desc: "Roster, roles & departments", icon: "👥", show: isAdmin },
    { title: "Attendance & Leaves", path: "attendance.html", desc: "Punch logs & leave approvals", icon: "⏰", show: true },
    { title: "My Team", path: "my-team.html", desc: "Direct reportees & org chart", icon: "🏢", show: showTeamAndReviews }
  ];

  var perfItems = [
    { title: "My Scorecard", path: "my-scorecard.html", desc: "Personal scorecard & achievement rating", icon: "🎯", show: true },
    { title: "Daily Work (DWM)", path: "dwm.html", desc: "Daily task logs & plan vs actuals", icon: "📅", show: true },
    { title: "KRAs & Target Metrics", path: "kra-targets.html", desc: "Key result areas & quarterly goals", icon: "📊", show: true },
    { title: "Performance Reviews", path: "reviews.html", desc: "360 appraisal feedback & ratings", icon: "📝", show: showTeamAndReviews },
    { title: "Annual Operating Plan (AOP)", path: "aop-targets.html", desc: "Company revenue targets & strategy", icon: "🏆", show: isAdmin },
    { title: "Standard Operating Procedures (SOP)", path: "sop.html", desc: "New joiner training & role-based operational procedures", icon: "📜", show: true },
    { title: "User Guide & PDF Manual", path: "user-guide.html", desc: "Comprehensive RevOps SOP & live PDF manual", icon: "📖", show: true }
  ];

  var serviceItems = [
    { title: "Service & Spares Leads", path: "service-leads.html", desc: "Dedicated pipeline for Spare Parts, Paid Services, AMC Renewals & Calls", icon: "🎯", show: true },
    { title: "Spare Parts Sales Hub", path: "parts-sales.html", desc: "Spare parts catalog, inventory, prices, COGS & margin analytics", icon: "⚙️", show: true },
    { title: "Service Tickets & QC", path: "service-tickets.html", desc: "Breakdown calls, on-site diagnostics, field SLAs & QC alerts", icon: "🛠️", show: true },
    { title: "AMC Contracts & PM Visits", path: "amc-contracts.html", desc: "Contract registry, quarterly PM visits, SLA & renewal countdown", icon: "📋", show: true },
    { title: "AMC & Service Quotations", path: "amc-quotes.html", desc: "Comprehensive & Non-Comprehensive AMC commercial proposals", icon: "📑", show: true },
    { title: "AMC & Service Orders", path: "amc-orders.html", desc: "Booked AMC contracts & service execution agreements", icon: "📦", show: true },
    { title: "AMC & Service Invoices", path: "amc-invoices.html", desc: "Quarterly & annual AMC billing milestones & GST tax invoices", icon: "🧾", show: true },
    { title: "Warranty & Equipment Health", path: "warranty-management.html", desc: "Installed base warranty tracking, RMA claims & 1-click AMC conversion", icon: "🛡️", show: true }
  ];

  var roleBadgeColor = "bg-[#982B68]/30 text-[#E283BD] border-[#982B68]/50";
  if (userRole === 'super_admin') roleBadgeColor = "bg-fuchsia-900/60 text-fuchsia-300 border-fuchsia-700/50";
  else if (userRole === 'admin') roleBadgeColor = "bg-purple-900/60 text-purple-300 border-purple-700/50";
  else if (userRole === 'manager') roleBadgeColor = "bg-blue-900/60 text-blue-300 border-blue-700/50";
  else if (userRole === 'staff') roleBadgeColor = "bg-emerald-900/60 text-emerald-300 border-emerald-700/50";

  var html = getRevOpsNavigationHtml(userName, userRole, employeeId, userEmail, roleBadgeColor, currentPath, salesItems, financeItems, hrItems, perfItems, serviceItems, showTeamAndReviews, isAdmin);

  navContainer.innerHTML = html;

  // Add body padding so fixed header and sidebar never overlap page content
  if (document.body) {
    document.body.classList.add('md:pl-64', 'pt-14', 'pb-16', 'md:pb-6');
  }

  // Populate User Switcher Dropdown (Super Admin only)
  setTimeout(function() {
    var currentRole = localStorage.getItem('userRole');
    if (currentRole !== 'super_admin' && currentRole !== 'admin') return;
    var switcherList = document.getElementById('user-switcher-list');
    var switcherListDesktop = document.getElementById('user-switcher-list-desktop');
    if (window.RevOpsStore) {
      var emps = window.RevOpsStore.getCollection('employees') || [];
      if (emps.length === 0) {
        emps = [
          { employeeId: 'E-001', name: 'Ravichandran', role: 'super_admin', designation: 'Managing Director', email: 'ars.okd@gmail.com' },
          { employeeId: 'E-002', name: 'Murugan', role: 'admin', designation: 'VP RevOps', email: 'murugan@measuredi.com' },
          { employeeId: 'E-003', name: 'Rajesh Kumar', role: 'manager', designation: 'Sales Head', email: 'rajesh@measuredi.com' },
          { employeeId: 'E-004', name: 'Priya Sharma', role: 'staff', designation: 'Sr. Service Eng', email: 'priya@measuredi.com' },
          { employeeId: 'E-005', name: 'Anil Mehta', role: 'manager', designation: 'Projects Lead', email: 'anil@measuredi.com' }
        ];
      }
      var currentEmpId = localStorage.getItem('employeeId') || 'E-001';
      var listHtml = emps.slice(0, 15).map(function(e) {
        var isCurrent = e.employeeId === currentEmpId;
        var rClass = e.role === 'super_admin' ? 'bg-fuchsia-950 text-fuchsia-300' :
                     e.role === 'admin' ? 'bg-purple-950 text-purple-300' :
                     e.role === 'manager' ? 'bg-blue-950 text-blue-300' : 'bg-emerald-950 text-emerald-300';
        return `
          <button onclick="switchActiveUserSession('${e.employeeId}')" class="w-full text-left p-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${isCurrent ? 'bg-indigo-900/60 border border-indigo-500/50 font-bold text-white' : 'hover:bg-slate-800 text-slate-300'}">
            <div class="truncate pr-2">
              <div class="font-bold text-slate-100 truncate">${e.name} (${e.employeeId})</div>
              <div class="text-[10px] text-slate-400 truncate">${e.designation || e.role}</div>
            </div>
            <span class="text-[9px] uppercase px-1.5 py-0.5 rounded font-extrabold shrink-0 ${rClass}">${e.role}</span>
          </button>
        `;
      }).join('');
      if (switcherList) switcherList.innerHTML = listHtml;
      if (switcherListDesktop) switcherListDesktop.innerHTML = listHtml;
    }
  }, 100);

  // Append Global Maintenance Footer
  var footerId = 'analytics-spire-footer';
  if (!document.getElementById(footerId)) {
    var footer = document.createElement('footer');
    footer.id = footerId;
    footer.className = "w-full py-4 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-400 mt-12";
    footer.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="flex items-center space-x-2">
          <span class="font-bold text-slate-200">Measure DI Technologies Private Limited</span>
          <span class="text-slate-600">•</span>
          <span class="text-slate-400">Made to Measure RevOps</span>
        </div>
        <div class="text-slate-400 font-medium">
          Developed and maintained by <span class="font-bold text-[#E283BD]">Analytics Spire</span>
        </div>
      </div>
    `;
    document.body.appendChild(footer);
  }

  // Trigger popup for assigned tickets if any exist for current user
  setTimeout(function() {
    checkAssignedServiceTicketsPopup();
  }, 400);
}

// Assigned Service Ticket Pop-up Notification Engine
function checkAssignedServiceTicketsPopup() {
  try {
    var empId = localStorage.getItem('employeeId');
    var userName = localStorage.getItem('userName') || '';
    if (!empId || !window.RevOpsStore) return;

    var tickets = window.RevOpsStore.getCollection('serviceTickets') || [];
    var myAssignedTickets = tickets.filter(function(t) {
      if (!t) return false;
      var matchesEmp = (t.assignedTo === empId) || (t.assignedToName && userName && t.assignedToName.toLowerCase().includes(userName.toLowerCase()));
      var isOpen = (t.status === 'Open' || t.status === 'In Progress' || t.status === 'Pending Parts');
      return matchesEmp && isOpen;
    });

    if (myAssignedTickets.length === 0) return;

    // Check if dismissed in this session
    var sessionKey = 'notified_tickets_' + empId + '_' + new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem(sessionKey)) return;

    var popupId = 'assigned-tickets-global-popup';
    if (document.getElementById(popupId)) return;

    var popup = document.createElement('div');
    popup.id = popupId;
    popup.className = "fixed bottom-5 right-5 z-50 max-w-md w-full bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl p-5 text-white animate-bounce-short";
    popup.innerHTML = `
      <div class="flex items-start justify-between gap-3 pb-2 border-b border-slate-800">
        <div class="flex items-center space-x-2.5">
          <div class="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-sm shrink-0">
            🔔
          </div>
          <div>
            <h4 class="text-xs font-black uppercase tracking-wider text-amber-400">Assigned Service Tickets Alert</h4>
            <p class="text-[11px] text-slate-300">You have <span class="font-bold text-white">${myAssignedTickets.length} active service ticket(s)</span> assigned to you.</p>
          </div>
        </div>
        <button onclick="dismissAssignedTicketsPopup('${sessionKey}')" class="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer">&times;</button>
      </div>

      <div class="py-2.5 space-y-2 max-h-48 overflow-y-auto">
        ${myAssignedTickets.slice(0, 3).map(function(t) {
          return `
            <div class="bg-slate-800/90 p-2 rounded-xl border border-slate-700 text-xs">
              <div class="flex items-center justify-between font-mono font-bold text-amber-300 text-[11px]">
                <span>${escapeHtml(t.ticketNumber || t.id)}</span>
                <span class="text-[9px] uppercase px-1.5 py-0.2 rounded font-bold ${t.severity === 'Critical' ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'}">${escapeHtml(t.severity || 'High')}</span>
              </div>
              <div class="font-bold text-white text-xs truncate mt-0.5">${escapeHtml(t.customerName)}</div>
              <div class="text-[10px] text-slate-400 truncate">${escapeHtml(t.equipmentModel || '')} &bull; SLA: <span class="text-slate-200 font-semibold">${escapeHtml(t.targetSlaDate || 'Pending')}</span></div>
            </div>
          `;
        }).join('')}
        ${myAssignedTickets.length > 3 ? `<p class="text-[10px] text-center text-slate-400 italic">+ ${myAssignedTickets.length - 3} more tickets in your queue</p>` : ''}
      </div>

      <div class="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
        <button onclick="dismissAssignedTicketsPopup('${sessionKey}')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer">
          Dismiss
        </button>
        <a href="service-tickets.html" class="px-3.5 py-1.5 bg-[#982B68] hover:bg-[#802256] text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer">
          <span>Review Tickets</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </a>
      </div>
    `;

    document.body.appendChild(popup);
  } catch(e) {
    console.warn("Assigned tickets popup check failed:", e);
  }
}

function dismissAssignedTicketsPopup(sessionKey) {
  try {
    sessionStorage.setItem(sessionKey, 'true');
    var el = document.getElementById('assigned-tickets-global-popup');
    if (el) el.remove();
  } catch(e) {}
}

function handleRevOpsLogout() {
  if (confirm("Are you sure you want to log out of Measure DI RevOps?")) {
    if (typeof auth !== 'undefined' && auth && auth.signOut) {
      auth.signOut();
    }
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('employeeId');
    window.location.href = 'login.html';
  }
}

function toggleMobileNavDrawer() {
  var drawer = document.getElementById('mobile-nav-drawer');
  if (drawer) {
    drawer.classList.toggle('hidden');
    if (!drawer.classList.contains('hidden')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
}

// Feature 1: Session Switcher Handler
function switchActiveUserSession(targetEmpId) {
  var currentRole = localStorage.getItem('userRole');
  if (currentRole !== 'super_admin' && currentRole !== 'admin') return;
  if (!window.RevOpsStore) return;
  var emps = window.RevOpsStore.getCollection('employees') || [];
  var targetUser = emps.find(function(e) { return e.employeeId === targetEmpId; });
  if (targetUser) {
    localStorage.setItem('employeeId', targetUser.employeeId);
    localStorage.setItem('userName', targetUser.name);
    localStorage.setItem('userEmail', targetUser.email || (targetUser.name.toLowerCase().replace(/\s+/g, '') + '@measuredi.com'));
    localStorage.setItem('userRole', targetUser.role || 'staff');
    
    // Notify user & reload page with new RBAC context
    console.log("Switched active user session to:", targetUser.name, targetUser.role);
    window.location.reload();
  }
}

// Feature 2: Manual Cloud Sync Trigger
function triggerManualSync() {
  var icon = document.getElementById('sync-icon-spin');
  if (icon) icon.classList.add('animate-spin');
  
  if (window.RevOpsStore && typeof window.RevOpsStore.initRealtimeSyncAll === 'function') {
    window.RevOpsStore.initRealtimeSyncAll();
  }
  
  setTimeout(function() {
    if (icon) icon.classList.remove('animate-spin');
    var badge = document.getElementById('nav-cloud-sync-badge');
    if (badge) {
      var syncTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      badge.setAttribute('title', 'Last synchronized at ' + syncTimeStr);
    }
  }, 600);
}

// Feature 3: Bulk Data Import / Export Center Modal Launcher


function openDataImportExportModal() {
  var modalId = 'revops-data-center-modal';
  var existingModal = document.getElementById(modalId);
  if (existingModal) {
    existingModal.classList.remove('hidden');
    return;
  }

  var modal = document.createElement('div');
  modal.id = modalId;
  modal.className = "fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto";
  modal.innerHTML = `
    <div class="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl p-6 text-slate-200 space-y-5 my-8">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-xl bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center text-lg border border-emerald-500/40">
            📊
          </div>
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <span>Bulk Data Import & Export Center</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Commercial SOP</span>
            </h3>
            <p class="text-xs text-slate-400">Import CSV/Excel files into Firestore for 200 staff or export system backups</p>
          </div>
        </div>
        <button onclick="document.getElementById('${modalId}').classList.add('hidden')" class="p-1 text-slate-400 hover:text-white text-2xl font-bold cursor-pointer">&times;</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        
        <!-- Column 1: Bulk CSV Import -->
        <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
          <h4 class="font-bold text-emerald-300 text-sm flex items-center space-x-1.5">
            <span>📥 CSV Bulk Upload (Chunked Batch)</span>
          </h4>
          <p class="text-slate-400 text-[11px]">Select target database collection and upload formatted CSV data:</p>
          
          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Target Collection</label>
            <select id="data-import-collection" class="w-full bg-slate-900 text-white text-xs border border-slate-700 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <optgroup label="Core Master Datasets">
                <option value="clientsMaster">Clients Master (GSTIN, Terms, Contacts)</option>
                <option value="projectsMaster">Projects Master (Automation & Turnkey)</option>
                <option value="employees">Employees Directory (Hierarchy & Roles)</option>
                <option value="sparePartsMaster">Spare Parts & Products Master (HSN, Prices)</option>
              </optgroup>
              <optgroup label="Commercial & Operations">
                <option value="invoices">Invoices & Proformas</option>
                <option value="quotations">Quotations & Price Bids</option>
                <option value="orders">Orders & Contracts</option>
                <option value="dwmActivities">DWM Daily Task Logs</option>
                <option value="leads">CRM Leads & Deals</option>
                <option value="payments">Payment Collections (AR)</option>
                <option value="attendance">Attendance Records</option>
                <option value="kraTargets">KRA Targets</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select CSV File</label>
            <input type="file" id="data-import-file-input" accept=".csv, .json" class="w-full bg-slate-900 text-slate-300 text-xs border border-slate-700 rounded-lg p-1.5 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer" />
          </div>

          <div class="flex items-center space-x-2 pt-1">
            <button onclick="processDataCenterCSVUpload()" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg transition-colors shadow-xs flex items-center justify-center space-x-1 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              <span>Upload to Firestore</span>
            </button>
            <button onclick="downloadCSVTemplate()" class="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer" title="Download Prescribed Format CSV">
              Template CSV
            </button>
            <a href="master-data.html" class="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1" title="Open Full Master Data Hub">
              Master Hub ↗
            </a>
          </div>

          <div id="data-import-status-msg" class="text-[11px] hidden p-2 rounded-lg"></div>
        </div>

        <!-- Column 2: Data Export & System Backup -->
        <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
          <h4 class="font-bold text-sky-300 text-sm flex items-center space-x-1.5">
            <span>📤 Instant System Export & Backup</span>
          </h4>
          <p class="text-slate-400 text-[11px]">Download production database records as JSON or CSV files for analysis or backup:</p>

          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Export Collection</label>
            <select id="data-export-collection" class="w-full bg-slate-900 text-white text-xs border border-slate-700 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-sky-500">
              <option value="all">Full System Backup (All Collections)</option>
              <option value="clientsMaster">Clients Master</option>
              <option value="projectsMaster">Projects Master</option>
              <option value="sparePartsMaster">Spare Parts Master</option>
              <option value="employees">Employees Directory</option>
              <option value="invoices">Invoices & Proformas</option>
              <option value="quotations">Quotations & Approvals</option>
              <option value="orders">Orders & Contracts</option>
              <option value="dwmActivities">DWM Task Entries</option>
              <option value="leads">CRM Pipeline</option>
              <option value="payments">Payment Collections</option>
              <option value="attendance">Attendance Logs</option>
            </select>
          </div>

          <div class="pt-2 space-y-2">
            <button onclick="executeDataExportJSON()" class="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded-lg transition-colors shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span>Download JSON Backup</span>
            </button>
            
            <button onclick="executeDataExportCSV()" class="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2 rounded-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer">
              <span>Export CSV Table</span>
            </button>
          </div>
        </div>

      </div>

      <div class="border-t border-slate-800 pt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>🔒 Input Sanitization & Batch Chunk Guardrails Active</span>
        <button onclick="document.getElementById('${modalId}').classList.add('hidden')" class="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors cursor-pointer">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Data Import Helpers
function downloadCSVTemplate() {
  var col = document.getElementById('data-import-collection')?.value || 'employees';
  var csvContent = "";
  var filename = col + "_template.csv";

  if (col === 'clientsMaster') {
    var tmpl = window.RevOpsStore?.getPrescribedCsvTemplate ? window.RevOpsStore.getPrescribedCsvTemplate('clients') : null;
    if (tmpl) {
      csvContent = tmpl.headers + "\n" + tmpl.sampleRows.join("\n");
      filename = tmpl.filename;
    } else {
      csvContent = "clientCode,clientName,gstin,contactPerson,email,phone,address,city,state,vertical,creditPeriodDays\nCL-001,JSW Steel Limited,29AAACJ1011A1Z2,Mr. Raghunath Verma,r.verma@jsw.in,9840112233,Toranagallu Slag Yard,Ballari,Karnataka,Sales,30\n";
    }
  } else if (col === 'projectsMaster') {
    var tmpl = window.RevOpsStore?.getPrescribedCsvTemplate ? window.RevOpsStore.getPrescribedCsvTemplate('projects') : null;
    if (tmpl) {
      csvContent = tmpl.headers + "\n" + tmpl.sampleRows.join("\n");
      filename = tmpl.filename;
    } else {
      csvContent = "projectCode,projectName,clientName,vertical,projectValue,startDate,targetCompletionDate,projectManagerName,status,budgetINR\nPRJ-2026-01,JSW Slag Yard Dynamic Crane Scale Automation,JSW Steel Limited,Projects,4500000,01/04/2026,30/09/2026,Mr. Murugan V,In Execution,3800000\n";
    }
  } else if (col === 'sparePartsMaster') {
    var tmpl = window.RevOpsStore?.getPrescribedCsvTemplate ? window.RevOpsStore.getPrescribedCsvTemplate('spareParts') : null;
    if (tmpl) {
      csvContent = tmpl.headers + "\n" + tmpl.sampleRows.join("\n");
      filename = tmpl.filename;
    } else {
      csvContent = "partNumber,partName,category,compatibleModel,hsnCode,unitPrice,gstPercent,uom,stockQty,minReorderLevel,leadTimeDays\nSP-LC-50T,High Precision 50-Ton Shear Beam Load Cell,Load Cells,Crane Scales CS-50T,90318000,45000,18,Nos,24,5,7\n";
    }
  } else if (col === 'employees') {
    var tmpl = window.RevOpsStore?.getPrescribedCsvTemplate ? window.RevOpsStore.getPrescribedCsvTemplate('employees') : null;
    if (tmpl) {
      csvContent = tmpl.headers + "\n" + tmpl.sampleRows.join("\n");
      filename = tmpl.filename;
    } else {
      csvContent = "employeeId,fullName,designation,vertical,reportsTo,reportsToName,email,mobile,role,workArrangement,dateOfJoining,isActive\nE-006,Senthil Nathan,Senior Field Engineer,Projects & production,E-003,Mrs. Anitha,senthil@measuredi.com,9840667788,staff,Site / On-Field,01/06/2021,true\n";
    }
  } else if (col === 'orders') {
    csvContent = "orderId,customerName,vertical,amount,financialYear,orderDate,status\nORD-2026-99,JSW Steel,Sales,1500000,2026-27,02/08/2026,Booked\n";
  } else if (col === 'invoices') {
    csvContent = "invoiceNumber,invoiceType,customerName,customerGstin,vertical,taxableValue,taxAmount,grandTotal,status,dueDate\nINV/2026-27/088,Tax Invoice,Tata Steel Limited,20AAACT2702H1ZQ,Projects,500000,90000,590000,Approved,30/09/2026\n";
  } else {
    csvContent = "id,title,category,date,status,employeeId\n101,Customer Site Visit,Service/Parts,02/08/2026,Completed,E-004\n";
  }

  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function processDataCenterCSVUpload() {
  var fileInput = document.getElementById('data-import-file-input');
  var colSelect = document.getElementById('data-import-collection');
  var statusMsg = document.getElementById('data-import-status-msg');
  
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    if (statusMsg) {
      statusMsg.className = "text-[11px] p-2 rounded-lg bg-rose-950 text-rose-300 border border-rose-800";
      statusMsg.textContent = "Please select a valid CSV file to upload.";
      statusMsg.classList.remove('hidden');
    }
    return;
  }

  var file = fileInput.files[0];
  var colName = colSelect.value;
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var lines = text.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
    if (lines.length < 2) {
      if (statusMsg) {
        statusMsg.className = "text-[11px] p-2 rounded-lg bg-rose-950 text-rose-300 border border-rose-800";
        statusMsg.textContent = "CSV file must contain a header line and at least one data record.";
        statusMsg.classList.remove('hidden');
      }
      return;
    }

    var headers = lines[0].split(',').map(function(h){ return h.replace(/^["']|["']$/g, '').trim(); });
    var records = [];
    for (var i = 1; i < lines.length; i++) {
      var row = lines[i].split(',').map(function(c){ return c.replace(/^["']|["']$/g, '').trim(); });
      var record = {};
      headers.forEach(function(h, idx) {
        if (h && row[idx] !== undefined) {
          record[h] = row[idx];
        }
      });
      records.push(record);
    }

    if (window.RevOpsStore && typeof window.RevOpsStore.bulkUploadItems === 'function') {
      window.RevOpsStore.bulkUploadItems(colName, records, function(count, err) {
        if (statusMsg) {
          statusMsg.className = "text-[11px] p-2 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800";
          statusMsg.textContent = "Successfully imported " + count + " records into " + colName + "! Real-time sync updated across devices.";
          statusMsg.classList.remove('hidden');
        }
      });
    }
  };
  reader.readAsText(file);
}

function executeDataExportJSON() {
  var col = document.getElementById('data-export-collection')?.value || 'all';
  var exportData = {};
  if (col === 'all') {
    var cols = ['employees', 'kraTargets', 'aopTargets', 'orders', 'dwmActivities', 'attendance', 'leads', 'payments', 'reviews', 'quotations', 'expenses', 'serviceTickets'];
    cols.forEach(function(c) {
      exportData[c] = window.RevOpsStore.getCollection(c) || [];
    });
  } else {
    exportData[col] = window.RevOpsStore.getCollection(col) || [];
  }
  
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
  var link = document.createElement('a');
  link.setAttribute("href", dataStr);
  link.setAttribute("download", "MeasureDI_RevOps_Backup_" + col + "_" + new Date().toISOString().slice(0, 10) + ".json");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}



function executeDataExportCSV() {
  var col = document.getElementById('data-export-collection')?.value || 'employees';
  if (col === 'all') col = 'employees';
  var items = window.RevOpsStore.getCollection(col) || [];
  if (items.length === 0) {
    alert("No records found in " + col + " to export.");
    return;
  }
  
  var keys = Object.keys(items[0]);
  var csvLines = [];
  csvLines.push(keys.join(','));
  items.forEach(function(item) {
    var row = keys.map(function(k) {
      var val = item[k] !== undefined ? String(item[k]).replace(/"/g, '""') : '';
      return '"' + val + '"';
    });
    csvLines.push(row.join(','));
  });
  
  var csvStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvLines.join('\n'));
  var link = document.createElement('a');
  link.setAttribute("href", csvStr);
  link.setAttribute("download", "K30_ERP_" + col + "_" + new Date().toISOString().slice(0, 10) + ".csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Auto-initialize Auth Guard & Global Navbar across all pages
function autoInitGlobalAuthGuard() {
  try {
    var currentPath = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPath !== 'login.html') {
      checkAuth();
    }
  } catch(e) {
    console.error("Error initializing auth guard:", e);
    try {
      renderRevOpsNavbar('Ravichandran', 'super_admin', true);
    } catch(e2) {
      console.error("Fallback navbar render failed:", e2);
    }
  }
}

// Universal Global Modal Safety Fallbacks (Ensures all "+ Create" buttons work instantly on all pages and logins)
window.openLeadModal = window.openLeadModal || function() {
  var modal = document.getElementById('lead-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeLeadModal = window.closeLeadModal || function() {
  var modal = document.getElementById('lead-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.openOrderModal = window.openOrderModal || function() {
  var modal = document.getElementById('order-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeOrderModal = window.closeOrderModal || function() {
  var modal = document.getElementById('order-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.openQuoteModal = window.openQuoteModal || function() {
  var modal = document.getElementById('quote-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeQuoteModal = window.closeQuoteModal || function() {
  var modal = document.getElementById('quote-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.openCreateInvoiceModal = window.openCreateInvoiceModal || function() {
  var modal = document.getElementById('invoiceModal') || document.getElementById('invoice-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeInvoiceModal = window.closeInvoiceModal || function() {
  var modal = document.getElementById('invoiceModal') || document.getElementById('invoice-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.openRaiseTicketModal = window.openRaiseTicketModal || function() {
  var modal = document.getElementById('ticketModal') || document.getElementById('ticket-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeRaiseTicketModal = window.closeRaiseTicketModal || function() {
  var modal = document.getElementById('ticketModal') || document.getElementById('ticket-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.openDwmModal = window.openDwmModal || function() {
  var modal = document.getElementById('dwm-modal') || document.getElementById('task-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeDwmModal = window.closeDwmModal || function() {
  var modal = document.getElementById('dwm-modal') || document.getElementById('task-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInitGlobalAuthGuard);
} else {
  autoInitGlobalAuthGuard();
}

// Top Navigation Dropdown Toggle Handlers
window.toggleTopNavMenu = function(event, menuId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  var target = document.getElementById(menuId);
  if (!target) return;
  var container = target.closest('.top-nav-dropdown-container');
  var isOpen = container ? container.classList.contains('open') : false;
  
  // Close all other dropdown containers first
  document.querySelectorAll('.top-nav-dropdown-container').forEach(function(c) {
    if (c !== container) {
      c.classList.remove('open');
    }
  });

  if (isOpen) {
    if (container) container.classList.remove('open');
  } else {
    if (container) container.classList.add('open');
  }
};

window.closeAllTopNavMenus = function() {
  document.querySelectorAll('.top-nav-dropdown-container').forEach(function(c) {
    c.classList.remove('open');
  });
  var userMenu = document.getElementById('topbar-user-menu');
  if (userMenu) userMenu.classList.add('hidden');
  var userMenuDesktop = document.getElementById('sidebar-user-menu-desktop');
  if (userMenuDesktop) userMenuDesktop.classList.add('hidden');
};

document.addEventListener('click', function(e) {
  if (!e.target.closest('.top-nav-dropdown-container') && !e.target.closest('#topbar-user-menu') && !e.target.closest('#sidebar-user-menu-desktop')) {
    window.closeAllTopNavMenus();
  }
});

function getRevOpsNavigationHtml(userName, userRole, employeeId, userEmail, roleBadgeColor, currentPath, salesItems, financeItems, hrItems, perfItems, serviceItems, showTeamAndReviews, isAdmin) {
  function renderSidebarItem(title, path, icon, show) {
    if (!show) return '';
    var isActive = currentPath === path;
    var activeClass = isActive 
      ? 'bg-[#982B68] text-white font-extrabold shadow-sm border-l-4 border-amber-400' 
      : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium';
    return `<a href="${path}" class="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs transition-all ${activeClass}">
      <span class="text-sm shrink-0">${icon}</span>
      <span class="truncate">${title}</span>
    </a>`;
  }

  function renderTopDropdown(title, iconEmoji, items, categoryPaths) {
    var isCatActive = categoryPaths.includes(currentPath);
    var catClass = isCatActive
      ? "px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#982B68] text-white shadow-xs flex items-center space-x-1"
      : "px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all flex items-center space-x-1";

    var safeId = 'top-menu-' + title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    var visibleItems = items.filter(function(i) { return i.show; });

    var itemsHtml = visibleItems.map(function(item) {
      var isActive = currentPath === item.path;
      return `
        <a href="${item.path}" class="block p-2 rounded-lg text-xs hover:bg-slate-800 transition-colors ${isActive ? 'bg-indigo-900/80 text-white font-bold border-l-2 border-[#982B68]' : 'text-slate-300'}">
          <div class="flex items-center space-x-1.5 font-bold">
            <span>${item.icon}</span>
            <span>${item.title}</span>
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5 leading-tight">${item.desc}</div>
        </a>
      `;
    }).join('');

    return `
      <div class="relative group top-nav-dropdown-container">
        <button type="button" onclick="toggleTopNavMenu(event, '${safeId}')" class="${catClass} cursor-pointer select-none" title="Open ${title} Menu">
          <span class="text-xs pointer-events-none">${iconEmoji}</span>
          <span class="pointer-events-none">${title}</span>
          <svg class="w-3 h-3 text-slate-400 group-hover:rotate-180 transition-transform pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div id="${safeId}" class="top-nav-dropdown-menu absolute left-0 top-full pt-1.5 w-72 md:w-80 z-50">
          <div class="bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-2 space-y-1 backdrop-blur-md">
            <div class="text-[10px] font-black uppercase text-amber-400 tracking-wider px-2 py-1 border-b border-slate-800 flex items-center justify-between">
              <span>${title} Hubs</span>
              <span class="text-[9px] text-slate-400 font-bold">${visibleItems.length} Modules</span>
            </div>
            ${itemsHtml}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <style id="revops-dropdown-core-styles">
      svg {
        max-width: 100%;
        box-sizing: border-box;
      }
      .top-nav-dropdown-menu {
        display: none;
      }
      .top-nav-dropdown-container:hover .top-nav-dropdown-menu,
      .top-nav-dropdown-container.open .top-nav-dropdown-menu {
        display: block !important;
      }
    </style>
    <!-- TOP HORIZONTAL NAVIGATION HEADER BAR (FIXED AT VERY TOP ACROSS ALL PAGES) -->
    <header class="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-200 shadow-xl px-4 flex items-center justify-between">
      
      <!-- Left: Logo & Brand -->
      <div class="flex items-center space-x-3">
        <a href="${userRole === 'staff' ? 'my-scorecard.html' : 'dashboard.html'}" class="flex items-center space-x-2.5 group">
          <div class="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 p-1 group-hover:border-[#982B68] transition-colors shadow-xs">
            <svg class="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M45 22C30 22 18 34 18 49C18 64 30 76 45 76C60 76 72 64 72 49V40H56V49C56 55 51 60 45 60C39 60 34 55 34 49C34 43 39 38 45 38H56V22H45Z" fill="#982B68"/>
              <rect x="58" y="12" width="7" height="7" fill="#982B68"/>
              <rect x="67" y="12" width="7" height="7" fill="#982B68"/>
              <rect x="58" y="21" width="7" height="7" fill="#982B68"/>
              <rect x="67" y="21" width="7" height="7" fill="#982B68"/>
              <rect x="67" y="30" width="7" height="7" fill="#982B68"/>
              <rect x="58" y="30" width="7" height="7" fill="#ffffff"/>
            </svg>
          </div>
          <div>
            <span class="text-xs font-black text-white tracking-wider block leading-none">K-30_ERP</span>
            <span class="text-[8px] font-bold text-[#E283BD] tracking-widest uppercase block leading-tight mt-0.5">ENTERPRISE REVOPS & ERP</span>
          </div>
        </a>
        <span class="hidden sm:inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${roleBadgeColor}">${userRole}</span>
      </div>

      <!-- Middle: Horizontal Category Dropdown Menus (Desktop / Tablet) -->
      <nav class="hidden md:flex items-center space-x-1.5">
        ${isAdmin ? `<a href="dashboard.html" class="${currentPath === 'dashboard.html' ? 'px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#982B68] text-white shadow-xs' : 'px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all'}">📊 Dashboard</a>` : ''}
        ${renderTopDropdown("Sales", "📈", salesItems, ['leads.html', 'quotations.html', 'orders.html', 'invoices.html', 'payments.html', 'master-data.html', 'audit-logs.html'])}
        ${renderTopDropdown("Service & Quality", "🛠️", serviceItems, ['service-tickets.html', 'amc-contracts.html', 'service-leads.html', 'amc-quotes.html', 'amc-orders.html', 'amc-invoices.html', 'parts-sales.html', 'warranty-management.html'])}
        ${renderTopDropdown("Finance", "💰", financeItems, ['expenses.html', 'payroll.html'])}
        ${renderTopDropdown("People & HR", "👥", hrItems, ['employees.html', 'attendance.html', 'my-team.html'])}
        ${renderTopDropdown("Performance", "🎯", perfItems, ['my-scorecard.html', 'dwm.html', 'kra-targets.html', 'reviews.html', 'aop-targets.html', 'user-guide.html'])}
        ${isAdmin ? `<a href="reports.html" class="${currentPath === 'reports.html' ? 'px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#982B68] text-white shadow-xs' : 'px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all'}">📈 Reports</a>` : ''}
      </nav>

      <!-- Right: User Switcher, Data Sync, Logout -->
      <div class="flex items-center space-x-2">
        ${(userRole === 'super_admin' || userRole === 'admin') ? `
          <!-- Switch Session User Button -->
          <div class="relative">
            <button type="button" onclick="var m=document.getElementById('topbar-user-menu'); if(m) m.classList.toggle('hidden');" class="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer border border-slate-700 transition-colors">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span class="truncate max-w-[120px]">${userName}</span>
              <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <!-- Popup List -->
            <div id="topbar-user-menu" class="hidden absolute right-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-2 z-50">
              <div class="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 py-1 border-b border-slate-800 mb-1 flex items-center justify-between">
                <span>Switch Session User (200 Roster)</span>
                <span class="text-[9px] text-emerald-400 font-bold">RBAC</span>
              </div>
              <div class="space-y-1 max-h-52 overflow-y-auto" id="user-switcher-list">
                <!-- Populated dynamically via JS -->
              </div>
            </div>
          </div>
        ` : `
          <div class="py-1 px-2.5 bg-slate-800 text-slate-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 border border-slate-700">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="truncate max-w-[120px]">${userName}</span>
          </div>
        `}

        <a href="Measure_DI_RevOps_Client_Demo_Guide.pdf" download="Measure_DI_RevOps_Client_Demo_Guide.pdf" target="_blank" class="hidden sm:flex py-1 px-2.5 text-xs font-bold text-sky-300 hover:text-white bg-sky-950/60 hover:bg-sky-900 border border-sky-800/80 rounded-lg transition-colors items-center space-x-1 cursor-pointer" title="Download Application PDF Guide">
          <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>PDF Guide</span>
        </a>

        <button onclick="openDataImportExportModal()" class="hidden sm:flex py-1 px-2 text-xs font-bold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/80 rounded-lg transition-colors items-center space-x-1 cursor-pointer" title="Data Center">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          <span>Data Center</span>
        </button>

        <button onclick="handleRevOpsLogout()" class="py-1 px-2 text-xs font-bold text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer" title="Logout">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          <span class="hidden sm:inline">Logout</span>
        </button>

        <!-- Mobile Drawer Menu Button -->
        <button onclick="toggleMobileNavDrawer()" class="md:hidden p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 cursor-pointer flex items-center space-x-1">
          <svg class="w-5 h-5 text-[#E283BD]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
    </header>
    <!-- DESKTOP / LAPTOP / TABLET PERSISTENT LEFT SIDEBAR MENU -->
    <aside id="revops-sidebar" class="hidden md:flex md:w-64 md:flex-col md:fixed md:top-14 md:bottom-0 md:left-0 z-40 bg-slate-900 border-r border-slate-800 text-slate-300 shadow-2xl shrink-0">
      
      <!-- Brand & Logo Header -->
      <div class="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <a href="${userRole === 'staff' ? 'my-scorecard.html' : 'dashboard.html'}" class="flex items-center space-x-2.5 group">
          <div class="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 p-1 group-hover:border-[#982B68] transition-colors shadow-xs">
            <svg class="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M45 22C30 22 18 34 18 49C18 64 30 76 45 76C60 76 72 64 72 49V40H56V49C56 55 51 60 45 60C39 60 34 55 34 49C34 43 39 38 45 38H56V22H45Z" fill="#982B68"/>
              <rect x="58" y="12" width="7" height="7" fill="#982B68"/>
              <rect x="67" y="12" width="7" height="7" fill="#982B68"/>
              <rect x="58" y="21" width="7" height="7" fill="#982B68"/>
              <rect x="67" y="21" width="7" height="7" fill="#982B68"/>
              <rect x="67" y="30" width="7" height="7" fill="#982B68"/>
              <rect x="58" y="30" width="7" height="7" fill="#ffffff"/>
            </svg>
          </div>
          <div>
            <span class="text-sm font-extrabold text-white tracking-wider block leading-none">K-30_ERP</span>
            <span class="text-[9px] font-bold text-[#E283BD] tracking-widest uppercase block leading-tight mt-0.5">ENTERPRISE ERP</span>
          </div>
        </a>
        <span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">REVOPS</span>
      </div>

      <!-- Active User Info & Quick Switcher Card -->
      <div class="p-3 border-b border-slate-800 bg-slate-850/50">
        <div class="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 relative">
          <div class="flex items-center space-x-2.5">
            <div class="w-8 h-8 rounded-lg bg-[#982B68]/30 text-[#E283BD] font-black flex items-center justify-center text-xs border border-[#982B68]/40 shrink-0">
              ${userName.charAt(0)}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-white truncate block">${userName}</span>
                <span class="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${roleBadgeColor}">${userRole}</span>
              </div>
              <span class="text-[10px] text-slate-400 truncate block">${employeeId} &bull; ${userEmail || 'Active'}</span>
            </div>
          </div>

          ${(userRole === 'super_admin' || userRole === 'admin') ? `
            <!-- Switch Session User Button -->
            <button type="button" onclick="var m=document.getElementById('sidebar-user-menu-desktop'); if(m) m.classList.toggle('hidden');" class="mt-2 w-full py-1 px-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center justify-between cursor-pointer border border-slate-600/50 transition-colors">
              <span>Switch Session User</span>
              <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>

            <!-- Desktop User Switcher Popup Menu -->
            <div id="sidebar-user-menu-desktop" class="hidden absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-2 z-50">
              <div class="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 py-1 border-b border-slate-800 mb-1 flex items-center justify-between">
                <span>Roster Select (200 Members)</span>
                <span class="text-[9px] text-emerald-400 font-bold">RBAC</span>
              </div>
              <div class="space-y-1 max-h-52 overflow-y-auto" id="user-switcher-list-desktop">
                <!-- Populated dynamically via JS -->
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Scrollable Left Sidebar Navigation Menu -->
      <div class="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
        
        <!-- Section 1: Overview -->
        ${isAdmin ? `
          <div>
            <div class="px-3 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Overview</div>
            <div class="space-y-1">
              ${renderSidebarItem("Executive Dashboard", "dashboard.html", "📊", true)}
            </div>
          </div>
        ` : ''}

        <!-- Section 2: Sales & Revenue -->
        <div>
          <div class="px-3 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center space-x-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            <span>Sales & Revenue</span>
          </div>
          <div class="space-y-1">
            ${salesItems.map(function(item) { return renderSidebarItem(item.title, item.path, item.icon, item.show); }).join('')}
          </div>
        </div>

        <!-- Section 2.5: Service & Quality -->
        <div>
          <div class="px-3 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center space-x-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span>Service & Quality</span>
          </div>
          <div class="space-y-1">
            ${serviceItems.map(function(item) { return renderSidebarItem(item.title, item.path, item.icon, item.show); }).join('')}
          </div>
        </div>

        <!-- Section 3: Finance & Accounting -->
        <div>
          <div class="px-3 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 flex items-center space-x-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Finance & Ledger</span>
          </div>
          <div class="space-y-1">
            ${financeItems.map(function(item) { return renderSidebarItem(item.title, item.path, item.icon, item.show); }).join('')}
          </div>
        </div>

        <!-- Section 4: People & HR -->
        <div>
          <div class="px-3 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-sky-400 flex items-center space-x-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            <span>People & HR</span>
          </div>
          <div class="space-y-1">
            ${hrItems.map(function(item) { return renderSidebarItem(item.title, item.path, item.icon, item.show); }).join('')}
          </div>
        </div>

        <!-- Section 5: Performance & Strategy -->
        <div>
          <div class="px-3 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-400 flex items-center space-x-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
            <span>Performance</span>
          </div>
          <div class="space-y-1">
            ${perfItems.map(function(item) { return renderSidebarItem(item.title, item.path, item.icon, item.show); }).join('')}
          </div>
        </div>

        <!-- Section 6: Reports -->
        ${isAdmin ? `
          <div>
            <div class="px-3 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Analytics</div>
            <div class="space-y-1">
              ${renderSidebarItem("Executive Reports", "reports.html", "📊", true)}
            </div>
          </div>
        ` : ''}

      </div>

      <!-- Sidebar Bottom Sticky Actions & Live Sync Status -->
      <div class="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
        
        <!-- Live Cloud Sync Indicator -->
        <div class="flex items-center justify-between bg-slate-800/90 px-2.5 py-1.5 rounded-xl border border-emerald-500/30 text-[11px] font-semibold text-emerald-300" title="Firestore Real-time Sync Active">
          <div class="flex items-center space-x-2">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span class="font-bold text-white">200 Live Roster</span>
          </div>
          <button onclick="triggerManualSync()" class="text-slate-400 hover:text-white transition-colors cursor-pointer" title="Trigger Instant Cloud Sync">
            <svg id="sync-icon-spin" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>

        <!-- Data Center & Logout Buttons -->
        <div class="grid grid-cols-2 gap-1.5">
          <button onclick="openDataImportExportModal()" class="py-1.5 px-2 text-xs font-bold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/80 rounded-xl transition-colors flex items-center justify-center space-x-1 cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            <span>Data Center</span>
          </button>

          <button onclick="handleRevOpsLogout()" class="py-1.5 px-2 text-xs font-bold text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 rounded-xl transition-colors flex items-center justify-center space-x-1 cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- MOBILE TOP HEADER (VISIBLE ON MOBILE SCREEN ONLY < MD) -->
    <div class="md:hidden sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-slate-300 shadow-md">
      <a href="${userRole === 'staff' ? 'my-scorecard.html' : 'dashboard.html'}" class="flex items-center space-x-2">
        <div class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 p-0.5 flex items-center justify-center">
          <svg class="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M45 22C30 22 18 34 18 49C18 64 30 76 45 76C60 76 72 64 72 49V40H56V49C56 55 51 60 45 60C39 60 34 55 34 49C34 43 39 38 45 38H56V22H45Z" fill="#982B68"/>
            <rect x="58" y="12" width="7" height="7" fill="#982B68"/>
            <rect x="67" y="12" width="7" height="7" fill="#982B68"/>
            <rect x="58" y="21" width="7" height="7" fill="#982B68"/>
            <rect x="67" y="21" width="7" height="7" fill="#982B68"/>
            <rect x="67" y="30" width="7" height="7" fill="#982B68"/>
            <rect x="58" y="30" width="7" height="7" fill="#ffffff"/>
          </svg>
        </div>
        <div>
          <span class="text-xs font-black text-white tracking-wider block leading-none">MEASURE DI</span>
          <span class="text-[8px] font-bold text-[#E283BD]">REVOPS</span>
        </div>
      </a>

      <div class="flex items-center space-x-2">
        <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${roleBadgeColor}">${userRole}</span>
        <button onclick="toggleMobileNavDrawer()" class="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 cursor-pointer flex items-center space-x-1">
          <svg class="w-5 h-5 text-[#E283BD]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          <span class="text-xs font-bold text-white">Menu</span>
        </button>
      </div>
    </div>

    <!-- MOBILE CATEGORIZED DRAWER OVERLAY -->
    <div id="mobile-nav-drawer" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md hidden transition-opacity flex justify-end">
      <div class="w-full max-w-xs bg-slate-900 h-full overflow-y-auto p-5 shadow-2xl border-l border-slate-800 flex flex-col justify-between">
        <div>
          <!-- Mobile Drawer Header -->
          <div class="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-lg bg-[#982B68] text-white font-black flex items-center justify-center text-sm shadow-xs">
                K
              </div>
              <div>
                <span class="text-xs font-black text-white uppercase tracking-wider block">K-30_ERP</span>
                <span class="text-[9px] font-bold text-[#E283BD]">Enterprise RevOps</span>
              </div>
            </div>
            <button onclick="toggleMobileNavDrawer()" class="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg text-lg font-bold">&times;</button>
          </div>

          <!-- User Info Banner in Drawer -->
          <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 mb-5 flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-white block">Hi, ${userName}</span>
              <span class="text-[10px] text-slate-400">${userEmail}</span>
            </div>
            <span class="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${roleBadgeColor}">${userRole}</span>
          </div>

          <!-- Categorized Mobile Navigation Accordion List -->
          <div class="space-y-4">
            ${userRole !== 'staff' ? `
              <div>
                <a href="dashboard.html" onclick="toggleMobileNavDrawer()" class="flex items-center space-x-2.5 p-2.5 rounded-xl ${currentPath === 'dashboard.html' ? 'bg-[#982B68] text-white font-bold' : 'bg-slate-800/60 text-slate-200'}">
                  <svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
                  <span class="text-xs font-bold">Executive Dashboard</span>
                </a>
              </div>
            ` : ''}

            <!-- Sales Group -->
            <div class="bg-slate-800/40 rounded-xl p-2.5 border border-slate-800">
              <div class="text-[10px] font-black uppercase text-emerald-400 tracking-wider mb-2 flex items-center space-x-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                <span>Sales & Revenue</span>
              </div>
              <div class="space-y-1">
                ${salesItems.filter(function(i){ return i.show; }).map(function(i){
                  return `<a href="${i.path}" onclick="toggleMobileNavDrawer()" class="flex items-center space-x-2 p-2 rounded-lg text-xs font-semibold ${currentPath === i.path ? 'bg-indigo-900 text-white font-extrabold border-l-2 border-[#982B68]' : 'text-slate-300 hover:bg-slate-800'}"><span>${i.icon}</span><span>${i.title}</span></a>`;
                }).join('')}
              </div>
            </div>

            <!-- Service Group -->
            <div class="bg-slate-800/40 rounded-xl p-2.5 border border-slate-800">
              <div class="text-[10px] font-black uppercase text-amber-400 tracking-wider mb-2 flex items-center space-x-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>Service & Quality</span>
              </div>
              <div class="space-y-1">
                ${serviceItems.filter(function(i){ return i.show; }).map(function(i){
                  return `<a href="${i.path}" onclick="toggleMobileNavDrawer()" class="flex items-center space-x-2 p-2 rounded-lg text-xs font-semibold ${currentPath === i.path ? 'bg-indigo-900 text-white font-extrabold border-l-2 border-[#982B68]' : 'text-slate-300 hover:bg-slate-800'}"><span>${i.icon}</span><span>${i.title}</span></a>`;
                }).join('')}
              </div>
            </div>

            <!-- Finance Group -->
            <div class="bg-slate-800/40 rounded-xl p-2.5 border border-slate-800">
              <div class="text-[10px] font-black uppercase text-indigo-400 tracking-wider mb-2 flex items-center space-x-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span>Finance & Ledger</span>
              </div>
              <div class="space-y-1">
                ${financeItems.filter(function(i){ return i.show; }).map(function(i){
                  return `<a href="${i.path}" onclick="toggleMobileNavDrawer()" class="flex items-center space-x-2 p-2 rounded-lg text-xs font-semibold ${currentPath === i.path ? 'bg-indigo-900 text-white font-extrabold border-l-2 border-[#982B68]' : 'text-slate-300 hover:bg-slate-800'}"><span>${i.icon}</span><span>${i.title}</span></a>`;
                }).join('')}
              </div>
            </div>

            <!-- HR Group -->
            <div class="bg-slate-800/40 rounded-xl p-2.5 border border-slate-800">
              <div class="text-[10px] font-black uppercase text-sky-400 tracking-wider mb-2 flex items-center space-x-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                <span>People & HR</span>
              </div>
              <div class="space-y-1">
                ${hrItems.filter(function(i){ return i.show; }).map(function(i){
                  return `<a href="${i.path}" onclick="toggleMobileNavDrawer()" class="flex items-center space-x-2 p-2 rounded-lg text-xs font-semibold ${currentPath === i.path ? 'bg-indigo-900 text-white font-extrabold border-l-2 border-[#982B68]' : 'text-slate-300 hover:bg-slate-800'}"><span>${i.icon}</span><span>${i.title}</span></a>`;
                }).join('')}
              </div>
            </div>

            <!-- Performance Group -->
            <div class="bg-slate-800/40 rounded-xl p-2.5 border border-slate-800">
              <div class="text-[10px] font-black uppercase text-purple-400 tracking-wider mb-2 flex items-center space-x-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
                <span>Performance & Strategy</span>
              </div>
              <div class="space-y-1">
                ${perfItems.filter(function(i){ return i.show; }).map(function(i){
                  return `<a href="${i.path}" onclick="toggleMobileNavDrawer()" class="flex items-center space-x-2 p-2 rounded-lg text-xs font-semibold ${currentPath === i.path ? 'bg-indigo-900 text-white font-extrabold border-l-2 border-[#982B68]' : 'text-slate-300 hover:bg-slate-800'}"><span>${i.icon}</span><span>${i.title}</span></a>`;
                }).join('')}
              </div>
            </div>

            ${userRole !== 'staff' ? `
              <div>
                <a href="reports.html" onclick="toggleMobileNavDrawer()" class="flex items-center space-x-2.5 p-2.5 rounded-xl ${currentPath === 'reports.html' ? 'bg-[#982B68] text-white font-bold' : 'bg-slate-800/60 text-slate-200'}">
                  <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <span class="text-xs font-bold">Analytics & Reports</span>
                </a>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Mobile Drawer Footer Actions -->
        <div class="pt-6 border-t border-slate-800 space-y-2 mt-6">
          <button onclick="if(confirm('Reload full 2-year dummy dataset?')) { window.RevOpsStore.reseedAllData(); }" class="w-full py-2.5 px-3 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            <span>Reload 2-Yr Data</span>
          </button>
          
          <button onclick="handleRevOpsLogout()" class="w-full py-2.5 px-3 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>

    <!-- FIXED MOBILE BOTTOM DOCK FOR QUICK SINGLE-THUMB ACCESS -->
    <div class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-400 py-1.5 px-2 flex items-center justify-around text-[10px]">
      <a href="${userRole === 'staff' ? 'my-scorecard.html' : 'dashboard.html'}" class="flex flex-col items-center py-1 px-2 rounded-lg ${currentPath === 'dashboard.html' || currentPath === 'my-scorecard.html' ? 'text-[#E283BD] font-black' : 'hover:text-white'}">
        <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        <span>Home</span>
      </a>

      <a href="dwm.html" class="flex flex-col items-center py-1 px-2 rounded-lg ${currentPath === 'dwm.html' ? 'text-[#E283BD] font-black' : 'hover:text-white'}">
        <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <span>DWM Tasks</span>
      </a>

      <a href="expenses.html" class="flex flex-col items-center py-1 px-2 rounded-lg ${currentPath === 'expenses.html' ? 'text-[#E283BD] font-black' : 'hover:text-white'}">
        <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span>Expenses</span>
      </a>

      <a href="attendance.html" class="flex flex-col items-center py-1 px-2 rounded-lg ${currentPath === 'attendance.html' ? 'text-[#E283BD] font-black' : 'hover:text-white'}">
        <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span>Attendance</span>
      </a>

      <button onclick="toggleMobileNavDrawer()" class="flex flex-col items-center py-1 px-2 rounded-lg text-slate-300 hover:text-white cursor-pointer">
        <svg class="w-5 h-5 mb-0.5 text-[#E283BD]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        <span class="font-bold">All Menu</span>
      </button>
    </div>
  `;
}
