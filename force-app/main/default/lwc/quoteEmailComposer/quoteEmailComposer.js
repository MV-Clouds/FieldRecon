import { LightningElement, track, api, wire } from 'lwc';
import getInitialData from '@salesforce/apex/QuoteEmailController.getInitialData';
import renderEmailTemplate from '@salesforce/apex/QuoteEmailController.renderEmailTemplate';
import sendQuoteEmail from '@salesforce/apex/QuoteEmailController.sendQuoteEmail';
import getRecordFiles from '@salesforce/apex/QuoteEmailController.getRecordFiles';
import getContactName from '@salesforce/apex/QuoteEmailController.getContactName';
import deleteContentDocuments from '@salesforce/apex/QuoteEmailController.deleteContentDocuments';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { gql, graphql } from 'lightning/uiGraphQLApi';

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

    connectedCallback() {
        this.overrideSLDS();
    }

    renderedCallback() {
        if (!this.accordionStyleApplied) {
            this.applyAccordionStyling();
        }
    }

    // --- Init ---
    @wire(getInitialData)
    wiredInitData({ error, data }) {
        if (data) {
            this.baseUrl = data.baseUrl;
            this.templateOptions = data.emailTemplates.map(t => ({ label: t.Name, value: t.Id }));
            this.fromOptions = data.orgWideAddresses.map(addr => ({ label: addr.DisplayName + ' <' + addr.Address + '>', value: addr.Id }));
            
            if(this.fromOptions.length > 0) this.selectedFromAddress = this.fromOptions[0].value;
            if(this.templateOptions.length > 0) {
                this.selectedTemplateId = this.templateOptions[0].value;
                this.fetchAndRenderTemplate(); // Renders the preview
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
        if (this.selectedTemplateId) this.fetchAndRenderTemplate();
        this.generateDefaultBody();
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

    // --- Default Body Generation ---
    generateDefaultBody() {
        if (!this.selectedToId || !this.recordId || !this.selectedTemplateId) return;

        // Fetch Contact/Contact Name for greeting
        getContactName({ contactId: this.selectedToId })
            .then(name => {
                // Dynamic URL Construction
                const dynamicUrl = `${this.baseUrl}/apex/ProposalPage?recordID=${this.recordId}&templateId=${this.selectedTemplateId}&contactId=${this.selectedToId}`;
                
                // Construct the HTML Body
                this.emailBody = `Hi ${name},<br/>Please <a href="${dynamicUrl}">click here</a> to view and accept your proposal.`;
            })
            .catch(error => {
                console.error('Error fetching contact name', error);
                // Fallback if name fetch fails
                const dynamicUrl = `${this.baseUrl}/apex/ProposalPage?recordID=${this.recordId}&templateId=${this.selectedTemplateId}&contactId=${this.selectedToId}`;
                this.emailBody = `Hi,<br/><br/>Please <a href="${dynamicUrl}">click here</a> to view and accept your proposal.`;
            });
    }

    // --- Standard Upload Handling ---
    handleUploadFinished(event) {
        const newFiles = event.detail.files;
        const newFileList = newFiles.map(file => ({
            id: file.documentId, // ContentDocumentId
            name: file.name,
            icon: this.getFileIcon(file.name),
            isNewUpload: true // Flag to indicate we should delete this if removed
        }));
        this.uploadedFiles = [...this.uploadedFiles, ...newFileList];
        this.showToast('Success', `${newFiles.length} file(s) uploaded successfully`, 'success');
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
        const formatted = selected.map(f => ({
            id: f.docId,
            name: f.title + (f.extension ? '.' + f.extension : ''),
            icon: f.icon,
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
                this.handleClose();
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