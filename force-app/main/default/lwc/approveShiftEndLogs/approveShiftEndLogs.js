import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getUnapprovedLogEntries from '@salesforce/apex/ApproveShiftEndLogsController.getUnapprovedLogEntries';
import getLogEntryDetails from '@salesforce/apex/ApproveShiftEndLogsController.getLogEntryDetails';
import deleteContentDocument from '@salesforce/apex/ApproveShiftEndLogsController.deleteContentDocument';
import processLogEntryApproval from '@salesforce/apex/ApproveShiftEndLogsController.processLogEntryApproval';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ApproveShiftEndLogs extends NavigationMixin(LightningElement) {
    @track logEntriesRaw = [];
    @track filteredLogEntriesRaw = [];
    @track isLoading = true;
    @track searchTerm = '';
    @track selectedDateFilter = 'last7days';
    @track selectedStatusFilter = 'Pending';
    @track showModal = false;
    @track selectedLog = null;
    @track modalNotes = '';
    @track logEntryDetails = null;
    @track activeTab = 'timesheets';
    @track editedFields = {};
    @track editedLocationProcesses = {};
    
    // State tracking for approvals and rejections
    @track timesheetApprovals = {}; // { timesheetId: 'approved' | 'rejected' | 'pending' }
    @track timesheetItemApprovals = {}; // { itemId: 'approved' | 'rejected' | 'pending' }
    @track locationProcessApprovals = {}; // { locationProcessId: 'approved' | 'rejected' | 'pending' }
    @track newAttachments = []; // Array of new file IDs uploaded
    @track removedAttachments = []; // Array of removed file IDs

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

    statusFilterOptions = [
        { label: 'All Statuses', value: 'All' },
        { label: 'Pending', value: 'Pending' },
        { label: 'Approved', value: 'Approved' },
        { label: 'Auto-Approved', value: 'Auto-Approved' },
        { label: 'Rejected', value: 'Rejected' }
    ];

    /**
     * Method Name: totalCount
     * @description: Returns total count of all log entries
     */
    get totalCount() {
        return this.logEntriesRaw.length;
    }

    /**
     * Method Name: pendingCount
     * @description: Returns count of pending log entries
     */
    get pendingCount() {
        return this.logEntriesRaw.filter(log => log.status === 'Pending').length;
    }

    /**
     * Method Name: approvedCount
     * @description: Returns count of approved log entries
     */
    get approvedCount() {
        return this.logEntriesRaw.filter(log => log.status === 'Approved').length;
    }

    /**
     * Method Name: autoApprovedCount
     * @description: Returns count of auto-approved log entries
     */
    get autoApprovedCount() {
        return this.logEntriesRaw.filter(log => log.status === 'Auto-Approved').length;
    }

    /**
     * Method Name: rejectedCount
     * @description: Returns count of rejected log entries
     */
    get rejectedCount() {
        return this.logEntriesRaw.filter(log => log.status === 'Rejected').length;
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
        return this.filteredLogEntriesRaw.map((log, index) => {
            return {
                Id: log.Id,
                key: log.Id,
                jobId: log.jobId,
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

    /**
     * Method Name: connectedCallback
     * @description: This method is called when the component is connected to the DOM.
     */
    connectedCallback() {
        this.loadLogEntries();
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
     * @description: Method is used to load log entries from the server
     */
    loadLogEntries() {
        this.isLoading = true;
        getUnapprovedLogEntries({
            dateFilter: this.selectedDateFilter
        })
            .then(result => {
                this.logEntriesRaw = result;
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
     * Method Name: handleDateFilterChange
     * @description: Method is used to handle the date filter change
     */
    handleDateFilterChange(event) {
        this.selectedDateFilter = event.target.value;
        this.loadLogEntries();
    }

    /**
     * Method Name: handleStatusFilterChange
     * @description: Method is used to handle the status filter change
     */
    handleStatusFilterChange(event) {
        this.selectedStatusFilter = event.target.value;
        this.applyFilters();
    }

    /**
     * Method Name: applyFilters
     * @description: Method is used to apply search and status filters in JavaScript
     */
    applyFilters() {
        let filtered = [...this.logEntriesRaw];
        
        // Apply status filter
        if (this.selectedStatusFilter && this.selectedStatusFilter !== 'All') {
            filtered = filtered.filter(log => log.status === this.selectedStatusFilter);
        }
        
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
                
                // Process location processes to add slider percentages
                if (processedResult.locationProcesses) {
                    processedResult.locationProcesses.forEach(lp => {
                        // Set current display to newValue (the pending approval value)
                        lp.currentPercent = parseFloat(lp.newValue);
                        lp.todayPercent = parseFloat((lp.newValue - lp.oldValue).toFixed(1));
                        lp.remainingPercent = parseFloat((100 - lp.newValue).toFixed(1));
                        lp.approvalStatus = this.getLocationProcessApprovalStatus(lp.id);
                        lp.isApproved = lp.approvalStatus === 'approved';
                        lp.isRejected = lp.approvalStatus === 'rejected';
                    });
                }
                
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
        
        if (confirm('Are you sure you want to remove this file?')) {
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
        }
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
        const dateTimeFields = ['Clock_In_Time__c', 'Clock_Out_Time__c'];
        const numberFields = ['Travel_Time__c', 'Per_Diem__c', 'Premium__c'];
        
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
     * @description: Method to handle field edits for timesheet entries (including datetime inputs with validation)
     */
    handleFieldEdit(event) {
        const recordId = event.target.dataset.recordid;
        const fieldName = event.target.dataset.fieldname;
        let newValue = event.target.value;

        // Validate and convert datetime-local format
        if ((fieldName === 'Clock_In_Time__c' || fieldName === 'Clock_Out_Time__c') && newValue) {
            // Basic validation: Check if datetime is valid format YYYY-MM-DDTHH:mm
            const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
            if (!dateTimePattern.test(newValue)) {
                this.showToast('Error', 'Invalid date/time format', 'error');
                return;
            }

            // Check if clock out is after clock in for the same entry
            if (fieldName === 'Clock_Out_Time__c') {
                const entry = this.logEntryDetails?.timesheetEntries?.find(e => e.id === recordId);
                if (entry) {
                    const clockInField = entry.approvalFields?.find(f => f.fieldApiName === 'Clock_In_Time__c');
                    const clockInValue = clockInField ? clockInField.newValue.slice(0, 16) : null;
                    
                    if (clockInValue && newValue <= clockInValue) {
                        this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                        event.target.value = this.formatDateTimeForInput(clockInField.newValue); // Reset to original
                        return;
                    }
                }
            }

            // Convert to format expected by Apex DateTime.valueOf(): YYYY-MM-DD HH:mm:ss
            // Input format: YYYY-MM-DDTHH:mm
            // Output format: YYYY-MM-DD HH:mm:ss
            newValue = newValue.replace('T', ' ') + ':00';
        }

        // Validate travel time is non-negative
        if (fieldName === 'Travel_Time__c' && newValue) {
            const travelTime = parseFloat(newValue);
            if (isNaN(travelTime) || travelTime < 0) {
                this.showToast('Error', 'Travel time must be a positive number', 'error');
                return;
            }
        }

        if (!this.editedFields[recordId]) {
            this.editedFields[recordId] = {};
        }
        this.editedFields[recordId][fieldName] = newValue;
        
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
        const newValue = parseFloat(parseFloat(slider.value).toFixed(1));

        this.editedLocationProcesses[processId] = newValue;
        
        // Update the location process newValue and currentPercent for backend processing and UI binding
        const lp = this.logEntryDetails.locationProcesses.find(l => l.id === processId);
        if (lp) {
            lp.newValue = newValue;
            lp.currentPercent = newValue; // Update currentPercent so slider value binding updates
            lp.todayPercent = parseFloat((newValue - lp.oldValue).toFixed(1));
            lp.remainingPercent = parseFloat((100 - newValue).toFixed(1));
        }
        
        // Reset approval status to pending when user makes changes
        this.resetLocationProcessToPending(processId);
        
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
        
        // Update UI
        const lp = this.logEntryDetails.locationProcesses.find(l => l.id === recordId);
        if (lp) {
            lp.approvalStatus = 'approved';
            lp.isApproved = true;
            lp.isRejected = false;
        }
        
        // Trigger reactivity
        this.logEntryDetails = { ...this.logEntryDetails };
        this.showToast('Success', 'Location process marked for approval', 'success');
    }

    /**
     * Method Name: handleRejectLocation
     * @description: Method to reject individual location process
     */
    handleRejectLocation(event) {
        const recordId = event.target.dataset.recordid;
        this.locationProcessApprovals[recordId] = 'rejected';
        
        // Update UI
        const lp = this.logEntryDetails.locationProcesses.find(l => l.id === recordId);
        if (lp) {
            lp.approvalStatus = 'rejected';
            lp.isApproved = false;
            lp.isRejected = true;
        }
        
        // Trigger reactivity
        this.logEntryDetails = { ...this.logEntryDetails };
        this.showToast('Success', 'Location process marked for rejection', 'success');
    }

    /**
     * Method Name: handleBulkApproveLocations
     * @description: Method to approve all location processes
     */
    handleBulkApproveLocations() {
        if (this.logEntryDetails?.locationProcesses) {
            this.logEntryDetails.locationProcesses.forEach(lp => {
                this.locationProcessApprovals[lp.id] = 'approved';
                lp.approvalStatus = 'approved';
                lp.isApproved = true;
                lp.isRejected = false;
            });
            
            // Trigger reactivity
            this.logEntryDetails = { ...this.logEntryDetails };
            this.showToast('Success', 'All location processes marked for approval', 'success');
        }
    }

    /**
     * Method Name: handleBulkRejectLocations
     * @description: Method to reject all location processes
     */
    handleBulkRejectLocations() {
        if (this.logEntryDetails?.locationProcesses) {
            this.logEntryDetails.locationProcesses.forEach(lp => {
                this.locationProcessApprovals[lp.id] = 'rejected';
                lp.approvalStatus = 'rejected';
                lp.isApproved = false;
                lp.isRejected = true;
            });
            
            // Trigger reactivity
            this.logEntryDetails = { ...this.logEntryDetails };
            this.showToast('Success', 'All location processes marked for rejection', 'success');
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
        // Validate that all items have been reviewed (approved or rejected)
        const validationResult = this.validateApprovalState();
        
        if (!validationResult.isValid) {
            this.showToast('Error', validationResult.message, 'error');
            return;
        }
        
        // Prepare approval data
        const approvalData = this.prepareApprovalData();
        
        // Determine log entry status based on approvals/rejections
        const logEntryStatus = this.determineLogEntryStatus(approvalData);
        
        if (logEntryStatus === 'Rejected' && !confirm('All items are rejected. This will mark the entire log entry as Rejected. Continue?')) {
            return;
        }
        
        // Call Apex to process the approval
        this.isLoading = true;
        processLogEntryApproval({
            logEntryId: this.logEntryDetails.Id,
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
                this.closeModal();
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
        
        // Check timesheets
        if (this.logEntryDetails?.timesheetEntries) {
            this.logEntryDetails.timesheetEntries.forEach(ts => {
                if (!this.timesheetApprovals[ts.id]) {
                    pendingItems.push(`Timesheet: ${ts.memberName}`);
                }
            });
        }
        
        // Check location processes
        if (this.logEntryDetails?.locationProcesses) {
            this.logEntryDetails.locationProcesses.forEach(lp => {
                if (!this.locationProcessApprovals[lp.id]) {
                    pendingItems.push(`Location Process: ${lp.name}`);
                }
            });
        }
        
        if (pendingItems.length > 0) {
            result.isValid = false;
            result.message = 'Please approve or reject all items before saving. Pending items: ' + pendingItems.join(', ');
        }
        
        return result;
    }
    
    /**
     * Method Name: prepareApprovalData
     * @description: Prepare all approval data for backend processing
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
                const tsData = {
                    id: ts.id,
                    action: this.timesheetApprovals[ts.id] || 'pending',
                    fieldUpdates: {},
                    items: []
                };
                
                // Collect field updates for this timesheet
                if (this.editedFields[ts.id]) {
                    tsData.fieldUpdates = this.editedFields[ts.id];
                }
                
                // Process timesheet items
                if (ts.items) {
                    ts.items.forEach(item => {
                        const itemData = {
                            id: item.id,
                            action: this.timesheetItemApprovals[item.id] || this.timesheetApprovals[ts.id] || 'pending',
                            fieldUpdates: {}
                        };
                        
                        // Collect field updates for this item
                        if (this.editedFields[item.id]) {
                            itemData.fieldUpdates = this.editedFields[item.id];
                        }
                        
                        tsData.items.push(itemData);
                    });
                }
                
                data.timesheets.push(tsData);
            });
        }
        
        // Process location process approvals
        if (this.logEntryDetails?.locationProcesses) {
            this.logEntryDetails.locationProcesses.forEach(lp => {
                const lpData = {
                    id: lp.id,
                    action: this.locationProcessApprovals[lp.id] || 'pending',
                    newValue: this.editedLocationProcesses[lp.id] !== undefined ? 
                              this.editedLocationProcesses[lp.id] : lp.currentPercent
                };
                
                data.locationProcesses.push(lpData);
            });
        }
        
        return data;
    }
    
    /**
     * Method Name: determineLogEntryStatus
     * @description: Determine log entry status based on approval decisions
     */
    determineLogEntryStatus(approvalData) {
        let hasApproved = false;
        let hasRejected = false;
        let allRejected = true;
        
        // Check timesheets
        approvalData.timesheets.forEach(ts => {
            if (ts.action === 'approved') {
                hasApproved = true;
                allRejected = false;
            } else if (ts.action === 'rejected') {
                hasRejected = true;
            }
        });
        
        // Check location processes
        approvalData.locationProcesses.forEach(lp => {
            if (lp.action === 'approved') {
                hasApproved = true;
                allRejected = false;
            } else if (lp.action === 'rejected') {
                hasRejected = true;
            }
        });
        
        // Determine final status
        if (allRejected && hasRejected) {
            return 'Rejected';
        } else if (hasApproved) {
            return 'Approved'; // Approved if at least one item is approved
        }
        
        return 'Pending';
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
     * Method Name: getFieldLabel
     * @description: Get proper field label from API name
     */
    getFieldLabel(apiName) {
        const labelMap = {
            'Clock_In_Time__c': 'Clock In Time',
            'Clock_Out_Time__c': 'Clock Out Time',
            'Travel_Time__c': 'Travel Time',
            'Per_Diem__c': 'Per Diem',
            'Premium__c': 'Premium'
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
}