({
    toggleLookupList : function (component, ariaexpanded, classadd, classremove) {
        //component.find("divLookup").set("v.aria-expanded", true);
        $A.util.addClass(component.find("divLookup"), classadd);
        $A.util.removeClass(component.find("divLookup"), classremove);
    },
     
    searchRecord : function (component, searchText) {
        
        component.find("searchinput").set("v.isLoading", true);        
        var action = component.get("c.searchRecord");
        action.setParams({
            "objectAPIName": component.get("v.objectAPIName"),
            "fieldAPIName":component.get("v.fieldAPIName"),
            "moreFields":component.get("v.subHeadingFieldsAPI"),
            "searchText":searchText,
            "recordLimit":component.get("v.recordLimit"),
            "andConditionField":component.get("v.andConditionField"), 
            "andConditionValue":component.get("v.andConditionValue "),
            "isEqual" : component.get("v.isEqual"),
            "andConditionListField": component.get("v.andConditionListField"),
            "andConditionListValue": component.get("v.andConditionListValue"),
            "andBooleanField": component.get("v.andBooleanField"),
            "isNullType" : component.get("v.isNullType")
        });
         
        action.setCallback(this, function(response) {
            var state = response.getState();
            if(component.isValid() && state === "SUCCESS") {
                if(response.getReturnValue()){
                    component.set("v.matchingRecords", response.getReturnValue());
                    if(response.getReturnValue().length > 0){
                        this.toggleLookupList(component, true, 'slds-is-open', 'slds-combobox-lookup');
                        
                    }
                    component.find("searchinput").set("v.isLoading", false);
                }
            } else if (state === "ERROR"){
                try{
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
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
    getNamespace: function (component, event, helper) {
        var action = component.get('c.getNamespace');
        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                component.set('v.namespaceWithUnderscore', response.getReturnValue());
                component.set('v.namespaceLoaded', true);
            } else if (state === 'ERROR') {
                try {
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
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
    }
})