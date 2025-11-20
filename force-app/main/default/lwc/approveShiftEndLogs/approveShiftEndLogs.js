import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getUnapprovedLogEntries from '@salesforce/apex/ApproveShiftEndLogsController.getUnapprovedLogEntries';
import getLogEntryDetails from '@salesforce/apex/ApproveShiftEndLogsController.getLogEntryDetails';
import deleteContentDocument from '@salesforce/apex/ApproveShiftEndLogsController.deleteContentDocument';
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
            console.log('Slider input not found for processId:', processId);
            return;
        }
        
        const sliderContainer = sliderInput.closest('.slider-wrapper');
        if (!sliderContainer) {
            console.log('Slider container not found');
            return;
        }
        
        const sliderTrack = sliderContainer.querySelector('.slider-track');
        if (!sliderTrack) {
            console.log('Slider track not found');
            return;
        }
        
        // Query all sections - they should be direct children of slider-track
        const allSections = sliderTrack.querySelectorAll('.slider-section');
        const completedSection = sliderTrack.querySelector('.slider-section.completed');
        const todaySection = sliderTrack.querySelector('.slider-section.today');
        const remainingSection = sliderTrack.querySelector('.slider-section.remaining');
        
        console.log('Sections found:', { 
            total: allSections.length, 
            completed: !!completedSection, 
            today: !!todaySection, 
            remaining: !!remainingSection 
        });
        
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
            dateFilter: this.selectedDateFilter,
            statusFilter: this.selectedStatusFilter
        })
            .then(result => {
                console.log('getUnapprovedLogEntries result:', result);

                this.logEntriesRaw = result;
                this.filteredLogEntriesRaw = result;
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
        this.loadLogEntries();
    }

    /**
     * Method Name: applyFilters
     * @description: Method is used to apply search filters
     */
    applyFilters() {
        if (!this.searchTerm) {
            this.filteredLogEntriesRaw = [...this.logEntriesRaw];
            return;
        }

        const searchLower = this.searchTerm.toLowerCase();
        this.filteredLogEntriesRaw = this.logEntriesRaw.filter(log => {
            const jobName = (log.jobName || '').toLowerCase();
            const jobNumber = (log.jobNumber || '').toLowerCase();
            return jobName.includes(searchLower) || jobNumber.includes(searchLower);
        });
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
                console.log('Log Entry Details:', result);
                const processedResult = JSON.parse(JSON.stringify(result)); // Deep clone
                
                // Process timesheet entries to add formatted fields
                if (processedResult.timesheetEntries) {
                    let serialNumber = 1;
                    processedResult.timesheetEntries.forEach(ts => {
                        ts.serialNumber = serialNumber++;
                        
                        // Process approval fields for timesheet entry
                        if (ts.approvalFields) {
                            ts.approvalFields = ts.approvalFields.map(field => {
                                return this.formatApprovalField(field);
                            });
                        }
                        
                        // Process items
                        if (ts.items) {
                            ts.items.forEach(item => {
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
                    });
                }
                
                // Process attachments to add download URLs and icons
                if (processedResult.attachments) {
                    processedResult.attachments.forEach(attachment => {
                        attachment.downloadUrl = `/sfc/servlet.shepherd/document/download/${attachment.id}`;
                        attachment.name = attachment.title;
                        if (!attachment.isImage) {
                            attachment.icon = this.getFileIcon(attachment.fileExtension);
                        }
                    });
                }
                
                this.logEntryDetails = processedResult;
                this.editedFields = {};
                this.editedLocationProcesses = {};
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
            
            this.logEntryDetails.attachments.push({
                id: file.documentId,
                title: file.name,
                fileExtension: fileExtension,
                isImage: isImage,
                downloadUrl: `/sfc/servlet.shepherd/document/download/${file.documentId}`,
                name: file.name,
                icon: isImage ? null : this.getFileIcon(fileExtension)
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
            this.isLoading = true;
            
            // Call Apex to delete the content document
            deleteContentDocument({ contentDocumentId: fileId })
                .then(() => {
                    // Remove from local array
                    this.logEntryDetails.attachments = this.logEntryDetails.attachments.filter(file => file.id !== fileId);
                    this.showToast('Success', 'File removed successfully', 'success');
                })
                .catch(error => {
                    console.error('Error removing file:', error);
                    this.showToast('Error', 'Failed to remove file: ' + (error.body?.message || error.message), 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
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
            formattedField.oldValueFormatted = this.parseLiteral(field.oldValue);
            formattedField.newValueFormatted = this.parseLiteral(field.newValue);
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
        this.showModal = false;
        this.selectedLog = null;
        this.logEntryDetails = null;
        this.modalNotes = '';
        this.editedFields = {};
        this.editedLocationProcesses = {};
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
            // Basic validation: Check if datetime is valid
            const dateObj = new Date(newValue);
            if (isNaN(dateObj.getTime())) {
                this.showToast('Error', 'Invalid date/time format', 'error');
                return;
            }

            // Check if clock out is after clock in for the same entry
            if (fieldName === 'Clock_Out_Time__c') {
                const entry = this.logEntryDetails?.timesheetEntries?.find(e => e.id === recordId);
                if (entry) {
                    const clockInField = entry.approvalFields?.find(f => f.fieldApiName === 'Clock_In_Time__c');
                    const clockInTime = clockInField ? new Date(clockInField.newValue) : null;
                    
                    if (clockInTime && dateObj <= clockInTime) {
                        this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                        event.target.value = this.formatDateTimeForInput(clockInField.newValue); // Reset to original
                        return;
                    }
                }
            }

            // Convert to ISO string
            newValue = dateObj.toISOString();
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

        console.log('Field edited:', { recordId, fieldName, newValue });
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

        console.log('Location slider changed:', { processId, newValue });
        
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

        console.log('Log field changed:', { fieldName, newValue });
    }

    /**
     * Method Name: handleApproveTimesheet
     * @description: Method to approve individual timesheet
     */
    handleApproveTimesheet(event) {
        const recordId = event.target.dataset.recordid;
        console.log('Approving timesheet:', recordId);
        // TODO: Implement Apex call
        this.showToast('Info', 'Approve Timesheet - Coming Soon', 'info');
    }

    /**
     * Method Name: handleRejectTimesheet
     * @description: Method to reject individual timesheet
     */
    handleRejectTimesheet(event) {
        const recordId = event.target.dataset.recordid;
        console.log('Rejecting timesheet:', recordId);
        // TODO: Implement Apex call
        this.showToast('Info', 'Reject Timesheet - Coming Soon', 'info');
    }

    /**
     * Method Name: handleApproveItem
     * @description: Method to approve individual timesheet item
     */
    handleApproveItem(event) {
        const recordId = event.target.dataset.recordid;
        console.log('Approving timesheet item:', recordId);
        // TODO: Implement Apex call
        this.showToast('Info', 'Approve Item - Coming Soon', 'info');
    }

    /**
     * Method Name: handleRejectItem
     * @description: Method to reject individual timesheet item
     */
    handleRejectItem(event) {
        const recordId = event.target.dataset.recordid;
        console.log('Rejecting timesheet item:', recordId);
        // TODO: Implement Apex call
        this.showToast('Info', 'Reject Item - Coming Soon', 'info');
    }

    /**
     * Method Name: handleBulkApproveTimesheets
     * @description: Method to approve all timesheets
     */
    handleBulkApproveTimesheets() {
        console.log('Bulk approving all timesheets');
        // TODO: Implement Apex call
        this.showToast('Info', 'Bulk Approve Timesheets - Coming Soon', 'info');
    }

    /**
     * Method Name: handleBulkRejectTimesheets
     * @description: Method to reject all timesheets
     */
    handleBulkRejectTimesheets() {
        console.log('Bulk rejecting all timesheets');
        // TODO: Implement Apex call
        this.showToast('Info', 'Bulk Reject Timesheets - Coming Soon', 'info');
    }

    /**
     * Method Name: handleApproveLocation
     * @description: Method to approve individual location process
     */
    handleApproveLocation(event) {
        const recordId = event.target.dataset.recordid;
        console.log('Approving location process:', recordId);
        // TODO: Implement Apex call
        this.showToast('Info', 'Approve Location Process - Coming Soon', 'info');
    }

    /**
     * Method Name: handleRejectLocation
     * @description: Method to reject individual location process
     */
    handleRejectLocation(event) {
        const recordId = event.target.dataset.recordid;
        console.log('Rejecting location process:', recordId);
        // TODO: Implement Apex call
        this.showToast('Info', 'Reject Location Process - Coming Soon', 'info');
    }

    /**
     * Method Name: handleBulkApproveLocations
     * @description: Method to approve all location processes
     */
    handleBulkApproveLocations() {
        console.log('Bulk approving all location processes');
        // TODO: Implement Apex call
        this.showToast('Info', 'Bulk Approve Locations - Coming Soon', 'info');
    }

    /**
     * Method Name: handleBulkRejectLocations
     * @description: Method to reject all location processes
     */
    handleBulkRejectLocations() {
        console.log('Bulk rejecting all location processes');
        // TODO: Implement Apex call
        this.showToast('Info', 'Bulk Reject Locations - Coming Soon', 'info');
    }

    /**
     * Method Name: handleAddImages
     * @description: Method to add images
     */
    handleAddImages() {
        console.log('Adding images');
        // TODO: Implement file upload
        this.showToast('Info', 'Add Images - Coming Soon', 'info');
    }

    /**
     * Method Name: handleDeleteAttachment
     * @description: Method to delete attachment
     */
    handleDeleteAttachment(event) {
        const attachmentId = event.target.dataset.attachmentid;
        console.log('Deleting attachment:', attachmentId);
        // TODO: Implement delete
        this.showToast('Info', 'Delete Attachment - Coming Soon', 'info');
    }

    /**
     * Method Name: handleApproveLogEntry
     * @description: Method to approve entire log entry
     */
    handleApproveLogEntry() {
        console.log('Approving log entry:', this.logEntryDetails.Id);
        console.log('Edited fields:', this.editedFields);
        console.log('Edited locations:', this.editedLocationProcesses);
        console.log('Log entry details:', this.logEntryDetails);
        // TODO: Implement Apex call to approve entire log entry
        this.showToast('Info', 'Approve Log Entry - Coming Soon', 'info');
    }

    /**
     * Method Name: handleRejectLogEntry
     * @description: Method to reject entire log entry
     */
    handleRejectLogEntry() {
        console.log('Rejecting log entry:', this.logEntryDetails.Id);
        // TODO: Implement Apex call to reject entire log entry
        this.showToast('Info', 'Reject Log Entry - Coming Soon', 'info');
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
        const dt = new Date(iso);
        const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
        return dt.toLocaleString('en-US', options);
    }

    /**
     * Method Name: formatDateTimeForInput
     * @description: Format ISO datetime for datetime-local input
     */
    formatDateTimeForInput(iso) {
        if (!iso) return '';
        // datetime-local expects format: YYYY-MM-DDTHH:mm
        const dt = new Date(iso);
        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        const hours = String(dt.getHours()).padStart(2, '0');
        const minutes = String(dt.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
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
}