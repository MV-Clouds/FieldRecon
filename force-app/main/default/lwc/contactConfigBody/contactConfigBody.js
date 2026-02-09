import { LightningElement, track } from 'lwc';
import getContactFields from '@salesforce/apex/ContactConfigController.getContactFields';
import saveContactConfig from '@salesforce/apex/ContactConfigController.saveContactConfig';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const MANDATORY_FIELD_DETAILS = [
    { fieldName: 'RecordType.DeveloperName', label: 'Type', fieldType: 'PICKLIST' },
    { fieldName: 'FirstName', label: 'First Name', fieldType: 'STRING' },
    { fieldName: 'LastName', label: 'Last Name', fieldType: 'STRING' },
    { fieldName: 'Email', label: 'Email', fieldType: 'EMAIL' },
];

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
                // Exclude compound/full name field (Name) because FirstName and LastName are available
                this.fieldOptions = this.fieldOptions.filter(opt => !this.isFullNameField(opt));
                this.filteredFieldOptions = [...this.fieldOptions];

                let itemsData = [];
                if (result.metadataRecords && result.metadataRecords.length > 0) {
                    itemsData = JSON.parse(result.metadataRecords[0]);
                    this.pageSize = parseInt(result.metadataRecords[1], 10);
                }

                const mandatoryFieldNames = MANDATORY_FIELD_DETAILS.map(f => f.fieldName);
                
                // Process existing items
                let processedItems = itemsData.map((item, index) => {
                    const fieldApiname = item.fieldApiname || item.fieldName;
                    const isMandatory = mandatoryFieldNames.includes(fieldApiname);
                    const fieldDef = this.fieldOptions.find(f => f.value === fieldApiname);
                    const isSystemLocked = fieldDef ? fieldDef.isEditableDisabled : false;

                    return {
                        id: index + 1,
                        fieldName: fieldApiname,
                        label: item.label,
                        value: fieldApiname,
                        fieldType: item.fieldType,
                        isEditable: isMandatory ? true : (isSystemLocked ? false : item.isEditable),
                        isRequired: isMandatory ? true : (isSystemLocked ? false : item.isRequired),
                        isTableView: isMandatory ? true : (item.isTableView === true),
                        isEditableDisabled: isMandatory || isSystemLocked,
                        isRequiredDisabled: isMandatory || isSystemLocked,
                        isTableViewDisabled: isMandatory,
                        isDeleteDisabled: isMandatory,
                        isDropdownDisabled: isMandatory,
                        dropdownClass: `combobox-input ${isMandatory ? 'disabled' : ''}`,
                        deleteClass: `delete-div ${isMandatory ? 'disabled' : ''}`,
                        isFocused: false
                    };
                });

                // Ensure all mandatory fields are present and at the top
                const finalItems = [];
                MANDATORY_FIELD_DETAILS.forEach((mandatory) => {
                    const existingIndex = processedItems.findIndex(item => item.fieldName === mandatory.fieldName);
                    if (existingIndex !== -1) {
                        const [item] = processedItems.splice(existingIndex, 1);
                        finalItems.push(item);
                    } else {
                        finalItems.push({
                            id: Date.now() + Math.random(),
                            fieldName: mandatory.fieldName,
                            label: mandatory.label,
                            value: mandatory.fieldName,
                            fieldType: mandatory.fieldType,
                            isEditable: true,
                            isRequired: true,
                            isTableView: true,
                            isEditableDisabled: true,
                            isRequiredDisabled: true,
                            isTableViewDisabled: true,
                            isDeleteDisabled: true,
                            isDropdownDisabled: true,
                            dropdownClass: 'combobox-input disabled',
                            deleteClass: 'delete-div disabled',
                            isFocused: false
                        });
                    }
                });

                this.items = [...finalItems, ...processedItems];
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
            isTableView: false,
            isTableViewDisabled: false,
            isRequiredDisabled: false,
            isDeleteDisabled: false,
            isDropdownDisabled: false,
            dropdownClass: 'combobox-input',
            deleteClass: 'delete-div',
            isFocused: false
        }];
        setTimeout(() => {
            const container = this.template.querySelector('.tableContainer');
            if (container) container.scrollTop = container.scrollHeight;
        }, 0);
    }

    handleDelete(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        if (this.items[index] && this.items[index].isDeleteDisabled) return;
        
        const newItems = [...this.items];
        newItems.splice(index, 1);
        this.items = newItems;
    }

    // Helper to compute available options for a given row index (excludes fields chosen in other rows)
    getAvailableOptions(index, searchTerm = '') {
        const currentValue = this.items[index] ? this.items[index].fieldName : null;
        const otherSelected = this.items
            .map((it, i) => i !== index ? it.fieldName : null)
            .filter(Boolean);

        const lowerSearch = (searchTerm || '').toLowerCase();

        return this.fieldOptions.filter(opt => {
            // never show compound/full name field (e.g., Name) in options
            if (this.isFullNameField(opt)) return false;
            const notSelectedElsewhere = !otherSelected.includes(opt.value) || opt.value === currentValue;
            const matchesSearch = opt.label.toLowerCase().includes(lowerSearch);
            return notSelectedElsewhere && matchesSearch;
        });
    }

    // Helper to identify and exclude compound/full name field
    isFullNameField(opt) {
        if (!opt) return false;
        const val = (opt.value || '').toString().toLowerCase();
        const lab = (opt.label || '').toString().toLowerCase();
        return val === 'name' || val === 'fullname' || lab === 'full name' || lab === 'fullname';
    }

    // Make this async so we can wait for DOM update before trying to focus the input
    async handleFocus(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        if (this.items[index] && this.items[index].isDropdownDisabled) return;

        // Pre-filter options to exclude values selected in other rows
        this.filteredFieldOptions = this.getAvailableOptions(index);

        this.items = this.items.map((item, i) => ({
            ...item,
            isFocused: i === index
        }));

        // Wait for next tick to ensure DOM updated
        await Promise.resolve();

        const searchInput = this.template.querySelector(`input.picklist-input[data-index="${index}"]`);
        if (searchInput) {
            searchInput.focus();
            // ensure caret is visible at end of any existing text
            try {
                const len = searchInput.value ? searchInput.value.length : 0;
                searchInput.setSelectionRange(len, len);
            } catch (e) {
            }
        }
    }

    handleBlur(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        setTimeout(() => {
            this.items = this.items.map((item, i) => {
                if(i === index) return {...item, isFocused: false};
                return item;
            });
            // Reset filtered options so it will be recalculated next time
            this.filteredFieldOptions = [...this.fieldOptions];
        }, 200);
    }

    handleSearchChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const searchTerm = event.target.value || '';
        this.filteredFieldOptions = this.getAvailableOptions(index, searchTerm);
    }

    handlePreventDefault(event) {
        event.preventDefault();
    }

    selectOption(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        const value = event.currentTarget.dataset.id;
        const label = event.currentTarget.dataset.label;
        const type = event.currentTarget.dataset.type;

        // Prevent selecting a value already chosen by another row (shouldn't happen because we filter, but safety net)
        const isDuplicate = this.items.some((it, i) => i !== index && it.fieldName === value);
        if (isDuplicate) {
            this.showToast('Error', 'Field already selected in another row', 'error');
            return;
        }

        const fieldDef = this.fieldOptions.find(f => f.value === value);
        const isLocked = fieldDef ? fieldDef.isEditableDisabled : false;

        this.items[index] = {
            ...this.items[index],
            fieldName: value,
            value: value,
            label: label,
            fieldType: type,
            isEditableDisabled: isLocked,
            isRequiredDisabled: isLocked ? true : false, // New selection isn't mandatory
            isTableViewDisabled: false,
            isTableView: false,
            isDeleteDisabled: false,
            isDropdownDisabled: false,
            dropdownClass: 'combobox-input',
            deleteClass: 'delete-div',
            isEditable: false,
            isRequired: false,
            isFocused: false
        };

        // Clear filtered options so other rows won't show this value
        this.filteredFieldOptions = [...this.fieldOptions];
    }

    handleEditableChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        this.items[index].isEditable = event.target.checked;
    }

    handleTableView(event) {
        const index = parseInt(event.target.dataset.index, 10);
        this.items[index].isTableView = event.target.checked;
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

    handleDragLeave(event) {
        event.currentTarget.classList.remove('drop-over');
    }

    handleDragEnd(event) {
        // Clean up all drag-related classes regardless of where the drag ended
        this.template.querySelectorAll('.popup__data-row').forEach(row => {
            row.classList.remove('dragged', 'drop-over');
        });
    }

    handleDrop(event) {
        event.preventDefault();
        const fromIndex = parseInt(event.dataTransfer.getData('text/plain'), 10);
        const toIndex = parseInt(event.currentTarget.dataset.index, 10);
        
        // If dropped on the same row, just clean up and return
        if (fromIndex === toIndex) {
            this.template.querySelectorAll('.popup__data-row').forEach(row => {
                row.classList.remove('dragged', 'drop-over');
            });
            return;
        }
        
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

        // Check if required fields have editable checkbox enabled
        const requiredButNotEditable = this.items.filter(item => 
            item.isRequired && !item.isEditable
        );

        if (requiredButNotEditable.length > 0) {
            const fieldNames = requiredButNotEditable.map(item => item.label).join(', ');
            this.showToast(
                'Error', 
                `Required fields must be editable: ${fieldNames}.`, 
                'error'
            );
            return;
        }

        this.isLoading = true;

        const dataToSave = this.items.map(item => ({
            fieldName: item.fieldName,
            label: item.label,
            fieldType: item.fieldType,
            isEditable: item.isEditable,
            isRequired: item.isRequired,
            isTableView: item.isTableView
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