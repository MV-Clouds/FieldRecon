({
    getExpensesData: function (component, event, helper) {
        var action = component.get('c.getExpenses');
        var self = this;
        component.set('v.columns', [
            {
                label: 'Name',
                fieldName: 'URL',
                type: 'url',
                typeAttributes: { label: { fieldName: 'name' }, target: '_blank' }
            },
            { label: 'Amount', fieldName: 'amount', type: 'currency', cellAttributes: { alignment: 'left' } },
            { label: 'Payment Type', fieldName: 'paymentType', type: 'picklist' }
        ]);
        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                component.set("v.secondLevelAccess",true);
                var rows = JSON.parse(response.getReturnValue());

                for (var i = 0; i < rows.length; i++) {
                    rows[i].URL = '/' + rows[i].id;
                }
                component.set('v.expenses', rows);
                component.set('v.totalExpenses', rows.length);
            } else if (state === 'ERROR') {
                component.set("v.secondLevelAccess",false);
                let errMsg = response.getError()[0].message;
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                    try {
                        if(!errMsg.includes('Second')){
                            self.toast.error(response.getError()[0].message);
                        }
                        return;
                    } catch (err) {
                        self.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(action);
    },
    archiveExpenses: function (component, event, helper) {
        var action = component.get('c.archiveExpense');
        var self = this;
        var expId = component.find('expense').get('v.value');
        action.setParams({
            expId: expId
        });
        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                self.toast.success('Success');
                //alert('SUCCESS');
                helper.getExpensesData(component, event, helper);
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                } catch (e) {
                    try {
                        self.toast.error(response.getError()[0].message);
                    } catch (err) {
                        self.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(action);
    }
});