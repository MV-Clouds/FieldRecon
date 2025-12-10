import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getUnapprovedLogEntries from '@salesforce/apex/ApproveShiftEndLogsController.getUnapprovedLogEntries';
import getLogEntryDetails from '@salesforce/apex/ApproveShiftEndLogsController.getLogEntryDetails';
import deleteContentDocument from '@salesforce/apex/ApproveShiftEndLogsController.deleteContentDocument';
import processLogEntryApproval from '@salesforce/apex/ApproveShiftEndLogsController.processLogEntryApproval';
import getChatterFeedItems from '@salesforce/apex/ShiftEndLogEntriesController.getChatterFeedItems';
import saveCameraPhoto from '@salesforce/apex/ApproveShiftEndLogsController.saveCameraPhoto';
import linkChatterFiles from '@salesforce/apex/ApproveShiftEndLogsController.linkChatterFiles';
import checkUserAccess from '@salesforce/apex/ApproveShiftEndLogsController.checkUserAccess';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ApproveShiftEndLogs extends NavigationMixin(LightningElement) {
    @track hasAccess = false;
    @track logEntriesRaw = [];
    @track filteredLogEntriesRaw = [];
    @track shownLogEntriesRaw = [];
    @track isLoading = false;
    @track searchTerm = '';
    @track selectedDateFilter = 'last7days';
    @track showModal = false;
    @track selectedLog = null;
    @track modalNotes = '';
    @track logEntryDetails = null;
    @track activeTab = 'timesheets';
    @track editedFields = {};
    @track editedLocationProcesses = {};
    @track currentPage = 1;
    @track pageSize = 20;
    @track visiblePages = 5;
    
    // State tracking for approvals and rejections
    @track timesheetApprovals = {}; // { timesheetId: 'approved' | 'rejected' | 'pending' }
    @track timesheetItemApprovals = {}; // { itemId: 'approved' | 'rejected' | 'pending' }
    @track locationProcessApprovals = {}; // { locationProcessId: 'approved' | 'rejected' | 'pending' }
    @track newAttachments = []; // Array of new file IDs uploaded
    @track removedAttachments = []; // Array of removed file IDs
    @track allLocationProcesses = []; // All location processes for the job
    @track groupedLocationProcesses = []; // Location processes grouped by location
    @track selectedLocationProcessFilter = 'pendingApproval'; // Filter: 'pendingApproval', 'unchanged', 'all'
    
    // Confirmation modal state
    @track showConfirmModal = false;
    @track confirmModalTitle = '';
    @track confirmModalMessage = '';
    @track confirmModalAction = null;
    @track confirmModalContext = null;

    // Image chatter state
    @track showChatterModal = false;
    @track chatterFeedItems = [];
    @track isLoadingChatter = false;
    @track isLoadingMoreChatter = false;
    @track chatterDaysOffset = 0;
    @track hasMoreChatterItems = true;

    @track showCameraModal = false;
    @track cameraStream = null;
    @track capturedPhoto = null;

    @track logColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Action', fieldName: 'actions', style: 'width: 6rem' },
        {
            label: 'Job Number',
            fieldName: 'jobNumber',
            isLink: true,
            recordIdField: 'jobId',
            style: 'width: 12rem'
        },
        { label: 'Job Name', fieldName: 'jobName', style: 'width: 15rem' },
        { label: 'Entry Number', fieldName: 'entryNumber', style: 'width: 10rem' },
        { label: 'Submitted Date', fieldName: 'submittedDate', style: 'width: 12rem' },
        { label: 'Submitted By', fieldName: 'submittedBy', style: 'width: 12rem' }
    ];

    dateFilterOptions = [
        { label: 'Last 7 Days', value: 'last7days' },
        { label: 'Last 15 Days', value: 'last15days' },
        { label: 'Last 30 Days', value: 'last30days' },
        { label: 'All Time', value: 'alltime' }
    ];

    locationProcessFilterOptions = [
        { label: 'Processes Pending for Approval', value: 'pendingApproval' },
        { label: 'Processes Not Updated', value: 'unchanged' },
        { label: 'All Location Processes', value: 'all' }
    ];

    /**
     * Method Name: connectedCallback
     * @description: Lifecycle hook - check user access before loading data
     */
    connectedCallback() {
        this.checkAccessPermissions();
    }

    /**
     * Method Name: checkAccessPermissions
     * @description: Check if current user has access to view this component
     */
    checkAccessPermissions() {
        this.isLoading = true;
        checkUserAccess()
            .then(result => {
                this.hasAccess = result;
                if (this.hasAccess) {
                    this.loadLogEntries();
                } else {
                    this.isLoading = false;
                }
            })
            .catch(error => {
                console.error('Error checking user access:', error);
                this.isLoading = false;
                this.showToast('Error', 'Error checking access permissions', 'error');
            });
    }

    /**
     * Method Name: hasAttachments
     * @description: Check if log entry has attachments
     */
    get hasAttachments() {
        return this.logEntryDetails?.attachments && this.logEntryDetails.attachments.length > 0;
    }

    // Tab visibility getters
    get isTimesheetsTab() {
        return this.activeTab === 'timesheets';
    }

    get isLocationsTab() {
        return this.activeTab === 'locations';
    }

    get isDetailsTab() {
        return this.activeTab === 'details';
    }

    get isGalleryTab() {
        return this.activeTab === 'gallery';
    }

    // Tab CSS class getters
    get timesheetsTabClass() {
        return this.activeTab === 'timesheets' ? 'tab-button active' : 'tab-button';
    }

    get locationsTabClass() {
        return this.activeTab === 'locations' ? 'tab-button active' : 'tab-button';
    }

    get detailsTabClass() {
        return this.activeTab === 'details' ? 'tab-button active' : 'tab-button';
    }

    get galleryTabClass() {
        return this.activeTab === 'gallery' ? 'tab-button active' : 'tab-button';
    }

    /**
     * Method Name: showTable
     * @description: Show table only if user has access and there are records
     */
    get showTable() {
        return this.hasAccess && this.logEntries && this.logEntries.length > 0;
    }

    get totalItems() {
        return this.filteredLogEntriesRaw ? this.filteredLogEntriesRaw.length : 0;
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
     * Method Name: showNoData
     * @description: Show no data message if user has access but no records found
     */
    get showNoData() {
        return this.hasAccess && !this.isLoading && !this.isCheckingAccess && (!this.logEntries || this.logEntries.length === 0);
    }

    /**
     * Method Name: acceptedFormats
     * @description: Accepted file formats for upload
     */
    get acceptedFormats() {
        return ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    }

    /**
     * Method Name: logEntries
     * @description: This method processes raw log entries and formats them for display in the UI.
     */
    get logEntries() {
        return this.shownLogEntriesRaw.map((log, index) => {
            return {
                Id: log.Id,
                key: log.Id,
                jobId: log.jobId,
                status: log.status,
                isPending: log.status === 'Pending',
                values: this.logColumns.map(col => {
                    let cell = {
                        value: '',
                        style: col.style,
                        isActions: false,
                        recordLink: null
                    };

                    if (col.fieldName === 'srNo') {
                        cell.value = index + 1;
                    } else if (col.fieldName === 'actions') {
                        cell.isActions = true;
                    } else if (col.fieldName === 'submittedDate') {
                        cell.value = this.formatDateToDisplay(log[col.fieldName]);
                    } else {
                        cell.value = log[col.fieldName] || '--';

                        if (col.isLink && col.recordIdField) {
                            cell.recordLink = `/${log[col.recordIdField]}`;
                        }
                    }

                    return cell;
                })
            };
        });
    }

    get hasChatterFeedItems() {
        return this.chatterFeedItems && this.chatterFeedItems.length > 0;
    }

    /**
     * Method Name: renderedCallback
     * @description: Initialize slider visuals after render
     */
    renderedCallback() {
        // Only initialize if we're on the locations tab and modal is open
        if (this.showModal && this.activeTab === 'locations' && this.logEntryDetails?.locationProcesses) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                this.initializeAllSliders();
            });
        }
    }

    /**
     * Method Name: handleTabClick
     * @description: Handle tab click and initialize sliders for location tab
     */
    handleTabClick(event) {
        const tabValue = event.currentTarget.dataset.tab;
        this.activeTab = tabValue;
        
        // Initialize sliders when switching to location tab
        if (this.activeTab === 'locations' && this.logEntryDetails?.locationProcesses) {
            // Use multiple timing strategies to ensure DOM is ready
            setTimeout(() => {
                this.initializeAllSliders();
            }, 50);
            
            setTimeout(() => {
                this.initializeAllSliders();
            }, 200);
        }
    }

    /**
     * Method Name: initializeAllSliders
     * @description: Initialize all sliders with proper section rendering
     */
    initializeAllSliders() {
        if (!this.logEntryDetails?.locationProcesses) return;
        
        this.logEntryDetails.locationProcesses.forEach(lp => {
            this.updateSliderVisuals(lp.id, lp.oldValue, lp.currentPercent);
        });
    }

    /**
     * Method Name: updateSliderVisuals
     * @description: Update slider section widths and colors
     */
    updateSliderVisuals(processId, previousPercent, currentPercent) {
        // Find the slider input element
        const sliderInput = this.template.querySelector(`input.progress-slider[data-id="${processId}"]`);
        if (!sliderInput) {
            return;
        }
        
        const sliderContainer = sliderInput.closest('.slider-wrapper');
        if (!sliderContainer) {
            return;
        }
        
        const sliderTrack = sliderContainer.querySelector('.slider-track');
        if (!sliderTrack) {
            return;
        }

        const completedSection = sliderTrack.querySelector('.slider-section.completed');
        const todaySection = sliderTrack.querySelector('.slider-section.today');
        const remainingSection = sliderTrack.querySelector('.slider-section.remaining');
        
        if (completedSection && todaySection && remainingSection) {
            const todayWidth = Math.max(0, currentPercent - previousPercent);
            const remainingWidth = Math.max(0, 100 - currentPercent);
            
            // Set widths for all sections
            completedSection.style.flexBasis = `${previousPercent}%`;
            completedSection.style.width = `${previousPercent}%`;
            completedSection.style.minWidth = previousPercent > 0 ? '2px' : '0';
            
            todaySection.style.flexBasis = `${todayWidth}%`;
            todaySection.style.width = `${todayWidth}%`;
            todaySection.style.minWidth = todayWidth > 0 ? '2px' : '0';
            
            remainingSection.style.flexBasis = `${remainingWidth}%`;
            remainingSection.style.width = `${remainingWidth}%`;
            remainingSection.style.minWidth = remainingWidth > 0 ? '2px' : '0';
            
            // Apply correct classes
            todaySection.classList.remove('pending-approval');
            todaySection.classList.add('today');
            
            // Position the slider input to only cover the draggable range (from oldValue to 100)
            const draggableWidth = 100 - previousPercent;
            sliderInput.style.left = `${previousPercent}%`;
            sliderInput.style.width = `${draggableWidth}%`;
        }
        
        // Update percentage display
        const locationContainer = sliderInput.closest('.location-slider-container');
        if (locationContainer) {
            const percentageDisplay = locationContainer.querySelector('.progress-percentage');
            if (percentageDisplay) {
                percentageDisplay.textContent = `${currentPercent.toFixed(1)}% Complete`;
            }
            
            // Update labels
            const labelsContainer = locationContainer.querySelector('.slider-labels');
            if (labelsContainer) {
                const todayPercent = Math.max(0, currentPercent - previousPercent);
                const remainingPercent = Math.max(0, 100 - currentPercent);
                
                // Update the text content directly by finding and updating the data
                const processData = this.logEntryDetails.locationProcesses.find(lp => lp.id === processId);
                if (processData) {
                    processData.todayPercent = parseFloat(todayPercent.toFixed(1));
                    processData.remainingPercent = parseFloat(remainingPercent.toFixed(1));
                }
            }
        }
    }

    /**
     * Method Name: loadLogEntries
     * @description: Method is used to load log entries from the server (only called if user has access)
     */
    loadLogEntries() {
        if (!this.hasAccess) {
            return;
        }
        this.isLoading = true;
        getUnapprovedLogEntries({
            dateFilter: this.selectedDateFilter
        })
            .then(response => {
                this.logEntriesRaw = response.entries || [];
                this.applyFilters();
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error loading log entries:', error);
                this.showToast('Error', 'Failed to load log entries', 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleSearch
     * @description: Method is used to handle the search
     */
    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.applyFilters();
    }

    /**
     * Method Name: handleRefresh
     * @description: Method is used to refresh/reload all data
     */
    handleRefresh() {
        // Reset search and filters
        this.searchTerm = '';
        this.currentPage = 1;
        
        // Clear the search input
        const searchInput = this.template.querySelector('lightning-input[type="search"]');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Reload data from server
        this.loadLogEntries();
    }

    /**
     * Method Name: handleDateFilterChange
     * @description: Method is used to handle the date filter change
     */
    handleDateFilterChange(event) {
        this.selectedDateFilter = event.target.value;
        this.loadLogEntries();
    }

    /**
     * Method Name: applyFilters
     * @description: Method is used to apply search filter in JavaScript
     */
    applyFilters() {
        // Reset to first page when filters change
        this.currentPage = 1;
        let filtered = [...this.logEntriesRaw];
        
        // Apply search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(log => {
                const jobName = (log.jobName || '').toLowerCase();
                const jobNumber = (log.jobNumber || '').toLowerCase();
                return jobName.includes(searchLower) || jobNumber.includes(searchLower);
            });
        }
        
        this.filteredLogEntriesRaw = filtered;
        
        // Update shown data for current page
        this.updateShownData();
    }

    /**
     * Method Name: handleActionClick
     * @description: Method is used to handle the action click (Edit/Review)
     */
    handleActionClick(event) {
        const logId = event.currentTarget.dataset.logid;
        const action = event.currentTarget.dataset.action;

        if (action === 'edit') {
            this.loadLogEntryDetails(logId);
        }
    }

    /**
     * Method Name: loadLogEntryDetails
     * @description: Method to load detailed log entry data and format for display
     */
    loadLogEntryDetails(logId) {
        this.isLoading = true;
        getLogEntryDetails({ logEntryId: logId })
            .then(result => {
                console.log('Log Entry Details Result:', JSON.stringify(result));
                const processedResult = JSON.parse(JSON.stringify(result)); // Deep clone
                
                // Process timesheet entries to add formatted fields
                if (processedResult.timesheetEntries) {
                    let serialNumber = 1;
                    processedResult.timesheetEntries.forEach(ts => {
                        ts.serialNumber = serialNumber++;
                        ts.approvalStatus = this.getTimesheetApprovalStatus(ts.id);
                        ts.isApproved = ts.approvalStatus === 'approved';
                        ts.isRejected = ts.approvalStatus === 'rejected';
                        
                        // Process approval fields for timesheet entry
                        if (ts.approvalFields) {
                            ts.approvalFields = ts.approvalFields.map(field => {
                                return this.formatApprovalField(field);
                            });
                        }
                        
                        // Process items
                        if (ts.items) {
                            ts.items.forEach(item => {
                                item.approvalStatus = this.getItemApprovalStatus(item.id);
                                item.isApproved = item.approvalStatus === 'approved';
                                item.isRejected = item.approvalStatus === 'rejected';
                                if (item.approvalFields) {
                                    item.approvalFields = item.approvalFields.map(field => {
                                        return this.formatApprovalField(field);
                                    });
                                }
                            });
                        }
                    });
                }
                
                // Store all location processes
                this.allLocationProcesses = [];
                if (processedResult.locationProcesses) {
                    processedResult.locationProcesses.forEach(lp => {
                        // Set current display to newValue for changed processes, currentValue for unchanged
                        const displayValue = lp.hasChanges ? lp.newValue : lp.currentValue;
                        lp.currentPercent = parseFloat(displayValue);
                        lp.previousPercent = parseFloat(lp.oldValue);
                        lp.todayPercent = parseFloat((displayValue - lp.oldValue).toFixed(1));
                        lp.remainingPercent = parseFloat((100 - displayValue).toFixed(1));
                        lp.approvalStatus = this.getLocationProcessApprovalStatus(lp.id);
                        lp.isApproved = lp.approvalStatus === 'approved';
                        lp.isRejected = lp.approvalStatus === 'rejected';
                        
                        this.allLocationProcesses.push(lp);
                    });
                }
                
                // Set initial filter to show pending approval processes if any exist
                const hasPendingChanges = this.allLocationProcesses.some(lp => lp.hasChanges);
                this.selectedLocationProcessFilter = hasPendingChanges ? 'pendingApproval' : 'all';
                
                // Group location processes by location AFTER setting the filter
                this.groupLocationProcessesByLocation();
                
                // Process attachments to add download URLs and icons
                if (processedResult.attachments) {
                    processedResult.attachments.forEach(attachment => {
                        attachment.downloadUrl = `/sfc/servlet.shepherd/document/download/${attachment.id}`;
                        attachment.name = attachment.title;
                        attachment.isNewUpload = false; // Mark as existing file (not newly uploaded)
                        if (!attachment.isImage) {
                            attachment.icon = this.getFileIcon(attachment.fileExtension);
                        }
                    });
                }
                
                this.logEntryDetails = processedResult;
                this.editedFields = {};
                this.editedLocationProcesses = {};
                this.timesheetApprovals = {};
                this.timesheetItemApprovals = {};
                this.locationProcessApprovals = {};
                this.newAttachments = [];
                this.removedAttachments = [];
                this.showModal = true;
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error loading log entry details:', error);
                this.showToast('Error', 'Failed to load log entry details: ' + error.body?.message, 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleUploadFinished
     * @description: Handle file upload completion
     */
    handleUploadFinished(event) {
        const uploadedFiles = event.detail.files;
        if (!this.logEntryDetails.attachments) {
            this.logEntryDetails.attachments = [];
        }
        
        uploadedFiles.forEach(file => {
            const fileExtension = file.name.split('.').pop();
            const isImage = this.isImageFile(fileExtension);
            
            // Track new attachment (will be deleted if user cancels)
            this.newAttachments.push(file.documentId);
            
            this.logEntryDetails.attachments.push({
                id: file.documentId,
                title: file.name,
                fileExtension: fileExtension,
                isImage: isImage,
                downloadUrl: `/sfc/servlet.shepherd/document/download/${file.documentId}`,
                name: file.name,
                icon: isImage ? null : this.getFileIcon(fileExtension),
                isNewUpload: true // Mark as newly uploaded
            });
        });
        
        this.showToast('Success', `${uploadedFiles.length} file(s) uploaded successfully`, 'success');
    }

    /**
     * Method Name: handleRemoveFile
     * @description: Handle file removal
     */
    handleRemoveFile(event) {
        const fileId = event.currentTarget.dataset.id;
        
        this.showConfirmation(
            'Remove File',
            'Are you sure you want to remove this file?',
            () => {
                const file = this.logEntryDetails.attachments.find(f => f.id === fileId);
                
                // Check if this is a newly uploaded file (not yet in database before modal opened)
                if (file && file.isNewUpload) {
                    // Remove from newAttachments tracking (no longer need to delete on cancel)
                    this.newAttachments = this.newAttachments.filter(id => id !== fileId);
                } else {
                    // Existing file - mark for deletion on approval only
                    this.removedAttachments.push(fileId);
                }
                
                // Remove from display
                this.logEntryDetails.attachments = this.logEntryDetails.attachments.filter(file => file.id !== fileId);
                this.showToast('Success', 'File marked for removal', 'success');
            },
            null
        );
    }

    /**
     * Method Name: isImageFile
     * @description: Check if file extension is an image
     */
    isImageFile(extension) {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'];
        return extension && imageExtensions.includes(extension.toLowerCase());
    }

    /**
     * Method Name: getFileIcon
     * @description: Get appropriate icon for file type based on extension
     */
    getFileIcon(extension) {
        if (!extension) return 'doctype:attachment';
        
        const ext = extension.toLowerCase();
        switch(ext) {
            case 'pdf':
                return 'doctype:pdf';
            case 'doc':
            case 'docx':
                return 'doctype:word';
            case 'xls':
            case 'xlsx':
                return 'doctype:excel';
            default:
                return 'doctype:attachment';
        }
    }

    /**
     * Method Name: formatApprovalField
     * @description: Format approval field with proper labels and values
     */
    formatApprovalField(field) {
        const formattedField = { ...field };
        
        // Add field label
        formattedField.fieldLabel = this.getFieldLabel(field.fieldApiName);
        
        // Determine field type
        const dateTimeFields = ['wfrecon__Clock_In_Time__c', 'wfrecon__Clock_Out_Time__c'];
        const numberFields = ['wfrecon__Travel_Time__c', 'wfrecon__Per_Diem__c', 'wfrecon__Premium__c'];
        
        formattedField.isDateTime = dateTimeFields.includes(field.fieldApiName);
        formattedField.isNumber = numberFields.includes(field.fieldApiName);
        
        // Format old value for display
        if (formattedField.isDateTime) {
            formattedField.oldValueFormatted = this.formatToAMPM(field.oldValue);
            formattedField.newValueFormatted = this.formatToAMPM(field.newValue);
            formattedField.newValueForInput = this.formatDateTimeForInput(field.newValue);
        } else {
            formattedField.oldValueFormatted = field.oldValue || '--';
            formattedField.newValueFormatted = field.newValue || '--';
        }
        
        return formattedField;
    }

    /**
     * Method Name: closeModal
     * @description: Method is used to close the modal
     */
    closeModal() {
        // Delete newly uploaded files if user cancels (doesn't approve)
        if (this.newAttachments.length > 0) {
            this.deleteNewlyUploadedFiles();
        }
        
        this.showModal = false;
        this.selectedLog = null;
        this.logEntryDetails = null;
        this.modalNotes = '';
        this.editedFields = {};
        this.editedLocationProcesses = {};
        this.timesheetApprovals = {};
        this.timesheetItemApprovals = {};
        this.locationProcessApprovals = {};
        this.newAttachments = [];
        this.removedAttachments = [];
        this.activeTab = 'timesheets';
    }

    /**
     * Method Name: handleFieldEdit
     * @description: Method to handle field edits for timesheet entries (editing the new values from approval data)
     * Tracks edits with key format: {recordId}.{fieldName}
     */
    handleFieldEdit(event) {
        const recordId = event.target.dataset.recordid;
        const fieldName = event.target.dataset.fieldname;
        let newValue = event.target.value;
        const inputValue = event.target.value; // Store original input value

        // Validate and convert datetime-local format
        if ((fieldName === 'wfrecon__Clock_In_Time__c' || fieldName === 'wfrecon__Clock_Out_Time__c') && newValue) {
            // Basic validation: Check if datetime is valid format YYYY-MM-DDTHH:mm
            const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
            if (!dateTimePattern.test(newValue)) {
                this.showToast('Error', 'Invalid date/time format', 'error');
                return;
            }

            // Check if clock out is after clock in for the same entry
            if (fieldName === 'wfrecon__Clock_Out_Time__c') {
                const entry = this.logEntryDetails?.timesheetEntries?.find(e => e.id === recordId);
                if (entry) {
                    const clockInField = entry.approvalFields?.find(f => f.fieldApiName === 'wfrecon__Clock_In_Time__c');
                    if (clockInField) {
                        // Get clock in value from edited fields or original
                        const clockInKey = `${recordId}.wfrecon__Clock_In_Time__c`;
                        const clockInValue = this.editedFields[clockInKey] || clockInField.newValue;
                        const clockInFormatted = clockInValue ? clockInValue.slice(0, 16) : null;
                        
                        if (clockInFormatted && newValue <= clockInFormatted) {
                            this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                            event.target.value = this.formatDateTimeForInput(clockInField.newValue); // Reset to original
                            return;
                        }
                    }
                }
            }

            // Convert to format expected by Apex DateTime.valueOf(): YYYY-MM-DD HH:mm:ss
            // Input format: YYYY-MM-DDTHH:mm
            // Output format: YYYY-MM-DD HH:mm:ss
            newValue = newValue.replace('T', ' ') + ':00';
        }

        // Validate travel time is non-negative
        if (fieldName === 'wfrecon__Travel_Time__c' && newValue) {
            const travelTime = parseFloat(newValue);
            if (isNaN(travelTime) || travelTime < 0) {
                this.showToast('Error', 'Travel time must be a positive number', 'error');
                return;
            }
            newValue = travelTime; // Convert to number
        }

        // Track the edit with key format: {recordId}.{fieldName}
        const editKey = `${recordId}.${fieldName}`;
        this.editedFields[editKey] = newValue;
        
        // Update the field value in the data structure to prevent revert on re-render
        this.logEntryDetails.timesheetEntries.forEach(ts => {
            if (ts.approvalFields) {
                ts.approvalFields.forEach(field => {
                    if (field.recordId === recordId && field.fieldApiName === fieldName) {
                        field.newValue = newValue;
                        field.newValueForInput = inputValue;
                        if (field.isDateTime) {
                            field.newValueFormatted = this.formatToAMPM(newValue);
                        } else {
                            field.newValueFormatted = newValue;
                        }
                    }
                });
            }
            
            // Also check items
            if (ts.items) {
                ts.items.forEach(item => {
                    if (item.approvalFields) {
                        item.approvalFields.forEach(field => {
                            if (field.recordId === recordId && field.fieldApiName === fieldName) {
                                field.newValue = newValue;
                                field.newValueForInput = inputValue;
                                if (field.isDateTime) {
                                    field.newValueFormatted = this.formatToAMPM(newValue);
                                } else {
                                    field.newValueFormatted = newValue;
                                }
                            }
                        });
                    }
                });
            }
        });
        
        // Reset approval status to pending when user makes changes
        this.resetTimesheetToPending(recordId);
    }

    /**
     * Method Name: handleSliderInput
     * @description: Method to handle real-time slider input (visual update only)
     */
    handleSliderInput(event) {
        const slider = event.target;
        const processId = slider.dataset.id;
        let currentValue = parseFloat(slider.value);
        const previousValue = parseFloat(slider.dataset.originalValue);
        const minValue = parseFloat(slider.min);

        // Enforce minimum value - cannot go below previousValue (completed/green section)
        // This prevents slider from moving into the green area
        if (currentValue < minValue) {
            currentValue = minValue;
            slider.value = minValue;
            return; // Exit early, don't update visuals
        }

        // Update visual progress in real-time
        const sliderContainer = slider.closest('.slider-wrapper');
        if (sliderContainer) {
            const sliderTrack = sliderContainer.querySelector('.slider-track');
            if (sliderTrack) {
                const todayPercent = Math.max(0, currentValue - previousValue);
                const remainingPercent = Math.max(0, 100 - currentValue);

                const completed = sliderTrack.querySelector('.slider-section.completed');
                const today = sliderTrack.querySelector('.slider-section.today');
                const remaining = sliderTrack.querySelector('.slider-section.remaining');

                if (completed && today && remaining) {
                    completed.style.flexBasis = `${previousValue}%`;
                    completed.style.width = `${previousValue}%`;
                    completed.style.minWidth = previousValue > 0 ? '2px' : '0';
                    
                    today.style.flexBasis = `${todayPercent}%`;
                    today.style.width = `${todayPercent}%`;
                    today.style.minWidth = todayPercent > 0 ? '2px' : '0';
                    
                    remaining.style.flexBasis = `${remainingPercent}%`;
                    remaining.style.width = `${remainingPercent}%`;
                    remaining.style.minWidth = remainingPercent > 0 ? '2px' : '0';
                    
                    // Keep slider positioned correctly
                    const draggableWidth = 100 - previousValue;
                    slider.style.left = `${previousValue}%`;
                    slider.style.width = `${draggableWidth}%`;
                }
            }
        }

        // Update percentage display
        const locationContainer = slider.closest('.location-slider-container');
        if (locationContainer) {
            const percentageDisplay = locationContainer.querySelector('.progress-percentage');
            if (percentageDisplay) {
                percentageDisplay.textContent = `${currentValue.toFixed(1)}% Complete`;
            }

            // Update labels
            const labelsContainer = locationContainer.querySelector('.slider-labels');
            if (labelsContainer) {
                const todayLabel = labelsContainer.querySelector('.label-today');
                if (todayLabel) {
                    // Find the text node after the SVG
                    const textNodes = Array.from(todayLabel.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                    if (textNodes.length > 0) {
                        textNodes[0].textContent = `Today: ${todayPercent.toFixed(1)}%`;
                    }
                }
                const remainingLabel = labelsContainer.querySelector('.label-remaining');
                if (remainingLabel) {
                    const textNodes = Array.from(remainingLabel.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                    if (textNodes.length > 0) {
                        textNodes[0].textContent = `Remaining: ${remainingPercent.toFixed(1)}%`;
                    }
                }
            }
        }
    }

    /**
     * Method Name: handleSliderChange
     * @description: Method to handle slider change on release (save value)
     */
    handleSliderChange(event) {
        const slider = event.target;
        const processId = slider.dataset.id;
        const hasChanges = slider.dataset.hasChanges === 'true';
        const newValue = parseFloat(parseFloat(slider.value).toFixed(1));

        this.editedLocationProcesses[processId] = newValue;
        
        // Update in allLocationProcesses array
        const lpInAll = this.allLocationProcesses.find(l => l.id === processId);
        if (lpInAll) {
            const originalValue = hasChanges ? lpInAll.oldValue : lpInAll.currentValue;
            lpInAll.newValue = newValue;
            lpInAll.currentPercent = newValue;
            lpInAll.todayPercent = parseFloat((newValue - originalValue).toFixed(1));
            lpInAll.remainingPercent = parseFloat((100 - newValue).toFixed(1));
            
            // Mark as user-edited if user modified an unchanged process (no approval needed)
            if (!hasChanges && newValue !== lpInAll.currentValue) {
                lpInAll.isUserEdited = true;
                lpInAll.oldValue = lpInAll.currentValue;
                // Don't set status or hasChanges - no approval needed for user edits
            }
        }
        
        // Re-group to update UI
        this.groupLocationProcessesByLocation();
        
        // Only reset approval status if process already had changes
        if (hasChanges) {
            this.resetLocationProcessToPending(processId);
        }
        
        // Trigger final visual update
        this.handleSliderInput(event);
    }

    /**
     * Method Name: handleLogFieldChange
     * @description: Method to handle log entry field changes
     */
    handleLogFieldChange(event) {
        const fieldName = event.target.dataset.field;
        const newValue = event.target.value;

        this.logEntryDetails[fieldName] = newValue;
    }

    /**
     * Method Name: handleApproveTimesheet
     * @description: Method to approve individual timesheet
     */
    handleApproveTimesheet(event) {
        const recordId = event.target.dataset.recordid;
        this.timesheetApprovals[recordId] = 'approved';
        
        // Also approve all items under this timesheet
        const tsEntry = this.logEntryDetails.timesheetEntries.find(ts => ts.id === recordId);
        if (tsEntry) {
            tsEntry.approvalStatus = 'approved';
            tsEntry.isApproved = true;
            tsEntry.isRejected = false;
            if (tsEntry.items) {
                tsEntry.items.forEach(item => {
                    this.timesheetItemApprovals[item.id] = 'approved';
                    item.approvalStatus = 'approved';
                    item.isApproved = true;
                    item.isRejected = false;
                });
            }
        }
        
        // Trigger reactivity
        this.logEntryDetails = { ...this.logEntryDetails };
        this.showToast('Success', 'Timesheet marked for approval', 'success');
    }

    /**
     * Method Name: handleRejectTimesheet
     * @description: Method to reject individual timesheet
     */
    handleRejectTimesheet(event) {
        const recordId = event.target.dataset.recordid;
        this.timesheetApprovals[recordId] = 'rejected';
        
        // Also reject all items under this timesheet
        const tsEntry = this.logEntryDetails.timesheetEntries.find(ts => ts.id === recordId);
        if (tsEntry) {
            tsEntry.approvalStatus = 'rejected';
            tsEntry.isApproved = false;
            tsEntry.isRejected = true;
            if (tsEntry.items) {
                tsEntry.items.forEach(item => {
                    this.timesheetItemApprovals[item.id] = 'rejected';
                    item.approvalStatus = 'rejected';
                    item.isApproved = false;
                    item.isRejected = true;
                });
            }
        }
        
        // Trigger reactivity
        this.logEntryDetails = { ...this.logEntryDetails };
        this.showToast('Success', 'Timesheet marked for rejection', 'success');
    }

    /**
     * Method Name: handleApproveItem
     * @description: Method to approve individual timesheet item
     */
    handleApproveItem(event) {
        const recordId = event.target.dataset.recordid;
        this.timesheetItemApprovals[recordId] = 'approved';
        
        // Update UI
        this.logEntryDetails.timesheetEntries.forEach(ts => {
            if (ts.items) {
                const item = ts.items.find(i => i.id === recordId);
                if (item) {
                    item.approvalStatus = 'approved';
                    item.isApproved = true;
                    item.isRejected = false;
                }
            }
        });
        
        // Trigger reactivity
        this.logEntryDetails = { ...this.logEntryDetails };
        this.showToast('Success', 'Item marked for approval', 'success');
    }

    /**
     * Method Name: handleRejectItem
     * @description: Method to reject individual timesheet item
     */
    handleRejectItem(event) {
        const recordId = event.target.dataset.recordid;
        this.timesheetItemApprovals[recordId] = 'rejected';
        
        // Update UI
        this.logEntryDetails.timesheetEntries.forEach(ts => {
            if (ts.items) {
                const item = ts.items.find(i => i.id === recordId);
                if (item) {
                    item.approvalStatus = 'rejected';
                    item.isApproved = false;
                    item.isRejected = true;
                }
            }
        });
        
        // Trigger reactivity
        this.logEntryDetails = { ...this.logEntryDetails };
        this.showToast('Success', 'Item marked for rejection', 'success');
    }

    /**
     * Method Name: handleBulkApproveTimesheets
     * @description: Method to approve all timesheets
     */
    handleBulkApproveTimesheets() {
        if (this.logEntryDetails?.timesheetEntries) {
            this.logEntryDetails.timesheetEntries.forEach(ts => {
                this.timesheetApprovals[ts.id] = 'approved';
                ts.approvalStatus = 'approved';
                ts.isApproved = true;
                ts.isRejected = false;
                
                // Also approve all items
                if (ts.items) {
                    ts.items.forEach(item => {
                        this.timesheetItemApprovals[item.id] = 'approved';
                        item.approvalStatus = 'approved';
                        item.isApproved = true;
                        item.isRejected = false;
                    });
                }
            });
            
            // Trigger reactivity
            this.logEntryDetails = { ...this.logEntryDetails };
            this.showToast('Success', 'All timesheets marked for approval', 'success');
        }
    }

    /**
     * Method Name: handleBulkRejectTimesheets
     * @description: Method to reject all timesheets
     */
    handleBulkRejectTimesheets() {
        if (this.logEntryDetails?.timesheetEntries) {
            this.logEntryDetails.timesheetEntries.forEach(ts => {
                this.timesheetApprovals[ts.id] = 'rejected';
                ts.approvalStatus = 'rejected';
                ts.isApproved = false;
                ts.isRejected = true;
                
                // Also reject all items
                if (ts.items) {
                    ts.items.forEach(item => {
                        this.timesheetItemApprovals[item.id] = 'rejected';
                        item.approvalStatus = 'rejected';
                        item.isApproved = false;
                        item.isRejected = true;
                    });
                }
            });
            
            // Trigger reactivity
            this.logEntryDetails = { ...this.logEntryDetails };
            this.showToast('Success', 'All timesheets marked for rejection', 'success');
        }
    }

    /**
     * Method Name: handleApproveLocation
     * @description: Method to approve individual location process
     */
    handleApproveLocation(event) {
        const recordId = event.target.dataset.recordid;
        this.locationProcessApprovals[recordId] = 'approved';
        
        // Update in allLocationProcesses
        const lp = this.allLocationProcesses.find(l => l.id === recordId);
        if (lp) {
            lp.approvalStatus = 'approved';
            lp.isApproved = true;
            lp.isRejected = false;
        }
        
        // Re-group to update UI
        this.groupLocationProcessesByLocation();
        this.showToast('Success', 'Location process marked for approval', 'success');
    }

    /**
     * Method Name: handleRejectLocation
     * @description: Method to reject individual location process
     */
    handleRejectLocation(event) {
        const recordId = event.target.dataset.recordid;
        this.locationProcessApprovals[recordId] = 'rejected';
        
        // Update in allLocationProcesses
        const lp = this.allLocationProcesses.find(l => l.id === recordId);
        if (lp) {
            lp.approvalStatus = 'rejected';
            lp.isApproved = false;
            lp.isRejected = true;
        }
        
        // Re-group to update UI
        this.groupLocationProcessesByLocation();
        this.showToast('Success', 'Location process marked for rejection', 'success');
    }

    /**
     * Method Name: handleBulkApproveLocations
     * @description: Method to approve all currently displayed location processes
     */
    handleBulkApproveLocations() {
        if (this.groupedLocationProcesses && this.groupedLocationProcesses.length > 0) {
            // Approve all processes in all displayed location groups
            this.groupedLocationProcesses.forEach(locationGroup => {
                locationGroup.processes.forEach(lp => {
                    // Only approve processes with changes
                    if (lp.hasChanges) {
                        this.locationProcessApprovals[lp.id] = 'approved';
                        
                        // Update in allLocationProcesses
                        const lpInAll = this.allLocationProcesses.find(l => l.id === lp.id);
                        if (lpInAll) {
                            lpInAll.approvalStatus = 'approved';
                            lpInAll.isApproved = true;
                            lpInAll.isRejected = false;
                        }
                    }
                });
            });
            
            // Re-group to update UI
            this.groupLocationProcessesByLocation();
            this.showToast('Success', 'All displayed location processes marked for approval', 'success');
        }
    }

    /**
     * Method Name: handleBulkRejectLocations
     * @description: Method to reject all currently displayed location processes
     */
    handleBulkRejectLocations() {
        if (this.groupedLocationProcesses && this.groupedLocationProcesses.length > 0) {
            // Reject all processes in all displayed location groups
            this.groupedLocationProcesses.forEach(locationGroup => {
                locationGroup.processes.forEach(lp => {
                    // Only reject processes with changes
                    if (lp.hasChanges) {
                        this.locationProcessApprovals[lp.id] = 'rejected';
                        
                        // Update in allLocationProcesses
                        const lpInAll = this.allLocationProcesses.find(l => l.id === lp.id);
                        if (lpInAll) {
                            lpInAll.approvalStatus = 'rejected';
                            lpInAll.isApproved = false;
                            lpInAll.isRejected = true;
                        }
                    }
                });
            });
            
            // Re-group to update UI
            this.groupLocationProcessesByLocation();
            this.showToast('Success', 'All displayed location processes marked for rejection', 'success');
        }
    }

    /**
     * Method Name: handleAddImages
     * @description: Method to add images
     */
    handleAddImages() {
        this.showToast('Info', 'Add Images - Coming Soon', 'info');
    }

    /**
     * Method Name: handleDeleteAttachment
     * @description: Method to delete attachment
     */
    handleDeleteAttachment(event) {
        const attachmentId = event.target.dataset.attachmentid;
        this.showToast('Info', 'Delete Attachment - Coming Soon', 'info');
    }

    /**
     * Method Name: handleSaveChanges
     * @description: Method to save all changes with validation and processing
     */
    handleSaveChanges() {
        // Validate required fields first
        if (!this.validateRequiredFields()) {
            return;
        }
        
        // Only validate approval state if there are items to review
        if (this.hasItemsToReview) {
            const validationResult = this.validateApprovalState();
            
            if (!validationResult.isValid) {
                this.showToast('Error', validationResult.message, 'error');
                return;
            }
        }
        
        // Prepare approval data
        const approvalData = this.prepareApprovalData();
        
        // Determine log entry status based on approvals/rejections
        const logEntryStatus = this.determineLogEntryStatus(approvalData);
        
        if (logEntryStatus === 'Rejected') {
            this.showConfirmation(
                'Reject Log Entry',
                'All items are rejected. This will mark the entire log entry as Rejected. Continue?',
                () => this.processSaveChanges(approvalData, logEntryStatus),
                null
            );
            return;
        }
        
        // Proceed with save
        this.processSaveChanges(approvalData, logEntryStatus);
    }
    
    /**
     * Method Name: processSaveChanges
     * @description: Process the save changes after confirmation
     */
    processSaveChanges(approvalData, logEntryStatus) {
        // Store log entry ID before closing modal
        const logEntryId = this.logEntryDetails.Id;
        
        // Close modal immediately to prevent multiple clicks
        this.showModal = false;
        this.isLoading = true;
        
        // Call Apex to process the approval
        processLogEntryApproval({
            logEntryId: logEntryId,
            approvalData: JSON.stringify(approvalData),
            logEntryStatus: logEntryStatus,
            logEntryUpdates: JSON.stringify({
                workPerformed: this.logEntryDetails.workPerformed,
                planForTomorrow: this.logEntryDetails.planForTomorrow,
                exceptions: this.logEntryDetails.exceptions,
                notesToOffice: this.logEntryDetails.notesToOffice
            })
        })
            .then(() => {
                this.showToast('Success', 'Changes saved successfully', 'success');
                // Clear newAttachments since they're now permanent (saved)
                this.newAttachments = [];
                // Clear modal data
                this.selectedLog = null;
                this.logEntryDetails = null;
                this.modalNotes = '';
                this.editedFields = {};
                this.editedLocationProcesses = {};
                this.timesheetApprovals = {};
                this.timesheetItemApprovals = {};
                this.locationProcessApprovals = {};
                this.removedAttachments = [];
                this.activeTab = 'timesheets';
                
                this.loadLogEntries(); // Refresh the list
            })
            .catch(error => {
                console.error('Error saving changes:', error);
                this.showToast('Error', 'Failed to save changes: ' + (error.body?.message || error.message), 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    
    /**
     * Method Name: validateApprovalState
     * @description: Validate that all items have been reviewed before approval
     */
    validateApprovalState() {
        const result = { isValid: true, message: '' };
        const pendingItems = [];
        
        // Check timesheets and their items
        if (this.logEntryDetails?.timesheetEntries && this.logEntryDetails.timesheetEntries.length > 0) {
            this.logEntryDetails.timesheetEntries.forEach(ts => {
                // If timesheet has items, validate items individually
                if (ts.items && ts.items.length > 0) {
                    ts.items.forEach(item => {
                        const itemStatus = this.timesheetItemApprovals[item.id];
                        if (!itemStatus || itemStatus === 'pending') {
                            pendingItems.push(`Timesheet Item: ${ts.memberName} - ${item.costCode || item.name}`);
                        }
                    });
                } else {
                    // If no items, check the timesheet itself
                    const tsStatus = this.timesheetApprovals[ts.id];
                    if (!tsStatus || tsStatus === 'pending') {
                        pendingItems.push(`Timesheet: ${ts.memberName}`);
                    }
                }
            });
        }
        
        // Check location processes (only those with original changes needing approval)
        if (this.allLocationProcesses && this.allLocationProcesses.length > 0) {
            this.allLocationProcesses.forEach(lp => {
                // Only validate processes that had original changes (not user-edited unchanged ones)
                if (lp.hasChanges) {
                    const lpStatus = this.locationProcessApprovals[lp.id];
                    if (!lpStatus || lpStatus === 'pending') {
                        pendingItems.push(`Location Process: ${lp.name} (${lp.locationName})`);
                    }
                }
            });
        }
        
        if (pendingItems.length > 0) {
            result.isValid = false;
            result.message = 'Please approve or reject all items before saving. Pending items:\n' + pendingItems.join('\n');
        }
        
        return result;
    }
    
    /**
     * Method Name: prepareApprovalData
     * @description: Prepare all approval data for backend processing using new structure
     * Returns: { timesheets: [...], locationProcesses: [...], removedAttachments: [...] }
     * Timesheet format: { id, status, fieldUpdates: { Clock_In_Time__c, Clock_Out_Time__c, Travel_Time__c } }
     * Location format: { id, status, newValue }
     */
    prepareApprovalData() {
        const data = {
            timesheets: [],
            locationProcesses: [],
            removedAttachments: this.removedAttachments
        };
        
        // Process timesheet approvals
        if (this.logEntryDetails?.timesheetEntries) {
            this.logEntryDetails.timesheetEntries.forEach(ts => {
                const status = this.timesheetApprovals[ts.id] || 'Pending';
                const fieldUpdates = {};
                
                // Collect field updates (edited new values) for this timesheet
                // These apply to BOTH parent and child records
                ts.approvalFields.forEach(field => {
                    // Check if user edited the new value
                    const editKey = `${ts.id}.${field.fieldApiName}`;
                    if (this.editedFields[editKey] !== undefined) {
                        // User edited value - already in correct format from handleFieldEdit
                        fieldUpdates[field.fieldApiName] = this.editedFields[editKey];
                    } else {
                        // Use the original new value if not edited
                        if (field.fieldApiName === 'wfrecon__Clock_In_Time__c' || field.fieldApiName === 'wfrecon__Clock_Out_Time__c') {
                            // Convert ISO string to format expected by Apex: YYYY-MM-DD HH:mm:ss
                            // field.newValue is in format: 2025-11-19T13:02:00.000Z
                            // Convert to: 2025-11-19 13:02:00
                            fieldUpdates[field.fieldApiName] = this.convertISOToApexFormat(field.newValue);
                        } else if (field.fieldApiName === 'wfrecon__Travel_Time__c') {
                            fieldUpdates[field.fieldApiName] = parseFloat(field.newValue) || 0;
                        }
                    }
                });
                
                const tsData = {
                    id: ts.id,
                    status: status,
                    fieldUpdates: fieldUpdates
                };
                
                data.timesheets.push(tsData);
            });
        }
        
        // Process location process approvals and user edits
        if (this.allLocationProcesses) {
            this.allLocationProcesses.forEach(lp => {
                const hasSliderEdit = this.editedLocationProcesses[lp.id] !== undefined;
                const hasOriginalChange = lp.hasChanges;
                const isUserEdited = lp.isUserEdited;
                
                // Include: 1) Original changes needing approval, 2) User-edited unchanged processes (auto-approved)
                if (hasOriginalChange || hasSliderEdit || isUserEdited) {
                    // Auto-approve user-edited unchanged processes, otherwise use approval status
                    const status = isUserEdited && !hasOriginalChange ? 'Approved' : (this.locationProcessApprovals[lp.id] || 'Pending');
                    
                    // Use edited value if available, otherwise use current value
                    const newValue = hasSliderEdit ? 
                                  this.editedLocationProcesses[lp.id] : 
                                  lp.currentPercent;
                    
                    const lpData = {
                        id: lp.id,
                        status: status,
                        newValue: newValue
                    };
                    
                    data.locationProcesses.push(lpData);
                }
            });
        }
        
        return data;
    }
    
    /**
     * Method Name: determineLogEntryStatus
     * @description: Determine log entry status based on approval decisions (using new structure with 'status' field)
     */
    determineLogEntryStatus(approvalData) {
        let hasApproved = false;
        let hasRejected = false;
        let allRejected = true;
        let hasItems = false;
        
        // Check timesheets (compare in lowercase since we store lowercase values)
        if (approvalData.timesheets && approvalData.timesheets.length > 0) {
            hasItems = true;
            approvalData.timesheets.forEach(ts => {
                const statusLower = ts.status ? ts.status.toLowerCase() : 'pending';
                if (statusLower === 'approved') {
                    hasApproved = true;
                    allRejected = false;
                } else if (statusLower === 'rejected') {
                    hasRejected = true;
                } else {
                    allRejected = false; // Has pending items
                }
            });
        }
        
        // Check location processes (compare in lowercase since we store lowercase values)
        if (approvalData.locationProcesses && approvalData.locationProcesses.length > 0) {
            hasItems = true;
            approvalData.locationProcesses.forEach(lp => {
                const statusLower = lp.status ? lp.status.toLowerCase() : 'pending';
                if (statusLower === 'approved') {
                    hasApproved = true;
                    allRejected = false;
                } else if (statusLower === 'rejected') {
                    hasRejected = true;
                } else {
                    allRejected = false; // Has pending items
                }
            });
        }
        
        // Determine final status (return in proper case for Salesforce)
        if (!hasItems || (!hasApproved && !hasRejected)) {
            return 'Pending'; // No items or all pending
        } else if (allRejected) {
            return 'Rejected'; // All items rejected
        } else if (hasApproved) {
            return 'Approved'; // At least one item approved
        }
        
        return 'Pending';
    }

    /**
     * Method Name: validateRequiredFields
     * @description: Validate that required fields are filled (Work Performed and Plan for Tomorrow)
     */
    validateRequiredFields() {
        const missingFields = [];
        
        if (!this.logEntryDetails.workPerformed || this.logEntryDetails.workPerformed.trim() === '') {
            missingFields.push('Work Performed');
        }
        
        if (!this.logEntryDetails.planForTomorrow || this.logEntryDetails.planForTomorrow.trim() === '') {
            missingFields.push('Plan for Tomorrow');
        }
        
        if (missingFields.length > 0) {
            this.showToast('Error', `Please fill in the following required fields: ${missingFields.join(', ')}`, 'error');
            return false;
        }
        
        return true;
    }

    /**
     * Method Name: handleSaveAndApprove
     * @description: Save changes and approve the log entry (when no items to review)
     */
    handleSaveAndApprove() {
        // Validate required fields
        if (!this.validateRequiredFields()) {
            return;
        }
        
        // Prepare approval data (empty items but with log entry updates)
        const approvalData = this.prepareApprovalData();
        
        // Store log entry ID before closing modal
        const logEntryId = this.logEntryDetails.Id;
        const workPerformed = this.logEntryDetails.workPerformed;
        const planForTomorrow = this.logEntryDetails.planForTomorrow;
        const exceptions = this.logEntryDetails.exceptions;
        
        // Close modal immediately to prevent multiple clicks
        this.showModal = false;
        this.isLoading = true;
        
        // Call Apex to process with Approved status
        processLogEntryApproval({
            logEntryId: logEntryId,
            approvalData: JSON.stringify(approvalData),
            logEntryStatus: 'Approved',
            logEntryUpdates: JSON.stringify({
                workPerformed: workPerformed,
                planForTomorrow: planForTomorrow,
                exceptions: exceptions,
            })
        })
        .then(() => {
            this.showToast('Success', 'Log entry approved successfully', 'success');
            // Clear modal data
            this.selectedLog = null;
            this.logEntryDetails = null;
            this.modalNotes = '';
            this.editedFields = {};
            this.editedLocationProcesses = {};
            this.timesheetApprovals = {};
            this.timesheetItemApprovals = {};
            this.locationProcessApprovals = {};
            this.newAttachments = [];
            this.removedAttachments = [];
            this.activeTab = 'timesheets';
            
            this.loadLogEntries();
        })
        .catch(error => {
            this.showToast('Error', 'Error approving log entry: ' + (error.body?.message || error.message), 'error');
            console.error('Error in handleSaveAndApprove:', error);
        })
        .finally(() => {
            this.isLoading = false;
        });
    }

    /**
     * Method Name: handleSaveAndReject
     * @description: Save changes and reject the log entry (when no items to review)
     */
    handleSaveAndReject() {
        // Validate required fields
        if (!this.validateRequiredFields()) {
            return;
        }
        
        // Confirm rejection
        this.showConfirmation(
            'Reject Log Entry',
            'Are you sure you want to reject this log entry? This action will mark the entire log entry as Rejected.',
            () => this.processRejectLogEntry(),
            null
        );
    }
    
    /**
     * Method Name: processRejectLogEntry
     * @description: Process the rejection after confirmation
     */
    processRejectLogEntry() {
        // Prepare approval data (empty items but with log entry updates)
        const approvalData = this.prepareApprovalData();
        
        // Store log entry ID and fields before closing modal
        const logEntryId = this.logEntryDetails.Id;
        const workPerformed = this.logEntryDetails.workPerformed;
        const planForTomorrow = this.logEntryDetails.planForTomorrow;
        const exceptions = this.logEntryDetails.exceptions;
        
        // Close modal immediately to prevent multiple clicks
        this.showModal = false;
        this.isLoading = true;
        
        // Call Apex to process with Rejected status
        processLogEntryApproval({
            logEntryId: logEntryId,
            approvalData: JSON.stringify(approvalData),
            logEntryStatus: 'Rejected',
            logEntryUpdates: JSON.stringify({
                workPerformed: workPerformed,
                planForTomorrow: planForTomorrow,
                exceptions: exceptions,
            })
        })
        .then(() => {
            this.showToast('Success', 'Log entry rejected successfully', 'success');
            // Clear modal data
            this.selectedLog = null;
            this.logEntryDetails = null;
            this.modalNotes = '';
            this.editedFields = {};
            this.editedLocationProcesses = {};
            this.timesheetApprovals = {};
            this.timesheetItemApprovals = {};
            this.locationProcessApprovals = {};
            this.newAttachments = [];
            this.removedAttachments = [];
            this.activeTab = 'timesheets';
            
            this.loadLogEntries();
        })
        .catch(error => {
            this.showToast('Error', 'Error rejecting log entry: ' + (error.body?.message || error.message), 'error');
            console.error('Error in handleSaveAndReject:', error);
        })
        .finally(() => {
            this.isLoading = false;
        });
    }

    /**
     * Method Name: handleCancelChanges
     * @description: Method to cancel and revert all changes
     */
    handleCancelChanges() {
        // Delete any newly uploaded files that haven't been saved
        if (this.newAttachments && this.newAttachments.length > 0) {
            const documentIds = this.newAttachments.map(att => att.documentId).filter(id => id);
            
            if (documentIds.length > 0) {
                deleteFiles({ documentIds: documentIds })
                    .then(() => {
                        console.log('Temporary files cleaned up');
                    })
                    .catch(error => {
                        console.error('Error cleaning up temporary files:', error);
                    });
            }
        }
        
        // Close modal without saving
        this.closeModal();
    }

    /**
     * Method Name: handleLinkClick
     * @description: Method is used to handle the link click for job record navigation
     */
    handleLinkClick(event) {
        try {
            const jobId = event.currentTarget.dataset.link;
            if (jobId) {
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: jobId,
                        actionName: 'view',
                    },
                });
            }
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleLinkClick ::', error);
        }
    }

    /**
     * Method Name: showToast
     * @description: Method is used to show toast messages
     */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }

    /**
     * Method Name: parseLiteral
     * @description: Format ISO datetime to readable format (from shiftEndLogEntries)
     */
    parseLiteral(iso) {
        if (!iso) return '--';
        return iso.slice(0, 16).replace('T', ' ');
    }
    
    /**
     * Method Name: formatToAMPM
     * @description: Format ISO datetime to readable AM/PM format without timezone conversion
     */
    formatToAMPM(iso) {
        try {
            if (!iso) return '--';
            
            // Extract date and time parts from ISO string
            // Format: "2025-11-19T13:02:00.000Z" or "2025-11-19T13:02"
            const parts = iso.split('T');
            if (parts.length < 2) return iso;
            
            const datePart = parts[0]; // "2025-11-19"
            const timePart = parts[1].substring(0, 5); // "13:02"
            
            // Parse date components
            const [year, month, day] = datePart.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[parseInt(month, 10) - 1];
            
            // Extract hours and minutes
            const [hoursStr, minutesStr] = timePart.split(':');
            let hours = parseInt(hoursStr, 10);
            const minutes = minutesStr;
            
            // Determine AM/PM
            const ampm = hours >= 12 ? 'PM' : 'AM';
            
            // Convert to 12-hour format
            hours = hours % 12;
            hours = hours ? hours : 12; // hour '0' should be '12'
            
            // Pad hours with leading zero if needed
            const paddedHours = String(hours).padStart(2, '0');
            
            // Format: "Nov 19, 2025, 01:02 PM"
            return `${monthName} ${parseInt(day, 10)}, ${year}, ${paddedHours}:${minutes} ${ampm}`;
        } catch (error) {
            console.error('Error in formatToAMPM:', error);
            return iso;
        }
    }

    /**
     * Method Name: hasItemsToReview
     * @description: Check if there are any timesheet entries or location processes with original changes to review
     */
    get hasItemsToReview() {
        const hasTimesheets = this.logEntryDetails?.timesheetEntries && 
                            this.logEntryDetails.timesheetEntries.length > 0;
        
        // Check if there are location processes with original changes needing approval
        const hasLocationProcessChanges = this.allLocationProcesses && 
                                         this.allLocationProcesses.some(lp => lp.hasChanges);
        
        return hasTimesheets || hasLocationProcessChanges;
    }

    /**
     * Method Name: formatDateToDisplay
     * @description: Format date string to MMM DD, YYYY format (e.g., Nov 21, 2025)
     * @param dateStr: Date string in various formats
     * @return: Formatted date string
     */
    formatDateToDisplay(dateStr) {
        if (!dateStr || dateStr === '--') return dateStr;
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        try {
            // Handle various input formats
            let date;
            if (dateStr.includes('/')) {
                // Handle MM/DD/YYYY format
                const parts = dateStr.split('/');
                date = new Date(parts[2], parts[0] - 1, parts[1]);
            } else if (dateStr.includes('-')) {
                // Handle YYYY-MM-DD format
                date = new Date(dateStr + 'T00:00:00');
            } else {
                date = new Date(dateStr);
            }
            
            if (isNaN(date.getTime())) return dateStr;
            
            const month = monthNames[date.getMonth()];
            const day = date.getDate();
            const year = date.getFullYear();
            
            return `${month} ${day}, ${year}`;
        } catch (error) {
            return dateStr;
        }
    }

    /**
     * Method Name: formatDateTimeForInput
     * @description: Format ISO datetime for datetime-local input without timezone conversion
     */
    formatDateTimeForInput(iso) {
        if (!iso) return '';
        // datetime-local expects format: YYYY-MM-DDTHH:mm
        // Extract the first 16 characters from ISO string (YYYY-MM-DDTHH:mm)
        // This avoids timezone conversion that occurs with new Date()
        return iso.slice(0, 16);
    }
    
    /**
     * Method Name: convertISOToApexFormat
     * @description: Convert ISO datetime string to format expected by Apex convertUtc method
     * @param iso: ISO datetime string (e.g., "2025-11-19T13:02:00.000Z")
     * @return: Datetime string in format "YYYY-MM-DD HH:mm:ss"
     */
    convertISOToApexFormat(iso) {
        if (!iso) return '';
        // Remove milliseconds and Z suffix if present
        // Convert from: 2025-11-19T13:02:00.000Z or 2025-11-19T13:02:00
        // Convert to: 2025-11-19 13:02:00
        let formatted = iso.split('.')[0]; // Remove milliseconds
        formatted = formatted.replace('Z', ''); // Remove Z suffix
        formatted = formatted.replace('T', ' '); // Replace T with space
        
        // Ensure we have seconds
        if (formatted.split(':').length === 2) {
            formatted += ':00';
        }
        
        return formatted;
    }

    /**
     * Method Name: getFieldLabel
     * @description: Get proper field label from API name
     */
    getFieldLabel(apiName) {
        const labelMap = {
            'wfrecon__Clock_In_Time__c': 'Clock In Time',
            'wfrecon__Clock_Out_Time__c': 'Clock Out Time',
            'wfrecon__Travel_Time__c': 'Travel Time',
            'wfrecon__Per_Diem__c': 'Per Diem',
            'wfrecon__Premium__c': 'Premium'
        };
        return labelMap[apiName] || apiName;
    }
    
    /**
     * Method Name: resetTimesheetToPending
     * @description: Reset timesheet and its items to pending when user makes changes
     */
    resetTimesheetToPending(recordId) {
        // Find if this is a timesheet entry or item
        this.logEntryDetails.timesheetEntries.forEach(ts => {
            if (ts.id === recordId) {
                // Reset timesheet
                this.timesheetApprovals[ts.id] = 'pending';
                ts.approvalStatus = 'pending';
                ts.isApproved = false;
                ts.isRejected = false;
            }
            
            // Check items
            if (ts.items) {
                ts.items.forEach(item => {
                    if (item.id === recordId) {
                        // Reset item
                        this.timesheetItemApprovals[item.id] = 'pending';
                        item.approvalStatus = 'pending';
                        item.isApproved = false;
                        item.isRejected = false;
                    }
                });
            }
        });
        
        // Trigger reactivity
        this.logEntryDetails = { ...this.logEntryDetails };
    }
    
    /**
     * Method Name: resetLocationProcessToPending
     * @description: Reset location process to pending when user makes changes
     */
    resetLocationProcessToPending(processId) {
        const lp = this.logEntryDetails.locationProcesses.find(l => l.id === processId);
        if (lp) {
            this.locationProcessApprovals[processId] = 'pending';
            lp.approvalStatus = 'pending';
            lp.isApproved = false;
            lp.isRejected = false;
            
            // Trigger reactivity
            this.logEntryDetails = { ...this.logEntryDetails };
        }
    }
    
    /**
     * Method Name: getTimesheetApprovalStatus
     * @description: Get approval status for a timesheet
     */
    getTimesheetApprovalStatus(timesheetId) {
        return this.timesheetApprovals[timesheetId] || 'pending';
    }
    
    /**
     * Method Name: getItemApprovalStatus
     * @description: Get approval status for a timesheet item
     */
    getItemApprovalStatus(itemId) {
        return this.timesheetItemApprovals[itemId] || 'pending';
    }
    
    /**
     * Method Name: getLocationProcessApprovalStatus
     * @description: Get approval status for a location process
     */
    getLocationProcessApprovalStatus(processId) {
        return this.locationProcessApprovals[processId] || 'pending';
    }
    
    /**
     * Method Name: deleteNewlyUploadedFiles
     * @description: Delete files that were uploaded during this session but not approved
     */
    deleteNewlyUploadedFiles() {
        if (!this.newAttachments || this.newAttachments.length === 0) {
            return;
        }
        
        // Delete each newly uploaded file
        const deletePromises = this.newAttachments.map(fileId => 
            deleteContentDocument({ contentDocumentId: fileId })
                .catch(error => {
                    console.error('Error deleting newly uploaded file:', error);
                    // Continue with other deletions even if one fails
                })
        );
        
        Promise.all(deletePromises)
            .then(() => {
                console.log('Cleaned up newly uploaded files');
            })
            .catch(error => {
                console.error('Error cleaning up files:', error);
            });
    }
    
    /**
     * Method Name: showConfirmation
     * @description: Show custom confirmation modal
     */
    showConfirmation(title, message, onConfirm, context) {
        this.confirmModalTitle = title;
        this.confirmModalMessage = message;
        this.confirmModalAction = onConfirm;
        this.confirmModalContext = context;
        this.showConfirmModal = true;
    }
    
    /**
     * Method Name: handleConfirmYes
     * @description: Handle confirmation modal yes button
     */
    handleConfirmYes() {
        this.showConfirmModal = false;
        if (this.confirmModalAction) {
            this.confirmModalAction(this.confirmModalContext);
        }
        this.confirmModalAction = null;
        this.confirmModalContext = null;
    }
    
    /**
     * Method Name: handleConfirmNo
     * @description: Handle confirmation modal no button
     */
    handleConfirmNo() {
        this.showConfirmModal = false;
        this.confirmModalAction = null;
        this.confirmModalContext = null;
    }

    /**
     * Method Name: updateShownData
     * @description: Update shownLogEntriesRaw for current page
     */
    updateShownData() {
        try {
            if (!this.filteredLogEntriesRaw || this.filteredLogEntriesRaw.length === 0) {
                this.shownLogEntriesRaw = [];
                return;
            }

            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            this.shownLogEntriesRaw = this.filteredLogEntriesRaw.slice(startIndex, endIndex);
        } catch (error) {
            console.error('Error updating shown data:', error);
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
     * Method Name: groupLocationProcessesByLocation
     * @description: Group all location processes by location and apply filter
     */
    groupLocationProcessesByLocation() {
        if (!this.allLocationProcesses || this.allLocationProcesses.length === 0) {
            this.groupedLocationProcesses = [];
            return;
        }

        // Store current expanded states before re-grouping
        const expandedStates = new Map();
        if (this.groupedLocationProcesses && this.groupedLocationProcesses.length > 0) {
            this.groupedLocationProcesses.forEach(group => {
                expandedStates.set(group.locationId, group.isExpanded);
            });
        }

        // Filter processes based on selected filter
        let filteredProcesses = [];
        if (this.selectedLocationProcessFilter === 'pendingApproval') {
            filteredProcesses = this.allLocationProcesses.filter(lp => lp.hasChanges);
        } else if (this.selectedLocationProcessFilter === 'unchanged') {
            filteredProcesses = this.allLocationProcesses.filter(lp => !lp.hasChanges);
        } else {
            filteredProcesses = [...this.allLocationProcesses];
        }

        // Group by location
        const locationMap = new Map();
        filteredProcesses.forEach(lp => {
            if (!locationMap.has(lp.locationId)) {
                locationMap.set(lp.locationId, {
                    locationId: lp.locationId,
                    locationName: lp.locationName,
                    processes: []
                });
            }
            locationMap.get(lp.locationId).processes.push(lp);
        });

        // Convert map to array and sort by location name
        this.groupedLocationProcesses = Array.from(locationMap.values()).sort((a, b) => 
            a.locationName.localeCompare(b.locationName)
        ).map((group, index) => {
            // Restore previous expanded state, or auto-expand first location if no previous state exists
            const wasExpanded = expandedStates.has(group.locationId) 
                ? expandedStates.get(group.locationId) 
                : index === 0;
            
            return {
                ...group,
                isExpanded: wasExpanded
            };
        });
    }

    /**
     * Method Name: handleLocationProcessFilterChange
     * @description: Handle location process filter change
     */
    handleLocationProcessFilterChange(event) {
        this.selectedLocationProcessFilter = event.detail.value;
        this.groupLocationProcessesByLocation();
    }

    /**
     * Method Name: handleToggleLocationGroup
     * @description: Toggle location group expand/collapse
     */
    handleToggleLocationGroup(event) {
        const locationId = event.currentTarget.dataset.locationId;
        
        this.groupedLocationProcesses = this.groupedLocationProcesses.map(group => {
            if (group.locationId === locationId) {
                return {
                    ...group,
                    isExpanded: !group.isExpanded
                };
            }
            return group;
        });
    }

    handleChooseFromChatter() {
        this.showChatterModal = true;
        this.chatterDaysOffset = 0;
        this.hasMoreChatterItems = true;
        this.loadChatterFeedItems();
    }

    closeChatterModal() {
        this.showChatterModal = false;
        this.chatterFeedItems = [];
    }

    loadChatterFeedItems() {
        try {
            // Prevent concurrent loads if already loading more
            if (this.isLoadingChatter && this.chatterDaysOffset > 0) return;

            this.isLoadingChatter = true;
            
            console.log('Loading Chatter feed items for Job ID:', this.logEntryDetails.jobId);

            // Fetch data
            getChatterFeedItems({ 
                jobId: this.logEntryDetails.jobId, 
                daysOffset: this.chatterDaysOffset 
            })
            .then(result => {
                console.log('Chatter Feed Items Result:', JSON.stringify(result));
                
                if (!result) {
                    this.hasMoreChatterItems = false;
                    if (this.chatterDaysOffset === 0) this.chatterFeedItems = [];
                    return;
                }

                this.hasMoreChatterItems = result.hasMore;
                
                // Explicitly map the items to ensure clean Objects for the HTML template
                const newItems = (result.feedItems || []).map(item => {
                    return {
                        id: item.id,
                        body: item.body || '',
                        formattedDate: item.createdDate ? new Date(item.createdDate).toLocaleDateString() : '',
                        attachments: (item.attachments || []).map(att => {
                            // Check if this file is already attached to the main log entry
                            const isAlreadyUploaded = this.logEntryDetails.attachments && 
                                this.logEntryDetails.attachments.some(ex => ex.id === att.contentDocumentId);

                            return {
                                id: att.id,
                                contentDocumentId: att.contentDocumentId,
                                title: att.title,
                                isImage: att.isImage === true, // Ensure boolean
                                thumbnailUrl: att.thumbnailUrl || '', // Ensure string
                                selected: false,
                                alreadyUploaded: isAlreadyUploaded,
                                // Set CSS class based on status
                                cardClass: isAlreadyUploaded 
                                    ? 'attachment-card disabled' 
                                    : 'attachment-card'
                            };
                        })
                    };
                });

                // If initial load, replace array. If loading more, append.
                if (this.chatterDaysOffset === 0) {
                    this.chatterFeedItems = newItems;
                } else {
                    this.chatterFeedItems = [...this.chatterFeedItems, ...newItems];
                }
            })
            .catch(error => {
                console.error('Error in loadChatterFeedItems promise:', error);
                this.showToast('Error', 'Failed to load Chatter posts', 'error');
            })
            .finally(() => {
                this.isLoadingChatter = false;
                this.isLoadingMoreChatter = false;
            });
        } catch (error) {
            console.error('Error initializing loadChatterFeedItems:', error);
            this.showToast('Error', 'Failed to initialize Chatter load', 'error');
            this.isLoadingChatter = false;
            this.isLoadingMoreChatter = false;
        }
    }

    handleLoadMoreChatter() {
        this.chatterDaysOffset += 3;
        this.isLoadingMoreChatter = true;
        this.loadChatterFeedItems();
    }

    handleAttachmentSelection(event) {
        const id = event.currentTarget.dataset.id;
        this.chatterFeedItems = this.chatterFeedItems.map(item => ({
            ...item,
            attachments: item.attachments.map(att => {
                if (att.id === id && !att.alreadyUploaded) {
                    return { 
                        ...att, 
                        selected: !att.selected, 
                        cardClass: !att.selected ? 'attachment-card selected' : 'attachment-card' 
                    };
                }
                return att;
            })
        }));
    }

    get hasNoSelectedAttachments() {
        return !this.chatterFeedItems.some(item => item.attachments.some(a => a.selected));
    }

    handleAddSelectedAttachments() {
        const selectedIds = [];
        const selectedFiles = [];
        
        this.chatterFeedItems.forEach(item => {
            item.attachments.forEach(att => {
                if(att.selected) {
                    selectedIds.push(att.contentDocumentId);
                    selectedFiles.push(att);
                }
            });
        });

        if(selectedIds.length > 0) {
            this.isLoading = true;
            // Use NEW local method to link to existing Log Entry
            linkChatterFiles({ parentId: this.logEntryDetails.Id, contentDocumentIds: selectedIds })
                .then(() => {
                    selectedFiles.forEach(f => {
                        // Add to newAttachments for potential rollback on Cancel
                        this.newAttachments.push(f.contentDocumentId); 
                        
                        // Update UI
                        this.logEntryDetails.attachments.push({
                            id: f.contentDocumentId,
                            title: f.title,
                            isImage: f.isImage,
                            downloadUrl: f.thumbnailUrl || `/sfc/servlet.shepherd/document/download/${f.contentDocumentId}`,
                            name: f.title,
                            isNewUpload: true
                        });
                    });
                    this.showToast('Success', 'Files added from Chatter', 'success');
                    this.closeChatterModal();
                })
                .catch(error => {
                    this.showToast('Error', 'Failed to link files: ' + (error.body?.message || error.message), 'error');
                })
                .finally(() => this.isLoading = false);
        }
    }

    handleOpenCamera() {
        this.showCameraModal = true;
        this.capturedPhoto = null;
        // Delay to allow DOM to render video element
        setTimeout(() => this.startCamera(), 100);
    }

    closeCameraModal() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        this.showCameraModal = false;
        this.capturedPhoto = null;
    }

    async startCamera() {
        try {
            const videoElement = this.template.querySelector('.camera-video');
            if (videoElement) {
                // Request camera access
                this.cameraStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } // Prefer back camera on mobile
                });
                videoElement.srcObject = this.cameraStream;
            }
        } catch (error) {
            console.error('Camera Error', error);
            this.showToast('Error', 'Unable to access camera. Please check permissions.', 'error');
            this.closeCameraModal();
        }
    }

    handleCapturePhoto() {
        const video = this.template.querySelector('.camera-video');
        const canvas = this.template.querySelector('.camera-canvas');
        if (video && canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            this.capturedPhoto = canvas.toDataURL('image/jpeg', 0.8);
            
            // Stop stream to freeze/save resources
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(track => track.stop());
                this.cameraStream = null;
            }
        }
    }

    handleRetakePhoto() {
        this.capturedPhoto = null;
        setTimeout(() => this.startCamera(), 100);
    }

    handleSaveCapturedPhoto() {
        if (!this.capturedPhoto) return;
        
        this.isLoading = true;
        const base64 = this.capturedPhoto.split(',')[1];
        const filename = 'Camera_Capture_' + new Date().getTime() + '.jpg';

        // Use NEW local method to save to existing Log Entry
        saveCameraPhoto({ 
            parentId: this.logEntryDetails.Id, 
            fileName: filename, 
            base64Data: base64 
        })
        .then(docId => {
            // Add to newAttachments for potential rollback
            this.newAttachments.push(docId); 
            
            // Update UI
            this.logEntryDetails.attachments.push({
                id: docId,
                title: filename,
                isImage: true,
                downloadUrl: this.capturedPhoto, // Use base64 for immediate preview without server roundtrip
                name: filename,
                isNewUpload: true
            });
            
            this.showToast('Success', 'Photo saved', 'success');
            this.closeCameraModal();
        })
        .catch(error => {
            this.showToast('Error', 'Failed to save photo: ' + (error.body?.message || error.message), 'error');
        })
        .finally(() => this.isLoading = false);
    }
}