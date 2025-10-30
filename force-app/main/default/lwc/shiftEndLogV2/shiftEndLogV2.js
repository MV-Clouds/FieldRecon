import { LightningElement, wire, track } from 'lwc';
import getShiftEndLogs from '@salesforce/apex/ShiftEndLogV2Controller.getShiftEndLogs';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';

export default class ShiftEndLogV2 extends NavigationMixin(LightningElement) {
    @track recordId; // Job ID
    @track shiftEndLogs = [];
    @track filteredLogs = [];
    @track searchTerm = '';
    @track isLoading = false;
    @track hasError = false;
    @track errorMessage = '';

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.recordId = pageRef.attributes.recordId;
    }
    
    connectedCallback() {
        this.isLoading = true;
        this.loadShiftEndLogs();
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
                        wfrecon__Log_Type__c: log.wfrecon__Log_Type__c,
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

    filterLogs() {
        if (!this.searchTerm) {
            this.filteredLogs = [...this.shiftEndLogs];
        } else {
            this.filteredLogs = this.shiftEndLogs.filter(log => 
                (log.Name && log.Name.toLowerCase().includes(this.searchTerm)) ||
                (log.wfrecon__Work_Performed__c && log.wfrecon__Work_Performed__c.toLowerCase().includes(this.searchTerm)) ||
                (log.wfrecon__Exceptions__c && log.wfrecon__Exceptions__c.toLowerCase().includes(this.searchTerm)) ||
                (log.wfrecon__Plan_for_Tomorrow__c && log.wfrecon__Plan_for_Tomorrow__c.toLowerCase().includes(this.searchTerm)) ||
                (log.createdByName && log.createdByName.toLowerCase().includes(this.searchTerm))
            );
        }
    }

    // Handle create button click
    handleCreate() {
        // Navigate to new log entry creation
        console.log('In the handlecreate');
        
    }

    // Handle edit button click
    handleEdit(event) {
        const logId = event.currentTarget.dataset.id;
        console.log('logId for edit:', logId);
        
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

    // Check if there are logs to display
    get hasLogs() {
        return this.filteredLogs && this.filteredLogs.length > 0;
    }

    get noLogsMessage() {
        return this.searchTerm ? 'No logs found matching your search criteria.' : 'No shift end logs found for this job.';
    }
}