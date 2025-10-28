import { LightningElement, track, api } from 'lwc';
import getObjectFields from '@salesforce/apex/RecordManagersCmpController.getObjectFields';
import getObjectFieldsParent from '@salesforce/apex/RecordManagersCmpController.getObjectFieldsParent';
import saveMetadata from '@salesforce/apex/RecordManagersCmpController.saveMappings';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class RecordConfigCmp extends LightningElement {
    @api objectApiName;
    @api featureName;
    @track fieldOptions = [];
    @track setScroll = false;
    @track pageSize = 30;
    @track items = [];
    @track searchText = '';
    @track filteredFieldOptions = [];
    @track parentFieldsOption = [];
    @track isLoading = false;

    // List of audit fields that should be non-editable
    auditFields = [
        'CreatedDate',
        'CreatedById', 
        'LastModifiedDate',
        'LastModifiedById',
        'SystemModstamp',
        'LastActivityDate',
        'LastReferencedDate',
        'LastViewedDate'
    ];

    @track dateOptions = [
        { label: 'DD-MM-YYYY', value: 'ddmmyyyy' },
        { label: 'MM-DD-YYYY', value: 'mmddyyyy' },
        { label: 'YYYY-MM-DD', value: 'yyyymmdd' }
    ];
    @track dateTimeOptions = [
        { label: 'DD-MM-YYYY (24 hour)', value: 'ddmmyyy24' },
        { label: 'MM-DD-YYYY (24 hour)', value: 'mmddyyyy24' },
        { label: 'YYYY-MM-DD (24 hour)', value: 'yyyymmdd24' },
        { label: 'DD-MM-YYYY (12 hour)', value: 'ddmmyyy12' },
        { label: 'MM-DD-YYYY (12 hour)', value: 'mmddyyyy12' },
        { label: 'YYYY-MM-DD (12 hour)', value: 'yyyymmdd12' }
    ];
    @track isForFocus = false;
    @track setIndex = 0;
    @track dragStartIndex = null;
    scrollInterval = null;

    get showParentDropDown() {
        return this.parentFieldsOption.length > 0;
    }

    get isDataAvailable() {
        return this.items && this.items.length > 0;
    }

    /**
    * Method Name: connectedCallback
    * @description: load external css and fetch fields data from metadata.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    connectedCallback(){
        this.fetchMetadata();
    }

    /**
    * Method Name: renderedCallback
    * @description: scroll to the bottom of the table when new row is added.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    renderedCallback(){
        if(this.setScroll){
            const container = this.template.querySelector('.tableContainer');
            container.scrollTop = container.scrollHeight;
            this.setScroll = false;
        } else if (this.isForFocus) {
            const inputElement = this.template.querySelector(`input[data-index="${this.setIndex}"]`);
            inputElement?.focus();
            this.isForFocus = false;
        }
    }

    /**
    * Method Name: isAuditField
    * @description: Check if field is an audit field
    * Date: 10/09/2024
    * Created By: Rachit Shah
    */
    isAuditField(fieldName) {
        return this.auditFields.includes(fieldName);
    }

    /**
    * Method Name: shouldDisableField
    * @description: Check if field should be disabled (formula, rollup, or audit field)
    * Date: 10/09/2024
    * Created By: Rachit Shah
    */
    shouldDisableField(fieldName, isCalculated = false) {
        return isCalculated || this.isAuditField(fieldName);
    }

    /**
    * Method Name: fetchMetadata
    * @description: fetch fields data from metadata.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    fetchMetadata() {
        this.isLoading = true;

        // console.log('featureName', this.featureName);
        // console.log('objectApiName', this.objectApiName);
        
        getObjectFields({ objectApiName: this.objectApiName , featureName: this.featureName})
            .then((result) => {
                if (!result) {
                    console.error('getObjectFields returned null');
                    this.isLoading = false;
                    return;
                }

                // console.log('result ==> ', result);
                

                this.fieldOptions = result.fieldDetailsList;
                this.fieldOptions = this.fieldOptions.map(option => ({
                    ...option,
                    showRightRef: this.isLookupField(option.fieldType),
                    isEditableDisabled: this.shouldDisableField(option.value, option.isCalculated)
                })).filter(option => option.value !== 'OwnerId');
                
                if (result.metadataRecords.length > 0) {
                    const fieldsData = JSON.parse(result.metadataRecords[0]);
                    // console.log('fieldsData ', fieldsData);
                    
                    this.items = fieldsData.map((item, index) => {
                        // Check if this field should be disabled (formula/rollup/audit)
                        const isEditableDisabled = this.getParentFieldEditableStatus(item.fieldName);
                        
                        return {
                            id: index + 1,
                            fieldName: item.fieldName,
                            cardView: item.cardView || false,
                            value: item.value,
                            label: item.label,
                            fieldType: item.fieldType,
                            format: item.format,
                            isDisable: item.format === '' || item.format == null,
                            // For disabled fields, always set isEditable to false, otherwise use saved value
                            isEditable: isEditableDisabled ? false : (item.isEditable !== undefined ? item.isEditable : false),
                            isEditableDisabled: isEditableDisabled,
                            picklist: item.fieldType === 'DATE' ? this.dateOptions :
                                item.fieldType === 'DATETIME' ? this.dateTimeOptions : null
                        };
                    });
                    this.pageSize = parseInt(result.metadataRecords[1], 10);
                }
                this.isLoading = false;
                this.filteredFieldOptions = this.fieldOptions;
            })
            .catch((error) => {
                // console.log('Error in fetchMetadata:', error);
                // console.log('Error Stack Trace:', error.stack);
                this.isLoading = false;
            });
    }

    /**
    * Method Name: getFieldEditableStatus
    * @description: Check if field is formula or rollup summary and should be disabled
    * Date: 10/09/2024
    * Created By: Rachit Shah
    */
    getFieldEditableStatus(fieldName) {
        const field = this.fieldOptions.find(option => option.value === fieldName);
        return field ? (field.isCalculated) : false;
    }

    /**
    * Method Name: handleEditableChange
    * @description: Handle editable checkbox change
    * Date: 10/09/2024
    * Created By: Rachit Shah
    */
    handleEditableChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const isEditable = event.target.checked;
        
        this.items = this.items.map((item, i) => {
            if (i === index) {
                return { ...item, isEditable: isEditable };
            }
            return item;
        });
    }

    /**
    * Method Name: isLookupField
    * @description: check if the field is a lookup field.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    isLookupField(fieldType) {
        return fieldType === 'REFERENCE' || fieldType === 'Lookup';
    }

    /**
    * Method Name: handleSearchChange
    * @description: handle search change.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    handleSearchChange(event) {
        try {
            const index = event.target.dataset.index;
            const newValue = event.target.value;
            this.items = this.items.map((item, i) => {
                if (i === parseInt(index, 10)) {
                    return { ...item, value: newValue };
                }
                return item;
            });
            if (newValue) {
                this.filteredFieldOptions = this.filterFieldOptions(newValue);
            } else {
                this.filteredFieldOptions = [...this.fieldOptions];
            }
        } catch (e) {
            // errordebugger('RecordConfigCmp', 'handleSearchChange', e, 'warn', 'Error occurred while handling search change');
        }
    }

    /**
    * Method Name: filterFieldOptions
    * @description: filter field options based on search text.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    filterFieldOptions(searchText) {
        try {
            const searchValue = searchText.toLowerCase();
            return this.fieldOptions.filter(option =>
                option.label.toLowerCase().includes(searchValue)
            );
        } catch (e) {
            // errordebugger('RecordConfigCmp', 'filterFieldOptions', e, 'warn', 'Error occurred while filtering field options');
        }
    }

    /**
    * Method Name: handleCardViewChange
    * @description: handle card view change.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    handleCardViewChange(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const cardView = event.target.checked;
        const selectedCardViewCount = this.items.filter(item => item.cardView).length;
        if (cardView && selectedCardViewCount >= 5) {
            event.target.checked = false;
            this.toast('Error', 'You can only select up to 5 items for card view', 'error');
        } else {
            this.items[index].cardView = cardView;
        }
    }

    handleDragStart(event) {
        this.dragStartIndex = Number(event.currentTarget.dataset.index);
        event.currentTarget.classList.add('dragged');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.dropEffect = 'move';
    }

    // DRAG LEAVE (remove highlight)
    handleDragLeave(event) {
        const row = event.currentTarget;
        row.classList.remove('drop-over');
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
    }

    // DROP (rearrange list)
    handleDragOver(event) {
        event.preventDefault();
        const row = event.currentTarget;
        row.classList.add('drop-over');
    
        // Auto-scroll fix
        const container = this.template.querySelector('.tableContainer');
        if (!container) return;
    
        const bounding = container.getBoundingClientRect();
        const mouseY = event.clientY;
        const scrollMargin = 70; // Increased from 36px for better sensitivity
        const scrollSpeed = 20;
        const maxScroll = container.scrollHeight - container.clientHeight;
        const currentScroll = container.scrollTop;
    
        // Clear any existing interval to prevent duplicates
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
    
        // Top zone scrolling
        if (mouseY < bounding.top + scrollMargin && currentScroll > 0) {
            this.scrollInterval = setInterval(() => {
                container.scrollTop = Math.max(0, container.scrollTop - scrollSpeed);
            }, 16);
        } 
        // Bottom zone scrolling
        else if (mouseY > bounding.bottom - scrollMargin && currentScroll < maxScroll) {
            this.scrollInterval = setInterval(() => {
                container.scrollTop = Math.min(maxScroll, container.scrollTop + scrollSpeed);
            }, 16);
        }
    }

    // Add to JavaScript methods
    handleDrop(event) {
        event.preventDefault();
        const dragStartIndex = this.dragStartIndex;
        const dropIndex = Number(event.currentTarget.dataset.index);

        if (dragStartIndex === dropIndex) return;

        // Reorder items
        const items = [...this.items];
        const [draggedItem] = items.splice(dragStartIndex, 1);
        items.splice(dropIndex, 0, draggedItem);

        // Update IDs
        this.items = items;

        // Reset styling
        event.currentTarget.classList.remove('drop-over');
    }

    // DRAG END (clear everything)
    handleDragEnd(event) {
        // Clear all drag classes
        this.template.querySelectorAll('.popup__data-row').forEach(row => {
            row.classList.remove('dragged', 'drop-over');
        });
        
        // Clear interval
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
    }
    handleDelete(event) {
        try {
            const index = parseInt(event.currentTarget.dataset.index, 10);
            const updatedItems = [...this.items];
            updatedItems.splice(index, 1);
            this.items = updatedItems;
            this.filteredFieldOptions = this.fieldOptions;
        } catch (error) {
            // errordebugger('RecordConfigCmp', 'handleDelete', error, 'warn', 'Error occurred while handling delete');
        }
    }

    /**
    * Method Name: addNewRow
    * @description: Used to add new row.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    addNewRow() {
        try {
            const newItem = {
                id: this.items.length + 1,
                fieldName: '',
                cardView: false,
                value: '',
                searchTerm: '',
                label: '',
                isDisable: true,
                isEditable: false,
                isEditableDisabled: false
            };
            this.items = [...this.items, newItem];
            this.setScroll = true;
        } catch (error) {
            // errordebugger('RecordConfigCmp', 'addNewRow', error, 'warn', 'Error occurred while adding new row');
        }
    }

    /**
    * Method Name: pageSizeChange
    * @description: handle page size change.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    pageSizeChange(event){
        this.pageSize = event.target.value;
    }

    /**
    * Method Name: saveRecords
    * @description: save records.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    saveRecords() {
        try {
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                if (!item.fieldName) {
                    this.toast('Error', `Please select field`, 'error');
                    return;
                }
            }
            const fieldNames = new Set();
            let errorFields = '';
            this.items.forEach(item => {
                if (fieldNames.has(item.fieldName)) {
                    errorFields += item.label + ',';
                } else {
                    fieldNames.add(item.fieldName);
                }
            });
            errorFields = errorFields.endsWith(',') ? errorFields.slice(0, -1) : errorFields;
            if (errorFields != '') {
                this.toast('Error', `Duplicate field name found: ${errorFields}`, 'error');
                return;
            }
            
            const itemsToSave = this.items.map(item => {
                // Ensure formula and rollup fields have isEditable set to false
                const isEditableValue = item.isEditableDisabled ? false : (item.isEditable !== undefined ? item.isEditable : true);
                
                return {
                    fieldName: item.fieldName,
                    fieldApiname: item.value,
                    cardView: item.cardView,
                    value: item.fieldName,
                    label: item.label,
                    fieldType: item.fieldType,
                    format: item.format,
                    isEditable: isEditableValue // Use the computed value
                };
            });
            
            const itemsData = JSON.stringify(itemsToSave);
            const totalPages = this.pageSize;
            saveMetadata({ itemsData, totalPages, objectApiName: this.objectApiName, featureName: this.featureName })
                .then(() => {
                    this.toast('Success', 'Configuration updated successfully', 'success');
                    
                    // Create custom event with specific detail and stop propagation
                    const configEvent = new CustomEvent('configurationupdated', {
                        bubbles: true,
                        composed: true,
                        detail: {
                            featureName: this.featureName,
                            success: true,
                            timestamp: Date.now() // Add timestamp to make event unique
                        }
                    });
                    
                    // Dispatch event and immediately close modal
                    this.dispatchEvent(configEvent);
                    
                    // Close modal after a small delay to ensure event is processed
                    this.closeModal();
                    
                })
                .catch(error => {
                    this.toast('Error', 'Error while updating records', 'error');
                });
        } catch (error) {
            // Handle error
        }
    }

    /**
    * Method Name: toast
    * @description: Used to show toast.
    * @param {string} title - The title of the toast.
    * @param {string} message - The message of the toast.
    * @param {string} variant - The variant of the toast.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    toast(title, message, variant) {
        const toastEvent = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(toastEvent);
    }

    // Picklist field methods

    /**
    * Method Name: handleFocus1
    * @description: Handle the Focus event in picklist fiedls.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    handleFocus1(event) {
        try {
            const index = event.currentTarget.dataset.index;
            this.setIndex = index;
            this.items = this.items.map((item, i) => {
                if (i === parseInt(index, 10)) {
                    return { ...item, isFocused: true };
                }
                return item;
            });
            this.isForFocus = true;
        } catch (error) {
            // errordebugger('RecordConfigCmp', 'handleFocus1', error, 'warn', 'Error occurred while handling focus');
        }
    }

     /**
    * Method Name: handleBlur1
    * @description: Handle the blur event in picklist fiedls.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    handleBlur1(event) {
        try {
            const index = event.currentTarget.dataset.index;
            this.items = this.items.map((item, i) => {
                if (i === parseInt(index, 10)) {
                    return { ...item, isFocused: false };
                }
                return item;
            });
            this.parentFieldsOption = [];
            this.filteredFieldOptions = [...this.fieldOptions];
        } catch (error) {
            // errordebugger('RecordConfigCmp', 'handleBlur1', error, 'warn', 'Error occurred while handling blur');
        }
    }

     /**
    * Method Name: handlePreventDefault
    * @description: prevent default events when the options div clicked.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    handlePreventDefault(event){
        event.preventDefault();
    }

    /**
    * Method Name: selectOption1
    * @description: select option in picklist fields.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    selectOption1(event) {
        try {
            const index = event.currentTarget.dataset.index;
            this.selectOption1Logic(event);
            requestAnimationFrame(() => {
                this.handleBlur(index);
            });
        } catch (e) {
            // errordebugger('RecordConfigCmp', 'selectOption1', e, 'warn', 'Error occurred while selecting option');
        }
    }

    /**
    * Method Name: selectOption1Logic
    * @description: select option logic in picklist fields.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    selectOption1Logic(event){
        const selectedOptionValue = event.currentTarget.dataset.id;
        const label = event.currentTarget.dataset.label;
        const index = event.currentTarget.dataset.index;
        const type = event.currentTarget.dataset.type;
        
        // Find the selected field to check if it's calculated or formula
        const selectedField = this.fieldOptions.find(option => option.value === selectedOptionValue);
        const isCalculated = selectedField ? selectedField.isCalculated : false;
        const isEditableDisabled = this.shouldDisableField(selectedOptionValue, isCalculated);
        
        this.items[index].fieldName = selectedOptionValue;
        this.items[index].value = selectedOptionValue;
        this.items[index].label = label;
        this.items[index].fieldType = type;
        this.items[index].isEditableDisabled = isEditableDisabled;
        
        // Set isEditable to false for all fields by default
        // For disabled fields (formula/rollup/audit), it will remain false and checkbox will be disabled
        // For regular fields, user can manually check the checkbox to make it editable
        this.items[index].isEditable = false;
        
        if (type == 'DATE') {
            this.items[index].isDisable = false;
            this.items[index].picklist = this.dateOptions;
            this.items[index].format = this.dateOptions[0].value;
        } else if (type == 'DATETIME') {
            this.items[index].isDisable = false;
            this.items[index].picklist = this.dateTimeOptions;
            this.items[index].format = this.dateTimeOptions[0].value;
        } else {
            this.items[index].isDisable = true;
            this.items[index].format = null;
        }
    }

    /**
    * Method Name: selectOptionParent
    * @description: select option in parent fields.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    selectOptionParent(event){
        try{
            const index = event.currentTarget.dataset.index;
            this.selectOptionParentLogic(event);
            requestAnimationFrame(() => {
                this.handleBlur(index);
            });
        } catch (e) {
            // errordebugger('RecordConfigCmp', 'selectOptionParent', e, 'warn', 'Error occurred while selecting option');
        }
    }

    /**
    * Method Name: selectOptionParentLogic
    * @description: select option logic in parent fields.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    selectOptionParentLogic(event){
        const selectedOptionValue = event.currentTarget.dataset.id;
        const label = event.currentTarget.dataset.label;
        const type = event.currentTarget.dataset.type;
        const index = event.currentTarget.dataset.index;
        
        // Find the selected parent field to check if it's calculated or formula
        const selectedField = this.parentFieldsOption.find(option => option.value === selectedOptionValue);
        const isCalculated = selectedField ? selectedField.isCalculated : false;
        const isEditableDisabled = this.shouldDisableField(selectedOptionValue, isCalculated);
        
        this.items[index].fieldName = this.items[index].relationshipName + '.' + selectedOptionValue;
        this.items[index].value = this.items[index].relationshipName + '.' + selectedOptionValue;
        this.items[index].label = label;
        this.items[index].fieldType = type;
        this.items[index].isEditableDisabled = isEditableDisabled;
        
        // Set isEditable to false for all fields by default
        // For disabled fields (formula/rollup/audit), it will remain false and checkbox will be disabled
        // For regular fields, user can manually check the checkbox to make it editable
        this.items[index].isEditable = false;
        
        if (type == 'DATE') {
            this.items[index].isDisable = false;
            this.items[index].picklist = this.dateOptions;
            this.items[index].format = this.dateOptions[0].value;
        } else if (type == 'DATETIME') {
            this.items[index].isDisable = false;
            this.items[index].picklist = this.dateTimeOptions;
            this.items[index].format = this.dateTimeOptions[0].value;
        } else {
            this.items[index].isDisable = true;
            this.items[index].format = null;
        }
        this.filteredFieldOptions = [...this.fieldOptions];
    }

    /**
    * Method Name: handleBlur
    * @description: handle blur event.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    handleBlur(index) {
        try {
            this.items = this.items.map((item, i) => {
                if (i === parseInt(index, 10)) {
                    return { ...item, isFocused: false };
                }
                return item;
            });
            this.parentFieldsOption = [];
            this.filteredFieldOptions = [...this.fieldOptions];
        } catch (error) {
            // errordebugger('RecordConfigCmp', 'handleBlur', error, 'warn', 'Error occurred while handling blur');
        }
    }

    /**
    * Method Name: clickOnRef
    * @description: click on reference field.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    clickOnRef(event){
        this.selectedField = [];
        const selectedValue = event.currentTarget.dataset.id;
        const index = event.currentTarget.dataset.index;
        const relationShip = event.currentTarget.dataset.label;
        this.items[index].relationshipName = relationShip;
        const selectedField = this.fieldOptions.find(option => option.value === selectedValue);
        if (selectedField != null) {
            this.fetchObjectFieldsWithoutReference(selectedField.referenceObjectName);
        }
    }

    /**
    * Method Name: fetchObjectFieldsWithoutReference
    * @description: fetch object fields without reference.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    fetchObjectFieldsWithoutReference(objectApiName) {
        getObjectFieldsParent({ objectApiName })
            .then(fields => {
                let filteredFields = fields.filter(field => field.fieldType !== 'REFERENCE');
                if (fields) {
                    this.parentFieldsOption = filteredFields.map(field => {
                        return {
                            label: field.label,
                            value: field.value,
                            fieldType: field.fieldType,
                            isCalculated: field.isCalculated,
                            isEditableDisabled: this.shouldDisableField(field.value, field.isCalculated),
                            referenceObjectName: field.referenceFields || [],
                            objectApiName: field.referenceObjectName || ''
                        };
                    });
                }
            })
            .catch(error => {
                // errordebugger('RecordConfigCmp', 'fetchObjectFieldsWithoutReference', error, 'warn', 'Error occurred while fetching object fields');
            });
    }

    /**
    * Method Name: handleFormatChange
    * @description: handle format change.
    * Date: 10/09/2024
    * Created By: Vyom Soni
    */
    handleFormatChange(event){
        const value = event.detail.value;
        const index = event.currentTarget.dataset.id;
        this.items[index].format = value;
    }

    closeModal() {
        const parent = this.template.host.closest('c-record-config-body-cmp');
        // console.log('parent', parent);
        
        if (parent) {
            parent.handleDialogueClose();
        }
    }

    /**
    * Method Name: getParentFieldEditableStatus
    * @description: Check if parent field should be disabled (formula/rollup/audit)
    * Date: 10/09/2024
    * Created By: Rachit Shah
    */
    getParentFieldEditableStatus(fieldName) {
        // Check if it's a parent field (contains dot notation)
        if (fieldName && fieldName.includes('.')) {
            const fieldNameOnly = fieldName.split('.')[1];
            const field = this.parentFieldsOption.find(option => option.value === fieldNameOnly);
            const isCalculated = field ? field.isCalculated : false;
            return this.shouldDisableField(fieldNameOnly, isCalculated);
        }
        
        // Regular field check
        const field = this.fieldOptions.find(option => option.value === fieldName);
        const isCalculated = field ? field.isCalculated : false;
        return this.shouldDisableField(fieldName, isCalculated);
    }
}