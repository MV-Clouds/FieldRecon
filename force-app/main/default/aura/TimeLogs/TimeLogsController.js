({
	doInit : function(component, event, helper) {
        var deviceName = $A.get("$Browser.formFactor");
        component.set("v.deviceType",deviceName);
        if(deviceName == 'DESKTOP'){
            var pageNumber = 1;  
            var pageSize = $A.util.isUndefined(component.find("pageSize").get("v.value")) ? 10 : component.find("pageSize").get("v.value"); 
            
            helper.setLocalTime(component, event, helper);
            helper.getDefalut(component, event, helper, pageNumber, pageSize);
        }else{
            component.set("v.Spinner", false);
        }
        
	},
	
	handleNext: function(component, event, helper) {
	    
        var pageNumber = component.get("v.PageNumber");  
        var pageSize = component.find("pageSize").get("v.value");
        pageNumber++;
        helper.getDefalut(component, event, helper, pageNumber, pageSize);
    },
     
    handlePrev: function(component, event, helper) {
        
        var pageNumber = component.get("v.PageNumber");  
        var pageSize = component.find("pageSize").get("v.value");
        pageNumber--;
        helper.getDefalut(component, event, helper, pageNumber, pageSize);
    },
    
     onFilterChange: function(component, event, helper) {
        var pageNumber = 1
        var pageSize = component.find("pageSize").get("v.value");
        helper.getDefalut(component, event, helper, pageNumber, pageSize);
    },
	
	handleSelect: function (component, event, helper) {
	    var pageNumber = 1
        var pageSize = component.find("pageSize").get("v.value");
        
	    component.set("v.isFirst", true);
	    helper.setLocalTime(component, event, helper);
        component.set('v.selectedtab',event.getParam('id'));
        helper.getDefalut(component, event, helper, pageNumber, pageSize);
    },
    
    onStartDateChange: function(component, event, helper) {
        var pageNumber = 1
        var pageSize = component.find("pageSize").get("v.value");
        
        var StartDate   = component.get("v.StartDatebegin");
        var EndDate     = component.get("v.EndDatebegin");
        var StartDate   = new Date();
        
        helper.onDatecompare(component, event, helper , StartDate, EndDate, pageNumber, pageSize);
    },
    
    onEndDateChange: function(component, event, helper) {
        var pageNumber = 1
        var pageSize = component.find("pageSize").get("v.value");
        
        var StartDate   = component.get("v.EndDatebegin");
        var EndDate     = component.get("v.EndDateend");
        
        helper.onDatecompare(component, event, helper , StartDate, EndDate, pageNumber, pageSize);
    },
    
    onLocationOpen: function(component, event, helper) {
        
        window.open('http://maps.google.com?q='+event.target.id);
    },
    
	handleClick: function(component, event, helper){
	    component.set("v.isModalOpen", true);
	},
	
	closeModel: function(component, event, helper) {
      component.set("v.isModalOpen", false);
   },
})