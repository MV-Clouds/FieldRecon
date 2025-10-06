import { LightningElement, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getJobLocationProcesses from '@salesforce/apex/SovJobLocationProcessesController.getJobLocationProcesses';
import updateProcessCompletion from '@salesforce/apex/SovJobLocationProcessesController.updateProcessCompletion';

export default class SovJobLocationProcesses extends NavigationMixin(LightningElement) {
    @track recordId;
    @track isLoading = true;
    @track locationProcesses = [];
    @track filteredProcesses = [];
    @track searchTerm = '';
    @track sortField = '';
    @track sortOrder = '';

    // Process table columns configuration
    @track processTableColumns = [
        { label: 'Name', fieldName: 'Name', type: 'text', isNameField: true },
        { label: 'Location Name', fieldName: 'wfrecon__Location__r.Name', type: 'text', isLocationField: true },
        { label: 'Contract Price', fieldName: 'wfrecon__Contract_Price__c', type: 'currency' },
        { label: 'Completed Percentage', fieldName: 'wfrecon__Completed_Percentage__c', type: 'percent', isSlider: true },
        { label: 'Current Completed Value', fieldName: 'wfrecon__Current_Completed_Value__c', type: 'currency' },
        { label: 'Process Status', fieldName: 'wfrecon__Process_Status__c', type: 'text' },
        { label: 'Sequence', fieldName: 'wfrecon__Sequence__c', type: 'number' }
    ];

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
    }

    /**
     * Method Name: get displayedProcesses
     * @description: Process location processes for table display
     */
    get displayedProcesses() {
        if (!this.filteredProcesses || this.filteredProcesses.length === 0) {
            return [];
        }

        return this.filteredProcesses.map(process => {
            const row = { ...process };
            row.recordUrl = `/lightning/r/${process.Id}/view`;
            row.locationUrl = `/lightning/r/${process.wfrecon__Location__c}/view`;
            
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
                    isLocationField: col.isLocationField || false,
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
            console.error('Error in sortDescription:', error);
            return '';
        }
    }

    /**
     * Method Name: connectedCallback
     * @description: Load location processes on component load
     */
    connectedCallback() {
        // Set default sorting to first column
        if (this.processTableColumns.length > 0) {
            this.sortField = this.processTableColumns[0].fieldName;
            this.sortOrder = 'asc';
        }
        this.fetchLocationProcesses();
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
                console.error('Error fetching location processes:', error);
                this.showToast('Error', 'Error fetching location processes: ' + (error.body?.message || error.message), 'error');
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
            let filteredData = this.locationProcesses.filter(process => {
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
                
                return searchInObject(process);
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
        } catch (error) {
            console.error('Error applying filters:', error);
            this.filteredProcesses = [];
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
     * @description: Handle completion percentage slider change
     */
    handleSliderChange(event) {
        const processId = event.target.dataset.processId;
        const originalValue = event.target.dataset.originalValue;
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
        
        updateProcessCompletion({ processId: processId, completionPercentage: newValue })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Process completion updated successfully', 'success');
                    // Update the original value for future reference
                    if (sliderElement) {
                        sliderElement.dataset.originalValue = newValue;
                    }
                    this.fetchLocationProcesses();
                } else {
                    this.showToast('Error', result, 'error');
                    // Revert the slider value and visual progress on error
                    if (sliderElement) {
                        sliderElement.value = originalValue;
                        sliderElement.style.setProperty('--progress-width', `${originalValue}%`);
                        
                        const sliderContainer = sliderElement.closest('.slider-container');
                        if (sliderContainer) {
                            const valueDisplay = sliderContainer.querySelector('.slider-value');
                            if (valueDisplay) {
                                valueDisplay.textContent = `${originalValue}%`;
                            }
                        }
                    }
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to update process completion: ' + (error.body?.message || error.message), 'error');
                // Revert the slider value and visual progress on error
                if (sliderElement) {
                    sliderElement.value = originalValue;
                    sliderElement.style.setProperty('--progress-width', `${originalValue}%`);
                    
                    const sliderContainer = sliderElement.closest('.slider-container');
                    if (sliderContainer) {
                        const valueDisplay = sliderContainer.querySelector('.slider-value');
                        if (valueDisplay) {
                            valueDisplay.textContent = `${originalValue}%`;
                        }
                    }
                }
            });
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
            console.error('Error in handleSortClick:', error);
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
        } catch (error) {
            console.error('Error in sortData:', error);
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
            console.error('Error in updateSortIcons:', error);
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
}