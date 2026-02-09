import { LightningElement, api, track } from 'lwc';

export default class GenericConfirmationModal extends LightningElement {
    @api title = 'Confirm Action';
    @api message = 'Are you sure you want to proceed?';
    @api confirmButtonLabel = 'Confirm';
    @api cancelButtonLabel = 'Cancel';
    @api confirmButtonVariant = 'brand'; // brand, destructive, neutral
    @api isProcessing = false;
    @api showModal = false;
    @api icon = 'utility:info'; // Default info icon
    @api iconVariant = 'info'; // warning, error, success, info
    @api size = 'small'; // small, medium, large
    @api showThreeButtons = false; // Show three buttons instead of two
    @api thirdButtonLabel = 'Third Option'; // Label for third button

    @track internalShowModal = false;

    /**
     * Method Name: get modalClass
     * @description: Dynamic modal class based on size
     */
    get modalClass() {
        let baseClass = 'generic-modal slds-modal slds-fade-in-open';
        if (this.size === 'large') {
            baseClass += ' slds-modal_large';
        } else if (this.size === 'medium') {
            baseClass += ' slds-modal_medium';
        }
        return baseClass;
    }

    /**
     * Method Name: get iconClass
     * @description: Dynamic icon class based on variant
     */
    get iconClass() {
        const variants = {
            'warning': 'slds-icon-text-warning',
            'error': 'slds-icon-text-error',
            'success': 'slds-icon-text-success',
            'info': 'slds-icon-text-default'
        };
        return `slds-icon slds-icon_container ${variants[this.iconVariant] || variants.info}`;
    }

    /**
     * Method Name: get confirmButtonClass
     * @description: Dynamic confirm button class based on variant
     */
    get confirmButtonClass() {
        const variants = {
            'brand': 'clock-in-button',
            'destructive': 'clock-in-button destructive',
            'neutral': 'clock-in-button neutral'
        };
        return variants[this.confirmButtonVariant] || variants.brand;
    }

    /**
     * Method Name: get isModalVisible
     * @description: Determine if modal should be visible
     */
    get isModalVisible() {
        return this.showModal || this.internalShowModal;
    }

    /**
     * Method Name: connectedCallback
     * @description: Component initialization
     */
    connectedCallback() {
        this.internalShowModal = this.showModal;
    }

    /**
     * Method Name: open
     * @description: Public method to open the modal
     */
    @api
    open() {
        this.internalShowModal = true;
    }

    /**
     * Method Name: close
     * @description: Public method to close the modal
     */
    @api
    close() {
        this.internalShowModal = false;
        this.dispatchEvent(new CustomEvent('close'));
    }

    /**
     * Method Name: handleCancel
     * @description: Handle cancel button click
     */
    handleCancel() {
        this.close();
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    /**
     * Method Name: handleConfirm
     * @description: Handle confirm button click
     */
    handleConfirm() {
        this.dispatchEvent(new CustomEvent('confirm'));
    }

    /**
     * Method Name: handleThirdOption
     * @description: Handle third button click (for 3-button mode)
     */
    handleThirdOption() {
        this.dispatchEvent(new CustomEvent('thirdoption'));
    }

    /**
     * Method Name: handleBackdropClick
     * @description: Handle backdrop click to close modal
     */
    handleBackdropClick(event) {
        if (event.target.classList.contains('slds-backdrop')) {
            this.handleCancel();
        }
    }

    /**
     * Method Name: handleKeyDown
     * @description: Handle keyboard events (ESC to close)
     */
    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.handleCancel();
        }
    }
}