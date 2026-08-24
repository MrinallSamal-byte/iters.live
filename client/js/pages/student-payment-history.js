// Role guard (must run before any page logic or API calls)
(function () {
  if (typeof APP === 'undefined' || typeof APP.requirePageRole !== 'function' || !APP.requirePageRole('student')) {
    // Stop all further execution on this page when the guard fails
    throw new Error('Access denied: page requires student role');
  }
})();

(function () {
    'use strict';

    // Auth check
    if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
        try { window.location.href = '/login.html'; } catch (_) { }
        return;
    }

    const user = APP.Storage.get('user') || {};
    let allPayments = [];

    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function notify(message, type) {
        if (window.Toast?.show) window.Toast.show({ type, message });
        else console.log(`[${type}] ${message}`);
    }

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        setupEventListeners();
        await Promise.all([loadPaymentStats(), loadPaymentHistory()]);
    }

    function setupEventListeners() {
        const applyFiltersBtn = document.getElementById('applyFilters');
        const clearFiltersBtn = document.getElementById('clearFilters');

        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', applyFilters);
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', clearFilters);
        }
    }

    async function loadPaymentStats() {
        try {
            const response = await APP.API.get('/payments/stats');
            
            if (response.success) {
                const stats = response.data;
                setText('totalPaid', `₹ ${stats.totalPaid.toFixed(2)}`);
                setText('totalPayments', stats.totalPayments);
                setText('pendingPayments', stats.pendingPayments);
            }
        } catch (error) {
            console.error('Failed to load payment stats:', error);
            // Show fallback values
            setText('totalPaid', '₹ 0.00');
            setText('totalPayments', '0');
            setText('pendingPayments', '0');
        }
    }

    async function loadPaymentHistory() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const table = document.getElementById('paymentsTable');

        try {
            // Show loading
            if (loadingState) loadingState.style.display = 'block';
            if (emptyState) emptyState.style.display = 'none';
            if (table) table.style.display = 'none';

            const response = await APP.API.get('/payments');

            if (response.success) {
                allPayments = response.data || [];

                if (allPayments.length === 0) {
                    // Show empty state
                    if (loadingState) loadingState.style.display = 'none';
                    if (emptyState) emptyState.style.display = 'block';
                } else {
                    // Show table with data
                    renderPaymentsTable(allPayments);
                    if (loadingState) loadingState.style.display = 'none';
                    if (table) table.style.display = 'table';
                }
            } else {
                throw new Error(response.error || 'Failed to load payments');
            }
        } catch (error) {
            console.error('Failed to load payment history:', error);
            notify('Failed to load payment history', 'error');
            
            // Show empty state on error
            if (loadingState) loadingState.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
        }
    }

    function renderPaymentsTable(payments) {
        const tbody = document.getElementById('paymentsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        payments.forEach(payment => {
            const row = document.createElement('tr');
            
            // Format date
            const date = new Date(payment.paymentDate);
            const dateStr = date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            const timeStr = date.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
            });

            // Status badge class
            const statusClass = `status-${payment.status}`;

            row.innerHTML = `
                <td><strong>${esc(payment.paymentId)}</strong></td>
                <td>
                    <div>${esc(dateStr)}</div>
                    <small style="color: var(--text-secondary);">${esc(timeStr)}</small>
                </td>
                <td>${esc(payment.category)}</td>
                <td>${esc(payment.semester)}</td>
                <td><strong>₹ ${Number(payment.amount || 0).toFixed(2)}</strong></td>
                <td><span class="status-badge ${statusClass}">${esc(payment.status)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-small btn-view" data-payment-id="${payment.id}">
                            View
                        </button>
                        <button class="btn-small btn-download" data-payment-id="${payment.id}">
                            Receipt
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    function applyFilters() {
        const statusFilter = document.getElementById('filterStatus').value;
        const categoryFilter = document.getElementById('filterCategory').value;

        let filtered = allPayments;

        if (statusFilter) {
            filtered = filtered.filter(p => p.status === statusFilter);
        }

        if (categoryFilter) {
            filtered = filtered.filter(p => p.category === categoryFilter);
        }

        renderPaymentsTable(filtered);

        // Show message if no results
        if (filtered.length === 0) {
            const tbody = document.getElementById('paymentsTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 3rem;">
                            <div style="color: var(--text-secondary);">
                                <div style="font-size: 2rem; margin-bottom: 1rem;">🔍</div>
                                <p>No payments found matching your filters.</p>
                                <button class="btn btn-secondary" onclick="document.getElementById('clearFilters').click()" style="margin-top: 1rem;">
                                    Clear Filters
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }

    function clearFilters() {
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterCategory').value = '';
        renderPaymentsTable(allPayments);
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function viewPayment(paymentId) {
        APP.navigateToDashboard(`/dashboard/student-payment-details.html?id=${paymentId}`);
    }

    async function downloadReceipt(paymentId) {
        try {
            notify('Downloading receipt...', 'info');
            
            // Get the access token
            const accessToken = APP.Storage.get('accessToken');
            
            // Create a download link
            const url = `/api/payments/${encodeURIComponent(paymentId)}/receipt`;
            
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
            a.download = `receipt-${paymentId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            notify('Receipt downloaded successfully', 'success');
        } catch (error) {
            console.error('Download receipt error:', error);
            notify('Failed to download receipt', 'error');
        }
    }

    // Use event delegation for button clicks instead of inline handlers
    document.addEventListener('click', function(e) {
        const target = e.target;
        
        // Handle view payment button
        if (target.classList.contains('btn-view') || target.closest('.btn-view')) {
            const btn = target.classList.contains('btn-view') ? target : target.closest('.btn-view');
            const paymentId = btn.getAttribute('data-payment-id');
            if (paymentId) {
                viewPayment(paymentId);
            }
        }
        
        // Handle download receipt button
        if (target.classList.contains('btn-download') || target.closest('.btn-download')) {
            const btn = target.classList.contains('btn-download') ? target : target.closest('.btn-download');
            const paymentId = btn.getAttribute('data-payment-id');
            if (paymentId) {
                downloadReceipt(paymentId);
            }
        }
    });

})();
