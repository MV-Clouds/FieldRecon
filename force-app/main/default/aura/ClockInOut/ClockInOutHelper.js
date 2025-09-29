({
    GetDefaultsData : function(component, event, helper) {
        var self = this;
        var action = component.get('c.getDefaults');
        action.setCallback(this, function (response) {
            var state = response.getState();
            
            if (state === "SUCCESS") {
                var data = response.getReturnValue();
                var codeList = data.codeList;
                component.set("v.codeList", codeList);
                component.set("v.codeMap", data.codeMap);
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
                self.GetCrewDetails(component, event, self);
                self.ChangeCodeForUser(component, event, self,codeId);
            } else if (state === "ERROR"){
                component.set("v.secondLevelAccess",false);
                try{
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
                    try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                self.StopWaiting(component, event, self);
            }
        });
        $A.enqueueAction(action);
    },
    GetLocationDefault : function(component, event, helper) {
        var self = this;
        var action = component.get('c.getLocationDefault');
        action.setCallback(this, function (response) {
            var state = response.getState();
            
            if (state === "SUCCESS") {
                var data = response.getReturnValue();
                
                component.set("v.withoutLocation",data);
            } 
        });
        $A.enqueueAction(action);
    },
    GetCrewDetails : function(component, event, helper){
        
        var action = component.get('c.getCrewDetails');
        var self = this;
        action.setParams({
            'jobId': component.get("v.recordId")
        });
        
        action.setCallback(this, function (response) {
            var state = response.getState();
            var defaultCostCode;
            
            if (state === "SUCCESS") {
                var data = response.getReturnValue();
                for(var user of data){
                    user["costCodeChanged"] = false;
                    if(!user.isClockedIn){
                        if(defaultCostCode == undefined || defaultCostCode == null) {
                            for(let i=0; i<user.costCodeList.length;i++){
                                if(user.costCodeList[i].defaultCostCode){
                                    defaultCostCode = user.costCodeList[i].Id;
                                    break;
                                }
                            }
                        }
                        user.timesheet.costCodeId = defaultCostCode;
                    }
                    /*if(user.timesheet.costCodeId == undefined){
                            user.timesheet.costCodeId = "";
                        }*/
                }
                
                component.set("v.crewWrapperList", data);
                component.set("v.crewWrapperListDuplicate",JSON.parse(JSON.stringify(data)));
                helper.StopWaiting(component, event, helper);
            }else if (state === "ERROR"){
                try{
                    self.toast.error(JSON.parse(response.getError()[0].message).message);
                }catch(e){
                    try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);
    },
    
    ChangeCodeForUser : function(component, event, helper,code){
        
        //var code = component.find("mainCodesSelect").get("v.value");
        var changedStatus = false;
        var crewList = component.get("v.crewWrapperList");
        var originalList = component.get("v.crewWrapperListDuplicate");
        var isCostCodeUpdated = component.get("v.costCodeUpdated");
        var codeToSet = "";
        if(code != ""){
            codeToSet = code;
        }
        
        for(var i=0; i<crewList.length; i++){
            if(originalList[i].timesheet.costCodeId != codeToSet && crewList[i].isClockedIn){
                crewList[i].costCodeChanged = true;
                changedStatus = true;
            }
            else if(crewList[i].costCodeChanged){
                crewList[i].costCodeChanged = false;
            }
            crewList[i].timesheet.costCodeId = codeToSet;
            if(changedStatus){
                component.set("v.costCodeUpdated",true);
            }
            if(!changedStatus){
                component.set("v.costCodeUpdated",false);
            }
        }
        /*if(component.get("v.costCodeUpdated") == false){
                self.toast.error("No Cost codes to Update");
            }*/
        component.set("v.crewWrapperList", crewList);
    },
    
    ClockInUser : function(component, event, helper, logEntry){
        var action = component.get('c.updateLogEntries');
        var costCodes = component.get('v.codeDisplayList');
        var self = this;
        if((logEntry.costCodeId == null || logEntry.costCodeId == undefined) && (costCodes != null && costCodes.length >0 )){
            self.toast.error("Please select a Cost Code for the Job!");
            helper.StopWaiting(component, event, helper);
            return;
        }
        action.setParams({
            'timesheet': JSON.stringify(logEntry),
            'latitude': component.get("v.latitude"),
            'longitude': component.get("v.longitude"),
            'clockIn': true
        });
        
        action.setCallback(this, function (response) {
            var state = response.getState();
            
            
            if (state === "SUCCESS") {
                
                var data = response.getReturnValue();
                if(data !== null){
                    var cl = component.get("v.crewWrapperList");
                    
                    for(var i=0; i<cl.length; i++){
                        if(data.contactId == cl[i].crewUser.Id){
                            cl[i].timesheet = data;
                            cl[i].timesheetCurrent = data;
                            cl[i].costCodeChanged = false;
                            cl[i].isClockedIn = true;
                            break;
                        }
                    }
                    component.set("v.crewWrapperList", cl);
                    component.set("v.crewWrapperListDuplicate",JSON.parse(JSON.stringify(cl)));
                }
                helper.StopWaiting(component, event, helper);
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
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);
    },
    
    ClockOutUser : function(component, event, helper, logEntry){
        var action = component.get('c.updateLogEntries');
        
        action.setParams({
            'timesheet': logEntry,
            'latitude': component.get("v.latitude"),
            'longitude': component.get("v.longitude"),
            'clockIn': false
        });
        var self = this;
        
        action.setCallback(this, function (response) {
            var state = response.getState();
            
            if (state === "SUCCESS") {
                
                
                var data = response.getReturnValue();
                var cl = component.get("v.crewWrapperList");
                
                for(var i=0; i<cl.length; i++){
                    if(data.contactId == cl[i].crewUser.Id){
                        cl[i].timesheet = data;
                        cl[i].timesheetCurrent = data;
                        cl[i].costCodeChanged = false;
                        break;
                    }
                }
                component.set("v.crewWrapperList", cl);
                component.set("v.crewWrapperListDuplicate",JSON.parse(JSON.stringify(cl)));
                
                helper.StopWaiting(component, event, helper);
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
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);
    },
    
    OnEventClockInTeam : function(component, event, helper){
        
        var allCrew = component.get("v.crewWrapperList");
        var action = component.get('c.clockInTeam');
        var costCodes = component.get('v.codeDisplayList');
        var self = this;
        
        if(allCrew.length == 0){
            self.toast.warning("No Employees Have been assigned to the Job! Please configure the Job and try again!");
            helper.StopWaiting(component, event, helper);
            return;
        }
        
        for(let i=0;i<allCrew.length;i++){
            if((allCrew[i].timesheet.costCodeId == '' || allCrew[i].timesheet.costCodeId == null || allCrew[i].timesheet.costCodeId == undefined) && (costCodes != null && costCodes.length > 0)){
                self.toast.error("Please select a Cost Code for the Jobs!");
                helper.StopWaiting(component, event, helper);
                return;
            }
        }
        
        action.setParams({
            'crewListString': JSON.stringify(allCrew),
            'latitude': component.get("v.latitude"),
            'longitude': component.get("v.longitude"),
            'jobId': component.get("v.recordId")
        });
        
        action.setCallback(this, function (response) {
            var state = response.getState();
            
            if (state === 'SUCCESS') {
                self.toast.success('Success');
                
                var dataMap = response.getReturnValue();
                var cl = component.get("v.crewWrapperList");
                
                for(var i=0; i<cl.length; i++){
                    var log = dataMap[cl[i].crewUser.Id];
                    if(log != null){
                        cl[i].timesheet = log;
                        cl[i].timesheetCurrent = log;
                        cl[i].isClockedIn = true;
                        cl[i].costCodeChanged = false;
                    }
                }
                
                component.set("v.crewWrapperList", cl);
                component.set("v.crewWrapperListDuplicate",JSON.parse(JSON.stringify(cl)));
                helper.StopWaiting(component, event, helper);
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
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);
    },
    
    OnEventClockOutTeam : function(component, event, helper){
        var allCrew = component.get("v.crewWrapperList");
        var action = component.get('c.clockOutTeam');
        var cl = component.get("v.crewWrapperList");
        var self = this;
        
        action.setParams({
            'crewListString': JSON.stringify(allCrew),
            'latitude': component.get("v.latitude"),
            'longitude': component.get("v.longitude"),
            'jobId': component.get("v.recordId")
        });
        
        action.setCallback(this, function (response) {
            var state = response.getState();
            
            if (state === "SUCCESS") {
                self.toast.success('Success');
                var dataMap = response.getReturnValue();
                for(var i=0; i<cl.length; i++){
                    var log = dataMap[cl[i].crewUser.Id];
                    
                    if(log != null){
                        cl[i].timesheet = log;
                        cl[i].timesheetCurrent = log;
                        cl[i].isClockedIn = false;
                        cl[i].costCodeChanged = false;
                    }
                }
                
                component.set("v.crewWrapperList", cl);
                helper.GetDefaultsData(component, event, helper);
                helper.StopWaiting(component, event, helper);
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
                helper.StopWaiting(component, event, helper);
            }
        });
        $A.enqueueAction(action);
    },
    
    onEventChangeCostCodes : function(component,event,helper){
        var crewList = component.get("v.crewWrapperList");
        var action = component.get('c.updateCostCode');
        var value = event.getSource().get("v.value");
        var index = event.getSource().get("v.name");
        var flag = false;
        var self = this;
        var crewChangeCodes = [];
        if(typeof index == "number"){
            if(crewList[index].timesheet.costCodeId == "" || crewList[index].timesheet.costCodeId == undefined || crewList[index].timesheet.costCodeId == null){
                self.toast.error("Please select a Cost Code for the Jobs!");
                helper.StopWaiting(component, event, helper);
                return;
            }
            if(crewList[index].costCodeChanged && crewList[index].isClockedIn){
                crewChangeCodes.push(crewList[index]);
            }
        }
        else{
            for(var i=0; i<crewList.length; i++){
                if(crewList[i].timesheet.costCodeId == "" || crewList[i].timesheet.costCodeId == undefined || crewList[i].timesheet.costCodeId == null){
                    self.toast.error("Please select a Cost Code for the Jobs!");
                    helper.StopWaiting(component, event, helper);
                    return;
                }
                if(crewList[i].costCodeChanged && crewList[i].isClockedIn){
                    crewChangeCodes.push(crewList[i]);
                }
            }
        }
        action.setParams({
            'crewListString' : JSON.stringify(crewChangeCodes),
            'latitude': component.get("v.latitude"),
            'longitude': component.get("v.longitude"),
            'jobId': component.get("v.recordId")
        });
        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === "SUCCESS"){
                var data = response.getReturnValue();
                var cl = component.get("v.crewWrapperList");
                for(var i=0; i<cl.length; i++){
                    var log = data[cl[i].crewUser.Id];
                    if(log != null){
                        cl[i].timesheet = log;
                        cl[i].timesheetCurrent = log;
                        cl[i].isClockedIn = true;
                        cl[i].costCodeChanged = false;
                    }
                    if(cl[i].costCodeChanged && typeof index == "number") {
                        flag = true;
                    }
                }
                if(!flag){
                    component.set("v.costCodeUpdated",false);
                }
                self.toast.success('Success');
                component.set("v.crewWrapperList", cl);
                component.set("v.crewWrapperListDuplicate",JSON.parse(JSON.stringify(cl)));
            }
            else if (state === "ERROR"){
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
            helper.StopWaiting(component, event, helper);
        });
        $A.enqueueAction(action);
        
    },
    
    checkAccess : function(component, event, helper){
        var accessCheck = component.get('c.checkProfileAccess');
        var self = this;
        
        accessCheck.setParams({
            objName : 'Mobilization__c'
        });
        accessCheck.setCallback(this, function(response){
            var state = response.getState();
            
            if(state === 'SUCCESS'){
                component.set('v.EditFlag',response.getReturnValue().EditFlag);
                component.set('v.ReadFlag',response.getReturnValue().ReadFlag);
                component.set('v.CreateFlag',response.getReturnValue().CreateFlag);
                component.set('v.DeleteFlag',response.getReturnValue().DeleteFlag);
                component.set('v.UserId',response.getReturnValue().UserId);
            }else if (state === "ERROR"){
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
        $A.enqueueAction(accessCheck);
    },
    
    StartWaiting : function(component, event, helper) {
        component.set("v.showSpinner", true);
    },
    
    StopWaiting : function(component, event, helper) {
        component.set("v.showSpinner", false);
    },
    
})