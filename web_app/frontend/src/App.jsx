import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  RefreshCw, 
  ArrowRight, 
  Lock, 
  Check, 
  Download, 
  CreditCard, 
  TrendingUp, 
  Mail, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

function App() {
  // State variables
  const [stats, setStats] = useState({
    totalJobs: 0,
    freeJobs: 0,
    paidJobs: 0,
    lastUpdated: 'Never',
    sources: {},
    previewJobs: []
  });
  
  const [isYearly, setIsYearly] = useState(false);
  const [activeToken, setActiveToken] = useState(localStorage.getItem('leads_access_token'));
  
  // Checkout Drawer state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('single');
  const [selectedPrice, setSelectedPrice] = useState(5);
  
  // Card Input state
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cardBrand, setCardBrand] = useState('generic');

  // --- Fetch Stats ---
  const loadStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const result = await res.json();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (e) {
      console.error("Failed to load statistics:", e);
    }
  };

  useEffect(() => {
    loadStats();

    // Check for success redirects if URL has queries
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const sessionId = urlParams.get('session_id');

    if (paymentSuccess && sessionId) {
      fetch(`/api/verify-payment?session_id=${sessionId}`)
        .then(res => res.json())
        .then(result => {
          if (result.success && result.token) {
            localStorage.setItem('leads_access_token', result.token);
            setActiveToken(result.token);
            // Clear URL params
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        });
    }
  }, []);

  // --- Card Brand Detection ---
  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    
    // Format value with space every 4 digits
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += value[i];
    }
    setCardNumber(formatted);

    // Basic Brand Detection
    if (value.startsWith('4')) {
      setCardBrand('visa');
    } else if (value.startsWith('5')) {
      setCardBrand('mastercard');
    } else {
      setCardBrand('generic');
    }
  };

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 2) {
      setCardExpiry(value.substring(0, 2) + ' / ' + value.substring(2, 4));
    } else {
      setCardExpiry(value);
    }
  };

  // --- Open Checkout ---
  const openCheckout = (plan, price) => {
    setSelectedPlan(plan);
    setSelectedPrice(price);
    setErrorMessage('');
    setCardName('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvc('');
    setIsCheckoutOpen(true);
  };

  // --- Submit Checkout ---
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsProcessing(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan: selectedPlan,
          name: cardName,
          cardNumber,
          expiry: cardExpiry,
          cvc: cardCvc
        })
      });

      const result = await res.json();
      
      setTimeout(() => {
        setIsProcessing(false);
        if (result.success && result.token) {
          localStorage.setItem('leads_access_token', result.token);
          setActiveToken(result.token);
          setIsCheckoutOpen(false);
          // Scroll to downloads section
          document.getElementById('download-portal')?.scrollIntoView({ behavior: 'smooth' });
        } else {
          setErrorMessage(result.error || "Card processing failed. Try again.");
        }
      }, 1500);

    } catch (err) {
      setIsProcessing(false);
      setErrorMessage("Unable to connect to Checkout gateway.");
    }
  };

  // --- Download Trigger ---
  const triggerDownload = (format) => {
    if (!activeToken) return;
    window.location.href = `/api/download?token=${activeToken}&format=${format}`;
  };

  // --- Custom Animated SVG Chart ---
  const renderChart = () => {
    const sources = stats.sources || {};
    const entries = Object.entries(sources).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return <div style={{color: 'var(--text-muted)'}}>No chart data</div>;

    const maxCount = Math.max(...entries.map(e => e[1]));
    const chartHeight = 130;
    
    return (
      <svg width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
        {entries.map(([source, count], index) => {
          const barWidth = 30;
          const spacing = 16;
          const barHeight = (count / maxCount) * (chartHeight - 40);
          const x = index * (barWidth + spacing) + 10;
          const y = chartHeight - 25 - barHeight;

          return (
            <g key={source}>
              {/* Animated Column Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="url(#tealGradient)"
                rx="4"
                className="chart-bar"
              />
              {/* Tooltip Counter */}
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize="10"
                fontWeight="700"
              >
                {count}
              </text>
              {/* Short Label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - 8}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="9"
                fontWeight="500"
              >
                {source.split(' ')[0].substring(0, 6)}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-teal)" />
            <stop offset="100%" stopColor="hsla(175, 80%, 43%, 0.2)" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  return (
    <>
      <div className="gradient-blob"></div>
      <div className="gradient-blob-secondary"></div>

      <nav>
        <div className="logo">
          <span>⚡</span> ClientFlow
        </div>
        <div className="logo-badge">Live Automation</div>
      </nav>

      <div className="container">
        {/* Hero Banner */}
        <header className="hero">
          <div className="live-indicator">
            <span className="live-pulse"></span>
            Live database updated daily at 11:00 AM
          </div>
          <h1>Premium Tech Job Leads<br />Without the <span>Bidding Fees</span></h1>
          <p>Skip paying connects on Upwork or bidding credits on Freelancer. ClientFlow compiles active developer and automation jobs with direct poster links.</p>
          <div className="hero-actions">
            {!activeToken ? (
              <a href="#pricing" className="btn btn-primary">Get Access Now <ArrowRight size={18} /></a>
            ) : (
              <a href="#download-portal" className="btn btn-primary">Download Leads Dashboard</a>
            )}
            <a href="#dashboard" className="btn btn-secondary">View Database Stats</a>
          </div>
        </header>

        {/* Dashboard Grid */}
        <section id="dashboard" style={{ marginBottom: '4rem' }}>
          <h2 className="dashboard-title">Live Database Metrics</h2>
          <div className="dashboard-grid">
            {/* Stat: Total leads */}
            <div className="stat-card">
              <div className="stat-label">Total Active Leads</div>
              <div className="stat-value">{stats.totalJobs || '-'}</div>
              <div className="stat-subtext">Verified listings (120-day limit)</div>
            </div>

            {/* Stat: Last Sync */}
            <div className="stat-card">
              <div className="stat-label">Last Automated Sync</div>
              <div className="stat-value" style={{ fontSize: '1.4rem', padding: '0.6rem 0' }}>
                {stats.lastUpdated}
              </div>
              <div className="stat-subtext">Heartbeat checks are healthy</div>
            </div>

            {/* Stat: Access Type */}
            <div className="stat-card">
              <div className="stat-label">Leads Cost Breakdown</div>
              <div className="platform-list" style={{ marginTop: '0.8rem' }}>
                <div className="platform-row">
                  <span className="platform-name">Free to Contact</span>
                  <span className="platform-count" style={{ color: 'var(--status-success)', borderColor: 'var(--status-success)' }}>
                    {stats.freeJobs || 0}
                  </span>
                </div>
                <div className="platform-row">
                  <span className="platform-name">Connects / Bids Required</span>
                  <span className="platform-count" style={{ color: 'var(--status-warning)', borderColor: 'var(--status-warning)' }}>
                    {stats.paidJobs || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Stat: Graphic Column Chart */}
            <div className="stat-card">
              <div className="stat-label">Distribution by Platform</div>
              <div className="chart-container">
                {renderChart()}
              </div>
            </div>
          </div>
        </section>

        {/* Gated Lead Preview Table */}
        <section className="preview-section">
          <div className="preview-header">
            <div className="preview-title">Recent Job Database Preview</div>
            <div className="preview-badge logo-badge" style={{ backgroundColor: 'hsla(175, 80%, 43%, 0.1)', color: 'var(--accent-teal)' }}>
              Live Data
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Age</th>
                  <th>Cost Type</th>
                  <th>Job Title</th>
                  <th>Company / Client</th>
                  <th>Job Link</th>
                </tr>
              </thead>
              <tbody>
                {stats.previewJobs && stats.previewJobs.length > 0 ? (
                  stats.previewJobs.map((job, idx) => (
                    <tr key={idx}>
                      <td className="td-source">{job.Source}</td>
                      <td>{job.Date}</td>
                      <td>
                        <span className={`badge-cost ${job.Cost.includes('Free') ? 'free' : 'paid'}`}>
                          {job.Cost}
                        </span>
                      </td>
                      <td className="td-title">{job.Title}</td>
                      {/* Blurred out gated fields */}
                      <td>
                        <div className="lock-container">
                          <span className="blurred-field">Acme Inc</span>
                          <Lock size={12} />
                        </div>
                      </td>
                      <td>
                        <div className="lock-container">
                          <span className="blurred-field">https://link...</span>
                          <Lock size={12} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      Crawl database first to preview jobs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="preview-overlay"></div>
        </section>

        {/* Paid Download Panel (Conditional Render) */}
        {activeToken && (
          <section id="download-portal" className="download-panel">
            <div className="success-badge">✓ Payment Authorized</div>
            <h2>Download Live Job Leads</h2>
            <p>You have unlocked direct, unrestricted download access. Choose your format below:</p>
            
            <div className="download-options">
              <div className="download-card">
                <Download size={40} className="stroke-teal" />
                <h3>job_leads.csv</h3>
                <span>Spreadsheet format (Excel / Sheets)</span>
                <button className="btn btn-primary" onClick={() => triggerDownload('csv')}>
                  Download CSV
                </button>
              </div>

              <div className="download-card">
                <Briefcase size={40} className="stroke-teal" />
                <h3>job_leads_table.txt</h3>
                <span>Space-aligned plain text table</span>
                <button className="btn btn-secondary" onClick={() => triggerDownload('txt')}>
                  Download Text Table
                </button>
              </div>
            </div>

            <div className="feedback-section">
              <p>
                Have ideas, custom requests, or feature suggestions? <br />
                <strong>Please let us know how we can improve!</strong> Reach us directly at{' '}
                <a href="mailto:support@clientflow.com">support@clientflow.com</a>
              </p>
            </div>
          </section>
        )}

        {/* Pricing Selection Grid */}
        {!activeToken && (
          <section id="pricing" className="pricing-section">
            <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>
              Unlock Direct Recruiter Leads
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
              Select a pricing plan to unlock immediate CSV download access.
            </p>

            {/* Monthly / Annual billing toggle switcher */}
            <div className="pricing-switcher-wrapper">
              <span className={`toggle-label ${!isYearly ? 'active' : ''}`} onClick={() => setIsYearly(false)}>
                Monthly Billing
              </span>
              <div className={`pricing-toggle ${isYearly ? 'yearly' : ''}`} onClick={() => setIsYearly(!isYearly)}>
                <div className="pricing-toggle-knob"></div>
              </div>
              <span className={`toggle-label ${isYearly ? 'active' : ''}`} onClick={() => setIsYearly(true)}>
                Yearly Billing <span className="discount-pill">Save 30%</span>
              </span>
            </div>
            
            <div className="pricing-grid">
              {/* Single Day Export Pass */}
              <div className="pricing-card">
                <div className="plan-name">Single Export Pass</div>
                <div className="plan-price">$5<span>one-time</span></div>
                <ul className="plan-features">
                  <li>Instant CSV & Text downloads</li>
                  <li>Direct links to hiring posters</li>
                  <li>Includes WWR, Remotive & HN</li>
                  <li>Includes 22 targeted subreddits</li>
                  <li>Includes Freelancer.com active bids</li>
                  <li>4 months of database history</li>
                </ul>
                <button className="btn btn-secondary" onClick={() => openCheckout('single', 5)}>
                  Get 24h Export
                </button>
              </div>

              {/* Monthly or Yearly Pro Pass */}
              <div className="pricing-card popular">
                <div className="popular-badge">Best Value</div>
                <div className="plan-name">Pro Access Plan</div>
                <div className="plan-price">
                  {isYearly ? '$99' : '$12'}
                  <span>{isYearly ? '/ year' : '/ month'}</span>
                </div>
                <ul className="plan-features">
                  <li>**Unlimited** daily downloads</li>
                  <li>Pre-sorted Reddit leads first</li>
                  <li>`Access Cost` column classifications</li>
                  <li>Includes Freelancer.com developer gigs</li>
                  <li>Direct profile contact links</li>
                  <li>No bidding connects or fees</li>
                </ul>
                <button 
                  className="btn btn-primary" 
                  onClick={() => openCheckout('subscription', isYearly ? 99 : 12)}
                >
                  Get Pro Access
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Slide-in checkout Drawer Modal overlay */}
      <div 
        className={`modal-overlay ${isCheckoutOpen ? 'active' : ''}`}
        onClick={() => setIsCheckoutOpen(false)}
      ></div>

      <aside className={`checkout-drawer ${isCheckoutOpen ? 'active' : ''}`}>
        <div className="checkout-header">
          <div className="checkout-title">Secure Checkout</div>
          <button className="close-btn" onClick={() => setIsCheckoutOpen(false)}>&times;</button>
        </div>

        {errorMessage && (
          <div className="error-message">
            {errorMessage}
          </div>
        )}

        <div className="summary-card">
          <div className="summary-row">
            <span>
              {selectedPlan === 'single' ? 'Single Export Pass' : 'Pro Access Pass'} 
              {selectedPlan === 'subscription' && (isYearly ? ' (Yearly)' : ' (Monthly)')}
            </span>
            <span>${selectedPrice}.00</span>
          </div>
          <div className="summary-row total">
            <span>Total Due</span>
            <span>${selectedPrice}.00</span>
          </div>
        </div>

        <form onSubmit={handleCheckoutSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="react-card-name">Cardholder Name</label>
            <input 
              className="form-input" 
              type="text" 
              id="react-card-name" 
              placeholder="John Doe" 
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-card-number">Card Number</label>
            <div className="input-wrapper">
              <input 
                className="form-input" 
                type="text" 
                id="react-card-number" 
                placeholder="4242 4242 4242 4242" 
                value={cardNumber}
                onChange={handleCardNumberChange}
                maxLength="19"
                required 
              />
              <div className="card-brand-icon">
                {cardBrand === 'visa' && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1A1F71', backgroundColor: '#FFF', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                    VISA
                  </span>
                )}
                {cardBrand === 'mastercard' && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#EB001B', backgroundColor: '#FFF', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                    MC
                  </span>
                )}
                {cardBrand === 'generic' && <CreditCard size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="form-group">
              <label className="form-label" htmlFor="react-card-expiry">Expiration Date</label>
              <input 
                className="form-input" 
                type="text" 
                id="react-card-expiry" 
                placeholder="MM / YY" 
                value={cardExpiry}
                onChange={handleExpiryChange}
                maxLength="7"
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="react-card-cvc">CVC</label>
              <input 
                className="form-input" 
                type="text" 
                id="react-card-cvc" 
                placeholder="123" 
                value={cardCvc}
                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                maxLength="4"
                required 
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-checkout-submit" 
            disabled={isProcessing}
            style={{ width: '100%', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {isProcessing ? (
              <>
                <div className="spinner"></div>
                <span>Authorizing Payment...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>Pay ${selectedPrice}.00 Securely</span>
              </>
            )}
          </button>
        </form>

        <div className="stripe-footer">
          <svg viewBox="0 0 40 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M39.6 8.5c0-3.3-1.8-4.9-4.8-4.9-3 0-5.1 1.7-5.1 4.9 0 3.7 2.4 4.8 5.4 4.8 1.4 0 2.8-.2 3.8-.7V11c-.9.4-2.1.6-3.3.6-2 0-3.2-.6-3.2-2.5h8c.1-.2.2-.4.2-.6zm-7.2-1.3c0-1.2.8-1.9 2-1.9s2 .7 2 1.9h-4zM24.7 3.9c-.8 0-1.7.4-2.2 1v-.8h-2.6V13h2.8v-5c0-1.4 1-2.1 2.3-2.1.3 0 .5 0 .8.1V3.9h-1.1zm-8.8.8v8.4h2.8V4.7h-2.8zm0-2.8v2h2.8v-2h-2.8zM10.8 1.9L8 13.1H5.3L3.6 5.8 1.8 13.1H0L3.1.9h2.8l1.6 6.8L9.2 1.9h1.6zm13.1-1.3l.3 1.2c-.7.1-1 .3-1 1v1.1h1v2.1h-1v5.7h-2.8V6.1h-.7V4.1h.7V3.5c0-1.8 1.1-2.9 2.8-2.9.2 0 .6 0 1 .1z" />
          </svg>
          <span>Secured Stripe Gateway</span>
        </div>
      </aside>
    </>
  );
}

export default App;
