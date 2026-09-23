// Shared form-validation helper. Highlights every missing required field in
// red at once (instead of the browser's native one-at-a-time validation
// popup) so a user saving a long form like Quotation/Invoice can spot every
// gap in one look. Forms that want this should add `novalidate` (so the
// browser doesn't also pop up its own tooltip) and call
// window.FormValidation.validateRequiredFields(formEl) as the first thing
// in their submit handler.
(function () {
  var ERROR_CLASSES = ['border-red-500', 'ring-2', 'ring-red-400', 'bg-red-50'];

  function isEmpty(field) {
    if (field.type === 'checkbox' || field.type === 'radio') {
      return !field.checked;
    }
    return !field.value || !field.value.trim();
  }

  function clearError(field) {
    field.classList.remove.apply(field.classList, ERROR_CLASSES);
  }

  function markError(field) {
    field.classList.add.apply(field.classList, ERROR_CLASSES);
    if (!field.dataset.validationListenerAttached) {
      field.dataset.validationListenerAttached = '1';
      var recheck = function () {
        if (!isEmpty(field)) clearError(field);
      };
      field.addEventListener('input', recheck);
      field.addEventListener('change', recheck);
    }
  }

  // Returns the list of invalid fields (empty array = form is valid).
  // Highlights every missing [required] field in the given form/container
  // in red, and clears the highlight on fields that are already filled.
  function validateRequiredFields(formEl) {
    if (!formEl) return [];
    var invalid = [];
    formEl.querySelectorAll('[required]').forEach(function (field) {
      if (isEmpty(field)) {
        markError(field);
        invalid.push(field);
      } else {
        clearError(field);
      }
    });

    if (invalid.length > 0) {
      invalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { invalid[0].focus({ preventScroll: true }); } catch (e) { invalid[0].focus(); }
    }

    return invalid;
  }

  window.FormValidation = { validateRequiredFields: validateRequiredFields };
})();
