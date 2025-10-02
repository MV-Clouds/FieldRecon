import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getScopeEntries from '@salesforce/apex/SovJobScopeController.getScopeEntries';
import getScopeEntryConfiguration from '@salesforce/apex/SovJobScopeController.getScopeEntryConfiguration';
import createScopeEntry from '@salesforce/apex/SovJobScopeController.createScopeEntry';
import deleteScopeEntries from '@salesforce/apex/SovJobScopeController.deleteScopeEntries';
import { CurrentPageReference } from 'lightning/navigation';
import getScopeEntryProcesses from '@salesforce/apex/SovJobScopeController.getScopeEntryProcesses';
import createScopeEntryProcess from '@salesforce/apex/SovJobScopeController.createScopeEntryProcess';
import getProcessLibraryRecords from '@salesforce/apex/SovJobScopeController.getProcessLibraryRecords';
import createScopeEntryProcessesFromLibrary from '@salesforce/apex/SovJobScopeController.createScopeEntryProcessesFromLibrary';
import getProcessTypes from '@salesforce/apex/SovJobScopeController.getProcessTypes';

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

    // Process table columns configuration
    @track processTableColumns = [
        { 
            label: 'Process', 
            fieldName: 'Name', 
            type: 'url',
            isNameField: true
        },
        { 
            label: 'Sequence', 
            fieldName: 'wfrecon__Sequence__c', 
            type: 'text'
        },
        { 
            label: 'Process Name', 
            fieldName: 'wfrecon__Process_Name__c', 
            type: 'text'
        },
        { 
            label: 'Step Value', 
            fieldName: 'wfrecon__Contract_Price__c', 
            type: 'currency'
        },
        { 
            label: '% Complete', 
            fieldName: 'wfrecon__Completed_Percentage__c', 
            type: 'percent'
        },
        { 
            label: 'Current Complete Value', 
            fieldName: 'wfrecon__Current_Complete_Value__c', 
            type: 'currency'
        },
        { 
            label: 'Process MH', 
            fieldName: 'wfrecon__Process_Type__c', 
            type: 'number'
        },
        { 
            label: 'Weight', 
            fieldName: 'wfrecon__Weight__c', 
            type: 'number'
        }
    ];

    // Modal and form properties
    @track showAddModal = false;
    @track isSubmitting = false;
    @track selectedRows = [];
    @track selectedProcesses = []; // Simplified process selection
    @track newScopeEntry = {
        name: '',
        contractValue: null,
        description: '',
        type: 'Contract' // Default type
    };

    @track lastConfigUpdateTimestamp = 0; // Add this to track last update

    // Process Modal Properties
    @track showAddProcessModal = false;
    @track isProcessSubmitting = false;
    @track selectedScopeEntryId = '';
    @track selectedScopeEntryName = '';
    @track newProcess = {
        processName: '',
        sequence: null,
        processType: '',
        weightage: null,
        measurementType: ''
    };

    // Process Type Options
    @track processTypeOptions = [
        { label: 'Overlay', value: 'Overlay' },
        { label: 'Grinding', value: 'Grinding' },
        { label: 'Surface Prep', value: 'Surface Prep' },
        { label: 'Coatings', value: 'Coatings' },
        { label: 'Joints', value: 'Joints' },
        { label: 'Polishing', value: 'Polishing' },
        { label: 'Generic', value: 'Generic' }
    ];

    // Measurement Type Options
    @track measurementTypeOptions = [
        { label: 'Crack Count', value: 'Crack Count' },
        { label: 'Square Feet', value: 'Square Feet' },
        { label: 'Distressed Edge', value: 'Distressed Edge' },
        { label: 'Distressed Joint', value: 'Distressed Joint' },
        { label: 'Misc. Defect Count', value: 'Misc. Defect Count' }
    ];

    // Process Library Modal Properties - Simplified
    @track showProcessLibraryModal = false;
    @track isProcessLibrarySubmitting = false;
    @track processLibraryRecords = [];
    @track processLibraryDisplayRecords = []; // New: This will hold the display data with selection states
    @track selectedProcessLibraryIds = [];
    @track processLibrarySearchTerm = '';
    @track selectedProcessCategory = '';

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
    }

    @track processTableUpdateTime = 0;

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
     * Method Name: get processNameCharacterCount
     * @description: Get current character count for process name field
     */
    get processNameCharacterCount() {
        return this.newProcess.processName ? this.newProcess.processName.length : 0;
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
     * Method Name: get isAllProcessesSelectedForEntry
     * @description: Check if all processes are selected for current entry (used in template)
     */
    get isAllProcessesSelectedForEntry() {
        // This will be evaluated for each entry in the template
        return (scopeEntryId) => this.isAllProcessesSelectedForEntry(scopeEntryId);
    }

    /**
     * Method Name: get hasSelectedProcessLibrary
     * @description: Check if any process library records are selected
     */
    get hasSelectedProcessLibrary() {
        return this.selectedProcessLibraryIds.length > 0;
    }

    /**
     * Method Name: get isAllProcessLibrarySelected
     * @description: Check if all visible process library records are selected
     */
    get isAllProcessLibrarySelected() {
        return this.processLibraryDisplayRecords.length > 0 && 
               this.processLibraryDisplayRecords.every(process => process.isSelected);
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
                    margin-bottom: 4px;
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
     * @description: Apply search filters and separate by type while preserving selections
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

            // Store current process details and states before updating
            const currentProcessStates = new Map();
            
            // Collect current states from both contract and change order entries
            [...(this.filteredContractEntries || []), ...(this.filteredChangeOrderEntries || [])].forEach(entry => {
                if (entry.processDetails || entry.showProcessDetails !== undefined) {
                    currentProcessStates.set(entry.Id, {
                        processDetails: entry.processDetails,
                        showProcessDetails: entry.showProcessDetails,
                        isLoadingProcesses: entry.isLoadingProcesses
                    });
                }
            });

            // Separate entries by type
            this.filteredContractEntries = filteredEntries.filter(entry => 
                this.getFieldValue(entry, 'wfrecon__Type__c') === 'Contract'
            );
            
            this.filteredChangeOrderEntries = filteredEntries.filter(entry => 
                this.getFieldValue(entry, 'wfrecon__Type__c') === 'Change Order'
            );

            // Restore process states and update selections
            [...this.filteredContractEntries, ...this.filteredChangeOrderEntries].forEach(entry => {
                const savedState = currentProcessStates.get(entry.Id);
                if (savedState) {
                    entry.showProcessDetails = savedState.showProcessDetails;
                    entry.isLoadingProcesses = savedState.isLoadingProcesses;
                    
                    if (savedState.processDetails) {
                        // Reprocess to maintain current selections
                        entry.processDetails = this.processProcessDetailsForDisplay(
                            savedState.processDetails.map(p => ({ ...p, isSelected: undefined }))
                        );
                    }
                }
            });

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
        this.selectedProcesses = []; // Clear selected processes too
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
     * @description: Handle all input changes using data-field and data-type attributes
     */
    handleInputChange(event) {
        const field = event.target.dataset.field;
        const type = event.target.dataset.type || 'scopeEntry'; // default to scopeEntry
        let value = event.target.type === 'number' ? parseFloat(event.target.value) : event.target.value;
        
        if (type === 'scopeEntry') {
            this.newScopeEntry = { ...this.newScopeEntry, [field]: value };
        } else if (type === 'process') {
            this.newProcess = { ...this.newProcess, [field]: value };
        }
    }

    /**
     * Method Name: handleSelectChange
     * @description: Handle all select/combobox changes using data-field and data-type attributes
     */
    handleSelectChange(event) {
        const field = event.target.dataset.field;
        const type = event.target.dataset.type || 'scopeEntry'; // default to scopeEntry
        const value = event.target.value;
        
        if (type === 'scopeEntry') {
            this.newScopeEntry = { ...this.newScopeEntry, [field]: value };
        } else if (type === 'process') {
            this.newProcess = { ...this.newProcess, [field]: value };
        }
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
     * Method Name: processProcessDetailsForDisplay
     * @description: Process process details for nested table display
     */
    processProcessDetailsForDisplay(processDetails) {
        if (!processDetails || processDetails.length === 0) {
            return [];
        }

        return processDetails.map(process => {
            const row = { ...process };
            row.recordUrl = `/lightning/r/${process.Id}/view`;
            // Preserve selection state from selectedProcesses array
            row.isSelected = this.selectedProcesses.includes(process.Id);
            
            row.displayFields = this.processTableColumns.map(col => {
                const key = col.fieldName;
                let value = this.getFieldValue(process, key);
                
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                
                // Handle currency fields
                let currencyValue = 0;
                if (col.type === 'currency') {
                    currencyValue = (value !== null && value !== undefined && !isNaN(value)) ? value : 0;
                }

                // Handle percentage fields
                let percentValue = 0;
                if (col.type === 'percent') {
                    percentValue = (value !== null && value !== undefined && !isNaN(value)) ? value : 0;
                }

                // Handle number fields  
                let numberValue = 0;
                if (col.type === 'number') {
                    numberValue = (value !== null && value !== undefined && !isNaN(value)) ? value : 0;
                }
                
                return {
                    key,
                    value: displayValue,
                    rawValue: value,
                    currencyValue: currencyValue,
                    percentValue: percentValue,
                    numberValue: numberValue,
                    hasValue: value !== null && value !== undefined && String(value).trim() !== '',
                    isNameField: col.isNameField || false,
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent',
                    isNumber: col.type === 'number',
                    isUrl: col.type === 'url'
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
     * @description: Handle add manual process button click
     */
    handleAddProcess(event) {
        this.selectedScopeEntryId = event.currentTarget.dataset.scopeEntryId;
        console.log('Selected Scope Entry ID for adding process:', this.selectedScopeEntryId);  
        
        this.selectedScopeEntryName = event.currentTarget.dataset.scopeEntryName;
        
        // Reset form
        this.newProcess = {
            processName: '',
            sequence: null,
            processType: '',
            weightage: null,
            measurementType: ''
        };
        
        this.showAddProcessModal = true;
    }

    /**
     * Method Name: handleCloseProcessModal
     * @description: Close add process modal
     */
    handleCloseProcessModal() {
        this.showAddProcessModal = false;
        this.selectedScopeEntryName = '';
        this.newProcess = {
            processName: '',
            sequence: null,
            processType: '',
            weightage: null,
            measurementType: ''
        };
    }

    /**
     * Method Name: validateProcess
     * @description: Validate process form data
     * @return: Object with isValid boolean and error message
     */
    validateProcess() {
        const { processName, sequence, processType, weightage, measurementType } = this.newProcess;
        
        if (!processName || processName.trim() === '') {
            return { isValid: false, message: 'Process Name is required' };
        }
        
        if (processName.trim().length > 80) {
            return { isValid: false, message: 'Process Name cannot be longer than 80 characters' };
        }
        
        if (!sequence || sequence <= 0 || sequence > 9999) {
            return { isValid: false, message: 'Sequence is required and must be between 1 and 9999' };
        }
        
        if (!processType || processType.trim() === '') {
            return { isValid: false, message: 'Process Type is required' };
        }
        
        if (!weightage || weightage <= 0 || weightage > 9999) {
            return { isValid: false, message: 'Weightage is required and must be between 0 and 9999' };
        }
        
        if (!measurementType || measurementType.trim() === '') {
            return { isValid: false, message: 'Measurement Type is required' };
        }
        
        return { isValid: true, message: '' };
    }

    /**
     * Method Name: handleSaveProcess
     * @description: Save new process with validation
     */
    handleSaveProcess() {
        const validation = this.validateProcess();
        if (!validation.isValid) {
            this.showToast('Error', validation.message, 'error');
            return;
        }

        this.isProcessSubmitting = true;
        
        const processData = {
            processName: this.newProcess.processName.trim(),
            sequence: this.newProcess.sequence,
            processType: this.newProcess.processType,
            weightage: this.newProcess.weightage,
            measurementType: this.newProcess.measurementType,
            scopeEntryId: this.selectedScopeEntryId
        };

        createScopeEntryProcess({ processData })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Manual process created successfully', 'success');
                    this.handleCloseProcessModal();
                    
                    // Refresh the process details for this scope entry while preserving selections
                    this.refreshProcessDetails(this.selectedScopeEntryId);
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to create process: ' + (error.body?.message || error.message), 'error');
            })
            .finally(() => {
                this.isProcessSubmitting = false;
                this.selectedScopeEntryId = '';
            });
    }

    /**
     * Method Name: updateProcessDetails
     * @description: Update process details for a specific entry while preserving selections
     */
    updateProcessDetails(scopeEntryId, processDetails) {
        // Process the details for display while preserving selections
        const processedDetails = this.processProcessDetailsForDisplay(processDetails);
        
        // Update contract entries
        this.filteredContractEntries = this.filteredContractEntries.map(entry => {
            if (entry.Id === scopeEntryId) {
                return {
                    ...entry,
                    processDetails: processedDetails,
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
                    processDetails: processedDetails,
                    isLoadingProcesses: false
                };
            }
            return entry;
        });
    }

    /**
     * Method Name: handleProcessRowSelection
     * @description: Handle individual process row selection
     */
    handleProcessRowSelection(event) {
        const processId = event.target.dataset.processId;
        const isChecked = event.target.checked;

        if (isChecked) {
            this.selectedProcesses = [...this.selectedProcesses, processId];
        } else {
            this.selectedProcesses = this.selectedProcesses.filter(id => id !== processId);
        }

        // Force re-render to update select all checkboxes
        this.updateDisplayedEntries();
    }

    /**
     * Method Name: handleSelectAllProcesses
     * @description: Handle select all processes for a specific scope entry
     */
    handleSelectAllProcesses(event) {
        const scopeEntryId = event.target.dataset.scopeEntryId;
        const isChecked = event.target.checked;
        
        // Get all process IDs for this scope entry
        const entry = this.getEntryById(scopeEntryId);
        if (!entry || !entry.processDetails) return;
        
        const processIds = entry.processDetails.map(process => process.Id);
        
        if (isChecked) {
            // Add all process IDs that aren't already selected
            const newSelections = processIds.filter(id => !this.selectedProcesses.includes(id));
            this.selectedProcesses = [...this.selectedProcesses, ...newSelections];
        } else {
            // Remove all process IDs for this scope entry
            this.selectedProcesses = this.selectedProcesses.filter(id => !processIds.includes(id));
        }

        // Force re-render
        this.updateDisplayedEntries();
    }

    /**
     * Method Name: updateDisplayedEntries
     * @description: Force update of displayed entries to reflect selection changes
     */
    updateDisplayedEntries() {
        // Re-process contract entries to update selection states
        if (this.filteredContractEntries.length > 0) {
            this.filteredContractEntries = this.filteredContractEntries.map(entry => {
                if (entry.processDetails) {
                    entry.processDetails = this.processProcessDetailsForDisplay(entry.processDetails);
                }
                return entry;
            });
        }

        // Re-process change order entries to update selection states
        if (this.filteredChangeOrderEntries.length > 0) {
            this.filteredChangeOrderEntries = this.filteredChangeOrderEntries.map(entry => {
                if (entry.processDetails) {
                    entry.processDetails = this.processProcessDetailsForDisplay(entry.processDetails);
                }
                return entry;
            });
        }
    }

    /**
     * Method Name: getEntryById
     * @description: Get entry by ID from both contract and change order entries
     */
    getEntryById(scopeEntryId) {
        const contractEntry = this.filteredContractEntries.find(entry => entry.Id === scopeEntryId);
        if (contractEntry) return contractEntry;
        
        const changeOrderEntry = this.filteredChangeOrderEntries.find(entry => entry.Id === scopeEntryId);
        return changeOrderEntry;
    }

    /**
     * Method Name: handleAddProcessFromLibrary
     * @description: Handle add process from library button click
     */
    handleAddProcessFromLibrary(event) {
        this.selectedScopeEntryId = event.currentTarget.dataset.scopeEntryId;
        this.selectedScopeEntryName = event.currentTarget.dataset.scopeEntryName;
        
        // Reset selections
        this.selectedProcessLibraryIds = [];
        this.processLibrarySearchTerm = '';
        this.selectedProcessCategory = '';
        
        // Load process library records and types
        this.loadProcessLibraryData();
        
        this.showProcessLibraryModal = true;
    }

    /**
     * Method Name: loadProcessLibraryData
     * @description: Load process library records and process types
     */
    loadProcessLibraryData() {
        // Load process types for filter
        getProcessTypes()
            .then(result => {
                this.processTypeOptions = result || [];
            })
            .catch(error => {
                console.error('Error loading process types:', error);
                this.processTypeOptions = [];
            });

        // Load process library records
        getProcessLibraryRecords()
            .then(result => {
                this.processLibraryRecords = result || [];
                this.applyProcessLibraryFilters(); // Apply filters after loading
            })
            .catch(error => {
                console.error('Error loading process library records:', error);
                this.showToast('Error', 'Failed to load process library: ' + (error.body?.message || error.message), 'error');
                this.processLibraryRecords = [];
                this.processLibraryDisplayRecords = [];
            });
    }

    /**
     * Method Name: applyProcessLibraryFilters
     * @description: Apply filters and maintain selection states
     */
    applyProcessLibraryFilters() {
        if (!this.processLibraryRecords || this.processLibraryRecords.length === 0) {
            this.processLibraryDisplayRecords = [];
            return;
        }

        let filtered = [...this.processLibraryRecords];

        // Filter by category if selected
        if (this.selectedProcessCategory) {
            filtered = filtered.filter(process => 
                process.wfrecon__Process_Type__c === this.selectedProcessCategory
            );
        }

        // Filter by search term
        if (this.processLibrarySearchTerm) {
            const searchLower = this.processLibrarySearchTerm.toLowerCase();
            filtered = filtered.filter(process => {
                return (process.Name && process.Name.toLowerCase().includes(searchLower)) ||
                       (process.wfrecon__Process_Name__c && process.wfrecon__Process_Name__c.toLowerCase().includes(searchLower)) ||
                       (process.wfrecon__Process_Type__c && process.wfrecon__Process_Type__c.toLowerCase().includes(searchLower)) ||
                       (process.wfrecon__Measurement_Type__c && process.wfrecon__Measurement_Type__c.toLowerCase().includes(searchLower));
            });
        }

        // Create display records with selection state
        this.processLibraryDisplayRecords = filtered.map(process => ({
            ...process,
            isSelected: this.selectedProcessLibraryIds.includes(process.Id)
        }));
    }

    /**
     * Method Name: handleCloseProcessLibraryModal
     * @description: Close process library modal
     */
    handleCloseProcessLibraryModal() {
        this.showProcessLibraryModal = false;
        this.selectedScopeEntryId = '';
        this.selectedScopeEntryName = '';
        this.selectedProcessLibraryIds = [];
        this.processLibrarySearchTerm = '';
        this.selectedProcessCategory = '';
        this.processLibraryRecords = [];
        this.processLibraryDisplayRecords = []; // Clear display records
        this.processTypeOptions = [];
    }

    /**
     * Method Name: handleProcessLibrarySearch
     * @description: Handle search in process library modal
     */
    handleProcessLibrarySearch(event) {
        this.processLibrarySearchTerm = event.target.value;
        this.applyProcessLibraryFilters(); // Re-apply filters
    }

    /**
     * Method Name: handleProcessCategoryFilter
     * @description: Handle category filter change
     */
    handleProcessCategoryFilter(event) {
        this.selectedProcessCategory = event.target.value;
        this.applyProcessLibraryFilters(); // Re-apply filters
    }

    /**
     * Method Name: handleProcessLibrarySelection
     * @description: Handle individual process library record selection
     */
    handleProcessLibrarySelection(event) {
        const processId = event.target.dataset.processId;
        const isChecked = event.target.checked;

        if (isChecked) {
            if (!this.selectedProcessLibraryIds.includes(processId)) {
                this.selectedProcessLibraryIds = [...this.selectedProcessLibraryIds, processId];
            }
        } else {
            this.selectedProcessLibraryIds = this.selectedProcessLibraryIds.filter(id => id !== processId);
        }

        // Update the display record's selection state
        this.processLibraryDisplayRecords = this.processLibraryDisplayRecords.map(process => ({
            ...process,
            isSelected: this.selectedProcessLibraryIds.includes(process.Id)
        }));
    }

    /**
     * Method Name: handleSelectAllProcessLibrary
     * @description: Handle select all process library records
     */
    handleSelectAllProcessLibrary(event) {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            // Add all visible process IDs to selection
            const visibleIds = this.processLibraryDisplayRecords.map(process => process.Id);
            const newSelections = visibleIds.filter(id => !this.selectedProcessLibraryIds.includes(id));
            this.selectedProcessLibraryIds = [...this.selectedProcessLibraryIds, ...newSelections];
        } else {
            // Remove all visible process IDs from selection
            const visibleIds = this.processLibraryDisplayRecords.map(process => process.Id);
            this.selectedProcessLibraryIds = this.selectedProcessLibraryIds.filter(id => !visibleIds.includes(id));
        }

        // Update display records
        this.processLibraryDisplayRecords = this.processLibraryDisplayRecords.map(process => ({
            ...process,
            isSelected: this.selectedProcessLibraryIds.includes(process.Id)
        }));
    }

    /**
     * Method Name: handleSaveProcessesFromLibrary
     * @description: Save selected processes from library
     */
    handleSaveProcessesFromLibrary() {
        if (this.selectedProcessLibraryIds.length === 0) {
            this.showToast('Warning', 'Please select at least one process', 'warning');
            return;
        }

        this.isProcessLibrarySubmitting = true;
        
        const processData = {
            scopeEntryId: this.selectedScopeEntryId,
            selectedProcessIds: this.selectedProcessLibraryIds
        };

        createScopeEntryProcessesFromLibrary({ processData })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', `${this.selectedProcessLibraryIds.length} processes added successfully`, 'success');
                    this.handleCloseProcessLibraryModal();
                    
                    // Refresh the process details for this scope entry while preserving selections
                    this.refreshProcessDetails(this.selectedScopeEntryId);
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to add processes: ' + (error.body?.message || error.message), 'error');
            })
            .finally(() => {
                this.isProcessLibrarySubmitting = false;
            });
    }

    /**
     * Method Name: refreshProcessDetails
     * @description: Refresh process details while preserving selections
     */
    refreshProcessDetails(scopeEntryId) {
        getScopeEntryProcesses({ scopeEntryId: scopeEntryId })
            .then(result => {
                this.updateProcessDetails(scopeEntryId, result || []);
            })
            .catch(error => {
                console.error('Error refreshing process details:', error);
                this.updateProcessDetails(scopeEntryId, []);
                this.showToast('Error', 'Failed to refresh process details: ' + (error.body?.message || error.message), 'error');
            });
    }

}