import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getMobilizationStatusColors from '@salesforce/apex/ManagementTabController.getMobilizationStatusColors';
import saveStatusColors from '@salesforce/apex/ManagementTabController.saveStatusColors';
import checkUserHasSalesforceLicense from '@salesforce/apex/ManagementTabController.checkUserHasSalesforceLicense';

export default class MobStatusColorConfig extends LightningElement {
    @track isLoading = true;
    @track statusColors = [];
    @track filteredStatusColors = [];
    @track searchTerm = '';
    @track hasUnsavedChanges = false;
    @track originalData = [];
    @track modifiedFields = new Map(); // Track which specific fields are modified
    @track showStatusModal = false;
    @track hasSalesforceLicense = false;

    /**
     * Method Name: get isDataAvailable
     * @description: Check if data is available to display
     */
    get isDataAvailable() {
        return this.filteredStatusColors && this.filteredStatusColors.length > 0;
    }

    /**
     * Method Name: get isButtonsDisabled
     * @description: Check if action buttons should be disabled
     */
    get isButtonsDisabled() {
        return !this.hasUnsavedChanges || this.isLoading;
    }

    /**
     * Method Name: get isSaveDisabled
     * @description: Check if save button should be disabled
     */
    get isSaveDisabled() {
        return !this.hasUnsavedChanges || this.isLoading;
    }

    /**
     * Method Name: get isCancelDisabled
     * @description: Check if cancel button should be disabled
     */
    get isCancelDisabled() {
        return !this.hasUnsavedChanges || this.isLoading;
    }

    /**
     * Method Name: get isManageStatusesDisabled
     * @description: Check if manage statuses button should be disabled
     */
    get isManageStatusesDisabled() {
        return !this.hasSalesforceLicense;
    }

    /**
     * Method Name: get manageStatusesTitle
     * @description: Get the title/tooltip for manage statuses button
     */
    get manageStatusesTitle() {
        return this.hasSalesforceLicense 
            ? 'Manage mobilization statuses' 
            : 'Only users with Salesforce license can perform this action. Please contact your admin for more support.';
    }

    /**
     * Method Name: connectedCallback
     * @description: Load status colors on component load
     */
    connectedCallback() {
        this.checkUserLicense();
        this.fetchStatusColors();
    }

    /**
     * Method Name: checkUserLicense
     * @description: Check if current user has Salesforce license
     */
    checkUserLicense() {
        checkUserHasSalesforceLicense()
            .then(result => {
                console.log(' User has Salesforce license:', result);
                
                this.hasSalesforceLicense = result;
            })
            .catch(error => {
                console.error('Error checking user license:', error);
                this.hasSalesforceLicense = false;
            });
    }

    /**
     * Method Name: fetchStatusColors
     * @description: Fetch all mobilization status colors
     */
    fetchStatusColors() {
        this.isLoading = true;
        getMobilizationStatusColors()
            .then(result => {
                this.statusColors = result.map(item => ({
                    ...item,
                    isModified: false
                }));
                this.originalData = JSON.parse(JSON.stringify(this.statusColors));
                this.modifiedFields.clear(); // Clear any previous modifications
                this.applyFilters();
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error fetching status colors:', error);
                this.showToast('Error', 'Error fetching status colors: ' + error.body.message, 'error');
                this.isLoading = false;
            });
    }

    /**
     * Method Name: applyFilters
     * @description: Apply search filters
     */
    applyFilters() {
        let filtered;
        if (this.searchTerm) {
            filtered = this.statusColors.filter(item =>
                item.picklistValue.toLowerCase().includes(this.searchTerm.toLowerCase())
            );
        } else {
            filtered = [...this.statusColors];
        }

        // Add serial numbers to filtered data
        this.filteredStatusColors = filtered.map((item, index) => ({
            ...item,
            serialNumber: index + 1,
            // Track field modifications for highlighting
            isTextColorModified: this.modifiedFields.has(`${item.picklistValue}-textColor`) ? 'color-picker-cell modified-cell' : 'color-picker-cell',
            isBackgroundColorModified: this.modifiedFields.has(`${item.picklistValue}-backgroundColor`) ? 'color-picker-cell modified-cell' : 'color-picker-cell'
        }));

        // Apply status name styling after data is processed
        setTimeout(() => {
            this.applyStatusNameStyling();
        }, 50);
    }

