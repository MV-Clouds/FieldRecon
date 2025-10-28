import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getMobilizationDetails from '@salesforce/apex/MobSchedulerController.getMobilizationDetails';
import getResourceDetails from '@salesforce/apex/MobSchedulerController.getResourceDetails';
import removeJobResource from '@salesforce/apex/MobSchedulerController.removeJobResource';
import assignResourceToMob from '@salesforce/apex/MobSchedulerController.assignResourceToMob';
import assignResourceToJob from '@salesforce/apex/MobSchedulerController.assignResourceToJob';
import deleteMobilization from '@salesforce/apex/MobSchedulerController.deleteMobilization';
import getDefaultValues from '@salesforce/apex/MobSchedulerController.getDefaultValues';
import getAllResources from '@salesforce/apex/MobSchedulerController.getAllResources';

export default class MobScheduler extends NavigationMixin(LightningElement) {
    showSpinner = false;

    @track isDayView = true;
    @track isResourceView = false;
    @track isWeekView = false;

    @track resources = [];
    @track filteredResources = [];
    @track weekDays = [];
    @track dayView = { day: '', date: '', iso: '', events: [] };
    @track filteredDayView = { day: '', date: '', iso: '', events: [] };

    @track periodRangeLabel = '';
    @track weekEvents = [];
    @track filteredEvents = [];

    @track resourceType = 'Crew';
    @track resourceTypeForAssign = 'Crew';

    currentWeekStart;
    searchKey = '';
    resourceSearchKey = '';

    // Filter Variables
    selectedStatusFilter = null;

    defaultMobGValues = {
        'start': null,
        'end': null,
        'includeSaturday': false,
        'includeSunday': false
    };

    // Modal Popup Variables
    showFormPopup = false;

    isMobEditForm = false;
    mobIdToEdit = '';

    isMobGroupCreate = false;
    startDateForMG = new Date();
    endDateForMG = this.startDateForMG + 7;

    isResourcesEditForm = false;
    mobIdForResources = null;
    allCrewMembers = [];
    allSubContractors = [];
    allAssets = [];

    isAssignForm = false;
    isAssetAssignment = false;
    selectedResourceId = null;
    selectedMobId = null;
    selectedJobId = null;

    // Confirmation Popup
    showConfirmationPopup = false;
    confirmationTitle = 'Confirm!';
    confirmationMessage = 'Are you sure, you want to proceed';
    confirmationBtnLabel = 'Confirm';
    
    isOverlap = false;
    isAllowOverLap = false;

    isOverlapJob = false;
    jobAssignmentInfo = {};
    selectedResourceIdsForAssign = [];
    selectedCrewAssignments = [];

    isRemove = false;
    resourceIdToRemove = null;
    typeOfResourceToRemove = '';

    isMobDelete = false;
    mobIdToDelete = null;

    get resourceObjectApi(){
        return this.resourceType == 'Asset' ? 'wfrecon__Equipment__c' : 'Contact';
    }

    displayResource = {
        primaryField: 'Name',
        additionalFields: ['CreatedBy.Name']
    }

    matchingResource = {
        primaryField: { fieldPath: 'Name' }, 
        additionalFields: [{ fieldPath: 'CreatedBy.Name' }]
    }

    get filterResource() {
        return this.resourceType == 'Asset' ?  null :
        {
            criteria: [
                {
                    fieldPath: 'RecordType.DeveloperName',
                    operator: 'eq',
                    value: this.resourceType == 'Crew' ? 'Employee_WF_Recon' : 'Sub_Contractor_WF_Recon',
                },
                {
                    fieldPath: 'wfrecon__User__r.IsActive',
                    operator: 'eq',
                    value: true,
                }
            ]
        }
    };

    jobFilters = {
        criteria: [
            {
                fieldPath: 'wfrecon__End_Date_Rollup__c',
                operator: 'gte',
                value: { literal: 'TODAY' }
            },
            {
                fieldPath: 'wfrecon__End_Date_Rollup__c',
                operator: 'ne',
                value: null
            }
        ]
    }
    displayJobs = {
        primaryField: 'Name',
        additionalFields: ['wfrecon__Job_Name__c']
    }

