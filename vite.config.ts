import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

function netlifyFunctionsDevPlugin() {
  return {
    name: 'netlify-functions-dev',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url?.startsWith('/.netlify/functions/reset-password')) {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const { handler } = await import('./netlify/functions/reset-password.js');
              const event = {
                httpMethod: req.method,
                headers: req.headers,
                body: body
              };
              const result = await handler(event);
              res.statusCode = result.statusCode || 200;
              if (result.headers) {
                for (const [key, value] of Object.entries(result.headers)) {
                  res.setHeader(key, value as string);
                }
              }
              res.end(result.body);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || String(err) }));
            }
          });
          return;
        }

        if (req.url?.startsWith('/.netlify/functions/send-email') || req.url?.startsWith('/api/send-email')) {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const { handler } = await import('./netlify/functions/send-email.js');
              const event = {
                httpMethod: req.method,
                headers: req.headers,
                body: body
              };
              const result = await handler(event);
              res.statusCode = result.statusCode || 200;
              if (result.headers) {
                for (const [key, value] of Object.entries(result.headers)) {
                  res.setHeader(key, value as string);
                }
              }
              res.end(result.body);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.FIREBASE_SERVICE_ACCOUNT_KEY && !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  }

  return {
    plugins: [react(), tailwindcss(), netlifyFunctionsDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          login: path.resolve(__dirname, 'login.html'),
          dashboard: path.resolve(__dirname, 'dashboard.html'),
          myScorecard: path.resolve(__dirname, 'my-scorecard.html'),
          employees: path.resolve(__dirname, 'employees.html'),
          kraTargets: path.resolve(__dirname, 'kra-targets.html'),
          aopTargets: path.resolve(__dirname, 'aop-targets.html'),
          leads: path.resolve(__dirname, 'leads.html'),
          quotations: path.resolve(__dirname, 'quotations.html'),
          orders: path.resolve(__dirname, 'orders.html'),
          payments: path.resolve(__dirname, 'payments.html'),
          dwm: path.resolve(__dirname, 'dwm.html'),
          attendance: path.resolve(__dirname, 'attendance.html'),
          myTeam: path.resolve(__dirname, 'my-team.html'),
          reviews: path.resolve(__dirname, 'reviews.html'),
          reports: path.resolve(__dirname, 'reports.html'),
          userGuide: path.resolve(__dirname, 'user-guide.html'),
          expenses: path.resolve(__dirname, 'expenses.html'),
          payroll: path.resolve(__dirname, 'payroll.html'),
          serviceTickets: path.resolve(__dirname, 'service-tickets.html'),
          serviceLeads: path.resolve(__dirname, 'service-leads.html'),
          amcContracts: path.resolve(__dirname, 'amc-contracts.html'),
          amcQuotes: path.resolve(__dirname, 'amc-quotes.html'),
          amcOrders: path.resolve(__dirname, 'amc-orders.html'),
          amcInvoices: path.resolve(__dirname, 'amc-invoices.html'),
          partsSales: path.resolve(__dirname, 'parts-sales.html'),
          warrantyManagement: path.resolve(__dirname, 'warranty-management.html'),
          auditLogs: path.resolve(__dirname, 'audit-logs.html'),
          invoices: path.resolve(__dirname, 'invoices.html'),
          masterData: path.resolve(__dirname, 'master-data.html'),
          sop: path.resolve(__dirname, 'sop.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
