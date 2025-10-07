import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getMobilizationMembers from '@salesforce/apex/HomeTabController.getMobilizationMembers';
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

    connectedCallback() {
        try {
            this.selectedDate = new Date();
            let isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent); 
    
            if(isMobileDevice) {
                this.isMobileDevice = true;
                console.log('Mobile device detected. Adjusting styles.');
            } else {
                this.isMobileDevice = false;
                console.log('Desktop device detected. Using default styles.');
            }
    
            this.getMobilizationMembers();
        } catch (error) {
            console.error('Error in connectedCallback:', error);
        }
    }

    renderedCallback() {
        if(!this.accordionStyleApplied){
            this.applyAccordionStyling();
        }
    }

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

    getMobilizationMembers() {
        try {
            this.isLoading = true;
            console.log('Fetching mobilization members for date:', this.apexFormattedDate, 'in', this.activeTab, 'mode');
            getMobilizationMembers({ filterDate: this.apexFormattedDate, mode: this.activeTab })
                .then((data) => {
                    console.log('Data fetched successfully:', data);
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
                })
                .catch((error) => {
                    console.error('Error fetching data:', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in getMobilizationMembers:', error);
            this.isLoading = false;
        }
    }

    groupWeeklyJobData(apexData) {
        try {
            console.log(apexData);
            
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
                console.log(dateKey);

                weekSections.push({
                    id: `day-${i}`,
                    label: this.formatDateLabel(currentDate),
                    jobs: jobsForDay
                });
            }

            this.weekJobList = weekSections;
            console.log(this.weekJobList);
            
        } catch (error) {
            console.error('Error in groupWeeklyJobData :: ', error);
        }
    }

    /**
    * Method Name: handleSectionToggle
    * @description: Handle accordion section toggle - Allow multiple sections to be open
    */
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
        if(selectedMob) {
            this.selectedContactId = selectedMob.contactId;
            this.selectedMobilizationId = selectedMob.mobId;
            this.clockInTime = selectedMob.jobStartTime?.slice(0, 16);
            this.clockOutTime = selectedMob.jobEndTime?.slice(0, 16);
        }
    }

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
        console.log(field);
        console.log(event.target.value);
        
        
        if(field === 'clockOut') {
            this.clockOutTime = event.target.value;
        } else if(field === 'clockIn') {
            this.clockInTime = event.target.value;
        } else if (field === 'costCode') {
            this.selectedCostCodeId = event.target.value;
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
    }

    closeClockOutModal() {
        this.showClockOutModal = false;
        this.selectedContactId = null;
        this.selectedMobilizationId = null;
        this.selectedCostCodeId = null;
        this.previousClockInTime = null;
        this.clockOutTime = null;
        this.clockInTime = null;
    }

    saveClockIn() {
        try {
            if(!this.selectedCostCodeId || !this.clockInTime) {
                this.showToast('Error', 'No cost code/time selected', 'error');
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
                memberId: selectedRecordDetails.memberId
            };

            console.log('params', params);
            console.log('JSON.stringify(params)', JSON.stringify(params));
            
            createTimesheetRecords({ params: JSON.stringify(params)})
                .then(result => {
                    console.log('result', result);
                    if(result == true) {
                        this.getMobilizationMembers();
                        this.closeClockInModal();
                        this.showToast('Success', 'Clocked In Successfully', 'success');
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
            console.error('Error in saveClockIn:', error);
            this.isLoading = false;
        }
    }

    saveClockOut() {
        try {
            if(!this.clockOutTime) {
                this.showToast('Error', 'No time selected', 'error');
                console.error('No time selected');
                return;
            }

            this.isLoading = true;

            const selectedRecordDetails = this.todayJobList.find(
                record => record.mobId === this.selectedMobilizationId
            );

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
                memberId: selectedRecordDetails.memberId
            };

            console.log('params', params);
            console.log('JSON.stringify(params)', JSON.stringify(params));

            createTimesheetRecords({ params: JSON.stringify(params)})
                .then(result => {
                    console.log('result', result);
                    if(result == true) {
                        this.getMobilizationMembers();
                        this.closeClockOutModal();
                        this.showToast('Success', 'Clocked Out Successfully', 'success');
                    } else {
                        this.showToast('Error', 'Failed to Clock Out User', 'error');
                    }
                })
                .catch(error => {
                    this.showToast('Error', 'Something went wrong. Please contact system admin', 'error');
                    console.error('Error creating timesheet records createTimesheetRecords apex :: ', error);
                    this.isLoading = false;
                });
            return;
        } catch (error) {
            console.error('Error in saveClockOut:', error);
            this.isLoading = false;
        }
    }

    formatDateLabel(date) {
        try {
            const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
            return date.toLocaleDateString(undefined, options); // Monday 6 Oct, 2025
        } catch (error) {
            console.error('Error in formatDateLabel :: ' , error);
        }
    }

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