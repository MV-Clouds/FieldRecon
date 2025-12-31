import { LightningElement, track, api, wire } from 'lwc';
import getInitialData from '@salesforce/apex/QuoteEmailController.getInitialData';
import renderEmailTemplate from '@salesforce/apex/QuoteEmailController.renderEmailTemplate';
import sendQuoteEmail from '@salesforce/apex/QuoteEmailController.sendQuoteEmail';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class QuoteEmailComposer extends LightningElement {
    @api recordId;
    
    // Accordion State
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
    @track ccCurrentUser = false;

    // Record Picker Selections
    @track selectedToId;
    @track selectedCcId;
    @track selectedBccId;

    connectedCallback() {
        this.overrideSLDS();
    }

    // --- Data Fetching ---

    @wire(getInitialData)
    wiredInitData({ error, data }) {
        if (data) {
            this.templateOptions = data.emailTemplates.map(t => ({ label: t.Name, value: t.Id }));
            this.fromOptions = data.orgWideAddresses.map(addr => ({ label: addr.DisplayName + ' <' + addr.Address + '>', value: addr.Id }));
            
            // Set Default From Address if available
            if(this.fromOptions.length > 0) {
                this.selectedFromAddress = this.fromOptions[0].value;
            }
        } else if (error) {
            this.showToast('Error', 'Error loading initial data', 'error');
            console.error('Init Data Error:', error);
        }
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

    handleCcUserChange(event) {
        this.ccCurrentUser = event.target.checked;
    }

    // --- Lookup Logic (Record Picker) ---

    handleToChange(event) {
        this.selectedToId = event.detail.recordId;
        // Re-render template if selected because WhoId changed
        if (this.selectedTemplateId) this.fetchAndRenderTemplate();
    }

    handleCcChange(event) {
        this.selectedCcId = event.detail.recordId;
    }

    handleBccChange(event) {
        this.selectedBccId = event.detail.recordId;
    }

    // --- Template Rendering ---

    fetchAndRenderTemplate() {
        if (!this.selectedTemplateId) return;

        // Use selected To contact as WhoId, or null (Apex handles null/dummy)
        const whoId = this.selectedToId || null;
        const whatId = this.recordId;

        renderEmailTemplate({ templateId: this.selectedTemplateId, whoId: whoId, whatId: whatId })
            .then(result => {
                this.subject = result.subject;
                this.emailBody = result.body;
            })
            .catch(error => {
                this.showToast('Error', 'Error rendering template', 'error');
                console.error('Render Error:', error);
            });
    }

    // --- Send Email Logic ---

    handleSendEmail() {
        if (!this.selectedToId) {
            this.showToast('Error', 'Please select a recipient (To)', 'error');
            return;
        }
        if (!this.subject) {
            this.showToast('Error', 'Please enter a subject', 'error');
            return;
        }

        // Prepare Lists for CC/BCC
        const ccIds = this.selectedCcId ? [this.selectedCcId] : [];
        const bccIds = this.selectedBccId ? [this.selectedBccId] : [];

        sendQuoteEmail({ 
            toId: this.selectedToId,
            ccIds: ccIds,
            bccIds: bccIds,
            subject: this.subject,
            body: this.emailBody,
            fromId: this.selectedFromAddress,
            relatedToId: this.recordId
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

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    /** * Method Name: overrideSLDS
    * @description: Overrides default SLDS styles for modal customization (COPIED FROM REFERENCE)
    */
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
                    padding: 0.8rem 1.5rem;
                    text-align: center;
                    flex-shrink: 0;
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

    toggleBodyPreview() {
        this.isBodyExpanded = !this.isBodyExpanded;
    }

    toggleAttachmentPreview() {
        this.isAttachmentExpanded = !this.isAttachmentExpanded;
    }

    handleClose() {
        // Dispatch event to Aura wrapper to close the modal
        const closeEvent = new CustomEvent('close');
        this.dispatchEvent(closeEvent);
    }
}