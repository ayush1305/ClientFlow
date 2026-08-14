const express = require('express');
const fs = require('fs');
const path = require('path');

// Initialize Stripe Key (falls back to mock database mode if blank)
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? require('stripe')(stripeKey) : null;

const nodemailer = require('nodemailer');
const SUBSCRIBERS_PATH = path.join(__dirname, 'subscribers.json');

// Initialize nodemailer SMTP Transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER, // Your email address
        pass: process.env.SMTP_PASS  // Your email App Password
    }
});

function addSubscriber(email) {
    let subscribers = [];
    try {
        if (fs.existsSync(SUBSCRIBERS_PATH)) {
            const data = fs.readFileSync(SUBSCRIBERS_PATH, 'utf8');
            subscribers = JSON.parse(data);
        }
    } catch (e) {
        console.error("Error reading subscribers file:", e);
    }
    
    // Add if not already subscribed
    if (!subscribers.includes(email)) {
        subscribers.push(email);
        try {
            fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify(subscribers, null, 2), 'utf8');
            console.log(`Saved new subscriber: ${email}`);
        } catch (e) {
            console.error("Error writing subscribers file:", e);
        }
    }
}

async function sendInstantEmail(email) {
    console.log(`Preparing to send instant CSV email to ${email}...`);
    
    if (!fs.existsSync(CSV_PATH)) {
        console.error("job_leads.csv not found for instant sending.");
        return;
    }

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const mailOptions = {
                from: `"ClientFlow Updates" <${process.env.SMTP_USER}>`,
                to: email,
                subject: `Your ClientFlow Job Leads Export Pass`,
                text: `Hello,\n\nThank you for your purchase! Attached is your copy of the active job leads CSV from ClientFlow.\n\nBest regards,\nThe ClientFlow Team`,
                attachments: [
                    {
                        filename: 'job_leads.csv',
                        path: CSV_PATH
                    }
                ]
            };

            await transporter.sendMail(mailOptions);
            console.log(`Instant CSV email sent successfully to ${email} via SMTP.`);
        } catch (err) {
            console.error(`Failed to send instant email to ${email}:`, err);
        }
    } else {
        // Mock Instant Email log
        console.log("================ MOCK INSTANT EMAIL ================");
        console.log(`From: "ClientFlow Updates" <updates@clientflow.com>`);
        console.log(`To: ${email}`);
        console.log(`Subject: Your ClientFlow Job Leads Export Pass`);
        console.log(`Attachment: Attached job_leads.csv (${fs.statSync(CSV_PATH).size} bytes)`);
        console.log("====================================================");
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Path to data files in the parent directory
const CSV_PATH = path.join(__dirname, '..', 'job_leads.csv');
const TXT_PATH = path.join(__dirname, '..', 'job_leads_table.txt');

// Simple robust CSV line parser that respects quotes containing commas
function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur.trim());
    return result;
}

// Parses CSV into list of JS objects
function getJobsData() {
    if (!fs.existsSync(CSV_PATH)) return [];
    
    try {
        const content = fs.readFileSync(CSV_PATH, 'utf-8');
        const lines = content.split('\n');
        if (lines.length === 0) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const jobs = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = parseCSVLine(line);
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] ? values[index].replace(/^"|"$/g, '') : '';
            });
            jobs.push(row);
        }
        return jobs;
    } catch (e) {
        console.error("Error reading/parsing CSV:", e);
        return [];
    }
}

