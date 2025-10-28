import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import getCostCodes from '@salesforce/apex/ManagementTabController.getCostCodes';
import deleteCostCode from '@salesforce/apex/ManagementTabController.deleteCostCode';
import upsertCostCode from '@salesforce/apex/ManagementTabController.upsertCostCode';
import CLASSIFICATION_TYPE_FIELD from '@salesforce/schema/Cost_Code__c.Classification_Type__c';

export default class CostCodeManagement extends NavigationMixin(LightningElement) {
    @track isLoading = true;
    @track costCodes = [];
    @track filteredCostCodes = [];
    @track searchTerm = '';
    @track sortField = 'Name';
    @track sortOrder = 'asc';
    @track showCreateModal = false;
    @track isEditMode = false;
    @track recordIdToEdit = null;
    
    // Form fields
    @track costCodeName = '';
    @track classificationType = '';
    @track levelCode = '';
    
    // Picklist options
    @track classificationTypeOptions = [];
    
    // Confirmation modal properties
    @track showConfirmationModal = false;
    @track confirmationModalTitle = 'Confirm Action';
    @track confirmationModalMessage = 'Are you sure you want to proceed?';
    @track pendingDeleteRecordId = null;
    
    // Pagination properties
    @track currentPage = 1;
    @track pageSize = 30;
    @track visiblePages = 5;
    @track shownCostCodeData = [];

    // Wire services for picklist values
    @wire(getPicklistValues, { recordTypeId: '012000000000000AAA', fieldApiName: CLASSIFICATION_TYPE_FIELD })
    wiredClassificationTypePicklist({ error, data }) {
        if (data) {
            this.classificationTypeOptions = data.values.map(option => ({
                label: option.label,
                value: option.value
            }));
        } else if (error) {
            console.error('Error fetching classification type picklist:', error);
        }
    }

    // Cost Code table columns configuration
    @track costCodeTableColumns = [
        { label: 'Sr. No.', fieldName: 'SerialNumber', type: 'text', isSerialNumber: true, sortable: false },
        { label: 'Actions', fieldName: 'Actions', type: 'text', isActions: true, sortable: false },
        { label: 'Name', fieldName: 'Name', type: 'text', isNameField: true, sortable: true },
        { label: 'Code', fieldName: 'wfrecon__Code__c', type: 'text', isCodeField: true, sortable: true },
        { label: 'Classification Type', fieldName: 'wfrecon__Classification_Type__c', type: 'text', isClassificationField: true, sortable: true },
        { label: 'Level Code', fieldName: 'wfrecon__Level_Code__c', type: 'number', isLevelCodeField: true, sortable: true }
    ];

    /**
     * Method Name: get displayedCostCodes
     * @description: Cost code management for table display
     */
    get displayedCostCodes() {
        if (!this.filteredCostCodes || this.filteredCostCodes.length === 0) {
            return [];
        }

        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, this.filteredCostCodes.length);
        
