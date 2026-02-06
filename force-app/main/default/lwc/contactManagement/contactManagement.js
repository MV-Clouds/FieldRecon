import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getContacts from '@salesforce/apex/ManagementTabController.getContacts';
import deleteContact from '@salesforce/apex/ManagementTabController.deleteContact';
import getContactFields from '@salesforce/apex/ContactConfigController.getContactFields';
import createUserFromContact from '@salesforce/apex/ManagementTabController.createUserFromContact';

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
    @track recordTypeId = '';
    @track showConfigModal = false;


    // Form fields
    @track firstName = '';
    @track lastName = '';
    @track email = '';
    @track recordType = '';

    // Record type options
    @track recordTypeOptions = [];

    // Confirmation modal properties
    @track showConfirmationModal = false;
    @track confirmationModalTitle = 'Confirm Action';
    @track confirmationModalMessage = 'Are you sure you want to proceed?';
    @track pendingDeleteRecordId = null;
    @track deleteModalMode = 'confirm'; // 'confirm' or 'options'

    // Pagination properties
    @track currentPage = 1;
    @track pageSize = 30;
    @track visiblePages = 5;
    @track shownContactData = [];

    // Contact table columns configuration - will be populated dynamically from metadata
    @track configuredMetadata = [];

    /**
     * Method Name: get contactTableColumns
     * @description: Generate table columns dynamically from metadata with isTableView = true
     */
    get contactTableColumns() {
        try {
            const columns = [];

            // Add Serial Number column
            columns.push({
                label: 'Sr. No.',
                fieldName: 'SerialNumber',
                type: 'text',
                isSerialNumber: true,
                sortable: false,
                headerClass: 'header-cell header-index non-sortable-header'
            });

            // Add Actions column
            columns.push({
                label: 'Actions',
                fieldName: 'Actions',
                type: 'text',
                isActions: true,
                sortable: false,
                headerClass: 'header-cell non-sortable-header'
            });

            // Add fields from metadata where isTableView = true
            if (this.configuredMetadata && this.configuredMetadata.length > 0) {
                this.configuredMetadata.forEach(field => {
                    if (field.isTableView === true) {
                        const isBooleanField = field.fieldType === 'BOOLEAN';
                        const columnType = this.getColumnType(field.fieldType);
                        
                        columns.push({
                            label: field.label || field.fieldName,
                            fieldName: field.fieldName,
                            type: columnType,
                            fieldType: field.fieldType,
                            isCheckboxField: isBooleanField,
                            sortable: true,
                            headerClass: 'header-cell sortable-header'
                        });
                    }
                });
            }

            return columns;
        } catch (error) {
            console.error('Error generating contact table columns:', error);
            return [];
        }
    }

    /**
     * Method Name: getColumnType
     * @description: Get the Lightning data-table column type from field type
     */
    getColumnType(fieldType) {
        switch (fieldType) {
            case 'DATE':
                return 'date';
            case 'DATETIME':
                return 'date';
            case 'BOOLEAN':
                return 'checkbox';
            case 'NUMBER':
            case 'CURRENCY':
                return 'number';
            case 'PERCENT':
                return 'percent';
            case 'EMAIL':
                return 'email';
            case 'URL':
                return 'url';
            case 'PHONE':
                return 'phone';
            default:
                return 'text';
        }
    }

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
                        fieldType: col.fieldType,
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

        if (!fieldValue && fieldValue !== false && fieldValue !== 0) {
            return '';
        }

        // Handle RecordType.DeveloperName specially
        if (column.fieldName === 'RecordType.DeveloperName') {
            if (fieldValue === 'Employee_WF_Recon') return 'Employee';
            if (fieldValue === 'Sub_Contractor_WF_Recon') return 'Sub Contractor';
            return fieldValue || '';
        }

        // Handle DATE fields (YYYY-MM-DD format)
        if (column.fieldType === 'DATE') {
            return this.formatDate(fieldValue);
        }

        // Handle DATETIME fields (ISO 8601 format)
        if (column.fieldType === 'DATETIME') {
            return this.formatDateTime(fieldValue);
        }

        return fieldValue || '';
    }

    /**
     * Method Name: formatDate
     * @description: Format date value to MMM D, YYYY (e.g., Feb 6, 2026)
     */
    formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return dateString;
            }
            
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString;
        }
    }

    /**
     * Method Name: formatDateTime
     * @description: Format datetime value to MMM D, YYYY, HH:MM AM/PM (e.g., Feb 6, 2026, 09:15 AM)
     */
    formatDateTime(dateTimeString) {
        if (!dateTimeString) return '';
        
        try {
            const date = new Date(dateTimeString);
            if (isNaN(date.getTime())) {
                return dateTimeString;
            }
            
            const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
            
            const formattedDate = date.toLocaleDateString('en-US', dateOptions);
            const formattedTime = date.toLocaleTimeString('en-US', timeOptions);
            
            return `${formattedDate}, ${formattedTime}`;
        } catch (error) {
            console.error('Error formatting datetime:', error);
            return dateTimeString;
        }
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
        return this.currentPage === this.totalPages;
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
                if (startPage > 2) {
                    pages.push({
                        number: '...',
                        cssClass: 'pagination-ellipsis',
                        isEllipsis: true
                    });
                }
            }

            // Add visible pages
            for (let i = startPage; i <= endPage; i++) {
                pages.push({
                    number: i,
                    cssClass: i === current ? 'pagination-button active' : 'pagination-button',
                    isEllipsis: false
                });
            }

            // Add last page and ellipsis if needed
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pages.push({
                        number: '...',
                        cssClass: 'pagination-ellipsis',
                        isEllipsis: true
                    });
                }
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
        return this.totalPages > this.visiblePages;
    }

    /**
     * Method Name: get isDataAvailable
     * @description: Check if data is available to display
     */
    get isDataAvailable() {
        return this.filteredContacts.length > 0;
    }

    /**
     * Method Name: get isDeleteWithInactiveMode
     * @description: Check if we should show 3-button mode for delete
     */
    get isDeleteWithInactiveMode() {
        return this.deleteModalMode === 'options';
    }

    /**
     * Method Name: get deleteConfirmLabel
     * @description: Get the delete button label based on mode
     */
    get deleteConfirmLabel() {
        return this.deleteModalMode === 'options' ? 'Only delete contact' : 'Delete';
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
        // this.fetchContacts();
        this.fetchConfiguration();
    }

    /**
  * Method Name: fetchContacts
  * @description: Fetch all contacts from the server and extract record types
  */
    fetchContacts() {
        // this.isLoading = true;

        // Extract fields with isTableView = true from configuration
        const tableViewFields = this.getTableViewFields();

        getContacts({ tableViewFields: tableViewFields })
            .then(result => {
                this.contacts = result || [];
                // Extract unique record types from contacts
                this.extractRecordTypes();

                this.applyFilters();
            })
            .catch(error => {
                console.error('Error fetching contacts:', error);
                this.showToast('Error', 'Failed to load contacts', 'error');
                this.contacts = [];
                this.filteredContacts = [];
            })
            .finally(() => {
                // this.isLoading = true;
                this.isLoading = false;
            });
    }

    /**
     * Method Name: getTableViewFields
     * @description: Extract field names that have isTableView = true from configuration
     */
    getTableViewFields() {
        const fields = [];
        
        if (this.configuredMetadata && this.configuredMetadata.length > 0) {
            this.configuredMetadata.forEach(field => {
                if (field.isTableView === true) {
                    fields.push(field.fieldName);
                }
            });
        }
        
        return fields;
    }

    /**
     * Method Name: extractRecordTypes
     * @description: Extract unique record types from contacts and populate options
     */
    extractRecordTypes() {
        const recordTypesMap = new Map();

        // Extract all record types from contacts
        this.contacts.forEach(contact => {
            const recordTypeDevName = this.getFieldValue(contact, 'RecordType.DeveloperName');
            const recordTypeId = this.getFieldValue(contact, 'RecordTypeId');

            if (recordTypeDevName && recordTypeId) {
                if (!recordTypesMap.has(recordTypeDevName)) {
                    // Determine label based on DeveloperName
                    let label = '';
                    if (recordTypeDevName === 'Employee_WF_Recon') {
                        label = 'Employee';
                    } else if (recordTypeDevName === 'Sub_Contractor_WF_Recon') {
                        label = 'Sub Contractor';
                    } else {
                        // Fallback: use the DeveloperName without suffix
                        label = recordTypeDevName.replace('_WF_Recon', '').replace(/_/g, ' ');
                    }

                    recordTypesMap.set(recordTypeDevName, {
                        label: label,
                        value: recordTypeId, // Store the ID, not DeveloperName
                        developerName: recordTypeDevName
                    });
                }
            }
        });

        // Convert Map to array and sort alphabetically by label
        this.recordTypeOptions = Array.from(recordTypesMap.values())
            .sort((a, b) => a.label.localeCompare(b.label));
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
            'RecordTypeId': ''
        };
        this.isEditMode = false;
        this.recordTypeId = '';
        this.isPreviewMode = false;
        this.recordIdToEdit = null;
        this.prepareDynamicFields();
        this.showCreateModal = true;
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
        } else if (fieldName === 'RecordTypeId') {
            this.recordType = event.target.value;
        } 
    }

    /**
 * Method Name: handleSave
 * @description: Handle save button click using lightning-record-edit-form
 */
    handleSave(event) {
        event.preventDefault();
        event.stopPropagation();

        // Validate custom required fields
        const isValid = this.validateCustomRequiredFields();
        if (!isValid) {
            return;
        }

        // Get the record edit form
        const recordEditForm = this.template.querySelector('lightning-record-edit-form');
        // Submit the form - this will trigger validation and standard save
        if (recordEditForm) {
            // Optional: You can do pre-save validation here if needed
            recordEditForm.submit();
        }
    }

    /**
     * Method Name: validateCustomRequiredFields
     * @description: Validate custom required fields from metadata
     */
    validateCustomRequiredFields() {
        let isValid = true;
        const missingFields = [];

        if (this.dynamicFields && this.dynamicFields.length > 0) {
            this.dynamicFields.forEach(field => {
                // Skip disabled fields and the record type field (handled separately)
                if (field.isDisabled) {
                    return;
                }

                // For record type field, check recordTypeId
                if (field.isRecordType) {
                    if (!this.recordTypeId) {
                        isValid = false;
                        missingFields.push(field.label);
                    }
                    return;
                }

                // For other required fields, check formValues
                if (field.isRequired) {
                    const fieldValue = this.formValues[field.fieldName];
                    
                    // Check if field is empty
                    if (fieldValue === null || fieldValue === undefined || 
                        fieldValue === '' || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
                        isValid = false;
                        missingFields.push(field.label);
                    }
                }
            });
        }

        if (!isValid) {
            const fieldsList = missingFields.length > 0 ? ': ' + missingFields.join(', ') : '';
            this.showToast('Error', `Please fill all required fields${fieldsList}`, 'error');
        }

        return isValid;
    }

    /**
 * Method Name: handleSuccess
 * @description: Handle successful save from lightning-record-edit-form
 */
