/**
 * Universal Authentication & Role-Based Access Control Guard
 * Handles authentication checks, dynamic top-nav rendering, role filtering, and user session management.
 */

// Role definitions & module access permissions
const ROLE_PERMISSIONS = {
  director: {
    label: 'Director / Super Admin',
    badgeClass: 'bg-purple-900/60 text-purple-300 border border-purple-500/40',
    allowedModules: ['*']
  },
  sales_manager: {
    label: 'Sales Manager',
    badgeClass: 'bg-blue-900/60 text-blue-300 border border-blue-500/40',
    allowedModules: [
      'dashboard', 'leads', 'quotations', 'orders', 'invoices', 'payments',
      'dwm', 'attendance', 'aop-targets', 'kra-targets', 'my-scorecard', 'my-team', 'reports'
    ]
  },
  service_manager: {
    label: 'Service Manager',
    badgeClass: 'bg-rose-900/60 text-rose-300 border border-rose-500/40',
    allowedModules: [
      'dashboard', 'service-tickets', 'service-leads', 'amc-contracts', 'amc-quotes', 'amc-orders',
      'amc-invoices', 'parts-sales', 'warranty-management', 'dwm', 'attendance', 'kra-targets', 'my-scorecard', 'reports'
    ]
  },
  sales_executive: {
    label: 'Sales Executive',
    badgeClass: 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/40',
    allowedModules: [
      'dashboard', 'leads', 'quotations', 'orders', 'dwm', 'attendance', 'my-scorecard', 'expenses'
    ]
  },
  service_engineer: {
    label: 'Service Engineer',
    badgeClass: 'bg-amber-900/60 text-amber-300 border border-amber-500/40',
    allowedModules: [
      'dashboard', 'service-tickets', 'parts-sales', 'dwm', 'attendance', 'my-scorecard', 'expenses'
    ]
  },
  finance_officer: {
    label: 'Finance & Accounts',
    badgeClass: 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40',
    allowedModules: [
      'dashboard', 'invoices', 'payments', 'expenses', 'payroll', 'amc-invoices', 'reports'
    ]
  },
  hr_operations: {
    label: 'HR & Operations',
    badgeClass: 'bg-teal-900/60 text-teal-300 border border-teal-500/40',
    allowedModules: [
      'dashboard', 'employees', 'attendance', 'payroll', 'reviews', 'sop', 'reports'
    ]
  }
};

// All 31 ERP modules organized by category
const MODULE_REGISTRY = [
  {
    category: 'Sales Pipeline & Revenue',
    icon: 'fa-funnel-dollar',
    color: 'text-purple-400',
    items: [
      { id: 'leads', name: 'Leads & Enquiries CRM', url: 'leads.html', icon: 'fa-filter' },
      { id: 'quotations', name: 'Quotations & Proposals', url: 'quotations.html', icon: 'fa-file-invoice' },
      { id: 'orders', name: 'Sales Orders & Purchase Orders', url: 'orders.html', icon: 'fa-cart-shopping' },
      { id: 'invoices', name: 'Sales Invoices (Tax GST)', url: 'invoices.html', icon: 'fa-file-invoice-dollar' },
      { id: 'payments', name: 'Payment Collections & NEFT/RTGS', url: 'payments.html', icon: 'fa-money-bill-wave' }
    ]
  },
  {
    category: 'Customer Service & AMC Support',
    icon: 'fa-headset',
    color: 'text-rose-400',
    items: [
      { id: 'service-tickets', name: 'Customer Service Tickets & SLA', url: 'service-tickets.html', icon: 'fa-ticket' },
      { id: 'service-leads', name: 'Service & Maintenance Leads', url: 'service-leads.html', icon: 'fa-wrench' },
      { id: 'amc-contracts', name: 'AMC Contract Management', url: 'amc-contracts.html', icon: 'fa-handshake' },
      { id: 'amc-quotes', name: 'AMC Quotations & Proposals', url: 'amc-quotes.html', icon: 'fa-file-signature' },
      { id: 'amc-orders', name: 'AMC Orders & Renewal Agreements', url: 'amc-orders.html', icon: 'fa-file-contract' },
      { id: 'amc-invoices', name: 'AMC Invoices & Milestones', url: 'amc-invoices.html', icon: 'fa-receipt' },
      { id: 'parts-sales', name: 'Spare Parts Sales & Dispatch', url: 'parts-sales.html', icon: 'fa-gears' },
      { id: 'warranty-management', name: 'Warranty Tracking & Expiry', url: 'warranty-management.html', icon: 'fa-shield-halved' }
    ]
  },
  {
    category: 'Operations, DWM & Daily Execution',
    icon: 'fa-calendar-check',
    color: 'text-cyan-400',
    items: [
      { id: 'dashboard', name: 'Executive Revenue Dashboard', url: 'dashboard.html', icon: 'fa-chart-pie' },
      { id: 'dwm', name: 'Daily Work Management (DWM)', url: 'dwm.html', icon: 'fa-calendar-days' },
      { id: 'attendance', name: 'Daily Attendance & Site Tracking', url: 'attendance.html', icon: 'fa-user-clock' },
      { id: 'expenses', name: 'Travel & Field Expenses', url: 'expenses.html', icon: 'fa-receipt' }
    ]
  },
  {
    category: 'Performance, Strategy & Planning',
    icon: 'fa-bullseye',
    color: 'text-amber-400',
    items: [
      { id: 'aop-targets', name: 'Annual Operating Plan (AOP)', url: 'aop-targets.html', icon: 'fa-crosshairs' },
      { id: 'kra-targets', name: 'Quarterly KRA Targets & KPIs', url: 'kra-targets.html', icon: 'fa-chart-line' },
      { id: 'my-scorecard', name: 'Individual Performance Scorecard', url: 'my-scorecard.html', icon: 'fa-award' },
      { id: 'my-team', name: 'Department Team Performance', url: 'my-team.html', icon: 'fa-users-gear' },
      { id: 'reviews', name: 'Performance Appraisals & Reviews', url: 'reviews.html', icon: 'fa-star' }
    ]
  },
  {
    category: 'Human Resources & Governance',
    icon: 'fa-users',
    color: 'text-teal-400',
    items: [
      { id: 'employees', name: 'Employee Directory & Hierarchy', url: 'employees.html', icon: 'fa-id-card' },
      { id: 'payroll', name: 'Payroll, Allowances & PF/ESI', url: 'payroll.html', icon: 'fa-calculator' },
      { id: 'sop', name: 'Standard Operating Procedures', url: 'sop.html', icon: 'fa-book' },
      { id: 'reports', name: 'Management Information Reports', url: 'reports.html', icon: 'fa-chart-simple' },
      { id: 'audit-logs', name: 'Master System Audit Trail', url: 'audit-logs.html', icon: 'fa-clock-rotate-left' },
      { id: 'master-data', name: 'Master System Configuration', url: 'master-data.html', icon: 'fa-sliders' },
      { id: 'user-guide', name: 'Complete ERP User Manual', url: 'user-guide.html', icon: 'fa-circle-question' }
    ]
  }
];

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse currentUser', e);
  }
  return null;
}

