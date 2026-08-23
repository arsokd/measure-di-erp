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

