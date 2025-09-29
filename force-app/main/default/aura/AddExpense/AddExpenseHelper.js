({
    getNewExpense: function (component, event, helper) {
        let newExpense = {
            id: '',
            reimbursable: false,
            amount: 0,
            paymentType: '',
            contactId: '',
            transactionDate: '',
            description: '',
            jobId: component.get('v.recordId')
        };
        component.set('v.expense', newExpense);
    },

    saveExpense: function (component, event, helper) {
        let action = component.get('c.saveExpense');
        return new Promise(
            $A.getCallback(function (resolve, reject) {
                action.setParams({ expenseString: JSON.stringify(component.get('v.expense')) });

                action.setCallback(this, function (response) {
                    if (response.getState() === 'SUCCESS') {
                        resolve(JSON.parse(response.getReturnValue()));
                    } else {
                        var errors = response.getError();
                        if (errors[0] && errors[0].message) {
                            reject(errors[0].message);
                        } else {
                            reject('Encountered an error when saving expense!');
                        }
                    }
                });
                $A.enqueueAction(action);
            })
        );
    },

    showToast: function (type, message) {
        var toastEvent = $A.get('e.force:showToast');
        toastEvent.setParams({
            title: type == 'success' ? 'Success!' : 'Error!',
            message: message,
            type: type
        });
        toastEvent.fire();
    }
});