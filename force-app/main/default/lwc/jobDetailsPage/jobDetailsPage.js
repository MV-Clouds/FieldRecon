import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getJobRelatedMoblizationDetails from '@salesforce/apex/JobDetailsPageController.getJobRelatedMoblizationDetails';
import getTimeSheetEntryItems from '@salesforce/apex/JobDetailsPageController.getTimeSheetEntryItems';
import getMobilizationMembersWithStatus from '@salesforce/apex/JobDetailsPageController.getMobilizationMembersWithStatus';
import createTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createTimesheetRecords';
import getContactsAndCostcode from '@salesforce/apex/JobDetailsPageController.getContactsAndCostcode';
import createManualTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createManualTimesheetRecords';
import updateTimesheets from '@salesforce/apex/JobDetailsPageController.updateTimesheets';
import deleteTimesheetEntry from '@salesforce/apex/JobDetailsPageController.deleteTimesheetEntry';

export default class JobDetailsPage extends NavigationMixin(LightningElement) {
    @track jobDetailsRaw;
    @track filteredJobDetailsRaw;
    @track isLoading = true;
    @track selectedDate;
    @track viewMode = 'day';
    @track weekStart;
    @track weekEnd;
    @track searchTerm;
    @track customStartDate;
    @track customEndDate;
    @track showClockInOutModal = false;
    @track showTimesheetModal = false;
    @track jobId;
    @track mobId;
    @track activeTab = 'clockin';
    @track clockInList = [];
    @track clockOutList = [];
    @track clockInOptions = [];
    @track clockOutOptions = [];
    @track costCodeOptions = [];
    @track selectedContactId;
    @track isSelectedContactClockedIn = false;
    @track previousClockInTime;
    @track selectedCostCodeId;
    @track defaultStartTime;
    @track clockInTime;
    @track defaultEndTime;
    @track clockOutTime;
    @track manualTimesheetEntry = false;
    @track editTimesheetEntry = false;
    @track showDeleteConfirmModal = false;
    @track selectedTimesheetEntryLineId;
    @track editableTimesheetEntry = {};
    @track allContacts = [];
    @track selectedManualPersonId;
    @track enteredManualTravelTime = 0.00;
    @track enteredManualPerDiem = 0;
    defaultDate = new Date().toISOString();
    @track timesheetDetailsRaw = [];
    @track currentJobStartDateTime;
    @track currentJobEndDateTime;

