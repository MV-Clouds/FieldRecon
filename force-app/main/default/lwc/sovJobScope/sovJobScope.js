import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getScopeEntries from '@salesforce/apex/SovJobScopeController.getScopeEntries';
import getScopeEntryConfiguration from '@salesforce/apex/SovJobScopeController.getScopeEntryConfiguration';
import createScopeEntry from '@salesforce/apex/SovJobScopeController.createScopeEntry';
import deleteScopeEntries from '@salesforce/apex/SovJobScopeController.deleteScopeEntries';
import { CurrentPageReference } from 'lightning/navigation';
import getScopeEntryProcesses from '@salesforce/apex/SovJobScopeController.getScopeEntryProcesses';

export default class SovJobScope extends NavigationMixin(LightningElement) {
    @track recordId;
    @track isLoading = true;
    @track scopeEntries = [];
    @track contractEntries = [];
    @track changeOrderEntries = [];
    @track filteredContractEntries = [];
    @track filteredChangeOrderEntries = [];
    @track searchTerm = '';
    @track scopeEntryColumns = [];
    @track accordionStyleApplied = false;
    @track activeSectionName = ['contractSection', 'changeOrderSection']; // Open both sections by default
    @track typeOptions = [
        { label: 'Contract', value: 'Contract' },
        { label: 'Change Order', value: 'Change Order' }
    ];
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
        description: '',
        type: 'Contract' // Default type
    };

    @track lastConfigUpdateTimestamp = 0; // Add this to track last update

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
     * Method Name: get contractSectionLabel
     * @description: Get contract section label with count
     */
    get contractSectionLabel() {
        const count = this.filteredContractEntries ? this.filteredContractEntries.length : 0;
        return `Contract (${count})`;
    }

    /**
     * Method Name: get changeOrderSectionLabel
     * @description: Get change order section label with count
     */
    get changeOrderSectionLabel() {
        const count = this.filteredChangeOrderEntries ? this.filteredChangeOrderEntries.length : 0;
        return `Change Order (${count})`;
    }

    /**
     * Method Name: get isContractDataAvailable
     * @description: Check if contract data is available
     */
    get isContractDataAvailable() {
        return this.filteredContractEntries && this.filteredContractEntries.length > 0;
    }

    /**
     * Method Name: get isChangeOrderDataAvailable
     * @description: Check if change order data is available
     */
    get isChangeOrderDataAvailable() {
        return this.filteredChangeOrderEntries && this.filteredChangeOrderEntries.length > 0;
    }

    /**
     * Method Name: get isAllContractSelected
     * @description: Check if all contract entries are selected
     */
    get isAllContractSelected() {
        return this.filteredContractEntries.length > 0 && 
                this.filteredContractEntries.every(entry => this.selectedRows.includes(entry.Id));
    }

    /**
     * Method Name: get isAllChangeOrderSelected
     * @description: Check if all change order entries are selected
     */
    get isAllChangeOrderSelected() {
        return this.filteredChangeOrderEntries.length > 0 && 
                this.filteredChangeOrderEntries.every(entry => this.selectedRows.includes(entry.Id));
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
     * Method Name: get displayedContractEntries
     * @description: Process contract entries for table display
     */
    get displayedContractEntries() {
        if (!this.filteredContractEntries || this.filteredContractEntries.length === 0) {
            return [];
        }
        return this.processEntriesForDisplay(this.filteredContractEntries);
    }

    /**
     * Method Name: get displayedChangeOrderEntries
     * @description: Process change order entries for table display
     */
    get displayedChangeOrderEntries() {
        if (!this.filteredChangeOrderEntries || this.filteredChangeOrderEntries.length === 0) {
            return [];
        }
        return this.processEntriesForDisplay(this.filteredChangeOrderEntries);
    }

    /**
     * Method Name: get totalContractValue
     * @description: Calculate total contract value across all scope entries
     */
    get totalContractValue() {
        if (!this.scopeEntries || this.scopeEntries.length === 0) return 0;
        
        return this.scopeEntries.reduce((total, entry) => {
            const contractValue = this.getFieldValue(entry, 'wfrecon__Contract_Value__c');
            return total + (contractValue || 0);
        }, 0);
    }

    /**
     * Method Name: get totalCompletedValue
     * @description: Calculate total completed value across all scope entries
     */
    get totalCompletedValue() {
        if (!this.scopeEntries || this.scopeEntries.length === 0) return 0;
        
        return this.scopeEntries.reduce((total, entry) => {
            const completedValue = this.getFieldValue(entry, 'wfrecon__Current_Complete_Value__c');
            return total + (completedValue || 0);
        }, 0);
    }

    /**
     * Method Name: get totalRemainingValue
     * @description: Calculate total remaining value (contract - completed)
     */
    get totalRemainingValue() {
        return Math.max(0, this.totalContractValue - this.totalCompletedValue);
    }

    /**
     * Method Name: get overallCompletionPercentage
     * @description: Calculate overall completion percentage
     */
    get overallCompletionPercentage() {
        if (this.totalContractValue === 0) return 0;
        
        return (this.totalCompletedValue / this.totalContractValue);
    }

    /**
     * Method Name: connectedCallback
     * @description: Load external CSS and fetch scope entries
     */
    connectedCallback() {        
        this.fetchScopeEntryConfiguration();
    }

    renderedCallback() {
        if(!this.accordionStyleApplied){
            this.applyAccordionStyling();
        }
    }

    applyAccordionStyling() {
        try {
            // Create style element if it doesn't exist
            const style = document.createElement('style');
            style.textContent = `
                .accordion-container .section-control {
                    background: #3396e5 !important;
                    color: white !important;
                    --slds-c-icon-color-foreground-default: #ffffff !important;
                }
            `;
            
            // Append to component's template
            const accordionContainer = this.template.querySelector('.accordion-container');
            if (accordionContainer) {
                accordionContainer.appendChild(style);
                this.accordionStyleApplied = true;
            }
            
        } catch (error) {
            console.error('Error applying accordion styling:', error);
        }
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
     * Method Name: handleConfigurationUpdated
     * @description: Handle configuration updated event from record config component
     */
    handleConfigurationUpdated(event) {
        console.log('Configuration updated event received:', event.detail);
        
        // Prevent duplicate processing using timestamp
        if (event.detail.timestamp && event.detail.timestamp === this.lastConfigUpdateTimestamp) {
            console.log('Duplicate event ignored');
            return;
        }
        
        if (event.detail.success && event.detail.featureName === 'ScopeEntry') {
            // Store timestamp to prevent duplicates
            this.lastConfigUpdateTimestamp = event.detail.timestamp;
            
            console.log('Processing configuration update...');
            
            // Stop event propagation
            event.stopPropagation();
            
            // Refresh the configuration and reload data
            this.isLoading = true;
            this.fetchScopeEntryConfiguration();
        }
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
     * Method Name: applyFilters
     * @description: Apply search filters and separate by type
     */
    applyFilters() {
        try {
            let filteredEntries = this.scopeEntries.filter(entry => {
                if (!this.searchTerm) return true;
                
                const searchLower = this.searchTerm.toLowerCase();
                
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

            // Separate entries by type
            this.filteredContractEntries = filteredEntries.filter(entry => 
                this.getFieldValue(entry, 'wfrecon__Type__c') === 'Contract'
            );
            
            this.filteredChangeOrderEntries = filteredEntries.filter(entry => 
                this.getFieldValue(entry, 'wfrecon__Type__c') === 'Change Order'
            );

            // Force reactivity for summary calculations
            this.template.querySelector('.summary-cards-container')?.setAttribute('data-update', Date.now().toString());
        } catch (error) {
            console.error('Error applying filters:', error);
            this.filteredContractEntries = [];
            this.filteredChangeOrderEntries = [];
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
            description: '',
            type: 'Contract'
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
     * @description: Validate scope entry form data including type
     * @return: Object with isValid boolean and error message
     */
    validateScopeEntry() {
        const { name, contractValue, description, type } = this.newScopeEntry;
        
        if (!type || type.trim() === '') {
            return { isValid: false, message: 'Type is required' };
        }
        
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
     * Method Name: processEntriesForDisplay
     * @description: Common method to process entries for display with nested table support
     */
    processEntriesForDisplay(entries) {
        const cols = this.tableColumns;
        return entries.map(entry => {
            const row = { ...entry };
            row.isSelected = this.selectedRows.includes(entry.Id);
            row.recordUrl = `/lightning/r/${entry.Id}/view`;
            
            // Preserve nested table state
            row.showProcessDetails = entry.showProcessDetails || false;
            row.processDetails = entry.processDetails || null;
            row.isLoadingProcesses = entry.isLoadingProcesses || false;
            
            row.displayFields = cols.map(col => {
                const key = col.fieldName;
                let value = this.getFieldValue(entry, key);
                
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                
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
     * Method Name: handleSectionToggle
     * @description: Handle accordion section toggle - Allow multiple sections to be open
     */
    handleSectionToggle(event) {
        this.activeSectionName = event.detail.openSections;
    }

    /**
     * Method Name: handleSelectAllContract
     * @description: Handle select all for contract entries
     */
    handleSelectAllContract(event) {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            const contractIds = this.filteredContractEntries.map(entry => entry.Id);
            this.selectedRows = [...new Set([...this.selectedRows, ...contractIds])];
        } else {
            const contractIds = this.filteredContractEntries.map(entry => entry.Id);
            this.selectedRows = this.selectedRows.filter(id => !contractIds.includes(id));
        }

        this.updateCheckboxes();
    }

    /**
     * Method Name: handleSelectAllChangeOrder
     * @description: Handle select all for change order entries
     */
    handleSelectAllChangeOrder(event) {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            const changeOrderIds = this.filteredChangeOrderEntries.map(entry => entry.Id);
            this.selectedRows = [...new Set([...this.selectedRows, ...changeOrderIds])];
        } else {
            const changeOrderIds = this.filteredChangeOrderEntries.map(entry => entry.Id);
            this.selectedRows = this.selectedRows.filter(id => !changeOrderIds.includes(id));
        }

        this.updateCheckboxes();
    }

    /**
     * Method Name: updateCheckboxes
     * @description: Update individual checkboxes after select all
     */
    updateCheckboxes() {
        setTimeout(() => {
            const checkboxes = this.template.querySelectorAll('[data-type="row-checkbox"]');
            checkboxes.forEach(checkbox => {
                const rowId = checkbox.dataset.rowId;
                checkbox.checked = this.selectedRows.includes(rowId);
            });
        }, 0);
    }

    /**
     * Method Name: handleTypeChange
     * @description: Handle type selection in modal
     */
    handleTypeChange(event) {
        this.newScopeEntry = { ...this.newScopeEntry, type: event.target.value };
    }

    /**
     * Method Name: handleToggleProcessDetails
     * @description: Toggle process details display and load data if needed
     */
    handleToggleProcessDetails(event) {
        const recordId = event.currentTarget.dataset.recordId;
        
        // Update contract entries
        this.filteredContractEntries = this.filteredContractEntries.map(entry => {
            if (entry.Id === recordId) {
                const updatedEntry = { ...entry };
                updatedEntry.showProcessDetails = !entry.showProcessDetails;
                
                // Load process details if expanding and not already loaded
                if (updatedEntry.showProcessDetails && !updatedEntry.processDetails) {
                    updatedEntry.isLoadingProcesses = true;
                    this.loadProcessDetails(recordId);
                }
                
                return updatedEntry;
            }
            return entry;
        });
        
        // Update change order entries
        this.filteredChangeOrderEntries = this.filteredChangeOrderEntries.map(entry => {
            if (entry.Id === recordId) {
                const updatedEntry = { ...entry };
                updatedEntry.showProcessDetails = !entry.showProcessDetails;
                
                // Load process details if expanding and not already loaded
                if (updatedEntry.showProcessDetails && !updatedEntry.processDetails) {
                    updatedEntry.isLoadingProcesses = true;
                    this.loadProcessDetails(recordId);
                }
                
                return updatedEntry;
            }
            return entry;
        });
        
        // Force re-render
        this.template.querySelector('.accordion-container')?.setAttribute('data-update', Date.now().toString());
    }

    /**
     * Method Name: loadProcessDetails
     * @description: Load process details for a specific scope entry
     */
    loadProcessDetails(scopeEntryId) {
        getScopeEntryProcesses({ scopeEntryId: scopeEntryId })
            .then(result => {
                this.updateProcessDetails(scopeEntryId, result || []);
            })
            .catch(error => {
                console.error('Error loading process details:', error);
                this.updateProcessDetails(scopeEntryId, []);
                this.showToast('Error', 'Failed to load process details: ' + (error.body?.message || error.message), 'error');
            });
    }

    /**
     * Method Name: handleAddProcess
     * @description: Handle add process button click
     */
    handleAddProcess(event) {
        const scopeEntryId = event.currentTarget.dataset.scopeEntryId;
        const scopeEntryName = event.currentTarget.dataset.scopeEntryName;
        this.showToast('Info', `Add Process clicked for ${scopeEntryName} (ID: ${scopeEntryId})`, 'info');
        // TODO: Implement add process modal/navigation
    }

    /**
     * Method Name: updateProcessDetails
     * @description: Update process details for a specific entry
     */
    updateProcessDetails(scopeEntryId, processDetails) {
        // Update contract entries
        this.filteredContractEntries = this.filteredContractEntries.map(entry => {
            if (entry.Id === scopeEntryId) {
                return {
                    ...entry,
                    processDetails: processDetails,
                    isLoadingProcesses: false
                };
            }
            return entry;
        });
        
        // Update change order entries
        this.filteredChangeOrderEntries = this.filteredChangeOrderEntries.map(entry => {
            if (entry.Id === scopeEntryId) {
                return {
                    ...entry,
                    processDetails: processDetails,
                    isLoadingProcesses: false
                };
            }
            return entry;
        });
        
        // Force re-render
        this.template.querySelector('.accordion-container')?.setAttribute('data-update', Date.now().toString());
    }
}
