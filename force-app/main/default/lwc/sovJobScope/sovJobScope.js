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
import getJobLocations from '@salesforce/apex/SovJobScopeController.getJobLocations';
import getExistingLocationProcesses from '@salesforce/apex/SovJobScopeController.getExistingLocationProcesses';
import createLocationProcesses from '@salesforce/apex/SovJobScopeController.createLocationProcesses';
import saveScopeEntryInlineEdits from '@salesforce/apex/SovJobScopeController.saveScopeEntryInlineEdits';

export default class SovJobScope extends NavigationMixin(LightningElement) {
    @track recordId;
    @track isLoading = true;
    @track scopeEntries = [];
    @track contractEntries = [];
    @track changeOrderEntries = [];
    @track filteredContractEntries = [];
    @track filteredChangeOrderEntries = [];
    @track searchTerm = '';
    @track processTableUpdateTime = 0;

    // Sorting properties
    @track sortField = '';
    @track sortOrder = '';
    @track processSortField = '';
    @track processSortOrder = '';
    
    @track scopeEntryColumns = [];
    @track accordionStyleApplied = false;
    @track activeSectionName = ['contractSection', 'changeOrderSection']; // Open both sections by default
    @track typeOptions = [
        { label: 'Contract', value: 'Contract' },
        { label: 'Change Order', value: 'Change Order' }
    ];
    @track defaultColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text', editable: true },
        { label: 'Type', fieldName: 'wfrecon__Type__c', type: 'text', editable: false },
        { label: 'Contract Value', fieldName: 'wfrecon__Contract_Value__c', type: 'currency', editable: true },
        { label: 'Completed Percentage', fieldName: 'wfrecon__Completed_Percentage__c', type: 'percent', editable: false },
        { label: 'Status', fieldName: 'wfrecon__Scope_Entry_Status__c', type: 'text', editable: false }
    ];

    // Process table columns configuration
    @track processTableColumns = [
        { 
            label: 'Process', 
            fieldName: 'wfrecon__Process_Library__r.Name', 
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

    // Process Library Table Columns Configuration
    @track processLibraryTableColumns = [
        { 
            label: 'Name', 
            fieldName: 'Name', 
            type: 'text',
            isNameField: true
        },
        { 
            label: 'Category', 
            fieldName: 'wfrecon__Process_Type__c', 
            type: 'text'
        },
        { 
            label: 'Sequence', 
            fieldName: 'wfrecon__Sequence__c', 
            type: 'number'
        },
        { 
            label: 'Measurement Type', 
            fieldName: 'wfrecon__Measurement_Type__c', 
            type: 'text'
        },
        { 
            label: 'Weight', 
            fieldName: 'wfrecon__Value__c', 
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
    @track processTypeOptions = [];

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
    @track processTypeFilterOptions = []; // For filter dropdown

    @track showAddLocationModal = false;
    @track isLocationSubmitting = false;
    @track locationRecords = [];
    @track locationDisplayRecords = [];
    @track selectedLocationIds = [];
    @track locationSearchTerm = '';
    @track selectedLocationScopeEntryId = '';

    // Location Table Columns Configuration
    @track locationTableColumns = [
        { 
            label: 'Name', 
            fieldName: 'Name', 
            type: 'text'
        },
        { 
            label: 'Square Feet', 
            fieldName: 'wfrecon__Square_Feet__c', 
            type: 'number'
        },
        { 
            label: 'Crack Count', 
            fieldName: 'wfrecon__Crack_Count__c', 
            type: 'number'
        },
        { 
            label: 'Distressed Edge', 
            fieldName: 'wfrecon__Distressed_Edge__c', 
            type: 'number'
        },
        { 
            label: 'Distressed Joint', 
            fieldName: 'wfrecon__Distressed_Joint_LF__c', 
            type: 'number'
        },
        { 
            label: 'Misc Defect Count', 
            fieldName: 'wfrecon__Misc_Defect_Count__c', 
            type: 'number'
        }
    ];

    @track modifiedScopeEntries = new Map(); // Track modified scope entries
    @track hasScopeModifications = false; // Track if there are unsaved scope changes
    @track isSavingScopeEntries = false; // Track save operation for scope entries
    @track editingScopeCells = new Set(); // Track which cells are currently being edited

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
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
     * Method Name: get hasSelectedLocations
     * @description: Check if any locations are selected
     */
    get hasSelectedLocations() {
        return this.selectedLocationIds.length > 0;
    }

    /**
     * Method Name: get isAllLocationsSelected
     * @description: Check if all visible locations are selected
     */
    get isAllLocationsSelected() {
        return this.locationDisplayRecords.length > 0 && 
               this.locationDisplayRecords.every(location => location.isSelected);
    }

    /**
     * Method Name: get sortDescription
     * @description: Set the header sort description
     */
    get sortDescription() {
        try {
            if (this.sortField !== '') {
                const orderDisplayName = this.sortOrder === 'asc' ? 'Ascending' : 'Descending';
                
                let field = this.tableColumns.find(item => item.fieldName === this.sortField);
                if (!field) {
                    return '';
                }

                const fieldDisplayName = field.label;
                return `Sorted by: ${fieldDisplayName} (${orderDisplayName})`;
            } else {
                return '';
            }
        } catch (error) {
            console.error('Error in sortDescription:', error);
            return '';
        }
    }

    /**
     * Method Name: get getSortableHeaderClass
     * @description: Get CSS class for sortable headers with active state
     */
    get getSortableHeaderClass() {
        return (fieldName) => {
            const baseClass = 'header-cell center-trancate-head sortable-header';
            return this.sortField === fieldName ? `${baseClass} active-sort` : baseClass;
        };
    }

    /**
     * Method Name: get getProcessSortableHeaderClass
     * @description: Get CSS class for process table sortable headers with active state
     */
    get getProcessSortableHeaderClass() {
        return (fieldName) => {
            const baseClass = 'header-cell center-trancate-head sortable-header';
            return this.processSortField === fieldName ? `${baseClass} active-sort` : baseClass;
        };
    }

    /**
     * Method Name: get isScopeButtonsDisabled
     * @description: Check if scope action buttons should be disabled
     */
    get isScopeButtonsDisabled() {
        return !this.hasScopeModifications || this.isSavingScopeEntries;
    }

    /**
     * Method Name: get isScopeSaveDisabled
     * @description: Check if scope save button should be disabled
     */
    get isScopeSaveDisabled() {
        return !this.hasScopeModifications || this.isSavingScopeEntries;
    }

    /**
     * Method Name: get scopeSaveButtonLabel
     * @description: Get dynamic scope save button label
     */
    get scopeSaveButtonLabel() {
        if (this.isSavingScopeEntries) {
            return 'Saving...';
        }
        if (this.hasScopeModifications) {
            return `Save Scope Changes (${this.modifiedScopeEntries.size})`;
        }
        return 'Save Scope Changes';
    }

    /**
     * Method Name: get scopeDiscardButtonTitle
     * @description: Get dynamic scope discard button title
     */
    get scopeDiscardButtonTitle() {
        if (!this.hasScopeModifications) {
            return 'No scope changes to discard';
        }
        return `Discard ${this.modifiedScopeEntries.size} unsaved scope change(s)`;
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
                    background: rgba(94, 90, 219, 0.9) !important;
                    color: white !important;
                    margin-bottom: 4px;
                    --slds-c-icon-color-foreground-default: #ffffff !important;
                    font-weight: 600 !important;
                    border-radius: 4px;
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
            case 'DOUBLE':           
            case 'INTEGER':          
            case 'LONG':             
            case 'DECIMAL':          
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

                        console.log('Fetched fieldsData:', fieldsData);
                        
                        this.scopeEntryColumns = fieldsData.map(field => ({
                            label: field.label,
                            fieldName: field.fieldName,
                            type: this.getColumnType(field.fieldType),
                            editable: field.isEditable || false 
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

                // Set default sorting to first column
                if (this.scopeEntryColumns.length > 0) {
                    this.sortField = this.scopeEntryColumns[0].fieldName;
                    this.sortOrder = 'asc';
                }

                
            })
            .catch(error => {
                console.error('Error fetching configuration:', error);
                // Use default columns on error
                this.scopeEntryColumns = this.defaultColumns;
                // Set default sorting
                if (this.scopeEntryColumns.length > 0) {
                    this.sortField = this.scopeEntryColumns[0].fieldName;
                    this.sortOrder = 'asc';
                }

                
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
        
        if (!this.recordId) {
            this.isLoading = false;
            return;
        }
    
        getScopeEntries({ jobId: this.recordId })
            .then(result => {
                this.scopeEntries = result || [];
                
                console.log('Fetched scope entries:', this.scopeEntries);
                
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
        
        // Prevent duplicate processing using timestamp
        if (event.detail.timestamp && event.detail.timestamp === this.lastConfigUpdateTimestamp) {
            console.log('Duplicate event ignored');
            return;
        }
        
        if (event.detail.success && event.detail.featureName === 'ScopeEntry') {
            // Store timestamp to prevent duplicates
            this.lastConfigUpdateTimestamp = event.detail.timestamp;
                        
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
     * @description: Apply search filters and separate by type while preserving selections - Updated
     */
    applyFilters() {
        try {
            // Don't reset sorting when applying filters, only when there's no default
            if (!this.sortField && this.tableColumns.length > 0) {
                // Set default sorting to first column
                this.sortField = this.tableColumns[0].fieldName;
                this.sortOrder = 'asc';
            }

            let filteredEntries = this.scopeEntries.filter(entry => {
                if (!this.searchTerm) return true;
                
                const searchLower = this.searchTerm.toLowerCase();
                
                const searchInObject = (obj, visited = new Set()) => {
                    if (!obj || visited.has(obj)) return false;
                    visited.add(obj);
                    
                    for (let key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            let value = obj[key];
                            if (value !== null && value !== undefined) {
                                if (typeof value === 'string' && value.toLowerCase().includes(searchLower)) {
                                    return true;
                                } else if (typeof value === 'object' && searchInObject(value, visited)) {
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
                    entry.processDetails = savedState.processDetails;
                    entry.showProcessDetails = savedState.showProcessDetails;
                    entry.isLoadingProcesses = savedState.isLoadingProcesses;
                }
            });

            // Apply sorting if we have data
            if (this.sortField) {
                this.sortData();
                // Update sort icons after a brief delay to ensure DOM is ready
                setTimeout(() => {
                    this.updateSortIcons();
                }, 0);
            }

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
     * @description: Refresh table data - Updated to maintain default sorting
     */
    handleRefresh() {
        this.isLoading = true;
        this.selectedRows = [];
        this.selectedProcesses = [];
        // Reset to default sorting (first column)
        if (this.tableColumns.length > 0) {
            this.sortField = this.tableColumns[0].fieldName;
            this.sortOrder = 'asc';
        }
        // Reset process sorting
        if (this.processTableColumns.length > 0) {
            this.processSortField = this.processTableColumns[0].fieldName;
            this.processSortOrder = 'asc';
        }
        // Clear sort icons
        setTimeout(() => {
            this.clearSortIcons();
            this.clearProcessSortIcons();
        }, 100);
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
            type: 'Contract' // Default to Contract
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
            description: '',
            type: 'Contract' // Default to Contract
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
            jobId: this.recordId,
            type: 'Contract' // Always set to Contract
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
     * @description: Open location modal and load locations
     */
    handleAddLocation(event) {
        const scopeEntryId = event.currentTarget.dataset.recordId;
        
        // Find the scope entry name
        const entry = this.getEntryById(scopeEntryId);
        this.selectedScopeEntryName = entry ? entry.Name : '';
        this.selectedLocationScopeEntryId = scopeEntryId;
        
        // Reset selections
        this.selectedLocationIds = [];
        this.locationSearchTerm = '';
        
        // Load location data
        this.loadLocationData(scopeEntryId);
        
        this.showAddLocationModal = true;
        
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
     * @description: Common method to process entries for display with nested table support and inline editing
     */
    processEntriesForDisplay(entries) {

        console.log('Processing entries for display:', entries);
        
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
                
                // Check if this field has been modified
                const modifiedValue = this.getModifiedScopeValue(entry.Id, key);
                if (modifiedValue !== null && modifiedValue !== undefined) {
                    value = modifiedValue;
                }
                
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                const isModified = this.isScopeFieldModified(entry.Id, key);
                const isBeingEdited = this.editingScopeCells.has(`${entry.Id}-${key}`);
                
                // Build cell classes
                let cellClass = 'center-trancate-text';
                if (col.editable) {
                    cellClass += ' editable-cell';
                }
                if (isModified && !isBeingEdited) {
                    cellClass += ' modified-scope-cell';
                }
                if (isBeingEdited) {
                    cellClass += ' editing-cell';
                }
                
                // Build content classes
                let contentClass = 'editable-content';
                
                // Handle currency fields - show $0.00 for empty currency fields
                let currencyValue = 0;
                if (col.type === 'currency') {
                    currencyValue = value !== null && value !== undefined ? parseFloat(value) : 0;
                }
                
                // Handle percent fields
                let percentValue = 0;
                if (col.type === 'percent') {
                    percentValue = value !== null && value !== undefined ? parseFloat(value)  : 0;
                }
                
                return {
                    key,
                    value: displayValue,
                    rawValue: value,
                    currencyValue: currencyValue,
                    percentValue: percentValue,
                    hasValue: value !== null && value !== undefined && String(value).trim() !== '',
                    isNameField: key === 'Name',
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent',
                    isNumber: col.type === 'number',
                    isEditable: col.editable || false,
                    isModified: isModified,
                    isBeingEdited: isBeingEdited,
                    cellClass: cellClass,
                    contentClass: contentClass
                };
            });

            console.log('Processed row:', row);
            
            
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
            // Fix: Link to Process Library record instead of Scope Entry Process
            row.recordUrl = process.wfrecon__Process_Library__c ? 
                `/lightning/r/${process.wfrecon__Process_Library__c}/view` : 
                `/lightning/r/${process.Id}/view`;
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

                    console.log('percentValue for', key, ':', percentValue);
                    
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
            scopeEntryId: this.selectedScopeEntryId,
            jobId: this.recordId
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
     * @description: Update process details for a specific entry while preserving selections - Updated with default sorting
     */
     updateProcessDetails(scopeEntryId, processDetails) {

        console.log('Updating process details for entry:', scopeEntryId, processDetails);
        
        // Set default process sorting to first column if not already set
        if (!this.processSortField && this.processTableColumns.length > 0) {
            this.processSortField = this.processTableColumns[0].fieldName;
            this.processSortOrder = 'asc';
        }

        // Process the details for display while preserving selections
        const processedDetails = this.processProcessDetailsForDisplay(processDetails);
        
        // Sort the processed details if we have a sort field
        let sortedDetails = processedDetails;
        if (this.processSortField) {
            sortedDetails = [...processedDetails].sort((a, b) => {
                let aValue = this.getFieldValue(a, this.processSortField);
                let bValue = this.getFieldValue(b, this.processSortField);

                // Handle null/undefined values
                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';

                // Convert to strings for comparison if they're not numbers
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                let compare = 0;
                if (aValue > bValue) {
                    compare = 1;
                } else if (aValue < bValue) {
                    compare = -1;
                }

                return this.processSortOrder === 'asc' ? compare : -compare;
            });
        }
        
        // Update contract entries
        this.filteredContractEntries = this.filteredContractEntries.map(entry => {
            if (entry.Id === scopeEntryId) {
                return {
                    ...entry,
                    processDetails: sortedDetails,
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
                    processDetails: sortedDetails,
                    isLoadingProcesses: false
                };
            }
            return entry;
        });

        // Update sort icons for process table
        setTimeout(() => {
            this.updateProcessSortIcons();
        }, 0);
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

                this.processTypeOptions = (result || []).map(type => ({
                    label: type,
                    value: type
                }));

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

        // Create display records with selection state and processed fields
        this.processLibraryDisplayRecords = filtered.map(process => {
            const processRecord = {
                ...process,
                isSelected: this.selectedProcessLibraryIds.includes(process.Id)
            };

            // Process display fields similar to other tables
            processRecord.displayFields = this.processLibraryTableColumns.map(col => {
                const key = col.fieldName;
                let value = this.getFieldValue(process, key);
                
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                
                // Handle number fields
                let numberValue = 0;
                if (col.type === 'number') {
                    numberValue = (value !== null && value !== undefined && !isNaN(value)) ? value : 0;
                }

                // Handle special display for name field with Process_Name__c - FIX: Use getFieldValue
                let displayName = '';
                if (col.isNameField) {
                    const processNameValue = this.getFieldValue(process, 'wfrecon__Process_Name__c');
                    displayName = processNameValue || '';
                }
                
                return {
                    key,
                    value: displayValue,
                    displayName: displayName, // Fixed: Use the properly accessed displayName
                    rawValue: value,
                    numberValue: numberValue,
                    hasValue: value !== null && value !== undefined && String(value).trim() !== '',
                    isNameField: col.isNameField || false,
                    isNumber: col.type === 'number',
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent'
                };
            });

            return processRecord;
        });
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
     * Method Name: handleProcessCategoryFilter
     * @description: Handle category filter change
     */
    handleProcessCategoryFilter(event) {
        this.selectedProcessCategory = event.target.value;
        this.applyProcessLibraryFilters();
    }

    /**
     * Method Name: handleProcessLibrarySearch
     * @description: Handle search in process library modal
     */
    handleProcessLibrarySearch(event) {
        this.processLibrarySearchTerm = event.target.value;
        this.applyProcessLibraryFilters();
    }

    /**
     * Method Name: handleCloseProcessLibraryModal
     * @description: Close process library modal
     */
    handleCloseProcessLibraryModal() {
        this.showProcessLibraryModal = false;
        this.selectedScopeEntryName = '';
        this.selectedProcessLibraryIds = [];
        this.processLibrarySearchTerm = '';
        this.selectedProcessCategory = '';
        this.processLibraryRecords = [];
        this.processLibraryDisplayRecords = [];
        this.processTypeOptions = [];
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
            selectedProcessIds: this.selectedProcessLibraryIds,
            jobId: this.recordId
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
                this.selectedScopeEntryId = '';
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

    /**
     * Method Name: loadLocationData
     * @description: Load locations and existing location processes
     */
    loadLocationData(scopeEntryId) {
        Promise.all([
            getJobLocations({ jobId: this.recordId }),
            getExistingLocationProcesses({ scopeEntryId: scopeEntryId })
        ])
        .then(([locations, existingLocationIds]) => {
            this.locationRecords = locations || [];
            this.selectedLocationIds = existingLocationIds || [];

            
            this.applyLocationFilters();
        })
        .catch(error => {
            console.error('Error loading location data:', error);
            this.showToast('Error', 'Failed to load locations: ' + (error.body?.message || error.message), 'error');
            this.locationRecords = [];
            this.locationDisplayRecords = [];
        });
    }

    /**
     * Method Name: applyLocationFilters
     * @description: Apply filters and maintain selection states for locations
     */
    applyLocationFilters() {
        if (!this.locationRecords || this.locationRecords.length === 0) {
            this.locationDisplayRecords = [];
            return;
        }

        let filtered = [...this.locationRecords];

        // Filter by search term
        if (this.locationSearchTerm) {
            const searchLower = this.locationSearchTerm.toLowerCase();
            filtered = filtered.filter(location => {
                return (location.Name && location.Name.toLowerCase().includes(searchLower)) ||
                       (location.wfrecon__Square_Feet__c && location.wfrecon__Square_Feet__c.toString().includes(searchLower)) ||
                       (location.wfrecon__Crack_Count__c && location.wfrecon__Crack_Count__c.toString().includes(searchLower));
            });
        }

        // Create display records with selection state
        this.locationDisplayRecords = filtered.map(location => {
            const locationRecord = {
                ...location,
                isSelected: this.selectedLocationIds.includes(location.Id)
            };

            // Process display fields
            locationRecord.displayFields = this.locationTableColumns.map(col => {
                const key = col.fieldName;
                let value = this.getFieldValue(location, key);
                
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                
                // Handle number fields
                let numberValue = 0;
                if (col.type === 'number') {
                    numberValue = (value !== null && value !== undefined && !isNaN(value)) ? value : 0;
                }
                
                return {
                    key,
                    value: displayValue,
                    rawValue: value,
                    numberValue: numberValue,
                    hasValue: value !== null && value !== undefined && String(value).trim() !== '',
                    isNumber: col.type === 'number'
                };
            });

            return locationRecord;
        });
    }

    /**
     * Method Name: handleLocationSelection
     * @description: Handle individual location selection
     */
    handleLocationSelection(event) {
        const locationId = event.target.dataset.locationId;
        const isChecked = event.target.checked;

        if (isChecked) {
            if (!this.selectedLocationIds.includes(locationId)) {
                this.selectedLocationIds = [...this.selectedLocationIds, locationId];
            }
        } else {
            this.selectedLocationIds = this.selectedLocationIds.filter(id => id !== locationId);
        }

        // Update the display record's selection state
        this.locationDisplayRecords = this.locationDisplayRecords.map(location => ({
            ...location,
            isSelected: this.selectedLocationIds.includes(location.Id)
        }));
    }

    /**
     * Method Name: handleSelectAllLocations
     * @description: Handle select all locations
     */
    handleSelectAllLocations(event) {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            // Add all visible location IDs to selection
            const visibleIds = this.locationDisplayRecords.map(location => location.Id);
            const newSelections = visibleIds.filter(id => !this.selectedLocationIds.includes(id));
            this.selectedLocationIds = [...this.selectedLocationIds, ...newSelections];
        } else {
            // Remove all visible location IDs from selection
            const visibleIds = this.locationDisplayRecords.map(location => location.Id);
            this.selectedLocationIds = this.selectedLocationIds.filter(id => !visibleIds.includes(id));
        }

        // Update display records
        this.locationDisplayRecords = this.locationDisplayRecords.map(location => ({
            ...location,
            isSelected: this.selectedLocationIds.includes(location.Id)
        }));
    }

    /**
     * Method Name: handleLocationSearch
     * @description: Handle search in location modal
     */
    handleLocationSearch(event) {
        this.locationSearchTerm = event.target.value;
        this.applyLocationFilters();
    }

    /**
     * Method Name: handleCloseLocationModal
     * @description: Close location modal
     */
    handleCloseLocationModal() {
        this.showAddLocationModal = false;
        this.selectedScopeEntryName = '';
        this.selectedLocationScopeEntryId = '';
        this.selectedLocationIds = [];
        this.locationSearchTerm = '';
        this.locationRecords = [];
        this.locationDisplayRecords = [];
    }

    /**
     * Method Name: handleSaveLocations
     * @description: Save selected locations and create location processes
     */
    handleSaveLocations() {
        if (this.selectedLocationIds.length === 0) {
            this.showToast('Warning', 'Please select at least one location', 'warning');
            return;
        }

        this.isLocationSubmitting = true;
        
        const locationData = {
            scopeEntryId: this.selectedLocationScopeEntryId,
            selectedLocationIds: this.selectedLocationIds
        };

        createLocationProcesses({ locationData })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', `${this.selectedLocationIds.length} location(s) added successfully`, 'success');
                    this.handleCloseLocationModal();
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to add locations: ' + (error.body?.message || error.message), 'error');
            })
            .finally(() => {
                this.isLocationSubmitting = false;
            });
    }

    /**
     * Method Name: handleSortClick
     * @description: Handle column header click for sorting - Updated
     */
    handleSortClick(event) {
        try {
            const fieldName = event.currentTarget.dataset.id;
            
            // Clear all existing active states first
            this.clearSortIcons();
            
            if (this.sortField === fieldName) {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = fieldName;
                this.sortOrder = 'asc';
            }
            
            this.sortData();
            this.updateSortIcons();
        } catch (error) {
            console.error('Error in handleSortClick:', error);
        }
    }

    /**
     * Method Name: handleProcessSortClick
     * @description: Handle column header click for sorting in process table
     */
    handleProcessSortClick(event) {
        try {
            const fieldName = event.currentTarget.dataset.id;
            const scopeEntryId = event.currentTarget.dataset.scopeEntryId;
            
            // Clear all existing active states first for this specific scope entry only
            this.clearProcessSortIcons(scopeEntryId);
            
            if (this.processSortField === fieldName) {
                this.processSortOrder = this.processSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                this.processSortField = fieldName;
                this.processSortOrder = 'asc';
            }
            
            this.sortProcessData(scopeEntryId);
            this.updateProcessSortIcons(scopeEntryId);
        } catch (error) {
            console.error('Error in handleProcessSortClick:', error);
        }
    }

    /**
     * Method Name: updateProcessSortIcons
     * @description: Update process table sort icons and active states
     */
    updateProcessSortIcons(scopeEntryId) {
        try {
            // If scopeEntryId is provided, only update icons for that specific table
            if (scopeEntryId) {
                // Clear all first for this specific scope entry
                this.clearProcessSortIcons(scopeEntryId);
                
                // Add active class to current sorted header for this specific scope entry
                // Fix: Target headers directly with both field name and scope entry ID
                const currentHeaders = this.template.querySelectorAll(`.process-sortable-header[data-process-sort-field="${this.processSortField}"][data-scope-entry-id="${scopeEntryId}"]`);
                currentHeaders.forEach(header => {
                    header.classList.add('active-sort');
                    
                    // Add rotation to the icon
                    const icon = header.querySelector('.process-sort-icon svg');
                    if (icon) {
                        icon.classList.add(this.processSortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                    }
                });
            } else {
                // Original behavior for backward compatibility
                this.clearProcessSortIcons();
                
                const currentHeaders = this.template.querySelectorAll(`[data-process-sort-field="${this.processSortField}"]`);
                currentHeaders.forEach(header => {
                    header.classList.add('active-sort');
                    
                    const icon = header.querySelector('.process-sort-icon svg');
                    if (icon) {
                        icon.classList.add(this.processSortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                    }
                });
            }
        } catch (error) {
            console.error('Error in updateProcessSortIcons:', error);
        }
    }

    /**
     * Method Name: clearProcessSortIcons
     * @description: Clear all process table sort icons and active states
     */
    clearProcessSortIcons(scopeEntryId) {
        try {
            if (scopeEntryId) {
                // Remove active classes from process headers for specific scope entry only
                // Fix: Target headers directly with the scope entry ID, not as descendants
                const allHeaders = this.template.querySelectorAll(`.process-sortable-header[data-scope-entry-id="${scopeEntryId}"]`);
                allHeaders.forEach(header => {
                    header.classList.remove('active-sort');
                });
                
                // Remove rotation classes from process icons for specific scope entry only
                // Fix: Target icons within headers that have the specific scope entry ID
                const allIcons = this.template.querySelectorAll(`.process-sortable-header[data-scope-entry-id="${scopeEntryId}"] .process-sort-icon svg`);
                allIcons.forEach(icon => {
                    icon.classList.remove('rotate-asc', 'rotate-desc');
                });
            } else {
                // Original behavior - clear all
                const allHeaders = this.template.querySelectorAll('.process-sortable-header');
                allHeaders.forEach(header => {
                    header.classList.remove('active-sort');
                });
                
                const allIcons = this.template.querySelectorAll('.process-sort-icon svg');
                allIcons.forEach(icon => {
                    icon.classList.remove('rotate-asc', 'rotate-desc');
                });
            }
        } catch (error) {
            console.error('Error in clearProcessSortIcons:', error);
        }
    }

    /**
     * Method Name: clearSortIcons
     * @description: Clear all sort icons and active states
     */
    clearSortIcons() {
        try {
            // Remove all active classes
            const allHeaders = this.template.querySelectorAll('.sortable-header');
            allHeaders.forEach(header => {
                header.classList.remove('active-sort');
            });
            
            // Remove all rotation classes
            const allIcons = this.template.querySelectorAll('.sort-icon svg');
            allIcons.forEach(icon => {
                icon.classList.remove('rotate-asc', 'rotate-desc');
            });
        } catch (error) {
            console.error('Error in clearSortIcons:', error);
        }
    }

    /**
     * Method Name: updateSortIcons
     * @description: Update sort icons and active states - Updated
     */
    updateSortIcons() {
        try {
            // Clear all first
            this.clearSortIcons();
            
            // Add active class to current sorted header
            const currentHeaders = this.template.querySelectorAll(`[data-sort-field="${this.sortField}"]`);
            currentHeaders.forEach(header => {
                header.classList.add('active-sort');
                
                // Add rotation to the icon
                const icon = header.querySelector('.sort-icon svg');
                if (icon) {
                    icon.classList.add(this.sortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                }
            });
        } catch (error) {
            console.error('Error in updateSortIcons:', error);
        }
    }

    /**
     * Method Name: sortProcessData
     * @description: Sort the process data for a specific scope entry
     */
    sortProcessData(scopeEntryId) {
        try {
            // Update contract entries
            this.filteredContractEntries = this.filteredContractEntries.map(entry => {
                if (entry.Id === scopeEntryId && entry.processDetails) {
                    const sortedProcessDetails = [...entry.processDetails].sort((a, b) => {
                        let aValue = this.getFieldValue(a, this.processSortField);
                        let bValue = this.getFieldValue(b, this.processSortField);

                        // Handle null/undefined values
                        if (aValue === null || aValue === undefined) aValue = '';
                        if (bValue === null || bValue === undefined) bValue = '';

                        // Convert to strings for comparison if they're not numbers
                        if (typeof aValue === 'string' && typeof bValue === 'string') {
                            aValue = aValue.toLowerCase();
                            bValue = bValue.toLowerCase();
                        }

                        let compare = 0;
                        if (aValue > bValue) {
                            compare = 1;
                        } else if (aValue < bValue) {
                            compare = -1;
                        }

                        return this.processSortOrder === 'asc' ? compare : -compare;
                    });

                    return {
                        ...entry,
                        processDetails: sortedProcessDetails
                    };
                }
                return entry;
            });

            // Update change order entries
            this.filteredChangeOrderEntries = this.filteredChangeOrderEntries.map(entry => {
                if (entry.Id === scopeEntryId && entry.processDetails) {
                    const sortedProcessDetails = [...entry.processDetails].sort((a, b) => {
                        let aValue = this.getFieldValue(a, this.processSortField);
                        let bValue = this.getFieldValue(b, this.processSortField);

                        // Handle null/undefined values
                        if (aValue === null || aValue === undefined) aValue = '';
                        if (bValue === null || bValue === undefined) bValue = '';

                        // Convert to strings for comparison if they're not numbers
                        if (typeof aValue === 'string' && typeof bValue === 'string') {
                            aValue = aValue.toLowerCase();
                            bValue = bValue.toLowerCase();
                        }

                        let compare = 0;
                        if (aValue > bValue) {
                            compare = 1;
                        } else if (aValue < bValue) {
                            compare = -1;
                        }

                        return this.processSortOrder === 'asc' ? compare : -compare;
                    });

                    return {
                        ...entry,
                        processDetails: sortedProcessDetails
                    };
                }
                return entry;
            });
        } catch (error) {
            console.error('Error in sortProcessData:', error);
        }
    }

    /**
     * Method Name: sortData
     * @description: Sort the data based on current sort field and order
     */
    sortData() {
        try {
            // Sort contract entries
            this.filteredContractEntries = [...this.filteredContractEntries].sort((a, b) => {
                let aValue = this.getFieldValue(a, this.sortField);
                let bValue = this.getFieldValue(b, this.sortField);

                // Handle null/undefined values
                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';

                // Convert to strings for comparison if they're not numbers
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                let compare = 0;
                if (aValue > bValue) {
                    compare = 1;
                } else if (aValue < bValue) {
                    compare = -1;
                }

                return this.sortOrder === 'asc' ? compare : -compare;
            });

            // Sort change order entries
            this.filteredChangeOrderEntries = [...this.filteredChangeOrderEntries].sort((a, b) => {
                let aValue = this.getFieldValue(a, this.sortField);
                let bValue = this.getFieldValue(b, this.sortField);

                // Handle null/undefined values
                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';

                // Convert to strings for comparison if they're not numbers
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                let compare = 0;
                if (aValue > bValue) {
                    compare = 1;
                } else if (aValue < bValue) {
                    compare = -1;
                }

                return this.sortOrder === 'asc' ? compare : -compare;
            });
        } catch (error) {
            console.error('Error in sortData:', error);
        }
    }

    /**
     * Method Name: handleScopeCellClick
     * @description: Handle cell click for inline editing of scope entries
     */
    handleScopeCellClick(event) {
        const recordId = event.currentTarget.dataset.recordId;
        const fieldName = event.currentTarget.dataset.fieldName;
        const isEditable = event.currentTarget.dataset.editable === 'true';
        
        if (!isEditable) return;
        
        const cellKey = `${recordId}-${fieldName}`;
        
        // Don't open editor if already editing this cell
        if (this.editingScopeCells.has(cellKey)) return;
        
        this.editingScopeCells.add(cellKey);
        
        // Trigger reactivity
        this.applyFilters();
        
        // Auto-focus the input after DOM update
        setTimeout(() => {
            const input = this.template.querySelector(`input[data-record-id="${recordId}"][data-field-name="${fieldName}"]`);
            if (input) {
                input.focus();
                input.select(); // Select all text for easy editing
            }
        }, 50);
    }

    /**
     * Method Name: handleScopeCellInputChange
     * @description: Handle input change in scope inline editing
     */
    handleScopeCellInputChange(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.fieldName;
        const fieldType = event.target.dataset.fieldType;
        let newValue = event.target.value;
        
        // Type conversion based on field type
        if (fieldType === 'number' && newValue !== '') {
            newValue = parseFloat(newValue);
            if (isNaN(newValue)) {
                newValue = 0;
            }
        }
        
        // Get original value to compare
        const originalEntry = [...this.filteredContractEntries, ...this.filteredChangeOrderEntries].find(entry => entry.Id === recordId);
        const originalValue = this.getFieldValue(originalEntry, fieldName);
        
        // Track modifications
        if (!this.modifiedScopeEntries.has(recordId)) {
            this.modifiedScopeEntries.set(recordId, {});
        }
        
        const modifications = this.modifiedScopeEntries.get(recordId);
        
        if (newValue !== originalValue) {
            modifications[fieldName] = newValue;
        } else {
            // Remove modification if value is back to original
            delete modifications[fieldName];
            if (Object.keys(modifications).length === 0) {
                this.modifiedScopeEntries.delete(recordId);
            }
        }
        
        // Update hasScopeModifications flag
        this.hasScopeModifications = this.modifiedScopeEntries.size > 0;
    }

    /**
     * Method Name: handleScopeCellInputBlur
     * @description: Handle blur event on scope inline edit input
     */
    handleScopeCellInputBlur(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.fieldName;
        const cellKey = `${recordId}-${fieldName}`;
        
        // Remove from editing set
        this.editingScopeCells.delete(cellKey);
        
        // Trigger reactivity to show normal cell
        this.applyFilters();
    }

    /**
     * Method Name: handleSaveScopeChanges
     * @description: Save all modified scope entries in a single batch
     */
    handleSaveScopeChanges() {
        if (this.modifiedScopeEntries.size === 0) {
            return;
        }

        this.isSavingScopeEntries = true;
        
        // Prepare data for batch update
        const updatedScopeEntries = [];
        
        this.modifiedScopeEntries.forEach((modifications, recordId) => {
            const scopeUpdate = { Id: recordId };
            Object.keys(modifications).forEach(fieldName => {
                scopeUpdate[fieldName] = modifications[fieldName];
            });
            updatedScopeEntries.push(scopeUpdate);
        });

        // Call batch update method
        const updatedScopeEntriesJson = JSON.stringify(updatedScopeEntries);
        
        saveScopeEntryInlineEdits({ updatedScopeEntriesJson: updatedScopeEntriesJson })
            .then(result => {
                if (result.startsWith('Success')) {
                    this.showToast('Success', result, 'success');
                    
                    // Clear modifications and refresh data
                    this.modifiedScopeEntries.clear();
                    this.hasScopeModifications = false;
                    this.editingScopeCells.clear();
                    
                    // Refresh scope entries
                    this.fetchScopeEntries();
                    
                } else if (result.startsWith('Partial Success')) {
                    this.showToast('Warning', result, 'warning');
                    
                    // Partially clear modifications and refresh
                    this.modifiedScopeEntries.clear();
                    this.hasScopeModifications = false;
                    this.editingScopeCells.clear();
                    this.fetchScopeEntries();
                    
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                console.error('Error in scope batch update:', error);
                this.showToast('Error', 'Failed to update scope entries: ' + (error.body?.message || error.message), 'error');
            })
            .finally(() => {
                this.isSavingScopeEntries = false;
            });
    }

    /**
     * Method Name: handleDiscardScopeChanges
     * @description: Discard all unsaved scope changes
     */
    handleDiscardScopeChanges() {
        // Clear all modifications
        this.modifiedScopeEntries.clear();
        this.hasScopeModifications = false;
        this.editingScopeCells.clear();
        
        // Trigger reactivity to remove highlighting and reset values
        this.applyFilters();
        
        this.showToast('Success', 'Scope changes discarded', 'success');
    }

    /**
     * Method Name: getModifiedScopeValue
     * @description: Get modified value for a specific scope field
     */
    getModifiedScopeValue(recordId, fieldName) {
        const modifications = this.modifiedScopeEntries.get(recordId);
        return modifications ? modifications[fieldName] : null;
    }

    /**
     * Method Name: isScopeFieldModified
     * @description: Check if a specific scope field has been modified
     */
    isScopeFieldModified(recordId, fieldName) {
        const modifications = this.modifiedScopeEntries.get(recordId);
        return modifications && modifications.hasOwnProperty(fieldName);
    }

}