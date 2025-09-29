({
    handleInit: function (component, event, helper) {
        component.set('v.fileList', []);
        helper.getNewExpense(component, event, helper);
    },

    handleSaveExpense: function (component, event, helper) {
        helper.saveExpense(component, event, helper).then(
            $A.getCallback(function (data) {
                component.set('v.expense', data);
                helper.showToast('success', 'Expense saved successfully!');
            }),
            $A.getCallback(function (error) {
                helper.showToast('error', 'Encountered an error creating expense!');
            })
        );
    },

    handleClose: function (component, event, helper) {
        var files = component.get('v.fileList');
        if (files.length == 0) {
            helper.showToast('error', 'Please upload receipts!');
        } else {
            $A.get('e.force:closeQuickAction').fire();
        }
    }
});