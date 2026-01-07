import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getContacts from '@salesforce/apex/ManagementTabController.getContacts';
import upsertContact from '@salesforce/apex/ManagementTabController.upsertContact';
import deleteContact from '@salesforce/apex/ManagementTabController.deleteContact';
// New Controller Methods for Config and Validation
import checkEmailUniqueness from '@salesforce/apex/ManagementTabController.checkEmailUniqueness';
import getContactFields from '@salesforce/apex/ContactConfigController.getContactFields';

export default class ContactManagement extends NavigationMixin(LightningElement) {
    @track isLoading = true;
    @track contacts = [];
    @track filteredContacts = [];
    @track searchTerm = '';
    @track sortField = 'Name';
    @track sortOrder = 'desc';
    @track showCreateModal = false;
    @track isEditMode = false;
    @track recordIdToEdit = null;
    
    // Form fields
    @track firstName = '';
    @track lastName = '';
    @track email = '';
    @track recordType = '';
    @track canClockInOut = false;
    
    // Record type options
    @track recordTypeOptions = [
        { label: 'Employee', value: 'Employee_WF_Recon' },
        { label: 'Sub Contractor', value: 'Sub_Contractor_WF_Recon' }
    ];
    
    // Confirmation modal properties
    @track showConfirmationModal = false;
    @track confirmationModalTitle = 'Confirm Action';
    @track confirmationModalMessage = 'Are you sure you want to proceed?';
    @track pendingDeleteRecordId = null;
    
    // Pagination properties
    @track currentPage = 1;
    @track pageSize = 30;
    @track visiblePages = 5;
    @track shownContactData = [];

    // Contact table columns configuration
    @track contactTableColumns = [
        { label: 'Sr. No.', fieldName: 'SerialNumber', type: 'text', isSerialNumber: true, sortable: false, headerClass: 'header-cell header-index non-sortable-header' },
        { label: 'Actions', fieldName: 'Actions', type: 'text', isActions: true, sortable: false, headerClass: 'header-cell non-sortable-header' },
        { label: 'Name', fieldName: 'Name', type: 'text', sortable: true, headerClass: 'header-cell sortable-header' },
        { label: 'Type', fieldName: 'RecordType.DeveloperName', type: 'text', sortable: true, headerClass: 'header-cell sortable-header' },
        { label: 'Can Clock In / Out', fieldName: 'wfrecon__Can_Clock_In_Out__c', type: 'checkbox', isCheckboxField: true, sortable: true, headerClass: 'header-cell sortable-header' }
    ];

    // Modal & Mode States
    @track showConfigModal = false;
    @track isPreviewMode = false;

    // Dynamic Form Data
    @track dynamicFields = [];
    @track formValues = {};
    @track configuredMetadata = [];

    /**
     * Method Name: get displayedContacts
     * @description: Contact records for table display
     */
    get displayedContacts() {
        try {
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = Math.min(startIndex + this.pageSize, this.filteredContacts.length);
            const paginatedData = this.filteredContacts.slice(startIndex, endIndex);

            return paginatedData.map((contact, index) => {
                const columns = this.contactTableColumns.map(col => {
                    const key = `${contact.Id}-${col.fieldName}`;
                    
                    if (col.isSerialNumber) {
                        return {
                            key,
                            isSerialNumber: true,
                            value: startIndex + index + 1
                        };
                    }
                    
                    if (col.isActions) {
                        return {
                            key,
                            isActions: true
                        };
                    }

                    if (col.isCheckboxField) {
                        const rawValue = this.getFieldValue(contact, col.fieldName);
                        return {
                            key,
                            isCheckboxField: true,
                            value: rawValue,
                            displayValue: rawValue ? 'Yes' : 'No'
                        };
                    }
                    
                    return {
                        key,
                        isRegularField: true,
                        value: this.formatFieldValue(contact, col)
                    };
                });

                return {
                    Id: contact.Id,
                    columns
                };
            });
        } catch (error) {
            console.error('Error processing contacts for display:', error);
            return [];
        }
    }

