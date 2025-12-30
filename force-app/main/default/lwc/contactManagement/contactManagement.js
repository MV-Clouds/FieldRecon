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

        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push({
                    number: i,
                    class: i === current ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
            }
        } else {
            pages.push({
                number: 1,
                class: 1 === current ? 'pagination-button active' : 'pagination-button',
                isEllipsis: false
            });

            let startPage = Math.max(2, current - Math.floor(maxVisible / 2));
            let endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);

            if (endPage - startPage < maxVisible - 1) {
                startPage = Math.max(2, endPage - maxVisible + 1);
            }

            if (startPage > 2) {
                pages.push({
                    key: 'ellipsis-start',
                    isEllipsis: true
                });
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push({
                    number: i,
                    class: i === current ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
            }

            if (endPage < totalPages - 1) {
                pages.push({
                    key: 'ellipsis-end',
                    isEllipsis: true
                });
            }

            pages.push({
                number: totalPages,
                class: totalPages === current ? 'pagination-button active' : 'pagination-button',
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
        this.formValues = {};
        this.isEditMode = false;
        this.isPreviewMode = false;
        this.prepareDynamicFields();
        this.showCreateModal = true;
    }

    /**
     * Method Name: handleCloseModal
     * @description: Close create contact modal
     */
    handleCloseModal() {
        this.showCreateModal = false;
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
        
        if (!this.validateForm()) return;

        this.isLoading = true;
        const email = this.formValues['Email'];
        const recordId = this.isEditMode ? this.recordIdToEdit : null;

        try {
            // 1. Check Uniqueness
            const isUnique = await checkEmailUniqueness({ email: email, excludeContactId: recordId });
            
            if (!isUnique) {
                this.showToast('Validation Error', 'This email address is already associated with another contact.', 'error');
                this.isLoading = false;
                return;
            }

            // 2. Prepare Dynamic Payload
            const contactRecord = { ...this.formValues };
            
            // Fix special keys for Apex
            if (contactRecord['RecordType.DeveloperName']) {
                contactRecord['RecordTypeDeveloperName'] = contactRecord['RecordType.DeveloperName'];
                delete contactRecord['RecordType.DeveloperName'];
            }

            // Clean nulls/undefined
            Object.keys(contactRecord).forEach(key => {
                if (contactRecord[key] === undefined || contactRecord[key] === null) delete contactRecord[key];
            });

            await upsertContact({ contactData: contactRecord });
            
            const msg = this.isEditMode ? 'Contact updated successfully' : 'Contact created successfully';
            this.showToast('Success', msg, 'success');
            this.handleCloseModal();
            this.fetchContacts();

        } catch (error) {
            console.error('Save Error', error);
            this.showToast('Error', error.body?.message || 'Failed to save contact', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    validateForm() {
        let isValid = true;
        // Validate all dynamic inputs
        const inputFields = this.template.querySelectorAll('lightning-input, lightning-combobox');
        
        inputFields.forEach(field => {
            if (!field.checkValidity()) {
                field.reportValidity();
                isValid = false;
            }
        });

        // Email Regex Check
        const email = this.formValues['Email'];
        if (email) {
            const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailPattern.test(email)) {
                this.showToast('Validation Error', 'Invalid email format.', 'error');
                isValid = false;
            }
        }
        return isValid;
    }

    /**
     * Method Name: validateForm
     * @description: Validate form fields dynamically and show relevant messages
     */
    validateForm() {
        let isValid = true;
        let errorMessages = [];
        let missingFields = [];

        const inputFields = this.template.querySelectorAll('lightning-input, lightning-combobox');
        inputFields.forEach(field => {
            if (!field.checkValidity()) {
                field.reportValidity();
                isValid = false;
            }
        });

        // Validate First Name
        if (!this.firstName || !this.firstName.trim()) {
            missingFields.push('First Name');
            isValid = false;
        }

        // Validate Last Name
        if (!this.lastName || !this.lastName.trim()) {
            missingFields.push('Last Name');
            isValid = false;
        }

        // Validate Email
        if (!this.email || !this.email.trim()) {
            missingFields.push('Email');
            isValid = false;
        } else {
            const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailPattern.test(this.email.trim())) {
                errorMessages.push('Please enter a valid email address');
                isValid = false;
            } else {
                const disposableDomains = [
                    'yopmail', 'tempmail', 'guerrillamail', 'mailinator',
                    '10minutemail', 'throwaway', 'trashmail', 'fakeinbox'
                ];
                const emailDomain = this.email.split('@')[1]?.toLowerCase();
                if (emailDomain && disposableDomains.some(domain => emailDomain.includes(domain))) {
                    errorMessages.push('Disposable email addresses are not allowed');
                    isValid = false;
                }
            }
        }

        // Validate Record Type
        if (!this.recordType) {
            missingFields.push('Type');
            isValid = false;
        }

        // === Determine Message to Show ===
        if (!isValid) {
            if (missingFields.length === 4) {
                // All fields empty
                this.showToast('Validation Error', 'All fields are required', 'error');
            } else if (missingFields.length > 0 && errorMessages.length === 0) {
                // Some missing fields
                this.showToast(
                    'Validation Error',
                    `${missingFields.join(', ')} ${missingFields.length > 1 ? 'are' : 'is'} required`,
                    'error'
                );
            } else if (errorMessages.length > 0) {
                // Other validation errors
                this.showToast('Validation Error', errorMessages.join(', '), 'error');
            }
        }

        return isValid;
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
        if (!this.configuredMetadata || this.configuredMetadata.length === 0) {
            this.setDefaultConfiguration();
        }

        this.dynamicFields = this.configuredMetadata.map(config => {
            const fieldName = config.fieldName;
            const currentVal = this.formValues[fieldName] !== undefined ? this.formValues[fieldName] : '';
            
            // Preview Mode: Force Disabled
            // Edit/Create Mode: Use config.isEditable setting
            const isDisabled = this.isPreviewMode ? true : !config.isEditable;
            
            // Determine Required Fields
            const isRequired = fieldName === 'LastName' || fieldName === 'Email' || fieldName === 'RecordType.DeveloperName';

            return {
                fieldName: fieldName,
                label: config.label || fieldName,
                value: currentVal,
                isDisabled: isDisabled,
                isRequired: isRequired,
                type: config.fieldType === 'EMAIL' ? 'email' : 'text',
                isCheckbox: config.fieldType === 'BOOLEAN',
                isRecordType: fieldName === 'RecordType.DeveloperName',
                isStandardInput: config.fieldType !== 'BOOLEAN' && fieldName !== 'RecordType.DeveloperName'
            };
        });
    }

    handleDynamicInputChange(event) {
        const name = event.target.name;
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        this.formValues[name] = value;
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