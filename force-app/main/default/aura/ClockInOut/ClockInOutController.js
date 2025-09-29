({
    Init : function(component, event, helper) {
        helper.StartWaiting(component, event, helper);
        helper.GetDefaultsData(component, event, helper);
        helper.checkAccess(component, event, helper);
        helper.GetLocationDefault(component, event, helper);
    },
    
    OnCodeSetChange : function(component, event, helper){
        var setId = event.getSource().get("v.value");
        var codeMap = component.get("v.codeMap");
        var codeList = null;
        
        if(setId != null && setId != ""){
            codeList = codeMap[setId];
        }
        
        var codeId;
        if(codeList != null){
            for(var i=0; i<codeList.length; i++){
                if(codeList[i].defaultCostCode == true || codeList[i].defaultCostCode == "true"){
                    codeId = codeList[i].Id;
                    break;
                }
            }
            component.set("v.codeDisplayList", codeList);
        }else{
            component.set("v.codeDisplayList", null);
        }
        
        
        component.find("mainCodesSelect").set("v.value", codeId);
        
        helper.ChangeCodeForUser(component, event, helper);
        
        var focusElement = component.find("mainCodesSelect");
        focusElement.focus();
    },
    OnCodeChange : function(component, event, helper){
        var value = event.getSource().get("v.value");
        var index = event.getSource().get("v.name");
        if(typeof index == "number"){
            var crewList = component.get("v.crewWrapperList");
            var originalList = component.get("v.crewWrapperListDuplicate");
            if(originalList[index].timesheet.costCodeId != value)
                crewList[index].costCodeChanged = true;
            else crewList[index].costCodeChanged = false;
            crewList[index].timesheet.costCodeId = value;
            component.set("v.crewWrapperList", crewList);
            return;
        }
        helper.ChangeCodeForUser(component, event, helper,value);
    },
    
    ClockInButtonClick : function(component, event, helper){
        console.log('Yess');
        helper.StartWaiting(component, event, helper);
        
        var logEntryUser = event.getSource().get("v.value");
        var index = event.getSource().get("v.name");
        
        if (component.get("v.withoutLocation") != true  && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(success,getError);
            
            function success(position) {
                console.log('success');
                component.set("v.latitude", position.coords.latitude);
                component.set("v.longitude", position.coords.longitude);
                component.set("v.isLocated", true);
                
                var crewList = component.get("v.crewWrapperList");
                
                var log = crewList[index].timesheet;
                log.contactId = logEntryUser;
                log.jobId = component.get("v.recordId");
                
                if(log.costCodeId == ""){
                    log.costCodeId = null;
                }
                
                helper.ClockInUser(component, event, helper, log);
                //crewList[index].isClockedIn = true;
                
                component.set("v.crewWrapperList", crewList);
            }
            function getError(err){
                helper.StopWaiting(component, event, helper);
                console.log('Error');
                component.set("v.isLocated", false);
                console.error(err.code);
                error('Error in fetching location!');
            }
        } 
        else if(component.get("v.withoutLocation")){
            component.set("v.latitude", 0);
            component.set("v.longitude", 0);
            component.set("v.isLocated", false);
            
            var crewList = component.get("v.crewWrapperList");
            
            var log = crewList[index].timesheet;
            log.contactId = logEntryUser;
            log.jobId = component.get("v.recordId");
            
            if(log.costCodeId == ""){
                log.costCodeId = null;
            }
            
            helper.ClockInUser(component, event, helper, log);
            //crewList[index].isClockedIn = true;
            
            component.set("v.crewWrapperList", crewList);
        }
            else {
                component.set("v.isLocated", false);
                helper.StopWaiting(component, event, helper);
                error('Geo Location is not supported');
            }
    },
    
    ClockOutButtonClick : function(component, event, helper){
        helper.StartWaiting(component, event, helper);
        
        var logEntryId = event.getSource().get("v.value");
        var index = event.getSource().get("v.name");
        
        if (component.get("v.withoutLocation") != true && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(success);
            
            function success(position) {
                
                component.set("v.latitude", position.coords.latitude);
                component.set("v.longitude", position.coords.longitude);
                component.set("v.isLocated", true);
                
                var crewList = component.get("v.crewWrapperList");
                var log = crewList[index].timesheet;
                
                helper.ClockOutUser(component, event, helper, JSON.stringify(log));
                crewList[index].isClockedIn = false;
                
                component.set("v.crewWrapperList", crewList);
            }
        } 
        else if(component.get("v.withoutLocation")) {
            component.set("v.latitude", 0);
                component.set("v.longitude", 0);
                component.set("v.isLocated", false);
                
                var crewList = component.get("v.crewWrapperList");
                var log = crewList[index].timesheet;
                
                helper.ClockOutUser(component, event, helper, JSON.stringify(log));
                crewList[index].isClockedIn = false;
                
                component.set("v.crewWrapperList", crewList);
        }
            else {
            component.set("v.isLocated", false);
            helper.StopWaiting(component, event, helper);
            error('Geo Location is not supported');
        }
    },
    
    OnEventClockInTeam : function(component, event, helper){
        
        var options = {
            timeout: 1000
        };
        if (component.get("v.withoutLocation") != true && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition($A.getCallback(success),getError,options);
            
            function success(position) {
                helper.StartWaiting(component, event, helper);
                component.set("v.latitude", position.coords.latitude);
                component.set("v.longitude", position.coords.longitude);
                component.set("v.isLocated", true);
                helper.OnEventClockInTeam(component, event, helper);
            }
            function getError(err){
                component.set("v.isLocated", false);
                console.error(err.code);
                error('Error in fetching location!');
            }
        }
        else if(component.get("v.withoutLocation") ) {
             helper.StartWaiting(component, event, helper);
                component.set("v.latitude", 0);
                component.set("v.longitude", 0);
                component.set("v.isLocated", false);
                helper.OnEventClockInTeam(component, event, helper);
        }
        else {
            component.set("v.isLocated", false);
            error('Geo Location is not supported');
        }
    },
    
    OnEventClockOutTeam : function(component, event, helper){
        
        
        if (component.get("v.withoutLocation") != true && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition($A.getCallback(success));
            
            function success(position) {
                helper.StartWaiting(component, event, helper);
                component.set("v.latitude", position.coords.latitude);
                component.set("v.longitude", position.coords.longitude);
                component.set("v.isLocated", true);
                helper.OnEventClockOutTeam(component, event, helper);
            }
        } 
        else if(component.get("v.withoutLocation")){
            helper.StartWaiting(component, event, helper);
                component.set("v.latitude", 0);
                component.set("v.longitude", 0);
                component.set("v.isLocated", false);
                helper.OnEventClockOutTeam(component, event, helper);
        }
            else {
            component.set("v.isLocated", false);
            
            error('Geo Location is not supported');
        }
    },
    CostCodeChangeClick: function(component, event, helper){
        helper.StartWaiting(component, event, helper);
        
        /*var logEntryId = event.getSource().get("v.value");
        var index = event.getSource().get("v.name");*/
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition($A.getCallback(success));
            
            function success(position) {
                
                component.set("v.latitude", position.coords.latitude);
                component.set("v.longitude", position.coords.longitude);
                component.set("v.isLocated", true);
                helper.onEventChangeCostCodes(component,event,helper);
            }
        } else {
            component.set("v.isLocated", false);
            helper.StopWaiting(component, event, helper);
            error('Geo Location is not supported');
        }
    }
})