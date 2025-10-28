import { LightningElement, track } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import FULL_CALENDAR from '@salesforce/resourceUrl/FullCalendarJS3';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getEvents from '@salesforce/apex/NewMobilizationCalendarController.getEvents';
import getJobs from '@salesforce/apex/NewMobilizationCalendarController.getJobs';
import getJobDefaultTimes from '@salesforce/apex/NewMobilizationCalendarController.getJobDefaultTimes';
import saveJobSchedule from '@salesforce/apex/NewMobilizationCalendarController.SaveJobSchedule';
import getMobilizationGroup from '@salesforce/apex/NewMobilizationCalendarController.getMobilizationGroup';
import deleteMobilizationGroup from '@salesforce/apex/NewMobilizationCalendarController.deleteMobilizationGroup';


// Resource Assignment Imports
import getAllResources from '@salesforce/apex/MobSchedulerController.getAllResources';

export default class NewMobilizationCalendar extends LightningElement {
    fullCalendarLoaded = false;
    @track events = {};
    isSpinner = false;
    openModal = false;
    Heading = 'Create Mobilization';
    jobId;
    @track jobOptions = [];
    jobName = '';
    groupId = '';
    startDateTime;
    endDateTime;
    includeSaturday = false;
    includeSunday = false;
    status;
    description;
    statusOptions = [
        { label: 'None', value: ''},
        { label: 'Pending', value: 'Pending' },
        { label: 'Confirmed', value: 'Confirmed' }
    ];
    confirmationPopup;
    showConfirmationPopup;
    confirmationTitle;
    confirmationMessage;
    event;
    filterstatus = '';
    filterjobs;

    displayJobs = {
        primaryField: 'wfrecon__Job_Name__c',
    }

    matchingJobs = {
        primaryField: { fieldPath: 'wfrecon__Job_Name__c' }
    }

    // Resource Assignment Popup
    showResourceAssignPopup = false;
    resourceTypeForAssign = 'Crew';
    selectedResourceIdsForAssign = [];

    resourceSearchKey = null;

    allCrewMembers = [];
    allSubContractors = [];
    allAssets = [];

    jobAssignmentInfo = {};

    get isEdit() {
        return this.jobName.length ? true : false;
    }

    get groupLink() {
        return '/' + this.groupId
    }

    // Resource Assignment Popup
    get resourceOptionsToShow() {
        let resources = [];
        if (this.resourceTypeForAssign === 'Crew') {
            resources = this.allCrewMembers || [];
        } else if (this.resourceTypeForAssign === 'Asset') {
            resources = this.allAssets || [];
        } else if (this.resourceTypeForAssign === 'SubContractor') {
            resources = this.allSubContractors || [];
        }

        // let addedResourcesForMob = this.addedResources?.map(res => res.id);
        const search = this.resourceSearchKey?.toLowerCase() || '';
        return resources
            .filter(rs => !search || rs.name?.toLowerCase().includes(search))
            // .map(res => ({
            //     ...res,
            //     isSelected: this.selectedResourceIdsForAssign?.includes(res.id),
            //     isAddedForMob: addedResourcesForMob.includes(res.id)
            // }));
    }

    connectedCallback() {
        this.isSpinner = true;
        this.loadAllResources(new Date().toISOString());
        loadScript(this, FULL_CALENDAR + '/fullcalendar3/jquery.min.js')
            .then(() => loadScript(this, FULL_CALENDAR + '/fullcalendar3/moment.js'))
            .then(() => loadScript(this, FULL_CALENDAR + '/fullcalendar3/fullcalendar.js'))
            .then(() => loadStyle(this, FULL_CALENDAR + '/fullcalendar3/fullcalendar.min.css'))
            .then(() => loadStyle(this, FULL_CALENDAR + '/fullcalendar3/fullcalendar.css'))
            .then(() => {
                this.fullCalendarLoaded = true;
                this.loadJobOptions();
                return getEvents();
            })
            .then(result => {
                if (result && Array.isArray(result)) {
                    console.log(result);
                    
                    this.events = result.map(ev => ({
                        ...ev,
                        start: new Date(ev.start).toISOString(),
                        end: ev.end ? new Date(ev.end).toISOString() : null
                    }));
                } else {
                    this.events = [];
                }
                this.initialiseCalendarJs();
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load calendar or events', 'error');
                console.error(error);
                this.isSpinner = false;
            });
    }
    

