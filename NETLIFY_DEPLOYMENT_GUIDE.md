# Netlify & GitHub Deployment Guide: K-30_ERP

**Project Name**: `K-30_ERP`  
**Target Netlify URL**: `https://k-30-erp.netlify.app`  
**Configured Admin Account**: `measuredichennai@gmail.com`

---

## 1. Setting / Changing the Name on GitHub

To name or rename your repository as **`K-30_ERP`** on GitHub:

1. Open your repository on [GitHub](https://github.com).
2. Click on the **Settings** tab (the gear icon near the top right of the repo).
3. Under the **General** section, find **Repository name**.
4. Enter **`K-30_ERP`** (or `k-30-erp`).
5. Click **Rename**.
6. GitHub will automatically handle redirecting old git remote URLs to the new repository name.

---

## 2. Setting / Changing the Name on Netlify

To name or rename your Netlify site as **`K-30_ERP`**:

1. Log in to your [Netlify Dashboard](https://app.netlify.com) using `measuredichennai@gmail.com`.
2. Select your site.
3. Go to **Site configuration** -> **General** -> **Site details**.
4. Click **Change site name**.
5. Type **`k-30-erp`** (Netlify subdomains accept lowercase letters, numbers, and hyphens).
6. Click **Save**.
7. Your app will immediately be live at: **`https://k-30-erp.netlify.app`**

---

## 3. Build & Deployment Settings

- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Functions Directory**: `netlify/functions`
- **Node.js Version**: `20.x`
- **Configuration File**: `netlify.toml` (included in repository root)

---

## 4. Deployment Methods

### Option A: Automatic CI/CD with GitHub (Recommended)
1. In Netlify, click **"Add new site"** -> **"Import an existing project"**.
2. Connect to GitHub and select repository **`K-30_ERP`**.
3. Build settings will auto-populate from `netlify.toml`.
4. Click **Deploy K-30_ERP**. Every git push will automatically build and deploy the latest version.

### Option B: Direct Drag-and-Drop Deploy
1. Run `npm run build` to generate the `dist` folder.
2. Go to [https://app.netlify.com/drop](https://app.netlify.com/drop).
3. Drag and drop the `dist` folder directly onto the upload zone.
