// PDF GENERATION ENGINE USING jsPDF + html2canvas
    async function generateUserGuidePDF() {
      const btn = document.getElementById('btn-download-pdf');
      const originalText = btn.innerHTML;
      btn.innerHTML = `
        <svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Compiling PDF Guide...</span>
      `;
      btn.disabled = true;

      try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 12;
        let yPos = margin;

        // Custom High-Quality Multi-Page PDF Compilation Engine
        pdf.setFillColor(15, 23, 42); // slate-900 background for cover
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');

        // Header / Cover Accent Line
        pdf.setFillColor(152, 43, 104); // #982B68 brand color
        pdf.rect(0, 0, pageWidth, 8, 'F');

        // Cover Title
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(22);
        pdf.text("Measure DI RevOps Platform", margin, 30);

        pdf.setFontSize(14);
        pdf.setTextColor(226, 131, 189); // #E283BD light magenta
        pdf.text("Official User Guide & Operating Manual (SOP)", margin, 40);

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(203, 213, 225); // slate-300
        pdf.text("Comprehensive Operational Manual, Role Matrix & Module Workflows", margin, 48);

        pdf.setDrawColor(51, 65, 85);
        pdf.line(margin, 54, pageWidth - margin, 54);

        // Document Metadata Block
        pdf.setFillColor(30, 41, 59);
        pdf.roundedRect(margin, 60, pageWidth - (margin * 2), 28, 3, 3, 'F');

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text("Document Details & System Version", margin + 5, 68);

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(148, 163, 184);
        pdf.text("Organization: Measure DI Technologies", margin + 5, 75);
        pdf.text("Effective Horizon: FY 2024-2026", margin + 5, 82);
        pdf.text("Language: English (Master Reference Edition)", pageWidth / 2, 75);
        pdf.text("Generated On: " + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), pageWidth / 2, 82);

        // Section 1: System Overview
        yPos = 100;
        pdf.setFillColor(152, 43, 104);
        pdf.rect(margin, yPos, 4, 12, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(255, 255, 255);
        pdf.text("1. System Architecture & Overview", margin + 8, yPos + 8);
        yPos += 18;

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(226, 232, 240);
        const overviewLines = pdf.splitTextToSize(
          "Measure DI RevOps is an enterprise Revenue Operations suite for industrial machinery, equipment sales, automation, and project execution. It unifies CRM leads, customer contracts, milestone invoicing, project expenses, payroll, employee attendance, quarterly KRAs, daily task logs (DWM), and Annual Operating Plan (AOP) strategies into a unified workspace.",
          pageWidth - (margin * 2)
        );
        pdf.text(overviewLines, margin, yPos);
        yPos += (overviewLines.length * 4.5) + 8;

        // Section 2: Role Permissions Table
        pdf.setFillColor(152, 43, 104);
        pdf.rect(margin, yPos, 4, 12, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(255, 255, 255);
        pdf.text("2. Role-Based Access Control (RBAC)", margin + 8, yPos + 8);
        yPos += 18;

        // Role Table Headers
        pdf.setFillColor(30, 41, 59);
        pdf.rect(margin, yPos, pageWidth - (margin * 2), 7, 'F');
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(226, 131, 189);
        pdf.text("Module", margin + 3, yPos + 5);
        pdf.text("Admin (Managing Director)", margin + 50, yPos + 5);
        pdf.text("Manager (Dept Head)", margin + 110, yPos + 5);
        pdf.text("Staff (Executive)", margin + 155, yPos + 5);
        yPos += 8;

        const rolesData = [
          ["Executive Dashboard", "Full Access & Filters", "Full Access & Filters", "Restricted"],
          ["Leads & Pipeline CRM", "Full Access & Edit All", "Full Team Scope", "Assigned Deals Only"],
          ["Orders & Contracts", "Full Access & SLA Edit", "Full Team Scope", "Assigned Contracts"],
          ["Payments & Collections", "Full AR Ledger View", "Team Milestone View", "Assigned Milestone View"],
          ["Expenses & Profit Center", "Full Ledger & Margins", "View & Submit Claims", "Submit Personal Claims"],
          ["Payroll & CTC", "Full Salary Ledger", "View Salary Structure", "Personal Pay Slip"],
          ["My Team & Appraisals", "Full Company Review", "Direct Reportees Review", "Restricted"],
          ["AOP Targets Strategy", "Full Edit & Allocations", "Restricted", "Restricted"]
        ];

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(203, 213, 225);
        rolesData.forEach((row, idx) => {
          if (idx % 2 === 0) {
            pdf.setFillColor(15, 23, 42);
          } else {
            pdf.setFillColor(30, 41, 59);
          }
          pdf.rect(margin, yPos, pageWidth - (margin * 2), 6, 'F');
          pdf.text(row[0], margin + 3, yPos + 4.5);
          pdf.text(row[1], margin + 50, yPos + 4.5);
          pdf.text(row[2], margin + 110, yPos + 4.5);
          pdf.text(row[3], margin + 155, yPos + 4.5);
          yPos += 6;
        });

        // Add New Page for Modules & Ratios
        pdf.addPage();
        pdf.setFillColor(15, 23, 42);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        pdf.setFillColor(152, 43, 104);
        pdf.rect(0, 0, pageWidth, 6, 'F');
        yPos = 16;

        // Section 3: Core Modules & Target Ratios
        pdf.setFillColor(152, 43, 104);
        pdf.rect(margin, yPos, 4, 12, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(255, 255, 255);
        pdf.text("3. Core Modules & Target Period Scaling Ratios", margin + 8, yPos + 8);
        yPos += 18;

        const ratioData = [
          ["Period Filter", "Multiplier", "Target Calculation Logic Formula"],
          ["Quarterly (Q1 - Q4)", "25% (0.25)", "Quarter Target = Annual Target × 0.25 (25% of annual KRA)"],
          ["Half Yearly (H1, H2)", "50% (0.50)", "Half-Year Target = Annual Target × 0.50 (50% of annual KRA)"],
          ["Month to Date (MTD)", "8.33% (0.0833)", "Monthly Target = Annual Target × (1 / 12)"],
          ["Week to Date (WTD)", "1.92% (0.0192)", "Weekly Target = Annual Target × (1 / 52)"],
          ["Full Year", "100% (1.00)", "Full Year Target = 100% of Annual KRA / AOP Target"]
        ];

        pdf.setFillColor(30, 41, 59);
        pdf.rect(margin, yPos, pageWidth - (margin * 2), 7, 'F');
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(226, 131, 189);
        pdf.text(ratioData[0][0], margin + 3, yPos + 5);
        pdf.text(ratioData[0][1], margin + 45, yPos + 5);
        pdf.text(ratioData[0][2], margin + 75, yPos + 5);
        yPos += 8;

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(203, 213, 225);
        for (let i = 1; i < ratioData.length; i++) {
          pdf.setFillColor(i % 2 === 0 ? 15 : 30, i % 2 === 0 ? 23 : 41, i % 2 === 0 ? 42 : 59);
          pdf.rect(margin, yPos, pageWidth - (margin * 2), 6, 'F');
          pdf.text(ratioData[i][0], margin + 3, yPos + 4.5);
          pdf.text(ratioData[i][1], margin + 45, yPos + 4.5);
          pdf.text(ratioData[i][2], margin + 75, yPos + 4.5);
          yPos += 6;
        }

        yPos += 10;

        // Section 4: Daily, Weekly & Monthly SOP
        pdf.setFillColor(152, 43, 104);
        pdf.rect(margin, yPos, 4, 12, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(255, 255, 255);
        pdf.text("4. Standard Operating Procedures (SOP) Routine", margin + 8, yPos + 8);
        yPos += 18;

        const sopData = [
          ["Routine Frequency", "Responsible Role", "Key Operating Steps"],
          ["Daily Morning Routine", "Sales & Ops Executives", "1. Punch-in Attendance. 2. Log DWM tasks. 3. Update deal stages."],
          ["Weekly Review (Fridays)", "Managers & Supervisors", "1. Review AR collections. 2. Verify DWM ratings. 3. Audit KRAs."],
          ["Monthly & Quarterly Close", "Managing Director & HR", "1. Run payroll disbursement. 2. Audit profit margins. 3. Appraisals."]
        ];

        pdf.setFillColor(30, 41, 59);
        pdf.rect(margin, yPos, pageWidth - (margin * 2), 7, 'F');
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(226, 131, 189);
        pdf.text(sopData[0][0], margin + 3, yPos + 5);
        pdf.text(sopData[0][1], margin + 50, yPos + 5);
        pdf.text(sopData[0][2], margin + 95, yPos + 5);
        yPos += 8;

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(203, 213, 225);
        for (let i = 1; i < sopData.length; i++) {
          pdf.setFillColor(i % 2 === 0 ? 15 : 30, i % 2 === 0 ? 23 : 41, i % 2 === 0 ? 42 : 59);
          pdf.rect(margin, yPos, pageWidth - (margin * 2), 7, 'F');
          pdf.text(sopData[i][0], margin + 3, yPos + 5);
          pdf.text(sopData[i][1], margin + 50, yPos + 5);
          pdf.text(sopData[i][2], margin + 95, yPos + 5);
          yPos += 7;
        }

        // Add Footers & Page Numbers
        const totalPages = pdf.internal.getNumberOfPages();
        for (let page = 1; page <= totalPages; page++) {
          pdf.setPage(page);
          pdf.setDrawColor(51, 65, 85);
          pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(148, 163, 184);
          pdf.text("Measure DI Technologies RevOps Platform - User Guide", margin, pageHeight - 6);
          pdf.text(`Page ${page} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 6);
        }

        // Save Generated PDF File
        pdf.save("Measure_DI_RevOps_User_Guide_SOP.pdf");

      } catch (err) {
        console.error("PDF generation failed:", err);
        alert("Failed to generate PDF automatically. Opening print view instead.");
        window.print();
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }

    function downloadClientDemoGuidePDF(e) {
      if (e) e.preventDefault();
      fetch('Measure_DI_RevOps_Client_Demo_Guide.pdf')
        .then(res => {
          if (!res.ok) throw new Error('HTTP status ' + res.status);
          return res.blob();
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'Measure_DI_RevOps_Client_Demo_Guide.pdf';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            a.remove();
            window.URL.revokeObjectURL(url);
          }, 100);
        })
        .catch(err => {
          console.warn('Direct Blob fetch failed, opening fallback link:', err);
          window.open('Measure_DI_RevOps_Client_Demo_Guide.pdf', '_blank');
        });
    }

    // Auto-check auth and render header
    document.addEventListener('DOMContentLoaded', function() {
      checkAuth([]);
    });
