import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getCrewMembers from '@salesforce/apex/ManagementTabController.getCrewMembers';
import getCrewContacts from '@salesforce/apex/ManagementTabController.getCrewContacts';
import saveCrew from '@salesforce/apex/ManagementTabController.saveCrew';
import deleteCrew from '@salesforce/apex/ManagementTabController.deleteCrew';

export default class CrewManagement extends NavigationMixin(LightningElement) {
    @track isLoading = true;
    @track crewList = [];
    @track filteredCrewList = [];
    @track shownCrewData = [];
    @track searchTerm = '';
    @track sortField = 'Name';
    @track sortOrder = 'asc';
    @track showCreateModal = false;
    @track isEditMode = false;
    @track recordIdToEdit = null;
    @track showConfirmationModal = false;
    @track confirmationModalTitle = 'Confirm Action';
    @track confirmationModalMessage = 'Are you sure you want to proceed?';
    @track pendingDeleteRecordId = null;
    @track currentPage = 1;
    @track pageSize = 30;
    @track visiblePages = 5;
    @track crewData = this.getDefaultCrewData();
    @track crewTableColumns = [
        { label: 'Sr. No.', fieldName: 'SerialNumber', type: 'text', isSerialNumber: true, sortable: false },
        { label: 'Actions', fieldName: 'Actions', type: 'text', isActions: true, sortable: false },
        { label: 'Crew Name', fieldName: 'Name', type: 'text', isNameField: true, sortable: true },
        { label: 'Description', fieldName: 'wfrecon__Description__c', type: 'text', sortable: true },
        { label: 'Crew Members', fieldName: 'wfrecon__Crew_Member_Count__c', type: 'number', sortable: true },
        { label: 'Color Code', fieldName: 'wfrecon__Color_Code__c', type: 'text', sortable: true }
    ];
    @track availableCrewContacts = [];
    @track filteredCrewContacts = [];
    @track selectedCrewMembers = [];
    @track memberSearchTerm = '';
    @track confirmationConfirmLabel = 'Delete';
    @track confirmationCancelLabel = 'Cancel';
    @track confirmationConfirmVariant = 'destructive';
    @track confirmationIcon = 'utility:warning';
    @track confirmationIconVariant = 'warning';

    confirmationContext = null;
    pendingSavePayload = null;
    pendingConflictMembers = [];
    hasAcknowledgedConflicts = false;

    /**
     * Method Name: get displayedCrews
     * @description: Crew records prepared for table display
     */
    get displayedCrews() {
        if (!this.shownCrewData || this.shownCrewData.length === 0) {
            return [];
        }
        return this.shownCrewData.map((crewRecord, index) => {
            const row = { ...crewRecord };
            row.recordUrl = `/lightning/r/${crewRecord.Id}/view`;

            const serialNumber = (this.currentPage - 1) * this.pageSize + index + 1;

            row.displayFields = this.crewTableColumns.map(col => {
                const key = col.fieldName;
                let value;

                if (col.isSerialNumber) {
                    value = serialNumber;
                } else {
                    value = this.getFieldValue(crewRecord, key);
                }

                return {
                    key: `${crewRecord.Id}_${key}`,
                    value,
                    hasValue: value !== null && value !== undefined && value !== '',
                    isNameField: col.isNameField || false,
                    isSerialNumber: col.isSerialNumber || false,
                    isActions: col.isActions || false,
                    isNumber: col.type === 'number',
                    numberValue: col.type === 'number' ? parseFloat(value) || 0 : null,
                    recordUrl: row.recordUrl
                };
            });

            return row;
        });
    }

    get totalItems() {
        return this.filteredCrewList ? this.filteredCrewList.length : 0;
    }

    get totalPages() {
        return Math.ceil(this.totalItems / this.pageSize);
    }

    get isFirstPage() {
        return this.currentPage === 1;
    }

    get isLastPage() {
        return this.currentPage === this.totalPages;
    }

