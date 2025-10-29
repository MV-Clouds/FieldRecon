import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getCrews from '@salesforce/apex/ManagementTabController.getCrewMembers';
import getCrewContacts from '@salesforce/apex/ManagementTabController.getCrewContacts';
import saveCrew from '@salesforce/apex/ManagementTabController.saveCrew';
import getCrewMobilizationSummary from '@salesforce/apex/ManagementTabController.getCrewMobilizationSummary';
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
    @track confirmationContext = null;
    @track pendingSavePayload = null;
    @track pendingConflictMembers = [];
    @track hasAcknowledgedConflicts = false;
    @track originalCrewmemberByContact = new Map();
    @track showConflictSelectionModal = false;
    @track conflictModalTitle = '';
    @track conflictModalMessage = '';
    @track conflictModalMembers = [];
    @track futureMobilizationCount = 0;
    @track lastPropagationRequested = false;
    @track conflictModalCategory = null;
    @track originalCrewContactIds = new Set();

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
        this.fetchCrew();
    }

    /**
     * Method Name: fetchCrew
     * @description: Fetch all crew records
     */
    fetchCrew() {
        try {
            this.isLoading = true;
    
            getCrews()
                .then(result => {
                    console.log('getCrews result :: ', result);
                    
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
            console.error('Error in fetchCrew:', error);
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
        this.futureMobilizationCount = 0;
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
            console.log('isEditMode :: ', this.isEditMode);
            
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

            this.hasAcknowledgedConflicts = false;

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
            payload.membersToAdd = Array.from(new Set(this.getMembersToAdd()));
            payload.membersToRemove = Array.from(new Set(this.getMembersToRemove()));
            payload.selectedMemberIds = Array.from(new Set(this.getSelectedMemberIds()));

            if (!payload.Name) {
                this.showToast('Error', 'Crew name is required', 'error');
                return;
            }

            let membersToAdd = payload.membersToAdd || [];
            const hasMembersToAdd = membersToAdd.length > 0;

            console.log('membersToAdd :: ', membersToAdd);
            console.log('this.selectedCrewMembers :: ', this.selectedCrewMembers);
            console.log('this.originalCrewContactIds :: ' , this.originalCrewContactIds);
            console.log('hasMembersToAdd :: ', hasMembersToAdd);

            if (!hasMembersToAdd) {
                this.pendingSavePayload = null;
                this.pendingConflictMembers = [];
                payload.assignToFutureMobilizations = false;
                console.log('payload in if (!hasMembersToAdd) :: ', payload);
                
                this.executeCrewSave(payload);
                return;
            }

            const conflictingMembers = this.getConflictingSelectedMembers(membersToAdd);
            console.log('conflictingMembers :: ', conflictingMembers);

            if (conflictingMembers.length > 0 && !this.hasAcknowledgedConflicts) {
                this.precachePendingSavePayload(payload, false);
                this.pendingConflictMembers = conflictingMembers.map(member => ({
                    contactId: member.id,
                    contactName: member.name,
                    assignedCrewNames: member.assignedCrewNames,
                    crewNameSummary: member.assignedCrewNames
                }));
                console.log('this.pendingConflictMembers :: ', this.pendingConflictMembers);
                
                this.showConflictConfirmation(null, this.pendingConflictMembers);
                return;
            }

            this.pendingConflictMembers = [];
            console.log('this.futureMobilizationCount :: ', this.futureMobilizationCount);

            if (this.futureMobilizationCount > 0) {
                this.showPropagationConfirmation(payload);
                return;
            }

            this.pendingSavePayload = null;
            payload.assignToFutureMobilizations = false;
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
        try {
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
            this.fetchCrewMobilizationSummary(recordId);
        } catch (error) {
            console.error('Error opening edit modal:', error);
            this.showToast('Error', 'Failed to load crew for editing', 'error');
        }
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

    /**
     * Method Name: resetCrewMemberSelection
     * @description: Reset crew member selection
     */
    resetCrewMemberSelection() {
        this.availableCrewContacts = [];
        this.filteredCrewContacts = [];
        this.selectedCrewMembers = [];
        this.memberSearchTerm = '';
        this.pendingSavePayload = null;
        this.pendingConflictMembers = [];
        this.hasAcknowledgedConflicts = false;
        this.originalCrewmemberByContact = new Map();
        this.originalCrewContactIds = new Set();
        this.showConflictSelectionModal = false;
        this.conflictModalMembers = [];
        this.conflictModalMessage = '';
        this.conflictModalTitle = '';
        this.lastPropagationRequested = false;
        this.futureMobilizationCount = 0;
        this.conflictModalCategory = null;
    }

    /**
     * Method Name: loadCrewContacts
     * @description: Load crew contacts for the specified crew
     */
    loadCrewContacts(crewId) {
        try {
            this.isLoading = true;
    
            getCrewContacts({ crewId })
                .then(result => {
                    console.log('getCrewContacts result :: ', result);
                    
                    const assignedDtos = (result && result.assignedContacts) ? result.assignedContacts : [];
                    const availableDtos = (result && result.availableContacts) ? result.availableContacts : [];
    
                    this.selectedCrewMembers = assignedDtos.map(dto => this.transformCrewContact(dto)).sort((a, b) => a.name.localeCompare(b.name));
                    const baselineMap = new Map();
                    const baselineContacts = new Set();
                    this.selectedCrewMembers.forEach(member => {
                        console.log('member :: ', member);
                        
                        if (member && member.id && member.currentCrewMemberId) {
                            const contactKey = String(member.id);
                            baselineMap.set(contactKey, member.currentCrewMemberId);
                            baselineContacts.add(contactKey);
                        }
                    });
                    this.originalCrewmemberByContact = baselineMap;
                    this.originalCrewContactIds = baselineContacts;
                    console.log('this.originalCrewmemberByContact :: ', this.originalCrewmemberByContact);
                    console.log('this.originalCrewContactIds :: ', this.originalCrewContactIds);

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
        } catch (error) {
            console.error('Error loading crew contacts:', error);
            this.showToast('Error', 'Failed to load crew members', 'error');
        }
    }

    fetchCrewMobilizationSummary(crewId) {
        try {
            if (!crewId) {
                this.futureMobilizationCount = 0;
                return;
            }
    
            getCrewMobilizationSummary({ crewId })
                .then(result => {
                    console.log('getCrewMobilizationSummary result :: ', result);
                    
                    const upcoming = result && typeof result.upcomingMobilizations !== 'undefined'
                        ? parseInt(result.upcomingMobilizations, 10)
                        : 0;
                    this.futureMobilizationCount = Number.isNaN(upcoming) ? 0 : upcoming;
                })
                .catch(error => {
                    console.error('Error fetching crew mobilization summary:', error);
                    this.futureMobilizationCount = 0;
                });
        } catch (error) {
            console.error('Error fetching crew mobilization summary:', error);
            this.futureMobilizationCount = 0;
        }
    }

    /**
     * Method Name: transformCrewContact
     * @description: Transform crew contact DTO to component model
     */
    transformCrewContact(contactDto) {
        try {
            const members = contactDto && contactDto.members ? contactDto.members : [];
            const memberCrewIds = members.map(m => m.crewId).filter(id => !!id);
            const memberCrewNames = members
                .map(m => m.crewName)
                .filter(name => !!name);
            const memberDetails = members.map(member => ({
                id: member.memberId || member.id,
                crewId: member.crewId,
                crewName: member.crewName,
                colorCode: member.colorCode
            }));
    
            return {
                id: contactDto.id,
                name: contactDto.name,
                assignedCrewNames: contactDto.assignedCrewNames || (memberCrewNames.length ? memberCrewNames.join(', ') : null),
                memberCrewIds,
                memberCrewNames,
                 members: memberDetails,
                isAssignedElsewhere: Boolean(contactDto.isAssignedElsewhere),
                isAssignedToCurrentCrew: Boolean(contactDto.isAssignedToCurrentCrew),
                currentCrewMemberId: contactDto.currentCrewMemberId || null,
                primaryCrewColor: contactDto.primaryCrewColor ? this.normalizeColorCode(contactDto.primaryCrewColor) : null,
                availableFlag: contactDto.isAssignedElsewhere ? 'false' : 'true',
                removeAriaLabel: contactDto.name ? `Remove ${contactDto.name}` : 'Remove crew member'
            };
        } catch (error) {
            console.error('Error transforming crew contact:', error);
            return null;
        }
    }

    /**
     * Method Name: sortAvailableCrewContacts
     * @description: Sort available crew contacts by assignment status and name
     */
    sortAvailableCrewContacts() {
        try {
            const sorted = [...this.availableCrewContacts].sort((a, b) => {
                if (a.isAssignedElsewhere === b.isAssignedElsewhere) {
                    return a.name.localeCompare(b.name);
                }
                return a.isAssignedElsewhere ? 1 : -1;
            });
            this.availableCrewContacts = sorted;
        } catch (error) {
            console.error('Error sorting available crew contacts:', error);
            this.showToast('Error', 'Failed to sort crew members', 'error');
        }
    }

    /**
     * Method Name: applyCrewMemberSearch
     * @description: Apply search filter to crew members
     */
    applyCrewMemberSearch() {
        try {
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
        } catch (error) {
            console.error('Error applying crew member search:', error);
            this.showToast('Error', 'Failed to filter crew members', 'error');
        }
    }

    /**
     * Method Name: handleCrewMemberSearchChange
     * @description: Handle changes to the crew member search input
     */
    handleCrewMemberSearchChange(event) {
        this.memberSearchTerm = event.target.value || '';
        this.applyCrewMemberSearch();
    }

    /**
     * Method Name: handleCrewMemberSelect
     * @description: Handle selection of a crew member from available list
     */
    handleCrewMemberSelect(event) {
        try {
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
        } catch (error) {
            console.error('Error selecting crew member:', error);
            this.showToast('Error', 'Failed to select crew member', 'error');
        }
    }

    /**
     * Method Name: handleRemoveCrewMemberKeydown
     * @description: Handle keydown event for removing crew member
     */
    handleRemoveCrewMemberKeydown(event) {
        try {
            const { key } = event;
            if (key === 'Enter' || key === ' ') {
                event.preventDefault();
                this.handleRemoveCrewMember(event);
            }
        } catch (error) {
            console.error('Error handling remove crew member keydown:', error);
            this.showToast('Error', 'Failed to handle remove crew member keydown', 'error');
        }
    }

    /**
     * Method Name: handleRemoveCrewMember
     * @description: Handle removal of a crew member from selected list
     */
    handleRemoveCrewMember(event) {
        try {
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
        } catch (error) {
            console.error('Error handling remove crew member:', error);
            this.showToast('Error', 'Failed to handle remove crew member', 'error');
        }
    }

    /**
     * Method Name: getSelectedMemberIds
     * @description: Get IDs of all selected crew members
     */
    getSelectedMemberIds() {
        return this.selectedCrewMembers.map(member => member.id);
    }

    /**
     * Method Name: getMembersToAdd
     * @description: Get IDs of all members to be added
     */
    getMembersToAdd() {
        console.log('fetching members to add');
        
        const membersToAdd = [];
        const originalMemberMap = this.originalCrewmemberByContact instanceof Map ? this.originalCrewmemberByContact : new Map();
        const baselineContacts = this.originalCrewContactIds instanceof Set ? this.originalCrewContactIds : new Set();
        console.log('this.selectedCrewMembers :: ', this.selectedCrewMembers);
        console.log('this.baselineContacts :: ', baselineContacts);
        
        this.selectedCrewMembers.forEach(member => {
            if (!member || !member.id) {
                return;
            }

            const contactKey = String(member.id);
            if (baselineContacts.has(contactKey) || originalMemberMap.has(contactKey)) {
                return;
            }

            membersToAdd.push(member.id);
        });

        return membersToAdd;
    }

    /**
     * Method Name: getMembersToRemove
     * @description: Get IDs of all members to be removed
     */
    getMembersToRemove() {
        const membersToRemove = [];
        const originalMemberMap = this.originalCrewmemberByContact instanceof Map ? this.originalCrewmemberByContact : new Map();
        const selectedIds = new Set(this.selectedCrewMembers.map(member => (member && member.id) ? String(member.id) : ''));

        originalMemberMap.forEach((memberId, contactId) => {
            const contactKey = String(contactId);
            if (!selectedIds.has(contactKey)) {
                membersToRemove.push(memberId);
            }
        });

        return membersToRemove;
    }

    /**
     * Method Name: getConflictingSelectedMembers
     * @description: Get selected members that are assigned to other crews
     */
    getConflictingSelectedMembers(membersToAdd) {
        const currentCrewId = this.recordIdToEdit;
        const originalMemberMap = this.originalCrewmemberByContact instanceof Map ? this.originalCrewmemberByContact : new Map();
        const baselineContacts = this.originalCrewContactIds instanceof Set ? this.originalCrewContactIds : new Set();
        const membersToAddSet = new Set((membersToAdd || []).map(memberId => memberId ? String(memberId) : ''));

        if (membersToAddSet.size === 0) {
            return [];
        }

        return this.selectedCrewMembers.filter(member => {
            if (!member || !member.id) {
                return false;
            }

            const contactKey = String(member.id);

            if (baselineContacts.has(contactKey) || originalMemberMap.has(contactKey)) {
                return false;
            }

            if (!membersToAddSet.has(contactKey)) {
                return false;
            }

            if (!member.isAssignedElsewhere) {
                return false;
            }

            if (!currentCrewId) {
                return true;
            }

            const memberCrewIds = member.memberCrewIds || [];
            return memberCrewIds.some(id => id !== currentCrewId);
        });
    }

    /**
     * Method Name: showConflictConfirmation
     * @description: Show confirmation modal for conflicting crew members
     */
    showConflictConfirmation(message, conflicts) {
        try {
            const conflictEntries = conflicts || [];
    
            this.confirmationContext = 'CONFLICT';
            this.conflictModalCategory = 'CONFLICT';
            this.conflictModalTitle = 'Add members already in another crew?';
            this.conflictModalMessage = message && message.trim().length
                ? message
                : `The following crew members are already assigned to another crew. You can still add them to this crew or add them and assign in future mobilizations as well.`;
            this.conflictModalMembers = conflictEntries;
            this.showConflictSelectionModal = true;
            this.hasAcknowledgedConflicts = false;
        } catch (error) {
            console.error('Error showing conflict confirmation:', error);
            this.showToast('Error', 'Failed to show conflict confirmation', 'error');
        }
    }

    precachePendingSavePayload(payload, assignToFutureMobilizations) {
        this.pendingSavePayload = {
            ...payload,
            assignToFutureMobilizations: Boolean(assignToFutureMobilizations)
        };
    }

    showPropagationConfirmation(payload) {
        try {
            const upcomingCount = Number.isFinite(this.futureMobilizationCount) ? this.futureMobilizationCount : 0;
            const countLabel = upcomingCount === 1 ? 'mobilization' : 'mobilizations';

            this.confirmationContext = 'PROPAGATION';
            this.conflictModalCategory = 'PROPAGATION';
            this.conflictModalTitle = 'Update upcoming mobilizations?';
            this.conflictModalMessage = `This crew has ${upcomingCount} upcoming ${countLabel}. Would you like to add the new members to those mobilizations as well?`;
            this.conflictModalMembers = [];
            this.pendingConflictMembers = [];
            this.pendingSavePayload = {
                ...payload,
                assignToFutureMobilizations: false
            };
            this.showConflictSelectionModal = true;
        } catch (error) {
            console.error('Error preparing propagation confirmation:', error);
            this.showToast('Error', 'Failed to prepare mobilization update confirmation', 'error');
        }
    }

    /**
     * Method Name: executeCrewSave
     * @description: Execute saving crew via Apex
     */
    executeCrewSave(payload) {
        try {
            const apexPayload = { ...payload };
            console.log('apexPayload :: ', apexPayload);
            
            const shouldPropagate = Boolean(apexPayload.assignToFutureMobilizations);
            this.isLoading = true;

            this.lastPropagationRequested = shouldPropagate;

            saveCrew({ crewData: apexPayload })
                .then(response => {
                    if (!response) {
                        this.showToast('Error', 'Failed to save crew', 'error');
                        return;
                    }

                    if (response.status === 'SUCCESS') {
                        let successMessage = `Crew ${this.isEditMode ? 'updated' : 'created'} successfully`;

                        if (response.mobilizationAssignmentsCreated && response.mobilizationAssignmentsCreated > 0) {
                            successMessage += `. ${response.mobilizationAssignmentsCreated} mobilization assignment${response.mobilizationAssignmentsCreated === 1 ? '' : 's'} created for upcoming schedules.`;
                        } else if (this.lastPropagationRequested) {
                            successMessage += '. No future mobilizations required updates.';
                        }

                        this.showToast('Success', successMessage, 'success');
                        this.handleCloseModal();
                        this.fetchCrew();
                    } else {
                        const message = response.message ? response.message : 'Failed to save crew';
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
                    this.lastPropagationRequested = false;
                });
        } catch (error) {
            console.error('Error executing crew save:', error);
            this.showToast('Error', 'Failed to execute crew save', 'error');
            this.isLoading = false;
            this.lastPropagationRequested = false;
        }
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
        }
        this.confirmationContext = null;
    }

    handleConflictModalAction(event) {
        try {
            const target = event.currentTarget;
            const action = target ? target.name : null;
            if (!action) {
                return;
            }

            if (action === 'cancel') {
                this.showConflictSelectionModal = false;
                this.pendingSavePayload = null;
                this.pendingConflictMembers = [];
                this.hasAcknowledgedConflicts = false;
                this.confirmationContext = null;
                this.conflictModalCategory = null;
                return;
            }

            const payload = this.pendingSavePayload ? { ...this.pendingSavePayload } : null;
            if (!payload) {
                this.showConflictSelectionModal = false;
                this.pendingConflictMembers = [];
                this.hasAcknowledgedConflicts = false;
                this.conflictModalCategory = null;
                return;
            }

            payload.assignToFutureMobilizations = action === 'addAndSync';

            if (this.conflictModalCategory === 'CONFLICT') {
                this.hasAcknowledgedConflicts = true;
            }

            this.pendingSavePayload = null;
            this.pendingConflictMembers = [];
            this.showConflictSelectionModal = false;
            this.confirmationContext = null;
            this.conflictModalCategory = null;

            this.executeCrewSave(payload);
        } catch (error) {
            console.error('Error handling conflict modal action:', error);
            this.showToast('Error', 'Unable to process your selection. Please try again.', 'error');
        }
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
                        this.fetchCrew();
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