import { LightningElement, api, track } from 'lwc';

export default class MobCard extends LightningElement {
    @api mobDetails;
    @api mode; // New API variable for mode flag (small or full)

    // Selected Records Lists
    @track selectedCrewMembers = [];
    @track selectedAssets = [];
    @track selectedSubContractors = [];

    // Selected Junction ObjectIds
    selectedCrewMemberJIds = [];
    selectedAssetJIds = [];
    selectedSubContractorJIds = [];

    // Filters
    // crewMemberFilters = [
    //     {field : 'wfrecon__Contact__r.RecordType.DeveloperName', operator : 'eq', value : 'Employee_WF_Recon'},
    // ];

    get modeClass() {
        return this.mode === 'small' ? 'event-card small' : 'event-card full';
    }

    get isFullCard(){
        return this.mode === 'full';
    }

    get resourceSections() {
        return [
            {
                key: 'crew',
                label: 'Crew',
                type: 'Crew',
                items: this.mobDetails?.crew || [],
                emptyText: 'No Crew Members Assigned Yet.'
            },
            {
                key: 'assets',
                label: 'Assets',
                type: 'Asset',
                items: this.mobDetails?.assets || [],
                emptyText: 'No Assets Assigned Yet.'
            },
            {
                key: 'subcontractors',
                label: 'Sub Contractors',
                type: 'SubContractor',
                items: this.mobDetails?.subcontractors || [],
                emptyText: 'No Sub Contractors Assigned Yet.'
            }
        ];
    }

    connectedCallback(){
        try {
            // console.log('Connected Callback :: ', this.mobDetails);
            this.selectedCrewMemberJIds = this.mobDetails.crew?.map(opt => opt.junctionId) || [];
            this.selectedAssetJIds = this.mobDetails.assets?.map(opt => opt.junctionId) || [];
            this.selectedSubContractorJIds = this.mobDetails.subcontractors?.map(opt => opt.junctionId) || [];


            // console.log('selectedCrewMemberJIds :: ', this.selectedCrewMemberJIds);
            // console.log('selectedAssetJIds :: ', this.selectedAssetJIds);
            // console.log('selectedSubContractorJIds :: ', this.selectedSubContractorJIds);
            
        } catch (e) {
            console.log('TemplatePreviewModalV2', 'connectedCallback', e, 'warn');
            
        }
    }

    onRecordSelect(event){
        try {
            let name  = event.currentTarget.dataset.name;
            let junction = event.currentTarget.dataset.junction;
            let fieldToPush = event.currentTarget.dataset.field;

            // console.log('Name :: ', name, ' Field :: ', fieldToPush);
            
            if(event.detail && event.detail.length){
                // console.log('Selected Records are : ', event.detail);
                this[junction] = event.detail.map(rec => rec[fieldToPush])
                // this.selectedRecordId = event.detail[0].Id;
                this[name] = event.detail;
            }
            else{
                this[junction] = [];
                this[name] = [];
            }
            console.log('Details is :: ', this[name]);
            
        } catch (error) {
            console.log('TemplatePreviewModalV2', 'onRecordSelect', error, 'warn');
        }
    }

    handleRecordPickerError(event){
        console.log('TemplatePreviewModalV2', 'handleRecordPickerError', {'message' : event.detail}, 'warn');
    }

    handleJobCardEdit(){
        this.dispatchEvent(new CustomEvent('edit', { detail: this.mobDetails?.id}));
    }

    handleJobCardDelete(){
        this.dispatchEvent(new CustomEvent('delete', { detail: this.mobDetails?.id}));
    }

    handleAssignResources(){
        try {
            this.dispatchEvent(new CustomEvent('assign', { detail: {id: this.mobDetails?.id, date: this.mobDetails.date}}));
        } catch (e) {
            console.log('Error in function handleAssignResources:::', e.message);
        }
    }

    handleRemoveSpecificResource(event){
        try {
            console.log('event to be is :: ', event.currentTarget);
            
            let id = event.currentTarget.dataset.id;
            let type = event.currentTarget.dataset.type;
            this.dispatchEvent(new CustomEvent('remove', { detail: {id: id, type: type}}));
        } catch (e) {
            console.log('Error in function handleRemoveSpecificResource:::', e.message);
        }
    }
}