({
    doInit: function(component, event, helper) {
        component.set("v.Spinner",true);
        
        var action = component.get('c.getDefault');
        var weekdayMap = component.get('v.weekdayMap');
        var weekdayMapRev = component.get('v.weekdayMapReverse');

        action.setCallback(this, function(response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                var today = new Date();
                var result = response.getReturnValue();
                today.setDate(today.getDate());

                if (today.getDay() <= weekdayMapRev[result.weekStartDay]) {
                    today.setDate(today.getDate() - 7 + (weekdayMapRev[result.weekStartDay] - today.getDay()));
                    var date = $A.localizationService.formatDate(today, "YYYY-MM-dd");
                    
                    component.set('v.StartDate', date);
                    
                }else if(today.getDay() > weekdayMapRev[result.weekStartDay]) {
                    today.setDate(today.getDate() - today.getDay() + weekdayMapRev[result.weekStartDay]);
                    var date = $A.localizationService.formatDate(today, "YYYY-MM-dd");
                    
                    component.set('v.StartDate', date);
                }
                helper.handleClick(component, event, helper);
            } else if (state === "ERROR"){
                try{
                    helper.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
                    try{
                        helper.toast.error(response.getError()[0].message);
                    }catch(err){
                        helper.toast.error(err.message);
                    }
                }
            }
            component.set("v.Spinner",false);
        });
        $A.enqueueAction(action);
    },
    handleClick: function(component, event, helper) {
        helper.handleClick(component, event, helper);
    },

    createPDF: function(component, event, helper) {
        helper.createPDF(component, event, helper);

    }

})