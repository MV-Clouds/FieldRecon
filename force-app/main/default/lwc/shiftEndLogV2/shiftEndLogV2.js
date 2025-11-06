import { LightningElement, wire, track } from 'lwc';
import getShiftEndLogs from '@salesforce/apex/ShiftEndLogV2Controller.getShiftEndLogs';
import updateShiftEndLog from '@salesforce/apex/ShiftEndLogV2Controller.updateShiftEndLog';
import getCurrentUserCrewInfo from '@salesforce/apex/ShiftEndLogV2Controller.getCurrentUserCrewInfo';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';

export default class ShiftEndLogV2 extends NavigationMixin(LightningElement) {
    @track recordId; // Job ID
    @track shiftEndLogs = [];
    @track filteredLogs = [];
    @track searchTerm = '';
    @track filterDate = '';
    @track isLoading = false;
    @track hasError = false;
    @track errorMessage = '';
    @track showEditModal = false;
    @track editLogId = null;
    @track showEntryPopup = false;
    @track isStylesLoaded = false;

    // Pagination properties
    @track currentPage = 1;
    @track pageSize = 9;
    @track visiblePages = 5;
    @track displayedLogs = [];

    // Edit form fields object
    @track editFormData = {
        workPerformedDate: '',
        workPerformed: '',
        exceptions: '',
        planForTomorrow: ''
    };

    // Crew information for current user
    @track crewLeaderId = null;
    @track crewIds = [];

    // Check if there are logs to display
    get hasLogs() {
        return this.filteredLogs && this.filteredLogs.length > 0;
    }

    // Pagination getters
    get totalItems() {
        return this.filteredLogs ? this.filteredLogs.length : 0;
    }

    get totalPages() {
        return Math.ceil(this.totalItems / this.pageSize);
    }

    get isFirstPage() {
        return this.currentPage === 1;
    }

    get isLastPage() {
        return this.currentPage === this.totalPages;
    }

    get startIndex() {
        return (this.currentPage - 1) * this.pageSize + 1;
    }

    get endIndex() {
        return Math.min(this.currentPage * this.pageSize, this.totalItems);
    }