    /**
     * Method Name: handleSearch
     * @description: Handle search input change
     */
    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.applyFilters();
    }

    /**
     * Method Name: handleColorInput
     * @description: Handle real-time color picker input for immediate visual feedback
     */
    handleColorInput(event) {
        const newValue = event.target.value;
        const fieldType = event.target.dataset.fieldType;
        
        // Update the color value display immediately
        const colorValueElement = event.target.parentElement.querySelector('.color-value');
        if (colorValueElement) {
            colorValueElement.textContent = newValue;
        }

        // If this is for a status name, update the visual preview immediately
        const recordId = event.target.dataset.recordId;
        const statusNameElement = this.template.querySelector(`[data-text-color][data-bg-color]`);
        
        // Find all status name elements and update the one that matches this record
        const statusNameElements = this.template.querySelectorAll('.status-name');
        statusNameElements.forEach(element => {
            // Check if this element corresponds to the current record
            const row = element.closest('tr');
            const recordElement = row?.querySelector(`[data-record-id="${recordId}"]`);
            
            if (recordElement) {
                if (fieldType === 'textColor') {
                    element.style.color = newValue;
                    element.dataset.textColor = newValue;
                } else if (fieldType === 'backgroundColor') {
                    element.style.backgroundColor = newValue;
                    element.dataset.bgColor = newValue;
                }
            }
        });
    }

    /**
     * Method Name: handleColorChange
     * @description: Handle color picker changes
     */
    handleColorChange(event) {
        const recordId = event.target.dataset.recordId;
        const fieldType = event.target.dataset.fieldType;
        const newValue = event.target.value;

        // Update the record in statusColors array
        const recordIndex = this.statusColors.findIndex(item => 
            (item.id === recordId) || (item.picklistValue === recordId)
        );

        if (recordIndex !== -1) {
            const record = { ...this.statusColors[recordIndex] };
            const originalRecord = this.originalData[recordIndex];
            
            if (fieldType === 'textColor') {
                record.textColor = newValue;
            } else if (fieldType === 'backgroundColor') {
                record.backgroundColor = newValue;
            }

            // Check if this field is actually modified from original
            const originalValue = fieldType === 'textColor' ? originalRecord.textColor : originalRecord.backgroundColor;
            const fieldKey = `${recordId}-${fieldType}`;
            
            if (newValue !== originalValue) {
                this.modifiedFields.set(fieldKey, true);
                record.isModified = true;
            } else {
                this.modifiedFields.delete(fieldKey);
                // Check if record has any modifications left
                const hasTextModification = this.modifiedFields.has(`${recordId}-textColor`);
                const hasBackgroundModification = this.modifiedFields.has(`${recordId}-backgroundColor`);
                record.isModified = hasTextModification || hasBackgroundModification;
            }

            this.statusColors[recordIndex] = record;

            // Update filtered array as well
            const filteredIndex = this.filteredStatusColors.findIndex(item => 
                (item.id === recordId) || (item.picklistValue === recordId)
            );
            if (filteredIndex !== -1) {
                this.filteredStatusColors[filteredIndex] = record;
            }

            this.checkForChanges();
            // Re-apply filters to update styling and highlighting
            this.applyFilters();
            
            // Update the specific status name styling for this record only
            setTimeout(() => {
                this.updateColorDisplays();
                this.applySpecificStatusNameStyling(recordId, record.textColor, record.backgroundColor);
            }, 0);
        }
    }

    /**
     * Method Name: checkForChanges
     * @description: Check if there are unsaved changes
     */
    checkForChanges() {
        this.hasUnsavedChanges = this.modifiedFields.size > 0;
    }

    /**
     * Method Name: handleSave
     * @description: Save all changes
     */
    handleSave() {
        const modifiedRecords = this.statusColors.filter(item => item.isModified);

        if (modifiedRecords.length === 0) {
            this.showToast('Info', 'No changes to save', 'info');
            return;
        }

        this.isLoading = true;

        // Prepare records for upsert (Custom Setting requires Name)
        const recordsToSave = modifiedRecords.map(item => ({
            sobjectType: 'wfrecon__Mobilization_Status_Color__c',
            Id: item.id || null,
            Name: item.picklistValue, // Use picklist value as name key
            wfrecon__Color__c: item.textColor,
            wfrecon__Background_Color__c: item.backgroundColor
        }));

        console.log('Records to upsert:', JSON.stringify(recordsToSave, null, 2));

        saveStatusColors({ recordsToSave })
            .then(result => {
                if (result.status === 'SUCCESS') {
                    this.showToast('Success', result.message, 'success');
                    this.modifiedFields.clear();
                    this.hasUnsavedChanges = false;
                    this.fetchStatusColors(); // Refresh data
                } else {
                    this.showToast('Error', result.message, 'error');
                    this.isLoading = false;
                }
            })
            .catch(error => {
                console.error('Error saving status colors:', error);
                this.showToast('Error', 'Error saving status colors: ' + error.body.message, 'error');
                this.isLoading = false;
            });
    }


    /**
     * Method Name: handleCancel
     * @description: Cancel all changes
     */
    handleCancel() {
        this.statusColors = JSON.parse(JSON.stringify(this.originalData));
        this.modifiedFields.clear(); // Clear all modifications
        this.applyFilters();
        this.hasUnsavedChanges = false;
        
        // Update color displays and styling after cancel
        setTimeout(() => {
            this.updateColorDisplays();
            this.applyStatusNameStyling();
        }, 100);
        
        this.showToast('Info', 'Changes canceled', 'info');
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

    /**
     * Method Name: applyStatusNameStyling
     * @description: Apply dynamic styling to all status name elements
     */
    applyStatusNameStyling() {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            const statusNameElements = this.template.querySelectorAll('.status-name');
            statusNameElements.forEach(element => {
                const textColor = element.dataset.textColor;
                const bgColor = element.dataset.bgColor;
                
                if (textColor && bgColor) {
                    element.style.backgroundColor = bgColor;
                    element.style.color = textColor;
                    element.style.padding = '4px 8px';
                    element.style.borderRadius = '4px';
                    element.style.fontWeight = '600';
                    element.style.display = 'inline-block';
                    element.style.minWidth = '120px';
                    element.style.textAlign = 'center';
                }
            });
        }, 0);
    }

    /**
     * Method Name: applySpecificStatusNameStyling
     * @description: Apply dynamic styling to a specific status name element
     */
    applySpecificStatusNameStyling(recordId, textColor, backgroundColor) {
        const statusNameElements = this.template.querySelectorAll('.status-name');
        statusNameElements.forEach(element => {
            // Check if this element corresponds to the specific record
            const row = element.closest('tr');
            const recordElement = row?.querySelector(`[data-record-id="${recordId}"]`);
            
            if (recordElement && textColor && backgroundColor) {
                element.style.backgroundColor = backgroundColor;
                element.style.color = textColor;
                element.style.padding = '4px 8px';
                element.style.borderRadius = '4px';
                element.style.fontWeight = '600';
                element.style.display = 'inline-block';
                element.style.minWidth = '120px';
                element.style.textAlign = 'center';
                
                // Update data attributes for consistency
                element.dataset.textColor = textColor;
                element.dataset.bgColor = backgroundColor;
            }
        });
    }

    /**
     * Method Name: updateColorDisplays
     * @description: Update color value displays and picker colors
     */
    updateColorDisplays() {
        const colorPickers = this.template.querySelectorAll('.color-picker');
        colorPickers.forEach(picker => {
            const recordId = picker.dataset.recordId;
            const fieldType = picker.dataset.fieldType;
            
            // Find the current record data
            const record = this.statusColors.find(item => 
                item.id === recordId || item.picklistValue === recordId
            );
            
            if (record) {
                const currentValue = fieldType === 'textColor' ? record.textColor : record.backgroundColor;
                
                // Update picker value
                picker.value = currentValue;
                
                // Update color value display
                const colorValueElement = picker.parentElement.querySelector('.color-value');
                if (colorValueElement) {
                    colorValueElement.textContent = currentValue;
                }
            }
        });
    }

    /**
     * Method Name: handleManageStatuses
     * @description: Open the status management modal
     */
    handleManageStatuses() {
        this.showStatusModal = true;
    }

    /**
     * Method Name: handleCloseStatusModal
     * @description: Close the status management modal and refresh data only if changes were saved
     */
    handleCloseStatusModal(event) {
        this.showStatusModal = false;
        // Only refresh the data if changes were actually saved in the modal
        const changesSaved = event.detail?.changesSaved || false;
        if (changesSaved) {
            this.fetchStatusColors();
        }
    }

}