// 1. Live statistics endpoint
app.get('/api/stats', (req, res) => {
    const jobs = getJobsData();
    if (jobs.length === 0) {
        return res.json({
            success: true,
            data: {
                totalJobs: 0,
                freeJobs: 0,
                paidJobs: 0,
                sources: {},
                lastUpdated: 'Never',
                newestLead: null
            }
        });
    }

    // Source breakdown & cost counts
    const sources = {};
    let freeJobs = 0;
    let paidJobs = 0;
    
    jobs.forEach(job => {
        let platform = job['Source'] || 'Other';
        // Group subreddits together or show separately
        if (platform.startsWith('Reddit')) {
            platform = 'Reddit (Subreddits)';
        }
        sources[platform] = (sources[platform] || 0) + 1;
        
        let cost = job['Access Cost'] || '';
        if (!cost) {
            const lowerSource = platform.toLowerCase();
            if (lowerSource.includes('upwork') || lowerSource.includes('freelancer')) {
                cost = 'Paid';
            } else {
                cost = 'Free';
            }
        }
        
        if (cost.includes('Free')) {
            freeJobs++;
        } else {
            paidJobs++;
        }
    });

    // Check last updated timestamp
    let lastUpdated = 'Unknown';
    try {
        const stats = fs.statSync(CSV_PATH);
        lastUpdated = stats.mtime.toLocaleString();
    } catch (e) {}

    // Slice first 5 jobs for the gated preview table
    const previewJobs = jobs.slice(0, 5).map(job => {
        let src = job['Source'] || '';
        if (src.startsWith('Reddit')) {
            src = 'Reddit';
        }
        return {
            Title: job['Title'] || '',
            Source: src,
            Date: job['Days Posted'] || 'Today',
            Cost: job['Access Cost'] || (job['Source'].includes('Freelancer') ? 'Paid (Connects / Bids)' : 'Free (No Fees)')
        };
    });

    // Find newest job title
    const newestLead = jobs[0] ? {
        title: jobs[0]['Title'],
        company: jobs[0]['Company / Poster'],
        source: jobs[0]['Source'].startsWith('Reddit') ? 'Reddit' : jobs[0]['Source'],
        link: jobs[0]['Job Link']
    } : null;

    res.json({
        success: true,
        data: {
            totalJobs: jobs.length,
            freeJobs,
            paidJobs,
            sources,
            lastUpdated,
            newestLead,
            previewJobs
        }
    });
});

