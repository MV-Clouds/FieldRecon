/**
 * @description       : 
 * @author            : abhinav.gupta@concret.io
 * @group             : 
 * @last modified on  : 12-01-2021
 * @last modified by  : abhinav@concret.io
 * Modifications Log 
 * Ver   Date         Author                      Modification
 * 1.0   10-29-2020   abhinav.gupta@concret.io   Initial Version
**/
import { LightningElement, api } from 'lwc';

export default class LibSpinner extends LightningElement {
    @api alternativeText = 'Loading...';
    @api size  = 'small';
    // spinner to show up on all over the UI vs relative
    @api isGlobal;

    get containerCSS(){
        let css ='';
        css += this.isGlobal ? 'slds-spinner_container slds-is-fixed' : 'slds-is-relative';        
        return css;
    }
    
    get spinnerCSS(){
        let css = 'slds-spinner';
        switch (this.size) {
            case 'xxsmall':
                css += ' slds-spinner_xx-small';
                break;
            
            case 'xsmall':
                css += ' slds-spinner_x-small';
                break;
            
            case 'small':
                css += ' slds-spinner_small';
                break;
            
            case 'medium':
                css += ' slds-spinner_medium';
                break;                

            case 'large':
                css += ' slds-spinner_large';
                break;                
        
            default:
                css += ' slds-spinner_small';
                break;
        }
        return css;
    }
}