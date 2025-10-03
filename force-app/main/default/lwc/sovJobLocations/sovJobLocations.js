import { LightningElement, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getLocationEntries from '@salesforce/apex/SovJobLocationsController.getLocationEntries';
import createLocationEntry from '@salesforce/apex/SovJobLocationsController.createLocationEntry';
import deleteLocationEntries from '@salesforce/apex/SovJobLocationsController.deleteLocationEntries';
import getLocationProcesses from '@salesforce/apex/SovJobLocationsController.getLocationProcesses';
import updateProcessCompletion from '@salesforce/apex/SovJobLocationsController.updateProcessCompletion';

export default class SovJobLocations extends NavigationMixin(LightningElement) {
    @track recordId;
    @track isLoading = true;
    @track locationEntries = [];
    @track filteredLocationEntries = [];
    @track searchTerm = '';
    @track selectedRows = [];
    @track accordionStyleApplied = false;

    // Default table columns
    @track defaultColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Square Feet', fieldName: 'wfrecon__Square_Feet__c', type: 'number' },
        { label: 'Crack Count', fieldName: 'wfrecon__Crack_Count__c', type: 'number' },
        { label: 'Distressed Edge', fieldName: 'wfrecon__Distressed_Edge__c', type: 'number' },
        { label: 'Distressed Joint LF', fieldName: 'wfrecon__Distressed_Joint_LF__c', type: 'number' },
        { label: 'Misc Defect Count', fieldName: 'wfrecon__Misc_Defect_Count__c', type: 'number' }
    ];

    // Process table columns configuration
    @track processTableColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text', isNameField: true },
        { label: 'Contract Price', fieldName: 'wfrecon__Contract_Price__c', type: 'currency' },
        { label: 'Completed %', fieldName: 'wfrecon__Completed_Percentage__c', type: 'percent', isSlider: true },
        { label: 'Current Completed Value', fieldName: 'wfrecon__Current_Completed_Value__c', type: 'currency' },
        { label: 'Process Status', fieldName: 'wfrecon__Process_Status__c', type: 'text' },
        { label: 'Sequence', fieldName: 'wfrecon__Sequence__c', type: 'number' }
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
        miscDefectCount: null
    };

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
    }

    /**
     * Method Name: get tableColumns
     * @description: Get table columns configuration
     */
    get tableColumns() {
        return this.defaultColumns;
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
                
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                
                return {
                    key,
                    value: displayValue,
                    rawValue: value,
                    hasValue: value !== null && value !== undefined && String(value).trim() !== '',
                    isNameField: key === 'Name',
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent',
                    isNumber: col.type === 'number'
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
     * Method Name: connectedCallback
     * @description: Load location entries
     */
    connectedCallback() {
        this.fetchLocationEntries();
    }

    renderedCallback() {
        if (!this.accordionStyleApplied) {
            this.applyAccordionStyling();
        }
    }

    applyAccordionStyling() {
        try {
            const style = document.createElement('style');
            style.textContent = `
                .accordion-container .section-control {
                    background: #3396e5 !important;
                    color: white !important;
                    margin-bottom: 4px;
                    --slds-c-icon-color-foreground-default: #ffffff !important;
                }
            `;
            
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
        } catch (error) {
            console.error('Error applying filters:', error);
            this.filteredLocationEntries = [];
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
            miscDefectCount: null
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
            miscDefectCount: null
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
        const processedDetails = this.processProcessDetailsForDisplay(processDetails);
        
        this.filteredLocationEntries = this.filteredLocationEntries.map(entry => {
            if (entry.Id === locationId) {
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
                if (col.type === 'percent') {
                    percentValue = value !== null && value !== undefined ? parseFloat(value) / 100 : 0;
                }
                
                return {
                    key,
                    value: displayValue,
                    rawValue: value,
                    currencyValue: currencyValue,
                    percentValue: percentValue,
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
     * @description: Handle completion percentage slider change
     */
    handleSliderChange(event) {
        const processId = event.target.dataset.processId;
        const newValue = parseFloat(event.target.value);
        
        updateProcessCompletion({ processId: processId, completionPercentage: newValue })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Process completion updated successfully', 'success');
                    // Optionally refresh the specific location's process details
                    const locationId = event.target.dataset.locationId;
                    if (locationId) {
                        this.loadProcessDetails(locationId);
                    }
                } else {
                    this.showToast('Error', result, 'error');
                    // Revert the slider value on error
                    event.target.value = event.target.dataset.originalValue;
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to update process completion: ' + (error.body?.message || error.message), 'error');
                // Revert the slider value on error
                event.target.value = event.target.dataset.originalValue;
            });
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