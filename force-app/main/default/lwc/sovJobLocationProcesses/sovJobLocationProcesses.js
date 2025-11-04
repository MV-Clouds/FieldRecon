import { LightningElement, api, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getJobLocationProcesses from '@salesforce/apex/SovJobLocationProcessesController.getJobLocationProcesses';
import batchUpdateProcessCompletion from '@salesforce/apex/SovJobLocationProcessesController.batchUpdateProcessCompletion';

export default class SovJobLocationProcesses extends NavigationMixin(LightningElement) {
    // Permission data received from parent component
    @api permissionData = {
        isReadOnly: false,
        isFullAccess: false
    };

    @track recordId;
    @track isLoading = true;
    @track locationProcesses = [];
    @track filteredProcesses = [];
    @track searchTerm = '';
    @track sortField = '';
    @track sortOrder = '';
    @track modifiedProcesses = new Map(); // Track modified processes
    @track hasModifications = false; // Track if there are unsaved changes
    @track isSaving = false; // Track save operation
    @track isUpdatingDOM = false; // Track when DOM is being updated

    // Process table columns configuration - will be built dynamically
    @track processTableColumns = [];

    // Permission-based computed properties
    /**
     * Method Name: get hasAnyAccess
     * @description: Check if user has any access (view or edit)
     */
    get hasAnyAccess() {
        return this.permissionData && (
            this.permissionData.isFullAccess ||
            this.permissionData.isReadOnly
        );
    }

    /**
     * Method Name: get canEdit
     * @description: Check if user can edit records
     */
    get canEdit() {
        return this.permissionData && this.permissionData.isFullAccess;
    }

    /**
     * Method Name: get isReadOnlyMode
     * @description: Check if user is in read-only mode
     */
    get isReadOnlyMode() {
        return !this.canEdit;
    }

    /**
     * Method Name: get activeProcessTableColumns
     * @description: Get process table columns based on permissions (hide slider if no access)
     */
    get activeProcessTableColumns() {
        const baseColumns = [
            { label: 'Name', fieldName: 'Name', type: 'text', isNameField: true, sortable: true },
            { label: 'Location Name', fieldName: 'wfrecon__Location__r.Name', type: 'text', isLocationField: true, sortable: true },
            { label: 'Sequence', fieldName: 'wfrecon__Sequence__c', type: 'number', sortable: true },
            { label: 'Contract Price', fieldName: 'wfrecon__Contract_Price__c', type: 'currency', sortable: true }
        ];

        // Only include the slider column if user has edit access
        if (this.canEdit) {
            baseColumns.push({ 
                label: 'Completed Percentage', 
                fieldName: 'wfrecon__Completed_Percentage__c', 
                type: 'percent', 
                isSlider: true, 
                sortable: false
            });
        }

        baseColumns.push(
            { label: 'Current Completed Value', fieldName: 'wfrecon__Current_Completed_Value__c', type: 'currency', sortable: true },
            { label: 'Process Status', fieldName: 'wfrecon__Process_Status__c', type: 'text', sortable: true }
        );

        return baseColumns;
    }

    /**
     * Method Name: get displayedProcesses
     * @description: Process location processes for table display
     */
    get displayedProcesses() {
        if (!this.filteredProcesses || this.filteredProcesses.length === 0) {
            return [];
        }

        return this.filteredProcesses.map(locationProcess => {
            const row = { ...locationProcess };
            row.recordUrl = `/lightning/r/${locationProcess.Id}/view`;
            row.locationUrl = `/lightning/r/${locationProcess.wfrecon__Location__c}/view`;
            row.isModified = this.modifiedProcesses.has(locationProcess.Id);
            
            row.displayFields = this.activeProcessTableColumns.map(col => {
                const key = col.fieldName;
                let value = this.getFieldValue(locationProcess, key);
                
                // Check if this field is modified (only for completion percentage)
                const isModified = this.modifiedProcesses.has(locationProcess.Id) && 
                                col.fieldName === 'wfrecon__Completed_Percentage__c';
                
                // Store original value for sliders
                const originalValue = value !== null && value !== undefined ? parseFloat(value) : 0;
                
                // Use modified value if available
                let displayValue = value;
                if (isModified && col.isSlider) {
                    displayValue = this.modifiedProcesses.get(locationProcess.Id).newValue;
                }
                
                // Handle different data types for display
                let displayText = '';
                if (col.type === 'text' || col.isNameField || col.isLocationField) {
                    displayText = displayValue || 'N/A';
                } else if (col.type === 'number' || col.type === 'percent' || col.type === 'currency') {
                    displayText = displayValue !== null && displayValue !== undefined ? String(displayValue) : '0';
                } else {
                    displayText = displayValue !== null && displayValue !== undefined ? String(displayValue) : '';
                }
                
                let currencyValue = 0;
                if (col.type === 'currency') {
                    currencyValue = displayValue !== null && displayValue !== undefined ? parseFloat(displayValue) : 0;
                }

                let percentValue = 0;
                let progressStyle = '';
                if (col.type === 'percent' || col.isSlider) {
                    const percentVal = displayValue !== null && displayValue !== undefined ? parseFloat(displayValue) : 0;
                    percentValue = percentVal / 100;
                    progressStyle = `--progress-width: ${percentVal}%;`;
                }
                
                return {
                    key,
                    value: displayText,
                    displayValue: col.isSlider ? (displayValue || 0) : displayText,
                    originalValue: col.isSlider ? originalValue : displayValue,
                    rawValue: originalValue,
                    currencyValue: currencyValue,
                    percentValue: percentValue,
                    progressStyle: progressStyle,
                    hasValue: value !== null && value !== undefined && String(value).trim() !== '' && String(value) !== 'N/A',
                    isNameField: col.isNameField || false,
                    isLocationField: col.isLocationField || false,
                    isCurrency: col.type === 'currency',
                    isPercent: col.type === 'percent',
                    isNumber: col.type === 'number',
                    isSlider: col.isSlider || false,
                    isModified: isModified
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
        return this.filteredProcesses && this.filteredProcesses.length > 0;
    }

    /**
     * Method Name: get sortDescription
     * @description: Set the header sort description
     */
    get sortDescription() {
        try {
            if (this.sortField !== '') {
                const orderDisplayName = this.sortOrder === 'asc' ? 'Ascending' : 'Descending';
                
                let field = this.processTableColumns.find(item => item.fieldName === this.sortField);
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

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
    }

    /**
     * Method Name: connectedCallback
     * @description: Load location processes on component load
     */
    connectedCallback() {
        // Set default sorting to first sortable column
        if (this.processTableColumns.length > 0) {
            const firstSortableColumn = this.processTableColumns.find(col => col.sortable);
            if (firstSortableColumn) {
                this.sortField = firstSortableColumn.fieldName;
                this.sortOrder = 'asc';
            }
        }
        this.fetchLocationProcesses();
    }

    /**
     * Method Name: renderedCallback
     * @description: Called after every render of the component
     */
    renderedCallback() {
        // Restore highlighting for modified processes after each render
        // Only do this if we have modifications and we're not already updating DOM
        if (this.modifiedProcesses.size > 0 && !this.isUpdatingDOM) {
            setTimeout(() => {
                this.updateRowHighlighting();
            }, 50);
        }
    }

    /**
     * Method Name: fetchLocationProcesses
     * @description: Fetch all location processes for the job
     */
    fetchLocationProcesses() {
        if (!this.recordId) {
            this.isLoading = false;
            return;
        }

        getJobLocationProcesses({ jobId: this.recordId })
            .then(result => {
                this.locationProcesses = result || [];
                this.applyFilters();
                this.isLoading = false;
            })
            .catch(error => {
                this.showToast('Error', 'Unable to load location processes. Please refresh the page and try again.', 'error');
                this.locationProcesses = [];
                this.filteredProcesses = [];
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
     * @description: Apply search filters
     */
    applyFilters() {
        try {
            this.isUpdatingDOM = true;
            
            let filteredData = this.locationProcesses.filter(locationProcess => {
                if (!this.searchTerm) return true;
                
                const searchLower = this.searchTerm.toLowerCase();
                
                // Search only in visible fields defined in processTableColumns
                const searchInVisibleFields = (record) => {
                    // Get the visible columns
                    const visibleColumns = this.processTableColumns;
                    
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
                
                return searchInVisibleFields(locationProcess);
            });
    
            this.filteredProcesses = filteredData;
    
            // Apply sorting if we have data
            if (this.sortField) {
                this.sortData();
                // Update sort icons after a brief delay to ensure DOM is ready
                setTimeout(() => {
                    this.updateSortIcons();
                }, 0);
            }

            // Restore highlighting for modified processes after filtering
            setTimeout(() => {
                this.updateRowHighlighting();
                this.isUpdatingDOM = false;
            }, 150);
        } catch (error) {
            this.filteredProcesses = [];
            this.isUpdatingDOM = false;
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
     * Method Name: handleSliderInput
     * @description: Handle real-time slider input for visual feedback
     */
    handleSliderInput(event) {
        // Check if user has edit permission
        if (!this.canEdit) return;
        
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
     * Method Name: handleSliderChange
     * @description: Handle completion percentage slider change - now tracks changes instead of saving immediately
     */
    handleSliderChange(event) {
        // Check if user has edit permission
        if (!this.canEdit) return;
        
        const processId = event.target.dataset.processId;
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
                newValue: newValue
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
        // Use multiple attempts to find the element in case DOM is still updating
        const attemptHighlighting = (attempts = 0) => {
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
            } else if (attempts < 3) {
                // Retry if element not found and we haven't exceeded max attempts
                setTimeout(() => attemptHighlighting(attempts + 1), 100);
            }
        };
        
        attemptHighlighting();
    }

    /**
     * Method Name: updateRowHighlighting
     * @description: Update visual highlighting for all modified rows and restore slider values
     */
    updateRowHighlighting() {
        // Use a longer timeout to ensure DOM is fully rendered after filtering/sorting
        setTimeout(() => {
            // Clear all previous highlighting
            const allSliderContainers = this.template.querySelectorAll('.slider-container');
            const allTableCells = this.template.querySelectorAll('td');
            
            allSliderContainers.forEach(container => {
                container.classList.remove('modified-field');
            });
            
            allTableCells.forEach(cell => {
                cell.classList.remove('modified-cell');
            });
            
            // Apply highlighting and restore values for currently modified processes
            this.modifiedProcesses.forEach((modification, processId) => {
                const slider = this.template.querySelector(`[data-process-id="${processId}"]`);
                if (slider) {
                    // Restore the modified value
                    slider.value = modification.newValue;
                    
                    // Update visual progress
                    slider.style.setProperty('--progress-width', `${modification.newValue}%`);
                    
                    // Update the displayed percentage
                    const sliderContainer = slider.closest('.slider-container');
                    if (sliderContainer) {
                        const valueDisplay = sliderContainer.querySelector('.slider-value');
                        if (valueDisplay) {
                            valueDisplay.textContent = `${modification.newValue}%`;
                        }
                    }
                }
                
                // Apply highlighting
                this.applySliderHighlighting(processId, true);
            });
        }, 200); // Increased timeout to ensure DOM is fully rendered
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

        // Call single batch update method
        batchUpdateProcessCompletion({ processUpdates: processUpdates })
            .then(result => {
                if (result.isSuccess) {
                    this.showToast('Success', `Successfully updated ${result.successCount} process${result.successCount !== 1 ? 'es' : ''}`, 'success');
                    
                    // Clear modifications and refresh data
                    this.modifiedProcesses.clear();
                    this.hasModifications = false;
                    
                    // Remove all highlighting immediately after clearing modifications
                    this.clearAllHighlighting();
                    
                    this.fetchLocationProcesses();
                } else {
                    let errorMessage = 'Failed to update some processes. Please try again.';
                    if (result.message) {
                        errorMessage = result.message;
                    }
                    this.showToast('Error', errorMessage, 'error');
                    
                    // If some succeeded, refresh to show current state
                    if (result.successCount > 0) {
                        // Clear modifications for successful updates and refresh
                        this.modifiedProcesses.clear();
                        this.hasModifications = false;
                        this.clearAllHighlighting();
                        this.fetchLocationProcesses();
                    }
                }
            })
            .catch(error => {
                this.showToast('Error', 'Unable to save changes. Please check your connection and try again.', 'error');
            })
            .finally(() => {
                this.isSaving = false;
            });
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
        
        this.showToast('Success', 'All changes have been discarded', 'success');
    }

    /**
     * Method Name: handleSortClick
     * @description: Handle column header click for sorting
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
            // Handle error silently
        }
    }

    /**
     * Method Name: sortData
     * @description: Sort the process data based on current sort field and order
     */
    sortData() {
        try {
            this.filteredProcesses = [...this.filteredProcesses].sort((a, b) => {
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

            // Restore highlighting after sorting
            setTimeout(() => {
                this.updateRowHighlighting();
            }, 100);
        } catch (error) {
            // Handle error silently
        }
    }

    /**
     * Method Name: updateSortIcons
     * @description: Update sort icons and active states
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
            // Handle error silently
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
     * Method Name: get discardButtonTitle
     * @description: Get dynamic discard button title
     */
    get discardButtonTitle() {
        if (!this.hasModifications) {
            return 'No changes to discard';
        }
        return `Discard ${this.modifiedProcesses.size} unsaved change(s)`;
    }
}