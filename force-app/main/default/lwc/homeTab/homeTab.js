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
        return this.selectedDate.toISOString().split('T')[0];
    }

    get isTodayTabActive(){
        return this.activeTab === 'today';
    }
    
    get isWeekTabActive(){
        return this.activeTab === 'week';
    }

    get todayTabClass() {
        return this.activeTab === 'today' ? 'active' : '';
    }
    
    get weekTabClass() {
        return this.activeTab === 'week' ? 'active' : '';
    }

    extractDateKey(value) {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return value.toISOString().slice(0, 10);
        }

        const str = value.toString().trim();
        if (!str) {
            return null;
        }

        if (str.length >= 10) {
            return str.slice(0, 10);
        }

        return null;
    }

    addDaysToDateKey(dateKey, days) {
        if (!dateKey || typeof dateKey !== 'string') {
            return null;
        }

        const [year, month, day] = dateKey.split('-').map(Number);
        if ([year, month, day].some(num => Number.isNaN(num))) {
            return null;
        }

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
        if (!dateKey) {
            return null;
        }
        const nextDay = this.addDaysToDateKey(dateKey, 1);
        const boundaryKey = nextDay || dateKey;
        return `${boundaryKey}T23:59`;
    }

    /** 
    * Method Name: formatToAMPM
    * @description: Formats ISO datetime string to 12-hour AM/PM format for display (e.g., "Nov 12, 2025, 03:45 PM")
    */
    formatToAMPM(iso) {
        try {
            if (!iso) return '';
            
            // Extract date and time parts from ISO string
            // Format: "2025-10-05T14:30:00.000Z" or "2025-10-05T14:30"
            const parts = iso.split('T');
            if (parts.length < 2) return iso;
            
            const datePart = parts[0]; // "2025-10-05"
            const timePart = parts[1].substring(0, 5); // "14:30"
            
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
            
            // Format: "Nov 12, 2025, 03:45 PM"
            return `${monthName} ${parseInt(day, 10)}, ${year}, ${paddedHours}:${minutes} ${ampm}`;
        } catch (error) {
            console.error('Error in formatToAMPM:', error);
            return iso;
        }
    }

    /** 
    * Method Name: timesheetDetails 
    * @description: This method processes raw timesheet details and formats them for display in the UI.
    */
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

                        // Format dates nicely
                        if (col.fieldName === 'clockInTime' || col.fieldName === 'clockOutTime') {
                            cell.value = this.formatToAMPM(cell.value);
                        }

                        // Sum travelTime and totalTime dynamically based on column name
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
    * Method Name: connectedCallback 
    * @description: Initializes component state, detects if the user is on a mobile device, and triggers fetching of mobilization members and timesheet details.
    */
    connectedCallback() {
        try {
            this.selectedDate = new Date();
            let isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent); 
    
            if(isMobileDevice) {
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

    /** 
    * Method Name: renderedCallback 
    * @description: Ensures accordion styling is applied once after the component is rendered.
    */
    renderedCallback() {
        if(!this.accordionStyleApplied){
            this.applyAccordionStyling();
        }
    }

    /** 
    * Method Name: applyAccordionStyling 
    * @description: Dynamically injects custom CSS to style the accordion sections within the component.
    */
    applyAccordionStyling() {
        try {
            // Create style element if it doesn't exist
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
            `;
            
            // Append to component's template
            const accordionContainer = this.template.querySelector('.accordion-container');
            if (accordionContainer) {
                accordionContainer.appendChild(style);
                this.accordionStyleApplied = true;
            }
            
        } catch (error) {
            console.error('Error applying accordion styling:', error);
        }
    }

    /** 
    * Method Name: getMobilizationMembers 
    * @description: Fetches mobilization members from Apex, processes the data for today or week view, and prepares it for UI display including job times, map markers, and cost code options.
    */
    getMobilizationMembers() {
        try {
            this.isLoading = true;
            getMobilizationMembers({ filterDate: this.apexFormattedDate, mode: this.activeTab })
                .then((data) => {
                    console.log('getMobilizationMembers fetched successfully:', data);
                    if(data && !data?.ERROR){
                        this.hasError = false;
                        this.errorMessage = '';
                        if (data && Object.keys(data).length !== 0) {
                            if(this.activeTab == 'today') {
                                this.todayJobList = data.dayJobs || [];
                                this.isTodayJobAvailable = this.todayJobList.length > 0;
                                
                                this.todayJobList = this.todayJobList.map(job => {
                                    console.log('job :: ', job);
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
                                            description: job.jobDescription ? job.jobDescription.replace(/'/g, '&#39;') : '',
                                            icon: 'standard:account'
                                        }],
                                        isValidLocation: (job.jobStreet != '--' && job.jobCity != '--' && job.jobState != '--' ) ? true : false
                                    };
                                });
        
                                const costCodeMap = data.costCodeDetails[0].costCodeDetails;
                                this.costCodeOptions = Object.keys(costCodeMap).map(key => ({
                                    label: costCodeMap[key], // the name
                                    value: key               // the id
                                }));
        
                            } else if(this.activeTab == 'week') {
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

    /** 
    * Method Name: groupWeeklyJobData 
    * @description: Groups Apex weekly job data by day from today to next Monday, formats job times, and prepares map markers for UI display in accordion sections.
    */
    groupWeeklyJobData(apexData) {
        try {
            let today = new Date();

            // normalize apexData keys
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
                            description: job.jobDescription ? job.jobDescription.replace(/'/g, '&#39;') : '',
                            icon: 'standard:account'
                        }]
                    };
                });
            }

            let weekSections = [];
            // loop today → next 6 days
            for (let i = 0; i < 7; i++) {
                let currentDate = new Date(today);
                currentDate.setDate(today.getDate() + i);

                let dateKey = currentDate.toISOString().slice(0, 10);
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

    /** 
    * Method Name: getTimesheetDetails 
    * @description: Fetches raw timesheet entries from Apex and stores them for further processing in the UI.
    */
    getTimesheetDetails() {
        try {
            this.isLoading = true;

            getTimeSheetEntryItems()
                .then(result => {
                    console.log('getTimeSheetEntryItems result :: ', result);

                    if(result && !result?.ERROR){  
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

    /**
    * Method Name: handleSectionToggle
    * @description: Handle accordion section toggle - Allow multiple sections to be open
    */
    handleSectionToggle(event) {
        this.activeSectionName = event.detail.openSections;
    }

    /**
    * Method Name: handleTodayTab
    * @description: Switches the UI to "Today" view and fetches today's mobilization jobs.
    */
    handleTodayTab() {
        this.activeTab = 'today';
        this.getMobilizationMembers();
    }

    /**
    * Method Name: handleWeekTab
    * @description: Switches the UI to "Week" view and fetches the week's mobilization jobs.
    */
    handleWeekTab() {
        this.activeTab = 'week';
        this.getMobilizationMembers();
    }

    /**
    * Method Name: handleClockIn
    * @description: Opens the Clock In modal and populates selected job and contact details for clocking in.
    */
    handleClockIn(event) {
        this.showClockInModal = true;
        const mobId = event.currentTarget.dataset.id;
        const selectedMob = this.todayJobList.find(job => job.mobId === mobId);
        if(selectedMob) {
            this.selectedContactId = selectedMob.contactId;
            this.selectedMobilizationId = selectedMob.mobId;
            this.clockInTime = selectedMob.jobStartTime?.slice(0, 16);
            this.clockOutTime = selectedMob.jobEndTime?.slice(0, 16);
            this.currentModalJobStartDateTime = selectedMob.jobStartTimeIso || selectedMob.jobStartTime;
            this.currentModalJobEndDateTime = selectedMob.jobEndTimeIso || selectedMob.jobEndTime;
        }
    }

    /**
    * Method Name: handleClockOut
    * @description: Opens the Clock Out modal and populates selected job, contact, and previous clock-in details for clocking out.
    */
    handleClockOut(event) {
        this.showClockOutModal = true;
        const mobId = event.currentTarget.dataset.id;
        const selectedMob = this.todayJobList.find(job => job.mobId === mobId);
        if(selectedMob) {
            this.selectedContactId = selectedMob.contactId;
            this.selectedMobilizationId = selectedMob.mobId;
            this.clockInTime = selectedMob.jobStartTime?.slice(0, 16);
            this.clockOutTime = selectedMob.jobEndTime?.slice(0, 16);
            this.previousClockInTime = this.formatToAMPM(selectedMob.clockInTime);
            this.currentModalJobStartDateTime = selectedMob.jobStartTimeIso || selectedMob.jobStartTime;
            this.currentModalJobEndDateTime = selectedMob.jobEndTimeIso || selectedMob.jobEndTime;
        }
    }

    /** 
    * Method Name: handleInputChange 
    * @description: Method is used to handle the input change
    */
    handleInputChange(event) {
        let field = event.target.dataset.field;
        let value = event.target.value;

        if(field === 'clockOut') {
            this.clockOutTime = value;
        } else if(field === 'clockIn') {
            this.clockInTime = value;
        } else if (field === 'costCode') {
            this.selectedCostCodeId = value;
        }
    }

    /** 
    * Method Name: closeClockInModal 
    * @description: Closes the Clock In modal and resets all related job, contact, and time fields.
    */
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

    /** 
    * Method Name: closeClockOutModal 
    * @description: Closes the Clock Out modal and resets all related job, contact, and time fields.
    */
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

    /** 
    * Method Name: saveClockIn 
    * @description: Validates input and submits a Clock In request for the selected mobilization, updating the timesheet and UI accordingly.
    */
    saveClockIn() {
        try {
            if(!this.selectedCostCodeId || !this.clockInTime) {
                this.showToast('Error', 'Select Cost Code and Time!', 'error');
                console.error('No cost code/time selected');
                return;
            }

            const selectedRecordDetails = this.todayJobList.find(
                record => record.mobId === this.selectedMobilizationId
            );

            if (!selectedRecordDetails) {
                this.showToast('Error', 'Unable to determine job details for the selected record', 'error');
                return;
            }

            const jobStartReference = selectedRecordDetails?.jobStartTimeIso || selectedRecordDetails?.jobStartTime;
            if (!this.validateClockInDate(this.clockInTime, jobStartReference)) {
                return;
            }

            this.isLoading = true;

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
                mobMemberId: selectedRecordDetails.mobMemberId
            };

            console.log('createTimesheetRecords params :: ', params);
            
            createTimesheetRecords({ params: JSON.stringify(params)})
                .then(result => {
                    console.log('createTimesheetRecords apex result :: ', result);
                    if(result == true) {
                        this.getMobilizationMembers();
                        this.getTimesheetDetails();
                        this.closeClockInModal();
                        this.showToast('Success', 'Clocked In Successfully', 'success');
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

    /** 
    * Method Name: saveClockOut 
    * @description: Validates input and submits a Clock Out request for the selected mobilization, updating the timesheet and UI accordingly.
    */
    saveClockOut() {
        try {
            if(!this.clockOutTime) {
                this.showToast('Error', 'No time selected', 'error');
                console.error('No time selected');
                return;
            }

            const selectedRecordDetails = this.todayJobList.find(
                record => record.mobId === this.selectedMobilizationId
            );

            if (!selectedRecordDetails) {
                this.showToast('Error', 'Unable to determine job details for the selected record', 'error');
                return;
            }

            if(new Date(this.clockOutTime.replace(' ', 'T')) <= new Date(selectedRecordDetails.clockInTime.slice(0, 16).replace('T', ' '))) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }

            const jobStartReference = selectedRecordDetails?.jobStartTimeIso || selectedRecordDetails?.jobStartTime;
            const jobEndReference = selectedRecordDetails?.jobEndTimeIso || selectedRecordDetails?.jobEndTime;
            if (!this.validateClockOutDate(this.clockOutTime, jobStartReference, jobEndReference)) {
                return;
            }
            this.isLoading = true;

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
                mobMemberId: selectedRecordDetails.mobMemberId
            };

            console.log('createTimesheetRecords params :: ', params);

            createTimesheetRecords({ params: JSON.stringify(params)})
                .then(result => {
                    console.log('createTimesheetRecords apex :: result', result);
                    if(result == true) {
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

    /** 
    * Method Name: handleLinkClick 
    * @description: Method is used to handle the link click
    */
    handleLinkClick(event) {
        try {
            const jobId = event.currentTarget.dataset.link; // ✅ use currentTarget
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


    /** 
    * Method Name: formatDateLabel 
    * @description: Converts a Date object into a human-readable string format for UI labels (e.g., Monday 6 Oct, 2025).
    */
    formatDateLabel(date) {
        try {
            const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
            return date.toLocaleDateString(undefined, options); // Monday 6 Oct, 2025
        } catch (error) {
            console.error('Error in formatDateLabel :: ' , error);
        }
    }

    /** 
    * Method Name: handleOpenInMaps 
    * @description: Opens the Google Maps location for the selected job based on its address, handling both today and week views.
    */
    handleOpenInMaps(event) {
        try {
            const mobId = event.target.dataset.id;
            let selectedMob;

            if (this.activeTab === 'today') {
                selectedMob = this.todayJobList.find(job => job.mobId === mobId);
            } else {
                // Week view: weekJobList contains sections with jobs
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

    /**
    * Method Name: checkIfDescriptionNeedsReadMore
    * @description: Checks if description text needs read more functionality (more than 3 lines)
    */
    checkIfDescriptionNeedsReadMore(text) {
        if (!text || text === '--') return false;
        // Approximate: if text is longer than 150 characters, it might need read more
        // This is a rough estimate; actual line count depends on container width
        return text.length > 150;
    }

    /**
    * Method Name: handleToggleDescription
    * @description: Toggles the expanded/collapsed state of job description
    */
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

    /** 
    * Method Name: showToast 
    * @description: Method is used to show toast message
    */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }
}