    initialiseCalendarJs() {
        const ele = this.template.querySelector('div.fullcalendarjs');
        const that = this;
        this.$cal = $(ele);

    
        $(ele).fullCalendar({
            header: {
                left: 'today',
                center: 'prev title next',
                right: 'basicDay,month,basicWeek,listMonth'
            },
            defaultView: 'month',
            defaultDate: new Date(),
            navLinks: true,
            editable: true,
            eventLimit: true,
            events: this.events,
            dragScroll: true,
            droppable: true,
            weekNumbers: false,
            selectable: true,
            selectMirror: true,
            timezone: 'UTC',
            select: this.handleDateRangeSelect.bind(this),
            eventClick: function (calEvent) {        
                console.log(calEvent.id);
                this.handleEventClick(calEvent.id);
            }.bind(this),
            eventDrop: this.getConfirmation.bind(this),
            eventResize: this.getConfirmation.bind(this),
            businessHours: true,
            draggable: true,
            eventResizableFromStart: true,
            eventDurationEditable:true,
            eventOrder: '-status',
            eventRender: function(event, element, view) {
                // Format start and end times
                if (view.name.startsWith('list')){
                    const startTime = event.allDay ? 'All Day' : moment(event.start).format('hh:mm A');
                    const endTime = event.allDay ? '' : (event.end ? moment(event.end).format('hh:mm A') : '');

                    const isMobile = window.innerWidth < 768;

                    
                    let rowHtml = `
                    <div class="fc-row-columns" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                        <span class="fc-col title" style="width:${isMobile ? '70%' : '30%'}; font-weight:bold;">
                            ${event.title}
                        </span>
                `;

                // Only add location and status if not mobile
                if (!isMobile) {
                    rowHtml += `
                        <span class="fc-col location" style="width:35%;">${event.jobLocation || ''}</span>
                        <span class="fc-col status" style="width:15%; text-align:center;">Status - ${event.status || ''}</span>
                    `;
                }

                rowHtml += `<span class="fc-col time" style="width:${isMobile ? '30%' : '20%'}; text-align:center;">
                            ${startTime}${endTime ? ' - ' + endTime : ''}
                        </span></div>`;

            // Replace title content
            element.find('.fc-list-item-title').html(rowHtml);

                    element.css({
                        'background-color': '#fff',
                        'color': event.textColor || '#000',
                        'border-left': `4px solid ${event.backgroundColor || '#000'}`
                    });
                }
    

            }
        });
        this.isSpinner = false;
    }

    getConfirmation(event){
        this.showConfirmationPopup = true;
        this.confirmationTitle = 'Confirm'
        this.confirmationMessage = 'Are you sure want to change Mobilization?'
        this.event = event;
    }

    handleClose(){
        this.showConfirmationPopup = false;
        this.event = null;
        this.refreshCalendar();
    }

