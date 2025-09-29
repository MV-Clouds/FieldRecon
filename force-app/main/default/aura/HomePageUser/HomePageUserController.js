({
	doInit: function(component, event, helper) {
		
       	helper.doInit(component, event, helper);
       	helper.getweekData(component,event,helper);
		//helper.getTimeSheetData(component,event,helper);
	},
	handleClick: function(component, event, helper){  
	  
	    helper.onclick(component, event, helper);
	},
    closeModel: function(component, event, helper) {
      // Set isModalOpen attribute to false  
      component.set("v.isModalOpen", false);
    },  
	openingoogle: function(component, event, helper){
		
		var jobAddress = component.get('v.Job');
		window.open('https://www.google.com/maps/search/?api=1&query='+jobAddress[0].location.Street+jobAddress[0].location.City+jobAddress[0].location.State+jobAddress[0].location.PostalCode+jobAddress[0].location.Country);
	},
	
	expandDesc : function(component, event, helper){
	    var temp = document.getElementById(event.getSource().get("v.value")).style.display;
	    if(temp == 'block'){
	        document.getElementById(event.getSource().get("v.value")).style.display = 'none';
	    }else{
	        document.getElementById(event.getSource().get("v.value")).style.display = 'block';
	    }
	},
	expand : function(component, event, helper){
		if(component.get('v.expandWeekDay') == event.currentTarget.dataset.id){
			component.set('v.expandWeekDay',false);	
		}else{
			component.set('v.expandWeekDay',event.currentTarget.dataset.id);
		}
		
	}	
});