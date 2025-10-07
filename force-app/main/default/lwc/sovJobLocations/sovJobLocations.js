import { LightningElement, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getLocationEntries from '@salesforce/apex/SovJobLocationsController.getLocationEntries';
import createLocationEntry from '@salesforce/apex/SovJobLocationsController.createLocationEntry';
import deleteLocationEntries from '@salesforce/apex/SovJobLocationsController.deleteLocationEntries';
import getLocationProcesses from '@salesforce/apex/SovJobLocationsController.getLocationProcesses';
import getLocationConfiguration from '@salesforce/apex/SovJobLocationsController.getLocationConfiguration';
import saveInlineEdits from '@salesforce/apex/SovJobLocationsController.saveInlineEdits';
import batchUpdateProcessCompletion from '@salesforce/apex/SovJobLocationProcessesController.batchUpdateProcessCompletion';

export default class SovJobLocations extends NavigationMixin(LightningElement) {
    @track recordId;
    @track isLoading = true;
    @track locationEntries = [];
    @track filteredLocationEntries = [];
    @track searchTerm = '';
    @track selectedRows = [];
    @track locationColumns = [];
    @track lastConfigUpdateTimestamp = 0;

    // Sorting properties
    @track sortField = '';
    @track sortOrder = '';
    @track processSortField = '';
    @track processSortOrder = '';

    // Inline editing properties
    @track modifiedLocations = new Map(); // Track modified location entries
    @track hasLocationModifications = false; // Track if there are unsaved location changes
    @track isSavingLocations = false; // Track save operation for locations
    @track editingCells = new Set(); // Track which cells are currently being edited

    // Default table columns
    @track defaultColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text', editable: true },
        { label: 'Square Feet', fieldName: 'wfrecon__Square_Feet__c', type: 'number', editable: true },
        { label: 'Crack Count', fieldName: 'wfrecon__Crack_Count__c', type: 'number', editable: true },
        { label: 'Distressed Edge', fieldName: 'wfrecon__Distressed_Edge__c', type: 'number', editable: true },
        { label: 'Distressed Joint LF', fieldName: 'wfrecon__Distressed_Joint_LF__c', type: 'number', editable: true },
        { label: 'Misc Defect Count', fieldName: 'wfrecon__Misc_Defect_Count__c', type: 'number', editable: true }
    ];

    // Process table columns configuration
    @track processTableColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text', isNameField: true },
        { label: 'Sequence', fieldName: 'wfrecon__Sequence__c', type: 'number' },
        { label: 'Contract Price', fieldName: 'wfrecon__Contract_Price__c', type: 'currency' },
        { label: 'Completed %', fieldName: 'wfrecon__Completed_Percentage__c', type: 'percent', isSlider: true },
        { label: 'Current Completed Value', fieldName: 'wfrecon__Current_Completed_Value__c', type: 'currency' },
        { label: 'Process Status', fieldName: 'wfrecon__Process_Status__c', type: 'text' }
    ];

    // Modal properties
    @track showAddModal = false;
    @track isSubmitting = false;
    @track newLocation = {
        name: '',
        squareFeet: null,
        crackCount: null,
        distressedEdge: null,
        distressedJoint: null,
        miscDefectCount: null,
        cureTimeDays: null
    };

    @track modifiedProcesses = new Map(); // Track modified processes across all locations
    @track hasModifications = false; // Track if there are unsaved changes
    @track isSaving = false; // Track save operation

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
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
            
            row.displayFields = cols.map(col => {
                const key = col.fieldName;
                let value = this.getFieldValue(entry, key);
                
                // Check if this field has been modified
                const modifiedValue = this.getModifiedValue(entry.Id, key);
                if (modifiedValue !== null && modifiedValue !== undefined) {
                    value = modifiedValue;
                }
                
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                
                return {
                    key,
                    value: displayValue,
                    rawValue: value,
                    hasValue: value !== null && value !== undefined && String(value).trim() !== '',
                    isNameField: key === 'Name',
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent',
                    isNumber: col.type === 'number', // FIX: This should match the column type
                    isEditable: col.editable || false, // FIX: This should use the column's editable property
                    isModified: this.isFieldModified(entry.Id, key) ? 'true' : 'false',
                    isBeingEdited: this.editingCells.has(`${entry.Id}-${key}`)
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
     * Method Name: get nameCharacterCount
     * @description: Get current character count for name field
     */
    get nameCharacterCount() {
        return this.newLocation.name ? this.newLocation.name.length : 0;
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
     * Method Name: get isButtonsDisabled
     * @description: Check if action buttons should be disabled
     */
    get isButtonsDisabled() {
        return !this.hasModifications || this.isSaving;
    }

    /**
     * Method Name: get isSaveDisabled
     * @description: Check if save button should be disabled
     */
    get isSaveDisabled() {
        return !this.hasModifications || this.isSaving;
    }

    /**
     * Method Name: get saveButtonLabel
     * @description: Get dynamic save button label
     */
    get saveButtonLabel() {
        if (this.isSaving) {
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
            return `Save Location Changes (${this.modifiedLocations.size})`;
        }
        return 'Save Location Changes';
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
     * Method Name: connectedCallback
     * @description: Load location entries with default sorting
     */
    connectedCallback() {
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

                        console.log('Parsed location configuration:', parsedFields);
                        
                        
                        if (Array.isArray(parsedFields) && parsedFields.length > 0) {
                            this.locationColumns = parsedFields.map(field => ({
                                label: field.label,
                                fieldName: field.fieldName,
                                type: this.getColumnType(field.fieldType),
                                editable: field.isEditable || false // ADD THIS LINE
                            }));
                        } else {
                            this.locationColumns = this.defaultColumns;
                        }
                    } catch (error) {
                        console.error('Error parsing location configuration:', error);
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
                console.error('Error fetching configuration:', error);
                this.locationColumns = this.defaultColumns;
                // Set default sorting
                if (this.locationColumns.length > 0) {
                    this.sortField = this.locationColumns[0].fieldName;
                    this.sortOrder = 'asc';
                }
                this.showToast('Warning', 'Using default configuration due to error', 'warning');
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
        
        if (event.detail.success && event.detail.featureName === 'LocationEntry') {
            // Store timestamp to prevent duplicates
            this.lastConfigUpdateTimestamp = event.detail.timestamp;
            
            console.log('Processing configuration update...');
            
            // Stop event propagation
            event.stopPropagation();
            
            // Refresh the configuration and reload data
            this.isLoading = true;
            this.fetchLocationConfiguration();
        }
    }

    /**
     * Method Name: fetchLocationEntries
     * @description: Fetch location entries for the job
     */
    fetchLocationEntries() {
        if (!this.recordId) {
            this.isLoading = false;
            return;
        }

        getLocationEntries({ jobId: this.recordId })
            .then(result => {
                this.locationEntries = result || [];
                this.applyFilters();
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error fetching location entries:', error);
                this.showToast('Error', 'Error fetching location entries: ' + (error.body?.message || error.message), 'error');
                this.locationEntries = [];
                this.filteredLocationEntries = [];
                this.isLoading = false;
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
            // Don't reset sorting when applying filters, only when there's no default
            if (!this.sortField && this.tableColumns.length > 0) {
                this.sortField = this.tableColumns[0].fieldName;
                this.sortOrder = 'asc';
            }

            let filteredEntries = this.locationEntries.filter(entry => {
                if (!this.searchTerm) return true;
                
                const searchLower = this.searchTerm.toLowerCase();
                
                const searchInObject = (obj, visited = new Set()) => {
                    if (!obj || typeof obj !== 'object' || visited.has(obj)) return false;
                    visited.add(obj);
                    
                    for (let key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            const value = obj[key];
                            if (value !== null && value !== undefined) {
                                if (typeof value === 'string' && value.toLowerCase().includes(searchLower)) {
                                    return true;
                                } else if (typeof value === 'number' && value.toString().includes(searchLower)) {
                                    return true;
                                } else if (typeof value === 'object') {
                                    if (searchInObject(value, visited)) return true;
                                }
                            }
                        }
                    }
                    return false;
                };
                
                return searchInObject(entry);
            });

            // Store current process states
            const currentProcessStates = new Map();
            this.filteredLocationEntries.forEach(entry => {
                if (entry.processDetails || entry.showProcessDetails !== undefined) {
                    currentProcessStates.set(entry.Id, {
                        processDetails: entry.processDetails,
                        showProcessDetails: entry.showProcessDetails,
                        isLoadingProcesses: entry.isLoadingProcesses
                    });
                }
            });

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
            console.error('Error applying filters:', error);
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
        this.isLoading = true;
        this.selectedRows = [];
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
        this.fetchLocationEntries();
    }

    /**
     * Method Name: handleAddLocation
     * @description: Open add location modal
     */
    handleAddLocation() {
        this.newLocation = {
            name: '',
            squareFeet: null,
            crackCount: null,
            distressedEdge: null,
            distressedJoint: null,
            miscDefectCount: null,
            cureTimeDays: null
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
            squareFeet: null,
            crackCount: null,
            distressedEdge: null,
            distressedJoint: null,
            miscDefectCount: null,
            cureTimeDays: null
        };
    }

    /**
     * Method Name: handleInputChange
     * @description: Handle input changes
     */
    handleInputChange(event) {
        const field = event.target.dataset.field;
        let value = event.target.type === 'number' ? parseFloat(event.target.value) : event.target.value;
        
        this.newLocation = { ...this.newLocation, [field]: value };
    }

    /**
     * Method Name: validateLocation
     * @description: Validate location form data
     */
    validateLocation() {
        const { name, squareFeet } = this.newLocation;
        
        if (!name || name.trim() === '') {
            return { isValid: false, message: 'Name is required' };
        }
        
        if (!squareFeet || squareFeet <= 0) {
            return { isValid: false, message: 'Square Feet is required and must be greater than 0' };
        }
        
        return { isValid: true, message: '' };
    }

    /**
     * Method Name: handleSaveLocation
     * @description: Save new location entry
     */
    handleSaveLocation() {
        const validation = this.validateLocation();
        if (!validation.isValid) {
            this.showToast('Error', validation.message, 'error');
            return;
        }

        this.isSubmitting = true;
        
        const locationData = {
            name: this.newLocation.name.trim(),
            squareFeet: this.newLocation.squareFeet,
            crackCount: this.newLocation.crackCount || 0,
            distressedEdge: this.newLocation.distressedEdge || 0,
            distressedJoint: this.newLocation.distressedJoint || 0,
            miscDefectCount: this.newLocation.miscDefectCount || 0,
            cureTimeDays: this.newLocation.cureTimeDays || 0,
            jobId: this.recordId
        };

        createLocationEntry({ locationData })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Location created successfully', 'success');
                    this.handleCloseModal();
                    this.fetchLocationEntries();
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to create location: ' + (error.body?.message || error.message), 'error');
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
     * @description: Handle mass delete of selected locations
     */
    handleMassDelete() {
        if (this.selectedRows.length === 0) {
            this.showToast('Warning', 'Please select at least one record to delete', 'warning');
            return;
        }

        this.isLoading = true;
            
        deleteLocationEntries({ locationIds: this.selectedRows })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', `${this.selectedRows.length} record(s) deleted successfully`, 'success');
                    this.selectedRows = [];
                    this.fetchLocationEntries();
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
     * Method Name: handleToggleProcessDetails
     * @description: Toggle process details display and load data if needed
     */
    handleToggleProcessDetails(event) {
        const recordId = event.currentTarget.dataset.recordId;
        
        this.filteredLocationEntries = this.filteredLocationEntries.map(entry => {
            if (entry.Id === recordId) {
                const updatedEntry = { ...entry };
                updatedEntry.showProcessDetails = !entry.showProcessDetails;
                
                if (updatedEntry.showProcessDetails && !updatedEntry.processDetails) {
                    updatedEntry.isLoadingProcesses = true;
                    this.loadProcessDetails(recordId);
                }
                
                return updatedEntry;
            }
            return entry;
        });
    }

    /**
     * Method Name: loadProcessDetails
     * @description: Load process details for a specific location
     */
    loadProcessDetails(locationId) {
        getLocationProcesses({ locationId: locationId })
            .then(result => {
                this.updateProcessDetails(locationId, result || []);
            })
            .catch(error => {
                console.error('Error loading process details:', error);
                this.updateProcessDetails(locationId, []);
                this.showToast('Error', 'Failed to load process details: ' + (error.body?.message || error.message), 'error');
            });
    }

    /**
     * Method Name: updateProcessDetails
     * @description: Update process details for a specific entry
     */
    updateProcessDetails(locationId, processDetails) {
        // Set default process sorting to first column if not already set
        if (!this.processSortField && this.processTableColumns.length > 0) {
            this.processSortField = this.processTableColumns[0].fieldName;
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
            row.recordUrl = `/lightning/r/${process.Id}/view`;
            
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
                    // Add progress style for slider visual
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
        } else {
            // Remove from modified if value is back to original
            this.modifiedProcesses.delete(processId);
        }
        
        // Update hasModifications flag
        this.hasModifications = this.modifiedProcesses.size > 0;
        
        // Apply highlighting immediately
        this.applySliderHighlighting(processId, newValue !== originalValue);
    }

    /**
     * Method Name: applySliderHighlighting
     * @description: Apply highlighting to modified slider containers
     */
    applySliderHighlighting(processId, isModified) {
        setTimeout(() => {
            const slider = this.template.querySelector(`[data-process-id="${processId}"]`);
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
            }
        }, 0);
    }

    /**
     * Method Name: handleEditRecord
     * @description: Handle edit record action
     */
    handleEditRecord(event) {
        const recordId = event.currentTarget.dataset.recordId;
        
        console.log('Edit record action for ID:', recordId);
        
    }

    /**
     * Method Name: handleSaveChanges
     * @description: Save all modified processes in a single batch
     */
    handleSaveChanges() {
        if (this.modifiedProcesses.size === 0) {
            return;
        }

        this.isSaving = true;
        
        // Prepare data for batch update
        const processUpdates = Array.from(this.modifiedProcesses.entries()).map(([processId, modification]) => ({
            processId: processId,
            completionPercentage: modification.newValue
        }));

        // Call batch update method
        batchUpdateProcessCompletion({ processUpdates: processUpdates })
            .then(result => {
                if (result.isSuccess) {
                    this.showToast('Success', `${result.successCount} process(es) updated successfully`, 'success');
                    
                    // Get all affected location IDs
                    const affectedLocationIds = new Set();
                    this.modifiedProcesses.forEach(modification => {
                        affectedLocationIds.add(modification.locationId);
                    });
                    
                    // Clear modifications and refresh data
                    this.modifiedProcesses.clear();
                    this.hasModifications = false;
                    
                    // Remove all highlighting immediately
                    this.clearAllHighlighting();
                    
                    // Reload process details for affected locations
                    affectedLocationIds.forEach(locationId => {
                        this.loadProcessDetails(locationId);
                    });
                    
                } else {
                    let errorMessage = result.message;
                    if (result.errorDetails && result.errorDetails.length > 0) {
                        errorMessage += '\nDetails: ' + result.errorDetails.join(', ');
                    }
                    this.showToast('Error', errorMessage, 'error');
                    
                    // If some succeeded, refresh to show current state
                    if (result.successCount > 0) {
                        const affectedLocationIds = new Set();
                        this.modifiedProcesses.forEach(modification => {
                            affectedLocationIds.add(modification.locationId);
                        });
                        
                        this.modifiedProcesses.clear();
                        this.hasModifications = false;
                        this.clearAllHighlighting();
                        
                        affectedLocationIds.forEach(locationId => {
                            this.loadProcessDetails(locationId);
                        });
                    }
                }
            })
            .catch(error => {
                console.error('Error in batch update:', error);
                this.showToast('Error', 'Failed to update processes: ' + (error.body?.message || error.message), 'error');
            })
            .finally(() => {
                this.isSaving = false;
            });
    }

    /**
     * Method Name: handleDiscardChanges
     * @description: Discard all unsaved changes
     */
    handleDiscardChanges() {
        // Reset all sliders to original values and remove highlighting
        this.modifiedProcesses.forEach((modification, processId) => {
            const slider = this.template.querySelector(`[data-process-id="${processId}"]`);
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
        });

        // Clear modifications
        this.modifiedProcesses.clear();
        this.hasModifications = false;
        
        this.showToast('Success', 'Changes discarded', 'success');
    }

    /**
     * Method Name: clearAllHighlighting
     * @description: Remove all highlighting from slider containers and table cells
     */
    clearAllHighlighting() {
        setTimeout(() => {
            // Remove all highlighting classes
            const allSliderContainers = this.template.querySelectorAll('.slider-container.modified-field');
            const allTableCells = this.template.querySelectorAll('td.modified-cell');
            
            allSliderContainers.forEach(container => {
                container.classList.remove('modified-field');
            });
            
            allTableCells.forEach(cell => {
                cell.classList.remove('modified-cell');
            });
        }, 0);
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
            console.error('Error in handleSortClick:', error);
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
            console.error('Error in handleProcessSortClick:', error);
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
            console.error('Error in sortData:', error);
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
            console.error('Error in sortProcessData:', error);
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
            console.error('Error in updateSortIcons:', error);
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

                console.log('locationHeaders:', locationHeaders);
                console.log('locationIcons:', locationIcons);
                
                
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
                console.log('NO locationId provided to updateProcessSortIcons');
                
            }
        } catch (error) {
            console.error('Error in updateProcessSortIcons:', error);
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
     * Method Name: handleCellClick
     * @description: Handle cell click for inline editing
     */
    handleCellClick(event) {
        const recordId = event.currentTarget.dataset.recordId;
        const fieldName = event.currentTarget.dataset.fieldName;
        const isEditable = event.currentTarget.dataset.editable === 'true';
        
        if (!isEditable) return;
        
        const cellKey = `${recordId}-${fieldName}`;
        
        // Don't open editor if already editing this cell
        if (this.editingCells.has(cellKey)) return;
        
        this.editingCells.add(cellKey);
        
        // Trigger reactivity
        this.filteredLocationEntries = [...this.filteredLocationEntries];
        
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
        }
        
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
     * Method Name: handleCellInputBlur
     * @description: Handle blur event on inline edit input
     */
    handleCellInputBlur(event) {
        const recordId = event.target.dataset.recordId;
        const fieldName = event.target.dataset.fieldName;
        const cellKey = `${recordId}-${fieldName}`;
        
        // Remove from editing set
        this.editingCells.delete(cellKey);
        
        // Trigger reactivity to show normal cell
        this.filteredLocationEntries = [...this.filteredLocationEntries];
    }

    /**
     * Method Name: handleSaveLocationChanges
     * @description: Save all modified location entries in a single batch
     */
    handleSaveLocationChanges() {
        if (this.modifiedLocations.size === 0) {
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
                    this.showToast('Success', result, 'success');
                    
                    // Clear modifications and refresh data
                    this.modifiedLocations.clear();
                    this.hasLocationModifications = false;
                    this.editingCells.clear();
                    
                    // Refresh location entries
                    this.fetchLocationEntries();
                    
                } else if (result.startsWith('Partial Success')) {
                    this.showToast('Warning', result, 'warning');
                    
                    // Partial success - still clear and refresh
                    this.modifiedLocations.clear();
                    this.hasLocationModifications = false;
                    this.editingCells.clear();
                    this.fetchLocationEntries();
                    
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                console.error('Error in location batch update:', error);
                this.showToast('Error', 'Failed to update locations: ' + (error.body?.message || error.message), 'error');
            })
            .finally(() => {
                this.isSavingLocations = false;
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
        
        this.showToast('Success', 'Location changes discarded', 'success');
    }
}