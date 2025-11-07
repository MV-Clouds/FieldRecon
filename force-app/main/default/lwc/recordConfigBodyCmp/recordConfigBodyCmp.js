import { LightningElement, track, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class RecordConfigBodyCmp extends NavigationMixin(LightningElement) {

    @track activeTabId = 'tab1';
    @api customParam = '';
    @api featureName;
    @api isFromListingManager;
    @track isModalOpen = false;

    get selectedTabObject() {
        switch (this.featureName) {
            case 'ScopeEntry':
                return 'wfrecon__Scope_Entry__c';
            case 'LocationEntry':
                return 'wfrecon__Location__c';
            default:
                return '';
        }
    }

    handleTabClick(event) {
        this.activeTabId = event.target.dataset.tabId;
    }
    
    openModal(){
        this.isModalOpen = true
    }

    @api
    handleDialogueClose(){
        this.isModalOpen = false;
    }
}