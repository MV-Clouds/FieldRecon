import { LightningElement, wire, track } from 'lwc';
import getShiftEndLogsWithCrewInfo from '@salesforce/apex/ShiftEndLogV2Controller.getShiftEndLogsWithCrewInfo';
import updateShiftEndLogWithImages from '@salesforce/apex/ShiftEndLogV2Controller.updateShiftEndLogWithImages';
import deleteShiftEndLog from '@salesforce/apex/ShiftEndLogV2Controller.deleteShiftEndLog';
import deleteUploadedFiles from '@salesforce/apex/ShiftEndLogV2Controller.deleteUploadedFiles';
import getChatterFeedItems from '@salesforce/apex/ShiftEndLogEntriesController.getChatterFeedItems';
import checkOrgStorageLimit from '@salesforce/apex/ShiftEndLogV2Controller.checkOrgStorageLimit';
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import { subscribe, unsubscribe, onError } from 'lightning/empApi';

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
    @track expandedCardId = null; // Track which card is expanded

    // Edit Modal Multi-Step Properties
    @track editCurrentStep = 'step1';
    @track editLocationProcesses = [];
    @track editAllLocationProcesses = [];
    @track editModifiedProcesses = new Map();
    @track editOriginalCompletionPercentages = new Map(); // Store original percentages separately
    @track editLocationOptions = [];
    @track editSelectedLocationId = '';
    @track editActiveAccordionSections = []; // Track active accordion sections for edit modal
    @track editGroupedLocationProcesses = []; // Grouped processes by location for edit modal

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
    @track imagesToDelete = []; // For newly uploaded files to delete
    @track imagesToUnlink = []; // For Chatter images to unlink (not delete)
    @track newlyUploadedContentDocIds = []; // Track new uploads during edit session for cleanup on cancel

    // Camera Modal
    @track showCameraModal = false;
    @track cameraStream = null;
    @track capturedPhoto = null;

    // Chatter Modal
    @track showChatterModal = false;
    @track showUploadOptions = false;
    @track chatterFeedItems = [];
    @track isLoadingChatter = false;
    @track isLoadingMoreChatter = false;
    @track chatterDaysOffset = 0;
    @track hasMoreChatterItems = true;

    // Crew information for current user
    @track crewLeaderId = null;
    @track crewIds = [];
    @track isCurrentUserCrewLeader = false;
    @track isAdminUser = false;
    @track hasAccess = false;

    subscription = {};
    channelName = '/event/wfrecon__General_Refresh_Event__e';

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
        this.checkUserPermissions();
        this.loadShiftEndLogsWithCrewInfo();
        this.handleSubscribe();
    }

    disconnectedCallback() {
        this.handleUnsubscribe();
    }

    handleSubscribe() {
        const messageCallback = (response) => {
            if(response.data && response.data.payload && response.data.payload.wfrecon__Record_Id__c === this.recordId) {
                console.log('Platform Event received, refreshing...');
                this.loadShiftEndLogsWithCrewInfo();
            }
        };

        subscribe(this.channelName, -1, messageCallback).then(response => {
            this.subscription = response;
        });
    }

    handleUnsubscribe() {
        unsubscribe(this.subscription, response => {
            console.log('Unsubscribed from channel');
        });
    }

    renderedCallback() {
        // Open first accordion in view mode by default for each expanded card
        if (this.expandedCardId) {
            const firstAccordionContent = this.template.querySelector(
                `.location-accordion-content[data-log-id="${this.expandedCardId}"]`
            );
            const firstAccordionHeader = this.template.querySelector(
                `.location-accordion-header[data-log-id="${this.expandedCardId}"]`
            );

            if (firstAccordionContent && !firstAccordionContent.classList.contains('open')) {
                firstAccordionContent.classList.add('open');
                if (firstAccordionHeader) {
                    firstAccordionHeader.classList.add('active');
                }
            }
        }

        // Open first accordion in edit mode by default for Step 2
        if (this.showEditModal && this.editCurrentStep === 'step2') {
            const firstEditContent = this.template.querySelector('.edit-location-accordion-content');
            const firstEditHeader = this.template.querySelector('.edit-location-accordion-header');

            if (firstEditContent && !firstEditContent.classList.contains('open')) {
                firstEditContent.classList.add('open');
                if (firstEditHeader) {
                    firstEditHeader.classList.add('active');
                }
            }
            // Always update sliders when on step 2 (regardless of accordion state)
            setTimeout(() => this.updateEditSliderVisuals(), 100);
        }
    }

    // Helper to group location processes for accordion view
    groupLocationProcessesForView(locationProcesses, locationProcessChanges, isApprovedStatus) {
        const locationMap = new Map();

        locationProcesses.forEach(proc => {
            let approvalDataForProcess = null;
            let isPendingApproval = false;

            // Parse approval data - locationProcessChanges is now an array from the new structure
            // Only show as pending if status is 'Pending' (not approved/auto-approved)
            if (locationProcessChanges && locationProcessChanges.length > 0 && !isApprovedStatus) {
                approvalDataForProcess = locationProcessChanges.find(item => item.id === proc.processId);
                isPendingApproval = !!approvalDataForProcess;
            }

            const approvalOldValue = approvalDataForProcess?.oldValue || 0;
            const approvalNewValue = approvalDataForProcess?.newValue || 0;
            const yesterdayPercent = proc.yesterdayPercentage || 0;

            const processWithApproval = {
                ...proc,
                isPendingApproval: isPendingApproval,
                approvalOldValue: approvalOldValue,
                approvalNewValue: approvalNewValue,
                displayYesterdayPercentage: yesterdayPercent,
                displayApprovalPercentage: isPendingApproval ? (approvalNewValue - yesterdayPercent) : 0
            };

            if (!locationMap.has(proc.locationName)) {
                locationMap.set(proc.locationName, {
                    locationName: proc.locationName,
                    sectionName: proc.locationName.replace(/\s+/g, '_'),
                    processes: []
                });
            }
            locationMap.get(proc.locationName).processes.push(processWithApproval);
        });

        return Array.from(locationMap.values());
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

    checkUserPermissions() {
        const permissionSetsToCheck = ['FR_Admin'];

        checkPermissionSetsAssigned({ psNames: permissionSetsToCheck })
            .then(result => {
                const assignedMap = result.assignedMap || {};
                const isAdmin = result.isAdmin || false;

                const hasFRAdmin = assignedMap['FR_Admin'] || false;

                // Set both flags
                this.isAdminUser = isAdmin || hasFRAdmin;
            })
            .catch(error => {
                this.isAdminUser = false;
            })
            .finally(() => {
                this.isLoading = false;
            });
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

                this.hasAccess = this.isCurrentUserCrewLeader || this.isAdminUser;

                // Extract and process shift end logs
                this.shiftEndLogs = data.shiftEndLogs.map(wrapper => {
                    const log = wrapper.logEntry;
                    const images = wrapper.images || [];
                    const locationProcesses = wrapper.locationProcesses || [];

                    // Parse approval data if present - now using new structure
                    let approvalData = null;
                    let locationProcessChanges = [];
                    let timesheetEntryChanges = {};
                    let hasPendingApproval = false;

                    // Create a set of fields that changed (from approval data)
                    const changedFieldsToday = new Set();
                    const fieldChangeDetails = {};
                    if (log.wfrecon__Approval_Data__c) {
                        try {
                            const parsedData = JSON.parse(log.wfrecon__Approval_Data__c);

                            // Check if it's the new structure or old structure
                            if (parsedData.locationProcessChanges) {
                                // New structure: { locationProcessChanges: [], timesheetEntryChanges: {} }
                                approvalData = parsedData;
                                locationProcessChanges = parsedData.locationProcessChanges || [];
                                timesheetEntryChanges = parsedData.timesheetEntryChanges || {};
                                hasPendingApproval = locationProcessChanges.length > 0 || Object.keys(timesheetEntryChanges).length > 0;

                                // Extract timesheet entry changes to track which fields changed
                                // Timesheet entry changes contain clock in/out modifications
                                Object.values(timesheetEntryChanges).forEach(entryData => {
                                    if (entryData.changes && Array.isArray(entryData.changes)) {
                                        entryData.changes.forEach(change => {
                                            // Track that timesheet entries were modified
                                            changedFieldsToday.add('Timesheet_Entries');
                                        });
                                    }
                                });
                            } else if (Array.isArray(parsedData)) {
                                // Old structure - convert to new structure for backwards compatibility
                                locationProcessChanges = parsedData;
                                approvalData = {
                                    locationProcessChanges: parsedData,
                                    timesheetEntryChanges: {}
                                };
                                hasPendingApproval = parsedData.length > 0;
                            }
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
                        status: status || 'Pending',
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
                        images: images.map(img => {
                            const ext = img.FileExtension ? img.FileExtension.toLowerCase() : '';
                            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'].includes(ext);
                            const isVideo = ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'].includes(ext);
                            const isPdf = ext === 'pdf';
                            const isDoc = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);

                            return {
                                Id: img.Id,
                                ContentDocumentId: img.ContentDocumentId,
                                Title: img.Title,
                                FileExtension: ext,
                                isImage: isImage,
                                isVideo: isVideo,
                                isPdf: isPdf,
                                isDoc: isDoc,
                                hasPreview: isImage || isVideo || isPdf,
                                thumbnailUrl: `/sfc/servlet.shepherd/document/download/${img.ContentDocumentId}`,
                                previewUrl: `/sfc/servlet.shepherd/document/download/${img.ContentDocumentId}`,
                                fileIcon: this.getFileIconForType(ext)
                            };
                        }),
                        hasImages: images.length > 0,
                        imageCount: images.length,
                        // Location processes with approval data
                        locationProcesses: locationProcesses.map(proc => {
                            let approvalDataForProcess = null;
                            let isPendingApproval = false;
                            let changedToday = false;
                            let oldPercentage = null;
                            let newPercentage = null;

                            // Check if this process has changes in approval data
                            if (locationProcessChanges && locationProcessChanges.length > 0) {
                                approvalDataForProcess = locationProcessChanges.find(item => item.id === proc.processId);
                                if (approvalDataForProcess) {
                                    changedToday = true;
                                    oldPercentage = approvalDataForProcess.oldValue || 0;
                                    newPercentage = approvalDataForProcess.newValue || 0;

                                    // Only show as pending if status is not approved/auto-approved
                                    isPendingApproval = !isApprovedStatus;
                                }
                            }

                            const yesterdayPercent = changedToday ? oldPercentage : (proc.completionPercentage || 0);
                            const todayChange = changedToday ? (newPercentage - oldPercentage) : 0;

                            return {
                                ...proc,
                                changedToday: changedToday,
                                oldPercentage: oldPercentage,
                                newPercentage: newPercentage,
                                isPendingApproval: isPendingApproval,
                                approvalOldValue: oldPercentage,
                                approvalNewValue: newPercentage,
                                // For display: show progress segments
                                yesterdayPercentage: yesterdayPercent,
                                todayChangePercentage: todayChange,
                                displayYesterdayPercentage: yesterdayPercent,
                                displayApprovalPercentage: isPendingApproval ? todayChange : 0,
                                progressBarColor: '#28a745',
                                todayChangeColor: changedToday ? 'rgba(94, 90, 219, 1)' : null
                            };
                        }),
                        hasLocationProcesses: locationProcesses.length > 0,
                        // Group location processes by location name for accordion view
                        groupedLocationProcesses: this.groupLocationProcessesForView(locationProcesses, locationProcessChanges, isApprovedStatus)
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

        // Apply search filter (Person name and Work Performed Date in YYYY-MM-DD format)
        if (this.searchTerm) {
            logs = logs.filter(log => {
                // Search by person name
                const matchesPerson = log.createdByName && log.createdByName.toLowerCase().includes(this.searchTerm);

                // Search by work performed date in YYYY-MM-DD format
                let matchesDate = false;
                if (log.wfrecon__Work_Performed_Date__c) {
                    const workPerformedDate = new Date(log.wfrecon__Work_Performed_Date__c).toISOString().split('T')[0];
                    matchesDate = workPerformedDate.includes(this.searchTerm);
                }

                return matchesPerson || matchesDate;
            });
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
        this.expandedCardId = null; // Reset expanded card when filtering
        this.updateDisplayedLogs();
    }

    // Update displayed logs based on current page
    updateDisplayedLogs() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        this.displayedLogs = this.filteredLogs.slice(startIndex, endIndex).map(log => {
            const isExpanded = log.Id === this.expandedCardId;
            return {
                ...log,
                isExpanded: isExpanded,
                cardClass: isExpanded ? 'log-card expanded' : 'log-card'
            };
        });
        this.updateProgressBars(); // Update progress bars after changing displayed logs
    }

    // Pagination handlers
    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.expandedCardId = null; // Reset expanded card on page change
            this.updateDisplayedLogs();
        }
    }

    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.expandedCardId = null; // Reset expanded card on page change
            this.updateDisplayedLogs();
        }
    }

    handlePageChange(event) {
        const pageNumber = parseInt(event.currentTarget.dataset.page, 10);
        this.currentPage = pageNumber;
        this.expandedCardId = null; // Reset expanded card on page change
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

    // Handle View More / View Less toggle
    handleToggleCard(event) {
        const logId = event.currentTarget.dataset.id;

        // If clicking on already expanded card, collapse it
        if (this.expandedCardId === logId) {
            this.expandedCardId = null;
        } else {
            // Expand the clicked card and collapse any other
            this.expandedCardId = logId;
        }

        // Update displayed logs to reflect the change
        this.updateDisplayedLogs();
    }

    // Handle accordion toggle in view mode
    handleViewAccordionToggle(event) {
        event.stopPropagation();
        const sectionName = event.currentTarget.dataset.section;
        const logId = event.currentTarget.dataset.logId;
        const headerElement = event.currentTarget;
        const contentElement = this.template.querySelector(
            `.location-accordion-content[data-section="${sectionName}"][data-log-id="${logId}"]`
        );

        if (contentElement) {
            const isOpen = contentElement.classList.contains('open');

            // Close all accordions for this log first
            const allContents = this.template.querySelectorAll(
                `.location-accordion-content[data-log-id="${logId}"]`
            );
            const allHeaders = this.template.querySelectorAll(
                `.location-accordion-header[data-log-id="${logId}"]`
            );

            allContents.forEach(content => content.classList.remove('open'));
            allHeaders.forEach(header => header.classList.remove('active'));

            // If it wasn't open, open it
            if (!isOpen) {
                contentElement.classList.add('open');
                headerElement.classList.add('active');
            }

            // Update progress bars after DOM settles
            setTimeout(() => this.updateProgressBars(), 50);
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

            // Parse approval data to get media metadata
            let mediaMetadataMap = new Map(); // Map<contentDocId, source>
            if (logToEdit.wfrecon__Approval_Data__c) {
                try {
                    const approvalData = JSON.parse(logToEdit.wfrecon__Approval_Data__c);
                    const mediaMetadata = approvalData.mediaMetadata || [];

                    // Build map of contentDocumentId -> source
                    mediaMetadata.forEach(meta => {
                        mediaMetadataMap.set(meta.contentDocumentId, meta.source);
                    });
                } catch (e) {
                    console.error('Error parsing approval data for media metadata:', e);
                }
            }

            // Load existing images and mark source (chatter/upload/camera)
            this.existingImages = logToEdit.images ? logToEdit.images.map(img => ({
                id: img.ContentDocumentId,
                versionId: img.Id,
                name: img.Title + '.' + img.FileExtension,
                url: `/sfc/servlet.shepherd/document/download/${img.ContentDocumentId}`,
                isExisting: true,
                source: mediaMetadataMap.get(img.ContentDocumentId) || 'upload', // Default to upload if not found
                isChatter: mediaMetadataMap.get(img.ContentDocumentId) === 'chatter'
            })) : [];

            // Reset new uploads and delete/unlink tracking
            this.newUploadedFiles = [];
            this.imagesToDelete = [];
            this.imagesToUnlink = [];
            this.newlyUploadedContentDocIds = []; // Track new uploads during this edit session

            // Load location processes for step 2
            this.loadEditLocationProcesses(logToEdit);
        }

        // Reset to step 1
        this.editCurrentStep = 'step1';
        this.showEditModal = true;

        // Update slider visuals after modal renders (increased timeout for modal animation)
        setTimeout(() => this.updateEditSliderVisuals(), 300);
    }

    // Handle close modal
    async handleCloseModal() {
        // Delete newly uploaded files during this edit session (exclude camera photos and Chatter images)
        if (this.newlyUploadedContentDocIds && this.newlyUploadedContentDocIds.length > 0) {
            try {
                await deleteUploadedFiles({ contentDocumentIds: this.newlyUploadedContentDocIds });
                console.log('Successfully deleted newly uploaded files on modal close');
            } catch (error) {
                console.error('Error deleting newly uploaded files on modal close:', error);
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
        this.imagesToUnlink = [];
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
             this.groupEditLocationProcesses();
            // Update slider visuals after DOM renders (increased timeout for render)
            setTimeout(() => this.updateEditSliderVisuals(), 300);
        } else if (this.editCurrentStep === 'step2') {
            if (this.hasEditLocationOptions && !this.hasModifiedProcesses) {
            this.showToast('Error', 'Please update at least one Location Progress record to continue.', 'error');
            return;
        }
            this.editCurrentStep = 'step3';
        }
    }

    handleEditPrevious() {
        if (this.editCurrentStep === 'step3') {
            this.editCurrentStep = 'step2';
             this.groupEditLocationProcesses();
            // Update slider visuals after DOM renders
            setTimeout(() => this.updateEditSliderVisuals(), 100);
        } else if (this.editCurrentStep === 'step2') {
            this.editCurrentStep = 'step1';
        }
    }

    // Load location processes for edit modal
    // loadEditLocationProcesses(logToEdit) {
    //     if (logToEdit.locationProcesses && logToEdit.locationProcesses.length > 0) {

    //         // Clear the original percentages map at the start
    //         this.editOriginalCompletionPercentages.clear();

    //         // Check if there's approval data - handle both new and old structure
    //         let approvalDataArray = [];
    //         let approvalDataMap = new Map(); // Map processId to approval entry
    //         if (logToEdit.wfrecon__Approval_Data__c) {
    //             try {
    //                 const parsedData = JSON.parse(logToEdit.wfrecon__Approval_Data__c);

    //                 // Check if it's the new structure or old structure
    //                 if (parsedData.locationProcessChanges) {
    //                     // New structure
    //                     approvalDataArray = parsedData.locationProcessChanges;
    //                 } else if (Array.isArray(parsedData)) {
    //                     // Old structure
    //                     approvalDataArray = parsedData;
    //                 }

    //                 // Build a map for quick lookup
    //                 approvalDataArray.forEach(item => {
    //                     approvalDataMap.set(item.id, item);
    //                 });
    //             } catch (e) {
    //                 console.error('Error parsing approval data in edit modal:', e);
    //             }
    //         }

    //         // Map backend fields to component properties
    //         this.editAllLocationProcesses = logToEdit.locationProcesses.map(proc => {
    //             // Handle different possible field names from backend
    //             const processId = proc.Id || proc.processId;
    //             const processName = proc.Name || proc.processName;
    //             const locationName = proc.wfrecon__Location__r?.Name || proc.locationName || 'Unknown Location';
    //             const sequence = proc.wfrecon__Sequence__c || proc.sequence || 0;

    //             // Get yesterday's percentage (total completed before today)
    //             const yesterdayPercentage = Math.round(parseFloat(proc.yesterdayPercentage || proc.oldPercentage || 0));

    //             // Get current total completed percentage
    //             const completionPercentage = Math.round(parseFloat(proc.wfrecon__Completed_Percentage__c || proc.completionPercentage || 0));

    //             // Calculate today's change (difference between current and yesterday)
    //             const todayProgress = Math.max(0, completionPercentage - yesterdayPercentage);
    //             const remainingProgress = Math.max(0, 100 - completionPercentage);

    //             // Check if this process is pending approval from the JSON array
    //             const approvalDataForProcess = approvalDataArray.find(item => item.id === processId);
    //             const isPendingApproval = !!approvalDataForProcess;
    //             const approvalOldValue = approvalDataForProcess?.oldValue || 0;
    //             const approvalNewValue = approvalDataForProcess?.newValue || 0;

    //             // If in approval: purple shows (yesterday → approval value)
    //             // If current > approval: that's new changes after approval
    //             const approvalChange = isPendingApproval
    //                 ? Math.round(approvalNewValue - yesterdayPercentage)
    //                 : 0;

    //             // Calculate today's progress considering approval
    //             const actualTodayProgress = isPendingApproval
    //                 ? Math.max(0, completionPercentage - yesterdayPercentage) // Show total change from yesterday
    //                 : todayProgress;

    //             // Store the BASELINE completion percentage in the separate Map
    //             // If this process has an existing approval entry, use its oldValue as baseline
    //             // Otherwise, use the current completionPercentage
    //             const baselinePercentage = approvalDataMap.has(processId)
    //                 ? approvalDataMap.get(processId).oldValue
    //                 : completionPercentage;
    //             this.editOriginalCompletionPercentages.set(processId, baselinePercentage);

    //             // Pre-populate editModifiedProcesses with existing approval data
    //             // This ensures existing changes are preserved even if not touched in this edit session
    //             if (approvalDataMap.has(processId)) {
    //                 const existingApproval = approvalDataMap.get(processId);
    //                 this.editModifiedProcesses.set(processId, {
    //                     processId: processId,
    //                     originalValue: existingApproval.oldValue, // yesterdayPercentage
    //                     newValue: existingApproval.newValue // Current value from approval
    //                 });
    //             }

    //             return {
    //                 processId: processId,
    //                 processName: processName,
    //                 locationName: locationName,
    //                 sequence: sequence,
    //                 yesterdayPercentage: yesterdayPercentage, // Total completed till yesterday (green base)
    //                 completionPercentage: completionPercentage, // Current total completed
    //                 todayProgress: actualTodayProgress, // Today's change (includes approval changes)
    //                 remainingProgress: remainingProgress,
    //                 changedToday: false,
    //                 isPendingApproval: isPendingApproval,
    //                 approvalOldValue: approvalOldValue,
    //                 approvalNewValue: approvalNewValue,
    //                 approvalChange: approvalChange,
    //                 displayApprovalPercentage: approvalChange,
    //                 sliderMinValue: yesterdayPercentage, // Always start from yesterday (not approval value)
    //                 completedStyle: `width: ${yesterdayPercentage}%`,
    //                 todayStyle: `width: ${actualTodayProgress}%`,
    //                 approvalStyle: `width: ${approvalChange}%`,
    //                 remainingStyle: `width: ${remainingProgress}%`
    //             };
    //         });

    //         this.buildEditLocationOptions();
    //         this.setEditDefaultLocation();
    //     }
    // }

    loadEditLocationProcesses(logToEdit) {
    if (logToEdit.locationProcesses && logToEdit.locationProcesses.length > 0) {

        // Clear the original percentages map at the start
        this.editOriginalCompletionPercentages.clear();

        // Check if there's approval data - handle both new and old structure
        let approvalDataArray = [];
        let approvalDataMap = new Map(); // Map processId to approval entry
        if (logToEdit.wfrecon__Approval_Data__c) {
            try {
                const parsedData = JSON.parse(logToEdit.wfrecon__Approval_Data__c);

                // Check if it's the new structure or old structure
                if (parsedData.locationProcessChanges) {
                    // New structure
                    approvalDataArray = parsedData.locationProcessChanges;
                } else if (Array.isArray(parsedData)) {
                    // Old structure
                    approvalDataArray = parsedData;
                }

                // Build a map for quick lookup
                approvalDataArray.forEach(item => {
                    approvalDataMap.set(item.id, item);
                });
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

            // Check if this process is pending approval from the JSON array
            const approvalDataForProcess = approvalDataArray.find(item => item.id === processId);
            const isPendingApproval = !!approvalDataForProcess;
            const approvalOldValue = approvalDataForProcess?.oldValue || 0;
            const approvalNewValue = approvalDataForProcess?.newValue || 0;

            // IMPORTANT FIX: When pending approval, use approvalNewValue as completionPercentage
            const completionPercentage = isPendingApproval 
                ? Math.round(parseFloat(approvalNewValue)) // Use approval value when pending
                : Math.round(parseFloat(proc.wfrecon__Completed_Percentage__c || proc.completionPercentage || 0));

            // Calculate today's change (difference between current and yesterday)
            const todayProgress = Math.max(0, completionPercentage - yesterdayPercentage);
            const remainingProgress = Math.max(0, 100 - completionPercentage);

            // If in approval: purple shows (yesterday → approval value)
            const approvalChange = isPendingApproval
                ? Math.round(approvalNewValue - yesterdayPercentage)
                : 0;

            // Calculate today's progress considering approval
            const actualTodayProgress = isPendingApproval
                ? Math.max(0, completionPercentage - yesterdayPercentage) // Show total change from yesterday
                : todayProgress;

            // Store the BASELINE completion percentage in the separate Map
            // If this process has an existing approval entry, use its oldValue as baseline
            // Otherwise, use the current completionPercentage
            const baselinePercentage = approvalDataMap.has(processId)
                ? approvalDataMap.get(processId).oldValue
                : completionPercentage;
            this.editOriginalCompletionPercentages.set(processId, baselinePercentage);

            // Pre-populate editModifiedProcesses with existing approval data
            // This ensures existing changes are preserved even if not touched in this edit session
            if (approvalDataMap.has(processId)) {
                const existingApproval = approvalDataMap.get(processId);
                this.editModifiedProcesses.set(processId, {
                    processId: processId,
                    originalValue: existingApproval.oldValue, // yesterdayPercentage
                    newValue: existingApproval.newValue // Current value from approval
                });
            }

            return {
                processId: processId,
                processName: processName,
                locationName: locationName,
                sequence: sequence,
                yesterdayPercentage: yesterdayPercentage, // Total completed till yesterday (green base)
                completionPercentage: completionPercentage, // Current total completed - NOW INCLUDES APPROVAL VALUE
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

        // Group processes by location for accordion view
        this.groupEditLocationProcesses();
    }

    setEditDefaultLocation() {
        if (this.editLocationOptions.length > 0) {
            this.editSelectedLocationId = this.editLocationOptions[0].value;
            // Set first accordion as active by default
            if (this.editGroupedLocationProcesses.length > 0) {
                this.editActiveAccordionSections = [this.editGroupedLocationProcesses[0].sectionName];
            }
        }
    }

    // groupEditLocationProcesses() {
    //     const locationMap = new Map();

    //     this.editAllLocationProcesses.forEach(proc => {
    //         if (!locationMap.has(proc.locationName)) {
    //             locationMap.set(proc.locationName, {
    //                 locationName: proc.locationName,
    //                 sectionName: proc.locationName.replace(/\s+/g, '_'), // Create unique section name
    //                 processes: []
    //             });
    //         }
    //         locationMap.get(proc.locationName).processes.push(proc);
    //     });

    //     this.editGroupedLocationProcesses = Array.from(locationMap.values());

    //     // Set first accordion as active by default
    //     if (this.editGroupedLocationProcesses.length > 0) {
    //         this.editActiveAccordionSections = [this.editGroupedLocationProcesses[0].sectionName];
    //     }
    // }

    groupEditLocationProcesses() {
        const locationMap = new Map();

        this.editAllLocationProcesses.forEach(proc => {
            // Recalculate display values based on current completionPercentage
            const yesterdayPercentage = proc.yesterdayPercentage || 0;
            const completionPercentage = proc.completionPercentage || 0;
            const todayProgress = Math.max(0, completionPercentage - yesterdayPercentage);
            const remainingProgress = Math.max(0, 100 - completionPercentage);
            
            // Check if this process has been modified
            const isModified = this.editModifiedProcesses.has(proc.processId);
            const originalCompletion = this.editOriginalCompletionPercentages.get(proc.processId) || completionPercentage;
            
            const updatedProc = {
                ...proc,
                todayProgress: todayProgress,
                remainingProgress: remainingProgress,
                changedToday: completionPercentage !== originalCompletion,
                completedStyle: `width: ${yesterdayPercentage}%`,
                todayStyle: `width: ${todayProgress}%`,
                remainingStyle: `width: ${remainingProgress}%`
            };
            
            if (!locationMap.has(proc.locationName)) {
                locationMap.set(proc.locationName, {
                    locationName: proc.locationName,
                    sectionName: proc.locationName.replace(/\s+/g, '_'),
                    processes: []
                });
            }
            locationMap.get(proc.locationName).processes.push(updatedProc);
        });

        this.editGroupedLocationProcesses = Array.from(locationMap.values());

        // Set first accordion as active by default
        if (this.editGroupedLocationProcesses.length > 0) {
            this.editActiveAccordionSections = [this.editGroupedLocationProcesses[0].sectionName];
        }
    }

    handleEditViewAccordionToggle(event) {
        event.stopPropagation();
        const sectionName = event.currentTarget.dataset.section;
        const headerElement = event.currentTarget;
        const contentElement = this.template.querySelector(
            `.edit-location-accordion-content[data-section="${sectionName}"]`
        );

        if (contentElement) {
            const isOpen = contentElement.classList.contains('open');

            // Close all accordions first (only one open at a time)
            const allContents = this.template.querySelectorAll('.edit-location-accordion-content');
            const allHeaders = this.template.querySelectorAll('.edit-location-accordion-header');

            allContents.forEach(content => content.classList.remove('open'));
            allHeaders.forEach(header => header.classList.remove('active'));

            // If it wasn't open, open it
            if (!isOpen) {
                contentElement.classList.add('open');
                headerElement.classList.add('active');
            }

            // Update slider visuals after DOM settles
            setTimeout(() => this.updateEditSliderVisuals(), 100);
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
        // Iterate over ALL processes in editAllLocationProcesses (not just filtered ones)
        this.editAllLocationProcesses.forEach(processData => {
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

                            // Always hide approval section (no orange)
                            approval.style.width = '0%';
                            approval.style.display = 'none';

                            // Green = yesterday/base completed (previous completed)
                            completed.style.width = `${yesterday}%`;
                            completed.style.display = yesterday > 0 ? 'block' : 'none';

                            // Purple = today's changes (from yesterday to current)
                            const todayChange = Math.max(0, current - yesterday);
                            today.style.width = `${todayChange}%`;
                            today.style.display = todayChange > 0 ? 'block' : 'none';

                            // Gray = remaining
                            const remainingPercent = Math.max(0, 100 - current);
                            remaining.style.width = `${remainingPercent}%`;
                            remaining.style.display = remainingPercent > 0 ? 'block' : 'none';
                        }
                    }
                }

                // Position slider to start at yesterdayPercentage (always from base, not approval)
                const sliderWidth = 100 - processData.yesterdayPercentage;
                sliderElement.style.left = `${processData.yesterdayPercentage}%`;
                sliderElement.style.width = `${sliderWidth}%`;

                // Disable slider if 100% complete
                // if (processData.completionPercentage >= 100) {
                //     sliderElement.disabled = true;
                //     sliderElement.style.cursor = 'not-allowed';
                // } else {
                //     sliderElement.disabled = false;
                //     sliderElement.style.cursor = 'pointer';
                // }
            }
        });
    }

    handleEditSliderInput(event) {
        const processId = event.target.dataset.processId;
        const newValue = parseInt(event.target.value, 10);
        const sliderElement = event.target;

        // Find process data from ALL processes (not just filtered)
        const processData = this.editAllLocationProcesses.find(p => p.processId === processId);
        if (!processData) return;

        // Update visual progress in real-time
        const sliderContainer = sliderElement.closest('.slider-wrapper');
        if (sliderContainer) {
            const sliderTrack = sliderContainer.querySelector('.slider-track');
            if (sliderTrack) {
                const proc = this.editAllLocationProcesses.find(p => p.processId === processId);
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
                        completed.style.display = yesterday > 0 ? 'block' : 'none';

                        // Purple = today's changes (from yesterday to current)
                        const todayProgress = Math.max(0, newValue - yesterday);
                        today.style.width = `${todayProgress}%`;
                        today.style.display = todayProgress > 0 ? 'block' : 'none';

                        // Gray = remaining
                        const remainingProgress = Math.max(0, 100 - newValue);
                        remaining.style.width = `${remainingProgress}%`;
                        remaining.style.display = remainingProgress > 0 ? 'block' : 'none';
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
                        sliderMinValue: resetValue,
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
                        sliderMinValue: resetValue,
                        completedStyle: `width: ${resetValue}%`,
                        todayStyle: `width: 0%`,
                        approvalStyle: `width: 0%`,
                        remainingStyle: `width: ${100 - resetValue}%`
                    };
                }
                return p;
            });
        }

        // Update the original completion percentage map to reset value
        this.editOriginalCompletionPercentages.set(processId, resetValue);

        // Remove from modified processes (this will remove it from approval data when saved)
        this.editModifiedProcesses.delete(processId);

        // Rebuild grouped location processes to reflect the change
        this.groupEditLocationProcesses();

        // Update visual sliders and force re-render
        setTimeout(() => {
            this.updateEditSliderVisuals();

            // Manually update the slider input value
            const sliderElement = this.template.querySelector(`input[data-process-id="${processId}"]`);
            if (sliderElement) {
                sliderElement.value = resetValue;
                sliderElement.dataset.originalValue = resetValue;
            }
        }, 100);

        this.showToast('Success', 'Reset to previous completed value. Today\'s progress is now 0%.', 'success');
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
        let existingApprovalData = {
            locationProcessChanges: [],
            timesheetEntryChanges: {}
        };

        if (currentLog && currentLog.wfrecon__Approval_Data__c) {
            try {
                const parsedData = JSON.parse(currentLog.wfrecon__Approval_Data__c);

                // Check if it's the new structure or old structure
                if (parsedData.locationProcessChanges) {
                    // New structure
                    existingApprovalData = parsedData;
                } else if (Array.isArray(parsedData)) {
                    // Old structure - convert to new structure
                    existingApprovalData = {
                        locationProcessChanges: parsedData,
                        timesheetEntryChanges: {}
                    };
                }
            } catch (e) {
                console.error('Error parsing existing approval data:', e);
                existingApprovalData = {
                    locationProcessChanges: [],
                    timesheetEntryChanges: {}
                };
            }
        }

        // Create a map starting with existing location process changes
        const approvalDataMap = new Map();
        existingApprovalData.locationProcessChanges.forEach(item => {
            approvalDataMap.set(item.id, item);
        });

        // Add or update with new modifications
        Array.from(this.editModifiedProcesses.entries()).forEach(([processId, modification]) => {
            // Find the process to get its name
            const processData = this.editAllLocationProcesses.find(p => p.processId === processId);

            // Check if this process already exists in approval data
            const existingApproval = approvalDataMap.get(processId);

            if (existingApproval) {
                // Update existing approval entry - keep the original oldValue, update newValue
                approvalDataMap.set(processId, {
                    id: processId,
                    oldValue: existingApproval.oldValue, // Preserve original oldValue
                    newValue: modification.newValue, // Update to latest newValue
                    name: processData ? processData.processName : existingApproval.name
                });
            } else {
                // New approval entry - use yesterdayPercentage as oldValue
                approvalDataMap.set(processId, {
                    id: processId,
                    oldValue: modification.originalValue, // yesterdayPercentage
                    newValue: modification.newValue,
                    name: processData ? processData.processName : 'Unknown'
                });
            }
        });

        // Handle processes that were in existing approval but reset/reverted in this session
        existingApprovalData.locationProcessChanges.forEach(existingApproval => {
            const processId = existingApproval.id;
            const processData = this.editAllLocationProcesses.find(p => p.processId === processId);

            if (processData) {
                // Only delete if:
                // 1. The process was reset back to the original oldValue, AND
                // 2. The process is NOT in editModifiedProcesses (which means it wasn't intentionally preserved)
                if (processData.completionPercentage === existingApproval.oldValue &&
                    !this.editModifiedProcesses.has(processId)) {
                    approvalDataMap.delete(processId);
                }
                // If it was modified again in this session, editModifiedProcesses already updated it above
            }
        });

        // Get all uploaded content document IDs from Chatter images (existing + new)
        const uploadedContentDocIds = [
            ...this.existingImages.filter(img => img.isChatter).map(img => img.id),
            ...this.newUploadedFiles.filter(file => file.isChatter).map(file => file.id)
        ];

        // Build updated media metadata
        const updatedMediaMetadata = [];

        // Add existing images that weren't removed
        this.existingImages.forEach(img => {
            updatedMediaMetadata.push({
                contentDocumentId: img.id,
                source: img.source || 'upload',
                name: img.name
            });
        });

        // Add new uploaded/chatter files
        this.newUploadedFiles.forEach(file => {
            if (file.isChatter) {
                updatedMediaMetadata.push({
                    contentDocumentId: file.id,
                    source: 'chatter',
                    name: file.name
                });
            } else if (!file.isCamera) {
                // Regular uploaded file
                updatedMediaMetadata.push({
                    contentDocumentId: file.id,
                    source: 'upload',
                    name: file.name
                });
            }
            // Camera photos will be added by Apex after upload
        });

        // Build the merged approval data structure
        const mergedApprovalData = {
            locationProcessChanges: Array.from(approvalDataMap.values()),
            timesheetEntryChanges: existingApprovalData.timesheetEntryChanges || {},
            uploadedContentDocumentIds: uploadedContentDocIds, // Track Chatter files for preventing re-selection
            mediaMetadata: updatedMediaMetadata // Track all media with source info
        };

        const formData = {
            Id: this.editLogId,
            wfrecon__Work_Performed_Date__c: this.editFormData.workPerformedDate,
            wfrecon__Work_Performed__c: this.editFormData.workPerformed,
            wfrecon__Exceptions__c: this.editFormData.exceptions,
            wfrecon__Plan_for_Tomorrow__c: this.editFormData.planForTomorrow,
            wfrecon__Notes_to_Office__c: this.editFormData.notesToOffice,
        };

        // Only set approval data if there are any updates (location process changes or timesheet changes)
        if (mergedApprovalData.locationProcessChanges.length > 0 || Object.keys(mergedApprovalData.timesheetEntryChanges).length > 0 || uploadedContentDocIds.length > 0) {
            formData.wfrecon__Approval_Data__c = JSON.stringify(mergedApprovalData);
        }

        console.log('formData ==> ', formData);
        console.log('Existing approval data:', existingApprovalData);
        console.log('New modifications from editModifiedProcesses:', Array.from(this.editModifiedProcesses.entries()));
        console.log('Merged approval data:', mergedApprovalData);


        this.isLoading = true;

        // Prepare camera photos for upload
        const cameraPhotos = this.newUploadedFiles
            .filter(file => file.isCamera === true && file.base64Data)
            .map(file => ({
                fileName: file.name,
                base64Data: file.base64Data
            }));

        const cameraPhotosJson = cameraPhotos.length > 0 ? JSON.stringify(cameraPhotos) : null;

        // Get IDs of newly uploaded files and Chatter files to link
        const contentDocumentIdsToLink = this.newUploadedFiles
            .filter(file => !file.isCamera) // Exclude camera photos (handled separately)
            .map(file => file.id);

        // Combined update: delete removed images, unlink Chatter images, link new files, update log entry, and upload camera photos
        updateShiftEndLogWithImages({
            logEntry: formData,
            contentDocumentIdsToDelete: this.imagesToDelete,
            contentDocumentIdsToUnlink: this.imagesToUnlink,
            contentDocumentIdsToLink: contentDocumentIdsToLink,
            cameraPhotosJson: cameraPhotosJson
        })
            .then(() => {
                this.showToast('Success', 'Shift End Log updated successfully', 'success');
                // Clear newlyUploadedContentDocIds so they won't be deleted on modal close
                // These files are now successfully linked to the log entry
                this.newlyUploadedContentDocIds = [];
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
    async handleUploadFinished(event) {
        try {
            // Check org storage before accepting the upload
            const storageCheck = await checkOrgStorageLimit();

            if (!storageCheck.hasSpace) {
                this.showToast('Error', storageCheck.message, 'error');
                // Delete the just-uploaded files
                const uploadedFilesFromEvent = event.detail.files;
                const docIdsToDelete = uploadedFilesFromEvent.map(file => file.documentId);
                if (docIdsToDelete.length > 0) {
                    await deleteUploadedFiles({ contentDocumentIds: docIdsToDelete });
                }
                return;
            }

            const uploadedFilesFromEvent = event.detail.files;
            uploadedFilesFromEvent.forEach(file => {
                this.newUploadedFiles.push({
                    id: file.documentId,
                    name: file.name,
                    url: `/sfc/servlet.shepherd/document/download/${file.documentId}`,
                    isExisting: false,
                    isCamera: false,
                    isChatter: false
                });
                // Track this as a newly uploaded file for cleanup if user cancels
                this.newlyUploadedContentDocIds.push(file.documentId);
            });

            // Show storage warning if approaching limit
            if (storageCheck.percentUsed > 90) {
                this.showToast('Warning', storageCheck.message, 'warning');
            } else {
                this.showToast('Success', `${uploadedFilesFromEvent.length} file(s) uploaded successfully`, 'success');
            }
        } catch (error) {
            console.error('Error in handleUploadFinished:', error);
            this.showToast('Error', 'Failed to upload files: ' + (error.body?.message || error.message), 'error');
        }
    }

    // Handle remove image
    handleRemoveImage(event) {
        const imageId = event.currentTarget.dataset.id;
        const isExisting = event.currentTarget.dataset.existing === 'true';
        const isChatter = event.currentTarget.dataset.chatter === 'true';

        if (isExisting) {
            // For existing images, check source to decide delete vs unlink
            const existingImg = this.existingImages.find(img => img.id === imageId);

            if (existingImg && existingImg.source === 'chatter') {
                // Chatter images: only unlink, don't delete
                this.imagesToUnlink.push(imageId);
            } else {
                // Upload/capture images: delete from org
                this.imagesToDelete.push(imageId);
            }

            this.existingImages = this.existingImages.filter(img => img.id !== imageId);
        } else if (isChatter) {
            // For Chatter images that were just added, simply remove from the list (no need to unlink as not yet saved)
            this.newUploadedFiles = this.newUploadedFiles.filter(img => img.id !== imageId);
        } else {
            // For newly uploaded files (camera photos or file uploads), mark for deletion
            this.newUploadedFiles = this.newUploadedFiles.filter(img => {
                if (img.id === imageId && !img.isCamera && !img.isChatter) {
                    // Only delete if it's a regular upload (not camera, not chatter)
                    this.imagesToDelete.push(imageId);
                }
                return img.id !== imageId;
            });
        }

        this.showToast('Success', 'Image removed', 'success');
    }

    // Get all images (existing + new)
    get allImages() {
        const all = [...this.existingImages, ...this.newUploadedFiles];
        return all.map(img => {
            const ext = img.extension || img.FileExtension || '';
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'].includes(ext.toLowerCase());
            return {
                ...img,
                isImage: isImage,
                fileIcon: this.getFileIconForType(ext)
            };
        });
    }

    get hasImages() {
        return this.allImages.length > 0;
    }

    get hasChatterFeedItems() {
        return this.chatterFeedItems && this.chatterFeedItems.length > 0;
    }

    get hasNoSelectedAttachments() {
        if (!this.chatterFeedItems || this.chatterFeedItems.length === 0) {
            return true;
        }

        for (let feedItem of this.chatterFeedItems) {
            for (let attachment of feedItem.attachments) {
                // Only enable button if attachment is selected AND not already uploaded
                if (attachment.selected && !attachment.alreadyUploaded) {
                    return false;
                }
            }
        }
        return true;
    }

    // Edit Modal Step Getters
    get isEditStep1() { return this.editCurrentStep === 'step1'; }
    get isEditStep2() { return this.editCurrentStep === 'step2'; }
    get isEditStep3() { return this.editCurrentStep === 'step3'; }

    get hasEditLocationOptions() {
        return this.editGroupedLocationProcesses && this.editGroupedLocationProcesses.length > 0;
    }

    get hasEditLocationProcesses() {
        return this.editLocationProcesses && this.editLocationProcesses.length > 0;
    }

    get hasModifiedProcesses() {
        return this.editModifiedProcesses.size > 0;
    }

    // Upload Options Handlers
    handleUploadOptionsClick(event) {
        event.stopPropagation();
        this.showUploadOptions = !this.showUploadOptions;

        // Close dropdown when clicking outside
        if (this.showUploadOptions) {
            document.addEventListener('click', this.handleClickOutside.bind(this));
        }
    }

    handleClickOutside() {
        this.showUploadOptions = false;
    }

    handleFileUploadClick(event) {
        event.stopPropagation();
    }

    handleUploadNewFiles() {
        this.showUploadOptions = false;
        // Trigger the file upload component
        setTimeout(() => {
            const fileUpload = this.template.querySelector('lightning-file-upload');
            if (fileUpload) {
                const inputElement = fileUpload.shadowRoot.querySelector('input[type="file"]');
                if (inputElement) {
                    inputElement.click();
                }
            }
        }, 100);
    }

    handleChooseFromChatter() {
        this.showUploadOptions = false;
        this.showChatterModal = true;
        this.chatterDaysOffset = 0;
        this.hasMoreChatterItems = true;
        this.loadChatterFeedItems();
    }

    // Chatter Functions
    async loadChatterFeedItems() {
        this.isLoadingChatter = true;

        try {
            const result = await getChatterFeedItems({
                jobId: this.recordId,
                daysOffset: this.chatterDaysOffset
            });

            console.log('Chatter Result:', result);

            // Check if there are more items
            this.hasMoreChatterItems = result && result.hasMore;

            // Get all currently uploaded content document IDs (existing + new)
            const allUploadedDocIds = [
                ...this.existingImages.map(img => img.id),
                ...this.newUploadedFiles.map(file => file.id)
            ];

            if (result && result.feedItems && result.feedItems.length > 0) {
                const newFeedItems = result.feedItems.map(feedItem => ({
                    ...feedItem,
                    formattedDate: this.formatChatterDate(feedItem.createdDate),
                    attachments: feedItem.attachments.map(att => {
                        const alreadyUploaded = allUploadedDocIds.includes(att.contentDocumentId);
                        return {
                            ...att,
                            selected: false,
                            alreadyUploaded: alreadyUploaded,
                            cardClass: alreadyUploaded ? 'attachment-card disabled' : 'attachment-card'
                        };
                    })
                }));

                // Append to existing items (for Load More)
                if (this.chatterDaysOffset === 0) {
                    this.chatterFeedItems = newFeedItems;
                } else {
                    this.chatterFeedItems = [...this.chatterFeedItems, ...newFeedItems];
                }
            } else {
                if (this.chatterDaysOffset === 0) {
                    this.chatterFeedItems = [];
                }
            }

        } catch (error) {
            console.error('Error loading Chatter feed items:', error);
            this.showToast('Error', 'Failed to load Chatter posts', 'error');
            this.chatterFeedItems = [];
            this.hasMoreChatterItems = false;
        } finally {
            this.isLoadingChatter = false;
        }
    }

    handleLoadMoreChatter() {
        this.chatterDaysOffset += 3;
        this.isLoadingMoreChatter = true;
        this.loadChatterFeedItems().then(() => {
            this.isLoadingMoreChatter = false;
        });
    }

    handleAttachmentSelection(event) {
        const attachmentId = event.currentTarget.dataset.id;

        // Find the attachment to check if already uploaded
        let isAlreadyUploaded = false;
        this.chatterFeedItems.forEach(feedItem => {
            feedItem.attachments.forEach(att => {
                if (att.id === attachmentId && att.alreadyUploaded) {
                    isAlreadyUploaded = true;
                }
            });
        });

        // Prevent selection if already uploaded
        if (isAlreadyUploaded) {
            this.showToast('Info', 'This file is already uploaded to this log entry', 'info');
            return;
        }

        // Toggle selection
        this.chatterFeedItems = this.chatterFeedItems.map(feedItem => ({
            ...feedItem,
            attachments: feedItem.attachments.map(att => {
                if (att.id === attachmentId) {
                    const newSelected = !att.selected;
                    return {
                        ...att,
                        selected: newSelected,
                        cardClass: `attachment-card${att.alreadyUploaded ? ' disabled' : ''}${newSelected ? ' selected' : ''}`
                    };
                }
                return att;
            })
        }));
    }

    handleAddSelectedAttachments() {
        // Double-check before proceeding
        if (this.hasNoSelectedAttachments) {
            return;
        }

        const selectedAttachments = [];

        // Collect all selected attachments (excluding already uploaded)
        this.chatterFeedItems.forEach(feedItem => {
            feedItem.attachments.forEach(att => {
                if (att.selected && !att.alreadyUploaded) {
                    selectedAttachments.push(att);
                }
            });
        });

        if (selectedAttachments.length === 0) {
            return;
        }

        // Add selected attachments to uploaded files
        selectedAttachments.forEach(attachment => {
            this.newUploadedFiles.push({
                id: attachment.contentDocumentId,
                name: attachment.title,
                url: attachment.thumbnailUrl,
                isImage: attachment.isImage,
                isExisting: false,
                isCamera: false,
                isChatter: true
            });
        });

        this.showToast('Success', `${selectedAttachments.length} file(s) added from Chatter`, 'success');
        this.closeChatterModal();
    }

    closeChatterModal() {
        this.showChatterModal = false;
        this.chatterFeedItems = [];
        this.chatterDaysOffset = 0;
        this.hasMoreChatterItems = true;
    }

    formatChatterDate(dateTimeString) {
        const date = new Date(dateTimeString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
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

    // Get file icon name based on file type
    getFileIconForType(extension) {
        const ext = extension ? extension.toLowerCase() : '';

        // Document types
        if (['doc', 'docx'].includes(ext)) return 'doctype:word';
        if (['xls', 'xlsx'].includes(ext)) return 'doctype:excel';
        if (['ppt', 'pptx'].includes(ext)) return 'doctype:ppt';
        if (ext === 'pdf') return 'doctype:pdf';
        if (['txt', 'log'].includes(ext)) return 'doctype:txt';
        if (['zip', 'rar', '7z'].includes(ext)) return 'doctype:zip';

        // Media types
        if (['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'].includes(ext)) return 'doctype:video';
        if (['mp3', 'wav', 'ogg', 'aac'].includes(ext)) return 'doctype:audio';

        // Code/data
        if (['csv'].includes(ext)) return 'doctype:csv';
        if (['xml'].includes(ext)) return 'doctype:xml';
        if (['json', 'js', 'css', 'html'].includes(ext)) return 'doctype:code';

        // Default
        return 'doctype:unknown';
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
        switch (type) {
            case 'standard': return 'success';
            case 'emergency': return 'error';
            case 'exception': return 'warning';
            case 'shift end': return 'success';
            default: return 'neutral';
        }
    }
}