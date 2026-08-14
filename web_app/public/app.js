document.addEventListener('DOMContentLoaded', () => {
    // State Management
    let selectedPlan = null;
    let selectedPrice = null;
    let activeToken = localStorage.getItem('leads_access_token');

    // UI Elements
    const statTotalJobs = document.getElementById('stat-total-jobs');
    const statLastSync = document.getElementById('stat-last-sync');
    const statFreeJobs = document.getElementById('stat-free-jobs');
    const statPaidJobs = document.getElementById('stat-paid-jobs');
    const platformBreakdown = document.getElementById('platform-breakdown');
    
    const checkoutOverlay = document.getElementById('checkout-overlay');
    const checkoutDrawer = document.getElementById('checkout-drawer');
    const checkoutForm = document.getElementById('checkout-form');
    const checkoutError = document.getElementById('checkout-error');
    
    const summaryPlanName = document.getElementById('summary-plan-name');
    const summaryPlanPrice = document.getElementById('summary-plan-price');
    const summaryTotalPrice = document.getElementById('summary-total-price');
    
    const btnCloseCheckout = document.getElementById('btn-close-checkout');
    const btnSubmitPayment = document.getElementById('btn-submit-payment');
    const btnText = document.getElementById('btn-text');
    const paymentSpinner = document.getElementById('payment-spinner');
    
    const downloadPortal = document.getElementById('download-portal');
    const btnDownloadCsv = document.getElementById('btn-download-csv');
    const btnDownloadTxt = document.getElementById('btn-download-txt');
    
    // Card inputs formatting elements
    const cardNameInput = document.getElementById('card-name');
    const cardNumberInput = document.getElementById('card-number');
    const cardExpiryInput = document.getElementById('card-expiry');
    const cardCvcInput = document.getElementById('card-cvc');

    // --- 1. Load Statistics from Server ---
    async function loadStats() {
        try {
            const res = await fetch('/api/stats');
            const result = await res.json();
            if (result.success && result.data) {
                const data = result.data;
                statTotalJobs.textContent = data.totalJobs;
                statLastSync.textContent = data.lastUpdated;
                if (statFreeJobs) statFreeJobs.textContent = data.freeJobs || 0;
                if (statPaidJobs) statPaidJobs.textContent = data.paidJobs || 0;
                
                // Platforms List
                platformBreakdown.innerHTML = '';
                const sortedSources = Object.entries(data.sources).sort((a, b) => b[1] - a[1]);
                
                if (sortedSources.length === 0) {
                    platformBreakdown.innerHTML = '<div class="platform-row"><span class="platform-name">No active feeds</span></div>';
                } else {
                    sortedSources.forEach(([source, count]) => {
                        const row = document.createElement('div');
                        row.className = 'platform-row';
                        row.innerHTML = `
                            <span class="platform-name">${source}</span>
                            <span class="platform-count">${count}</span>
                        `;
                        platformBreakdown.appendChild(row);
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load live stats:", e);
        }
    }

    loadStats();

    // --- 2. Check Login Status ---
    function checkAccess() {
        if (activeToken) {
            // Show Download Panel
            downloadPortal.classList.add('active');
            // Hide Pricing Section
            const pricingSection = document.getElementById('pricing');
            if (pricingSection) pricingSection.style.display = 'none';
        }
    }
    
    checkAccess();

    // --- 3. Format Card Inputs ---
    // Format card number with spaces (1234 5678 1234 5678)
    cardNumberInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) formatted += ' ';
            formatted += value[i];
        }
        e.target.value = formatted;
    });

    // Format expiry date with slash (MM / YY)
    cardExpiryInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 2) {
            e.target.value = value.substr(0, 2) + ' / ' + value.substr(2, 2);
        } else {
            e.target.value = value;
        }
    });

    // Format CVC to numbers only
    cardCvcInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });

    // --- 4. Open Checkout Drawer ---
    document.querySelectorAll('.btn-select-plan').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectedPlan = e.target.getAttribute('data-plan');
            selectedPrice = e.target.getAttribute('data-price');
            
            // Populate summary card
            const planLabel = selectedPlan === 'single' ? 'Single Export Pass' : 'Pro Subscription';
            summaryPlanName.textContent = planLabel;
            summaryPlanPrice.textContent = `$${selectedPrice}.00`;
            summaryTotalPrice.textContent = `$${selectedPrice}.00`;
            btnText.textContent = `Pay $${selectedPrice}.00`;
            
            // Clear errors & inputs
            checkoutError.style.display = 'none';
            checkoutError.textContent = '';
            checkoutForm.reset();
            
            // Open Drawers
            checkoutOverlay.classList.add('active');
            checkoutDrawer.classList.add('active');
        });
    });

    // --- 5. Close Checkout Drawer ---
    function closeCheckout() {
        checkoutOverlay.classList.remove('active');
        checkoutDrawer.classList.remove('active');
    }

    btnCloseCheckout.addEventListener('click', closeCheckout);
    checkoutOverlay.addEventListener('click', closeCheckout);

    // --- 6. Handle Mock Checkout Form Submission ---
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        checkoutError.style.display = 'none';
        checkoutError.textContent = '';
        
        // Form field fetches
        const name = cardNameInput.value.trim();
        const cardNumber = cardNumberInput.value;
        const expiry = cardExpiryInput.value;
        const cvc = cardCvcInput.value;
        
        // Show Loading Spinner
        paymentSpinner.style.display = 'inline-block';
        btnSubmitPayment.disabled = true;
        btnText.textContent = "Processing charge...";
        
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan: selectedPlan,
                    name,
                    cardNumber,
                    expiry,
                    cvc
                })
            });
            
            const result = await res.json();
            
            // Artificial delay to simulate banking authorization
            setTimeout(() => {
                paymentSpinner.style.display = 'none';
                btnSubmitPayment.disabled = false;
                
                if (result.success && result.token) {
                    // Success checkout path
                    activeToken = result.token;
                    localStorage.setItem('leads_access_token', activeToken);
                    
                    // Close checkout
                    closeCheckout();
                    
                    // Unlock download panel
                    downloadPortal.classList.add('active');
                    
                    // Hide Pricing cards
                    const pricingSection = document.getElementById('pricing');
                    if (pricingSection) pricingSection.style.display = 'none';
                    
                    // Scroll to download panel smoothly
                    downloadPortal.scrollIntoView({ behavior: 'smooth' });
                } else {
                    // Display error
                    checkoutError.textContent = result.error || "An error occurred processing the card. Try again.";
                    checkoutError.style.display = 'block';
                    btnText.textContent = `Pay $${selectedPrice}.00`;
                }
            }, 1500); // 1.5 second visual wait
            
        } catch (err) {
            paymentSpinner.style.display = 'none';
            btnSubmitPayment.disabled = false;
            btnText.textContent = `Pay $${selectedPrice}.00`;
            checkoutError.textContent = "Unable to connect to Stripe checkout server.";
            checkoutError.style.display = 'block';
        }
    });

    // --- 7. Secure Downloads Triggers ---
    btnDownloadCsv.addEventListener('click', () => {
        if (!activeToken) return;
        window.location.href = `/api/download?token=${activeToken}&format=csv`;
    });

    btnDownloadTxt.addEventListener('click', () => {
        if (!activeToken) return;
        window.location.href = `/api/download?token=${activeToken}&format=txt`;
    });
});
