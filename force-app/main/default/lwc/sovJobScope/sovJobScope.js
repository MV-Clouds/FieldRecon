import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getScopeEntries from '@salesforce/apex/SovJobScopeController.getScopeEntries';
import getScopeEntryConfiguration from '@salesforce/apex/SovJobScopeController.getScopeEntryConfiguration';
import createScopeEntry from '@salesforce/apex/SovJobScopeController.createScopeEntry';
import deleteScopeEntries from '@salesforce/apex/SovJobScopeController.deleteScopeEntries';
import { CurrentPageReference } from 'lightning/navigation';
import createScopeEntryProcess from '@salesforce/apex/SovJobScopeController.createScopeEntryProcess';
import getProcessLibraryRecords from '@salesforce/apex/SovJobScopeController.getProcessLibraryRecords';
import createScopeEntryProcessesFromLibrary from '@salesforce/apex/SovJobScopeController.createScopeEntryProcessesFromLibrary';
import getLocationsByScopeEntry from '@salesforce/apex/SovJobScopeController.getLocationsByScopeEntry';
import createLocationProcesses from '@salesforce/apex/SovJobScopeController.createLocationProcesses';
import saveScopeEntryInlineEdits from '@salesforce/apex/SovJobScopeController.saveScopeEntryInlineEdits';
import saveProcessEntryInlineEdits from '@salesforce/apex/SovJobScopeController.saveProcessEntryInlineEdits';
import getPicklistValuesForField from '@salesforce/apex/SovJobScopeController.getPicklistValuesForField';
import deleteSelectedScopeEntryProcesses from '@salesforce/apex/SovJobScopeController.deleteSelectedScopeEntryProcesses';
import { getPicklistValues } from "lightning/uiObjectInfoApi";
import PROCESSTYPE_FIELD from '@salesforce/schema/Process__c.Process_Type__c'

export default class SovJobScope extends NavigationMixin(LightningElement) {
    // Permission data received from parent component
    @api permissionData = {
        isReadOnly: false,
        isFullAccess: false
    };

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
    @track scopeEntryProcessMap = new Map(); // Map<scopeEntryId, Array<processData>> - stores preloaded process data
    @track scopeEntryLocationCounts = new Map(); // Map<scopeEntryId, Integer> - stores location counts for each scope entry

    @track sortField = '';
    @track sortOrder = '';
    @track contractSortField = '';
    @track contractSortOrder = '';
    @track changeOrderSortField = '';
    @track changeOrderSortOrder = '';
    @track processSortByEntry = new Map();
    @track totalJobContractValue;

    @track processSortField = 'wfrecon__Sequence__c';
    @track processSortOrder = 'asc';

