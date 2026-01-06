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
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';

// Platform Event Imports
import { subscribe, unsubscribe, onError } from 'lightning/empApi';

export default class MobScheduler extends NavigationMixin(LightningElement) {
    showSpinner = false;
    @track hasAccess = false;
    @track accessErrorMessage = '';

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

    @track resourceType = 'CrewMaster';
    @track resourceTypeForAssign = 'Crew';

    @track currentWeekStart;
    searchKey = '';
    resourceSearchKey = '';
    @track statusOptions = [];

    // Filter Variables
    selectedStatusFilter = [];

    defaultMobGValues = {
        'start': null,
        'end': null,
        'includeSaturday': false,
        'includeSunday': false
    };
    tzOffset = 0;

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
    confirmationBtnLabel = 'Proceed';
    confirmationBtnLabel2 = null;

    isOverlap = false;
    isAllowOverLap = false;

    isOverlapJob = false;
    jobAssignmentInfo = {};
    selectedResourceIdsForAssign = [];
    selectedCrewAssignments = [];

    isRemove = false;
    resourceIdToRemove = null;
    mobIdToRemove = null;
    typeOfResourceToRemove = '';

    isMobDelete = false;
    mobIdToDelete = null;

    // Platform Event Subscription
    channelName = '/event/wfrecon__Job_Change_Event__e';
    subscription = {};

