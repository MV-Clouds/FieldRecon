import { LightningElement, track } from 'lwc';

export default class ManagementTab extends LightningElement {
    @track activeTab = 'crew';

    allTabs = [
        { label: 'Crew', value: 'crew' },
        { label: 'Cost Code', value: 'costcode' },
        { label: 'Process Library', value: 'processlibrary' },
        { label: 'Mobilization Status Color ', value: 'isMobStatusColorConfig' }
        // { label: 'Employee', value: 'employee' },
        
    ];

    get tabs() {
        return this.allTabs.map(tab => ({
            ...tab,
            isActive: this.activeTab === tab.value,
            className: this.activeTab === tab.value ? 'active' : '',
            isCrew: tab.value === 'crew',
            isCostCode: tab.value === 'costcode',
            isProcessLibrary: tab.value === 'processlibrary',
            isEmployee: tab.value === 'employee',
            isMobStatusColorConfig: tab.value === 'isMobStatusColorConfig',
        }));
    }

    handleTabChange(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }
}