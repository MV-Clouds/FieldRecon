({
    init: function (component, event, helper) {
        helper.fetchData(component);
    },
    handleCancel: function(component, event, helper) {
        helper.fetchData(component);
    },
    handleSave: function(component, event, helper) {
        helper.saveData(component);
    },
    validateInput : function(component, event, helper) {
        var allValid = component.find('user-input').reduce(function (validSoFar, inputCmp) {
            inputCmp.reportValidity();
            return validSoFar && inputCmp.checkValidity();
        }, true);
        component.set("v.validInput", allValid);
    },
})