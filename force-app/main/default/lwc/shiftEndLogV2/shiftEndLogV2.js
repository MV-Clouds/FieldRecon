import { LightningElement, wire, track } from 'lwc';
import getShiftEndLogsWithCrewInfo from '@salesforce/apex/ShiftEndLogV2Controller.getShiftEndLogsWithCrewInfo';
import updateShiftEndLogWithImages from '@salesforce/apex/ShiftEndLogV2Controller.updateShiftEndLogWithImages';
import deleteShiftEndLog from '@salesforce/apex/ShiftEndLogV2Controller.deleteShiftEndLog';
import deleteUploadedFiles from '@salesforce/apex/ShiftEndLogV2Controller.deleteUploadedFiles';
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
    
    // Edit Modal Multi-Step Properties
    @track editCurrentStep = 'step1';
    @track editLocationProcesses = [];
    @track editAllLocationProcesses = [];
    @track editModifiedProcesses = new Map();
    @track editOriginalCompletionPercentages = new Map(); // Store original percentages separately
    @track editLocationOptions = [];
    @track editSelectedLocationId = '';

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
    @track isCurrentUserCrewLeader = false;

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

    // Helper to update progress bars after DOM is ready
    updateProgressBars() {
        setTimeout(() => {
            // Update yesterday's progress bars (base layer - theme purple)
            const yesterdayBars = this.template.querySelectorAll('.yesterday-progress');
            yesterdayBars.forEach(bar => {
                const percentage = bar.dataset.percentage || 0;
                const color = bar.dataset.color || '#5a5adb'; // Theme purple
                bar.style.width = `${percentage}%`;
                bar.style.backgroundColor = color;
            });

            // Update today's progress bars (showing only the change portion - orange)
            const todayBars = this.template.querySelectorAll('.today-progress');
            todayBars.forEach(bar => {
                const totalPercentage = parseFloat(bar.dataset.percentage) || 0;
                const yesterdayPercentage = parseFloat(bar.dataset.yesterday) || 0;
                const changePercentage = totalPercentage - yesterdayPercentage; // Only the difference
                const color = bar.dataset.color || '#F0AD4E'; // Orange
                bar.style.width = `${changePercentage}%`;
                bar.style.backgroundColor = color;
            });

            // Update approval progress bars (showing approval change from yesterday)
            const approvalBars = this.template.querySelectorAll('.approval-progress');
            approvalBars.forEach(bar => {
                const approvalNewValue = parseFloat(bar.dataset.percentage) || 0;
                const yesterdayPercentage = parseFloat(bar.dataset.yesterday) || 0;
                const approvalChange = Math.max(0, approvalNewValue - yesterdayPercentage);
                bar.style.width = `${approvalChange}%`;
            });
        }, 0);
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
                    this.isCurrentUserCrewLeader = data?.crewInfo?.crewLeaderId != null ? true : false;
                    this.crewIds = data.crewInfo.crewIds || [];
                    console.log('Crew Leader ID:', this.crewLeaderId);
                    console.log('Crew IDs where user is leader:', this.crewIds);
                }

                // Extract and process shift end logs
                this.shiftEndLogs = data.shiftEndLogs.map(wrapper => {
                    const log = wrapper.logEntry;
                    const images = wrapper.images || [];
                    const locationProcesses = wrapper.locationProcesses || [];
                    const fieldChanges = wrapper.fieldChanges || [];                    
                    
                    // Map field API names to display names
                    const fieldNameMap = {
                        'wfrecon__Work_Performed__c': 'Work_Performed',
                        'wfrecon__Exceptions__c': 'Exceptions',
                        'wfrecon__Plan_for_Tomorrow__c': 'Plan_for_Tomorrow',
                        'wfrecon__Notes_to_Office__c': 'Notes_to_Office',
                        'wfrecon__Work_Performed_Date__c': 'Work_Performed_Date'
                    };

                    // Create a set of fields that changed today
                    const changedFieldsToday = new Set();
                    const fieldChangeDetails = {};
                    
                    fieldChanges.forEach(change => {
                        const mappedFieldName = fieldNameMap[change.fieldName] || change.fieldName;
                        changedFieldsToday.add(mappedFieldName);
                        fieldChangeDetails[mappedFieldName] = {
                            oldValue: change.oldValue,
                            newValue: change.newValue,
                            changedBy: change.changedBy,
                            changedDate: change.changedDate
                        };
                    });
                    
                    // Parse approval data if present
                    let approvalData = null;
                    let hasPendingApproval = false;
                    if (log.wfrecon__Approval_Data__c) {
                        try {
                            approvalData = JSON.parse(log.wfrecon__Approval_Data__c);
                            hasPendingApproval = approvalData && Object.keys(approvalData).length > 0;
                        } catch (e) {
                            console.error('Error parsing approval data:', e);
                        }
                    }

                    // Check if status is Auto-Approved or Approved
                    const status = log.wfrecon__Status__c;
                    const isApprovedStatus = status === 'Auto-Approved' || status === 'Approved';
                    
                    return {
                        Id: log.Id,
                        Name: log.Name,
                        wfrecon__Work_Performed__c: log.wfrecon__Work_Performed__c,
                        wfrecon__Work_Performed_Date__c: log.wfrecon__Work_Performed_Date__c,
                        wfrecon__Log_Type__c: log.wfrecon__Log_Type__c || 'Standard',
                        wfrecon__Exceptions__c: log.wfrecon__Exceptions__c,
                        wfrecon__Plan_for_Tomorrow__c: log.wfrecon__Plan_for_Tomorrow__c,
                        wfrecon__Notes_to_Office__c: log.wfrecon__Notes_to_Office__c,
                        wfrecon__Status__c: status,
                        wfrecon__Approval_Data__c: log.wfrecon__Approval_Data__c,
                        CreatedBy: log.CreatedBy,
                        formattedDate: this.formatDate(log.wfrecon__Work_Performed_Date__c),
                        hasExceptions: log.wfrecon__Exceptions__c && log.wfrecon__Exceptions__c.trim() !== '',
                        createdByName: log.CreatedBy?.Name || 'Unknown User',
                        statusVariant: this.getStatusVariant(log.wfrecon__Log_Type__c),
                        // Approval-related properties
                        approvalData: approvalData,
                        hasPendingApproval: hasPendingApproval,
                        isApprovedStatus: isApprovedStatus,
                        canEdit: !isApprovedStatus,
                        canDelete: !isApprovedStatus,
                        approvalStatusLabel: hasPendingApproval ? 'Pending Approval' : (status || 'Draft'),
                        // Display properties with dash for empty values
                        displayWorkPerformed: log.wfrecon__Work_Performed__c || '-',
                        displayExceptions: log.wfrecon__Exceptions__c || '-',
                        displayPlanForTomorrow: log.wfrecon__Plan_for_Tomorrow__c || '-',
                        displayNotesToOffice: log.wfrecon__Notes_to_Office__c || '-',
                        exceptionContentClass: (log.wfrecon__Exceptions__c && log.wfrecon__Exceptions__c.trim() !== '') ? 'exception-content' : 'plan-content',
                        // Field change tracking
                        changedFieldsToday: Array.from(changedFieldsToday),
                        fieldChangeDetails: fieldChangeDetails,
                        hasChangesToday: changedFieldsToday.size > 0,
                        workPerformedChanged: changedFieldsToday.has('Work_Performed'),
                        exceptionsChanged: changedFieldsToday.has('Exceptions'),
                        planForTomorrowChanged: changedFieldsToday.has('Plan_for_Tomorrow'),
                        notesToOfficeChanged: changedFieldsToday.has('Notes_to_Office'),
                        workPerformedDateChanged: changedFieldsToday.has('Work_Performed_Date'),
                        images: images.map(img => ({
                            Id: img.Id,
                            ContentDocumentId: img.ContentDocumentId,
                            Title: img.Title,
                            FileExtension: img.FileExtension,
                            thumbnailUrl: `/sfc/servlet.shepherd/document/download/${img.ContentDocumentId}`,
                            previewUrl: `/sfc/servlet.shepherd/document/download/${img.ContentDocumentId}`
                        })),
                        hasImages: images.length > 0,
                        imageCount: images.length,
                        // Location processes with approval data
                        locationProcesses: locationProcesses.map(proc => {
                            let approvalDataForProcess = null;
                            let isPendingApproval = false;
                            
                            // Parse approval data - it's stored as JSON array [{ id, oldValue, newValue }]
                            // Only show as pending if status is 'Pending' (not approved/auto-approved)
                            if (approvalData && Array.isArray(approvalData) && !isApprovedStatus) {
                                approvalDataForProcess = approvalData.find(item => item.id === proc.processId);
                                isPendingApproval = !!approvalDataForProcess;
                            }
                            
                            const approvalOldValue = approvalDataForProcess?.oldValue || 0;
                            const approvalNewValue = approvalDataForProcess?.newValue || 0;
                            const yesterdayPercent = proc.yesterdayPercentage || 0;
                            
                            return {
                                ...proc,
                                isPendingApproval: isPendingApproval,
                                approvalOldValue: approvalOldValue,
                                approvalNewValue: approvalNewValue,
                                // For display: if in approval, show approval segment from yesterday to new value
                                displayYesterdayPercentage: yesterdayPercent,
                                displayApprovalPercentage: isPendingApproval ? (approvalNewValue - yesterdayPercent) : 0
                            };
                        }),
                        hasLocationProcesses: locationProcesses.length > 0
                    };
                });
                
                this.filteredLogs = [...this.shiftEndLogs];
                this.currentPage = 1; // Reset to first page
                this.updateDisplayedLogs(); // Initialize displayed logs
                this.updateProgressBars(); // Update progress bars
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
        this.updateProgressBars(); // Update progress bars after changing displayed logs
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

    handleCloseEntryPopup(event) {
        this.showEntryPopup = false;
        
        // Check if a record was created and refresh data
        if (event && event.detail && event.detail.isRecordCreated) {
            this.loadShiftEndLogsWithCrewInfo();
        }
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

            // Load location processes for step 2
            this.loadEditLocationProcesses(logToEdit);
        }
        
        // Reset to step 1
        this.editCurrentStep = 'step1';
        this.showEditModal = true;
    }

    // Handle close modal
    handleCloseModal() {
        // Delete newly uploaded files before closing (exclude camera photos as they're not yet uploaded)
        if (this.newUploadedFiles && this.newUploadedFiles.length > 0) {
            try {
                // Only delete files that have real ContentDocument IDs (not temporary camera photo IDs)
                const contentDocumentIds = this.newUploadedFiles
                    .filter(file => !file.isCamera && !file.id.startsWith('temp_'))
                    .map(file => file.id);
                
                if (contentDocumentIds.length > 0) {
                    deleteUploadedFiles({ contentDocumentIds })
                    .then(() => {
                        console.log('Successfully deleted newly uploaded files on modal close')
                    })
                    .catch(error => {
                        console.error('Error deleting newly uploaded files on modal close:', error)
                    });
            }
            } catch (error) {
                console.error('Error deleting uploaded files:', error);

            }
        }

        this.showEditModal = false;
        this.editLogId = null;
        this.editCurrentStep = 'step1';
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
        this.editLocationProcesses = [];
        this.editAllLocationProcesses = [];
        this.editModifiedProcesses = new Map();
        this.editOriginalCompletionPercentages = new Map();
        this.editLocationOptions = [];
        this.editSelectedLocationId = '';
    }

        // Handle input change in edit form
    handleEditInputChange(event) {
        const field = event.target.dataset.field;
        if (field) {
            this.editFormData = {
                ...this.editFormData,
                [field]: event.target.value
            };
        }
    }

    // Edit Modal Navigation
    handleEditNext() {
        if (this.editCurrentStep === 'step1') {
            // Validate Step 1 required fields
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
            
            this.editCurrentStep = 'step2';
            // Update slider visuals after DOM renders
            setTimeout(() => this.updateEditSliderVisuals(), 100);
        } else if (this.editCurrentStep === 'step2') {
            this.editCurrentStep = 'step3';
        }
    }

    handleEditPrevious() {
        if (this.editCurrentStep === 'step3') {
            this.editCurrentStep = 'step2';
            // Update slider visuals after DOM renders
            setTimeout(() => this.updateEditSliderVisuals(), 100);
        } else if (this.editCurrentStep === 'step2') {
            this.editCurrentStep = 'step1';
        }
    }

    // Load location processes for edit modal
    loadEditLocationProcesses(logToEdit) {
        if (logToEdit.locationProcesses && logToEdit.locationProcesses.length > 0) {
            
            // Clear the original percentages map at the start
            this.editOriginalCompletionPercentages.clear();
            
            // Check if there's approval data - parse the JSON array format
            let approvalDataArray = [];
            if (logToEdit.wfrecon__Approval_Data__c) {
                try {
                    approvalDataArray = JSON.parse(logToEdit.wfrecon__Approval_Data__c);
                } catch (e) {
                    console.error('Error parsing approval data in edit modal:', e);
                }
            }
            
            // Map backend fields to component properties
            this.editAllLocationProcesses = logToEdit.locationProcesses.map(proc => {
                // Handle different possible field names from backend
                const processId = proc.Id || proc.processId;
                const processName = proc.Name || proc.processName;
                const locationName = proc.wfrecon__Location__r?.Name || proc.locationName || 'Unknown Location';
                const sequence = proc.wfrecon__Sequence__c || proc.sequence || 0;
                
                // Get yesterday's percentage (total completed before today)
                const yesterdayPercentage = Math.round(parseFloat(proc.yesterdayPercentage || proc.oldPercentage || 0));
                
                // Get current total completed percentage
                const completionPercentage = Math.round(parseFloat(proc.wfrecon__Completed_Percentage__c || proc.completionPercentage || 0));
                
                // Calculate today's change (difference between current and yesterday)
                const todayProgress = Math.max(0, completionPercentage - yesterdayPercentage);
                const remainingProgress = Math.max(0, 100 - completionPercentage);
                
                // Check if this process is pending approval from the JSON array
                const approvalDataForProcess = approvalDataArray.find(item => item.id === processId);
                const isPendingApproval = !!approvalDataForProcess;
                const approvalOldValue = approvalDataForProcess?.oldValue || 0;
                const approvalNewValue = approvalDataForProcess?.newValue || 0;
                
                // If in approval: purple shows (yesterday → approval value)
                // If current > approval: that's new changes after approval
                const approvalChange = isPendingApproval 
                    ? Math.round(approvalNewValue - yesterdayPercentage)
                    : 0;
                
                // Calculate today's progress considering approval
                const actualTodayProgress = isPendingApproval 
                    ? Math.max(0, completionPercentage - yesterdayPercentage) // Show total change from yesterday
                    : todayProgress;
                
                // Store the original completion percentage in the separate Map
                this.editOriginalCompletionPercentages.set(processId, completionPercentage);
                                
                return {
                    processId: processId,
                    processName: processName,
                    locationName: locationName,
                    sequence: sequence,
                    yesterdayPercentage: yesterdayPercentage, // Total completed till yesterday (green base)
                    completionPercentage: completionPercentage, // Current total completed
                    todayProgress: actualTodayProgress, // Today's change (includes approval changes)
                    remainingProgress: remainingProgress,
                    changedToday: false,
                    isPendingApproval: isPendingApproval,
                    approvalOldValue: approvalOldValue,
                    approvalNewValue: approvalNewValue,
                    approvalChange: approvalChange,
                    displayApprovalPercentage: approvalChange,
                    sliderMinValue: yesterdayPercentage, // Always start from yesterday (not approval value)
                    completedStyle: `width: ${yesterdayPercentage}%`,
                    todayStyle: `width: ${actualTodayProgress}%`,
                    approvalStyle: `width: ${approvalChange}%`,
                    remainingStyle: `width: ${remainingProgress}%`
                };
            });
            
            this.buildEditLocationOptions();
            this.setEditDefaultLocation();
        }
    }

    buildEditLocationOptions() {
        const locationMap = new Map();
        this.editAllLocationProcesses.forEach(proc => {
            if (!locationMap.has(proc.locationName)) {
                locationMap.set(proc.locationName, {
                    label: proc.locationName,
                    value: proc.locationName
                });
            }
        });
        this.editLocationOptions = Array.from(locationMap.values());
    }

    setEditDefaultLocation() {
        if (this.editLocationOptions.length > 0) {
            this.editSelectedLocationId = this.editLocationOptions[0].value;
            this.filterEditProcessesByLocation();
        }
    }

    handleEditLocationChange(event) {
        this.editSelectedLocationId = event.detail.value;
        this.filterEditProcessesByLocation();
        // Update visual sliders after DOM renders
        setTimeout(() => this.updateEditSliderVisuals(), 50);
    }

    filterEditProcessesByLocation() {
        let filtered;
        if (this.editSelectedLocationId) {
            filtered = this.editAllLocationProcesses.filter(
                proc => proc.locationName === this.editSelectedLocationId
            );
        } else {
            filtered = [...this.editAllLocationProcesses];
        }
        
        // Ensure styles are recalculated for filtered processes
        this.editLocationProcesses = filtered.map(proc => {
            const todayProgress = Math.max(0, proc.completionPercentage - proc.yesterdayPercentage);
            const remainingProgress = Math.max(0, 100 - proc.completionPercentage);
            const approvalChange = proc.isPendingApproval ? proc.approvalChange : 0;
            
            return {
                ...proc,
                todayProgress: todayProgress,
                remainingProgress: remainingProgress,
                displayApprovalPercentage: approvalChange,
                completedStyle: `width: ${proc.yesterdayPercentage}%`,
                todayStyle: `width: ${todayProgress}%`,
                approvalStyle: `width: ${approvalChange}%`,
                remainingStyle: `width: ${remainingProgress}%`
            };
        });
        
        // Update visual sliders after DOM renders
        setTimeout(() => this.updateEditSliderVisuals(), 50);
    }

    // Update slider visuals manually in DOM
    updateEditSliderVisuals() {
        this.editLocationProcesses.forEach(processData => {
            const sliderElement = this.template.querySelector(`input[data-process-id="${processData.processId}"]`);
            if (sliderElement) {
                // Set the slider value to reflect current completion percentage
                sliderElement.value = processData.completionPercentage;
                
                const sliderContainer = sliderElement.closest('.slider-wrapper');
                if (sliderContainer) {
                    const sliderTrack = sliderContainer.querySelector('.slider-track');
                    if (sliderTrack) {
                        const completed = sliderTrack.querySelector('.completed');
                        const today = sliderTrack.querySelector('.today');
                        const approval = sliderTrack.querySelector('.approval');
                        const remaining = sliderTrack.querySelector('.remaining');

                        if (completed && today && approval && remaining) {
                            const yesterday = processData.yesterdayPercentage || 0;
                            const current = processData.completionPercentage || 0;
                            const approvalValue = processData.approvalNewValue || 0;
                            const isInApproval = processData.isPendingApproval;
                            
                            // Always hide approval section (no orange)
                            approval.style.width = '0%';
                            approval.style.display = 'none';
                            
                            // Green = yesterday/base completed
                            completed.style.width = `${yesterday}%`;
                            
                            // Purple = today's changes (from yesterday to current)
                            // If in approval: shows approval changes + any modifications after
                            const todayChange = Math.max(0, current - yesterday);
                            today.style.width = `${todayChange}%`;
                            today.style.display = todayChange > 0 ? 'block' : 'none';
                            today.style.background = 'linear-gradient(90deg, rgba(94, 90, 219, 0.9) 0%, rgba(94, 90, 219, 1) 100%)';
                            
                            // Gray = remaining
                            remaining.style.width = `${Math.max(0, 100 - current)}%`;
                        }
                    }
                }
                
                // Position slider to start at yesterdayPercentage (always from base, not approval)
                const sliderWidth = 100 - processData.yesterdayPercentage;
                sliderElement.style.left = `${processData.yesterdayPercentage}%`;
                sliderElement.style.width = `${sliderWidth}%`;

                // Disable slider if 100% complete
                if (processData.completionPercentage >= 100) {
                    sliderElement.disabled = true;
                    sliderElement.style.cursor = 'not-allowed';
                } else {
                    sliderElement.disabled = false;
                    sliderElement.style.cursor = 'pointer';
                }
            }
        });
    }

    handleEditSliderInput(event) {
        const processId = event.target.dataset.processId;
        const newValue = parseInt(event.target.value, 10);
        const sliderElement = event.target;
        
        // Find process data
        const processData = this.editLocationProcesses.find(p => p.processId === processId);
        if (!processData) return;

        // Update visual progress in real-time
        const sliderContainer = sliderElement.closest('.slider-wrapper');
        if (sliderContainer) {
            const sliderTrack = sliderContainer.querySelector('.slider-track');
            if (sliderTrack) {
                const proc = this.editLocationProcesses.find(p => p.processId === processId);
                if (proc) {
                    const yesterday = proc.yesterdayPercentage || 0;
                    const approvalValue = proc.approvalNewValue || 0;
                    const isInApproval = proc.isPendingApproval;
                    
                    const completed = sliderTrack.querySelector('.completed');
                    const today = sliderTrack.querySelector('.today');
                    const approval = sliderTrack.querySelector('.approval');
                    const remaining = sliderTrack.querySelector('.remaining');

                    if (completed && today && approval && remaining) {
                        // Always hide approval section (no orange)
                        approval.style.width = '0%';
                        approval.style.display = 'none';
                        
                        // Green = yesterday/base completed
                        completed.style.width = `${yesterday}%`;
                        
                        // Purple = today's changes (from yesterday to current)
                        const todayProgress = Math.max(0, newValue - yesterday);
                        today.style.width = `${todayProgress}%`;
                        today.style.display = todayProgress > 0 ? 'block' : 'none';
                        today.style.background = 'linear-gradient(90deg, rgba(94, 90, 219, 0.9) 0%, rgba(94, 90, 219, 1) 100%)';
                        
                        // Gray = remaining
                        remaining.style.width = `${Math.max(0, 100 - newValue)}%`;
                    }

                    // Update labels
                    const labelsContainer = sliderElement.closest('.edit-location-slider-container')?.querySelector('.slider-labels');
                    if (labelsContainer) {
                        const todayPercent = Math.max(0, newValue - yesterday);
                        const remainingPercent = Math.max(0, 100 - newValue);
                        
                        const todayLabel = labelsContainer.querySelector('.label-today');
                        if (todayLabel) {
                            // Find the text node after the SVG
                            const textNodes = Array.from(todayLabel.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                            if (textNodes.length > 0) {
                                textNodes[0].textContent = `Today: ${todayPercent}%`;
                            }
                        }
                        const remainingLabel = labelsContainer.querySelector('.label-remaining');
                        if (remainingLabel) {
                            const textNodes = Array.from(remainingLabel.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                            if (textNodes.length > 0) {
                                textNodes[0].textContent = `Remaining: ${remainingPercent}%`;
                            }
                        }
                    }
                    
                    // Update percentage display
                    const percentageDisplay = sliderElement.closest('.edit-location-slider-container')?.querySelector('.progress-percentage');
                    if (percentageDisplay) {
                        percentageDisplay.textContent = `${newValue}% Complete`;
                    }
                }
            }
        }
    }

    handleEditSliderChange(event) {
        const processId = event.target.dataset.processId;
        const yesterdayValue = parseInt(event.target.dataset.originalValue, 10); // This is yesterdayPercentage (sliderMinValue)
        const newValue = parseInt(event.target.value, 10);
        
        // Find the process data to check if it's in approval and get original completion %
        const processData = this.editAllLocationProcesses.find(p => p.processId === processId);
        if (!processData) return;
        
        // Get the ORIGINAL completion percentage from the separate Map
        const originalCompletionPercentage = this.editOriginalCompletionPercentages.get(processId);
        
        // For approval data JSON, always use yesterdayPercentage as the base
        // This ensures approval data always shows changes from the base value
        // Track modification only if changed from the original state
        if (newValue !== originalCompletionPercentage) {
            this.editModifiedProcesses.set(processId, {
                processId: processId,
                originalValue: yesterdayValue, // Always use yesterday as base for approval data
                newValue: newValue
            });
        } else {
            this.editModifiedProcesses.delete(processId);
        }

        // Update in editAllLocationProcesses to persist across location changes
        const allProcessIndex = this.editAllLocationProcesses.findIndex(p => p.processId === processId);
        if (allProcessIndex !== -1) {
            const proc = this.editAllLocationProcesses[allProcessIndex];
            const todayProgress = Math.max(0, newValue - proc.yesterdayPercentage);
            const remainingProgress = Math.max(0, 100 - newValue);
            
            this.editAllLocationProcesses = this.editAllLocationProcesses.map((p, index) => {
                if (index === allProcessIndex) {
                    return {
                        ...p,
                        completionPercentage: newValue,
                        todayProgress: todayProgress,
                        remainingProgress: remainingProgress,
                        changedToday: newValue !== originalCompletionPercentage,
                        completedStyle: `width: ${p.yesterdayPercentage}%`,
                        todayStyle: `width: ${todayProgress}%`,
                        remainingStyle: `width: ${remainingProgress}%`
                    };
                }
                return p;
            });
        }

        // Update in editLocationProcesses for current display
        const processIndex = this.editLocationProcesses.findIndex(p => p.processId === processId);
        if (processIndex !== -1) {
            const proc = this.editLocationProcesses[processIndex];
            const todayProgress = Math.max(0, newValue - proc.yesterdayPercentage);
            const remainingProgress = Math.max(0, 100 - newValue);
            
            this.editLocationProcesses = this.editLocationProcesses.map((p, index) => {
                if (index === processIndex) {
                    return {
                        ...p,
                        completionPercentage: newValue,
                        todayProgress: todayProgress,
                        remainingProgress: remainingProgress,
                        changedToday: newValue !== originalCompletionPercentage,
                        completedStyle: `width: ${p.yesterdayPercentage}%`,
                        todayStyle: `width: ${todayProgress}%`,
                        remainingStyle: `width: ${remainingProgress}%`
                    };
                }
                return p;
            });
        }

        // Update visual feedback
        this.handleEditSliderInput(event);
    }

    // Reset approval for a process (restore to original base)
    handleResetApproval(event) {
        const processId = event.currentTarget.dataset.processId;
        
        // Find the process in editAllLocationProcesses
        const processData = this.editAllLocationProcesses.find(p => p.processId === processId);
        if (!processData || !processData.isPendingApproval) {
            return;
        }
        
        // Reset to yesterday's percentage (the original base before approval)
        const resetValue = processData.yesterdayPercentage;
        
        // Update in editAllLocationProcesses
        const allProcessIndex = this.editAllLocationProcesses.findIndex(p => p.processId === processId);
        if (allProcessIndex !== -1) {
            this.editAllLocationProcesses = this.editAllLocationProcesses.map((p, index) => {
                if (index === allProcessIndex) {
                    return {
                        ...p,
                        completionPercentage: resetValue,
                        todayProgress: 0,
                        remainingProgress: 100 - resetValue,
                        changedToday: false,
                        isPendingApproval: false,
                        approvalOldValue: 0,
                        approvalNewValue: 0,
                        approvalChange: 0,
                        displayApprovalPercentage: 0,
                        completedStyle: `width: ${resetValue}%`,
                        todayStyle: `width: 0%`,
                        approvalStyle: `width: 0%`,
                        remainingStyle: `width: ${100 - resetValue}%`
                    };
                }
                return p;
            });
        }
        
        // Update in editLocationProcesses for current display
        const processIndex = this.editLocationProcesses.findIndex(p => p.processId === processId);
        if (processIndex !== -1) {
            this.editLocationProcesses = this.editLocationProcesses.map((p, index) => {
                if (index === processIndex) {
                    return {
                        ...p,
                        completionPercentage: resetValue,
                        todayProgress: 0,
                        remainingProgress: 100 - resetValue,
                        changedToday: false,
                        isPendingApproval: false,
                        approvalOldValue: 0,
                        approvalNewValue: 0,
                        approvalChange: 0,
                        displayApprovalPercentage: 0,
                        completedStyle: `width: ${resetValue}%`,
                        todayStyle: `width: 0%`,
                        approvalStyle: `width: 0%`,
                        remainingStyle: `width: ${100 - resetValue}%`
                    };
                }
                return p;
            });
        }
        
        // Update the original completion percentage map
        this.editOriginalCompletionPercentages.set(processId, resetValue);
        
        // Remove from modified processes if present
        this.editModifiedProcesses.delete(processId);
        
        // Update visual sliders
        setTimeout(() => this.updateEditSliderVisuals(), 50);
        
        this.showToast('Success', 'Approval reset to original base value', 'success');
    }

    // Removed handleDiscardEditChanges and handleSaveEditChanges
    // State is now preserved automatically and saved on final Update button click

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

        // Get existing approval data from the current log entry
        const currentLog = this.shiftEndLogs.find(log => log.Id === this.editLogId);
        let existingApprovalData = [];
        
        if (currentLog && currentLog.wfrecon__Approval_Data__c) {
            try {
                existingApprovalData = JSON.parse(currentLog.wfrecon__Approval_Data__c);
                if (!Array.isArray(existingApprovalData)) {
                    existingApprovalData = [];
                }
            } catch (e) {
                console.error('Error parsing existing approval data:', e);
                existingApprovalData = [];
            }
        }

        // Create a map starting with existing approval data
        const approvalDataMap = new Map();
        existingApprovalData.forEach(item => {
            approvalDataMap.set(item.id, item);
        });

        // Add or update with new modifications
        Array.from(this.editModifiedProcesses.entries()).forEach(([processId, modification]) => {
            approvalDataMap.set(processId, {
                id: processId,
                oldValue: modification.originalValue,
                newValue: modification.newValue
            });
        });

        // Only remove processes that were in the current edit session and were reset back
        // Don't touch processes that were already in approval but not modified in this session
        this.editAllLocationProcesses.forEach(proc => {
            const wasInExistingApproval = existingApprovalData.some(item => item.id === proc.processId);
            const wasModifiedNow = this.editModifiedProcesses.has(proc.processId);
            
            // Only remove if it was modified in THIS session and then reset back
            // OR if it's a new modification that was later reset (but this shouldn't happen as we check !== in handleEditSliderChange)
            if (wasModifiedNow) {
                const originalPercentage = this.editOriginalCompletionPercentages.get(proc.processId);
                const currentPercentage = proc.completionPercentage;
                
                // If modified in this session but reset to original, remove from approval data
                if (originalPercentage === currentPercentage) {
                    approvalDataMap.delete(proc.processId);
                }
            }
            // If NOT in existing approval and NOT modified now, don't add it
            // If IN existing approval and NOT modified now, keep it (already in map)
        });

        // Convert map back to array
        const mergedApprovalData = Array.from(approvalDataMap.values());

        const formData = {
            Id: this.editLogId,
            wfrecon__Work_Performed_Date__c: this.editFormData.workPerformedDate,
            wfrecon__Work_Performed__c: this.editFormData.workPerformed,
            wfrecon__Exceptions__c: this.editFormData.exceptions,
            wfrecon__Plan_for_Tomorrow__c: this.editFormData.planForTomorrow,
            wfrecon__Notes_to_Office__c: this.editFormData.notesToOffice,
        };

        // Only set approval data if there are any updates (existing or new)
        if(mergedApprovalData.length > 0) {
            formData.wfrecon__Approval_Data__c = JSON.stringify(mergedApprovalData);
        }

        console.log('formData ==> ', formData);
        console.log('Existing approval data:', existingApprovalData);
        console.log('New modifications from editModifiedProcesses:', Array.from(this.editModifiedProcesses.entries()));
        console.log('Merged approval data:', mergedApprovalData);
        

        this.isLoading = true;

        // Combined update: delete removed images and update log entry
        updateShiftEndLogWithImages({ 
            logEntry: formData, 
            contentDocumentIdsToDelete: this.imagesToDelete
        })
        .then(() => {
            this.showToast('Success', 'Shift End Log updated successfully', 'success');
            this.handleCloseModal();
            this.loadShiftEndLogsWithCrewInfo();
        })
        .catch(error => {
            const errorMessage = error.body?.message || 'Error updating shift end log';
            this.showToast('Error', errorMessage, 'error');
        })
        .finally(() => {
            this.isLoading = false;
        });
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

    // Edit Modal Step Getters
    get isEditStep1() { return this.editCurrentStep === 'step1'; }
    get isEditStep2() { return this.editCurrentStep === 'step2'; }
    get isEditStep3() { return this.editCurrentStep === 'step3'; }

    get hasEditLocationOptions() {
        return this.editLocationOptions && this.editLocationOptions.length > 0;
    }

    get hasEditLocationProcesses() {
        return this.editLocationProcesses && this.editLocationProcesses.length > 0;
    }

    get hasModifiedProcesses() {
        return this.editModifiedProcesses.size > 0;
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