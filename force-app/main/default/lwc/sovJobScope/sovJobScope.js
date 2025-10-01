import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getScopeEntries from '@salesforce/apex/SovJobScopeController.getScopeEntries';
import getScopeEntryConfiguration from '@salesforce/apex/SovJobScopeController.getScopeEntryConfiguration';
import createScopeEntry from '@salesforce/apex/SovJobScopeController.createScopeEntry';
import deleteScopeEntries from '@salesforce/apex/SovJobScopeController.deleteScopeEntries';
import emptyState from '@salesforce/resourceUrl/emptyState';
import { CurrentPageReference } from 'lightning/navigation';

export default class SovJobScope extends NavigationMixin(LightningElement) {
    @track recordId;
    @track isLoading = true;
    @track scopeEntries = [];
    @track filteredScopeEntries = [];
    @track pagedScopeEntries = [];
    @track currentPage = 1;
    @track pageSize = 10;  // Fixed page size
    @track searchTerm = '';
    @track visiblePages = 5;
    @track scopeEntryColumns = [];
    @track emptyState = emptyState;
    @track defaultColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Type', fieldName: 'Type__c', type: 'text' },
        { label: 'Contract Value', fieldName: 'Contract_Value__c', type: 'currency' },
        { label: 'Completed %', fieldName: 'Completed_Percentage__c', type: 'percent' },
        { label: 'Status', fieldName: 'Scope_Entry_Status__c', type: 'text' }
    ];

    // Modal and form properties
    @track showAddModal = false;
    @track isSubmitting = false;
    @track selectedRows = [];
    @track newScopeEntry = {
        name: '',
        contractValue: null,
        description: ''
    };

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
    }

    /**
     * Method Name: processTableData
     * @description: Process scope entries for table display
     */
    get processedScopeEntries() {
        if (!this.pagedScopeEntries || this.pagedScopeEntries.length === 0) {
            return [];
        }

        const cols = this.tableColumns;
        return this.pagedScopeEntries.map(entry => {
            const row = { ...entry };
            row.isSelected = this.selectedRows.includes(entry.Id);
            row.recordUrl = `/lightning/r/${entry.Id}/view`;
            row.displayFields = cols.map(col => {
                const key = col.fieldName;
                let value = entry[key];
                
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                
                // Handle currency fields - show $0.00 for empty currency fields
                let currencyValue = 0;
                if (col.type === 'currency') {
                    currencyValue = (value !== null && value !== undefined && !isNaN(value)) ? value : 0;
                }
                
                return {
                    key,
                    value: displayValue,
                    rawValue: value,
                    currencyValue: currencyValue,
                    hasValue: value !== null && value !== undefined && String(value).trim() !== '',
                    isNameField: key === 'Name',
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent'
                };
            });
            return row;
        });
    }

    /**
     * Method Name: get tableColumns
     * @description: Get table columns configuration
     */
    get tableColumns() {
        return this.scopeEntryColumns.length > 0 ? this.scopeEntryColumns : this.defaultColumns;
    }

    // Pagination getters and methods
    get totalPages() {
        return Math.ceil(this.filteredScopeEntries.length / this.pageSize);
    }

    get isFirstPage() {
        return this.currentPage === 1;
    }

    get isLastPage() {
        return this.currentPage === this.totalPages;
    }

    get showEllipsis() {
        return this.totalPages > this.visiblePages;
    }

    get pageNumbers() {
        try {
            const totalPages = this.totalPages;
            const currentPage = this.currentPage;
            const visiblePages = this.visiblePages;

            let pages = [];

            if (totalPages <= visiblePages) {
                for (let i = 1; i <= totalPages; i++) {
                    pages.push({
                        number: i,
                        isEllipsis: false,
                        className: `pagination-button ${i === currentPage ? 'active' : ''}`
                    });
                }
            } else {
                pages.push({
                    number: 1,
                    isEllipsis: false,
                    className: `pagination-button ${currentPage === 1 ? 'active' : ''}`
                });

                if (currentPage > 3) {
                    pages.push({ isEllipsis: true });
                }

                let start = Math.max(2, currentPage - 1);
                let end = Math.min(currentPage + 1, totalPages - 1);

                for (let i = start; i <= end; i++) {
                    pages.push({
                        number: i,
                        isEllipsis: false,
                        className: `pagination-button ${i === currentPage ? 'active' : ''}`
                    });
                }

                if (currentPage < totalPages - 2) {
                    pages.push({ isEllipsis: true });
                }

                pages.push({
                    number: totalPages,
                    isEllipsis: false,
                    className: `pagination-button ${currentPage === totalPages ? 'active' : ''}`
                });
            }

            return pages;
        } catch (error) {
            // errorDebugger('sovJobScope', 'pageNumbers', error, 'warn', 'Error in pageNumbers');
            return [];
        }
    }

    /**
     * Method Name: get hasSelectedRows
     * @description: Check if any rows are selected
     */
    get hasSelectedRows() {
        return this.selectedRows.length > 0;
    }

    /**
     * Method Name: get isAllSelected
     * @description: Check if all visible rows are selected
     */
    get isAllSelected() {
        return this.pagedScopeEntries.length > 0 && 
               this.pagedScopeEntries.every(entry => this.selectedRows.includes(entry.Id));
    }

    /**
     * Method Name: get isDeleteDisabled
     * @description: Check if delete button should be disabled
     */
    get isDeleteDisabled() {
        return this.selectedRows.length === 0;
    }

    /**
     * Method Name: get isDataAvailable
     * @description: Check if data is available to display
     */
    get isDataAvailable() {
        return this.filteredScopeEntries && this.filteredScopeEntries.length > 0;
    }

    /**
     * Method Name: get nameCharacterCount
     * @description: Get current character count for name field
     */
    get nameCharacterCount() {
        return this.newScopeEntry.name ? this.newScopeEntry.name.length : 0;
    }

    /**
     * Method Name: get descriptionCharacterCount
     * @description: Get current character count for description field
     */
    get descriptionCharacterCount() {
        return this.newScopeEntry.description ? this.newScopeEntry.description.length : 0;
    }

    /**
     * Method Name: get selectedRecordsCount
     * @description: Get count of selected records
     */
    get selectedRecordsCount() {
        return this.selectedRows.length;
    }

    /**
     * Method Name: get selectedRecordsText
     * @description: Get text for selected records count
     */
    get selectedRecordsText() {
        const count = this.selectedRecordsCount;
        return count === 1 ? `${count} record selected` : `${count} records selected`;
    }

    /**
     * Method Name: get showSelectedCount
     * @description: Show selected count when records are selected
     */
    get showSelectedCount() {
        return this.selectedRecordsCount > 0;
    }

    /**
     * Method Name: connectedCallback
     * @description: Load external CSS and fetch scope entries
     */
    connectedCallback() {        
        this.fetchScopeEntryConfiguration();
    }

    /**
     * Method Name: fetchScopeEntryConfiguration
     * @description: Fetch configuration and then load scope entries
     */
    fetchScopeEntryConfiguration() {
        getScopeEntryConfiguration()
            .then(result => {
                if (result && result.fieldsData) {
                    const fieldsData = JSON.parse(result.fieldsData);
                    this.scopeEntryColumns = fieldsData.map(field => ({
                        label: field.label,
                        fieldName: field.fieldName,
                        type: this.getColumnType(field.fieldType)
                    }));
                    // this.pageSize = result.pageSize || 10;
                }
            })
            .catch(error => {
                this.showToast('Error', 'Error fetching configuration', 'error');
            }).finally(() => {
                this.fetchScopeEntries();
            });
    }

    /**
     * Method Name: fetchScopeEntries
     * @description: Fetch scope entries for the job
     */
    fetchScopeEntries() {
        console.log('Record ID:', this.recordId);
        
        if (!this.recordId) {
            this.isLoading = false;
            return;
        }

        getScopeEntries({ jobId: this.recordId })
            .then(result => {
                this.scopeEntries = result || [];
                this.applyFilters();
                this.isLoading = false;
            })
            .catch(error => {
                this.showToast('Error', 'Error fetching scope entries', 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: getColumnType
     * @description: Convert field type to column type
     */
    getColumnType(fieldType) {
        switch ((fieldType || '').toUpperCase()) {
            case 'CURRENCY':
                return 'currency';
            case 'PERCENT':
                return 'percent';
            case 'NUMBER':
                return 'number';
            case 'DATE':
                return 'date';
            case 'DATETIME':
                return 'date';
            case 'EMAIL':
                return 'email';
            case 'PHONE':
                return 'phone';
            case 'URL':
                return 'url';
            case 'BOOLEAN':
                return 'boolean';
            default:
                return 'text';
        }
    }

    /**
     * Method Name: applyFilters
     * @description: Apply search filters to scope entries
     */
    applyFilters() {
        try {
            this.filteredScopeEntries = this.scopeEntries.filter(entry => {
                if (!this.searchTerm) return true;
                
                const searchLower = this.searchTerm.toLowerCase();
                return Object.values(entry).some(value => 
                    value && value.toString().toLowerCase().includes(searchLower)
                );
            });

            this.updatePagedData();
        } catch (error) {
            // errorDebugger('sovJobScope', 'applyFilters', error, 'warn', 'Error applying filters');
        }
    }

    /**
     * Method Name: updatePagedData
     * @description: Update paged data based on current page and page size
     */
    updatePagedData() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        this.pagedScopeEntries = this.filteredScopeEntries.slice(startIndex, endIndex);
    }

    /**
     * Method Name: handleSearch
     * @description: Handle search input change
     */
    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.currentPage = 1;
        this.applyFilters();
    }

    /**
     * Method Name: handlePrevious
     * @description: Handle previous button click
     */
    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePagedData();
        }
    }

    /**
     * Method Name: handleNext
     * @description: Handle next button click
     */
    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.updatePagedData();
        }
    }

    /**
     * Method Name: handlePageChange
     * @description: Handle page number click
     */
    handlePageChange(event) {
        const selectedPage = parseInt(event.target.getAttribute('data-id'), 10);
        if (selectedPage !== this.currentPage) {
            this.currentPage = selectedPage;
            this.updatePagedData();
        }
    }

    /**
     * Method Name: openConfiguration
     * @description: Open configuration modal
     */
    openConfiguration() {
        // This will open the configuration modal
        const configModal = this.template.querySelector('c-record-config-body-cmp');
        if (configModal) {
            configModal.openModal();
        }
    }

    /**
     * Method Name: showToast
     * @description: Show toast message
     */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }

    /**
     * Method Name: handleRefresh
     * @description: Refresh table data
     */
    handleRefresh() {
        this.isLoading = true;
        this.selectedRows = [];
        this.fetchScopeEntries();
    }

    /**
     * Method Name: handleAddScopeEntry
     * @description: Open add scope entry modal
     */
    handleAddScopeEntry() {
        this.newScopeEntry = {
            name: '',
            contractValue: null,
            description: ''
        };
        this.showAddModal = true;
    }

    /**
     * Method Name: handleCloseModal
     * @description: Close add scope entry modal
     */
    handleCloseModal() {
        this.showAddModal = false;
        this.newScopeEntry = {
            name: '',
            contractValue: null,
            description: ''
        };
    }

    /**
     * Method Name: handleInputChange
     * @description: Handle input changes in the modal form
     */
    handleInputChange(event) {
        const field = event.target.dataset.field;
        let value = event.target.type === 'number' ? parseFloat(event.target.value) : event.target.value;
        
        // Don't trim during input - only trim when saving
        this.newScopeEntry = { ...this.newScopeEntry, [field]: value };
    }

    /**
     * Method Name: validateScopeEntry
     * @description: Validate scope entry form data
     * @return: Object with isValid boolean and error message
     */
    validateScopeEntry() {
        const { name, contractValue, description } = this.newScopeEntry;
        
        // Check if name is empty after trim
        if (!name || name.trim() === '') {
            return { isValid: false, message: 'Name is required' };
        }
        
        // Check if contract value is empty or invalid
        if (!contractValue || contractValue <= 0) {
            return { isValid: false, message: 'Contract Value is required and must be greater than 0' };
        }
        
        // Check description length (max 255 characters) if provided
        if (description && description.trim().length > 255) {
            return { isValid: false, message: 'Description cannot be longer than 255 characters' };
        }
        
        return { isValid: true, message: '' };
    }

    /**
     * Method Name: handleSaveScopeEntry
     * @description: Save new scope entry with validation
     */
    handleSaveScopeEntry() {
        // Validate form data
        const validation = this.validateScopeEntry();
        if (!validation.isValid) {
            this.showToast('Error', validation.message, 'error');
            return;
        }

        this.isSubmitting = true;
        
        const scopeEntryData = {
            name: this.newScopeEntry.name.trim(),
            contractValue: this.newScopeEntry.contractValue,
            description: this.newScopeEntry.description ? this.newScopeEntry.description.trim() : '',
            jobId: this.recordId
        };

        createScopeEntry({ scopeEntryData })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Scope entry created successfully', 'success');
                    this.handleCloseModal();
                    this.fetchScopeEntries(); // Refresh the table
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to create scope entry: ' + error.body?.message || error.message, 'error');
            })
            .finally(() => {
                this.isSubmitting = false;
            });
    }

    /**
     * Method Name: handleRowSelection
     * @description: Handle row selection
     */
    handleRowSelection(event) {
        const rowId = event.target.dataset.rowId;
        const isChecked = event.target.checked;

        if (isChecked) {
            this.selectedRows = [...this.selectedRows, rowId];
        } else {
            this.selectedRows = this.selectedRows.filter(id => id !== rowId);
        }
    }

    /**
     * Method Name: handleSelectAll
     * @description: Handle select all checkbox
     */
    handleSelectAll(event) {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            this.selectedRows = this.pagedScopeEntries.map(entry => entry.Id);
        } else {
            this.selectedRows = [];
        }

        // Update individual checkboxes
        const checkboxes = this.template.querySelectorAll('[data-type="row-checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
        });
    }

    /**
     * Method Name: handleMassDelete
     * @description: Handle mass delete of selected scope entries
     */
    handleMassDelete() {
        if (this.selectedRows.length === 0) {
            this.showToast('Warning', 'Please select at least one record to delete', 'warning');
            return;
        }

        this.isLoading = true;
            
        deleteScopeEntries({ scopeEntryIds: this.selectedRows })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', `${this.selectedRows.length} record(s) deleted successfully`, 'success');
                    this.selectedRows = [];
                    this.fetchScopeEntries(); // Refresh the table
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to delete records: ' + error.body?.message || error.message, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleAddLocation
     * @description: Handle add location action
     */
    handleAddLocation(event) {
        const recordId = event.currentTarget.dataset.recordId;
        this.showToast('Info', `Add Location functionality for record: ${recordId}`, 'info');
        // Add your location adding logic here
    }

    /**
     * Method Name: handleEditRecord
     * @description: Handle edit record action
     */
    handleEditRecord(event) {
        const recordId = event.currentTarget.dataset.recordId;
        
        // Navigate to edit page
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'edit'
            }
        });
    }

    /**
     * Method Name: handleOpenChildRecords
     * @description: Handle open child records action
     */
    handleOpenChildRecords(event) {
        const recordId = event.currentTarget.dataset.recordId;
        this.showToast('Info', `Open Child Records functionality for record: ${recordId}`, 'info');
        // Add your child records navigation logic here
    }
}
