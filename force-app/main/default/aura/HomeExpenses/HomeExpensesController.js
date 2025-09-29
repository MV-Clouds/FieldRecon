({
    doInit: function (component, event, helper) {
        helper.getExpensesData(component, event, helper);
    },

    onSelectChange: function (component, event, helper) {
        var page = 1;
        var pageSize = component.find('pageSize').get('v.value');
        component.set('v.PageSize', pageSize);
    },

    openExpenses: function (component, event, helper) {
        var id = event.currentTarget.dataset.id;
        var navEvt = $A.get('e.force:navigateToSObject');
        navEvt.setParams({
            recordId: id
        });
        navEvt.fire();
    },
    openArchive: function (component, event, helper) {
        if (component.get('v.archive') == event.currentTarget.dataset.id) {
            component.set('v.archive', false);
        } else {
            component.set('v.archive', event.currentTarget.dataset.id);
        }
    },
    onclickExpense: function (component, event, helper) {
        helper.archiveExpenses(component, event, helper);
    }
});