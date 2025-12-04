import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getMobilizationList from '@salesforce/apex/ShiftEndLogEntriesController.getMobilizationList';
import getMobilizationMembersWithStatus from '@salesforce/apex/ShiftEndLogEntriesController.getMobilizationMembersWithStatus';
import createTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createTimesheetRecords';
import getTimeSheetEntryItems from '@salesforce/apex/ShiftEndLogEntriesController.getTimeSheetEntryItems';
import getJobLocationProcesses from '@salesforce/apex/ShiftEndLogEntriesController.getJobLocationProcesses';
import createLogEntry from '@salesforce/apex/ShiftEndLogEntriesController.createLogEntry';
import deleteContentDocuments from '@salesforce/apex/ShiftEndLogEntriesController.deleteContentDocuments';
import getChatterFeedItems from '@salesforce/apex/ShiftEndLogEntriesController.getChatterFeedItems';
import checkOrgStorageLimit from '@salesforce/apex/ShiftEndLogV2Controller.checkOrgStorageLimit';

export default class ShiftEndLogEntries extends LightningElement {
    @api jobId = '';
    @api crewLeaderId = '';
    @api crewIds = [];

    @track isLoading = false;
    @track currentStep = 'step1';
    @track selectedMobilizationId;
    @track mobilizationOptions = [];
    @track crewMembers = [];
    @track costCodeOptions = [];
    @track timesheetEntries = [];
    @track regularTimesheetEntries = [];
    @track pendingTimesheetEntries = [];
    @track localPendingEdits = new Map(); // Store pending edits locally: Map<itemId, {changes, TSEId, contactId, contactName}>
    @track step3Data = {
        whatWeDone: '',
        planForTomorrow: '',
        exceptions: '',
        notesToOffice: ''
    };
    @track locationProcesses = [];
    @track allLocationProcesses = [];
    @track groupedLocationProcesses = [];
    @track modifiedProcesses = new Map();
    @track uploadedFiles = [];
    @track locationOptions = [];
    @track selectedLocationId;
    @track activeAccordionSections = []; // Track active accordion sections

    // Clock In/Out Modal
    @track showClockInModal = false;
    @track showClockOutModal = false;
    @track selectedContactId;
    @track selectedCostCodeId;
    @track clockInTime;
    @track clockOutTime;
    @track previousClockInTime;
    @track currentJobStartDateTime;
    @track currentJobEndDateTime;

    @track modalJobStartTime = '';
    @track modalJobEndTime = '';
    // Edit Timesheet Modal
    @track showEditTimesheetModal = false;
    @track editTimesheetData = {};

    // Move Back Modal
    @track showMoveBackModal = false;
    @track selectedMoveBackEntryId = null;

    // Camera Modal
    @track showCameraModal = false;
    @track cameraStream = null;
    @track capturedPhoto = null;

    // Chatter Modal
    @track showChatterModal = false;
    @track chatterFeedItems = [];
    @track isLoadingChatter = false;
    @track isLoadingMoreChatter = false;
    @track chatterDaysOffset = 0;
    @track hasMoreChatterItems = true;

    @track activeTab = 'approved';

    // Approval status tracking
    @track approvalStatus = {
        approvalMessage: '',
        canEditTimesheet: true
    };

    acceptedFormats = '.jpg,.jpeg,.png,.gif,.bmp,.svg,.webp,.tiff,.pdf,.doc,.docx';

