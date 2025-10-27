import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getProcessLibraries from '@salesforce/apex/ManagementTabController.getProcessLibraries';

export default class ProcessLibraryManagement extends NavigationMixin(LightningElement) {
    @track isLoading = true;
    @track processes = [];
    @track filteredProcesses = [];
    @track searchTerm = '';
    @track sortField = 'Name';
    @track sortOrder = 'asc';
    @track showCreateModal = false;
    @track isCreateModalLoading = false;

    // Process table columns configuration
    @track processTableColumns = [
        { label: 'Sr. No.', fieldName: 'SerialNumber', type: 'text', isSerialNumber: true, sortable: false },
        { label: 'Name', fieldName: 'Name', type: 'text', isNameField: true, sortable: true },
        { label: 'Process Name', fieldName: 'wfrecon__Process_Name__c', type: 'text', sortable: true },
        { label: 'Weight', fieldName: 'wfrecon__Weight__c', type: 'number', sortable: true },
        { label: 'Unit of Measure', fieldName: 'wfrecon__Unit_of_Measure__c', type: 'text', sortable: true },
        { label: 'Process Type', fieldName: 'wfrecon__Process_Type__c', type: 'text', sortable: true }
    ];

    /**
     * Method Name: get displayedProcesses
     * @description: Process library processes for table display
     */
    get displayedProcesses() {
        if (!this.filteredProcesses || this.filteredProcesses.length === 0) {
            return [];
        }

        return this.filteredProcesses.map((processRecord, index) => {
            const row = { ...processRecord };
            row.recordUrl = `/lightning/r/${processRecord.Id}/view`;
            
            row.displayFields = this.processTableColumns.map(col => {
                const key = col.fieldName;
                let value;
                
                // Handle serial number field
                if (col.isSerialNumber) {
                    value = index + 1;
                } else {
                    value = this.getFieldValue(processRecord, key);
                }
                
                return {
                    key: `${processRecord.Id}_${key}`,
                    value: value,
                    hasValue: value !== null && value !== undefined && value !== '',
                    isNameField: col.isNameField || false,
                    isSerialNumber: col.isSerialNumber || false,
                    isNumber: col.type === 'number',
                    numberValue: col.type === 'number' ? parseFloat(value) || 0 : null,
                    recordUrl: row.recordUrl
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
     * Method Name: connectedCallback
     * @description: Load processes on component load
     */
    connectedCallback() {
        this.fetchProcesses();
    }

    /**
     * Method Name: fetchProcesses
     * @description: Fetch all processes from the library
     */
    fetchProcesses() {
        this.isLoading = true;
        
        getProcessLibraries()
            .then(result => {
                this.processes = result || [];
                this.applyFilters();
                this.isLoading = false;
                setTimeout(() => {
                    this.updateSortIcons();
                }, 100);
            })
            .catch(error => {
                console.error('Error fetching processes:', error);
                this.showToast('Error', 'Failed to load processes', 'error');
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
            let value = record;
            for (const part of parts) {
                if (value && value.hasOwnProperty(part)) {
                    value = value[part];
                } else {
                    return null;
                }
            }
            return value;
        }
        
        return null;
    }

    /**
     * Method Name: applyFilters
     * @description: Apply search filters and sorting
     */
    applyFilters() {
        try {
            let filtered = [...this.processes];
            
            // Apply search filter - only search by Process Name field
            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                filtered = filtered.filter(processRecord => {
                    const processNameValue = this.getFieldValue(processRecord, 'wfrecon__Process_Name__c');
                    if (processNameValue === null || processNameValue === undefined) return false;
                    return String(processNameValue).toLowerCase().includes(searchLower);
                });
            }
            
            this.filteredProcesses = filtered;
            this.sortData();
        } catch (error) {
            console.error('Error applying filters:', error);
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
     * Method Name: handleCreateNew
     * @description: Open create new process modal
     */
    handleCreateNew() {
        this.showCreateModal = true;
    }

    /**
     * Method Name: handleCloseModal
     * @description: Close create process modal
     */
    handleCloseModal() {
        this.showCreateModal = false;
        this.isCreateModalLoading = false;
    }

    /**
     * Method Name: handleSaveSuccess
     * @description: Handle successful process creation
     */
    handleSaveSuccess(event) {
        this.showToast('Success', 'Process created successfully', 'success');
        this.handleCloseModal();
        this.fetchProcesses(); // Refresh the list
    }

    /**
     * Method Name: handleSaveError
     * @description: Handle process creation error
     */
    handleSaveError(event) {
        console.error('Error creating process:', event.detail);
        this.showToast('Error', 'Failed to create process', 'error');
        this.isCreateModalLoading = false;
    }

    /**
     * Method Name: handleSortClick
     * @description: Handle column header click for sorting
     */
    handleSortClick(event) {
        try {
            const clickedField = event.currentTarget.dataset.sortField;
            
            if (this.sortField === clickedField) {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = clickedField;
                this.sortOrder = 'asc';
            }
            
            this.sortData();
            this.updateSortIcons();
        } catch (error) {
            console.error('Error handling sort click:', error);
        }
    }

    /**
     * Method Name: sortData
     * @description: Sort the process data based on current sort field and order
     */
    sortData() {
        try {
            if (!this.sortField || !this.filteredProcesses) return;
            
            this.filteredProcesses.sort((a, b) => {
                let aVal = this.getFieldValue(a, this.sortField);
                let bVal = this.getFieldValue(b, this.sortField);
                
                // Handle null/undefined values
                if (aVal === null || aVal === undefined) aVal = '';
                if (bVal === null || bVal === undefined) bVal = '';
                
                // Convert to strings for comparison
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();
                
                let result = 0;
                if (aVal < bVal) result = -1;
                else if (aVal > bVal) result = 1;
                
                return this.sortOrder === 'desc' ? -result : result;
            });
        } catch (error) {
            console.error('Error sorting data:', error);
        }
    }

    /**
     * Method Name: updateSortIcons
     * @description: Update sort icons and active states
     */
    updateSortIcons() {
        try {
            setTimeout(() => {
                const headers = this.template.querySelectorAll('.sortable-header');
                headers.forEach(header => {
                    const fieldName = header.dataset.sortField;
                    const icon = header.querySelector('.sort-icon svg');
                    
                    if (fieldName === this.sortField) {
                        header.classList.add('active-sort');
                        if (icon) {
                            icon.classList.remove('rotate-asc', 'rotate-desc');
                            icon.classList.add(this.sortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                        }
                    } else {
                        header.classList.remove('active-sort');
                        if (icon) {
                            icon.classList.remove('rotate-asc', 'rotate-desc');
                        }
                    }
                });
            }, 0);
        } catch (error) {
            console.error('Error updating sort icons:', error);
        }
    }

    /**
     * Method Name: handleNavigateToRecord
     * @description: Navigate to process record page
     */
    handleNavigateToRecord(event) {
        event.preventDefault();
        const recordId = event.target.dataset.recordId;
        
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'view'
            }
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