function checkAuth() {
  const user = getCurrentUser();
  const isLoginPage = window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('login');

  if (!user && !isLoginPage) {
    window.location.replace('login.html');
    return null;
  }

  if (user && isLoginPage) {
    window.location.replace('dashboard.html');
    return user;
  }

  return user;
}
function hasModuleAccess(moduleName, role) {
  if (!role || role === 'director') return true;
  const config = ROLE_PERMISSIONS[role];
  if (!config) return true;
  if (config.allowedModules.includes('*')) return true;
  return config.allowedModules.includes(moduleName);
}

function renderGlobalNav() {
  const user = getCurrentUser();
  if (!user) return;

  const roleConfig = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.director;
  const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';

  let navHtml = `
    <nav class="bg-slate-900 border-b border-slate-800 text-slate-200 sticky top-0 z-50 shadow-md">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          
          <!-- Brand Logo & Home -->
          <div class="flex items-center space-x-3">
            <a href="dashboard.html" class="flex items-center space-x-2.5">
              <div class="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-black text-lg">
                <i class="fa-solid fa-gauge-high"></i>
              </div>
              <span class="font-bold text-white text-base tracking-tight hidden sm:inline">Measure DI <span class="text-purple-400 text-xs px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800">ERP</span></span>
            </a>
          </div>

          <!-- Desktop Navigation Dropdown Menus -->
          <div class="hidden lg:flex items-center space-x-1">
  `;

  MODULE_REGISTRY.forEach((cat, idx) => {
    const accessibleItems = cat.items.filter(item => hasModuleAccess(item.id, user.role));
    if (accessibleItems.length === 0) return;

    navHtml += `
      <div class="relative group" style="position: relative;">
        <button class="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center space-x-1.5 focus:outline-none">
          <i class="fa-solid ${cat.icon} ${cat.color}"></i>
          <span>${cat.category.split(' ')[0]}</span>
          <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 group-hover:rotate-180 transition-transform"></i>
        </button>

        <div class="absolute left-0 mt-1 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-2 hidden group-hover:block z-50">
          <div class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 mb-1">
            ${cat.category}
          </div>
    `;

    accessibleItems.forEach(item => {
      const isActive = currentPath === item.url;
      navHtml += `
        <a href="${item.url}" class="flex items-center space-x-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-purple-300 transition-colors ${isActive ? 'bg-purple-900/30 text-purple-300 font-semibold border-l-2 border-purple-500' : ''}">
          <i class="fa-solid ${item.icon} w-4 text-slate-400"></i>
          <span>${item.name}</span>
        </a>
      `;
    });

    navHtml += `
        </div>
      </div>
    `;
  });

  navHtml += `
          </div>

          <!-- User Profile Switcher & Sign Out -->
          <div class="flex items-center space-x-3">
            <div class="hidden md:flex flex-col text-right">
              <span class="text-xs font-semibold text-white">${user.name || 'Admin User'}</span>
              <span class="text-[10px] text-purple-300 font-medium">${roleConfig.label}</span>
            </div>

            <button onclick="handleLogout()" title="Sign Out" class="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700/60 transition-all text-xs flex items-center space-x-1">
              <i class="fa-solid fa-right-from-bracket"></i>
              <span class="hidden sm:inline">Logout</span>
            </button>
          </div>

        </div>
      </div>
    </nav>
  `;

  const existingNav = document.querySelector('nav');
  if (existingNav) {
    existingNav.outerHTML = navHtml;
  } else {
    document.body.insertAdjacentHTML('afterbegin', navHtml);
  }
}

function handleLogout() {
  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('currentUser');
  window.location.replace('login.html');
}

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  if (user) {
    renderGlobalNav();
  }
});