    get isDesktopDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /iphone|ipad|ipod|android|blackberry|windows phone|mobile/i.test(userAgent);
        const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
        return !isMobile && !isTablet;
    }

    get isStep1() { return this.currentStep === 'step1'; }
    get isStep2() { return this.currentStep === 'step2'; }
    get isStep3() { return this.currentStep === 'step3'; }
    get isStep4() { return this.currentStep === 'step4'; }

    get hasCrewMembers() {
        return this.crewMembers && this.crewMembers.length > 0;
    }

    get hasTimesheetEntries() {
        return this.timesheetEntries && this.timesheetEntries.length > 0;
    }

    get hasRegularTimesheetEntries() {
        return this.regularTimesheetEntries && this.regularTimesheetEntries.length > 0;
    }

    get hasPendingTimesheetEntries() {
        return this.pendingTimesheetEntries && this.pendingTimesheetEntries.length > 0;
    }

    get isFormDisabled() {
        return !this.approvalStatus.canEditTimesheet;
    }

    get hasLocationOptions() {
        return this.groupedLocationProcesses && this.groupedLocationProcesses.length > 0;
    }

    get hasLocationProcesses() {
        return this.locationProcesses && this.locationProcesses.length > 0;
    }

    get hasMobilizationOptions() {
        return this.mobilizationOptions && this.mobilizationOptions.length > 0;
    }

    get showApprovedTab() {
        return this.activeTab === 'approved';
    }

    get showPendingTab() {
        return this.activeTab === 'pending';
    }

    get approvedTabClass() {
        return this.activeTab === 'approved' ? 'tab-button active' : 'tab-button';
    }

    get pendingTabClass() {
        return this.activeTab === 'pending' ? 'tab-button active' : 'tab-button';
    }

    get clockInMinBoundary() {
        const reference = this.currentJobStartDateTime || this.clockInTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get clockInMaxBoundary() {
        const reference = this.currentJobStartDateTime || this.clockInTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T23:59` : null;
    }

    get clockOutMinBoundary() {
        const reference = this.currentJobEndDateTime || this.clockOutTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get clockOutMaxBoundary() {
        const reference = this.currentJobEndDateTime || this.clockOutTime;
        const dateKey = this.extractDateKey(reference);
        if (!dateKey) return null;
        const nextDay = this.addDaysToDateKey(dateKey, 1);
        return nextDay ? `${nextDay}T23:59` : null;
    }

    get editClockInMinBoundary() {
        const reference = this.currentJobStartDateTime || (this.editTimesheetData ? this.editTimesheetData.newclockInTime : null);
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get editClockInMaxBoundary() {
        const reference = this.currentJobStartDateTime || (this.editTimesheetData ? this.editTimesheetData.newclockInTime : null);
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T23:59` : null;
    }

    get editClockOutMinBoundary() {
        const reference = this.currentJobEndDateTime || (this.editTimesheetData ? this.editTimesheetData.newclockOutTime : null);
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get editClockOutMaxBoundary() {
        const reference = this.currentJobEndDateTime || (this.editTimesheetData ? this.editTimesheetData.newclockOutTime : null);
        const dateKey = this.extractDateKey(reference);
        if (!dateKey) return null;
        const nextDay = this.addDaysToDateKey(dateKey, 1);
        return nextDay ? `${nextDay}T23:59` : null;
    }

    get showApprovalMessage() {
        return this.approvalStatus.approvalMessage && this.approvalStatus.approvalMessage.trim() !== '';
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

    get isEditSaveDisabled() {
        if (!this.editTimesheetData) return true;

        const oldClkIn = this.editTimesheetData.oldclockInTime ? this.editTimesheetData.oldclockInTime.slice(0, 16) : '';
        const newClkIn = this.editTimesheetData.newclockInTime ? this.editTimesheetData.newclockInTime.slice(0, 16) : '';

        const oldClkOut = this.editTimesheetData.oldclockOutTime ? this.editTimesheetData.oldclockOutTime.slice(0, 16) : '';
        const newClkOut = this.editTimesheetData.newclockOutTime ? this.editTimesheetData.newclockOutTime.slice(0, 16) : '';

        const oldTravel = parseFloat(this.editTimesheetData.oldTravelTime || 0);
        const newTravel = parseFloat(this.editTimesheetData.travelTime || 0);

        const isClockInChanged = oldClkIn !== newClkIn;
        const isClockOutChanged = oldClkOut !== newClkOut;
        const isTravelChanged = oldTravel !== newTravel;

        return !(isClockInChanged || isClockOutChanged || isTravelChanged);
    }

    connectedCallback() {
        this.loadMobilizationList();
        this.loadLocationProcesses();
    }

    renderedCallback() {
        // Apply slider styles manually in DOM for dynamic progress bars
        if (this.isStep3 && this.groupedLocationProcesses.length > 0) {
            this.updateSliderStyles();
            this.updateRowHighlighting();

            // Open first accordion by default
            const firstAccordionContent = this.template.querySelector('.location-accordion-content');
            const firstAccordionHeader = this.template.querySelector('.location-accordion-header');

            if (firstAccordionContent && !firstAccordionContent.classList.contains('open')) {
                firstAccordionContent.classList.add('open');
                if (firstAccordionHeader) {
                    firstAccordionHeader.classList.add('active');
                }
            }
        }
    }

    updateSliderStyles() {
        // Update slider visual styles based on completion percentages
        this.groupedLocationProcesses.forEach(locationGroup => {
            locationGroup.processes.forEach(proc => {
                const slider = this.template.querySelector(`[data-process-id="${proc.id}"]`);
                if (slider) {
                    // Set the slider value to reflect current completion percentage
                    slider.value = proc.completedPercent;

                    const sliderTrack = slider.closest('.slider-wrapper')?.querySelector('.slider-track');
                    if (sliderTrack) {
                        const completed = sliderTrack.querySelector('.completed');
                        const today = sliderTrack.querySelector('.today');
                        const remaining = sliderTrack.querySelector('.remaining');

                        if (completed && today && remaining) {
                            completed.style.width = `${proc.previousPercent}%`;
                            today.style.width = `${proc.todayPercent}%`;
                            remaining.style.width = `${proc.remainingPercent}%`;

                            // Apply orange color if pending approval, purple if editing
                            if (proc.isPendingApproval) {
                                today.classList.remove('today');
                                today.classList.add('pending-approval');
                            } else {
                                today.classList.remove('pending-approval');
                                today.classList.add('today');
                            }
                        }
                    }

                    // Position slider to start at previousPercent
                    const sliderWidth = 100 - proc.previousPercent;
                    slider.style.left = `${proc.previousPercent}%`;
                    slider.style.width = `${sliderWidth}%`;

                    // Disable slider only if 100% complete
                    // Pending approval badge is shown for visibility but doesn't block editing
                    if (proc.completedPercent >= 100) {
                        slider.disabled = true;
                        slider.style.cursor = 'not-allowed';
                    } else {
                        slider.disabled = false;
                        slider.style.cursor = 'pointer';
                    }
                }
            });
        });
    }

    updateRowHighlighting() {
        // Highlight modified sliders
        this.modifiedProcesses.forEach((modification, processId) => {
            const slider = this.template.querySelector(`[data-process-id="${processId}"]`);
            if (slider) {
                const sliderContainer = slider.closest('.location-slider-container');
                if (sliderContainer) {
                    sliderContainer.classList.add('modified-field');
                }
            }
        });
    }

    loadMobilizationList() {
        getMobilizationList({ jobId: this.jobId, crewLeaderId: this.crewLeaderId })
            .then(result => {
                if (result) {
                    // Parse and format the mobilization options
                    this.mobilizationOptions = Object.keys(result).map(key => {
                        const parts = result[key].split('||');
                        const dateStr = parts[0]; // YYYY-MM-DD
                        const jobName = parts[1];
                        const status = parts[2];

                        // Format date as "MMM DD, YYYY"
                        const formattedDate = this.formatDateToDisplay(dateStr);

                        return {
                            label: `${jobName} (Date - ${formattedDate}, Status - ${status})`,
                            value: key,
                            dateStr: dateStr // Keep original date for sorting
                        };
                    });

                    // Sort by date descending (most recent first)
                    this.mobilizationOptions.sort((a, b) => {
                        return new Date(b.dateStr) - new Date(a.dateStr);
                    });

                    // Auto-select the most recent (first) mobilization
                    if (this.mobilizationOptions.length > 0) {
                        this.selectedMobilizationId = this.mobilizationOptions[0].value;
                        this.loadCrewMembersAndApprovalStatus();
                    }
                }
            })
            .catch(error => {
                console.error('Error loading mobilizations:', error);
                this.showToast('Error', 'Failed to load mobilizations', 'error');
            })
    }

    /**
     * Format date string from YYYY-MM-DD to MMM DD, YYYY
     */
    formatDateToDisplay(dateStr) {
        if (!dateStr) return '';

        const date = new Date(dateStr + 'T00:00:00');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();

        return `${month} ${day}, ${year}`;
    }

    handleMobilizationChange(event) {
        this.selectedMobilizationId = event.detail.value;
        if (this.selectedMobilizationId) {
            this.loadCrewMembersAndApprovalStatus();
        }
    }

    loadCrewMembersAndApprovalStatus() {
        this.isLoading = true;
        getMobilizationMembersWithStatus({ mobId: this.selectedMobilizationId, jobId: this.jobId, crewLeaderId: this.crewLeaderId })
            .then(result => {
                console.log('getMobilizationMembersWithStatus result:', result);

                if (result) {
                    // Process approval status
                    const approvalStatusList = result.approvalStatus || [];
                    if (approvalStatusList.length > 0) {
                        const approvalData = approvalStatusList[0];
                        this.approvalStatus = {
                            approvalMessage: approvalData.approvalMessage || '',
                            canEditTimesheet: approvalData.canEditTimesheet !== false
                        };
                    } else {
                        this.approvalStatus = {
                            approvalMessage: '',
                            canEditTimesheet: true
                        };
                    }

                    // Process clock in members
                    const clockInList = result.clockIn || [];
                    const clockOutList = result.clockOut || [];

                    // Combine and process all members
                    const allMembers = new Map();

                    clockInList.forEach(member => {
                        allMembers.set(member.contactId, {
                            contactId: member.contactId,
                            contactName: member.contactName,
                            canClockIn: this.approvalStatus.canEditTimesheet,
                            canClockOut: false,
                            statusText: member.isAgain ? 'Ready to Clock In Again' : 'Not Clocked In',
                            statusClass: 'status-not-clocked',
                            hoursWorked: null,
                            jobStartTime: member.jobStartTime,
                            jobEndTime: member.jobEndTime,
                            timesheetId: member.timesheetId,
                            isTimesheetNull: member.isTimesheetNull,
                            isTimesheetEntryNull: member.isTimesheetEntryNull,
                            mobMemberId: member.mobMemberId,
                            recentClockIn: member.recentClockIn ? this.formatToAMPM(member.recentClockIn) : null,
                            recentClockOut: member.recentClockOut ? this.formatToAMPM(member.recentClockOut) : null,
                            hasRecentTimes: !!(member.recentClockIn || member.recentClockOut)
                        });
                    });

                    clockOutList.forEach(member => {
                        allMembers.set(member.contactId, {
                            contactId: member.contactId,
                            contactName: member.contactName,
                            canClockIn: false,
                            canClockOut: this.approvalStatus.canEditTimesheet,
                            statusText: 'Clocked In',
                            statusClass: 'status-clocked-in',
                            // hoursWorked: this.calculateHours(member.clockInTime),
                            clockInTime: member.clockInTime,
                            jobStartTime: member.jobStartTime,
                            jobEndTime: member.jobEndTime,
                            timesheetId: member.timesheetId,
                            isTimesheetNull: member.isTimesheetNull,
                            isTimesheetEntryNull: member.isTimesheetEntryNull,
                            timesheetEntryId: member.timesheetEntryId,
                            mobMemberId: member.mobMemberId,
                            recentClockIn: member.clockInTime ? this.formatToAMPM(member.clockInTime) : null,
                            recentClockOut: member.recentClockOut ? this.formatToAMPM(member.recentClockOut) : null,
                            hasRecentTimes: !!(member.clockInTime || member.recentClockOut)
                        });
                    });

                    this.crewMembers = Array.from(allMembers.values());

                    // Sort crew members by contact name in ascending order
                    this.crewMembers.sort((a, b) => {
                        const nameA = a.contactName ? a.contactName.toLowerCase() : '';
                        const nameB = b.contactName ? b.contactName.toLowerCase() : '';
                        return nameA.localeCompare(nameB);
                    });

                    // Store cost code options
                    if (result.costCodeDetails && result.costCodeDetails.length > 0) {
                        const costCodeMap = result.costCodeDetails[0].costCodeDetails;
                        this.costCodeOptions = Object.keys(costCodeMap).map(key => ({
                            label: costCodeMap[key],
                            value: key
                        }));
                    }

                    // Store job times
                    if (this.crewMembers.length > 0) {
                        this.currentJobStartDateTime = this.crewMembers[0].jobStartTime;
                        this.currentJobEndDateTime = this.crewMembers[0].jobEndTime;
                    }
                }
            })
            .catch(error => {
                console.error('Error loading crew members:', error);
                this.showToast('Error', 'Failed to load crew members', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleClockInClick(event) {
        console.log('enter in clock in');
        const contactId = event.currentTarget.dataset.id;
        const member = this.crewMembers.find(m => m.contactId === contactId);

        console.log('members ==> ', contactId, ' ', member)
        if (member) {
            this.selectedContactId = contactId;
            this.clockInTime = member.jobStartTime ? member.jobStartTime.slice(0, 16) : new Date().toISOString().slice(0, 16);
            this.modalJobStartTime = member.jobStartTime ? this.formatToAMPM(member.jobStartTime) : '';
            this.modalJobEndTime = member.jobEndTime ? this.formatToAMPM(member.jobEndTime) : '';
            this.showClockInModal = true;
        }
    }

    handleClockOutClick(event) {
        const contactId = event.currentTarget.dataset.id;
        const member = this.crewMembers.find(m => m.contactId === contactId);

        if (member) {
            this.selectedContactId = contactId;
            this.clockOutTime = member.jobEndTime ? member.jobEndTime.slice(0, 16) : new Date().toISOString().slice(0, 16);
            this.modalJobStartTime = member.jobStartTime ? this.formatToAMPM(member.jobStartTime) : '';
            this.modalJobEndTime = member.jobEndTime ? this.formatToAMPM(member.jobEndTime) : '';
            this.previousClockInTime = member.clockInTime ? this.formatToAMPM(member.clockInTime) : null;
            this.showClockOutModal = true;
        }
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;

        if (field === 'costCode') {
            this.selectedCostCodeId = value;
        } else if (field === 'clockIn') {
            this.clockInTime = value;
        } else if (field === 'clockOut') {
            this.clockOutTime = value;
        }
    }

    saveClockIn() {
        if (!this.selectedCostCodeId || !this.clockInTime) {
            this.showToast('Error', 'Please fill all required fields', 'error');
            return;
        }

        const member = this.crewMembers.find(m => m.contactId === this.selectedContactId);
        if (!member) return;

        const jobStartReference = member.jobStartTime;
        if (!this.validateClockInDate(this.clockInTime, jobStartReference)) {
            return;
        }

        this.isLoading = true;

        const params = {
            actionType: 'clockIn',
            contactId: this.selectedContactId,
            costCodeId: this.selectedCostCodeId,
            mobId: this.selectedMobilizationId,
            jobId: this.jobId,
            clockInTime: this.clockInTime.replace(' ', 'T'),
            isTimeSheetNull: member.isTimesheetNull,
            timesheetId: member.timesheetId,
            isTimeSheetEntryNull: member.isTimesheetEntryNull,
            mobMemberId: member.mobMemberId
        };

        createTimesheetRecords({ params: JSON.stringify(params) })
            .then(result => {
                if (result) {
                    this.showToast('Success', 'Clocked In Successfully', 'success');
                    this.closeClockInModal();
                    this.loadCrewMembersAndApprovalStatus();
                } else {
                    this.showToast('Error', 'Failed to Clock In', 'error');
                }
            })
            .catch(error => {
                console.error('Error clock in:', error);
                this.showToast('Error', 'Something went wrong', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    saveClockOut() {
        if (!this.clockOutTime) {
            this.showToast('Error', 'Please select clock out time', 'error');
            return;
        }

        const member = this.crewMembers.find(m => m.contactId === this.selectedContactId);
        if (!member) return;

        if (new Date(this.clockOutTime.replace(' ', 'T')) <= new Date(member.clockInTime.slice(0, 16).replace('T', ' '))) {
            this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
            return;
        }

        const jobStartReference = member.jobStartTime;
        const jobEndReference = member.jobEndTime;
        if (!this.validateClockOutDate(this.clockOutTime, jobStartReference, jobEndReference)) {
            return;
        }

        this.isLoading = true;

        const params = {
            actionType: 'clockOut',
            contactId: this.selectedContactId,
            mobId: this.selectedMobilizationId,
            jobId: this.jobId,
            clockInTime: member.clockInTime,
            clockOutTime: this.clockOutTime.replace(' ', 'T'),
            isTimeSheetNull: member.isTimesheetNull,
            timesheetId: member.timesheetId,
            isTimeSheetEntryNull: member.isTimesheetEntryNull,
            timesheetEntryId: member.timesheetEntryId,
            mobMemberId: member.mobMemberId
        };

        createTimesheetRecords({ params: JSON.stringify(params) })
            .then(result => {
                if (result) {
                    this.showToast('Success', 'Clocked Out Successfully', 'success');
                    this.closeClockOutModal();
                    this.loadCrewMembersAndApprovalStatus();
                } else {
                    this.showToast('Error', 'Failed to Clock Out', 'error');
                }
            })
            .catch(error => {
                console.error('Error clock out:', error);
                this.showToast('Error', 'Something went wrong', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    closeClockInModal() {
        try {
            this.showClockInModal = false;
            this.selectedContactId = null;
            this.selectedCostCodeId = null;
            this.clockInTime = null;
        } catch (error) {
            // Error handling
        }
    }

    closeClockOutModal() {
        this.showClockOutModal = false;
        this.selectedContactId = null;
        this.clockOutTime = null;
        this.previousClockInTime = null;
    }

    // Step 2: Timesheet Entries
    loadTimesheetEntries() {
        this.isLoading = true;

        // Get job start date for query
        const jobStartDate = this.currentJobStartDateTime ?
            new Date(this.currentJobStartDateTime).toISOString().split('T')[0] :
            new Date().toISOString().split('T')[0];

        getTimeSheetEntryItems({ jobId: this.jobId, jobStartDate: jobStartDate, mobId: this.selectedMobilizationId, crewLeaderId: this.crewLeaderId })
            .then(result => {
                console.log('Timesheet Entries Result:', result);
                if (result && result.length > 0) {
                    const allEntries = result.map((entry) => {
                        // Check if there's a local pending edit for this entry
                        const localEdit = this.localPendingEdits.get(entry.id);
                        const isPendingLocally = localEdit !== undefined;

                        // Use raw ISO strings for formatting (to avoid timezone issues)
                        let displayClockIn = entry.clockInTime; // Keep ISO format
                        let displayClockOut = entry.clockOutTime; // Keep ISO format
                        let displayTravelTime = entry.travelTime ? entry.travelTime.toFixed(2) : '0.00';

                        if (isPendingLocally) {
                            // Override with pending new values from local edits
                            const changesMap = new Map(localEdit.changes.map(c => [c.fieldApiName, c.newValue]));
                            if (changesMap.has('wfrecon__Clock_In_Time__c')) {
                                displayClockIn = changesMap.get('wfrecon__Clock_In_Time__c');
                            }
                            if (changesMap.has('wfrecon__Clock_Out_Time__c')) {
                                displayClockOut = changesMap.get('wfrecon__Clock_Out_Time__c');
                            }
                            if (changesMap.has('wfrecon__Travel_Time__c')) {
                                displayTravelTime = changesMap.get('wfrecon__Travel_Time__c');
                            }
                        }

                        const workHrs = entry.workHours ? parseFloat(entry.workHours) : 0;
                        const travelHrs = displayTravelTime ? parseFloat(displayTravelTime) : 0;
                        const totalHrs = workHrs + travelHrs;

                        return {
                            id: entry.id,
                            contactId: entry.contactId,
                            contactName: entry.contactName,
                            clockInTime: this.formatToAMPM(displayClockIn),
                            clockOutTime: this.formatToAMPM(displayClockOut),
                            workHours: workHrs.toFixed(2),
                            travelTime: travelHrs.toFixed(2),
                            totalTime: totalHrs.toFixed(2),
                            costCodeName: entry.costCodeName || '--',
                            TSEId: entry.TSEId,
                            rawClockIn: entry.clockInTime,
                            rawClockOut: entry.clockOutTime,
                            canEdit: this.approvalStatus.canEditTimesheet
                        };
                    });

                    // Sort timesheet entries by contact name in ascending order
                    allEntries.sort((a, b) => {
                        const nameA = a.contactName ? a.contactName.toLowerCase() : '';
                        const nameB = b.contactName ? b.contactName.toLowerCase() : '';
                        return nameA.localeCompare(nameB);
                    });

                    // Separate regular and pending entries based on local edits
                    const regularEntries = allEntries.filter(entry => !this.localPendingEdits.has(entry.id));
                    const pendingEntries = allEntries.filter(entry => this.localPendingEdits.has(entry.id));

                    // Assign serial numbers starting from 1 for each section
                    this.regularTimesheetEntries = regularEntries.map((entry, index) => ({
                        ...entry,
                        srNo: index + 1
                    }));

                    // For pending entries, extract old/new values from local edits
                    this.pendingTimesheetEntries = pendingEntries.map((entry, index) => {
                        const localEdit = this.localPendingEdits.get(entry.id);

                        // Create maps for quick lookup
                        const changesMap = new Map(localEdit.changes.map(c => [c.fieldApiName, c]));

                        // Get old and new values from local edits
                        const clockInChange = changesMap.get('wfrecon__Clock_In_Time__c');
                        const clockOutChange = changesMap.get('wfrecon__Clock_Out_Time__c');
                        const travelTimeChange = changesMap.get('wfrecon__Travel_Time__c');

                        // Get old and new values (keep ISO format for accurate comparison and formatting)
                        const oldClockInVal = clockInChange ? clockInChange.oldValue : entry.rawClockIn;
                        const oldClockOutVal = clockOutChange ? clockOutChange.oldValue : entry.rawClockOut;
                        const oldTravelTimeVal = travelTimeChange ? travelTimeChange.oldValue : (entry.travelTime || '0.00');

                        const newClockInVal = clockInChange ? clockInChange.newValue : entry.rawClockIn;
                        const newClockOutVal = clockOutChange ? clockOutChange.newValue : entry.rawClockOut;
                        const newTravelTimeVal = travelTimeChange ? travelTimeChange.newValue : (entry.travelTime || '0.00');

                        // Calculate old total hours using old values
                        const oldWorkHours = this.calculateWorkHours(oldClockInVal, oldClockOutVal);
                        const oldTravelHours = parseFloat(oldTravelTimeVal || 0);
                        const oldTotalHours = (oldWorkHours + oldTravelHours).toFixed(2);

                        // Calculate new total hours using new values
                        const newWorkHours = this.calculateWorkHours(newClockInVal, newClockOutVal);
                        const newTravelHours = parseFloat(newTravelTimeVal || 0);
                        const newTotalHours = (newWorkHours + newTravelHours).toFixed(2);

                        // Check if values actually changed (compare ISO strings for clock times)
                        const isClockInChanged = oldClockInVal !== newClockInVal;
                        const isClockOutChanged = oldClockOutVal !== newClockOutVal;
                        const isTravelTimeChanged = parseFloat(oldTravelTimeVal) !== parseFloat(newTravelTimeVal);
                        const isTotalHoursChanged = parseFloat(oldTotalHours) !== parseFloat(newTotalHours);

                        return {
                            ...entry,
                            srNo: index + 1,
                            // Raw values for editing (ISO format)
                            rawNewClockIn: newClockInVal,
                            rawNewClockOut: newClockOutVal,
                            rawOldClockIn: oldClockInVal,
                            rawOldClockOut: oldClockOutVal,
                            // Old values (from current database state or approval data oldValue) - formatted
                            oldClockIn: this.formatToAMPM(oldClockInVal),
                            oldClockOut: this.formatToAMPM(oldClockOutVal),
                            oldTravelTime: oldTravelTimeVal,
                            oldTotalHours: oldTotalHours,
                            // New values (from approval data newValue) - formatted
                            newClockIn: this.formatToAMPM(newClockInVal),
                            newClockOut: this.formatToAMPM(newClockOutVal),
                            newTravelTime: newTravelTimeVal,
                            newTotalHours: newTotalHours,
                            // Highlight classes - only for NEW columns where value actually changed
                            hasClockInChange: isClockInChanged ? 'value-changed' : '',
                            hasClockOutChange: isClockOutChanged ? 'value-changed' : '',
                            hasTravelTimeChange: isTravelTimeChanged ? 'value-changed' : '',
                            hasTotalHoursChange: isTotalHoursChanged ? 'value-changed' : ''
                        };
                    });

                    // Keep all entries for reference (with mixed serial numbers)
                    this.timesheetEntries = [...this.regularTimesheetEntries, ...this.pendingTimesheetEntries];

                    console.log('Total entries:', this.timesheetEntries.length);
                    console.log('Regular entries:', this.regularTimesheetEntries);
                    console.log('Pending entries:', this.pendingTimesheetEntries);
                } else {
                    // No records found - reset all arrays
                    console.log('No timesheet entries found');
                    this.timesheetEntries = [];
                    this.regularTimesheetEntries = [];
                    this.pendingTimesheetEntries = [];
                }
            })
            .catch(error => {
                console.error('Error loading timesheet entries:', error);
                this.showToast('Error', 'Failed to load timesheet entries', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleEditTimesheetEntry(event) {
        const entryId = event.currentTarget.dataset.id;
        const entry = this.timesheetEntries.find(e => e.id === entryId);

        if (entry) {
            console.log('Edit Entry:', entry);
            console.log('Raw Clock In:', entry.rawClockIn);
            console.log('Raw NEW Clock In:', entry.rawNewClockIn);
            console.log('Raw Clock Out:', entry.rawClockOut);
            console.log('Raw NEW Clock Out:', entry.rawNewClockOut);

            // Check if there's a local pending edit for this entry
            const localEdit = this.localPendingEdits.get(entry.id);
            const isPending = localEdit !== undefined;

            // For pending entries, use rawNewClockIn/Out if available, otherwise use rawClockIn/Out
            const currentClockIn = (isPending && entry.rawNewClockIn) ? entry.rawNewClockIn : entry.rawClockIn;
            const currentClockOut = (isPending && entry.rawNewClockOut) ? entry.rawNewClockOut : entry.rawClockOut;
            const currentTravelTime = (isPending && entry.newTravelTime) ? entry.newTravelTime : (entry.travelTime || '0.00');

            console.log('Using Clock In:', currentClockIn);
            console.log('Using Clock Out:', currentClockOut);
            console.log('Using Travel Time:', currentTravelTime);

            this.editTimesheetData = {
                id: entry.id,
                TSEId: entry.TSEId,
                contactId: entry.contactId,
                contactName: entry.contactName,
                oldclockInTime: entry.rawClockIn ? entry.rawClockIn.slice(0, 16) : '',
                oldclockOutTime: entry.rawClockOut ? entry.rawClockOut.slice(0, 16) : '',
                oldTravelTime: entry.travelTime || '0.00',
                newclockInTime: currentClockIn ? currentClockIn.slice(0, 16) : '',
                newclockOutTime: currentClockOut ? currentClockOut.slice(0, 16) : '',
                travelTime: currentTravelTime
            };
            this.showEditTimesheetModal = true;
        }
    }

    handleEditInputChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;

        if (field === 'editClockIn') {
            this.editTimesheetData.newclockInTime = value;
        } else if (field === 'editClockOut') {
            this.editTimesheetData.newclockOutTime = value;
        } else if (field === 'editTravelTime') {
            this.editTimesheetData.travelTime = value;
        }

        console.log('this.editTimesheetData ::', this.editTimesheetData);

    }

    saveEditedTimesheet() {
        try {
            if (!this.editTimesheetData.newclockInTime || !this.editTimesheetData.newclockOutTime) {
                this.showToast('Error', 'Clock In and Clock Out times are required', 'error');
                return;
            }

            if (new Date(this.editTimesheetData.newclockOutTime.replace(' ', 'T')) <= new Date(this.editTimesheetData.newclockInTime.replace(' ', 'T'))) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }

            // Validate clock in date is on job start date
            if (!this.validateClockInDate(this.editTimesheetData.newclockInTime, this.currentJobStartDateTime)) {
                return;
            }

            // Validate clock out date is within job date range
            if (!this.validateClockOutDate(this.editTimesheetData.newclockOutTime, this.currentJobStartDateTime, this.currentJobEndDateTime)) {
                return;
            }

            // Convert to ISO format for storage
            const newClkIn = this.editTimesheetData.newclockInTime.slice(0, 16) + ':00.000Z';
            const newClkOut = this.editTimesheetData.newclockOutTime.slice(0, 16) + ':00.000Z';
            const oldClkIn = this.editTimesheetData.oldclockInTime.slice(0, 16) + ':00.000Z';
            const oldClkOut = this.editTimesheetData.oldclockOutTime.slice(0, 16) + ':00.000Z';
            const travelTime = this.editTimesheetData.travelTime || '0.00';
            const oldTravelTime = this.editTimesheetData.oldTravelTime || '0.00';

            // Build changes array
            const changes = [];

            if (oldClkIn !== newClkIn) {
                changes.push({
                    fieldApiName: 'wfrecon__Clock_In_Time__c',
                    oldValue: oldClkIn,
                    newValue: newClkIn
                });
            }

            if (oldClkOut !== newClkOut) {
                changes.push({
                    fieldApiName: 'wfrecon__Clock_Out_Time__c',
                    oldValue: oldClkOut,
                    newValue: newClkOut
                });
            }

            if (oldTravelTime !== travelTime) {
                changes.push({
                    fieldApiName: 'wfrecon__Travel_Time__c',
                    oldValue: parseFloat(oldTravelTime),
                    newValue: parseFloat(travelTime)
                });
            }

            // Only proceed if there are changes
            if (changes.length > 0) {
                // Store locally - no database update
                this.localPendingEdits.set(this.editTimesheetData.id, {
                    changes: changes,
                    TSEId: this.editTimesheetData.TSEId,
                    contactId: this.editTimesheetData.contactId,
                    contactName: this.editTimesheetData.contactName
                });

                this.showToast('Success', 'Timesheet entry marked as pending locally', 'success');
                this.closeEditTimesheetModal();
                this.loadTimesheetEntries();
            }
        } catch (error) {
            console.error('Error saving timesheet edit:', error);
            this.showToast('Error', 'Something went wrong', 'error');
        }
    }

    closeEditTimesheetModal() {
        this.showEditTimesheetModal = false;
        this.editTimesheetData = {};
    }

    handleMoveBackToRegular(event) {
        const entryId = event.currentTarget.dataset.id;
        const entry = this.pendingTimesheetEntries.find(e => e.id === entryId);

        if (!entry) {
            this.showToast('Error', 'Entry not found', 'error');
            return;
        }

        // Store the entry ID and show modal
        this.selectedMoveBackEntryId = entryId;
        this.showMoveBackModal = true;
    }

    closeMoveBackModal() {
        this.showMoveBackModal = false;
        this.selectedMoveBackEntryId = null;
    }

    confirmMoveBackToRegular() {
        if (!this.selectedMoveBackEntryId) {
            this.showToast('Error', 'Entry not found', 'error');
            return;
        }

        // Remove from local pending edits
        this.localPendingEdits.delete(this.selectedMoveBackEntryId);

        this.showToast('Success', 'Entry moved back to regular successfully. The Regular tab has been updated.', 'success');
        this.showMoveBackModal = false;
        this.selectedMoveBackEntryId = null;

        // Reload timesheet entries to reflect changes in both tabs
        this.loadTimesheetEntries();
    }

    handleApprovedTab() {
        this.activeTab = 'approved';
    }

    handlePendingTab() {
        this.activeTab = 'pending';
    }

    // Step 3: Log Details
    handleStep3InputChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;
        this.step3Data[field] = value;
    }

    loadLocationProcesses() {
        if (!this.jobId) return;

        this.isLoading = true;

        getJobLocationProcesses({ jobId: this.jobId })
            .then(result => {
                console.log('Location Processes Result:', result);
                if (result && result.processes && result.processes.length > 0) {
                    const pendingApprovalData = result.pendingApprovalData || {};

                    this.allLocationProcesses = result.processes.map(proc => {
                        const prevPercent = parseFloat(proc.wfrecon__Completed_Percentage__c || 0);
                        const approvalInfo = pendingApprovalData[proc.Id];
                        const isPendingApproval = !!approvalInfo;

                        return {
                            id: proc.Id,
                            name: proc?.wfrecon__Process_Name__c || proc.Name,
                            locationId: proc.wfrecon__Location__c,
                            locationName: proc.wfrecon__Location__r?.Name || 'Unknown Location',
                            sequence: proc.wfrecon__Sequence__c,
                            previousPercent: parseFloat(prevPercent.toFixed(1)),
                            completedPercent: parseFloat(prevPercent.toFixed(1)),
                            todayPercent: 0,
                            remainingPercent: parseFloat((100 - prevPercent).toFixed(1)),
                            isPendingApproval: isPendingApproval,
                            approvalOldValue: approvalInfo ? approvalInfo.oldValue : null,
                            approvalNewValue: approvalInfo ? approvalInfo.newValue : null
                        };
                    });

                    // Build location options
                    this.buildLocationOptions();

                    // Set default location to "Job Site" or first available
                    this.setDefaultLocation();
                }
            })
            .catch(error => {
                console.error('Error loading location processes:', error);
                this.showToast('Error', 'Failed to load location processes', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    buildLocationOptions() {
        const locationMap = new Map();

        this.allLocationProcesses.forEach(proc => {
            if (!locationMap.has(proc.locationId)) {
                locationMap.set(proc.locationId, {
                    label: proc.locationName,
                    value: proc.locationId
                });
            }
        });

        this.locationOptions = Array.from(locationMap.values());
    }

    setDefaultLocation() {
        // Try to find "Job Site" location
        const jobSiteLocation = this.locationOptions.find(loc =>
            loc.label.toLowerCase() === 'job site'
        );

        if (jobSiteLocation) {
            this.selectedLocationId = jobSiteLocation.value;
        } else if (this.locationOptions.length > 0) {
            // If no "Job Site", select first location
            this.selectedLocationId = this.locationOptions[0].value;
        }

        // Filter processes for selected location
        this.filterProcessesByLocation();
    }

    handleLocationChange(event) {
        this.selectedLocationId = event.detail.value;
        this.filterProcessesByLocation();

        // Force re-render after short delay to apply slider values
        setTimeout(() => {
            this.updateSliderStyles();
            this.updateRowHighlighting();
        }, 100);
    }

    filterProcessesByLocation() {
        if (!this.selectedLocationId) {
            this.locationProcesses = [];
            this.groupedLocationProcesses = [];
            return;
        }

        // Filter processes for selected location
        this.locationProcesses = this.allLocationProcesses.filter(
            proc => proc.locationId === this.selectedLocationId
        );

        // Apply any saved modifications to the filtered processes
        this.locationProcesses.forEach(proc => {
            if (this.modifiedProcesses.has(proc.id)) {
                const modification = this.modifiedProcesses.get(proc.id);
                proc.completedPercent = parseFloat(modification.newValue.toFixed(1));
                proc.todayPercent = parseFloat((modification.newValue - proc.previousPercent).toFixed(1));
                proc.remainingPercent = parseFloat((100 - modification.newValue).toFixed(1));
            }
        });

        this.groupProcessesByLocation();
    }

    groupProcessesByLocation() {
        // Group processes by location for display with accordion support
        const locationMap = new Map();

        this.allLocationProcesses.forEach(proc => {
            if (!locationMap.has(proc.locationId)) {
                locationMap.set(proc.locationId, {
                    locationId: proc.locationId,
                    locationName: proc.locationName,
                    sectionName: proc.locationName.replace(/\s+/g, '_'), // Create unique section name for accordion
                    processes: []
                });
            }
            // Only show "Pending Approval" badge if there's EXISTING pending approval from previous log entries
            // Do NOT show badge for modifications in the current session
            const processWithApproval = {
                ...proc,
                isPendingApproval: proc.isPendingApproval || false,
                approvalOldValue: proc.approvalOldValue,
                approvalNewValue: proc.approvalNewValue
            };
            locationMap.get(proc.locationId).processes.push(processWithApproval);
        });

        this.groupedLocationProcesses = Array.from(locationMap.values());

        // Set first accordion as active by default
        if (this.groupedLocationProcesses.length > 0) {
            this.activeAccordionSections = [this.groupedLocationProcesses[0].sectionName];
        }
    }

    handleAccordionToggle(event) {
        event.stopPropagation();
        const sectionName = event.currentTarget.dataset.section;
        const headerElement = event.currentTarget;
        const contentElement = this.template.querySelector(
            `.location-accordion-content[data-section="${sectionName}"]`
        );

        if (contentElement) {
            const isOpen = contentElement.classList.contains('open');

            // Close all accordions first (only one open at a time)
            const allContents = this.template.querySelectorAll('.location-accordion-content');
            const allHeaders = this.template.querySelectorAll('.location-accordion-header');

            allContents.forEach(content => content.classList.remove('open'));
            allHeaders.forEach(header => header.classList.remove('active'));

            // If it wasn't open, open it
            if (!isOpen) {
                contentElement.classList.add('open');
                headerElement.classList.add('active');
            }

            // Update slider visuals after DOM settles
            setTimeout(() => this.updateSliderStyles(), 100);
        }
    }

    handleSliderInput(event) {
        const processId = event.target.dataset.id;
        const newValue = parseFloat(event.target.value);
        const sliderElement = event.target;

        // Update visual progress in real-time
        const sliderContainer = sliderElement.closest('.slider-wrapper');
        if (sliderContainer) {
            const sliderTrack = sliderContainer.querySelector('.slider-track');
            if (sliderTrack) {
                const proc = this.findProcessById(processId);
                if (proc) {
                    const todayPercent = Math.max(0, newValue - proc.previousPercent);
                    const remainingPercent = Math.max(0, 100 - newValue);

                    const completed = sliderTrack.querySelector('.completed');
                    const today = sliderTrack.querySelector('.today, .pending-approval');
                    const remaining = sliderTrack.querySelector('.remaining');

                    if (completed && today && remaining) {
                        completed.style.width = `${proc.previousPercent}%`;
                        today.style.width = `${todayPercent}%`;
                        remaining.style.width = `${remainingPercent}%`;

                        // Ensure it's purple (editing mode) when user is dragging
                        today.classList.remove('pending-approval');
                        today.classList.add('today');
                    }

                    // Update percentage display
                    const percentageDisplay = sliderElement.closest('.location-slider-container')?.querySelector('.progress-percentage');
                    if (percentageDisplay) {
                        percentageDisplay.textContent = `${newValue.toFixed(1)}% Complete`;
                    }

                    // Update labels
                    const labelsContainer = sliderElement.closest('.location-slider-container')?.querySelector('.slider-labels');
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
        }
    }

    handleSliderChange(event) {
        const processId = event.target.dataset.id;
        const originalValue = parseFloat(event.target.dataset.originalValue);
        const newValue = parseFloat(parseFloat(event.target.value).toFixed(1));

        // Note: Process may have pending approval (shown with badge), but users can still edit it
        // The badge provides visibility that there's a pending change, but doesn't block new modifications

        console.log('Slider changed - Process ID:', processId, 'Original:', originalValue, 'New:', newValue);

        // Track the modification
        if (newValue !== originalValue) {
            this.modifiedProcesses.set(processId, {
                processId: processId,
                originalValue: originalValue,
                newValue: newValue
            });
        } else {
            this.modifiedProcesses.delete(processId);
        }

        // Update in allLocationProcesses to persist across location changes
        const allProcessIndex = this.allLocationProcesses.findIndex(p => p.id === processId);
        if (allProcessIndex !== -1) {
            // Create a new object to trigger reactivity
            this.allLocationProcesses = this.allLocationProcesses.map((proc, index) => {
                if (index === allProcessIndex) {
                    return {
                        ...proc,
                        completedPercent: newValue,
                        previousPercent: originalValue,
                        todayPercent: Math.max(0, newValue - originalValue),
                        remainingPercent: Math.max(0, 100 - newValue)
                    };
                }
                return proc;
            });
        }

        // Update in locationProcesses for current display
        const processIndex = this.locationProcesses.findIndex(p => p.id === processId);
        if (processIndex !== -1) {
            this.locationProcesses = this.locationProcesses.map((proc, index) => {
                if (index === processIndex) {
                    return {
                        ...proc,
                        completedPercent: newValue,
                        previousPercent: originalValue,
                        todayPercent: Math.max(0, newValue - originalValue),
                        remainingPercent: Math.max(0, 100 - newValue)
                    };
                }
                return proc;
            });

            // Rebuild grouped processes
            this.groupProcessesByLocation();
        }

        // Update visual feedback
        this.handleSliderInput(event);
        this.applySliderHighlighting(processId, newValue !== originalValue);
    }

    applySliderHighlighting(processId, isModified) {
        setTimeout(() => {
            const slider = this.template.querySelector(`[data-process-id="${processId}"]`);
            if (slider) {
                const sliderContainer = slider.closest('.location-slider-container');
                if (sliderContainer) {
                    if (isModified) {
                        sliderContainer.classList.add('modified-field');
                    } else {
                        sliderContainer.classList.remove('modified-field');
                    }
                }
            }
        }, 0);
    }

    findProcessById(processId) {
        for (let group of this.groupedLocationProcesses) {
            const proc = group.processes.find(p => p.id === processId);
            if (proc) return proc;
        }
        return null;
    }

    // Step 4: Gallery - Lightning File Upload
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
                    await deleteContentDocuments({ contentDocumentIds: docIdsToDelete });
                }
                return;
            }

            const uploadedFilesFromEvent = event.detail.files;
            uploadedFilesFromEvent.forEach(file => {
                const fileType = this.getFileType(file.name);
                this.uploadedFiles.push({
                    id: file.documentId,
                    name: file.name,
                    url: `/sfc/servlet.shepherd/document/download/${file.documentId}`,
                    fileType: fileType,
                    isImage: fileType === 'image',
                    icon: this.getFileIcon(file.name)
                });
            });

            // Force UI update
            this.uploadedFiles = [...this.uploadedFiles];

            // Show storage warning if approaching limit
            if (storageCheck.percentUsed > 90) {
                this.showToast('Warning', storageCheck.message, 'warning');
            } else {
                this.showToast('Success', `${uploadedFilesFromEvent.length} file(s) uploaded successfully`, 'success');
            }
        } catch (error) {
            console.error('Error in handleUploadFinished :: ', error);
            this.showToast('Error', 'Failed to upload files: ' + (error.body?.message || error.message), 'error');
        }
    }

    getFileType(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'];
        const documentExtensions = ['pdf', 'doc', 'docx'];

        if (imageExtensions.includes(extension)) {
            return 'image';
        } else if (documentExtensions.includes(extension)) {
            return 'document';
        }
        return 'file';
    }

    getFileIcon(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();

        switch (extension) {
            case 'pdf':
                return 'doctype:pdf';
            case 'doc':
            case 'docx':
                return 'doctype:word';
            default:
                return 'doctype:attachment';
        }
    }

    async handleRemoveFile(event) {
        const fileId = event.currentTarget.dataset.id;
        this.isLoading = true;
        // Find the file to check if it's a camera photo
        const fileToRemove = this.uploadedFiles.find(file => file.id === fileId);

        try {
            // Only delete from Salesforce if it's not a camera photo or chatter file
            // Camera photos and chatter files are not yet saved to Salesforce
            if (!fileToRemove?.isCamera && !fileToRemove?.isChatter) {
                await deleteContentDocuments({ contentDocumentIds: [fileId] });
            }

            // Remove from local array
            this.uploadedFiles = this.uploadedFiles.filter(file => file.id !== fileId);

            this.showToast('Success', 'File removed successfully', 'success');
        } catch (error) {
            console.error('Error removing file:', error);
            this.showToast('Error', 'Failed to remove file: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // Upload Options Handlers
    handleChooseFromChatter() {
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
                jobId: this.jobId,
                daysOffset: this.chatterDaysOffset
            });

            // Check if there are more items
            this.hasMoreChatterItems = result && result.hasMore;

            if (result && result.feedItems && Array.isArray(result.feedItems) && result.feedItems.length > 0) {
                // Get set of already uploaded content document IDs
                const uploadedContentDocIds = new Set(
                    this.uploadedFiles
                        .filter(file => file.isChatter)
                        .map(file => file.id)
                );

                const formattedItems = result.feedItems.map(item => ({
                    id: item.id,
                    body: item.body || '',
                    formattedDate: this.formatChatterDate(item.createdDate),
                    attachments: item.attachments.map(att => {
                        const isAlreadyUploaded = uploadedContentDocIds.has(att.contentDocumentId);
                        return {
                            id: att.id,
                            title: att.title,
                            contentDocumentId: att.contentDocumentId,
                            isImage: att.isImage || false,
                            thumbnailUrl: att.thumbnailUrl || '',
                            selected: false,
                            alreadyUploaded: isAlreadyUploaded,
                            cardClass: isAlreadyUploaded ? 'attachment-card disabled' : 'attachment-card'
                        };
                    })
                }));

                if (this.chatterDaysOffset === 0) {
                    this.chatterFeedItems = formattedItems;
                } else {
                    this.chatterFeedItems = [...this.chatterFeedItems, ...formattedItems];
                }
            } else {
                if (this.chatterDaysOffset === 0) {
                    this.chatterFeedItems = [];
                }
            }
        } catch (error) {
            console.error('Error loading chatter feed items:', error);
            console.error('Error details:', error.body?.message || error.message);
            this.showToast('Error', 'Failed to load chatter posts: ' + (error.body?.message || error.message), 'error');
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

        // Find the attachment to check if it's already uploaded
        let isAlreadyUploaded = false;
        for (let feedItem of this.chatterFeedItems) {
            const attachment = feedItem.attachments.find(att => att.id === attachmentId);
            if (attachment && attachment.alreadyUploaded) {
                isAlreadyUploaded = true;
                break;
            }
        }

        // Don't allow selection of already uploaded files
        if (isAlreadyUploaded) {
            this.showToast('Info', 'This file is already added', 'info');
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
            feedItem.attachments.forEach(attachment => {
                if (attachment.selected && !attachment.alreadyUploaded) {
                    selectedAttachments.push(attachment);
                }
            });
        });

        if (selectedAttachments.length === 0) {
            return;
        }

        // Add selected attachments to uploaded files
        selectedAttachments.forEach(attachment => {
            const fileType = attachment.isImage ? 'image' : 'document';
            this.uploadedFiles.push({
                id: attachment.contentDocumentId,
                name: attachment.title,
                url: attachment.isImage ? attachment.thumbnailUrl : `/sfc/servlet.shepherd/document/download/${attachment.contentDocumentId}`,
                fileType: fileType,
                isImage: attachment.isImage,
                isChatter: true, // Mark as from Chatter
                icon: this.getFileIcon(attachment.title)
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
                        facingMode: 'user',
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

        if (videoElement && canvasElement) {
            const context = canvasElement.getContext('2d');
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            context.drawImage(videoElement, 0, 0);

            // Get image data URL
            this.capturedPhoto = canvasElement.toDataURL('image/jpeg', 0.8);

            // Stop camera stream after capturing
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(track => track.stop());
                this.cameraStream = null;
            }
        }
    }

    handleRetakePhoto() {
        this.capturedPhoto = null;
        // Restart camera after clearing captured photo
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
            if (fileSizeInMB > 4) {
                this.showToast('Error', 'Photo size exceeds 4MB limit. Please try again with lower quality.', 'error');
                return;
            }

            // Create file name
            const fileName = `Camera_${new Date().getTime()}.jpg`;

            // Store temporarily in uploaded files list (will be saved on final submit)
            this.uploadedFiles.push({
                id: `temp_${new Date().getTime()}`, // Temporary ID
                name: fileName,
                url: this.capturedPhoto, // Use base64 URL for preview
                fileType: 'image',
                isImage: true,
                icon: 'doctype:image',
                isCamera: true, // Flag to identify camera photos
                base64Data: base64Data // Store base64 for later upload
            });

            this.closeCameraModal();
            this.showToast('Success', 'Photo captured successfully. It will be saved when you complete the log entry.', 'success');
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

    get hasUploadedFiles() {
        return this.uploadedFiles && this.uploadedFiles.length > 0;
    }

    // Navigation
    handleNext() {
        if (this.currentStep === 'step1') {
            if (!this.selectedMobilizationId) {
                this.showToast('Error', 'Please select a mobilization', 'error');
                return;
            }

            // Check if there are any crew members
            if (!this.crewMembers || this.crewMembers.length === 0) {
                this.showToast('Error', 'No crew members found for the selected mobilization', 'error');
                return;
            }

            // Validate that at least one crew member has clock in and clock out
            const hasAtLeastOneEntry = this.crewMembers.some(member => {
                return member.recentClockIn && member.recentClockOut;
            });

            if (!hasAtLeastOneEntry) {
                this.showToast('Error', 'At least one crew member must have a clock in and clock out before proceeding', 'error');
                return;
            }

            this.currentStep = 'step2';
            this.loadTimesheetEntries();
        } else if (this.currentStep === 'step2') {
            this.currentStep = 'step3';
        } else if (this.currentStep === 'step3') {
            // Check for unsaved progress bar changes
            if (this.hasModifications) {
                this.showToast('Warning', 'Please save or discard your progress changes before proceeding', 'warning');
                return;
            }
            if (!this.step3Data.whatWeDone?.trim() || !this.step3Data.planForTomorrow?.trim()) {
                this.showToast('Error', 'Please fill required fields', 'error');
                return;
            }
            this.currentStep = 'step4';
        }
    }

    handlePrevious() {
        if (this.currentStep === 'step2') {
            this.currentStep = 'step1';
        } else if (this.currentStep === 'step3') {
            this.currentStep = 'step2';
        } else if (this.currentStep === 'step4') {
            this.currentStep = 'step3';
        }
    }

    async handleDone() {
        this.isLoading = true;

        try {
            // Prepare step3 data with trimmed values
            const step3DataToSave = {
                whatWeDone: this.step3Data.whatWeDone?.trim(),
                planForTomorrow: this.step3Data.planForTomorrow?.trim(),
                exceptions: this.step3Data.exceptions?.trim(),
                notesToOffice: this.step3Data.notesToOffice?.trim()
            };

            // Separate camera photos, chatter files, and regular uploaded files
            const cameraPhotos = this.uploadedFiles.filter(file => file.isCamera);
            const chatterFiles = this.uploadedFiles.filter(file => file.isChatter);
            const regularFiles = this.uploadedFiles.filter(file => !file.isCamera && !file.isChatter);

            // Get ContentDocument IDs from regular uploaded files and chatter files
            const fileIds = [...regularFiles.map(file => file.id), ...chatterFiles.map(file => file.id)];

            // Prepare camera photos data
            const cameraPhotosData = cameraPhotos.map(photo => ({
                fileName: photo.name,
                base64Data: photo.base64Data
            }));

            // Build new approval data structure with locationProcessChanges and timesheetEntryChanges
            let approvalDataJson = null;

            // Build locationProcessChanges array
            const locationProcessChanges = Array.from(this.modifiedProcesses.entries()).map(([processId, modification]) => {
                // Find the process to get its name
                const process = this.allLocationProcesses.find(p => p.processId === processId);
                return {
                    id: processId,
                    oldValue: modification.originalValue,
                    newValue: modification.newValue,
                    name: process ? process.processName : 'Unknown'
                };
            });

            // Build timesheetEntryChanges object from local pending edits
            const timesheetEntryChanges = {};

            this.localPendingEdits.forEach((editData, itemId) => {
                timesheetEntryChanges[editData.TSEId] = {
                    changes: editData.changes,
                    contactId: editData.contactId,
                    contactName: editData.contactName
                };
            });

            // Build media metadata with source info for all files
            const mediaMetadata = [];

            // Add regular uploaded files
            regularFiles.forEach(file => {
                mediaMetadata.push({
                    contentDocumentId: file.id,
                    source: 'upload',
                    name: file.name
                });
            });

            // Add chatter files
            chatterFiles.forEach(file => {
                mediaMetadata.push({
                    contentDocumentId: file.id,
                    source: 'chatter',
                    name: file.name
                });
            });

            // Camera photos will be added after creation with source 'camera'

            // Build the new structure only if there are changes
            if (locationProcessChanges.length > 0 || Object.keys(timesheetEntryChanges).length > 0 || mediaMetadata.length > 0 || cameraPhotos.length > 0) {
                const approvalDataStructure = {
                    locationProcessChanges: locationProcessChanges,
                    timesheetEntryChanges: timesheetEntryChanges,
                    uploadedContentDocumentIds: chatterFiles.map(file => file.id), // Track Chatter files for preventing re-selection in edit mode
                    mediaMetadata: mediaMetadata // Track all media with source info
                };

                approvalDataJson = JSON.stringify(approvalDataStructure);
            }

            // Get the selected mobilization date
            const selectedMobOption = this.mobilizationOptions.find(opt => opt.value === this.selectedMobilizationId);
            const workPerformedDate = selectedMobOption ? selectedMobOption.dateStr : new Date().toISOString().substring(0, 10);

            // Create Log Entry record with files, camera photos, mobilization ID, and approval data
            // Status will be determined in Apex based on yesterday's approval and today's pending logs
            await createLogEntry({
                jobId: this.jobId,
                step3DataJson: JSON.stringify(step3DataToSave),
                contentDocumentIds: fileIds,
                cameraPhotosJson: JSON.stringify(cameraPhotosData),
                workPerformedDate: workPerformedDate,
                approvalDataJson: approvalDataJson,
                mobilizationId: this.selectedMobilizationId
            });

            this.showToast('Success', 'Shift End Log created successfully', 'success');
            this.dispatchEvent(new CustomEvent('close', {
                detail: { isRecordCreated: true }
            }));
        } catch (error) {
            console.error('Error creating log entry:', error);
            this.showToast('Error', 'Failed to create Shift End Log: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleDialogueClose() {
        // Delete only regular uploaded files if user cancels without saving
        // Camera photos and chatter files are not saved yet, so no need to delete them
        const regularFiles = this.uploadedFiles.filter(file => !file.isCamera && !file.isChatter);
        const fileIds = regularFiles.map(file => file.id);

        if (fileIds.length > 0) {
            try {
                await deleteContentDocuments({ contentDocumentIds: fileIds });
            } catch (error) {
                console.error('Error deleting files:', error);
            }
        }
        this.dispatchEvent(new CustomEvent('close', {
            detail: { isRecordCreated: false }
        }));
    }

    // Utility Methods
    parseLiteral(iso) {
        if (!iso) return '--';
        return iso.slice(0, 16).replace('T', ' ');
    }

    extractDateKey(value) {
        if (!value) return null;
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        const str = value.toString().trim();
        if (!str || str.length < 10) return null;
        return str.slice(0, 10);
    }

    addDaysToDateKey(dateKey, days) {
        if (!dateKey || typeof dateKey !== 'string') return null;
        const [year, month, day] = dateKey.split('-').map(Number);
        if ([year, month, day].some(num => Number.isNaN(num))) return null;
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        utcDate.setUTCDate(utcDate.getUTCDate() + days);
        return utcDate.toISOString().slice(0, 10);
    }

    validateClockInDate(clockInValue, jobStartValue) {
        const clockInDate = this.extractDateKey(clockInValue);
        const jobStartDate = this.extractDateKey(jobStartValue);
        if (clockInDate && jobStartDate && clockInDate !== jobStartDate) {
            this.showToast('Error', 'Clock In time must be on the job start date', 'error');
            return false;
        }
        return true;
    }

    validateClockOutDate(clockOutValue, jobStartValue, jobEndValue) {
        const clockOutDate = this.extractDateKey(clockOutValue);
        const jobStartDate = this.extractDateKey(jobStartValue);
        const jobEndDate = this.extractDateKey(jobEndValue);

        if (clockOutDate && jobEndDate) {
            const nextDay = this.addDaysToDateKey(jobEndDate, 1);
            if (clockOutDate !== jobStartDate && clockOutDate !== jobEndDate && clockOutDate !== nextDay) {
                this.showToast('Error', 'Clock Out time must be on the job start date, job end date, or the following day', 'error');
                return false;
            }
        }
        return true;
    }

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

    calculateWorkHours(clockInStr, clockOutStr) {
        try {
            if (!clockInStr || !clockOutStr) return 0;

            // Parse datetime strings (format: "YYYY-MM-DD HH:MM")
            const clockIn = new Date(clockInStr.replace(' ', 'T'));
            const clockOut = new Date(clockOutStr.replace(' ', 'T'));

            if (isNaN(clockIn.getTime()) || isNaN(clockOut.getTime())) return 0;

            // Calculate difference in hours
            const diffMs = clockOut - clockIn;
            const diffHours = diffMs / (1000 * 60 * 60);

            return diffHours > 0 ? diffHours : 0;
        } catch (error) {
            console.error('Error calculating work hours:', error);
            return 0;
        }
    }

    parseApprovalData(approvalDataJson) {
        if (!approvalDataJson) return [];

        try {
            const approvalData = JSON.parse(approvalDataJson);
            return approvalData.map(change => {
                let fieldLabel = change.fieldApiName;
                if (fieldLabel === 'Clock_In_Time__c') fieldLabel = 'Clock In';
                else if (fieldLabel === 'Clock_Out_Time__c') fieldLabel = 'Clock Out';
                else if (fieldLabel === 'Travel_Time__c') fieldLabel = 'Travel Time';

                let oldVal = change.oldValue;
                let newVal = change.newValue;

                // Process values based on field type
                if (fieldLabel === 'Clock In' || fieldLabel === 'Clock Out') {
                    // Keep ISO format for internal processing, formatting happens at display time
                    oldVal = oldVal || '';
                    newVal = newVal || '';
                } else if (fieldLabel === 'Travel Time') {
                    oldVal = oldVal ? parseFloat(oldVal).toFixed(2) : '0.00';
                    newVal = newVal ? parseFloat(newVal).toFixed(2) : '0.00';
                }

                return {
                    fieldLabel,
                    oldValue: oldVal || '--',
                    newValue: newVal || '--'
                };
            });
        } catch (error) {
            console.error('Error parsing approval data:', error);
            return [];
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}