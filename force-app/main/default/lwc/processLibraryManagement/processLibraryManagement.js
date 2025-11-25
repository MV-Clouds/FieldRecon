import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import UNIT_OF_MEASURE_FIELD from '@salesforce/schema/Process__c.Unit_of_Measure__c';
import PROCESS_TYPE_FIELD from '@salesforce/schema/Process__c.Process_Type__c';
import getProcessLibraries from '@salesforce/apex/ManagementTabController.getProcessLibraries';
import deleteProcess from '@salesforce/apex/ManagementTabController.deleteProcess';
import upsertProcess from '@salesforce/apex/ManagementTabController.upsertProcess';

export default class ProcessLibraryManagement extends NavigationMixin(LightningElement) {
    @track isLoading = true;
    @track processes = [];
    @track filteredProcesses = [];
    @track searchTerm = '';
    @track sortField = 'Name';
    @track sortOrder = 'asc';
    @track showCreateModal = false;
    @track isEditMode = false;
    @track recordIdToEdit = null;
    
    // Form fields
    @track processName = '';
    @track weight = '';
    @track unitOfMeasure = '';
    @track processType = '';
    
    // Picklist options
    @track unitOfMeasureOptions = [];
    @track processTypeOptions = [];

    // Process Type filter options
    @track processTypeFilterOptions = [];
    @track filterProcessTypes = [];
    
    // Confirmation modal properties
    @track showConfirmationModal = false;
    @track confirmationModalTitle = 'Confirm Action';
    @track confirmationModalMessage = 'Are you sure you want to proceed?';
    @track pendingDeleteRecordId = null;
    
    // Pagination properties
    @track currentPage = 1;
    @track pageSize = 30;
    @track visiblePages = 5;
    @track shownProcessedData = [];

    // Wire services for picklist values
    @wire(getPicklistValues, { recordTypeId: '012000000000000AAA', fieldApiName: UNIT_OF_MEASURE_FIELD })
    wiredUnitOfMeasurePicklist({ error, data }) {
        if (data) {
            this.unitOfMeasureOptions = data.values.map(item => ({
                label: item.label,
                value: item.value
            }));
        } else if (error) {
            console.error('Error fetching Unit of Measure picklist:', error);
        }
    }

    @wire(getPicklistValues, { recordTypeId: '012000000000000AAA', fieldApiName: PROCESS_TYPE_FIELD })
    wiredProcessTypePicklist({ error, data }) {
        if (data) {
            this.processTypeOptions = data.values.map(item => ({
                label: item.label,
                value: item.value
            }));

            // Map for filter picklist (all selected by default)
            this.processTypeFilterOptions = data.values.map(item => ({
                label: item.label,
                value: item.value,
                isSelected: true
            }));
            this.filterProcessTypes = this.processTypeFilterOptions.map(opt => opt.value);
            // Re-apply filters after populating initial process types
            this.applyFilters();
        } else if (error) {
            console.error('Error fetching Process Type picklist:', error);
        }
    }

    // Process table columns configuration
    @track processTableColumns = [
        { label: 'Sr. No.', fieldName: 'SerialNumber', type: 'text', isSerialNumber: true, sortable: false },
        { label: 'Actions', fieldName: 'Actions', type: 'text', isActions: true, sortable: false },
        { label: 'Name', fieldName: 'Name', type: 'text', isNameField: false, sortable: true },
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
        if (!this.shownProcessedData || this.shownProcessedData.length === 0) {
            return [];
        }

        return this.shownProcessedData.map((processRecord, index) => {
            const row = { ...processRecord };
            row.recordUrl = `/lightning/r/${processRecord.Id}/view`;
            
            // Calculate the correct serial number based on current page
            const serialNumber = (this.currentPage - 1) * this.pageSize + index + 1;
            
            row.displayFields = this.processTableColumns.map(col => {
                const key = col.fieldName;
                let value;
                
                // Handle serial number field
                if (col.isSerialNumber) {
                    value = serialNumber;
                } else {
                    value = this.getFieldValue(processRecord, key);
                    
                }
                
                // For number fields, check if value is a valid number (including 0)
                const hasValue = col.type === 'number' 
                    ? (value !== null && value !== undefined && value !== '')
                    : (value !== null && value !== undefined && value !== '');
                
                return {
                    key: `${processRecord.Id}_${key}`,
                    value: value,
                    hasValue: hasValue,
                    isNameField: col.isNameField || false,
                    isSerialNumber: col.isSerialNumber || false,
                    isActions: col.isActions || false,
                    isNumber: col.type === 'number',
                    numberValue: col.type === 'number' ? parseFloat(value) || 0 : null,
                    recordUrl: row.recordUrl
                };
            });
            
            return row;
        });
    }

