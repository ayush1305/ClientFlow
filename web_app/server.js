const express = require('express');
const fs = require('fs');
const path = require('path');

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
    const previewJobs = jobs.slice(0, 5).map(job => ({
        Title: job['Title'] || '',
        Source: job['Source'] || '',
        Date: job['Days Posted'] || 'Today',
        Cost: job['Access Cost'] || (job['Source'].includes('Freelancer') ? 'Paid (Connects / Bids)' : 'Free (No Fees)')
    }));

    // Find newest job title
    const newestLead = jobs[0] ? {
        title: jobs[0]['Title'],
        company: jobs[0]['Company / Poster'],
        source: jobs[0]['Source'],
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
app.post('/api/checkout', (req, res) => {
    const { plan, cardNumber, expiry, cvc, name } = req.body;

    if (!plan || !cardNumber || !expiry || !cvc || !name) {
        return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    // Standard client card regex validations
    const cleanCard = cardNumber.replace(/\s+/g, '');
    if (cleanCard.length < 15 || cleanCard.length > 16) {
        return res.status(400).json({ success: false, error: "Invalid Card Number." });
    }

    // Process Mock Charge
    console.log(`Mocking Stripe charge for plan '${plan}' ($${plan === 'single' ? '5.00' : '12.00'})`);
    console.log(`Cardholder Name: ${name}`);

    // Generate secure-looking token
    const token = 'tok_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();

    res.json({
        success: true,
        message: "Payment authorized successfully via Stripe Mock Gateway.",
        token: token
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
