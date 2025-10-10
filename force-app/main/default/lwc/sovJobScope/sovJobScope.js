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
import createChangeOrder from '@salesforce/apex/SovJobScopeController.createChangeOrder';
import saveProcessEntryInlineEdits from '@salesforce/apex/SovJobScopeController.saveProcessEntryInlineEdits';
import getPicklistValuesForField from '@salesforce/apex/SovJobScopeController.getPicklistValuesForField';
import deleteSelectedScopeEntryProcesses from '@salesforce/apex/SovJobScopeController.deleteSelectedScopeEntryProcesses';

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
    @track modifiedProcessEntriesByScopeEntry = new Map(); // Map<scopeEntryId, Set<processId>>
    @track fieldPicklistOptions = new Map(); // Map<fieldName, Array<{label, value}>>

    // Sorting properties
    @track sortField = '';
    @track sortOrder = '';
    @track contractSortField = ''; // ADD THIS
    @track contractSortOrder = ''; // ADD THIS
    @track changeOrderSortField = ''; // ADD THIS
    @track changeOrderSortOrder = ''; // ADD THIS
    @track processSortByEntry = new Map(); // Map<scopeEntryId, {sortField, sortOrder}>

    @track processSortField = '';
    @track processSortOrder = '';
    @track processSetupFlags = {}; // Store process setup flags from Apex
    
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

    @track processTableColumns = [
        { 
            label: 'Process Library', 
            fieldName: 'wfrecon__Process_Library__r.Name', 
            type: 'url',
            editable: false
        },
        { 
            label: 'Sequence', 
            fieldName: 'wfrecon__Sequence__c', 
            type: 'number',
            editable: true
        },
        { 
            label: 'Process Name', 
            fieldName: 'wfrecon__Process_Name__c', 
            type: 'text',
            editable: true,
            conditionalEdit: true // This field has conditional editing
        },
        { 
            label: 'Step Value', 
            fieldName: 'wfrecon__Contract_Price__c', 
            type: 'currency',
            editable: false
        },
        { 
            label: '% Complete', 
            fieldName: 'wfrecon__Completed_Percentage__c', 
            type: 'percent',
            editable: false
        },
        { 
            label: 'Current Complete Value', 
            fieldName: 'wfrecon__Current_Complete_Value__c', 
            type: 'currency',
            editable: false
        },
        { 
            label: 'Weight', 
            fieldName: 'wfrecon__Weight__c', 
            type: 'number',
            editable: true
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
    @track isProcessLibrarySubmitting = false;
    @track selectedScopeEntryId = '';
    @track selectedScopeEntryName = '';
    @track newProcess = {
        processName: '',
        sequence: null,
        processType: '',
        weightage: null,
        measurementType: ''
    };

    @track changeOrderManualProcess = {
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
    @track processTypeCategoryOptions = []; // Separate options for category filter with "All" option

    @track modifiedProcessEntries = new Map(); // Change structure to: Map<processId, {scopeEntryId, modifications}>
    @track hasProcessModifications = false; // Track if there are unsaved process changes
    @track isSavingProcessEntries = false; // Track save operation for process entries
    @track editingProcessCells = new Set(); // Track which process cells are currently being edited
    @track selectedProcessesByScopeEntry = new Map(); // Map<scopeEntryId, Set<processId>>

    @track showAddLocationModal = false;
    @track isLocationSubmitting = false;
    @track locationRecords = [];
    @track locationDisplayRecords = [];
    @track selectedLocationIds = [];
    @track originalLocationIds = [];
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

    // Change Order Modal Properties
    @track showCreateChangeOrderModal = false;
    @track isChangeOrderSubmitting = false;
    @track selectedScopeEntryForChangeOrder = null;
    @track changeOrderStep = 1; // 1 for initial form, 2 for process selection
    @track changeOrderData = {
        name: '',
        contractValue: null,
        processOption: '' // 'manual' or 'library'
    };
    @track selectedChangeOrderProcessIds = [];

    // Change Order Process Options
    @track processSelectionOptions = [
        { label: 'Add Manual Process', value: 'manual' },
        { label: 'Add from Process Library', value: 'library' }
    ];


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
        return this.selectedRows.length === 0 || this.isLoading || this.isSavingScopeEntries;
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
     * @description: Calculate total contract value from contract entries only
     */
    get totalContractValue() {
        if (!this.filteredContractEntries || this.filteredContractEntries.length === 0) return 0;
        
        return this.filteredContractEntries.reduce((total, entry) => {
            const contractValue = this.getFieldValue(entry, 'wfrecon__Contract_Value__c');
            return total + (contractValue || 0);
        }, 0);
    }

    /**
     * Method Name: get totalChangeOrderValue
     * @description: Calculate total contract value from change order entries only
     */
    get totalChangeOrderValue() {
        if (!this.filteredChangeOrderEntries || this.filteredChangeOrderEntries.length === 0) return 0;
        
        return this.filteredChangeOrderEntries.reduce((total, entry) => {
            const contractValue = this.getFieldValue(entry, 'wfrecon__Contract_Value__c');
            return total + (contractValue || 0);
        }, 0);
    }

    /**
     * Method Name: get totalAllContractValue
     * @description: Calculate total contract value across all scope entries (contract + change orders)
     */
    get totalAllContractValue() {
        return this.totalContractValue + this.totalChangeOrderValue;
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
        return Math.max(0, this.totalAllContractValue - this.totalCompletedValue);
    }

    /**
     * Method Name: get overallCompletionPercentage
     * @description: Calculate overall completion percentage
     */
    get overallCompletionPercentage() {
        if (this.totalAllContractValue === 0) return 0;
        
        return (this.totalCompletedValue / this.totalAllContractValue);
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
     * Method Name: get hasSelectedProcesses
     * @description: Check if any processes are selected for deletion
     */
    get hasSelectedProcesses() {
        return this.selectedProcesses.length > 0;
    }

    /**
     * Method Name: get selectedProcessesCount
     * @description: Get count of selected processes
     */
    get selectedProcessesCount() {
        return this.selectedProcesses.length;
    }

    /**
     * Method Name: get isDeleteProcessDisabled
     * @description: Check if delete process button should be disabled
     */
    get isDeleteProcessDisabled() {
        return this.selectedProcesses.length === 0 || this.isProcessSubmitting || this.isSavingProcessEntries;
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
        return !this.hasScopeModifications || this.isSavingScopeEntries || this.isLoading;
    }

    /**
     * Method Name: get isScopeSaveDisabled
     * @description: Check if scope save button should be disabled
     */
    get isScopeSaveDisabled() {
        return !this.hasScopeModifications || this.isSavingScopeEntries || this.isLoading;
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
     * Method Name: get showChangeOrderButtons
     * @description: Check if change order buttons should be shown (when entry has locations and processes)
     */
    get showChangeOrderButtons() {
        return (scopeEntryId) => {
            const entry = this.getEntryById(scopeEntryId);
            return entry && entry.processDetails && entry.processDetails.length > 0;
        };
    }

    /**
     * Method Name: get hideProcessButtons
     * @description: Check if process buttons should be hidden (when entry has locations and processes)
     */
    get hideProcessButtons() {
        return (scopeEntryId) => {
            const entry = this.getEntryById(scopeEntryId);
            return entry && entry.processDetails && entry.processDetails.length > 0;
        };
    }

    /**
     * Method Name: get changeOrderNameCharacterCount
     * @description: Get current character count for change order name field
     */
    get changeOrderNameCharacterCount() {
        return this.changeOrderData.name ? this.changeOrderData.name.length : 0;
    }

    /**
     * Method Name: get changeOrderNameCharacterCountClass
     * @description: Get CSS class for change order name character count based on length
     */
    get changeOrderNameCharacterCountClass() {
        const count = this.changeOrderNameCharacterCount;
        if (count > 80) return 'character-count error';
        if (count > 70) return 'character-count warning';
        return 'character-count';
    }

    /**
     * Method Name: get isChangeOrderStep1
     * @description: Check if we're on step 1 of change order creation
     */
    get isChangeOrderStep1() {
        return this.changeOrderStep === 1;
    }

    /**
     * Method Name: get isChangeOrderStep2
     * @description: Check if we're on step 2 of change order creation
     */
    get isChangeOrderStep2() {
        return this.changeOrderStep === 2;
    }

    /**
     * Method Name: get canProceedToStep2
     * @description: Check if user can proceed to step 2
     */
    get canProceedToStep2() {
        return this.changeOrderData.name && 
               this.changeOrderData.contractValue && 
               this.changeOrderData.contractValue > 0 &&
               this.changeOrderData.contractValue <= 2000000000 &&
               this.changeOrderData.processOption;
    }

    /**
     * Method Name: validateChangeOrderStep1
     * @description: Validate step 1 data for change order
     * @return: Object with isValid boolean and error message
     */
    validateChangeOrderStep1() {
        const { name, contractValue, processOption } = this.changeOrderData;
        
        // Check if any required field is missing
        const missingFields = [];
        
        if (!name || name.trim() === '') {
            missingFields.push('Name');
        }
        
        if (!contractValue || contractValue <= 0) {
            missingFields.push('Contract Value');
        }
        
        if (!processOption || processOption.trim() === '') {
            missingFields.push('Process Option');
        }
        
        // If multiple required fields are missing, show generic message
        if (missingFields.length > 1) {
            return { isValid: false, message: 'Please fill all required fields' };
        }
        
        // Specific field validations
        if (!name || name.trim() === '') {
            return { isValid: false, message: 'Name is required' };
        }
        
        if (name.trim().length > 80) {
            return { isValid: false, message: 'Name cannot be longer than 80 characters' };
        }
        
        if (!contractValue) {
            return { isValid: false, message: 'Contract Value is required' };
        }
        
        if (contractValue <= 0) {
            return { isValid: false, message: 'Contract Value must be greater than 0' };
        }
        
        if (contractValue > 2000000000) {
            return { isValid: false, message: 'Contract Value cannot exceed 2,000,000,000' };
        }
        
        if (!processOption || processOption.trim() === '') {
            return { isValid: false, message: 'Process Option is required' };
        }
        
        return { isValid: true, message: '' };
    }

    /**
     * Method Name: get hasSelectedChangeOrderProcesses
     * @description: Check if any processes are selected for change order
     */
    get hasSelectedChangeOrderProcesses() {
        return this.selectedChangeOrderProcessIds.length > 0;
    }

    get isMannualProcessSelected() {
        return this.changeOrderData.processOption === 'manual';
    }

    get isLibraryProcessSelected() {
        return this.changeOrderData.processOption === 'library';
    }

    /**
     * Method Name: get changeOrderProcessNameCharacterCount
     * @description: Get current character count for change order process name field
     */
    get changeOrderProcessNameCharacterCount() {
        return this.changeOrderManualProcess.processName ? this.changeOrderManualProcess.processName.length : 0;
    }

    /**
     * Method Name: get changeOrderProcessNameCharacterCountClass
     * @description: Get CSS class for change order process name character count based on length
     */
    get changeOrderProcessNameCharacterCountClass() {
        const count = this.changeOrderProcessNameCharacterCount;
        if (count > 80) return 'character-count error';
        if (count > 70) return 'character-count warning';
        return 'character-count';
    }

    /**
     * Method Name: get isProcessButtonsDisabled
     * @description: Check if process action buttons should be disabled
     */
    get isProcessButtonsDisabled() {
        return !this.hasProcessModifications || this.isSavingProcessEntries || this.isProcessSubmitting;
    }

    /**
     * Method Name: get isProcessSaveDisabled
     * @description: Check if process save button should be disabled
     */
    get isProcessSaveDisabled() {
        return !this.hasProcessModifications || this.isSavingProcessEntries || this.isProcessSubmitting;
    }

    /**
     * Method Name: get processDiscardButtonTitle
     * @description: Get dynamic process discard button title
     */
    get processDiscardButtonTitle() {
        if (!this.hasProcessModifications) {
            return 'No process changes to discard';
        }
        return `Discard ${this.modifiedProcessEntries.size} unsaved process change(s)`;
    }

    /**
     * Method Name: get processSaveButtonLabel
     *  @description: Get dynamic process save button label
     */
    
    /**
     * Method Name: hasSelectedProcessesForEntry
     * @description: Check if any processes are selected for a specific scope entry
     */
    hasSelectedProcessesForEntry(scopeEntryId) {
        const selectedProcesses = this.selectedProcessesByScopeEntry.get(scopeEntryId);
        return selectedProcesses && selectedProcesses.size > 0;
    }

    /**
     * Method Name: getSelectedProcessesCountForEntry
     * @description: Get count of selected processes for a specific scope entry
     */
    getSelectedProcessesCountForEntry(scopeEntryId) {
        const selectedProcesses = this.selectedProcessesByScopeEntry.get(scopeEntryId);
        return selectedProcesses ? selectedProcesses.size : 0;
    }

    /**
     * Method Name: isDeleteProcessDisabledForEntry
     * @description: Check if delete process button should be disabled for a specific scope entry
     */
    isDeleteProcessDisabledForEntry(scopeEntryId) {
        return !this.hasSelectedProcessesForEntry(scopeEntryId);
    }
    
    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
    }

    /**
     * Method Name: connectedCallback
     * @description: Load external CSS and fetch scope entries
     */
    connectedCallback() {        
        this.fetchScopeEntryConfiguration();
        this.loadProcessLibraryData();
    }

    /**
     * Method Name: renderedCallback    
     * @description: Apply accordion styling once
    */
    renderedCallback() {
        if(!this.accordionStyleApplied){
            this.applyAccordionStyling();
        }
    }

    /**
     * Method Name: applyAccordionStyling   
     * @description: Dynamically apply styles to accordion headers
     */
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
            // Error styling accordion - silently continue
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
            case 'PICKLIST':
                return 'picklist';
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
                            type: this.getColumnType(field.fieldType),
                            editable: field.isEditable || false 
                        }));
                    } catch (error) {
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
                // Handle the new Map response structure
                if (result && result.success) {
                    this.scopeEntries = result.scopeEntries || [];
                    this.processSetupFlags = result.processSetupFlags || {};
                                        
                    this.applyFilters();
                } else {
                    // Handle error case
                    this.showToast('Error', result.error || 'Failed to fetch scope entries', 'error');
                    this.scopeEntries = [];
                    this.processSetupFlags = {};
                }
                this.isLoading = false;
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load scope entries', 'error');
                this.scopeEntries = [];
                this.processSetupFlags = {};
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
                
                // Search only in visible fields defined in tableColumns
                const searchInVisibleFields = (record) => {
                    // Get the visible columns
                    const visibleColumns = this.tableColumns || this.defaultColumns;
                    
                    for (let column of visibleColumns) {
                        const fieldValue = this.getFieldValue(record, column.fieldName);
                        
                        if (fieldValue !== null && fieldValue !== undefined) {
                            if (typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(searchLower)) {
                                return true;
                            } else if (typeof fieldValue === 'number' && fieldValue.toString().includes(searchLower)) {
                                return true;
                            }
                        }
                    }
                    return false;
                };
                
                return searchInVisibleFields(entry);
            });

            filteredEntries = filteredEntries.map(entry => {
                return {
                    ...entry,
                    hasCompleteProcessSetup: this.processSetupFlags[entry.Id] === true
                };
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
        // Prevent double-click by checking if already processing
        if (this.isLoading) {
            return;
        }

        this.isLoading = true;
        this.selectedRows = [];
        this.selectedProcesses = [];
        this.selectedProcessesByScopeEntry = new Map(); // Clear scope entry-specific selections
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
     * Method Name: handleRefreshProcessData
     * @description: Handle refresh button click for specific scope entry process data
     */
    handleRefreshProcessData(event) {
        const scopeEntryId = event.currentTarget.dataset.scopeEntryId;
        
        // Check if process is already loading to prevent double-click
        const entry = this.getEntryById(scopeEntryId);
        if (entry && entry.isLoadingProcesses) {
            return;
        }
        
        console.log('Refreshing process data for scope entry:', scopeEntryId);
        
        if (scopeEntryId) {
            this.loadProcessDetails(scopeEntryId);
        }
    }

    /**
     * Method Name: refreshScopeEntryProcessData
     * @description: General method to refresh process data for a specific scope entry
     */
    refreshScopeEntryProcessData(scopeEntryId) {
        try {
            // Store currently expanded entries
            const expandedEntries = new Set();
            this.scopeEntries.forEach(entry => {
                if (entry.showProcessDetails) {
                    expandedEntries.add(entry.Id);
                }
            });

            // Show loading state for the specific entry
            this.scopeEntries = this.scopeEntries.map(entry => {
                if (entry.Id === scopeEntryId) {
                    return {
                        ...entry,
                        isLoadingProcesses: true,
                        showProcessDetails: true // Ensure the table remains expanded
                    };
                }
                return entry;
            });

            // Re-fetch scope entries data to get updated process information
            getScopeEntries({ jobId: this.recordId })
                .then(result => {
                    if (result && result.success) {
                        this.scopeEntries = result.scopeEntries || [];
                        this.processSetupFlags = result.processSetupFlags || {};
                        
                        // Restore expanded state for all previously expanded entries
                        this.scopeEntries = this.scopeEntries.map(entry => {
                            if (expandedEntries.has(entry.Id)) {
                                return {
                                    ...entry,
                                    showProcessDetails: true,
                                    isLoadingProcesses: false
                                };
                            }
                            return entry;
                        });

                        // Apply filters to update displayed data
                        this.applyFilters();
                        
                        this.showToast('Success', 'Process data has been updated', 'success');
                    } else {
                        throw new Error(result.error || 'Failed to refresh process data');
                    }
                })
                .catch(error => {
                    this.showToast('Error', 'Failed to refresh process data', 'error');
                    
                    // Remove loading state on error
                    this.scopeEntries = this.scopeEntries.map(entry => {
                        if (entry.Id === scopeEntryId) {
                            return {
                                ...entry,
                                isLoadingProcesses: false
                            };
                        }
                        return entry;
                    });
                });
        } catch (error) {
            this.showToast('Error', 'Failed to refresh process data', 'error');
        }
    }

    /**
     * Method Name: handleDeleteSelectedProcesses
     * @description: Handle deletion of selected process entries with automatic recalculation
     */
    handleDeleteSelectedProcesses(event) {
        // Prevent double-click by checking if already processing
        if (this.isProcessSubmitting || this.isSavingProcessEntries) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const scopeEntryId = event.target.dataset.scopeEntryId;
        
        if (!scopeEntryId) {
            this.showToast('Error', 'Unable to identify scope entry for deletion', 'error');
            return;
        }

        const selectedProcesses = this.selectedProcessesByScopeEntry.get(scopeEntryId);
        if (!selectedProcesses || selectedProcesses.size === 0) {
            this.showToast('Warning', 'Please select at least one process to delete', 'warning');
            return;
        }

        const processIds = Array.from(selectedProcesses);

        // Set loading state to prevent multiple clicks
        this.isProcessSubmitting = true;

        // Call the apex method to delete selected processes
        deleteSelectedScopeEntryProcesses({ processIds: processIds })
            .then(result => {
                if (result && result.startsWith('Success')) {
                    // Enhanced success message that may include recalculation details
                    this.showToast('Success', 'Selected processes have been removed', 'success');
                    
                    // Clear selections for this scope entry
                    this.selectedProcessesByScopeEntry.delete(scopeEntryId);
                    
                    // Also remove from global array
                    this.selectedProcesses = this.selectedProcesses.filter(id => !processIds.includes(id));
                    
                    // Refresh all scope entries data to reflect the changes and recalculations
                    this.loadProcessDetails(scopeEntryId);
                } else {
                    throw new Error(result || 'Unknown error occurred');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to delete processes', 'error');
            })
            .finally(() => {
                // Reset loading state
                this.isProcessSubmitting = false;
            });
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
        } else if (type === 'changeOrderProcess') {
            this.changeOrderManualProcess = { ...this.changeOrderManualProcess, [field]: value };
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
        } else if (type === 'changeOrderProcess') {
            this.changeOrderManualProcess = { ...this.changeOrderManualProcess, [field]: value };
        }
    }

    /**
     * Method Name: validateScopeEntry
     * @description: Validate scope entry form data including type
     * @return: Object with isValid boolean and error message
     */
    validateScopeEntry() {
        const { name, contractValue, description } = this.newScopeEntry;
        
        // Check if any required field is missing
        const missingFields = [];
        
        if (!name || name.trim() === '') {
            missingFields.push('Name');
        }
        
        if (!contractValue || contractValue <= 0) {
            missingFields.push('Contract Value');
        }
        
        // If multiple required fields are missing, show generic message
        if (missingFields.length > 1) {
            return { isValid: false, message: 'Please fill all required fields' };
        }
        
        // Specific field validations
        if (!name || name.trim() === '') {
            return { isValid: false, message: 'Name is required' };
        }
        
        if (name.trim().length > 80) {
            return { isValid: false, message: 'Name cannot be longer than 80 characters' };
        }
        
        if (!contractValue) {
            return { isValid: false, message: 'Contract Value is required' };
        }
        
        if (contractValue <= 0) {
            return { isValid: false, message: 'Contract Value must be greater than 0' };
        }
        
        if (contractValue > 2000000000) {
            return { isValid: false, message: 'Contract Value cannot exceed 2,000,000,000' };
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
        // Prevent double-click by checking if already processing
        if (this.isSubmitting) {
            return;
        }

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
                    this.showToast('Success', 'New scope entry has been created', 'success');
                    this.handleCloseModal();
                    this.fetchScopeEntries();
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to create scope entry', 'error');
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
        // Prevent double-click by checking if already processing
        if (this.isLoading || this.isSavingScopeEntries) {
            return;
        }

        if (this.selectedRows.length === 0) {
            this.showToast('Warning', 'Please select at least one record to delete', 'warning');
            return;
        }

        this.isLoading = true;
            
        deleteScopeEntries({ scopeEntryIds: this.selectedRows })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Selected entries have been deleted', 'success');
                    this.selectedRows = [];
                    this.fetchScopeEntries();
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to delete records', 'error');
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
        
        // Reset selections but keep original state tracking
        this.selectedLocationIds = [];
        this.originalLocationIds = [];
        this.locationSearchTerm = '';
        
        // Load location data
        this.loadLocationData(scopeEntryId);
        
        this.showAddLocationModal = true;
        
    }


    /**
     * Method Name: processEntriesForDisplay
     * @description: Common method to process entries for display with nested table support and inline editing
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
            
            row.isProcessButtonsDisabled = !this.hasProcessModificationsForEntry(entry.Id) || this.isSavingProcessEntries;
            row.isProcessSaveDisabled = !this.hasProcessModificationsForEntry(entry.Id) || this.isSavingProcessEntries;
            row.processSaveButtonLabel = this.getProcessSaveButtonLabelForEntry(entry.Id);
            row.processDiscardButtonTitle = this.getProcessDiscardButtonTitleForEntry(entry.Id);
            
            // Add scope entry-specific delete properties
            row.hasSelectedProcesses = this.hasSelectedProcessesForEntry(entry.Id);
            row.selectedProcessesCount = this.getSelectedProcessesCountForEntry(entry.Id);
            row.isDeleteProcessDisabled = this.isDeleteProcessDisabledForEntry(entry.Id);
            
            row.displayFields = cols.map(col => {
                const cellKey = `${entry.Id}-${col.fieldName}`;
                const isBeingEdited = this.editingScopeCells.has(cellKey);
                const isModified = this.isScopeFieldModified(entry.Id, col.fieldName);
                
                let value = this.getFieldValue(entry, col.fieldName);
                let rawValue = value;
                let displayValue = value;
                
                // Check for modified value
                if (isModified) {
                    value = this.getModifiedScopeValue(entry.Id, col.fieldName);
                    rawValue = value;
                    displayValue = value;
                }
                
                // Format display value based on type
                if (col.type === 'currency' && value != null) {
                    displayValue = value;
                } else if (col.type === 'percent' && value != null) {
                    displayValue = value;
                } else if (col.type === 'date' && value) {
                    displayValue = this.formatDateForDisplay(value);
                }
                
                // Determine CSS classes
                let cellClass = col.editable ? 'center-trancate-text editable-cell' : 'center-trancate-text';
                let contentClass = 'editable-content';
                
                if (isModified) {
                    cellClass += ' modified-scope-cell';
                }
                
                if (isBeingEdited) {
                    cellClass += ' editing-cell';
                }
                
                // Prepare field data
                const fieldData = {
                    key: col.fieldName,
                    value: displayValue || '',
                    rawValue: rawValue,
                    cellClass: cellClass,
                    contentClass: contentClass,
                    isEditable: col.editable || false,
                    isBeingEdited: isBeingEdited,
                    hasValue: value != null && value !== '',
                    
                    // Type indicators
                    isDate: col.type === 'date',
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent',
                    isNumber: col.type === 'number',
                    isPicklist: col.type === 'picklist',
                    isNameField: col.fieldName === 'Name',
                    
                    // Date specific
                    dateValue: col.type === 'date' && value ? this.formatDateForInput(value) : '',
                    
                    // Currency specific
                    currencyValue: col.type === 'currency' ? (value || 0) : null,
                    
                    // Percent specific  
                    percentValue: col.type === 'percent' ? (value || 0) : null,
                    
                    // Current selected value for picklist
                    selectedValue: value || ''
                };
                
                // Add picklist options if it's a picklist field
                if (col.type === 'picklist') {
                    const options = this.fieldPicklistOptions.get(col.fieldName) || [];
                    fieldData.picklistOptions = options.map(option => ({
                        label: option.label,
                        value: option.value,
                        selected: option.value === value // Properly set selected state
                    }));
                }
                
                return fieldData;
            });
            
            return row;
        });
    }
    

    /**
     * Method Name: getPicklistValues
     * @description: Get picklist values for a field
     */
    async getPicklistValues(fieldName) {
        if (this.fieldPicklistOptions.has(fieldName)) {
            return this.fieldPicklistOptions.get(fieldName);
        }
        
        try {
            // Determine which object to query based on field name
            let objectApiName = 'wfrecon__Scope_Entry__c';
            
            // If field is from process table columns, use Scope_Entry_Process__c
            const isProcessField = this.processTableColumns.some(col => col.fieldName === fieldName);
            if (isProcessField) {
                objectApiName = 'wfrecon__Scope_Entry_Process__c';
            }
            
            // Call Apex to get picklist values
            const picklistValues = await getPicklistValuesForField({ 
                objectApiName: objectApiName,
                fieldApiName: fieldName 
            });
            
            const options = picklistValues.map(value => ({
                label: value,
                value: value
            }));
            
            this.fieldPicklistOptions.set(fieldName, options);
            return options;
        } catch (error) {
            return [];
        }
    }

    /**
     * Method Name: processProcessDetailsForDisplay
     * @description: Process process details for nested table display with inline editing support
     */
    processProcessDetailsForDisplay(processDetails) {
        if (!processDetails || processDetails.length === 0) {
            return [];
        }

        return processDetails.map(processData => {
            const row = { ...processData };
            // Fix: Link to Process Library record instead of Scope Entry Process
            row.recordUrl = processData.wfrecon__Process_Library__c ? 
                `/lightning/r/${processData.wfrecon__Process_Library__c}/view` : 
                `/lightning/r/${processData.Id}/view`;
            // Preserve selection state from scope entry-specific selection tracking
            const scopeEntryId = this.getScopeEntryIdForProcess(processData.Id);
            const selectedProcesses = this.selectedProcessesByScopeEntry.get(scopeEntryId);
            row.isSelected = selectedProcesses ? selectedProcesses.has(processData.Id) : false;
            
            row.displayFields = this.processTableColumns.map(col => {
                const key = col.fieldName;
                let value = this.getFieldValue(processData, key);
                
                // Check if this field has been modified
                const modifiedValue = this.getModifiedProcessValue(processData.Id, key);
                if (modifiedValue !== null && modifiedValue !== undefined) {
                    value = modifiedValue;
                }
                
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                const isModified = this.isProcessFieldModified(processData.Id, key);
                const isBeingEdited = this.editingProcessCells.has(`${processData.Id}-${key}`);
                
                // Check if field is editable
                let isEditable = col.editable || false;
                
                // Handle conditional editing for Process Name (only editable if IsManual is true)
                if (col.conditionalEdit && key === 'wfrecon__Process_Name__c') {
                    isEditable = isEditable && this.getFieldValue(processData, 'wfrecon__IsManual__c') === true;
                }
                
                // Build cell classes
                let cellClass = 'center-trancate-text';
                if (isEditable) {
                    cellClass += ' editable-cell';
                }
                if (isModified && !isBeingEdited) {
                    cellClass += ' modified-process-cell';
                }
                if (isBeingEdited) {
                    cellClass += ' editing-cell';
                }
                
                // Build content classes
                let contentClass = 'editable-content';
                
                // Handle currency fields
                let currencyValue = 0;
                if (col.type === 'currency') {
                    currencyValue = value !== null && value !== undefined ? parseFloat(value) : 0;
                }

                // Handle percentage fields
                let percentValue = 0;
                if (col.type === 'percent') {
                    percentValue = value !== null && value !== undefined ? parseFloat(value) : 0;
                }

                // Handle number fields  
                let numberValue = 0;
                if (col.type === 'number') {
                    numberValue = value !== null && value !== undefined ? parseFloat(value) : 0;
                }

                // Handle date fields
                let dateValue = '';
                if (col.type === 'date' && value) {
                    dateValue = this.formatDateForInput(value);
                }

                // Handle picklist fields - NO ASYNC CALLS HERE
                let picklistOptions = [];
                if (col.type === 'picklist') {
                    // Check if we already have options cached
                    if (this.fieldPicklistOptions.has(key)) {
                        picklistOptions = this.fieldPicklistOptions.get(key);
                    }
                    // If editing and no options, we'll load them synchronously elsewhere
                }
                
                // Fix hasValue logic to properly handle empty strings and null values
                let hasValue;
                if (col.type === 'currency' || col.type === 'percent' || col.type === 'number') {
                    hasValue = value !== null && value !== undefined && !isNaN(value);
                } else {
                    hasValue = value !== null && value !== undefined && String(value).trim() !== '';
                }
                
                return {
                    key,
                    value: displayValue || (col.type === 'currency' ? '0' : col.type === 'percent' ? '0%' : col.type === 'number' ? '0' : '--'),
                    rawValue: value,
                    currencyValue: currencyValue,
                    percentValue: percentValue,
                    numberValue: numberValue,
                    dateValue: dateValue,
                    picklistOptions: picklistOptions,
                    hasValue: hasValue,
                    isNameField: key === 'wfrecon__Process_Library__r.Name',
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent',
                    isNumber: col.type === 'number',
                    isDate: col.type === 'date',
                    isPicklist: col.type === 'picklist',
                    isEditable: isEditable,
                    isModified: isModified,
                    isBeingEdited: isBeingEdited,
                    cellClass: cellClass,
                    contentClass: contentClass
                };
            });

            return row;
        });
    }

    /**
     * Method Name: formatDateForInput
     * @description: Format date for input field (YYYY-MM-DD)
     */
    formatDateForInput(dateValue) {
        if (!dateValue) return '';
        
        try {
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return '';
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            
            return `${year}-${month}-${day}`;
        } catch (error) {
            return '';
        }
    }

    /**
     * Method Name: formatDateForDisplay
     * @description: Format date for display (locale-specific)
     */
    formatDateForDisplay(dateValue) {
        if (!dateValue) return '--';
        
        try {
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return '--';
            
            return date.toLocaleDateString();
        } catch (error) {
            return '--';
        }
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

        try{
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
        catch(error){
            // Error loading process details - silently continue
        }
        
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
                this.updateProcessDetails(scopeEntryId, []);
                this.showToast('Error', 'Failed to load process details', 'error');
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
        
        // Check if any required field is missing
        const missingFields = [];
        
        if (!processName || processName.trim() === '') {
            missingFields.push('Process Name');
        }
        
        if (!sequence || sequence <= 0) {
            missingFields.push('Sequence');
        }
        
        if (!processType || processType.trim() === '') {
            missingFields.push('Process Type');
        }
        
        if (!weightage || weightage <= 0) {
            missingFields.push('Weight');
        }
        
        if (!measurementType || measurementType.trim() === '') {
            missingFields.push('Measurement Type');
        }
        
        // If multiple required fields are missing, show generic message
        if (missingFields.length > 1) {
            return { isValid: false, message: 'Please fill all required fields' };
        }
        
        // Specific field validations
        if (!processName || processName.trim() === '') {
            return { isValid: false, message: 'Process Name is required' };
        }
        
        if (processName.trim().length > 80) {
            return { isValid: false, message: 'Process Name cannot be longer than 80 characters' };
        }
        
        if (!sequence) {
            return { isValid: false, message: 'Sequence is required' };
        }
        
        if (sequence <= 0 || sequence > 9999) {
            return { isValid: false, message: 'Sequence must be between 1 and 9999' };
        }
        
        if (!processType || processType.trim() === '') {
            return { isValid: false, message: 'Process Type is required' };
        }
        
        if (!weightage) {
            return { isValid: false, message: 'Weight is required' };
        }
        
        if (weightage <= 0 || weightage > 9999) {
            return { isValid: false, message: 'Weight must be between 0.01 and 9999' };
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
        // Prevent double-click by checking if already processing
        if (this.isProcessSubmitting) {
            return;
        }

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
                    this.showToast('Success', 'Process has been added', 'success');
                    this.handleCloseProcessModal();
                    
                    // Refresh the process details for this scope entry while preserving selections
                    this.refreshProcessDetails(this.selectedScopeEntryId);
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to create process', 'error');
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
        const scopeEntryId = event.target.dataset.scopeEntryId;
        const isChecked = event.target.checked;

        // Initialize the scope entry set if it doesn't exist
        if (!this.selectedProcessesByScopeEntry.has(scopeEntryId)) {
            this.selectedProcessesByScopeEntry.set(scopeEntryId, new Set());
        }

        const selectedProcesses = this.selectedProcessesByScopeEntry.get(scopeEntryId);

        if (isChecked) {
            selectedProcesses.add(processId);
            // Also maintain global array for backward compatibility if needed
            if (!this.selectedProcesses.includes(processId)) {
                this.selectedProcesses = [...this.selectedProcesses, processId];
            }
        } else {
            selectedProcesses.delete(processId);
            // Remove from global array as well
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
        
        // Initialize the scope entry set if it doesn't exist
        if (!this.selectedProcessesByScopeEntry.has(scopeEntryId)) {
            this.selectedProcessesByScopeEntry.set(scopeEntryId, new Set());
        }

        const selectedProcesses = this.selectedProcessesByScopeEntry.get(scopeEntryId);
        
        if (isChecked) {
            // Add all process IDs for this scope entry
            processIds.forEach(id => selectedProcesses.add(id));
            // Add to global array that aren't already selected
            const newSelections = processIds.filter(id => !this.selectedProcesses.includes(id));
            this.selectedProcesses = [...this.selectedProcesses, ...newSelections];
        } else {
            // Remove all process IDs for this scope entry
            processIds.forEach(id => selectedProcesses.delete(id));
            // Remove from global array as well
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

        // Update sort icons after DOM re-renders
        setTimeout(() => {
            this.refreshAllSortIcons();
        }, 100);
    }

    /**
     * Method Name: refreshAllSortIcons
     * @description: Refresh all sort icons for scope entries and their process tables
     */
    refreshAllSortIcons() {
        try {
            // Refresh contract section sort icons
            if (this.contractSortField) {
                this.updateSortIcons('contract');
            }

            // Refresh change order section sort icons
            if (this.changeOrderSortField) {
                this.updateSortIcons('changeOrder');
            }

            // Refresh process table sort icons for each scope entry that has sort state
            this.processSortByEntry.forEach((sortState, scopeEntryId) => {
                if (sortState && sortState.sortField) {
                    this.updateProcessSortIcons(scopeEntryId);
                }
            });
        } catch (error) {
            // Error refreshing sort icons - silently continue
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
        
        // Reset selections and clear all modal data
        this.selectedProcessLibraryIds = [];
        this.processLibrarySearchTerm = '';
        this.selectedProcessCategory = '';
        this.processLibraryDisplayRecords = [];
        this.processLibraryRecords = [];
        
        // Load process library records and types
        this.showProcessLibraryModal = true;
        
        
        this.loadProcessLibraryData();
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

                // Create separate category options with "All" option for filter dropdown
                this.processTypeCategoryOptions = [
                    { label: 'All', value: '' },
                    ...this.processTypeOptions
                ];

            })
            .catch(error => {
                this.processTypeOptions = [];
                this.processTypeCategoryOptions = [{ label: 'All', value: '' }];
            });
    
        // Load process library records
        getProcessLibraryRecords()
            .then(result => {
                this.processLibraryRecords = result || [];
                this.applyProcessLibraryFilters(); // Apply filters after loading
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load process library', 'error');
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
        // Note: isSelected will be false for all records since selectedProcessLibraryIds was cleared
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
        this.processLibraryDisplayRecords = [];
        this.processLibraryRecords = [];
        
    }

    /**
     * Method Name: handleSaveProcessesFromLibrary
     * @description: Save selected processes from library
     */
    handleSaveProcessesFromLibrary() {
        // Prevent double-click by checking if already processing
        if (this.isProcessLibrarySubmitting) {
            return;
        }

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
                    this.showToast('Success', 'Processes have been added from library', 'success');
                    this.handleCloseProcessLibraryModal();
                    
                    // Refresh the process details for this scope entry while preserving selections
                    this.refreshProcessDetails(this.selectedScopeEntryId);
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to add processes', 'error');
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
                this.updateProcessDetails(scopeEntryId, []);
                this.showToast('Error', 'Failed to refresh process details', 'error');
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
            this.selectedLocationIds = [...(existingLocationIds || [])]; // Create a copy
            this.originalLocationIds = [...(existingLocationIds || [])]; // Store original state
            
            this.applyLocationFilters();
        })
        .catch(error => {
            this.showToast('Error', 'Failed to load locations', 'error');
            this.locationRecords = [];
            this.locationDisplayRecords = [];
            this.selectedLocationIds = [];
            this.originalLocationIds = [];
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
        this.selectedLocationScopeEntryId = '';
        this.selectedScopeEntryName = '';
        this.selectedLocationIds = [];
        this.originalLocationIds = []; // Clear original state
        this.locationSearchTerm = '';
        this.locationRecords = [];
        this.locationDisplayRecords = [];
        
    }

    /**
     * Method Name: handleSaveLocations
     * @description: Save selected locations and create location processes
     */
    handleSaveLocations() {
        // Prevent double-click by checking if already processing
        if (this.isLocationSubmitting) {
            return;
        }

        // Check if any locations are selected
        if (!this.selectedLocationIds || this.selectedLocationIds.length === 0) {
            this.showToast('Warning', 'Please select at least one location', 'warning');
            return;
        }

        this.isLocationSubmitting = true;
        
        // Calculate the differences
        const originalIds = new Set(this.originalLocationIds || []);
        const selectedIds = new Set(this.selectedLocationIds || []);
        
        const addedLocationIds = [...selectedIds].filter(id => !originalIds.has(id));
        const removedLocationIds = [...originalIds].filter(id => !selectedIds.has(id));
        const unchangedLocationIds = [...selectedIds].filter(id => originalIds.has(id));

        const scopeEntryId = this.selectedLocationScopeEntryId;
        
        const locationData = {
            scopeEntryId: this.selectedLocationScopeEntryId,
            selectedLocationIds: this.selectedLocationIds,
            originalLocationIds: this.originalLocationIds,
            addedLocationIds: addedLocationIds,
            removedLocationIds: removedLocationIds,
            unchangedLocationIds: unchangedLocationIds,
            hasChanges: addedLocationIds.length > 0 || removedLocationIds.length > 0
        };

        createLocationProcesses({ locationData })
            .then(result => {
                if (result.includes('Success')) {
                    this.showToast('Success', 'Locations have been updated', 'success');
                    this.handleCloseLocationModal();
                    this.refreshProcessDetails(scopeEntryId);
                    
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to add locations', 'error');
            })
            .finally(() => {
                this.isLocationSubmitting = false;
            });
    }

    /**
     * Method Name: handleSortClick
     * @description: Handle column header click for sorting - FIXED with section context
     */
    handleSortClick(event) {
        try {
            const fieldName = event.currentTarget.dataset.id;
            const section = event.currentTarget.dataset.section; // ADD THIS to template: data-section="contract" or "changeOrder"
            
            // Determine which sort fields to use based on section
            let currentSortField, currentSortOrder;
            
            if (section === 'contract') {
                currentSortField = this.contractSortField;
                currentSortOrder = this.contractSortOrder;
            } else {
                currentSortField = this.changeOrderSortField;
                currentSortOrder = this.changeOrderSortOrder;
            }
            
            // Clear sort icons for this section only
            this.clearSortIcons(section);
            
            // Toggle or set sort
            if (currentSortField === fieldName) {
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = fieldName;
                currentSortOrder = 'asc';
            }
            
            // Update the appropriate sort fields
            if (section === 'contract') {
                this.contractSortField = currentSortField;
                this.contractSortOrder = currentSortOrder;
            } else {
                this.changeOrderSortField = currentSortField;
                this.changeOrderSortOrder = currentSortOrder;
            }
            
            this.sortData(section);
            this.updateSortIcons(section);
        } catch (error) {
            // Error handling sort - silently continue
        }
    }

    /**
     * Method Name: handleProcessSortClick
     * @description: Handle column header click for sorting in process table - FIXED
     */
    handleProcessSortClick(event) {
        try {
            const fieldName = event.currentTarget.dataset.id;
            const scopeEntryId = event.currentTarget.dataset.scopeEntryId;
            
            // Get current sort state for this specific entry
            let currentSort = this.processSortByEntry.get(scopeEntryId) || { sortField: '', sortOrder: 'asc' };
            
            // Toggle or set sort
            if (currentSort.sortField === fieldName) {
                currentSort.sortOrder = currentSort.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                // Clear icons for this scope entry only when changing field
                this.clearProcessSortIcons(scopeEntryId);
                currentSort.sortField = fieldName;
                currentSort.sortOrder = 'asc';
            }
            
            // Update the sort state for this entry
            this.processSortByEntry.set(scopeEntryId, currentSort);
            
            this.sortProcessData(scopeEntryId);
            this.updateProcessSortIcons(scopeEntryId);
        } catch (error) {
            // Error handling process sort - silently continue
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
                // Get the sort state for this specific scope entry
                const sortState = this.processSortByEntry.get(scopeEntryId);
                if (!sortState || !sortState.sortField) {
                    return; // No sort state or field, nothing to update
                }
                
                // Add active class to current sorted header for this specific scope entry
                const currentHeaders = this.template.querySelectorAll(`.process-sortable-header[data-process-sort-field="${sortState.sortField}"][data-scope-entry-id="${scopeEntryId}"]`);
                currentHeaders.forEach(header => {
                    header.classList.add('active-sort');
                    
                    // Add rotation to the icon
                    const icon = header.querySelector('.process-sort-icon svg');
                    if (icon) {
                        // Remove any existing rotation classes first
                        icon.classList.remove('rotate-asc', 'rotate-desc');
                        // Add the correct rotation
                        icon.classList.add(sortState.sortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
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
                        icon.classList.remove('rotate-asc', 'rotate-desc');
                        icon.classList.add(this.processSortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                    }
                });
            }
        } catch (error) {
            // Error updating process sort icons - silently continue
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
            // Error clearing process sort icons - silently continue
        }
    }

    /**
     * Method Name: clearSortIcons
     * @description: Clear all sort icons and active states - FIXED with section
     */
    clearSortIcons(section) {
        try {
            const selector = section ? `.sortable-header[data-section="${section}"]` : '.sortable-header';
            const allHeaders = this.template.querySelectorAll(selector);
            allHeaders.forEach(header => {
                header.classList.remove('active-sort');
            });
            
            const iconSelector = section ? `.sortable-header[data-section="${section}"] .sort-icon svg` : '.sort-icon svg';
            const allIcons = this.template.querySelectorAll(iconSelector);
            allIcons.forEach(icon => {
                icon.classList.remove('rotate-asc', 'rotate-desc');
            });
        } catch (error) {
            // Error clearing sort icons - silently continue
        }
    }

    /**
     * Method Name: updateSortIcons
     * @description: Update sort icons and active states - FIXED with section
     */
    updateSortIcons(section) {
        try {
            const sortField = section === 'contract' ? this.contractSortField : this.changeOrderSortField;
            const sortOrder = section === 'contract' ? this.contractSortOrder : this.changeOrderSortOrder;
            
            if (!sortField) return;
            
            const currentHeaders = this.template.querySelectorAll(`[data-sort-field="${sortField}"][data-section="${section}"]`);
            currentHeaders.forEach(header => {
                header.classList.add('active-sort');
                
                const icon = header.querySelector('.sort-icon svg');
                if (icon) {
                    icon.classList.add(sortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                }
            });
        } catch (error) {
            // Error updating sort icons - silently continue
        }
    }

    /**
     * Method Name: sortProcessData
     * @description: Sort the process data for a specific scope entry - FIXED
     */
    sortProcessData(scopeEntryId) {
        try {
            const sortState = this.processSortByEntry.get(scopeEntryId);
            if (!sortState || !sortState.sortField) return;
            
            const sortFunction = (a, b) => {
                let aValue = this.getFieldValue(a, sortState.sortField);
                let bValue = this.getFieldValue(b, sortState.sortField);

                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';

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

                return sortState.sortOrder === 'asc' ? compare : -compare;
            };
            
            // Update contract entries
            this.filteredContractEntries = this.filteredContractEntries.map(entry => {
                if (entry.Id === scopeEntryId && entry.processDetails) {
                    const sortedProcessDetails = [...entry.processDetails].sort(sortFunction);
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
                    const sortedProcessDetails = [...entry.processDetails].sort(sortFunction);
                    return {
                        ...entry,
                        processDetails: sortedProcessDetails
                    };
                }
                return entry;
            });
        } catch (error) {
            // Error sorting process data - silently continue
        }
    }

    /**
     * Method Name: sortData
     * @description: Sort the data based on current sort field and order - FIXED with section
     */
    sortData(section) {
        try {
            const sortField = section === 'contract' ? this.contractSortField : this.changeOrderSortField;
            const sortOrder = section === 'contract' ? this.contractSortOrder : this.changeOrderSortOrder;
            
            if (!sortField) return;
            
            const sortFunction = (a, b) => {
                let aValue = this.getFieldValue(a, sortField);
                let bValue = this.getFieldValue(b, sortField);

                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';

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

                return sortOrder === 'asc' ? compare : -compare;
            };
            
            if (section === 'contract') {
                this.filteredContractEntries = [...this.filteredContractEntries].sort(sortFunction);
            } else {
                this.filteredChangeOrderEntries = [...this.filteredChangeOrderEntries].sort(sortFunction);
            }
        } catch (error) {
            // Error sorting data - silently continue
        }
    }

    /**
     * Method Name: handleScopeCellClick
     * @description: Handle cell click for inline editing of scope entries
     */
    async handleScopeCellClick(event) {
        const recordId = event.currentTarget.dataset.recordId;
        const fieldName = event.currentTarget.dataset.fieldName;
        const isEditable = event.currentTarget.dataset.editable === 'true';
        
        if (!isEditable) return;
        
        const cellKey = `${recordId}-${fieldName}`;
        
        // Don't open editor if already editing this cell
        if (this.editingScopeCells.has(cellKey)) return;
        
        // Find the column to check if it's a picklist
        const column = this.tableColumns.find(col => col.fieldName === fieldName);
        
        // If it's a picklist and we don't have options yet, load them
        if (column && column.type === 'picklist' && !this.fieldPicklistOptions.has(fieldName)) {
            try {
                await this.getPicklistValues(fieldName);
            } catch (error) {
                // Error loading picklist values - continue without picklist
            }
        }
        
        // Start editing
        this.editingScopeCells.add(cellKey);
        this.applyFilters();
        
        // Auto-focus the input after DOM update with increased delay and better targeting
        setTimeout(() => {
            // Try multiple selectors to find the input/select element
            let inputElement = null;
            
            // For regular inputs
            inputElement = this.template.querySelector(`input[data-record-id="${recordId}"][data-field-name="${fieldName}"]`);
            
            // For select elements (picklists)
            if (!inputElement) {
                inputElement = this.template.querySelector(`select[data-record-id="${recordId}"][data-field-name="${fieldName}"]`);
            }
            
            // For combobox elements
            if (!inputElement) {
                const combobox = this.template.querySelector(`lightning-combobox[data-record-id="${recordId}"][data-field-name="${fieldName}"]`);
                if (combobox) {
                    inputElement = combobox.querySelector('input');
                }
            }
            
            if (inputElement) {
                inputElement.focus();
                
                // For text inputs, select all text for easier editing
                if (inputElement.type === 'text' || inputElement.type === 'number') {
                    inputElement.select();
                }
            } else {
                // Could not find input element - silently continue
            }
        }, 100); // Increased delay to ensure DOM is fully rendered
    }
    /**
     * Method Name: handleScopeCellInputChange
     * @description: Handle input change in scope inline editing - FIXED
     */
    handleScopeCellInputChange(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.fieldName;
        const fieldType = event.target.dataset.fieldType;
        let newValue = event.target.value;
        
        // Type conversion based on field type
        if (fieldType === 'number') {
            if (newValue === '' || newValue === null || newValue === undefined) {
                newValue = null;
            } else {
                newValue = parseFloat(newValue);
                if (isNaN(newValue)) {
                    newValue = null;
                }
            }
        } else if (fieldType === 'date') {
            // Convert date string to ISO format for storage
            if (newValue) {
                try {
                    const date = new Date(newValue);
                    newValue = date.toISOString();
                } catch (error) {
                    newValue = null;
                }
            } else {
                newValue = null;
            }
        }
        // Picklist and text fields remain as strings
        
        // Get original value to compare
        const originalEntry = [...this.filteredContractEntries, ...this.filteredChangeOrderEntries].find(entry => entry.Id === recordId);
        const originalValue = this.getFieldValue(originalEntry, fieldName);
        
        // Track modifications
        if (!this.modifiedScopeEntries.has(recordId)) {
            this.modifiedScopeEntries.set(recordId, {});
        }
        
        const modifications = this.modifiedScopeEntries.get(recordId);
        
        // Compare values properly
        const areValuesEqual = (val1, val2) => {
            if (val1 === val2) return true;
            if ((val1 === null || val1 === undefined || val1 === '') && 
                (val2 === null || val2 === undefined || val2 === '')) return true;
            if (fieldType === 'number' && !isNaN(val1) && !isNaN(val2)) {
                return parseFloat(val1) === parseFloat(val2);
            }
            if (fieldType === 'date') {
                // Compare dates
                if (!val1 || !val2) return val1 === val2;
                try {
                    const date1 = new Date(val1);
                    const date2 = new Date(val2);
                    return date1.getTime() === date2.getTime();
                } catch (error) {
                    return false;
                }
            }
            return false;
        };
        
        if (!areValuesEqual(newValue, originalValue)) {
            modifications[fieldName] = newValue;
        } else {
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
        try {
            const recordId = event.target.dataset.recordId;
            const fieldName = event.target.dataset.fieldName;
            const cellKey = `${recordId}-${fieldName}`;
            
            // Remove from editing set
            this.editingScopeCells.delete(cellKey);
            
            // Trigger reactivity to show normal cell
            this.applyFilters();
        } catch (error) {
            // Error handling blur event - silently continue
        }
        
    }

    /**
     * Method Name: validateScopeChanges
     * @description: Validate scope entry modifications before saving
     */
    validateScopeChanges() {
        const errors = [];
        
        for (const [recordId, changes] of this.modifiedScopeEntries.entries()) {
            const entry = this.scopeEntries.find(e => e.Id === recordId);
            const entryName = entry ? entry.Name : recordId;
            
            for (const [fieldName, value] of Object.entries(changes)) {
                // Get field metadata to determine validation rules
                const column = this.tableColumns.find(col => col.fieldName === fieldName);
                
                if (column) {

                    console.log(`Validating ${entryName} - ${column.label}:`, value);
                    console.log('Type:', column.type);
                    
                    // Text field validation
                    if (column.type === 'text') {
                        // Check for empty values after trimming
                        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
                            errors.push(`${entryName} - ${column.label}: Field cannot be empty`);
                        }
                        // Check max 80 characters
                        else if (value && value.length > 80) {
                            errors.push(`${entryName} - ${column.label}: Text cannot exceed 80 characters (current: ${value.length})`);
                        }
                    }
                    
                    // Number field validation (max 6 digits with 2 decimal places)
                    if ((column.type === 'number' || column.type === 'currency' || column.type === 'percent')) {
                        // Check for empty, null, undefined, or zero values
                        if (value === null || value === undefined || value === '' || 
                            (typeof value === 'string' && value.trim() === '') ||
                            (typeof value === 'string' && value.trim() === '-') ||
                            parseFloat(value) === 0) {
                            errors.push(`${entryName} - ${column.label}: Field cannot be empty or zero`);
                        }
                        else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                                // Check for negative numbers
                                if (numValue < 0) {
                                    errors.push(`${entryName} - ${column.label}: Negative numbers are not allowed`);
                                }
                                
                                // Check if number has more than 6 digits before decimal
                                const wholePart = Math.floor(Math.abs(numValue)).toString();
                                if (wholePart.length > 6) {
                                    errors.push(`${entryName} - ${column.label}: Number cannot have more than 6 digits before decimal point (current: ${wholePart.length})`);
                                }
                                
                                // Check if number has more than 2 decimal places
                                const decimalPart = numValue.toString().split('.')[1];
                                if (decimalPart && decimalPart.length > 2) {
                                    errors.push(`${entryName} - ${column.label}: Number cannot have more than 2 decimal places (current: ${decimalPart.length})`);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return errors;
    }

    /**
     * Method Name: handleSaveScopeChanges
     * @description: Save all modified scope entries in a single batch
     */
    handleSaveScopeChanges() {
        // Prevent double-click by checking if already processing
        if (this.isSavingScopeEntries || this.isLoading) {
            return;
        }

        if (this.modifiedScopeEntries.size === 0) {
            return;
        }

        // Validate changes before saving
        const validationErrors = this.validateScopeChanges();
        if (validationErrors.length > 0) {
            this.showToast('Validation Error', validationErrors.join('\n'), 'error');
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
                    this.showToast('Success', 'Your changes have been saved', 'success');
                    
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
                this.showToast('Error', 'Failed to update scope entries', 'error');
            })
            .finally(() => {
                this.isSavingScopeEntries = false;
            });
    }

    handleScopePicklistChange(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.fieldName;
        const newValue = event.target.value;
        
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
            delete modifications[fieldName];
            if (Object.keys(modifications).length === 0) {
                this.modifiedScopeEntries.delete(recordId);
            }
        }
        
        // Update hasScopeModifications flag
        this.hasScopeModifications = this.modifiedScopeEntries.size > 0;
        
        // Trigger reactivity
        this.applyFilters();
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
        
        this.showToast('Success', 'Changes have been discarded', 'success');
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

    /*
    * Method Name: getProcessButtonsDisabledForEntry
    * @description: Check if process buttons should be disabled for specific entry
    */
    getProcessButtonsDisabledForEntry(scopeEntryId) {
        return !this.hasProcessModificationsForEntry(scopeEntryId) || this.isSavingProcessEntries;
    }
    
    /**
    * Method Name: getProcessSaveButtonLabelForEntry
    * @description: Get dynamic process save button label for specific entry
    */
    getProcessSaveButtonLabelForEntry(scopeEntryId) {
        if (this.isSavingProcessEntries) {
            return 'Saving...';
        }
        const count = this.getProcessModificationCountForEntry(scopeEntryId);
        if (count > 0) {
            return `Save Changes (${count})`;
        }
        return 'Save Changes';
    }
    
    /**
    * Method Name: getProcessDiscardButtonTitleForEntry
    * @description: Get dynamic process discard button title for specific entry
    */
    getProcessDiscardButtonTitleForEntry(scopeEntryId) {
        const count = this.getProcessModificationCountForEntry(scopeEntryId);
        if (count === 0) {
            return 'No process changes to discard';
        }
        return `Discard ${count} unsaved process change(s)`;
    }

    /**
     * Method Name: handleCreateChangeOrder
     * @description: Open change order creation modal
     */
    handleCreateChangeOrder(event) {
        const scopeEntryId = event.currentTarget.dataset.recordId;
        const entry = this.getEntryById(scopeEntryId);
        
        if (!entry) {
            this.showToast('Error', 'Scope entry not found', 'error');
            return;
        }

        this.selectedScopeEntryForChangeOrder = entry;
        this.changeOrderStep = 1;
        this.changeOrderData = {
            name: `${entry.Name} - CO`,
            contractValue: null,
            processOption: ''
        };
        this.selectedChangeOrderProcessIds = [];
        
        this.showCreateChangeOrderModal = true;
    
        
        // Load process library data for potential use in step 2
        this.loadProcessLibraryData();
    }

    /**
     * Method Name: handleCloseChangeOrderModal
     * @description: Close change order modal and reset data
     */
    handleCloseChangeOrderModal() {
        this.showCreateChangeOrderModal = false;
        this.selectedScopeEntryForChangeOrder = null;
        this.changeOrderStep = 1;
        this.changeOrderData = {
            name: '',
            contractValue: null,
            processOption: ''
        };
        this.selectedChangeOrderProcessIds = [];
        

    }

    /**
     * Method Name: handleChangeOrderInputChange
     * @description: Handle input changes in change order form with real-time validation
     */
    handleChangeOrderInputChange(event) {
        const field = event.target.dataset.field;
        let value = event.target.type === 'number' ? parseFloat(event.target.value) : event.target.value;
        
        // Real-time validation for contract value
        if (field === 'contractValue' && event.target.type === 'number') {
            if (value > 2000000000) {
                event.target.style.borderColor = '#dc3545';
                event.target.style.boxShadow = '0 0 0 2px rgba(220, 53, 69, 0.2)';
                setTimeout(() => {
                    this.showToast('Error', 'Contract Value cannot exceed 2,000,000,000', 'error');
                }, 100);
                return;
            } else {
                event.target.style.borderColor = '';
                event.target.style.boxShadow = '';
            }
        }
        
        this.changeOrderData = { ...this.changeOrderData, [field]: value };
    }

    /**
     * Method Name: handleChangeOrderSelectChange
     * @description: Handle select changes in change order form
     */
    handleChangeOrderSelectChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;
        
        this.changeOrderData = { ...this.changeOrderData, [field]: value };
    }

    /**
     * Method Name: handleChangeOrderNextStep
     * @description: Proceed to step 2 of change order creation
     */
    handleChangeOrderNextStep() {
        const validation = this.validateChangeOrderStep1();
        if (!validation.isValid) {
            this.showToast('Error', validation.message, 'error');
            return;
        }

        // Reset manual process data when entering step 2
        if (this.changeOrderData.processOption === 'manual') {
            this.changeOrderManualProcess = {
                processName: '',
                sequence: null,
                processType: '',
                weightage: null,
                measurementType: ''
            };
        }

        // Reset process library filters and selections for change order
        if (this.changeOrderData.processOption === 'library') {
            this.selectedProcessCategory = ''; // Reset to "All"
            this.processLibrarySearchTerm = '';
            this.selectedChangeOrderProcessIds = [];
        }

        this.changeOrderStep = 2;
    }

    /**
     * Method Name: handleChangeOrderPreviousStep
     * @description: Go back to step 1 of change order creation
     */
    handleChangeOrderPreviousStep() {
        this.changeOrderStep = 1;
    }

    /**
     * Method Name: handleChangeOrderProcessSelection
     * @description: Handle process selection in change order modal
     */
    handleChangeOrderProcessSelection(event) {
        const processId = event.target.dataset.processId;
        const isChecked = event.target.checked;

        if (isChecked) {
            if (!this.selectedChangeOrderProcessIds.includes(processId)) {
                this.selectedChangeOrderProcessIds = [...this.selectedChangeOrderProcessIds, processId];
            }
        } else {
            this.selectedChangeOrderProcessIds = this.selectedChangeOrderProcessIds.filter(id => id !== processId);
        }

        // Update display records
        this.processLibraryDisplayRecords = this.processLibraryDisplayRecords.map(process => ({
            ...process,
            isSelected: this.selectedChangeOrderProcessIds.includes(process.Id)
        }));
    }

    /**
     * Method Name: handleSelectAllChangeOrderProcesses
     * @description: Handle select all for change order processes
     */
    handleSelectAllChangeOrderProcesses(event) {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            const visibleIds = this.processLibraryDisplayRecords.map(process => process.Id);
            const newSelections = visibleIds.filter(id => !this.selectedChangeOrderProcessIds.includes(id));
            this.selectedChangeOrderProcessIds = [...this.selectedChangeOrderProcessIds, ...newSelections];
        } else {
            const visibleIds = this.processLibraryDisplayRecords.map(process => process.Id);
            this.selectedChangeOrderProcessIds = this.selectedChangeOrderProcessIds.filter(id => !visibleIds.includes(id));
        }

        this.processLibraryDisplayRecords = this.processLibraryDisplayRecords.map(process => ({
            ...process,
            isSelected: this.selectedChangeOrderProcessIds.includes(process.Id)
        }));
    }

    /**
     * Method Name: validateChangeOrderStep2
     * @description: Validate step 2 data
     */
    validateChangeOrderStep2() {
        if (this.changeOrderData.processOption === 'manual') {
            const { processName, sequence, processType, weightage, measurementType } = this.changeOrderManualProcess;
            
            // Check if any required field is missing
            const missingFields = [];
            
            if (!processName || processName.trim() === '') {
                missingFields.push('Process Name');
            }
            
            if (!sequence || sequence <= 0) {
                missingFields.push('Sequence');
            }
            
            if (!processType || processType.trim() === '') {
                missingFields.push('Process Type');
            }
            
            if (!weightage || weightage <= 0) {
                missingFields.push('Weight');
            }
            
            if (!measurementType || measurementType.trim() === '') {
                missingFields.push('Measurement Type');
            }
            
            // If multiple required fields are missing, show generic message
            if (missingFields.length > 1) {
                return { isValid: false, message: 'Please fill all required fields' };
            }
            
            // Specific field validations
            if (!processName || processName.trim() === '') {
                return { isValid: false, message: 'Process Name is required' };
            }
            
            if (processName.trim().length > 80) {
                return { isValid: false, message: 'Process Name cannot be longer than 80 characters' };
            }
            
            if (!sequence) {
                return { isValid: false, message: 'Sequence is required' };
            }
            
            if (sequence <= 0 || sequence > 9999) {
                return { isValid: false, message: 'Sequence must be between 1 and 9999' };
            }
            
            if (!processType || processType.trim() === '') {
                return { isValid: false, message: 'Process Type is required' };
            }
            
            if (!weightage) {
                return { isValid: false, message: 'Weight is required' };
            }
            
            if (weightage <= 0 || weightage > 9999) {
                return { isValid: false, message: 'Weight must be between 0.01 and 9999' };
            }
            
            if (!measurementType || measurementType.trim() === '') {
                return { isValid: false, message: 'Measurement Type is required' };
            }
            
            return { isValid: true, message: '' };
        } else if (this.changeOrderData.processOption === 'library') {
            if (this.selectedChangeOrderProcessIds.length === 0) {
                return { isValid: false, message: 'Please select at least one process from the library' };
            }
        }
        return { isValid: true, message: '' };
    }

    /**
     * Method Name: handleSaveChangeOrder
     * @description: Save the change order
     */
    handleSaveChangeOrder() {
        // Prevent double-click by checking if already processing
        if (this.isChangeOrderSubmitting) {
            return;
        }

        const step2Validation = this.validateChangeOrderStep2();
        if (!step2Validation.isValid) {
            this.showToast('Error', step2Validation.message, 'error');
            return;
        }

        this.isChangeOrderSubmitting = true;

        const changeOrderRequestData = {
            originalScopeEntryId: this.selectedScopeEntryForChangeOrder.Id,
            changeOrderName: this.changeOrderData.name,
            contractValue: this.changeOrderData.contractValue,
            processOption: this.changeOrderData.processOption,
            jobId: this.recordId
        };

        if (this.changeOrderData.processOption === 'manual') {
            changeOrderRequestData.manualProcess = {
                processName: this.changeOrderManualProcess.processName.trim(),
                sequence: this.changeOrderManualProcess.sequence,
                processType: this.changeOrderManualProcess.processType,
                weightage: this.changeOrderManualProcess.weightage,
                measurementType: this.changeOrderManualProcess.measurementType
            };
        } else if (this.changeOrderData.processOption === 'library') {
            changeOrderRequestData.selectedProcessIds = this.selectedChangeOrderProcessIds;
        }

        // Call Apex method
        createChangeOrder({ changeOrderData: changeOrderRequestData })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Change order has been created', 'success');
                    this.handleCloseChangeOrderModal();
                    this.fetchScopeEntries(); // Refresh the data
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to create change order', 'error');
            })
            .finally(() => {
                this.isChangeOrderSubmitting = false;
            });
    }

    /**
     * Method Name: handleProcessCellClick
     * @description: Handle cell click for inline editing of process entries
     */
    handleProcessCellClick(event) {
        const recordId = event.currentTarget.dataset.recordId;
        const fieldName = event.currentTarget.dataset.fieldName;
        const isEditable = event.currentTarget.dataset.editable === 'true';
        
        if (!isEditable) return;
        
        const cellKey = `${recordId}-${fieldName}`;
        
        // Don't open editor if already editing this cell
        if (this.editingProcessCells.has(cellKey)) return;
        
        // Find the column to check if it's a picklist
        const column = this.processTableColumns.find(col => col.fieldName === fieldName);
        
        // If it's a picklist and we don't have options yet, load them
        if (column && column.type === 'picklist' && !this.fieldPicklistOptions.has(fieldName)) {
            this.getPicklistValues(fieldName).then(() => {
                // After options are loaded, set editing state and refresh
                this.editingProcessCells.add(cellKey);
                this.updateDisplayedEntries();
                
                // Auto-focus the input after DOM update
                setTimeout(() => {
                    this.focusProcessInput(recordId, fieldName);
                }, 100);
            });
        } else {
            // For non-picklist or already cached picklists
            this.editingProcessCells.add(cellKey);
            this.updateDisplayedEntries();
            
            // Auto-focus the input after DOM update
            setTimeout(() => {
                this.focusProcessInput(recordId, fieldName);
            }, 100);
        }
    }

    /**
     * Method Name: focusProcessInput
     * @description: Helper method to focus process input elements
     */
    focusProcessInput(recordId, fieldName) {
        // Try multiple selectors to find the input/select element
        let inputElement = null;
        
        // For regular inputs
        inputElement = this.template.querySelector(`input[data-process-record-id="${recordId}"][data-process-field-name="${fieldName}"]`);
        
        // For select elements (picklists)
        if (!inputElement) {
            inputElement = this.template.querySelector(`select[data-process-record-id="${recordId}"][data-process-field-name="${fieldName}"]`);
        }
        
        if (inputElement) {
            inputElement.focus();
            
            // For text inputs, select all text for easier editing
            if (inputElement.type === 'text' || inputElement.type === 'number') {
                inputElement.select();
            }
        } else {
            // Could not find process input element - silently continue
        }
    }
    
    /**
     * Method Name: handleProcessCellInputChange
     * @description: Handle input change in process inline editing - FIXED with scope context
     */
    handleProcessCellInputChange(event) {
        const recordId = event.target.dataset.processRecordId;
        const fieldName = event.target.dataset.processFieldName;
        const fieldType = event.target.dataset.processFieldType;
        const scopeEntryId = this.getScopeEntryIdForProcess(recordId); // GET scope entry ID
        let newValue = event.target.value;
        
        // Type conversion based on field type
        if (fieldType === 'number') {
            if (newValue === '' || newValue === null || newValue === undefined) {
                newValue = null;
            } else {
                newValue = parseFloat(newValue);
                if (isNaN(newValue)) newValue = null;
            }
        }
        
        // Get original value to compare
        const originalProcess = this.findProcessById(recordId);
        const originalValue = this.getFieldValue(originalProcess, fieldName);
        
        // Track modifications with scope context
        if (!this.modifiedProcessEntries.has(recordId)) {
            this.modifiedProcessEntries.set(recordId, {
                scopeEntryId: scopeEntryId,
                modifications: {}
            });
        }
        
        // Track by scope entry for button state
        if (!this.modifiedProcessEntriesByScopeEntry.has(scopeEntryId)) {
            this.modifiedProcessEntriesByScopeEntry.set(scopeEntryId, new Set());
        }
        
        const entry = this.modifiedProcessEntries.get(recordId);
        const modifications = entry.modifications;
        
        // Compare values properly for numbers
        const areValuesEqual = (val1, val2) => {
            if (val1 === val2) return true;
            if ((val1 === null || val1 === undefined || val1 === '') && 
                (val2 === null || val2 === undefined || val2 === '')) return true;
            if (fieldType === 'number' && !isNaN(val1) && !isNaN(val2)) {
                return parseFloat(val1) === parseFloat(val2);
            }
            return false;
        };
        
        if (!areValuesEqual(newValue, originalValue)) {
            modifications[fieldName] = newValue;
            this.modifiedProcessEntriesByScopeEntry.get(scopeEntryId).add(recordId);
        } else {
            delete modifications[fieldName];
            if (Object.keys(modifications).length === 0) {
                this.modifiedProcessEntries.delete(recordId);
                this.modifiedProcessEntriesByScopeEntry.get(scopeEntryId).delete(recordId);
                if (this.modifiedProcessEntriesByScopeEntry.get(scopeEntryId).size === 0) {
                    this.modifiedProcessEntriesByScopeEntry.delete(scopeEntryId);
                }
            }
        }
        
        // Update hasProcessModifications flag
        this.hasProcessModifications = this.modifiedProcessEntries.size > 0;
    }

    /**
     * Method Name: getScopeEntryIdForProcess
     * @description: Get scope entry ID for a given process ID
     */
    getScopeEntryIdForProcess(processId) {
        // Search in contract entries
        for (let entry of this.filteredContractEntries) {
            if (entry.processDetails) {
                const found = entry.processDetails.find(p => p.Id === processId);
                if (found) return entry.Id;
            }
        }
        
        // Search in change order entries
        for (let entry of this.filteredChangeOrderEntries) {
            if (entry.processDetails) {
                const found = entry.processDetails.find(p => p.Id === processId);
                if (found) return entry.Id;
            }
        }
        
        return null;
    }

    /**
     * Method Name: hasProcessModificationsForEntry
     * @description: Check if specific scope entry has process modifications
     */
    hasProcessModificationsForEntry(scopeEntryId) {
        return this.modifiedProcessEntriesByScopeEntry.has(scopeEntryId) && 
            this.modifiedProcessEntriesByScopeEntry.get(scopeEntryId).size > 0;
    }

    /**
     * Method Name: getProcessModificationCountForEntry
     * @description: Get count of modified processes for specific scope entry
     */
    getProcessModificationCountForEntry(scopeEntryId) {
        if (!this.modifiedProcessEntriesByScopeEntry.has(scopeEntryId)) return 0;
        return this.modifiedProcessEntriesByScopeEntry.get(scopeEntryId).size;
    }
    
    /**
     * Method Name: handleProcessCellInputBlur
     * @description: Handle blur event on process inline edit input
     */
    handleProcessCellInputBlur(event) {
        const recordId = event.target.dataset.processRecordId;
        const fieldName = event.target.dataset.processFieldName;
        const cellKey = `${recordId}-${fieldName}`;
        
        // Remove from editing set
        this.editingProcessCells.delete(cellKey);
        
        // Trigger reactivity to show normal cell
        this.updateDisplayedEntries();
    }
    
    /**
     * Method Name: validateProcessChanges
     * @description: Validate process entry modifications before saving
     */
    validateProcessChanges(scopeEntryId) {
        const errors = [];
        
        if (!this.modifiedProcessEntriesByScopeEntry.has(scopeEntryId)) {
            return errors;
        }
        
        const processIdsToValidate = this.modifiedProcessEntriesByScopeEntry.get(scopeEntryId);
        
        for (const processId of processIdsToValidate) {
            const modificationEntry = this.modifiedProcessEntries.get(processId);
            if (!modificationEntry) continue;
            
            const process = this.findProcessById(processId);
            const processName = process ? (process.wfrecon__Process_Name__c || process.Id) : processId;
            
            for (const [fieldName, value] of Object.entries(modificationEntry.modifications)) {
                // Get field metadata to determine validation rules
                const column = this.processTableColumns.find(col => col.fieldName === fieldName);
                
                if (column) {
                    // Text field validation
                    if (column.type === 'text') {
                        // Check for empty values after trimming
                        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
                            errors.push(`${processName} - ${column.label}: Field cannot be empty`);
                        }
                        // Check max 80 characters
                        else if (value && value.length > 80) {
                            errors.push(`${processName} - ${column.label}: Text cannot exceed 80 characters (current: ${value.length})`);
                        }
                    }
                    
                    // Number field validation (max 6 digits with 2 decimal places)
                    if ((column.type === 'number' || column.type === 'currency' || column.type === 'percent')) {
                        // Check for empty, null, undefined, or zero values
                        if (value === null || value === undefined || value === '' || 
                            (typeof value === 'string' && value.trim() === '') ||
                            (typeof value === 'string' && value.trim() === '-') ||
                            parseFloat(value) === 0) {
                            errors.push(`${processName} - ${column.label}: Field cannot be empty or zero`);
                        }
                        else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                                // Check for negative numbers
                                if (numValue < 0) {
                                    errors.push(`${processName} - ${column.label}: Negative numbers are not allowed`);
                                }
                                
                                // Check if number has more than 6 digits before decimal
                                const wholePart = Math.floor(Math.abs(numValue)).toString();
                                if (wholePart.length > 6) {
                                    errors.push(`${processName} - ${column.label}: Number cannot have more than 6 digits before decimal point (current: ${wholePart.length})`);
                                }
                                
                                // Check if number has more than 2 decimal places
                                const decimalPart = numValue.toString().split('.')[1];
                                if (decimalPart && decimalPart.length > 2) {
                                    errors.push(`${processName} - ${column.label}: Number cannot have more than 2 decimal places (current: ${decimalPart.length})`);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return errors;
    }

    /**
     * Method Name: handleSaveProcessChanges
     * @description: Save all modified process entries in a single batch
     */
    handleSaveProcessChanges(event) {
        // Prevent double-click by checking if already processing
        if (this.isSavingProcessEntries || this.isProcessSubmitting) {
            return;
        }

        // Get scope entry ID from button click
        const scopeEntryId = event.currentTarget.dataset.scopeEntryId;
        
        if (!this.hasProcessModificationsForEntry(scopeEntryId)) {
            return;
        }

        // Validate changes before saving
        const validationErrors = this.validateProcessChanges(scopeEntryId);
        if (validationErrors.length > 0) {
            this.showToast('Validation Error', validationErrors.join('\n'), 'error');
            return;
        }

        this.isSavingProcessEntries = true;
        
        // Get only the processes for this scope entry
        const processIdsToUpdate = this.modifiedProcessEntriesByScopeEntry.get(scopeEntryId);
        const updatedProcessEntries = [];
        
        processIdsToUpdate.forEach(processId => {
            const entry = this.modifiedProcessEntries.get(processId);
            const processUpdate = { Id: processId };
            Object.keys(entry.modifications).forEach(fieldName => {
                processUpdate[fieldName] = entry.modifications[fieldName];
            });
            updatedProcessEntries.push(processUpdate);
        });

        // Call batch update method
        const updatedProcessEntriesJson = JSON.stringify(updatedProcessEntries);
        
        saveProcessEntryInlineEdits({ updatedProcessEntriesJson: updatedProcessEntriesJson })
            .then(result => {
                if (result.startsWith('Success')) {
                    this.showToast('Success', 'Process changes have been saved', 'success');
                    
                    // Clear modifications for this scope entry only
                    processIdsToUpdate.forEach(processId => {
                        this.modifiedProcessEntries.delete(processId);
                    });
                    this.modifiedProcessEntriesByScopeEntry.delete(scopeEntryId);
                    
                    this.hasProcessModifications = this.modifiedProcessEntries.size > 0;
                    this.editingProcessCells.clear();
                    
                    // Refresh only this scope entry's processes
                    this.refreshProcessDetails(scopeEntryId);
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to update process entries', 'error');
            })
            .finally(() => {
                this.isSavingProcessEntries = false;
            });
    }
    
    /**
     * Method Name: handleDiscardProcessChanges
     * @description: Discard unsaved process changes for specific scope entry
     */
    handleDiscardProcessChanges(event) {
        const scopeEntryId = event.currentTarget.dataset.scopeEntryId;
        
        if (!this.hasProcessModificationsForEntry(scopeEntryId)) {
            return;
        }
        
        // Clear modifications for this scope entry only
        const processIdsToDiscard = this.modifiedProcessEntriesByScopeEntry.get(scopeEntryId);
        processIdsToDiscard.forEach(processId => {
            this.modifiedProcessEntries.delete(processId);
            // Clear editing state for this process
            this.editingProcessCells.forEach(cellKey => {
                if (cellKey.startsWith(processId)) {
                    this.editingProcessCells.delete(cellKey);
                }
            });
        });
        this.modifiedProcessEntriesByScopeEntry.delete(scopeEntryId);
        
        // Update global flag
        this.hasProcessModifications = this.modifiedProcessEntries.size > 0;
        
        // Trigger reactivity to remove highlighting and reset values
        this.updateDisplayedEntries();
        
        this.showToast('Success', 'Process changes have been discarded', 'success');
    }
    
    /**
     * Method Name: getModifiedProcessValue
     * @description: Get modified value for a specific process field
     */
    getModifiedProcessValue(recordId, fieldName) {
        const entry = this.modifiedProcessEntries.get(recordId);
        return entry && entry.modifications ? entry.modifications[fieldName] : null;
    }
    
    /**
     * Method Name: isProcessFieldModified
     * @description: Check if a specific process field has been modified
     */
    isProcessFieldModified(recordId, fieldName) {
        const entry = this.modifiedProcessEntries.get(recordId);
        return entry && entry.modifications && entry.modifications.hasOwnProperty(fieldName);
    }
    
    /**
     * Method Name: findProcessById
     * @description: Find a process by ID across all scope entries
     */
    findProcessById(processId) {
        // Search in contract entries
        for (let entry of this.filteredContractEntries) {
            if (entry.processDetails) {
                const process = entry.processDetails.find(p => p.Id === processId);
                if (process) return process;
            }
        }
        
        // Search in change order entries
        for (let entry of this.filteredChangeOrderEntries) {
            if (entry.processDetails) {
                const process = entry.processDetails.find(p => p.Id === processId);
                if (process) return process;
            }
        }
        
        return null;
    }

    /**
     * Method Name: handleScopeSelectChange
     * @description: Handle native select change for scope picklist fields
     */
    handleScopeSelectChange(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.fieldName;
        const newValue = event.target.value;
        
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
            delete modifications[fieldName];
            if (Object.keys(modifications).length === 0) {
                this.modifiedScopeEntries.delete(recordId);
            }
        }
        
        // Update hasScopeModifications flag
        this.hasScopeModifications = this.modifiedScopeEntries.size > 0;
        
        // Trigger reactivity
        this.applyFilters();
    }

    /**
     * Method Name: handleProcessSelectChange
     * @description: Handle native select change for process picklist fields
     */
    handleProcessSelectChange(event) {
        const recordId = event.target.dataset.processRecordId;
        const fieldName = event.target.dataset.processFieldName;
        const scopeEntryId = this.getScopeEntryIdForProcess(recordId);
        const newValue = event.target.value;
        
        // Get original value to compare
        const originalProcess = this.findProcessById(recordId);
        const originalValue = this.getFieldValue(originalProcess, fieldName);
        
        // Track modifications with scope context
        if (!this.modifiedProcessEntries.has(recordId)) {
            this.modifiedProcessEntries.set(recordId, {
                scopeEntryId: scopeEntryId,
                modifications: {}
            });
        }
        
        // Track by scope entry for button state
        if (!this.modifiedProcessEntriesByScopeEntry.has(scopeEntryId)) {
            this.modifiedProcessEntriesByScopeEntry.set(scopeEntryId, new Set());
        }
        
        const entry = this.modifiedProcessEntries.get(recordId);
        const modifications = entry.modifications;
        
        if (newValue !== originalValue) {
            modifications[fieldName] = newValue;
            this.modifiedProcessEntriesByScopeEntry.get(scopeEntryId).add(recordId);
        } else {
            delete modifications[fieldName];
            if (Object.keys(modifications).length === 0) {
                this.modifiedProcessEntries.delete(recordId);
                this.modifiedProcessEntriesByScopeEntry.get(scopeEntryId).delete(recordId);
            }
        }
        
        // Update hasProcessModifications flag
        this.hasProcessModifications = this.modifiedProcessEntries.size > 0;
        
        // Trigger reactivity
        this.updateDisplayedEntries();
    }
}
    