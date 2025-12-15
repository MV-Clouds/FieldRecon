import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getMobilizationMembers from '@salesforce/apex/HomeTabController.getMobilizationMembers';
import getTimeSheetEntryItems from '@salesforce/apex/HomeTabController.getTimeSheetEntryItems';
import createTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createTimesheetRecords';

export default class HomeTab extends NavigationMixin(LightningElement) {
    @track isMobileDevice = false;
    @track selectedDate;
    @track isLoading = false;
    @track activeSectionName = ['jobDetails', 'timesheetDetails'];
    @track activeTab = 'today';
    @track todayJobList = [];
    @track weekJobList = [];
    @track isTodayJobAvailable = false;
    @track isWeekJobAvailable = false;
    @track accordionStyleApplied = false;
    @track hasError = false;
    @track errorMessage = '';
    @track showClockInModal = false;
    @track showClockOutModal = false;
    @track costCodeOptions = [];
    @track clockInTime;
    @track clockOutTime;
    @track selectedContactId;
    @track selectedMobilizationId;
    @track selectedCostCodeId;
    @track previousClockInTime;
    @track currentWeekTravelTime;
    @track currentTotalWorkHours;
    @track timesheetDetailsRaw = [];
    @track currentModalJobStartDateTime;
    @track currentModalJobEndDateTime;
    
