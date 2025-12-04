(function () {
    'use strict';

    // Auth check
    if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
        try { window.location.href = '/login.html'; } catch (_) { }
        return;
    }

    const user = APP.Storage.get('user') || {};
    let currentPayment = null;

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        // Get payment ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const paymentId = urlParams.get('id');

        if (!paymentId) {
            showError('Payment ID not provided');
            return;
        }

        await loadPaymentDetails(paymentId);
        setupEventListeners();
    }

    function setupEventListeners() {
        const downloadBtn = document.getElementById('downloadReceipt');
        const printBtn = document.getElementById('printReceipt');

        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadReceipt);
        }

        if (printBtn) {
            printBtn.addEventListener('click', printReceipt);
        }
    }

    async function loadPaymentDetails(paymentId) {
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        const content = document.getElementById('paymentContent');

        try {
            // Show loading
            if (loadingState) loadingState.style.display = 'block';
            if (errorState) errorState.style.display = 'none';
            if (content) content.style.display = 'none';

            const response = await APP.API.get(`/payments/${paymentId}`);

            if (response.success) {
                currentPayment = response.data;
                renderPaymentDetails(currentPayment);

                // Show content
                if (loadingState) loadingState.style.display = 'none';
                if (content) content.style.display = 'block';
            } else {
                throw new Error(response.error || 'Payment not found');
            }
        } catch (error) {
            console.error('Failed to load payment details:', error);
            showError(error.message || 'Failed to load payment details');
        }
    }

    function renderPaymentDetails(payment) {
        // Update status header based on payment status
        const statusIcon = document.getElementById('statusIcon');
        const statusTitle = document.getElementById('statusTitle');
        const statusSubtitle = document.getElementById('statusSubtitle');

        if (payment.status === 'completed') {
            statusIcon.textContent = '✓';
            statusIcon.style.background = 'rgba(34, 197, 94, 0.1)';
            statusTitle.textContent = 'Payment Successful';
            statusSubtitle.textContent = 'Your payment has been processed successfully';
        } else if (payment.status === 'pending') {
            statusIcon.textContent = '⏳';
            statusIcon.style.background = 'rgba(234, 179, 8, 0.1)';
            statusTitle.textContent = 'Payment Pending';
            statusSubtitle.textContent = 'Your payment is being processed';
        } else if (payment.status === 'failed') {
            statusIcon.textContent = '✗';
            statusIcon.style.background = 'rgba(239, 68, 68, 0.1)';
            statusTitle.textContent = 'Payment Failed';
            statusSubtitle.textContent = 'There was an issue processing your payment';
        } else if (payment.status === 'refunded') {
            statusIcon.textContent = '↩️';
            statusIcon.style.background = 'rgba(168, 85, 247, 0.1)';
            statusTitle.textContent = 'Payment Refunded';
            statusSubtitle.textContent = 'This payment has been refunded';
        }

        // Payment Information
        setText('paymentId', payment.paymentId);
        setText('transactionId', payment.transactionId);
        
        // Format date
        const date = new Date(payment.paymentDate);
        const dateStr = date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        setText('paymentDate', dateStr);

        // Status with badge
        const statusEl = document.getElementById('paymentStatus');
        if (statusEl) {
            statusEl.textContent = payment.status;
            statusEl.className = `status-badge status-${payment.status}`;
        }

        // Student Information
        setText('studentName', payment.studentName);
        setText('studentRegNo', payment.studentRegNo);
        setText('studentEmail', payment.studentEmail);

        // Payment Details
        setText('semester', payment.semester);
        setText('category', payment.category);
        setText('paymentMethod', payment.paymentMethod);
        setText('description', payment.description || 'N/A');
        setText('amount', `₹ ${payment.amount.toFixed(2)}`);
    }

    function showError(message) {
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        const errorMessage = document.getElementById('errorMessage');

        if (loadingState) loadingState.style.display = 'none';
        if (errorState) errorState.style.display = 'block';
        if (errorMessage) errorMessage.textContent = message;
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    async function downloadReceipt() {
        if (!currentPayment) return;

        try {
            APP.Toast.info('Downloading receipt...');

            // Get the access token
            const accessToken = APP.Storage.get('accessToken');
            const apiUrl = APP.Config.getApiUrl();

            // Create a download link
            const url = `${apiUrl}/payments/${currentPayment.id}/receipt`;

            // Download using fetch
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to download receipt');
            }

            // Get the blob
            const blob = await response.blob();

            // Create download link
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `receipt-${currentPayment.paymentId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            APP.Toast.success('Receipt downloaded successfully');
        } catch (error) {
            console.error('Download receipt error:', error);
            APP.Toast.error('Failed to download receipt');
        }
    }

    function printReceipt() {
        if (!currentPayment) return;

        // Create a printable version
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            APP.Toast.error('Please allow popups to print receipt');
            return;
        }

        const date = new Date(currentPayment.paymentDate);
        const dateStr = date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Receipt - ${currentPayment.paymentId}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 40px;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 40px;
                        border-bottom: 2px solid #333;
                        padding-bottom: 20px;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                    }
                    .header h2 {
                        margin: 10px 0 0;
                        font-size: 20px;
                        font-weight: normal;
                    }
                    .section {
                        margin-bottom: 30px;
                    }
                    .section h3 {
                        margin-bottom: 15px;
                        font-size: 16px;
                        text-transform: uppercase;
                        color: #666;
                    }
                    .detail-row {
                        display: flex;
                        padding: 8px 0;
                        border-bottom: 1px solid #eee;
                    }
                    .detail-row label {
                        font-weight: bold;
                        width: 200px;
                    }
                    .detail-row span {
                        flex: 1;
                    }
                    .amount-box {
                        background: #f5f5f5;
                        padding: 20px;
                        text-align: center;
                        margin: 30px 0;
                        border: 2px solid #333;
                    }
                    .amount-box .label {
                        font-size: 14px;
                        color: #666;
                        margin-bottom: 10px;
                    }
                    .amount-box .value {
                        font-size: 32px;
                        font-weight: bold;
                    }
                    .footer {
                        margin-top: 50px;
                        text-align: center;
                        font-size: 12px;
                        color: #666;
                    }
                    @media print {
                        body {
                            padding: 20px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ITER COLLEGE</h1>
                    <h2>Payment Receipt</h2>
                </div>

                <div class="section">
                    <h3>Receipt Details</h3>
                    <div class="detail-row">
                        <label>Payment ID:</label>
                        <span>${currentPayment.paymentId}</span>
                    </div>
                    <div class="detail-row">
                        <label>Transaction ID:</label>
                        <span>${currentPayment.transactionId}</span>
                    </div>
                    <div class="detail-row">
                        <label>Date:</label>
                        <span>${dateStr}</span>
                    </div>
                    <div class="detail-row">
                        <label>Time:</label>
                        <span>${timeStr}</span>
                    </div>
                </div>

                <div class="section">
                    <h3>Student Information</h3>
                    <div class="detail-row">
                        <label>Name:</label>
                        <span>${currentPayment.studentName}</span>
                    </div>
                    <div class="detail-row">
                        <label>Registration Number:</label>
                        <span>${currentPayment.studentRegNo}</span>
                    </div>
                    <div class="detail-row">
                        <label>Email:</label>
                        <span>${currentPayment.studentEmail}</span>
                    </div>
                </div>

                <div class="section">
                    <h3>Payment Details</h3>
                    <div class="detail-row">
                        <label>Semester:</label>
                        <span>${currentPayment.semester}</span>
                    </div>
                    <div class="detail-row">
                        <label>Category:</label>
                        <span>${currentPayment.category}</span>
                    </div>
                    <div class="detail-row">
                        <label>Payment Method:</label>
                        <span>${currentPayment.paymentMethod}</span>
                    </div>
                    <div class="detail-row">
                        <label>Description:</label>
                        <span>${currentPayment.description || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <label>Status:</label>
                        <span style="text-transform: uppercase;">${currentPayment.status}</span>
                    </div>
                </div>

                <div class="amount-box">
                    <div class="label">Amount Paid</div>
                    <div class="value">₹ ${currentPayment.amount.toFixed(2)}</div>
                </div>

                <div class="footer">
                    <p>This is a computer-generated receipt and does not require a signature.</p>
                    <p>Generated on: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}</p>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        // Wait for content to load, then print
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }

})();
