# Publishing and Deployment Guide

This guide outlines how to host your Job Leads web application on the internet so customers can purchase and download your compiled list of jobs.

---

## 1. Hosting Options (Node.js + Express Backend)

Because your website uses a Node.js backend (to securely parse the CSV and serve file downloads), you cannot use static-only hosts like GitHub Pages or Vercel unless you split the project. 

The easiest options to host your unified Node.js application are:

### Option A: Render (Recommended - Free & Easy)
Render is a cloud hosting platform with a generous free tier that integrates directly with GitHub.
1. Create a free account at [render.com](https://render.com).
2. Create a new **Web Service**.
3. Connect your GitHub repository containing the scraper and `web_app` directory.
4. Set the following configuration settings:
   - **Root Directory**: `web_app`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **Deploy**. Render will host your site on a free `onrender.com` subdomain!

### Option B: Railway (Very Fast & Developer Friendly)
1. Sign up at [railway.app](https://railway.app).
2. Select **New Project** and connect your GitHub repo.
3. Railway automatically detects the Node.js project and deploys it.
4. Go to settings and click **Generate Domain** to get a public URL.

---

## 2. Setting Up Real Payments (Stripe SDK Integration)

Currently, the web app uses a **Mock Stripe Checkout** which processes payments on a simulation screen. To start accepting real money from real credit cards, follow these steps:

### Step 1: Install Stripe SDK
In your terminal, navigate to the `web_app` folder and install Stripe:
```cmd
npm install stripe
```

### Step 2: Get Stripe API Keys
1. Create a free account at [stripe.com](https://stripe.com).
2. Go to your **Developers Dashboard** and toggled "Test Mode" on.
3. Retrieve your **Secret Key** (`sk_test_...`) and **Publishable Key** (`pk_test_...`).

### Step 3: Replace Mock Endpoint with Stripe API
Modify the `/api/checkout` route in [`server.js`](file:///C:/Users/Ayush/.gemini/antigravity/scratch/job_leads_scraper/web_app/server.js) to create a real Stripe Checkout Session:
```javascript
const stripe = require('stripe')('YOUR_STRIPE_SECRET_KEY');

app.post('/api/checkout-session', async (req, res) => {
  const { plan } = req.body;
  const priceId = plan === 'single' ? 'YOUR_STRIPE_5_DOLLAR_PRICE_ID' : 'YOUR_STRIPE_12_DOLLAR_PRICE_ID';
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: plan === 'single' ? 'payment' : 'subscription',
      success_url: `https://yourdomain.com/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://yourdomain.com/`,
    });
    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## 3. Running Scrapers in Production

When hosted on the cloud, your local `job_leads.csv` needs to update automatically. You can do this in two ways:

1. **GitHub Actions Cron (Recommended)**: Set up a free GitHub Action that runs `scraper.py` every day at 11:00 AM, commits the updated `job_leads.csv` back to your repository, which automatically triggers a re-deployment on Render!
2. **Server Cron Job**: If you use a VPS (like DigitalOcean), you can configure a standard cron job on the Linux server directly to run `python scraper.py` every morning at 11:00 AM.
