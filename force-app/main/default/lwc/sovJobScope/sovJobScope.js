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
    @track searchTerm = '';
    @track scopeEntryColumns = [];
    @track emptyState = emptyState;
    @track defaultColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Type', fieldName: 'wfrecon__Type__c', type: 'text' },
        { label: 'Contract Value', fieldName: 'wfrecon__Contract_Value__c', type: 'currency' },
        { label: 'Completed %', fieldName: 'wfrecon__Completed_Percentage__c', type: 'percent' },
        { label: 'Status', fieldName: 'wfrecon__Scope_Entry_Status__c', type: 'text' }
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
     * Method Name: get displayedScopeEntries
     * @description: Process scope entries for table display without pagination
     */
    get displayedScopeEntries() {
        if (!this.filteredScopeEntries || this.filteredScopeEntries.length === 0) {
            return [];
        }

        const cols = this.tableColumns;
        return this.filteredScopeEntries.map(entry => {
            const row = { ...entry };
            row.isSelected = this.selectedRows.includes(entry.Id);
            row.recordUrl = `/lightning/r/${entry.Id}/view`;
            row.displayFields = cols.map(col => {
                const key = col.fieldName;
                let value = this.getFieldValue(entry, key);
                
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
     * Method Name: getFieldValue
     * @description: Get field value from nested object structure
     */
    getFieldValue(record, fieldName) {
        if (!record || !fieldName) return null;
        
        // Handle standard fields and namespaced fields directly on the record
        if (record.hasOwnProperty(fieldName)) {
            return record[fieldName];
        }
        
        // Handle relationship fields (Job__r.SomeField)
        if (fieldName.includes('.')) {
            const parts = fieldName.split('.');
            let current = record;
            for (let part of parts) {
                if (current && current[part] !== undefined) {
                    current = current[part];
                } else {
                    return null;
                }
            }
            return current;
        }
        
        return null;
    }

    /**
     * Method Name: get tableColumns
     * @description: Get table columns configuration
     */
    get tableColumns() {
        return this.scopeEntryColumns.length > 0 ? this.scopeEntryColumns : this.defaultColumns;
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
        return this.filteredScopeEntries.length > 0 && 
               this.filteredScopeEntries.every(entry => this.selectedRows.includes(entry.Id));
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
                    try {
                        const fieldsData = JSON.parse(result.fieldsData);
                        this.scopeEntryColumns = fieldsData.map(field => ({
                            label: field.label,
                            fieldName: field.fieldName,
                            type: this.getColumnType(field.fieldType)
                        }));
                    } catch (error) {
                        console.error('Error parsing fieldsData:', error);
                        // Use default columns if parsing fails
                        this.scopeEntryColumns = this.defaultColumns;
                    }
                } else {
                    // Use default columns if no configuration found
                    this.scopeEntryColumns = this.defaultColumns;
                }
            })
            .catch(error => {
                console.error('Error fetching configuration:', error);
                // Use default columns on error
                this.scopeEntryColumns = this.defaultColumns;
                this.showToast('Warning', 'Using default configuration due to error', 'warning');
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
                console.log('Raw Scope Entries Result:', result);
                this.scopeEntries = result || [];
                this.applyFilters();
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error fetching scope entries:', error);
                this.showToast('Error', 'Error fetching scope entries: ' + (error.body?.message || error.message), 'error');
                this.scopeEntries = [];
                this.filteredScopeEntries = [];
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
                
                // Search through all string fields in the entry
                const searchInObject = (obj, visited = new Set()) => {
                    if (!obj || typeof obj !== 'object' || visited.has(obj)) {
                        return false;
                    }
                    visited.add(obj);
                    
                    for (let key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            const value = obj[key];
                            if (value !== null && value !== undefined) {
                                if (typeof value === 'string' && value.toLowerCase().includes(searchLower)) {
                                    return true;
                                }
                                if (typeof value === 'number' && value.toString().includes(searchLower)) {
                                    return true;
                                }
                                if (typeof value === 'object' && searchInObject(value, visited)) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                };
                
                return searchInObject(entry);
            });
        } catch (error) {
            console.error('Error applying filters:', error);
            this.filteredScopeEntries = this.scopeEntries;
        }
    }

    /**
     * Method Name: handleSearch
     * @description: Handle search input change
     */
    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.applyFilters();
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
        
        this.newScopeEntry = { ...this.newScopeEntry, [field]: value };
    }

    /**
     * Method Name: validateScopeEntry
     * @description: Validate scope entry form data
     * @return: Object with isValid boolean and error message
     */
    validateScopeEntry() {
        const { name, contractValue, description } = this.newScopeEntry;
        
        if (!name || name.trim() === '') {
            return { isValid: false, message: 'Name is required' };
        }
        
        if (!contractValue || contractValue <= 0) {
            return { isValid: false, message: 'Contract Value is required and must be greater than 0' };
        }
        
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
                    this.fetchScopeEntries();
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to create scope entry: ' + (error.body?.message || error.message), 'error');
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
            this.selectedRows = this.filteredScopeEntries.map(entry => entry.Id);
        } else {
            this.selectedRows = [];
        }

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
                    this.fetchScopeEntries();
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to delete records: ' + (error.body?.message || error.message), 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleAddLocation
     * @description: Handle add location action - shows toast message
     */
    handleAddLocation(event) {
        const recordId = event.currentTarget.dataset.recordId;
        this.showToast('Info', `Add Location action clicked for record: ${recordId}`, 'info');
    }

    /**
     * Method Name: handleEditRecord
     * @description: Handle edit record action - shows toast message
     */
    handleEditRecord(event) {
        const recordId = event.currentTarget.dataset.recordId;
        this.showToast('Info', `Edit Record action clicked for record: ${recordId}`, 'info');
    }

    /**
     * Method Name: handleOpenChildRecords
     * @description: Handle open child records action - shows toast message
     */
    handleOpenChildRecords(event) {
        const recordId = event.currentTarget.dataset.recordId;
        this.showToast('Info', `Open Child Records action clicked for record: ${recordId}`, 'info');
    }
}
