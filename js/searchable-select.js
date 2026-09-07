// searchable-select.js — Measure DI RevOps
//
// App-wide searchable dropdown enhancement. The client asked, explicitly
// and repeatedly, for every dropdown in the app to be searchable — not
// just a handful of pages. Rather than rewriting each of the 143 <select>
// elements across 27 pages by hand (and risking breaking the JS that
// already reads/writes their value), this progressively enhances every
// plain <select> into a searchable combobox using Tom Select, while
// keeping the original <select> element as the one true source of value —
// so every existing onchange handler, .value read/write, cascading
// dropdown, and disabled-state toggle in the app keeps working completely
// unchanged. This file is the only thing any page needs to include (along
// with the Tom Select CDN tags) to get search everywhere.
//
// Three things make this safe to drop into already-live pages without
// touching their own logic:
//   1. New <select> elements appearing after page load (a modal opening,
//      an "+ Add Item" row) are found and enhanced automatically via a
//      page-wide MutationObserver.
//   2. A select's own list of <option>s being rewritten by existing app
//      code (e.g. "pick a customer, populate their quotations") is
//      detected via a MutationObserver on that select and handled with
//      Tom Select's own sync() — the documented way to tell it the
//      underlying <select> changed outside its API.
//   3. A select's *value* being set directly by existing app code (e.g.
//      pre-filling a dropdown when opening a record to edit it) is
//      bridged through a property override on the element, plus a light
//      polling fallback for the rarer case of code setting
//      option.selected or select.selectedIndex directly instead of
//      select.value.
(function () {
  var ENHANCED_FLAG = 'ssEnhanced';

  function shouldSkip(select) {
    if (!select || select.tagName !== 'SELECT') return true;
    if (select.multiple) return true;
    if (select.dataset && select.dataset.noSearch === 'true') return true;
    return false;
  }

  function bridgeValueProperty(select, instance) {
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
      if (!desc || !desc.get || !desc.set) return;
      Object.defineProperty(select, 'value', {
        configurable: true,
        enumerable: true,
        get: function () {
          return desc.get.call(select);
        },
        set: function (v) {
          desc.set.call(select, v);
          try { instance.setValue(desc.get.call(select), true); } catch (e) {}
        }
      });
    } catch (e) {
      // If the browser won't allow the override, the polling fallback
      // below still keeps things in sync, just with a small delay.
    }
  }

  function startReconcileLoop(select, instance) {
    // Safety net for code paths that set selection via option.selected or
    // select.selectedIndex instead of select.value (the value-property
    // bridge above doesn't see those). Cheap string compare, so polling a
    // handful of selects per page every 400ms is negligible.
    setInterval(function () {
      try {
        var nativeVal = select.value;
        if (instance.getValue() !== nativeVal) {
          instance.setValue(nativeVal, true);
        }
      } catch (e) {}
    }, 400);
  }

  function enhance(select) {
    if (shouldSkip(select)) return;
    if (select.dataset && select.dataset[ENHANCED_FLAG] === '1') return;
    if (typeof TomSelect === 'undefined') return;

    select.dataset[ENHANCED_FLAG] = '1';

    try {
      var instance = new TomSelect(select, {
        create: false,
        allowEmptyOption: true,
        maxOptions: null,
        placeholder: select.getAttribute('data-placeholder') || undefined
      });

      if (select.disabled) instance.disable();

      var optionsObserver = new MutationObserver(function () {
        try { instance.sync(); } catch (e) {}
      });
      optionsObserver.observe(select, { childList: true, subtree: true });

      var disabledObserver = new MutationObserver(function () {
        if (select.disabled) instance.disable(); else instance.enable();
      });
      disabledObserver.observe(select, { attributes: true, attributeFilter: ['disabled'] });

      bridgeValueProperty(select, instance);
      startReconcileLoop(select, instance);
    } catch (e) {
      console.warn('Searchable dropdown enhancement failed for a <select>:', e);
    }
  }

  function enhanceWithin(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.tagName === 'SELECT') {
      enhance(node);
      return;
    }
    if (!node.querySelectorAll) return;
    var found = node.querySelectorAll('select');
    for (var i = 0; i < found.length; i++) enhance(found[i]);
  }

  function injectOverrideStyles() {
    if (document.getElementById('ss-style-overrides')) return;
    var style = document.createElement('style');
    style.id = 'ss-style-overrides';
    style.textContent =
      // width:100% (not a JS-measured pixel value) matters here: these
      // selects mostly live inside modals that start out hidden
      // (display:none), and Tom Select would otherwise measure a 0px
      // container at init time and render squished once the modal opens.
      // A pure-CSS percentage width sidesteps that entirely.
      '.ts-wrapper{font-size:inherit;width:100%;}' +
      '.ts-control{min-height:unset;padding:0.45rem 0.65rem;font-size:0.8rem;line-height:1.25rem;' +
      'border-radius:0.5rem;border-color:#cbd5e1;width:100%;box-sizing:border-box;}' +
      '.ts-control input{font-size:0.8rem;}' +
      '.ts-wrapper.single .ts-control{background:#fff;}' +
      '.ts-dropdown{z-index:99999;font-size:0.8rem;border-radius:0.5rem;overflow:hidden;}' +
      '.ts-dropdown .option{padding:0.4rem 0.65rem;}' +
      '.ts-dropdown .active{background-color:#982B68;color:#fff;}' +
      '.ts-control.focus{box-shadow:0 0 0 2px rgba(152,43,104,0.35);border-color:#982B68;}';
    document.head.appendChild(style);
  }

  function boot() {
    if (typeof TomSelect === 'undefined') {
      // CDN script still loading — try again shortly rather than giving up.
      setTimeout(boot, 150);
      return;
    }
    injectOverrideStyles();
    enhanceWithin(document.body);

    var pageObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) enhanceWithin(added[j]);
      }
    });
    pageObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