    /**
     * Method Name: get totalItems
     * @description: Get total number of filtered processes
     */
    get totalItems() {
        return this.filteredProcesses ? this.filteredProcesses.length : 0;
    }

    /**
     * Method Name: get totalPages
     * @description: Calculate total number of pages
     */
    get totalPages() {
        return Math.ceil(this.totalItems / this.pageSize);
    }

    /**
     * Method Name: get isFirstPage
     * @description: Check if current page is first page
     */
    get isFirstPage() {
        return this.currentPage === 1;
    }

    /**
     * Method Name: get isLastPage
     * @description: Check if current page is last page
     */
    get isLastPage() {
        return this.currentPage === this.totalPages;
    }

    /**
     * Method Name: get startIndex
     * @description: Get start index for current page
     */
    get startIndex() {
        return (this.currentPage - 1) * this.pageSize + 1;
    }

    /**
     * Method Name: get endIndex
     * @description: Get end index for current page
     */
    get endIndex() {
        return Math.min(this.currentPage * this.pageSize, this.totalItems);
    }

    /**
     * Method Name: get pageNumbers
     * @description: Generate array of page numbers for pagination display
     */
    get pageNumbers() {
        const pages = [];
        const totalPages = this.totalPages;
        
        if (totalPages <= this.visiblePages) {
            // Show all pages if total pages is less than or equal to visible pages
            for (let i = 1; i <= totalPages; i++) {
                pages.push({
                    number: i,
                    cssClass: i === this.currentPage ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
            }
        } else {
            // Show pages with ellipsis
            const startPage = Math.max(1, this.currentPage - Math.floor(this.visiblePages / 2));
            const endPage = Math.min(totalPages, startPage + this.visiblePages - 1);
            
            // Add first page and ellipsis if needed
            if (startPage > 1) {
                pages.push({
                    number: 1,
                    cssClass: '1' === this.currentPage ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
                if (startPage > 2) {
                    pages.push({
                        number: '...',
                        cssClass: 'pagination-ellipsis',
                        isEllipsis: true
                    });
                }
            }
            
            // Add visible pages
            for (let i = startPage; i <= endPage; i++) {
                pages.push({
                    number: i,
                    cssClass: i === this.currentPage ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
            }
            
            // Add last page and ellipsis if needed
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pages.push({
                        number: '...',
                        cssClass: 'pagination-ellipsis',
                        isEllipsis: true
                    });
                }
                pages.push({
                    number: totalPages,
                    cssClass: totalPages === this.currentPage ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
            }
        }
        
        return pages;
    }

    /**
     * Method Name: get showEllipsis
     * @description: Check if ellipsis should be shown in pagination
     */
    get showEllipsis() {
        return this.totalPages > this.visiblePages;
    }

    /**
     * Method Name: get isDataAvailable
     * @description: Check if data is available to display
     */
    get isDataAvailable() {
        return this.shownProcessedData && this.shownProcessedData.length > 0;
    }

    /**
     * Method Name: get modalTitle
     * @description: Get modal title based on mode
     */
    get modalTitle() {
        return this.isEditMode ? 'Edit Process' : 'Create New Process';
    }

    /**
     * Method Name: get saveButtonLabel
     * @description: Get save button label based on mode
     */
    get saveButtonLabel() {
        return this.isEditMode ? 'Update' : 'Save';
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
     * @description: Apply search filters, process type filter, and sorting
     */
    applyFilters() {
        try {
            let filtered = [...this.processes];
            
            // 1. Apply search filter - only search by Process Name field
            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                filtered = filtered.filter(processRecord => {
                    const processNameValue = this.getFieldValue(processRecord, 'wfrecon__Process_Name__c');
                    if (processNameValue === null || processNameValue === undefined) return false;
                    return String(processNameValue).toLowerCase().includes(searchLower);
                });
            }

            // 2. Apply Process Type filter
            if (this.filterProcessTypes && this.filterProcessTypes.length > 0) {
                filtered = filtered.filter(processRecord => {
                    const processTypeValue = this.getFieldValue(processRecord, 'wfrecon__Process_Type__c');
                    // Check if the record's Process Type is in the list of selected filter values
                    // Handles null/undefined Process Type by excluding it if the list of selected values doesn't include null/undefined (which it shouldn't)
                    return this.filterProcessTypes.includes(processTypeValue);
                });
            }

            
            this.filteredProcesses = filtered;
            this.sortData();
            this.updateShownData();
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
        this.currentPage = 1; // Reset to first page when searching
        this.applyFilters();
    }

    /**
     * Method Name: handleCreateNew
     * @description: Open create new process modal
     */
    handleCreateNew() {
        this.isEditMode = false;
        this.recordIdToEdit = null;
        this.clearFormFields();
        this.showCreateModal = true;
    }

    /**
     * Method Name: handleCloseModal
     * @description: Close create process modal
     */
    handleCloseModal() {
        this.showCreateModal = false;
        this.isEditMode = false;
        this.isLoading = false;
        this.recordIdToEdit = null;
        this.clearFormFields();
    }

    /**
     * Method Name: clearFormFields
     * @description: Clear all form fields
     */
    clearFormFields() {
        this.processName = '';
        this.weight = '';
        this.unitOfMeasure = '';
        this.processType = '';
    }

    /**
     * Method Name: populateFormFields
     * @description: Populate form fields for editing
     */
    populateFormFields(processRecord) {
        this.processName = processRecord.wfrecon__Process_Name__c || '';
        this.weight = processRecord.wfrecon__Weight__c || '';
        this.unitOfMeasure = processRecord.wfrecon__Unit_of_Measure__c || '';
        this.processType = processRecord.wfrecon__Process_Type__c || '';
    }

    /**
     * Method Name: handleInputChange
     * @description: Handle input field changes
     */
    handleInputChange(event) {
        const fieldName = event.target.dataset.field;
        let value = event.target.value;
        
        switch (fieldName) {
            case 'processName':
                this.processName = value;
                break;
            case 'weight':
                this.weight = value;
                break;
            case 'unitOfMeasure':
                this.unitOfMeasure = value;
                break;
            case 'processType':
                this.processType = value;
                break;
        }
    }

    /**
     * Method Name: handleSave
     * @description: Handle save button click
     */
    handleSave() {
        if (!this.validateForm()) {
            return;
        }

        this.isLoading = true;

        // Trim values before saving
        const processRecord = {
            Id: this.isEditMode ? this.recordIdToEdit : null,
            wfrecon__Process_Name__c: this.processName.trim(),
            wfrecon__Weight__c: parseFloat(this.weight),
            wfrecon__Unit_of_Measure__c: this.unitOfMeasure.trim(),
            wfrecon__Process_Type__c: this.processType.trim()
        };

        upsertProcess({ processRecord: processRecord })
            .then(() => {
                const actionLabel = this.isEditMode ? 'updated' : 'created';
                this.showToast('Success', `Process ${actionLabel} successfully`, 'success');
                this.handleCloseModal();
                this.currentPage = 1; // Reset to first page
                this.fetchProcesses(); // Refresh the list
            })
            .catch(error => {
                console.error('Error saving process:', error);
                const actionLabel = this.isEditMode ? 'update' : 'create';
                this.showToast('Error', `Failed to ${actionLabel} process: ${error.body?.message || error.message}`, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: validateForm
     * @description: Validate form fields
     */
    validateForm() {
        const emptyFields = [];

        // Trim and check each field
        const processNameTrimmed = this.processName ? this.processName.trim() : '';
        const weightTrimmed = this.weight ? String(this.weight).trim() : '';
        const unitOfMeasureTrimmed = this.unitOfMeasure ? this.unitOfMeasure.trim() : '';
        const processTypeTrimmed = this.processType ? this.processType.trim() : '';

        console.log('Weight Trimmed:', weightTrimmed);

        // Check for empty required fields
        if (!processNameTrimmed) {
            emptyFields.push('Process Name');
        }
        if (!weightTrimmed) {
            emptyFields.push('Weight');
        }
        if (!unitOfMeasureTrimmed) {
            emptyFields.push('Unit of Measure');
        }
        if (!processTypeTrimmed) {
            emptyFields.push('Process Type');
        }

        // If all fields are empty, show generic message
        if (emptyFields.length === 4) {
            this.showToast('Error', 'Please fill all required fields', 'error');
            return false;
        }

        // If some fields are empty, show which ones
        if (emptyFields.length > 0) {
            const fieldList = emptyFields.join(', ');
            this.showToast('Error', `Please fill the following required fields: ${fieldList}`, 'error');
            return false;
        }

        // Validate Process Name length
        if (processNameTrimmed.length > 255) {
            this.showToast('Error', 'Process Name cannot exceed 255 characters', 'error');
            return false;
        }

        // Validate weight is a valid number
        if (weightTrimmed) {
            const weightNum = parseFloat(weightTrimmed);
            if (isNaN(weightNum)) {
                this.showToast('Error', 'Weight must be a valid number', 'error');
                return false;
            }
            if (weightNum <= 0) {
                this.showToast('Error', 'Weight must be greater than 0', 'error');
                return false;
            }
        }

        return true;
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
            
            this.currentPage = 1; // Reset to first page when sorting
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
            
            this.updateShownData();
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
                    
                    // Remove active-sort class from all headers first
                    header.classList.remove('active-sort');
                    
                    if (fieldName === this.sortField) {
                        // Add active-sort class to current sorted field
                        header.classList.add('active-sort');
                        if (icon) {
                            icon.classList.remove('rotate-asc', 'rotate-desc');
                            icon.classList.add(this.sortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                        }
                    } else {
                        // Reset rotation for non-active columns
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
     * @description: Navigate to process record page in new tab
     */
    handleNavigateToRecord(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordId;
        
        this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'view'
            }
        }).then(url => {
            window.open(url, '_blank');
        });
    }

    /**
     * Method Name: handleEditProcess
     * @description: Handle edit process action
     */
    handleEditProcess(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordId;
        
        // Find the process record to edit
        const processToEdit = this.processes.find(process => process.Id === recordId);
        if (processToEdit) {
            this.isEditMode = true;
            this.recordIdToEdit = recordId;
            this.populateFormFields(processToEdit);
            this.showCreateModal = true;
        }
    }

    /**
     * Method Name: handleDeleteProcess
     * @description: Handle delete process action
     */
    handleDeleteProcess(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordId;
        
        // Store the record ID and show confirmation modal
        this.pendingDeleteRecordId = recordId;
        this.confirmationModalTitle = 'Delete Process';
        this.confirmationModalMessage = 'Are you sure you want to delete this process? This action cannot be undone.';
        this.showConfirmationModal = true;
    }

    /**
     * Method Name: handleConfirmationModalConfirm
     * @description: Handle confirmation modal confirm action
     */
    handleConfirmationModalConfirm() {
        this.showConfirmationModal = false;
        if (this.pendingDeleteRecordId) {
            this.deleteProcessRecord(this.pendingDeleteRecordId);
            this.pendingDeleteRecordId = null;
        }
    }

    /**
     * Method Name: handleConfirmationModalCancel
     * @description: Handle confirmation modal cancel action
     */
    handleConfirmationModalCancel() {
        this.showConfirmationModal = false;
        this.pendingDeleteRecordId = null;
    }

    /**
     * Method Name: deleteProcessRecord
     * @description: Delete process record via Apex
     */
    deleteProcessRecord(recordId) {
        this.isLoading = true;
        
        deleteProcess({ processId: recordId })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Process deleted successfully', 'success');
                    this.fetchProcesses(); // Refresh the list
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                console.error('Error deleting process:', error);
                this.showToast('Error', 'Failed to delete process', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: updateShownData
     * @description: Update the shownProcessedData when pagination is applied
     */
    updateShownData() {
        try {
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            this.shownProcessedData = this.filteredProcesses.slice(startIndex, endIndex);
        } catch (error) {
            console.error('Error updating shown data:', error);
        }
    }

    /**
     * Method Name: handlePrevious
     * @description: Handle the previous button click in pagination
     */
    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handleNext
     * @description: Handle the next button click in pagination
     */
    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handlePageChange
     * @description: Handle direct click on page number
     */
    handlePageChange(event) {
        const selectedPage = parseInt(event.target.dataset.page);
        if (selectedPage && selectedPage !== this.currentPage) {
            this.currentPage = selectedPage;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handleProcessTypeFilter
     * @description: Handle the change in process type filter
     */
    handleProcessTypeFilter(event) {
        try {
            const value = event.currentTarget.dataset.value;
            // Find the option to update
            const optionToUpdate = this.processTypeFilterOptions.find(opt => opt.value === value);

            if (optionToUpdate) {
                // Toggle selection
                optionToUpdate.isSelected = !optionToUpdate.isSelected;
                
                // Update the array of selected values
                this.filterProcessTypes = this.processTypeFilterOptions
                    .filter(opt => opt.isSelected)
                    .map(opt => opt.value);
                
                // Re-assign the entire array to trigger reactivity
                this.processTypeFilterOptions = [...this.processTypeFilterOptions];

                // Apply the new filter
                this.currentPage = 1; // Reset to first page
                this.applyFilters();
            }
        } catch (e) {
            console.error('Error in handleProcessTypeFilter:::', e?.message);
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