    get pageNumbers() {
        const pages = [];
        const totalPages = this.totalPages;

        if (totalPages <= this.visiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push({
                    number: i,
                    isActive: i === this.currentPage,
                    isEllipsis: false,
                    cssClass: i === this.currentPage ? 'pagination-button active' : 'pagination-button'
                });
            }
        } else {
            const startPage = Math.max(1, this.currentPage - Math.floor(this.visiblePages / 2));
            const endPage = Math.min(totalPages, startPage + this.visiblePages - 1);

            if (startPage > 1) {
                pages.push({
                    number: 1,
                    isActive: false,
                    isEllipsis: false,
                    cssClass: 'pagination-button'
                });

                if (startPage > 2) {
                    pages.push({
                        number: '...',
                        isActive: false,
                        isEllipsis: true,
                        cssClass: ''
                    });
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push({
                    number: i,
                    isActive: i === this.currentPage,
                    isEllipsis: false,
                    cssClass: i === this.currentPage ? 'pagination-button active' : 'pagination-button'
                });
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pages.push({
                        number: '...',
                        isActive: false,
                        isEllipsis: true,
                        cssClass: ''
                    });
                }

                pages.push({
                    number: totalPages,
                    isActive: false,
                    isEllipsis: false,
                    cssClass: 'pagination-button'
                });
            }
        }