    /**
     * Method Name: formatFieldValue
     * @description: Format field value for display
     */
    formatFieldValue(contact, column) {
        const fieldValue = this.getFieldValue(contact, column.fieldName);
        
        // Handle RecordType.DeveloperName specially
        if (column.fieldName === 'RecordType.DeveloperName') {
            if (fieldValue === 'Employee_WF_Recon') return 'Employee';
            if (fieldValue === 'Sub_Contractor_WF_Recon') return 'Sub Contractor';
            return fieldValue || '';
        }
        
        return fieldValue || '';
    }

    /**
     * Method Name: get totalItems
     * @description: Get total number of filtered contacts
     */
    get totalItems() {
        return this.filteredContacts.length;
    }

    /**
     * Method Name: get totalPages
     * @description: Calculate total number of pages
     */
    get totalPages() {
        return Math.ceil(this.totalItems / this.pageSize);
    }

    /**
     * Method Name: get isFirstPage
     * @description: Check if current page is first page
     */
    get isFirstPage() {
        return this.currentPage === 1;
    }

    /**
     * Method Name: get isLastPage
     * @description: Check if current page is last page
     */
    get isLastPage() {
        return this.currentPage >= this.totalPages;
    }

    /**
     * Method Name: get startIndex
     * @description: Get start index for current page
     */
    get startIndex() {
        return (this.currentPage - 1) * this.pageSize;
    }

    /**
     * Method Name: get endIndex
     * @description: Get end index for current page
     */
    get endIndex() {
        return Math.min(this.startIndex + this.pageSize, this.totalItems);
    }