    get resourceObjectApi(){
        // return this.resourceType == 'Asset' ? 'wfrecon__Equipment__c' : 'Contact';
        switch(this.resourceType){
            case 'Asset':
                return 'wfrecon__Equipment__c';
            case 'CrewMaster':
                return 'wfrecon__Crew__c';
            default:
                return 'Contact';
        }
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
        return this.resourceType == 'Asset' || this.resourceType == 'CrewMaster' ?  null :
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

    get isEmployeeAssignOpen(){
        return this.resourceType == 'Crew';
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
        if(this.isAssignForm) return `Assign ${this.resourceType == 'CrewMaster' ? 'Crew' : (this.resourceType == 'Crew' ? 'Employee' : this.resourceType)}`;
        return 'Assign Resources';
    }

    get selectedDateToShow(){
        return this.currentWeekStart ? this.normalizeDate(this.currentWeekStart)?.toLocaleDateString('en-CA') : null;
    }

    connectedCallback() {
        this.checkUserPermissions();
        this.registerPlatformEventListener();
    }

    disconnectedCallback() {
        // Unsubscribe from platform event when component is destroyed
        this.handleUnsubscribe();
    }

    checkUserPermissions() {
        this.showSpinner = true;
        const permissionSetsToCheck = ['FR_Admin', 'FR_Mobilization_Scheduler'];

        checkPermissionSetsAssigned({ psNames: permissionSetsToCheck })
            .then(result => {
                const assignedMap = result.assignedMap || {};
                const isAdmin = result.isAdmin || false;

                const hasFRAdmin = assignedMap['FR_Admin'] || false;

                if (isAdmin || hasFRAdmin) {
                    this.hasAccess = true;
                    this.initDay(new Date());
                    this.loadDefaultMobGroupValues();
                } else {
                    this.hasAccess = false;
                    this.accessErrorMessage = "You don't have permission to access this page. Please contact your system administrator to request the FR_Admin permission set.";
                }
            })
            .catch(error => {
                this.hasAccess = false;
                this.accessErrorMessage = 'An error occurred while checking permissions. Please try again or contact your system administrator.';
                console.error('Error checking permissions:', error);
            })
            .finally(() => {
                this.showSpinner = false;
            });
    }

    loadDefaultMobGroupValues(){
        try {
            getDefaultValues({startDate: this.selectedDateToShow})
            .then(result =>{
                let timeDefaults = result?.time;
                this.defaultMobGValues = timeDefaults;
                this.tzOffset = result?.tzOffset;
                this.statusOptions = result?.statusOptions;
                this.statusOptions.forEach(opt => {
                    opt.isSelected = opt.label?.toLowerCase() == 'overhead job' ? false : true
                })
                this.selectedStatusFilter = this.statusOptions?.filter(opt => opt.isSelected)?.map(opt => opt.value) || [];
                this.applySearchFilter();
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

            const valDateRaw = new Date(val);
            const valDate = this.normalizeDate(valDateRaw);

            const startDateRaw = new Date(this.currentWeekStart);
            const startDate = this.normalizeDate(startDateRaw);
            const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

            if (!this.isDayView && valDate >= startDate && valDate < endDate) {
                return;
            }

            this.currentWeekStart = new Date(val + 'T00:00:00');
            this.isDayView ? this.initDay(this.currentWeekStart) : this.initWeek(this.currentWeekStart);
        } catch(e) {
            console.error('MobScheduler.handleDateToGoTo error:', e?.message);
        }
    }

    normalizeDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }


    handleStatusFilterChange(event){
        try {
            let value = event.currentTarget.dataset.value;
            let statusToUpdate = this.statusOptions.find(opt => opt.value == value);
            statusToUpdate.isSelected = !statusToUpdate.isSelected;

            this.selectedStatusFilter = this.statusOptions?.filter(opt => opt.isSelected)?.map(opt => opt.value) || [];
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
            const d = this.normalizeDate(new Date(start));
            d.setDate(start.getDate() + i);
            days.push({
                iso: d.toLocaleDateString('en-CA'),
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

        const start = this.normalizeDate(new Date(this.currentWeekStart));
        startDateStr = start.toLocaleDateString('en-CA');
        if (mode === 'week') {
            const end = this.normalizeDate(new Date(this.currentWeekStart));
            end.setDate(end.getDate() + 6);
            endDateStr = end.toLocaleDateString('en-CA');
        } else if (mode === 'day') {
            endDateStr = startDateStr;
        } else {
            console.error('Invalid loadData call: mode or selectedDate missing');
            this.showLoading(false);
            return;
        }

        getMobilizationDetails({ startDate: startDateStr, endDate: endDateStr })
            .then(data => {
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
        const end = new Date(this.currentWeekStart);
        end.setDate(end.getDate() + 6);

        const startNormalize = this.normalizeDate(new Date(this.currentWeekStart));
        const startDateStr = startNormalize.toLocaleDateString('en-CA');

        const endNormalize = this.normalizeDate(end);
        const endDateStr = endNormalize.toLocaleDateString('en-CA');

        getResourceDetails({ startDate: startDateStr, endDate: endDateStr, resourceType })
            .then(data => {
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
                        resMap[item.id] = { id: item.id, name: item.name, days: this.weekDays.map(d => ({ iso: d.iso, events: [] })), crewStyle: item.crewStyle};
                    }

                    const startNormalize = this.normalizeDate(new Date(item.start));
                    const dayIso = startNormalize.toLocaleDateString('en-CA');
                    const dayObj = resMap[item.id].days.find(d => d.iso === dayIso);
                    if (dayObj) dayObj.events.push({ id: item.id, mobId: item.mobId, jobName: item.jobName, jobId: item.jobId, jId: item.jId, status: item.status, statusStyle: item.statusStyle, isPast: new Date(item.end) < new Date(), clockStatusColorStyle: item.clockStatusColor ? `background-color: ${item.clockStatusColor};` : 'background-color: #ff5e5e;',clockStatusLabel: item.clockStatusLabel || 'Not Clocked In' });
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
            const statusFilter = this.selectedStatusFilter.length > 0 ? this.selectedStatusFilter : null; // null or specific status

            if (!key && !statusFilter) {
                if (!this.isResourceView) {
                    this.filteredEvents = JSON.parse(JSON.stringify(this.weekEvents));
                    this.isWeekView ? this.mapWeekData() : this.mapDayData();
                    return;
                } else {
                    this.filteredResources = JSON.parse(JSON.stringify(this.resources)).sort((a, b) => a.name.localeCompare(b.name));
                    if(!this.filteredResources || this.filteredResources.length < 1){
                        this.template.querySelector('.resource-calendar-container').scrollLeft = 0;
                    }
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
                            (statusFilter == null || statusFilter.includes(event.status)) && (isResourceMatch || (event.jobName?.toLowerCase().includes(keyLower) ||
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
                }).filter(r => r !== null)
                .sort((a, b) => a.name.localeCompare(b.name));

                if(!this.filteredResources || this.filteredResources.length < 1){
                    this.template.querySelector('.resource-calendar-container').scrollLeft = 0;
                }
                return;
            }

            // Event view (week/day)
            this.filteredEvents = this.weekEvents.filter(event => {
                // First, check status if filter applied
                if (statusFilter && !statusFilter.includes(event.status)) return false;

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
                const evIso = this.normalizeDate(new Date(ev.start)).toLocaleDateString('en-CA');                
                return evIso === day.iso;
            }).map(ev => this.normalizeEvent(ev));
            return { ...day, events: dayEvents };
        });
        this.showLoading(false);
    }

    // Map day data
    mapDayData() {
        let dateToCheck = this.normalizeDate(this.currentWeekStart);
        const dayIso = dateToCheck.toLocaleDateString('en-CA');
        const dayEvents = this.filteredEvents?.filter(ev => {
            
            const evIso = this.normalizeDate(new Date(ev.start)).toLocaleDateString('en-CA');
            return evIso === dayIso;
        }).map(ev => this.normalizeEvent(ev));

        this.dayView = { ...this.dayView, events: dayEvents };
        this.showLoading(false);
    }

    // Normalize event fields
    normalizeEvent(ev) {
        const startTime = new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const endTime = new Date(ev.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const startDayTime = new Date(ev.start).toLocaleTimeString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
        const endDayTime = new Date(ev.end).toLocaleTimeString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

        return {
            ...ev,
            start: startTime,
            date: new Date(ev.start).toLocaleDateString('en-CA'),
            end: endTime,
            crew: ev.crew || [],
            assets: ev.assets || [],
            subcontractors: ev.subcontractors || [],
            isPast: new Date(ev.end) < new Date(),
            startDayTime : startDayTime?.replaceAll('am', 'AM')?.replaceAll('pm', 'PM'),
            endDayTime : endDayTime?.replaceAll('am', 'AM')?.replaceAll('pm', 'PM')
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

    // handleMobDateFieldUpdate(event) {
    //     const startField = this.template.querySelector('lightning-input-field[data-id="start"] input');
    //     const endField = this.template.querySelector('lightning-input-field[data-id="end"] input');

    //     const startDate = new Date(startField.value);
    //     const endDate = new Date(endField.value);

    //     // clear previous errors
    //     startField.setCustomValidity('');
    //     endField.setCustomValidity('');

    //     // validation
    //     if (startField.value && endField.value && startDate > endDate) {
    //         const msg = 'Start Date cannot be later than End Date.';
    //         startField.setCustomValidity(msg);
    //         endField.setCustomValidity(msg);
    //     }

    //     // show errors
    //     startField.reportValidity();
    //     endField.reportValidity();
    // }

    handleCreateMobSubmitted(event){
        try {
            this.showLoading(true);
            event.preventDefault();
            let details = event.detail.fields;
            const start = Date.parse(details.wfrecon__Start_Date__c);
            const end = Date.parse(details.wfrecon__End_Date__c);

            const startLocal = this.removeOrgTimeZone(details.wfrecon__Start_Date__c);
            const nowLocal = new Date();

            if (start == end) {
                this.showToast('Error', 'Start date-time can not be same as end date-time.', 'error');
            } 
            // else if (startLocal.getTime() < nowLocal.getTime()) {
            //     this.showToast('Error', 'Start date/time can not be in past.', 'error');
            // } 
            else if (start > end) {
                this.showToast('Error', 'End date cannot be earlier than the start date. Please select a valid range.', 'error');
            } else {
                this.template.querySelector('lightning-record-edit-form.mob-group-form').submit(details);
            }
        } catch (e) {
            console.error('MobScheduler.handleCreateMobSubmitted error:', e?.message);
        }
    }

    removeOrgTimeZone(utcDateStr) {
        const d = new Date(utcDateStr);
        const orgOffset = this.tzOffset * 60; // Salesforce user zone (UTC−5)
        const deviceOffset = d.getTimezoneOffset(); // Niue = +660 (minutes)
        const diffMs = (deviceOffset + orgOffset) * 60 * 1000;
        return new Date(d.getTime() + diffMs);
    }
    
    handleRemoveAssignment(event){
        try {
            let id = event.currentTarget.dataset.id;
            let mobId = event.currentTarget.dataset.mobid;
            if(!id){
                console.error('MobScheduler.handleRemoveAssignment error: id is not defined');
                return;
            } else if(this.resourceType){
                this.isRemove = true;
                this.resourceIdToRemove = id;
                this.mobIdToRemove = mobId;
                this.typeOfResourceToRemove = this.resourceType;
                // this.showConfirmationPopup = true;
                this.askConfirmation('Remove Resource!', 'Are you sure you want to remove this resource from a day?', 'Remove', 'Remove For All Days');
            }
        } catch (e) {
            console.error('MobScheduler.handleRemoveAssignment error:', e?.message);
        }
    }

    removeJobAssignment(id, type = this.resourceType, mobId, allUpcoming = false){
        try{
            this.showLoading(true);
            removeJobResource({ id: id, type: type , mobId: mobId, allUpcoming: allUpcoming })
            .then(result => {
                if(result === 'success'){
                    this.showToast('Success', 'The resource assignment is been removed!', 'success');
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
            if((this.resourceTypeForAssign == 'Crew' && !this.selectedCrewAssignments.length) || (this.resourceTypeForAssign != 'Crew' && !this.selectedResourceIdsForAssign.length)) {
                this.showToast('Error', 'Please select resource to assign.', 'error');
                return;
            }
            this.showLoading(true);

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
                    this.askConfirmation('Time Overlapping!', 'Resource allocation is overlapping. How would you like to proceed?', 'Overlap & Assign', 'Assign Only Available');

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
            let mobId = event.currentTarget.dataset.job;
            
            this.isRemove = true;
            this.resourceIdToRemove = id;
            this.mobIdToRemove = mobId;
            this.typeOfResourceToRemove = type;
            this.askConfirmation('Remove Resource!', 'Are you sure you want to remove this resource from a day?', 'Remove', 'Remove For All Days');
        } catch (e) {
            console.error('MobScheduler.handleRemoveJobResource error:', e?.message);
        }
    }

    handleRemoveResourceFromCard(event){
        try {
            let id = event.detail.id;
            let type = event.detail.type;
            let mobId = event.detail.mobId;
            this.isRemove = true;
            this.resourceIdToRemove = id;
            this.mobIdToRemove = mobId;
            this.typeOfResourceToRemove = type;
            if(type == 'CrewMaster'){
                this.askConfirmation('Remove Resource!', 'Are you sure you want to remove this crew and it\'s members from this mobilization?', 'Remove', 'Remove For All Days');
                return;
            }
            this.askConfirmation('Remove Resource!', 'Are you sure you want to remove this resource from a day?', 'Remove', 'Remove For All Days');
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
    askConfirmation(title, message, confirmLabel, confirmLabel2){
        this.showLoading(false);
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
                    this.mobIdToRemove = null;
                    this.typeOfResourceToRemove = null;
                } else if(this.isRemove){
                    this.removeJobAssignment(this.resourceIdToRemove, this.typeOfResourceToRemove, this.mobIdToRemove, false);
                    this.resourceIdToRemove = null;
                    this.mobIdToRemove = null;
                    this.typeOfResourceToRemove = null;
                } else if(this.isMobDelete){
                    this.deleteMob(this.mobIdToDelete);
                    this.mobIdToDelete = null;
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
                }else if(this.isRemove){
                    this.removeJobAssignment(this.resourceIdToRemove, this.typeOfResourceToRemove, this.mobIdToRemove, true);
                    this.resourceIdToRemove = null;
                    this.mobIdToRemove = null;
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
            this.confirmationBtnLabel = 'Proceed';
            this.confirmationBtnLabel2 = null;
        } catch (e) {
            console.error('MobScheduler.handleConfirmationAction error:', e?.message);
        }
    }

    // Platform Event Methods
    registerPlatformEventListener() {
        try {
            // Register error listener
            const errorListener = (error) => {
                console.error('Platform Event Error:', JSON.stringify(error));
            };
            onError(errorListener);

            // Subscribe to platform event
            const messageCallback = (response) => {
                try {
                    console.log('Platform Event Received:', JSON.stringify(response));
                    
                    // Refresh data to show updated changes
                    if (this.isDayView) {
                        this.initDay(this.currentWeekStart);
                    } else {
                        // initWeek handles both Week View and Resource View
                        this.initWeek(this.currentWeekStart);
                    }
                    
                } catch (error) {
                    console.error('Error processing platform event:', error?.message);
                }
            };

            // Subscribe to the channel
            subscribe(this.channelName, -1, messageCallback)
                .then((response) => {
                    console.log('Successfully subscribed to platform event:', this.channelName);
                    this.subscription = response;
                })
                .catch((error) => {
                    console.error('Error subscribing to platform event:', error);
                });
        } catch (error) {
            console.error('Error in registerPlatformEventListener:', error?.message);
        }
    }

    handleUnsubscribe() {
        try {
            // Unsubscribe from the platform event
            if (this.subscription) {
                unsubscribe(this.subscription, (response) => {
                    console.log('Unsubscribed from platform event:', response);
                });
            }
        } catch (error) {
            console.error('Error unsubscribing from platform event:', error?.message);
        }
    }
}