        return pages;
    }

    get isDataAvailable() {
        return this.shownCrewData && this.shownCrewData.length > 0;
    }

    get modalTitle() {
        return this.isEditMode ? 'Edit Crew' : 'Create New Crew';
    }

    get saveButtonLabel() {
        return this.isEditMode ? 'Update' : 'Save';
    }

    connectedCallback() {
        this.fetchCrewMembers();
    }

    /**
     * Method Name: fetchCrewMembers
     * @description: Fetch all crew records
     */
    fetchCrewMembers() {
        try {
            this.isLoading = true;
    
            getCrewMembers()
                .then(result => {
                    this.crewList = result || [];
                    this.applyFilters();
                    setTimeout(() => {
                        this.updateSortIcons();
                    }, 100);
                })
                .catch(error => {
                    console.error('Error fetching crews:', error);
                    this.showToast('Error', 'Failed to load crews', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in fetchCrewMembers:', error);
            this.showToast('Error', 'Failed to load crews', 'error');
            this.isLoading = false;
        }
    }

    /**
     * Method Name: getFieldValue
     * @description: Get field value from record, supporting nested fields
     */
    getFieldValue(record, fieldName) {
        try {
            if (!record || !fieldName) {
                return null;
            }
    
            if (record.hasOwnProperty(fieldName)) {
                return record[fieldName];
            }
    
            if (fieldName.includes('.')) {
                const parts = fieldName.split('.');
                let value = record;
                for (const part of parts) {
                    if (value && value.hasOwnProperty(part)) {
                        value = value[part];
                    } else {
                        return null;
                    }
                }
                return value;
            }
    
            // Attempt to strip namespace prefix if present in config
            if (fieldName.includes('__') && fieldName.startsWith('wfrecon__')) {
                const withoutNamespace = fieldName.replace('wfrecon__', '');
                if (record.hasOwnProperty(withoutNamespace)) {
                    return record[withoutNamespace];
                }
            }
    
            return null;
        } catch (error) {
            console.error('Error getting field value:', error);
            return null;
        }
    }

    /**
     * Method Name: applyFilters
     * @description: Apply search filters and sorting
     */
    applyFilters() {
        try {
            let filtered = [...this.crewList];

            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                filtered = filtered.filter(crewRecord => {
                    const crewName = this.getFieldValue(crewRecord, 'Name');
                    if (!crewName) {
                        return false;
                    }
                    return String(crewName).toLowerCase().includes(searchLower);
                });
            }

            this.filteredCrewList = filtered;
            this.sortData();
            this.updateShownData();
        } catch (error) {
            console.error('Error applying crew filters:', error);
        }
    }

    /**
     * Method Name: handleSearch
     * @description: Handle search input change
     */
    handleSearch(event) {
        try {
            this.searchTerm = event.target.value;
            this.currentPage = 1;
            this.applyFilters();
        } catch (error) {
            console.error('Error in handleSearch:', error);
        }
    }

    /**
     * Method Name: handleCreateNew
     * @description: Open create crew modal
     */
    handleCreateNew() {
        this.isEditMode = false;
        this.recordIdToEdit = null;
        this.crewData = this.getDefaultCrewData();
        this.resetCrewMemberSelection();
        this.showCreateModal = true;
        this.loadCrewContacts(null);
    }

    /**
     * Method Name: handleCloseModal
     * @description: Close modal and reset state
     */
    handleCloseModal() {
        this.showCreateModal = false;
        this.isLoading = false;
        this.isEditMode = false;
        this.recordIdToEdit = null;
        this.crewData = this.getDefaultCrewData();
        this.resetCrewMemberSelection();
        this.showConfirmationModal = false;
        this.confirmationContext = null;
        this.confirmationConfirmLabel = 'Delete';
        this.confirmationConfirmVariant = 'destructive';
        this.confirmationCancelLabel = 'Cancel';
        this.confirmationIcon = 'utility:warning';
        this.confirmationIconVariant = 'warning';
    }

    /**
     * Method Name: handleInputChange
     * @description: Handle input change for create crew modal
     */
    handleInputChange(event) {
        try {
            const field = event.target.dataset.field;
            if (!field) {
                return;
            }
    
            let value = event.target.value;
    
            if (field === 'Color_Code__c') {
                value = this.normalizeColorCode(value);
                event.target.value = value;
            }
    
            this.crewData = {
                ...this.crewData,
                [field]: value
            };
        } catch (error) {
            console.error('Error in handleInputChange:', error);
        }
    }

    /**
     * Method Name: handleSaveCrew
     * @description: Save crew record via Apex
     */
    handleSaveCrew() {
        try {
            const inputs = this.template.querySelectorAll('lightning-input[data-field]');
            let allValid = true;

            inputs.forEach(input => {
                if (!input.reportValidity()) {
                    allValid = false;
                }
            });

            if (!allValid) {
                return;
            }

            const payload = {
                ...this.crewData
            };

            if (this.recordIdToEdit) {
                payload.Id = this.recordIdToEdit;
            } else if (payload.Id) {
                delete payload.Id;
            }

            payload.Name = (payload.Name || '').trim();
            payload.Description__c = payload.Description__c ? payload.Description__c.trim() : '';
            payload.Color_Code__c = this.normalizeColorCode(payload.Color_Code__c);
            payload.memberIds = Array.from(new Set(this.getSelectedMemberIds()));

            if (!payload.Name) {
                this.showToast('Error', 'Crew name is required', 'error');
                return;
            }

            const conflictingMembers = this.getConflictingSelectedMembers();

            if (conflictingMembers.length > 0 && !this.hasAcknowledgedConflicts) {
                this.pendingSavePayload = { ...payload };
                this.pendingConflictMembers = conflictingMembers.map(member => ({
                    contactId: member.id,
                    contactName: member.name,
                    assignedCrewNames: member.assignedCrewNames,
                    crewNameSummary: member.assignedCrewNames
                }));
                this.showConflictConfirmation(null, this.pendingConflictMembers);
                return;
            }

            this.pendingSavePayload = null;
            this.pendingConflictMembers = [];
            this.executeCrewSave(payload);
        } catch (error) {
            console.error('Error in handleSaveCrew :: ', error);
            this.showToast('Error', 'Failed to save crew', 'error');
        }
    }

    /**
     * Method Name: handleSortClick
     * @description: Handle sorting for columns
     */
    handleSortClick(event) {
        const clickedField = event.currentTarget.dataset.sortField;

        if (this.sortField === clickedField) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = clickedField;
            this.sortOrder = 'asc';
        }

        this.currentPage = 1;
        this.sortData();
        this.updateSortIcons();
    }

    /**
     * Method Name: sortData
     * @description: Sort crew data based on active column
     */
    sortData() {
        try {
            if (!this.sortField || !this.filteredCrewList) {
                return;
            }

            this.filteredCrewList.sort((a, b) => {
                let aVal = this.getFieldValue(a, this.sortField);
                let bVal = this.getFieldValue(b, this.sortField);

                if (aVal === null || aVal === undefined) {
                    aVal = '';
                }

                if (bVal === null || bVal === undefined) {
                    bVal = '';
                }

                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();

                let result = 0;
                if (aVal < bVal) {
                    result = -1;
                } else if (aVal > bVal) {
                    result = 1;
                }

                return this.sortOrder === 'desc' ? -result : result;
            });

            this.updateShownData();
        } catch (error) {
            console.error('Error sorting crew data:', error);
        }
    }

    /**
     * Method Name: updateSortIcons
     * @description: Update sort icon state classes
     */
    updateSortIcons() {
        try {
            setTimeout(() => {
                const headers = this.template.querySelectorAll('.crew-sortable-header');
                headers.forEach(header => {
                    const fieldName = header.dataset.sortField;
                    const icon = header.querySelector('.crew-sort-icon svg');

                    if (fieldName === this.sortField) {
                        header.classList.add('active-sort');
                        if (icon) {
                            icon.classList.remove('rotate-asc', 'rotate-desc');
                            icon.classList.add(this.sortOrder === 'asc' ? 'rotate-asc' : 'rotate-desc');
                        }
                    } else {
                        header.classList.remove('active-sort');
                        if (icon) {
                            icon.classList.remove('rotate-asc', 'rotate-desc');
                        }
                    }
                });
            }, 0);
        } catch (error) {
            console.error('Error updating crew sort icons:', error);
        }
    }

    /**
     * Method Name: handleNavigateToRecord
     * @description: Open crew record in new tab
     */
    handleNavigateToRecord(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordId;

        this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: {
                recordId,
                actionName: 'view'
            }
        }).then(url => {
            window.open(url, '_blank');
        });
    }

    /**
     * Method Name: handleEditCrew
     * @description: Open modal in edit mode
     */
    handleEditCrew(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordId;
        this.isEditMode = true;
        this.recordIdToEdit = recordId;
        const crewRecord = this.crewList.find(record => record.Id === recordId);
        if (crewRecord) {
            this.crewData = {
                Id: crewRecord.Id,
                Name: this.getFieldValue(crewRecord, 'Name') || '',
                Description__c: this.getFieldValue(crewRecord, 'wfrecon__Description__c') || '',
                Color_Code__c: this.normalizeColorCode(this.getFieldValue(crewRecord, 'wfrecon__Color_Code__c') || '#FFFFFF')
            };
        } else {
            this.crewData = {
                ...this.getDefaultCrewData(),
                Id: recordId
            };
        }
        this.resetCrewMemberSelection();
        this.showCreateModal = true;
        this.loadCrewContacts(recordId);
    }

    /**
     * Method Name: getDefaultCrewData
     * @description: Get default crew data structure
     */
    getDefaultCrewData() {
        return {
            Id: null,
            Name: '',
            Description__c: '',
            Color_Code__c: '#FFFFFF'
        };
    }

    /**
     * Method Name: normalizeColorCode
     * @description: Ensure color code is in proper format
     */
    normalizeColorCode(colorValue) {
        try {
            if (!colorValue) {
                return '#FFFFFF';
            }
    
            let normalizedColor = colorValue.trim();
    
            if (!normalizedColor.startsWith('#')) {
                normalizedColor = `#${normalizedColor}`;
            }
    
            if (normalizedColor.length === 1) {
                normalizedColor = '#FFFFFF';
            }
    
            return normalizedColor;
        } catch (error) {
            console.error('Error normalizing color code:', error);
            return '#FFFFFF';
        }
    }

    resetCrewMemberSelection() {
        this.availableCrewContacts = [];
        this.filteredCrewContacts = [];
        this.selectedCrewMembers = [];
        this.memberSearchTerm = '';
        this.pendingSavePayload = null;
        this.pendingConflictMembers = [];
        this.hasAcknowledgedConflicts = false;
    }

    loadCrewContacts(crewId) {
        this.isLoading = true;

        getCrewContacts({ crewId })
            .then(result => {
                const assignedDtos = (result && result.assignedContacts) ? result.assignedContacts : [];
                const availableDtos = (result && result.availableContacts) ? result.availableContacts : [];

                this.selectedCrewMembers = assignedDtos.map(dto => this.transformCrewContact(dto)).sort((a, b) => a.name.localeCompare(b.name));
                this.availableCrewContacts = availableDtos.map(dto => this.transformCrewContact(dto));
                this.sortAvailableCrewContacts();
            })
            .catch(error => {
                console.error('Error fetching crew contacts:', error);
                this.showToast('Error', 'Failed to load crew members', 'error');
            })
            .finally(() => {
                this.applyCrewMemberSearch();
                this.isLoading = false;
            });
    }

    transformCrewContact(contactDto) {
        const memberships = contactDto && contactDto.memberships ? contactDto.memberships : [];
        const membershipCrewIds = memberships.map(m => m.crewId).filter(id => !!id);
        const membershipCrewNames = memberships
            .map(m => m.crewName)
            .filter(name => !!name);

        return {
            id: contactDto.id,
            name: contactDto.name,
            assignedCrewNames: contactDto.assignedCrewNames || (membershipCrewNames.length ? membershipCrewNames.join(', ') : null),
            membershipCrewIds,
            membershipCrewNames,
            isAssignedElsewhere: Boolean(contactDto.isAssignedElsewhere),
            primaryCrewColor: contactDto.primaryCrewColor ? this.normalizeColorCode(contactDto.primaryCrewColor) : null,
            availableFlag: contactDto.isAssignedElsewhere ? 'false' : 'true',
            removeAriaLabel: contactDto.name ? `Remove ${contactDto.name}` : 'Remove crew member'
        };
    }

    sortAvailableCrewContacts() {
        const sorted = [...this.availableCrewContacts].sort((a, b) => {
            if (a.isAssignedElsewhere === b.isAssignedElsewhere) {
                return a.name.localeCompare(b.name);
            }
            return a.isAssignedElsewhere ? 1 : -1;
        });
        this.availableCrewContacts = sorted;
    }

    applyCrewMemberSearch() {
        const searchValue = (this.memberSearchTerm || '').trim().toLowerCase();
        if (!searchValue) {
            this.filteredCrewContacts = [...this.availableCrewContacts];
            return;
        }

        this.filteredCrewContacts = this.availableCrewContacts.filter(contact => {
            const name = contact.name ? contact.name.toLowerCase() : '';
            const assigned = contact.assignedCrewNames ? contact.assignedCrewNames.toLowerCase() : '';
            return name.includes(searchValue) || assigned.includes(searchValue);
        });
    }

    handleCrewMemberSearchChange(event) {
        this.memberSearchTerm = event.target.value || '';
        this.applyCrewMemberSearch();
    }

    handleCrewMemberSelect(event) {
        const contactId = event.target.dataset.id;
        if (!contactId) {
            return;
        }

        const contactIndex = this.availableCrewContacts.findIndex(contact => contact.id === contactId);
        if (contactIndex === -1) {
            return;
        }

        const [selectedContact] = this.availableCrewContacts.splice(contactIndex, 1);
        this.availableCrewContacts = [...this.availableCrewContacts];
        this.selectedCrewMembers = [...this.selectedCrewMembers, selectedContact].sort((a, b) => a.name.localeCompare(b.name));

        if (selectedContact.isAssignedElsewhere) {
            this.hasAcknowledgedConflicts = false;
        }

        this.applyCrewMemberSearch();
    }

    handleRemoveCrewMemberKeydown(event) {
        const { key } = event;
        if (key === 'Enter' || key === ' ') {
            event.preventDefault();
            this.handleRemoveCrewMember(event);
        }
    }

    handleRemoveCrewMember(event) {
        const contactId = event.currentTarget.dataset.id;
        if (!contactId) {
            return;
        }

        const memberIndex = this.selectedCrewMembers.findIndex(member => member.id === contactId);
        if (memberIndex === -1) {
            return;
        }

        const [removedMember] = this.selectedCrewMembers.splice(memberIndex, 1);
        this.selectedCrewMembers = [...this.selectedCrewMembers];
        this.availableCrewContacts = [...this.availableCrewContacts, removedMember];
        this.sortAvailableCrewContacts();
        this.applyCrewMemberSearch();
    }

    getSelectedMemberIds() {
        return this.selectedCrewMembers.map(member => member.id);
    }

    getConflictingSelectedMembers() {
        const currentCrewId = this.recordIdToEdit;
        return this.selectedCrewMembers.filter(member => {
            if (!member.isAssignedElsewhere) {
                return false;
            }

            if (!currentCrewId) {
                return true;
            }

            const membershipCrewIds = member.membershipCrewIds || [];
            return membershipCrewIds.some(id => id !== currentCrewId);
        });
    }

    showConflictConfirmation(message, conflicts) {
        const conflictEntries = conflicts || [];
        const detailedNames = conflictEntries
            .map(conflict => {
                const contactName = conflict.contactName || conflict.name;
                const crewNames = conflict.crewNameSummary || conflict.assignedCrewNames;
                return crewNames ? `${contactName} (${crewNames})` : contactName;
            })
            .filter(detail => !!detail);

        this.confirmationContext = 'CONFLICT';
        this.confirmationModalTitle = 'Assign members already in another crew?';
        this.confirmationModalMessage = message && message.trim().length
            ? message
            : `The following crew members are already assigned to another crew: ${detailedNames.join(', ')}. Do you want to add them here as well?`;
        this.confirmationConfirmLabel = 'Add Members';
        this.confirmationConfirmVariant = 'brand';
        this.confirmationCancelLabel = 'Cancel';
        this.confirmationIcon = 'utility:help';
        this.confirmationIconVariant = 'info';
        this.showConfirmationModal = true;
    }

    executeCrewSave(payload) {
        const apexPayload = { ...payload, bypassConflictCheck: this.hasAcknowledgedConflicts };
        this.isLoading = true;

        saveCrew({ crewData: apexPayload })
            .then(response => {
                if (response && response.status === 'SUCCESS') {
                    this.showToast('Success', `Crew ${this.isEditMode ? 'updated' : 'created'} successfully`, 'success');
                    this.handleCloseModal();
                    this.fetchCrewMembers();
                } else if (response && response.status === 'CONFLICT') {
                    this.hasAcknowledgedConflicts = false;
                    this.pendingSavePayload = { ...payload };
                    this.pendingConflictMembers = response.conflicts || [];
                    this.showConflictConfirmation(response.message, this.pendingConflictMembers);
                } else {
                    const message = response && response.message ? response.message : 'Failed to save crew';
                    this.showToast('Error', message, 'error');
                }
            })
            .catch(error => {
                console.error('Error saving crew:', error);
                const message = error && error.body && error.body.message ? error.body.message : 'Failed to save crew';
                this.showToast('Error', message, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    /**
     * Method Name: handleDeleteCrew
     * @description: Show confirmation modal before delete
     */
    handleDeleteCrew(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.recordId;

        this.pendingDeleteRecordId = recordId;
        this.confirmationContext = 'DELETE';
        this.confirmationModalTitle = 'Delete Crew';
        this.confirmationModalMessage = 'Are you sure you want to delete this crew? This action cannot be undone.';
        this.confirmationConfirmLabel = 'Delete';
        this.confirmationConfirmVariant = 'destructive';
        this.confirmationCancelLabel = 'Cancel';
        this.confirmationIcon = 'utility:warning';
        this.confirmationIconVariant = 'warning';
        this.showConfirmationModal = true;
    }

    /**
     * Method Name: handleConfirmationModalConfirm
     * @description: Execute deletion after confirmation
     */
    handleConfirmationModalConfirm() {
        this.showConfirmationModal = false;

        if (this.confirmationContext === 'DELETE') {
            if (this.pendingDeleteRecordId) {
                this.deleteCrewRecord(this.pendingDeleteRecordId);
                this.pendingDeleteRecordId = null;
            }
        } else if (this.confirmationContext === 'CONFLICT') {
            this.hasAcknowledgedConflicts = true;
            const payload = this.pendingSavePayload ? { ...this.pendingSavePayload } : null;
            this.pendingSavePayload = null;
            this.pendingConflictMembers = [];
            if (payload) {
                this.executeCrewSave(payload);
            }
        }

        this.confirmationContext = null;
    }

    /**
     * Method Name: handleConfirmationModalCancel
     * @description: Close confirmation modal without deleting
     */
    handleConfirmationModalCancel() {
        this.showConfirmationModal = false;
        if (this.confirmationContext === 'DELETE') {
            this.pendingDeleteRecordId = null;
        } else if (this.confirmationContext === 'CONFLICT') {
            this.pendingSavePayload = null;
            this.pendingConflictMembers = [];
        }
        this.confirmationContext = null;
    }

    /**
     * Method Name: deleteCrewRecord
     * @description: Delete crew via Apex
     */
    deleteCrewRecord(recordId) {
        try {
            this.isLoading = true;
    
            deleteCrew({ crewId: recordId })
                .then(result => {
                    if (result === 'Success') {
                        this.showToast('Success', 'Crew deleted successfully', 'success');
                        this.fetchCrewMembers();
                    } else {
                        this.showToast('Error', result, 'error');
                    }
                })
                .catch(error => {
                    console.error('Error deleting crew:', error);
                    this.showToast('Error', 'Failed to delete crew', 'error');
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in deleteCrewRecord:', error);
            this.showToast('Error', 'Failed to delete crew', 'error');
            this.isLoading = false;
        }
    }

    /**
     * Method Name: updateShownData
     * @description: Update shownCrewData for current page
     */
    updateShownData() {
        try {
            if (!this.filteredCrewList || this.filteredCrewList.length === 0) {
                this.shownCrewData = [];
                return;
            }

            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            this.shownCrewData = this.filteredCrewList.slice(startIndex, endIndex);
        } catch (error) {
            console.error('Error updating crew shown data:', error);
        }
    }

    /**
     * Method Name: handlePrevious
     * @description: Navigate to previous page
     */
    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage -= 1;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handleNext
     * @description: Navigate to next page
     */
    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage += 1;
            this.updateShownData();
        }
    }

    /**
     * Method Name: handlePageChange
     * @description: Navigate to selected page number
     */
    handlePageChange(event) {
        const selectedPage = parseInt(event.target.dataset.page, 10);
        if (selectedPage && selectedPage !== this.currentPage) {
            this.currentPage = selectedPage;
            this.updateShownData();
        }
    }

    /**
     * Method Name: showToast
     * @description: Utility to show toast messages
     */
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title,
            message,
            variant,
            mode: 'dismissable'
        });
        this.dispatchEvent(evt);
    }
}