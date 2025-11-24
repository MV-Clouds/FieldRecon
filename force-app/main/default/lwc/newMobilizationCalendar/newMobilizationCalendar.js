import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import FULL_CALENDAR from '@salesforce/resourceUrl/FullCalendarJS3';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getEvents from '@salesforce/apex/NewMobilizationCalendarController.getEvents';
import getJobDefaultTimes from '@salesforce/apex/NewMobilizationCalendarController.getJobDefaultTimes';
import getTimeZoneOffset from '@salesforce/apex/NewMobilizationCalendarController.getTimeZoneOffset';
import saveJobSchedule from '@salesforce/apex/NewMobilizationCalendarController.SaveJobSchedule';
import getMobilizationGroup from '@salesforce/apex/NewMobilizationCalendarController.getMobilizationGroup';
import deleteMobilizationGroup from '@salesforce/apex/NewMobilizationCalendarController.deleteMobilizationGroup';
import getMobStatusOptions from '@salesforce/apex/NewMobilizationCalendarController.getMobStatusOptions';

// Resource Assignment Imports
import getAllResources from '@salesforce/apex/MobSchedulerController.getAllResources';
import assignResourceToJob from '@salesforce/apex/MobSchedulerController.assignResourceToJob';

// Permission Checker
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';

export default class NewMobilizationCalendar extends NavigationMixin(LightningElement) {
    fullCalendarLoaded = false;
    @track events = {};
    isSpinner = false;
    openModal = false;
    Heading = 'Create Mobilization Group';
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
    @track statusOptions = [];
    confirmationPopup;
    showConfirmationPopup;
    confirmationTitle;
    confirmationMessage;
    event;
    filterStatus = [];
    filterjobs;

    _oldEvent = {};
    revertFunc = new function() {};

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
    selectedCrewAssignments = [];

    resourceSearchKey = null;

    allCrewMembers = [];
    allSubContractors = [];
    allAssets = [];

    jobAssignmentInfo = {};

    // Confirmation Popup
    showConfirmationPopup = false;
    confirmationTitle = 'Confirm!';
    confirmationMessage = 'Are you sure, you want to proceed';
    confirmationBtnLabel = 'Proceed';
    confirmationBtnLabel2 = null;

    isOverlapJob = false;
    isDropOrExpand = false;

    tzOffset = 0;

    // Permissions Flags
    hasFullAccess = false;

    get isEdit() {
        return this.jobName.length ? true : false;
    }

    get groupLink() {
        return '/' + this.groupId
    }

    get isCrewAssignOpen(){
        return this.resourceTypeForAssign == 'Crew';
    }

    // Resource Assignment Popup
    get resourceOptionsToShow() {
        let resources = [];
        const search = this.resourceSearchKey?.toLowerCase() || '';
        // const addedResourcesForMob = this.addedResources?.map(res => res.id) || [];

        if (this.resourceTypeForAssign === 'Crew') {
            // Use groupedCrew created earlier (e.g. via groupCrewByTeam)
            const groupedCrewList = this.groupCrewByTeam(this.allCrewMembers || []);
            
            // Apply search filter on group or member name
            const filteredGroups = groupedCrewList
            .map(group => {
                const filteredMembers = group.members.filter(m =>
                    !search || m.name?.toLowerCase().includes(search)
                );

                if (filteredMembers?.length > 0 || group.crewName?.toLowerCase().includes(search)) {
                    
                    const members = filteredMembers.map(m => ({
                        ...m,
                        isSelected: (this.selectedCrewAssignments || []).some(sel => sel.id === m.id && (!sel.crewId || sel.crewId === (group.id))),
                        // isAddedForMob: addedResourcesForMob.includes(m.id)
                    }));

                    // Determine if all members are selected
                    const allSelected = members.every(mem => mem.isSelected);                    
                    return {
                        ...group,
                        members,
                        isSelected: allSelected
                    };
                }
                return null;
            })
            .filter(Boolean)
            .sort(a => a.id === 'NA' ? 1 : -1);
            resources = this.allCrewMembers || [];

            return filteredGroups;
        } 
        else if (this.resourceTypeForAssign === 'Asset') {
            resources = this.allAssets || [];
        } 
        else if (this.resourceTypeForAssign === 'SubContractor') {
            resources = this.allSubContractors || [];
        }

        // Non-crew case (existing logic)
        return resources
        .filter(rs => !search || rs.name?.toLowerCase().includes(search))
        .map(res => ({
            ...res,
            isSelected: this.selectedResourceIdsForAssign?.includes(res.id),
            // isAddedForMob: addedResourcesForMob.includes(res.id)
        }));
    }

