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
    @track changesSaved = false; // Track if changes were actually saved

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

                console.log('result ==> ', result);
                
                this.existingStatuses = result.map(status => ({
                    label: status,
                    value: status,
                    isActive: true,
                    isMarkedForRemoval: false,
                    cssClass: 'tile',
                    tooltipText: `Click to mark "${status}" for removal`
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
        const statusToRemove = event.currentTarget.dataset.status;
        this.newStatusesToAdd = this.newStatusesToAdd.filter(status => 
            status.value !== statusToRemove
        );
        this.checkForChanges();
    }

    /**
     * Method Name: handleToggleStatusRemoval
     * @description: Toggle status for removal when pill is clicked
     */
    handleToggleStatusRemoval(event) {
        const statusValue = event.currentTarget.dataset.status;
        
        this.existingStatuses = this.existingStatuses.map(status => {
            if (status.value === statusValue) {
                const isMarkedForRemoval = !status.isMarkedForRemoval;
                return { 
                    ...status, 
                    isMarkedForRemoval: isMarkedForRemoval,
                    cssClass: isMarkedForRemoval ? 'tile marked-for-removal' : 'tile',
                    tooltipText: isMarkedForRemoval 
                        ? `Click to unmark "${status.label}" for removal` 
                        : `Click to mark "${status.label}" for removal`
                };
            }
            return status;
        });

        // Update statusesToRemove array
        const isCurrentlyMarked = this.existingStatuses.find(s => s.value === statusValue)?.isMarkedForRemoval;
        
        if (isCurrentlyMarked) {
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
                    // Create specific success message based on what was changed
                    let successMessage = '';
                    const addedCount = valuesToAdd.length;
                    const removedCount = valuesToDeactivate.length;

                    if (addedCount > 0 && removedCount > 0) {
                        successMessage = `${addedCount} status${addedCount > 1 ? 'es' : ''} added and ${removedCount} status${removedCount > 1 ? 'es' : ''} removed successfully`;
                    } else if (addedCount > 0) {
                        successMessage = addedCount === 1 
                            ? `Status "${valuesToAdd[0]}" has been added successfully` 
                            : `${addedCount} statuses have been added successfully`;
                    } else if (removedCount > 0) {
                        successMessage = removedCount === 1 
                            ? `Status "${valuesToDeactivate[0]}" has been removed successfully` 
                            : `${removedCount} statuses have been removed successfully`;
                    }

                    this.showToast('Success', successMessage, 'success');
                    this.changesSaved = true; // Mark that changes were saved
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
        // Reset arrays and input
        this.newStatusesToAdd = [];
        this.statusesToRemove = [];
        this.newStatusInput = '';
        this.hasUnsavedChanges = false;
        this.isLoading = false;
        // Note: Don't reset changesSaved here as we need it for the close event
        
        // Reset existing statuses removal marks and CSS classes
        this.existingStatuses = this.existingStatuses.map(status => {
            return {
                label: status.label,
                value: status.value,
                isActive: status.isActive,
                isMarkedForRemoval: false,
                cssClass: 'tile',
                tooltipText: `Click to mark "${status.label}" for removal`
            };
        });
    }

    /**
     * Method Name: closeModal
     * @description: Close the modal
     */
    closeModal() {
        const closeEvent = new CustomEvent('close', {
            detail: { changesSaved: this.changesSaved }
        });
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