import { LightningElement, wire, track } from 'lwc';
import getShiftEndLogsWithCrewInfo from '@salesforce/apex/ShiftEndLogV2Controller.getShiftEndLogsWithCrewInfo';
import updateShiftEndLogWithImages from '@salesforce/apex/ShiftEndLogV2Controller.updateShiftEndLogWithImages';
import deleteShiftEndLog from '@salesforce/apex/ShiftEndLogV2Controller.deleteShiftEndLog';
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
    @track showEditModal = false;
    @track editLogId = null;
    @track showEntryPopup = false;

    // Confirmation Modal Properties
    @track showConfirmationModal = false;
    @track confirmationTitle = '';
    @track confirmationMessage = '';
    @track confirmationAction = '';
    @track confirmationButtonLabel = 'Confirm';
    @track confirmationButtonVariant = 'brand';
    @track confirmationData = null;

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
        planForTomorrow: '',
        notesToOffice: ''
    };

    // Image handling
    @track existingImages = [];
    @track newUploadedFiles = [];
    @track imagesToDelete = [];

    // Camera Modal
    @track showCameraModal = false;
    @track cameraStream = null;
    @track capturedPhoto = null;

    // Crew information for current user
    @track crewLeaderId = null;
    @track crewIds = [];

    acceptedFormats = '.jpg,.jpeg,.png,.gif,.bmp,.svg,.webp,.tiff';

    // Desktop only for camera (mobile file uploader has built-in camera)
    get isDesktopDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /iphone|ipad|ipod|android|blackberry|windows phone|mobile/i.test(userAgent);
        const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
        return !isMobile && !isTablet;
    }

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
        if (this.searchTerm) {
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
        this.loadShiftEndLogsWithCrewInfo();
    }

    // Load shift end logs with crew information
    loadShiftEndLogsWithCrewInfo() {
        if (!this.recordId) {
            this.isLoading = false;
            this.hasError = true;
            this.errorMessage = 'No record ID provided';
            return;
        }

        getShiftEndLogsWithCrewInfo({ jobId: this.recordId })
            .then(data => {
                // Extract crew information
                if (data.crewInfo) {
                    this.crewLeaderId = data.crewInfo.crewLeaderId;
                    this.crewIds = data.crewInfo.crewIds || [];
                    console.log('Crew Leader ID:', this.crewLeaderId);
                    console.log('Crew IDs where user is leader:', this.crewIds);
                }

                // Extract and process shift end logs
                this.shiftEndLogs = data.shiftEndLogs.map(wrapper => {
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
                        wfrecon__Notes_to_Office__c: log.wfrecon__Notes_to_Office__c,
                        CreatedBy: log.CreatedBy,
                        formattedDate: this.formatDate(log.wfrecon__Work_Performed_Date__c),
                        hasExceptions: log.wfrecon__Exceptions__c && log.wfrecon__Exceptions__c.trim() !== '',
                        createdByName: log.CreatedBy?.Name || 'Unknown User',
                        statusVariant: this.getStatusVariant(log.wfrecon__Log_Type__c),
                        // Display properties with dash for empty values
                        displayWorkPerformed: log.wfrecon__Work_Performed__c || '-',
                        displayExceptions: log.wfrecon__Exceptions__c || '-',
                        displayPlanForTomorrow: log.wfrecon__Plan_for_Tomorrow__c || '-',
                        displayNotesToOffice: log.wfrecon__Notes_to_Office__c || '-',
                        exceptionContentClass: (log.wfrecon__Exceptions__c && log.wfrecon__Exceptions__c.trim() !== '') ? 'exception-content' : 'plan-content',
                        images: images.map(img => ({
                            Id: img.Id,
                            ContentDocumentId: img.ContentDocumentId,
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
            })
            .catch(error => {
                this.hasError = true;
                this.errorMessage = error.body?.message || 'Error loading shift end logs and crew info';
                this.showToast('Error', this.errorMessage, 'error');
            })
            .finally(() => {
                this.isLoading = false;
                this.filterLogs();
            });
    }

    // Handle search functionality
    handleSearch(event) {
        this.searchTerm = event.target.value.toLowerCase();
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
                planForTomorrow: logToEdit.wfrecon__Plan_for_Tomorrow__c || '',
                notesToOffice: logToEdit.wfrecon__Notes_to_Office__c || ''
            };

            // Load existing images
            this.existingImages = logToEdit.images ? logToEdit.images.map(img => ({
                id: img.ContentDocumentId,
                versionId: img.Id,
                name: img.Title + '.' + img.FileExtension,
                url: `/sfc/servlet.shepherd/document/download/${img.ContentDocumentId}`,
                isExisting: true
            })) : [];
            
            // Reset new uploads and delete tracking
            this.newUploadedFiles = [];
            this.imagesToDelete = [];
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
            planForTomorrow: '',
            notesToOffice: ''
        };
        this.existingImages = [];
        this.newUploadedFiles = [];
        this.imagesToDelete = [];
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
    async handleSaveEdit() {
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
            wfrecon__Plan_for_Tomorrow__c: this.editFormData.planForTomorrow,
            wfrecon__Notes_to_Office__c: this.editFormData.notesToOffice
        };

        this.isLoading = true;

        try {
            // Combined update: delete removed images and update log entry
            await updateShiftEndLogWithImages({ 
                logEntry: formData, 
                contentDocumentIdsToDelete: this.imagesToDelete 
            });

            this.showToast('Success', 'Shift End Log updated successfully', 'success');
            this.handleCloseModal();
            this.loadShiftEndLogsWithCrewInfo();
        } catch (error) {
            const errorMessage = error.body?.message || 'Error updating shift end log';
            this.showToast('Error', errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }   

    // Handle file upload
    handleUploadFinished(event) {
        const uploadedFilesFromEvent = event.detail.files;
        uploadedFilesFromEvent.forEach(file => {
            this.newUploadedFiles.push({
                id: file.documentId,
                name: file.name,
                url: `/sfc/servlet.shepherd/document/download/${file.documentId}`,
                isExisting: false
            });
        });
        this.showToast('Success', `${uploadedFilesFromEvent.length} file(s) uploaded successfully`, 'success');
    }

    // Handle remove image
    handleRemoveImage(event) {
        const imageId = event.currentTarget.dataset.id;
        const isExisting = event.currentTarget.dataset.existing === 'true';
        const isCamera = event.currentTarget.dataset.camera === 'true';

        if (isExisting) {
            // Mark existing image for deletion
            this.imagesToDelete.push(imageId);
            this.existingImages = this.existingImages.filter(img => img.id !== imageId);
        } else {
            // Remove from newly uploaded files (including camera photos)
            this.newUploadedFiles = this.newUploadedFiles.filter(img => img.id !== imageId);
        }

        this.showToast('Success', 'Image removed', 'success');
    }

    // Get all images (existing + new)
    get allImages() {
        return [...this.existingImages, ...this.newUploadedFiles];
    }

    get hasImages() {
        return this.allImages.length > 0;
    }

    // Camera Functions
    handleOpenCamera() {
        this.showCameraModal = true;
        this.capturedPhoto = null;
        
        // Wait for modal to render, then start camera
        setTimeout(() => {
            this.startCamera();
        }, 100);
    }

    async startCamera() {
        try {
            const videoElement = this.template.querySelector('.camera-video');
            if (videoElement) {
                this.cameraStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment', // Use back camera by default
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    } 
                });
                videoElement.srcObject = this.cameraStream;
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.showToast('Error', 'Unable to access camera. Please check permissions.', 'error');
            this.closeCameraModal();
        }
    }

    handleCapturePhoto() {
        const videoElement = this.template.querySelector('.camera-video');
        const canvasElement = this.template.querySelector('.camera-canvas');
        
        if (videoElement && canvasElement && videoElement.videoWidth > 0) {
            const context = canvasElement.getContext('2d');
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            
            // Get image data URL
            this.capturedPhoto = canvasElement.toDataURL('image/jpeg', 0.9);
            
            // Stop camera stream after capture
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(track => track.stop());
                this.cameraStream = null;
            }
        } else {
            this.showToast('Error', 'Camera not ready. Please try again.', 'error');
        }
    }

    handleRetakePhoto() {
        this.capturedPhoto = null;
        // Restart camera
        setTimeout(() => {
            this.startCamera();
        }, 100);
    }

    handleSaveCapturedPhoto() {
        if (!this.capturedPhoto) return;
        
        try {
            // Convert base64 to blob for size validation
            const base64Data = this.capturedPhoto.split(',')[1];
            const blob = this.base64ToBlob(base64Data, 'image/jpeg');
            
            // Check file size (4MB limit)
            const fileSizeInMB = blob.size / (1024 * 1024);
            if (fileSizeInMB > 8) {
                this.showToast('Error', 'Photo size exceeds 8MB limit. Please try again.', 'error');
                return;
            }
            
            // Create file name
            const fileName = `Camera_${new Date().getTime()}.jpg`;
            
            // Store temporarily in uploaded files list
            this.newUploadedFiles.push({
                id: `temp_${new Date().getTime()}`,
                name: fileName,
                url: this.capturedPhoto,
                isExisting: false,
                isCamera: true,
                base64Data: base64Data
            });
            
            this.closeCameraModal();
            this.showToast('Success', 'Photo captured successfully', 'success');
        } catch (error) {
            console.error('Error saving photo:', error);
            this.showToast('Error', 'Failed to capture photo: ' + error.message, 'error');
        }
    }

    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    closeCameraModal() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        this.showCameraModal = false;
        this.capturedPhoto = null;
    }

    // Handle image preview (for card view - opens in Salesforce)
    handleImagePreview(event) {
        event.stopPropagation();
        const contentDocumentId = event.currentTarget.dataset.id;
        const versionId = event.currentTarget.dataset.versionId;
        
        this[NavigationMixin.Navigate]({
            type: 'standard__namedPage',
            attributes: {
                pageName: 'filePreview'
            },
            state: {
                selectedRecordId: contentDocumentId || versionId
            }
        });
    }

    // Handle image preview in modal (opens in Salesforce - same as card view)
    handleModalImagePreview(event) {
        event.stopPropagation();
        const contentDocumentId = event.currentTarget.dataset.id;
        const versionId = event.currentTarget.dataset.versionId;
        
        this[NavigationMixin.Navigate]({
            type: 'standard__namedPage',
            attributes: {
                pageName: 'filePreview'
            },
            state: {
                selectedRecordId: contentDocumentId || versionId
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

    // Handle delete button click
    handleDelete(event) {
        event.stopPropagation();
        const logId = event.currentTarget.dataset.id;
        const logName = event.currentTarget.dataset.name;
        
        // Show confirmation modal
        this.confirmationTitle = 'Delete Shift End Log';
        this.confirmationMessage = `Are you sure you want to delete <strong>${logName}</strong>? This action cannot be undone.`;
        this.confirmationButtonLabel = 'Delete';
        this.confirmationButtonVariant = 'destructive';
        this.confirmationAction = 'deleteLog';
        this.confirmationData = logId;
        this.showConfirmationModal = true;
    }

    // Handle confirmation modal confirm action
    handleConfirmationConfirm() {
        try {
            switch (this.confirmationAction) {
                case 'deleteLog':
                    this.showConfirmationModal = false;
                    this.proceedWithLogDeletion(this.confirmationData);
                    break;
                default:
                    this.showConfirmationModal = false;
                    break;
            }
        } catch (error) {
            this.showToast('Error', 'An error occurred while processing the action', 'error');
            this.showConfirmationModal = false;
        } finally {
            this.resetConfirmationState();
        }
    }

    // Handle confirmation modal cancel action
    handleConfirmationCancel() {
        this.showConfirmationModal = false;
        this.resetConfirmationState();
    }

    // Handle confirmation modal close action
    handleConfirmationClose() {
        this.showConfirmationModal = false;
        this.resetConfirmationState();
    }

    // Reset confirmation modal state
    resetConfirmationState() {
        this.confirmationTitle = '';
        this.confirmationMessage = '';
        this.confirmationAction = '';
        this.confirmationButtonLabel = 'Confirm';
        this.confirmationButtonVariant = 'brand';
        this.confirmationData = null;
    }

    // Proceed with actual deletion after confirmation
    proceedWithLogDeletion(logId) {
        this.isLoading = true;
        
        deleteShiftEndLog({ logId: logId })
            .then(result => {
                if (result.includes('Success')) {
                    this.showToast('Success', 'Shift end log deleted successfully', 'success');
                    this.loadShiftEndLogsWithCrewInfo();
                } else {
                    this.showToast('Error', 'Unable to delete shift end log. Please try again.', 'error');
                }
            })
            .catch(error => {
                const errorMessage = error.body?.message || 'Error deleting shift end log';
                this.showToast('Error', errorMessage, 'error');
            })
            .finally(() => {
                this.isLoading = false;
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