    /**
     * Method Name: get pageNumbers
     * @description: Generate array of page numbers for pagination display
     */
    get pageNumbers() {
        const pages = [];
        const totalPages = this.totalPages;
        const current = this.currentPage;
        const maxVisible = this.visiblePages;

        // If total pages fits within visible range + first/last, render them all
        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push({
                    number: i,
                    cssClass: i === current ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
            }
        } else {
            // Always show first page
            pages.push({
                number: 1,
                cssClass: 1 === current ? 'pagination-button active' : 'pagination-button',
                isEllipsis: false
            });

            let startPage = Math.max(2, current - Math.floor(maxVisible / 2));
            let endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);

            if (endPage - startPage < maxVisible - 1) {
                startPage = Math.max(2, endPage - maxVisible + 1);
            }

            if (startPage > 2) {
                pages.push({
                    number: 'ellipsis-start',
                    isEllipsis: true
                });
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push({
                    number: i,
                    cssClass: i === current ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
            }

            if (endPage < totalPages - 1) {
                pages.push({
                    number: 'ellipsis-end',
                    isEllipsis: true
                });
            }

            // Always show last page
            pages.push({
                number: totalPages,
                cssClass: totalPages === current ? 'pagination-button active' : 'pagination-button',
                isEllipsis: false
            });
        }

        return pages;
    }

    /**
     * Method Name: get showEllipsis
     * @description: Check if ellipsis should be shown in pagination
     */
    get showEllipsis() {
        return this.totalPages > this.visiblePages + 2;
    }

    /**
     * Method Name: get isDataAvailable
     * @description: Check if data is available to display
     */
    get isDataAvailable() {
        return this.filteredContacts.length > 0;
    }

    /**
     * Method Name: get modalTitle
     * @description: Get modal title based on mode
     */
    get modalTitle() {
        if (this.isPreviewMode) return 'Contact Details';
        return this.isEditMode ? 'Edit Contact' : 'Create New Contact';
    }

    /**
     * Method Name: get saveButtonLabel
     * @description: Get save button label based on mode
     */
    get saveButtonLabel() {
        return this.isEditMode ? 'Update' : 'Save';
    }

    /**
     * Method Name: connectedCallback
     * @description: Load contacts on component load
     */
    connectedCallback() {
        this.fetchContacts();
        this.fetchConfiguration();
    }

    /**
     * Method Name: fetchContacts
     * @description: Fetch all contacts from the server
     */
    fetchContacts() {
        this.isLoading = true;
        
        getContacts()
            .then(result => {
                this.contacts = result || [];
                this.applyFilters();
            })
            .catch(error => {
                console.error('Error fetching contacts:', error);
                this.showToast('Error', 'Failed to load contacts', 'error');
                this.contacts = [];
                this.filteredContacts = [];
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: getFieldValue
     * @description: Get field value from nested object structure
     */
    getFieldValue(record, fieldName) {
        if (!record || !fieldName) {
            return '';
        }

        const fieldParts = fieldName.split('.');
        let value = record;

        for (let part of fieldParts) {
            if (value && value.hasOwnProperty(part)) {
                value = value[part];
            } else {
                return '';
            }
        }

        return value !== null && value !== undefined ? value : '';
    }

    /**
     * Method Name: applyFilters
     * @description: Apply search filters and sorting
     */
    applyFilters() {
        try {
            let filtered = [...this.contacts];

            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                filtered = filtered.filter(contact => {
                    const name = this.getFieldValue(contact, 'Name').toLowerCase();
                    const email = this.getFieldValue(contact, 'Email').toLowerCase();
                    const recordType = this.getFieldValue(contact, 'RecordType.DeveloperName').toLowerCase();
                    
                    return name.includes(searchLower) || 
                           email.includes(searchLower) || 
                           recordType.includes(searchLower);
                });
            }

            this.filteredContacts = filtered;
            this.sortData();
            this.currentPage = 1;
        } catch (error) {
            console.error('Error applying filters:', error);
        }
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
     * Method Name: handleCreateNew
     * @description: Open create new contact modal
     */
    handleCreateNew() {
        this.formValues = {
            'wfrecon__Can_Clock_In_Out__c': true  // Default to checked
        };
        this.isEditMode = false;
        this.isPreviewMode = false;
        this.recordIdToEdit = null;
        this.prepareDynamicFields();
        this.showCreateModal = true;
        
        // Set default value for checkbox field after modal renders
        setTimeout(() => {
            this.setDefaultCheckboxValue();
        }, 100);
    }

    /**
     * Method Name: setDefaultCheckboxValue
     * @description: Set default value for checkbox field after modal renders
     *              This is needed because lightning-input-field doesn't respect value property
     */
    setDefaultCheckboxValue() {
        const inputFields = this.template.querySelectorAll('lightning-input-field');
        inputFields.forEach(field => {
            if (field.fieldName === 'wfrecon__Can_Clock_In_Out__c') {
                field.value = true;
            }
        });
    }

    /**
     * Method Name: handleCloseModal
     * @description: Close create contact modal
     */
    handleCloseModal() {
        this.showCreateModal = false;
        this.formValues = {};
        this.clearFormFields();
        this.isEditMode = false;
        this.recordIdToEdit = null;
    }

    /**
     * Method Name: clearFormFields
     * @description: Clear all form fields
     */
    clearFormFields() {
        this.firstName = '';
        this.lastName = '';
        this.email = '';
        this.recordType = '';
        this.canClockInOut = false;
    }

    /**
     * Method Name: populateFormFields
     * @description: Populate form fields for editing
     */
    populateFormFields(contactRecord) {
        this.firstName = this.getFieldValue(contactRecord, 'FirstName');
        this.lastName = this.getFieldValue(contactRecord, 'LastName');
        this.email = this.getFieldValue(contactRecord, 'Email');
        this.recordType = this.getFieldValue(contactRecord, 'RecordType.DeveloperName');
        this.canClockInOut = this.getFieldValue(contactRecord, 'wfrecon__Can_Clock_In_Out__c') || false;
    }

    /**
     * Method Name: handleInputChange
     * @description: Handle input field changes
     */
    handleInputChange(event) {
        const fieldName = event.target.name;
        
        if (fieldName === 'firstName') {
            this.firstName = event.target.value;
        } else if (fieldName === 'lastName') {
            this.lastName = event.target.value;
        } else if (fieldName === 'email') {
            this.email = event.target.value;
        } else if (fieldName === 'recordType') {
            this.recordType = event.target.value;
        } else if (fieldName === 'canClockInOut') {
            this.canClockInOut = event.target.checked;
        }
    }

    /**
     * Method Name: handleSave
     * @description: Handle save button click
     */
    async handleSave(event) {
        event.preventDefault();
        
        const inputFields = this.template.querySelectorAll('lightning-input-field');
        const customInputs = this.template.querySelectorAll('.custom-field-input');
        
        let isValid = true;
        const fieldData = {};

        // 1. Get Standard Fields (Inputs, Dates, Lookups)
        inputFields.forEach(field => {
            if(!field.reportValidity()) {
                isValid = false;
            }
            // Only add to fieldData if value exists
            if(field.value !== undefined && field.value !== null && field.value !== '') {
                fieldData[field.fieldName] = field.value;
            }
        });

        // 2. Get Custom Fields (Record Type Combobox)
        customInputs.forEach(input => {
            if(!input.reportValidity()) {
                isValid = false;
            }
            // Only add to fieldData if value exists
            if(input.value !== undefined && input.value !== null && input.value !== '') {
                fieldData[input.name] = input.value;
            }
        });

        if (!isValid) {
            this.showToast('Error', 'Please complete all required fields.', 'error');
            return;
        }

        // 3. Merge & Process Data - formValues should already have values from handleCustomInputChange
        const finalPayload = { ...this.formValues, ...fieldData };
        
        // Add record ID if editing
        if (this.isEditMode && this.recordIdToEdit) {
            finalPayload['Id'] = this.recordIdToEdit;
        }
        
        // Email Validation
        const email = finalPayload['Email'];
        if (email) {
            this.isLoading = true;
            try {
                const isUnique = await checkEmailUniqueness({ 
                    email: email, 
                    excludeContactId: this.isEditMode ? this.recordIdToEdit : null 
                });
                if (!isUnique) {
                    this.showToast('Validation Error', 'This email address is already associated with another contact.', 'error');
                    this.isLoading = false;
                    return;
                }
            } catch (error) {
                this.isLoading = false;
                console.error('Email validation error:', error);
                this.showToast('Error', 'Failed to validate email. Please try again.', 'error');
                return;
            }
        }

        // Clean Empty Strings for Apex
        Object.keys(finalPayload).forEach(key => {
            if (finalPayload[key] === '' || finalPayload[key] === undefined) {
                finalPayload[key] = null;
            }
        });

        // Fix Record Type Key for Apex
        if (finalPayload['RecordType.DeveloperName']) {
            finalPayload['RecordTypeDeveloperName'] = finalPayload['RecordType.DeveloperName'];
            delete finalPayload['RecordType.DeveloperName'];
        }

        // 4. Save
        this.isLoading = true;
        upsertContact({ contactData: finalPayload })
            .then(result => {
                if (result) {
                    const msg = this.isEditMode ? 'Contact updated successfully' : 'Contact created successfully';
                    this.showToast('Success', msg, 'success');
                    this.handleCloseModal();
                    this.fetchContacts();
                } else {
                    this.showToast('Error', 'Failed to save contact. Please try again.', 'error');
                }
            })
            .catch(error => {
                console.error('Save Error', error);
                this.showToast('Error', error.body?.message || 'Failed to save contact', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleSortClick
     * @description: Handle column header click for sorting
     */
    handleSortClick(event) {
        const clickedField = event.currentTarget.dataset.field;
        
        if (!clickedField) return;

        if (this.sortField === clickedField) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = clickedField;
            this.sortOrder = 'asc';
        }

        this.sortData();
        this.updateSortIcons();
    }

    /**
     * Method Name: sortData
     * @description: Sort the contact data based on current sort field and order
     */
    sortData() {
        try {
            this.filteredContacts.sort((a, b) => {
                let aVal = this.getFieldValue(a, this.sortField);
                let bVal = this.getFieldValue(b, this.sortField);

                // Handle null/undefined values
                if (aVal === null || aVal === undefined) aVal = '';
                if (bVal === null || bVal === undefined) bVal = '';

                // Convert to strings for comparison if not already
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();

                if (aVal < bVal) {
                    return this.sortOrder === 'asc' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return this.sortOrder === 'asc' ? 1 : -1;
                }
                return 0;
            });
        } catch (error) {
            console.error('Error sorting data:', error);
        }
    }

    /**
     * Method Name: updateSortIcons
     * @description: Update sort icons and active states
     */
    updateSortIcons() {
        try {
            setTimeout(() => {
                const headers = this.template.querySelectorAll('.sortable-header');
                
                headers.forEach(header => {
                    const field = header.dataset.field;
                    const sortIcon = header.querySelector('.sort-icon');
                    
                    if (field === this.sortField) {
                        header.classList.add('active-sort');
                        if (sortIcon) {
                            sortIcon.classList.remove('rotate-asc', 'rotate-desc');
                            sortIcon.classList.add(this.sortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                        }
                    } else {
                        header.classList.remove('active-sort');
                        if (sortIcon) {
                            sortIcon.classList.remove('rotate-asc', 'rotate-desc');
                            sortIcon.classList.add('rotate-asc');
                        }
                    }
                });
            }, 0);
        } catch (error) {
            console.error('Error updating sort icons:', error);
        }
    }

    /**
     * Method Name: handleEditContact
     * @description: Handle edit contact action
     */
    handleEditContact(event) {
        event.preventDefault();
        event.preventDefault();
        const id = event.currentTarget.dataset.recordId;
        this.openModalWithRecord(id, true, false);
    }

    handlePreviewContact(event) {
        event.preventDefault();
        const id = event.currentTarget.dataset.recordId;
        this.openModalWithRecord(id, false, true);
    }

    openModalWithRecord(recordId, isEdit, isPreview) {
        const contact = this.contacts.find(c => c.Id === recordId);
        if (contact) {
            this.isEditMode = isEdit;
            this.isPreviewMode = isPreview;
            this.recordIdToEdit = recordId;
            
            // Populate formValues from Config
            this.formValues = {};
            this.configuredMetadata.forEach(field => {
                this.formValues[field.fieldName] = this.getFieldValue(contact, field.fieldName);
            });
            this.formValues['Id'] = recordId;

            this.prepareDynamicFields();
            this.showCreateModal = true;
        }
    }

    /**
     * Method Name: handleDeleteContact
     * @description: Handle delete contact action
     */
    handleDeleteContact(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordId;
        
        this.pendingDeleteRecordId = recordId;
        this.confirmationModalTitle = 'Delete Contact';
        this.confirmationModalMessage = 'Are you sure you want to delete this contact? This action cannot be undone.';
        this.showConfirmationModal = true;
    }

    /**
     * Method Name: handleConfirmationModalConfirm
     * @description: Handle confirmation modal confirm action
     */
    handleConfirmationModalConfirm() {
        this.showConfirmationModal = false;
        if (this.pendingDeleteRecordId) {
            this.deleteContactRecord(this.pendingDeleteRecordId);
            this.pendingDeleteRecordId = null;
        }
    }

    /**
     * Method Name: handleConfirmationModalCancel
     * @description: Handle confirmation modal cancel action
     */
    handleConfirmationModalCancel() {
        this.showConfirmationModal = false;
        this.pendingDeleteRecordId = null;
    }

    /**
     * Method Name: deleteContactRecord
     * @description: Delete contact record via Apex
     */
    deleteContactRecord(recordId) {
        this.isLoading = true;
        
        deleteContact({ contactId: recordId })
            .then(result => {
                if (result === 'Success') {
                    this.showToast('Success', 'Contact deleted successfully', 'success');
                    this.fetchContacts();
                } else {
                    this.showToast('Error', result, 'error');
                }
            })
            .catch(error => {
                console.error('Error deleting contact:', error);
                this.showToast('Error', error.body?.message || 'Failed to delete contact', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handlePrevious
     * @description: Handle the previous button click in pagination
     */
    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }

    /**
     * Method Name: handleNext
     * @description: Handle the next button click in pagination
     */
    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
    }

    /**
     * Method Name: handlePageChange
     * @description: Handle direct click on page number
     */
    handlePageChange(event) {
        const selectedPage = parseInt(event.target.dataset.page);
        if (selectedPage && selectedPage !== this.currentPage) {
            this.currentPage = selectedPage;
        }
    }

    // --- Configuration Fetching ---
    fetchConfiguration() {
        getContactFields()
            .then(result => {
                if (result && result.metadataRecords && result.metadataRecords.length > 0) {
                    try {
                        this.configuredMetadata = JSON.parse(result.metadataRecords[0]);
                    } catch (e) {
                        this.setDefaultConfiguration();
                    }
                } else {
                    this.setDefaultConfiguration();
                }
            })
            .catch(error => {
                console.error('Error fetching config', error);
                this.setDefaultConfiguration();
            });
    }

    setDefaultConfiguration() {
        this.configuredMetadata = [
            { fieldName: 'FirstName', label: 'First Name', isEditable: true, fieldType: 'STRING' },
            { fieldName: 'LastName', label: 'Last Name', isEditable: true, fieldType: 'STRING' },
            { fieldName: 'Email', label: 'Email', isEditable: true, fieldType: 'EMAIL' },
            { fieldName: 'RecordType.DeveloperName', label: 'Type', isEditable: true, fieldType: 'PICKLIST' },
            { fieldName: 'wfrecon__Can_Clock_In_Out__c', label: 'Can Clock In / Out', isEditable: true, fieldType: 'BOOLEAN' }
        ];
    }

    // --- Configuration Modal Handlers ---
    handleOpenConfig() {
        this.showConfigModal = true;
    }

    handleConfigUpdated(event) {
        this.showConfigModal = false;
        if(event.detail && event.detail.success) {
            this.fetchConfiguration(); // Reload config if saved
        }
    }

    // --- Dynamic Form Logic ---
    prepareDynamicFields() {
        // 1. Load config or default
        let metadata = [];
        if (this.configuredMetadata && this.configuredMetadata.length > 0) {
            metadata = [...this.configuredMetadata];
        } else {
            this.setDefaultConfiguration();
            metadata = [...this.configuredMetadata];
        }

        // 2. Filter out Record Type from metadata if it exists (to avoid duplicates)
        // We will manually inject it at the top next.
        const otherFields = metadata.filter(f => 
            f.fieldName !== 'RecordType.DeveloperName' && 
            f.fieldName !== 'RecordTypeId'
        );

        // 3. Create the Record Type Field Object (Always First)
        const recordTypeVal = this.formValues['RecordType.DeveloperName'] || this.formValues['RecordTypeId'];
        
        const recordTypeField = {
            fieldName: 'RecordType.DeveloperName', // Internal ID for UI
            label: 'Type',
            value: recordTypeVal,
            isDisabled: this.isPreviewMode, // Disabled in preview, enabled in create/edit
            isRequired: true,
            isRecordType: true,
            isCheckbox: false,
            isStandardInput: false
        };

        // 4. Map the rest of the fields
        const dynamicOtherFields = otherFields.map(config => {
            const fieldName = config.fieldName;
            
            // Set default value for Can Clock In/Out checkbox on create mode
            let currentVal = this.formValues[fieldName] !== undefined ? this.formValues[fieldName] : null;
            
            // Ensure checkbox field gets proper boolean value
            if (!this.isEditMode && !this.isPreviewMode && 
                fieldName === 'wfrecon__Can_Clock_In_Out__c' && currentVal === null) {
                currentVal = true;
            }
            
            const isDisabled = this.isPreviewMode ? true : !config.isEditable;
            const isSystemRequired = fieldName === 'LastName' || fieldName === 'Email';
            const isRequired = isSystemRequired || (config.isRequired === true);

            return {
                fieldName: fieldName,
                label: config.label || fieldName,
                value: currentVal,
                isDisabled: isDisabled,
                isRequired: isRequired,
                isRecordType: false,
                isCheckbox: config.fieldType === 'BOOLEAN',
                isStandardInput: config.fieldType !== 'BOOLEAN'
            };
        });

        if (this.isEditMode || this.isPreviewMode) {
            this.dynamicFields = [...dynamicOtherFields];
        } else {
            // Create Mode: Show Type at the top
            this.dynamicFields = [recordTypeField, ...dynamicOtherFields];
        }
    }
    /**
     * Method Name: handleCustomInputChange
     * @description: Handle custom input changes (Record Type combobox)
     */
    handleCustomInputChange(event) {
        const name = event.target.name;
        const value = event.detail.value;
        if (name && value !== undefined) {
            this.formValues[name] = value;
        }
    }

    /**
     * Method Name: showToast
     * @description: Show toast message
     */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }
}