    groupCrewByTeam(crewList) {        
        const groupedMap = {};

        (crewList || []).forEach(member => {
            const key = member?.crewId || 'NA';
            const name = member?.crewName || 'Individual Employees';

            if (!groupedMap[key]) {
                groupedMap[key] = {
                    id: key,
                    name: name,
                    isSelected: false,
                    isAvailable: true,
                    bgStyle: `background-color: color(from ${member.bgColor} srgb r g b / 0.3); border: 1px solid ${member.bgColor};`,
                    members: []
                };
            }

            groupedMap[key].members.push(member);
        });

        // Convert map to array for easy template iteration
        return Object.values(groupedMap);
    }

    connectedCallback() {
        this.isSpinner = true;
        this.fetchTimeZoneOffset();
        this.fetchPermissions();
        loadScript(this, FULL_CALENDAR + '/fullcalendar3/jquery.min.js')
            .then(() => loadScript(this, FULL_CALENDAR + '/fullcalendar3/moment.js'))
            .then(() => loadScript(this, FULL_CALENDAR + '/fullcalendar3/fullcalendar.js'))
            .then(() => loadStyle(this, FULL_CALENDAR + '/fullcalendar3/fullcalendar.min.css'))
            .then(() => loadStyle(this, FULL_CALENDAR + '/fullcalendar3/fullcalendar.css'))
            .then(() => {
                this.fullCalendarLoaded = true;
                this.loadStatusOptions();
                return getEvents();
            })
            .then(result => {
                if (result && Array.isArray(result)) {
                    this.events = result.map(ev => ({
                        ...ev,
                        start: new Date(ev.start).toLocaleDateString('en-CA'),
                        end: ev.end ? new Date(ev.end).toLocaleDateString('en-CA') : null,
                        startDateAndTime: ev.start,
                        endDateAndTime: ev.end,
                    }));
                } else {
                    this.events = [];
                }
                
                this.initialiseCalendarJs();
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load calendar or events', 'error');
                console.error('Error in NewMobilizationCalendar.ConnectedCallback > loadScript', error?.body?.message || error?.message);
                this.isSpinner = false;
            });
    }

    fetchPermissions(){
        try{
            checkPermissionSetsAssigned({ psNames : ['FR_Mobilization_Calendar']})
            .then((result) => {
                this.hasFullAccess = result.isAdmin || result.all;
                this.hasFullAccess && this.loadAllResources(new Date().toLocaleDateString('en-CA'));
            })
            .catch((e) => {
                console.error('Error in NewMobilizationCalendar.fetchPermissions > checkPermissionSetsAssigned', e?.body?.message || e?.message);
            })
        } catch(e){
            console.error('Error in function NewMobilizationCalendar.fetchPermissions:::', e?.message);
        }
    }

    fetchTimeZoneOffset(){
        try {
            getTimeZoneOffset()
            .then((result) => {
                this.tzOffset = result;
            })
            .catch((e) => {
                console.error('Error in fetchTimeZoneOffset > getTimeZoneOffset :: ', e?.body?.message || e?.message);
            })
        } catch (e) {
            console.error('Error in fetchTimeZoneOffset :: ', e?.message);
        }
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
            defaultView: 'basicWeek',
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
                this.handleEventClick(calEvent.id);
            }.bind(this),
            eventDrop: this.getConfirmation.bind(this),
            eventResize: this.getConfirmation.bind(this),
            eventDragStart: function(event) {
                this._oldEvent = $.extend(true, {}, event);
            }.bind(this),
            eventResizeStart: function(event) {
                this._oldEvent = $.extend(true, {}, event);
            }.bind(this),
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

