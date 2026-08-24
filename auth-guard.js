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

  if (userRole === 'super_admin') {
    // Universal access
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

  var hasDirectReports = employees.some(function(e) {
    return e && e.reportsTo === employeeId;
  });

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

  navContainer.innerHTML = getRevOpsNavigationHtml(userName, userRole, employeeId, userEmail, roleBadgeColor, currentPath, salesItems, financeItems, hrItems, perfItems, serviceItems, showTeamAndReviews, isAdmin);

  if (document.body) {
    document.body.classList.add('md:pl-64', 'pt-14', 'pb-16', 'md:pb-6');
  }
}

// Universal Global Modal Safety Fallbacks
window.openLeadModal = function() {
  var modal = document.getElementById('lead-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeLeadModal = function() {
  var modal = document.getElementById('lead-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.openOrderModal = function() {
  var modal = document.getElementById('order-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeOrderModal = function() {
  var modal = document.getElementById('order-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.openQuoteModal = function() {
  var modal = document.getElementById('quote-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeQuoteModal = function() {
  var modal = document.getElementById('quote-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.openCreateInvoiceModal = function() {
  var modal = document.getElementById('invoiceModal') || document.getElementById('invoice-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeInvoiceModal = function() {
  var modal = document.getElementById('invoiceModal') || document.getElementById('invoice-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.openRaiseTicketModal = function() {
  var modal = document.getElementById('ticketModal') || document.getElementById('ticket-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeRaiseTicketModal = function() {
  var modal = document.getElementById('ticketModal') || document.getElementById('ticket-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.openDwmModal = function() {
  var modal = document.getElementById('dwm-modal') || document.getElementById('task-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeDwmModal = function() {
  var modal = document.getElementById('dwm-modal') || document.getElementById('task-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

// Auto-initialize Auth Guard & Global Navbar across all pages
function autoInitGlobalAuthGuard() {
  try {
    var currentPath = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPath !== 'login.html') {
      checkAuth();
    }
  } catch(e) {
    console.error("Error initializing auth guard:", e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInitGlobalAuthGuard);
} else {
  autoInitGlobalAuthGuard();
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

window.toggleTopNavMenu = function(event, menuId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  var target = document.getElementById(menuId);
  if (!target) return;
  var container = target.closest('.top-nav-dropdown-container');
  var isOpen = container ? container.classList.contains('open') : false;
  
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
};

document.addEventListener('click', function(e) {
  if (!e.target.closest('.top-nav-dropdown-container') && !e.target.closest('#topbar-user-menu')) {
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
      .top-nav-dropdown-menu { display: none; }
      .top-nav-dropdown-container:hover .top-nav-dropdown-menu,
      .top-nav-dropdown-container.open .top-nav-dropdown-menu { display: block !important; }
    </style>
    <header class="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-200 shadow-xl px-4 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <a href="${userRole === 'staff' ? 'my-scorecard.html' : 'dashboard.html'}" class="flex items-center space-x-2.5 group">
          <div class="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 p-1 group-hover:border-[#982B68] transition-colors shadow-xs">
            <i class="fa-solid fa-gauge text-purple-400 text-sm"></i>
          </div>
          <div>
            <span class="text-xs font-black text-white tracking-wider block leading-none">K-30_ERP</span>
            <span class="text-[8px] font-bold text-[#E283BD] tracking-widest uppercase block leading-tight mt-0.5">ENTERPRISE REVOPS & ERP</span>
          </div>
        </a>
        <span class="hidden sm:inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${roleBadgeColor}">${userRole}</span>
      </div>

      <nav class="hidden md:flex items-center space-x-1.5">
        ${isAdmin ? `<a href="dashboard.html" class="${currentPath === 'dashboard.html' ? 'px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#982B68] text-white shadow-xs' : 'px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all'}">📊 Dashboard</a>` : ''}
        ${renderTopDropdown("Sales", "📈", salesItems, ['leads.html', 'quotations.html', 'orders.html', 'invoices.html', 'payments.html', 'master-data.html', 'audit-logs.html'])}
        ${renderTopDropdown("Service & Quality", "🛠️", serviceItems, ['service-tickets.html', 'amc-contracts.html', 'service-leads.html', 'amc-quotes.html', 'amc-orders.html', 'amc-invoices.html', 'parts-sales.html', 'warranty-management.html'])}
        ${renderTopDropdown("Finance", "💰", financeItems, ['expenses.html', 'payroll.html'])}
        ${renderTopDropdown("People & HR", "👥", hrItems, ['employees.html', 'attendance.html', 'my-team.html'])}
        ${renderTopDropdown("Performance", "🎯", perfItems, ['my-scorecard.html', 'dwm.html', 'kra-targets.html', 'reviews.html', 'aop-targets.html', 'user-guide.html'])}
      </nav>

      <div class="flex items-center space-x-2">
        <div class="py-1 px-2.5 bg-slate-800 text-slate-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 border border-slate-700">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span class="truncate max-w-[120px]">${userName}</span>
        </div>

        <button onclick="handleRevOpsLogout()" class="py-1 px-2 text-xs font-bold text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer" title="Logout">
          <i class="fa-solid fa-power-off"></i>
          <span class="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  `;
}
