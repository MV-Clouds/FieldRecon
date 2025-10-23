import { LightningElement, track} from 'lwc';

export default class SovJobContainer extends LightningElement {
    @track activeTab = 'scope';

    get isScopeActive() {
        return this.activeTab === 'scope';
    }

    get isLocationsActive() {
        return this.activeTab === 'locations';
    }

    get isProcessesActive() {
        return this.activeTab === 'processes';
    }

    get scopeTabClass() {
        return this.activeTab === 'scope' ? 'active' : '';
    }

    get locationsTabClass() {
        return this.activeTab === 'locations' ? 'active' : '';
    }

    get processesTabClass() {
        return this.activeTab === 'processes' ? 'active' : '';
    }

    handleScopeTab() {
        this.activeTab = 'scope';
    }

    handleLocationsTab() {
        this.activeTab = 'locations';
    }

    handleProcessesTab() {
        this.activeTab = 'processes';
    }
}