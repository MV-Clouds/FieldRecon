import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getCrewMembers from '@salesforce/apex/ManagementTabController.getCrewMembers';
import deleteCrew from '@salesforce/apex/ManagementTabController.deleteCrew';

export default class CrewManagement extends NavigationMixin(LightningElement) {
    @track isLoading = true;
    @track crewList = [];
    @track filteredCrewList = [];
    @track shownCrewData = [];
    @track searchTerm = '';
    @track sortField = 'Name';
    @track sortOrder = 'asc';
    @track showCreateModal = false;
    @track isCreateModalLoading = false;
    @track isEditMode = false;
    @track recordIdToEdit = null;
    @track showConfirmationModal = false;
    @track confirmationModalTitle = 'Confirm Action';
    @track confirmationModalMessage = 'Are you sure you want to proceed?';
    @track pendingDeleteRecordId = null;
    @track currentPage = 1;
    @track pageSize = 30;
    @track visiblePages = 5;
    @track crewTableColumns = [
        { label: 'Sr. No.', fieldName: 'SerialNumber', type: 'text', isSerialNumber: true, sortable: false },
        { label: 'Actions', fieldName: 'Actions', type: 'text', isActions: true, sortable: false },
        { label: 'Crew Name', fieldName: 'Name', type: 'text', isNameField: true, sortable: true },
        { label: 'Description', fieldName: 'wfrecon__Description__c', type: 'text', sortable: true },
        { label: 'Crew Members', fieldName: 'wfrecon__Crew_Member_Count__c', type: 'number', sortable: true },
        { label: 'Color Code', fieldName: 'wfrecon__Color_Code__c', type: 'text', sortable: true }
    ];

