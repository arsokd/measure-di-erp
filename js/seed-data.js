
window.RevOpsStore = window.RevOpsStore || {};
if (typeof window.getFormattedToday !== 'function') {
 window.getFormattedToday = function() {
 var now = new Date();
 var dd = String(now.getDate()).padStart(2, '0');
 var mm = String(now.getMonth() + 1).padStart(2, '0');
 var yyyy = now.getFullYear();
 return dd + '/' + mm + '/' + yyyy;
 };
}
var getFormattedToday = window.getFormattedToday;
window.RevOpsStore.initSeedData = function() {
 // Configuration master lists (Lead Source, Industry Vertical, Project
 // Sector, Vertical Classification, Currency) — idempotent, runs every
 // time regardless of the version gate below, but only fills a collection
 // the first time it's genuinely empty.
 if (typeof window.RevOpsStore.seedMasterListsIfEmpty === 'function') {
   window.RevOpsStore.seedMasterListsIfEmpty();
 }

 var checkCols = ['employees', 'orders', 'leads', 'serviceTickets', 'aopTargets', 'kraTargets', 'expenses', 'payments', 'payroll', 'attendance', 'dwmActivities', 'reviews', 'projectsMaster'];
 var hasEmptyCols = checkCols.some(function(colName) {
 var arr = (window.RevOpsStore && typeof window.RevOpsStore.getCollection === 'function') ? window.RevOpsStore.getCollection(colName) : null;
 if (!arr || arr.length === 0) {
 try {
 var raw = localStorage.getItem(colName);
 arr = raw ? JSON.parse(raw) : [];
 } catch(e) { arr = []; }
 }
 return !arr || arr.length === 0;
 });
 if (!localStorage.getItem('revops_seeded_v25') || hasEmptyCols) {
 console.log("Seeding Google Sheets RevOps data for Measure DI Technologies...");
 
 
 
 var currentEmps = window.RevOpsStore.getCollection('employees') || [];
 var empListChanged = false;
 if (currentEmps.some(function(e) { return e.employeeId === 'E-000' || (e.fullName && e.fullName.indexOf('Arun') !== -1); })) {
 console.log('Cleaning legacy E-000 record...');
 currentEmps = currentEmps.filter(function(e) { return e.employeeId !== 'E-000' && (!e.fullName || e.fullName.indexOf('Arun') === -1); });
 empListChanged = true;
 }
 currentEmps.forEach(function(e) {
 if (e.employeeId === 'E-001') {
 e.role = 'super_admin';
 e.mobile = '9840629928';
 e.email = 'measuredichennai@gmail.com';
 empListChanged = true;
 } else if (e.employeeId === 'E-002') {
 e.role = 'super_admin';
 e.mobile = '9840122334';
 e.fullName = 'Mr. Murugan V';
 e.designation = 'Sales & Marketing Head';
 e.customPassword = 'AAABBC123456';
 e.password = 'AAABBC123456';
 empListChanged = true;
 }
 });
 if (empListChanged) {
 window.RevOpsStore.saveCollection('employees', currentEmps);
 }
 var defaultEmployees = [{"id":"emp_dev","employeeId":"E-DEV","fullName":"Developer (ars.okd)","designation":"Lead Developer & System Architect","vertical":"Management / Board","subVertical":"Director","location":"Head Office","grade":"M1","reportsTo":"","reportsToName":"","workArrangement":"Hybrid","email":"ars.okd@gmail.com","mobile":"9840629928","customPassword":"AAABBC123456","password":"AAABBC123456","dateOfJoining":"01/04/2020","primaryAopMetric":"System Architecture & Security","primaryAopTarget":0,"unit":"₹ (INR)","role":"super_admin","remarks":"Primary Developer & Super Admin Account","isActive":true},{"id":"emp_1","employeeId":"E-001","fullName":"Mr. Ravichandran","designation":"Director","vertical":"Management / Board","subVertical":"Director","location":"Head Office","grade":"M1","reportsTo":"","reportsToName":"","workArrangement":"Head Office","email":"measuredichennai@gmail.com","mobile":"9840629928","dateOfJoining":"01/04/2020","primaryAopMetric":"Sales Revenue, Service Revenue, Spare parts Revenue","primaryAopTarget":0,"unit":"₹ (INR)","role":"super_admin","remarks":"Managing Director / Super Admin","isActive":true},{"id":"emp_2","employeeId":"E-002","fullName":"Mr. Murugan V","designation":"Sales & Marketing Head","vertical":"Marketing","subVertical":"Marketing Head","location":"Head Office","grade":"M2","reportsTo":"E-001","reportsToName":"Mr. Ravichandran","workArrangement":"Hybrid","email":"murugan@measuredi.com","mobile":"9840122334","customPassword":"AAABBC123456","password":"AAABBC123456","dateOfJoining":"01/04/2020","primaryAopMetric":"Sales Revenue, Service Revenue, Spare parts Revenue, DOS","primaryAopTarget":200000000,"unit":"₹ (INR)","role":"super_admin","remarks":"Super Admin / Executive / Marketing Head","isMasterDataAdmin":true,"isActive":true},{"id":"emp_3","employeeId":"E-003","fullName":"Mrs. Anitha","designation":"Technical Head","vertical":"Projects & production","subVertical":"Technical head","location":"Head Office","grade":"M2","reportsTo":"E-001","reportsToName":"Mr. Ravichandran","workArrangement":"Head Office","email":"anitha@measuredi.com","mobile":"8939821717","dateOfJoining":"01/04/2020","primaryAopMetric":"Project Delivery & Production Quality","primaryAopTarget":100000000,"unit":"₹ (INR)","role":"admin","remarks":"Admin / Technical Head","isMasterDataAdmin":true,"isActive":true},{"id":"emp_4","employeeId":"E-004","fullName":"Mrs. Subhashini","designation":"Markeing - Onboard Head","vertical":"Marketing","subVertical":"Markeing - Onboard head","location":"Head Office","grade":"M3","reportsTo":"E-002","reportsToName":"Mr. Murugan","workArrangement":"Hybrid","email":"subha@measuredi.com","mobile":"8939821732","dateOfJoining":"01/04/2020","primaryAopMetric":"Sales Revenue, DOS","primaryAopTarget":50000000,"unit":"₹ (INR)","role":"manager","remarks":"Onboard Vertical Lead","isActive":true},{"id":"emp_5","employeeId":"E-005","fullName":"Ms. Dipa","designation":"Marketing - Crane & Spares","vertical":"Marketing","subVertical":"Marketing - Crane and spares","location":"Head Office","grade":"M3","reportsTo":"E-002","reportsToName":"Mr. Murugan","workArrangement":"Hybrid","email":"dipanwita@measuredi.com","mobile":"8939821723","dateOfJoining":"01/04/2020","primaryAopMetric":"Service Revenue, Spare parts Revenue","primaryAopTarget":70000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_6","employeeId":"E-006","fullName":"Mrs. Krithika","designation":"Project Lead","vertical":"Projects & production","subVertical":"Project lead","location":"Head Office","grade":"M3","reportsTo":"E-003","reportsToName":"Mrs. Anitha","workArrangement":"Head Office","email":"techsupport@measuredi.com","mobile":"9500320679","dateOfJoining":"01/04/2020","primaryAopMetric":"Project Delivery","primaryAopTarget":30000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_7","employeeId":"E-007","fullName":"Mrs. Sandhya","designation":"Digital Marketing Lead","vertical":"Marketing","subVertical":"Digiatl marketing lead","location":"Head Office","grade":"M3","reportsTo":"E-002","reportsToName":"Mr. Murugan","workArrangement":"Hybrid","email":"service@measuredi.com","mobile":"8056186502","dateOfJoining":"01/04/2020","primaryAopMetric":"Digital Marketing Leads","primaryAopTarget":20000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_8","employeeId":"E-008","fullName":"Mr. Ramkarthik","designation":"Mechanical Design","vertical":"Projects & production","subVertical":"Mehanical design","location":"Head Office","grade":"M3","reportsTo":"E-003","reportsToName":"Mrs. Anitha","workArrangement":"Head Office","email":"design@measuredi.com","mobile":"8939821708","dateOfJoining":"01/04/2020","primaryAopMetric":"Mechanical Designs","primaryAopTarget":20000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_9","employeeId":"E-009","fullName":"Mr. Balamurugan","designation":"Embedded Design","vertical":"R&D","subVertical":"Embedded design","location":"R&D Lab","grade":"M3","reportsTo":"E-003","reportsToName":"Mrs. Anitha","workArrangement":"On-site","email":"development@measuredi.com","mobile":"9840629928","dateOfJoining":"01/04/2020","primaryAopMetric":"Embedded Firmware Releases","primaryAopTarget":15000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_10","employeeId":"E-010","fullName":"Mr. Santhosh","designation":"Software Engineer","vertical":"R&D","subVertical":"Software engineer","location":"R&D Lab","grade":"M3","reportsTo":"E-003","reportsToName":"Mrs. Anitha","workArrangement":"Hybrid","email":"software@measuredi.com","mobile":"9344355707","dateOfJoining":"01/04/2020","primaryAopMetric":"Software Releases & RevOps Integration","primaryAopTarget":15000000,"unit":"₹ (INR)","role":"staff","remarks":"Software Engineer / Developer","isActive":true},{"id":"emp_11","employeeId":"E-011","fullName":"Mrs. Vijayalakshmi","designation":"Finance Lead","vertical":"Accounts","subVertical":"Finance","location":"Head Office","grade":"M2","reportsTo":"E-001","reportsToName":"Mr. Ravichandran","workArrangement":"Head Office","email":"accounts@measuredi.com","mobile":"8925903314","dateOfJoining":"01/04/2020","primaryAopMetric":"Financial Accounts & Payroll","primaryAopTarget":200000000,"unit":"₹ (INR)","role":"manager","remarks":"","isActive":true},{"id":"emp_12","employeeId":"E-012","fullName":"Mr. Prasanth","designation":"Factory- Production Incharge","vertical":"Production - Mechanical","subVertical":"Factory- Production incharge","location":"Factory Unit","grade":"M3","reportsTo":"E-003","reportsToName":"Mrs. Anitha","workArrangement":"On-site","email":"prasanth@measuredi.com","mobile":"6383615369","dateOfJoining":"01/04/2020","primaryAopMetric":"Factory Assembly Units","primaryAopTarget":10000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_13","employeeId":"E-013","fullName":"Mrs. Sandhya","designation":"Valasaravakkam- Electronics Production Incharge","vertical":"Production - electronics","subVertical":"Valasaravakkam- Electronics production Incharge","location":"Valasaravakkam Factory","grade":"M3","reportsTo":"E-003","reportsToName":"Mrs. Anitha","workArrangement":"On-site","email":"measurediproduction@gmail.com","mobile":"8220112004","dateOfJoining":"01/04/2020","primaryAopMetric":"Electronics Production Batch Quality","primaryAopTarget":10000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_14","employeeId":"E-014","fullName":"Mr. Sivakumar Murugan","designation":"Valasaravakkam- Electronics Production Engineer","vertical":"Production - electronics","subVertical":"Valasaravakam- Electronics production Engineer","location":"Valasaravakkam Factory","grade":"M4","reportsTo":"E-013","reportsToName":"Mrs. Sandhya","workArrangement":"On-site","email":"measurediproduction1@gmail.com","mobile":"9790686971","dateOfJoining":"01/04/2021","primaryAopMetric":"PCB Assembly & Testing","primaryAopTarget":5000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_15","employeeId":"E-015","fullName":"Ms. Patchyammal","designation":"Valasaravakkam- Electronics Production Engineer","vertical":"Production - electronics","subVertical":"Valasaravakam- Electronics production Engineer","location":"Valasaravakkam Factory","grade":"M4","reportsTo":"E-013","reportsToName":"Mrs. Sandhya","workArrangement":"On-site","email":"patchyammal@measuredi.com","mobile":"7339510066","dateOfJoining":"01/04/2021","primaryAopMetric":"Electronics Testing & QA","primaryAopTarget":5000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_16","employeeId":"E-016","fullName":"Mr. Sivakumar Chinnayan","designation":"Territory Manager - Orissa","vertical":"Marketing & service","subVertical":"Territory manager - Orissa","location":"Jharsuguda / Orissa","grade":"M3","reportsTo":"E-002","reportsToName":"Mr. Murugan","workArrangement":"On-site","email":"sivakumar@measuredi.com","mobile":"8939821702","dateOfJoining":"01/04/2020","primaryAopMetric":"Territory Revenue & Service AMC","primaryAopTarget":20000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_17","employeeId":"E-017","fullName":"Mr. Balram","designation":"Territory Manager - Telangana","vertical":"Marketing & service","subVertical":"Territory manager - Telangana","location":"Ramagundam / Telangana","grade":"M3","reportsTo":"E-002","reportsToName":"Mr. Murugan","workArrangement":"On-site","email":"balaram@measuredi.com","mobile":"8939821719","dateOfJoining":"01/04/2020","primaryAopMetric":"Territory Revenue & Steel Industry Sales","primaryAopTarget":30000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_18","employeeId":"E-018","fullName":"Mr. Mathiyarasu","designation":"Territory Manager - Karnataka","vertical":"Marketing & service","subVertical":"Territory manager - Kartnataka","location":"Toranagallu / Karnataka","grade":"M3","reportsTo":"E-002","reportsToName":"Mr. Murugan","workArrangement":"On-site","email":"mathi@measuredi.com","mobile":"8939821712","dateOfJoining":"01/04/2020","primaryAopMetric":"Territory Revenue & Mining Spares","primaryAopTarget":20000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_19","employeeId":"E-019","fullName":"Mr. Sandeep","designation":"Territory Manager - Maihar","vertical":"Marketing & service","subVertical":"Territory manager - Maihar","location":"Maihar / MP","grade":"M3","reportsTo":"E-002","reportsToName":"Mr. Murugan","workArrangement":"On-site","email":"sandeep@measuredi.com","mobile":"7000265250","dateOfJoining":"01/04/2020","primaryAopMetric":"Cement Plant Service & Sales","primaryAopTarget":5000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_20","employeeId":"E-020","fullName":"Mr. Debi Tripathy","designation":"Service Engineer","vertical":"Service","subVertical":"Service Engineer","location":"Odisha / Field","grade":"M4","reportsTo":"E-016","reportsToName":"Mr. Sivakumar Chinnayan","workArrangement":"Field","email":"debi@measuredi.com","mobile":"9114293958","dateOfJoining":"01/04/2021","primaryAopMetric":"Service Calls Completed & AMC","primaryAopTarget":5000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true},{"id":"emp_21","employeeId":"E-021","fullName":"Mr. Manohar","designation":"Business Executive","vertical":"Marketing","subVertical":"Businees Executive","location":"Head Office","grade":"M4","reportsTo":"E-002","reportsToName":"Mr. Murugan","workArrangement":"Hybrid","email":"manohar@measuredi.com","mobile":"9500340489","dateOfJoining":"01/04/2021","primaryAopMetric":"Business Leads & Conversions","primaryAopTarget":5000000,"unit":"₹ (INR)","role":"staff","remarks":"","isActive":true}];
 var defaultKraTargets = [{"id":"kra_5","employeeId":"E-002","financialYear":"2024-25","kraName":"over all orders","kpiType":"Amount","annualTarget":79900000,"targetValue":79900000,"weight":40,"dailyControl":"Monitor executive revenue pipelines & vertical targets across team","aopLine":"Sales, Marketing, Service, Parts Sales"},{"id":"kra_6","employeeId":"E-002","financialYear":"2024-25","kraName":"Over all Outstanding","kpiType":"Count","annualTarget":45,"targetValue":45,"weight":20,"dailyControl":"Track 45-day credit compliance across all client accounts","aopLine":"Sales, Marketing, Service, Parts Sales"},{"id":"kra_7","employeeId":"E-002","financialYear":"2024-25","kraName":"Lead generation","kpiType":"Count","annualTarget":300,"targetValue":300,"weight":15,"dailyControl":"Strategic enterprise client acquisitions","aopLine":"Sales, Marketing, Service, Parts Sales"},{"id":"kra_8","employeeId":"E-002","financialYear":"2024-25","kraName":"Order Conversion","kpiType":"Percentage","annualTarget":35,"targetValue":35,"weight":15,"dailyControl":"Maintain >35% win rate across sales proposals","aopLine":"Sales, Marketing, Service, Parts Sales"},{"id":"kra_9","employeeId":"E-002","financialYear":"2024-25","kraName":"Retention of customer","kpiType":"Percentage","annualTarget":90,"targetValue":90,"weight":10,"dailyControl":"Sustain >90% account renewal & contract retention","aopLine":"Sales, Marketing, Service, Parts Sales"},{"id":"kra_10","employeeId":"E-003","financialYear":"2024-25","kraName":"Onboard Order Revenue","kpiType":"Amount","annualTarget":19700000,"targetValue":19700000,"weight":40,"dailyControl":"Deliver onboard weighing system order bookings","aopLine":"Sales"},{"id":"kra_11","employeeId":"E-003","financialYear":"2024-25","kraName":"Onboard Payment & Outstanding","kpiType":"Count","annualTarget":45,"targetValue":45,"weight":20,"dailyControl":"Maintain <45 days outstanding collections","aopLine":"Sales"},{"id":"kra_12","employeeId":"E-003","financialYear":"2024-25","kraName":"Lead generation","kpiType":"Count","annualTarget":300,"targetValue":300,"weight":15,"dailyControl":"Qualify new OEM & fleet operator leads","aopLine":"Sales"},{"id":"kra_13","employeeId":"E-003","financialYear":"2024-25","kraName":"Order Conversion","kpiType":"Percentage","annualTarget":35,"targetValue":35,"weight":15,"dailyControl":"Achieve >35% quote-to-order conversion rate","aopLine":"Sales"},{"id":"kra_14","employeeId":"E-003","financialYear":"2024-25","kraName":"Retention of customer","kpiType":"Percentage","annualTarget":90,"targetValue":90,"weight":10,"dailyControl":"Maintain customer satisfaction & repeat fleet orders","aopLine":"Sales"},{"id":"kra_15","employeeId":"E-004","financialYear":"2024-25","kraName":"Orders in Spares & Crane Scale","kpiType":"Amount","annualTarget":35500000,"targetValue":35500000,"weight":40,"dailyControl":"Drive spare parts & crane scale revenue","aopLine":"Service, Parts Sales, Projects"},{"id":"kra_16","employeeId":"E-004","financialYear":"2024-25","kraName":"Outstanding related to Spares & Cranes","kpiType":"Count","annualTarget":45,"targetValue":45,"weight":20,"dailyControl":"Collections control for spare parts orders","aopLine":"Service, Parts Sales, Projects"},{"id":"kra_17","employeeId":"E-004","financialYear":"2024-25","kraName":"Lead generation","kpiType":"Count","annualTarget":300,"targetValue":300,"weight":15,"dailyControl":"Service contract & maintenance leads","aopLine":"Service, Parts Sales, Projects"},{"id":"kra_18","employeeId":"E-004","financialYear":"2024-25","kraName":"Order Conversion","kpiType":"Percentage","annualTarget":35,"targetValue":35,"weight":15,"dailyControl":"Convert service quotes to confirmed orders","aopLine":"Service, Parts Sales, Projects"},{"id":"kra_19","employeeId":"E-004","financialYear":"2024-25","kraName":"Retention of customer","kpiType":"Percentage","annualTarget":90,"targetValue":90,"weight":10,"dailyControl":"Annual maintenance contract (AMC) renewals","aopLine":"Service, Parts Sales, Projects"}];
 var defaultAopTargets = [{"id":"aop_24_1","financialYear":"2024-25","lineItem":"Sales Vertical Revenue","vertical":"Sales","annualTarget":20000000},{"id":"aop_24_2","financialYear":"2024-25","lineItem":"Service/Parts Vertical Revenue","vertical":"Service/Parts","annualTarget":60000000},{"id":"aop_24_3","financialYear":"2024-25","lineItem":"Company Total AOP Revenue","vertical":"Company","annualTarget":80000000},{"id":"aop_24_4","financialYear":"2024-25","lineItem":"Service SLA Compliance Target (%)","vertical":"Service/Parts","annualTarget":95},{"id":"aop_24_5","financialYear":"2024-25","lineItem":"Customer CSAT Benchmark Target (Stars)","vertical":"Service/Parts","annualTarget":4.5},{"id":"aop_25_1","financialYear":"2025-26","lineItem":"Sales Vertical Revenue","vertical":"Sales","annualTarget":25000000},{"id":"aop_25_2","financialYear":"2025-26","lineItem":"Service/Parts Vertical Revenue","vertical":"Service/Parts","annualTarget":75000000},{"id":"aop_25_3","financialYear":"2025-26","lineItem":"Company Total AOP Revenue","vertical":"Company","annualTarget":100000000},{"id":"aop_25_4","financialYear":"2025-26","lineItem":"Service SLA Compliance Target (%)","vertical":"Service/Parts","annualTarget":95},{"id":"aop_25_5","financialYear":"2025-26","lineItem":"Customer CSAT Benchmark Target (Stars)","vertical":"Service/Parts","annualTarget":4.6},{"id":"aop_26_1","financialYear":"2026-27","lineItem":"Sales Vertical Revenue","vertical":"Sales","annualTarget":16666667},{"id":"aop_26_2","financialYear":"2026-27","lineItem":"Service/Parts Vertical Revenue","vertical":"Service/Parts","annualTarget":50000000},{"id":"aop_26_3","financialYear":"2026-27","lineItem":"Company Total AOP Revenue","vertical":"Company","annualTarget":66666667},{"id":"aop_26_4","financialYear":"2026-27","lineItem":"Service SLA Compliance Target (%)","vertical":"Service/Parts","annualTarget":95},{"id":"aop_26_5","financialYear":"2026-27","lineItem":"Customer CSAT Benchmark Target (Stars)","vertical":"Service/Parts","annualTarget":4.8}];
 
var defaultOrders = [{"id":"ord_2026_01","customerName":"JSW Steel Works Vijayanagar","customerGstin":"29AAACJ1011A1Z2","vertical":"Sales","subVertical":"Project Sales","orderValue":8500000,"gstPct":18,"gstAmount":1530000,"totalInvoiceValue":10030000,"hsnCode":"8423","invoiceNumber":"INV/2026-27/001","orderDate":"15/04/2026","status":"Won","lossReason":"","remarks":"Automated Belt Scale weighing system supply and integration","contributors":[{"employeeId":"E-002","employeeName":"Mr. Murugan V","contributionPct":50},{"employeeId":"E-006","employeeName":"Mathiarasu","contributionPct":50}],"contributorIds":["E-002","E-006"],"isMultiContributor":true,"employeeId":"E-002","employeeName":"Mr. Murugan V","createdAt":"2026-04-15T10:00:00","updatedAt":"2026-04-15T10:00:00"},{"id":"ord_2026_02","customerName":"Tata Steel Kalinganagar","customerGstin":"21AAACT2341A1Z5","vertical":"Service/Parts","subVertical":"AMC Service","orderValue":4200000,"gstPct":18,"gstAmount":756000,"totalInvoiceValue":4956000,"hsnCode":"8423","invoiceNumber":"INV/2026-27/002","orderDate":"02/05/2026","status":"Won","lossReason":"","remarks":"Annual Maintenance Contract renewal for weighbridges & load cells","contributors":[{"employeeId":"E-004","employeeName":"Dipanwita","contributionPct":100}],"contributorIds":["E-004"],"isMultiContributor":false,"employeeId":"E-004","employeeName":"Dipanwita","createdAt":"2026-05-02T10:00:00","updatedAt":"2026-05-02T10:00:00"},{"id":"ord_2026_03","customerName":"Ultratech Cement Dhar Works","customerGstin":"23AAACU1234Y1Z7","vertical":"Sales","subVertical":"Onboard Sales","orderValue":6800000,"gstPct":18,"gstAmount":1224000,"totalInvoiceValue":8024000,"hsnCode":"8423","invoiceNumber":"INV/2026-27/003","orderDate":"18/06/2026","status":"Won","lossReason":"","remarks":"Onboard weighing systems for dumper fleet","contributors":[{"employeeId":"E-003","employeeName":"Subhashini","contributionPct":70},{"employeeId":"E-002","employeeName":"Mr. Murugan V","contributionPct":30}],"contributorIds":["E-003","E-002"],"isMultiContributor":true,"employeeId":"E-003","employeeName":"Subhashini","createdAt":"2026-06-18T10:00:00","updatedAt":"2026-06-18T10:00:00"},{"id":"ord_2026_04","customerName":"Hindalco Lapanga Smelter","customerGstin":"21AAACH3456W1Z8","vertical":"Service/Parts","subVertical":"OEM Spares","orderValue":3150000,"gstPct":18,"gstAmount":567000,"totalInvoiceValue":3717000,"hsnCode":"8423","invoiceNumber":"INV/2026-27/004","orderDate":"10/07/2026","status":"Won","lossReason":"","remarks":"OEM high precision load cells & spare indicators","contributors":[{"employeeId":"E-007","employeeName":"Sivakumar","contributionPct":100}],"contributorIds":["E-007"],"isMultiContributor":false,"employeeId":"E-007","employeeName":"Sivakumar","createdAt":"2026-07-10T10:00:00","updatedAt":"2026-07-10T10:00:00"},{"id":"ord_2026_05","customerName":"Caterpillar India Pvt Ltd","customerGstin":"33AAACC9900F1Z3","vertical":"Sales","subVertical":"Onboard Sales","orderValue":9200000,"gstPct":18,"gstAmount":1656000,"totalInvoiceValue":10856000,"hsnCode":"8423","invoiceNumber":"INV/2026-27/005","orderDate":"01/08/2026","status":"Won","lossReason":"","remarks":"Heavy mining dump truck payload monitoring order","contributors":[{"employeeId":"E-002","employeeName":"Mr. Murugan V","contributionPct":60},{"employeeId":"E-005","employeeName":"Balaram","contributionPct":40}],"contributorIds":["E-002","E-005"],"isMultiContributor":true,"employeeId":"E-002","employeeName":"Mr. Murugan V","createdAt":"2026-08-01T10:00:00","updatedAt":"2026-08-01T10:00:00"},{"id":"ord_139","customerName":"JSW Cement Toranagallu","customerGstin":"29AAACJ9012S1Z0","vertical":"Service, Parts Sales, Projects","subVertical":"OEM Spares","orderValue":3050000,"gstPct":18,"gstAmount":549000,"totalInvoiceValue":3599000,"hsnCode":"8423","invoiceNumber":"INV/2024-25/048","orderDate":"01/04/2024","status":"Won","lossReason":"","remarks":"Order won for OEM Spares supply & service execution","contributors":[{"employeeId":"E-006","employeeName":"Mathiarasu","contributionPct":70},{"employeeId":"E-002","employeeName":"Murugan","contributionPct":30}],"contributorIds":["E-006","E-002"],"isMultiContributor":true,"employeeId":"E-006","employeeName":"Mathiarasu","createdAt":"2024-04-01T10:00:00","updatedAt":"2024-04-01T10:00:00"},{"id":"ord_164","customerName":"Thermax Limited Chinchwad","customerGstin":"27AAACT4567F1Z8","vertical":"Service, Parts Sales, Projects","subVertical":"Field Service","orderValue":1060000,"gstPct":18,"gstAmount":190800,"totalInvoiceValue":1250800,"hsnCode":"8423","invoiceNumber":"INV/2024-25/073","orderDate":"02/04/2024","status":"Won","lossReason":"","remarks":"Order won for Field Service supply & service execution","contributors":[{"employeeId":"E-009","employeeName":"Manowharan","contributionPct":100}],"contributorIds":["E-009"],"isMultiContributor":false,"employeeId":"E-009","employeeName":"Manowharan","createdAt":"2024-04-02T10:00:00","updatedAt":"2024-04-02T10:00:00"},{"id":"ord_108","customerName":"Ashok Leyland Mining Fleet","customerGstin":"33AAACA1122B1Z4","vertical":"Sales","subVertical":"Onboard Sales","orderValue":5550000,"gstPct":18,"gstAmount":999000,"totalInvoiceValue":6549000,"hsnCode":"8423","invoiceNumber":"INV/2024-25/017","orderDate":"04/04/2024","status":"Won","lossReason":"","remarks":"Order won for Onboard Sales supply & service execution","contributors":[{"employeeId":"E-003","employeeName":"Subhashini","contributionPct":100}],"contributorIds":["E-003"],"isMultiContributor":false,"employeeId":"E-003","employeeName":"Subhashini","createdAt":"2024-04-04T10:00:00","updatedAt":"2024-04-04T10:00:00"},{"id":"ord_151","customerName":"Hindalco Lapanga Smelter","customerGstin":"21AAACH3456W1Z8","vertical":"Service, Parts Sales, Projects","subVertical":"OEM Spares","orderValue":1300000,"gstPct":18,"gstAmount":234000,"totalInvoiceValue":1534000,"hsnCode":"8423","invoiceNumber":"INV/2024-25/060","orderDate":"17/04/2024","status":"Won","lossReason":"","remarks":"Order won for OEM Spares supply & service execution","contributors":[{"employeeId":"E-007","employeeName":"Sivakumar","contributionPct":100}],"contributorIds":["E-007"],"isMultiContributor":false,"employeeId":"E-007","employeeName":"Sivakumar","createdAt":"2024-04-17T10:00:00","updatedAt":"2024-04-17T10:00:00"},{"id":"ord_128","customerName":"JSW Steel Ltd - Vijayanagar Works","customerGstin":"29AAACJ1011A1Z2","vertical":"Service, Parts Sales, Projects","subVertical":"Crane Weighing Systems","orderValue":4060000,"gstPct":18,"gstAmount":730800,"totalInvoiceValue":4790800,"hsnCode":"8423","invoiceNumber":"INV/2024-25/037","orderDate":"25/04/2024","status":"Won","lossReason":"","remarks":"Order won for Crane Weighing Systems supply & service execution","contributors":[{"employeeId":"E-004","employeeName":"Dipanwita","contributionPct":100}],"contributorIds":["E-004"],"isMultiContributor":false,"employeeId":"E-004","employeeName":"Dipanwita","createdAt":"2024-04-25T10:00:00","updatedAt":"2024-04-25T10:00:00"},{"id":"ord_156","customerName":"Ultratech Cement Maihar Works","customerGstin":"23AAACU1234Y1Z7","vertical":"Service, Parts Sales, Projects","subVertical":"AMC Service","orderValue":630000,"gstPct":18,"gstAmount":113400,"totalInvoiceValue":743400,"hsnCode":"8423","invoiceNumber":"INV/2024-25/065","orderDate":"28/04/2024","status":"Won","lossReason":"","remarks":"Order won for AMC Service supply & service execution","contributors":[{"employeeId":"E-008","employeeName":"Sandeep","contributionPct":100}],"contributorIds":["E-008"],"isMultiContributor":false,"employeeId":"E-008","employeeName":"Sandeep","createdAt":"2024-04-28T10:00:00","updatedAt":"2024-04-28T10:00:00"},{"id":"ord_142","customerName":"KIOCL Kudremukh Iron Ore","customerGstin":"29AAACK8901R1Z5","vertical":"Service, Parts Sales, Projects","subVertical":"AMC Service","orderValue":1540000,"gstPct":18,"gstAmount":277200,"totalInvoiceValue":1817200,"hsnCode":"8423","invoiceNumber":"INV/2024-25/051","orderDate":"06/05/2024","status":"Won","lossReason":"","remarks":"Order won for AMC Service supply & service execution","contributors":[{"employeeId":"E-006","employeeName":"Mathiarasu","contributionPct":100}],"contributorIds":["E-006"],"isMultiContributor":false,"employeeId":"E-006","employeeName":"Mathiarasu","createdAt":"2024-05-06T10:00:00","updatedAt":"2024-05-06T10:00:00"},{"id":"ord_160","customerName":"Thermax Limited Chinchwad","customerGstin":"27AAACT4567F1Z8","vertical":"Service, Parts Sales, Projects","subVertical":"Field Service","orderValue":1650000,"gstPct":18,"gstAmount":297000,"totalInvoiceValue":1947000,"hsnCode":"8423","invoiceNumber":"INV/2024-25/069","orderDate":"09/05/2024","status":"Won","lossReason":"","remarks":"Order won for Field Service supply & service execution","contributors":[{"employeeId":"E-009","employeeName":"Manowharan","contributionPct":70},{"employeeId":"E-002","employeeName":"Murugan","contributionPct":30}],"contributorIds":["E-009","E-002"],"isMultiContributor":true,"employeeId":"E-009","employeeName":"Manowharan","createdAt":"2024-05-09T10:00:00","updatedAt":"2024-05-09T10:00:00"},{"id":"ord_136","customerName":"Kesoram Cement Basantnagar","customerGstin":"36AAACK5678M1Z8","vertical":"Service, Parts Sales, Projects","subVertical":"Paid/Out-of-Warranty Service","orderValue":4730000,"gstPct":18,"gstAmount":851400,"totalInvoiceValue":5581400,"hsnCode":"8423","invoiceNumber":"INV/2024-25/045","orderDate":"25/05/2024","status":"Won","lossReason":"","remarks":"Order won for Paid/Out-of-Warranty Service supply & service execution","contributors":[{"employeeId":"E-005","employeeName":"Balaram","contributionPct":100}],"contributorIds":["E-005"],"isMultiContributor":false,"employeeId":"E-005","employeeName":"Balaram","createdAt":"2024-05-25T10:00:00","updatedAt":"2024-05-25T10:00:00"},{"id":"ord_127","customerName":"Hindalco Industries Renukoot","customerGstin":"09AAACH8901G1Z6","vertical":"Service, Parts Sales, Projects","subVertical":"OEM Spares","orderValue":9780000,"gstPct":18,"gstAmount":1760400,"totalInvoiceValue":11540400,"hsnCode":"8423","invoiceNumber":"INV/2024-25/036","orderDate":"10/06/2024","status":"Won","lossReason":"","remarks":"Order won for OEM Spares supply & service execution","contributors":[{"employeeId":"E-004","employeeName":"Dipanwita","contributionPct":70},{"employeeId":"E-002","employeeName":"Murugan","contributionPct":30}],"contributorIds":["E-004","E-002"],"isMultiContributor":true,"employeeId":"E-004","employeeName":"Dipanwita","createdAt":"2024-06-10T10:00:00","updatedAt":"2024-06-10T10:00:00"}];
 var defaultDwmActivities = [{"id":"dwm_1","employeeId":"E-002","employeeName":"Murugan","date":"23/08/2024","activityDescription":"Quarterly AMC preventive maintenance service for heavy weighbridge","linkedKraId":"kra_4","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Completed mechanical alignment & electrical zero adjustment","plannedAt":"2024-08-23T09:00:00","accomplishedAt":"2024-08-23T17:30:00"},{"id":"dwm_2","employeeId":"E-002","employeeName":"Murugan","date":"22/02/2026","activityDescription":"Joint review meeting with vertical head regarding monthly AOP gap analysis","linkedKraId":"kra_7","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Action plan finalized to close Q2 revenue targets","plannedAt":"2026-02-22T09:00:00","accomplishedAt":"2026-02-22T17:30:00"},{"id":"dwm_3","employeeId":"E-002","employeeName":"Murugan","date":"03/07/2026","activityDescription":"Digital marketing lead enquiry verification and immediate WhatsApp follow-up","linkedKraId":"kra_6","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Lead qualified and forwarded to area engineer","plannedAt":"2026-07-03T09:00:00","accomplishedAt":"2026-07-03T17:30:00"},{"id":"dwm_4","employeeId":"E-002","employeeName":"Murugan","date":"02/07/2024","activityDescription":"Joint review meeting with vertical head regarding monthly AOP gap analysis","linkedKraId":"kra_7","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Action plan finalized to close Q2 revenue targets","plannedAt":"2024-07-02T09:00:00","accomplishedAt":"2024-07-02T17:30:00"},{"id":"dwm_5","employeeId":"E-002","employeeName":"Murugan","date":"15/04/2024","activityDescription":"Payment collection follow-up visit to finance office","linkedKraId":"kra_5","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Payment commitment received for next RTGS cycle","plannedAt":"2024-04-15T09:00:00","accomplishedAt":"2024-04-15T17:30:00"},{"id":"dwm_6","employeeId":"E-002","employeeName":"Murugan","date":"02/10/2025","activityDescription":"Demonstration of wireless crane scale unit to GM Operations","linkedKraId":"kra_2","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Demo successful, customer requested commercial proposal","plannedAt":"2025-10-02T09:00:00","accomplishedAt":"2025-10-02T17:30:00"},{"id":"dwm_7","employeeId":"E-002","employeeName":"Murugan","date":"10/07/2025","activityDescription":"Digital marketing lead enquiry verification and immediate WhatsApp follow-up","linkedKraId":"kra_6","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Lead qualified and forwarded to area engineer","plannedAt":"2025-07-10T09:00:00","accomplishedAt":"2025-07-10T17:30:00"},{"id":"dwm_8","employeeId":"E-002","employeeName":"Murugan","date":"18/02/2026","activityDescription":"Payment collection follow-up visit to finance office","linkedKraId":"kra_5","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Payment commitment received for next RTGS cycle","plannedAt":"2026-02-18T09:00:00","accomplishedAt":"2026-02-18T17:30:00"},{"id":"dwm_9","employeeId":"E-002","employeeName":"Murugan","date":"20/11/2025","activityDescription":"Joint review meeting with vertical head regarding monthly AOP gap analysis","linkedKraId":"kra_7","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Action plan finalized to close Q2 revenue targets","plannedAt":"2025-11-20T09:00:00","accomplishedAt":"2025-11-20T17:30:00"},{"id":"dwm_10","employeeId":"E-002","employeeName":"Murugan","date":"22/07/2026","activityDescription":"Digital marketing lead enquiry verification and immediate WhatsApp follow-up","linkedKraId":"kra_6","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Lead qualified and forwarded to area engineer","plannedAt":"2026-07-22T09:00:00","accomplishedAt":"2026-07-22T17:30:00"},{"id":"dwm_11","employeeId":"E-002","employeeName":"Murugan","date":"20/07/2024","activityDescription":"Quarterly AMC preventive maintenance service for heavy weighbridge","linkedKraId":"kra_4","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Completed mechanical alignment & electrical zero adjustment","plannedAt":"2024-07-20T09:00:00","accomplishedAt":"2024-07-20T17:30:00"},{"id":"dwm_12","employeeId":"E-002","employeeName":"Murugan","date":"27/07/2025","activityDescription":"Site visit to customer plant for load cell calibration check","linkedKraId":"kra_1","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Calibrated 4 load cells; certificate issued","plannedAt":"2025-07-27T09:00:00","accomplishedAt":"2025-07-27T17:30:00"},{"id":"dwm_13","employeeId":"E-002","employeeName":"Murugan","date":"26/12/2025","activityDescription":"Digital marketing lead enquiry verification and immediate WhatsApp follow-up","linkedKraId":"kra_6","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Lead qualified and forwarded to area engineer","plannedAt":"2025-12-26T09:00:00","accomplishedAt":"2025-12-26T17:30:00"},{"id":"dwm_14","employeeId":"E-002","employeeName":"Murugan","date":"16/12/2025","activityDescription":"Quarterly AMC preventive maintenance service for heavy weighbridge","linkedKraId":"kra_4","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Completed mechanical alignment & electrical zero adjustment","plannedAt":"2025-12-16T09:00:00","accomplishedAt":"2025-12-16T17:30:00"},{"id":"dwm_15","employeeId":"E-002","employeeName":"Murugan","date":"24/01/2026","activityDescription":"Demonstration of wireless crane scale unit to GM Operations","linkedKraId":"kra_2","linkedKra":"Key Operational KRA","linkedAopLine":"Sales & Marketing Head","planStatus":"Planned","accomplishmentStatus":"Done","accomplishmentRemarks":"Demo successful, customer requested commercial proposal","plannedAt":"2026-01-24T09:00:00","accomplishedAt":"2026-01-24T17:30:00"}];
 var defaultAttendance = [{"id":"att_1","employeeId":"E-001","employeeName":"Ravichandran","date":"30/11/2024","punchInTime":"2024-11-30T09:09:00","punchOutTime":"2024-11-30T18:03:00","workedHours":8.1,"dwmPlanCount":3,"dwmAccomplishedCount":4,"status":"Completed"},{"id":"att_2","employeeId":"E-001","employeeName":"Ravichandran","date":"22/06/2026","punchInTime":"2026-06-22T09:14:00","punchOutTime":"2026-06-22T18:02:00","workedHours":8.2,"dwmPlanCount":3,"dwmAccomplishedCount":4,"status":"Completed"},{"id":"att_3","employeeId":"E-001","employeeName":"Ravichandran","date":"01/10/2025","punchInTime":"2025-10-01T09:00:00","punchOutTime":"2025-10-01T18:20:00","workedHours":8.8,"dwmPlanCount":2,"dwmAccomplishedCount":4,"status":"Completed"},{"id":"att_4","employeeId":"E-001","employeeName":"Ravichandran","date":"26/08/2024","punchInTime":"2024-08-26T09:09:00","punchOutTime":"2024-08-26T18:13:00","workedHours":8,"dwmPlanCount":3,"dwmAccomplishedCount":2,"status":"Completed"},{"id":"att_5","employeeId":"E-001","employeeName":"Ravichandran","date":"06/11/2025","punchInTime":"2025-11-06T09:13:00","punchOutTime":"2025-11-06T18:05:00","workedHours":9,"dwmPlanCount":2,"dwmAccomplishedCount":4,"status":"Completed"},{"id":"att_6","employeeId":"E-001","employeeName":"Ravichandran","date":"05/04/2025","punchInTime":"2025-04-05T09:02:00","punchOutTime":"2025-04-05T18:30:00","workedHours":8.8,"dwmPlanCount":4,"dwmAccomplishedCount":4,"status":"Completed"},{"id":"att_7","employeeId":"E-001","employeeName":"Ravichandran","date":"20/10/2025","punchInTime":"2025-10-20T09:00:00","punchOutTime":"2025-10-20T18:12:00","workedHours":9.3,"dwmPlanCount":2,"dwmAccomplishedCount":4,"status":"Completed"},{"id":"att_8","employeeId":"E-001","employeeName":"Ravichandran","date":"02/05/2025","punchInTime":"2025-05-02T09:11:00","punchOutTime":"2025-05-02T18:08:00","workedHours":9.1,"dwmPlanCount":3,"dwmAccomplishedCount":2,"status":"Completed"},{"id":"att_9","employeeId":"E-001","employeeName":"Ravichandran","date":"20/03/2025","punchInTime":"2025-03-20T09:07:00","punchOutTime":"2025-03-20T18:23:00","workedHours":9,"dwmPlanCount":2,"dwmAccomplishedCount":4,"status":"Completed"},{"id":"att_10","employeeId":"E-001","employeeName":"Ravichandran","date":"23/04/2026","punchInTime":"2026-04-23T09:10:00","punchOutTime":"2026-04-23T18:04:00","workedHours":8.1,"dwmPlanCount":4,"dwmAccomplishedCount":3,"status":"Completed"},{"id":"att_11","employeeId":"E-001","employeeName":"Ravichandran","date":"13/07/2026","punchInTime":"2026-07-13T09:05:00","punchOutTime":"2026-07-13T18:26:00","workedHours":9.2,"dwmPlanCount":3,"dwmAccomplishedCount":4,"status":"Completed"},{"id":"att_12","employeeId":"E-001","employeeName":"Ravichandran","date":"04/08/2025","punchInTime":"2025-08-04T09:05:00","punchOutTime":"2025-08-04T18:25:00","workedHours":8.2,"dwmPlanCount":4,"dwmAccomplishedCount":3,"status":"Completed"},{"id":"att_13","employeeId":"E-001","employeeName":"Ravichandran","date":"08/05/2024","punchInTime":"2024-05-08T09:09:00","punchOutTime":"2024-05-08T18:06:00","workedHours":8.1,"dwmPlanCount":2,"dwmAccomplishedCount":2,"status":"Completed"},{"id":"att_14","employeeId":"E-001","employeeName":"Ravichandran","date":"18/02/2025","punchInTime":"2025-02-18T09:09:00","punchOutTime":"2025-02-18T18:16:00","workedHours":8.6,"dwmPlanCount":4,"dwmAccomplishedCount":3,"status":"Completed"},{"id":"att_15","employeeId":"E-001","employeeName":"Ravichandran","date":"16/12/2024","punchInTime":"2024-12-16T09:01:00","punchOutTime":"2024-12-16T18:24:00","workedHours":9,"dwmPlanCount":3,"dwmAccomplishedCount":3,"status":"Completed"}];
 var defaultLeads = [{"id":"lead_1","employeeId":"E-003","customerName":"Ashok Leyland Mining Fleet","vertical":"Sales","subVertical":"Onboard Sales","status":"Quoted","expectedValue":2550000,"followUpDate":"03/09/2024","createdDate":"29/08/2024","contactPerson":"Manager Purchase - Ashok","contactPhone":"+91 98390 72277","remarks":"Requirement for Onboard Sales - initial technical discussions completed"},{"id":"lead_2","employeeId":"E-003","customerName":"Bharat Earth Movers Ltd (BEML)","vertical":"Sales","subVertical":"Project Sales","status":"Lost","expectedValue":4000000,"followUpDate":"03/06/2026","createdDate":"27/05/2026","contactPerson":"Manager Purchase - Bharat","contactPhone":"+91 98390 92544","remarks":"Requirement for Project Sales - initial technical discussions completed"},{"id":"lead_3","employeeId":"E-003","customerName":"Bharat Earth Movers Ltd (BEML)","vertical":"Sales","subVertical":"Project Sales","status":"New Enquiry","expectedValue":3700000,"followUpDate":"13/11/2024","createdDate":"17/10/2024","contactPerson":"Manager Purchase - Bharat","contactPhone":"+91 98390 74799","remarks":"Requirement for Project Sales - initial technical discussions completed"},{"id":"lead_4","employeeId":"E-003","customerName":"Volvo Construction Equipment","vertical":"Sales","subVertical":"Onboard Sales","status":"New Enquiry","expectedValue":6250000,"followUpDate":"15/12/2024","createdDate":"06/12/2024","contactPerson":"Manager Purchase - Volvo","contactPhone":"+91 98390 10726","remarks":"Requirement for Onboard Sales - initial technical discussions completed"},{"id":"lead_5","employeeId":"E-003","customerName":"Tata Motors Commercial Vehicles","vertical":"Sales","subVertical":"Onboard Sales","status":"Negotiation","expectedValue":2000000,"followUpDate":"25/06/2026","createdDate":"07/06/2026","contactPerson":"Manager Purchase - Tata","contactPhone":"+91 98390 77889","remarks":"Requirement for Onboard Sales - initial technical discussions completed"},{"id":"lead_6","employeeId":"E-003","customerName":"Volvo Construction Equipment","vertical":"Sales","subVertical":"Onboard Sales","status":"Negotiation","expectedValue":7600000,"followUpDate":"13/06/2024","createdDate":"22/05/2024","contactPerson":"Manager Purchase - Volvo","contactPhone":"+91 98390 25906","remarks":"Requirement for Onboard Sales - initial technical discussions completed"},{"id":"lead_7","employeeId":"E-003","customerName":"Volvo Construction Equipment","vertical":"Sales","subVertical":"Onboard Sales","status":"Lost","expectedValue":6100000,"followUpDate":"14/09/2024","createdDate":"15/08/2024","contactPerson":"Manager Purchase - Volvo","contactPhone":"+91 98390 79616","remarks":"Requirement for Onboard Sales - initial technical discussions completed"},{"id":"lead_8","employeeId":"E-003","customerName":"Bharat Earth Movers Ltd (BEML)","vertical":"Sales","subVertical":"Project Sales","status":"Lost","expectedValue":5650000,"followUpDate":"16/12/2025","createdDate":"01/12/2025","contactPerson":"Manager Purchase - Bharat","contactPhone":"+91 98390 76162","remarks":"Requirement for Project Sales - initial technical discussions completed"},{"id":"lead_9","employeeId":"E-003","customerName":"Volvo Construction Equipment","vertical":"Sales","subVertical":"Onboard Sales","status":"Lost","expectedValue":1850000,"followUpDate":"21/08/2026","createdDate":"30/07/2026","contactPerson":"Manager Purchase - Volvo","contactPhone":"+91 98390 72216","remarks":"Requirement for Onboard Sales - initial technical discussions completed"},{"id":"lead_10","employeeId":"E-003","customerName":"Volvo Construction Equipment","vertical":"Sales","subVertical":"Onboard Sales","status":"Negotiation","expectedValue":7550000,"followUpDate":"20/01/2025","createdDate":"22/12/2024","contactPerson":"Manager Purchase - Volvo","contactPhone":"+91 98390 93579","remarks":"Requirement for Onboard Sales - initial technical discussions completed"},{"id":"lead_11","employeeId":"E-003","customerName":"L&T Construction Machinery","vertical":"Sales","subVertical":"Project Sales","status":"Qualified","expectedValue":4550000,"followUpDate":"23/06/2026","createdDate":"25/05/2026","contactPerson":"Manager Purchase - L&T","contactPhone":"+91 98390 92149","remarks":"Requirement for Project Sales - initial technical discussions completed"},{"id":"lead_12","employeeId":"E-003","customerName":"Ashok Leyland Mining Fleet","vertical":"Sales","subVertical":"Onboard Sales","status":"Quoted","expectedValue":6500000,"followUpDate":"26/01/2025","createdDate":"07/01/2025","contactPerson":"Manager Purchase - Ashok","contactPhone":"+91 98390 47450","remarks":"Requirement for Onboard Sales - initial technical discussions completed"},{"id":"lead_13","employeeId":"E-003","customerName":"Ashok Leyland Mining Fleet","vertical":"Sales","subVertical":"Onboard Sales","status":"Won","expectedValue":8000000,"followUpDate":"19/01/2025","createdDate":"04/01/2025","contactPerson":"Manager Purchase - Ashok","contactPhone":"+91 98390 80798","remarks":"Requirement for Onboard Sales - initial technical discussions completed"},{"id":"lead_14","employeeId":"E-003","customerName":"Tata Motors Commercial Vehicles","vertical":"Sales","subVertical":"Onboard Sales","status":"Negotiation","expectedValue":3700000,"followUpDate":"29/08/2024","createdDate":"20/08/2024","contactPerson":"Manager Purchase - Tata","contactPhone":"+91 98390 30028","remarks":"Requirement for Onboard Sales - initial technical discussions completed"},{"id":"lead_15","employeeId":"E-003","customerName":"Caterpillar India Logistics","vertical":"Sales","subVertical":"Onboard Sales","status":"Lost","expectedValue":3900000,"followUpDate":"13/11/2024","createdDate":"06/11/2024","contactPerson":"Manager Purchase - Caterpillar","contactPhone":"+91 98390 53369","remarks":"Requirement for Onboard Sales - initial technical discussions completed"}];
 var defaultPayments = [{"id":"pay_1","employeeId":"E-006","customerName":"JSW Cement Toranagallu","invoiceNumber":"INV/2024-25/048","amount":3599000,"paymentDate":"12/05/2024","mode":"Direct Transfer","remarks":"Full payment received against invoice INV/2024-25/048"},{"id":"pay_2","employeeId":"E-009","customerName":"Thermax Limited Chinchwad","invoiceNumber":"INV/2024-25/073","amount":1250800,"paymentDate":"26/04/2024","mode":"RTGS","remarks":"Full payment received against invoice INV/2024-25/073"},{"id":"pay_3","employeeId":"E-003","customerName":"Ashok Leyland Mining Fleet","invoiceNumber":"INV/2024-25/017","amount":6549000,"paymentDate":"19/05/2024","mode":"NEFT","remarks":"Full payment received against invoice INV/2024-25/017"},{"id":"pay_4","employeeId":"E-007","customerName":"Hindalco Lapanga Smelter","invoiceNumber":"INV/2024-25/060","amount":1534000,"paymentDate":"23/05/2024","mode":"Direct Transfer","remarks":"Full payment received against invoice INV/2024-25/060"},{"id":"pay_5","employeeId":"E-004","customerName":"JSW Steel Ltd - Vijayanagar Works","invoiceNumber":"INV/2024-25/037","amount":4790800,"paymentDate":"23/06/2024","mode":"NEFT","remarks":"Full payment received against invoice INV/2024-25/037"},{"id":"pay_6","employeeId":"E-008","customerName":"Ultratech Cement Maihar Works","invoiceNumber":"INV/2024-25/065","amount":743400,"paymentDate":"23/06/2024","mode":"RTGS","remarks":"Full payment received against invoice INV/2024-25/065"},{"id":"pay_7","employeeId":"E-006","customerName":"KIOCL Kudremukh Iron Ore","invoiceNumber":"INV/2024-25/051","amount":1817200,"paymentDate":"11/06/2024","mode":"Direct Transfer","remarks":"Full payment received against invoice INV/2024-25/051"},{"id":"pay_8","employeeId":"E-009","customerName":"Thermax Limited Chinchwad","invoiceNumber":"INV/2024-25/069","amount":1947000,"paymentDate":"27/06/2024","mode":"NEFT","remarks":"Full payment received against invoice INV/2024-25/069"},{"id":"pay_9","employeeId":"E-005","customerName":"Kesoram Cement Basantnagar","invoiceNumber":"INV/2024-25/045","amount":5581400,"paymentDate":"29/06/2024","mode":"Direct Transfer","remarks":"Full payment received against invoice INV/2024-25/045"},{"id":"pay_10","employeeId":"E-004","customerName":"Hindalco Industries Renukoot","invoiceNumber":"INV/2024-25/036","amount":11540400,"paymentDate":"09/08/2024","mode":"NEFT","remarks":"Full payment received against invoice INV/2024-25/036"},{"id":"pay_11","employeeId":"E-004","customerName":"SAIL Durgapur Steel Plant","invoiceNumber":"INV/2024-25/034","amount":12885600,"paymentDate":"30/07/2024","mode":"RTGS","remarks":"Full payment received against invoice INV/2024-25/034"},{"id":"pay_12","employeeId":"E-003","customerName":"Ashok Leyland Mining Fleet","invoiceNumber":"INV/2024-25/018","amount":5687600,"paymentDate":"12/08/2024","mode":"RTGS","remarks":"Full payment received against invoice INV/2024-25/018"},{"id":"pay_13","employeeId":"E-005","customerName":"Telangana State Power Gen Corp","invoiceNumber":"INV/2024-25/043","amount":1427800,"paymentDate":"20/07/2024","mode":"Direct Transfer","remarks":"Full payment received against invoice INV/2024-25/043"},{"id":"pay_14","employeeId":"E-005","customerName":"Sagar Cements Mattampally","invoiceNumber":"INV/2024-25/047","amount":5274600,"paymentDate":"19/08/2024","mode":"NEFT","remarks":"Full payment received against invoice INV/2024-25/047"},{"id":"pay_15","employeeId":"E-004","customerName":"Hindalco Industries Renukoot","invoiceNumber":"INV/2024-25/028","amount":6619800,"paymentDate":"26/07/2024","mode":"Direct Transfer","remarks":"Full payment received against invoice INV/2024-25/028"}];
 var defaultReviews = [{"id":"rev_1","employeeId":"E-002","employeeName":"Murugan","reviewerId":"E-001","reviewerName":"Ravichandran","periodType":"Monthly","periodLabel":"April 2024","periodStartDate":"01/04/2024","periodEndDate":"30/04/2024","kpiAchievementSnapshot":93.4,"dwmComplianceSnapshot":91.8,"attendanceSnapshot":92.9,"rating":"Meets Expectations","managerComments":"Performance review for April 2024. Target achievement at 93.4%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for April 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"30/04/2024","createdAt":"2026-08-06T04:32:28.293144"},{"id":"rev_2","employeeId":"E-003","employeeName":"Subhashini","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"April 2024","periodStartDate":"01/04/2024","periodEndDate":"30/04/2024","kpiAchievementSnapshot":100.4,"dwmComplianceSnapshot":94.4,"attendanceSnapshot":99.7,"rating":"Exceeds Expectations","managerComments":"Performance review for April 2024. Target achievement at 100.4%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for April 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"30/04/2024","createdAt":"2026-08-06T04:32:28.293164"},{"id":"rev_3","employeeId":"E-004","employeeName":"Dipanwita","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"April 2024","periodStartDate":"01/04/2024","periodEndDate":"30/04/2024","kpiAchievementSnapshot":92.2,"dwmComplianceSnapshot":93.5,"attendanceSnapshot":95.1,"rating":"Meets Expectations","managerComments":"Performance review for April 2024. Target achievement at 92.2%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for April 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"30/04/2024","createdAt":"2026-08-06T04:32:28.293178"},{"id":"rev_4","employeeId":"E-005","employeeName":"Balaram","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"April 2024","periodStartDate":"01/04/2024","periodEndDate":"30/04/2024","kpiAchievementSnapshot":87.6,"dwmComplianceSnapshot":93.2,"attendanceSnapshot":95.7,"rating":"Needs Improvement","managerComments":"Performance review for April 2024. Target achievement at 87.6%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for April 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"30/04/2024","createdAt":"2026-08-06T04:32:28.293187"},{"id":"rev_5","employeeId":"E-006","employeeName":"Mathiarasu","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"April 2024","periodStartDate":"01/04/2024","periodEndDate":"30/04/2024","kpiAchievementSnapshot":89,"dwmComplianceSnapshot":96.1,"attendanceSnapshot":98.4,"rating":"Meets Expectations","managerComments":"Performance review for April 2024. Target achievement at 89.0%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for April 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"30/04/2024","createdAt":"2026-08-06T04:32:28.293206"},{"id":"rev_6","employeeId":"E-007","employeeName":"Sivakumar","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"April 2024","periodStartDate":"01/04/2024","periodEndDate":"30/04/2024","kpiAchievementSnapshot":106.1,"dwmComplianceSnapshot":95.3,"attendanceSnapshot":97.4,"rating":"Exceeds Expectations","managerComments":"Performance review for April 2024. Target achievement at 106.1%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for April 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"30/04/2024","createdAt":"2026-08-06T04:32:28.293214"},{"id":"rev_7","employeeId":"E-008","employeeName":"Sandeep","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"April 2024","periodStartDate":"01/04/2024","periodEndDate":"30/04/2024","kpiAchievementSnapshot":92.2,"dwmComplianceSnapshot":92.1,"attendanceSnapshot":92.9,"rating":"Meets Expectations","managerComments":"Performance review for April 2024. Target achievement at 92.2%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for April 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"30/04/2024","createdAt":"2026-08-06T04:32:28.293220"},{"id":"rev_8","employeeId":"E-009","employeeName":"Manowharan","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"April 2024","periodStartDate":"01/04/2024","periodEndDate":"30/04/2024","kpiAchievementSnapshot":93.6,"dwmComplianceSnapshot":91.3,"attendanceSnapshot":95.1,"rating":"Meets Expectations","managerComments":"Performance review for April 2024. Target achievement at 93.6%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for April 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"30/04/2024","createdAt":"2026-08-06T04:32:28.293226"},{"id":"rev_9","employeeId":"E-002","employeeName":"Murugan","reviewerId":"E-001","reviewerName":"Ravichandran","periodType":"Monthly","periodLabel":"May 2024","periodStartDate":"01/05/2024","periodEndDate":"31/05/2024","kpiAchievementSnapshot":98.7,"dwmComplianceSnapshot":95.2,"attendanceSnapshot":95.4,"rating":"Exceeds Expectations","managerComments":"Performance review for May 2024. Target achievement at 98.7%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for May 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"31/05/2024","createdAt":"2026-08-06T04:32:28.293250"},{"id":"rev_10","employeeId":"E-003","employeeName":"Subhashini","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"May 2024","periodStartDate":"01/05/2024","periodEndDate":"31/05/2024","kpiAchievementSnapshot":96.2,"dwmComplianceSnapshot":94.8,"attendanceSnapshot":99.4,"rating":"Meets Expectations","managerComments":"Performance review for May 2024. Target achievement at 96.2%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for May 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"31/05/2024","createdAt":"2026-08-06T04:32:28.293263"},{"id":"rev_11","employeeId":"E-004","employeeName":"Dipanwita","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"May 2024","periodStartDate":"01/05/2024","periodEndDate":"31/05/2024","kpiAchievementSnapshot":106.4,"dwmComplianceSnapshot":91.6,"attendanceSnapshot":93.3,"rating":"Exceeds Expectations","managerComments":"Performance review for May 2024. Target achievement at 106.4%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for May 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"31/05/2024","createdAt":"2026-08-06T04:32:28.293283"},{"id":"rev_12","employeeId":"E-005","employeeName":"Balaram","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"May 2024","periodStartDate":"01/05/2024","periodEndDate":"31/05/2024","kpiAchievementSnapshot":91.6,"dwmComplianceSnapshot":91.7,"attendanceSnapshot":98.7,"rating":"Meets Expectations","managerComments":"Performance review for May 2024. Target achievement at 91.6%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for May 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"31/05/2024","createdAt":"2026-08-06T04:32:28.293290"},{"id":"rev_13","employeeId":"E-006","employeeName":"Mathiarasu","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"May 2024","periodStartDate":"01/05/2024","periodEndDate":"31/05/2024","kpiAchievementSnapshot":99.2,"dwmComplianceSnapshot":97.8,"attendanceSnapshot":99.6,"rating":"Exceeds Expectations","managerComments":"Performance review for May 2024. Target achievement at 99.2%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for May 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"31/05/2024","createdAt":"2026-08-06T04:32:28.293301"},{"id":"rev_14","employeeId":"E-007","employeeName":"Sivakumar","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"May 2024","periodStartDate":"01/05/2024","periodEndDate":"31/05/2024","kpiAchievementSnapshot":96.1,"dwmComplianceSnapshot":91.8,"attendanceSnapshot":95.1,"rating":"Meets Expectations","managerComments":"Performance review for May 2024. Target achievement at 96.1%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for May 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"31/05/2024","createdAt":"2026-08-06T04:32:28.293316"},{"id":"rev_15","employeeId":"E-008","employeeName":"Sandeep","reviewerId":"E-002","reviewerName":"Murugan","periodType":"Monthly","periodLabel":"May 2024","periodStartDate":"01/05/2024","periodEndDate":"31/05/2024","kpiAchievementSnapshot":97.9,"dwmComplianceSnapshot":95.9,"attendanceSnapshot":95.3,"rating":"Meets Expectations","managerComments":"Performance review for May 2024. Target achievement at 97.9%. Strong DWM discipline and territory presence.","employeeComments":"Achieved key operational KRAs for May 2024. Continuing focus on high-margin revenue lines.","actionItems":"Expand active customer base; follow up on open quotations within 48 hours.","reviewDate":"31/05/2024","createdAt":"2026-08-06T04:32:28.293324"}];
 if (!localStorage.getItem('employees') || (window.RevOpsStore && (!window.RevOpsStore.getCollection('employees') || window.RevOpsStore.getCollection('employees').length === 0))) { localStorage.setItem('employees', JSON.stringify(defaultEmployees)); }
 if (!localStorage.getItem('kraTargets')) { localStorage.setItem('kraTargets', JSON.stringify(defaultKraTargets)); }
 if (!localStorage.getItem('aopTargets')) { localStorage.setItem('aopTargets', JSON.stringify(defaultAopTargets)); }
 if (!localStorage.getItem('orders')) { localStorage.setItem('orders', JSON.stringify(defaultOrders)); }
 if (!localStorage.getItem('dwmActivities')) { localStorage.setItem('dwmActivities', JSON.stringify(defaultDwmActivities)); }
 if (!localStorage.getItem('attendance')) { localStorage.setItem('attendance', JSON.stringify(defaultAttendance)); }
 if (!localStorage.getItem('leads')) { localStorage.setItem('leads', JSON.stringify(defaultLeads)); }
 if (!localStorage.getItem('payments')) { localStorage.setItem('payments', JSON.stringify(defaultPayments)); }
 if (!localStorage.getItem('reviews')) { localStorage.setItem('reviews', JSON.stringify(defaultReviews)); }
 
if (!localStorage.getItem('expenses')) {
 localStorage.setItem('expenses', JSON.stringify([
 { id: 'exp_1', voucherNo: 'TRV-1001', date: '18/07/2026', category: 'Travelling', payee: 'Murugan', amount: 18500, vertical: 'Sales', projectId: '', paymentMode: 'Bank Transfer', remarks: 'Travel Claim: Jharsuguda Cluster (15/07/2026 - 18/07/2026)', status: 'Approved', receiptBase64: '', policyExceeded: false, preAppRefId: 'TRV-APP-101', clientName: 'Tata Steel Long Products', items: [{ date: '15/07/2026', category: 'Flight/Train Ticket', desc: 'Flight Chennai to Jharsuguda', amount: 4400 }, { date: '16/07/2026', category: 'Hotel Accommodation', desc: 'Hotel Grand Residency 2 nights', amount: 10500 }, { date: '17/07/2026', category: 'Daily Allowance (Food)', desc: 'Daily allowance 3 days', amount: 3600 }] },
 { id: 'exp_2', voucherNo: 'VOUCH-1002', date: '14/07/2026', category: 'Project Expenses', payee: 'Universal Testing Corp', amount: 650000, vertical: 'Projects', projectId: 'PRJ-2026-101', paymentMode: 'Bank Transfer', remarks: 'Raw material load cell sensors & crane scale calibration kit for Steel Plant Project', status: 'Approved', receiptBase64: '' },
 { id: 'exp_3', voucherNo: 'VOUCH-1003', date: '18/07/2026', category: 'Admin', payee: 'Airtel Broadband & Utilities', amount: 14200, vertical: 'Overhead', projectId: '', paymentMode: 'UPI', remarks: 'Head office internet, landline & cloud server hosting bill', status: 'Approved', receiptBase64: '' },
 { id: 'exp_4', voucherNo: 'VOUCH-1004', date: '22/07/2026', category: 'Salary Advance', payee: 'Sivakumar', amount: 25000, vertical: 'Service/Parts', projectId: '', paymentMode: 'Bank Transfer', remarks: 'Temporary salary advance for field service emergency', status: 'Approved', receiptBase64: '' },
 { id: 'exp_5', voucherNo: 'TRV-1005', date: '05/06/2026', category: 'Travelling', payee: 'Sivakumar', amount: 12400, vertical: 'Service/Parts', projectId: 'PRJ-2026-102', paymentMode: 'Bank Transfer', remarks: 'Toranagallu emergency calibration trip flight & conveyance', status: 'Approved', receiptBase64: '' },
 { id: 'exp_6', voucherNo: 'VOUCH-1006', date: '12/06/2026', category: 'Project Expenses', payee: 'Precision Sensors India Ltd', amount: 420000, vertical: 'Projects', projectId: 'PRJ-2026-102', paymentMode: 'Bank Transfer', remarks: 'Digital weighbridge terminal displays and load cell mounting hardware', status: 'Approved', receiptBase64: '' },
 { id: 'exp_7', voucherNo: 'VOUCH-1007', date: '20/05/2026', category: 'Admin', payee: 'Godrej Office Supplies', amount: 38500, vertical: 'Overhead', projectId: '', paymentMode: 'Corporate Card', remarks: 'Office ergonomics chairs and client meeting room stationaries', status: 'Approved', receiptBase64: '' },
 { id: 'exp_8', voucherNo: 'TRV-1008', date: '10/05/2026', category: 'Travelling', payee: 'Priya Sharma', amount: 15600, vertical: 'Service/Parts', projectId: '', paymentMode: 'Bank Transfer', remarks: 'Site inspection & calibration audit at Vedanta Smelter Plant', status: 'Approved', receiptBase64: '' },
 { id: 'exp_9', voucherNo: 'VOUCH-1009', date: '02/04/2026', category: 'Project Expenses', payee: 'Industrial Cables & Controls', amount: 210000, vertical: 'Projects', projectId: 'PRJ-2026-101', paymentMode: 'Bank Transfer', remarks: 'Armored signal cable drums for weighbridge automation installation', status: 'Approved', receiptBase64: '' },
 { id: 'exp_10', voucherNo: 'VOUCH-1010', date: '25/04/2026', category: 'Admin', payee: 'TNS & Associates CA Firm', amount: 45000, vertical: 'Overhead', projectId: '', paymentMode: 'Bank Transfer', remarks: 'GST annual audit retainer & statutory compliance filing fee', status: 'Approved', receiptBase64: '' }
 ]));
 }
 if (!localStorage.getItem('projectsMaster')) {
 localStorage.setItem('projectsMaster', JSON.stringify([
 { id: 'PRJ-2026-101', projectCode: 'PRJ-2026-101', projectName: 'Tata Steel Weighbridge SLA & Automation', clientName: 'Tata Steel Long Products', vertical: 'Projects', budget: 2500000, milestones: [{ id: 'M1', title: 'Supply & Hardware Dispatch', amount: 1500000, status: 'Received' }, { id: 'M2', title: 'Installation & Calibration Commissioning', amount: 800000, status: 'Invoiced' }], tmBillings: [{ id: 'TM1', title: 'Overtime Automation Engineering (40 hrs @ ₹2,000)', hours: 40, rate: 2000, amount: 80000, status: 'Invoiced' }], changeOrders: [{ id: 'CO1', title: 'Additional Heavy-Duty Load Cell Cables', amount: 50000, status: 'Approved' }], directLaborCost: 350000, subcontractorCost: 280000, materialsCost: 850000 },
 { id: 'PRJ-2026-102', projectCode: 'PRJ-2026-102', projectName: 'Jindal Steels Crane Scales Overhaul', clientName: 'Jindal Steels & Minerals Ltd', vertical: 'Projects', budget: 1800000, milestones: [{ id: 'M1', title: 'Phase 1 Sensor Supply & Disassembly', amount: 1000000, status: 'Received' }, { id: 'M2', title: 'Phase 2 Load Cell Testing & Final Signoff', amount: 600000, status: 'Invoiced' }], tmBillings: [{ id: 'TM1', title: 'Specialist On-site Calibration (30 hrs @ ₹2,500)', hours: 30, rate: 2500, amount: 75000, status: 'Invoiced' }], changeOrders: [{ id: 'CO1', title: 'Wireless Display Module Upgrade', amount: 45000, status: 'Approved' }], directLaborCost: 250000, subcontractorCost: 190000, materialsCost: 620000 }
 ]));
 }
 if (!localStorage.getItem('expenseSplits')) {
 localStorage.setItem('expenseSplits', JSON.stringify([
 { splitId: 'SPL-101', expenseId: 'exp_1', projectCode: 'PRJ-2026-101', allocationMode: 'weighted', allocatedPercentage: 60, allocatedAmount: 11100, expenseClassification: 'Allocated Shared' },
 { splitId: 'SPL-102', expenseId: 'exp_1', projectCode: 'PRJ-2026-102', allocationMode: 'weighted', allocatedPercentage: 40, allocatedAmount: 7400, expenseClassification: 'Allocated Shared' }
 ]));
 }
 if (!localStorage.getItem('travelPolicyMaster')) {
 localStorage.setItem('travelPolicyMaster', JSON.stringify([{ id: 'pol_1', hotelLimitPerDay: 3500, daLimitPerDay: 1200, localConveyancePerDay: 1500, flightLimitPerTrip: 12000, clientEntertainmentLimit: 5000, updatedAt: '2026-07-01' }]));
 }
 if (!localStorage.getItem('travelApprovals')) {
 localStorage.setItem('travelApprovals', JSON.stringify([
 { id: 'TRV-APP-101', empId: 'E-002', employeeName: 'Murugan', vertical: 'Sales', startDate: '2026-07-15', endDate: '2026-07-18', places: 'Jharsuguda & Rourkela Industrial Belts', purpose: 'New Crane Scale SLA contract & plant load cell inspection', clientType: 'existing', clientName: 'Tata Steel Long Products', contactPerson: 'Mr. S. K. Mahapatra (Sr. GM Projects)', contactPhone: '+91 97760 88210', estimatedBudget: 18000, isExtension: false, refId: '', status: 'Approved', appliedDate: '2026-07-10', extensionReason: '' }
 ]));
 }
 if (!localStorage.getItem('serviceTickets')) {
 localStorage.setItem('serviceTickets', JSON.stringify([
 {
 id: 'TKT-2026-001',
 ticketNumber: 'TKT-2026-001',
 customerName: 'Tata Steel Long Products',
 equipmentModel: 'MDI-WS-9000 Weighbridge System',
 equipmentSerial: 'EQ-9042',
 vertical: 'Service/Parts',
 complaintCategory: 'Load Cell Drift',
 complaintDescription: 'Load cell reading fluctuates by +/- 150kg during static truck weighing at Blast Furnace Gate 2.',
 severity: 'High',
 status: 'Resolved',
 assignedTo: 'E-004',
 assignedToName: 'Priya Sharma',
 createdDate: '12/07/2026',
 targetSlaDate: '14/07/2026',
 resolvedDate: '13/07/2026',
 resolutionNotes: 'Replaced moisture-damaged junction box & recalibrated load cells using certified 20-ton deadweights.',
 rootCause: 'Moisture ingress in junction box terminal housing due to heavy rain.',
 isRepetitiveDefect: true,
 repeatCountIn30Days: 2,
 csatRating: 5,
 warrantyStatus: 'AMC Contract'
 },
 {
 id: 'TKT-2026-002',
 ticketNumber: 'TKT-2026-002',
 customerName: 'Tata Steel Long Products',
 equipmentModel: 'MDI-WS-9000 Weighbridge System',
 equipmentSerial: 'EQ-9042',
 vertical: 'Service/Parts',
 complaintCategory: 'Load Cell Drift',
 complaintDescription: 'Repeat issue: Load cell reading again fluctuating on same Weighbridge EQ-9042 after heavy rainfall.',
 severity: 'Critical',
 status: 'Open',
 assignedTo: 'E-004',
 assignedToName: 'Priya Sharma',
 createdDate: '28/07/2026',
 targetSlaDate: '29/07/2026',
 resolvedDate: '',
 resolutionNotes: 'Inspection in progress. IP68 weather-sealed junction enclosure requested from spares warehouse.',
 rootCause: 'Inadequate seal design on cable entry glands for outdoor tropical exposure.',
 isRepetitiveDefect: true,
 repeatCountIn30Days: 2,
 csatRating: 0,
 warrantyStatus: 'AMC Contract'
 },
 {
 id: 'TKT-2026-003',
 ticketNumber: 'TKT-2026-003',
 customerName: 'JSW Steel Ltd',
 equipmentModel: 'MDI-CS-5000 Crane Scale',
 equipmentSerial: 'EQ-5011',
 vertical: 'Service/Parts',
 complaintCategory: 'Display Communication Failure',
 complaintDescription: 'Wireless handheld display losing RF link with crane scale transmitter above 15 meters height.',
 severity: 'Medium',
 status: 'In Progress',
 assignedTo: 'E-002',
 assignedToName: 'Murugan',
 createdDate: '20/07/2026',
 targetSlaDate: '25/07/2026',
 resolvedDate: '',
 resolutionNotes: 'High-gain RF antenna array mounted; testing telemetry response under high-EMI environment.',
 rootCause: 'Electromagnetic interference from nearby 11kV busbar ducting.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 0,
 warrantyStatus: 'Under Warranty'
 },
 {
 id: 'TKT-2026-004',
 ticketNumber: 'TKT-2026-004',
 customerName: 'Jindal Steels & Minerals',
 equipmentModel: 'MDI-LCS-2000 Dynamic Load Cell',
 equipmentSerial: 'EQ-2088',
 vertical: 'Service/Parts',
 complaintCategory: 'Scale Calibration Error',
 complaintDescription: 'Tare value auto-zeroing fails during batch weighing operation at Pellet Plant 1.',
 severity: 'High',
 status: 'Resolved',
 assignedTo: 'E-003',
 assignedToName: 'Rajesh Kumar',
 createdDate: '05/07/2026',
 targetSlaDate: '07/07/2026',
 resolvedDate: '06/07/2026',
 resolutionNotes: 'Updated firmware to Rev 4.2 with widened zero-tracking tolerance window and zero-point calibration.',
 rootCause: 'Firmware zero-tracking buffer overrun caused by vibration harmonics.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 4,
 warrantyStatus: 'Out of Warranty'
 },
 {
 id: 'TKT-2026-005',
 ticketNumber: 'TKT-2026-005',
 customerName: 'Jindal Steels & Minerals',
 equipmentModel: 'MDI-LCS-2000 Dynamic Load Cell',
 equipmentSerial: 'EQ-2088',
 vertical: 'Service/Parts',
 complaintCategory: 'Scale Calibration Error',
 complaintDescription: 'Repeat defect: Pellet Plant 1 Tare auto-zero error reoccurred on EQ-2088 within 20 days.',
 severity: 'Critical',
 status: 'Escalated',
 assignedTo: 'E-003',
 assignedToName: 'Rajesh Kumar',
 createdDate: '22/07/2026',
 targetSlaDate: '23/07/2026',
 resolvedDate: '',
 resolutionNotes: 'Senior engineering lead assigned for structural vibration dampening isolator retrofit.',
 rootCause: 'Mechanical mounting frame resonance at 48Hz causing sensor noise.',
 isRepetitiveDefect: true,
 repeatCountIn30Days: 2,
 csatRating: 0,
 warrantyStatus: 'Out of Warranty'
 },
 {
 id: 'TKT-2026-006',
 ticketNumber: 'TKT-2026-006',
 customerName: 'Vedanta Smelter Plant',
 equipmentModel: 'MDI-WS-9000 Weighbridge System',
 equipmentSerial: 'EQ-9102',
 vertical: 'Projects',
 complaintCategory: 'Power Supply Surge',
 complaintDescription: 'Digitizer terminal power supply unit blown following grid voltage spike.',
 severity: 'Medium',
 status: 'Pending Parts',
 assignedTo: 'E-005',
 assignedToName: 'Anil Mehta',
 createdDate: '25/07/2026',
 targetSlaDate: '30/07/2026',
 resolvedDate: '',
 resolutionNotes: 'Replacement 24V DC SMPS module dispatched from central store. Awaiting customer site clearance.',
 rootCause: 'External utility grid surge without localized isolation transformer.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 0,
 warrantyStatus: 'AMC Contract'
 },
 {
 id: 'TKT-2026-007',
 ticketNumber: 'TKT-2026-007',
 customerName: 'Godrej & Boyce Mfg Co',
 equipmentModel: 'MDI-CS-3000 Compact Scale',
 equipmentSerial: 'EQ-3045',
 vertical: 'Sales',
 complaintCategory: 'Software Sync Disruption',
 complaintDescription: 'ERP integration API fails to fetch weight tickets automatically.',
 severity: 'Low',
 status: 'Closed',
 assignedTo: 'E-004',
 assignedToName: 'Priya Sharma',
 createdDate: '01/06/2026',
 targetSlaDate: '05/06/2026',
 resolvedDate: '03/06/2026',
 resolutionNotes: 'Updated REST API token endpoint credentials and restored automated JSON weight export.',
 rootCause: 'Expired SSL certificate on client local proxy server.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 5,
 warrantyStatus: 'Under Warranty'
 },
 {
 id: 'TKT-2026-008',
 ticketNumber: 'TKT-2026-008',
 customerName: 'Ultratech Cement Works',
 equipmentModel: 'MDI-BS-7500 Belt Scale System',
 equipmentSerial: 'EQ-7012',
 vertical: 'Service/Parts',
 complaintCategory: 'Scale Calibration Error',
 complaintDescription: 'Totalizer counter skipping pulse counts during high conveyor belt speeds.',
 severity: 'High',
 status: 'In Progress',
 assignedTo: 'E-001',
 assignedToName: 'Kalyan Kumar',
 createdDate: '15/05/2026',
 targetSlaDate: '18/05/2026',
 resolvedDate: '',
 resolutionNotes: 'Aligning optical speed encoder and checking tachometer signal output.',
 rootCause: 'Misaligned tachometer encoder disk.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 0,
 warrantyStatus: 'AMC Contract'
 },
 
 {
 id: 'TKT-2025-088',
 ticketNumber: 'TKT-2025-088',
 customerName: 'BEML Mining Division',
 equipmentModel: 'MDI-WS-9000 Weighbridge System',
 equipmentSerial: 'EQ-9015',
 vertical: 'Service/Parts',
 complaintCategory: 'Hydraulic Sensor Leakage',
 complaintDescription: 'Oil dampener seal leaking fluid near pit axle assembly.',
 severity: 'High',
 status: 'Closed',
 assignedTo: 'E-004',
 assignedToName: 'Priya Sharma',
 createdDate: '15/11/2025',
 targetSlaDate: '18/11/2025',
 resolvedDate: '17/11/2025',
 resolutionNotes: 'Fitted heavy-duty Viton O-ring seals and topped up hydraulic dampening oil level.',
 rootCause: 'Wear and tear on rubber seals due to high ambient temperature exposure.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 5,
 warrantyStatus: 'AMC Contract'
 },
 {
 id: 'TKT-2025-072',
 ticketNumber: 'TKT-2025-072',
 customerName: 'SAIL Durgapur Steel Plant',
 equipmentModel: 'MDI-CS-5000 Crane Scale',
 equipmentSerial: 'EQ-5022',
 vertical: 'Service/Parts',
 complaintCategory: 'Display Communication Failure',
 complaintDescription: 'Screen flickering under extreme radiant heat near ladle furnace.',
 severity: 'Critical',
 status: 'Closed',
 assignedTo: 'E-002',
 assignedToName: 'Murugan',
 createdDate: '10/01/2026',
 targetSlaDate: '11/01/2026',
 resolvedDate: '11/01/2026',
 resolutionNotes: 'Installed heat radiation shield and upgraded LCD display module with high-temp glass.',
 rootCause: 'Thermal degradation of standard LCD polarizer sheet.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 5,
 warrantyStatus: 'Under Warranty'
 },
 {
 id: 'TKT-2025-055',
 ticketNumber: 'TKT-2025-055',
 customerName: 'Hindalco Industries',
 equipmentModel: 'MDI-LCS-2000 Dynamic Load Cell',
 equipmentSerial: 'EQ-2019',
 vertical: 'Service/Parts',
 complaintCategory: 'Load Cell Drift',
 complaintDescription: 'Non-linear load output curve under 50-ton heavy aluminum ingot weighing.',
 severity: 'High',
 status: 'Closed',
 assignedTo: 'E-003',
 assignedToName: 'Rajesh Kumar',
 createdDate: '18/08/2025',
 targetSlaDate: '20/08/2025',
 resolvedDate: '19/08/2025',
 resolutionNotes: 'Replaced strained flexure element and performed 5-point span calibration.',
 rootCause: 'Mechanical overload beyond 120% rating.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 4,
 warrantyStatus: 'AMC Contract'
 },
 {
 id: 'TKT-2025-041',
 ticketNumber: 'TKT-2025-041',
 customerName: 'Larsen & Toubro Heavy Eng',
 equipmentModel: 'MDI-BS-7500 Belt Scale System',
 equipmentSerial: 'EQ-7005',
 vertical: 'Projects',
 complaintCategory: 'Software Sync Disruption',
 complaintDescription: 'PLC Modbus TCP communication timeout error during batch dispensing.',
 severity: 'Medium',
 status: 'Closed',
 assignedTo: 'E-005',
 assignedToName: 'Anil Mehta',
 createdDate: '02/06/2025',
 targetSlaDate: '05/06/2025',
 resolvedDate: '04/06/2025',
 resolutionNotes: 'Reconfigured Modbus polling frequency and increased socket timeout value in firmware.',
 rootCause: 'Network congestion on plant local ethernet switch.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 5,
 warrantyStatus: 'Under Warranty'
 },
 {
 id: 'TKT-2025-030',
 ticketNumber: 'TKT-2025-030',
 customerName: 'Tata Steel Long Products',
 equipmentModel: 'MDI-WS-9000 Weighbridge System',
 equipmentSerial: 'EQ-9010',
 vertical: 'Service/Parts',
 complaintCategory: 'Power Supply Surge',
 complaintDescription: 'Main terminal control unit failing to power on after storm.',
 severity: 'High',
 status: 'Closed',
 assignedTo: 'E-004',
 assignedToName: 'Priya Sharma',
 createdDate: '14/04/2025',
 targetSlaDate: '16/04/2025',
 resolvedDate: '15/04/2025',
 resolutionNotes: 'Replaced fuse and surge protection device (SPD) block.',
 rootCause: 'Lightning strike voltage surge.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 4,
 warrantyStatus: 'AMC Contract'
 },
 {
 id: 'TKT-2025-022',
 ticketNumber: 'TKT-2025-022',
 customerName: 'Ultratech Cement Works',
 equipmentModel: 'MDI-CS-3000 Compact Scale',
 equipmentSerial: 'EQ-3022',
 vertical: 'Sales',
 complaintCategory: 'General Maintenance',
 complaintDescription: 'Routine 6-month accuracy verification and load sensor cleaning.',
 severity: 'Low',
 status: 'Closed',
 assignedTo: 'E-001',
 assignedToName: 'Kalyan Kumar',
 createdDate: '12/09/2025',
 targetSlaDate: '16/09/2025',
 resolvedDate: '14/09/2025',
 resolutionNotes: 'Cleaned scale platform pit, recalibrated zero reference, issued health report.',
 rootCause: 'Dust buildup under scale platter.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 5,
 warrantyStatus: 'Under Warranty'
 },
 {
 id: 'TKT-2025-015',
 ticketNumber: 'TKT-2025-015',
 customerName: 'JSW Steel Ltd',
 equipmentModel: 'MDI-LCS-2000 Dynamic Load Cell',
 equipmentSerial: 'EQ-2045',
 vertical: 'Service/Parts',
 complaintCategory: 'Load Cell Drift',
 complaintDescription: 'Cable shield insulation damaged causing grounding noise on channel 3.',
 severity: 'Medium',
 status: 'Closed',
 assignedTo: 'E-002',
 assignedToName: 'Murugan',
 createdDate: '20/07/2025',
 targetSlaDate: '23/07/2025',
 resolvedDate: '21/07/2025',
 resolutionNotes: 'Spliced high-flex copper shielded cable and re-grounded cable braid.',
 rootCause: 'Rodent damage on exposed cable tray.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 4,
 warrantyStatus: 'AMC Contract'
 },
 
 {
 id: 'TKT-2024-099',
 ticketNumber: 'TKT-2024-099',
 customerName: 'JSW Steel Ltd',
 equipmentModel: 'MDI-CS-3000 Compact Scale',
 equipmentSerial: 'EQ-3008',
 vertical: 'Service/Parts',
 complaintCategory: 'General Maintenance',
 complaintDescription: 'Annual stamping & verification calibration check required by Weights & Measures dept.',
 severity: 'Low',
 status: 'Closed',
 assignedTo: 'E-001',
 assignedToName: 'Kalyan Kumar',
 createdDate: '10/02/2025',
 targetSlaDate: '15/02/2025',
 resolvedDate: '12/02/2025',
 resolutionNotes: 'Completed official legal metrology stamping & issued verification certificate.',
 rootCause: 'Routine annual compliance audit.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 5,
 warrantyStatus: 'AMC Contract'
 },
 {
 id: 'TKT-2024-064',
 ticketNumber: 'TKT-2024-064',
 customerName: 'Vedanta Smelter Plant',
 equipmentModel: 'MDI-LCS-2000 Dynamic Load Cell',
 equipmentSerial: 'EQ-2004',
 vertical: 'Service/Parts',
 complaintCategory: 'Load Cell Drift',
 complaintDescription: 'Zero point drift of +40kg after continuous 24-hour operation.',
 severity: 'High',
 status: 'Closed',
 assignedTo: 'E-003',
 assignedToName: 'Rajesh Kumar',
 createdDate: '20/10/2024',
 targetSlaDate: '22/10/2024',
 resolvedDate: '21/10/2024',
 resolutionNotes: 'Re-zeroed tare and adjusted thermal compensation circuit resistors.',
 rootCause: 'Thermal expansion of mounting pedestal.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 4,
 warrantyStatus: 'Under Warranty'
 },
 {
 id: 'TKT-2024-035',
 ticketNumber: 'TKT-2024-035',
 customerName: 'BEML Mining Division',
 equipmentModel: 'MDI-BS-7500 Belt Scale System',
 equipmentSerial: 'EQ-7001',
 vertical: 'Service/Parts',
 complaintCategory: 'Scale Calibration Error',
 complaintDescription: 'Weight totalizer drifting by +2.5% against belt weigh scale standard.',
 severity: 'High',
 status: 'Closed',
 assignedTo: 'E-004',
 assignedToName: 'Priya Sharma',
 createdDate: '18/07/2024',
 targetSlaDate: '20/07/2024',
 resolvedDate: '19/07/2024',
 resolutionNotes: 'Performed test chain calibration run and updated K-factor in weight processor.',
 rootCause: 'Conveyor belt tension change due to mechanical belt splice replacement.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 5,
 warrantyStatus: 'AMC Contract'
 },
 {
 id: 'TKT-2024-012',
 ticketNumber: 'TKT-2024-012',
 customerName: 'Godrej & Boyce Mfg Co',
 equipmentModel: 'MDI-WS-9000 Weighbridge System',
 equipmentSerial: 'EQ-9001',
 vertical: 'Sales',
 complaintCategory: 'Display Communication Failure',
 complaintDescription: 'RS232 serial cable severed by forklift movement.',
 severity: 'Medium',
 status: 'Closed',
 assignedTo: 'E-004',
 assignedToName: 'Priya Sharma',
 createdDate: '05/05/2024',
 targetSlaDate: '08/05/2024',
 resolvedDate: '06/05/2024',
 resolutionNotes: 'Laid armored shielded RS232 cable with heavy-duty conduit protection.',
 rootCause: 'Physical damage to unprotected cable line.',
 isRepetitiveDefect: false,
 repeatCountIn30Days: 1,
 csatRating: 5,
 warrantyStatus: 'Under Warranty'
 }
 ]));
 }
 var existingQuotes = [];
 try { existingQuotes = JSON.parse(localStorage.getItem('quotations') || '[]'); } catch(e) {}
 if (!existingQuotes || existingQuotes.length === 0) {
 localStorage.setItem('quotations', JSON.stringify([
 {
 id: 'QT-2026-001-R1',
 quoteNumber: 'QT-2026-001',
 revision: 1,
 parentQuoteId: null,
 leadId: 'LD-2026-001',
 customerName: 'L&T Construction Equipment Division',
 contactPerson: 'Mr. S. K. Raman',
 email: 'skraman@lnt.com',
 mobile: '9840112233',
 address: 'Mount Poonamallee Road, Manapakkam, Chennai - 600089',
 vertical: 'Equipment Sales',
 employeeId: 'E-002',
 employeeName: 'Mr. Murugan V',
 createdDate: '02/08/2026',
 validityDays: 30,
 expiryDate: '01/09/2026',
 financialYear: '2026-27',
 items: [
 {
 itemId: 'ITEM-101',
 description: 'Measure DI Heavy-Duty 100T Digital Weighbridge System',
 hsnCode: '842389',
 qty: 1,
 unitPrice: 1200000,
 lineDiscountPercent: 10,
 taxPercent: 18,
 lineSubtotal: 1080000,
 lineTax: 194400,
 lineTotal: 1274400
 },
 {
 itemId: 'ITEM-102',
 description: 'Installation, Calibration & Legal Metrology Stamping',
 hsnCode: '998719',
 qty: 1,
 unitPrice: 150000,
 lineDiscountPercent: 0,
 taxPercent: 18,
 lineSubtotal: 150000,
 lineTax: 27000,
 lineTotal: 177000
 }
 ],
 grossSubtotal: 1350000,
 overallDiscountPercent: 8.89,
 overallDiscountAmount: 120000,
 netSubtotal: 1230000,
 taxAmount: 221400,
 grandTotal: 1451400,
 approvalThreshold: 15,
 requiredApproverRole: 'none',
 status: 'Approved',
 approvalHistory: [
 {
 approverId: 'E-002',
 approverName: 'Mr. Murugan V',
 approverRole: 'admin',
 action: 'Auto-Approved',
 timestamp: '02/08/2026 11:15 AM',
 remarks: 'Discount of 8.89% is within standard rep threshold (<=15%). Auto-approved.'
 }
 ],
 termsAndConditions: '1. 50% advance along with Purchase Order.\n2. 40% against dispatch inspection.\n3. 10% post commissioning.\n4. Price inclusive of 1-year warranty.',
 convertedOrderId: null
 },
 {
 id: 'QT-2026-002-R1',
 quoteNumber: 'QT-2026-002',
 revision: 1,
 parentQuoteId: null,
 leadId: 'LD-2026-002',
 customerName: 'TATA Steel Project & Infrastructure',
 contactPerson: 'Mr. Rajesh Verma',
 email: 'rverma@tatasteel.com',
 mobile: '9840223344',
 address: 'Kalinganagar Industrial Complex, Odisha',
 vertical: 'Steel Projects',
 employeeId: 'E-002',
 employeeName: 'Mr. Murugan V',
 createdDate: '08/08/2026',
 validityDays: 30,
 expiryDate: '07/09/2026',
 financialYear: '2026-27',
 items: [
 {
 itemId: 'ITEM-201',
 description: 'Custom Automation Sensor Skid Assembly with PLC Panel',
 hsnCode: '842390',
 qty: 2,
 unitPrice: 1800000,
 lineDiscountPercent: 20,
 taxPercent: 18,
 lineSubtotal: 2880000,
 lineTax: 518400,
 lineTotal: 3398400
 }
 ],
 grossSubtotal: 3600000,
 overallDiscountPercent: 20,
 overallDiscountAmount: 720000,
 netSubtotal: 2880000,
 taxAmount: 518400,
 grandTotal: 3398400,
 approvalThreshold: 15,
 requiredApproverRole: 'admin',
 status: 'Pending Approval',
 approvalHistory: [
 {
 approverId: 'E-002',
 approverName: 'Mr. Murugan V',
 approverRole: 'staff',
 action: 'Submitted for Approval',
 timestamp: '08/08/2026 02:45 PM',
 remarks: '20% discount requested to match competitive tender bid from Avery Weightronix.'
 }
 ],
 termsAndConditions: '1. 40% advance along with PO.\n2. 50% against delivery at site.\n3. 10% after successful commissioning.',
 convertedOrderId: null
 },
 {
 id: 'QT-2026-003-R1',
 quoteNumber: 'QT-2026-003',
 revision: 1,
 parentQuoteId: null,
 leadId: 'LD-2026-003',
 customerName: 'Hyundai Motor India Plant Phase 2',
 contactPerson: 'Mr. K. Seung',
 email: 'kseung@hyundai-india.com',
 mobile: '9840334455',
 address: 'SIPCOT Industrial Park, Irrungattukottai, Sriperumbudur',
 vertical: 'Equipment Sales',
 employeeId: 'E-003',
 employeeName: 'Mrs. Anitha',
 createdDate: '10/08/2026',
 validityDays: 30,
 expiryDate: '09/09/2026',
 financialYear: '2026-27',
 items: [
 {
 itemId: 'ITEM-301',
 description: 'High-Speed Automated Industrial Checkweigher Unit',
 hsnCode: '842381',
 qty: 1,
 unitPrice: 2500000,
 lineDiscountPercent: 28,
 taxPercent: 18,
 lineSubtotal: 1800000,
 lineTax: 324000,
 lineTotal: 2124000
 }
 ],
 grossSubtotal: 2500000,
 overallDiscountPercent: 28,
 overallDiscountAmount: 700000,
 netSubtotal: 1800000,
 taxAmount: 324000,
 grandTotal: 2124000,
 approvalThreshold: 25,
 requiredApproverRole: 'super_admin',
 status: 'Pending Approval',
 approvalHistory: [
 {
 approverId: 'E-003',
 approverName: 'Mrs. Anitha',
 approverRole: 'admin',
 action: 'Submitted for Executive Approval',
 timestamp: '10/08/2026 04:20 PM',
 remarks: '28% heavy discount requested for strategic entry into Hyundai Automotive line. Escalated to MD (Mr. Ravichandran).'
 }
 ],
 termsAndConditions: '1. 30% advance along with PO.\n2. 60% against dispatch.\n3. 10% after 30-day trial run.',
 convertedOrderId: null
 },
 {
 id: 'QT-2026-004-R2',
 quoteNumber: 'QT-2026-004',
 revision: 2,
 parentQuoteId: 'QT-2026-004-R1',
 leadId: 'LD-2026-004',
 customerName: 'Godrej & Boyce Manufacturing Co',
 contactPerson: 'Mr. V. Anand',
 email: 'vanand@godrej.com',
 mobile: '9840445566',
 address: 'Pirojshanagar, Vikhroli, Mumbai - 400079',
 vertical: 'Service',
 employeeId: 'E-004',
 employeeName: 'Mrs. Subhashini',
 createdDate: '05/08/2026',
 validityDays: 30,
 expiryDate: '04/09/2026',
 financialYear: '2026-27',
 items: [
 {
 itemId: 'ITEM-401',
 description: 'Annual Comprehensive Calibration & Maintenance Contract (AMC)',
 hsnCode: '998719',
 qty: 1,
 unitPrice: 450000,
 lineDiscountPercent: 12,
 taxPercent: 18,
 lineSubtotal: 396000,
 lineTax: 71280,
 lineTotal: 467280
 }
 ],
 grossSubtotal: 450000,
 overallDiscountPercent: 12,
 overallDiscountAmount: 54000,
 netSubtotal: 396000,
 taxAmount: 71280,
 grandTotal: 467280,
 approvalThreshold: 15,
 requiredApproverRole: 'none',
 status: 'Sent to Customer',
 approvalHistory: [
 {
 approverId: 'E-004',
 approverName: 'Mrs. Subhashini',
 approverRole: 'manager',
 action: 'Revision Created & Approved',
 timestamp: '05/08/2026 03:10 PM',
 remarks: 'Revision 2 generated with updated maintenance scope and 12% discount.'
 }
 ],
 termsAndConditions: '1. 100% payment annually in advance.\n2. Quarterly scheduled preventive maintenance visits included.',
 convertedOrderId: null
 },
 {
 id: 'QT-2026-005-R1',
 quoteNumber: 'QT-2026-005',
 revision: 1,
 parentQuoteId: null,
 leadId: 'LD-2026-005',
 customerName: 'Saint-Gobain Glass India',
 contactPerson: 'Mr. N. Sundaram',
 email: 'nsundaram@saint-gobain.com',
 mobile: '9840556677',
 address: 'SIPCOT Industrial Park, Sriperumbudur',
 vertical: 'Equipment Sales',
 employeeId: 'E-005',
 employeeName: 'Ms. Dipa',
 createdDate: '01/08/2026',
 validityDays: 30,
 expiryDate: '31/08/2026',
 financialYear: '2026-27',
 items: [
 {
 itemId: 'ITEM-501',
 description: 'Precision Load Cell Array - 50T Load Capacity',
 hsnCode: '842390',
 qty: 4,
 unitPrice: 212500,
 lineDiscountPercent: 15,
 taxPercent: 18,
 lineSubtotal: 722500,
 lineTax: 130050,
 lineTotal: 852550
 }
 ],
 grossSubtotal: 850000,
 overallDiscountPercent: 15,
 overallDiscountAmount: 127500,
 netSubtotal: 722500,
 taxAmount: 130050,
 grandTotal: 852550,
 approvalThreshold: 15,
 requiredApproverRole: 'none',
 status: 'Converted to Order',
 approvalHistory: [
 {
 approverId: 'E-002',
 approverName: 'Mr. Murugan V',
 approverRole: 'admin',
 action: 'Approved & Converted',
 timestamp: '01/08/2026 05:00 PM',
 remarks: 'Quote accepted by customer and converted to Sales Order ORD-2026-088.'
 }
 ],
 termsAndConditions: '1. 50% advance, 50% on delivery.\n2. Warranty: 12 months from installation.',
 convertedOrderId: 'ORD-2026-088'
 }
 ]));
 }
 if (!localStorage.getItem('clientsMaster') || JSON.parse(localStorage.getItem('clientsMaster') || '[]').length === 0) {
 localStorage.setItem('clientsMaster', JSON.stringify([
 {
 id: 'client_1',
 clientCode: 'CL-001',
 clientName: 'JSW Steel Limited',
 gstin: '29AAACJ1011A1Z2',
 contactPerson: 'Mr. Raghunath Verma',
 email: 'r.verma@jsw.in',
 phone: '9840112233',
 address: 'Toranagallu Slag Yard, Vidyanagar',
 city: 'Ballari',
 state: 'Karnataka',
 vertical: 'Sales',
 creditPeriodDays: 30,
 accountManagerId: 'E-002',
 accountManagerName: 'Mr. Murugan V',
 isActive: true
 },
 {
 id: 'client_2',
 clientCode: 'CL-002',
 clientName: 'Tata Steel Limited',
 gstin: '20AAACT2702H1ZQ',
 contactPerson: 'Mr. Amitav Sen',
 email: 'amitav.sen@tatasteel.com',
 phone: '9840223344',
 address: 'Jamshedpur Steel Works',
 city: 'Jamshedpur',
 state: 'Jharkhand',
 vertical: 'Projects',
 creditPeriodDays: 45,
 accountManagerId: 'E-003',
 accountManagerName: 'Mrs. Anitha',
 isActive: true
 },
 {
 id: 'client_3',
 clientCode: 'CL-003',
 clientName: 'UltraTech Cement Ltd',
 gstin: '27AAACU0147L1ZF',
 contactPerson: 'Mr. Suresh Pillai',
 email: 'suresh.p@ultratech.adityabirla.com',
 phone: '9840334455',
 address: 'Awarpur Cement Works',
 city: 'Chandrapur',
 state: 'Maharashtra',
 vertical: 'Service/Parts',
 creditPeriodDays: 30,
 accountManagerId: 'E-005',
 accountManagerName: 'Ms. Dipa',
 isActive: true
 },
 {
 id: 'client_4',
 clientCode: 'CL-004',
 clientName: 'Bharat Heavy Electricals (BHEL)',
 gstin: '33AAACB1234A1Z5',
 contactPerson: 'Mr. K. Natarajan',
 email: 'natarajan@bhel.in',
 phone: '9840445566',
 address: 'Boiler Plant HPBP Complex',
 city: 'Trichy',
 state: 'Tamil Nadu',
 vertical: 'Projects',
 creditPeriodDays: 60,
 accountManagerId: 'E-001',
 accountManagerName: 'Mr. Ravichandran',
 isActive: true
 },
 {
 id: 'client_5',
 clientCode: 'CL-005',
 clientName: 'Saint-Gobain India Private Limited',
 gstin: '33AAACS1234C1Z8',
 contactPerson: 'Mr. Ramesh Krishnan',
 email: 'ramesh.k@saint-gobain.com',
 phone: '9840556677',
 address: 'World Glass Complex, SIPCOT Industrial Park',
 city: 'Sriperumbudur',
 state: 'Tamil Nadu',
 vertical: 'Sales',
 creditPeriodDays: 30,
 accountManagerId: 'E-002',
 accountManagerName: 'Mr. Murugan V',
 isActive: true
 }
 ]));
 }
 if (!localStorage.getItem('sparePartsMaster') || JSON.parse(localStorage.getItem('sparePartsMaster') || '[]').length === 0) {
 localStorage.setItem('sparePartsMaster', JSON.stringify([
 {
 id: 'sp_1',
 partNumber: 'SP-LC-50T',
 partName: 'High Precision 50-Ton Shear Beam Load Cell (IP68)',
 category: 'Load Cells & Transducers',
 compatibleModel: 'Crane Scales CS-50T / CS-30T',
 hsnCode: '90318000',
 unitPrice: 45000,
 gstPercent: 18,
 uom: 'Nos',
 stockQty: 24,
 minReorderLevel: 5,
 leadTimeDays: 7,
 isActive: true
 },
 {
 id: 'sp_2',
 partNumber: 'SP-ENC-1000',
 partName: 'Optical Rotary Encoder 1000 PPR Stainless Steel',
 category: 'Sensors & Encoders',
 compatibleModel: 'In-Motion Rail Weighers IMW-200',
 hsnCode: '90319000',
 unitPrice: 18500,
 gstPercent: 18,
 uom: 'Nos',
 stockQty: 40,
 minReorderLevel: 10,
 leadTimeDays: 5,
 isActive: true
 },
 {
 id: 'sp_3',
 partNumber: 'SP-DISP-7S',
 partName: 'Industrial High-Brightness 6-Digit LED Display Indicator',
 category: 'Displays & Terminals',
 compatibleModel: 'Universal (All Measure DI Weighers)',
 hsnCode: '85285900',
 unitPrice: 28000,
 gstPercent: 18,
 uom: 'Nos',
 stockQty: 18,
 minReorderLevel: 4,
 leadTimeDays: 10,
 isActive: true
 },
 {
 id: 'sp_4',
 partNumber: 'SP-JB-04IP',
 partName: 'IP68 Stainless Steel 4-Channel Analog Junction Box',
 category: 'Junction Boxes & Wiring',
 compatibleModel: 'Weighbridges & Hoppers WB-100',
 hsnCode: '85369090',
 unitPrice: 6500,
 gstPercent: 18,
 uom: 'Nos',
 stockQty: 55,
 minReorderLevel: 15,
 leadTimeDays: 3,
 isActive: true
 },
 {
 id: 'sp_5',
 partNumber: 'SP-LAS-SCAN',
 partName: 'High-Speed Multi-Line Laser Surface Profiler Head',
 category: 'Optical Metrology',
 compatibleModel: 'Laser Scanners LS-200',
 hsnCode: '90314900',
 unitPrice: 145000,
 gstPercent: 18,
 uom: 'Sets',
 stockQty: 8,
 minReorderLevel: 2,
 leadTimeDays: 21,
 isActive: true
 },
 {
 id: 'sp_6',
 partNumber: 'SP-CAL-20T',
 partName: 'Certified Class M1 20-Ton Heavy Calibration Test Block',
 category: 'Calibration Standards',
 compatibleModel: 'Heavy Crane & Pitless Weighbridge',
 hsnCode: '90319000',
 unitPrice: 85000,
 gstPercent: 18,
 uom: 'Nos',
 stockQty: 6,
 minReorderLevel: 1,
 leadTimeDays: 14,
 isActive: true
 }
 ]));
 }
 if (!localStorage.getItem('bankDetailsMaster') || JSON.parse(localStorage.getItem('bankDetailsMaster') || '[]').length === 0) {
 localStorage.setItem('bankDetailsMaster', JSON.stringify([
 {
 id: 'bank_1',
 bankName: 'HDFC Bank',
 branch: 'Guindy Industrial Estate, Chennai - 600032',
 accountNumber: '50200049283719',
 ifscCode: 'HDFC0000123',
 accountType: 'Current Account',
 beneficiaryName: 'MEASURE DI TECHNOLOGIES PRIVATE LIMITED',
 upiId: 'measuredi@hdfcbank',
 swiftCode: 'HDFCINBBCHE',
 isActive: true
 },
 {
 id: 'bank_2',
 bankName: 'State Bank of India (SBI)',
 branch: 'Industrial Complex Branch, Guindy, Chennai - 600032',
 accountNumber: '39281726351',
 ifscCode: 'SBIN0001824',
 accountType: 'Current Account',
 beneficiaryName: 'MEASURE DI TECHNOLOGIES PRIVATE LIMITED',
 upiId: 'measuredi@sbi',
 swiftCode: 'SBININBB443',
 isActive: true
 },
 {
 id: 'bank_3',
 bankName: 'ICICI Bank',
 branch: 'Nungambakkam High Road Branch, Chennai - 600034',
 accountNumber: '000905034821',
 ifscCode: 'ICIC0000009',
 accountType: 'Current Account',
 beneficiaryName: 'MEASURE DI TECHNOLOGIES PRIVATE LIMITED',
 upiId: 'measuredi@icici',
 swiftCode: 'ICICINBBCTS',
 isActive: true
 }
 ]));
 }
 localStorage.setItem('revops_seeded_v25', 'true');
 localStorage.setItem('revops_seeded_v27', 'true');
 }
};
if (typeof window !== "undefined") {
 window.RevOpsStore = window.RevOpsStore || {};
 if (typeof window.RevOpsStore.initSeedData === "function") {
 window.RevOpsStore.initSeedData();
 }
 if (typeof document !== "undefined") {
 document.addEventListener('DOMContentLoaded', function() {
 if (window.RevOpsStore && typeof window.RevOpsStore.initSeedData === "function") {
 window.RevOpsStore.initSeedData();
 }
 setTimeout(function() {
 if (window.RevOpsStore && window.RevOpsStore.initSync) window.RevOpsStore.initSync();
 }, 300);
 });
 }
}