    get pageNumbers() {
        const pages = [];
        const totalPages = this.totalPages;
        
        if (totalPages <= this.visiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push({
                    number: i,
                    cssClass: i === this.currentPage ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
            }
        } else {
            const halfVisible = Math.floor(this.visiblePages / 2);
            let startPage = Math.max(1, this.currentPage - halfVisible);
            let endPage = Math.min(totalPages, startPage + this.visiblePages - 1);

            if (endPage - startPage < this.visiblePages - 1) {
                startPage = Math.max(1, endPage - this.visiblePages + 1);
            }

            if (startPage > 1) {
                pages.push({
                    number: 1,
                    cssClass: 'pagination-button',
                    isEllipsis: false
                });
                if (startPage > 2) {
                    pages.push({
                        number: 'ellipsis-start',
                        cssClass: 'pagination-ellipsis',
                        isEllipsis: true
                    });
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push({
                    number: i,
                    cssClass: i === this.currentPage ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pages.push({
                        number: 'ellipsis-end',
                        cssClass: 'pagination-ellipsis',
                        isEllipsis: true
                    });
                }
                pages.push({
                    number: totalPages,
                    cssClass: 'pagination-button',
                    isEllipsis: false
                });
            }
        }
        
        return pages;
    }

    get noLogsMessage() {
        if (this.searchTerm || this.filterDate) {
            return 'No logs found matching your search criteria.';
        }
        return 'No shift end logs found for this job.';
    }

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
    }
    
    connectedCallback() {
        this.isLoading = true;
        this.loadShiftEndLogs();
        this.loadCrewInfo();
    }

    renderedCallback() {
        if(!this.isStylesLoaded) {
            this.applyCustomStyling();
        }
    }

    applyCustomStyling() {
            const style = document.createElement('style');
            style.textContent = `
                 .date-filter lightning-input .slds-form-element__help,
                 .date-filter lightning-input .slds-assistive-text {
                     display: none !important;
                 }  
            `;

            const dateContainer = this.template.querySelector('.date-filter');
            if (dateContainer) {
                dateContainer.appendChild(style);
                console.log('dateContainer found and style applied' , dateContainer);
                
                this.isStylesLoaded = true;
            }
    }

    // Load crew information for current user
    loadCrewInfo() {
        if (!this.recordId) {
            return;
        }

        getCurrentUserCrewInfo({ jobId: this.recordId })
            .then(data => {
                if (data) {
                    this.crewLeaderId = data.crewLeaderId;
                    this.crewIds = data.crewIds || [];
                    console.log('Crew Leader ID:', this.crewLeaderId);
                    console.log('Crew IDs where user is leader:', this.crewIds);
                }
            })
            .catch(error => {
                console.error('Error loading crew info:', error);
                // Don't show error to user as this is supplementary information
            });
    }

    // Load shift end logs method
    loadShiftEndLogs() {
        if (!this.recordId) {
            this.isLoading = false;
            this.hasError = true;
            this.errorMessage = 'No record ID provided';
            return;
        }

        getShiftEndLogs({ jobId: this.recordId })
            .then(data => {
                this.shiftEndLogs = data.map(wrapper => {
                    const log = wrapper.logEntry;
                    const images = wrapper.images || [];
                    
                    return {
                        Id: log.Id,
                        Name: log.Name,
                        wfrecon__Work_Performed__c: log.wfrecon__Work_Performed__c,
                        wfrecon__Work_Performed_Date__c: log.wfrecon__Work_Performed_Date__c,
                        wfrecon__Log_Type__c: log.wfrecon__Log_Type__c || 'Standard',
                        wfrecon__Exceptions__c: log.wfrecon__Exceptions__c,
                        wfrecon__Plan_for_Tomorrow__c: log.wfrecon__Plan_for_Tomorrow__c,
                        CreatedBy: log.CreatedBy,
                        formattedDate: this.formatDate(log.wfrecon__Work_Performed_Date__c),
                        hasExceptions: log.wfrecon__Exceptions__c && log.wfrecon__Exceptions__c.trim() !== '',
                        createdByName: log.CreatedBy?.Name || 'Unknown User',
                        statusVariant: this.getStatusVariant(log.wfrecon__Log_Type__c),
                        images: images.map(img => ({
                            Id: img.Id,
                            Title: img.Title,
                            FileExtension: img.FileExtension,
                            thumbnailUrl: `/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${img.Id}`,
                            previewUrl: `/sfc/servlet.shepherd/version/renditionDownload?rendition=SVGZ&versionId=${img.Id}`
                        })),
                        hasImages: images.length > 0,
                        imageCount: images.length
                    };
                });
                this.filteredLogs = [...this.shiftEndLogs];
                this.currentPage = 1; // Reset to first page
                this.updateDisplayedLogs(); // Initialize displayed logs
                this.hasError = false;
                this.isLoading = false;
            })
            .catch(error => {
                this.hasError = true;
                this.errorMessage = error.body?.message || 'Error loading shift end logs';
                this.showToast('Error', this.errorMessage, 'error');
                this.isLoading = false;
            });
    }

    // Handle search functionality
    handleSearch(event) {
        this.searchTerm = event.target.value.toLowerCase();
        this.filterLogs();
    }

    // Handle date filter
    handleDateFilter(event) {
        this.filterDate = event.target.value;
        this.filterLogs();
    }

    // Handle clear filter
    handleClearFilter() {
        this.filterDate = '';
        this.filterLogs();
    }

    filterLogs() {
        let logs = [...this.shiftEndLogs];

        // Apply search filter (Name and Person only)
        if (this.searchTerm) {
            logs = logs.filter(log => 
                (log.Name && log.Name.toLowerCase().includes(this.searchTerm)) ||
                (log.createdByName && log.createdByName.toLowerCase().includes(this.searchTerm))
            );
        }

        // Apply date filter
        if (this.filterDate) {
            logs = logs.filter(log => {
                if (!log.wfrecon__Work_Performed_Date__c) return false;
                const logDate = new Date(log.wfrecon__Work_Performed_Date__c).toISOString().split('T')[0];
                return logDate === this.filterDate;
            });
        }

        this.filteredLogs = logs;
        this.currentPage = 1; // Reset to first page when filtering
        this.updateDisplayedLogs();
    }

    // Update displayed logs based on current page
    updateDisplayedLogs() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        this.displayedLogs = this.filteredLogs.slice(startIndex, endIndex);
    }

    // Pagination handlers
    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateDisplayedLogs();
        }
    }

    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.updateDisplayedLogs();
        }
    }

    handlePageChange(event) {
        const pageNumber = parseInt(event.currentTarget.dataset.page, 10);
        this.currentPage = pageNumber;
        this.updateDisplayedLogs();
    }

    // Handle create button click
    handleCreate() {
        this.showEntryPopup = true;
    }

    handleCloseEntryPopup() {
        this.showEntryPopup = false;
    }

    // Handle edit button click
    handleEdit(event) {
        const logId = event.currentTarget.dataset.id;
        this.editLogId = logId;
        
        // Find the log to edit and populate form fields
        const logToEdit = this.shiftEndLogs.find(log => log.Id === logId);
        if (logToEdit) {
            this.editFormData = {
                workPerformedDate: logToEdit.wfrecon__Work_Performed_Date__c || '',
                workPerformed: logToEdit.wfrecon__Work_Performed__c || '',
                exceptions: logToEdit.wfrecon__Exceptions__c || '',
                planForTomorrow: logToEdit.wfrecon__Plan_for_Tomorrow__c || ''
            };
        }
        
        this.showEditModal = true;
    }

    // Handle close modal
    handleCloseModal() {
        this.showEditModal = false;
        this.editLogId = null;
        this.clearEditForm();
    }

    // Clear edit form
    clearEditForm() {
        this.editFormData = {
            workPerformedDate: '',
            workPerformed: '',
            exceptions: '',
            planForTomorrow: ''
        };
    }

    // Handle input change in edit form
    handleEditInputChange(event) {
        const fieldName = event.target.dataset.field;
        const value = event.target.value;
        
        this.editFormData = {
            ...this.editFormData,
            [fieldName]: value
        };
    }

    // Handle save button click
    handleSaveEdit() {
        // Validate required fields
        if (!this.editFormData.workPerformedDate) {
            this.showToast('Error', 'Work Performed Date is required', 'error');
            return;
        }

        if (!this.editFormData.workPerformed || this.editFormData.workPerformed.trim() === '') {
            this.showToast('Error', 'Work Performed is required', 'error');
            return;
        }

        if (!this.editFormData.planForTomorrow || this.editFormData.planForTomorrow.trim() === '') {
            this.showToast('Error', 'Plan for Tomorrow is required', 'error');
            return;
        }

        const formData = {
            Id: this.editLogId,
            wfrecon__Work_Performed_Date__c: this.editFormData.workPerformedDate,
            wfrecon__Work_Performed__c: this.editFormData.workPerformed,
            wfrecon__Exceptions__c: this.editFormData.exceptions,
            wfrecon__Plan_for_Tomorrow__c: this.editFormData.planForTomorrow
        };

        this.isLoading = true;

        // Pass the entire form data object to Apex
        updateShiftEndLog({ logEntry: formData })
            .then(() => {
                this.showToast('Success', 'Shift End Log updated successfully', 'success');
                this.handleCloseModal();
                this.loadShiftEndLogs();
            })
            .catch(error => {
                const errorMessage = error.body?.message || 'Error updating shift end log';
                this.showToast('Error', errorMessage, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    // Handle record navigation
    handleRecordNavigation(event) {
        const logId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: logId,
                objectApiName: 'wfrecon__Log_Entry__c',
                actionName: 'view'
            }
        });
    }

    // Handle image preview
    handleImagePreview(event) {
        const imageId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__namedPage',
            attributes: {
                pageName: 'filePreview'
            },
            state: {
                selectedRecordId: imageId
            }
        });
    }

    // Format date for display
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Show toast message
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }

    // Get status variant for styling
    getStatusVariant(logType) {
        if (!logType) return 'neutral';
        
        const type = logType.toLowerCase();
        switch(type) {
            case 'standard': return 'success';
            case 'emergency': return 'error';
            case 'exception': return 'warning';
            case 'shift end': return 'success';
            default: return 'neutral';
        }
    }
}