    @track scopeEntryColumns = [];
    @track accordionStyleApplied = false;
    @track activeSectionName = ['contractSection', 'changeOrderSection'];
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
            conditionalEdit: true
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
        type: 'Contract'
    };

    @track lastConfigUpdateTimestamp = 0;

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
    };

    // Process Type Options
    @track processTypeOptions = [];

    // Process Library Modal Properties - Simplified
    @track showProcessLibraryModal = false;
    @track isProcessLibrarySubmitting = false;
    @track processLibraryRecords = [];
    @track processLibraryDisplayRecords = [];
    @track selectedProcessLibraryIds = [];
    @track processLibrarySearchTerm = '';
    @track selectedProcessCategory = '';
    @track processTypeFilterOptions = [];
    @track processTypeCategoryOptions = [];

    @track modifiedProcessEntries = new Map();
    @track hasProcessModifications = false;
    @track isSavingProcessEntries = false;
    @track isSavingProcessEntriesByScopeEntry = new Map(); // Map<scopeEntryId, boolean> - tracks saving state per scope entry
    @track editingProcessCells = new Set();
    @track selectedProcessesByScopeEntry = new Map();

    @track showAddLocationModal = false;
    @track isLocationSubmitting = false;
    @track isLocationViewMode = false; // View-only mode for approved entries
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
            label: 'Quantity',
            fieldName: 'wfrecon__Quantity__c',
            type: 'number'
        },
        {
            label: 'Type',
            fieldName: 'wfrecon__Unit_of_Measure__c',
            type: 'text'
        }
    ];

    @track modifiedScopeEntries = new Map();
    @track hasScopeModifications = false;
    @track isSavingScopeEntries = false;
    @track editingScopeCells = new Set();

    // Confirmation Modal Properties
    @track showConfirmationModal = false;
    @track confirmationTitle = '';
    @track confirmationMessage = '';
    @track confirmationAction = '';
    @track confirmationButtonLabel = 'Confirm';
    @track confirmationButtonVariant = 'brand';
    @track confirmationData = null;

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
        if (!this.filteredContractEntries || this.filteredContractEntries.length === 0) return false;
        return this.filteredContractEntries.every(entry => this.selectedRows.includes(entry.Id));
    }

    /**
     * Method Name: get isAllChangeOrderSelected
     * @description: Check if all change order entries are selected
     */
    get isAllChangeOrderSelected() {
        if (!this.filteredChangeOrderEntries || this.filteredChangeOrderEntries.length === 0) return false;
        return this.filteredChangeOrderEntries.every(entry => this.selectedRows.includes(entry.Id));
    }    /**
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
        // console.log('In getter');

        if (!this.filteredChangeOrderEntries || this.filteredChangeOrderEntries.length === 0) {
            return [];
        }
        return this.processEntriesForDisplay(this.filteredChangeOrderEntries);
    }

    /**
     * Method Name: get totalContractValue
     * @description: Calculate total contract value from contract entries only (unfiltered for summary cards)
     */
    get totalContractValue() {
        if (!this.contractEntries || this.contractEntries.length === 0) return 0;

        return this.contractEntries.reduce((total, entry) => {
            const contractValue = this.getFieldValue(entry, 'wfrecon__Contract_Value__c');
            return total + (contractValue || 0);
        }, 0);
    }

    /**
     * Method Name: get totalChangeOrderValue
     * @description: Calculate total contract value from change order entries only (unfiltered for summary cards)
     */
    get totalChangeOrderValue() {
        if (!this.changeOrderEntries || this.changeOrderEntries.length === 0) return 0;

        return this.changeOrderEntries.reduce((total, entry) => {
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
     * Method Name: get viewModeLocationRecords
     * @description: Get only selected/added locations for view mode (approved entries)
     */
    get viewModeLocationRecords() {
        return this.locationDisplayRecords.filter(location => location.isSelected);
    }

    /**
     * Method Name: get isApproveAllDisabled
     * @description: Check if approve all button should be disabled
     */
    get isApproveAllDisabled() {
        return !this.filteredContractEntries ||
            this.filteredContractEntries.length === 0 ||
            this.filteredContractEntries.every(entry => entry.wfrecon__Scope_Entry_Status__c === 'Approved') ||
            this.isLoading ||
            this.isSavingScopeEntries;
    }

    /**
     * Method Name: get areAllContractEntriesApproved
     * @description: Check if all contract entries are approved
     */
    get areAllContractEntriesApproved() {
        return this.filteredContractEntries &&
            this.filteredContractEntries.length > 0 &&
            this.filteredContractEntries.every(entry => entry.wfrecon__Scope_Entry_Status__c === 'Approved');
    }

    /**
     * Method Name: get shouldHideContractHeaderCheckbox
     * @description: Check if contract header checkbox should be hidden - always show now for unapprove functionality
     */
    get shouldHideContractHeaderCheckbox() {
        return !this.filteredContractEntries || this.filteredContractEntries.length === 0;
    }

    /**
     * Method Name: get areAllChangeOrderEntriesApproved
     * @description: Check if all change order entries are approved
     */
    get areAllChangeOrderEntriesApproved() {
        return this.filteredChangeOrderEntries &&
            this.filteredChangeOrderEntries.length > 0 &&
            this.filteredChangeOrderEntries.every(entry => entry.wfrecon__Scope_Entry_Status__c === 'Approved');
    }

    /**
     * Method Name: get shouldHideChangeOrderHeaderCheckbox
     * @description: Check if change order header checkbox should be hidden - always show now for unapprove functionality
     */
    get shouldHideChangeOrderHeaderCheckbox() {
        return !this.filteredChangeOrderEntries || this.filteredChangeOrderEntries.length === 0;
    }

    /**
     * Method Name: get isUnapproveContractDisabled
     * @description: Check if unapprove contract button should be disabled
     */
    get isUnapproveContractDisabled() {
        // Get selected approved contract entries
        const selectedApprovedContracts = this.filteredContractEntries.filter(entry =>
            this.selectedRows.includes(entry.Id) && entry.wfrecon__Scope_Entry_Status__c === 'Approved'
        );
        return selectedApprovedContracts.length === 0 || this.isLoading || this.isSavingScopeEntries;
    }

    /**
     * Method Name: get isUnapproveChangeOrderDisabled
     * @description: Check if unapprove change order button should be disabled
     */
    get isUnapproveChangeOrderDisabled() {
        // Get selected approved change order entries
        const selectedApprovedChangeOrders = this.filteredChangeOrderEntries.filter(entry =>
            this.selectedRows.includes(entry.Id) && entry.wfrecon__Scope_Entry_Status__c === 'Approved'
        );
        return selectedApprovedChangeOrders.length === 0 || this.isLoading || this.isSavingScopeEntries;
    }

    /**
     * Method Name: get selectedApprovedContractCount
     * @description: Get count of selected approved contract entries
     */
    get selectedApprovedContractCount() {
        return this.filteredContractEntries.filter(entry =>
            this.selectedRows.includes(entry.Id) && entry.wfrecon__Scope_Entry_Status__c === 'Approved'
        ).length;
    }

    /**
     * Method Name: get selectedApprovedChangeOrderCount
     * @description: Get count of selected approved change order entries
     */
    get selectedApprovedChangeOrderCount() {
        return this.filteredChangeOrderEntries.filter(entry =>
            this.selectedRows.includes(entry.Id) && entry.wfrecon__Scope_Entry_Status__c === 'Approved'
        ).length;
    }

    /**
     * Method Name: get isApproveAllChangeOrderDisabled
     * @description: Check if approve all change order button should be disabled
     */
    get isApproveAllChangeOrderDisabled() {
        return !this.filteredChangeOrderEntries ||
            this.filteredChangeOrderEntries.length === 0 ||
            this.filteredChangeOrderEntries.every(entry => entry.wfrecon__Scope_Entry_Status__c === 'Approved') ||
            this.isLoading ||
            this.isSavingScopeEntries;
    }

    /**
     * Method Name: get canEdit
     * @description: Check if user has edit permissions (full access only)
     */
    get canEdit() {
        return this.permissionData && this.permissionData.isFullAccess;
    }

    /**
     * Method Name: get canDelete
     * @description: Check if user has delete permissions (full access only)
     */
    get canDelete() {
        return this.permissionData && this.permissionData.isFullAccess;
    }

    /**
     * Method Name: get canCreate
     * @description: Check if user has create permissions (full access only)
     */
    get canCreate() {
        return this.permissionData && this.permissionData.isFullAccess;
    }

    /**
     * Method Name: get isReadOnly
     * @description: Check if user has read-only access
     */
    get isReadOnly() {
        return this.permissionData && this.permissionData.isReadOnly;
    }

    /**
     * Method Name: get isDeleteDisabledByPermission
     * @description: Check if delete button should be disabled based on permissions
     */
    get isDeleteDisabledByPermission() {
        return this.selectedRows.length === 0 || this.isLoading || this.isSavingScopeEntries || !this.canDelete;
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
     * Method Name: setCurrentPageReference
     * @description: Get record Id from recordpage
     */
    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
    }

    /**
     * Method Name: wiredProcessTypeValues
     * @description: Get picklist value for process type
     */
    @wire(getPicklistValues, { recordTypeId: '012000000000000AAA', fieldApiName: PROCESSTYPE_FIELD })
    wiredProcessTypeValues({ data, error }) {
        if (data) {

            this.processTypeOptions = data.values.map(item => ({
                label: item.label,
                value: item.value
            }));

            this.processTypeCategoryOptions = [
                { label: 'All', value: '' },
                ...this.processTypeOptions
            ];
        } else if (error) {
            console.error('Error loading process type picklist:', error);
        }
    }

    /**
     * Method Name: connectedCallback
     * @description: Load scope entries with default sorting
     */
    connectedCallback() {
        this.fetchScopeConfiguration();
    }

    /**
     * Method Name: renderedCallback    
     * @description: Apply accordion styling once
    */
    renderedCallback() {
        if (!this.accordionStyleApplied) {
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
                .accordion-container .section-control,
                .bid-accordion .section-control {
                    background: rgba(94, 90, 219, 0.9) !important;
                    color: white !important;
                    margin-bottom: 4px;
                    --slds-c-icon-color-foreground-default: #ffffff !important;
                    font-weight: 600 !important;
                    border-radius: 4px;
                }

                .bid-accordion .slds-accordion__summary {
                    padding-bottom: 0;
                }

                .accordion-container .slds-accordion__summary-content,
                .bid-accordion .slds-accordion__summary-content {
                    font-size: medium;
                }
                
            `;

            // Append to component's template
            const accordionContainer = this.template.querySelector('.accordion-container');
            if (accordionContainer) {
                accordionContainer.appendChild(style);
                this.accordionStyleApplied = true;
            }

        } catch (error) {
            console.log('Error ==> ', error);

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
     * Method Name: areAllProcessesSelectedForEntry
     * @description: Check if all processes are selected for a specific scope entry
     */
    areAllProcessesSelectedForEntry(scopeEntryId) {
        // Find the entry to get its process count
        const entry = this.getEntryById(scopeEntryId);

        // If no entry found or no process details, return false
        if (!entry || !entry.processDetails || entry.processDetails.length === 0) {
            return false;
        }

        // Get selected processes for this scope entry
        const selectedProcesses = this.selectedProcessesByScopeEntry.get(scopeEntryId);

        // If no processes are selected, return false
        if (!selectedProcesses || selectedProcesses.size === 0) {
            return false;
        }

        // Check if all processes are selected
        return selectedProcesses.size === entry.processDetails.length;
    }

    /**
     * Method Name: isDeleteProcessDisabledForEntry
     * @description: Check if delete process button should be disabled for a specific scope entry
     */
    isDeleteProcessDisabledForEntry(scopeEntryId) {
        return !this.hasSelectedProcessesForEntry(scopeEntryId);
    }

    /**
     * Method Name: getDefaultScopeEntryType
     * @description: Determine default type for new scope entry based on approved status
     * @return: String - 'Contract' or 'Change Order'
     */
    getDefaultScopeEntryType() {
        // Check if any scope entry has approved status
        const hasApprovedEntry = this.scopeEntries && this.scopeEntries.some(entry =>
            entry.wfrecon__Scope_Entry_Status__c === 'Approved'
        );

        // If any scope entry is approved, default to Change Order, otherwise Contract
        return hasApprovedEntry ? 'Change Order' : 'Contract';
    }

    /**
     * Method Name: fetchScopeConfiguration
     * @description: Fetch configuration and then load scope entries
     * @note: Uses imperative Apex call to bypass LWC caching for fresh metadata
     */
    async fetchScopeConfiguration() {
        // Use imperative call to ensure fresh data (bypass cache)
        getScopeEntryConfiguration()
            .then(result => {
                console.log('Configuration fetch result:', result);

                console.log('permissionData ==> ', this.permissionData);

                if (result && result.fieldsData) {
                    try {
                        const fieldsData = JSON.parse(result.fieldsData);

                        this.scopeEntryColumns = fieldsData.map(field => ({
                            label: field.label,
                            fieldName: field.fieldName,
                            type: this.getColumnType(field.fieldType),
                            editable: (field.fieldName === 'wfrecon__Approved_Date__c') ? false : (field.isEditable || false)
                        }));

                        console.log('Fetched Columns from metadata:', this.scopeEntryColumns);
                        console.log('Metadata last updated:', new Date().toISOString());

                    } catch (error) {
                        console.error('Error parsing configuration:', error);
                        this.scopeEntryColumns = this.defaultColumns;
                    }
                } else {
                    console.warn('No configuration data found, using defaults');
                    this.scopeEntryColumns = this.defaultColumns;
                }

                // Set default sorting to first column
                if (this.scopeEntryColumns.length > 0) {
                    this.sortField = this.scopeEntryColumns[0].fieldName;
                    this.sortOrder = 'asc';
                }
            })
            .catch((error) => {
                console.error('Error fetching configuration:', error);
                this.scopeEntryColumns = this.defaultColumns;
                // Set default sorting
                if (this.scopeEntryColumns.length > 0) {
                    this.sortField = this.scopeEntryColumns[0].fieldName;
                    this.sortOrder = 'asc';
                }
                this.showToast('Warning', 'Using default configuration due to error', 'warning');
            })
            .finally(() => {
                // Always load data after configuration is processed (success or failure)
                this.loadProcessLibraryData();
                this.fetchScopeEntries();
            });
    }

    /**
     * Method Name: fetchScopeEntries
     * @description: Fetch scope entries for the job with preloaded process data
     */
    fetchScopeEntries() {
        if (!this.recordId) {
            this.isLoading = false;
            // Initialize empty arrays to ensure filter functions work
            this.scopeEntries = [];
            this.contractEntries = [];
            this.changeOrderEntries = [];
            this.filteredContractEntries = [];
            this.filteredChangeOrderEntries = [];
            this.scopeEntryProcessMap = new Map();
            return Promise.resolve();
        }

        return getScopeEntries({ jobId: this.recordId })
            .then(result => {

                if (result && result.success) {
                    // Ensure scopeEntries is always an array
                    this.scopeEntries = Array.isArray(result.scopeEntries) ? result.scopeEntries : [];
                    console.log('scopeEntries:', this.scopeEntries);


                    for (let i = 0; i < this.scopeEntries.length; i++) {
                        if (this.scopeEntries[i].wfrecon__Job__r && this.scopeEntries[i].wfrecon__Job__r.wfrecon__Total_Contract_Price__c) {
                            this.totalJobContractValue = this.scopeEntries[i].wfrecon__Job__r.wfrecon__Total_Contract_Price__c;
                            break;
                        }
                    }

                    // Store the preloaded process data
                    this.scopeEntryProcessMap = new Map();
                    if (result.scopeEntryProcessMap) {
                        Object.keys(result.scopeEntryProcessMap).forEach(scopeEntryId => {
                            this.scopeEntryProcessMap.set(scopeEntryId, result.scopeEntryProcessMap[scopeEntryId]);
                        });
                    }

                    // Store the location counts
                    this.scopeEntryLocationCounts = new Map();
                    if (result.scopeEntryLocationCounts) {
                        Object.keys(result.scopeEntryLocationCounts).forEach(scopeEntryId => {
                            this.scopeEntryLocationCounts.set(scopeEntryId, result.scopeEntryLocationCounts[scopeEntryId]);
                        });
                    }

                    this.applyFilters();
                    this.isLoading = false;

                    return result;
                } else {
                    // Initialize empty arrays even on failure
                    this.scopeEntries = [];
                    this.contractEntries = [];
                    this.changeOrderEntries = [];
                    this.filteredContractEntries = [];
                    this.filteredChangeOrderEntries = [];
                    this.scopeEntryProcessMap = new Map();
                    this.scopeEntryLocationCounts = new Map();
                    this.isLoading = false;
                    throw new Error(result.error || 'Unable to load scope data');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Unable to load scope data. Please refresh and try again.', 'error');
                // Initialize empty arrays on error to prevent filter issues
                this.scopeEntries = [];
                this.contractEntries = [];
                this.changeOrderEntries = [];
                this.filteredContractEntries = [];
                this.filteredChangeOrderEntries = [];
                this.scopeEntryProcessMap = new Map();
                this.scopeEntryLocationCounts = new Map();
                this.isLoading = false;
                throw error; // Re-throw to allow caller to handle
            });
    }

    /**
     * Method Name: handleConfigurationUpdated
     * @description: Handle configuration updated event from record config component
     */
    handleConfigurationUpdated(event) {

        console.log('lastConfigUpdateTimestamp :', this.lastConfigUpdateTimestamp);
        console.log('event.detail.timestamp :', event.detail.timestamp);
        console.log('Configuration update event received:', event.detail);

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
            this.performCompleteRefresh();
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
            // Set default sorting for contract and change order sections if not already set
            if (!this.contractSortField && this.tableColumns.length > 0) {
                this.contractSortField = this.tableColumns[0].fieldName;
                this.contractSortOrder = 'asc';
            }
            if (!this.changeOrderSortField && this.tableColumns.length > 0) {
                this.changeOrderSortField = this.tableColumns[0].fieldName;
                this.changeOrderSortOrder = 'asc';
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
                    ...entry
                };
            });

            // Store current process details and states before updating
            const currentProcessStates = new Map();

            // Collect current states from both contract and change order entries
            [...(this.filteredContractEntries || []), ...(this.filteredChangeOrderEntries || [])].forEach(entry => {
                if (entry.processDetails || entry.showProcessDetails !== undefined) {
                    currentProcessStates.set(entry.Id, {
                        processDetails: entry.processDetails,
                        showProcessDetails: entry.showProcessDetails
                    });
                }
            });

            // Separate entries by type - first populate unfiltered arrays for summary calculations
            this.contractEntries = this.scopeEntries.filter(entry =>
                this.getFieldValue(entry, 'wfrecon__Type__c') === 'Contract'
            );

            this.changeOrderEntries = this.scopeEntries.filter(entry =>
                this.getFieldValue(entry, 'wfrecon__Type__c') === 'Change Order'
            );

            // Then populate filtered arrays for display
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

                    // If process details are missing but showProcessDetails is true, restore from preloaded map
                    if (entry.showProcessDetails && (!entry.processDetails || entry.processDetails.length === 0)) {
                        const processData = this.scopeEntryProcessMap.get(entry.Id) || [];
                        // console.log(`Restoring process details for entry ${entry.Id}: ${processData.length} processes found`);
                        try {
                            const processedDetails = this.processProcessDetailsForDisplay(processData);
                            entry.processDetails = processedDetails;
                            // console.log(`Successfully restored ${processedDetails.length} process details for entry ${entry.Id}`);
                        } catch (error) {
                            console.error('Error processing process details during filter restore:', error);
                            entry.processDetails = [];
                        }
                    }
                }
            });

            // Apply sorting for both sections
            this.sortData('contract');
            this.sortData('changeOrder');

            // Update sort icons after a brief delay to ensure DOM is ready
            setTimeout(() => {
                this.updateSortIcons('contract');
                this.updateSortIcons('changeOrder');
            }, 0);

            // Force reactivity for summary calculations
            this.template.querySelector('.summary-cards-container')?.setAttribute('data-update', Date.now().toString());

            // Clean up any approved entries from selection
            this.cleanupApprovedEntriesFromSelection();
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
     * Method Name: validateScopeEntryForApproval
     * @description: Validate if a scope entry can be approved by checking if it has processes and locations
     * @param {String} scopeEntryId - The ID of the scope entry to validate
     * @return {Promise<Object>} - Validation result with isValid and message properties
     */
    async validateScopeEntryForApproval(scopeEntryId) {
        try {
            // Find the scope entry by ID
            let scopeEntry = this.getEntryById(scopeEntryId);

            // If not found in filtered entries, check in the original scopeEntries array
            if (!scopeEntry) {
                scopeEntry = this.scopeEntries.find(entry => entry.Id === scopeEntryId);
            }

            // Check if this is a Change Order with Deduction type - if so, allow approval without validation
            if (scopeEntry &&
                scopeEntry.wfrecon__Type__c === 'Change Order' &&
                scopeEntry.wfrecon__Change_Order_Type__c === 'Deduction') {
                return {
                    isValid: true,
                    message: 'Change Order with Deduction type can be approved without additional requirements.'
                };
            }

            // Check if scope entry has processes
            const hasProcesses = this.scopeEntryProcessMap.has(scopeEntryId) &&
                this.scopeEntryProcessMap.get(scopeEntryId).length > 0;

            // console.log('hasProcesses ==> ' , hasProcesses);

            // Check if scope entry has locations using cached data
            const locationCount = this.scopeEntryLocationCounts.get(scopeEntryId) || 0;
            const hasLocations = locationCount > 0;

            // console.log('hasLocations ==> ' , hasLocations);
            // console.log('locationCount ==> ' , locationCount);

            if (!hasProcesses && !hasLocations) {
                return {
                    isValid: false,
                    message: 'Scope entry cannot be approved. It must have at least one process and one location.'
                };
            } else if (!hasProcesses) {
                return {
                    isValid: false,
                    message: 'Scope entry cannot be approved. It must have at least one process.'
                };
            } else if (!hasLocations) {
                return {
                    isValid: false,
                    message: 'Scope entry cannot be approved. It must have at least one location.'
                };
            }

            return {
                isValid: true,
                message: 'Scope entry can be approved.'
            };
        } catch (error) {
            console.error('Error validating scope entry for approval:', error);
            return {
                isValid: false,
                message: 'Error validating scope entry. Please try again.'
            };
        }
    }

    /**
     * Method Name: validateScopeEntriesForApproval
     * @description: Validate multiple scope entries for approval
     * @param {Array} scopeEntries - Array of scope entries to validate
     * @return {Promise<Object>} - Validation result with isValid, message, and invalidEntries properties
     */
    async validateScopeEntriesForApproval(scopeEntries) {
        const invalidEntries = [];
        const validationPromises = scopeEntries.map(async (entry) => {
            const validation = await this.validateScopeEntryForApproval(entry.Id);
            if (!validation.isValid) {
                invalidEntries.push({
                    name: entry.Name,
                    id: entry.Id,
                    reason: validation.message
                });
            }
            return validation;
        });

        await Promise.all(validationPromises);

        // console.log('invalidEntries ==> ' , invalidEntries);

        if (invalidEntries.length > 0) {
            const entryNames = invalidEntries.map(entry => entry.name).join(', ');
            return {
                isValid: false,
                message: `The following scope entries cannot be approved because they don't have both processes and locations: ${entryNames}`,
                invalidEntries: invalidEntries
            };
        }

        return {
            isValid: true,
            message: 'All scope entries can be approved.',
            invalidEntries: []
        };
    }

    /**
     * Method Name: performCompleteRefresh
     * @description: Comprehensive refresh method that handles all business logic
     */
    async performCompleteRefresh() {

        try {
            this.isLoading = true;
            this.selectedRows = [];

            // Clear all modifications and editing states for both scope and process entries
            this.modifiedProcessEntriesByScopeEntry.clear();
            this.modifiedProcessEntries.clear();
            this.hasProcessModifications = false;
            this.isSavingProcessEntries = false;
            this.isSavingProcessEntriesByScopeEntry.clear(); // Clear entry-specific saving states
            this.editingProcessCells.clear();

            // Clear scope entry modifications and editing states
            this.modifiedScopeEntries.clear();
            this.hasScopeModifications = false;
            this.isSavingScopeEntries = false;
            this.editingScopeCells.clear();

            // Clear selected processes by scope entry
            this.selectedProcessesByScopeEntry.clear();
            this.selectedProcesses = [];
            // Create new Map to trigger reactivity
            this.selectedProcessesByScopeEntry = new Map();

            // Store expanded scope entries for restoration after refresh
            const expandedScopeEntryIds = new Set();
            [...(this.filteredContractEntries || []), ...(this.filteredChangeOrderEntries || [])].forEach(entry => {
                if (entry.showProcessDetails) {
                    expandedScopeEntryIds.add(entry.Id);
                }
            });

            // Clear preloaded data
            this.scopeEntryProcessMap.clear();
            this.scopeEntryLocationCounts.clear();

            // Reset sorting to defaults
            if (this.scopeEntryColumns.length > 0) {
                this.sortField = this.scopeEntryColumns[0].fieldName;
                this.sortOrder = 'asc';
                this.contractSortField = this.scopeEntryColumns[0].fieldName;
                this.contractSortOrder = 'asc';
                this.changeOrderSortField = this.scopeEntryColumns[0].fieldName;
                this.changeOrderSortOrder = 'asc';
            }

            // Process sorting is set to default sequence field

            // Clear search term
            this.searchTerm = '';

            // Reset field picklist options cache
            this.fieldPicklistOptions.clear();

            // Fetch fresh data
            let res = await this.fetchScopeConfiguration();

            // Log filtered entries after data fetch
            // console.log('filtered COntract -> ',this.filteredContractEntries);
            // console.log('filtered Change Order -> ',this.filteredChangeOrderEntries);
            // console.log('expandedScopeEntryIds -> ',expandedScopeEntryIds.size);


            if (res) {
                // Restore expanded states for scope entries that were previously expanded
                this.restoreExpandedStates(expandedScopeEntryIds);

                this.clearAllHighlighting();
                this.updateDisplayedEntries();

            }

        } catch (error) {
            console.log('Error ==> ', error);

        } finally {
            this.isLoading = false;
        }
    }

    /**
    * Method Name: performTargetedRefresh
    * @description: Targeted refresh that maintains expanded states and only updates necessary data
    */
    async performTargetedRefresh() {
        try {
            this.isLoading = true;

            // Store current expanded states before refresh
            const expandedScopeEntryIds = new Set();
            [...(this.filteredContractEntries || []), ...(this.filteredChangeOrderEntries || [])].forEach(entry => {
                if (entry.showProcessDetails) {
                    expandedScopeEntryIds.add(entry.Id);
                }
            });

            // Clear only the process-related data that needs to be refreshed
            this.scopeEntryProcessMap.clear();
            this.scopeEntryLocationCounts.clear();

            // Fetch fresh scope entries data
            let res = await this.fetchScopeEntries();

            if (res) {
                // Restore expanded states immediately after data load
                this.restoreExpandedStates(expandedScopeEntryIds);

                // Force re-render of displayed entries
                this.updateDisplayedEntries();

                console.log(`Targeted refresh completed. Restored ${expandedScopeEntryIds.size} expanded states.`);
            }

        } catch (error) {
            console.error('Error in performTargetedRefresh:', error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Method Name: restoreExpandedStates
     * @description: Restore expanded states for scope entries that were previously expanded
     * @param {Set} expandedScopeEntryIds - Set of scope entry IDs that should be expanded
     */
    restoreExpandedStates(expandedScopeEntryIds) {
        if (!expandedScopeEntryIds || expandedScopeEntryIds.size === 0) {
            return;
        }

        try {
            // Restore expanded states for contract entries
            this.filteredContractEntries = this.filteredContractEntries.map(entry => {
                if (expandedScopeEntryIds.has(entry.Id)) {
                    const updatedEntry = { ...entry };
                    updatedEntry.showProcessDetails = true;

                    // Load process details from preloaded map
                    const processData = this.scopeEntryProcessMap.get(entry.Id) || [];
                    try {
                        const processedDetails = this.processProcessDetailsForDisplay(processData);
                        updatedEntry.processDetails = processedDetails;
                        // console.log(`Restored processDetails for contract ${entry.Id}:`, processedDetails.length, 'items');
                    } catch (error) {
                        console.error('Error processing process details during state restoration:', error);
                        updatedEntry.processDetails = [];
                    }

                    return updatedEntry;
                }
                return entry;
            });

            // Restore expanded states for change order entries
            this.filteredChangeOrderEntries = this.filteredChangeOrderEntries.map(entry => {
                if (expandedScopeEntryIds.has(entry.Id)) {
                    const updatedEntry = { ...entry };
                    updatedEntry.showProcessDetails = true;

                    // Load process details from preloaded map
                    const processData = this.scopeEntryProcessMap.get(entry.Id) || [];
                    try {
                        const processedDetails = this.processProcessDetailsForDisplay(processData);
                        updatedEntry.processDetails = processedDetails;
                        // console.log(`Restored processDetails for change order ${entry.Id}:`, processedDetails.length, 'items');
                    } catch (error) {
                        console.error('Error processing process details during state restoration:', error);
                        updatedEntry.processDetails = [];
                    }

                    return updatedEntry;
                }
                return entry;
            });

            // console.log(`Restored expanded state for ${expandedScopeEntryIds.size} scope entries`);
        } catch (error) {
            console.error('Error in restoreExpandedStates:', error);
        }
    }

    /**
     * Method Name: clearAllHighlighting
     * @description: Clear all cell highlighting and clean up approved entries from selection
     */
    clearAllHighlighting() {
        try {
            // Clear any modified cell highlighting
            const modifiedCells = this.template.querySelectorAll('.modified-scope-cell, .modified-process-cell');
            modifiedCells.forEach(cell => {
                cell.classList.remove('modified-scope-cell', 'modified-process-cell');

            });

            // Remove any approved entries from selectedRows
            this.cleanupApprovedEntriesFromSelection();
        } catch (error) {
            console.error('Error clearing highlighting:', error);
        }
    }

    /**
     * Method Name: cleanupApprovedEntriesFromSelection
     * @description: Remove approved entries from selectedRows to prevent accidental operations
     */
    cleanupApprovedEntriesFromSelection() {
        const allEntries = [...this.contractEntries, ...this.changeOrderEntries];
        const approvedEntryIds = allEntries
            .filter(entry => entry.wfrecon__Scope_Entry_Status__c === 'Approved')
            .map(entry => entry.Id);

        if (approvedEntryIds.length > 0) {
            const originalCount = this.selectedRows.length;
            this.selectedRows = this.selectedRows.filter(id => !approvedEntryIds.includes(id));

            // If any approved entries were removed from selection, update checkboxes
            if (this.selectedRows.length !== originalCount) {
                this.updateCheckboxes();
            }
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

        // Show confirmation modal for process deletion
        this.showProcessDeleteConfirmation(processIds, scopeEntryId);
    }

    /**
     * Method Name: showProcessDeleteConfirmation
     * @description: Show confirmation modal for deleting selected processes
     */
    showProcessDeleteConfirmation(processIds, scopeEntryId) {
        const processCount = processIds.length;
        this.confirmationTitle = 'Delete Processes';
        this.confirmationMessage = `Warning: This will permanently delete ${processCount} process ${processCount === 1 ? 'entry' : 'entries'}.`;
        this.confirmationButtonLabel = 'Delete';
        this.confirmationButtonVariant = 'destructive';
        this.confirmationAction = 'deleteProcesses';
        this.confirmationData = { processIds, scopeEntryId };
        this.showConfirmationModal = true;
    }

    /**
     * Method Name: proceedWithProcessDeletion
     * @description: Proceed with deleting processes
     */
    proceedWithProcessDeletion(data) {
        const { processIds, scopeEntryId } = data;
        this.isProcessSubmitting = true;

        deleteSelectedScopeEntryProcesses({ processIds: processIds })
            .then(result => {
                if (result && result.startsWith('Success')) {
                    // Clear selections for deleted processes
                    const selectedProcesses = this.selectedProcessesByScopeEntry.get(scopeEntryId) || new Set();
                    processIds.forEach(processId => {
                        selectedProcesses.delete(processId);
                    });

                    // Update the map with the cleaned set
                    if (selectedProcesses.size > 0) {
                        this.selectedProcessesByScopeEntry.set(scopeEntryId, selectedProcesses);
                    } else {
                        this.selectedProcessesByScopeEntry.delete(scopeEntryId);
                    }

                    // Create a new Map to trigger reactivity
                    this.selectedProcessesByScopeEntry = new Map(this.selectedProcessesByScopeEntry);

                    this.showToast('Success', 'Processes deleted successfully', 'success');

                    // Refresh data and update UI
                    this.performTargetedRefresh();
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to delete processes', 'error');
            })
            .finally(() => {
                this.isProcessSubmitting = false;
            });
    }

    /**
     * Method Name: openModal
     * @description: Open modal based on type and initialize default values
     */
    openModal(modalType, options = {}) {
        switch (modalType) {
            case 'scopeEntry':
                // Determine default type based on whether any scope entry has approved status
                const defaultType = this.getDefaultScopeEntryType();
                this.newScopeEntry = {
                    name: '',
                    contractValue: null,
                    description: '',
                    type: defaultType
                };
                this.showAddModal = true;
                break;
            case 'process':
                this.selectedScopeEntryId = options.scopeEntryId;
                this.selectedScopeEntryName = options.scopeEntryName;
                this.newProcess = {
                    processName: '',
                    sequence: null,
                    processType: '',
                    weightage: null,
                };
                this.showAddProcessModal = true;
                break;
            case 'processLibrary':
                this.selectedScopeEntryId = options.scopeEntryId;
                this.selectedScopeEntryName = options.scopeEntryName;
                this.showProcessLibraryModal = true;
                this.loadProcessLibraryData();
                break;
            case 'location':
                this.selectedLocationScopeEntryId = options.scopeEntryId;
                this.selectedScopeEntryName = options.scopeEntryName;
                this.isLocationViewMode = options.isViewMode || false;
                this.showAddLocationModal = true;
                this.loadLocationData();
                break;

        }
    }

    /**
     * Method Name: closeModal
     * @description: Close modal and reset to default state
     */
    closeModal(modalType) {
        switch (modalType) {
            case 'scopeEntry':
                this.showAddModal = false;
                const defaultType = this.getDefaultScopeEntryType();
                this.newScopeEntry = {
                    name: '',
                    contractValue: null,
                    description: '',
                    type: defaultType
                };
                break;
            case 'process':
                this.showAddProcessModal = false;
                this.newProcess = {
                    processName: '',
                    sequence: null,
                    processType: '',
                    weightage: null,
                };
                this.selectedScopeEntryId = '';
                this.selectedScopeEntryName = '';
                break;
            case 'processLibrary':
                this.showProcessLibraryModal = false;
                this.selectedProcessLibraryIds = [];
                this.processLibrarySearchTerm = '';
                this.selectedProcessCategory = '';
                this.selectedScopeEntryId = '';
                this.selectedScopeEntryName = '';
                this.processLibraryDisplayRecords = this.processLibraryDisplayRecords.map(process => ({
                    ...process,
                    isSelected: false
                }));
                break;
            case 'location':
                this.showAddLocationModal = false;
                this.selectedLocationIds = [];
                this.locationSearchTerm = '';
                this.selectedLocationScopeEntryId = '';
                this.selectedScopeEntryName = '';
                this.isLocationViewMode = false;
                this.locationDisplayRecords = this.locationDisplayRecords.map(location => ({
                    ...location,
                    isSelected: false
                }));
                break;

        }
    }

    /**
     * Method Name: handleAddScopeEntry
     * @description: Handle opening add scope entry modal
     */
    handleAddScopeEntry() {
        this.openModal('scopeEntry');
    }

    /**
     * Method Name: handleCloseModal
     * @description: Handle closing any open modal
     */
    handleCloseModal() {
        this.closeModal('scopeEntry');
    }

    /**
     * Method Name: handleInputChange
     * @description: Handle all input changes using data-field and data-type attributes
     */
    handleInputChange(event) {
        const field = event.target.dataset.field;
        const type = event.target.dataset.type || 'scopeEntry'; // default to scopeEntry
        let value = event.target.value;

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
     * @description: Validate scope entry form data including type-specific validation
     * @return: Object with isValid boolean and error message
     */
    validateScopeEntry() {
        const { name, contractValue, description, type } = this.newScopeEntry;

        // Check if any required field is missing
        const missingFields = [];

        if (!name || name.trim() === '') {
            missingFields.push('Name');
        }

        if (contractValue === null || contractValue === undefined) {
            missingFields.push('Value');
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

        if (contractValue === null || contractValue === undefined) {
            return { isValid: false, message: 'Value is required' };
        }

        // Type-specific validation for contractValue
        if (type === 'Contract' && contractValue <= 0) {
            return { isValid: false, message: 'Contract type entries must be positive numbers only. Please enter a value greater than 0' };
        }

        // Change Order validation - must not be zero, can be positive or negative
        if (type === 'Change Order' && contractValue == 0) {
            return { isValid: false, message: 'Change Order value cannot be zero. Please enter a positive or negative value' };
        }

        if (contractValue > 2000000000) {
            return { isValid: false, message: 'Value cannot exceed 2,000,000,000' };
        }

        if (contractValue < -2000000000) {
            return { isValid: false, message: 'Value cannot be less than -2,000,000,000' };
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

        const rawContract = this.newScopeEntry.contractValue;
        const parsedContract = rawContract === null || rawContract === undefined || rawContract === ''
            ? null
            : Number(rawContract);

        // If Number(...) produced NaN, show error
        if (parsedContract !== null && Number.isNaN(parsedContract)) {
            this.showToast('Error', 'Contract Value must be a valid number', 'error');
            return;
        }

        this.isSubmitting = true;

        const scopeEntryData = {
            name: this.newScopeEntry.name.trim(),
            contractValue: parsedContract, // send as a JS number (can be negative)
            description: this.newScopeEntry.description ? this.newScopeEntry.description.trim() : '',
            jobId: this.recordId,
            type: this.newScopeEntry.type
        };


        createScopeEntry({ scopeEntryData })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'New scope entry has been created', 'success');
                    this.handleCloseModal();
                    this.performCompleteRefresh();
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
     * @description: Handle row selection - only allow selection of non-approved entries
     */
    handleRowSelection(event) {
        const rowId = event.target.dataset.rowId;
        const isChecked = event.target.checked;

        // Find the entry to check if it's approved
        const allEntries = [...this.contractEntries, ...this.changeOrderEntries];
        const entry = allEntries.find(e => e.Id === rowId);

        // Prevent selection of approved entries
        // if (entry && entry.wfrecon__Scope_Entry_Status__c === 'Approved') {
        //     event.target.checked = false;
        //     this.showToast('Warning', 'Approved entries cannot be selected for deletion.', 'warning');
        //     return;
        // }

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
     * @description: Handle mass delete of selected non-approved scope entries only
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

        // Filter out approved entries from deletion
        const allEntries = [...this.contractEntries, ...this.changeOrderEntries];
        const selectedEntries = allEntries.filter(entry => this.selectedRows.includes(entry.Id));
        const nonApprovedSelectedEntries = selectedEntries.filter(entry =>
            entry.wfrecon__Scope_Entry_Status__c !== 'Approved'
        );
        const approvedSelectedEntries = selectedEntries.filter(entry =>
            entry.wfrecon__Scope_Entry_Status__c === 'Approved'
        );

        // Show warning if trying to delete approved entries
        if (approvedSelectedEntries.length > 0 && nonApprovedSelectedEntries.length === 0) {
            this.showToast('Warning', 'Cannot delete approved entries. Only draft entries can be deleted.', 'warning');
            return;
        }

        if (nonApprovedSelectedEntries.length === 0) {
            this.showToast('Warning', 'No non-approved entries selected for deletion.', 'warning');
            return;
        }

        // Show information message if some approved entries were skipped
        if (approvedSelectedEntries.length > 0) {
            this.showToast('Info',
                `${approvedSelectedEntries.length} approved entries will be skipped. Only ${nonApprovedSelectedEntries.length} draft entries will be deleted.`,
                'info'
            );
        }

        // Show confirmation modal for deletion
        this.showDeleteConfirmation(nonApprovedSelectedEntries);
    }

    showDeleteConfirmation(entriesToDelete) {
        const entryCount = entriesToDelete.length;
        this.confirmationTitle = 'Delete Scope Entries';
        this.confirmationMessage = `Warning: This will permanently delete ${entryCount} scope ${entryCount === 1 ? 'entry' : 'entries'} and all related data.`;
        this.confirmationButtonLabel = 'Delete';
        this.confirmationButtonVariant = 'destructive';
        this.confirmationAction = 'deleteScopeEntries';
        this.confirmationData = entriesToDelete;
        this.showConfirmationModal = true;
    }


    proceedWithDeletion(entriesToDelete) {
        this.isLoading = true;
        const entryIds = entriesToDelete.map(entry => entry.Id);

        deleteScopeEntries({ scopeEntryIds: entryIds })
            .then(result => {
                if (result === 'Success') {
                    // Clear selections for deleted entries
                    this.selectedRows = this.selectedRows.filter(id => !entryIds.includes(id));

                    // Clear process selections for deleted scope entries
                    entryIds.forEach(entryId => {
                        this.selectedProcessesByScopeEntry.delete(entryId);
                    });

                    this.showToast('Success', `${entriesToDelete.length} entries deleted successfully`, 'success');

                    // Refresh data and update UI
                    this.performTargetedRefresh();
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
     * Method Name: handleApproveAllContractEntries
     * @description: Handle approving all contract entries with total contract price validation and process/location validation
     */
    async handleApproveAllContractEntries() {
        // Prevent double-click by checking if already processing
        if (this.isLoading || this.isSavingScopeEntries) {
            return;
        }

        if (!this.filteredContractEntries || this.filteredContractEntries.length === 0) {
            this.showToast('Warning', 'No contract entries found to approve', 'warning');
            return;
        }

        // Check if all are already approved
        const unapprovedEntries = this.filteredContractEntries.filter(entry =>
            entry.wfrecon__Scope_Entry_Status__c !== 'Approved'
        );

        if (unapprovedEntries.length === 0) {
            this.showToast('Info', 'All contract entries are already approved', 'info');
            return;
        }

        try {
            // Validate that all unapproved entries have processes and locations
            const validation = await this.validateScopeEntriesForApproval(unapprovedEntries);
            if (!validation.isValid) {
                this.showToast('Error', validation.message, 'error');
                return;
            }

            // Get job's total contract price
            const totalBaseContractValue = this.totalContractValue || 0;

            // console.log('totalJobContractValue ==> ', this.totalJobContractValue);


            // Check if totals match
            if (Math.abs(this.totalJobContractValue - totalBaseContractValue) > 0.01) { // Allow for small rounding differences
                // Show confirmation modal for mismatch
                this.showContractPriceConfirmation(this.totalJobContractValue, totalBaseContractValue, unapprovedEntries);
            } else {
                // Proceed directly with approval
                this.proceedWithContractApproval(unapprovedEntries);
            }
        } catch (error) {
            console.error('Error getting job total contract price:', error);
            this.showToast('Error', 'Failed to validate contract totals. Please try again.', 'error');
        }
    }

    showContractPriceConfirmation(jobTotalContractPrice, totalBaseContractValue, unapprovedEntries) {
        const difference = Math.abs(jobTotalContractPrice - totalBaseContractValue);
        const formattedJobTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(jobTotalContractPrice);
        const formattedContractTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalBaseContractValue);

        this.confirmationTitle = 'Contract Total Mismatch';
        this.confirmationMessage = `Job Total Contract Price ${formattedJobTotal} does not match Sum of Contract Entries ${formattedContractTotal}. Do you want to proceed with approval?`;
        this.confirmationButtonLabel = 'Approve Anyway';
        this.confirmationButtonVariant = 'destructive';
        this.confirmationAction = 'approveContractEntries';
        this.confirmationData = unapprovedEntries;
        this.showConfirmationModal = true;
    }

    proceedWithContractApproval(unapprovedEntries) {
        this.isSavingScopeEntries = true;
        const updatedEntries = unapprovedEntries.map(entry => ({
            Id: entry.Id,
            wfrecon__Scope_Entry_Status__c: 'Approved'
        }));

        saveScopeEntryInlineEdits({ updatedScopeEntriesJson: JSON.stringify(updatedEntries) })
            .then(result => {
                if (result.includes('Success')) {
                    this.showToast('Success', 'Contract entries approved successfully', 'success');
                    this.performCompleteRefresh();
                }
            })
            .catch(() => {
                this.showToast('Error', 'Failed to approve contract entries', 'error');
            })
            .finally(() => {
                this.isSavingScopeEntries = false;
            });
    }

    /**
     * Method Name: handleApproveAllChangeOrderEntries
     * @description: Handle approving all change order entries with process/location validation
     */
    async handleApproveAllChangeOrderEntries() {
        // Prevent double-click by checking if already processing
        if (this.isLoading || this.isSavingScopeEntries) {
            return;
        }

        // console.log('Here');


        if (!this.filteredChangeOrderEntries || this.filteredChangeOrderEntries.length === 0) {
            this.showToast('Warning', 'No change order entries found to approve', 'warning');
            return;
        }

        // Check if all are already approved
        const unapprovedEntries = this.filteredChangeOrderEntries.filter(entry =>
            entry.wfrecon__Scope_Entry_Status__c !== 'Approved'
        );

        if (unapprovedEntries.length === 0) {
            this.showToast('Info', 'All change order entries are already approved', 'info');
            return;
        }

        try {
            // Validate that all unapproved entries have processes and locations
            const validation = await this.validateScopeEntriesForApproval(unapprovedEntries);
            if (!validation.isValid) {
                this.showToast('Error', validation.message, 'error');
                return;
            }

            this.isSavingScopeEntries = true;

            // Prepare updates for all change order entries
            const updatedEntries = unapprovedEntries.map(entry => ({
                Id: entry.Id,
                wfrecon__Scope_Entry_Status__c: 'Approved'
            }));

            const updatedEntriesJson = JSON.stringify(updatedEntries);

            // console.log('updatedEntriesJson ==> ' , updatedEntriesJson);


            saveScopeEntryInlineEdits({ updatedScopeEntriesJson: updatedEntriesJson })
                .then(result => {
                    // console.log(result);

                    if (result.includes('Success')) {
                        this.showToast('Success', `All change order entries have been approved`, 'success');
                        this.performCompleteRefresh();
                    }
                })
                .catch(() => {
                    this.showToast('Error', 'Failed to approve change order entries', 'error');
                })
                .finally(() => {
                    this.isSavingScopeEntries = false;
                });

            // console.log('Here 2');
        } catch (error) {
            console.error('Error validating change order entries:', error);
            this.showToast('Error', 'Failed to validate change order entries. Please try again.', 'error');
            this.isSavingScopeEntries = false;
        }
    }

    /**
     * Method Name: handleUnapproveSelectedContracts
     * @description: Handle unapproving selected contract entries (only approved ones)
     */
    handleUnapproveSelectedContracts() {
        // Prevent double-click by checking if already processing
        if (this.isLoading || this.isSavingScopeEntries) {
            return;
        }

        // Get selected approved contract entries only
        const selectedApprovedContracts = this.filteredContractEntries.filter(entry =>
            this.selectedRows.includes(entry.Id) && entry.wfrecon__Scope_Entry_Status__c === 'Approved'
        );

        if (selectedApprovedContracts.length === 0) {
            this.showToast('Warning', 'No approved contract entries selected to unapprove', 'warning');
            return;
        }

        // Show confirmation modal
        this.confirmationTitle = 'Unapprove Contract Entries';
        this.confirmationMessage = `Are you sure you want to unapprove ${selectedApprovedContracts.length} contract ${selectedApprovedContracts.length === 1 ? 'entry' : 'entries'}?`;
        this.confirmationButtonLabel = 'Unapprove';
        this.confirmationButtonVariant = 'destructive';
        this.confirmationIcon = 'utility:warning';
        this.confirmationIconVariant = 'warning';
        this.confirmationAction = 'unapproveContractEntries';
        this.confirmationData = selectedApprovedContracts;
        this.showConfirmationModal = true;
    }

    /**
     * Method Name: proceedWithContractUnapproval
     * @description: Proceed with unapproving contract entries
     */
    proceedWithContractUnapproval(approvedEntries) {
        this.isSavingScopeEntries = true;
        const updatedEntries = approvedEntries.map(entry => ({
            Id: entry.Id,
            wfrecon__Scope_Entry_Status__c: 'Draft',
            wfrecon__Approved_Date__c: null
        }));

        saveScopeEntryInlineEdits({ updatedScopeEntriesJson: JSON.stringify(updatedEntries) })
            .then(result => {
                if (result.includes('Success')) {
                    this.showToast('Success', `${approvedEntries.length} contract ${approvedEntries.length === 1 ? 'entry' : 'entries'} unapproved successfully`, 'success');
                    this.selectedRows = [];
                    this.performCompleteRefresh();
                }
            })
            .catch(() => {
                this.showToast('Error', 'Failed to unapprove contract entries', 'error');
            })
            .finally(() => {
                this.isSavingScopeEntries = false;
            });
    }

    /**
     * Method Name: handleUnapproveSelectedChangeOrders
     * @description: Handle unapproving selected change order entries (only approved ones)
     */
    handleUnapproveSelectedChangeOrders() {
        // Prevent double-click by checking if already processing
        if (this.isLoading || this.isSavingScopeEntries) {
            return;
        }

        // Get selected approved change order entries only
        const selectedApprovedChangeOrders = this.filteredChangeOrderEntries.filter(entry =>
            this.selectedRows.includes(entry.Id) && entry.wfrecon__Scope_Entry_Status__c === 'Approved'
        );

        if (selectedApprovedChangeOrders.length === 0) {
            this.showToast('Warning', 'No approved change order entries selected to unapprove', 'warning');
            return;
        }

        // Show confirmation modal
        this.confirmationTitle = 'Unapprove Change Order Entries';
        this.confirmationMessage = `Are you sure you want to unapprove ${selectedApprovedChangeOrders.length} change order ${selectedApprovedChangeOrders.length === 1 ? 'entry' : 'entries'}?`;
        this.confirmationButtonLabel = 'Unapprove';
        this.confirmationButtonVariant = 'destructive';
        this.confirmationIcon = 'utility:warning';
        this.confirmationIconVariant = 'warning';
        this.confirmationAction = 'unapproveChangeOrderEntries';
        this.confirmationData = selectedApprovedChangeOrders;
        this.showConfirmationModal = true;
    }

    /**
     * Method Name: proceedWithChangeOrderUnapproval
     * @description: Proceed with unapproving change order entries
     */
    proceedWithChangeOrderUnapproval(approvedEntries) {
        this.isSavingScopeEntries = true;
        const updatedEntries = approvedEntries.map(entry => ({
            Id: entry.Id,
            wfrecon__Scope_Entry_Status__c: 'Draft',
            wfrecon__Approved_Date__c: null
        }));

        saveScopeEntryInlineEdits({ updatedScopeEntriesJson: JSON.stringify(updatedEntries) })
            .then(result => {
                if (result.includes('Success')) {
                    this.showToast('Success', `${approvedEntries.length} change order ${approvedEntries.length === 1 ? 'entry' : 'entries'} unapproved successfully`, 'success');
                    this.selectedRows = [];
                    this.performCompleteRefresh();
                }
            })
            .catch(() => {
                this.showToast('Error', 'Failed to unapprove change order entries', 'error');
            })
            .finally(() => {
                this.isSavingScopeEntries = false;
            });
    }

    handleAddLocation(event) {
        const scopeEntryId = event.currentTarget.dataset.recordId;
        const entry = this.getEntryById(scopeEntryId);

        // Check if scope entry is approved - open in view-only mode
        const isApproved = entry && entry.wfrecon__Scope_Entry_Status__c === 'Approved';

        this.openModal('location', {
            scopeEntryId: scopeEntryId,
            scopeEntryName: entry ? entry.Name : '',
            isViewMode: isApproved
        });
    }


    /**
     * Method Name: processEntriesForDisplay
     * @description: Common method to process entries for display with nested table support and inline editing
     */
    processEntriesForDisplay(entries) {
        const cols = this.tableColumns;

        // console.log('cols ==> ' , cols);


        return entries.map(entry => {
            const row = { ...entry };
            row.isSelected = this.selectedRows.includes(entry.Id);
            row.recordUrl = `/lightning/r/${entry.Id}/view`;

            // Preserve nested table state
            row.showProcessDetails = entry.showProcessDetails || false;
            row.processDetails = entry.processDetails || null;

            // console.log(`Processing entry ${entry.Id}: showProcessDetails=${row.showProcessDetails}, processDetails=${row.processDetails ? row.processDetails.length : 'null'} items`);

            // Check if this specific scope entry is approved
            row.isScopeEntryApproved = entry.wfrecon__Scope_Entry_Status__c === 'Approved';

            // Add location button title based on approval status
            row.locationButtonTitle = row.isScopeEntryApproved ? 'View Locations' : 'Add Location';

            // Calculate if all processes are selected for this entry
            row.isAllProcessesSelected = this.areAllProcessesSelectedForEntry(entry.Id);

            // Entry-specific button states - use entry-specific saving state instead of global
            const isEntrySaving = this.isSavingProcessEntriesByScopeEntry.get(entry.Id) || false;
            row.isProcessButtonsDisabled = !this.hasProcessModificationsForEntry(entry.Id) || isEntrySaving;
            row.isProcessSaveDisabled = !this.hasProcessModificationsForEntry(entry.Id) || isEntrySaving;
            row.isSavingProcessEntries = isEntrySaving; // Add entry-specific saving flag for template use
            row.processSaveButtonLabel = this.getProcessSaveButtonLabelForEntry(entry.Id);
            row.processDiscardButtonTitle = this.getProcessDiscardButtonTitleForEntry(entry.Id);

            // Add scope entry-specific delete properties
            row.hasSelectedProcesses = this.hasSelectedProcessesForEntry(entry.Id);
            row.selectedProcessesCount = this.getSelectedProcessesCountForEntry(entry.Id);
            row.isDeleteProcessDisabled = this.isDeleteProcessDisabledForEntry(entry.Id);

            // Check if process action buttons should be hidden when this specific scope entry is approved
            row.hideProcessButtons = row.isScopeEntryApproved;

            // Add data attribute to identify contract vs change order sections
            row.sectionType = entry.wfrecon__Type__c;

            // Add CSS classes for conditional hiding
            row.processButtonsClass = row.hideProcessButtons ? 'hide-process-buttons' : '';
            row.checkboxClass = row.hideProcessButtons ? 'hide-contract-checkboxes' : '';

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
                // Only add editable-cell class if user has edit permissions
                let cellClass = (col.editable && this.canEdit) ? 'center-trancate-text editable-cell' : 'center-trancate-text';
                let contentClass = 'editable-content';

                if (isModified) {
                    cellClass += ' modified-scope-cell';
                }

                if (isBeingEdited) {
                    cellClass += ' editing-cell';
                }

                // Check if editing should be disabled based on individual approval status
                const isEditingDisabled = row.isScopeEntryApproved;

                // Prepare field data
                const fieldData = {
                    key: col.fieldName,
                    value: displayValue || '',
                    rawValue: rawValue,
                    cellClass: cellClass,
                    contentClass: contentClass,
                    isEditable: (col.editable || false) && !isEditingDisabled && this.canEdit,
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
                        selected: option.value === value
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
     * Method Name: buildFieldDisplayData
     * @description: Helper method to build field display data structure
     */
    buildFieldDisplayData(processData, col, key, value, displayValue, isModified, isEditable, isBeingEdited) {
        // Build cell classes - only add editable-cell class if user has edit permissions
        let cellClass = 'center-trancate-text';
        if (isEditable && this.canEdit) cellClass += ' editable-cell';
        if (isModified && !isBeingEdited) cellClass += ' modified-process-cell';
        if (isBeingEdited) cellClass += ' editing-cell';

        // Build content classes
        let contentClass = 'editable-content';

        // Handle different field types
        let currencyValue = 0, percentValue = 0, numberValue = 0, dateValue = '';

        if (col.type === 'currency') {
            currencyValue = value !== null && value !== undefined ? parseFloat(value) : 0;
        } else if (col.type === 'percent') {
            percentValue = value !== null && value !== undefined ? parseFloat(value) : 0;
        } else if (col.type === 'number') {
            numberValue = value !== null && value !== undefined ? parseFloat(value) : 0;
        } else if (col.type === 'date' && value) {
            dateValue = this.formatDateForInput(value);
        }

        // Handle picklist options
        let picklistOptions = [];
        if (col.type === 'picklist' && this.fieldPicklistOptions.has(key)) {
            picklistOptions = this.fieldPicklistOptions.get(key);
        }

        // Determine if field has value
        let hasValue;
        if (['currency', 'percent', 'number'].includes(col.type)) {
            hasValue = value !== null && value !== undefined && !isNaN(value);
        } else {
            hasValue = value !== null && value !== undefined && String(value).trim() !== '';
        }

        return {
            key,
            value: displayValue || (col.type === 'currency' ? '0' : col.type === 'percent' ? '0%' : col.type === 'number' ? '0' : '--'),
            rawValue: value,
            currencyValue,
            percentValue,
            numberValue,
            dateValue,
            picklistOptions,
            hasValue,
            isNameField: key === 'wfrecon__Process_Library__r.Name',
            isCurrency: col.type === 'currency',
            isPercent: col.type === 'percent',
            isNumber: col.type === 'number',
            isDate: col.type === 'date',
            isPicklist: col.type === 'picklist',
            isEditable,
            isModified,
            isBeingEdited,
            cellClass,
            contentClass
        };
    }

    /**
     * Method Name: processProcessDetailsForDisplay
     * @description: Process process details for nested table display with inline editing support
     */
    processProcessDetailsForDisplay(processDetails) {
        // console.log('processProcessDetailsForDisplay called with:', processDetails);

        if (!processDetails || processDetails.length === 0) {
            // console.log('No process details to display');
            return [];
        }

        const result = processDetails.map(processData => {
            const row = { ...processData };

            // Set record URL for navigation
            row.recordUrl = processData.wfrecon__Process_Library__c ?
                `/lightning/r/${processData.wfrecon__Process_Library__c}/view` :
                `/lightning/r/${processData.Id}/view`;

            // Preserve selection state
            // console.log('processData.Id ==> ', processData.Id);
            // console.log('processData fields ==> ', Object.keys(processData));
            // console.log('Full processData ==> ', processData);

            // First try to get scope entry ID directly from process data
            let scopeEntryId = this.getFieldValue(processData, 'wfrecon__Scope_Entry__c');
            // console.log('Direct scope entry ID from wfrecon__Scope_Entry__c ==> ', scopeEntryId);

            // If not available, try the search method as fallback
            if (!scopeEntryId) {
                scopeEntryId = this.getScopeEntryIdForProcess(processData.Id);
                // console.log('Scope entry ID from search method ==> ', scopeEntryId);
            }
            // console.log('Final scopeEntryId ==> ', scopeEntryId);
            const selectedProcesses = this.selectedProcessesByScopeEntry.get(scopeEntryId);
            row.isSelected = selectedProcesses ? selectedProcesses.has(processData.Id) : false;


            // console.log('scopeEntryId ==> ', scopeEntryId);


            // Get parent scope entry to check approval status - search in all available arrays
            let parentEntry = this.scopeEntries.find(entry => entry.Id === scopeEntryId);


            // console.log('parentEntry ==> ', parentEntry);
            const isParentScopeEntryApproved = parentEntry && parentEntry.wfrecon__Scope_Entry_Status__c === 'Approved';


            // Process display fields
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

                // Check parent scope entry status for editing restrictions
                // Use the already retrieved parent scope entry status
                // console.log('isParentScopeEntryApproved ==> ', isParentScopeEntryApproved);

                // If parent scope entry is 'Approved', only sequence column should be editable
                if (isParentScopeEntryApproved) {
                    isEditable = isEditable && key === 'wfrecon__Sequence__c';
                }

                // Check user permissions - only allow editing if user has full access
                isEditable = isEditable && this.canEdit;

                return this.buildFieldDisplayData(processData, col, key, value, displayValue, isModified, isEditable, isBeingEdited);
            });

            // console.log('row.displayFields ==> ', row.displayFields);

            return row;
        });

        // console.log('processProcessDetailsForDisplay returning:', result.length, 'processed records');
        return result;
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
     * @description: Handle select all for all contract entries (both approved and unapproved)
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
     * @description: Handle select all for all change order entries (both approved and unapproved)
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
     * @description: Toggle process details display and load data synchronously from preloaded data
     */
    handleToggleProcessDetails(event) {
        const recordId = event.currentTarget.dataset.recordId;

        if (!recordId) {
            this.showToast('Error', 'Unable to identify scope entry', 'error');
            return;
        }

        try {
            // Force reactivity by creating new arrays for contract entries
            this.filteredContractEntries = [...this.filteredContractEntries.map(entry => {
                if (entry.Id === recordId) {
                    const updatedEntry = { ...entry };
                    updatedEntry.showProcessDetails = !entry.showProcessDetails;

                    // Always ensure loading is false and process data when expanding
                    if (updatedEntry.showProcessDetails) {
                        // Get process data from preloaded map
                        const processData = this.scopeEntryProcessMap.get(recordId) || [];
                        // console.log('Process data for scope entry', recordId, ':', processData);

                        // Process the data for display
                        try {
                            const processedDetails = this.processProcessDetailsForDisplay(processData);
                            updatedEntry.processDetails = processedDetails;
                            // console.log(`Set processDetails for ${recordId}:`, processedDetails.length, 'items');
                        } catch (error) {
                            console.error('Error processing process details:', error);
                            updatedEntry.processDetails = [];
                        }
                    } else {
                        updatedEntry.processDetails = null;
                        // console.log(`Collapsed processDetails for ${recordId}`);
                    }

                    return updatedEntry;
                }
                return entry;
            })];

            this.filteredChangeOrderEntries = [...this.filteredChangeOrderEntries.map(entry => {
                if (entry.Id === recordId) {
                    const updatedEntry = { ...entry };
                    updatedEntry.showProcessDetails = !entry.showProcessDetails;

                    if (updatedEntry.showProcessDetails) {
                        const processData = this.scopeEntryProcessMap.get(recordId) || [];
                        // console.log('Process data for scope entry', recordId, ':', processData);

                        try {
                            const processedDetails = this.processProcessDetailsForDisplay(processData);
                            updatedEntry.processDetails = processedDetails;
                            // console.log(`Set processDetails for change order ${recordId}:`, processedDetails.length, 'items');
                        } catch (error) {
                            console.error('Error processing process details:', error);
                            updatedEntry.processDetails = [];
                        }
                    } else {
                        updatedEntry.processDetails = null;
                        // console.log(`Collapsed processDetails for change order ${recordId}`);
                    }

                    return updatedEntry;
                }
                return entry;
            })];
        } catch (error) {
            console.error('Error in handleToggleProcessDetails:', error);
            this.showToast('Error', 'Failed to toggle process details', 'error');
        }
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
        };

        this.showAddProcessModal = true;

    }

    handleCloseProcessModal() {
        this.closeModal('process');
    }

    /**
     * Method Name: validateProcess
     * @description: Validate process form data
     * @return: Object with isValid boolean and error message
     */
    validateProcess() {
        const { processName, sequence, processType, weightage } = this.newProcess;

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

        const parsedSequnce = parseFloat(this.newProcess.sequence);
        const parsedWeightage = parseFloat(this.newProcess.weightage);

        const processData = {
            processName: this.newProcess.processName.trim(),
            sequence: parsedSequnce,
            processType: this.newProcess.processType,
            weightage: parsedWeightage,
            scopeEntryId: this.selectedScopeEntryId,
            jobId: this.recordId
        };

        createScopeEntryProcess({ processData })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Process has been added', 'success');
                    this.handleCloseProcessModal();

                    // Use targeted refresh instead of complete refresh to maintain expanded state
                    this.performTargetedRefresh();

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

        // Create a new Map to trigger reactivity
        this.selectedProcessesByScopeEntry = new Map(this.selectedProcessesByScopeEntry);

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

        // Create a new Map to trigger reactivity
        this.selectedProcessesByScopeEntry = new Map(this.selectedProcessesByScopeEntry);

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
                const updatedEntry = { ...entry };
                if (updatedEntry.processDetails) {
                    updatedEntry.processDetails = this.processProcessDetailsForDisplay(updatedEntry.processDetails);
                }
                // Update the isAllProcessesSelected flag
                updatedEntry.isAllProcessesSelected = this.areAllProcessesSelectedForEntry(updatedEntry.Id);
                return updatedEntry;
            });
        }

        // Re-process change order entries to update selection states
        if (this.filteredChangeOrderEntries.length > 0) {
            this.filteredChangeOrderEntries = this.filteredChangeOrderEntries.map(entry => {
                const updatedEntry = { ...entry };
                if (updatedEntry.processDetails) {
                    updatedEntry.processDetails = this.processProcessDetailsForDisplay(updatedEntry.processDetails);
                }
                // Update the isAllProcessesSelected flag
                updatedEntry.isAllProcessesSelected = this.areAllProcessesSelectedForEntry(updatedEntry.Id);
                return updatedEntry;
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

    handleAddProcessFromLibrary(event) {
        this.openModal('processLibrary', {
            scopeEntryId: event.currentTarget.dataset.scopeEntryId,
            scopeEntryName: event.currentTarget.dataset.scopeEntryName
        });
    }

    /**
     * Method Name: loadProcessLibraryData
     * @description: Load process library records and process types
     */
    loadProcessLibraryData() {
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

    handleCloseProcessLibraryModal() {
        this.closeModal('processLibrary');
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
                    this.performTargetedRefresh();

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
     * Method Name: setProcessLoadingState
     * @description: Utility method to set loading state for process details
     */
    setProcessLoadingState(scopeEntryId, isLoading) {
        // Force reactivity by creating new arrays
        this.filteredContractEntries = [...this.filteredContractEntries.map(entry => {
            if (entry.Id === scopeEntryId) {
                return { ...entry, isLoadingProcesses: isLoading };
            }
            return entry;
        })];

        this.filteredChangeOrderEntries = [...this.filteredChangeOrderEntries.map(entry => {
            if (entry.Id === scopeEntryId) {
                return { ...entry, isLoadingProcesses: isLoading };
            }
            return entry;
        })];
    }

    /**
     * Method Name: loadLocationData
     * @description: Load locations using junction object for scope entry relationships
     */
    loadLocationData() {
        getLocationsByScopeEntry({ scopeEntryId: this.selectedLocationScopeEntryId })
            .then(result => {
                if (result.success) {
                    this.locationRecords = result.allLocations || [];
                    this.selectedLocationIds = [...(result.selectedLocationIds || [])]; // Create a copy
                    this.originalLocationIds = [...(result.selectedLocationIds || [])]; // Store original state

                    this.applyLocationFilters();
                } else {
                    this.showToast('Error', result.message || 'Failed to load locations', 'error');
                    this.locationRecords = [];
                    this.locationDisplayRecords = [];
                    this.selectedLocationIds = [];
                    this.originalLocationIds = [];
                }
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
                    (location.wfrecon__Quantity__c && location.wfrecon__Quantity__c.toString().includes(searchLower))
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

    handleCloseLocationModal() {
        this.closeModal('location');
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

                    // Update the location count cache immediately
                    this.scopeEntryLocationCounts.set(scopeEntryId, this.selectedLocationIds.length);

                    this.handleCloseLocationModal();
                    // Use targeted refresh instead of complete refresh to maintain expanded state
                    this.performTargetedRefresh();

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

    handleSortClick(event) {
        try {
            const fieldName = event.currentTarget.dataset.id;
            const section = event.currentTarget.dataset.section;

            let currentSortField, currentSortOrder;

            if (section === 'contract') {
                currentSortField = this.contractSortField;
                currentSortOrder = this.contractSortOrder;
            } else {
                currentSortField = this.changeOrderSortField;
                currentSortOrder = this.changeOrderSortOrder;
            }

            if (currentSortField === fieldName) {
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = fieldName;
                currentSortOrder = 'asc';
            }

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
            // Error handling sort
        }
    }

    handleProcessSortClick(event) {
        try {
            const fieldName = event.currentTarget.dataset.id;
            const scopeEntryId = event.currentTarget.dataset.scopeEntryId;

            let currentSort = this.processSortByEntry.get(scopeEntryId) || { sortField: '', sortOrder: 'asc' };

            if (currentSort.sortField === fieldName) {
                currentSort.sortOrder = currentSort.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.sortField = fieldName;
                currentSort.sortOrder = 'asc';
            }

            this.processSortByEntry.set(scopeEntryId, currentSort);
            this.sortProcessData(scopeEntryId);
            this.updateProcessSortIcons(scopeEntryId);
        } catch (error) {
            // Error handling process sort
        }
    }

    /**
     * Method Name: updateProcessSortIcons
     * @description: Update process table sort icons and active states - FIXED VERSION
     */
    updateProcessSortIcons(scopeEntryId) {
        try {
            if (scopeEntryId) {
                // Clear icons for this specific scope entry first
                const scopeHeaders = this.template.querySelectorAll(`th[data-scope-entry-id="${scopeEntryId}"].process-sortable-header`);
                const scopeIcons = this.template.querySelectorAll(`th[data-scope-entry-id="${scopeEntryId}"] .process-sort-icon svg`);

                scopeHeaders.forEach(header => {
                    header.classList.remove('active-sort');
                });

                scopeIcons.forEach(icon => {
                    icon.classList.remove('rotate-asc', 'rotate-desc');
                });

                // Get the sort state for this specific scope entry
                const sortState = this.processSortByEntry.get(scopeEntryId);
                if (!sortState || !sortState.sortField) {
                    return; // No sort state or field, nothing to update
                }

                // Set active for this scope entry
                const currentHeaders = this.template.querySelectorAll(`[data-process-sort-field="${sortState.sortField}"][data-scope-entry-id="${scopeEntryId}"]`);
                currentHeaders.forEach(header => {
                    header.classList.add('active-sort');

                    const icon = header.querySelector('.process-sort-icon svg');
                    if (icon) {
                        icon.classList.add(sortState.sortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                    }
                });
            }
            else {
                // No scopeEntryId provided
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
     * Method Name: updateSortIcons
     * @description: Update sort icons and active states - FIXED VERSION
     */
    updateSortIcons(section) {
        try {
            // First clear ALL icons for this section
            this.clearSortIcons(section);

            const sortField = section === 'contract' ? this.contractSortField : this.changeOrderSortField;
            const sortOrder = section === 'contract' ? this.contractSortOrder : this.changeOrderSortOrder;

            if (!sortField) return;

            // Then set the active one using the correct selector pattern from sovJobLocations
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

    sortEntries(entries, sortField, sortOrder) {
        if (!sortField || !entries) return entries;

        return [...entries].sort((a, b) => {
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
        });
    }

    /**
     * Method Name: clearSortIcons
     * @description: Clear all sort icons and active states - FIXED VERSION following sovJobLocations pattern
     */
    clearSortIcons(section) {
        try {
            // Clear all headers for the specified section
            const allHeaders = this.template.querySelectorAll(`[data-section="${section}"].sortable-header`);
            const allIcons = this.template.querySelectorAll(`[data-section="${section}"] .sort-icon svg`);

            allHeaders.forEach(header => {
                header.classList.remove('active-sort');
            });

            allIcons.forEach(icon => {
                icon.classList.remove('rotate-asc', 'rotate-desc');
            });
        } catch (error) {
            // Error clearing sort icons - silently continue
        }
    }

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

            this.filteredContractEntries = this.filteredContractEntries.map(entry => {
                if (entry.Id === scopeEntryId && entry.processDetails) {
                    return {
                        ...entry,
                        processDetails: [...entry.processDetails].sort(sortFunction)
                    };
                }
                return entry;
            });

            this.filteredChangeOrderEntries = this.filteredChangeOrderEntries.map(entry => {
                if (entry.Id === scopeEntryId && entry.processDetails) {
                    return {
                        ...entry,
                        processDetails: [...entry.processDetails].sort(sortFunction)
                    };
                }
                return entry;
            });
        } catch (error) {
            // Error sorting process data
        }
    }

    sortData(section) {
        try {
            const sortField = section === 'contract' ? this.contractSortField : this.changeOrderSortField;
            const sortOrder = section === 'contract' ? this.contractSortOrder : this.changeOrderSortOrder;

            if (section === 'contract') {
                this.filteredContractEntries = this.sortEntries(this.filteredContractEntries, sortField, sortOrder);
            } else {
                this.filteredChangeOrderEntries = this.sortEntries(this.filteredChangeOrderEntries, sortField, sortOrder);
            }
        } catch (error) {
            // Error sorting data
        }
    }

    /**
     * Method Name: handleScopeCellClick
     * @description: Handle cell click for inline editing of scope entries
     */
    async handleScopeCellClick(event) {
        // Check if user has edit permissions
        if (!this.canEdit) return;

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
     * @description: Handle input change in scope inline editing with approval validation - FIXED
     */
    async handleScopeCellInputChange(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.fieldName;
        const fieldType = event.target.dataset.fieldType;
        let newValue = event.target.value;

        // Special validation for status field changes to "Approved"
        if (fieldName === 'wfrecon__Scope_Entry_Status__c' && newValue === 'Approved') {
            try {
                const validation = await this.validateScopeEntryForApproval(recordId);
                if (!validation.isValid) {
                    this.showToast('Error', validation.message, 'error');
                    // Reset the value to prevent the change
                    const originalEntry = [...this.filteredContractEntries, ...this.filteredChangeOrderEntries].find(entry => entry.Id === recordId);
                    if (originalEntry) {
                        event.target.value = originalEntry.wfrecon__Scope_Entry_Status__c || '';
                    }
                    return;
                }
            } catch (error) {
                console.error('Error validating scope entry approval:', error);
                this.showToast('Error', 'Error validating scope entry. Please try again.', 'error');
                // Reset the value to prevent the change
                const originalEntry = [...this.filteredContractEntries, ...this.filteredChangeOrderEntries].find(entry => entry.Id === recordId);
                if (originalEntry) {
                    event.target.value = originalEntry.wfrecon__Scope_Entry_Status__c || '';
                }
                return;
            }
        }

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

                    // console.log(`Validating ${entryName} - ${column.label}:`, value);
                    // console.log('Type:', column.type);

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
                        // Check for empty, null, undefined values
                        if (value === null || value === undefined || value === '' ||
                            (typeof value === 'string' && value.trim() === '') ||
                            (typeof value === 'string' && value.trim() === '-')) {
                            errors.push(`${entryName} - ${column.label}: Field cannot be empty. Please enter a value greater than 0`);
                        }
                        else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                                // Special validation for Contract Value field
                                const isContractValue = fieldName === 'wfrecon__Contract_Value__c';
                                const isContractType = entry && entry.wfrecon__Type__c === 'Contract';
                                const isChangeOrderType = entry && entry.wfrecon__Type__c === 'Change Order';

                                // Contract Value specific validation
                                if (isContractValue) {
                                    // Contract type must be positive
                                    if (isContractType && numValue <= 0) {
                                        errors.push(`${entryName} - ${column.label}: Contract type entries must be positive numbers only. Please enter a value greater than 0`);
                                    }
                                    // Change Order cannot be zero
                                    else if (isChangeOrderType && numValue === 0) {
                                        errors.push(`${entryName} - ${column.label}: Change Order value cannot be zero. Please enter a positive or negative value`);
                                    }
                                }
                                // Other number fields validation
                                else {
                                    // Zero validation for non-contract-value fields
                                    if (numValue === 0) {
                                        errors.push(`${entryName} - ${column.label}: Field cannot be zero. Please enter a value greater than 0`);
                                    }
                                    // Negative numbers not allowed for non-contract-value fields
                                    else if (numValue < 0) {
                                        errors.push(`${entryName} - ${column.label}: Negative numbers are not allowed. Please enter a value greater than 0`);
                                    }
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
     * @description: Save all modified scope entries in a single batch with approval validation
     */
    async handleSaveScopeChanges() {
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

        // Check for approval status changes and validate them
        const approvalValidationErrors = [];
        for (const [recordId, modifications] of this.modifiedScopeEntries.entries()) {
            if (modifications.hasOwnProperty('wfrecon__Scope_Entry_Status__c') &&
                modifications['wfrecon__Scope_Entry_Status__c'] === 'Approved') {
                try {
                    const validation = await this.validateScopeEntryForApproval(recordId);
                    if (!validation.isValid) {
                        const entry = this.scopeEntries.find(e => e.Id === recordId);
                        const entryName = entry ? entry.Name : recordId;
                        approvalValidationErrors.push(`${entryName}: ${validation.message}`);
                    }
                } catch (error) {
                    console.error('Error validating scope entry for approval:', error);
                    const entry = this.scopeEntries.find(e => e.Id === recordId);
                    const entryName = entry ? entry.Name : recordId;
                    approvalValidationErrors.push(`${entryName}: Error validating approval requirements`);
                }
            }
        }

        if (approvalValidationErrors.length > 0) {
            this.showToast('Approval Validation Error',
                `${approvalValidationErrors.join('\n')}`,
                'error');
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
                if (result.includes('Success')) {
                    this.showToast('Success', 'Your changes have been saved', 'success');

                    // Clear modifications and refresh data
                    this.modifiedScopeEntries.clear();
                    this.hasScopeModifications = false;
                    this.editingScopeCells.clear();

                    // Refresh scope entries
                    this.performCompleteRefresh();

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
        const isEntrySaving = this.isSavingProcessEntriesByScopeEntry.get(scopeEntryId) || false;
        if (isEntrySaving) {
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
     * Method Name: handleProcessCellClick
     * @description: Handle cell click for inline editing of process entries
     */
    handleProcessCellClick(event) {
        // Check if user has edit permissions
        if (!this.canEdit) return;

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
        // Search in all contract entries (both filtered and original)
        const allContractEntries = [...this.contractEntries, ...this.filteredContractEntries];
        for (let entry of allContractEntries) {
            if (entry.processDetails) {
                const found = entry.processDetails.find(p => p.Id === processId);
                if (found) return entry.Id;
            }
        }

        // Search in all change order entries (both filtered and original)
        const allChangeOrderEntries = [...this.changeOrderEntries, ...this.filteredChangeOrderEntries];
        for (let entry of allChangeOrderEntries) {
            if (entry.processDetails) {
                const found = entry.processDetails.find(p => p.Id === processId);
                if (found) return entry.Id;
            }
        }

        // Also search in the preloaded process map
        for (let [entryId, processDetails] of this.scopeEntryProcessMap) {
            if (processDetails && Array.isArray(processDetails)) {
                const found = processDetails.find(p => p.Id === processId);
                if (found) return entryId;
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
        // Get scope entry ID from button click
        const scopeEntryId = event.currentTarget.dataset.scopeEntryId;

        // Prevent double-click by checking if already processing for this entry
        const isEntrySaving = this.isSavingProcessEntriesByScopeEntry.get(scopeEntryId) || false;
        if (isEntrySaving || this.isProcessSubmitting) {
            return;
        }

        if (!this.hasProcessModificationsForEntry(scopeEntryId)) {
            return;
        }

        // Validate changes before saving
        const validationErrors = this.validateProcessChanges(scopeEntryId);
        if (validationErrors.length > 0) {
            this.showToast('Validation Error', validationErrors.join('\n'), 'error');
            return;
        }

        // Set saving state for this specific entry
        this.isSavingProcessEntriesByScopeEntry.set(scopeEntryId, true);

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
                    this.performTargetedRefresh();

                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to update process entries', 'error');
            })
            .finally(() => {
                // Clear saving state for this specific entry
                this.isSavingProcessEntriesByScopeEntry.set(scopeEntryId, false);
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

    handleConfirmationConfirm() {
        try {
            switch (this.confirmationAction) {
                case 'approveContractEntries':
                    this.showConfirmationModal = false;
                    this.proceedWithContractApproval(this.confirmationData);
                    break;
                case 'unapproveContractEntries':
                    this.showConfirmationModal = false;
                    this.proceedWithContractUnapproval(this.confirmationData);
                    break;
                case 'unapproveChangeOrderEntries':
                    this.showConfirmationModal = false;
                    this.proceedWithChangeOrderUnapproval(this.confirmationData);
                    break;
                case 'deleteScopeEntries':
                    this.showConfirmationModal = false;
                    this.proceedWithDeletion(this.confirmationData);
                    break;
                case 'deleteProcesses':
                    this.showConfirmationModal = false;
                    this.proceedWithProcessDeletion(this.confirmationData);
                    break;
                default:
                    this.showConfirmationModal = false;
                    break;
            }
        } catch (error) {
            this.showToast('Error', 'An error occurred while processing the action', 'error');
            this.showConfirmationModal = false;
        } finally {
            this.resetConfirmationState();
        }
    }

    /*
     * Method Name : handleConfirmationCancel
     * @description : Method to cancel confirmation modal
     */
    handleConfirmationCancel() {
        this.showConfirmationModal = false;
        this.resetConfirmationState();
    }

    /*
     * Method Name : handleConfirmationClose
     * @description : Method to close confirmation modal
     */
    handleConfirmationClose() {
        this.showConfirmationModal = false;
        this.resetConfirmationState();
    }

    /**
     * Method Name : resetConfirmationState
     * @description : Method to reset confirmation state
     */
    resetConfirmationState() {
        this.confirmationTitle = '';
        this.confirmationMessage = '';
        this.confirmationAction = '';
        this.confirmationButtonLabel = 'Confirm';
        this.confirmationButtonVariant = 'brand';
        this.confirmationData = null;
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

}