    getConfirmation(event, delta, revertFunc) {
        try{

            this.showToast('Info', 'This feature will be added shortly...', 'info');
            revertFunc();
            return;

            if(!event.start || !this._oldEvent.start || !event.startDateAndTime || !this._oldEvent.startDateAndTime){
                this.showToast('Something Went Wrong!', 'Please refresh the tab and try again.', 'error');
                return;
            }

            const toDate = (val) => {
                if (!val) return null;
                if (val instanceof Date) return val;
                const d = new Date(val);
                return isNaN(d.getTime()) ? null : d;
            };
    
            const mergeDateAndTime = (dateOnly, timeOnly) => {
                return new Date(
                    dateOnly.getFullYear(),
                    dateOnly.getMonth(),
                    dateOnly.getDate(),
                    timeOnly.getHours(),
                    timeOnly.getMinutes(),
                    timeOnly.getSeconds()
                );
            };
    
            const eventStartDate = toDate(event.start);
            const eventOldStartDate = toDate(this._oldEvent.start);
            const eventStartTime = toDate(event.startDateAndTime);
            const eventOldStartTime = toDate(this._oldEvent.startDateAndTime);
    
            const mergedStart = mergeDateAndTime(eventStartDate, eventStartTime);
            const mergedOldStart = mergeDateAndTime(eventOldStartDate, eventOldStartTime);
    
            const startLocal = this.removeOrgTimeZone(mergedStart);
            const oldStartLocal = this.removeOrgTimeZone(mergedOldStart);
            
            let nowLocal = new Date();

            if(startLocal.getTime() != oldStartLocal.getTime()){
                if(oldStartLocal.getTime() < nowLocal.getTime()){
                    this.showToast('Error', 'Can not change the start date/time for in-progress mobilization group.', 'error');
                    revertFunc(); 
                    return;
                }if(startLocal.getTime() < nowLocal.getTime()){
                    this.showToast('Error', 'Start date/time can not be set in the past.', 'error');
                    revertFunc(); 
                    return;
                }
            }
    
            this.showConfirmationPopup = true;
            this.confirmationTitle = 'Confirm'
            this.confirmationMessage = 'Are you sure want to change Mobilization?'
            this.event = event;
            this.revertFunc = revertFunc;
            this.isDropOrExpand = true;
        } catch (e) {
            console.error('Error in function NewMobilizationCalendar.getConfirmation:::', e?.message);
        }
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
                this.event = null;
                this.revertFunc = new function() {};
            })
            .catch(error => {
                console.error(error);
                this.showToast('Error', 'Error saving record: ' + error.body?.message, 'error');
                this.revertFunc();
                this.event = null;
                this.revertFunc = new function() {};
            })
            .finally(() => {
                this.isSpinner = false;
            });
    }

    loadStatusOptions(){
        try {
            getMobStatusOptions()
            .then((result) => {
                this.statusOptions = result || [];
                this.statusOptions.forEach(opt => {
                    opt.isSelected = opt.label?.toLowerCase() == 'overhead job' ? false : true
                })
                this.filterStatus = this.statusOptions?.filter(opt => opt.isSelected)?.map(opt => opt.value) || [];
            })
            .catch(error => {
                console.error('Error in function NewMobilizationCalendar.loadStatusOptions:::', error?.body?.message || error?.message);
            })
        } catch (e) {
            console.error('Error in function loadStatusOptions:::', e?.message);
        }
    }

    handleResourceItemUpdate(event){
        try {
            let name = event.currentTarget.name;            
            this[name] = event.detail.recordId;            
        } catch (e) {
            console.error('Error in function NewMobilizationCalendar.handleFilter:::', e?.message);
        }
    }

    refreshCalendar() {
        this.isSpinner = true;
        getEvents({job: this.filterjobs, status: this.filterStatus})
        .then((result) => {
            if (result && Array.isArray(result)) {                
                this.events = result.map(ev => ({
                    ...ev,
                    start: new Date(ev.start).toLocaleDateString('en-CA'),
                    end: ev.end ? new Date(ev.end).toLocaleDateString('en-CA') : null,
                    startDateAndTime: ev.start,
                    endDateAndTime: ev.end,
                }));
            } else {
                this.events = [];
            }

            if (!this.$cal) return;

            // Remove all current events
            this.$cal.fullCalendar('removeEvents');

            // Add the entire updated events array
            this.$cal.fullCalendar('addEventSource', this.events);
            this.isSpinner = false;
        });
    }

    handleJobChange(event) {
        this.jobId = event.target.value;
    }

    handleStartDateTimeChange(event) {
        this.startDateTime = event.target.value;        
    }

    handleEndDateTimeChange(event) {
        this.endDateTime = event.target.value;        
    }

    handleIncludeSaturdayChange(event) {
        this.includeSaturday = event.target.checked;
    }

    handleIncludeSundayChange(event) {
        this.includeSunday = event.target.checked;
    }

    handleStatusChange(event) {        
        this.status = event.detail.value;
    }

    handleDescriptionChange(event) {
        this.description = event.target.value;
    }

    showToast(title, message, variant) {
        this.isSpinner = false;
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
            if(!this.hasFullAccess) {
                this.showToast('Error', 'You do not have permission to create events.', 'error');
                return;
            }
            let startStr = JSON.stringify(start)?.replaceAll('"', '');
            let endStr = JSON.stringify(end)?.replaceAll('"', '');

            const endDate = new Date(end);
            
            this.isSpinner = true;
            this.selectedEventId = '';
            this.Heading = 'Create Mobilization Group';

            const nowLocal = this.normalizeDate(new Date()).toLocaleDateString('en-CA');

            if (startStr < nowLocal) {
                this.isSpinner = false;
                this.showToast('Warning', 'Cannot create events in the past.','warn');
                console.warn('Cannot create events in the past.');
                return; // Exit early
            }

            // Subtract 1 day from end to make it inclusive
            endDate.setDate(endDate.getDate() - 1);

            getJobDefaultTimes({ startDate: startStr, endDate: endStr})
            .then(defaults => {
                // Format for lightning-input using helper
                this.startDateTime = defaults.startDateTime
                
                this.endDateTime   = defaults.endDateTime;
                // Include Saturday/Sunday checkboxes
                this.includeSaturday = defaults.IncludeSaturday;
                this.includeSunday = defaults.IncludeSunday;

                // Open modal
                this.openModal = true;
                this.template.querySelector('.header').scrollIntoView({block: 'end'});

                this.isSpinner = false;
            })
            .catch(error => {
                this.isSpinner = false;
                console.error('Error fetching default times:', error);
            });
        } catch (e) {
            this.isSpinner = false;
            console.error('Error in function NewMobilizationCalendar.handleDateRangeSelect:::', e?.message);
            
        }
    }

    handleEventClick(recordId) {
        if(!this.hasFullAccess){
            this.showToast('Warning', 'You do not have permission to edit this event.','error');
            return;
        }
        this.isSpinner = true;
        getMobilizationGroup({recordId: recordId})
        .then((result)=>{
            this.isSpinner = false;
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
            this.template.querySelector('.header').scrollIntoView({block: 'end'});
            this.selectedEventId = recordId;
        })
        .catch((e)=>{
            console.error('Error in function NewMobilizationCalendar.handleEventClick:::', e?.message);
            this.isSpinner = false;
        });
    }

    handleSuccess(){
        this.showToast('Success', 'Record saved successfully!', 'success');
        this.openModal = false;
        this.resetTempVariables();
        this.refreshCalendar();
    }

    handleMobFormSubmitted(event){
        try {
            this.isSpinner = true;
            event.preventDefault();
            let details = event.detail.fields;
            const start = Date.parse(details.wfrecon__Start_Date__c);
            const end = Date.parse(details.wfrecon__End_Date__c);

            const startLocal = this.removeOrgTimeZone(details.wfrecon__Start_Date__c);
            const nowLocal = new Date();

            let oldStartLocal = this.removeOrgTimeZone(this.startDateTime);
            
            if(this.isEdit && (startLocal.getTime() != oldStartLocal.getTime())){
                if(oldStartLocal.getTime() < nowLocal.getTime()){
                    this.showToast('Error', 'Can not change the start date/time for in-progress mobilization group.', 'error');
                    return;
                }if(startLocal.getTime() < nowLocal.getTime()){
                    this.showToast('Error', 'Start date/time can not be set in the past.', 'error');
                    return;
                }
            }

            if (start == end) {
                this.showToast('Error', 'Start date-time can not be same as end date-time.', 'error');
            } else if (!this.isEdit && startLocal.getTime() < nowLocal.getTime()) {
                this.showToast('Error', 'Start date/time can not be in past.', 'error');
            } else if (start > end) {
                this.showToast('Error', 'End date cannot be earlier than the start date. Please select a valid range.', 'error');
            } else {
                this.template.querySelector('lightning-record-edit-form.mob-group-form').submit(details);
            }
        } catch (e) {
            console.error('NewMobilizationCalendar.handleMobFormSubmitted error:', e?.message);
        }
    }

    removeOrgTimeZone(utcDateStr) {
        const d = new Date(utcDateStr);
        const orgOffset = this.tzOffset * 60; // Salesforce user zone (UTC−5)
        const deviceOffset = d.getTimezoneOffset(); // Niue = +660 (minutes)
        const diffMs = (deviceOffset + orgOffset) * 60 * 1000;
        return new Date(d.getTime() + diffMs);
    }

    normalizeDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
            } else {
                let value = event.currentTarget.dataset.value;
                let statusToUpdate = this.statusOptions.find(opt => opt.value == value);
                statusToUpdate.isSelected = !statusToUpdate.isSelected;
                
                this.filterStatus = this.statusOptions?.filter(opt => opt.isSelected)?.map(opt => opt.value) || [];
            }
            this.refreshCalendar();
        } catch (e) {
            console.error('Error in function NewMobilizationCalendar.handleFilter:::', e?.message);
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
                    // if (a.isAvailable !== b.isAvailable) {
                    //     return a.isAvailable ? -1 : 1;
                    // }

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
        this.selectedCrewAssignments = [];
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
            if((this.resourceTypeForAssign == 'Crew' && !this.selectedCrewAssignments.length) || (this.resourceTypeForAssign != 'Crew' && !this.selectedResourceIdsForAssign.length)) {
                this.showToast('Error', 'Please select resource to assign.', 'error');
                return;
            }
            this.isSpinner = true;

            if(event){
                let name = 'selectedResourceIdsForAssign';
                let type = this.resourceTypeForAssign;

                const resourceMap = {};
                (this.selectedCrewAssignments || []).forEach(item => {
                    resourceMap[item.id] = item.crewId || null;
                });
    
                this.jobAssignmentInfo = { 
                    resourceIds: this[name].join(','), 
                    resourceMap: JSON.stringify(resourceMap),
                    mobId: null, 
                    mobGroupId: this.selectedEventId,
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
                    this.askConfirmation('Time Overlapping!', 'Resource allocation is overlapping. How would you like to proceed?', 'Overlap & Assign', 'Assign Only Available');

                } else if (status === 'SUCCESS') {
                    this.showToast('Success', 'Resource assigned successfully.', 'success');
                    this.selectedCrewAssignments = [];
                    this.selectedResourceIdsForAssign = [];
                    this.showResourceAssignPopup = false;

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

    handleSelectWholeCrew(event){
        try {
            const crewId = event.currentTarget.dataset.id;
            const checked = event.currentTarget.checked;

            if (checked) {
                const crewMembers = this.allCrewMembers.filter(m => m?.crewId === crewId);
                for (const member of crewMembers) {
                    // Only push if not already selected for this crew
                    const alreadyExists = this.selectedCrewAssignments.some(sel => sel.id === member.id && sel.crewId === crewId);
                    if (!alreadyExists) {
                        this.selectedCrewAssignments = [...this.selectedCrewAssignments, { id: member.id, crewId }];
                    }
                }
            } else {
                // Remove all selections belonging to this crew
                this.selectedCrewAssignments = this.selectedCrewAssignments.filter(sel => sel.crewId !== crewId);
            }
        } catch (e) {
            console.error('MobScheduler.handleSelectWholeCrew error:', e?.message);
        }
    }

    handleSelectResourceOption(event){
        try {
            let name = 'selectedResourceIdsForAssign';
            let id = event.currentTarget.dataset.id;
            let checked = event.currentTarget.checked;
            let type = event.currentTarget.dataset.type;
            if(checked){
                if(type == 'Crew'){
                    let crewId = event.currentTarget.dataset.crewid;
                    this.selectedCrewAssignments = [...this.selectedCrewAssignments, {id: id, crewId: crewId == 'NA' ? null : crewId}];
                }
                this[name] = [...this[name], id];
            } else{
                this.selectedCrewAssignments = this.selectedCrewAssignments.filter(item => item.id !== id);
                this[name] = this[name].filter(item => item !== id);
            }
        } catch (e) {
            console.error('MobScheduler.handleSelectResourceOption error:', e?.message);
        }
    }

    handleResourceAssign(event){
        try {
            event.preventDefault();
            this.showResourceAssignPopup = true;
            this.selectedCrewAssignments = [];
            this.selectedResourceIdsForAssign = [];
        } catch (e) {
            console.error('Error in function NewMobilizationCalendar.handleResourceAssign:::', error.message);
        }
    }

    handleCancelEdit() {
        this.showResourceAssignPopup = false;
    }

    // Confirmation
    askConfirmation(title, message, confirmLabel, confirmLabel2){
        this.isSpinner = false;
        this.confirmationTitle = title;
        this.confirmationMessage = message;
        this.confirmationBtnLabel = confirmLabel;
        this.confirmationBtnLabel2 = confirmLabel2 || null;
        this.showConfirmationPopup = true;
    }
    handleConfirmationAction(event){
        try {
            let name = event.currentTarget.name;
            if(name == 'confirm'){
                if(this.isOverlapJob){
                    this.jobAssignmentInfo.allowOverlap = true;
                    this.jobAssignmentInfo.overlapMode = 'ALL';
                    // this.jobAssignmentInfo.overlappingDates.map(ol => ({ ...ol, allowOverlap : true}));
                    this.addResourceForAssignment();
                    this.resourceIdToRemove = null;
                    this.mobIdToRemove = null;
                    this.typeOfResourceToRemove = null;
                } else if (this.isDropOrExpand){
                    this.handleEventDrop();
                }
            } else if(name == 'secondOption'){
                if(this.isOverlapJob){
                    this.jobAssignmentInfo.allowOverlap = true;
                    this.jobAssignmentInfo.overlapMode = 'SKIP';
                    // this.jobAssignmentInfo.overlappingDates.map(ol => ({ ...ol, allowOverlap : false}));
                    this.addResourceForAssignment();
                    this.resourceIdToRemove = null;
                    this.mobIdToRemove = null;
                    this.typeOfResourceToRemove = null;
                }
            } else {
                if(this.isDropOrExpand){
                    this.revertFunc();
                    this.event = null;
                    this.revertFunc = new function() {};
                }
            }

            this.showConfirmationPopup = false;
            this.isOverlapJob = false;
            this.isDropOrExpand = false;
            this.jobAssignmentInfo.overlappingDates = null;

            // Reset Confirm Popup Details
            this.confirmationTitle = 'Confirm!';
            this.confirmationMessage = 'Are you sure, you want to proceed';
            this.confirmationBtnLabel = 'Proceed';
            this.confirmationBtnLabel2 = null;
        } catch (e) {
            console.error('MobScheduler.handleConfirmationAction error:', e?.message);
        }
    }

    navigateToRecord(event) {
        try {
            let recordId = event.currentTarget.dataset.id;
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: recordId,
                    actionName: 'view',
                },
            });
        } catch (e) {
            console.error('error in navigateToRecord:', e.message);
        }
    }
}