        return this.filteredCostCodes.slice(startIndex, endIndex).map((record, index) => {
            return {
                ...record,
                SerialNumber: startIndex + index + 1,
                Actions: 'actions'
            };
        });
    }

    /**
     * Method Name: get totalItems
     * @description: Get total number of filtered cost codes
     */
    get totalItems() {
        return this.filteredCostCodes ? this.filteredCostCodes.length : 0;
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
        const totalPages = this.totalPages;
        const currentPage = this.currentPage;
        const visiblePages = this.visiblePages;
        const pageNumbers = [];

        if (totalPages <= visiblePages) {
            // Show all pages
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push({
                    number: i,
                    isActive: i === currentPage,
                    isEllipsis: false,
                    cssClass: i === currentPage ? 'pagination-button active' : 'pagination-button'
                });
            }
        } else {
            // Show pages with ellipsis
            const startPage = Math.max(1, currentPage - Math.floor(visiblePages / 2));
            const endPage = Math.min(totalPages, startPage + visiblePages - 1);
            
            // Add first page and ellipsis if needed
            if (startPage > 1) {
                pageNumbers.push({
                    number: 1,
                    isActive: false,
                    isEllipsis: false,
                    cssClass: 'pagination-button'
                });
                
                if (startPage > 2) {
                    pageNumbers.push({
                        number: '...',
                        isActive: false,
                        isEllipsis: true,
                        cssClass: ''
                    });
                }
            }
            
            // Add visible pages
            for (let i = startPage; i <= endPage; i++) {
                pageNumbers.push({
                    number: i,
                    isActive: i === currentPage,
                    isEllipsis: false,
                    cssClass: i === currentPage ? 'pagination-button active' : 'pagination-button'
                });
            }
            
            // Add last page and ellipsis if needed
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pageNumbers.push({
                        number: '...',
                        isActive: false,
                        isEllipsis: true,
                        cssClass: ''
                    });
                }
                
                pageNumbers.push({
                    number: totalPages,
                    isActive: false,
                    isEllipsis: false,
                    cssClass: 'pagination-button'
                });
            }
        }

        return pageNumbers;
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
        return this.filteredCostCodes && this.filteredCostCodes.length > 0;
    }

    /**
     * Method Name: get modalTitle
     * @description: Get modal title based on mode
     */
    get modalTitle() {
        return this.isEditMode ? 'Edit Cost Code' : 'Create New Cost Code';
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
     * @description: Load cost codes on component load
     */
    connectedCallback() {
        this.fetchCostCodes();
    }

    /**
     * Method Name: fetchCostCodes
     * @description: Fetch all cost codes from the library
     */
    fetchCostCodes() {
        this.isLoading = true;
        getCostCodes()
            .then(result => {
                this.costCodes = result || [];
                this.applyFilters();
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error fetching cost codes:', error);
                this.isLoading = false;
                this.showToast('Error', 'Error fetching cost codes: ' + error.body?.message, 'error');
            });
    }

    /**
     * Method Name: getFieldValue
     * @description: Get field value from nested object structure
     */
    getFieldValue(record, fieldName) {
        if (!record || !fieldName) return '';
        
        // Handle nested field access (e.g., 'Account.Name')
        if (fieldName.includes('.')) {
            const parts = fieldName.split('.');
            let value = record;
            for (const part of parts) {
                value = value?.[part];
                if (value === undefined || value === null) return '';
            }
            return value;
        }
        
        return record[fieldName] || '';
    }

    /**
     * Method Name: applyFilters
     * @description: Apply search filters and sorting
     */
    applyFilters() {
        let filtered = [...this.costCodes];

        // Apply search filter - only search by Name
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(record => {
                return this.getFieldValue(record, 'Name').toLowerCase().includes(searchLower);
            });
        }

        this.filteredCostCodes = filtered;
        this.sortData();
        this.currentPage = 1; // Reset to first page when filtering
        this.updateShownData();
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
     * @description: Open create new cost code modal
     */
    handleCreateNew() {
        this.isEditMode = false;
        this.recordIdToEdit = null;
        this.clearFormFields();
        this.showCreateModal = true;
    }

    /**
     * Method Name: handleCloseModal
     * @description: Close create cost code modal
     */
    handleCloseModal() {
        this.showCreateModal = false;
        this.isEditMode = false;
        this.recordIdToEdit = null;
        this.clearFormFields();
    }

    /**
     * Method Name: clearFormFields
     * @description: Clear all form fields
     */
    clearFormFields() {
        this.costCodeName = '';
        this.classificationType = '';
        this.levelCode = '';
    }

    /**
     * Method Name: populateFormFields
     * @description: Populate form fields for editing
     */
    populateFormFields(costCodeRecord) {
        this.costCodeName = costCodeRecord.Name || '';
        this.classificationType = costCodeRecord.wfrecon__Classification_Type__c || '';
        this.levelCode = costCodeRecord.wfrecon__Level_Code__c || '';
    }

    /**
     * Method Name: handleInputChange
     * @description: Handle input field changes
     */
    handleInputChange(event) {
        const fieldName = event.target.name;
        const value = event.target.value;
        
        switch(fieldName) {
            case 'costCodeName':
                this.costCodeName = value;
                break;
            case 'classificationType':
                this.classificationType = value;
                break;
            case 'levelCode':
                this.levelCode = value;
                break;
            default:
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

        const costCodeRecord = {
            Name: this.costCodeName,
            wfrecon__Classification_Type__c: this.classificationType,
            wfrecon__Level_Code__c: parseInt(this.levelCode) || null
        };

        if (this.isEditMode && this.recordIdToEdit) {
            costCodeRecord.Id = this.recordIdToEdit;
        }

        upsertCostCode({ costCodeRecord })
            .then(result => {
                this.showCreateModal = false;
                this.showToast('Success', `Cost Code ${this.isEditMode ? 'updated' : 'created'} successfully!`, 'success');
                this.fetchCostCodes(); // Refresh the data
                this.clearFormFields();
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error saving cost code:', error);
                this.showToast('Error', 'Error saving cost code: ' + error.body?.message, 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: validateForm
     * @description: Validate form fields
     */
    validateForm() {
        let isValid = true;
        const requiredFields = [
            { value: this.costCodeName, name: 'Cost Code Name' },
            { value: this.classificationType, name: 'Classification Type' },
            { value: this.levelCode, name: 'Level Code' }
        ];

        // Check for empty required fields
        for (const field of requiredFields) {
            if (!field.value || field.value.trim() === '') {
                this.showToast('Error', `${field.name} is required.`, 'error');
                isValid = false;
                break;
            }
        }

        // Validate level code is a number
        if (isValid && this.levelCode) {
            const levelCodeNum = parseInt(this.levelCode);
            if (isNaN(levelCodeNum) || levelCodeNum < 0) {
                this.showToast('Error', 'Level Code must be a valid positive number.', 'error');
                isValid = false;
            }
        }

        return isValid;
    }


    /**
     * Method Name: handleSortClick
     * @description: Handle column header click for sorting
     */
    handleSortClick(event) {
        const fieldName = event.currentTarget.dataset.sortField;
        
        if (this.sortField === fieldName) {
            // Toggle sort order if same field is clicked
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            // Set new sort field and default to ascending
            this.sortField = fieldName;
            this.sortOrder = 'asc';
        }
        
        this.sortData();
        this.updateSortIcons();
    }

    /**
     * Method Name: sortData
     * @description: Sort the cost code data based on current sort field and order
     */
    sortData() {
        this.filteredCostCodes.sort((a, b) => {
            let aVal = this.getFieldValue(a, this.sortField);
            let bVal = this.getFieldValue(b, this.sortField);
            
            // Handle null/undefined values
            if (aVal == null) aVal = '';
            if (bVal == null) bVal = '';
            
            // Convert to string for comparison if not already
            if (typeof aVal !== 'string') aVal = String(aVal);
            if (typeof bVal !== 'string') bVal = String(bVal);
            
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
            
            if (aVal < bVal) {
                return this.sortOrder === 'asc' ? -1 : 1;
            }
            if (aVal > bVal) {
                return this.sortOrder === 'asc' ? 1 : -1;
            }
            return 0;
        });
        
        // Update sort icons after sorting
        this.updateSortIcons();
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
     * @description: Navigate to cost code record page in new tab
     */
    handleNavigateToRecord(event) {
        const recordId = event.currentTarget.dataset.recordId;
        
        this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                actionName: 'view',
            },
        }).then(url => {
            window.open(url, '_blank');
        });
    }

    /**
     * Method Name: handleEditCostCode
     * @description: Handle edit cost code action
     */
    handleEditCostCode(event) {
        const recordId = event.currentTarget.dataset.recordId;
        const costCodeRecord = this.costCodes.find(record => record.Id === recordId);
        
        if (costCodeRecord) {
            this.isEditMode = true;
            this.recordIdToEdit = recordId;
            this.populateFormFields(costCodeRecord);
            this.showCreateModal = true;
        }
    }

    /**
     * Method Name: handleDeleteCostCode
     * @description: Handle delete cost code action
     */
    handleDeleteCostCode(event) {
        const recordId = event.currentTarget.dataset.recordId;
        this.pendingDeleteRecordId = recordId;
        this.confirmationModalTitle = 'Delete Cost Code';
        this.confirmationModalMessage = 'Are you sure you want to delete this cost code? This action cannot be undone.';
        this.showConfirmationModal = true;
    }

    /**
     * Method Name: handleConfirmationModalConfirm
     * @description: Handle confirmation modal confirm action
     */
    handleConfirmationModalConfirm() {
        this.showConfirmationModal = false;
        if (this.pendingDeleteRecordId) {
            this.deleteCostCodeRecord(this.pendingDeleteRecordId);
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
     * Method Name: deleteCostCodeRecord
     * @description: Delete cost code record via Apex
     */
    deleteCostCodeRecord(recordId) {
        deleteCostCode({ costCodeId: recordId })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Cost Code deleted successfully!', 'success');
                    this.fetchCostCodes(); // Refresh the data
                } else {
                    this.showToast('Error', 'Error deleting cost code: ' + result, 'error');
                }
                this.pendingDeleteRecordId = null;
            })
            .catch(error => {
                console.error('Error deleting cost code:', error);
                this.showToast('Error', 'Error deleting cost code: ' + error.body?.message, 'error');
                this.pendingDeleteRecordId = null;
            });
    }

    /**
     * Method Name: updateShownData
     * @description: Update the shownCostCodeData when pagination is applied
     */
    updateShownData() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, this.filteredCostCodes.length);
        
        this.shownCostCodeData = this.filteredCostCodes.slice(startIndex, endIndex).map((record, index) => {
            return {
                ...record,
                SerialNumber: startIndex + index + 1
            };
        });
    }

    /**
     * Method Name: handlePrevious
     * @description: Handle the previous button click in pagination
     */
    handlePrevious() {
        if (!this.isFirstPage) {
            this.currentPage--;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handleNext
     * @description: Handle the next button click in pagination
     */
    handleNext() {
        if (!this.isLastPage) {
            this.currentPage++;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handlePageChange
     * @description: Handle direct click on page number
     */
    handlePageChange(event) {
        const pageNumber = parseInt(event.currentTarget.dataset.page);
        if (pageNumber !== this.currentPage && pageNumber >= 1 && pageNumber <= this.totalPages) {
            this.currentPage = pageNumber;
            this.updateShownData();
        }
    }

    /**
     * Method Name: showToast
     * @description: Show toast message
     */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
}