    matchingJobs = {
        primaryField: { fieldPath: 'Name' }, 
        additionalFields: [{ fieldPath: 'wfrecon__Job_Name__c' }]
    }

    displayMobs = {
        primaryField: 'wfrecon__Start_Date_Text__c',
        additionalFields: ['Name']
    }

    matchingMobs = {
        primaryField: { fieldPath: 'wfrecon__Start_Date_Text__c' },
        additionalFields: [{ fieldPath: 'Name' }]
    }

    get filterDates(){
        return {
            criteria: [
                {
                    fieldPath: 'wfrecon__Job__c',
                    operator: 'eq',
                    value: this.selectedJobId,
                },
                {
                    fieldPath: 'wfrecon__Start_Date__c',
                    operator: 'gte',
                    value: { literal: 'TODAY' }
                }
            ]
        }
    }

    get isCrewAssignOpen(){
        return this.isResourcesEditForm && this.resourceTypeForAssign == 'Crew';
    }

    get resourceOptionsToShow() {
        let resources = [];
        const search = this.resourceSearchKey?.toLowerCase() || '';
        const addedResourcesForMob = this.addedResources?.map(res => res.id) || [];

        if (this.resourceTypeForAssign === 'Crew') {
            // Use groupedCrew created earlier (e.g. via groupCrewByTeam)
            const groupedCrewList = this.groupCrewByTeam(this.allCrewMembers || []);

            // Apply search filter on group or member name
            const filteredGroups = groupedCrewList
            .map(group => {
                const filteredMembers = group.members.filter(m =>
                    !search || m.name?.toLowerCase().includes(search)
                );

                if (filteredMembers.length > 0 || group.crewName?.toLowerCase().includes(search)) {
                    
                    const members = filteredMembers.map(m => ({
                        ...m,
                        isSelected: (this.selectedCrewAssignments || []).some(sel => sel.id === m.id && (!sel.crewId || sel.crewId === (group.id))),
                        isAddedForMob: addedResourcesForMob.includes(m.id)
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

            // console.log('Filtered Are :: ',filteredGroups);
            
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
            isAddedForMob: addedResourcesForMob.includes(res.id)
        }));
    }


    get addedResources(){
        let selectedTiles = [];
        if(this.resourceTypeForAssign == 'Crew'){
            selectedTiles = (this.isDayView ? this.dayView?.events?.find(ev => ev.id === this.mobIdForResources)?.crew : this.weekDays?.flatMap(day => day.events)?.filter(event => event.id === this.mobIdForResources)?.flatMap(event => event.crew)) || [];
        } else if(this.resourceTypeForAssign == 'Asset'){
            selectedTiles = (this.isDayView ? this.dayView?.events?.find(ev => ev.id === this.mobIdForResources)?.assets : this.weekDays?.flatMap(day => day.events)?.filter(event => event.id === this.mobIdForResources)?.flatMap(event => event.assets)) || [];
        } else if(this.resourceTypeForAssign == 'SubContractor'){
            selectedTiles = (this.isDayView ? this.dayView?.events?.find(ev => ev.id === this.mobIdForResources)?.subcontractors : this.weekDays?.flatMap(day => day.events)?.filter(event => event.id === this.mobIdForResources)?.flatMap(event => event.subcontractors)) || []
        }
        return selectedTiles;
    }

    // Main tab classes
    get resourceTabClass() { return this.isResourceView ? 'tab-nav-btn header-tab-nav-btn active' : 'tab-nav-btn header-tab-nav-btn'; }
    get weekTabClass() { return this.isWeekView ? 'tab-nav-btn header-tab-nav-btn active' : 'tab-nav-btn header-tab-nav-btn border-inline-nav-btn'; }
    get dayTabClass() { return this.isDayView ? 'tab-nav-btn header-tab-nav-btn active' : 'tab-nav-btn header-tab-nav-btn'; }

    get popupHeader(){
        if(this.isMobGroupCreate) return 'Create Mobilization Group';
        if(this.isMobEditForm) return 'Edit Mobilization';
        if(this.isAssignForm) return `Assign ${this.resourceType}`;
        return 'Assign Resources';
    }

    get selectedDateToShow(){
        return this.currentWeekStart ? this.currentWeekStart.toISOString().slice(0,10) : null;
    }

    connectedCallback() {
        this.showLoading(true);
        this.initDay(new Date());
        this.loadDefaultMobGroupValues();
    }

    loadDefaultMobGroupValues(){
        try {
            getDefaultValues()
            .then(result =>{                
                let timeDefaults = result?.time;
                this.defaultMobGValues = timeDefaults;
            })
            .catch(e => {
                console.error('MobScheduler.loadDefaultMobGroupValues apex:getDefaultValues error:', e?.body?.message || e?.message);
            })
        } catch (e) {
            console.error('MobScheduler.loadDefaultMobGroupValues error:', e?.message);
        }
    }

    loadAllResources(selectedDate){
        try {
            this.showLoading(true);
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

                this.showLoading(false);
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


    // Tab switching
    showResourceView() {
        this.isResourceView = true;
        this.isWeekView = false;
        this.isDayView = false;
        this.currentWeekStart = this.currentWeekStart || new Date();
        this.initWeek(this.currentWeekStart);
    };
    showWeekView() {
        this.isResourceView = false;
        this.isWeekView = true;
        this.isDayView = false;
        this.currentWeekStart = this.currentWeekStart || new Date();
        this.initWeek(this.currentWeekStart);
    };
    showDayView() {
        this.isResourceView = false;
        this.isWeekView = false;
        this.isDayView = true;
        this.currentWeekStart = this.currentWeekStart || new Date();
        this.initDay(this.currentWeekStart);
    };

    // Select resource type
    selectResourceType(event) {
        let name = event.target.name;
        let forWhat = event.currentTarget.dataset.for;

        if(forWhat == 'assign'){
            this.resourceTypeForAssign = name;
            this.selectedWholeCrewIds = [];
            this.selectedCrewAssignments = [];
            this.selectedResourceIdsForAssign = [];
        } else{
            this.resourceType = name;
        }
        if (forWhat != 'assign') this.loadResourceData(name);
    }

    // Period navigation
    prevPeriod() {
        if (this.isWeekView || this.isResourceView) {
            const prev = new Date(this.currentWeekStart);
            prev.setDate(prev.getDate() - 7);
            this.initWeek(prev);
        } else if (this.isDayView) {
            const prev = new Date(this.currentWeekStart);
            prev.setDate(prev.getDate() - 1);
            this.initDay(prev);
        }
    };

    nextPeriod() {
        
        if (this.isWeekView || this.isResourceView) {
            const next = new Date(this.currentWeekStart);
            next.setDate(next.getDate() + 7);
            this.initWeek(next);
        } else if (this.isDayView) {
            const next = new Date(this.currentWeekStart);
            next.setDate(next.getDate() + 1);
            this.initDay(next);
        }
    };

    handleDateToGoTo(event){
        try{
            let val = event.currentTarget?.value;
            if(!val) return;
            this.currentWeekStart = new Date(val);
            this.isDayView ? this.initDay(this.currentWeekStart) : this.initWeek(this.currentWeekStart);
        }catch(e){
            console.error('MobScheduler.handleDateToGoTo error:', e?.message);
        }
    }

    handleStatusFilterChange(event){
        try {
            this.selectedStatusFilter = event.detail?.value;
            this.applySearchFilter();
        } catch (e) {
            console.error('MobScheduler.handleStatusFilterChange error:', e?.message);
        }
    }

    handleSearchValueChange(event){
        try {
            this.searchKey = event.currentTarget?.value || '';
            this.applySearchFilter();
        } catch (e) {
            console.error('MobScheduler.handleSearchValueChange error:', e?.message);
        }
    }

    handleResourceSearch(event){
        try {
            this.resourceSearchKey = event.currentTarget?.value || '';
        } catch (e) {
            console.error('MobScheduler.handleResourceSearch error:', e?.message);
        }
    }


    // Init Week
    initWeek(date) {
        this.showLoading(true);
        const start = new Date(date);
        start.setDate(start.getDate() - start.getDay()); // Sunday
        this.currentWeekStart = start;

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push({
                iso: d.toISOString().slice(0, 10),
                label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
                day: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
                date: d.getDate().toString(),
                events: []
            });
        }
        this.weekDays = days;
        this.periodRangeLabel = `${days[0].label} - ${days[6].label}`;

        this.isResourceView ? this.loadResourceData(this.resourceType) : this.loadData('week');
    }

    // Init Day
    initDay(date) {
        this.showLoading(true);
        this.currentWeekStart = date;

        const iso = date.toISOString().slice(0, 10);
        this.dayView = {
            iso: iso,
            day: date.toLocaleDateString(undefined, { weekday: 'long' }),
            date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            events: []
        };

        this.periodRangeLabel = `${this.dayView.day}, ${this.dayView.date}`;

        this.loadData('day');
    }

    // Load Week/Day data
    loadData(mode = 'week') {
        this.showLoading(true);
        let startDateStr, endDateStr;

        const start = new Date(this.currentWeekStart);
        startDateStr = start.toISOString().slice(0, 10);
        if (mode === 'week') {
            const end = new Date(this.currentWeekStart);
            end.setDate(end.getDate() + 6);
            endDateStr = end.toISOString().slice(0, 10);
        } else if (mode === 'day') {
            endDateStr = startDateStr;
        } else {
            console.error('Invalid loadData call: mode or selectedDate missing');
            this.showLoading(false);
            return;
        }

        getMobilizationDetails({ startDate: startDateStr, endDate: endDateStr })
            .then(data => {
                console.log('Data is :: ', data );
                
                this.weekEvents = data.weekEvents || [];
                this.applySearchFilter();
                mode === 'week' ? this.mapWeekData() : this.mapDayData();
            })
            .catch(e => {
                console.error('MobScheduler.loadData apex:getMobilizationDetails error:', e?.body?.message || e?.message);
                this.showLoading(false);
            });
    }

    // Load Resource-specific data
    loadResourceData(resourceType = 'Crew', selectedDate = null) {
        this.showLoading(true);
        const start = this.currentWeekStart;
        const end = new Date(this.currentWeekStart);
        end.setDate(end.getDate() + 6);

        const startDateStr = start.toISOString().slice(0,10);
        const endDateStr = (selectedDate || end).toISOString().slice(0,10);

        getResourceDetails({ startDate: startDateStr, endDate: endDateStr, resourceType })
            .then(data => {
                // Map data into table per week
                this.resources = this.weekDays.map(day => {
                    return day; // placeholder, mapping below
                });

                // Map resources
                this.resources = [];
                const weekMap = {};
                for (let day of this.weekDays) {
                    weekMap[day.iso] = day.iso;
                }

                // Build resources with jobs per day
                const resMap = {};
                data.forEach(item => {
                    if (!resMap[item.id]) {
                        resMap[item.id] = { id: item.id, name: item.name, days: this.weekDays.map(d => ({ iso: d.iso, events: [] })) };
                    }
                    const dayIso = new Date(item.start).toISOString().slice(0,10);
                    const dayObj = resMap[item.id].days.find(d => d.iso === dayIso);
                    if (dayObj) dayObj.events.push({ id: item.junctionId, jobName: item.jobName, jobId: item.jobId, jId: item.jId, status: item.status, statusStyle: item.statusStyle, isPast: new Date(item.end) < new Date() });
                });

                this.resources = Object.values(resMap);
                this.applySearchFilter();
                
                this.showLoading(false);
            })
            .catch(e => {
                console.error('MobScheduler.loadResourceData apex:getResourceDetails error:', e?.body?.message || e?.message);
                this.showLoading(false);
            });
    }

    applySearchFilter() {
        try {
            const key = this.searchKey?.toLowerCase();
            const statusFilter = this.selectedStatusFilter; // null or specific status

            if (!key && !statusFilter) {
                if (!this.isResourceView) {
                    this.filteredEvents = JSON.parse(JSON.stringify(this.weekEvents));
                    this.isWeekView ? this.mapWeekData() : this.mapDayData();
                    return;
                } else {
                    this.filteredResources = JSON.parse(JSON.stringify(this.resources));
                    return;
                }
            }

            if (this.isResourceView) {
                this.filteredResources = this.resources.map(resource => {
                    const keyLower = key;

                    // check if resource name matches
                    const isResourceMatch = resource.name?.toLowerCase().includes(keyLower);

                    // if resource name matches, return it as is (all days, all events)
                    if (isResourceMatch && !statusFilter) return { ...resource, days: resource.days };

                    let anyDayMatched = false;

                    // map all days
                    const updatedDays = resource.days.map(day => {
                        // filter matching events for this day
                        const filteredEvents = day.events.filter(event =>
                            event.status == statusFilter && (isResourceMatch || (event.jobName?.toLowerCase().includes(keyLower) ||
                            event.jobId?.toLowerCase().includes(keyLower)))
                        );

                        // if any events matched, mark the flag
                        if (filteredEvents.length > 0) {
                            anyDayMatched = true;
                            return { ...day, events: filteredEvents };
                        }

                        // keep day but empty events if not matching
                        return { ...day, events: [] };
                    });

                    if (anyDayMatched) {
                        return { ...resource, days: updatedDays };
                    }

                    return null;
                }).filter(r => r !== null);

                return;
            }

            // Event view (week/day)
            this.filteredEvents = this.weekEvents.filter(event => {
                // First, check status if filter applied
                if (statusFilter && event.status !== statusFilter) return false;

                // Match Job Name or Location
                if ((event.jobId && event.jobId.toLowerCase().includes(key)) ||
                    (event.jobName && event.jobName.toLowerCase().includes(key)) ||
                    (event.location && event.location.toLowerCase().includes(key))) {
                    return true;
                }

                // Match Crew
                if (event.crew?.some(c => c.name.toLowerCase().includes(key))) return true;

                // Match Assets
                if (event.assets?.some(a => a.name.toLowerCase().includes(key))) return true;

                // Match Subcontractors
                if (event.subcontractors?.some(s => s.name.toLowerCase().includes(key))) return true;

                return false; // no match
            });

            this.isWeekView ? this.mapWeekData() : this.mapDayData();

        } catch(e) {
            console.error('MobScheduler.applySearchFilter error:', e?.message);
        }
    }



    // Map week data
    mapWeekData() {
        this.weekDays = this.weekDays.map(day => {
            const dayEvents = this.filteredEvents?.filter(ev => {
                const evIso = new Date(ev.start).toLocaleDateString('en-CA');                
                return evIso === day.iso;
            }).map(ev => this.normalizeEvent(ev));
            return { ...day, events: dayEvents };
        });
        this.showLoading(false);
    }

    // Map day data
    mapDayData() {
        const dayIso = this.currentWeekStart.toLocaleDateString('en-CA');
        const dayEvents = this.filteredEvents?.filter(ev => {
            const evIso = new Date(ev.start).toLocaleDateString('en-CA');
            return evIso === dayIso;
        }).map(ev => this.normalizeEvent(ev));

        this.dayView = { ...this.dayView, events: dayEvents };
        this.showLoading(false);
    }

    // Normalize event fields
    normalizeEvent(ev) {
        const startTime = new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const endTime = new Date(ev.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const startDayTime = new Date(ev.start).toLocaleTimeString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        const endDayTime = new Date(ev.end).toLocaleTimeString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

        return {
            ...ev,
            start: startTime,
            date: new Date(ev.start).toLocaleDateString('en-CA'),
            end: endTime,
            crew: ev.crew || [],
            assets: ev.assets || [],
            subcontractors: ev.subcontractors || [],
            isPast: new Date(ev.end) < new Date(),
            startDayTime,
            endDayTime
        };
    }


    // ----------------------------- Data Interaction Related Functions -------------------------------

    handleAddMobilizationGroup(){
        try{
            this.handleClosePopup();
            this.showFormPopup = true;
            this.isMobGroupCreate  = true;
        }catch(e){
            console.error('MobScheduler.handleAddMobilizationGroup error:', e?.message);
        }
    }

    handleCreateMobSubmitted(event){
        try {
            this.showLoading(true);
            event.preventDefault();
            let details = event.detail.fields;
            const start = Date.parse(details.wfrecon__Start_Date__c);
            const end = Date.parse(details.wfrecon__End_Date__c);

            if (start < new Date()) {
                this.showToast('Error', 'Start date/time can not be in past.', 'error');
            }else if (start > end) {
                this.showToast('Error', 'End date should be after the start date.', 'error');
            }else{
                this.template.querySelector('lightning-record-edit-form.mob-group-form').submit(details);
            }
        } catch (e) {
            console.error('MobScheduler.handleCreateMobSubmitted error:', e?.message);
        }
    }

    handleRemoveAssignment(event){
        try {
            let id = event.currentTarget.dataset.id;
            if(!id){
                console.error('MobScheduler.handleRemoveAssignment error: id is not defined');
                return;
            } else if(this.resourceType){
                this.isRemove = true;
                this.resourceIdToRemove = id;
                this.typeOfResourceToRemove = this.resourceType;
                // this.showConfirmationPopup = true;
                this.askConfirmation('Remove Resource!', 'Are you sure you want to remove this resource from a day?', 'Remove');
            }
        } catch (e) {
            console.error('MobScheduler.handleRemoveAssignment error:', e?.message);
        }
    }

    removeJobAssignment(id, type = this.resourceType){
        try{
            this.showLoading(true);
            removeJobResource({ id: id, type: type })
            .then(result => {
                if(result === 'success'){
                    this.isDayView ? this.initDay(this.currentWeekStart) : this.initWeek(this.currentWeekStart);
                }else{
                    this.showToast('Error', 'Could not remove job, please try again...', 'error');
                    this.showLoading(false);
                }
            })
            .catch(error => {
                this.showToast('Error', 'Could not remove job, please try again...', 'error');
                console.error('MobScheduler.removeJobAssignment apex:removeJobResource error:', error?.body?.message || error?.message);
                this.showLoading(false);
            })
        } catch(e){
            this.showToast('Error', 'Could not remove job, please try again...', 'error');
            console.error('MobScheduler.removeJobAssignment error:', e?.message);
            this.showLoading(false);
        }
    }

    handleAssignResource(event){
        try{
            let iso = event.currentTarget.dataset.iso;
            let resource = event.currentTarget.dataset.resource;

            this.handleClosePopup();
            this.selectedMobId = iso;
            this.selectedResourceId = resource;
            this.isAssignForm = true;
            this.isAssetAssignment = this.resourceType == 'Asset' ? true : false;
            this.showFormPopup = true;
        } catch (e) {
            console.error('MobScheduler.handleAssignResource error:', e?.message);
            this.showLoading(false);
            this.showToast('Error', 'Could not assign job, please try again...', 'error');
        }
    }

    handleEditResource(event){
        try {
            this.handleClosePopup();
            this.loadAllResources(event.detail.date);
            
            this.mobIdForResources = event.detail.id;
            this.showFormPopup = true;
            this.isResourcesEditForm = true;
        } catch (e) {
            console.error('MobScheduler.handleEditResource error:', e?.message);
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
            console.log('The Map now:', this.selectedCrewAssignments);
        } catch (e) {
            console.log('Error in function handleSelectWholeCrew:::', e.message);
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

            console.log('The Map now:', this.selectedCrewAssignments);
            
        } catch (e) {
            console.error('MobScheduler.handleSelectResourceOption error:', e?.message);
        }
    }

    handleJobCardDelete(event){
        try {
            this.mobIdToDelete = event.detail;
            this.isMobDelete = true;
            this.askConfirmation('Delete Mobilization!', 'Are you sure you want to delete this mobilization for selected day?', 'Delete');
        } catch (e) {
            console.error('MobScheduler.handleJobCardDelete error:', e?.message);
        }
    }

    deleteMob(id){
        try {
            this.showLoading(true);
            deleteMobilization({ mobId: id })
            .then(result => {
                if(result === 'success'){
                    this.isDayView ? this.initDay(this.currentWeekStart) : this.initWeek(this.currentWeekStart);
                }else{
                    this.showToast('Error', 'Could not delete mobilization, please try again...', 'error');
                    this.showLoading(false);
                }
            })
            .catch(error => {
                this.showToast('Error', 'Could not delete mobilization, please try again...');
                console.error('MobScheduler.deleteMobilization apex:deleteMobilization error:', error?.body?.message || error?.message);
            })
            
        } catch (e) {
            this.showToast('Error', 'Could not delete mobilization, please try again...');
            console.error('MobScheduler.deleteMob error:', e?.message);
        }
    }

    // Popup Methods
    handleJobCardEdit(event) {
        try {
            this.handleClosePopup();
            this.showLoading(true);
            this.mobIdToEdit = event.detail;
            this.isMobEditForm = true;
            this.showFormPopup = true;
        } catch (e) {
            this.showToast('Error', 'Could not open the edit form. Please try again.', 'error');
        }
    }

    handleCancelEdit() {
        this.showFormPopup = false;
        this.isMobEditForm = false;
        this.isMobGroupCreate = false;
    }

    handleSuccess() {
        this.mobIdToEdit = '';
        this.showFormPopup = false;
        this.isMobEditForm = false;
        this.isMobGroupCreate = false;
        this.isDayView ? this.initDay(this.currentWeekStart) : this.initWeek(this.currentWeekStart);
    }

    handleFormLoaded() {
        this.showLoading(false);
    }

    handleError(event) {
        const msg = event?.detail ? JSON.stringify(event.detail) : 'Unknown error';
        console.error('MobScheduler.handleError error:', msg);
        this.showToast('Error', 'Something went wrong, please try again...', 'error');
    }

    // Resource Assignment Popup
    handleResourceItemUpdate(event){
        try {
            let name = event.currentTarget.name;
            this[name] = event.detail.recordId;
        } catch (e) {
            console.error('MobScheduler.handleResourceItemUpdate error:', e?.message);
        }
    }

    handleSaveChanges(){
        try {
            this.showLoading(true);
            if(!this.selectedResourceId || !this.selectedJobId || !this.selectedMobId){
                const inputs = this.template.querySelectorAll('.assign-form-picker') || [];
                for(let i = 0; i < inputs.length; i++){
                    inputs[i].reportValidity();
                }
                this.showToast('Error', 'Please select all the required fields.', 'error');
                return;
            }else{
                let assignmentData = { 
                    resourceId: this.selectedResourceId, 
                    mobId: this.selectedMobId, 
                    type: this.resourceType,
                    allowOverlap: this.isAllowOverLap
                }
                assignResourceToMob({assignmentData: assignmentData})
                .then(result => {
                    if(result == 'ASSIGNED'){
                        this.showToast('Already Assigned!', 'Resource is already been assigned to this job on selected day.', 'error');
                    }else if(result == 'OVERLAP'){
                        this.isOverlap = true;
                        this.askConfirmation('Time Overlapping!', 'Resource allocation is overlapping. Do you still want to assign?', 'Assign')
                        // this.showConfirmationPopup = true;
                        // this.showLoading(false);
                        // this.isAllowOverLap = true;
                        // this.showToast('Error', 'Resource is already assigned to job in this period.', 'error');
                        // return;
                    }else if(result == 'success'){
                        this.showToast('Success', 'Resource assigned successfully.', 'success');
                        this.isDayView ? this.initDay(this.currentWeekStart) : this.initWeek(this.currentWeekStart);
                        this.showFormPopup = false;
                        this.isAssignForm = false;
                    }else{
                        this.showToast('Error', 'Could not assign resource to a job, please try again...', 'error');
                    }
                })
                .catch(error => {
                    this.showToast('Error', 'Could not assign job, please try again...', 'error');
                    console.error('MobScheduler.handleSaveChanges apex:assignResourceToMob error:', error?.body?.message || error?.message);
                });
            }
        } catch (e) {
            console.error('MobScheduler.handleSaveChanges error:', e?.message);
        }
    }


    // Job Card Resource Editing Form
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
                    this.isDayView ? this.initDay(this.currentWeekStart) : this.initWeek(this.currentWeekStart);
                    this.showFormPopup = false;
                    this.isAssignForm = false;
                    this.selectedCrewAssignments = [];
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

    handleRemoveJobResource(event){
        try {
            let id = event.currentTarget.dataset.id;
            let type = event.currentTarget.dataset.type;
            
            this.isRemove = true;
            this.resourceIdToRemove = id;
            this.typeOfResourceToRemove = type;
            this.askConfirmation('Remove Resource!', 'Are you sure you want to remove this resource from a day?', 'Remove');
        } catch (e) {
            console.error('MobScheduler.handleRemoveJobResource error:', e?.message);
        }
    }

    handleRemoveResourceFromCard(event){
        try {
            let id = event.detail.id;
            let type = event.detail.type;
            this.isRemove = true;
            this.resourceIdToRemove = id;
            this.typeOfResourceToRemove = type;
            this.askConfirmation('Remove Resource!', 'Are you sure you want to remove this resource from a day?', 'Remove');
        } catch (e) {
            console.error('MobScheduler.handleRemoveResourceFromCard error:', e?.message);
        }
    }

    handleRecordNavigation(event){
        try {
            let id = event.currentTarget.dataset.id;
            id && this.navigateToRecord(id);
        } catch (e) {
            console.error('MobScheduler.handleRecordNavigation error:', e?.message);
        }
    }

    // Generic Methods
    showLoading(isLoading){
        this.showSpinner = isLoading;
    }

    showToast(title, message, variant){
        this.showLoading(false);
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: 'dismissable'
        });
        this.dispatchEvent(evt);
    }

    navigateToRecord(recordId) {
        try {
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

    handleClosePopup(){
        this.showFormPopup = false;
        this.isMobEditForm = false;
        this.isMobGroupCreate = false;

        this.isAssignForm = false;
        this.selectedJobId = null;
        this.selectedResourceId = null;
        this.selectedMobId = null;
        
        this.isResourcesEditForm = false;
        this.selectedCrewAssignments = [];
        this.selectedResourceIdsForAssign = [];
    }

    // Confirmation
    askConfirmation(title, message, confirmLabel){
        this.showLoading(false);
        this.confirmationTitle = title;
        this.confirmationMessage = message;
        this.confirmationBtnLabel = confirmLabel;
        this.showConfirmationPopup = true;

    }
    handleConfirmationAction(event){
        try {
            let name = event.currentTarget.name;
            if(name == 'confirm'){
                if(this.isOverlap){
                    this.isAllowOverLap = true;
                    this.handleSaveChanges();
                    this.isAllowOverLap = false;
                } else if(this.isOverlapJob){
                    this.jobAssignmentInfo.allowOverlap = true;
                    this.jobAssignmentInfo.overlapMode = 'ALL';
                    // this.jobAssignmentInfo.overlappingDates.map(ol => ({ ...ol, allowOverlap : true}));
                    this.addResourceForAssignment();
                    this.resourceIdToRemove = null;
                    this.typeOfResourceToRemove = null;
                } else if(this.isRemove){
                    this.removeJobAssignment(this.resourceIdToRemove, this.typeOfResourceToRemove);
                    this.resourceIdToRemove = null;
                    this.typeOfResourceToRemove = null;
                } else if(this.isMobDelete){
                    this.deleteMob(this.mobIdToDelete);
                    this.mobIdToDelete = null;
                }
            } else if(name == 'noOverlap'){
                if(this.isOverlapJob){
                    this.jobAssignmentInfo.allowOverlap = true;
                    this.jobAssignmentInfo.overlapMode = 'SKIP';
                    // this.jobAssignmentInfo.overlappingDates.map(ol => ({ ...ol, allowOverlap : false}));
                    this.addResourceForAssignment();
                    this.resourceIdToRemove = null;
                    this.typeOfResourceToRemove = null;
                }
            }

            this.showConfirmationPopup = false;
            this.isOverlap = false;
            this.isOverlapJob = false;
            this.isRemove = false;
            this.isMobDelete = false;
            this.jobAssignmentInfo.overlappingDates = null;

            // Reset Confirm Popup Details
            this.confirmationTitle = 'Confirm!';
            this.confirmationMessage = 'Are you sure, you want to proceed';
            this.confirmationBtnLabel = 'Confirm';
        } catch (e) {
            console.error('MobScheduler.handleConfirmationAction error:', e?.message);
        }
    }
}