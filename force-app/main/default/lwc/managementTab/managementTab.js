import { LightningElement, track } from 'lwc';
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';

export default class ManagementTab extends LightningElement {
    @track activeTab = 'crew';
    @track isLoading = true;
    @track hasAccess = false;
    @track accessErrorMessage = '';

    allTabs = [
        { label: 'Crew', value: 'crew' },
        { label: 'Cost Code', value: 'costcode' },
        { label: 'Process Library', value: 'processlibrary' },
        { label: 'Mobilization Status Color ', value: 'isMobStatusColorConfig' },
        { label: 'Employee', value: 'employee' },
        { label: 'Shift End Log Configuration', value: 'shiftEndLogApprover' },
        { label: 'Proposal Configuration', value: 'proposalConfiguration' },
    ];

    connectedCallback() {
        this.checkUserPermissions();
    }

    checkUserPermissions() {
        const permissionSetsToCheck = ['FR_Admin'];
        
        checkPermissionSetsAssigned({ psNames: permissionSetsToCheck })
            .then(result => {
                const assignedMap = result.assignedMap || {};
                const isAdmin = result.isAdmin || false;
                
                const hasFRAdmin = assignedMap['FR_Admin'] || false;
                
                if (isAdmin || hasFRAdmin) {
                    this.hasAccess = true;
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
                this.isLoading = false;
            });
    }

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
            isShiftEndLogApprover: tab.value === 'shiftEndLogApprover',
             isProposalConfiguration: tab.value === 'proposalConfiguration'
        }));
    }

    handleTabChange(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }
}