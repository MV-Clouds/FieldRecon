import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getEmailTemplateBody from '@salesforce/apex/EmailTemplateController.getEmailTemplateBody';
import getVFPagePDF from '@salesforce/apex/EmailTemplateController.getVFPagePDF';

export default class BillingPDFGenerator extends LightningElement {
    @api recordId;
    fileName = '';
    @track isLoading = false;
    @track errorMessage = '';
    @track htmlContent = '';

    connectedCallback() {
        this.loadTemplateContent();
    }

    /**
     * Load email template content from Apex
     */
    async loadTemplateContent() {
        this.isLoading = true;
        this.errorMessage = '';

        try {
            const result = await getEmailTemplateBody({ recordId: this.recordId });

            const htmlBody = result?.body;
            this.fileName = result?.billingName ? result.billingName + '.pdf' : 'template.pdf';

            this.htmlContent = htmlBody || '<div>No content available</div>';
            this.renderPreview(this.htmlContent);

        } catch (error) {
            this.errorMessage = 'Error loading template: ' + (error.body?.message || error.message);
            console.error('Error loading template:', error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Render HTML preview in the container
     */
    renderPreview(htmlContent) {
        const previewContainer = this.template.querySelector('.preview-content');
        if (previewContainer) {
            previewContainer.innerHTML = htmlContent;
        }
    }

    /**
     * Handle Download PDF button click
     */
    async handleDownloadPDF() {
        this.isLoading = true;
        const base64Pdf = await getVFPagePDF({ recordId: this.recordId });

        let binaryString = atob(base64Pdf);

        const byteArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            byteArray[i] = binaryString.charCodeAt(i);
        }

        const pdfBlob = new Blob([byteArray], { type: 'application/pdf' });

        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.fileName;
        link.click();
        window.URL.revokeObjectURL(url);
    }

    /**
     * Handle Cancel button click - close modal
     */
    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    /**
     * Show toast notification
     */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({ title, message, variant });
        this.dispatchEvent(event);
    }

    /**
     * Disable download button if library not loaded or no content
     */
    get isDownloadDisabled() {
        return !this.htmlContent || this.isLoading;
    }
}