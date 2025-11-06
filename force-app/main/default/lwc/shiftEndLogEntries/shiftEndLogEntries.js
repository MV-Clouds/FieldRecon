import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getMobilizationList from '@salesforce/apex/ShiftEndLogEntriesController.getMobilizationList';
import getMobilizationMembersWithStatus from '@salesforce/apex/ShiftEndLogEntriesController.getMobilizationMembersWithStatus';
import createTimesheetRecords from '@salesforce/apex/ShiftEndLogEntriesController.createTimesheetRecords';
import getTimeSheetEntryItems from '@salesforce/apex/ShiftEndLogEntriesController.getTimeSheetEntryItems';
import updateTimesheets from '@salesforce/apex/ShiftEndLogEntriesController.updateTimesheets';
import getJobLocationProcesses from '@salesforce/apex/SovJobLocationProcessesController.getJobLocationProcesses';
import batchUpdateProcessCompletion from '@salesforce/apex/SovJobLocationProcessesController.batchUpdateProcessCompletion';
import createLogEntry from '@salesforce/apex/ShiftEndLogEntriesController.createLogEntry';
import deleteContentDocuments from '@salesforce/apex/ShiftEndLogEntriesController.deleteContentDocuments';
import uploadCameraPhoto from '@salesforce/apex/ShiftEndLogEntriesController.uploadCameraPhoto';

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
    @track step3Data = {
        whatWeDone: '',
        planForTomorrow: '',
        exceptions: '',
        notesToOffice: ''
    };
    @track locationProcesses = [];
    @track groupedLocationProcesses = [];
    @track modifiedProcesses = new Map();
    @track hasModifications = false;
    @track isSaving = false;
    @track uploadedFiles = [];

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

    // Edit Timesheet Modal
    @track showEditTimesheetModal = false;
    @track editTimesheetData = {};

    // Camera Modal
    @track showCameraModal = false;
    @track cameraStream = null;
    @track capturedPhoto = null;

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

    get hasTimesheetEntries() {
        return this.timesheetEntries && this.timesheetEntries.length > 0;
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

    connectedCallback() {
        console.log('jobId -> ', this.jobId);
        console.log('crewLeaderId -> ', this.crewLeaderId);
        console.log('crewIds -> ', this.crewIds);

        this.loadMobilizationList();
        this.loadLocationProcesses();
    }

    renderedCallback() {
        // Apply slider styles manually in DOM for dynamic progress bars
        if (this.isStep3 && this.groupedLocationProcesses.length > 0) {
            this.updateSliderStyles();
            this.updateRowHighlighting();
        }
    }

    updateSliderStyles() {
        // Update slider visual styles based on completion percentages
        this.groupedLocationProcesses.forEach(locationGroup => {
            locationGroup.processes.forEach(proc => {
                const slider = this.template.querySelector(`[data-process-id="${proc.id}"]`);
                if (slider) {
                    const sliderTrack = slider.closest('.slider-wrapper')?.querySelector('.slider-track');
                    if (sliderTrack) {
                        const completed = sliderTrack.querySelector('.completed');
                        const today = sliderTrack.querySelector('.today');
                        const remaining = sliderTrack.querySelector('.remaining');

                        if (completed && today && remaining) {
                            completed.style.width = `${proc.previousPercent}%`;
                            today.style.width = `${proc.todayPercent}%`;
                            remaining.style.width = `${proc.remainingPercent}%`;
                        }
                    }

                    // Position slider to start at previousPercent
                    const sliderWidth = 100 - proc.previousPercent;
                    slider.style.left = `${proc.previousPercent}%`;
                    slider.style.width = `${sliderWidth}%`;

                    // Disable slider if 100% complete
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
        this.isLoading = true;
        getMobilizationList({ jobId: this.jobId })
            .then(result => {
                if (result) {
                    this.mobilizationOptions = Object.keys(result).map(key => ({
                        label: result[key],
                        value: key
                    }));

                    // Auto-select today's date mobilization if available
                    const today = new Date().toISOString().split('T')[0];
                    const todayMob = this.mobilizationOptions.find(mob =>
                        mob.label.includes(today)
                    );
                    if (todayMob) {
                        this.selectedMobilizationId = todayMob.value;
                        this.loadCrewMembers();
                    }
                }
            })
            .catch(error => {
                console.error('Error loading mobilizations:', error);
                this.showToast('Error', 'Failed to load mobilizations', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleMobilizationChange(event) {
        this.selectedMobilizationId = event.detail.value;
        if (this.selectedMobilizationId) {
            this.loadCrewMembers();
        }
    }

    loadCrewMembers() {
        this.isLoading = true;
        getMobilizationMembersWithStatus({
            mobId: this.selectedMobilizationId,
            jobId: this.jobId
        })
            .then(result => {
                if (result) {
                    // Process clock in members
                    const clockInList = result.clockIn || [];
                    const clockOutList = result.clockOut || [];

                    // Combine and process all members
                    const allMembers = new Map();

                    clockInList.forEach(member => {
                        allMembers.set(member.contactId, {
                            contactId: member.contactId,
                            contactName: member.contactName,
                            canClockIn: true,
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
                            recentClockIn: member.recentClockIn ? this.formatDateTime(member.recentClockIn) : null,
                            recentClockOut: member.recentClockOut ? this.formatDateTime(member.recentClockOut) : null,
                            hasRecentTimes: !!(member.recentClockIn || member.recentClockOut)
                        });
                    });

                    clockOutList.forEach(member => {
                        allMembers.set(member.contactId, {
                            contactId: member.contactId,
                            contactName: member.contactName,
                            canClockIn: false,
                            canClockOut: true,
                            statusText: 'Clocked In',
                            statusClass: 'status-clocked-in',
                            hoursWorked: this.calculateHours(member.clockInTime),
                            clockInTime: member.clockInTime,
                            jobStartTime: member.jobStartTime,
                            jobEndTime: member.jobEndTime,
                            timesheetId: member.timesheetId,
                            isTimesheetNull: member.isTimesheetNull,
                            isTimesheetEntryNull: member.isTimesheetEntryNull,
                            timesheetEntryId: member.timesheetEntryId,
                            mobMemberId: member.mobMemberId,
                            recentClockIn: member.clockInTime ? this.formatDateTime(member.clockInTime) : null,
                            recentClockOut: member.recentClockOut ? this.formatDateTime(member.recentClockOut) : null,
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

    calculateHours(clockInTime) {
        if (!clockInTime) return null;
        const now = new Date();
        const clockIn = new Date(clockInTime);
        const diffMs = now - clockIn;
        const diffHrs = diffMs / (1000 * 60 * 60);
        return diffHrs > 0 ? diffHrs.toFixed(2) : '0.00';
    }

    handleClockInClick(event) {
        const contactId = event.currentTarget.dataset.id;
        const member = this.crewMembers.find(m => m.contactId === contactId);

        if (member) {
            this.selectedContactId = contactId;
            this.clockInTime = member.jobStartTime ? member.jobStartTime.slice(0, 16) : new Date().toISOString().slice(0, 16);
            this.showClockInModal = true;
        }
    }

    handleClockOutClick(event) {
        const contactId = event.currentTarget.dataset.id;
        const member = this.crewMembers.find(m => m.contactId === contactId);

        if (member) {
            this.selectedContactId = contactId;
            this.clockOutTime = member.jobEndTime ? member.jobEndTime.slice(0, 16) : new Date().toISOString().slice(0, 16);
            this.previousClockInTime = member.clockInTime ? member.clockInTime.slice(0, 16).replace('T', ' ') : null;
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
            timesheetEntryId: member.timesheetEntryId,
            mobMemberId: member.mobMemberId
        };

        createTimesheetRecords({ params: JSON.stringify(params) })
            .then(result => {
                if (result) {
                    this.showToast('Success', 'Clocked In Successfully', 'success');
                    this.closeClockInModal();
                    this.loadCrewMembers();
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

        if (new Date(this.clockOutTime) <= new Date(member.clockInTime)) {
            this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
            return;
        }

        const jobEndReference = member.jobEndTime;
        if (!this.validateClockOutDate(this.clockOutTime, jobEndReference)) {
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
                    this.loadCrewMembers();
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
        this.showClockInModal = false;
        this.selectedContactId = null;
        this.selectedCostCodeId = null;
        this.clockInTime = null;
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

        getTimeSheetEntryItems({ jobId: this.jobId, jobStartDate: jobStartDate })
            .then(result => {
                if (result) {
                    this.timesheetEntries = result.map((entry, index) => ({
                        id: entry.id,
                        srNo: index + 1,
                        contactName: entry.contactName,
                        clockInTime: this.parseLiteral(entry.clockInTime),
                        clockOutTime: this.parseLiteral(entry.clockOutTime),
                        workHours: entry.workHours ? entry.workHours.toFixed(2) : '0.00',
                        travelTime: entry.travelTime ? entry.travelTime.toFixed(2) : '0.00',
                        costCodeName: entry.costCodeName || '--',
                        TSEId: entry.TSEId,
                        rawClockIn: entry.clockInTime,
                        rawClockOut: entry.clockOutTime
                    }));

                    // Sort timesheet entries by contact name in ascending order
                    this.timesheetEntries.sort((a, b) => {
                        const nameA = a.contactName ? a.contactName.toLowerCase() : '';
                        const nameB = b.contactName ? b.contactName.toLowerCase() : '';
                        return nameA.localeCompare(nameB);
                    });

                    // Update serial numbers after sorting
                    this.timesheetEntries = this.timesheetEntries.map((entry, index) => ({
                        ...entry,
                        srNo: index + 1
                    }));
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
            this.editTimesheetData = {
                id: entry.id,
                TSEId: entry.TSEId,
                clockInTime: entry.rawClockIn ? entry.rawClockIn.slice(0, 16) : '',
                clockOutTime: entry.rawClockOut ? entry.rawClockOut.slice(0, 16) : '',
                travelTime: entry.travelTime
            };
            this.showEditTimesheetModal = true;
        }
    }

    handleEditInputChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;

        if (field === 'editClockIn') {
            this.editTimesheetData.clockInTime = value;
        } else if (field === 'editClockOut') {
            this.editTimesheetData.clockOutTime = value;
        } else if (field === 'editTravelTime') {
            this.editTimesheetData.travelTime = value;
        }
    }

    saveEditedTimesheet() {
        if (!this.editTimesheetData.clockInTime || !this.editTimesheetData.clockOutTime) {
            this.showToast('Error', 'Clock In and Clock Out times are required', 'error');
            return;
        }

        if (new Date(this.editTimesheetData.clockOutTime) <= new Date(this.editTimesheetData.clockInTime)) {
            this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
            return;
        }

        this.isLoading = true;

        const params = {
            Id: this.editTimesheetData.id,
            TSEId: this.editTimesheetData.TSEId,
            ClockIn: this.editTimesheetData.clockInTime,
            ClockOut: this.editTimesheetData.clockOutTime,
            TravelTime: this.editTimesheetData.travelTime || '0.00'
        };

        const stringifiedEntry = JSON.stringify(
            Object.fromEntries(
                Object.entries(params).map(([key, value]) => [key, String(value)])
            )
        );

        updateTimesheets({ params: stringifiedEntry })
            .then(result => {
                if (result) {
                    this.showToast('Success', 'Timesheet updated successfully', 'success');
                    this.closeEditTimesheetModal();
                    this.loadTimesheetEntries();
                } else {
                    this.showToast('Error', 'Failed to update timesheet', 'error');
                }
            })
            .catch(error => {
                console.error('Error updating timesheet:', error);
                this.showToast('Error', 'Something went wrong', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    closeEditTimesheetModal() {
        this.showEditTimesheetModal = false;
        this.editTimesheetData = {};
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
                if (result && result.length > 0) {
                    this.locationProcesses = result.map(proc => {
                        const prevPercent = parseFloat(proc.wfrecon__Completed_Percentage__c || 0);
                        return {
                            id: proc.Id,
                            name: proc.Name,
                            locationId: proc.wfrecon__Location__c,
                            locationName: proc.wfrecon__Location__r?.Name || 'Unknown Location',
                            sequence: proc.wfrecon__Sequence__c,
                            previousPercent: parseFloat(prevPercent.toFixed(1)),
                            completedPercent: parseFloat(prevPercent.toFixed(1)),
                            todayPercent: 0,
                            remainingPercent: parseFloat((100 - prevPercent).toFixed(1))
                        };
                    });
                    this.groupProcessesByLocation();
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

    groupProcessesByLocation() {
        // Group processes by location
        const locationMap = new Map();

        this.locationProcesses.forEach(proc => {
            if (!locationMap.has(proc.locationId)) {
                locationMap.set(proc.locationId, {
                    locationId: proc.locationId,
                    locationName: proc.locationName,
                    processes: []
                });
            }
            locationMap.get(proc.locationId).processes.push(proc);
        });

        this.groupedLocationProcesses = Array.from(locationMap.values());
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
                    const today = sliderTrack.querySelector('.today');
                    const remaining = sliderTrack.querySelector('.remaining');

                    if (completed && today && remaining) {
                        completed.style.width = `${proc.previousPercent}%`;
                        today.style.width = `${todayPercent}%`;
                        remaining.style.width = `${remainingPercent}%`;
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

        // Track the modification
        if (newValue !== originalValue) {
            this.modifiedProcesses.set(processId, {
                originalValue: originalValue,
                newValue: newValue
            });

            // Update process in local array
            const proc = this.findProcessById(processId);
            if (proc) {
                proc.completedPercent = newValue;
                proc.todayPercent = parseFloat((newValue - proc.previousPercent).toFixed(1));
                proc.remainingPercent = parseFloat((100 - newValue).toFixed(1));
            }
        } else {
            this.modifiedProcesses.delete(processId);
        }

        this.hasModifications = this.modifiedProcesses.size > 0;

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

    handleSaveProcessChanges() {
        if (this.modifiedProcesses.size === 0) return;

        this.isSaving = true;

        const processUpdates = Array.from(this.modifiedProcesses.entries()).map(([processId, modification]) => ({
            processId: processId,
            completionPercentage: modification.newValue
        }));

        batchUpdateProcessCompletion({ processUpdates: processUpdates })
            .then(result => {
                if (result.isSuccess) {
                    this.showToast('Success', `Successfully updated ${result.successCount} process${result.successCount !== 1 ? 'es' : ''}`, 'success');
                    this.modifiedProcesses.clear();
                    this.hasModifications = false;
                    this.clearAllHighlighting();
                    this.loadLocationProcesses();
                } else {
                    this.showToast('Error', result.message || 'Failed to update some processes', 'error');
                    if (result.successCount > 0) {
                        this.modifiedProcesses.clear();
                        this.hasModifications = false;
                        this.clearAllHighlighting();
                        this.loadLocationProcesses();
                    }
                }
            })
            .catch(error => {
                console.error('Error saving process changes:', error);
                this.showToast('Error', 'Unable to save changes. Please try again.', 'error');
            })
            .finally(() => {
                this.isSaving = false;
            });
    }

    handleDiscardProcessChanges() {
        // Reset all sliders to original values
        this.modifiedProcesses.forEach((modification, processId) => {
            const slider = this.template.querySelector(`[data-process-id="${processId}"]`);
            if (slider) {
                slider.value = modification.originalValue;

                const proc = this.findProcessById(processId);
                if (proc) {
                    proc.completedPercent = parseFloat(modification.originalValue.toFixed(1));
                    proc.todayPercent = parseFloat((modification.originalValue - proc.previousPercent).toFixed(1));
                    proc.remainingPercent = parseFloat((100 - modification.originalValue).toFixed(1));
                }
            }
        });

        this.modifiedProcesses.clear();
        this.hasModifications = false;
        this.clearAllHighlighting();
        this.updateSliderStyles();
        this.showToast('Success', 'All changes have been discarded', 'success');
    }

    clearAllHighlighting() {
        setTimeout(() => {
            const allContainers = this.template.querySelectorAll('.location-slider-container.modified-field');
            allContainers.forEach(container => {
                container.classList.remove('modified-field');
            });
        }, 0);
    }

    // Step 4: Gallery - Lightning File Upload
    handleUploadFinished(event) {
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
        this.showToast('Success', `${uploadedFilesFromEvent.length} file(s) uploaded successfully`, 'success');
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
        
        switch(extension) {
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
        
        // Find the file to check if it's a camera photo
        const fileToRemove = this.uploadedFiles.find(file => file.id === fileId);
        
        try {
            // Only delete from Salesforce if it's not a camera photo
            // Camera photos are not yet saved to Salesforce
            if (!fileToRemove?.isCamera) {
                await deleteContentDocuments({ contentDocumentIds: [fileId] });
            }
            
            // Remove from local array
            this.uploadedFiles = this.uploadedFiles.filter(file => file.id !== fileId);
            
            this.showToast('Success', 'File removed successfully', 'success');
        } catch (error) {
            console.error('Error removing file:', error);
            this.showToast('Error', 'Failed to remove file: ' + (error.body?.message || error.message), 'error');
        }
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
        }
    }

    handleRetakePhoto() {
        this.capturedPhoto = null;
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
            
            // Validate that all crew members have at least one clock in and clock out
            const allClockedOut = this.crewMembers.every(member => {
                // Check if member has recent clock in and clock out times
                return member.recentClockIn && member.recentClockOut;
            });
            
            if (!allClockedOut) {
                this.showToast('Error', 'All crew members must have at least one clock in and clock out before proceeding', 'error');
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
            // Check for unsaved progress bar changes
            if (this.hasModifications) {
                this.showToast('Warning', 'Please save or discard your progress changes before going back', 'warning');
                return;
            }
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

            // Separate camera photos and regular uploaded files
            const cameraPhotos = this.uploadedFiles.filter(file => file.isCamera);
            const regularFiles = this.uploadedFiles.filter(file => !file.isCamera);

            // Get ContentDocument IDs from regular uploaded files
            const fileIds = regularFiles.map(file => file.id);

            // Prepare camera photos data
            const cameraPhotosData = cameraPhotos.map(photo => ({
                fileName: photo.name,
                base64Data: photo.base64Data
            }));

            // Create Log Entry record with files and camera photos in single call
            await createLogEntry({
                jobId: this.jobId,
                step3DataJson: JSON.stringify(step3DataToSave),
                contentDocumentIds: fileIds,
                cameraPhotosJson: JSON.stringify(cameraPhotosData),
                workPerformedDate: new Date().toISOString()
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
        // Camera photos are not saved yet, so no need to delete them
        const regularFiles = this.uploadedFiles.filter(file => !file.isCamera);
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

    validateClockOutDate(clockOutValue, jobEndValue) {
        const clockOutDate = this.extractDateKey(clockOutValue);
        const jobEndDate = this.extractDateKey(jobEndValue);
        if (clockOutDate && jobEndDate) {
            const nextDay = this.addDaysToDateKey(jobEndDate, 1);
            if (clockOutDate !== jobEndDate && clockOutDate !== nextDay) {
                this.showToast('Error', 'Clock Out time must be on the job end date or the following day', 'error');
                return false;
            }
        }
        return true;
    }

    formatDateTime(dateValue) {
        if (!dateValue) return '--';
        
        try {
            const iso = new Date(dateValue).toISOString();
            return iso.slice(0, 16).replace('T', ' ');
        } catch (error) {
            return '--';
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}