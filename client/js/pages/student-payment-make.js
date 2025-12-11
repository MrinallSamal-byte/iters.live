(function () {
    'use strict';

    // Auth check
    if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
        try { window.location.href = '/login.html'; } catch (_) { }
        return;
    }

    const user = APP.Storage.get('user') || {};

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        setupFormListeners();
        updatePaymentSummary();
    }

    function setupFormListeners() {
        const form = document.getElementById('paymentForm');
        const amountInput = document.getElementById('amount');

        // Update summary when amount changes
        if (amountInput) {
            amountInput.addEventListener('input', updatePaymentSummary);
        }

        // Handle form submission
        if (form) {
            form.addEventListener('submit', handleSubmit);
        }
    }

    function updatePaymentSummary() {
        const amountInput = document.getElementById('amount');
        const summaryAmount = document.getElementById('summaryAmount');
        const summaryTotal = document.getElementById('summaryTotal');

        if (!amountInput || !summaryAmount || !summaryTotal) return;

        const amount = parseFloat(amountInput.value) || 0;
        const processingFee = 0; // No processing fee for now
        const total = amount + processingFee;

        summaryAmount.textContent = `₹ ${amount.toFixed(2)}`;
        summaryTotal.textContent = `₹ ${total.toFixed(2)}`;
    }

    async function handleSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const submitBtn = document.getElementById('submitPayment');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');

        // Get form data
        const formData = {
            amount: parseFloat(document.getElementById('amount').value),
            semester: document.getElementById('semester').value,
            category: document.getElementById('category').value,
            paymentMethod: document.getElementById('paymentMethod').value,
            description: document.getElementById('description').value
        };

        // Validation
        if (!formData.amount || formData.amount <= 0) {
            APP.Toast.error('Please enter a valid amount');
            return;
        }

        if (!formData.semester || !formData.category || !formData.paymentMethod) {
            APP.Toast.error('Please fill in all required fields');
            return;
        }

        // Show loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-flex';

        try {
            // Create payment
            const response = await APP.API.post('/payments', formData);

            if (response.success) {
                // Show success message
                APP.Toast.success('Payment processed successfully!');

                // Show payment details in a modal-like manner
                showPaymentSuccess(response.data);

                // Reset form
                form.reset();
                updatePaymentSummary();

                // Redirect to payment history after a delay
                setTimeout(() => {
                    // Create page access token before redirecting
                    if (window.PageAccessToken && typeof window.PageAccessToken.createPageAccessToken === 'function') {
                        window.PageAccessToken.createPageAccessToken('/dashboard/student-payment-history.html');
                    }
                    window.location.href = '/dashboard/student-payment-history.html';
                }, 3000);
            } else {
                throw new Error(response.error || 'Payment failed');
            }
        } catch (error) {
            console.error('Payment error:', error);
            APP.Toast.error(error.message || 'Failed to process payment. Please try again.');
        } finally {
            // Hide loading state
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    }

    function showPaymentSuccess(paymentData) {
        // Create a success overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        overlay.innerHTML = `
            <div style="
                background: var(--bg-primary);
                border-radius: 16px;
                padding: 3rem;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.3s ease;
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    background: rgba(34, 197, 94, 0.1);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3rem;
                    margin: 0 auto 1.5rem;
                ">✓</div>
                <h2 style="color: var(--text-primary); margin-bottom: 1rem;">Payment Successful!</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">Your payment has been processed successfully.</p>
                <div style="
                    background: var(--bg-secondary);
                    padding: 1.5rem;
                    border-radius: 12px;
                    text-align: left;
                    margin-bottom: 2rem;
                ">
                    <div style="margin-bottom: 1rem;">
                        <small style="color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Payment ID</small>
                        <strong style="color: var(--text-primary);">${paymentData.paymentId}</strong>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <small style="color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Transaction ID</small>
                        <strong style="color: var(--text-primary);">${paymentData.transactionId}</strong>
                    </div>
                    <div>
                        <small style="color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Amount</small>
                        <strong style="color: var(--primary-color); font-size: 1.5rem;">₹ ${paymentData.amount.toFixed(2)}</strong>
                    </div>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.875rem;">
                    Redirecting to payment history...
                </p>
            </div>
        `;

        document.body.appendChild(overlay);

        // Add animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Remove overlay on click
        overlay.addEventListener('click', () => {
            overlay.remove();
            style.remove();
        });
    }

})();