    handleEventDrop() {
        this.showConfirmationPopup = false;
        let event = this.event;
        const newStart = new Date(event.start);
        const newEnd = new Date(event.end);

        // Preserve original time
        const [sH, sM, sAMPM] = event.timestart.match(/(\d+):(\d+)\s?(AM|PM)/i).slice(1);
        const startHour = (sAMPM === 'PM' ? 12 : 0) + (parseInt(sH) % 12);
        newStart.setHours(startHour, sM);

        const [eH, eM, eAMPM] = event.timeend.match(/(\d+):(\d+)\s?(AM|PM)/i).slice(1);
        const endHour = (eAMPM === 'PM' ? 12 : 0) + (parseInt(eH) % 12);
        newEnd.setHours(endHour, eM);

        newEnd.setDate(newEnd.getDate() - 1);


        console.log(`Moved: ${event.title}`);
        console.log(`New Start: ${newStart.toISOString()}`);
        console.log(`New End: ${newEnd.toISOString()}`);

        const mgp = {
            id: event.id || null,
            startDate: newStart.toISOString(),
            endDate: newEnd.toISOString(),
            status: event.status || '',
            description: event.desc || '',
            jobId: event.jobId,
            includeSaturday: event.saturday || false,
            includeSunday: event.sunday || false
        };
        console.log(mgp);
        saveJobSchedule({ mgp: mgp })
            .then(result => {
                if (result === 'SUCCESS') {
                    this.showToast('Success', 'Record saved successfully!', 'success');
                    this.openModal = false;
                    this.resetTempVariables();
                    this.refreshCalendar();
                } else {
                    this.showToast('Error', 'Something went wrong!', 'error');
                }
            })
            .catch(error => {
                console.error(error);
                this.showToast('Error', 'Error saving record: ' + error.body?.message, 'error');
            })
            .finally(() => {
                this.isSpinner = false;
            });
    }

    loadJobOptions() {
        getJobs()
            .then(result => {
                console.log(result);
                
                this.jobOptions = result.map((Id, Name) => ({ label: Name, value: Id }));
                console.log(this.jobOptions);
                
            })
            .catch(error => {
                console.error(error);
            });
    }

    handleResourceItemUpdate(event){
        try {
            let name = event.currentTarget.name;
            console.log('The Whole detail is :: ', event.detail);
            
            this[name] = event.detail.recordId;
            console.log('Name :: ', name, ' Value :: ', this[name]);
            
        } catch (e) {
            console.log('Error in function handleResourceItemUpdate:::', e.message);
        }
    }

    refreshCalendar() {
        this.isSpinner = true;
        getEvents({job: this.filterjobs, status: this.filterstatus})
        .then((result) => {
            if (result && Array.isArray(result)) {
                console.log(result);
                
                this.events = result.map(ev => ({
                    ...ev,
                    start: new Date(ev.start).toISOString(),
                    end: ev.end ? new Date(ev.end).toISOString() : null
                }));
            } else {
                this.events = [];
            }
            this.isSpinner = false;

            if (!this.$cal) return;

            // Remove all current events
            this.$cal.fullCalendar('removeEvents');

            // Add the entire updated events array
            this.$cal.fullCalendar('addEventSource', this.events);

        });
    }

    handleJobChange(event) {
        this.jobId = event.target.value;
    }

    handleStartDateTimeChange(event) {
        this.startDateTime = event.target.value;
        console.log(this.startDateTime);
        
    }

    handleEndDateTimeChange(event) {
        this.endDateTime = event.target.value;
        console.log(this.endDateTime);
        
    }

    handleIncludeSaturdayChange(event) {
        this.includeSaturday = event.target.checked;
    }

    handleIncludeSundayChange(event) {
        this.includeSunday = event.target.checked;
    }

    handleStatusChange(event) {
        console.log('Event is :: ', event.detail);
        
        this.status = event.detail.value;
    }

    handleDescriptionChange(event) {
        this.description = event.target.value;
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }

    handleModalClose() {
        this.openModal = false;
        this.resetTempVariables();
    }

    handleRecordCreate(event) {
        this.openModal = false;
        this.showToast('Success', 'Record created successfully!', 'success');
        this.refreshCalendar();
    }
    