    /**
     * Method Name: get displayedCrews
     * @description: Crew records prepared for table display
     */
    get displayedCrews() {
        if (!this.shownCrewData || this.shownCrewData.length === 0) {
            return [];
        }

        return this.shownCrewData.map((crewRecord, index) => {
            const row = { ...crewRecord };
            row.recordUrl = `/lightning/r/${crewRecord.Id}/view`;

            const serialNumber = (this.currentPage - 1) * this.pageSize + index + 1;

            row.displayFields = this.crewTableColumns.map(col => {
                const key = col.fieldName;
                let value;

                if (col.isSerialNumber) {
                    value = serialNumber;
                } else {
                    value = this.getFieldValue(crewRecord, key);
                }

                return {
                    key: `${crewRecord.Id}_${key}`,
                    value,
                    hasValue: value !== null && value !== undefined && value !== '',
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
     * @description: Get total number of filtered crews
     */
    get totalItems() {
        return this.filteredCrewList ? this.filteredCrewList.length : 0;
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
     * Method Name: get pageNumbers
     * @description: Generate array of page numbers for pagination display
     */
    get pageNumbers() {
        const pages = [];
        const totalPages = this.totalPages;

        if (totalPages <= this.visiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push({
                    number: i,
                    isActive: i === this.currentPage,
                    isEllipsis: false,
                    cssClass: i === this.currentPage ? 'pagination-button active' : 'pagination-button'
                });
            }
        } else {
            const startPage = Math.max(1, this.currentPage - Math.floor(this.visiblePages / 2));
            const endPage = Math.min(totalPages, startPage + this.visiblePages - 1);

            if (startPage > 1) {
                pages.push({
                    number: 1,
                    isActive: false,
                    isEllipsis: false,
                    cssClass: 'pagination-button'
                });

                if (startPage > 2) {
                    pages.push({
                        number: '...',
                        isActive: false,
                        isEllipsis: true,
                        cssClass: ''
                    });
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push({
                    number: i,
                    isActive: i === this.currentPage,
                    isEllipsis: false,
                    cssClass: i === this.currentPage ? 'pagination-button active' : 'pagination-button'
                });
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pages.push({
                        number: '...',
                        isActive: false,
                        isEllipsis: true,
                        cssClass: ''
                    });
                }

                pages.push({
                    number: totalPages,
                    isActive: false,
                    isEllipsis: false,
                    cssClass: 'pagination-button'
                });
            }
        }

        return pages;
    }

    /**
     * Method Name: get isDataAvailable
     * @description: Check if data is available to display
     */
    get isDataAvailable() {
        return this.shownCrewData && this.shownCrewData.length > 0;
    }

    /**
     * Method Name: get modalTitle
     * @description: Get modal title based on mode
     */
    get modalTitle() {
        return this.isEditMode ? 'Edit Crew' : 'Create New Crew';
    }

    /**
     * Method Name: get saveButtonLabel
     * @description: Get save button label based on mode
     */
    get saveButtonLabel() {
        return this.isEditMode ? 'Update' : 'Save';
    }

    connectedCallback() {
        this.fetchCrewMembers();
    }

    /**
     * Method Name: fetchCrewMembers
     * @description: Fetch all crew records
     */
    fetchCrewMembers() {
        this.isLoading = true;

        getCrewMembers()
            .then(result => {
                this.crewList = result || [];
                this.applyFilters();
                setTimeout(() => {
                    this.updateSortIcons();
                }, 100);
            })
            .catch(error => {
                console.error('Error fetching crews:', error);
                this.showToast('Error', 'Failed to load crews', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: getFieldValue
     * @description: Get field value from record, supporting nested fields
     */
    getFieldValue(record, fieldName) {
        if (!record || !fieldName) {
            return null;
        }

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

        // Attempt to strip namespace prefix if present in config
        if (fieldName.includes('__') && fieldName.startsWith('wfrecon__')) {
            const withoutNamespace = fieldName.replace('wfrecon__', '');
            if (record.hasOwnProperty(withoutNamespace)) {
                return record[withoutNamespace];
            }
        }

        return null;
    }

    /**
     * Method Name: applyFilters
     * @description: Apply search filters and sorting
     */
    applyFilters() {
        try {
            let filtered = [...this.crewList];

            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                filtered = filtered.filter(crewRecord => {
                    const crewName = this.getFieldValue(crewRecord, 'Name');
                    if (!crewName) {
                        return false;
                    }
                    return String(crewName).toLowerCase().includes(searchLower);
                });
            }

            this.filteredCrewList = filtered;
            this.sortData();
            this.updateShownData();
        } catch (error) {
            console.error('Error applying crew filters:', error);
        }
    }

    /**
     * Method Name: handleSearch
     * @description: Handle search input change
     */
    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.currentPage = 1;
        this.applyFilters();
    }

    /**
     * Method Name: handleCreateNew
     * @description: Open create crew modal
     */
    handleCreateNew() {
        this.isEditMode = false;
        this.recordIdToEdit = null;
        this.showCreateModal = true;
    }

    /**
     * Method Name: handleCloseModal
     * @description: Close modal and reset state
     */
    handleCloseModal() {
        this.showCreateModal = false;
        this.isCreateModalLoading = false;
        this.isEditMode = false;
        this.recordIdToEdit = null;
    }

    /**
     * Method Name: handleSaveSuccess
     * @description: Handle successful save of crew record
     */
    handleSaveSuccess() {
        const actionLabel = this.isEditMode ? 'updated' : 'created';
        this.showToast('Success', `Crew ${actionLabel} successfully`, 'success');
        this.handleCloseModal();
        this.currentPage = 1;
        this.fetchCrewMembers();
    }

    /**
     * Method Name: handleSaveError
     * @description: Handle errors during save
     */
    handleSaveError(event) {
        console.error('Error saving crew:', event.detail);
        const actionLabel = this.isEditMode ? 'update' : 'create';
        this.showToast('Error', `Failed to ${actionLabel} crew`, 'error');
        this.isCreateModalLoading = false;
    }

    /**
     * Method Name: handleFormSubmit
     * @description: Handle submit to show loading state
     */
    handleFormSubmit(event) {
        event.preventDefault();
        this.isCreateModalLoading = true;
        const form = this.template.querySelector('lightning-record-edit-form.crew-form');
        if (form) {
            form.submit(event.detail.fields);
        }
    }

    /**
     * Method Name: handleFormLoaded
     * @description: Remove loading when form is ready
     */
    handleFormLoaded() {
        this.isCreateModalLoading = false;
    }

    /**
     * Method Name: handleSortClick
     * @description: Handle sorting for columns
     */
    handleSortClick(event) {
        const clickedField = event.currentTarget.dataset.sortField;

        if (this.sortField === clickedField) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = clickedField;
            this.sortOrder = 'asc';
        }

        this.currentPage = 1;
        this.sortData();
        this.updateSortIcons();
    }

    /**
     * Method Name: sortData
     * @description: Sort crew data based on active column
     */
    sortData() {
        try {
            if (!this.sortField || !this.filteredCrewList) {
                return;
            }

            this.filteredCrewList.sort((a, b) => {
                let aVal = this.getFieldValue(a, this.sortField);
                let bVal = this.getFieldValue(b, this.sortField);

                if (aVal === null || aVal === undefined) {
                    aVal = '';
                }

                if (bVal === null || bVal === undefined) {
                    bVal = '';
                }

                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();

                let result = 0;
                if (aVal < bVal) {
                    result = -1;
                } else if (aVal > bVal) {
                    result = 1;
                }

                return this.sortOrder === 'desc' ? -result : result;
            });

            this.updateShownData();
        } catch (error) {
            console.error('Error sorting crew data:', error);
        }
    }

    /**
     * Method Name: updateSortIcons
     * @description: Update sort icon state classes
     */
    updateSortIcons() {
        try {
            setTimeout(() => {
                const headers = this.template.querySelectorAll('.crew-sortable-header');
                headers.forEach(header => {
                    const fieldName = header.dataset.sortField;
                    const icon = header.querySelector('.crew-sort-icon svg');

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
            console.error('Error updating crew sort icons:', error);
        }
    }

    /**
     * Method Name: handleNavigateToRecord
     * @description: Open crew record in new tab
     */
    handleNavigateToRecord(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordId;

        this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: {
                recordId,
                actionName: 'view'
            }
        }).then(url => {
            window.open(url, '_blank');
        });
    }

    /**
     * Method Name: handleEditCrew
     * @description: Open modal in edit mode
     */
    handleEditCrew(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordId;
        this.isEditMode = true;
        this.recordIdToEdit = recordId;
        this.showCreateModal = true;
    }

    /**
     * Method Name: handleDeleteCrew
     * @description: Show confirmation modal before delete
     */
    handleDeleteCrew(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordId;

        this.pendingDeleteRecordId = recordId;
        this.confirmationModalTitle = 'Delete Crew';
        this.confirmationModalMessage = 'Are you sure you want to delete this crew? This action cannot be undone.';
        this.showConfirmationModal = true;
    }

    /**
     * Method Name: handleConfirmationModalConfirm
     * @description: Execute deletion after confirmation
     */
    handleConfirmationModalConfirm() {
        this.showConfirmationModal = false;
        if (this.pendingDeleteRecordId) {
            this.deleteCrewRecord(this.pendingDeleteRecordId);
            this.pendingDeleteRecordId = null;
        }
    }

    /**
     * Method Name: handleConfirmationModalCancel
     * @description: Close confirmation modal without deleting
     */
    handleConfirmationModalCancel() {
        this.showConfirmationModal = false;
        this.pendingDeleteRecordId = null;
    }

    /**
     * Method Name: deleteCrewRecord
     * @description: Delete crew via Apex
     */
    deleteCrewRecord(recordId) {
        this.isLoading = true;

        deleteCrew({ crewId: recordId })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Crew deleted successfully', 'success');
                    this.fetchCrewMembers();
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                console.error('Error deleting crew:', error);
                this.showToast('Error', 'Failed to delete crew', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: updateShownData
     * @description: Update shownCrewData for current page
     */
    updateShownData() {
        try {
            if (!this.filteredCrewList || this.filteredCrewList.length === 0) {
                this.shownCrewData = [];
                return;
            }

            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            this.shownCrewData = this.filteredCrewList.slice(startIndex, endIndex);
        } catch (error) {
            console.error('Error updating crew shown data:', error);
        }
    }

    /**
     * Method Name: handlePrevious
     * @description: Navigate to previous page
     */
    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage -= 1;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handleNext
     * @description: Navigate to next page
     */
    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage += 1;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handlePageChange
     * @description: Navigate to selected page number
     */
    handlePageChange(event) {
        const selectedPage = parseInt(event.target.dataset.page, 10);
        if (selectedPage && selectedPage !== this.currentPage) {
            this.currentPage = selectedPage;
            this.updateShownData();
        }
    }

    /**
     * Method Name: showToast
     * @description: Utility to show toast messages
     */
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title,
            message,
            variant,
            mode: 'dismissable'
        });
        this.dispatchEvent(evt);
    }
}