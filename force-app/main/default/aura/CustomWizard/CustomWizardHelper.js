({
	doInitHelper : function(component, event, helper) {
        component.set("v.showSpinner", true);
        var self = this;
        
		var action = component.get("c.fetchUser");
        
        action.setCallback(this, function(response) {
            var state = response.getState();            
            if (state === "SUCCESS"){
                //var arr = [];
                var oRes = response.getReturnValue();

                component.set('v.listOfAllUsersForFilter', oRes);
                component.set('v.listOfAllUsersMain', oRes); 
                component.set("v.showSpinner", false);
                helper.setPagination(component, event, helper, oRes);
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
	
	setPagination : function(component, event, helper, oRes){
	    component.set("v.listOfAllUsersForFilter", oRes);
            var temp = [];
            for(var i=0;i<oRes.length;i++){
                if(component.get("v.pageSize") <= i){
                    break;
                }
                temp.push(oRes[i]);
            }
            component.set("v.showSpinner", false);
            component.set('v.pageNumber', 1);
            component.set('v.dataSize', oRes.length);
            component.set('v.listOfAllUsers', temp);
            helper.pageRecord(component, event, helper);
	},
	
	getDefaultValues : function(component, event, helper) {
	     var action = component.get("c.getMaxindicatordistance");
         var self = this;

        action.setCallback(this, function(responsed) {
            var state = responsed.getState();            
            if (state === "SUCCESS"){
                var mid = responsed.getReturnValue();
                component.set('v.DefalutValues', mid);
            } else if (state === "ERROR"){
                try{
                    self.toast.error(JSON.parse(responsed.getError()[0].message).message);
                }catch(e){
                    try{
                        self.toast.error(responsed.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }
        });
        $A.enqueueAction(action);
	 },
	 
	 saveDefaultValues : function(component, event, helper) {
        var action = component.get("c.updateDefaultValues");
        
        action.setParams({ 
            "DefalutValues": component.get("v.DefalutValues")
        });
        var self = this;
        
        action.setCallback(this, function(responsed) {
            var state = responsed.getState();
            if (state === "SUCCESS") {
                component.set("v.DefalutValues",responsed.getReturnValue()); 
                self.toast.success('Default values has been updated successfully');
            }else if(state === "ERROR"){
                try{
                    self.toast.error(JSON.parse(responsed.getError()[0].message).message);
                }catch(e){
                    try{
                        self.toast.error(responsed.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }                                                
        });
        $A.enqueueAction(action);
	 },
	 
	 Stratweekday : function(component, event, helper) {
        var action = component.get("c.updateStartweekday");
        var self = this;
        
        action.setParams({ 
            "startWeekDay": component.get("v.StartWeekDay")
        });
        
        action.setCallback(this, function(responsed) {
            var state = responsed.getState();

            if (state === "SUCCESS") {
                component.set("v.StartWeekDay",responsed.getReturnValue()); 
                toastEvent.fire();
            }else if(state === "ERROR"){
                try{
                    self.toast.error(JSON.parse(responsed.getError()[0].message).message);
                }catch(e){
                    try{
                        self.toast.error(responsed.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
                }
            }                                               
        });
        $A.enqueueAction(action);
	 },
	 
// 	 Code By Mitesh **************************************************************
    
    customDefaultTimes : function(component, event, helper) {
        var action = component.get("c.getDefaultTimes");
        var self = this;

        action.setCallback(this, function(response) {
            var state = response.getState();            
            if (state === "SUCCESS"){
                //var arr = [];
                var dTime = response.getReturnValue();
                component.set('v.jobDefaultTimes', dTime); 
            }else if(state === "ERROR"){
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
    
    customReimbursement : function(component, event, helper) {
        var action = component.get("c.getReimbursements");
        var self = this;

        action.setCallback(this, function(response) {
            var state = response.getState();            
            if (state === "SUCCESS"){
                //var arr = [];
                var remb = response.getReturnValue();
                component.set('v.jobReimbursement', remb); 
            }else if(state === "ERROR"){
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
    
    reimbursementData : function(component, event, helper){
        var ReimbursementValue = component.get("v.jobReimbursement");
        var action = component.get("c.updateReimbursement");
        var self = this;

        action.setParams({ 
            "rembsMent": ReimbursementValue
        });

        action.setCallback(this, function(response) {
            var state = response.getState();

            if (state === "SUCCESS") {
                component.set("v.jobReimbursement",response.getReturnValue()); 
                
            }else if(state === "ERROR"){
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

    filterProcess : function(component, event, helper, data, term, searchField){
        var results = data, regex;
        var self = this;

        try{
            regex = new RegExp(term, "i");

            if(searchField == 'name'){
                results = data.filter(row=>regex.test(row.name));
            }
            else if(searchField == 'active')
            {
                results = data.filter(row=>regex.test(row.active));
            }
        }catch(e){
            try{
                        self.toast.error(response.getError()[0].message);
                    }catch(err){
                        self.toast.error(err.message);
                    }
        }
        return results;
    },
    
    /* passLocaleValue : function(component, event, helper) {  
        var sl = component.get('v.selectLocale');
        component.set('v.orgDetail.DefaultLocaleSidKey',sl);
    }, */
    
    passUserLocalValue : function(component, event, helper) {
        var sl1 = component.get('v.selectUserLocale');
        component.set('v.userDetail.locale',sl1);
    },
    
    /* passLanguageValue : function(component, event, helper) {  
        var slang = component.get('v.selectLanguage');
        component.set('v.orgDetail.LanguageLocaleKey',slang);
    }, */
    
    passUserLanguageValue : function(component, event, helper) {
        var slang1 = component.get('v.selectUserLanguage');
        component.set('v.userDetail.languageLocale',slang1);
    },
    
    /* passTimeZoneValue : function(component, event, helper) {  
        var st = component.get('v.selectTimeZone');
        component.set('v.orgDetail.TimeZoneSidKey',st);
    }, */
    
    passUserTimeZoneValue : function(component, event, helper) {  
        var st1 = component.get('v.selectUserTimeZone');
        component.set('v.userDetail.timezone',st1);
    },
    
    passRoleValue : function(component, event, helper) {  
        var sr = component.get('v.selectRole');
        component.set('v.userDetail.userRoleId',sr);
    },
    
    passULValue : function(component, event, helper) {  
        var sul = component.get('v.selectUserLicense');
        component.set('v.userDetail.Profile.UserLicense.Id',sul);
    },
    
    passProfileValue : function(component, event, helper) {
        var sp = component.get('v.selectProfile');
        component.set('v.userDetail.profileId',sp);
    },
    
    passEmailEncodingValue : function(component, event, helper) {
        var see = component.get('v.selectEmailEncoding');
        component.set('v.userDetail.emailEncodingKey',see);
    },

    fetchOrgTimeZone : function(component, event, helper) {
    	var action = component.get("c.fetchOrgTZone");
        var self = this;

        action.setCallback(this, function(response) {
            var state = response.getState();
            if(state === "SUCCESS"){
                var arr = response.getReturnValue();               
                component.set("v.orgTimeZone",arr.timeZone);
                component.set("v.orgLan",arr.language);
                component.set("v.orgLocale",arr.locale);
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
    
    inActivateUser : function(component, event, helper) {
        var idx    = event.getSource().get('v.name');
        
        var inActive = component.get('v.activeInActive');
        var self = this;
        var action = component.get("c.activeInActiveUser");
        action.setParams({"uId": idx,"inActivate":inActive});
        action.setCallback(this, function(response) {
            var state = response.getState();
            if(state === "SUCCESS"){
                var result = response.getReturnValue();
                component.set("v.userDetail", response.getReturnValue());
                helper.doInitHelper(component,event, helper);
               
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
    
    fetchUserAllDetail : function(component, event, helper) {
        var idx    = event.getSource().get('v.name');
        var self = this;
        var action = component.get("c.fetchAllUserDetails");
        action.setParams({"uId": idx});
        action.setCallback(this, function(response) {
            var state = response.getState();
            if(state === "SUCCESS"){
                var result = response.getReturnValue();
                component.set("v.userDetail", response.getReturnValue());
                component.set("v.emailField",component.get("v.userDetail.email"));
                component.set("v.isModalOpen", true);
                
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
    
    fetchbasicUserDetail : function(component, event, helper) {
    
        var idx = event.getSource().get("v.name");
        var self = this;
        var action = component.get("c.fetchAllUserDetails");
        
        action.setParams({"uId": idx});
        action.setCallback(this, function(response) {
            var state = response.getState();
         
            if(state === "SUCCESS"){
                var result = response.getReturnValue();
                component.set("v.isUserModalOpen", true);
                component.set("v.basicDetail", result);
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
    
    saveUserDetail : function(component, event, helper) {
 		var temp = component.get("v.userDetail.lastName").charAt(0)+component.get("v.userDetail.firstName").substring(0,5);
        component.set("v.userDetail.alias",temp);
    	var userDetail = component.get("v.userDetail");  
        var self = this;
        var action = component.get("c.saveUserDetails");
        action.setParams({ 
            "uWrapper": userDetail
        });
        action.setCallback(this, function(response) {
            var state = response.getState();
            if (state === "SUCCESS") {
                component.set("v.userDetail",response.getReturnValue());
                if(component.get("v.emailField") == component.get("v.userDetail.email")){
                    self.toast.success('User Record has been successfully Inserted or Updated');
                }else{
                    self.toast.success('User Record has been successfully Updated and Sent an email to confirm new email Address');
                }
               
                component.set("v.isModalOpen", false);
                helper.doInitHelper(component,event, helper);
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
        $A.enqueueAction(action);
    },
    
    fetchUserRole : function(component, event, helper) {      
        var action = component.get("c.fetchUserRole");
        var self = this;
        action.setCallback(this, function(response) {
            var state = response.getState();            
            if (state === "SUCCESS"){
                var role = response.getReturnValue();
                component.set('v.listOfAllUserRoles', role); 
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
    
    resetUserPassword : function(component,event, helper){
       
        var idx = event.getSource().get('v.name');
        var self = this;
        var action = component.get("c.changeUserPassword");
    
        action.setParams({"uId": idx});
        
        action.setCallback(this, function(response) {
            self.toast.success('A new password for the following user has been sent via email. The user will be required to enter a new password upon initial login to salesforce.com.');
        if (state === "SUCCESS"){
                self.toast.success('Link send in User Email id..');
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
        $A.enqueueAction(action);
    },
    
    fetchUserLicense : function(component, event, helper) {  
        var self = this;
        var action = component.get("c.fetchUserLicense");
        action.setCallback(this, function(response) {    
            var state = response.getState();            
            if (state === "SUCCESS"){
                var lice = response.getReturnValue();
                component.set('v.listOfAllUserLicense', lice); 
            
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
    
    fetchProfile : function(component, event, helper) {  
        var action = component.get("c.fetchProfile");
        var self = this;
        action.setCallback(this, function(response) {
            var state = response.getState();            
            if (state === "SUCCESS"){
                var pro = response.getReturnValue();
                component.set('v.listOfAllUserProfile', pro); 
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
    
    fetchTime : function(component, event, helper) {
        var action = component.get("c.fetchTimeZone");
        var self = this;
        action.setCallback(this, function(response) {
            var state = response.getState();            
            if (state === "SUCCESS"){
                var tz = response.getReturnValue();
                component.set('v.listOfAllTimeZone', tz); 
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
        $A.enqueueAction(action);
    },
    
    fetchLocale : function(component, event, helper) {
        var action = component.get("c.fetchLocale");
        var self = this;
        action.setCallback(this, function(response) {
            var state = response.getState();            
            if (state === "SUCCESS"){
                var loc = response.getReturnValue();
                component.set('v.listOfAllLocale', loc); 
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
        $A.enqueueAction(action);
    },
    
    fetchLanguage : function(component, event, helper) {
        var action = component.get("c.fetchLanguage");
        var self = this;
        action.setCallback(this, function(response) {
            var state = response.getState();            
            if (state === "SUCCESS"){
                var lang = response.getReturnValue();
                component.set('v.listOfAllLanguage', lang); 
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
        $A.enqueueAction(action);
    },
    
    fetchEmailEncoding : function(component, event, helper) {
        var action = component.get("c.fetchEmailEncoding");
        var self = this;
        action.setCallback(this, function(response) {
            var state = response.getState();            
            if (state === "SUCCESS"){
                var ee = response.getReturnValue();
                component.set('v.listOfAllEmailEncoding', ee); 
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
        $A.enqueueAction(action);
    },
    pageRecord : function(component, event, helper){
        var result = component.get('v.listOfAllUsersForFilter');        
        var pageNumber = component.get('v.pageNumber');
        var pageSize = component.get('v.pageSize');
        var dataSize = component.get('v.dataSize');
        if(dataSize <= pageSize*(pageNumber)){
        	component.set('v.isLastPage',true);     
        }else{
            component.set('v.isLastPage',false); 
        }
        var temp = (pageNumber-1)*pageSize;
        var tempData = [];
        for(var i= temp; i<temp+pageSize ;i++){
            if(result[i] != '' && result[i] != null){
             	tempData.push(result[i]);   
            }
        }   
        component.set('v.listOfAllUsers',tempData);
    }
})