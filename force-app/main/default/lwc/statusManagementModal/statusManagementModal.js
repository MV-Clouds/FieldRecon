import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getMobilizationPicklistValues from '@salesforce/apex/ManagementTabController.getMobilizationPicklistValues';
import updateGlobalPicklistValues from '@salesforce/apex/ManagementTabController.updateGlobalPicklistValues';

export default class StatusManagementModal extends LightningElement {
    @track isLoading = false;
    @track existingStatuses = [];
    @track newStatusesToAdd = [];
    @track statusesToRemove = [];
    @track newStatusInput = '';
    @track hasUnsavedChanges = false;

    /**
     * Method Name: get isModalOpen
     * @description: Check if modal is open
     */
    get isModalOpen() {
        return true; // Modal is open when component is rendered
    }

    /**
     * Method Name: get isSaveDisabled
     * @description: Check if save button should be disabled
     */
    get isSaveDisabled() {
        return !this.hasUnsavedChanges || this.isLoading;
    }

    /**
     * Method Name: get isAddDisabled
     * @description: Check if add button should be disabled
     */
    get isAddDisabled() {
        return !this.newStatusInput.trim() || this.isLoading;
    }

    /**
     * Method Name: connectedCallback
     * @description: Load existing statuses on component load
     */
    connectedCallback() {
        this.fetchExistingStatuses();
    }

    /**
     * Method Name: fetchExistingStatuses
     * @description: Fetch all existing mobilization status picklist values
     */
    fetchExistingStatuses() {
        this.isLoading = true;
        getMobilizationPicklistValues()
            .then(result => {
                this.existingStatuses = result.map(status => ({
                    label: status,
                    value: status,
                    isActive: true,
                    isMarkedForRemoval: false
                }));
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error fetching statuses:', error);
                this.showToast('Error', 'Error fetching statuses: ' + error.body.message, 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleNewStatusInputChange
     * @description: Handle new status input change
     */
    handleNewStatusInputChange(event) {
        this.newStatusInput = event.target.value;
    }

    /**
     * Method Name: handleAddNewStatus
     * @description: Add new status to the list
     */
    handleAddNewStatus() {
        const newStatus = this.newStatusInput.trim();
        
        if (!newStatus) {
            this.showToast('Warning', 'Please enter a status name', 'warning');
            return;
        }

        // Check if status already exists
        const existsInCurrent = this.existingStatuses.some(status => 
            status.label.toLowerCase() === newStatus.toLowerCase()
        );
        const existsInNew = this.newStatusesToAdd.some(status => 
            status.label.toLowerCase() === newStatus.toLowerCase()
        );

        if (existsInCurrent || existsInNew) {
            this.showToast('Warning', 'Status already exists', 'warning');
            return;
        }

        // Add to new statuses list
        this.newStatusesToAdd = [...this.newStatusesToAdd, {
            label: newStatus,
            value: newStatus,
            isNew: true
        }];

        this.newStatusInput = '';
        this.hasUnsavedChanges = true;
    }

    /**
     * Method Name: handleRemoveNewStatus
     * @description: Remove status from new statuses list
     */
    handleRemoveNewStatus(event) {
        const statusToRemove = event.target.dataset.status;
        this.newStatusesToAdd = this.newStatusesToAdd.filter(status => 
            status.value !== statusToRemove
        );
        this.checkForChanges();
    }

    /**
     * Method Name: handleToggleStatusRemoval
     * @description: Toggle status for removal
     */
    handleToggleStatusRemoval(event) {
        const statusValue = event.target.dataset.status;
        const isChecked = event.target.checked;

        this.existingStatuses = this.existingStatuses.map(status => {
            if (status.value === statusValue) {
                return { ...status, isMarkedForRemoval: isChecked };
            }
            return status;
        });

        // Update statusesToRemove array
        if (isChecked) {
            if (!this.statusesToRemove.includes(statusValue)) {
                this.statusesToRemove = [...this.statusesToRemove, statusValue];
            }
        } else {
            this.statusesToRemove = this.statusesToRemove.filter(status => status !== statusValue);
        }

        this.checkForChanges();
    }

    /**
     * Method Name: checkForChanges
     * @description: Check if there are unsaved changes
     */
    checkForChanges() {
        this.hasUnsavedChanges = this.newStatusesToAdd.length > 0 || this.statusesToRemove.length > 0;
    }

    /**
     * Method Name: handleSave
     * @description: Save all changes
     */
    handleSave() {
        if (!this.hasUnsavedChanges) {
            this.showToast('Info', 'No changes to save', 'info');
            return;
        }

        this.isLoading = true;

        const valuesToAdd = this.newStatusesToAdd.map(status => status.value);
        const valuesToDeactivate = this.statusesToRemove;

        console.log('Saving changes:', { valuesToAdd, valuesToDeactivate });

        updateGlobalPicklistValues({ 
            valuesToAdd: valuesToAdd, 
            valuesToDeactivate: valuesToDeactivate 
        })
            .then(result => {
                if (result === 'SUCCESS') {
                    this.showToast('Success', 'Status values updated successfully', 'success');
                    this.resetChanges();
                    this.fetchExistingStatuses(); // Refresh the list
                } else {
                    this.showToast('Error', result, 'error');
                    this.isLoading = false;
                }
            })
            .catch(error => {
                console.error('Error saving status values:', error);
                this.showToast('Error', 'Error saving status values: ' + error.body.message, 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleCancel
     * @description: Cancel all changes and close modal
     */
    handleCancel() {
        this.resetChanges();
        this.closeModal();
    }

    /**
     * Method Name: resetChanges
     * @description: Reset all changes
     */
    resetChanges() {
        this.newStatusesToAdd = [];
        this.statusesToRemove = [];
        this.newStatusInput = '';
        this.hasUnsavedChanges = false;
        this.isLoading = false;
        
        // Reset existing statuses removal marks
        this.existingStatuses = this.existingStatuses.map(status => ({
            ...status,
            isMarkedForRemoval: false
        }));
    }

    /**
     * Method Name: closeModal
     * @description: Close the modal
     */
    closeModal() {
        const closeEvent = new CustomEvent('close');
        this.dispatchEvent(closeEvent);
    }

    /**
     * Method Name: handleKeyPress
     * @description: Handle Enter key press in input field
     */
    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.handleAddNewStatus();
        }
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