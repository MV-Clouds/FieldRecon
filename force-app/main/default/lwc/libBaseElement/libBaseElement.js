/**
 * @description       :
 * @author            : abhinav@concret.io
 * @group             :
 * @last modified on  : 12-01-2021
 * @last modified by  : abhinav@concret.io
 * Modifications Log
 * Ver   Date         Author                      Modification
 * 1.0   10-26-2020   abhinav@concret.io   Initial Version
 **/
import { LightningElement, api } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { reduceErrors } from "c/libErrorUtils";
import customResource from '@salesforce/resourceUrl/customResources';
import { loadStyle } from 'lightning/platformResourceLoader';
import { NavigationMixin } from 'lightning/navigation';

export default class LibBaseElement extends NavigationMixin(LightningElement) {
    isProcessing = false;
    errorDetails;
    showToastOnErrors = false;
    @api showIllustration = false;

    renderedCallback() {

        Promise.all([
            loadStyle(this, customResource + '/btn-color.css')
        ])
            .then(() => {
                //why empty?
            })
            .catch(error => {
            });
    }
    /**
     * 	Show Toast
     */
    toast = {
        // internal
        _showToast: (title, message, messageType) => {
            const event = new ShowToastEvent({
                title: title,
                message: message,
                variant: messageType
            });
            this.dispatchEvent(event);
        },
        /*
         * 	In all methods below, only message is sufficient to raise a toast, other params
         * could be passed as required for changes.
         */
        info: (message, title) => {
            this.toast._showToast(title || "Info", message, "info");
        },
        success: (message, title) => {
            this.toast._showToast(title || "Success", message, "success");
        },
        warning: (message, title) => {
            this.toast._showToast(title || "Warning", message, "warning");
        },
        error: (message, title) => {
            this.toast._showToast(title || "Error", message, "error");
        }
    };

    /**
     * 	Show / Hide spinners
     */
    spinner = {
        disabled: false,
        show: () => {
            if (!this.spinner.disabled) this.isProcessing = true;
        },
        hide: () => {
            this.isProcessing = false;
        }
    };

    toErrorObject = (message, cause, stacktrace) => {
        let errObj = {
            message: message,
            cause: cause || "Unknown",
            stacktrace: stacktrace || ""
        };
        return errObj;
    };

    /**
     * Parses {error} into a json object having {cause, message} properties for further use by child components
     * @param {*} errors
     */
    parseError = (error) => {
        let errObj = null;
        let errors = reduceErrors(error);
        if (errors.length > 1) {
            errObj = this.toErrorObject(errors.join(","));
        } else if (errors.length == 1) {
            let errJson = errors[0];
            try {
                errObj = JSON.parse(errJson);
            } catch (err) {
                errObj = this.toErrorObject(errJson);
            }
        }
        return errObj;
    };

    /**
     * Shows a toast error message
     */
    handleError = (error) => {
        this.spinner.hide();
        console.log(error);
        let ctx = this.parseError(error);
        console.log(ctx);
        this.errorDetails = ctx;
        if (this.showToastOnErrors) {
            if (ctx && ctx.message) {
                this.toast.error(ctx.message, ctx.cause);
            } else {
                this.toast.error(ctx);
            }
        }
    };

    /**
     * Makes a remote callout, this makes the rest of LWC JS code simple, as the error handling
     * and other repeated items are handled by this method
     * @param {*} remoteSFCallout pointer to Apex @AuraEnabled method,
     *                              imported via import [pointer] from '@salesforce/apex/[auraenabled class.method]';
     * @param {*} remotePromiseParams any params as a JSON object, that must be passed to the `remoteSFCallout` function
     * @param {*} throwErrors if TRUE, it will throw errors, or reject promise for errors.
     *                        Don't pass it, or keep it FALSE, if you want LibBase framework to take care of error handling.
     */
    async remoteCall(remoteSFCallout, remotePromiseParams, throwErrors) {
        this.spinner.show();
        this.errorDetails = null;
        let result;
        let isFailed = false;
        try {
            result = await remoteSFCallout(remotePromiseParams);
        } catch (err) {
            isFailed = true;
            this.handleError(err);
        } finally {
           this.spinner.hide();
        }
        return new Promise((resolve, reject) => {
            if (isFailed) {
                if (throwErrors) reject(this.errorDetails);
                if(this.errorDetails.cause == 'Config')
                {
                    this.showIllustration = true;
                }
                else
                {
                    this.showIllustration = false;
                }

            } else {
                resolve(result);
            }
        });
    }

    showError(comp, message){
        comp.setCustomValidity(message);
        comp.reportValidity();
    }

    removeError(comp){
        comp.setCustomValidity('');
        comp.reportValidity();
    }

    @api
    navigateToContactRoles(oppId){
        this[NavigationMixin.Navigate]({
            type: 'standard__recordRelationshipPage',
            attributes: {
                recordId: oppId,
                objectApiName: 'Opportunity',
                relationshipApiName: 'OpportunityContactRoles',
                actionName: 'view'
            },
        });
    }
}