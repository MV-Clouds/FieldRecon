import { LightningElement, track } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import CUSTOMCALENDAR from '@salesforce/resourceUrl/Customcalendar';
import EMPTYILLUSTRATION from '@salesforce/resourceUrl/svg_illustrations';

// Apex
// import getEvents from '@salesforce/apex/CalendarClass.getEvents';
// import updateRecords from '@salesforce/apex/CalendarClass.updateRecords';
// import updateRecordsNew from '@salesforce/apex/CalendarClass.updateRecordsNew';
// import updateNotes from '@salesforce/apex/CalendarClass.updateNotes';

export default class MobilizationCalendar extends LightningElement {
    @track showCalendar = false;
    @track showNoData = false;
    @track showFeatureAccess = false;

    @track statusNew = '';
    @track job = '';
    @track notes = '';
    @track statusOptions = [];

    calendarInitialized = false;
    calendar;

    sfDomain = '/lightning/setup/SetupOneHome/home'; // replace if dynamic
    emptyStateImage = EMPTYILLUSTRATION + '/empty-state-no-access.svg';

    renderedCallback() {
        if (this.calendarInitialized) {
            return;
        }
        this.calendarInitialized = true;

        Promise.all([
            loadStyle(this, CUSTOMCALENDAR + '/packages/core/main.css'),
            loadStyle(this, CUSTOMCALENDAR + '/packages/daygrid/main.css'),
            loadStyle(this, CUSTOMCALENDAR + '/packages/timegrid/main.css'),
            loadStyle(this, CUSTOMCALENDAR + '/packages/list/main.css'),
            loadScript(this, CUSTOMCALENDAR + '/packages/core/main.js'),
            loadScript(this, CUSTOMCALENDAR + '/packages/interaction/main.js'),
            loadScript(this, CUSTOMCALENDAR + '/packages/daygrid/main.js'),
            loadScript(this, CUSTOMCALENDAR + '/packages/timegrid/main.js'),
            loadScript(this, CUSTOMCALENDAR + '/packages/list/main.js'),
            loadScript(this, CUSTOMCALENDAR + '/packages/moment/main.js')
        ])
        .then(() => { 
            console.log('All scripts loaded'); 
            this.initCalendar();
        })
        .catch(error => {
            console.error('Error loading calendar libs', error);
        });
    }

    initCalendar() {
                // STATIC EVENTS FOR TESTING
                const staticEvents = [
                    {
                        id: '1',
                        title: 'Team Meeting',
                        start: new Date().toISOString(),
                        end: new Date(new Date().getTime() + 3600 * 1000).toISOString(),
                        extendedProps: { status: 'Pending', jobLocation: 'HQ', timeStart: '10:00', timeEnd: '11:00' }
                    },
                    {
                        id: '2',
                        title: 'Project Review',
                        start: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
                        end: new Date(new Date().setDate(new Date().getDate() + 1) + 7200 * 1000).toISOString(),
                        extendedProps: { status: 'Completed', jobLocation: 'Remote', timeStart: '14:00', timeEnd: '16:00' }
                    },
                    {
                        id: '3',
                        title: 'Client Call',
                        start: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(),
                        end: new Date(new Date().setDate(new Date().getDate() + 2) + 3600 * 1000).toISOString(),
                        extendedProps: { status: 'Pending', jobLocation: 'Online', timeStart: '09:00', timeEnd: '10:00' }
                    }
                ]
        const calendarEl = this.template.querySelector('.calendar-container');
        this.calendar = new FullCalendar.Calendar(calendarEl, {
            plugins: ['interaction', 'dayGrid', 'timeGrid', 'list'],
            initialView: 'dayGridWeek',
            headerToolbar: {
                left: 'today',
                center: 'prev,title,next',
                right: 'dayGridMonth,dayGridWeek,listMonth'
            },
            editable: true,
            events:  staticEvents,
            eventDrop: (info) => {
                console.log('Drop Event :: ', info.event);
                
                // updateRecords({
                //     recordId: info.event.id,
                //     startDate: info.event.start,
                //     endDate: info.event.end
                // });
            },
            eventResize: (info) => {
                console.log('Drop Resize :: ', info.event);
                // updateRecordsNew({
                //     recordId: info.event.id,
                //     startDate: info.event.start,
                //     endDate: info.event.end
                // });
            },
            eventClick: (info) => {
                // You could open a custom modal here like VF did with $Lightning.createComponent
                console.log('Event clicked', info.event.id);
            }
        });

        this.calendar.render();
    }

    handleStatusChange(e) {
        this.statusNew = e.detail.value;
        this.calendar.refetchEvents();
    }

    handleJobChange(e) {
        this.job = e.target.value;
    }

    refreshEvents() {
        this.calendar.refetchEvents();
    }

    handleNotesChange(e) {
        this.notes = e.target.value;
    }

    handleSaveNotes() {
        console.log('note');
        
        // updateNotes({ notes: this.notes })
        //     .then(() => console.log('Notes updated'))
        //     .catch(err => console.error(err));
    }
}