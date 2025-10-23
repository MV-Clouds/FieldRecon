import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getAllContactsWithDetails from '@salesforce/apex/TimeCardManagerController.getAllContactsWithDetails';

export default class TimeCardManager extends NavigationMixin(LightningElement) {
    @track contactsRaw = [];
    @track filteredContactsRaw = [];
    @track isLoading = true;
    @track searchTerm = '';
    @track customStartDate;
    @track customEndDate;

    defaultDate = new Date().toISOString().split('T')[0];

    get defaultEndDate() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + daysUntilSunday);
        return endDate.toISOString().split('T')[0];
    }

    @track contactColumns = [
        { label: 'Sr. No.', fieldName: 'srNo', style: 'width: 6rem' },
        { 
            label: 'Contact Name', 
            fieldName: 'contactName', 
            style: 'width: 15rem',
            isLink: true,
            recordIdField: 'contactId' 
        },
        { label: 'Developer Name', fieldName: 'developerName', style: 'width: 12rem' },
        { label: 'Can Clock In/Out', fieldName: 'canClockInOut', style: 'width: 10rem' },
        { label: 'Email', fieldName: 'email', style: 'width: 15rem' },
        { label: 'Phone', fieldName: 'phone', style: 'width: 12rem' },
        { label: 'Total Mobilizations', fieldName: 'totalMobilizations', style: 'width: 12rem' },
    ];

    get contactDetails() {
        if (!this.filteredContactsRaw || this.filteredContactsRaw.length === 0) {
            return [];
        }

        return this.filteredContactsRaw.map((contact, index) => {
            return {
                contactId: contact.contactId,
                values: this.contactColumns.map(col => {
                    let cell = { 
                        fieldName: col.fieldName, 
                        value: '', 
                        recordLink: false, 
                        style: col.style 
                    };

                    if (col.fieldName === 'srNo') {
                        cell.value = index + 1;
                    } else if (col.fieldName === 'contactName') {
                        cell.value = contact.contactName || '';
                        if (col.isLink && col.recordIdField) {
                            cell.recordLink = true;
                        }
                    } else if (col.fieldName === 'canClockInOut') {
                        cell.value = contact.canClockInOut ? 'Yes' : 'No';
                    } else if (col.fieldName === 'totalMobilizations') {
                        cell.value = contact.mobilizationGroups ? contact.mobilizationGroups.length : 0;
                    } else {
                        cell.value = contact[col.fieldName] || '';
                    }

                    return cell;
                })
            };
        });
    }

    connectedCallback() {
        // Set default date range to today to end of week (Sunday)
        this.customStartDate = this.defaultDate;
        this.customEndDate = this.defaultEndDate;
        this.loadContactDetails();
    }

    loadContactDetails() {
        this.isLoading = true;
        
        getAllContactsWithDetails({
            customStartDate: this.customStartDate,
            customEndDate: this.customEndDate
        })
        .then(result => {
            console.log('Contact details result:', result);
            this.contactsRaw = result || [];
            this.filterContacts();
            this.isLoading = false;
        })
        .catch(error => {
            console.error('Error loading contact details:', error);
            this.isLoading = false;
        });
    }

    filterContacts() {
        if (!this.contactsRaw || this.contactsRaw.length === 0) {
            this.filteredContactsRaw = [];
            return;
        }

        let filtered = [...this.contactsRaw];

        // Apply search filter on client side - only by contact name
        if (this.searchTerm && this.searchTerm.trim() !== '') {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(contact => {
                return (contact.contactName && contact.contactName.toLowerCase().includes(searchLower));
            });
        }

        this.filteredContactsRaw = filtered;
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.filterContacts();
    }

    handleCustomStartDateChange(event) {
        this.customStartDate = event.target.value;
        if (this.customStartDate && this.customEndDate) {
            this.loadContactDetails();
        }
    }

    handleCustomEndDateChange(event) {
        this.customEndDate = event.target.value;
        if (this.customStartDate && this.customEndDate) {
            this.loadContactDetails();
        }
    }

    handleLinkClick(event) {
        try {
            const contactId = event.currentTarget.dataset.link;
            if (contactId) {
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: contactId,
                        actionName: 'view',
                    },
                });
            }
        } catch (error) {
            console.error('Error in handleLinkClick ::', error);
        }
    }
}