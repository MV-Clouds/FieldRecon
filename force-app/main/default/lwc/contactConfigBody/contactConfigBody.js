import { LightningElement, track } from 'lwc';
import getContactFields from '@salesforce/apex/ContactConfigController.getContactFields';
import saveContactConfig from '@salesforce/apex/ContactConfigController.saveContactConfig';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ContactConfigBody extends LightningElement {
    @track fieldOptions = [];
    @track items = [];
    @track filteredFieldOptions = [];
    @track isLoading = false;
    @track pageSize = 30;

    auditFields = ['CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById', 'SystemModstamp'];

    connectedCallback() {
        this.fetchMetadata();
    }

    fetchMetadata() {
        this.isLoading = true;
        getContactFields()
            .then(result => {
                this.fieldOptions = result.fieldDetailsList.map(opt => ({
                    ...opt,
                    isEditableDisabled: this.auditFields.includes(opt.value) || opt.isCalculated
                }));
                this.filteredFieldOptions = [...this.fieldOptions];

                if (result.metadataRecords && result.metadataRecords.length > 0) {
                    const fieldsData = JSON.parse(result.metadataRecords[0]);
                    this.pageSize = parseInt(result.metadataRecords[1], 10);

                    this.items = fieldsData.map((item, index) => {
                        const fieldDef = this.fieldOptions.find(f => f.value === (item.fieldApiname || item.fieldName));
                        const isLocked = fieldDef ? fieldDef.isEditableDisabled : false;

                        return {
                            id: index + 1,
                            fieldName: item.fieldName,
                            label: item.label,
                            value: item.fieldApiname || item.fieldName,
                            fieldType: item.fieldType,
                            isEditable: isLocked ? false : item.isEditable,
                            isEditableDisabled: isLocked,
                            isRequired: item.isRequired === true, // Load Required State
                            isFocused: false
                        };
                    });
                }
                this.isLoading = false;
            })
            .catch(error => {
                this.isLoading = false;
                console.error(error);
                this.showToast('Error', 'Failed to load configuration', 'error');
            });
    }

    get isDataAvailable() {
        return this.items && this.items.length > 0;
    }

    addNewRow() {
        this.items = [...this.items, {
            id: Date.now(),
            fieldName: '',
            label: 'Select Field',
            value: '',
            isEditable: false,
            isEditableDisabled: false,
            isRequired: false, // Default
            isFocused: false
        }];
        setTimeout(() => {
            const container = this.template.querySelector('.tableContainer');
            if (container) container.scrollTop = container.scrollHeight;
        }, 0);
    }

    handleDelete(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        const newItems = [...this.items];
        newItems.splice(index, 1);
        this.items = newItems;
    }

    handleFocus(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        this.filteredFieldOptions = [...this.fieldOptions];
        this.items = this.items.map((item, i) => ({
            ...item,
            isFocused: i === index
        }));

        setTimeout(() => {
            const searchInput = this.template.querySelector(`input.picklist-input[data-index="${index}"]`);
            if (searchInput) {
                searchInput.focus();
            }
        }, 0);
    }

    handleBlur(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        setTimeout(() => {
            this.items = this.items.map((item, i) => {
                if(i === index) return {...item, isFocused: false};
                return item;
            });
        }, 200);
    }

    handleSearchChange(event) {
        const searchTerm = event.target.value.toLowerCase();
        this.filteredFieldOptions = this.fieldOptions.filter(opt => 
            opt.label.toLowerCase().includes(searchTerm)
        );
    }

    handlePreventDefault(event) {
        event.preventDefault();
    }

    selectOption(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        const value = event.currentTarget.dataset.id;
        const label = event.currentTarget.dataset.label;
        const type = event.currentTarget.dataset.type;

        const fieldDef = this.fieldOptions.find(f => f.value === value);
        const isLocked = fieldDef ? fieldDef.isEditableDisabled : false;

        this.items[index] = {
            ...this.items[index],
            fieldName: value,
            value: value,
            label: label,
            fieldType: type,
            isEditableDisabled: isLocked,
            isEditable: false,
            isRequired: false,
            isFocused: false
        };
    }

    handleEditableChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        this.items[index].isEditable = event.target.checked;
    }

    // NEW: Handle Required Checkbox Change
    handleRequiredChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        this.items[index].isRequired = event.target.checked;
    }

    handleDragStart(event) {
        event.dataTransfer.setData('text/plain', event.currentTarget.dataset.index);
        event.currentTarget.classList.add('dragged');
    }

    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drop-over');
    }

    handleDrop(event) {
        event.preventDefault();
        const fromIndex = parseInt(event.dataTransfer.getData('text/plain'), 10);
        const toIndex = parseInt(event.currentTarget.dataset.index, 10);
        
        const items = [...this.items];
        const [movedItem] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, movedItem);
        
        this.items = items;
        
        this.template.querySelectorAll('.popup__data-row').forEach(row => {
            row.classList.remove('dragged', 'drop-over');
        });
    }

    saveRecords() {
        if (this.items.some(item => !item.fieldName)) {
            this.showToast('Error', 'Please select a field for all rows', 'error');
            return;
        }

        const seen = new Set();
        const duplicates = new Set();
        
        this.items.forEach(item => {
            if (seen.has(item.fieldName)) {
                duplicates.add(item.label);
            } else {
                seen.add(item.fieldName);
            }
        });

        if (duplicates.size > 0) {
            // Show specific duplicate names in toast
            const dupList = Array.from(duplicates).join(', ');
            this.showToast('Error', `Duplicate fields detected: ${dupList}`, 'error');
            return;
        }

        this.isLoading = true;

        const dataToSave = this.items.map(item => ({
            fieldName: item.fieldName,
            label: item.label,
            fieldType: item.fieldType,
            isEditable: item.isEditable,
            isRequired: item.isRequired
        }));

        saveContactConfig({ 
            itemsData: JSON.stringify(dataToSave), 
            totalPages: this.pageSize 
        })
        .then(() => {
            this.isLoading = false;
            this.showToast('Success', 'Configuration updated successfully', 'success');
            this.dispatchEvent(new CustomEvent('configurationupdated', {
                detail: { success: true }
            }));
        })
        .catch(error => {
            this.isLoading = false;
            this.showToast('Error', 'Failed to save settings', 'error');
        });
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('configurationupdated', {
            detail: { success: false }
        }));
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}