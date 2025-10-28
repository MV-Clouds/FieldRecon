({
    getValues : function (component,event,helper) {
        var record = component.get("v.record");
        console.log(record);
        var subheading = '';
        for(var i=0; i<component.get("v.subHeadingFieldsAPI").length; i++ ){
            if(record[component.get("v.namespaceWithUnderscore")+component.get("v.subHeadingFieldsAPI")[i]]){
                subheading = subheading + record[component.get("v.namespaceWithUnderscore")+component.get("v.subHeadingFieldsAPI")[i]] + ' - ';
            }
        }
        subheading = subheading.substring(0,subheading.lastIndexOf('-'));
        component.set("v.subHeadingFieldValues", subheading);
    },
     
    handleSelect : function (component,event) {
        var chooseEvent = component.getEvent("lookupSelect");
        chooseEvent.setParams({
            "recordId" : component.get("v.record").Id,
            "recordName":component.get("v.record").Name
        });
        chooseEvent.fire();
    }
})