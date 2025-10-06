import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getJobRelatedMoblizationDetails from '@salesforce/apex/JobDetailsPageController.getJobRelatedMoblizationDetails';
import getTimeSheetEntryItems from '@salesforce/apex/JobDetailsPageController.getTimeSheetEntryItems';
import getMobilizationMembersWithStatus from '@salesforce/apex/JobDetailsPageController.getMobilizationMembersWithStatus';
import createTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createTimesheetRecords';
import getContactsAndCostcode from '@salesforce/apex/JobDetailsPageController.getContactsAndCostcode';
import createManualTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createManualTimesheetRecords';
import updateTimesheets from '@salesforce/apex/JobDetailsPageController.updateTimesheets';

export default class JobDetailsPage extends LightningElement {
    @track jobDetailsRaw;
    @track filteredJobDetailsRaw;
    @track isLoading = true;
    @track selectedDate;
    @track viewMode = 'day';
    @track weekStart;
    @track weekEnd;
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
    @track selectedTimesheetEntryLineId;
    @track editableTimesheetEntry = {};
    @track allContacts = [];
    @track selectedManualPersonId;
    @track enteredManualTravelTime = 0.00;
    @track enteredManualPerDiem = 0;
    defaultDate = new Date().toISOString();
    @track timesheetDetailsRaw = [];

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
        { label: 'Job Address', fieldName: 'jobAddress', style: 'width: 15rem' },
        { label: 'Status', fieldName: 'status', style: 'width: 12rem' },
        { label: 'Description', fieldName: 'jobDescription', style: 'width: 15rem' }
    ];

    @track timesheetColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Actions', fieldName: 'actions', style: 'width: 6rem' },
        { label: 'Full Name', fieldName: 'contactName', style: 'width: 12rem' },
        { label: 'Clock In Time', fieldName: 'clockInTime', style: 'width: 10rem' },
        { label: 'Clock Out Time', fieldName: 'clockOutTime', style: 'width: 10rem' },
        { label: 'Travel Time', fieldName: 'travelTime', style: 'width: 6rem' },
        { label: 'Per Diem', fieldName: 'perDiem', style: 'width: 6rem' },
        { label: 'Total Time', fieldName: 'totalTime', style: 'width: 6rem' },
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
                            value: '', 
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

                        return cell;
                    })
                };
            });
        } catch (error) {
            console.error('Error in jobDetails ::', error);
        }
    }

    get clockInOutModalClass() {
        return this.activeTab === 'clockin' ? 'slds-modal__container clock-in-popup' : 'slds-modal__container';
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

    get dayClass() {
        return this.viewMode === 'day' ? 'dayViewBtn clock-in-button' : 'dayViewBtn close-btn';
    }

    get weekClass() {
        return this.viewMode === 'week' ? 'weekViewBtn clock-in-button' : 'weekViewBtn close-btn';
    }

    get customClass() {
        return this.viewMode === 'custom' ? 'customViewBtn clock-in-button' : 'customViewBtn close-btn';
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
                        let cell = { value: '', isActions: false, style: col.style };

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
            console.log('Fetching job details for date:', this.apexFormattedDate, 'in', this.viewMode, 'mode');
            
            getJobRelatedMoblizationDetails({ filterDate: this.apexFormattedDate, mode: this.viewMode })
                .then((data) => {
                    this.jobDetailsRaw = data;
                    this.filteredJobDetailsRaw = data;
                    console.log('jobDetailsRaw => ', this.jobDetailsRaw);
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

    /** 
    * Method Name: handleSearch 
    * @description: Method is used to handle the search
    */
    handleSearch(event) {
        try {
            const searchKey = event.target.value.toLowerCase();
    
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
            const link = event.currentTarget.dataset.link;
            if (link) {
                window.open(link, '_blank');
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
        this.viewMode = 'custom';
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
            
            const actionType = event.currentTarget.dataset.action;
    
            console.log('Clicked Action:', actionType, 'for Job:', jobId, ' and Mob:', mobId, '');
    
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
                    console.log('result', result);
                    
                    this.clockInList = result.clockIn;

                    this.clockInOptions = this.clockInList.map(person => ({
                        label: person.contactName,
                        value: person.contactId
                    }));
                    console.log('Clock In Options:', this.clockInOptions);

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
                this.showToast('Error', 'Please fill value in all the fields!', 'error');
                console.error('No contact/cost code/time selected');
                return;
            }

            this.isLoading = true;

            const selectedRecordDetails = this.clockInList.find(
                record => record.contactId === this.selectedContactId
            );

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
            console.log('params', params);
            console.log('JSON.stringify(params)', JSON.stringify(params));
            
            createTimesheetRecords({ params: JSON.stringify(params)})
                .then(result => {
                    console.log('result', result);
                    if(result == true) {
                        this.selectedContactId = null;
                        this.selectedCostCodeId = null;
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
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleClockIn ::', error);
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
                    console.log('result', result);

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
                    console.log('Clock Out Options:', this.clockOutOptions);

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
                console.error('No contact/time selected');
                return;
            }

            this.isLoading = true;

            const selectedRecordDetails = this.clockOutList.find(
                record => record.contactId === this.selectedContactId
            );

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
            console.log('params', params);
            console.log('JSON.stringify(params)', JSON.stringify(params));
            
            createTimesheetRecords({ params: JSON.stringify(params)})
                .then(result => {
                    console.log('result', result);
                    if(result == true) {
                        this.selectedContactId = null;
                        this.previousClockInTime = null;
                        this.clockOutTime = this.defaultEndTime;
                        this.getClockOutDetails();
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
    * Method Name: handlePersonChange 
    * @description: Method is used to handle the person change in clock in/out modal
    */
    handlePersonChange(event) {
        this.selectedContactId = event.target.value;
        let dataField = event.target.dataset.field;
        console.log('Selected Contact ID:', this.selectedContactId, ' for ', dataField);
        this.clockInTime = this.defaultStartTime;
        this.clockOutTime = this.defaultEndTime;

        if(dataField == 'clockIn') {
            // Suppose your fetched list is stored in this.wrapperList
            const selectedContact = this.clockInList.find(
                item => item.contactId === this.selectedContactId
            );
    
            if (selectedContact) {
                this.isSelectedContactClockedIn = selectedContact.isAgain;  
                console.log('isAgain for contact ' + this.selectedContactId + ' = ' + this.isSelectedContactClockedIn);
            } else {
                this.isSelectedContactClockedIn = false; // default
                console.log('No match found for ' + this.selectedContactId);
            }
        }

        if(dataField == 'clockOut') {
            // Suppose your fetched list is stored in this.wrapperList
            const selectedContact = this.clockOutList.find(
                item => item.contactId === this.selectedContactId
            );
    
            if (selectedContact) {
                this.previousClockInTime = this.parseLiteral(selectedContact.clockInTime);  
                console.log('previousClockInTime for contact ' + this.selectedContactId + ' = ' + this.previousClockInTime);
            }
        }
    }

    /** 
    * Method Name: handleCostCodeChange 
    * @description: Method is used to handle the cost code change in clock in/out modal
    */
    handleCostCodeChange(event) {
        this.selectedCostCodeId = event.target.value;
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

            let jobStartDate = this.jobDetailsRaw.map(job => {
                let dt = new Date(job.startDate); // parse ISO string
                let year = dt.getFullYear();
                let month = dt.getMonth() + 1; // JS months are 0-based
                let day = dt.getDate();
                
                let dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                return dateStr;
            });

            console.log('jobStartDate', jobStartDate);
            

            getTimeSheetEntryItems({ jobId: this.jobId, jobStartDate: jobStartDate.toString() })
                .then((data) => {
                    console.log('data', data);
                    
                    this.timesheetDetailsRaw = data.map(item => {
                        return {
                            ...item,
                            id: item?.id,
                            travelTime: item?.travelTime != null ? parseFloat(item.travelTime).toFixed(2) : 0.00,
                            perDiem: item?.perDiem != null ? item.perDiem : 0,
                            totalTime: item?.totalTime != null ? parseFloat(item.totalTime).toFixed(2) : 0.00
                        };
                    });
                    console.log(this.timesheetDetailsRaw);
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
                    console.log('data', data);
                    this.allContacts = data.contacts.map(contact => ({
                        label: contact.Name,
                        value: contact.Id
                    }));

                    this.costCodeOptions = data.costCodes.map(costCode => ({
                        label: costCode.Name,
                        value: costCode.Id
                    }));

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
    * Method Name: handleManualPersonChange 
    * @description: Method is used to handle the manual person change in manual timesheet modal
    */
    handleManualPersonChange(event) {
        this.selectedManualPersonId = event.target.value;
    }

    handleManualFieldChange(event) {
        try {
            const field = event.target.dataset.field; // data-field attribute on input
            const value = event.target.value;
    
            if(field == 'TravelTime') {
                this.enteredManualTravelTime = value;
            } else if (field == 'PerDiem') {
                this.enteredManualPerDiem = value;
            }
        } catch (error) {
            console.error('Error in handleEditTSELFieldChange:', error);
        }
    }

    /** 
    * Method Name: handleManualClockInDateChange 
    * @description: Method is used to handle the manual clock in date change in manual timesheet modal
    */
    handleManualClockInDateChange(event) { 
        this.clockInTime = event.target.value;
    }

    /** 
    * Method Name: handleManualClockOutDateChange 
    * @description: Method is used to handle the manual clock out date change in manual timesheet modal
    */
    handleManualClockOutDateChange(event) {
        this.clockOutTime = event.target.value;
    }

    /** 
    * Method Name: createManualTimesheet 
    * @description: Method is used to create the manual timesheet record
    */
    createManualTimesheet() {
        try {
            if(!this.selectedManualPersonId || !this.selectedCostCodeId || !this.clockInTime || !this.clockOutTime) {
                this.showToast('Error', 'Please fill value in all the fields!', 'error');
                console.error('No contact/cost code/clock in time/clock out time selected');
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

            console.log(params);
    
            createManualTimesheetRecords({params : JSON.stringify(params)})
                .then((result) => {
                    console.log('result :: ' , result);
                    if(result == true) {
                        this.getJobRelatedTimesheetDetails();
                        this.showToast('Success', 'Timesheet created successfully', 'success');
                        this.selectedManualPersonId = null;
                        this.selectedCostCodeId = null;
                        this.clockInTime = null;
                        this.clockOutTime = null;
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
                    ClockIn: record.clockInTime,
                    ClockOut: record.clockOutTime,
                    TravelTime: record.travelTime || 0.00,
                    PerDiem: record.perDiem || 0.00
                };
                console.log('Editable Entry:', this.editableTimesheetEntry);
                
                this.editTimesheetEntry = true;
            }
        } catch (error) {
            console.error('Error in handleEditTimesheetClick:', error);
        }
    }

    /** 
    * Method Name: handleEditTSELFieldChange 
    * @description: Method is used to handle the field change in edit timesheet modal
    */
    handleEditTSELFieldChange(event) {
        try {
            const field = event.target.dataset.field; // data-field attribute on input
            const value = event.target.value;
    
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
            console.log('Attempting to save entry:', entry);
            
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

            console.log('Updated entry:', stringifiedEntry);

            updateTimesheets({ params: stringifiedEntry })
                .then((result) => {
                    if(result == true) {
                        this.getJobRelatedTimesheetDetails();
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