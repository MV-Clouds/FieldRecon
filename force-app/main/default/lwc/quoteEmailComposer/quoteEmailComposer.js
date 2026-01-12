import { LightningElement, track, api, wire } from 'lwc';
import getInitialData from '@salesforce/apex/QuoteEmailController.getInitialData';
import renderEmailTemplate from '@salesforce/apex/QuoteEmailController.renderEmailTemplate';
import sendQuoteEmail from '@salesforce/apex/QuoteEmailController.sendQuoteEmail';
import getRecordFiles from '@salesforce/apex/QuoteEmailController.getRecordFiles';
import getUploadedFileDetails from '@salesforce/apex/QuoteEmailController.getUploadedFileDetails';
import getContactName from '@salesforce/apex/QuoteEmailController.getContactName';
import deleteContentDocuments from '@salesforce/apex/QuoteEmailController.deleteContentDocuments';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { gql, graphql } from 'lightning/uiGraphQLApi';

// Max file size in bytes (25 MB)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export default class QuoteEmailComposer extends LightningElement {
    @api recordId;
    
    @track isLoading = false;

    // Accordion Logic
    @track activeSectionName = ['bodyPreview', 'templatePreview'];
    @track accordionStyleApplied = false;

    // Dropdown Data
    @track templateOptions = [];
    @track fromOptions = [];
    @track baseUrl = '';

    // Form Selections
    @track selectedTemplateId;
    @track selectedFromAddress;
    @track subject = '';
    
    // Body Logic: 
    // emailBody = The editable text in the form (Contains the link)
    // templatePreviewHtml = The visual preview of the selected Template (Not editable)
    @track emailBody = '';
    @track templatePreviewHtml = ''; 

    @track selectedToId;
    
    // Multi-select Lists
    @track ccItems = [];
    @track bccItems = [];

    // Attachments
    @track uploadedFiles = []; // Main list of selected files {id, name, icon, isNewUpload}
    
    // File Modal
    @track showFileModal = false;
    @track recordFiles = []; // Files fetched from Apex for the modal
    @track isLoadingFiles = false;

    // GraphQL Selection Tracker
    selectedRecordId = '';
    activePicker = ''; // 'CC' or 'BCC'

    // Status Flag
    emailSentSuccessfully = false;

    connectedCallback() {
        this.overrideSLDS();
    }

    renderedCallback() {
        if (!this.accordionStyleApplied) {
            this.applyAccordionStyling();
        }
    }

    // Lifecycle hook that runs when the component is removed from DOM (Cancel button OR "X" button)
    disconnectedCallback() {
        if (!this.emailSentSuccessfully) {
            // Identify files uploaded in this session
            const newUploads = this.uploadedFiles.filter(f => f.isNewUpload).map(f => f.id);
            
            if (newUploads.length > 0) {
                // Fire and forget - clean up files because email wasn't sent
                deleteContentDocuments({ contentDocumentIds: newUploads })
                    .catch(error => {
                        console.error('Error cleaning up files on disconnect', error);
                    });
            }
        }
    }

    // --- Init ---
    @wire(getInitialData, { recordId: '$recordId' })
    wiredInitData({ error, data }) {
        if (data) {
            this.baseUrl = data.baseUrl;
            this.templateOptions = data.emailTemplates.map(t => ({ label: t.Name, value: t.Id }));
            this.fromOptions = data.orgWideAddresses.map(addr => ({ label: addr.DisplayName + ' <' + addr.Address + '>', value: addr.Id }));
            
            if(this.fromOptions.length > 0) this.selectedFromAddress = this.fromOptions[0].value;
            if(this.templateOptions.length > 0) {
                this.selectedTemplateId = this.templateOptions[0].value;
            }

            // Auto-populate To address if a contact is found on the Bid
            if(data.defaultContactId) {
                this.selectedToId = data.defaultContactId;
            }

            console.log('Initial Data Loaded:', JSON.stringify(data));
            

            // Only trigger default body generation if we have the necessary data
            if(this.selectedTemplateId) {
                this.fetchAndRenderTemplate(); 
                this.generateDefaultBody();
            }

        } else if (error) {
            this.showToast('Error', 'Error loading initial data', 'error');
        }
    }

    // --- Computed Properties ---
    get isSendDisabled() {
        const hasTemplate = !!this.selectedTemplateId;
        const hasFrom = !!this.selectedFromAddress;
        const hasTo = !!this.selectedToId;
        const hasSubject = !!this.subject;
        const hasBody = !!this.emailBody;

        return !(hasTemplate && hasFrom && hasTo && hasSubject && hasBody);
    }

    get sendButtonClass() {
        // Use user-defined colors: #5e5adb (Header Purple) for active, Gray for disabled
        return this.isSendDisabled 
            ? 'footer-btn secondary btn-disabled' 
            : 'footer-btn secondary btn-active';
    }

    get hasFiles() {
        return this.uploadedFiles.length > 0;
    }

    // --- Event Handlers ---

    handleTemplateChange(event) {
        this.selectedTemplateId = event.detail.value;
        this.fetchAndRenderTemplate();
        this.generateDefaultBody();
    }

    handleFromChange(event) {
        this.selectedFromAddress = event.detail.value;
    }

    handleSubjectChange(event) {
        this.subject = event.detail.value;
    }

    handleBodyChange(event) {
        this.emailBody = event.detail.value;
    }

    handleToChange(event) {
        this.selectedToId = event.detail.recordId;
        
        if (this.selectedTemplateId) {
            this.fetchAndRenderTemplate();
        }

        // If body is empty, generate from scratch. 
        if (!this.emailBody || this.emailBody.trim() === '') {
            this.generateDefaultBody();
        } else {
            this.updateBodyWithNewContact();
        }
    }

    // Multi-select Handlers
    handleCcSelect(event) {
        this.activePicker = 'CC';
        this.selectedRecordId = event.detail.recordId;
    }

    handleBccSelect(event) {
        this.activePicker = 'BCC';
        this.selectedRecordId = event.detail.recordId;
    }

    handleCcRemove(event) {
        const itemName = event.detail.item.name;
        this.ccItems = this.ccItems.filter(item => item.name !== itemName);
    }

    handleBccRemove(event) {
        const itemName = event.detail.item.name;
        this.bccItems = this.bccItems.filter(item => item.name !== itemName);
    }

    handleSectionToggle(event) {
        this.activeSectionName = event.detail.openSections;
    }

    // --- Template Rendering (Preview Only) ---
    fetchAndRenderTemplate() {
        if (!this.selectedTemplateId) return;
        this.isLoading = true;
        renderEmailTemplate({ templateId: this.selectedTemplateId, whoId: this.selectedToId || null, whatId: this.recordId })
            .then(result => {
                this.subject = result.subject;
                // Only update the Preview variable, NOT the emailBody input
                this.templatePreviewHtml = result.body;
            })
            .catch(error => this.showToast('Error', 'Error rendering template', 'error'))
            .finally(() => this.isLoading = false);
    }

    // --- Default Body Generation (Fresh) ---
    generateDefaultBody() {
        if (!this.recordId || !this.selectedTemplateId) return;

        // Fetch Contact/Contact Name for greeting
        getContactName({ contactId: this.selectedToId })
            .then(name => {
                const safeName = name || '';
                const contactParam = this.selectedToId ? this.selectedToId : '';
                // Dynamic URL Construction
                const dynamicUrl = `${this.baseUrl}?recordID=${this.recordId}&templateId=${this.selectedTemplateId}&contactId=${contactParam}`;
                
                // Construct the HTML Body
                this.emailBody = `Hi ${safeName},<br/>Please <a href="${dynamicUrl}">click here</a> to view and accept your proposal.`;
            })
            .catch(error => {
                console.error('Error fetching contact name', error);
                const contactParam = this.selectedToId ? this.selectedToId : '';
                const dynamicUrl = `${this.baseUrl}/apex/ProposalPage?recordID=${this.recordId}&templateId=${this.selectedTemplateId}&contactId=${contactParam}`;
                this.emailBody = `Hi,<br/><br/>Please <a href="${dynamicUrl}">click here</a> to view and accept your proposal.`;
            });
    }

    // --- Update Body (Preserve Edits) ---
    updateBodyWithNewContact() {
        if (!this.recordId) return;

        getContactName({ contactId: this.selectedToId })
            .then(name => {
                const newName = name || '';
                let tempBody = this.emailBody;

                // 1. Update Greeting (Assumes "Hi [Name]," format)
                // Looks for "Hi " followed by any text until a comma
                if (tempBody.includes('Hi ')) {
                    const greetingRegex = /Hi .*?,/;
                    tempBody = tempBody.replace(greetingRegex, `Hi ${newName},`);
                }

                // 2. Update Link Parameter (contactId=...)
                // Finds "contactId=" followed by alphanumeric ID characters and replaces them
                const linkRegex = /contactId=[a-zA-Z0-9]*/;
                if(this.selectedToId) {
                    tempBody = tempBody.replace(linkRegex, `contactId=${this.selectedToId}`);
                    console.log('Updated body with new contact ID:', this.selectedToId + '---'+ tempBody);
                    
                } else {
                    // If contact removed, just clear the ID in url
                    tempBody = tempBody.replace(linkRegex, `contactId=`);
                    console.log('no body with new contact ID:', this.selectedToId + '---'+ tempBody);
                }

                this.emailBody = tempBody;
            })
            .catch(error => {
                console.error('Error updating body with new contact', error);
            });
    }

    // --- Standard Upload Handling ---
    handleUploadFinished(event) {
        const newFiles = event.detail.files;
        const newFileIds = newFiles.map(file => file.documentId);
        
        // Fetch details (size) for validation
        getUploadedFileDetails({ contentDocumentIds: newFileIds })
            .then(fileDetails => {
                let currentTotalSize = this.uploadedFiles.reduce((acc, file) => acc + (file.size || 0), 0);
                let newUploadSize = fileDetails.reduce((acc, file) => acc + (file.size || 0), 0);
                
                if (currentTotalSize + newUploadSize > MAX_FILE_SIZE) {
                    this.showToast('Error', 'Total attachment size cannot exceed 25MB.', 'error');
                    // Delete the files that were just uploaded because they break the limit
                    deleteContentDocuments({ contentDocumentIds: newFileIds });
                    return;
                }

                const newFileList = fileDetails.map(file => ({
                    id: file.docId, // ContentDocumentId
                    name: file.title + '.' + file.extension,
                    icon: this.getFileIcon(file.title + '.' + file.extension),
                    size: file.size,
                    isNewUpload: true // Flag to indicate we should delete this if removed
                }));
                this.uploadedFiles = [...this.uploadedFiles, ...newFileList];
                this.showToast('Success', `${newFiles.length} file(s) uploaded successfully`, 'success');
            })
            .catch(error => {
                console.error(error);
                this.showToast('Error', 'Error validating file size', 'error');
            });
    }

    // --- File Modal Logic ---
    openFileSelectionModal() {
        this.showFileModal = true;
        this.loadRecordFiles();
    }

    closeFileModal() {
        this.showFileModal = false;
        this.recordFiles = [];
    }

    loadRecordFiles() {
        this.isLoadingFiles = true;
        getRecordFiles({ recordId: this.recordId })
            .then(result => {
                const currentFileIds = new Set(this.uploadedFiles.map(f => f.id));
                
                this.recordFiles = result.map(file => ({
                    ...file,
                    icon: this.getFileIcon(file.title + '.' + file.extension),
                    thumbnailUrl: file.isImage ? `/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${file.versionId}` : '',
                    selected: false,
                    size: file.size,
                    alreadyAdded: currentFileIds.has(file.docId),
                    cardClass: `attachment-card ${currentFileIds.has(file.docId) ? 'disabled' : ''}`
                }));
            })
            .catch(error => {
                console.error(error);
                this.showToast('Error', 'Failed to fetch record files', 'error');
            })
            .finally(() => {
                this.isLoadingFiles = false;
            });
    }

    handleFileSelectionInModal(event) {
        const docId = event.currentTarget.dataset.id;
        this.recordFiles = this.recordFiles.map(file => {
            if (file.docId === docId && !file.alreadyAdded) {
                const newSelected = !file.selected;
                return { 
                    ...file, 
                    selected: newSelected, 
                    cardClass: `attachment-card ${newSelected ? 'selected' : ''}` 
                };
            }
            return file;
        });
    }

    get hasRecordFiles() {
        return this.recordFiles && this.recordFiles.length > 0;
    }

    get hasNoSelectedFiles() {
        return !this.recordFiles.some(f => f.selected);
    }

    handleAddSelectedFiles() {
        const selected = this.recordFiles.filter(f => f.selected);
        
        // Validation for size
        let currentTotalSize = this.uploadedFiles.reduce((acc, file) => acc + (file.size || 0), 0);
        let selectedSize = selected.reduce((acc, file) => acc + (file.size || 0), 0);

        if (currentTotalSize + selectedSize > MAX_FILE_SIZE) {
            this.showToast('Error', 'Total attachment size cannot exceed 25MB.', 'error');
            return;
        }

        const formatted = selected.map(f => ({
            id: f.docId,
            name: f.title + (f.extension ? '.' + f.extension : ''),
            icon: f.icon,
            size: f.size,
            isNewUpload: false // Existing file, do not delete on remove
        }));

        this.uploadedFiles = [...this.uploadedFiles, ...formatted];
        this.closeFileModal();
    }

    // --- Removal Logic ---
    handleRemoveFile(event) {
        const fileId = event.detail.name; // ID from pill
        const fileToRemove = this.uploadedFiles.find(f => f.id === fileId);

        if (fileToRemove && fileToRemove.isNewUpload) {
            // Delete from Salesforce if it was just uploaded in this session
            this.isLoading = true;
            deleteContentDocuments({ contentDocumentIds: [fileId] })
                .then(() => {
                    this.removeFromList(fileId);
                    this.showToast('Success', 'File removed', 'success');
                })
                .catch(error => {
                    console.error(error);
                    this.showToast('Error', 'Failed to delete file', 'error');
                })
                .finally(() => this.isLoading = false);
        } else {
            // Just remove from list
            this.removeFromList(fileId);
        }
    }

    removeFromList(fileId) {
        this.uploadedFiles = this.uploadedFiles.filter(f => f.id !== fileId);
    }

    // --- Helper Utils ---
    getFileIcon(fileName) {
        if(!fileName) return 'doctype:attachment';
        const ext = fileName.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) return 'doctype:image';
        if (ext === 'pdf') return 'doctype:pdf';
        if (['doc', 'docx'].includes(ext)) return 'doctype:word';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'doctype:excel';
        return 'doctype:attachment';
    }

    // --- Send Email ---
    handleSendEmail() {
        try{
            console.log('Send Email Clicked');
            
            if (this.isSendDisabled) {
                this.showToast('Error', 'Please fill all required fields', 'error');
                return;
            }
    
            console.log('Validating fields...');
            
            const allValid = [
                    ...this.template.querySelectorAll('.validate-field'),
            ].reduce((validSoFar, inputCmp) => {
                // Check validation for standard inputs and record pickers
                if (inputCmp.reportValidity) {
                    inputCmp.reportValidity();
                    return validSoFar && inputCmp.checkValidity();
                }
                return validSoFar;
            }, true);

            if (!allValid) {
                this.showToast('Error', 'Please fix the errors in the form.', 'error');
                return;
            }
    
            console.log('Fields Validated, Sending Email...');
            this.isLoading = true;
            const fileIds = this.uploadedFiles.map(f => f.id);
            
            // Collect IDs from multi-select pills
            const ccIdList = this.ccItems.map(item => item.name);
            const bccIdList = this.bccItems.map(item => item.name);
    
            sendQuoteEmail({
                toId: this.selectedToId,
                ccIds: ccIdList,
                bccIds: bccIdList,
                subject: this.subject,
                body: this.emailBody,
                fromId: this.selectedFromAddress,
                relatedToId: this.recordId,
                contentDocumentIds: fileIds
            })
            .then(() => {
                this.showToast('Success', 'Email Sent Successfully', 'success');
                // Flag success so disconnectedCallback knows NOT to delete files
                this.emailSentSuccessfully = true;
                
                // Ensure no new uploads are left hanging if we success (they are now sent/attached)
                this.dispatchEvent(new CustomEvent('close'));
            })
            .catch(error => {
                console.error(error);
                this.showToast('Error', 'Failed to send email: ' + (error.body ? error.body.message : error.message), 'error');
            })
            .finally(() => this.isLoading = false);
        }catch(err){
            console.error('Unexpected error in handleSendEmail:', err.stack);
            this.showToast('Error', 'An unexpected error occurred. Please try again.', 'error');
            this.isLoading = false;
        }
    }

    handleClose() {
        // Just close. disconnectedCallback handles the cleanup if emailSentSuccessfully is false.
        this.dispatchEvent(new CustomEvent('close'));
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    overrideSLDS() {
        let style = document.createElement('style');
        style.innerText = `
                .uiModal--medium .modal-container {
                    width: 80%;
                    min-width: min(480px, calc(100% - 2rem));
                    margin-inline: auto;
                }
                .no-apply .modal-container{
                    width: 50%;
                }
                .slds-modal__container{
                    width: 90%;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .slds-p-around--medium {
                    padding: unset !important;
                }
                .slds-modal__header:not(.empty):not(.slds-modal__header_empty){
                    background-color: #5e5adb;
                    color: white;
                    padding: 1.25rem 1.5rem;
                    text-align: center;
                    border-radius: 16px 16px 0px 0px;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }
                .slds-modal__title {
                    font-size: 1.25rem !important;
                    font-weight: 600 !important;
                    margin: 0 !important;
                }
                .slds-modal__footer {
                    display: none !important;
                }
                .cuf-content {
                    padding: unset !important;
                }
                .slds-modal__content{
                    height: unset !important;
                    background-color: white;
                    padding: 0rem;
                }
                .slds-rich-text-editor{
                    overflow: hidden;
                }
        `;
        this.template.host.appendChild(style);
    }

    applyAccordionStyling() {
        try {
            // Create style element if it doesn't exist
            const style = document.createElement('style');
            style.textContent = `
                .accordion-container .section-control {
                    background: rgba(94, 90, 219, 0.9) !important;
                    color: white !important;
                    margin-bottom: 4px;
                    --slds-c-icon-color-foreground-default: #ffffff !important;
                    font-weight: 600 !important;
                    border-radius: 4px;
                    padding: 6px;
                }
                .accordion-container .slds-accordion__summary-content{
                    font-size: medium;
                }
            `;
            const accordionContainer = this.template.querySelector('.accordion-container');
            if (accordionContainer) {
                accordionContainer.appendChild(style);
                this.accordionStyleApplied = true;
            }

        } catch (error) {
            console.error('Error applying accordion styling:', error);
        }
    }

    get variables() {
        return {
            selectedRecordId: this.selectedRecordId
        };
    }

    @wire(graphql, {
        query: gql`
            query searchContact($selectedRecordId: ID) {
                uiapi {
                    query {
                        Contact(
                            where: { Id: { eq: $selectedRecordId } }
                            first: 1
                        ) {
                            edges {
                                node {
                                    Id
                                    Name {
                                        value
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `,
        variables: '$variables'
    })
    wiredGraphQL({ data, errors }) {
        if (errors || !data || (data && data?.uiapi?.query?.Contact?.edges?.length < 1)) {
            return;
        }
        
        const graphqlResults = data.uiapi.query.Contact.edges.map((edge) => ({
            Id: edge.node.Id,
            Name: edge.node.Name.value
        }));

        const contactData = graphqlResults?.[0];
        const newItem = {
            label: contactData.Name,
            name: contactData.Id
        };

        if (this.activePicker === 'CC') {
             // Check for duplicates in CC
             if (!this.ccItems.some(item => item.name === newItem.name)) {
                this.ccItems = [...this.ccItems, newItem];
             }
             // Clear the CC picker
             const picker = this.template.querySelector('[data-id="cc-picker"]');
             if (picker) picker.clearSelection();

        } else if (this.activePicker === 'BCC') {
            // Check for duplicates in BCC
            if (!this.bccItems.some(item => item.name === newItem.name)) {
                this.bccItems = [...this.bccItems, newItem];
            }
            // Clear the BCC picker
            const picker = this.template.querySelector('[data-id="bcc-picker"]');
            if (picker) picker.clearSelection();
        }
        
        // Reset ID so wire doesn't re-fire unexpectedly if we clear logic elsewhere
        this.selectedRecordId = null; 
    }
}