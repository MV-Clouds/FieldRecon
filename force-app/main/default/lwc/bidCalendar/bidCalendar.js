import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import FULL_CALENDAR from '@salesforce/resourceUrl/FullCalendarJS3';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getEvents from '@salesforce/apex/BidCalendarController.getEvents';
import getTimeZoneOffset from '@salesforce/apex/BidCalendarController.getTimeZoneOffset';
import SaveBidRecord from '@salesforce/apex/BidCalendarController.SaveBidRecord';
import getBid from '@salesforce/apex/BidCalendarController.getBid';
import deleteBid from '@salesforce/apex/BidCalendarController.deleteBid';
import getBidStatusOptions from '@salesforce/apex/BidCalendarController.getBidStatusOptions';
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';

export default class BidCalendar extends NavigationMixin(LightningElement) {
    fullCalendarLoaded = false;
    @track events = {};
    isSpinner = false;
    openModal = false;
    Heading = 'Create Bid';
    bidId;
    jobId;
    bidName = '';
    dueDate;
    status;
    description;
    @track statusOptions = [];
    confirmationPopup;
    showConfirmationPopup;
    confirmationTitle;
    confirmationMessage;
    event;
    filterStatus = [];
    filterBids;

    _oldEvent = {};
    revertFunc = new function() {};

    displayBids = {
        primaryField: 'Name',
    }

    matchingBids = {
        primaryField: { fieldPath: 'Name' }
    }

    // Permissions Flags
    hasFullAccess = false;

    get isEdit() {
        return this.bidName.length ? true : false;
    }

