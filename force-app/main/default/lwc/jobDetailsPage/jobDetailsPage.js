import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getJobRelatedMoblizationDetails from '@salesforce/apex/JobDetailsPageController.getJobRelatedMoblizationDetails';
import getTimeSheetEntryItems from '@salesforce/apex/JobDetailsPageController.getTimeSheetEntryItems';
import getMobilizationMembersWithStatus from '@salesforce/apex/JobDetailsPageController.getMobilizationMembersWithStatus';
import createTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createTimesheetRecords';
import getContactsAndCostcode from '@salesforce/apex/JobDetailsPageController.getContactsAndCostcode';
import createManualTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createManualTimesheetRecords';
import saveTravelTimeOnTimesheets from '@salesforce/apex/JobDetailsPageController.saveTravelTimeOnTimesheets';

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
    @track selectedCostCodeId;
    @track defaultStartTime;
    @track clockInTime;
    @track defaultEndTime;
    @track clockOutTime;
    @track manualTimesheetEntry = false;
    @track allContacts = [];
    @track selectedManualPersonId;
    @track isTravelTimeEdited = false;
    @track editStates = {};
    defaultDate = new Date().toISOString();
    @track timesheetDetailsRaw = [];

    @track jobColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Actions', fieldName: 'actions', style: 'width: 6rem' },
        { 
            label: 'Job Number', 
            fieldName: 'wfrecon__Job__r.Name',
            isLink: true,
            recordIdField: 'wfrecon__Job__c', 
            style: 'width: 8rem'
        },
        { label: 'Job Name', fieldName: 'wfrecon__Job__r.wfrecon__Job_Name__c', style: 'width: 15rem' },
        { label: 'Start Date Time', fieldName: 'wfrecon__Start_Date__c', style: 'width: 10rem' },
        { label: 'End Date Time', fieldName: 'wfrecon__End_Date__c', style: 'width: 10rem' },
        { label: 'Job Address', fieldName: 'wfrecon__Job__r.wfrecon__Address__c', style: 'width: 15rem' },
        { label: 'Status', fieldName: 'wfrecon__Mobilization_Status__c', style: 'width: 12rem' },
        { label: 'Description', fieldName: 'wfrecon__Job__r.wfrecon__Description__c', style: 'width: 15rem' }
    ];


    @track timesheetColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Full Name', fieldName: 'wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Contact__r.Name', style: 'width: 12rem' },
        { label: 'Clock In Time', fieldName: 'wfrecon__Clock_In_Time__c', style: 'width: 10rem' },
        { label: 'Clock Out Time', fieldName: 'wfrecon__Clock_Out_Time__c', style: 'width: 10rem' },
        { label: 'Travel Time', fieldName: 'wfrecon__Travel_Time__c', style: 'width: 6rem' },
        { label: 'Total Time', fieldName: 'wfrecon__Total_Time__c', style: 'width: 6rem' },
        { label: 'Cost Code', fieldName: 'wfrecon__Cost_Code__r.Name', style: 'width: 8rem' }
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
                    key: job.Id,
                    jobId: job.wfrecon__Job__r.Id,
                    values: this.jobColumns.map(col => {
                        let cell = { key: col.fieldName, value: '', recordLink: null, isActions: false, style: col.style };
    
                        if (col.fieldName === 'srNo') {
                            cell.value = index + 1;
                        } else if (col.fieldName === 'actions') {
                            cell.isActions = true; // Mark actions column
                        } else if (col.fieldName.includes('.')) {
                            let parts = col.fieldName.split('.');
                            let value = job;
                            parts.forEach(p => value = value ? value[p] : null);
                            cell.value = value || '';
    
                            if (col.isLink && col.recordIdField) {
                                cell.recordLink = `/${job[col.recordIdField]}`;
                            }
                        } else {
                            cell.value = job[col.fieldName] || '';
                        }
    
                        if (col.fieldName === 'wfrecon__Start_Date__c' || col.fieldName === 'wfrecon__End_Date__c') {
                            cell.value = this.formatDate(cell.value);
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
                    Id: ts.Id,
                    values: this.timesheetColumns.map(col => {
                        let cell = { value: '', style: col.style };

                        if (col.fieldName === 'srNo') {
                            cell.value = index + 1;
                        } else if (col.fieldName.includes('.')) {
                            // Handle nested field path like wfrecon__Timesheet_Entry__r.wfrecon__TimeSheet__r.wfrecon__Contact__r.Name
                            let parts = col.fieldName.split('.');
                            let value = ts;
                            parts.forEach(p => value = value ? value[p] : null);
                            cell.value = value || '';
                        } else {
                            cell.value = ts[col.fieldName] || '';
                        }

                        // Format dates nicely
                        if (col.fieldName === 'wfrecon__Clock_In_Time__c' || col.fieldName === 'wfrecon__Clock_Out_Time__c') {
                            cell.value = this.formatDate(cell.value);
                        }

                        // Format number (hours with 2 decimals)
                        if (col.fieldName === 'wfrecon__Total_Time__c' && cell.value !== '') {
                            cell.value = parseFloat(cell.value).toFixed(2);
                        }

                        if(col.fieldName === 'wfrecon__Travel_Time__c') {
                            cell.isTravelTime = true;
                            cell.isEditing = this.editStates[ts.Id] || false;
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
    * Method Name: formatDate 
    * @description: Method is used to format the date
    */
    formatDate(dateStr) {
        try {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in formatDate ::', error);
        }
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
                const jobNumber = job.wfrecon__Job__r?.Name
                    ? job.wfrecon__Job__r.Name.toString().toLowerCase()
                    : '';
                const jobName = job.wfrecon__Job__r?.wfrecon__Job_Name__c
                    ? job.wfrecon__Job__r.wfrecon__Job_Name__c.toString().toLowerCase()
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
                        label: person.displayName,
                        value: person.contactId
                    }));
                    console.log('Clock In Options:', this.clockInOptions);

                    if (this.clockInList.length > 0) {
                        this.defaultStartTime = result.clockIn[0].jobStartTime;
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
        this.clockInTime = this.defaultStartTime;
        this.clockOutTime = this.defaultEndTime;
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
                    this.selectedContactId = null;
                    this.selectedCostCodeId = null;
                    this.clockInTime = this.defaultStartTime;
                    this.getClockInDetails();
                    this.showToast('Success', 'User Clocked In Successfully', 'success');
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
        this.clockInTime = this.defaultStartTime;
        this.clockOutTime = this.defaultEndTime;
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
                        label: person.displayName,
                        value: person.contactId
                    }));
                    console.log('Clock Out Options:', this.clockOutOptions);

                    if (this.clockOutList.length > 0) {
                        this.defaultEndTime = result.clockOut[0].jobEndTime;
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
                    this.selectedContactId = null;
                    this.clockOutTime = this.defaultEndTime;
                    this.getClockOutDetails();
                    this.showToast('Success', 'User Clocked Out Successfully', 'success');
                })
                .catch(error => {
                    console.error('Error creating timesheet records createTimesheetRecords apex :: ', error);
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    this.isLoading = false;
                });
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleClockIn ::', error);
        }
    }

    /** 
    * Method Name: handlePersonChange 
    * @description: Method is used to handle the person change in clock in/out modal
    */
    handlePersonChange(event) {
        this.selectedContactId = event.target.value;
        this.clockInTime = this.defaultStartTime;
        this.clockOutTime = this.defaultEndTime;
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
                // if(job.Id == this.mobId){
                    let dt = new Date(job.wfrecon__Start_Date__c); // parse ISO string
                    let year = dt.getFullYear();
                    let month = dt.getMonth() + 1; // JS months are 0-based
                    let day = dt.getDate();
                    
                    let dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    return dateStr;
                // }
            });

            getTimeSheetEntryItems({ jobId: this.jobId, jobStartDate: jobStartDate.toString() })
                .then((data) => {
                    this.timesheetDetailsRaw = data;
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
                // if(job.Id == this.mobId){   
                    let dt = new Date(job.wfrecon__Start_Date__c); // parse ISO string
                    let year = dt.getFullYear();
                    let month = dt.getMonth() + 1; // JS months are 0-based
                    let day = dt.getDate();
                    
                    let dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    return dateStr;
                // }
            });
    
            let jobEndDate = this.jobDetailsRaw.map(job => {
                // if(job.Id == this.mobId){   
                    let dt = new Date(job.wfrecon__End_Date__c); // parse ISO string
                    let year = dt.getFullYear();
                    let month = dt.getMonth() + 1; // JS months are 0-based
                    let day = dt.getDate();
                    
                    let dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    return dateStr;
                // }
            });
    
            const params = {
                jobId : this.jobId,
                mobId : this.mobId,
                contactId : this.selectedManualPersonId,
                costCodeId : this.selectedCostCodeId,
                clockInTime : this.clockInTime,
                clockOutTime : this.clockOutTime,
                jobStartDate : jobStartDate.toString(),
                jobEndDate : jobEndDate.toString()
            }

            console.log(params);
    
            createManualTimesheetRecords({params : JSON.stringify(params)})
                .then((result) => {
                    console.log('result :: ' , result);
                    this.getJobRelatedTimesheetDetails();
                    this.showToast('Success', 'Timesheet created successfully', 'success');
                    this.selectedManualPersonId = null;
                    this.selectedCostCodeId = null;
                    this.clockInTime = null;
                    this.clockOutTime = null;
                })
                .catch((error) => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error in createManualTimesheetRecords :: ' , error);
                    this.isLoading = false;
                })
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in createManualTimesheet :: ', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: handleEditClick 
    * @description: Method is used to handle the edit click for travel time
    */
    handleEditClick(event) {
        try {
            const rowId = event.target.dataset.id;
            this.editStates[rowId] = true;
            this.isTravelTimeEdited = true;
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleEditClick ::', error);
        }
    }

    /** 
    * Method Name: handleTravelTimeChange 
    * @description: Method is used to handle the travel time change in timesheet modal
    */
    handleTravelTimeChange(event) {
        try {
            const newValue = event.target.value;
            const rowId = event.target.dataset.id;
    
            this.timesheetDetailsRaw = this.timesheetDetailsRaw.map(row => {
                if (row.Id === rowId) {
                    return {
                        ...row,
                        wfrecon__Travel_Time__c: parseFloat(newValue).toFixed(2) // update actual field
                    };
                }
                return row;
            });
            console.log('editStates => ', this.editStates);
            console.log('timesheetdetailsRaw => ', this.timesheetDetailsRaw);
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in handleTravelTimeChange ::', error);
        }
    }

    /** 
    * Method Name: saveTravelTimeInTimesheet 
    * @description: Method is used to save the travel time in timesheet records
    */
    saveTravelTimeInTimesheet() {
        try {
            this.isLoading = true;
            const updatedRecords = this.timesheetDetailsRaw
                .filter(row => this.editStates[row.Id]) // only rows marked as edited
                .map(row => ({
                    Id: row.Id,
                    wfrecon__Travel_Time__c: row.wfrecon__Travel_Time__c
                }));
    
            console.log('Updated Records to send => ', JSON.stringify(updatedRecords));
    
            if (updatedRecords.length > 0) {
                saveTravelTimeOnTimesheets({ params: JSON.stringify(updatedRecords) })
                    .then(() => {
                        this.getJobRelatedTimesheetDetails();
                        this.isTravelTimeEdited = false;
                        this.editStates = {}; // reset edit states after save
                        this.showToast('Success', 'Timesheet(s) updated successfully', 'success');
                    })
                    .catch(error => {
                        console.error('Error saving travel time saveTravelTimeOnTimesheets apex :: ', error);
                        this.showToast('Error', 'Something went wrong. Please contact system admin' , 'error');
                    })
                    .finally(() => {
                        this.isLoading = false;
                    });
            }
        } catch (error) {
            this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
            console.error('Error in saveTravelTimeInTimesheet ::', error);
            this.isLoading = false;
        }
    }

    /** 
    * Method Name: closeTimesheetModal 
    * @description: Method is used to close the timesheet modal
    */
    closeTimesheetModal() {
        this.showTimesheetModal = false;
        this.jobId = null;
        this.mobId = null;
        this.editStates = {};
        this.isTravelTimeEdited = false;
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