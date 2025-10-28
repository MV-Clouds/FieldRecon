import { LightningElement, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getLocationEntries from '@salesforce/apex/SovJobLocationsController.getLocationEntries';
import createLocationEntry from '@salesforce/apex/SovJobLocationsController.createLocationEntry';
import deleteLocationEntries from '@salesforce/apex/SovJobLocationsController.deleteLocationEntries';
import getLocationConfiguration from '@salesforce/apex/SovJobLocationsController.getLocationConfiguration';
import saveInlineEdits from '@salesforce/apex/SovJobLocationsController.saveInlineEdits';
import getPicklistValuesForField from '@salesforce/apex/SovJobLocationsController.getPicklistValuesForField';
import batchUpdateProcessCompletion from '@salesforce/apex/SovJobLocationProcessesController.batchUpdateProcessCompletion';
import { getPicklistValues } from "lightning/uiObjectInfoApi";
import UNIT_OF_MEASURE_FIELD from '@salesforce/schema/Location__c.Unit_of_Measure__c';


export default class SovJobLocations extends NavigationMixin(LightningElement) {
    @track recordId;
    @track isLoading = true;
    @track locationEntries = [];
    @track filteredLocationEntries = [];
    @track searchTerm = '';
    @track selectedRows = [];
    @track locationColumns = [];
    @track lastConfigUpdateTimestamp = 0;
    @track fieldPicklistOptions = new Map(); // Map<fieldName, Array<{label, value}>>
    @track locationProcessMap = new Map(); // Map<locationId, Array<processData>>

    // Sorting properties
    @track sortField = '';
    @track sortOrder = '';
    @track processSortField = 'wfrecon__Sequence__c';
    @track processSortOrder = 'asc';

    // Inline editing properties
    @track modifiedLocations = new Map(); // Track modified location entries
    @track hasLocationModifications = false; // Track if there are unsaved location changes
    @track isSavingLocations = false; // Track save operation for locations
    @track editingCells = new Set(); // Track which cells are currently being edited

    // Default table columns
    @track defaultColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text', editable: true },
        { label: 'Quantity', fieldName: 'wfrecon__Quantity__c', type: 'number', editable: true },
        { label: 'Unit of Measure', fieldName: 'wfrecon__Unit_of_Measure__c', type: 'picklist', editable: true }
    ];

    // Process table columns configuration
    @track processTableColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text', isNameField: true, isSortable: true },
        { label: 'Sequence', fieldName: 'wfrecon__Sequence__c', type: 'number', isSortable: true },
        { label: 'Process Name', fieldName: 'wfrecon__Scope_Entry_Process__r.wfrecon__Process_Name__c', type: 'text', isSortable: true },
        { label: 'Contract Price', fieldName: 'wfrecon__Contract_Price__c', type: 'currency', isSortable: true },
        { label: 'Completed %', fieldName: 'wfrecon__Completed_Percentage__c', type: 'percent', isSlider: true , isEditable: false, isSortable: false},
        { label: 'Current Completed Value', fieldName: 'wfrecon__Current_Completed_Value__c', type: 'currency', isSortable: true },
        { label: 'Process Status', fieldName: 'wfrecon__Process_Status__c', type: 'text', isSortable: true }
    ];

    // Modal properties
    @track showAddModal = false;
    @track isSubmitting = false;
    @track newLocation = {
        name: '',
        quantity: null,
        unitOfMeasure: ''
    };

    // Unit of Measure picklist options
    @track unitOfMeasureOptions = [];

    @track modifiedProcesses = new Map(); // Track modified processes across all locations
    @track modifiedProcessesByLocation = new Map(); // Map<locationId, Set<processId>>
    @track hasModifications = false; // Track if there are unsaved changes
    @track isSaving = false; // Track save operation
    @track savingLocations = new Set(); // Track which locations are currently saving

    // Confirmation Modal Properties
    @track showConfirmationModal = false;
    @track confirmationTitle = '';
    @track confirmationMessage = '';
    @track confirmationAction = '';
    @track confirmationButtonLabel = 'Confirm';
    @track confirmationButtonVariant = 'brand';
    @track confirmationData = null;

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
    }

    @wire(getPicklistValues, { recordTypeId: '012000000000000AAA', fieldApiName: UNIT_OF_MEASURE_FIELD })
    wiredUnitOfMeasure({ error, data }) {
        if (data) {
            this.unitOfMeasureOptions = data.values.map(item => ({ label: item.label, value: item.value }));
            // Also populate the fieldPicklistOptions map for inline editing
            this.fieldPicklistOptions.set('wfrecon__Unit_of_Measure__c', this.unitOfMeasureOptions);
        } else if (error) {
            this.unitOfMeasureOptions = [];
            console.error('Error loading Unit of Measure picklist values:', error);
        }
    }

    /**
     * Method Name: get tableColumns
     * @description: Get table columns configuration
     */
    get tableColumns() {
        return this.locationColumns.length > 0 ? this.locationColumns : this.defaultColumns;
    }


    /**
     * Method Name: get displayedLocationEntries
     * @description: Process location entries for table display
     */
    get displayedLocationEntries() {
        if (!this.filteredLocationEntries || this.filteredLocationEntries.length === 0) {
            return [];
        }

        const cols = this.tableColumns;
        return this.filteredLocationEntries.map(entry => {
            const row = { ...entry };
            
            row.isSelected = this.selectedRows.includes(entry.Id);
            row.recordUrl = `/lightning/r/${entry.Id}/view`;
            
            // Preserve nested table state
            row.showProcessDetails = entry.showProcessDetails || false;
            row.processDetails = entry.processDetails || null;
            row.isLoadingProcesses = entry.isLoadingProcesses || false;

            // Add per-location button properties
            const entryId = entry.Id;
            const hasProcessMods = this.hasProcessModificationsForLocation(entryId);
            const isSavingLocation = this.savingLocations.has(entryId);
            
            row.isProcessButtonsDisabled = !hasProcessMods || isSavingLocation;
            row.isProcessSaveDisabled = !hasProcessMods || isSavingLocation;
            
            // Compute button labels directly instead of calling methods
            if (isSavingLocation) {
                row.processSaveButtonLabel = 'Saving...';
            } else if (hasProcessMods) {
                const count = this.getProcessModificationCountForLocation(entryId);
                row.processSaveButtonLabel = `Save Changes (${count})`;
            } else {
                row.processSaveButtonLabel = 'Save Changes';
            }
            
            if (!hasProcessMods) {
                row.processDiscardButtonTitle = 'No unsaved changes to discard';
            } else {
                const count = this.getProcessModificationCountForLocation(entryId);
                row.processDiscardButtonTitle = `Discard ${count} unsaved process change(s) for this location`;
            }            
            
            row.displayFields = cols.map(col => {
                const key = col.fieldName;
                let value = this.getFieldValue(entry, key);
                
                // Check if this field has been modified
                const entryId = entry.Id;
                const modifiedValue = this.getModifiedValue(entryId, key);
                if (modifiedValue !== null && modifiedValue !== undefined) {
                    value = modifiedValue;
                }
                
                // Handle different field types for display
                let displayValue = value !== null && value !== undefined ? String(value) : '';
                let currencyValue = '';
                let percentValue = '';
                let numberValue = '';
                let dateValue = '';
                
                // Handle currency fields
                if (col.type === 'currency' && value !== null && value !== undefined) {
                    currencyValue = String(value);
                    displayValue = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD'
                    }).format(value);
                }
                
                // Handle percent fields
                if (col.type === 'percent' && value !== null && value !== undefined) {
                    percentValue = String(value);
                    displayValue = value + '%';
                }
                
                // Handle number fields
                if (col.type === 'number' && value !== null && value !== undefined) {
                    numberValue = String(value);
                }

                // Handle date fields
                if (col.type === 'date' && value) {
                    dateValue = this.formatDateForInput(value);
                }

                // Handle picklist fields - NO ASYNC CALLS HERE
                let picklistOptions = [];
                if (col.type === 'picklist') {
                    // Check if we already have options cached
                    if (this.fieldPicklistOptions.has(key)) {
                        const allOptions = this.fieldPicklistOptions.get(key);
                        // Use the current value (which could be modified value) for selection
                        picklistOptions = allOptions.map(option => ({
                            label: option.label,
                            value: option.value,
                            selected: option.value === value
                        }));
                    }
                    // If editing and no options, we'll load them synchronously elsewhere
                }
                
                const isModified = this.isFieldModified(entryId, key);
                const cellKey = `${entryId}-${key}`;
                const isBeingEdited = this.editingCells.has(cellKey);
                
                // Build cell classes
                let cellClass = 'center-trancate-text';
                if (col.editable) {
                    cellClass += ' editable-cell';
                }
                if (isModified && !isBeingEdited) {
                    cellClass += ' modified-location-cell';
                }
                if (isBeingEdited) {
                    cellClass += ' editing-cell';
                }
                
                // Build content classes
                let contentClass = 'editable-content';

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
                    isNameField: key === 'Name',
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent',
                    isNumber: col.type === 'number',
                    isDate: col.type === 'date',
                    isPicklist: col.type === 'picklist',
                    isEditable: col.editable || false,
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
     * Method Name: get isDataAvailable
     * @description: Check if data is available to display
     */
    get isDataAvailable() {
        return this.filteredLocationEntries && this.filteredLocationEntries.length > 0;
    }

    /**
     * Method Name: get isDeleteDisabled
     * @description: Check if delete button should be disabled
     */
    get isDeleteDisabled() {
        return this.selectedRows.length === 0;
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
     * Method Name: get isAllSelected
     * @description: Check if all visible rows are selected
     */
    get isAllSelected() {
        return this.filteredLocationEntries.length > 0 && 
               this.filteredLocationEntries.every(entry => this.selectedRows.includes(entry.Id));
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
     * Method Name: get isButtonsDisabled
     * @description: Check if action buttons should be disabled
     */
    get isButtonsDisabled() {
        return !this.hasModifications || this.isSaving || this.savingLocations.size > 0;
    }

    /**
     * Method Name: get isSaveDisabled
     * @description: Check if save button should be disabled
     */
    get isSaveDisabled() {
        return !this.hasModifications || this.isSaving || this.savingLocations.size > 0;
    }

    /**
     * Method Name: get saveButtonLabel
     * @description: Get dynamic save button label
     */
    get saveButtonLabel() {
        if (this.isSaving || this.savingLocations.size > 0) {
            return 'Saving...';
        }
        if (this.hasModifications) {
            return `Save Changes (${this.modifiedProcesses.size})`;
        }
        return 'Save Changes';
    }

    /**
     * Method Name: get discardButtonTitle
     * @description: Get dynamic discard button title
     */
    get discardButtonTitle() {
        if (!this.hasModifications) {
            return 'No changes to discard';
        }
        return `Discard ${this.modifiedProcesses.size} unsaved change(s)`;
    }

    // New getters for location inline editing
    /**
     * Method Name: get isLocationButtonsDisabled
     * @description: Check if location action buttons should be disabled
     */
    get isLocationButtonsDisabled() {
        return !this.hasLocationModifications || this.isSavingLocations;
    }

    /**
     * Method Name: get isLocationSaveDisabled
     * @description: Check if location save button should be disabled
     */
    get isLocationSaveDisabled() {
        return !this.hasLocationModifications || this.isSavingLocations;
    }

    /**
     * Method Name: get locationSaveButtonLabel
     * @description: Get dynamic location save button label
     */
    get locationSaveButtonLabel() {
        if (this.isSavingLocations) {
            return 'Saving...';
        }
        if (this.hasLocationModifications) {
            return `Save Changes (${this.modifiedLocations.size})`;
        }
        return 'Save Changes';
    }

    /**
     * Method Name: get locationDiscardButtonTitle
     * @description: Get dynamic location discard button title
     */
    get locationDiscardButtonTitle() {
        if (!this.hasLocationModifications) {
            return 'No location changes to discard';
        }
        return `Discard ${this.modifiedLocations.size} unsaved location change(s)`;
    }

    /**
     * Method Name: getModifiedValue
     * @description: Get modified value for a specific field
     */
    getModifiedValue(recordId, fieldName) {
        const modifications = this.modifiedLocations.get(recordId);
        return modifications ? modifications[fieldName] : null;
    }

    /**
     * Method Name: isFieldModified
     * @description: Check if a specific field has been modified
     */
    isFieldModified(recordId, fieldName) {
        const modifications = this.modifiedLocations.get(recordId);
        return modifications && modifications.hasOwnProperty(fieldName);
    }

    /**
     * Method Name: hasProcessModificationsForLocation
     * @description: Check if specific location has process modifications
     */
    hasProcessModificationsForLocation(locationId) {
        return this.modifiedProcessesByLocation.has(locationId) && 
            this.modifiedProcessesByLocation.get(locationId).size > 0;
    }

    /**
     * Method Name: getProcessModificationCountForLocation
     * @description: Get count of modified processes for specific location
     */
    getProcessModificationCountForLocation(locationId) {
        if (!this.modifiedProcessesByLocation.has(locationId)) return 0;
        return this.modifiedProcessesByLocation.get(locationId).size;
    }

    /**
     * Method Name: getProcessSaveButtonLabelForLocation
     * @description: Get dynamic process save button label for specific location
     */
    getProcessSaveButtonLabelForLocation(locationId) {
        if (this.savingLocations.has(locationId)) {
            return 'Saving...';
        }
        const count = this.getProcessModificationCountForLocation(locationId);
        if (count > 0) {
            return `Save Changes (${count})`;
        }
        return 'Save Changes';
    }

    /**
     * Method Name: getProcessDiscardButtonTitleForLocation
     * @description: Get dynamic process discard button title for specific location
     */
    getProcessDiscardButtonTitleForLocation(locationId) {
        const count = this.getProcessModificationCountForLocation(locationId);
        if (count === 0) {
            return 'No changes to discard';
        }
        return `Discard ${count} unsaved change(s)`;
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
            let objectApiName = 'wfrecon__Location__c';
            
            // If field is from process table columns, use Location_Process__c
            const isProcessField = this.processTableColumns.some(col => col.fieldName === fieldName);
            if (isProcessField) {
                objectApiName = 'wfrecon__Location_Process__c';
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
     * Method Name: connectedCallback
     * @description: Load location entries with default sorting
     */
    connectedCallback() {
        // Initialize saving locations set if not already initialized
        if (!this.savingLocations) {
            this.savingLocations = new Set();
        }
        
        this.fetchLocationConfiguration();
    }

    /**
     * Method Name: fetchLocationConfiguration
     * @description: Fetch configuration and then load location entries
     */
    fetchLocationConfiguration() {
        getLocationConfiguration()
            .then(result => {
                if (result && result.fieldsData) {
                    try {
                        const parsedFields = JSON.parse(result.fieldsData);
                        
                        if (Array.isArray(parsedFields) && parsedFields.length > 0) {
                            this.locationColumns = parsedFields.map(field => {
                                const columnType = this.getColumnType(field.fieldType);
                                
                                return {
                                    label: field.label,
                                    fieldName: field.fieldName,
                                    type: columnType,
                                    editable: field.isEditable || false
                                };
                            });
                        } else {
                            this.locationColumns = this.defaultColumns;
                        }                        
                    } catch (error) {
                        this.locationColumns = this.defaultColumns;
                    }
                } else {
                    this.locationColumns = this.defaultColumns;
                }
    
                // Set default sorting to first column
                if (this.locationColumns.length > 0) {
                    this.sortField = this.locationColumns[0].fieldName;
                    this.sortOrder = 'asc';
                }
                
            })
            .catch(error => {
                this.locationColumns = this.defaultColumns;
                // Set default sorting
                if (this.locationColumns.length > 0) {
                    this.sortField = this.locationColumns[0].fieldName;
                    this.sortOrder = 'asc';
                }
                this.showToast('Notice', 'Using default table configuration', 'warning');
            })
            .finally(() => {
                this.fetchLocationEntries();
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
     * Method Name: handleConfigurationUpdated
     * @description: Handle configuration updated event from record config component
     */
    handleConfigurationUpdated(event) {
        // Prevent duplicate processing using timestamp
        if (event.detail.timestamp && event.detail.timestamp === this.lastConfigUpdateTimestamp) {
            return;
        }
        
        if (event.detail.success && event.detail.featureName === 'LocationEntry') {
            // Store timestamp to prevent duplicates
            this.lastConfigUpdateTimestamp = event.detail.timestamp;
            
            // Stop event propagation
            event.stopPropagation();
            
            // Refresh the configuration and reload data
            this.isLoading = true;
            this.fetchLocationConfiguration();
        }
    }

    /**
     * Method Name: fetchLocationEntries
     * @description: Fetch location entries for the job with preloaded process data
     */
    fetchLocationEntries() {
        if (!this.recordId) {
            this.isLoading = false;
            // Initialize empty arrays to ensure filter functions work
            this.locationEntries = [];
            this.filteredLocationEntries = [];
            this.locationProcessMap = new Map();
            return Promise.resolve();
        }

        return getLocationEntries({ jobId: this.recordId })
            .then(result => {
                if (result && result.success) {
                    // Ensure locationEntries is always an array
                    this.locationEntries = Array.isArray(result.locationEntries) ? result.locationEntries : [];
                    
                    // Store the preloaded process data
                    this.locationProcessMap = new Map();
                    if (result.locationProcessMap) {
                        Object.keys(result.locationProcessMap).forEach(locationId => {
                            this.locationProcessMap.set(locationId, result.locationProcessMap[locationId]);
                        });
                    }
                    
                    this.applyFilters();
                    this.isLoading = false;
                    
                    return result;
                } else {
                    // Initialize empty arrays even on failure
                    this.locationEntries = [];
                    this.filteredLocationEntries = [];
                    this.locationProcessMap = new Map();
                    this.isLoading = false;
                    throw new Error(result.error || 'Unable to load location data');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Unable to load location data. Please refresh and try again.', 'error');
                // Initialize empty arrays on error to prevent filter issues
                this.locationEntries = [];
                this.filteredLocationEntries = [];
                this.locationProcessMap = new Map();
                this.isLoading = false;
                throw error; // Re-throw to allow caller to handle
            });
    }

    /**
     * Method Name: getFieldValue
     * @description: Get field value from nested object structure
     */
    getFieldValue(record, fieldName) {
        if (!record || !fieldName) return null;
        
        if (record.hasOwnProperty(fieldName)) {
            return record[fieldName];
        }
        
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
     * @description: Apply search filters while preserving selections
     */
    applyFilters() {
        try {
            // Ensure locationEntries is always an array
            if (!Array.isArray(this.locationEntries)) {
                this.locationEntries = [];
            }

            // Don't reset sorting when applying filters, only when there's no default
            if (!this.sortField && this.tableColumns.length > 0) {
                this.sortField = this.tableColumns[0].fieldName;
                this.sortOrder = 'asc';
            }

            let filteredEntries = this.locationEntries.filter(entry => {
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

            // Store current process states
            const currentProcessStates = new Map();
            if (Array.isArray(this.filteredLocationEntries)) {
                this.filteredLocationEntries.forEach(entry => {
                    if (entry.processDetails || entry.showProcessDetails !== undefined) {
                        currentProcessStates.set(entry.Id, {
                            processDetails: entry.processDetails,
                            showProcessDetails: entry.showProcessDetails,
                            isLoadingProcesses: entry.isLoadingProcesses
                        });
                    }
                });
            }

            this.filteredLocationEntries = filteredEntries;

            // Restore process states
            this.filteredLocationEntries.forEach(entry => {
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
        } catch (error) {
            this.filteredLocationEntries = [];
        }
    }

    /**
     * Method Name: handleSliderInput
     * @description: Handle real-time slider input for visual feedback
     */
    handleSliderInput(event) {
        const newValue = parseFloat(event.target.value);
        const sliderElement = event.target;
        
        // Update visual progress in real-time
        if (sliderElement) {
            sliderElement.style.setProperty('--progress-width', `${newValue}%`);
            
            // Update the displayed percentage
            const sliderContainer = sliderElement.closest('.slider-container');
            if (sliderContainer) {
                const valueDisplay = sliderContainer.querySelector('.slider-value');
                if (valueDisplay) {
                    valueDisplay.textContent = `${newValue}%`;
                }
            }
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
     * Method Name: handleRefresh
     * @description: Refresh table data
     */
    handleRefresh() {
        this.performCompleteRefresh();
    }

    /**
     * Method Name: performCompleteRefresh
     * @description: Comprehensive refresh method that handles all business logic
     */
    performCompleteRefresh() {
        this.isLoading = true;
        this.selectedRows = [];
        
        // Clear all modifications and editing states
        this.modifiedLocations.clear();
        this.hasLocationModifications = false;
        this.modifiedProcesses.clear();
        this.modifiedProcessesByLocation.clear();
        this.hasModifications = false;
        this.editingCells.clear();
        
        // Clear saving states
        if (!this.savingLocations) {
            this.savingLocations = new Set();
        } else {
            this.savingLocations.clear();
        }
        
        // Reset sorting to defaults
        if (this.tableColumns.length > 0) {
            this.sortField = this.tableColumns[0].fieldName;
            this.sortOrder = 'asc';
        }
        
        // Clear search term
        this.searchTerm = '';
        
        // Reset field picklist options cache if needed
        this.fieldPicklistOptions.clear();
        
        // Store expanded locations for restoration after refresh
        const expandedLocationIds = this.locationEntries
            .filter(entry => entry.showProcessDetails)
            .map(entry => entry.Id);
        
        // Clear preloaded data maps to force fresh data fetch
        this.locationProcessMap.clear();
        
        // Reset process sorting to defaults
        this.processSortField = 'wfrecon__Sequence__c';
        this.processSortOrder = 'asc';
        
        // Fetch fresh data
        this.fetchLocationEntries()
            .then(() => {
                // Restore expanded state for previously expanded locations with fresh data
                if (expandedLocationIds.length > 0) {
                    this.restoreExpandedStatesWithFreshData(expandedLocationIds);
                }
                
                // Clear any highlighting
                this.clearAllHighlighting();
                
                // Update sort icons
                this.updateSortIcons();
            })
            .catch(error => {
                // Error already handled in fetchLocationEntries
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleNestedRefresh
     * @description: Handle refresh for nested process details table
     */
    handleNestedRefresh(event) {
        const locationId = event.currentTarget.dataset.locationId;
        if (!locationId) {
            return;
        }
        
        this.refreshNestedProcessDetails(locationId);
    }

    /**
     * Method Name: refreshNestedProcessDetails
     * @description: Refresh process details for a specific location using fresh data fetch
     */
    refreshNestedProcessDetails(locationId) {
        try {
            // Find the location entry
            const locationEntry = this.locationEntries.find(entry => entry.Id === locationId);
            if (!locationEntry) {
                return;
            }
            
            // Set loading state for this specific location
            locationEntry.isLoadingProcesses = true;
            
            // Clear any modifications for this location's processes
            if (this.modifiedProcessesByLocation.has(locationId)) {
                const processIds = this.modifiedProcessesByLocation.get(locationId);
                processIds.forEach(processId => {
                    this.modifiedProcesses.delete(processId);
                });
                this.modifiedProcessesByLocation.delete(locationId);
            }
            
            // Update global modifications flag
            this.hasModifications = this.modifiedProcesses.size > 0;
            
            // Clear the cached process data for this location to force fresh fetch
            this.locationProcessMap.delete(locationId);
            
            // Trigger a fetch of fresh location entries to get updated process data
            this.fetchLocationEntries()
                .then(() => {
                    // Get the fresh process data after fetchLocationEntries completes
                    const freshProcesses = this.locationProcessMap.get(locationId) || [];
                    
                    // Update the specific location with fresh processed data
                    this.filteredLocationEntries = this.filteredLocationEntries.map(entry => {
                        if (entry.Id === locationId) {
                            const updatedEntry = { ...entry };
                            
                            if (freshProcesses.length > 0) {
                                const processedDetails = this.processProcessDetailsForDisplay(freshProcesses);
                                updatedEntry.processDetails = processedDetails;
                                updatedEntry.isLoadingProcesses = false;
                            } else {
                                updatedEntry.processDetails = [];
                                updatedEntry.isLoadingProcesses = false;
                            }
                            
                            return updatedEntry;
                        }
                        return entry;
                    });
                    
                    // Also update the main locationEntries array
                    this.locationEntries = this.locationEntries.map(entry => {
                        if (entry.Id === locationId) {
                            const updatedEntry = { ...entry };
                            const freshProcesses = this.locationProcessMap.get(locationId) || [];
                            
                            if (freshProcesses.length > 0) {
                                const processedDetails = this.processProcessDetailsForDisplay(freshProcesses);
                                updatedEntry.processDetails = processedDetails;
                                updatedEntry.isLoadingProcesses = false;
                            } else {
                                updatedEntry.processDetails = [];
                                updatedEntry.isLoadingProcesses = false;
                            }
                            
                            return updatedEntry;
                        }
                        return entry;
                    });
                    
                    // Apply sorting and update displays after fresh data is loaded
                    setTimeout(() => {
                        if (this.processSortField) {
                            this.sortProcessData(locationId);
                            this.updateProcessSortIcons(locationId);
                        }
                        this.updateSliderDisplays(locationId);
                    }, 50);
                    
                    this.showToast('Success', `Process details refreshed for ${locationEntry.Name}`, 'success');
                })
                .catch(error => {
                    console.error('Error fetching fresh process data:', error);
                    locationEntry.isLoadingProcesses = false;
                    this.showToast('Error', 'Unable to refresh process details. Please try again.', 'error');
                });
            
        } catch (error) {
            console.error('Error in refreshNestedProcessDetails:', error);
            this.showToast('Error', 'Unable to refresh process details. Please try again.', 'error');
        }
    }

    /**
     * Method Name: restoreExpandedStates
     * @description: Restore expanded states for specified location IDs
     */
    restoreExpandedStates(locationIds) {
        try {
            locationIds.forEach(locationId => {
                const locationEntry = this.locationEntries.find(entry => entry.Id === locationId);
                if (locationEntry) {
                    locationEntry.showProcessDetails = true;
                    // Use preloaded process details for expanded locations with fresh data
                    const preloadedProcesses = this.locationProcessMap.get(locationId) || [];
                    
                    // Immediately refresh the process details with fresh data
                    if (preloadedProcesses.length > 0) {
                        
                        const processedDetails = this.processProcessDetailsForDisplay(preloadedProcesses);
                        
                        // Update the location entry in both arrays
                        locationEntry.processDetails = processedDetails;
                        locationEntry.isLoadingProcesses = false;
                    } else {
                        locationEntry.processDetails = [];
                        locationEntry.isLoadingProcesses = false;
                    }
                }
            });
            
            // Trigger reactivity
            this.locationEntries = [...this.locationEntries];
            this.applyFilters();
            
            // Update slider displays for all expanded locations with increased delay for fresh data
            setTimeout(() => {
                locationIds.forEach(locationId => {
                    // Apply sorting first
                    if (this.processSortField) {
                        this.sortProcessData(locationId);
                    }
                    // Then update slider displays with fresh data
                    this.updateSliderDisplays(locationId);
                });
            }, 300); // Increased delay to ensure fresh data is fully processed
        } catch (error) {
            // Error handled silently
        }
    }

    /**
     * Method Name: restoreExpandedStatesWithFreshData
     * @description: Restore expanded states with fresh process data fetch similar to sovJobScope approach
     */
    restoreExpandedStatesWithFreshData(locationIds) {
        try {
            locationIds.forEach(locationId => {
                const locationEntry = this.locationEntries.find(entry => entry.Id === locationId);
                if (locationEntry) {
                    locationEntry.showProcessDetails = true;
                    locationEntry.isLoadingProcesses = true;
                    
                    // Get fresh process details from preloaded data after fetchLocationEntries
                    const preloadedProcesses = this.locationProcessMap.get(locationId) || [];
                    
                    if (preloadedProcesses.length > 0) {
                        // Process the fresh data for display
                        const processedDetails = this.processProcessDetailsForDisplay(preloadedProcesses);
                        
                        // Update the location entry with fresh processed data
                        locationEntry.processDetails = processedDetails;
                        locationEntry.isLoadingProcesses = false;
                    } else {
                        locationEntry.processDetails = [];
                        locationEntry.isLoadingProcesses = false;
                    }
                }
            });
            
            // Trigger reactivity with fresh data
            this.locationEntries = [...this.locationEntries];
            this.applyFilters();
            
            // Update displays for all expanded locations with fresh data processing
            setTimeout(() => {
                locationIds.forEach(locationId => {
                    // Apply process sorting to fresh data
                    if (this.processSortField) {
                        this.sortProcessData(locationId);
                        this.updateProcessSortIcons(locationId);
                    }
                    // Update slider displays with fresh data
                    this.updateSliderDisplays(locationId);
                });
            }, 100); // Shorter delay since data is already fresh from fetchLocationEntries
        } catch (error) {
            console.error('Error restoring expanded states with fresh data:', error);
        }
    }

    /**
     * Method Name: handleAddLocation
     * @description: Open add location modal
     */
    handleAddLocation() {
        this.newLocation = {
            name: '',
            quantity: null,
            unitOfMeasure: ''
        };
        this.showAddModal = true;
    }

    /**
     * Method Name: handleCloseModal
     * @description: Close add location modal
     */
    handleCloseModal() {
        this.showAddModal = false;
        this.newLocation = {
            name: '',
            quantity: null,
            unitOfMeasure: ''
        };
    }

    /**
     * Method Name: handleInputChange
     * @description: Handle input changes
     */
    handleInputChange(event) {
        let field, value;
        
        // Handle lightning-combobox
        if (event.target.name) {
            field = event.target.name;
            value = event.detail.value;
        } else {
            // Handle regular input fields
            field = event.target.dataset.field;
            value = event.target.type === 'number' ? parseFloat(event.target.value) : event.target.value;
        }
        
        this.newLocation = { ...this.newLocation, [field]: value };
    }

    /**
     * Method Name: handleSaveLocation
     * @description: Save new location entry
     */
    handleSaveLocation() {

        if(this.newLocation.name.trim() === '' || this.newLocation.quantity === null || this.newLocation.unitOfMeasure.trim() === '') {
            this.showToast('Error', 'All fields are required.', 'error');
            return;
        }

        if(this.newLocation.quantity !== null && (isNaN(this.newLocation.quantity) || this.newLocation.quantity < 0)) {
            this.showToast('Error', 'Quantity must be a non-negative number.', 'error');
            return;
        }

        if (!this.newLocation.unitOfMeasure || this.newLocation.unitOfMeasure.trim() === '') {
            this.showToast('Error', 'Unit of Measure is required.', 'error');
            return;
        }

        if (!this.newLocation.name || this.newLocation.name.trim() === '') {
            this.showToast('Error', 'Name is required.', 'error');
            return;
        }

        this.isSubmitting = true;
        
        const locationData = {
            name: this.newLocation.name.trim(),
            quantity: this.newLocation.quantity,
            unitOfMeasure: this.newLocation.unitOfMeasure,
            jobId: this.recordId
        };

        createLocationEntry({ locationData })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'New location has been created successfully', 'success');
                    this.handleCloseModal();
                    this.fetchLocationEntries();
                } else {
                    this.showToast('Error', 'Unable to create location. Please try again.', 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Unable to create location. Please check your data and try again.', 'error');
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
            this.selectedRows = this.filteredLocationEntries.map(entry => entry.Id);
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
     * @description: Handle mass delete of selected locations with confirmation
     */
    handleMassDelete() {
        if (this.selectedRows.length === 0) {
            this.showToast('Notice', 'Please select at least one location to delete', 'warning');
            return;
        }

        // Show confirmation modal for deletion
        this.showDeleteConfirmation();
    }

    /**
     * Method Name: showDeleteConfirmation
     * @description: Show confirmation modal before deleting locations
     */
    showDeleteConfirmation() {
        const locationCount = this.selectedRows.length;
        this.confirmationTitle = 'Delete Locations';
        this.confirmationMessage = `Warning: This will permanently delete ${locationCount} location ${locationCount === 1 ? 'entry' : 'entries'} and all related data.`;
        this.confirmationButtonLabel = 'Delete';
        this.confirmationButtonVariant = 'destructive';
        this.confirmationAction = 'deleteLocations';
        this.confirmationData = [...this.selectedRows];
        this.showConfirmationModal = true;
    }

    /**
     * Method Name: proceedWithLocationDeletion
     * @description: Proceed with actual deletion after confirmation
     */
    proceedWithLocationDeletion(locationIds) {
        this.isLoading = true;
            
        deleteLocationEntries({ locationIds: locationIds })
            .then(result => {
                if (result.includes('Success')) {
                    const count = locationIds.length;
                    const message = count === 1 ? 'Location deleted successfully' : `${count} locations deleted successfully`;
                    this.showToast('Success', message, 'success');
                    this.selectedRows = [];
                    this.fetchLocationEntries();
                } else {
                    this.showToast('Error', 'Unable to delete selected locations. Please try again.', 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Unable to delete selected locations. Please try again.', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleToggleProcessDetails
     * @description: Toggle process details display using preloaded data
     */
    handleToggleProcessDetails(event) {
        const recordId = event.currentTarget.dataset.recordId;
        
        this.filteredLocationEntries = this.filteredLocationEntries.map(entry => {
            if (entry.Id === recordId) {
                const updatedEntry = { ...entry };
                updatedEntry.showProcessDetails = !entry.showProcessDetails;
                
                // Always load process data when opening, regardless of existing processDetails
                if (updatedEntry.showProcessDetails) {
                    const preloadedProcesses = this.locationProcessMap.get(recordId) || [];
                    
                    // Immediately update the process details instead of waiting for the updateProcessDetails method
                    if (preloadedProcesses.length > 0) {
                        // Set default process sorting to Sequence if not set
                        if (!this.processSortField) {
                            this.processSortField = 'wfrecon__Sequence__c';
                            this.processSortOrder = 'asc';
                        }
                        
                        const processedDetails = this.processProcessDetailsForDisplay(preloadedProcesses);
                        updatedEntry.processDetails = processedDetails;
                        updatedEntry.isLoadingProcesses = false;
                    } else {
                        updatedEntry.processDetails = [];
                        updatedEntry.isLoadingProcesses = false;
                    }
                }
                
                return updatedEntry;
            }
            return entry;
        });
        
        // Apply sorting after the data is loaded
        if (this.processSortField) {
            setTimeout(() => {
                this.sortProcessData(recordId);
                this.updateSliderDisplays(recordId);
            }, 0);
        } else {
            // Update slider displays even without sorting
            setTimeout(() => {
                this.updateSliderDisplays(recordId);
            }, 0);
        }
    }

    /**
     * Method Name: loadProcessDetails (DEPRECATED)
     * @description: Load process details for a specific location - now uses preloaded data
     * @deprecated: This method is no longer used since processes are preloaded
     */
    // Method kept for potential backward compatibility but should not be called
    loadProcessDetails(locationId) {
        const preloadedProcesses = this.locationProcessMap.get(locationId) || [];
        this.updateProcessDetails(locationId, preloadedProcesses);
        return Promise.resolve(preloadedProcesses);
    }

    /**
     * Method Name: updateProcessDetails
     * @description: Update process details for a specific entry
     */
    updateProcessDetails(locationId, processDetails) {
        // Set default process sorting to first column if not already set
        if (!this.processSortField && this.processTableColumns.length > 0) {
            this.processSortField = 'wfrecon__Sequence__c';
            this.processSortOrder = 'asc';
        }

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
        
        this.filteredLocationEntries = this.filteredLocationEntries.map(entry => {
            if (entry.Id === locationId) {
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
            this.updateProcessSortIcons(locationId);
        }, 0);
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
            const processId = this.getFieldValue(process, 'Id');
            row.recordUrl = `/lightning/r/${processId}/view`;
            
            row.displayFields = this.processTableColumns.map(col => {
                const key = col.fieldName;
                let value = this.getFieldValue(process, key);
                
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                
                let currencyValue = 0;
                if (col.type === 'currency') {
                    currencyValue = value !== null && value !== undefined ? parseFloat(value) : 0;
                }
    
                let percentValue = 0;
                let rawValue = 0;
                let progressStyle = '';
                if (col.type === 'percent') {
                    rawValue = value !== null && value !== undefined ? parseFloat(value) : 0;
                    percentValue = rawValue / 100;
                    progressStyle = `--progress-width: ${rawValue}%`;
                }
                
                return {
                    key,
                    value: displayValue,
                    rawValue: rawValue,
                    currencyValue: currencyValue,
                    percentValue: percentValue,
                    progressStyle: progressStyle,
                    hasValue: value !== null && value !== undefined && String(value).trim() !== '',
                    isNameField: col.isNameField || false,
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent',
                    isNumber: col.type === 'number',
                    isSlider: col.isSlider || false
                };
            });
            return row;
        });
    }

    /**
     * Method Name: handleSliderChange
     * @description: Handle completion percentage slider change - now tracks changes instead of saving immediately
     */
    handleSliderChange(event) {
        const processId = event.target.dataset.processId;
        const locationId = event.target.dataset.locationId;
        const originalValue = parseFloat(event.target.dataset.originalValue);
        const newValue = parseFloat(event.target.value);
        const sliderElement = event.target;
        
        // Update visual progress immediately
        if (sliderElement) {
            sliderElement.style.setProperty('--progress-width', `${newValue}%`);
            
            // Update the displayed percentage
            const sliderContainer = sliderElement.closest('.slider-container');
            if (sliderContainer) {
                const valueDisplay = sliderContainer.querySelector('.slider-value');
                if (valueDisplay) {
                    valueDisplay.textContent = `${newValue}%`;
                }
            }
        }
        
        // Track the modification
        if (newValue !== originalValue) {
            this.modifiedProcesses.set(processId, {
                originalValue: originalValue,
                newValue: newValue,
                locationId: locationId
            });

            // Track by location for button state
            if (!this.modifiedProcessesByLocation.has(locationId)) {
                this.modifiedProcessesByLocation.set(locationId, new Set());
            }
            this.modifiedProcessesByLocation.get(locationId).add(processId);
        } else {
            // Remove from modified if value is back to original
            this.modifiedProcesses.delete(processId);
            
            // Remove from location tracking
            if (this.modifiedProcessesByLocation.has(locationId)) {
                this.modifiedProcessesByLocation.get(locationId).delete(processId);
                if (this.modifiedProcessesByLocation.get(locationId).size === 0) {
                    this.modifiedProcessesByLocation.delete(locationId);
                }
            }
        }
        
        // Update hasModifications flag
        this.hasModifications = this.modifiedProcesses.size > 0;
        
        // Apply highlighting immediately
        this.applySliderHighlighting(processId, newValue !== originalValue);
        
        // Update the process details to reflect the change in the data model
        this.updateSliderValueInProcessDetails(locationId, processId, newValue);
    }

    /**
     * Method Name: applySliderHighlighting
     * @description: Apply highlighting to modified slider containers
     */
    applySliderHighlighting(processId, isModified) {
        // Use requestAnimationFrame for better DOM timing
        requestAnimationFrame(() => {
            const slider = this.template.querySelector(`input[data-process-id="${processId}"]`);
            if (slider) {
                const sliderContainer = slider.closest('.slider-container');
                const tableCell = slider.closest('td');
                
                if (isModified) {
                    if (sliderContainer) {
                        sliderContainer.classList.add('modified-field');
                    }
                    if (tableCell) {
                        tableCell.classList.add('modified-cell');
                    }
                } else {
                    if (sliderContainer) {
                        sliderContainer.classList.remove('modified-field');
                    }
                    if (tableCell) {
                        tableCell.classList.remove('modified-cell');
                    }
                }
            } else {
                // Slider not found for highlighting
            }
        });
    }

     /**
    * Method Name: updateSliderValueInProcessDetails
    * @description: Update the slider value in the process details data model
    */
    updateSliderValueInProcessDetails(locationId, processId, newValue) {
        this.filteredLocationEntries = this.filteredLocationEntries.map(entry => {
            if (entry.Id === locationId && entry.processDetails) {
                const updatedProcessDetails = entry.processDetails.map(process => {
                    const currentProcessId = this.getFieldValue(process, 'Id');
                    if (currentProcessId === processId) {
                        const updatedProcess = { ...process };
                        // Update the display fields to reflect the new value
                        updatedProcess.displayFields = updatedProcess.displayFields.map(field => {
                            if (field.isSlider && field.key === 'wfrecon__Completed_Percentage__c') {
                                return {
                                    ...field,
                                    rawValue: newValue,
                                    progressStyle: `--progress-width: ${newValue}%`
                                };
                            }
                            return field;
                        });
                        return updatedProcess;
                    }
                    return process;
                });
                
                return {
                    ...entry,
                    processDetails: updatedProcessDetails
                };
            }
            return entry;
        });
    }

    /**
     * Method Name: handleSaveChanges
     * @description: Save all modified processes in a single batch or for a specific location
     */
    handleSaveChanges(event) {
        // Check if this is a location-specific save
        const locationId = event.target.dataset.locationId;
        
        let processesToSave;
        let affectedLocationIds = new Set();
        
        if (locationId) {
            // Location-specific save - only save processes for this location
            if (!this.modifiedProcessesByLocation.has(locationId) || 
                this.modifiedProcessesByLocation.get(locationId).size === 0) {
                return;
            }

            // Validate changes before saving for this location
            const validationErrors = this.validateProcessChanges(locationId);
            if (validationErrors.length > 0) {
                this.showToast('Validation Error', validationErrors.join('\n'), 'error');
                return;
            }
            
            const processIdsForLocation = this.modifiedProcessesByLocation.get(locationId);
            processesToSave = new Map();
            processIdsForLocation.forEach(processId => {
                if (this.modifiedProcesses.has(processId)) {
                    processesToSave.set(processId, this.modifiedProcesses.get(processId));
                }
            });
            affectedLocationIds.add(locationId);
            
            // Set location-specific saving state
            this.savingLocations.add(locationId);
        } else {
            // Global save - save all modifications
            if (this.modifiedProcesses.size === 0) {
                return;
            }

            // Validate changes for all affected locations before saving
            const allLocationIds = new Set();
            this.modifiedProcesses.forEach(modification => {
                allLocationIds.add(modification.locationId);
            });

            let allValidationErrors = [];
            for (const locId of allLocationIds) {
                const locationErrors = this.validateProcessChanges(locId);
                allValidationErrors = allValidationErrors.concat(locationErrors);
            }

            if (allValidationErrors.length > 0) {
                this.showToast('Validation Error', allValidationErrors.join('\n'), 'error');
                return;
            }

            processesToSave = this.modifiedProcesses;
            
            // Collect all affected location IDs
            processesToSave.forEach(modification => {
                affectedLocationIds.add(modification.locationId);
                this.savingLocations.add(modification.locationId);
            });
            
            this.isSaving = true;
        }

        if (processesToSave.size === 0) {
            return;
        }
        
        // Prepare data for batch update
        const processUpdates = Array.from(processesToSave.entries()).map(([processId, modification]) => ({
            processId: processId,
            completionPercentage: modification.newValue
        }));

        // Call batch update method
        batchUpdateProcessCompletion({ processUpdates: processUpdates })
            .then(result => {
                if (result.isSuccess) {
                    const count = result.successCount;
                    const message = count === 1 ? 'Process completion updated successfully' : `${count} process completions updated successfully`;
                    this.showToast('Success', message, 'success');
                    
                    // Clear modifications for saved processes
                    if (locationId) {
                        // Location-specific save - only clear modifications for this location
                        const processIdsForLocation = this.modifiedProcessesByLocation.get(locationId);
                        processIdsForLocation.forEach(processId => {
                            this.modifiedProcesses.delete(processId);
                        });
                        this.modifiedProcessesByLocation.delete(locationId);
                    } else {
                        // Global save - clear all modifications
                        this.modifiedProcesses.clear();
                        this.modifiedProcessesByLocation.clear();
                    }
                    
                    // Update global flag
                    this.hasModifications = this.modifiedProcesses.size > 0;
                    
                    // Remove highlighting for saved processes only
                    this.clearHighlightingForLocations(affectedLocationIds);
                                        
                }
            })
            .catch(error => {
                this.showToast('Error', 'Unable to update process completion. Please try again.', 'error');
            })
            .finally(() => {
                this.performCompleteRefresh();
            });
    }

    /**
     * Method Name: handleDiscardChanges
     * @description: Discard all unsaved changes or changes for a specific location
     */
    handleDiscardChanges(event) {
        // Check if this is a location-specific discard
        const locationId = event.target.dataset.locationId;
        
        let processesToDiscard;
        if (locationId) {
            // Location-specific discard - only discard processes for this location
            if (!this.modifiedProcessesByLocation.has(locationId) || 
                this.modifiedProcessesByLocation.get(locationId).size === 0) {
                return;
            }
            
            const processIdsForLocation = this.modifiedProcessesByLocation.get(locationId);
            processesToDiscard = new Map();
            processIdsForLocation.forEach(processId => {
                if (this.modifiedProcesses.has(processId)) {
                    processesToDiscard.set(processId, this.modifiedProcesses.get(processId));
                }
            });
        } else {
            // Global discard - discard all modifications
            processesToDiscard = this.modifiedProcesses;
        }

        // Reset all sliders to original values and remove highlighting
        processesToDiscard.forEach((modification, processId) => {
            const slider = this.template.querySelector(`input[data-process-id="${processId}"]`);
            if (slider) {
                slider.value = modification.originalValue;
                slider.style.setProperty('--progress-width', `${modification.originalValue}%`);
                
                const sliderContainer = slider.closest('.slider-container');
                const tableCell = slider.closest('td');
                
                if (sliderContainer) {
                    const valueDisplay = sliderContainer.querySelector('.slider-value');
                    if (valueDisplay) {
                        valueDisplay.textContent = `${modification.originalValue}%`;
                    }
                    // Remove highlighting
                    sliderContainer.classList.remove('modified-field');
                }
                
                if (tableCell) {
                    tableCell.classList.remove('modified-cell');
                }
            }
            
            // Update the data model to reflect the original value
            this.updateSliderValueInProcessDetails(modification.locationId, processId, modification.originalValue);
        });

        // Clear modifications
        if (locationId) {
            // Location-specific discard - only clear modifications for this location
            const processIdsForLocation = this.modifiedProcessesByLocation.get(locationId);
            processIdsForLocation.forEach(processId => {
                this.modifiedProcesses.delete(processId);
            });
            this.modifiedProcessesByLocation.delete(locationId);
        } else {
            // Global discard - clear all modifications
            this.modifiedProcesses.clear();
            this.modifiedProcessesByLocation.clear();
        }
        
        // Update global flag
        this.hasModifications = this.modifiedProcesses.size > 0;
        // sovjobloc
        // Force UI refresh to update button states and slider widths
        this.filteredLocationEntries = [...this.filteredLocationEntries];
        
        // Use setTimeout to ensure DOM updates are processed before re-applying styles
        setTimeout(() => {
            // Re-apply proper slider styles after DOM refresh
            processesToDiscard.forEach((modification, processId) => {
                const slider = this.template.querySelector(`[data-process-id="${processId}"]`);
                if (slider) {
                    slider.style.setProperty('--progress-width', `${modification.originalValue}%`);
                }
            });
        }, 10);
        
        this.showToast('Success', 'Process changes have been discarded', 'success');
    }

    /**
     * Method Name: clearAllHighlighting
     * @description: Remove all highlighting from slider containers and table cells
     */
    clearAllHighlighting() {
        requestAnimationFrame(() => {
            // Remove all highlighting classes
            const allSliderContainers = this.template.querySelectorAll('.slider-container.modified-field');
            const allTableCells = this.template.querySelectorAll('td.modified-cell');
            
            allSliderContainers.forEach(container => {
                container.classList.remove('modified-field');
            });
            
            allTableCells.forEach(cell => {
                cell.classList.remove('modified-cell');
            });
        });
    }

    /**
     * Method Name: clearHighlightingForLocations
     * @description: Remove highlighting for specific locations only
     */
    clearHighlightingForLocations(locationIds) {
        requestAnimationFrame(() => {
            locationIds.forEach(locationId => {
                // Find all sliders and cells for this location
                const locationSliders = this.template.querySelectorAll(`input[data-location-id="${locationId}"]`);
                locationSliders.forEach(slider => {
                    const sliderContainer = slider.closest('.slider-container');
                    const tableCell = slider.closest('td');
                    
                    if (sliderContainer) {
                        sliderContainer.classList.remove('modified-field');
                    }
                    if (tableCell) {
                        tableCell.classList.remove('modified-cell');
                    }
                });
            });
        });
    }

    /**
     * Method Name: refreshProcessDetailsForLocations
     * @description: Refresh process details for specific locations using preloaded data
     */
    refreshProcessDetailsForLocations(locationIds) {
        locationIds.forEach(locationId => {
            const preloadedProcesses = this.locationProcessMap.get(locationId) || [];
            
            this.filteredLocationEntries = this.filteredLocationEntries.map(entry => {
                if (entry.Id === locationId && entry.showProcessDetails) {
                    const updatedEntry = { ...entry };
                    
                    if (preloadedProcesses.length > 0) {
                        const processedDetails = this.processProcessDetailsForDisplay(preloadedProcesses);
                        updatedEntry.processDetails = processedDetails;
                        updatedEntry.isLoadingProcesses = false;
                    } else {
                        updatedEntry.processDetails = [];
                        updatedEntry.isLoadingProcesses = false;
                    }
                    
                    return updatedEntry;
                }
                return entry;
            });
            
            // Update slider displays after data refresh
            setTimeout(() => {
                this.updateSliderDisplays(locationId);
            }, 100);
        });
    }

    /**
     * Method Name: handleSortClick
     * @description: Handle column header click for sorting - FIXED VERSION
     */
    handleSortClick(event) {
        try {
            const fieldName = event.currentTarget.dataset.id;
            
            if (this.sortField === fieldName) {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = fieldName;
                this.sortOrder = 'asc';
            }
            
            this.sortData();
            this.updateSortIcons();
        } catch (error) {
            // Error handled silently
        }
    }

    /**
     * Method Name: handleProcessSortClick
     * @description: Handle column header click for sorting in process table - FIXED VERSION
     */
    handleProcessSortClick(event) {
        try {
            const fieldName = event.currentTarget.dataset.id;
            const locationId = event.currentTarget.dataset.locationId;
            
            if (this.processSortField === fieldName) {
                this.processSortOrder = this.processSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                this.processSortField = fieldName;
                this.processSortOrder = 'asc';
            }
            
            this.sortProcessData(locationId);
            this.updateProcessSortIcons(locationId);
        } catch (error) {
            // Error handled silently
        }
    }

    /**
     * Method Name: sortData
     * @description: Sort the location data based on current sort field and order
     */
    sortData() {
        try {
            this.filteredLocationEntries = [...this.filteredLocationEntries].sort((a, b) => {
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
            // Error handled silently
        }
    }

    /**
     * Method Name: sortProcessData
     * @description: Sort the process data for a specific location
     */
    sortProcessData(locationId) {
        try {
            this.filteredLocationEntries = this.filteredLocationEntries.map(entry => {
                if (entry.Id === locationId && entry.processDetails) {
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
            // Error handled silently
        }
    }

    /**
     * Method Name: updateSortIcons
     * @description: Update sort icons and active states - FIXED VERSION
     */
    updateSortIcons() {
        try {
            // First clear ALL icons
            const allHeaders = this.template.querySelectorAll('.sortable-header');
            const allIcons = this.template.querySelectorAll('.sort-icon svg');
            
            allHeaders.forEach(header => {
                header.classList.remove('active-sort');
            });
            
            allIcons.forEach(icon => {
                icon.classList.remove('rotate-asc', 'rotate-desc');
            });
            
            // Then set the active one
            const currentHeaders = this.template.querySelectorAll(`[data-sort-field="${this.sortField}"]`);
            currentHeaders.forEach(header => {
                header.classList.add('active-sort');
                
                const icon = header.querySelector('.sort-icon svg');
                if (icon) {
                    icon.classList.add(this.sortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                }
            });
        } catch (error) {
            // Error handled silently
        }
    }

    /**
     * Method Name: updateProcessSortIcons
     * @description: Update process table sort icons and active states - FIXED VERSION
     */
    updateProcessSortIcons(locationId) {
        try {
            if (locationId) {
                // Clear icons for this specific location
                const locationHeaders = this.template.querySelectorAll(`th[data-location-id="${locationId}"].process-sortable-header`);
                const locationIcons = this.template.querySelectorAll(`th[data-location-id="${locationId}"] .process-sort-icon svg`);
                
                locationHeaders.forEach(header => {
                    header.classList.remove('active-sort');
                });
                
                locationIcons.forEach(icon => {
                    icon.classList.remove('rotate-asc', 'rotate-desc');
                });
                
                // Set active for this location
                const currentHeaders = this.template.querySelectorAll(`[data-process-sort-field="${this.processSortField}"][data-location-id="${locationId}"]`);
                currentHeaders.forEach(header => {
                    header.classList.add('active-sort');
                    
                    const icon = header.querySelector('.process-sort-icon svg');
                    if (icon) {
                        icon.classList.add(this.processSortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                    }
                });
            }
            else{
                // No locationId provided
            }
        } catch (error) {
            // Error handled silently
        }
    }

    /**
     * Method Name: updateSliderDisplays
     * @description: Update all slider display widths after data refresh
     */
    updateSliderDisplays(locationId) {
        try {
            setTimeout(() => {
                // Find all sliders for the specific location
                const sliders = this.template.querySelectorAll(`input[type="range"][data-location-id="${locationId}"]`);
                
                // Get the latest location entry from filtered entries
                const locationEntry = this.filteredLocationEntries.find(entry => entry.Id === locationId);
                
                if (!locationEntry || !locationEntry.processDetails) {
                    return;
                }
                
                sliders.forEach(slider => {
                    const processId = slider.dataset.processId;
                    
                    // Get the fresh value from the latest process data
                    const processDetail = locationEntry.processDetails.find(pd => this.getFieldValue(pd, 'Id') === processId);
                    if (processDetail) {
                        const percentField = processDetail.displayFields.find(field => field.key === 'wfrecon__Completed_Percentage__c');
                        if (percentField && percentField.rawValue !== undefined) {
                            const freshValue = percentField.rawValue;
                            
                            // Update the slider's actual value and attributes
                            slider.value = freshValue;
                            slider.setAttribute('data-original-value', freshValue);
                            
                            // Update the CSS custom property for progress width
                            slider.style.setProperty('--progress-width', `${freshValue}%`);
                            
                            // Update the slider value display
                            const sliderContainer = slider.closest('.slider-container');
                            if (sliderContainer) {
                                const valueDisplay = sliderContainer.querySelector('.slider-value');
                                if (valueDisplay) {
                                    valueDisplay.textContent = `${freshValue}%`;
                                }
                            }
                            
                            // Remove any modified styling since we have fresh data
                            const processRow = slider.closest('tr');
                            if (processRow) {
                                processRow.classList.remove('modified-field');
                            }
                            
                            return;
                        }
                    }
                    
                    // Fallback to existing value if fresh data not found
                    const currentValue = parseFloat(slider.value) || 0;
                    slider.style.setProperty('--progress-width', `${currentValue}%`);
                    
                    const sliderContainer = slider.closest('.slider-container');
                    if (sliderContainer) {
                        const valueDisplay = sliderContainer.querySelector('.slider-value');
                        if (valueDisplay) {
                            valueDisplay.textContent = `${currentValue}%`;
                        }
                    }
                });
            }, 200); // Sufficient delay to ensure DOM is fully updated with fresh data
            
        } catch (error) {
            // Error handled silently
        }
    }

    /**
     * Method Name: handleCellClick
     * @description: Handle cell click for inline editing with auto-focus
     */
    async handleCellClick(event) {
        const recordId = event.currentTarget.dataset.recordId;
        const fieldName = event.currentTarget.dataset.fieldName;
        const fieldType = event.currentTarget.dataset.fieldType;
        const isEditable = event.currentTarget.dataset.editable === 'true';
        
        if (!isEditable) return;
        
        const cellKey = `${recordId}-${fieldName}`;
        
        // Don't open editor if already editing this cell
        if (this.editingCells.has(cellKey)) return;

        // Load picklist options if needed
        if (fieldType === 'picklist') {
            try {
                await this.getPicklistValues(fieldName);
            } catch (error) {
                // Error handled silently
            }
        }
        
        this.editingCells.add(cellKey);
        
        // Trigger reactivity
        this.filteredLocationEntries = [...this.filteredLocationEntries];
        
        // Auto-focus the input after DOM update
        setTimeout(() => {
            const input = this.template.querySelector(`input[data-record-id="${recordId}"][data-field-name="${fieldName}"]`);
            const select = this.template.querySelector(`select[data-record-id="${recordId}"][data-field-name="${fieldName}"]`);
            const element = input || select;
            
            if (element) {
                element.focus();
                if (input) {
                    input.select(); // Select all text for easy editing
                }
            }
        }, 50);
    }

    /**
     * Method Name: handleCellInputChange
     * @description: Handle input change in inline editing
     */
    handleCellInputChange(event) {
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
        } else if (fieldType === 'date') {
            // For date fields, keep the value as string (YYYY-MM-DD format)
            // The backend will handle the conversion
        }
        
        // Get original value to compare
        const originalEntry = this.locationEntries.find(entry => entry.Id === recordId);
        const originalValue = this.getFieldValue(originalEntry, fieldName);
        
        // Track modifications
        if (!this.modifiedLocations.has(recordId)) {
            this.modifiedLocations.set(recordId, {});
        }
        
        const modifications = this.modifiedLocations.get(recordId);
        
        // Compare values properly for different types
        const areValuesEqual = (val1, val2) => {
            if (val1 === val2) return true;
            if ((val1 === null || val1 === undefined || val1 === '') && 
                (val2 === null || val2 === undefined || val2 === '')) return true;
            if (fieldType === 'number' && !isNaN(val1) && !isNaN(val2)) {
                return parseFloat(val1) === parseFloat(val2);
            }
            if (fieldType === 'date') {
                // Compare date strings
                const date1 = val1 ? new Date(val1).toISOString().split('T')[0] : '';
                const date2 = val2 ? new Date(val2).toISOString().split('T')[0] : '';
                return date1 === date2;
            }
            return false;
        };
        
        if (!areValuesEqual(newValue, originalValue)) {
            modifications[fieldName] = newValue;
        } else {
            // Remove modification if value is back to original
            delete modifications[fieldName];
            if (Object.keys(modifications).length === 0) {
                this.modifiedLocations.delete(recordId);
            }
        }
        
        // Update hasLocationModifications flag
        this.hasLocationModifications = this.modifiedLocations.size > 0;
    }

    /**
     * Method Name: handleCellInputBlur
     * @description: Handle blur event on inline edit input
     */
    handleCellInputBlur(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.fieldName;
        const cellKey = `${recordId}-${fieldName}`;
        
        // Use setTimeout to allow other events to process first
        setTimeout(() => {
            // Remove from editing set
            this.editingCells.delete(cellKey);
            
            // Trigger reactivity to show normal cell
            this.filteredLocationEntries = [...this.filteredLocationEntries];
        }, 100);
    }

    /**
     * Method Name: handleSelectChange
     * @description: Handle picklist selection change
     */
    handleSelectChange(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.fieldName;
        const fieldType = event.target.dataset.fieldType;
        const newValue = event.target.value;
        
        // Get original value to compare
        const originalEntry = this.locationEntries.find(entry => entry.Id === recordId);
        const originalValue = this.getFieldValue(originalEntry, fieldName);
        
        // Track modifications
        if (!this.modifiedLocations.has(recordId)) {
            this.modifiedLocations.set(recordId, {});
        }
        
        const modifications = this.modifiedLocations.get(recordId);
        
        if (newValue !== originalValue) {
            modifications[fieldName] = newValue;
        } else {
            // Remove modification if value is back to original
            delete modifications[fieldName];
            if (Object.keys(modifications).length === 0) {
                this.modifiedLocations.delete(recordId);
            }
        }
        
        // Update hasLocationModifications flag
        this.hasLocationModifications = this.modifiedLocations.size > 0;
    }

    /**
     * Method Name: handleCellDoubleClick
     * @description: Handle double click to start editing and load picklist options if needed
     */
    async handleCellDoubleClick(event) {
        const recordId = event.currentTarget.dataset.recordId;
        const fieldName = event.currentTarget.dataset.fieldName;
        const fieldType = event.currentTarget.dataset.fieldType;
        const cellKey = `${recordId}-${fieldName}`;
        
        // Check if cell is editable
        const column = this.tableColumns.find(col => col.fieldName === fieldName);
        if (!column || !column.editable) return;
        
        // Add to editing set
        this.editingCells.add(cellKey);
        
        // Load picklist options if this is a picklist field and we don't have options yet
        if (column && column.type === 'picklist' && !this.fieldPicklistOptions.has(fieldName)) {
            try {
                await this.getPicklistValues(fieldName);
                // Force a re-render to show the picklist with options
                this.filteredLocationEntries = [...this.filteredLocationEntries];
            } catch (error) {
                // Error handled silently
            }
        }
        
        // Trigger reactivity to show editing cell
        this.filteredLocationEntries = [...this.filteredLocationEntries];
        
        // Focus the input after a brief delay
        setTimeout(() => {
            const input = this.template.querySelector(`[data-record-id="${recordId}"][data-field-name="${fieldName}"]`);
            if (input) {
                input.focus();
                if (input.type === 'text' || input.type === 'number') {
                    input.select();
                }
            }
        }, 50);
    }

    /**
     * Method Name: validateLocationChanges
     * @description: Validate location entry modifications before saving
     */
    validateLocationChanges() {
        const errors = [];
        
        for (const [recordId, changes] of this.modifiedLocations.entries()) {
            const entry = this.locationEntries.find(e => e.Id === recordId);
            const entryName = entry ? entry.Name : recordId;
            
            for (const [fieldName, value] of Object.entries(changes)) {
                // Get field metadata to determine validation rules
                const column = this.tableColumns.find(col => col.fieldName === fieldName);
                
                if (column) {
                    
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
     * Method Name: validateProcessChanges
     * @description: Validate process entry modifications before saving
     */
    validateProcessChanges(locationId) {
        const errors = [];
        
        if (!this.modifiedProcessesByLocation.has(locationId)) {
            return errors;
        }
        
        const processIdsToValidate = this.modifiedProcessesByLocation.get(locationId);
        
        for (const processId of processIdsToValidate) {
            const modificationEntry = this.modifiedProcesses.get(processId);
            if (!modificationEntry) continue;
            
            const location = this.locationEntries.find(l => l.Id === locationId);
            const locationName = location ? location.Name : locationId;
            
            // For process completion percentage validation (slider values)
            if (modificationEntry.fieldName === 'wfrecon__Completed_Percentage__c') {
                const value = modificationEntry.newValue;
                
                // Check for empty, null, undefined values
                if (value === null || value === undefined || value === '' || 
                    (typeof value === 'string' && value.trim() === '')) {
                    errors.push(`${locationName} - Process Completion: Field cannot be empty`);
                }
                else {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        // Check for negative numbers
                        if (numValue < 0) {
                            errors.push(`${locationName} - Process Completion: Negative values are not allowed`);
                        }
                        
                        // Check for values over 100% for percentage fields
                        if (numValue > 100) {
                            errors.push(`${locationName} - Process Completion: Percentage cannot exceed 100%`);
                        }
                        
                        // Check if number has more than 2 decimal places
                        const decimalPart = numValue.toString().split('.')[1];
                        if (decimalPart && decimalPart.length > 2) {
                            errors.push(`${locationName} - Process Completion: Percentage cannot have more than 2 decimal places (current: ${decimalPart.length})`);
                        }
                    }
                }
            }
        }
        
        return errors;
    }

    /**
     * Method Name: handleSaveLocationChanges
     * @description: Save all modified location entries in a single batch
     */
    handleSaveLocationChanges() {
        if (this.modifiedLocations.size === 0) {
            return;
        }

        // Validate changes before saving
        const validationErrors = this.validateLocationChanges();
        if (validationErrors.length > 0) {
            this.showToast('Validation Error', validationErrors.join('\n'), 'error');
            return;
        }

        this.isSavingLocations = true;

        
        // Prepare data for batch update
        const updatedLocations = [];
        
        this.modifiedLocations.forEach((modifications, recordId) => {
            const locationUpdate = { Id: recordId };
            Object.keys(modifications).forEach(fieldName => {
                locationUpdate[fieldName] = modifications[fieldName];
            });
            updatedLocations.push(locationUpdate);
        });

        // Call batch update method
        const updatedLocationsJson = JSON.stringify(updatedLocations);
        
        saveInlineEdits({ updatedLocationsJson: updatedLocationsJson })
            .then(result => {
                if (result.startsWith('Success')) {
                    const count = this.modifiedLocations.size;
                    const message = count === 1 ? 'Location updated successfully' : `${count} locations updated successfully`;
                    this.showToast('Success', message, 'success');
                } else if (result.startsWith('Partial Success')) {
                    this.showToast('Warning', 'Some locations were updated, but others failed. Please check and try again.', 'warning');
                } else {
                    this.showToast('Error', 'Unable to update locations. Please try again.', 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Something went wrong while updating locations. Please try again.', 'error');
            })
            .finally(() => {
                this.isSavingLocations = false;
                this.performCompleteRefresh();
            });
    }

    /**
     * Method Name: handleDiscardLocationChanges
     * @description: Discard all unsaved location changes
     */
    handleDiscardLocationChanges() {
        // Clear all modifications
        this.modifiedLocations.clear();
        this.hasLocationModifications = false;
        this.editingCells.clear();
        
        // Trigger reactivity to remove highlighting and reset values
        this.filteredLocationEntries = [...this.filteredLocationEntries];
        
        this.showToast('Success', 'Location changes have been discarded', 'success');
    }

    /**
     * Method Name: handleConfirmationConfirm
     * @description: Handle confirmation modal confirm action
     */
    handleConfirmationConfirm() {
        try {
            switch (this.confirmationAction) {
                case 'deleteLocations':
                    this.showConfirmationModal = false;
                    this.proceedWithLocationDeletion(this.confirmationData);
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

    /**
     * Method Name: handleConfirmationCancel
     * @description: Handle confirmation modal cancel action
     */
    handleConfirmationCancel() {
        this.showConfirmationModal = false;
        this.resetConfirmationState();
    }

    /**
     * Method Name: handleConfirmationClose
     * @description: Handle confirmation modal close action
     */
    handleConfirmationClose() {
        this.showConfirmationModal = false;
        this.resetConfirmationState();
    }

    /**
     * Method Name: resetConfirmationState
     * @description: Reset confirmation modal state
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