    handleDateRangeSelect(start, end) {
        try {
            this.isSpinner = true;
            this.selectedEventId = '';
            this.status = 'Confirmed';
            this.Heading = 'Create Mobilization';

            const startDate = new Date(start); // UTC from FullCalendar
            const endDate = new Date(end);

            // Convert both to local time for comparison
            const now = new Date();

            // ❌ Prevent creation for past start dates (compare local time)
            if (startDate < now.setHours(0, 0, 0, 0)) {
                this.isSpinner = false;
                this.showToast('Warning', 'Cannot create events in the past.','warn');
                console.warn('Cannot create events in the past.');
                return; // Exit early
            }
        
            // Subtract 1 day from end to make it inclusive
            endDate.setDate(endDate.getDate() - 1);


            getJobDefaultTimes()
            .then(defaults => {
                // Apply default start time
                startDate.setHours(Number(defaults.StartHour));
                startDate.setMinutes(Number(defaults.StartMinute));
                startDate.setSeconds(0);

                // Apply default end time
                endDate.setHours(Number(defaults.EndHour));
                endDate.setMinutes(Number(defaults.EndMinute));
                endDate.setSeconds(0);

                // Format for lightning-input using helper
                this.startDateTime = this.formatForInput(startDate);
                
                this.endDateTime   = this.formatForInput(endDate);
                // Include Saturday/Sunday checkboxes
                this.includeSaturday = defaults.IncludeSaturday;
                this.includeSunday = defaults.IncludeSunday;

                // Open modal
                this.openModal = true;

                console.log('Adjusted Start:', this.startDateTime);
                console.log('Adjusted End:', this.endDateTime);
                this.isSpinner = false;
            })
            .catch(error => {
                this.isSpinner = false;
                console.error('Error fetching default times:', error);
            });
        } catch (error) {
            this.isSpinner = false;
            console.log(error);
            
        }
    }

    formatForInput(date) {
        const d = new Date(date);
        return d.toISOString();
    }
    

    handleEventClick(recordId) {
        this.isSpinner = true;
        console.log('Clicked event:', recordId);
        getMobilizationGroup({recordId: recordId})
        .then((result)=>{
            this.isSpinner = false;
            console.log(result);
            this.startDateTime = result.startDate;
            this.endDateTime = result.endDate;
            this.includeSaturday = result.includeSaturday;
            this.includeSunday = result.includeSunday;
            this.jobName = result.jobRealName+' - '+ result.jobName;
            this.jobId = result.jobId;
            this.status = result.status;
            this.description = result.description;
            this.groupId = result.id;
            this.Heading = 'Edit Mobilization';
            this.openModal = true;
            this.selectedEventId = recordId;
        })
        .catch((error)=>{
            console.log(error);
            this.isSpinner = false;
        });
    }

    handleSuccess(){
        this.showToast('Success', 'Record saved successfully!', 'success');
        this.openModal = false;
        this.resetTempVariables();
        this.refreshCalendar();
    }

    resetTempVariables() {
        this.jobId = '';
        this.startDateTime = '';
        this.endDateTime = '';
        this.status = '';
        this.description = '';
        this.jobName = '';
        this.groupId = '';
        this.selectedEventId = '';
    }

    handleDeleteMobilization() {
        this.isSpinner = true;
        deleteMobilizationGroup({recordId: this.groupId})
        .then(()=>{
            this.showToast('Success', 'Mobilization Group Deleted', 'success');
            this.handleModalClose();
            this.refreshCalendar();
            this.isSpinner = false;
        })
        .catch((error)=>{
            this.showToast('Error', 'Error Deleting Mobilization Group', 'error');
            this.isSpinner = false;
        })
    }

    handleFilter(event){
        try {
            if(event.target.name === 'jobId') {
                this.filterjobs = event.detail.recordId;
                console.log(this.filterjobs);
            } else if(event.target.name === 'status') {
                this.filterstatus = event.detail.value;
                console.log(this.filterstatus);
            }
            this.refreshCalendar();
        } catch (error) {
            console.log(error);
        }
    }


