import { LightningElement, track, api } from 'lwc';

export default class QuoteEmailComposer extends LightningElement {
    @api recordId;
    
    @track isBodyExpanded = true;
    @track isAttachmentExpanded = true;

    connectedCallback() {
        this.overrideSLDS();
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
                    padding: 1.25rem 1.5rem;
                    text-align: center;
                    flex-shrink: 0;
                    border-radius: 16px 16px 0 0;
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