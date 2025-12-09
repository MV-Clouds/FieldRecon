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
    @track toggleValue = false;
    @track originalToggleValue = false;

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
        this.overrideSLDS();
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

                    // Set toggle value from feature flag
                    this.toggleValue = result.timesheetApprovalFeature === true;
                    this.originalToggleValue = this.toggleValue;

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
     * Method Name: handleToggleChange
     * @description: Handle changes in toggle value
     */
    handleToggleChange(event) {
        this.toggleValue = event.target.checked;
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
        
        // Compare arrays and toggle value
        const hasApproverChanges = JSON.stringify(currentSorted) !== JSON.stringify(originalSorted);
        const hasToggleChanges = this.toggleValue !== this.originalToggleValue;
        
        this.hasUnsavedChanges = hasApproverChanges || hasToggleChanges;
    }

    /**
     * Method Name: handleSave
     * @description: Save the selected approvers and toggle value
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

        saveLogEntryApprovers({ 
            approversJSON,
            timesheetApprovalFeature: this.toggleValue
        })
            .then(result => {
                if (result.status === 'SUCCESS') {
                    this.showToast('Success', result.message || 'Changes saved successfully. The updates will be deployed shortly.', 'success');
                    this.originalSelectedValues = [...this.selectedValues];
                    this.originalToggleValue = this.toggleValue;
                    this.hasUnsavedChanges = false;
                } else {
                    this.showToast('Error', result.message || 'Error saving changes', 'error');
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error saving changes:', error);
                this.showToast('Error', 'Error saving changes: ' + (error.body?.message || error.message), 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleCancel
     * @description: Cancel changes and reset to original values
     */
    handleCancel() {
        this.selectedValues = [...this.originalSelectedValues];
        this.toggleValue = this.originalToggleValue;
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

    overrideSLDS(){
        let style = document.createElement('style');
        style.innerText = `
                .main-card .slds-dueling-list__options [aria-selected='true'] {
                    background-color: #5e5adb !important;
                }

                .main-card .slds-button__icon {
                    fill: #5e5adb !important;
                }

                .main-card .slds-listbox_vertical .slds-listbox__option[aria-selected='false']:hover,
                .main-card .slds-listbox_vertical .slds-listbox__option:not([aria-selected='true']):hover {
                    background-color: #e3e3fb !important;
                }
        `;
        this.template.host.appendChild(style);
    }
}