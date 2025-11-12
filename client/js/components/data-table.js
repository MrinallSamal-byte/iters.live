/**
 * Advanced Data Table Component
 * Sortable, filterable, paginated table with bulk operations and CSV export
 */

class DataTable {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      columns: options.columns || [],
      data: options.data || [],
      pageSize: options.pageSize || 25,
      sortable: options.sortable !== false,
      filterable: options.filterable !== false,
      exportable: options.exportable !== false,
      bulkActions: options.bulkActions || [],
      onRowClick: options.onRowClick || null,
      onBulkAction: options.onBulkAction || null,
      ...options
    };

    this.currentPage = 1;
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.filters = {};
    this.selectedRows = new Set();

    this.render();
  }

  /**
   * Render the complete table
   */
  render() {
    if (!this.container) return;

    const html = `
      <div class="data-table-wrapper">
        ${this.renderToolbar()}
        ${this.renderTable()}
        ${this.renderPagination()}
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  /**
   * Render toolbar with search, filters, and actions
   */
  renderToolbar() {
    return `
      <div class="data-table-toolbar">
        <div class="toolbar-left">
          ${this.options.filterable ? `
            <input 
              type="text" 
              class="table-search" 
              placeholder="Search..."
              id="table-search-${this.container.id}"
            />
          ` : ''}
          
          ${this.options.bulkActions.length > 0 ? `
            <select class="bulk-action-select" id="bulk-action-${this.container.id}">
              <option value="">Bulk Actions</option>
              ${this.options.bulkActions.map(action => `
                <option value="${action.value}">${action.label}</option>
              `).join('')}
            </select>
            <button class="btn-apply-bulk" id="apply-bulk-${this.container.id}">
              Apply
            </button>
          ` : ''}
        </div>

        <div class="toolbar-right">
          <button class="btn-column-toggle" id="column-toggle-${this.container.id}">
            <i class="fas fa-columns"></i> Columns
          </button>
          
          ${this.options.exportable ? `
            <button class="btn-export" id="export-csv-${this.container.id}">
              <i class="fas fa-download"></i> Export CSV
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render the table itself
   */
  renderTable() {
    const visibleColumns = this.options.columns.filter(col => col.visible !== false);
    const paginatedData = this.getPaginatedData();

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${this.options.bulkActions.length > 0 ? `
                <th class="checkbox-column">
                  <input 
                    type="checkbox" 
                    id="select-all-${this.container.id}"
                    class="select-all-checkbox"
                  />
                </th>
              ` : ''}
              
              ${visibleColumns.map(col => `
                <th 
                  class="${this.options.sortable && col.sortable !== false ? 'sortable' : ''} ${
                    this.sortColumn === col.key ? 'sorted-' + this.sortDirection : ''
                  }"
                  data-column="${col.key}"
                >
                  ${col.label}
                  ${this.options.sortable && col.sortable !== false ? `
                    <i class="fas fa-sort sort-icon"></i>
                  ` : ''}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${paginatedData.length > 0 ? paginatedData.map((row, index) => `
              <tr data-row-id="${row.id || index}" class="${this.selectedRows.has(row.id || index) ? 'selected' : ''}">
                ${this.options.bulkActions.length > 0 ? `
                  <td class="checkbox-column">
                    <input 
                      type="checkbox" 
                      class="row-checkbox"
                      data-row-id="${row.id || index}"
                      ${this.selectedRows.has(row.id || index) ? 'checked' : ''}
                    />
                  </td>
                ` : ''}
                
                ${visibleColumns.map(col => `
                  <td data-column="${col.key}">
                    ${col.render ? col.render(row[col.key], row) : this.escapeHtml(row[col.key])}
                  </td>
                `).join('')}
              </tr>
            `).join('') : `
              <tr>
                <td colspan="${visibleColumns.length + (this.options.bulkActions.length > 0 ? 1 : 0)}" class="no-data">
                  No data available
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render pagination controls
   */
  renderPagination() {
    const totalPages = Math.ceil(this.getFilteredData().length / this.options.pageSize);
    
    if (totalPages <= 1) return '';

    return `
      <div class="data-table-pagination">
        <div class="pagination-info">
          Showing ${(this.currentPage - 1) * this.options.pageSize + 1} to ${Math.min(this.currentPage * this.options.pageSize, this.getFilteredData().length)} of ${this.getFilteredData().length} entries
        </div>
        
        <div class="pagination-controls">
          <button 
            class="btn-page" 
            data-page="first"
            ${this.currentPage === 1 ? 'disabled' : ''}
          >
            <i class="fas fa-angle-double-left"></i>
          </button>
          
          <button 
            class="btn-page" 
            data-page="prev"
            ${this.currentPage === 1 ? 'disabled' : ''}
          >
            <i class="fas fa-angle-left"></i>
          </button>
          
          ${this.renderPageNumbers(totalPages)}
          
          <button 
            class="btn-page" 
            data-page="next"
            ${this.currentPage === totalPages ? 'disabled' : ''}
          >
            <i class="fas fa-angle-right"></i>
          </button>
          
          <button 
            class="btn-page" 
            data-page="last"
            ${this.currentPage === totalPages ? 'disabled' : ''}
          >
            <i class="fas fa-angle-double-right"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render page numbers
   */
  renderPageNumbers(totalPages) {
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(`
        <button 
          class="btn-page ${i === this.currentPage ? 'active' : ''}" 
          data-page="${i}"
        >
          ${i}
        </button>
      `);
    }

    return pages.join('');
  }

  /**
   * Get filtered and sorted data
   */
  getFilteredData() {
    let data = [...this.options.data];

    // Apply search filter
    const searchTerm = document.getElementById(`table-search-${this.container.id}`)?.value.toLowerCase();
    if (searchTerm) {
      data = data.filter(row => {
        return this.options.columns.some(col => {
          const value = String(row[col.key] || '').toLowerCase();
          return value.includes(searchTerm);
        });
      });
    }

    // Apply column filters
    Object.keys(this.filters).forEach(key => {
      const filterValue = this.filters[key];
      if (filterValue) {
        data = data.filter(row => String(row[key]).toLowerCase().includes(filterValue.toLowerCase()));
      }
    });

    // Apply sorting
    if (this.sortColumn) {
      data.sort((a, b) => {
        const aVal = a[this.sortColumn];
        const bVal = b[this.sortColumn];
        
        if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }

  /**
   * Get paginated data
   */
  getPaginatedData() {
    const data = this.getFilteredData();
    const start = (this.currentPage - 1) * this.options.pageSize;
    const end = start + this.options.pageSize;
    return data.slice(start, end);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Search
    const searchInput = document.getElementById(`table-search-${this.container.id}`);
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.currentPage = 1;
        this.render();
      });
    }

    // Column sorting
    if (this.options.sortable) {
      const headers = this.container.querySelectorAll('th.sortable');
      headers.forEach(header => {
        header.addEventListener('click', () => {
          const column = header.dataset.column;
          if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
          }
          this.render();
        });
      });
    }

    // Pagination
    const pageButtons = this.container.querySelectorAll('.btn-page');
    pageButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        const totalPages = Math.ceil(this.getFilteredData().length / this.options.pageSize);
        
        switch(page) {
          case 'first':
            this.currentPage = 1;
            break;
          case 'prev':
            this.currentPage = Math.max(1, this.currentPage - 1);
            break;
          case 'next':
            this.currentPage = Math.min(totalPages, this.currentPage + 1);
            break;
          case 'last':
            this.currentPage = totalPages;
            break;
          default:
            this.currentPage = parseInt(page);
        }
        
        this.render();
      });
    });

    // Row selection
    const selectAllCheckbox = document.getElementById(`select-all-${this.container.id}`);
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = this.container.querySelectorAll('.row-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          const rowId = cb.dataset.rowId;
          if (e.target.checked) {
            this.selectedRows.add(rowId);
          } else {
            this.selectedRows.delete(rowId);
          }
        });
        this.render();
      });
    }

    const rowCheckboxes = this.container.querySelectorAll('.row-checkbox');
    rowCheckboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const rowId = e.target.dataset.rowId;
        if (e.target.checked) {
          this.selectedRows.add(rowId);
        } else {
          this.selectedRows.delete(rowId);
        }
      });
    });

    // Bulk actions
    const applyBulkBtn = document.getElementById(`apply-bulk-${this.container.id}`);
    if (applyBulkBtn) {
      applyBulkBtn.addEventListener('click', () => {
        const select = document.getElementById(`bulk-action-${this.container.id}`);
        const action = select.value;
        if (action && this.selectedRows.size > 0 && this.options.onBulkAction) {
          this.options.onBulkAction(action, Array.from(this.selectedRows));
        }
      });
    }

    // Export CSV
    const exportBtn = document.getElementById(`export-csv-${this.container.id}`);
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportToCSV());
    }
  }

  /**
   * Export table data to CSV
   */
  exportToCSV() {
    const data = this.getFilteredData();
    const columns = this.options.columns.filter(col => col.visible !== false);
    
    // Create CSV header
    const header = columns.map(col => col.label).join(',');
    
    // Create CSV rows
    const rows = data.map(row => {
      return columns.map(col => {
        const value = row[col.key] || '';
        // Escape commas and quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',');
    });

    // Combine header and rows
    const csv = [header, ...rows].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.options.title || 'data'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Update table data
   */
  updateData(newData) {
    this.options.data = newData;
    this.currentPage = 1;
    this.selectedRows.clear();
    this.render();
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in other modules
window.DataTable = DataTable;
export default DataTable;
