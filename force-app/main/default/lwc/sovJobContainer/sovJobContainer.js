import { LightningElement, track } from 'lwc';
import checkPermissionSetsAssigned from '@salesforce/apex/PermissionsUtility.checkPermissionSetsAssigned';

export default class SovJobContainer extends LightningElement {
    @track activeTab = 'scope';
    @track permissionData = {
        isReadOnly: false,
        isFullAccess: false
    };
    @track isLoading = true;

    connectedCallback() {
        this.checkUserPermissions();
    }

    /**
     * Check user permissions based on permission sets
     */
    checkUserPermissions() {
        try {
            // Permission sets to check
            const permissionSetsToCheck = ['FR_SOV', 'FR_Finance'];

            // Call Apex method (returns a Promise)
            checkPermissionSetsAssigned({ psNames: permissionSetsToCheck })
            .then(result => {
                if (result.error) {
                    console.error('Error checking permission sets:', result.error);
                    this.setDefaultPermissions();
                    return;
                }

                console.log('Permission check result ==> ', result);
                
                const assignedMap = result.assignedMap || {};
                const isAdmin = result.isAdmin || false;
                const hasFRSOV = assignedMap['FR_SOV'] || false;
                const hasFRFinance = assignedMap['FR_Finance'] || false;

                if (isAdmin || hasFRSOV) {
                    // Admin or FR_SOV → Full access
                    this.permissionData = {
                        isReadOnly: false,
                        isFullAccess: true
                    };
                } else if (hasFRFinance) {
                    // FR_Finance → Read-only access
                    this.permissionData = {
                        isReadOnly: true,
                        isFullAccess: false
                    };
                } else {
                    // No specific permissions - no access
                    this.setDefaultPermissions();
                }
            })
            .catch(error => {
                console.error('Error in checkUserPermissions:', error);
                this.setDefaultPermissions();
            })
            .finally(() => {
                // Hide spinner after permission check is complete
                this.isLoading = false;
            });

        }
        catch (error) {
            console.error('Error in outer block:', error);
            this.setDefaultPermissions();
            this.isLoading = false;
        }
    }

    /**
     * Set default permissions (no access)
     */
    setDefaultPermissions() {
        this.permissionData = {
            isReadOnly: false,
            isFullAccess: false
        };
    }

    /**
     * Check if user has any access (view or edit)
     */
    get hasAnyAccess() {
        return this.permissionData && (
            this.permissionData.isFullAccess ||
            this.permissionData.isReadOnly
        );
    }

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