handleSuccess(event) {
    const contactId = event.detail.id;
    const msg = this.isEditMode ? 'Contact and User updated successfully' : 'Contact and User created successfully';

    createUserFromContact({ contactId: contactId })
        .then(result => {
            console.log('result', result);
            
            if (result.success) {
                // Success case - user was created
                this.showToast('Success', msg, 'success');
                console.log('User created with ID:', result.userId);
            } else {
                // Error case from Apex                
                // Check if it's a license limit error
                if (result.message && result.message.includes('LICENSE_LIMIT_EXCEEDED')) {
                    this.showToast('Error', 'Cannot create user: No available licenses as limit exceeded.', 'error');
                    // deleteContact({ contactId: contactId });
                    this.deleteContactRecord(contactId,false);
                } else if (result.message && !result.message.includes('LICENSE_LIMIT_EXCEEDED')) {
                    // For other errors, delete the contact
                    this.showToast('Error', 'User creation failed: ' + result.message, 'error');
                    // deleteContact({ contactId: contactId });
                    this.deleteContactRecord(contactId,false);
                }
            }
        })
        .catch(error => {            
            // deleteContact({ contactId: contactId });
            this.deleteContactRecord(contactId,false);
        })
        .finally(() => {
            this.isLoading = false;
            this.handleCloseModal();
            this.fetchContacts();
        });
}

    /**
     * Method Name: handleError
     * @description: Handle error from lightning-record-edit-form
     */
    handleError(event) {
        this.isLoading = true;

        // Extract error message
        const error = event.detail;
        console.error('Save Error', error);

        let errorMessage = 'Error saving contact';
        if (error.detail) {
            if (error?.detail && error.detail.toLowerCase().includes('required')) {
                errorMessage = 'Please fill all required fields.';
            }
            if (error?.detail && error.detail.toLowerCase().includes('duplicate')) {
                errorMessage = 'Contact with this email already exists.';
            }
        } else if (error.message) {
            errorMessage = error.detail;
        }

        this.showToast('Error', errorMessage, 'error');
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

            // Get the RecordTypeId from the contact
            const contactRecordTypeId = this.getFieldValue(contact, 'RecordTypeId');

            // Set the recordTypeId property for the form
            if (contactRecordTypeId) {
                this.recordTypeId = contactRecordTypeId;
            }

            // Populate formValues from Config
            this.formValues = {};
            this.configuredMetadata.forEach(field => {
                this.formValues[field.fieldName] = this.getFieldValue(contact, field.fieldName);
            });

            // Store RecordTypeId for proper mapping
            this.formValues['RecordTypeId'] = contactRecordTypeId;
            this.formValues['RecordType.DeveloperName'] = this.getFieldValue(contact, 'RecordType.DeveloperName');
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
        this.confirmationModalMessage = 'Are you sure you want to delete this contact?';
        this.showConfirmationModal = true;
        this.deleteModalMode = 'options'; // Set modal to show 3 button options
    }

    /**
     * Method Name: handleConfirmationModalConfirm
     * @description: Handle confirmation modal confirm action
     */
    handleConfirmationModalConfirm(event) {
        this.showConfirmationModal = false;
        if (this.pendingDeleteRecordId) {
            // Default delete - just delete the contact
            this.deleteContactRecord(this.pendingDeleteRecordId);
            this.pendingDeleteRecordId = null;
        }
        this.deleteModalMode = 'confirm'; // Reset mode
    }

    /**
     * Method Name: handleConfirmationModalCancel
     * @description: Handle confirmation modal cancel action
     */
    handleConfirmationModalCancel() {
        this.showConfirmationModal = false;
        this.pendingDeleteRecordId = null;
        this.deleteModalMode = 'confirm'; // Reset mode
    }

    /**
     * Method Name: handleDeleteWithInactiveUser
     * @description: Handle delete contact and set user to inactive
     */
    handleDeleteWithInactiveUser() {
        this.showConfirmationModal = false;
        if (this.pendingDeleteRecordId) {
            this.deleteContactRecord(this.pendingDeleteRecordId,true);
            this.pendingDeleteRecordId = null;
        }
        this.deleteModalMode = 'confirm'; // Reset mode
    }

    /**
     * Method Name: handleOnlyDeleteContact
     * @description: Handle delete contact only (no user deactivation)
     */
    handleOnlyDeleteContact() {
        this.showConfirmationModal = false;
        if (this.pendingDeleteRecordId) {
            this.deleteContactRecord(this.pendingDeleteRecordId,false);
            this.pendingDeleteRecordId = null;
        }
        this.deleteModalMode = 'confirm'; // Reset mode
    }

    /**
     * Method Name: deleteContactRecord
     * @description: Delete contact record via Apex
     */
    deleteContactRecord(recordId, deactivateUser = true, showToastMessage = true) {
        this.isLoading = true;

        deleteContact({ 
            contactId: recordId, 
            deactivateUser: deactivateUser 
        })
        .then(result => {
            if (result === 'Success') {
                if (showToastMessage) {
                    const message = deactivateUser 
                        ? 'Contact deleted and user deactivated successfully' 
                        : 'Contact deleted successfully';
                    this.showToast('Success', message, 'success');
                }
                this.fetchContacts();
            } else {
                if (showToastMessage) {
                    this.showToast('Error', result, 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error deleting contact:', error);
            if (showToastMessage) {
                this.showToast(
                    'Error',
                    error.body?.message || 'Failed to delete contact',
                    'error'
                );
            }
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
                console.log('Config result', result);
                
                if (result && result.metadataRecords && result.metadataRecords.length > 0) {
                    try {
                        this.configuredMetadata = JSON.parse(result.metadataRecords[0]);
                    } catch (e) {
                        this.setDefaultConfiguration();
                    }
                } else {
                    this.setDefaultConfiguration();
                }
                this.fetchContacts();
            })
            .catch(error => {
                console.error('Error fetching config', error);
                this.setDefaultConfiguration();
                this.isLoading = false;
            });
    }

    setDefaultConfiguration() {
        this.configuredMetadata = [
            { fieldName: 'RecordType.DeveloperName', label: 'Type', isEditable: true, fieldType: 'PICKLIST', isRequired: true, isTableView: true },
            { fieldName: 'FirstName', label: 'First Name', isEditable: true, fieldType: 'STRING', isRequired: true, isTableView: true },
            { fieldName: 'LastName', label: 'Last Name', isEditable: true, fieldType: 'STRING', isRequired: true, isTableView: true },
            { fieldName: 'Email', label: 'Email', isEditable: true, fieldType: 'EMAIL', isRequired: true, isTableView: true },
        ];
    }

    // --- Configuration Modal Handlers ---
    handleOpenConfig() {

        this.showConfigModal = true;
        console.log('Open config modal');
        
    }

    handleConfigUpdated(event) {
        this.showConfigModal = false;
        if (event.detail && event.detail.success) {
            console.log('Success', 'Configuration updated successfully', 'success');
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
        const otherFields = metadata.filter(f =>
            f.fieldName !== 'RecordType.DeveloperName' &&
            f.fieldName !== 'RecordTypeId'
        );

        // 3. Get the current record type value
        let recordTypeVal = '';
        if (this.isEditMode && this.formValues['RecordTypeId']) {
            recordTypeVal = this.formValues['RecordTypeId'];
        } else if (this.recordTypeId) {
            recordTypeVal = this.recordTypeId;
        }

        // 4. Create the Record Type Field Object (Always First)
        const recordTypeField = {
            fieldName: 'RecordTypeId',
            label: 'Type',
            value: recordTypeVal,
            isDisabled: this.isPreviewMode,
            isRequired: true,
            isRecordType: true,
            isCheckbox: false,
            isStandardInput: false,
            options: this.recordTypeOptions
        };

        // 5. Map the rest of the fields
        const dynamicOtherFields = otherFields.map(config => {
            const fieldName = config.fieldName;

            // Set value from formValues
            let currentVal = this.formValues[fieldName] !== undefined ? this.formValues[fieldName] : null;

            const isDisabled = this.isPreviewMode ? true : !config.isEditable;
            const isRequired = config.isRequired === true;

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

        // Always show Record Type field
        this.dynamicFields = [recordTypeField, ...dynamicOtherFields];
    }

    /**
     * Method Name: handleCustomInputChange
     * @description: Handle custom input changes from both lightning-combobox and lightning-input-field
     */
    handleCustomInputChange(event) {
        const target = event.target;
        let fieldName = target.name || target.fieldName;
        let value = event.detail.value;

        if (fieldName && value !== undefined) {
            this.formValues[fieldName] = value;

            // If this is the RecordTypeId field, update the tracked property
            if (fieldName === 'RecordTypeId') {
                this.recordTypeId = value;
            }
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