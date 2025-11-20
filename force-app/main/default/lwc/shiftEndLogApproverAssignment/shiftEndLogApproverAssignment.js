import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getLogEntryApprovers from '@salesforce/apex/ManagementTabController.getLogEntryApprovers';
import saveLogEntryApprovers from '@salesforce/apex/ManagementTabController.saveLogEntryApprovers';

export default class ShiftEndLogApproverAssignment extends LightningElement {
    @track isLoading = true;
    @track availableOptions = [];
    @track selectedValues = [];
    @track originalSelectedValues = [];
    @track hasUnsavedChanges = false;
    @track allUsersMap = new Map(); // Store user ID to Name mapping

    /**
     * Method Name: get isButtonsDisabled
     * @description: Check if action buttons should be disabled
     */
    get isButtonsDisabled() {
        return !this.hasUnsavedChanges || this.isLoading;
    }

    /**
     * Method Name: connectedCallback
     * @description: Load approvers on component load
     */
    connectedCallback() {
        this.fetchApprovers();
    }

    /**
     * Method Name: fetchApprovers
     * @description: Fetch all approvers and active users
     */
    fetchApprovers() {
        this.isLoading = true;
        getLogEntryApprovers()
            .then(result => {
                if (result.status === 'SUCCESS') {
                    // Process all active users
                    const allUsers = result.allActiveUsers || [];
                    this.allUsersMap.clear();
                    
                    allUsers.forEach(user => {
                        this.allUsersMap.set(user.value, user.label);
                    });

                    // Process existing approvers JSON
                    let selectedUserIds = [];
                    if (result.approversJSON) {
                        try {
                            const approversObj = JSON.parse(result.approversJSON);
                            selectedUserIds = Object.values(approversObj);
                        } catch (e) {
                            console.error('Error parsing approvers JSON:', e);
                        }
                    }

                    // Set selected values
                    this.selectedValues = [...selectedUserIds];
                    this.originalSelectedValues = [...selectedUserIds];

                    // Create options for dual listbox
                    this.availableOptions = allUsers.map(user => ({
                        label: user.label,
                        value: user.value
                    }));

                    this.hasUnsavedChanges = false;
                } else {
                    this.showToast('Error', result.message || 'Error fetching approvers', 'error');
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error fetching approvers:', error);
                this.showToast('Error', 'Error fetching approvers: ' + (error.body?.message || error.message), 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleSelectionChange
     * @description: Handle changes in dual listbox selection
     */
    handleSelectionChange(event) {
        const newSelectedValues = event.detail.value;
        this.selectedValues = newSelectedValues;
        this.checkForChanges();
    }

    /**
     * Method Name: checkForChanges
     * @description: Check if there are unsaved changes
     */
    checkForChanges() {
        // Sort both arrays for comparison
        const currentSorted = [...this.selectedValues].sort();
        const originalSorted = [...this.originalSelectedValues].sort();
        
        // Compare arrays
        this.hasUnsavedChanges = JSON.stringify(currentSorted) !== JSON.stringify(originalSorted);
    }

    /**
     * Method Name: handleSave
     * @description: Save the selected approvers
     */
    handleSave() {
        if (!this.hasUnsavedChanges) {
            this.showToast('Info', 'No changes to save', 'info');
            return;
        }

        this.isLoading = true;

        // Build the JSON object with Name as key and ID as value
        const approversObj = {};
        this.selectedValues.forEach(userId => {
            const userName = this.allUsersMap.get(userId);
            if (userName) {
                approversObj[userName] = userId;
            }
        });

        const approversJSON = JSON.stringify(approversObj, null, 2);
        this.generatedJSON = approversJSON;

        saveLogEntryApprovers({ approversJSON })
            .then(result => {
                if (result.status === 'SUCCESS' || result.status === 'INFO') {
                    this.showToast('Success', 'Approvers updated successfully', 'success');
                    this.originalSelectedValues = [...this.selectedValues];
                    this.hasUnsavedChanges = false;
                } else {
                    this.showToast('Error', result.message || 'Error saving approvers', 'error');
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error saving approvers:', error);
                this.showToast('Error', 'Error saving approvers: ' + (error.body?.message || error.message), 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleCancel
     * @description: Cancel changes and reset to original values
     */
    handleCancel() {
        this.selectedValues = [...this.originalSelectedValues];
        this.hasUnsavedChanges = false;
    }

    /**
     * Method Name: showToast
     * @description: Show toast message
     */
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(evt);
    }
}