    get bidLink() {
        return '/' + this.bidId
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
                        end: new Date(ev.end).toLocaleDateString('en-CA')
                    }));
                } else {
                    this.events = [];
                }
                
                this.initialiseCalendarJs();
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load calendar or events', 'error');
                console.error('Error in BidCalendar.connectedCallback > loadScript', error?.body?.message || error?.message);
                this.isSpinner = false;
            });
    }

    fetchPermissions(){
        try{
            checkPermissionSetsAssigned({ psNames : ['FR_Admin']})
                .then((result) => {
                    this.hasFullAccess = result.isAdmin || result.all;
                })
                .catch((e) => {
                    console.error('Error in BidCalendar.fetchPermissions > checkPermissionSetsAssigned', e?.body?.message || e?.message);
                })
        } catch(e){
            console.error('Error in function BidCalendar.fetchPermissions:::', e?.message);
        }
    }

    fetchTimeZoneOffset(){
        try {
            getTimeZoneOffset()
                .then((result) => {
                    this.tzOffset = result;
                })
                .catch((e) => {
                    console.error('Error in BidCalendar.fetchTimeZoneOffset > getTimeZoneOffset :: ', e?.body?.message || e?.message);
                })
        } catch (e) {
            console.error('Error in BidCalendar.fetchTimeZoneOffset :: ', e?.message);
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


            if(!event.start || !this._oldEvent.start){
                this.showToast('Something Went Wrong!', 'Please refresh the tab and try again.', 'error');
                return;
            }

            const mergeDateAndTime = (dateOnly, timeOnly) => {
                return new Date(
                    dateOnly.getUTCFullYear(),
                    dateOnly.getUTCMonth(),
                    dateOnly.getUTCDate()
                );
            };
    
            const eventStartDate = new Date(event.start);
            const eventOldStartDate = new Date(this._oldEvent.start);
    
            const startLocal = mergeDateAndTime(eventStartDate);
            const oldStartLocal = mergeDateAndTime(eventOldStartDate);

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
            console.error('Error in function BidCalendar.getConfirmation:::', e?.message);
            this.showToast('Error', 'Something went wrong! Please try again.', 'error');
            revertFunc();
        }
    }

    handleClose(){
        this.showConfirmationPopup = false;
        this.event = null;
        this.refreshCalendar();
    }

    handleEventDrop() {
        try{
            this.showConfirmationPopup = false;
            let event = this.event;
            
            const toApexDateTimeString = (dateObj, timeObj) => {
                const year = dateObj.getUTCFullYear();
                const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getUTCDate()).padStart(2, '0');
                const hours = String(timeObj.getHours()).padStart(2, '0');
                const minutes = String(timeObj.getMinutes()).padStart(2, '0');
                const seconds = String(timeObj.getSeconds() || 0).padStart(2, '0');
    
                return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
            };

            const eventStartDate = new Date(event.start);
            eventEndDate.setDate(eventEndDate.getDate() - 1);

            const bidMap = {
                id: event.id || null,
                dueDate: toApexDateTimeString(eventStartDate),
                job: event.jobId,
                status: event.status || '',
                description: event.desc || ''
            };
            SaveBidRecord({ bidMap: bidMap })
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
        }catch (e) {
            console.error('Error in function BidCalendar.handleEventDrop:::', e?.message);
            this.showToast('Error', 'Something went wrong! Please try again.', 'error');
            this.revertFunc();
        }
    }

    loadStatusOptions(){
        try {
            getBidStatusOptions()
            .then((result) => {
                this.statusOptions = result || [];
                this.statusOptions.forEach(opt => {
                    opt.isSelected = true
                })
                this.filterStatus = this.statusOptions?.filter(opt => opt.isSelected)?.map(opt => opt.value) || [];
            })
            .catch(error => {
                console.error('Error in function BidCalendar.loadStatusOptions:::', error?.body?.message || error?.message);
            })
        } catch (e) {
            console.error('Error in function BidCalendar.loadStatusOptions:::', e?.message);
        }
    }

    handleResourceItemUpdate(event){
        try {
            let name = event.currentTarget.name;            
            this[name] = event.detail.recordId;            
        } catch (e) {
            console.error('Error in function BidCalendar.handleResourceItemUpdate:::', e?.message);
        }
    }

    refreshCalendar() {
        this.isSpinner = true;
        getEvents({job: this.filterBids, status: this.filterStatus})
        .then((result) => {
            console.log('result :: ', result);
            
            if (result && Array.isArray(result)) {                
                this.events = result.map(ev => ({
                    ...ev,
                    start: new Date(ev.start).toLocaleDateString('en-CA'),
                    end: new Date(ev.end).toLocaleDateString('en-CA')
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
        })
        .catch((e) => {
            console.error('Error in function BidCalendar.refreshCalendar:::', e?.message);
            this.isSpinner = false;
        });
    }

    handleJobChange(event) {
        this.bidId = event.target.value;
    }

    handleDueDateChange(event) {
        this.dueDate = event.target.value;        
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
            endDate.setDate(endDate.getDate() - 1);
        } catch (e) {
            this.isSpinner = false;
            console.error('Error in function BidCalendar.handleDateRangeSelect:::', e?.message);
            
        }
    }

    handleEventClick(recordId) {
        if(!this.hasFullAccess){
            this.showToast('Warning', 'You do not have permission to edit this event.','error');
            return;
        }
        this.isSpinner = true;
        getBid({recordId: recordId})
            .then((result)=>{
                this.isSpinner = false;
                this.bidName = result.name;
                this.bidId = result.id;
                this.status = result.status;
                this.description = result.description;
                this.Heading = 'Edit Bid';
                this.openModal = true;
                this.template.querySelector('.header').scrollIntoView({block: 'end'});
                this.selectedEventId = recordId;
            })
            .catch((e)=>{
                console.error('Error in function BidCalendar.handleEventClick:::', e?.message);
                this.isSpinner = false;
            });
    }

    handleSuccess(){
        this.showToast('Success', 'Record saved successfully!', 'success');
        this.openModal = false;
        this.resetTempVariables();
        this.refreshCalendar();
    }

    handleFormSubmitted(event){
        try {
            this.isSpinner = true;
            event.preventDefault();
            let details = event.detail.fields;

            const startLocal = this.removeOrgTimeZone(details.wfrecon__Bid_Due_Date__c);
            const nowLocal = new Date();

            let oldStartLocal = this.removeOrgTimeZone(this.startDateTime);
            
            if(this.isEdit && (startLocal.getTime() != oldStartLocal.getTime())){
                if(oldStartLocal.getTime() < nowLocal.getTime()){
                    this.showToast('Error', 'Only can change the due date for future bids', 'error');
                    return;
                }if(startLocal.getTime() < nowLocal.getTime()){
                    this.showToast('Error', 'Due date can not be set in the past.', 'error');
                    return;
                }
            }
            this.template.querySelector('lightning-record-edit-form.mob-group-form').submit(details);
        } catch (e) {
            console.error('BidCalendar.handleFormSubmitted error:', e?.message);
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
        this.bidId = '';
        this.status = '';
        this.description = '';
        this.bidName = '';
        this.selectedEventId = '';
    }

    handleDeleteMobilization() {
        this.isSpinner = true;
        deleteBid({recordId: this.selectedEventId})
            .then(()=>{
                this.showToast('Success', 'Bid Deleted', 'success');
                this.handleModalClose();
                this.refreshCalendar();
                this.isSpinner = false;
            })
            .catch((error)=>{
                this.showToast('Error', 'Error Deleting Bid', 'error');
                this.isSpinner = false;
            })
    }

    handleFilter(event){
        try {
            if(event.target.name === 'bidId') {
                this.filterBids = event.detail.recordId;
            } else {
                let value = event.currentTarget.dataset.value;
                let statusToUpdate = this.statusOptions.find(opt => opt.value == value);
                statusToUpdate.isSelected = !statusToUpdate.isSelected;
                
                this.filterStatus = this.statusOptions?.filter(opt => opt.isSelected)?.map(opt => opt.value) || [];
            }
            this.refreshCalendar();
        } catch (e) {
            console.error('Error in function BidCalendar.handleFilter:::', e?.message);
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
                if (this.isDropOrExpand){
                    this.handleEventDrop();
                }
            } else {
                if(this.isDropOrExpand){
                    this.revertFunc();
                    this.event = null;
                    this.revertFunc = new function() {};
                }
            }

            this.showConfirmationPopup = false;
            this.isDropOrExpand = false;

            // Reset Confirm Popup Details
            this.confirmationTitle = 'Confirm!';
            this.confirmationMessage = 'Are you sure, you want to proceed';
            this.confirmationBtnLabel = 'Proceed';
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