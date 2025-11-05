import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';


export default class MobCard extends NavigationMixin(LightningElement) {
    @api mobDetails;

    get masterCrewList(){
        return this.groupCrewByTeam(this.mobDetails?.crew || []) || [];
    }

    get resourceSections() {
        return [
            {
                key: 'crewMaster',
                label: 'Crew',
                type: 'CrewMaster',
                items: this.masterCrewList,
                emptyText: 'No Crews Assigned Yet.'
            },
            {
                key: 'crew',
                label: 'Employees',
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
        if(this.mobDetails && this.mobDetails.bgColor){
            this.template.host.style.setProperty('--card-bg-color', this.mobDetails.bgColor);
        }
    }

    groupCrewByTeam(crewList) {
        const crewMap = {};

        (crewList || []).forEach(member => {
            // Skip entries without crewId (i.e. Individual Employees)
            if (!member.crewId) return;

            if (!crewMap[member.crewId]) {
                crewMap[member.crewId] = {
                    id: member.crewId,
                    name: member.crewName,
                    // crewColor: member.crewColor,
                    bgStyle: member.bgStyle,
                    dotStyle: 'background-color: ' + member.crewColor + ';',
                    // members: []
                };
            }

            // crewMap[member.crewId].members.push({
            //     id: member.id,
            //     name: member.name,
            //     type: member.type,
            //     junctionId: member.junctionId
            // });
        });

        return Object.values(crewMap);
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
            let id = event.currentTarget.dataset.id;
            let type = event.currentTarget.dataset.type;
            // if(type == 'CrewMaster'){
            //     id = (this.mobDetails?.crew)?.filter(crew => crew.crewId === id).map(cMember => cMember.junctionId).join(',');
            // }
            // console.log('id :: ', id);
            
            this.dispatchEvent(new CustomEvent('remove', { detail: {id: id, type: type, mobId: this.mobDetails?.id}}));
        } catch (e) {
            console.log('Error in function handleRemoveSpecificResource:::', e.message);
        }
    }

    handleRecordNavigation(){
        this.navigateToRecord(this.mobDetails?.jId);
    }

    handleResourceNavigation(event){
        let id = event.currentTarget.dataset.id;
        id && this.navigateToRecord(id);
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
}