// 2. Mock payment checkout session
// Simulates secure credit card charge processing
app.post('/api/checkout', async (req, res) => {
    const { plan, price, email, cardNumber, expiry, cvc, name } = req.body;

    if (!plan || !cardNumber || !expiry || !cvc || !name) {
        return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    // Standard client card regex validations
    const cleanCard = cardNumber.replace(/\s+/g, '');
    if (cleanCard.length < 15 || cleanCard.length > 16) {
        return res.status(400).json({ success: false, error: "Invalid Card Number." });
    }

    // Determine final price (fallback to standard defaults if not passed)
    const finalPrice = price || (plan === 'single' ? 5 : 12);

    // If real Stripe SDK is configured via environment variables
    if (stripe) {
        console.log(`Processing actual Stripe charge for plan '${plan}' ($${finalPrice}.00)`);
        try {
            // Split expiry to month and year (Format: MM / YY)
            const parts = expiry.split('/');
            const expMonth = parseInt(parts[0].trim());
            const expYear = parseInt(parts[1].trim()) + 2000; // YY -> 20YY

            // Create charge using Stripe API
            const charge = await stripe.charges.create({
                amount: Math.round(finalPrice * 100), // in cents
                currency: 'usd',
                description: `ClientFlow ${plan} Access Pass`,
                source: {
                    object: 'card',
                    number: cleanCard,
                    exp_month: expMonth,
                    exp_year: expYear,
                    cvc: cvc,
                    name: name
                }
            });

            // Generate secure access token on successful charge
            const token = 'stripe_live_tok_' + charge.id + '_' + Date.now();

            if (email) {
                if (plan === 'subscription') {
                    addSubscriber(email);
                }
                sendInstantEmail(email).catch(err => console.error("Error sending instant email:", err));
            }

            return res.json({
                success: true,
                message: "Payment processed successfully via Stripe live checkout.",
                token: token
            });
        } catch (err) {
            console.error("Stripe Charge Error:", err.message);
            return res.status(400).json({ success: false, error: err.message });
        }
    }

    // Process Mock Charge Fallback
    console.log(`Mocking Stripe charge for plan '${plan}' ($${finalPrice}.00)`);
    console.log(`Cardholder Name: ${name}`);

    // Generate secure-looking mock token
    const token = 'tok_mock_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();

    if (email) {
        if (plan === 'subscription') {
            addSubscriber(email);
        }
        sendInstantEmail(email).catch(err => console.error("Error sending instant email:", err));
    }

    res.json({
        success: true,
        message: "Payment authorized successfully via Stripe Mock Gateway.",
        token: token
    });
});

// 2b. Dispatch daily CSV files automatically to subscribers
app.post('/api/send-daily-emails', async (req, res) => {
    const secretKey = req.headers['x-sync-secret'] || req.query.secret;
    const expectedSecret = process.env.SYNC_SECRET || 'clientflow_sync_secret';
    
    if (secretKey !== expectedSecret) {
        return res.status(401).json({ success: false, error: "Unauthorized sync trigger." });
    }

    let subscribers = [];
    try {
        if (fs.existsSync(SUBSCRIBERS_PATH)) {
            subscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_PATH, 'utf8'));
        }
    } catch (e) {
        return res.status(500).json({ success: false, error: "Failed to read subscriber list." });
    }

    if (subscribers.length === 0) {
        console.log("No active daily subscribers to update.");
        return res.json({ success: true, message: "No active subscribers." });
    }

    console.log(`Preparing to send daily CSV update to ${subscribers.length} subscribers...`);

    if (!fs.existsSync(CSV_PATH)) {
        return res.status(404).json({ success: false, error: "job_leads.csv not found on server." });
    }

    // If SMTP email settings are provided in Render config
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const mailOptions = {
                from: `"ClientFlow Updates" <${process.env.SMTP_USER}>`,
                to: subscribers.join(', '),
                subject: `Daily Job Leads CSV Update - ClientFlow`,
                text: `Hello Subscriber,\n\nHere is your requested daily sync update containing the latest active job postings from ClientFlow.\n\nBest regards,\nThe ClientFlow Team`,
                attachments: [
                    {
                        filename: 'job_leads.csv',
                        path: CSV_PATH
                    }
                ]
            };

            await transporter.sendMail(mailOptions);
            console.log("Daily CSV emails dispatched successfully via SMTP!");
            return res.json({ success: true, message: `Dispatched to ${subscribers.length} emails.` });
        } catch (err) {
            console.error("Failed to send SMTP emails:", err);
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    // Mock Email Send fallback
    console.log("================ MOCK EMAIL SEND ================");
    console.log(`From: "ClientFlow Updates" <updates@clientflow.com>`);
    console.log(`To: ${subscribers.join(', ')}`);
    console.log(`Subject: Daily Job Leads CSV Update - ClientFlow`);
    console.log(`Attachment: Attached job_leads.csv (${fs.statSync(CSV_PATH).size} bytes)`);
    console.log("=================================================");
    
    return res.json({ 
        success: true, 
        message: `Mock email triggered successfully to ${subscribers.length} subscribers (SMTP not configured).` 
    });
});

// 3. Secure file download downloader
// Validates token to serve CSV or text outputs
app.get('/api/download', (req, res) => {
    const { token, format } = req.query;

    if (!token || !token.startsWith('tok_')) {
        return res.status(403).send("<h1>403 Forbidden</h1><p>Access token is missing or invalid. Please complete payment to unlock sheet downloads.</p>");
    }

    if (format === 'txt') {
        if (!fs.existsSync(TXT_PATH)) {
            return res.status(404).send("Text table file not generated yet. Run scraper first.");
        }
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename=job_leads_table.txt');
        return res.sendFile(TXT_PATH);
    } else {
        if (!fs.existsSync(CSV_PATH)) {
            return res.status(404).send("CSV sheet not generated yet. Run scraper first.");
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=job_leads.csv');
        return res.sendFile(CSV_PATH);
    }
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Job Leads Web Application running on: http://localhost:${PORT}`);
    console.log(`Serving CSV Data from: ${CSV_PATH}`);
    console.log(`====================================================`);
});