    // Resource Allocation Popup Methods
    loadAllResources(selectedDate){
        try {
            // this.isSpinner = true;
            getAllResources({selectedDate: selectedDate})
            .then((result) => {
                const sortByAvailability = (a, b) => {
                    // First: sort by availability (available first)
                    if (a.isAvailable !== b.isAvailable) {
                        return a.isAvailable ? -1 : 1;
                    }

                    // Then: sort by name (alphabetically, case-insensitive)
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();

                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;
                    return 0;
                };

                this.allCrewMembers = [...(result.crew || [])].sort(sortByAvailability);
                this.allSubContractors = [...(result.subcontractors || [])].sort(sortByAvailability);
                this.allAssets = [...(result.assets || [])].sort(sortByAvailability);

                this.isSpinner = false;
            })
            .catch((e) => {
                this.showToast('Error', 'Could not fetch resources, please try again...');
                console.error('MobScheduler.loadAllResources apex:getAllResources error:', e?.body?.message || e?.message);
            })
        } catch (e) {
            this.showToast('Error', 'Could not fetch resources, please try again...');
            console.error('MobScheduler.loadAllResources error:', e?.message);
        }
    }

    selectResourceType(event) {
        let name = event.target.name;
        this.resourceTypeForAssign = name;
        this.selectedResourceIdsForAssign = [];
    }

    handleResourceSearch(event){
        try {
            this.resourceSearchKey = event.currentTarget?.value || '';
        } catch (e) {
            console.error('MobScheduler.handleResourceSearch error:', e?.message);
        }
    }

    addResourceForAssignment(event){
        try {
            this.showLoading(true);

            if(event){
                let name = 'selectedResourceIdsForAssign';
                let type = this.resourceTypeForAssign;
    
                this.jobAssignmentInfo = { 
                    resourceIds: this[name].join(','), 
                    mobId: this.mobIdForResources, 
                    type: type,
                    allowOverlap: false,
                    overlapMode: 'SKIP',
                }
            }

            assignResourceToJob({ assignmentData: this.jobAssignmentInfo })
            .then(result => {
                // Parse the JSON string returned from Apex
                let parsedResult;
                try {
                    parsedResult = JSON.parse(result);
                } catch (e) {
                    console.error('MobScheduler.addResourceForAssignment apex:assignResourceToJob invalid JSON:', e?.message);
                    this.showToast('Error', 'Unexpected response format from server.', 'error');
                    return;
                }

                // Check result status
                const status = parsedResult?.status;

                if (status === 'OVERLAP') {
                    this.isOverlapJob = true;
                    // Show confirmation popup
                    this.askConfirmation('Time Overlapping!', 'Resource allocation is overlapping. How would you like to proceed?', 'Overlap & Assign');

                } else if (status === 'SUCCESS') {
                    this.showToast('Success', 'Resource assigned successfully.', 'success');
                    this.showResourceAssignPopup = false;
                    this.selectedResourceIdsForAssign = [];

                } else if (status === 'ERROR') {
                    this.showToast('Error', parsedResult.message || 'Could not assign resource to job.', 'error');

                } else {
                    // Catch unexpected responses
                    this.showToast('Error', 'Unexpected response from server.', 'error');
                }
            })
            .catch(error => {
                console.error('MobScheduler.addResourceForAssignment apex:assignResourceToJob error:', error?.body?.message || error?.message);
                this.showToast('Error', 'Could not assign job, please try again...', 'error');
            });
        } catch (e) {
            console.error('MobScheduler.addResourceForAssignment error:', e?.message);
        }
    }

    handleResourceAssign(){
        try {
            this.showResourceAssignPopup = true;
            this.selectedResourceIdsForAssign = [];
        } catch (e) {
            console.log('Error in function handleResourceAssign:::', e.message);
        }
    }

    handleCancelEdit() {
        this.showResourceAssignPopup = false;
    }
}