import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getMobilizationMembers from '@salesforce/apex/HomeTabController.getMobilizationMembers';
import getTimeSheetEntryItems from '@salesforce/apex/HomeTabController.getTimeSheetEntryItems';
import createTimesheetRecords from '@salesforce/apex/JobDetailsPageController.createTimesheetRecords';

export default class HomeTab extends LightningElement {
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
    @track showClockInModal = false;
    @track showClockOutModal = false;
    @track costCodeOptions = [];
    @track clockInTime;
    @track clockOutTime;
    @track selectedContactId;
    @track selectedMobilizationId;
    @track selectedCostCodeId;
    @track previousClockInTime;
    @track timesheetDetailsRaw = [];
    @track timesheetColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { label: 'Job Number', fieldName: 'jobNumber', style: 'width: 10rem' },
        { label: 'Job Name', fieldName: 'jobName', style: 'width: 15rem' },
        { label: 'Clock In Time', fieldName: 'clockInTime', style: 'width: 10rem' },
        { label: 'Clock Out Time', fieldName: 'clockOutTime', style: 'width: 10rem' },
        { label: 'Travel Time', fieldName: 'travelTime', style: 'width: 6rem' },
        { label: 'Total Time', fieldName: 'totalTime', style: 'width: 6rem' },
        { label: 'Cost Code', fieldName: 'costCodeName', style: 'width: 8rem' }
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
                        let cell = { value: '', style: col.style };

                        if (col.fieldName === 'srNo') {
                            cell.value = index + 1;
                        } else {
                            cell.value = ts[col.fieldName] || '';
                        }

                        // Format dates nicely
                        if (col.fieldName === 'clockInTime' || col.fieldName === 'clockOutTime') {
                            cell.value = cell.value.slice(0, 16).replace('T', ' ');
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
                    if(data != null){
                        if (data && Object.keys(data).length !== 0) {
                            if(this.activeTab == 'today') {
                                this.todayJobList = data.dayJobs || [];
                                this.isTodayJobAvailable = this.todayJobList.length > 0;
                                
                                this.todayJobList = this.todayJobList.map(job => {
                                    return {
                                        ...job,
                                        jobStartTime: job.jobStartTime?.slice(0, 16).replace('T', ' '),
                                        jobEndTime: job.jobEndTime?.slice(0, 16).replace('T', ' '),
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
                        this.showToast('Error', 'Failed to load data!', 'error');
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
            // Generate week range: today → next Monday (7 days total)
            let today = new Date();

            // normalize apexData keys
            const normalizedApexData = {};
            for (let key in apexData) {
                const date = new Date(key);
                normalizedApexData[date.toDateString()] = apexData[key].map(job => ({
                    ...job,
                    jobStartTime: job.jobStartTime?.slice(0, 16).replace('T', ' '),
                    jobEndTime: job.jobEndTime?.slice(0, 16).replace('T', ' '),
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
                }));
            }

            let weekSections = [];
            // loop today → next 6 days
            for (let i = 0; i < 7; i++) {
                let currentDate = new Date(today);
                currentDate.setDate(today.getDate() + i);

                let dateKey = currentDate.toDateString();
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
                    
                    if(result != null) {  
                        if (result && result.length !== 0) {
                            this.timesheetDetailsRaw = result;
                        } 
                    } else {
                        this.showToast('Error', 'Failed to load data!', 'error');
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
            this.previousClockInTime = selectedMob.clockInTime.slice(0, 16).replace('T', ' ');
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

            this.isLoading = true;

            const selectedRecordDetails = this.todayJobList.find(
                record => record.mobId === this.selectedMobilizationId
            );

            const params = {
                actionType: 'clockIn',
                contactId: this.selectedContactId,
                costCodeId: this.selectedCostCodeId,
                mobilizationId: this.selectedMobilizationId,
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

            if(new Date(this.clockOutTime.replace(' ', 'T')) <= new Date(selectedRecordDetails.clockInTime.slice(0, 16).replace('T', ' '))) {
                this.showToast('Error', 'Clock Out must be greater than Clock In time', 'error');
                return;
            }
            this.isLoading = true;

            const params = {
                actionType: 'clockOut',
                contactId: this.selectedContactId,
                costCodeId: this.selectedCostCodeId,
                mobilizationId: this.selectedMobilizationId,
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