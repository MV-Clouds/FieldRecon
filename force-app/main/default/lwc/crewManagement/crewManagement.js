import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getCrews from '@salesforce/apex/ManagementTabController.getCrewMembers';
import getCrewContacts from '@salesforce/apex/ManagementTabController.getCrewContacts';
import saveCrew from '@salesforce/apex/ManagementTabController.saveCrew';
import getCrewMobilizationSummary from '@salesforce/apex/ManagementTabController.getCrewMobilizationSummary';
import deleteCrew from '@salesforce/apex/ManagementTabController.deleteCrew';
import getMobilizationOverlapConflicts from '@salesforce/apex/ManagementTabController.getMobilizationOverlapConflicts';

const NO_LEADER_VALUE = '__none__';
const MEMBER_TYPE_LEADER = 'Leader';
const MEMBER_TYPE_MEMBER = 'Member';

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
        { label: 'Crew Leader', fieldName: 'wfrecon__Crew_Leader__r.wfrecon__Contact__r.Name', type: 'text', sortable: true },
        { label: 'Color Code', fieldName: 'wfrecon__Color_Code__c', type: 'text', sortable: true, isColorField: true }
    ];
    @track availableCrewContacts = [];
    @track filteredCrewContacts = [];
    @track selectedCrewMembers = [];
    @track crewLeaderContactId = null;
    @track crewLeaderOptions = [{ label: '-- None --', value: NO_LEADER_VALUE }];
    @track memberSearchTerm = '';
    @track confirmationConfirmLabel = 'Delete';
    @track confirmationCancelLabel = 'Cancel';
    @track confirmationConfirmVariant = 'destructive';
    @track confirmationIcon = 'utility:warning';
    @track confirmationIconVariant = 'warning';
    @track confirmationContext = null;
    @track pendingSavePayload = null;
    @track hasAcknowledgedConflicts = false;
    @track originalCrewmemberByContact = new Map();
    @track showConflictSelectionModal = false;
    @track conflictModalTitle = '';
    @track conflictModalMessage = '';
    @track conflictModalMembers = [];
    @track conflictPrimaryAction = 'addMembers';
    @track conflictPrimaryLabel = 'Add Members';
    @track conflictSecondaryAction = 'addAndSync';
    @track conflictSecondaryLabel = 'Add & Update in Mobilizations';
    @track futureMobilizationCount = 0;
    @track lastPropagationRequested = false;
    @track conflictModalCategory = null;
    @track originalCrewContactIds = new Set();
    @track showOverlapModal = false;
    @track overlapModalTitle = 'Time Overlapping!';
    @track overlapModalMessage = 'Resource allocation is overlapping. How would you like to proceed?';
    @track mobilizationOverlapConflicts = [];
    @track overlapPrimaryLabel = 'Overlap & Assign';
    @track overlapSecondaryLabel = 'Assign Only Available';
    @track overlapCancelLabel = 'Cancel';

    hasAcknowledgedRemoval = false;
    hasAcknowledgedPropagation = false;
    overlapPrimaryAction = 'overlapAssign';
    overlapSecondaryAction = 'assignAvailable';
    overlapCancelAction = 'cancelOverlap';
    pendingOverlapPayload = null;

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

            const serialNumber = (this.currentPage - 1) * this.pageSize + index + 1;

            row.displayFields = this.crewTableColumns.map(col => {
                const key = col.fieldName;
                const isColorField = col.isColorField || false;
                let value;

                if (col.isSerialNumber) {
                    value = serialNumber;
                } else {
                    value = this.getFieldValue(crewRecord, key);
                }

                let displayValue = value;
                let normalizedColor = null;

                if (isColorField && value) {
                    normalizedColor = this.normalizeColorCode(value);
                    displayValue = normalizedColor.toUpperCase();
                }

                const hasValue = displayValue !== null && displayValue !== undefined && displayValue !== '';

                return {
                    key: `${crewRecord.Id}_${key}`,
                    value: displayValue,
                    hasValue,
                    isNameField: col.isNameField || false,
                    isSerialNumber: col.isSerialNumber || false,
                    isActions: col.isActions || false,
                    isNumber: col.type === 'number',
                    numberValue: col.type === 'number' ? parseFloat(value) || 0 : null,
                    isColorField,
                    colorValue: normalizedColor
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

    get crewLeaderSelectionValue() {
        return this.crewLeaderContactId ? this.crewLeaderContactId : NO_LEADER_VALUE;
    }

    get isCrewLeaderSelectionDisabled() {
        return !this.selectedCrewMembers.some(member => member && member.id && !member.isMarkedForRemoval);
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
        this.restoreConfirmationDefaults();
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
            payload.membersToAdd = Array.from(new Set(this.getMembersToAdd()));
            payload.membersToRemove = Array.from(new Set(this.getMembersToRemove()));
            payload.selectedMemberIds = Array.from(new Set(this.getSelectedMemberIds()));
            payload.leaderContactId = this.crewLeaderContactId || null;

            if (!payload.Name) {
                this.showToast('Error', 'Crew name is required', 'error');
                return;
            }

            payload.assignToFutureMobilizations = false;
            payload.removeFromFutureMobilizations = false;
            this.pendingSavePayload = null;

            this.processSaveFlow(payload);
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
        this.crewLeaderContactId = null;
        this.crewLeaderOptions = [{ label: '-- None --', value: NO_LEADER_VALUE }];
        this.memberSearchTerm = '';
        this.pendingSavePayload = null;
        this.hasAcknowledgedConflicts = false;
        this.hasAcknowledgedRemoval = false;
        this.hasAcknowledgedPropagation = false;
        this.originalCrewmemberByContact = new Map();
        this.originalCrewContactIds = new Set();
        this.showConflictSelectionModal = false;
        this.conflictModalMembers = [];
        this.conflictModalMessage = '';
        this.conflictModalTitle = '';
        this.lastPropagationRequested = false;
        this.futureMobilizationCount = 0;
        this.conflictModalCategory = null;
        this.conflictPrimaryAction = 'addMembers';
        this.conflictPrimaryLabel = 'Add Members';
        this.conflictSecondaryAction = 'addAndSync';
        this.conflictSecondaryLabel = 'Add & Update in Mobilizations';
        this.clearOverlapModalState();
        this.pendingOverlapPayload = null;
        this.updateCrewLeaderState(null);
    }

    isExistingMember(member) {
        return Boolean(member && member.currentCrewMemberId);
    }

    updateCrewLeaderState(preselectedContactId = undefined) {
        try {
            const baseMembers = Array.isArray(this.selectedCrewMembers)
                ? this.selectedCrewMembers
                : [];

            let desiredLeaderId = typeof preselectedContactId !== 'undefined'
                ? (preselectedContactId ? String(preselectedContactId) : null)
                : (this.crewLeaderContactId ? String(this.crewLeaderContactId) : null);

            const normalizedMembers = baseMembers.map(member => {
                const contactId = member && member.id ? String(member.id) : null;
                const crewMemberId = member && member.currentCrewMemberId ? String(member.currentCrewMemberId) : null;

                return {
                    ...member,
                    id: contactId,
                    currentCrewMemberId: crewMemberId
                };
            });

            const activeIds = new Set(
                normalizedMembers
                    .filter(member => member && member.id && !member.isMarkedForRemoval)
                    .map(member => member.id)
            );

            if (desiredLeaderId && !activeIds.has(desiredLeaderId)) {
                desiredLeaderId = null;
            }

            const enhancedMembers = normalizedMembers.map(member => {
                const isLeader = Boolean(desiredLeaderId && member.id === desiredLeaderId);
                const classes = ['tile'];

                if (member && member.isMarkedForRemoval) {
                    classes.push('tile-removed');
                }

                if (isLeader) {
                    classes.push('tile-leader');
                }

                const tileClass = classes.join(' ');

                const memberName = member && member.name ? member.name : 'this crew member';
                const leaderSuffix = isLeader ? ' (leader)' : '';
                const removeLabel = member && member.isMarkedForRemoval
                    ? `Keep ${memberName}${leaderSuffix}`
                    : `Remove ${memberName}${leaderSuffix}`;

                return {
                    ...member,
                    isCurrentCrewLeader: isLeader,
                    memberType: isLeader ? MEMBER_TYPE_LEADER : MEMBER_TYPE_MEMBER,
                    tileClass,
                    removeAriaLabel: removeLabel
                };
            });

            const options = [
                { label: '-- None --', value: NO_LEADER_VALUE },
                ...enhancedMembers
                    .filter(member => member && member.id && !member.isMarkedForRemoval)
                    .map(member => ({
                        label: member.name,
                        value: member.id
                    }))
            ];

            this.selectedCrewMembers = enhancedMembers;
            this.crewLeaderOptions = options;
            this.crewLeaderContactId = desiredLeaderId;
        } catch (error) {
            console.error('Error updating crew leader state:', error);
            this.crewLeaderContactId = null;
            this.crewLeaderOptions = [{ label: '-- None --', value: NO_LEADER_VALUE }];
        }
    }

    removeCrewMemberById(contactId) {
        try {
            if (!contactId) {
                return;
            }

            const memberIndex = this.selectedCrewMembers.findIndex(member => member.id === contactId);
            if (memberIndex === -1) {
                return;
            }

            const member = { ...this.selectedCrewMembers[memberIndex] };
            const isExistingMember = this.isExistingMember(member);

            if (isExistingMember) {
                const nextRemovalState = !member.isMarkedForRemoval;
                const memberName = member && member.name ? member.name : 'this crew member';

                member.isMarkedForRemoval = nextRemovalState;
                member.removeAriaLabel = nextRemovalState
                    ? `Keep ${memberName}`
                    : `Remove ${memberName}`;

                this.selectedCrewMembers.splice(memberIndex, 1, member);
                this.selectedCrewMembers = [...this.selectedCrewMembers];
                this.updateCrewLeaderState(this.crewLeaderContactId);

                if (nextRemovalState) {
                    this.hasAcknowledgedRemoval = false;
                }
                this.clearOverlapModalState();
                return;
            }

            const [removedMember] = this.selectedCrewMembers.splice(memberIndex, 1);
            this.selectedCrewMembers = [...this.selectedCrewMembers];
            this.updateCrewLeaderState(this.crewLeaderContactId);

            const restoredMember = {
                ...removedMember,
                isMarkedForRemoval: false,
                tileClass: 'tile',
                removeAriaLabel: removedMember && removedMember.name
                    ? `Remove ${removedMember.name}`
                    : 'Remove this crew member',
                isCurrentCrewLeader: false,
                memberType: MEMBER_TYPE_MEMBER
            };

            this.availableCrewContacts = [...this.availableCrewContacts, restoredMember];
            this.sortAvailableCrewContacts();
            this.applyCrewMemberSearch();
            this.hasAcknowledgedConflicts = false;
            this.hasAcknowledgedPropagation = false;
            this.clearOverlapModalState();
        } catch (error) {
            console.error('Error updating crew member selection:', error);
            this.showToast('Error', 'Failed to update crew member selection', 'error');
        }
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
                    const serverLeaderContactId = result && result.crewLeaderContactId ? String(result.crewLeaderContactId) : null;
    
                    this.selectedCrewMembers = assignedDtos.map(dto => this.transformCrewContact(dto)).sort((a, b) => a.name.localeCompare(b.name));
                    this.updateCrewLeaderState(serverLeaderContactId);
                    const baselineMap = new Map();
                    const baselineContacts = new Set();
                    this.selectedCrewMembers.forEach(member => {
                        if (member && member.id && member.currentCrewMemberId) {
                            const contactKey = String(member.id);
                            baselineMap.set(contactKey, member.currentCrewMemberId);
                            baselineContacts.add(contactKey);
                        }
                    });
                    this.originalCrewmemberByContact = baselineMap;
                    this.originalCrewContactIds = baselineContacts;

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
        if (!crewId) {
            this.futureMobilizationCount = 0;
            return;
        }

        getCrewMobilizationSummary({ crewId })
            .then(count => {
                this.futureMobilizationCount = count || 0;
            })
            .catch(error => {
                console.error('Error fetching crew mobilization summary:', error);
                this.futureMobilizationCount = 0;
            });
    }

    /**
     * Method Name: transformCrewContact
     * @description: Transform crew contact DTO to component model
     */
    transformCrewContact(contactDto) {
        try {
            const members = Array.isArray(contactDto && contactDto.members) ? contactDto.members : [];
            const memberCrewIds = members
                .map(m => (m && m.crewId ? String(m.crewId) : null))
                .filter(id => !!id);
            const memberCrewNames = members
                .map(m => m && m.crewName)
                .filter(name => !!name);
            const memberDetails = members.map(member => ({
                id: member && member.memberId ? String(member.memberId) : (member && member.id ? String(member.id) : null),
                crewId: member && member.crewId ? String(member.crewId) : null,
                crewName: member && member.crewName ? member.crewName : null,
                colorCode: member && member.colorCode ? member.colorCode : null,
                memberType: member && member.memberType ? member.memberType : null
            }));

            const normalizedContactId = contactDto && contactDto.id ? String(contactDto.id) : null;
            const currentCrewMemberId = contactDto && contactDto.currentCrewMemberId ? String(contactDto.currentCrewMemberId) : null;
            const currentCrewId = this.recordIdToEdit ? String(this.recordIdToEdit) : null;
            const currentMemberDetail = memberDetails.find(detail => detail && detail.crewId && currentCrewId && detail.crewId === currentCrewId);
            const rawMemberType = contactDto && contactDto.currentCrewMemberType
                ? contactDto.currentCrewMemberType
                : (currentMemberDetail && currentMemberDetail.memberType ? currentMemberDetail.memberType : null);
            const isCrewLeader = Boolean(contactDto && contactDto.isCurrentCrewLeader)
                || (rawMemberType && rawMemberType.toLowerCase() === MEMBER_TYPE_LEADER.toLowerCase());
            const normalizedMemberType = isCrewLeader
                ? MEMBER_TYPE_LEADER
                : (rawMemberType ? rawMemberType : MEMBER_TYPE_MEMBER);

            return {
                id: normalizedContactId,
                name: contactDto ? contactDto.name : null,
                assignedCrewNames: contactDto && contactDto.assignedCrewNames
                    ? contactDto.assignedCrewNames
                    : (memberCrewNames.length ? memberCrewNames.join(', ') : null),
                memberCrewIds,
                memberCrewNames,
                members: memberDetails,
                isAssignedElsewhere: Boolean(contactDto && contactDto.isAssignedElsewhere),
                isAssignedToCurrentCrew: Boolean(contactDto && contactDto.isAssignedToCurrentCrew),
                currentCrewMemberId,
                primaryCrewColor: contactDto && contactDto.primaryCrewColor
                    ? this.normalizeColorCode(contactDto.primaryCrewColor)
                    : null,
                availableFlag: contactDto && contactDto.isAssignedElsewhere ? 'false' : 'true',
                removeAriaLabel: contactDto && contactDto.name ? `Remove ${contactDto.name}` : 'Remove crew member',
                isMarkedForRemoval: false,
                tileClass: 'tile',
                isCurrentCrewLeader: isCrewLeader,
                memberType: normalizedMemberType
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

    handleCrewLeaderChange(event) {
        try {
            const newValue = event && event.detail ? event.detail.value : null;
            if (!newValue || newValue === NO_LEADER_VALUE) {
                this.updateCrewLeaderState(null);
            } else {
                this.updateCrewLeaderState(newValue);
            }
        } catch (error) {
            console.error('Error handling crew leader change:', error);
        }
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
    
            const [selectedContactRaw] = this.availableCrewContacts.splice(contactIndex, 1);
            const selectedContact = {
                ...selectedContactRaw,
                id: selectedContactRaw && selectedContactRaw.id ? String(selectedContactRaw.id) : selectedContactRaw.id,
                currentCrewMemberId: selectedContactRaw && selectedContactRaw.currentCrewMemberId
                    ? String(selectedContactRaw.currentCrewMemberId)
                    : selectedContactRaw.currentCrewMemberId,
                isMarkedForRemoval: false,
                tileClass: 'tile',
                removeAriaLabel: selectedContactRaw && selectedContactRaw.name
                    ? `Remove ${selectedContactRaw.name}`
                    : 'Remove crew member',
                isCurrentCrewLeader: false,
                memberType: MEMBER_TYPE_MEMBER
            };
            this.availableCrewContacts = [...this.availableCrewContacts];
            this.selectedCrewMembers = [...this.selectedCrewMembers, selectedContact].sort((a, b) => a.name.localeCompare(b.name));
            this.updateCrewLeaderState();
    
            this.hasAcknowledgedConflicts = false;
            this.hasAcknowledgedPropagation = false;
    
            this.applyCrewMemberSearch();
            this.clearOverlapModalState();
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
                const contactId = event.currentTarget.dataset.id;
                this.removeCrewMemberById(contactId);
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

            this.removeCrewMemberById(contactId);
        } catch (error) {
            console.error('Error handling remove crew member:', error);
            this.showToast('Error', 'Failed to handle remove crew member', 'error');
        }
    }

    /**
     * Method Name: getSelectedMemberIds
     * @description: Get IDs of all currently selected members (not marked for removal)
     */
    getSelectedMemberIds() {
        return this.selectedCrewMembers
            .filter(member => member && member.id && !member.isMarkedForRemoval)
            .map(member => member.id);
    }

    /**
     * Method Name: getMembersToAdd
     * @description: Get IDs of all members to be added
     */
    getMembersToAdd() {
        return this.selectedCrewMembers
            .filter(member => {
                if (!member || !member.id || member.isMarkedForRemoval) {
                    return false;
                }
                const contactKey = String(member.id);
                return !this.originalCrewContactIds.has(contactKey);
            })
            .map(member => member.id);
    }

    /**
     * Method Name: getMembersToRemove
     * @description: Get IDs of all crew member records to be removed
     */
    getMembersToRemove() {
        const retainedIds = new Set(
            this.selectedCrewMembers
                .filter(member => member && member.id && !member.isMarkedForRemoval)
                .map(member => String(member.id))
        );

        const membersToRemove = [];
        this.originalCrewmemberByContact.forEach((memberId, contactId) => {
            if (!retainedIds.has(String(contactId))) {
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
        if (!membersToAdd || membersToAdd.length === 0) {
            return [];
        }

        const membersToAddSet = new Set(membersToAdd.map(id => String(id)));
        const currentCrewId = this.recordIdToEdit;

        return this.selectedCrewMembers.filter(member => {
            if (!member || !member.id || !membersToAddSet.has(String(member.id))) {
                return false;
            }

            // Skip if already in this crew
            if (this.originalCrewContactIds.has(String(member.id))) {
                return false;
            }

            // Include if assigned elsewhere
            if (!member.isAssignedElsewhere) {
                return false;
            }

            // For new crew creation, all conflicts count
            if (!currentCrewId) {
                return true;
            }

            // For edit mode, check if assigned to different crews
            const memberCrewIds = member.memberCrewIds || [];
            return memberCrewIds.some(id => id !== currentCrewId);
        });
    }

    /**
     * Method Name: getRemovalTargets
     * @description: Get existing members marked for removal
     */
    getRemovalTargets() {
        return this.selectedCrewMembers.filter(member => 
            member && member.currentCrewMemberId && member.isMarkedForRemoval
        );
    }

    /**
     * Method Name: showConflictConfirmation
     * @description: Show confirmation modal for conflicting crew members
     */
    showConflictConfirmation(payload, conflicts, message) {
        try {
            this.clearOverlapModalState();
            const conflictEntries = (conflicts || []).map(conflict => ({
                contactId: conflict.contactId || conflict.id,
                contactName: conflict.contactName || conflict.name,
                crewNameSummary: conflict.crewNameSummary || conflict.assignedCrewNames
            }));

            this.pendingSavePayload = {
                ...payload,
                assignToFutureMobilizations: false
            };

            this.confirmationContext = 'CONFLICT';
            this.conflictModalCategory = 'CONFLICT';
            this.conflictModalTitle = 'Add members already in another crew?';
            this.conflictModalMessage = message && message.trim().length
                ? message
                : 'The following crew members are already assigned to another crew. You can still add them to this crew or add them and sync upcoming mobilizations.';
            this.conflictModalMembers = conflictEntries;
            this.conflictPrimaryAction = 'addMembers';
            this.conflictPrimaryLabel = 'Add Members';
            this.conflictSecondaryAction = 'addAndSync';
            this.conflictSecondaryLabel = 'Add & Update Mobilizations';
            this.showConflictSelectionModal = true;
            this.hasAcknowledgedConflicts = false;
        } catch (error) {
            console.error('Error showing conflict confirmation:', error);
            this.showToast('Error', 'Failed to show conflict confirmation', 'error');
        }
    }

    showPropagationConfirmation(payload) {
        try {
            this.clearOverlapModalState();
            const upcomingCount = Number.isFinite(this.futureMobilizationCount) ? this.futureMobilizationCount : 0;
            const countLabel = upcomingCount === 1 ? 'mobilization' : 'mobilizations';

            this.confirmationContext = 'PROPAGATION';
            this.conflictModalCategory = 'PROPAGATION';
            this.conflictModalTitle = 'Update upcoming mobilizations?';
            this.conflictModalMessage = `This crew has ${upcomingCount} upcoming ${countLabel}. Would you like to add the new members to those mobilizations as well?`;
            this.conflictModalMembers = [];
            this.pendingSavePayload = {
                ...payload,
                assignToFutureMobilizations: false
            };
            this.conflictPrimaryAction = 'skipPropagation';
            this.conflictPrimaryLabel = 'Keep Crew Only';
            this.conflictSecondaryAction = 'propagateMobilizations';
            this.conflictSecondaryLabel = 'Add & Update Mobilizations';
            this.showConflictSelectionModal = true;
            this.hasAcknowledgedPropagation = false;
        } catch (error) {
            console.error('Error preparing propagation confirmation:', error);
            this.showToast('Error', 'Failed to prepare mobilization update confirmation', 'error');
        }
    }

    showRemovalConfirmation(payload, removalTargets) {
        try {
            this.clearOverlapModalState();
            const removalEntries = removalTargets.map(member => ({
                contactId: member.id,
                contactName: member.name,
                crewNameSummary: member.assignedCrewNames
            }));

            this.pendingSavePayload = {
                ...payload,
                removeFromFutureMobilizations: false
            };

            this.confirmationContext = 'REMOVAL';
            this.conflictModalCategory = 'REMOVAL';
            this.conflictModalTitle = 'Remove crew members from future mobilizations?';
            this.conflictModalMessage = 'Select how you want to remove these members. You can keep future mobilizations intact or remove the members from upcoming mobilizations as well.';
            this.conflictModalMembers = removalEntries;
            this.conflictPrimaryAction = 'removeCrew';
            this.conflictPrimaryLabel = 'Remove from Crew';
            this.conflictSecondaryAction = 'removeCrewFuture';
            this.conflictSecondaryLabel = 'Remove Crew & Future Mobilizations';
            this.showConflictSelectionModal = true;
            this.hasAcknowledgedRemoval = false;
        } catch (error) {
            console.error('Error showing removal confirmation:', error);
            this.showToast('Error', 'Failed to prepare removal confirmation', 'error');
        }
    }

    formatMobilizationWindow(startValue, endValue) {
        try {
            if (!startValue) {
                return '';
            }

            const locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
            const start = new Date(startValue);
            const end = endValue ? new Date(endValue) : null;
            const adjustedEnd = end && end < start ? new Date(end.getTime() + 24 * 60 * 60 * 1000) : end;

            const dateFormatter = new Intl.DateTimeFormat(locale, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            const timeFormatter = new Intl.DateTimeFormat(locale, {
                hour: 'numeric',
                minute: '2-digit'
            });

            const startDate = dateFormatter.format(start);
            const startTime = timeFormatter.format(start);

            if (!adjustedEnd) {
                return `${startDate} ${startTime}`;
            }

            const sameDay = start.toDateString() === adjustedEnd.toDateString();
            const endDate = dateFormatter.format(adjustedEnd);
            const endTime = timeFormatter.format(adjustedEnd);

            if (sameDay) {
                return `${startDate} ${startTime} - ${endTime}`;
            }

            return `${startDate} ${startTime} - ${endDate} ${endTime}`;
        } catch (error) {
            console.error('Error formatting mobilization window:', error);
            return '';
        }
    }

    transformMobilizationOverlapConflicts(conflicts) {
        try {
            if (!Array.isArray(conflicts) || conflicts.length === 0) {
                return [];
            }

            return conflicts.map((conflict, index) => {
                const key = `${conflict.contactId || 'unknown'}-${conflict.targetMobilizationId || 'target'}-${conflict.conflictingMobilizationId || 'conflict'}-${index}`;
                const fallbackTargetName = conflict.targetMobilizationName
                    || (this.isEditMode ? 'Crew mobilization' : 'New crew mobilizations');
                const targetStart = conflict.targetStart || conflict.conflictingStart || null;
                const targetEnd = conflict.targetEnd || conflict.conflictingEnd || null;
                return {
                    key,
                    contactId: conflict.contactId,
                    contactName: conflict.contactName,
                    targetMobilizationId: conflict.targetMobilizationId,
                    targetMobilizationName: fallbackTargetName,
                    targetWindow: this.formatMobilizationWindow(targetStart, targetEnd),
                    conflictingMobilizationId: conflict.conflictingMobilizationId,
                    conflictingMobilizationName: conflict.conflictingMobilizationName,
                    conflictingWindow: this.formatMobilizationWindow(conflict.conflictingStart, conflict.conflictingEnd),
                    conflictingCrewName: conflict.conflictingCrewName || 'Individual Assignment'
                };
            });
        } catch (error) {
            console.error('Error transforming mobilization overlap conflicts:', error);
            return [];
        }
    }

    /**
     * Method Name: buildSkipAssignmentsFromConflicts
     * @description: Build map of mobilization assignments to skip based on conflicts
     */
    buildSkipAssignmentsFromConflicts() {
        const skipMap = {};

        this.mobilizationOverlapConflicts.forEach(conflict => {
            if (!conflict?.contactId || !conflict?.targetMobilizationId) {
                return;
            }

            if (!skipMap[conflict.contactId]) {
                skipMap[conflict.contactId] = [];
            }
            skipMap[conflict.contactId].push(conflict.targetMobilizationId);
        });

        return skipMap;
    }

    clearOverlapModalState() {
        this.showOverlapModal = false;
        this.mobilizationOverlapConflicts = [];
        this.pendingOverlapPayload = null;
    }

    /**
     * Method Name: evaluateMobilizationOverlap
     * @description: Check for mobilization time conflicts and show modal if any
     */
    evaluateMobilizationOverlap(payload) {
        try {
            const uniqueMembersToAdd = [...new Set(payload.membersToAdd?.filter(id => id) || [])];

            if (uniqueMembersToAdd.length === 0) {
                this.processSaveFlow(payload, { skipOverlapCheck: true });
                return;
            }

            this.clearOverlapModalState();
            this.isLoading = true;

            getMobilizationOverlapConflicts({ 
                crewId: this.recordIdToEdit, 
                contactIds: uniqueMembersToAdd 
            })
                .then(result => {
                    const conflicts = Array.isArray(result) ? result : (result?.conflicts || []);

                    if (conflicts.length === 0) {
                        this.processSaveFlow(payload, { skipOverlapCheck: true });
                        return;
                    }

                    this.pendingOverlapPayload = {
                        ...payload,
                        mobilizationAssignmentsToSkip: payload.mobilizationAssignmentsToSkip || {}
                    };
                    this.mobilizationOverlapConflicts = this.transformMobilizationOverlapConflicts(conflicts);
                    this.showOverlapModal = true;
                    this.isLoading = false;
                })
                .catch(error => {
                    console.error('Error evaluating mobilization overlap:', error);
                    this.showToast('Error', 'Failed to evaluate mobilization overlaps', 'error');
                    this.isLoading = false;
                });
        } catch (error) {
            console.error('Error in evaluateMobilizationOverlap:', error);
            this.showToast('Error', 'Failed to evaluate mobilization overlaps', 'error');
            this.isLoading = false;
        }
    }

    /**
     * Method Name: processSaveFlow
     * @description: Process crew save with conflict checks and confirmations
     */
    processSaveFlow(payload, options = {}) {
        try {
            // Set default values
            const workingPayload = {
                ...payload,
                assignToFutureMobilizations: payload.assignToFutureMobilizations || false,
                removeFromFutureMobilizations: payload.removeFromFutureMobilizations || false,
                mobilizationAssignmentsToSkip: payload.mobilizationAssignmentsToSkip || {}
            };

            const { skipOverlapCheck = false } = options;
            const membersToAdd = workingPayload.membersToAdd || [];
            const hasMembersToAdd = membersToAdd.length > 0;
            const wantsPropagation = Boolean(workingPayload.assignToFutureMobilizations);

            // Check for crew assignment conflicts
            if (hasMembersToAdd && !this.hasAcknowledgedConflicts) {
                const conflictingMembers = this.getConflictingSelectedMembers(membersToAdd);
                if (conflictingMembers.length > 0) {
                    this.showConflictConfirmation(workingPayload, conflictingMembers);
                    return;
                }
            }

            // Check for member removals
            const removalTargets = this.getRemovalTargets();
            const hasRemovals = workingPayload.membersToRemove?.length > 0 && removalTargets.length > 0;
            if (hasRemovals && !this.hasAcknowledgedRemoval) {
                this.showRemovalConfirmation(workingPayload, removalTargets);
                return;
            }

            // Check for future mobilization propagation
            if (hasMembersToAdd && this.futureMobilizationCount > 0 && !this.hasAcknowledgedPropagation) {
                this.showPropagationConfirmation(workingPayload);
                return;
            }

            // Check for time overlaps if propagating to future mobilizations
            const shouldCheckOverlap = !skipOverlapCheck && hasMembersToAdd && wantsPropagation;
            if (shouldCheckOverlap && (this.isEditMode ? this.futureMobilizationCount > 0 : true)) {
                this.evaluateMobilizationOverlap(workingPayload);
                return;
            }

            // All checks passed - proceed with save
            this.pendingSavePayload = null;
            this.pendingOverlapPayload = null;
            this.mobilizationOverlapConflicts = [];
            this.executeCrewSave(workingPayload);
        } catch (error) {
            console.error('Error in processSaveFlow:', error);
            this.showToast('Error', 'Failed to process crew save', 'error');
        }
    }

    /**
     * Method Name: executeCrewSave
     * @description: Execute saving crew via Apex
     */
    executeCrewSave(payload) {
        try {
            const apexPayload = { ...payload };
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

                        const assignmentsSkipped = Number(response.mobilizationAssignmentsSkipped);
                        if (!Number.isNaN(assignmentsSkipped) && assignmentsSkipped > 0) {
                            successMessage += ` ${assignmentsSkipped} mobilization assignment${assignmentsSkipped === 1 ? ' was' : 's were'} skipped due to scheduling conflicts.`;
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

    restoreConfirmationDefaults() {
        this.confirmationModalTitle = 'Confirm Action';
        this.confirmationModalMessage = 'Are you sure you want to proceed?';
        this.confirmationConfirmLabel = 'Delete';
        this.confirmationConfirmVariant = 'destructive';
        this.confirmationCancelLabel = 'Cancel';
        this.confirmationIcon = 'utility:warning';
        this.confirmationIconVariant = 'warning';
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
        this.restoreConfirmationDefaults();
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
        this.restoreConfirmationDefaults();
    }

    handleOverlapModalAction(event) {
        try {
            const action = event?.currentTarget?.dataset?.action;
            if (!action) {
                return;
            }

            if (action === this.overlapCancelAction) {
                this.clearOverlapModalState();
                this.hasAcknowledgedPropagation = false;
                return;
            }

            const payload = this.pendingOverlapPayload
                ? {
                    ...this.pendingOverlapPayload,
                    mobilizationAssignmentsToSkip: {
                        ...(this.pendingOverlapPayload.mobilizationAssignmentsToSkip || {})
                    }
                }
                : null;

            if (!payload) {
                this.clearOverlapModalState();
                return;
            }

            if (action === this.overlapSecondaryAction) {
                const skipMap = this.buildSkipAssignmentsFromConflicts();
                payload.mobilizationAssignmentsToSkip = skipMap;

                if (!skipMap || Object.keys(skipMap).length === 0) {
                    payload.assignToFutureMobilizations = false;
                } else {
                    payload.assignToFutureMobilizations = true;
                }
            } else if (action === this.overlapPrimaryAction) {
                payload.mobilizationAssignmentsToSkip = {};
                payload.assignToFutureMobilizations = true;
            } else {
                return;
            }

            this.clearOverlapModalState();
            this.hasAcknowledgedPropagation = true;
            this.processSaveFlow(payload, { skipOverlapCheck: true });
        } catch (error) {
            console.error('Error handling overlap modal action:', error);
            this.showToast('Error', 'Unable to process overlap selection. Please try again.', 'error');
        }
    }

    handleConflictModalAction(event) {
        try {
            const target = event?.currentTarget;
            const action = target && target.dataset ? target.dataset.action : null;
            if (!action) {
                return;
            }

            if (action === 'cancel') {
                this.showConflictSelectionModal = false;
                this.pendingSavePayload = null;
                this.conflictModalMembers = [];
                this.conflictModalCategory = null;
                this.confirmationContext = null;
                this.clearOverlapModalState();
                return;
            }

            const payload = this.pendingSavePayload ? { ...this.pendingSavePayload } : null;
            if (!payload) {
                this.showConflictSelectionModal = false;
                this.conflictModalCategory = null;
                this.conflictModalMembers = [];
                this.confirmationContext = null;
                return;
            }

            if (this.conflictModalCategory === 'CONFLICT') {
                payload.assignToFutureMobilizations = action === this.conflictSecondaryAction;
                this.hasAcknowledgedConflicts = true;
            } else if (this.conflictModalCategory === 'PROPAGATION') {
                payload.assignToFutureMobilizations = action === this.conflictSecondaryAction;
                this.hasAcknowledgedPropagation = true;
            } else if (this.conflictModalCategory === 'REMOVAL') {
                payload.removeFromFutureMobilizations = action === this.conflictSecondaryAction;
                this.hasAcknowledgedRemoval = true;
            }

            this.pendingSavePayload = null;
            this.showConflictSelectionModal = false;
            this.confirmationContext = null;
            this.conflictModalCategory = null;
            this.conflictModalMembers = [];

            this.processSaveFlow(payload);
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