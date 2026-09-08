// searchable-select.js — Measure DI RevOps
//
// App-wide searchable dropdown enhancement. Progressively converts every
// plain <select> into a searchable combobox (Tom Select) while keeping the
// original <select> element as the one true source of value, so every
// existing onchange handler, cascading dropdown, and .value read/write
// across the app keeps working completely unchanged.
//
// IMPORTANT — this file previously shipped with a feedback-loop bug that
// froze the live app ("Page Unresponsive"): a MutationObserver watched a
// select for option changes and called Tom Select's sync() on every
// mutation, but sync() itself writes back to that same select's DOM
// (mirroring the selected option for native form compatibility) — which
// re-triggered the same observer, forever, pegging the main thread. This
// version guards every place that can mutate an observed select's DOM by
// disconnecting its observer first and reconnecting only after that
// mutation has fully settled (via setTimeout 0, i.e. next tick), which is
// the standard fix for MutationObserver re-entrancy. Kept deliberately
// simple beyond that — no per-select polling loop, no disabled-attribute
// observer — specifically to minimize any further feedback-loop surface
// until this has been live and stable for a while.
(function () {
  var ENHANCED_FLAG = 'ssEnhanced';

  function shouldSkip(select) {
    if (!select || select.tagName !== 'SELECT') return true;
    if (select.multiple) return true;
    if (select.dataset && select.dataset.noSearch === 'true') return true;
    return false;
  }

  function bridgeValueProperty(select, instance) {
    // Lets existing app code keep doing `select.value = x` (e.g. pre-
    // filling a dropdown when opening a record to edit) and have the
    // Tom Select UI reflect it, with no MutationObserver involved at all
    // — a direct property override, not something that can feed back on
    // itself the way a DOM-mutation observer can.
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
      // Non-fatal — the select just won't visually reflect a direct
      // .value= assignment from existing app code in this rare case.
    }
  }

  function watchForOptionChanges(select, instance) {
    var observer = new MutationObserver(function () {
      // Disconnect BEFORE touching the DOM ourselves — sync() rebuilds
      // Tom Select's option cache from the <select>'s current children,
      // and (for native form compatibility) can write the selected
      // option's state back onto them. Without disconnecting first, that
      // write would immediately re-trigger this very callback, forever.
      observer.disconnect();
      try {
        // sync() alone is add-only — it rebuilds Tom Select's option
        // cache from the select's current DOM but never removes entries
        // that are no longer there, so a customer-filtered dropdown
        // would keep showing every option it had ever seen, layered on
        // top of each other. clearOptions() first drops everything
        // except the currently-selected item, so sync() then rebuilds
        // a genuinely fresh list matching the select's real state.
        instance.clearOptions();
        instance.sync();
      } catch (e) {}
      setTimeout(function () {
        try {
          observer.observe(select, { childList: true, subtree: true });
        } catch (e) {}
      }, 0);
    });
    observer.observe(select, { childList: true, subtree: true });
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

      watchForOptionChanges(select, instance);
      bridgeValueProperty(select, instance);
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