    @track jobColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Actions', fieldName: 'actions', style: 'width: 6rem' },
        { 
            label: 'Job Number', 
            fieldName: 'jobNumber',
            isLink: true,
            recordIdField: 'jobId', 
            style: 'width: 8rem'
        },
        { label: 'Job Name', fieldName: 'jobName', style: 'width: 15rem' },
        { label: 'Start Date Time', fieldName: 'startDate', style: 'width: 10rem' },
        { label: 'End Date Time', fieldName: 'endDate', style: 'width: 10rem' },
        { label: 'Total Man Hours', fieldName: 'totalManHours', style: 'width: 10rem' },
        { label: 'Total Hours + Travel', fieldName: 'totalHoursWithTravel', style: 'width: 12rem' },
        { label: 'Job Address', fieldName: 'jobAddress', style: 'width: 15rem' },
        { label: 'Description', fieldName: 'jobDescription', style: 'width: 15rem' }
    ];

    @track timesheetColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Actions', fieldName: 'actions', style: 'width: 6rem' },
        { label: 'Full Name', fieldName: 'contactName', style: 'width: 12rem' },
        { label: 'Clock In Time', fieldName: 'clockInTime', style: 'width: 10rem' },
        { label: 'Clock Out Time', fieldName: 'clockOutTime', style: 'width: 10rem' },
        { label: 'Work Hours', fieldName: 'workHours', style: 'width: 6rem' },
        { label: 'Travel Time', fieldName: 'travelTime', style: 'width: 6rem' },
        { label: 'Total Time', fieldName: 'totalTime', style: 'width: 6rem' },
        { label: 'Per Diem', fieldName: 'perDiem', style: 'width: 6rem' },
        { label: 'Premium', fieldName: 'premium', style: 'width: 6rem' },
        { label: 'Cost Code', fieldName: 'costCodeName', style: 'width: 8rem' }
    ];

    get formattedSelectedDate() {
        try {
            if (this.viewMode === 'day') {
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                return this.selectedDate ? this.selectedDate.toLocaleDateString('en-US', options) : '';
            } else {
                return `${this.weekStart.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })} - 
                        ${this.weekEnd.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}`;
            }
        } catch (error) {
            console.error('Error in formattedSelectedDate ::', error);
        }
    }

    get apexFormattedDate() {
        return this.selectedDate.toISOString().split('T')[0];
    }

    /** 
    * Method Name: jobDetails 
    * @description: This method processes raw job details and formats them for display in the UI.
    */
    get jobDetails() {
        try {
            if (!this.filteredJobDetailsRaw) {
                return [];
            }

            return this.filteredJobDetailsRaw.map((job, index) => {
                return {
                    key: job.mobId,
                    jobId: job.jobId,
                    values: this.jobColumns.map(col => {
                        let cell = { 
                            key: col.fieldName, 
                            value: '--', 
                            recordLink: null, 
                            isActions: false, 
                            style: col.style 
                        };

                        if (col.fieldName === 'srNo') {
                            cell.value = index + 1;
                        } else if (col.fieldName === 'actions') {
                            cell.isActions = true; 
                        } else {
                            cell.value = job[col.fieldName] || '';
                            if (col.isLink && col.recordIdField) {
                                cell.recordLink = `/${job[col.recordIdField]}`;
                            }
                        }

                        if (col.fieldName === 'startDate' || col.fieldName === 'endDate') {
                            cell.value = this.parseLiteral(cell.value);
                        }

                        if (col.fieldName === 'totalManHours') {
                            cell.value = job.totalManHours?.toFixed(2) || '0.00';
                        }

                        if (col.fieldName === 'totalHoursWithTravel') {
                            cell.value = job.totalHoursWithTravel?.toFixed(2) || '0.00';
                        }

                        return cell;
                    })
                };
            });
        } catch (error) {
            console.error('Error in jobDetails ::', error);
        }
    }
    
    get clockInTabClass() {
        return this.activeTab === 'clockin' ? 'active' : '';
    }
    
    get clockOutTabClass() {
        return this.activeTab === 'clockout' ? 'active' : '';
    }
    
    get isClockInActive(){
        return this.activeTab === 'clockin';
    }
    
    get isClockOutActive(){
        return this.activeTab === 'clockout';
    }

    get isCustomView() {
        return this.viewMode == 'custom';
    }

    get dayClass() {
        return this.viewMode === 'day' ? 'tab-nav-btn header-tab-nav-btn active' : 'tab-nav-btn header-tab-nav-btn';
    }

    get weekClass() {
        return this.viewMode === 'week' ? 'tab-nav-btn header-tab-nav-btn active' : 'tab-nav-btn header-tab-nav-btn border-inline-nav-btn';
    }

    get customClass() {
        return this.viewMode === 'custom' ? 'tab-nav-btn header-tab-nav-btn active' : 'tab-nav-btn header-tab-nav-btn';
    }

    /** 
    * Method Name: timesheetDetails 
    * @description: This method processes raw timesheet details and formats them for display in the UI.
    */
    get timesheetDetails() {
        try {
            if (!this.timesheetDetailsRaw) {
                return [];
            }

            return this.timesheetDetailsRaw.map((ts, index) => {
                return {
                    id: ts.id,
                    values: this.timesheetColumns.map(col => {
                        let cell = { value: '--', isActions: false, style: col.style };

                        if (col.fieldName === 'srNo') {
                            cell.value = index + 1;
                        } else if (col.fieldName === 'actions') {
                            cell.isActions = true; 
                        } else if (col.fieldName.includes('.')) {
                            let parts = col.fieldName.split('.');
                            let value = ts;
                            parts.forEach(p => value = value ? value[p] : null);
                            cell.value = value || '';
                        } else {
                            cell.value = ts[col.fieldName] || '';
                        }

                        // Format dates nicely
                        if (col.fieldName === 'clockInTime' || col.fieldName === 'clockOutTime') {
                            cell.value = this.parseLiteral(cell.value);
                        }

                        // Handle Per Diem - display 0 if not present
                        if (col.fieldName === 'perDiem') {
                            cell.value = ts.perDiem !== null && ts.perDiem !== undefined ? ts.perDiem : 0;
                        }

                        // Handle Premium - display Yes/No instead of true/false
                        if (col.fieldName === 'premium') {
                            cell.value = ts.premium === true ? 'Yes' : 'No';
                        }

                        return cell;
                    })
                };
            });
        } catch (error) {
            console.error('Error in timesheetDetails ::', error);
            return [];
        }
    }

    /** 
    * Method Name: connectedCallback 
    * @description: This method is called when the component is connected to the DOM.
    */
    connectedCallback() {
        try {
            this.selectedDate = new Date();
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in connectedCallback ::', error);
        }
    }

    /** 
    * Method Name: getJobRelatedMoblizationDetails 
    * @description: Method is used to get the job related mobilization details
    */
    getJobRelatedMoblizationDetails() {
        try {
            this.isLoading = true;
            
            getJobRelatedMoblizationDetails({ filterDate: this.apexFormattedDate, mode: this.viewMode, customStartDate: this.customStartDate, customEndDate: this.customEndDate })
                .then((data) => {
                    if(data != null) {
                        this.jobDetailsRaw = data;
                        this.filteredJobDetailsRaw = data;
                        console.log('getJobRelatedMoblizationDetails jobDetailsRaw => ', this.jobDetailsRaw);
                    } else {
                        this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    }
                }).catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in getJobRelatedMoblizationDetails apex ::' ,error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in getJobRelatedMoblizationDetails ::', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: parseLiteral 
    * @description: Method is used to parse the ISO date string to "YYYY-MM-DD HH:MM" format
    */
    parseLiteral(iso) {
        return iso.slice(0, 16).replace('T', ' '); // "2025-10-05 07:00"
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

    validateClockInDate (clockInValue, jobStartValue, jobEndValue) {
        const clockInDate = this.extractDateKey(clockInValue);
        const jobStartDate = this.extractDateKey(jobStartValue);
        const jobEndDate = this.extractDateKey(jobEndValue);

        if (clockInDate && jobStartDate && clockInDate !== jobStartDate && clockInDate !== jobEndDate) {
            this.showToast('Error', 'Clock In time must be on the job start date or job end date', 'error');
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
                this.showToast('Error', 'Clock Out time must be on the job start date, job end date or the following day', 'error');
                return false;
            }
        }

        return true;
    }

    get clockInMinBoundary() {
        const jobRecord = this.getCurrentJobRecord();
        const reference = this.currentJobStartDateTime
            || jobRecord?.startDate
            || (this.clockInList && this.clockInList.length > 0 ? this.clockInList[0].jobStartTime : null)
            || this.defaultStartTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get clockInMaxBoundary() {
        const jobRecord = this.getCurrentJobRecord();
        const reference = this.currentJobEndDateTime
            || jobRecord?.endDate
            || (this.clockInList && this.clockInList.length > 0 ? this.clockInList[0].jobEndTime : null)
            || this.defaultEndTime
            || this.defaultStartTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T23:59` : null;
    }

    get clockOutMinBoundary() {
        const jobRecord = this.getCurrentJobRecord();
        const reference = this.currentJobStartDateTime
            || jobRecord?.startDate
            || (this.clockOutList && this.clockOutList.length > 0 ? this.clockOutList[0].jobStartTime : null)
            || this.defaultStartTime;
        const dateKey = this.extractDateKey(reference);
        return dateKey ? `${dateKey}T00:00` : null;
    }

    get clockOutMaxBoundary() {
        const jobRecord = this.getCurrentJobRecord();
        const reference = this.currentJobEndDateTime
            || jobRecord?.endDate
            || (this.clockOutList && this.clockOutList.length > 0 ? this.clockOutList[0].jobEndTime : null)
            || this.defaultEndTime
            || this.defaultStartTime;
        const dateKey = this.extractDateKey(reference);
        if (!dateKey) {
            return null;
        }
        const nextDay = this.addDaysToDateKey(dateKey, 1);
        const boundaryKey = nextDay || dateKey;
        return `${boundaryKey}T23:59`;
    }

    getCurrentJobRecord() {
        if (!this.jobId || !this.jobDetailsRaw || !Array.isArray(this.jobDetailsRaw)) {
            return null;
        }

        return this.jobDetailsRaw.find(job => job.jobId === this.jobId || job.Id === this.jobId);
    }

    /** 
    * Method Name: handleSearch 
    * @description: Method is used to handle the search
    */
    handleSearch(event) {
        try {
            this.searchTerm = event.target.value;
            const searchKey = event.target.value.trim().toLowerCase();
    
            if (!searchKey) {
                // If input is empty, show all
                this.filteredJobDetailsRaw = this.jobDetailsRaw;
                return;
            }
    
            this.filteredJobDetailsRaw = this.jobDetailsRaw.filter(job => {
                const jobNumber = job.jobNumber
                    ? job.jobNumber.toString().toLowerCase()
                    : '';
                const jobName = job.jobName
                    ? job.jobName.toString().toLowerCase()
                    : '';
    
                return jobNumber.includes(searchKey) || jobName.includes(searchKey);
            });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleSearch ::', error);
        }
    }

    /** 
    * Method Name: handleLinkClick 
    * @description: Method is used to handle the link click
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
    * Method Name: handlePreviousDate 
    * @description: Method is used to handle the previous date
    */
    handlePreviousDate() {
        try {
            if (this.viewMode === 'day') {
                let dt = new Date(this.selectedDate);
                dt.setDate(dt.getDate() - 1);
                this.selectedDate = dt;
            } else {
                // move 1 week back
                this.selectedDate.setDate(this.selectedDate.getDate() - 7);
                this.calculateWeekRange();
            }
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handlePreviousDate ::', error);
        }
    }

    /** 
    * Method Name: handleNextDate 
    * @description: Method is used to handle the next date
    */
    handleNextDate() {
        try {
            if (this.viewMode === 'day') {
                let dt = new Date(this.selectedDate);
                dt.setDate(dt.getDate() + 1);
                this.selectedDate = dt;
            } else {
                // move 1 week forward
                this.selectedDate.setDate(this.selectedDate.getDate() + 7);
                this.calculateWeekRange();
            }
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleNextDate ::', error);
        }
    }

    /** 
    * Method Name: switchToDayView 
    * @description: Method is used to switch to day view
    */
    switchToDayView() {
        try {
            this.viewMode = 'day';
            this.selectedDate = new Date(); // reset to today
            this.customStartDate = null;
            this.customEndDate = null;
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in switchToDayView ::', error);
        }
    }

    /** 
    * Method Name: switchToWeekView 
    * @description: Method is used to switch to week view
    */
    switchToWeekView() {
        try {
            this.viewMode = 'week';
            this.customStartDate = null;
            this.customEndDate = null;
            this.selectedDate = new Date();
            this.calculateWeekRange();
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in switchToWeekView ::', error);
        }
    }

    /** 
    * Method Name: calculateWeekRange 
    * @description: Method is used to calculate the week range
    */
    calculateWeekRange() {
        try {
            let dt = new Date(this.selectedDate);
            let day = dt.getDay(); // 0=Sunday, 6=Saturday
            this.weekStart = new Date(dt);
            this.weekStart.setDate(dt.getDate() - day); // move back to Sunday
            this.weekEnd = new Date(this.weekStart);
            this.weekEnd.setDate(this.weekStart.getDate() + 6); // Saturday
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in calculateWeekRange ::', error);
        }
    }

    /** 
    * Method Name: switchToCustomView 
    * @description: Method is used to switch to custom view
    */
    switchToCustomView() {
        try {
            this.viewMode = 'custom';
    
            // Get today's date
            const today = new Date();
    
            // Get day of week (0 = Sunday, 6 = Saturday)
            const day = today.getDay();
    
            // Calculate Sunday (start of week)
            const sunday = new Date(today);
            sunday.setDate(today.getDate() - day);
    
            // Calculate Saturday (end of week)
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
    
            // Convert to yyyy-MM-dd (for <input type="date">)
            const toISODate = date => date.toISOString().split('T')[0];
    
            this.customStartDate = toISODate(sunday);
            this.customEndDate = toISODate(saturday);
    
            // Optionally trigger Apex call immediately with defaults
            this.getJobRelatedMoblizationDetails();
        } catch (error) {
            console.error('Error in switchToCustomView :: ', error);
        }
    }

    /** 
    * Method Name: handleCustomDateChange 
    * @description: handle custom date filter change and call method to filter data
    */
    handleCustomDateChange(event) {
        const field = event.target.dataset.field;
        if (field === 'filterStart') {
            this.customStartDate = event.target.value;
        } else if (field === 'filterEnd') {
            this.customEndDate = event.target.value;
        }

        if(this.customStartDate && this.customEndDate) {
            // Wait 2 seconds before fetching data
            clearTimeout(this._dateChangeTimeout); // clear previous timer if any
            this._dateChangeTimeout = setTimeout(() => {
                this.getJobRelatedMoblizationDetails();
            }, 1000);
            // this.getJobRelatedMoblizationDetails();
        }
    }

    /** 
    * Method Name: handleActionClick 
    * @description: Method is used to handle the row action click
    */
    handleActionClick(event) {
        try {
            const jobId = event.currentTarget.dataset.job;
            this.jobId = jobId;
            const mobId = event.currentTarget.dataset.mobid;
            this.mobId = mobId;

            const jobRecord = this.getCurrentJobRecord();
            if (jobRecord) {
                this.currentJobStartDateTime = jobRecord.startDate;
                this.currentJobEndDateTime = jobRecord.endDate;
            }
            
            const actionType = event.currentTarget.dataset.action;
    
            if (actionType === 'clock') {
                this.getClockInDetails();
            } else if (actionType === 'list') {
                this.getJobRelatedTimesheetDetails();
            }
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleActionClick ::', error);
        }
    }

    /** 
    * Method Name: getClockInDetails 
    * @description: Method is used to get the clock in details
    */
    getClockInDetails() {
        try {
            this.showClockInOutModal = true;
            this.isLoading = true;
            
            getMobilizationMembersWithStatus({ mobId: this.mobId})
                .then(result => {
                    if(result != null) {
                        console.log('getMobilizationMembersWithStatus result :: ', result);
                        
                        this.clockInList = result.clockIn;
    
                        this.clockInOptions = this.clockInList.map(person => ({
                            label: person.contactName,
                            value: person.contactId
                        }));
    
                        if (this.clockInList.length > 0) {
                            this.defaultStartTime = result.clockIn[0].jobStartTime.slice(0, 16);
                        } else {
                            this.defaultStartTime = new Date().toISOString();
                        }
                        this.clockInTime = this.defaultStartTime;
    
                        if(result.costCodeDetails.length > 0) {
                            const costCodeMap = result.costCodeDetails[0].costCodeDetails; // this is an object
                            this.costCodeOptions = Object.keys(costCodeMap).map(key => ({
                                label: costCodeMap[key], // the name
                                value: key               // the id
                            }));
                        }
                    } else {
                        this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    }
                })
                .catch(error => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error fetching data getMobilizationMembersWithStatus apex :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in getClockInDetails ::', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleClockInTab 
    * @description: Method is used to handle the clock in tab
    */
    handleClockInTab(){
        this.activeTab = 'clockin';
        this.selectedContactId = null;
        this.selectedCostCodeId = null;
        this.isSelectedContactClockedIn = false;
        this.clockInTime = this.defaultStartTime;
        this.clockOutTime = this.defaultEndTime;
        this.previousClockInTime = null;
        this.getClockInDetails();
    }

    /** 
    * Method Name: handleClockIn 
    * @description: Method is used to handle the clock in action
    */
    handleClockIn() {
        try {
            if(!this.selectedContactId || !this.clockInTime || !this.selectedCostCodeId) {
                this.showToast('Error', 'Please fill value in all required the fields!', 'error');
                console.error('No contact/cost code/time selected');
                return;
            }

            this.isLoading = true;

            const selectedRecordDetails = this.clockInList.find(
                record => record.contactId === this.selectedContactId
            );

            if (!selectedRecordDetails) {
                this.showToast('Error', 'Unable to determine job details for the selected contact', 'error');
                this.isLoading = false;
                return;
            }

            const jobStartReference = selectedRecordDetails?.jobStartTime || this.currentJobStartDateTime;
            if (!this.validateClockInDate(this.clockInTime, jobStartReference)) {
                this.isLoading = false;
                return;
            }

            const params = {
                actionType: 'clockIn',
                jobId: this.jobId,
                mobId: this.mobId,
                contactId: this.selectedContactId,
                costCodeId: this.selectedCostCodeId,
                clockInTime: this.clockInTime,
                isTimeSheetNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetNull : true,
                timesheetId: selectedRecordDetails ? selectedRecordDetails?.timesheetId : null,
                isTimeSheetEntryNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetEntryNull : true,
                timesheetEntryId: selectedRecordDetails ? selectedRecordDetails?.timesheetEntryId : null,
                mobMemberId: selectedRecordDetails ? selectedRecordDetails?.mobMemberId : null,
            };
            console.log('createTimesheetRecords params :: ', params);
            
            createTimesheetRecords({ params: JSON.stringify(params)})
                .then(result => {
                    console.log('createTimesheetRecords result :: ', result);
                    if(result == true) {
                        this.selectedContactId = null;
                        this.selectedCostCodeId = null;
                        this.template.querySelector('.custom-select-costcode').value = '';
                        this.isSelectedContactClockedIn = false;
                        this.clockInTime = this.defaultStartTime;
                        this.getClockInDetails();
                        this.showToast('Success', 'User Clocked In Successfully', 'success');
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
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleClockIn ::', error);
            this.isLoading = false;
        }
    }
    
    /** 
    * Method Name: handleClockOutTab 
    * @description: Method is used to handle the clock out tab
    */
    handleClockOutTab(){
        this.activeTab = 'clockout';
        this.selectedContactId = null;
        this.selectedCostCodeId = null;
        this.isSelectedContactClockedIn = false;
        this.clockInTime = this.defaultStartTime;
        this.clockOutTime = this.defaultEndTime;
        this.previousClockInTime = null;
        this.getClockOutDetails();
    }

    /** 
    * Method Name: getClockOutDetails 
    * @description: Method is used to get the clock out details
    */
    getClockOutDetails() {
        try {
            this.showClockInOutModal = true;
            this.isLoading = true;
            
            getMobilizationMembersWithStatus({ mobId: this.mobId})
                .then(result => {
                    console.log('getMobilizationMembersWithStatus result :: ', result);

                    this.clockOutList = result.clockOut;
                    
                    // Clock Out list and options
                    this.clockOutList = result.clockOut.map(person => ({
                        ...person,
                        clockInTime: person.clockInTime, // Clock In time from Apex
                    }));
                    
                    this.clockOutOptions = this.clockOutList.map(person => ({
                        label: person.contactName,
                        value: person.contactId
                    }));

                    if (this.clockOutList.length > 0) {
                        this.defaultEndTime = result.clockOut[0].jobEndTime.slice(0, 16);
                    } else {
                        this.defaultEndTime = new Date().toISOString();
                    }
                    this.clockOutTime = this.defaultEndTime;
                })
                .catch(error => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error fetching data getMobilizationMembersWithStatus apex :: ', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in getClockInDetails ::', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleClockOut 
    * @description: Method is used to handle the clock out action
    */
    handleClockOut() {
        try {
            if(!this.selectedContactId || !this.clockOutTime) {
                this.showToast('Error', 'Please fill value in all the required fields!', 'error');
                console.error('No contact/time selected');
                return;
            }
            
            const selectedRecordDetails = this.clockOutList.find(
                record => record.contactId === this.selectedContactId
            );

            if (!selectedRecordDetails) {
                this.showToast('Error', 'Unable to determine job details for the selected contact', 'error');
                return;
            }

            if(new Date(this.clockOutTime.replace(' ', 'T')) <= new Date(selectedRecordDetails.clockInTime.slice(0, 16).replace('T', ' '))) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }

            const jobEndReference = selectedRecordDetails?.jobEndTime || this.currentJobEndDateTime;
            const jobStartReference = selectedRecordDetails?.jobStartTime || this.currentJobStartDateTime;

            if (!this.validateClockOutDate(this.clockOutTime, jobStartReference, jobEndReference)) {
                return;
            }
            
            this.isLoading = true;

            const params = {
                actionType: 'clockOut',
                jobId: this.jobId,
                mobId: this.mobId,
                contactId: this.selectedContactId,
                clockInTime: selectedRecordDetails ? selectedRecordDetails?.clockInTime : this.clockInTime,
                clockOutTime: this.clockOutTime,
                isTimeSheetNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetNull : true,
                timesheetId: selectedRecordDetails ? selectedRecordDetails?.timesheetId : null,
                isTimeSheetEntryNull: selectedRecordDetails ? selectedRecordDetails?.isTimesheetEntryNull : true,
                timesheetEntryId: selectedRecordDetails ? selectedRecordDetails?.timesheetEntryId : null,
                mobMemberId: selectedRecordDetails ? selectedRecordDetails?.mobMemberId : null,
            };
            console.log('createTimesheetRecords params :: ', params);
            
            createTimesheetRecords({ params: JSON.stringify(params)})
                .then(result => {
                    console.log('createTimesheetRecords result :: ', result);
                    if(result == true) {
                        this.selectedContactId = null;
                        this.previousClockInTime = null;
                        this.clockOutTime = this.defaultEndTime;
                        this.getClockOutDetails();
                        this.getJobRelatedMoblizationDetails();
                        this.showToast('Success', 'User Clocked Out Successfully', 'success');
                    } else {
                        this.showToast('Error', 'Failed to Clock Out User', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error creating timesheet records createTimesheetRecords apex :: ', error);
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleClockIn ::', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleInputChange 
    * @description: Method is used to handle input field changes
    */
    handleInputChange(event) {
        try {
            let dataField = event.target.dataset.field;
            let value = event.target.value;
    
            if(dataField == 'costCode') {
                this.selectedCostCodeId = value;
            } else if(dataField == 'clockIn' || dataField == 'clockOut') {
                this.selectedContactId = value;
                this.clockInTime = this.defaultStartTime;
                this.clockOutTime = this.defaultEndTime;
        
                if(dataField == 'clockIn') {
                    // Suppose your fetched list is stored in this.wrapperList
                    const selectedContact = this.clockInList.find(
                        item => item.contactId === this.selectedContactId
                    );
            
                    if (selectedContact) {
                        this.isSelectedContactClockedIn = selectedContact.isAgain;  
                    } else {
                        this.isSelectedContactClockedIn = false; // default
                    }
                }
        
                if(dataField == 'clockOut') {
                    // Suppose your fetched list is stored in this.wrapperList
                    const selectedContact = this.clockOutList.find(
                        item => item.contactId === this.selectedContactId
                    );
            
                    if (selectedContact) {
                        this.previousClockInTime = this.parseLiteral(selectedContact.clockInTime);  
                    }
                }
            } else if(dataField == 'manualContact') {
                this.selectedManualPersonId = value;
            } else if(dataField == 'TravelTime') {
                this.enteredManualTravelTime = value;
            } else if (dataField == 'PerDiem') {
                this.enteredManualPerDiem = value;
            } else if (dataField == 'clockInDateTime') {
                this.clockInTime = value;
            } else if (dataField == 'clockOutDateTime') {
                this.clockOutTime = value;
            }
        } catch (error) {
            console.error('Error in handleInputChange :: ', error);
        }
    }

    /** 
    * Method Name: closeClockInOutModal 
    * @description: Method is used to close the clock in/out modal
    */
    closeClockInOutModal() {
        this.activeTab = 'clockin';
        this.showClockInOutModal = false;
        this.jobId = null;
        this.mobId = null;
        this.selectedContactId = null;
        this.selectedCostCodeId = null;
        this.clockInList = [];
        this.clockOutList = [];
        this.previousClockInTime = null;
        this.isSelectedContactClockedIn = false;
    }

    /** 
    * Method Name: getJobRelatedTimesheetDetails 
    * @description: Method is used to get the job related timesheet details
    */
    getJobRelatedTimesheetDetails() {
        try {
            this.showTimesheetModal = true;
            this.isLoading = true;

            const jobRecord = this.getCurrentJobRecord();
            if (jobRecord) {
                this.currentJobStartDateTime = jobRecord.startDate;
                this.currentJobEndDateTime = jobRecord.endDate;
            }

            getTimeSheetEntryItems({ mobId: this.mobId })
                .then((data) => {
                    if(data != null) {
                        this.timesheetDetailsRaw = data.map(item => {
                            return {
                                ...item,
                                id: item?.id,
                                travelTime: item?.travelTime != null ? parseFloat(item.travelTime).toFixed(2) : 0.00,
                                perDiem: item?.perDiem != null ? item.perDiem : 0,
                                totalTime: item?.totalTime != null ? parseFloat(item.totalTime).toFixed(2) : 0.00
                            };
                        });
                        console.log('getTimeSheetEntryItems timesheetDetailsRaw :: ', this.timesheetDetailsRaw);
                    } else {
                        this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    }
                }).catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in getJobRelatedTimesheetDetails apex ::' ,error);
                })
                .finally(() => {
                    this.isLoading = false;
                    this.manualTimesheetEntry = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in getJobRelatedTimesheetDetails ::', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleAddTimesheet 
    * @description: Method is used to handle the add timesheet action
    */
    handleAddTimesheet() {
        try {
            this.manualTimesheetEntry = true;
            this.isLoading = true;
    
            getContactsAndCostcode({})
                .then((data) => {
                    if(data != null) {
                        console.log('getContactsAndCostcode data :: ', data);
                        this.allContacts = data.contacts.map(contact => ({
                            label: contact.Name,
                            value: contact.Id
                        }));
    
                        this.costCodeOptions = data.costCodes.map(costCode => ({
                            label: costCode.Name,
                            value: costCode.Id
                        }));
                    } else {
                        this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    }
                }).catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in getContactsAndCostcode apex ::' ,error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleAddTimesheet ::', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: closeManualTimesheetModal 
    * @description: Method is used to close the manual timesheet modal
    */
    closeManualTimesheetModal() {
        this.manualTimesheetEntry = false;
        this.selectedManualPersonId = null;
        this.selectedCostCodeId = null;
        this.clockInTime = null;
        this.clockOutTime = null;
        this.allContacts = [];
        this.costCodeOptions = [];
    }

    /** 
    * Method Name: createManualTimesheet 
    * @description: Method is used to create the manual timesheet record
    */
    createManualTimesheet() {
        try {
            console.log(this.selectedManualPersonId);
            console.log(this.selectedCostCodeId);
            console.log(this.clockInTime);
            console.log(this.clockOutTime);
            
            if(!this.selectedManualPersonId || !this.selectedCostCodeId || !this.clockInTime || !this.clockOutTime) {
                this.showToast('Error', 'Please fill value in all the required fields!', 'error');
                console.error('No contact/cost code/clock in time/clock out time selected');
                return;
            }

            if(new Date(this.clockOutTime.replace(' ', 'T')) <= new Date(this.clockInTime.replace(' ', 'T'))) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }

            const jobRecord = this.getCurrentJobRecord();
            const jobStartReference = jobRecord?.startDate || this.currentJobStartDateTime;
            const jobEndReference = jobRecord?.endDate || this.currentJobEndDateTime;

            if (!this.validateClockInDate(this.clockInTime, jobStartReference, jobEndReference)) {
                return;
            }

            if (!this.validateClockOutDate(this.clockOutTime, jobStartReference, jobEndReference)) {
                return;
            }
            console.log('this.enteredManualPerDiem  ::', this.enteredManualPerDiem );
            
            if (this.enteredManualPerDiem != 0 && this.enteredManualPerDiem != 1) {
                this.showToast('Error', 'Per Diem must be either 0 or 1.', 'error');
                return;
            }

            this.isLoading = true;
    
            let jobStartDate = this.jobDetailsRaw.map(job => {
                let dt = new Date(job.startDate); // parse ISO string
                let year = dt.getFullYear();
                let month = dt.getMonth() + 1; // JS months are 0-based
                let day = dt.getDate();
                
                let dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                return dateStr;
            });
    
            let jobEndDate = this.jobDetailsRaw.map(job => {
                let dt = new Date(job.endDate); // parse ISO string
                let year = dt.getFullYear();
                let month = dt.getMonth() + 1; // JS months are 0-based
                let day = dt.getDate();
                
                let dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                return dateStr;
            });
    
            const params = {
                jobId : this.jobId,
                mobId : this.mobId,
                contactId : this.selectedManualPersonId,
                costCodeId : this.selectedCostCodeId,
                clockInTime : this.clockInTime,
                clockOutTime : this.clockOutTime,
                jobStartDate : jobStartDate.toString(),
                jobEndDate : jobEndDate.toString(),
                travelTime : this.enteredManualTravelTime ? String(this.enteredManualTravelTime) : '0.00',
                perDiem : this.enteredManualPerDiem ? String(this.enteredManualPerDiem) : '0'
            }

            console.log('createManualTimesheetRecords params :: ', params);
    
            createManualTimesheetRecords({params : JSON.stringify(params)})
                .then((result) => {
                    console.log('createManualTimesheetRecords result :: ' , result);
                    if(result == true) {
                        this.getJobRelatedTimesheetDetails();
                        this.getJobRelatedMoblizationDetails();
                        this.showToast('Success', 'Timesheet created successfully', 'success');
                        this.selectedManualPersonId = null;
                        this.selectedCostCodeId = null;
                        this.clockInTime = null;
                        this.clockOutTime = null;
                        this.enteredManualTravelTime = null;
                        this.enteredManualPerDiem = null;
                    } else {
                        this.showToast('Error', 'Failed to create timesheet record. Please try again.', 'error');
                    }
                })
                .catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in createManualTimesheetRecords :: ' , error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in createManualTimesheet :: ', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleEditTimesheetClick 
    * @description: Method is used to handle the edit timesheet action
    */
    handleEditTimesheetClick(event) {
        try {
            this.selectedTimesheetEntryLineId = event.currentTarget.dataset.id;
            
            // Find the record in timesheetDetailsRaw
            const record = this.timesheetDetailsRaw.find(item => item.id === this.selectedTimesheetEntryLineId);
            
            if(record) {
                // Create a copy for editing
                this.editableTimesheetEntry = {
                    Id: record.id,
                    TSEId: record.TSEId,
                    FullName: record.contactName,
                    ClockIn: record.clockInTime.slice(0, 16),
                    ClockOut: record.clockOutTime.slice(0, 16),
                    TravelTime: record.travelTime || 0.00,
                    PerDiem: record.perDiem || 0.00,
                    premium: record?.premium || false
                };
                
                this.editTimesheetEntry = true;
            }
        } catch (error) {
            console.error('Error in handleEditTimesheetClick:', error);
        }
    }

    /** 
    * Method Name: handleDeleteTimesheetClick 
    * @description: Method is used to handle the delete timesheet action
    */
    handleDeleteTimesheetClick(event) {
        try {
            this.showDeleteConfirmModal = true;
            this.selectedTimesheetEntryLineId = event.currentTarget.dataset.id;
        } catch (error) {
            console.error('Error in handleDeleteTimesheetClick:', error);
        }
    }

    /** 
    * Method Name: closeDeleteConfirmModal 
    * @description: Method is used to close the delete confirm modal
    */
    closeDeleteConfirmModal() {
        this.showDeleteConfirmModal = false;
        this.selectedTimesheetEntryLineId = null;
    }

    /** 
    * Method Name: handleDeleteConfirmTSEL 
    * @description: Method is used to handle the delete confirm action
    */
    handleDeleteConfirmTSEL() {
        try {
            this.isLoading = true;
            deleteTimesheetEntry({TSELId : this.selectedTimesheetEntryLineId})
                .then((result) => {
                    if(result == true) {
                        this.selectedTimesheetEntryLineId = null;
                        this.showDeleteConfirmModal = false;
                        this.getJobRelatedTimesheetDetails();
                        this.getJobRelatedMoblizationDetails();
                        this.showToast('Success', 'Timesheet deleted successfully', 'success');
                    } else {
                        this.showToast('Error', 'Failed to delete timesheet record. Please try again.', 'error');
                    }
                })
                .catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in deleteTimesheetEntry :: ', error);
                    this.isLoading = false;
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in handleDeleteTimesheetClick:', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleEditTSELFieldChange 
    * @description: Method is used to handle the field change in edit timesheet modal
    */
    handleEditTSELFieldChange(event) {
        try {
            const field = event.target.dataset.field; // data-field attribute on input
            let value;

            // Handle checkbox separately
            if (event.target.type === 'checkbox') {
                value = event.target.checked;
            } else {
                value = event.target.value;
            }
    
            if(field && this.editableTimesheetEntry) {
                // Update variable dynamically
                this.editableTimesheetEntry[field] = value;
            }
        } catch (error) {
            console.error('Error in handleEditTSELFieldChange:', error);
        }
    }

    /** 
    * Method Name: handleSaveTSEL 
    * @description: Method is used to save the edited timesheet entry
    */
    handleSaveTSEL() {
        try {
            const entry = this.editableTimesheetEntry;
            
            // Check ClockIn
            if (!entry.ClockIn || entry.ClockIn.toString().trim() === '') {
                this.showToast('Error', 'Clock In Time cannot be empty', 'error');
                return;
            }

            // Check ClockOut
            if (!entry.ClockOut || entry.ClockOut.toString().trim() === '') {
                this.showToast('Error', 'Clock Out Time cannot be empty', 'error');
                return;
            }

            // Normalize PerDiem
            if (entry.PerDiem === null || entry.PerDiem === undefined || entry.PerDiem.toString().trim() === '') {
                entry.PerDiem = 0;
            } else {
                let perDiemNum = Number(entry.PerDiem);
                if (perDiemNum !== 0 && perDiemNum !== 1) {
                    this.showToast('Error', 'Per Diem must be 0 or 1', 'error');
                    return false;
                }
                entry.PerDiem = perDiemNum; // store as number
            }

            if(new Date(entry.ClockOut.replace(' ', 'T')) <= new Date(entry.ClockIn.replace(' ', 'T'))) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }

            const jobRecord = this.getCurrentJobRecord();
            const jobStartReference = jobRecord?.startDate || this.currentJobStartDateTime;
            const jobEndReference = jobRecord?.endDate || this.currentJobEndDateTime;

            if (!this.validateClockInDate(entry.ClockIn, jobStartReference, jobEndReference)) {
                return;
            }

            if (!this.validateClockOutDate(entry.ClockOut, jobStartReference, jobEndReference)) {
                return;
            }

            this.isLoading = true;
            // Deep clone and convert all values to string
            let stringifiedEntry = JSON.stringify(
                Object.fromEntries(
                    Object.entries(this.editableTimesheetEntry).map(([key, value]) => {
                        // If null or undefined, make it empty string
                        if (value === null || value === undefined) {
                            value = '';
                        }
                        return [key, String(value)];
                    })
                )
            );

            console.log('UpupdateTimesheetsdated params:', stringifiedEntry);

            updateTimesheets({ params: stringifiedEntry })
                .then((result) => {
                    if(result == true) {
                        this.selectedTimesheetEntryLineId = null;
                        this.getJobRelatedTimesheetDetails();
                        this.getJobRelatedMoblizationDetails();
                        this.showToast('Success', 'Timesheet entry updated successfully', 'success');
                        this.closeEditTimesheetModal();
                    } else {
                        this.showToast('Error', 'Failed to update timesheet entry. Please try again.', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error saving timesheet entry saveTravelTimeOnTimesheets apex :: ', error);
                    this.showToast('Error', 'Something went wrong. Please contact system admin' , 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleSaveTSEL:', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: closeEditTimesheetModal 
    * @description: Method is used to close the edit timesheet modal
    */
    closeEditTimesheetModal() {
        this.editTimesheetEntry = false;
        this.editableTimesheetEntry = {};
    }

    /** 
    * Method Name: closeTimesheetModal 
    * @description: Method is used to close the timesheet modal
    */
    closeTimesheetModal() {
        this.showTimesheetModal = false;
        this.jobId = null;
        this.mobId = null;
        this.editTimesheetEntry = false;
        this.timesheetDetailsRaw = [];
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