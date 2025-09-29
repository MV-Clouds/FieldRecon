/*
Copyright (c) www.concret.io
All rights reserved.
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. The name of the author may not be used to endorse or promote products
   derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE AUTHOR "AS IS" AND ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, 
INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

({
    toast: {
        // internal
        _showToast: function (title, message, messageType, params) {
            var toastEvent = $A.get('e.force:showToast');

            if (toastEvent) {
                try {
                    params = Object.assign(
                        {
                            title: title,
                            message: message,
                            type: messageType,
                            duration: 1000
                        },
                        params
                    );
                    toastEvent.setParams(params).fire();
                } catch(err) {
                    console.log(err);
                }
            }
        },
        /*
         * 	In all methods below, only message is sufficient to raise a toast, other params
         * could be passed as required for changes.
         */

        info: function (message, title, params) {
            this._showToast(title || 'Info', message, 'info', params);
        },
        success: function (message, title, params) {
            this._showToast(title || 'Success', message, 'success', params);
        },
        warning: function (message, title, params) {
            this._showToast(title || 'Warning', message, 'warning', params);
        },
        error: function (message, title, params) {
            this._showToast(title || 'Error', message, 'error', params);
        }
    },
    /*
     * 	Show / Hide spinners
     */
    spinner: {
        disabled: false,
        show: function (component) {
            if (!this.disabled) component.set('v.isProcessing', true);
        },
        hide: function (component) {
            component.set('v.isProcessing', false);
        }
    },
    getNamespace: function (component, event) {
        var action = component.get('c.getNamespace');
        var self = this;
        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                var result = response.getReturnValue();
                component.set('v.namespaceWithUnderscore', result[0]);
                component.set('v.componentNamespace', result[1]);
                component.set('v.srcCalendarURL','/apex/'+result[0]+'CustomCalendar');
            } else if (state === 'ERROR') {
                try {
                    let errors = response.getError();
                    if (errors.length > 0) {
                        self.toast.error(errors[0].message);
                    } else {
                        self.toast.error('Encountered an unexpected error');
                    }
                } catch (e) {
                   try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(action);
    },
    forms : {
        clearError: function(inputElement){
            inputElement.setCustomValidity('');
            inputElement.reportValidity();
        }, 
        setError: function(inputElement, errorMessage) {
            inputElement.setCustomValidity(errorMessage);
            inputElement.reportValidity();
        }
    }
});