    // UPDATED: Removed Action Column for Desktop view as requested
    @track timesheetColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Job Number', fieldName: 'jobNumber', style: 'width: 10rem', isLink: true, recordIdField: 'jobId' },
        { label: 'Job Name', fieldName: 'jobName', style: 'width: 15rem' },
        { label: 'Clock In Time', fieldName: 'clockInTime', style: 'width: 12rem' },
        { label: 'Clock Out Time', fieldName: 'clockOutTime', style: 'width: 12rem' },
        { label: 'Work Hours', fieldName: 'workHours', style: 'width: 6rem' },
        { label: 'Travel Time', fieldName: 'travelTime', style: 'width: 6rem' },
        { label: 'Total Time', fieldName: 'totalTime', style: 'width: 6rem' },
        { label: 'Cost Code', fieldName: 'costCodeName', style: 'width: 10rem' }
    ];

    get apexFormattedDate() {
        const start = this.normalizeDate(new Date(this.selectedDate));
        let currentDate = start.toLocaleDateString('en-CA');
        return currentDate;
    }

    get isTodayTabActive() {
        return this.activeTab === 'today';
    }

    get isWeekTabActive() {
        return this.activeTab === 'week';
    }

    get todayTabClass() {
        return this.activeTab === 'today' ? 'active' : '';
    }

    get weekTabClass() {
        return this.activeTab === 'week' ? 'active' : '';
    }

    // ... (Existing helper methods like extractDateKey, addDaysToDateKey remain unchanged) ...
    extractDateKey(value) {
        if (!value) return null;
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        const str = value.toString().trim();
        if (!str) return null;
        if (str.length >= 10) return str.slice(0, 10);
        return null;
    }

    addDaysToDateKey(dateKey, days) {
        if (!dateKey || typeof dateKey !== 'string') return null;
        const [year, month, day] = dateKey.split('-').map(Number);
        if ([year, month, day].some(num => Number.isNaN(num))) return null;
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        utcDate.setUTCDate(utcDate.getUTCDate() + days);
        return utcDate.toISOString().slice(0, 10);
    }
    // ... (Validation methods validateClockInDate, etc. remain unchanged) ...
    validateClockInDate(clockInValue, jobStartValue, jobEndValue) {
        const clockInDate = this.extractDateKey(clockInValue);
        const jobStartDate = this.extractDateKey(jobStartValue);
        const jobEndDate = this.extractDateKey(jobEndValue);
        if (clockInDate && jobStartDate) {
            if (clockInDate !== jobStartDate && clockInDate !== jobEndDate) {
                this.showToast('Error', 'Clock In time must be on the job start date or job end date', 'error');
                return false;
            }
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

    getCurrentModalJobRecord() {
        if (!this.selectedMobilizationId || !Array.isArray(this.todayJobList)) {
            return null;
        }
        return this.todayJobList.find(job => job.mobId === this.selectedMobilizationId);
    }

    get clockInMinBoundary() {
        const jobRecord = this.getCurrentModalJobRecord();
        const reference = this.currentModalJobStartDateTime
            || jobRecord?.jobStartTimeIso
            || jobRecord?.jobStartTime
            || this.clockInTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get clockInMaxBoundary() {
        const jobRecord = this.getCurrentModalJobRecord();
        const reference = this.currentModalJobEndDateTime
            || jobRecord?.jobEndTimeIso
            || jobRecord?.jobEndTime
            || this.clockOutTime
            || this.clockInTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T23:59` : null;
    }

    get clockOutMinBoundary() {
        const jobRecord = this.getCurrentModalJobRecord();
        const reference = this.currentModalJobStartDateTime
            || jobRecord?.jobStartTimeIso
            || jobRecord?.jobStartTime
            || this.clockInTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get clockOutMaxBoundary() {
        const jobRecord = this.getCurrentModalJobRecord();
        const reference = this.currentModalJobEndDateTime
            || jobRecord?.jobEndTimeIso
            || jobRecord?.jobEndTime
            || this.clockOutTime
            || this.clockInTime;
        const dateKey = this.extractDateKey(reference);
        if (!dateKey) return null;
        const nextDay = this.addDaysToDateKey(dateKey, 1);
        const boundaryKey = nextDay || dateKey;
        return `${boundaryKey}T23:59`;
    }

    get modalJobStartTime() {
        const job = this.getCurrentModalJobRecord();
        return job ? job.jobStartTime : '';
    }

    get modalJobEndTime() {
        const job = this.getCurrentModalJobRecord();
        return job ? job.jobEndTime : '';
    }

    normalizeDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    isValidDateTime(dateTimeString) {
        const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
        return regex.test(dateTimeString);
    }

    formatToAMPM(iso) {
        try {
            if (!iso) return '';
            const parts = iso.split('T');
            if (parts.length < 2) return iso;
            const datePart = parts[0]; 
            const timePart = parts[1].substring(0, 5); 
            const [year, month, day] = datePart.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[parseInt(month, 10) - 1];
            const [hoursStr, minutesStr] = timePart.split(':');
            let hours = parseInt(hoursStr, 10);
            const minutes = minutesStr;
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; 
            const paddedHours = String(hours).padStart(2, '0');
            return `${monthName} ${parseInt(day, 10)}, ${year}, ${paddedHours}:${minutes} ${ampm}`;
        } catch (error) {
            console.error('Error in formatToAMPM:', error);
            return iso;
        }
    }

    get timesheetDetails() {
        try {
            if (!this.timesheetDetailsRaw) {
                this.currentWeekTravelTime = 0;
                this.currentTotalWorkHours = 0;
                return [];
            }

            this.currentWeekTravelTime = 0;
            this.currentTotalWorkHours = 0;

            return this.timesheetDetailsRaw.map((ts, index) => {
                return {
                    id: ts.id,
                    jobId: ts.jobId,
                    values: this.timesheetColumns.map(col => {
                        let cell = { value: '--', style: col.style, recordLink: null, };

                        if (col.fieldName === 'srNo') {
                            cell.value = index + 1;
                        } else {
                            cell.value = ts[col.fieldName] || '--';
                            if (col.isLink && col.recordIdField) {
                                cell.recordLink = `/${ts[col.recordIdField]}`;
                            }
                        }

                        if (col.fieldName === 'clockInTime' || col.fieldName === 'clockOutTime') {
                            cell.value = this.formatToAMPM(cell.value);
                        }

                        if (col.fieldName === 'travelTime' && ts[col.fieldName]) {
                            this.currentWeekTravelTime += cell.value;
                        }
                        if (col.fieldName === 'workHours' && ts[col.fieldName]) {
                            this.currentTotalWorkHours += cell.value;
                        }

                        return cell;
                    })
                };
            });
        } catch (error) {
            console.error('Error in timesheetDetails ::', error);
            this.currentWeekTravelTime = 0;
            this.currentTotalWorkHours = 0;
            return [];
        }
    }

    /**
     * Method Name: dailyTimesheetSummary
     * @description: Groups timesheet data by day for Mobile Card View.
     */
    get dailyTimesheetSummary() {
        if (!this.timesheetDetailsRaw || this.timesheetDetailsRaw.length === 0) {
            return [];
        }

        const groups = {};

        this.timesheetDetailsRaw.forEach(entry => {
            // Group by Date (Assume clockInTime exists and is ISO)
            let dateKey = 'Unknown Date';
            let displayDate = 'Unknown Date';

            if (entry.clockInTime) {
                // Extract YYYY-MM-DD
                dateKey = entry.clockInTime.split('T')[0];
                const dateObj = new Date(dateKey);
                // Format: Monday, Oct 6
                displayDate = this.formatDateLabel(dateObj);
            }

            if (!groups[dateKey]) {
                groups[dateKey] = {
                    date: dateKey,
                    labelDate: displayDate,
                    totalHours: 0,
                    entries: []
                };
            }

            // Sum up total time (Work + Travel) for the daily summary header
            const work = entry.workHours || 0;
            const travel = entry.travelTime || 0;
            groups[dateKey].totalHours += (work + travel);

            groups[dateKey].entries.push({
                id: entry.id,
                jobName: entry.jobName || 'Unknown Job',
                jobNumber: entry.jobNumber || '--',
                workHours: work ? work.toFixed(2) + ' Hrs' : '0 Hrs',
                travelTime: travel ? travel.toFixed(2) + ' Hrs' : '0 Hrs'
            });
        });

        // Convert object to array and format the label
        return Object.values(groups).map(day => {
            return {
                ...day,
                // Label format: "Monday, Oct 6: 8.5 Hours"
                label: `${day.labelDate}, Total Work:${day.totalHours.toFixed(2)} Hours`
            };
        }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date
    }

    connectedCallback() {
        try {
            this.selectedDate = new Date();
            let isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            if (isMobileDevice) {
                this.isMobileDevice = true;
            } else {
                this.isMobileDevice = false;
            }

            this.getMobilizationMembers();
            this.getTimesheetDetails();
        } catch (error) {
            console.error('Error in connectedCallback:', error);
        }
    }

    renderedCallback() {
        if (!this.accordionStyleApplied) {
            this.applyAccordionStyling();
        }
    }

    applyAccordionStyling() {
        try {
            const style = document.createElement('style');
            style.textContent = `
                .accordion-container .section-control {
                    background: rgba(94, 90, 219, 0.9) !important;
                    color: white !important;
                    margin-bottom: 4px;
                    --slds-c-icon-color-foreground-default: #ffffff !important;
                    font-weight: 600 !important;
                    border-radius: 4px;
                }
                .accordion-container .slds-accordion__summary-content{
                    font-size: medium;
                }
                /* Mobile Timesheet Accordion Headers */
                .mobile-timesheet-container .section-control {
                    background: rgb(94 90 219 / 18%) !important; 
                    color: #333 !important;
                    border-left: 5px solid rgba(94, 90, 219, 0.9);
                    border-bottom: 1px solid #ddd;
                    --slds-c-icon-color-foreground-default: #5e5adb !important;
                }
            `;
            const accordionContainer = this.template.querySelector('.accordion-container');
            if (accordionContainer) {
                accordionContainer.appendChild(style);
                this.accordionStyleApplied = true;
            }
        } catch (error) {
            console.error('Error applying accordion styling:', error);
        }
    }

    // ... (Remaining methods getMobilizationMembers, groupWeeklyJobData, getTimesheetDetails, handleSectionToggle, handleTodayTab, handleWeekTab, handleClockIn, handleClockOut, handleInputChange, closeClockInModal, closeClockOutModal, getCurrentLocation, saveClockIn, saveClockOut, handleLinkClick, handleOpenInMaps, checkIfDescriptionNeedsReadMore, handleToggleDescription, showToast remain unchanged) ...
    
    // Included purely for context completeness, assume they exist as per original code provided
    getMobilizationMembers() {
        try {
            this.isLoading = true;
            getMobilizationMembers({ filterDate: this.apexFormattedDate, mode: this.activeTab })
                .then((data) => {
                    if (data && !data?.ERROR) {
                        this.hasError = false;
                        this.errorMessage = '';
                        if (data && Object.keys(data).length !== 0) {
                            if (this.activeTab == 'today') {
                                this.todayJobList = data.dayJobs || [];
                                this.isTodayJobAvailable = this.todayJobList.length > 0;
                                this.todayJobList = this.todayJobList.map(job => {
                                    const rawStart = job.jobStartTime;
                                    const rawEnd = job.jobEndTime;
                                    const description = job.jobDescription || '--';
                                    const needsReadMore = this.checkIfDescriptionNeedsReadMore(description);
                                    return {
                                        ...job,
                                        jobStartTimeIso: rawStart,
                                        jobEndTimeIso: rawEnd,
                                        jobId: job.jobId,
                                        jobStartTime: this.formatToAMPM(rawStart),
                                        jobEndTime: this.formatToAMPM(rawEnd),
                                        jobDescription: description,
                                        displayDescription: description,
                                        descriptionClass: needsReadMore ? 'job-description-content collapsed' : 'job-description-content',
                                        showReadMore: needsReadMore,
                                        readMoreText: 'Read more...',
                                        isExpanded: false,
                                        mapMarkers: [{
                                            location: {
                                                Street: job.jobStreet || '',
                                                City: job.jobCity || '',
                                                State: job.jobState || '',
                                                PostalCode: job.jobPostalCode || '',
                                                Country: job.jobCountry || ''
                                            },
                                            value: job.mobId,
                                            title: job.jobName ? `${job.jobName} (${job.jobNumber})` : job.jobNumber,
                                            description: job.jobDescription ? job.jobDescription.replace(/'/g, '') : '',
                                            icon: 'standard:account'
                                        }],
                                        isValidLocation: (job.jobStreet != '--' && job.jobCity != '--' && job.jobState != '--') ? true : false
                                    };
                                });
                                const costCodeMap = data.costCodeDetails[0].costCodeDetails;
                                this.costCodeOptions = Object.keys(costCodeMap).map(key => ({
                                    label: costCodeMap[key],
                                    value: key
                                }));
                            } else if (this.activeTab == 'week') {
                                let apexData = data.weekJobs || [];
                                this.groupWeeklyJobData(apexData);
                                this.isWeekJobAvailable = apexData.length > 0;
                            }
                        }
                    } else {
                        this.hasError = true;
                        this.errorMessage = data.ERROR || 'An error occurred while fetching data.';
                    }
                })
                .catch((error) => {
                    console.error('Error fetching data getMobilizationMembers apex:', error);
                    this.showToast('Error', 'Failed to load data!', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in getMobilizationMembers:', error);
            this.showToast('Error', 'Failed to load data!', 'error');
            this.isLoading = false;
        }
    }

    groupWeeklyJobData(apexData) {
        try {
            let today = new Date();
            const normalizedApexData = {};
            for (let key in apexData) {
                normalizedApexData[key] = apexData[key].map(job => {
                    const description = job.jobDescription || '--';
                    const needsReadMore = this.checkIfDescriptionNeedsReadMore(description);
                    return {
                        ...job,
                        jobStartTimeIso: job.jobStartTime,
                        jobEndTimeIso: job.jobEndTime,
                        jobStartTime: this.formatToAMPM(job.jobStartTime),
                        jobEndTime: this.formatToAMPM(job.jobEndTime),
                        jobDescription: description,
                        displayDescription: description,
                        descriptionClass: needsReadMore ? 'job-description-content collapsed' : 'job-description-content',
                        showReadMore: needsReadMore,
                        readMoreText: 'Read more...',
                        isExpanded: false,
                        mapMarkers: [{
                            location: {
                                Street: job.jobStreet || '',
                                City: job.jobCity || '',
                                State: job.jobState || '',
                                PostalCode: job.jobPostalCode || '',
                                Country: job.jobCountry || ''
                            },
                            value: job.mobId,
                            title: job.jobName ? `${job.jobName} (${job.jobNumber})` : job.jobNumber,
                            description: job.jobDescription ? job.jobDescription.replace(/'/g, '') : '',
                            icon: 'standard:account'
                        }]
                    };
                });
            }
            let weekSections = [];
            for (let i = 0; i < 7; i++) {
                let currentDate = new Date(today);
                currentDate.setDate(today.getDate() + i);
                const start = this.normalizeDate(currentDate);
                let dateKey = start.toLocaleDateString('en-CA');
                let jobsForDay = normalizedApexData[dateKey] || [];
                weekSections.push({
                    id: `day-${i}`,
                    label: this.formatDateLabel(currentDate),
                    jobs: jobsForDay
                });
            }
            this.weekJobList = weekSections;
        } catch (error) {
            console.error('Error in groupWeeklyJobData :: ', error);
        }
    }

    getTimesheetDetails() {
        try {
            this.isLoading = true;
            getTimeSheetEntryItems()
                .then(result => {
                    if (result && !result?.ERROR) {
                        if (result && result.timesheetEntries.length !== 0) {
                            this.timesheetDetailsRaw = result.timesheetEntries;
                        }
                    } else {
                        this.hasError = true;
                        this.errorMessage = result.ERROR || 'An error occurred while fetching data.';
                    }
                })
                .catch(error => {
                    console.error('Error in getTimeSheetEntryItems apex :: ', error);
                    this.showToast('Error', 'Failed to load data!', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                })
        } catch (error) {
            console.error('Error in getTimeSheetEntryItems ::', error);
            this.showToast('Error', 'Failed to load data!', 'error');
            this.isLoading = false;
        }
    }

    handleSectionToggle(event) {
        this.activeSectionName = event.detail.openSections;
    }

    handleTodayTab() {
        this.activeTab = 'today';
        this.getMobilizationMembers();
    }

    handleWeekTab() {
        this.activeTab = 'week';
        this.getMobilizationMembers();
    }

    handleClockIn(event) {
        this.showClockInModal = true;
        const mobId = event.currentTarget.dataset.id;
        const selectedMob = this.todayJobList.find(job => job.mobId === mobId);
        if (selectedMob) {
            this.selectedContactId = selectedMob.contactId;
            this.selectedMobilizationId = selectedMob.mobId;
            this.clockInTime = selectedMob.jobStartTime?.slice(0, 16);
            this.clockOutTime = selectedMob.jobEndTime?.slice(0, 16);
            this.currentModalJobStartDateTime = selectedMob.jobStartTimeIso || selectedMob.jobStartTime;
            this.currentModalJobEndDateTime = selectedMob.jobEndTimeIso || selectedMob.jobEndTime;
        }
    }

    handleClockOut(event) {
        this.showClockOutModal = true;
        const mobId = event.currentTarget.dataset.id;
        const selectedMob = this.todayJobList.find(job => job.mobId === mobId);
        if (selectedMob) {
            this.selectedContactId = selectedMob.contactId;
            this.selectedMobilizationId = selectedMob.mobId;
            this.clockInTime = selectedMob.jobStartTime?.slice(0, 16);
            this.clockOutTime = selectedMob.jobEndTime?.slice(0, 16);
            this.previousClockInTime = this.formatToAMPM(selectedMob.clockInTime);
            this.currentModalJobStartDateTime = selectedMob.jobStartTimeIso || selectedMob.jobStartTime;
            this.currentModalJobEndDateTime = selectedMob.jobEndTimeIso || selectedMob.jobEndTime;
        }
    }

    handleInputChange(event) {
        let field = event.target.dataset.field;
        let value = event.target.value;
        if (field === 'clockOut') {
            this.clockOutTime = value;
        } else if (field === 'clockIn') {
            this.clockInTime = value;
        } else if (field === 'costCode') {
            this.selectedCostCodeId = value;
        }
    }

    closeClockInModal() {
        this.showClockInModal = false;
        this.selectedContactId = null;
        this.selectedMobilizationId = null;
        this.selectedCostCodeId = null;
        this.previousClockInTime = null;
        this.clockInTime = null;
        this.clockOutTime = null;
        this.currentModalJobStartDateTime = null;
        this.currentModalJobEndDateTime = null;
    }

    closeClockOutModal() {
        this.showClockOutModal = false;
        this.selectedContactId = null;
        this.selectedMobilizationId = null;
        this.selectedCostCodeId = null;
        this.previousClockInTime = null;
        this.clockOutTime = null;
        this.clockInTime = null;
        this.currentModalJobStartDateTime = null;
        this.currentModalJobEndDateTime = null;
    }

    async getCurrentLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.error('Geolocation is not supported by this browser.');
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    console.error('Error getting location:', error.message);
                    resolve(null);
                }
            );
        });
    }

    async saveClockIn() {
        try {
            if (!this.selectedCostCodeId || !this.clockInTime) {
                this.showToast('Error', 'Select Cost Code and Time!', 'error');
                return;
            }
            if (!this.isValidDateTime(this.clockInTime)) {
                this.showToast('Error', 'Please select both date and time for clock in.', 'error');
                return;
            }
            const selectedRecordDetails = this.todayJobList.find(
                record => record.mobId === this.selectedMobilizationId
            );
            if (!selectedRecordDetails) {
                this.showToast('Error', 'Unable to determine job details', 'error');
                return;
            }
            const jobStartReference = selectedRecordDetails?.jobStartTimeIso || selectedRecordDetails?.jobStartTime;
            const jobEndReference = selectedRecordDetails?.jobEndTimeIso || selectedRecordDetails?.jobEndTime;
            if (!this.validateClockInDate(this.clockInTime, jobStartReference, jobEndReference)) {
                return;
            }
            this.isLoading = true;
            const location = await this.getCurrentLocation();
            const params = {
                actionType: 'clockIn',
                contactId: this.selectedContactId,
                costCodeId: this.selectedCostCodeId,
                mobId: this.selectedMobilizationId,
                jobId: selectedRecordDetails.jobId,
                clockInTime: this.clockInTime.replace(' ', 'T'),
                isTimeSheetNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetNull : true,
                timesheetId: selectedRecordDetails ? selectedRecordDetails?.timesheetId : null,
                isTimeSheetEntryNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetEntryNull : true,
                timesheetEntryId: selectedRecordDetails ? selectedRecordDetails?.timesheetEntryId : null,
                mobMemberId: selectedRecordDetails.mobMemberId,
                clockInLatitude: location?.latitude || null,
                clockInLongitude: location?.longitude || null,
                canAccessLocation: selectedRecordDetails?.canAccessLocation || false
            };
            createTimesheetRecords({ params: JSON.stringify(params) })
                .then(result => {
                    if (result == true) {
                        this.showToast('Success', 'Clocked In Successfully', 'success');
                        this.closeClockInModal();
                        this[NavigationMixin.Navigate]({
                            type: 'standard__recordPage',
                            attributes: {
                                recordId: selectedRecordDetails.jobId,
                                actionName: 'view'
                            }
                        });
                        this.getMobilizationMembers();
                        this.getTimesheetDetails();
                    } else {
                        this.showToast('Error', 'Failed to Clock In User', 'error');
                    }
                })
                .catch(error => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error creating timesheet records createTimesheetRecords apex :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in saveClockIn:', error);
            this.isLoading = false;
        }
    }

    async saveClockOut() {
        try {
            if (!this.clockOutTime) {
                this.showToast('Error', 'No time selected', 'error');
                console.error('No time selected');
                return;
            }
            if (!this.isValidDateTime(this.clockOutTime)) {
                this.showToast('Error', 'Please select both date and time for clock out.', 'error');
                return;
            }
            const selectedRecordDetails = this.todayJobList.find(
                record => record.mobId === this.selectedMobilizationId
            );
            if (!selectedRecordDetails) {
                this.showToast('Error', 'Unable to determine job details for the selected record', 'error');
                return;
            }
            if (new Date(this.clockOutTime.replace(' ', 'T')) <= new Date(selectedRecordDetails.clockInTime.slice(0, 16).replace('T', ' '))) {
                this.showToast('Error', 'Clock out time must be greater than clock in time', 'error');
                return;
            }
            const jobStartReference = selectedRecordDetails?.jobStartTimeIso || selectedRecordDetails?.jobStartTime;
            const jobEndReference = selectedRecordDetails?.jobEndTimeIso || selectedRecordDetails?.jobEndTime;
            if (!this.validateClockOutDate(this.clockOutTime, jobStartReference, jobEndReference)) {
                return;
            }
            this.isLoading = true;
            const location = await this.getCurrentLocation();
            const params = {
                actionType: 'clockOut',
                contactId: this.selectedContactId,
                costCodeId: this.selectedCostCodeId,
                mobId: this.selectedMobilizationId,
                jobId: selectedRecordDetails.jobId,
                clockInTime: selectedRecordDetails.clockInTime,
                clockOutTime: this.clockOutTime.replace(' ', 'T'),
                isTimeSheetNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetNull : true,
                timesheetId: selectedRecordDetails ? selectedRecordDetails?.timesheetId : null,
                isTimeSheetEntryNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetEntryNull : true,
                timesheetEntryId: selectedRecordDetails ? selectedRecordDetails?.timesheetEntryId : null,
                mobMemberId: selectedRecordDetails.mobMemberId,
                clockOutLatitude: location?.latitude || null,
                clockOutLongitude: location?.longitude || null,
                canAccessLocation: selectedRecordDetails?.canAccessLocation || false
            };
            createTimesheetRecords({ params: JSON.stringify(params) })
                .then(result => {
                    if (result == true) {
                        this.getMobilizationMembers();
                        this.getTimesheetDetails();
                        this.closeClockOutModal();
                        this.showToast('Success', 'Clocked Out Successfully', 'success');
                    } else {
                        this.showToast('Error', 'Failed to Clock Out User', 'error');
                    }
                })
                .catch(error => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error creating timesheet records createTimesheetRecords apex :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
            return;
        } catch (error) {
            console.error('Error in saveClockOut:', error);
            this.isLoading = false;
        }
    }

    handleLinkClick(event) {
        try {
            const jobId = event.currentTarget.dataset.link;
            console.log('Job Id:', jobId);
            if (jobId) {
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: jobId,
                        actionName: 'view',
                    },
                });
            } else {
                console.warn('No jobId found in dataset');
            }
        } catch (error) {
            console.error('Error in handleLinkClick:', error);
        }
    }

    formatDateLabel(date) {
        try {
            const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
            return date.toLocaleDateString(undefined, options); 
        } catch (error) {
            console.error('Error in formatDateLabel :: ', error);
        }
    }

    handleOpenInMaps(event) {
        try {
            const mobId = event.target.dataset.id;
            let selectedMob;
            if (this.activeTab === 'today') {
                selectedMob = this.todayJobList.find(job => job.mobId === mobId);
            } else {
                for (let section of this.weekJobList) {
                    selectedMob = section.jobs.find(job => job.mobId === mobId);
                    if (selectedMob) break;
                }
            }
            if (selectedMob) {
                if (!selectedMob.isValidLocation) {
                    this.showToast('Error', 'Invalid Location', 'error');
                    return;
                }
                const street = selectedMob?.jobStreet || '';
                const city = selectedMob?.jobCity || '';
                const state = selectedMob?.jobState || '';
                const postalCode = selectedMob?.jobPostalCode || '';
                const country = selectedMob?.jobCountry || '';
                const query = encodeURIComponent(`${street} ${city} ${state} ${postalCode} ${country}`.trim());
                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`);
            }
        } catch (error) {
            console.error('Error in handleOpenInMaps :: ', error);
        }
    }

    checkIfDescriptionNeedsReadMore(text) {
        if (!text || text === '--') return false;
        return text.length > 150;
    }

    handleToggleDescription(event) {
        const mobId = event.currentTarget.dataset.id;
        if (this.activeTab === 'today') {
            this.todayJobList = this.todayJobList.map(job => {
                if (job.mobId === mobId) {
                    const isExpanded = !job.isExpanded;
                    return {
                        ...job,
                        isExpanded: isExpanded,
                        descriptionClass: isExpanded ? 'job-description-content' : 'job-description-content collapsed',
                        readMoreText: isExpanded ? 'Read less' : 'Read more...'
                    };
                }
                return job;
            });
        } else if (this.activeTab === 'week') {
            this.weekJobList = this.weekJobList.map(section => {
                return {
                    ...section,
                    jobs: section.jobs.map(job => {
                        if (job.mobId === mobId) {
                            const isExpanded = !job.isExpanded;
                            return {
                                ...job,
                                isExpanded: isExpanded,
                                descriptionClass: isExpanded ? 'job-description-content' : 'job-description-content collapsed',
                                readMoreText: isExpanded ? 'Read less' : 'Read more...'
                            };
                        }
                        return job;
                    })
                };
            });
        }
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }
}