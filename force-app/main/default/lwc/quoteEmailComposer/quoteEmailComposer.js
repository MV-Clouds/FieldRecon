import { LightningElement, track, api, wire } from 'lwc';
import getInitialData from '@salesforce/apex/QuoteEmailController.getInitialData';
import renderEmailTemplate from '@salesforce/apex/QuoteEmailController.renderEmailTemplate';
import sendQuoteEmail from '@salesforce/apex/QuoteEmailController.sendQuoteEmail';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class QuoteEmailComposer extends LightningElement {
    @api recordId;
    
    // Accordion State (Both Open by Default)
    @track isBodyExpanded = true;
    @track isAttachmentExpanded = true;

    // Dropdown Data
    @track templateOptions = [];
    @track fromOptions = [];

    // Form Selections
    @track selectedTemplateId;
    @track selectedFromAddress;
    @track subject = '';
    @track emailBody = '';
    
    // Record Picker Selections
    @track selectedToId;
    @track selectedCcId;
    @track selectedBccId;

    // Attachments
    @track uploadedFiles = []; // Array of { name, base64, contentType }

    connectedCallback() {
        this.overrideSLDS();
    }

    // --- Data Fetching & Default Selection ---

    @wire(getInitialData)
    wiredInitData({ error, data }) {
        if (data) {
            this.templateOptions = data.emailTemplates.map(t => ({ label: t.Name, value: t.Id }));
            this.fromOptions = data.orgWideAddresses.map(addr => ({ label: addr.DisplayName + ' <' + addr.Address + '>', value: addr.Id }));
            
            // 1. Default From Address
            if(this.fromOptions.length > 0) {
                this.selectedFromAddress = this.fromOptions[0].value;
            }

            // 2. Default Template (First One)
            if(this.templateOptions.length > 0) {
                this.selectedTemplateId = this.templateOptions[0].value;
                this.fetchAndRenderTemplate(); // Render immediately
            }

        } else if (error) {
            this.showToast('Error', 'Error loading initial data', 'error');
            console.error('Init Data Error:', error);
        }
    }

    // --- Computed Properties for UI ---

    // Validate fields to enable/disable button
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

    get bodyPreviewClass() {
        return this.isBodyExpanded ? 'accordion-body' : 'accordion-body collapsed';
    }

    get attachmentPreviewClass() {
        return this.isAttachmentExpanded ? 'accordion-body' : 'accordion-body collapsed';
    }

    get bodyPreviewIcon() {
        return this.isBodyExpanded ? 'utility:chevronup' : 'utility:chevrondown';
    }

    get attachmentPreviewIcon() {
        return this.isAttachmentExpanded ? 'utility:chevronup' : 'utility:chevrondown';
    }

    // --- Event Handlers ---

    handleTemplateChange(event) {
        this.selectedTemplateId = event.detail.value;
        this.fetchAndRenderTemplate();
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
    }

    handleCcChange(event) {
        this.selectedCcId = event.detail.recordId;
    }

    handleBccChange(event) {
        this.selectedBccId = event.detail.recordId;
    }

    // --- Attachment Handling ---

    triggerFileInput() {
        const fileInput = this.template.querySelector('input[data-id="fileInput"]');
        if (fileInput) {
            fileInput.click();
        }
    }

    handleFileSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        // Process files asynchronously
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1]; // Remove 'data:image/png;base64,' header
                this.uploadedFiles.push({
                    name: file.name,
                    base64Data: base64,
                    contentType: file.type || 'application/octet-stream'
                });
                // Trigger reactivity
                this.uploadedFiles = [...this.uploadedFiles]; 
            };
            reader.readAsDataURL(file);
        });
    }

    handleRemoveFile(event) {
        const index = event.detail.name;
        this.uploadedFiles.splice(index, 1);
        this.uploadedFiles = [...this.uploadedFiles]; // Trigger reactivity
    }

    // --- Template Rendering ---

    fetchAndRenderTemplate() {
        if (!this.selectedTemplateId) return;

        const whoId = this.selectedToId || null;
        const whatId = this.recordId;

        renderEmailTemplate({ templateId: this.selectedTemplateId, whoId: whoId, whatId: whatId })
            .then(result => {
                this.subject = result.subject;
                this.emailBody = result.body;
            })
            .catch(error => {
                this.showToast('Error', 'Error rendering template', 'error');
            });
    }

    toggleBodyPreview() {
        this.isBodyExpanded = !this.isBodyExpanded;
    }

    toggleAttachmentPreview() {
        this.isAttachmentExpanded = !this.isAttachmentExpanded;
    }

    // --- Send Email Logic ---

    handleSendEmail() {
        if (this.isSendDisabled) {
            this.showToast('Error', 'Please fill in all required fields.', 'error');
            return;
        }

        // 1. Validations (Input Reports)
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

        // 2. Prepare Data
        const ccIds = this.selectedCcId ? [this.selectedCcId] : [];
        const bccIds = this.selectedBccId ? [this.selectedBccId] : [];

        // 3. Send
        sendQuoteEmail({ 
            toId: this.selectedToId,
            ccIds: ccIds,
            bccIds: bccIds,
            subject: this.subject,
            body: this.emailBody,
            fromId: this.selectedFromAddress,
            relatedToId: this.recordId,
            files: this.uploadedFiles // Pass the files list
        })
        .then(() => {
            this.showToast('Success', 'Email Sent Successfully', 'success');
            this.handleClose();
        })
        .catch(error => {
            console.error('Send Error:', error);
            this.showToast('Error', 'Failed to send email: ' + (error.body ? error.body.message : error.message), 'error');
        });
    }

    handleClose() {
        const closeEvent = new CustomEvent('close');
        this.dispatchEvent(closeEvent);
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
                    border-radius: 4px 4px 0 0;
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
        `;
        this.template.host.appendChild(style);
    }
}