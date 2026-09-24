// Converts a rupee amount into words using the Indian numbering system
// (Crore / Lakh / Thousand, not the Western thousand/million grouping),
// for the "Amount in Words" line required alongside the numeric Grand
// Total on formal commercial documents (Quotations, Invoices).
(function () {
  var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n) {
    if (n < 20) return ONES[n];
    var t = Math.floor(n / 10), o = n % 10;
    return TENS[t] + (o ? ' ' + ONES[o] : '');
  }

  function threeDigits(n) {
    var h = Math.floor(n / 100), rest = n % 100;
    var parts = [];
    if (h) parts.push(ONES[h] + ' Hundred');
    if (rest) parts.push(twoDigits(rest));
    return parts.join(' ');
  }

  // Converts a non-negative integer (up to 999 crore) into Indian-numbering words.
  function integerToIndianWords(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'Zero';

    var crore = Math.floor(n / 10000000); n %= 10000000;
    var lakh = Math.floor(n / 100000); n %= 100000;
    var thousand = Math.floor(n / 1000); n %= 1000;
    var hundred = n;

    var parts = [];
    if (crore) parts.push(threeDigits(crore) + ' Crore');
    if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
    if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
    if (hundred) parts.push(threeDigits(hundred));
    return parts.join(' ');
  }

  // e.g. amountInWords(94400) -> "Rupees Ninety Four Thousand Four Hundred Only"
  // amountInWords(94400.5) -> "Rupees Ninety Four Thousand Four Hundred and Fifty Paise Only"
  function amountInWords(amount, currencyWord) {
    currencyWord = currencyWord || 'Rupees';
    var value = Math.abs(Number(amount) || 0);
    var rupees = Math.floor(value);
    var paise = Math.round((value - rupees) * 100);
    if (paise === 100) { rupees += 1; paise = 0; }

    var words = currencyWord + ' ' + integerToIndianWords(rupees);
    if (paise > 0) {
      words += ' and ' + integerToIndianWords(paise) + ' Paise';
    }
    words += ' Only';
    return words;
  }

  window.NumberToWords = {
    amountInWords: amountInWords,
    integerToIndianWords: integerToIndianWords
  };
})();
