// Shared PDF-generation helper for the Quotation and Invoice send flows.
// Renders a chunk of HTML into an off-screen, unconstrained container
// (rather than capturing the live print-preview modal, which is clipped
// and hidden via `display:none` when the Send modal is used directly) so
// html2canvas always gets a full, correctly laid-out capture regardless of
// whether the user ever opened the print preview first. Requires jsPDF and
// html2canvas to already be loaded on the page (CDN script tags, same as
// js/user-guide.js).
(function () {
  function blobToDataUri(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Waits a tick so the Tailwind Play CDN's MutationObserver has a chance
  // to inject the generated utility CSS for freshly-added markup before we
  // rasterize it - without this, off-screen content captured synchronously
  // can render unstyled.
  function settle() {
    return new Promise(function (resolve) { setTimeout(resolve, 60); });
  }

  // htmlContent: an HTML string for the printable document body.
  // filename: the attachment's display file name (e.g. "Invoice_INV-1.pdf").
  // Returns { name, type, data } ready to push into an email attachments array.
  async function generatePdfFromHtml(htmlContent, filename, options) {
    options = options || {};
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('PDF engine (jsPDF) failed to load. Check your internet connection and try again.');
    }
    if (!window.html2canvas) {
      throw new Error('PDF engine (html2canvas) failed to load. Check your internet connection and try again.');
    }

    var container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '-99999px';
    container.style.width = (options.width || 800) + 'px';
    container.style.background = '#ffffff';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    try {
      await settle();

      var canvas = await window.html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      var jsPDF = window.jspdf.jsPDF;
      var pdf = new jsPDF('p', 'mm', 'a4');
      var pageWidth = pdf.internal.pageSize.getWidth();
      var pageHeight = pdf.internal.pageSize.getHeight();

      var imgWidth = pageWidth;
      var imgHeight = (canvas.height * imgWidth) / canvas.width;
      var imgData = canvas.toDataURL('image/jpeg', 0.95);

      var heightLeft = imgHeight;
      var position = 0;
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      var blob = pdf.output('blob');
      var dataUri = await blobToDataUri(blob);

      return { name: filename, type: 'application/pdf', data: dataUri };
    } finally {
      document.body.removeChild(container);
    }
  }

  window.PdfGenerator = { generatePdfFromHtml: generatePdfFromHtml };
})();
